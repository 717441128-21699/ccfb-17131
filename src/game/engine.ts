import {
  INITIAL_MEMBERS,
  INITIAL_OWNED_PLAYS,
  INITIAL_PUPPETS,
  INITIAL_RIVALS,
  START_DAY_INDEX,
  YEAR_DAYS,
} from './data';
import type {
  ChoiceOption,
  GameState,
  LedgerCategory,
  LedgerEntry,
  LedgerSource,
  LogTone,
  MemberRole,
  PerformanceDay,
  Role,
  WeatherDay,
  WeatherKind,
  YearSettlement,
} from './types';
import { dateLabel, dateParts, clamp } from './utils';
import {
  affinityKey,
  baseAffinity,
  castReadiness,
  getAffinity,
  getPlay,
  getVillage,
  puppetReadiness,
  routeBetween,
  rivalAtVillage,
} from './world';
import { repairCost, rollShow, hostDailyBase } from './simulation';

export const OWNER_PUBLIC_SHARES = 45; // 班主箱股 30 + 公中香火/公积金 15
const REPLACEMENT_SHARES: Record<Role, number> = {
  qianxian: 12,
  shangshou: 10,
  xiashou: 7,
  huqin: 9,
  luogu: 7,
};

const HIRE_NAMES = [
  '韩秀生', '杨满台', '田一弦', '冯九锣', '吕小签', '常月笙',
  '魏长庚', '蒋云板', '沈灯影', '潘喜来', '姚三弦', '秦小武',
];

export function createInitialState(): GameState {
  const state: GameState = {
    serial: 1000,
    yearName: '光绪二十年 · 甲午',
    dayIndex: START_DAY_INDEX,
    cash: 72,
    reputation: 55,
    currentVillageId: 'taoyuan',
    travel: null,
    activeRunId: null,
    study: null,
    members: structuredClone(INITIAL_MEMBERS),
    puppets: structuredClone(INITIAL_PUPPETS),
    ownedPlayIds: [...INITIAL_OWNED_PLAYS],
    learnedAt: Object.fromEntries(INITIAL_OWNED_PLAYS.map((id) => [id, 0])),
    affinity: {},
    runs: [],
    days: [],
    ledger: [],
    log: [],
    rivals: structuredClone(INITIAL_RIVALS),
    forecast: [],
    pendingChoice: null,
    settlement: null,
    totalShows: 0,
    totalAudiences: 0,
  };

  const engine = new GameEngine(state);
  state.forecast = Array.from({ length: 7 }, (_, index) =>
    engine.makeWeather(START_DAY_INDEX + index),
  );
  engine.addLog('story', '正月初六，戏箱封条刚揭。你带着五把硬手和豆官，落脚桃园堡，只等三月娘娘会。');
  engine.addLog('info', '先在右侧选戏、选天数；也可点邻村赶路。日子每推进一日，饭钱和行情都会走动。');
  return state;
}

type Listener = (state: GameState) => void;

export class GameEngine {
  state: GameState;
  private listeners = new Set<Listener>();

  constructor(state: GameState) {
    this.state = state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener(this.state));
  }

  reset(): void {
    this.state = createInitialState();
    this.emit();
  }

  private uid(prefix: string): string {
    this.state.serial += 1;
    return `${prefix}_${this.state.serial}`;
  }

  addLog(tone: LogTone, text: string): void {
    this.state.log.unshift({
      id: this.uid('log'),
      dayIndex: this.state.dayIndex,
      dateLabel: dateLabel(this.state.dayIndex),
      tone,
      text,
    });
    if (this.state.log.length > 120) this.state.log.length = 120;
  }

  private post(input: {
    direction: LedgerEntry['direction'];
    category: LedgerCategory;
    title: string;
    amount: number;
    note?: string;
    source: LedgerSource;
  }): LedgerEntry {
    const amount = Math.round(input.amount * 10) / 10;
    const entry: LedgerEntry = {
      id: this.uid('led'),
      serial: this.state.serial,
      dayIndex: this.state.dayIndex,
      dateLabel: dateLabel(this.state.dayIndex),
      direction: input.direction,
      category: input.category,
      title: input.title,
      amount,
      note: input.note ?? '',
      source: input.source,
    };
    this.state.ledger.push(entry);
    if (input.direction === 'in') this.state.cash += amount;
    else this.state.cash -= amount;
    return entry;
  }

  makeWeather(dayIndex: number): WeatherDay {
    const { month } = dateParts(dayIndex);
    const r = Math.random();
    let kind: WeatherKind = '晴';
    let rain = false;
    let severe = false;
    let icon = '☀️';

    if (month === 11 || month === 12) {
      if (r < 0.24) {
        kind = '雪'; rain = true; severe = r < 0.08; icon = '❄️';
      } else if (r < 0.55) {
        kind = '多云'; icon = '🌤️';
      } else {
        kind = '晴'; icon = '☀️';
      }
    } else {
      const rainChance = [0, 0.13, 0.15, 0.18, 0.24, 0.3, 0.36, 0.34, 0.22, 0.16, 0.12, 0.1][month - 1];
      if (r < rainChance) {
        const heavy = Math.random() < 0.32;
        kind = heavy ? '大雨' : '小雨';
        rain = true;
        severe = heavy;
        icon = heavy ? '⛈️' : '🌦️';
      } else if (r < rainChance + 0.2) {
        kind = '阴'; icon = '☁️';
      } else if (r < rainChance + 0.42) {
        kind = '多云'; icon = '🌤️';
      }
    }

    return { dayIndex, label: dateLabel(dayIndex), kind, rain, severe, icon };
  }

  private activeMembers() {
    return this.state.members.filter((m) => m.status !== 'left');
  }

  advanceDay(): void {
    if (this.state.settlement || this.state.pendingChoice) return;
    if (this.state.dayIndex >= YEAR_DAYS - 1) {
      this.settleYear();
      return;
    }

    this.state.dayIndex += 1;
    this.state.forecast.shift();
    this.state.forecast.push(this.makeWeather(this.state.dayIndex + 6));
    this.recoverAffinity();

    if (this.state.travel) this.progressTravel();
    else if (this.state.activeRunId) this.progressPerformance();
    else if (this.state.study) this.progressStudy();
    else this.chargeIdle();

    this.tickMembers();
    this.moveRivals();

    if (this.state.dayIndex === YEAR_DAYS - 1) {
      this.addLog('story', '今日已是腊月三十。可在“年终账本”封箱算账，看看这一年能否过个好年。');
    }
    this.emit();
  }

  private recoverAffinity(): void {
    for (const [key, current] of Object.entries(this.state.affinity)) {
      const [villageId, playId] = key.split('::');
      if (!villageId || !playId) continue;
      const base = baseAffinity(getVillage(villageId), getPlay(playId));
      if (current < base) {
        this.state.affinity[key] = clamp(current + Math.max(0.18, (base - current) * 0.04), 0, base);
      }
    }
  }

  depart(toVillageId: string): string | null {
    const s = this.state;
    if (s.settlement) return '今年已经封箱';
    if (s.pendingChoice) return '先决断眼前的班务';
    if (s.travel) return '戏班已经在路上';
    if (s.activeRunId) return '这一村的戏还没唱完';
    if (s.study) return '拜师学艺还没结束';
    const route = routeBetween(s.currentVillageId, toVillageId);
    if (!route) return '只能沿村路到相邻的村子，不能一步跳过';

    s.travel = {
      fromVillageId: s.currentVillageId,
      toVillageId,
      li: route.li,
      totalDays: route.days,
      elapsedDays: 0,
    };
    const village = getVillage(toVillageId);
    this.addLog('info', `启程往${village.name}：旱路${route.li}里，戏箱车日行三十里，约走${route.days}天。`);
    this.emit();
    return null;
  }

  private progressTravel(): void {
    const travel = this.state.travel;
    if (!travel) return;
    travel.elapsedDays += 1;
    const target = getVillage(travel.toVillageId);
    const weather = this.state.forecast[0];
    const cost = 1.25 + this.activeMembers().length * 0.13 + (weather.rain ? 0.7 : 0);
    this.post({
      direction: 'out',
      category: '行路盘缠',
      title: `赶路往${target.name}·第${travel.elapsedDays}天`,
      amount: cost,
      note: weather.rain ? `${weather.kind}，车脚和避雨多花了钱` : '打尖、喂牲口、戏箱车脚',
      source: { type: 'travel', villageId: target.id },
    });
    this.activeMembers().forEach((m) => {
      m.health = clamp(m.health - (weather.rain ? 2.2 : 0.7), 0, 100);
    });
    if (weather.rain) this.addLog('bad', `赶路遇${weather.kind}，戏箱要盖油布，众人淋得狼狈。`);

    if (travel.elapsedDays >= travel.totalDays) {
      this.state.currentVillageId = travel.toVillageId;
      this.state.travel = null;
      this.addLog('good', `戏班一行和一副戏箱平安抵达${target.name}。`);
      this.maybeIllness(0.1);
    }
  }

  startRun(playId: string, days: number): string | null {
    const s = this.state;
    if (s.settlement) return '今年已经封箱';
    if (s.pendingChoice) return '先决断眼前的班务';
    if (s.travel) return '还在路上';
    if (s.activeRunId) return '已有一台戏在唱';
    if (s.study) return '学艺未完';
    const play = getPlay(playId);
    if (!s.ownedPlayIds.includes(playId)) return '还没学会这出戏';
    if (days < 1 || days > 5) return '一次只能约定一至五天';

    const run = {
      id: this.uid('run'),
      villageId: s.currentVillageId,
      playId,
      agreedDays: days,
      startDayIndex: s.dayIndex,
      completed: false,
      dayIds: [] as string[],
      totalIncome: 0,
      totalExpense: 0,
    };
    s.runs.unshift(run);
    s.activeRunId = run.id;
    const village = getVillage(s.currentVillageId);
    this.addLog('story', `${village.name}会首点了《${play.title}》，约定连唱${days}天。明日开台，唱一天便过一日。`);
    this.emit();
    return null;
  }

  private progressPerformance(): void {
    const s = this.state;
    const run = s.runs.find((r) => r.id === s.activeRunId);
    if (!run) {
      s.activeRunId = null;
      return;
    }

    const village = getVillage(run.villageId);
    const play = getPlay(run.playId);
    const weather: WeatherDay = s.forecast[0] ?? this.makeWeather(s.dayIndex);
    const dayId = this.uid('perf');
    const cast = castReadiness(s, play);
    const puppets = puppetReadiness(s, play);
    const stageBlockers = [
      ...cast.missingRoles.map((role) => `缺${role}`),
      ...puppets.missing.map((p) => `缺${p.name}`),
    ];

    if (stageBlockers.length > 0) {
      const day: PerformanceDay = {
        id: dayId,
        runId: run.id,
        dayIndex: s.dayIndex,
        dateLabel: dateLabel(s.dayIndex),
        weather: weather.kind,
        rain: weather.rain,
        playId: play.id,
        villageId: village.id,
        quality: 0,
        appeal: getAffinity(s, village.id, play.id),
        audience: 0,
        capacity: village.population,
        hostFee: 0,
        tips: 0,
        fairBonus: 0,
        rainCompensation: 0,
        compensation: 0,
        income: 0,
        expense: 0,
        canceled: true,
        cancelKind: 'cast',
        reasons: [`${stageBlockers.join('、')}，今日无法开戏`, '合约日数照耗，戏钱和彩钱分文无着，名声也受损伤'],
      };
      s.days.unshift(day);
      run.dayIds.push(day.id);
      s.reputation = clamp(s.reputation - 2.6, 0, 100);
      this.activeMembers().forEach((m) => {
        m.loyalty = clamp(m.loyalty - 0.5, 0, 100);
      });
      this.addLog('bad', `${village.name}的合约到了期，却因${stageBlockers.join('、')}开不了《${play.title}》，只能回戏。`);
    } else if (weather.rain) {
      const compensation = Math.round(hostDailyBase(village) * 0.38 * 10) / 10;
      const day: PerformanceDay = {
        id: dayId,
        runId: run.id,
        dayIndex: s.dayIndex,
        dateLabel: dateLabel(s.dayIndex),
        weather: weather.kind,
        rain: true,
        playId: play.id,
        villageId: village.id,
        quality: 0,
        appeal: getAffinity(s, village.id, play.id),
        audience: 0,
        capacity: village.population,
        hostFee: 0,
        tips: 0,
        fairBonus: 0,
        rainCompensation: compensation,
        compensation,
        income: 0,
        expense: compensation,
        canceled: true,
        cancelKind: 'rain',
        reasons: [`${weather.kind}突至，皮影幕面怕湿，只能停唱`, '按乡规班社包赔会首戏台定钱、供品损失'],
      };
      s.days.unshift(day);
      run.dayIds.push(day.id);
      run.totalExpense += compensation;
      this.post({
        direction: 'out',
        category: '雨灾赔偿',
        title: `${village.name}《${play.title}》雨阻赔偿`,
        amount: compensation,
        note: day.reasons.join('；'),
        source: { type: 'performance', runId: run.id, dayId: day.id, villageId: village.id },
      });
      s.reputation = clamp(s.reputation - 1.2, 0, 100);
      this.addLog('bad', `${village.name}唱起《${play.title}》时遇${weather.kind}，台下四散，按规矩赔了${compensation}元。`);
    } else {
      const recentCount = s.days.filter(
        (d) =>
          d.villageId === village.id &&
          d.playId === play.id &&
          !d.canceled &&
          d.dayIndex > s.dayIndex - 35,
      ).length;
      const beforeAffinity = getAffinity(s, village.id, play.id);
      const result = rollShow(s, village.id, play.id, Math.random);
      s.affinity[affinityKey(village.id, play.id)] = clamp(
        beforeAffinity - (22 + recentCount * 9),
        4,
        98,
      );
      const miscCost = 0.7 + play.difficulty * 0.08;
      const income = result.hostFee + result.tips + result.fairBonus;
      const day: PerformanceDay = {
        id: dayId,
        runId: run.id,
        dayIndex: s.dayIndex,
        dateLabel: dateLabel(s.dayIndex),
        weather: weather.kind,
        rain: false,
        playId: play.id,
        villageId: village.id,
        quality: result.quality,
        appeal: result.affinity,
        audience: result.audience,
        capacity: Math.round(village.population * 1.8),
        hostFee: result.hostFee,
        tips: result.tips,
        fairBonus: result.fairBonus,
        rainCompensation: 0,
        income,
        expense: miscCost,
        canceled: false,
        reasons: result.reasons,
      };
      s.days.unshift(day);
      run.dayIds.push(day.id);
      run.totalIncome += income;
      run.totalExpense += miscCost;

      this.post({
        direction: 'in',
        category: '演出戏钱',
        title: `${village.name}·《${play.title}》${dateLabel(s.dayIndex)}戏钱`,
        amount: result.hostFee,
        note: `会首按唱日给的戏价钱；当日约${result.audience}人，成色${result.quality}分。`,
        source: { type: 'performance', runId: run.id, dayId: day.id, villageId: village.id },
      });
      this.post({
        direction: 'in',
        category: '观众彩钱',
        title: `${village.name}·《${play.title}》观众彩钱`,
        amount: result.tips,
        note: '叫好、挂红、往台上扔的赏钱，按班里老规矩归入公账后分份。',
        source: { type: 'performance', runId: run.id, dayId: day.id, villageId: village.id },
      });
      if (result.fairBonus > 0) {
        this.post({
          direction: 'in',
          category: '庙会赏银',
          title: `${village.name}${village.templeName}赏银`,
          amount: result.fairBonus,
          note: '庙会会首与镇上商户合送的赏银。',
          source: { type: 'performance', runId: run.id, dayId: day.id, villageId: village.id },
        });
      }
      this.post({
        direction: 'out',
        category: '日常饭食',
        title: `${village.name}演出日灯油茶水`,
        amount: miscCost,
        note: '会首管正饭，此为灯油、弦线、茶水和后台杂用。',
        source: { type: 'performance', runId: run.id, dayId: day.id, villageId: village.id },
      });

      s.totalShows += 1;
      s.totalAudiences += result.audience;
      s.reputation = clamp(s.reputation + (result.quality - 68) * 0.075 + (result.quality >= 88 ? 0.5 : 0), 0, 100);

      play.requiredPuppets.forEach((puppetId) => {
        const puppet = s.puppets.find((p) => p.id === puppetId);
        if (puppet) puppet.condition = clamp(puppet.condition - play.wear * (0.72 + Math.random() * 0.55), 1, 100);
      });
      this.activeMembers().forEach((m) => {
        m.health = clamp(m.health - play.difficulty * 0.42 - Math.random() * 1.4, 0, 100);
        if (result.quality >= 82) m.loyalty = clamp(m.loyalty + 0.45, 0, 100);
        if (result.quality <= 52) m.loyalty = clamp(m.loyalty - 1.1, 0, 100);
      });

      this.addLog(
        result.quality >= 80 ? 'good' : result.quality <= 55 ? 'bad' : 'info',
        `${dateLabel(s.dayIndex)}在${village.name}唱《${play.title}》：成色${result.quality}，观众约${result.audience}人，进项${(income).toFixed(1)}元。`,
      );
      this.maybeIllness(result.quality < 58 ? 0.13 : 0.07);
    }

    if (run.dayIds.length >= run.agreedDays) {
      run.completed = true;
      run.endDayIndex = s.dayIndex;
      s.activeRunId = null;
      const canceledCount = s.days.filter((d) => d.runId === run.id && d.canceled).length;
      if (canceledCount > 0) {
        this.addLog('bad', `${village.name}${run.agreedDays}天合约到期，其中${canceledCount}天没能开台；戏班名声和下回台口都受影响。`);
      } else {
        this.addLog('story', `${village.name}${run.agreedDays}天戏圆满收口。戏箱清点完毕，可赶往下一村。`);
      }
      this.maybePoach();
    }
  }

  beginStudy(playId: string): string | null {
    const s = this.state;
    if (s.settlement || s.pendingChoice || s.travel || s.activeRunId || s.study) {
      return '现在还不能拜师学戏';
    }
    if (s.ownedPlayIds.includes(playId)) return '这出戏已经在唱本里';
    const play = getPlay(playId);
    if (s.cash < play.studyCost) return `学费还差${(play.studyCost - s.cash).toFixed(1)}元`;

    this.post({
      direction: 'out',
      category: '拜师学戏',
      title: `拜${play.master}学《${play.title}》`,
      amount: play.studyCost,
      note: `束脩和抄录唱本定钱，预计${play.studyDays}天学成。`,
      source: { type: 'study', villageId: s.currentVillageId },
    });
    s.study = {
      playId,
      master: play.master,
      totalDays: play.studyDays,
      elapsedDays: 0,
      cost: play.studyCost,
    };
    this.addLog('story', `戏班在${getVillage(s.currentVillageId).name}暂住，向${play.master}拜师学《${play.title}》。`);
    this.emit();
    return null;
  }

  private progressStudy(): void {
    const study = this.state.study;
    if (!study) return;
    study.elapsedDays += 1;
    const cost = 0.75 + this.activeMembers().length * 0.08;
    this.post({
      direction: 'out',
      category: '日常饭食',
      title: `学《${getPlay(study.playId).title}》第${study.elapsedDays}天饭食`,
      amount: cost,
      note: '学戏期间不登台，众人吃住和抄谱油烛。',
      source: { type: 'study', villageId: this.state.currentVillageId },
    });
    if (study.elapsedDays >= study.totalDays) {
      const play = getPlay(study.playId);
      if (!this.state.ownedPlayIds.includes(play.id)) this.state.ownedPlayIds.push(play.id);
      this.state.learnedAt[play.id] = this.state.dayIndex;
      this.state.study = null;
      this.addLog('good', `《${play.title}》唱本、总纲和影人套路都已学会，往后可以点唱。`);
    }
  }

  private chargeIdle(): void {
    const cost = 0.9 + this.activeMembers().length * 0.1;
    this.post({
      direction: 'out',
      category: '日常饭食',
      title: '歇班一日饭食店钱',
      amount: cost,
      note: '没有演出，会首不管饭，众人坐吃山空。',
      source: { type: 'daily', villageId: this.state.currentVillageId },
    });
  }

  private tickMembers(): void {
    this.activeMembers().forEach((m) => {
      if (m.status === 'sick') {
        m.sickDays = Math.max(0, m.sickDays - 1);
        if (m.sickDays === 0) {
          m.status = 'ok';
          m.health = Math.max(m.health, 58);
          this.addLog('good', `${m.name}病体好转，已能归场应活。`);
        }
      } else {
        m.health = clamp(m.health + 1.4, 0, 100);
      }
    });
  }

  treatMember(memberId: string): string | null {
    if (this.state.settlement) return '今年已经封箱，不能再动账';
    const m = this.state.members.find((x) => x.id === memberId);
    if (!m || m.status === 'left') return '没有这个人';
    if (this.state.cash < 4) return '公账上不够四元药钱';
    this.post({
      direction: 'out',
      category: '医药调理',
      title: `给${m.name}抓药调理`,
      amount: 4,
      note: '请村中郎中看脉、抓两剂草药，病期缩短，精神也恢复。',
      source: { type: 'member', memberId: m.id, villageId: this.state.currentVillageId },
    });
    m.health = clamp(m.health + 20, 0, 100);
    if (m.status === 'sick') {
      m.sickDays = Math.max(0, m.sickDays - 2);
      if (m.sickDays === 0) m.status = 'ok';
    }
    this.addLog('info', `给${m.name}抓了药，又许他歇半日，身体好转。`);
    this.emit();
    return null;
  }

  rewardMember(memberId: string, amount: number): string | null {
    if (this.state.settlement) return '今年已经封箱，不能再动账';
    const m = this.state.members.find((x) => x.id === memberId);
    if (!m || m.status === 'left') return '没有这个人';
    if (amount <= 0) return '赏钱数目不对';
    if (this.state.cash < amount) return '公账上没有这么多现钱';
    this.post({
      direction: 'out',
      category: '挽留花红',
      title: `赏${m.name}茶钱花红`,
      amount,
      note: '班主私下塞的辛苦钱，最能买住台上人的心意。',
      source: { type: 'member', memberId: m.id, villageId: this.state.currentVillageId },
    });
    m.loyalty = clamp(m.loyalty + amount * 1.35, 0, 100);
    this.addLog('good', `${m.name}接了花红，嘴上不说，往后上场更卖力。`);
    this.emit();
    return null;
  }

  hireReplacement(role: Role, apprentice: boolean): string | null {
    if (this.state.settlement) return '今年已经封箱，不能再动账';
    const cost = apprentice ? 6 : 16;
    if (this.state.cash < cost) return apprentice ? '请学徒也要六元安家钱' : '请把式至少要十六元定银';
    const name = HIRE_NAMES[Math.floor(Math.random() * HIRE_NAMES.length)];
    const id = this.uid('member');
    const member = apprentice
      ? {
          id, name, role: 'xuetu' as MemberRole, covers: [role] as Role[], age: 15 + Math.floor(Math.random() * 4),
          skill: 38 + Math.floor(Math.random() * 14), health: 92, loyalty: 66, shares: 2,
          status: 'ok' as const, sickDays: 0,
          bio: '新托会首寻来的学徒，腿脚勤快，能顶替些基础活路，大戏还压不住。',
        }
      : {
          id, name, role: role as MemberRole, covers: [] as Role[], age: 24 + Math.floor(Math.random() * 24),
          skill: 58 + Math.floor(Math.random() * 13), health: 82, loyalty: 58,
          shares: REPLACEMENT_SHARES[role], status: 'ok' as const, sickDays: 0,
          bio: '搭班而来的把式，手艺稳当，只是初来乍到，还要看班中情分和年底分红。',
        };

    this.post({
      direction: 'out',
      category: '请人入伙',
      title: apprentice ? `收${name}做学徒` : `请${name}补${roleLabel(role)}缺`,
      amount: cost,
      note: apprentice ? '安家钱、拜师礼和头一季穿戴。' : '托会首作保的定银和上路盘缠。',
      source: { type: 'member', memberId: id, villageId: this.state.currentVillageId },
    });
    this.state.members.push(member);
    this.addLog('story', apprentice ? `${name}背着铺盖进班，先学装箱、帮场。` : `${name}正式搭班，补上${roleLabel(role)}这一摊。`);
    this.emit();
    return null;
  }

  repairPuppet(puppetId: string): string | null {
    if (this.state.settlement) return '今年已经封箱，不能再动账';
    const p = this.state.puppets.find((x) => x.id === puppetId);
    if (!p) return '没有这一堂影人';
    const cost = repairCost(p.condition, p.unitCost, p.count);
    if (cost <= 0) return '这一堂影人还新，不必修';
    if (this.state.cash < cost) return '公账不够修影人的钱';
    this.post({
      direction: 'out',
      category: '修补影人',
      title: `修补${p.name}`,
      amount: cost,
      note: '换驴皮、缀关节、补颜色、重上油，修完恢复十成光鲜。',
      source: { type: 'puppet', villageId: this.state.currentVillageId },
    });
    p.condition = 100;
    this.addLog('info', `${p.name}送与皮影匠人修整，关节和颜色都恢复如新。`);
    this.emit();
    return null;
  }

  repairAllPuppets(): string | null {
    if (this.state.settlement) return '今年已经封箱，不能再动账';
    const total = this.state.puppets.reduce(
      (sum, p) => sum + repairCost(p.condition, p.unitCost, p.count),
      0,
    );
    if (total <= 0) return '所有影人都还齐整';
    if (this.state.cash < total) return `全修需要${total}元，公账不足`;
    this.post({
      direction: 'out',
      category: '修补影人',
      title: '全园影人统一检修',
      amount: total,
      note: '箱中影人全数检查，断线、卷边、掉色处一并修补。',
      source: { type: 'puppet', villageId: this.state.currentVillageId },
    });
    this.state.puppets.forEach((p) => { p.condition = 100; });
    this.addLog('good', '一副戏箱修得齐齐整整，台上再不怕影人旧、关节涩。');
    this.emit();
    return null;
  }

  buyPuppet(puppetId: string): string | null {
    if (this.state.settlement) return '今年已经封箱，不能再动账';
    const p = this.state.puppets.find((x) => x.id === puppetId);
    if (!p) return '没有这一堂影人';
    if (this.state.cash < p.unitCost) return '公账不够添新影人的钱';
    this.post({
      direction: 'out',
      category: '新添影箱',
      title: `新添一件${p.name}`,
      amount: p.unitCost,
      note: '从皮影铺子或走乡匠人处新添，可替换旧损件，也让整堂行头更新。',
      source: { type: 'puppet', villageId: this.state.currentVillageId },
    });
    p.condition = Math.round(((p.condition * p.count + 100) / (p.count + 1)) * 10) / 10;
    p.count += 1;
    this.addLog('good', `戏箱里新添了${p.name}，数量增到${p.count}件。`);
    this.emit();
    return null;
  }

  private maybeIllness(chance: number): void {
    const weak = this.activeMembers()
      .filter((m) => m.status === 'ok')
      .sort((a, b) => a.health - b.health);
    const candidate = weak[0];
    if (!candidate) return;
    const adjusted = chance + (70 - candidate.health) / 260;
    if (Math.random() > adjusted) return;
    candidate.status = 'sick';
    candidate.sickDays = 3 + Math.floor(Math.random() * 4);
    candidate.health = clamp(candidate.health - 13, 5, 100);
    this.addLog('bad', `${candidate.name}受了风寒，病倒了，总得将养几日；可在人员页花钱抓药。`);
  }

  private maybePoach(): void {
    if (this.state.pendingChoice) return;
    const target = this.activeMembers()
      .filter((m) => m.loyalty < 62)
      .sort((a, b) => a.loyalty - b.loyalty)[0];
    if (!target) return;
    const force = target.loyalty < 43;
    if (!force && Math.random() > 0.34) return;

    const rival = rivalAtVillage(this.state, this.state.currentVillageId)
      ?? this.state.rivals[Math.floor(Math.random() * this.state.rivals.length)];
    const options: ChoiceOption[] = [
      {
        id: 'redpacket',
        label: '封十八元红包，当众抬他身价',
        detail: '现钱和面子一起给，照例能留住；忠心大涨。',
        cost: 18,
      },
      {
        id: 'drink',
        label: '打酒割肉，拿老情分劝一劝',
        detail: '只花四元，去留要看他平日忠心和一时意气。',
        cost: 4,
      },
      {
        id: 'release',
        label: '强扭的瓜不甜，放行',
        detail: `强扭的瓜不甜，不得罪${rival.name}，但若他是关键行当，近期便有戏唱不了。`,
      },
    ];
    this.state.pendingChoice = {
      id: this.uid('choice'),
      kind: 'poach',
      title: `${rival.name}暗中挖角`,
      body: `${rival.name}的人散戏后请${target.name}吃酒，许了更高的份银。话说得客气，意思却明白：要么${target.name}过班，要么你今夜给个留住的说法。`,
      memberId: target.id,
      rivalId: rival.id,
      options,
    };
    this.addLog('story', `风声不对：${rival.name}正在私下接触${target.name}。`);
  }

  resolveChoice(optionId: string): void {
    const choice = this.state.pendingChoice;
    if (!choice || !choice.memberId) return;
    const member = this.state.members.find((m) => m.id === choice.memberId);
    if (!member) {
      this.state.pendingChoice = null;
      this.emit();
      return;
    }

    if (optionId === 'redpacket') {
      if (this.state.cash < 18) return;
      this.post({
        direction: 'out',
        category: '挽留花红',
        title: `封红包留住${member.name}`,
        amount: 18,
        note: '当众夸他是台柱子，另许年底账目公开、按股分钱。',
        source: { type: 'member', memberId: member.id },
      });
      member.loyalty = clamp(member.loyalty + 28, 0, 100);
      this.addLog('good', `${member.name}收下红包，说班主讲规矩，哪儿也不去了。`);
    } else if (optionId === 'drink') {
      if (this.state.cash < 4) return;
      this.post({
        direction: 'out',
        category: '挽留花红',
        title: `与${member.name}吃酒谈心`,
        amount: 4,
        note: '一壶烧酒、二斤卤肉，提起当年搭班的情分。',
        source: { type: 'member', memberId: member.id },
      });
      const stayChance = 0.28 + member.loyalty / 125;
      if (Math.random() < stayChance) {
        member.loyalty = clamp(member.loyalty + 13, 0, 100);
        this.addLog('good', `酒过三巡，${member.name}红了眼眶，撕了对方的帖子，决意留下。`);
      } else {
        member.status = 'left';
        member.loyalty = 0;
        this.addLog('bad', `${member.name}虽念旧情，终究嫌份银薄，留书过了别的班。`);
      }
    } else {
      member.status = 'left';
      member.loyalty = 0;
      this.addLog('bad', `你放${member.name}离班。这一摊行当空了，需另请人或让学徒顶替。`);
    }

    this.state.pendingChoice = null;
    this.emit();
  }

  private moveRivals(): void {
    this.state.rivals.forEach((rival) => {
      if (this.state.dayIndex < rival.untilDayIndex) return;
      const villages = ['liulin', 'changning', 'xinfeng', 'tielu', 'bajiao', 'fenghe', 'tianjia', 'taoyuan'];
      const nextId = villages[Math.floor(Math.random() * villages.length)];
      const plays = ['sangu', 'zhamei', 'baxian', 'yangjia', 'xiyou', 'bainv'];
      rival.villageId = nextId;
      rival.playId = plays[Math.floor(Math.random() * plays.length)];
      rival.untilDayIndex = this.state.dayIndex + 7 + Math.floor(Math.random() * 9);
      this.addLog('info', `${rival.name}转场到${getVillage(nextId).name}，贴出了《${getPlay(rival.playId).title}》的水牌。`);
    });
  }

  settleYear(): YearSettlement | null {
    if (this.state.settlement) return this.state.settlement;
    const s = this.state;

    const totalIncome = s.ledger.filter((e) => e.direction === 'in').reduce((sum, e) => sum + e.amount, 0);
    const totalExpense = s.ledger.filter((e) => e.direction === 'out').reduce((sum, e) => sum + e.amount, 0);
    const totalPerformanceIncome = s.ledger
      .filter((e) => e.direction === 'in' && ['演出戏钱', '观众彩钱', '庙会赏银'].includes(e.category))
      .reduce((sum, e) => sum + e.amount, 0);
    const operatingNet = Math.round((totalIncome - totalExpense) * 10) / 10;
    const members = this.activeMembers();
    const memberShares = members.reduce((sum, m) => sum + m.shares, 0);
    const totalShares = OWNER_PUBLIC_SHARES + memberShares;
    const bonusPool = Math.max(0, operatingNet);
    const shareUnit = bonusPool / totalShares;
    const payouts = members.map((m) => ({
      memberId: m.id,
      name: m.name,
      role: m.role,
      shares: m.shares,
      amount: Math.round(m.shares * shareUnit * 10) / 10,
    }));

    payouts.forEach((payout) => {
      if (payout.amount <= 0) return;
      this.post({
        direction: 'share',
        category: '年终分账',
        title: `年终分账 · ${payout.name}（${payout.shares}股）`,
        amount: payout.amount,
        note: `全年净余按一百股老规矩分派：班主箱股与公中留${OWNER_PUBLIC_SHARES}股，在场人等按身股拿钱。`,
        source: { type: 'settlement', memberId: payout.memberId },
      });
    });

    const reserveRate = OWNER_PUBLIC_SHARES / totalShares;
    const reserve = Math.round(bonusPool * reserveRate * 10) / 10;
    const finalCash = Math.round(s.cash * 10) / 10;

    let grade: string;
    let title: string;
    let summary: string;
    if (finalCash >= 950 && s.reputation >= 75) {
      grade = '上上';
      title = '唱红渭北，满堂花红';
      summary = '这一年戏硬、人齐、账清，村村相传。年终不但众人分到厚份，还有银钱添箱置行头，明年的台口已经有人来订。';
    } else if (finalCash >= 520) {
      grade = '丰';
      title = '肥年好岁，封箱大吉';
      summary = '刨去嚼用、赔偿和人工，箱底仍厚。众人按股分到钱，能割肉打酒、扯布做衣，来年还能添新影人。';
    } else if (finalCash >= 240) {
      grade = '平';
      title = '账目清明，过得去个好年';
      summary = '没有大发，也没有塌窟窿。股份钱虽不算厚，总算人人有份，开春风调雨顺便能再闯。';
    } else if (finalCash >= 70) {
      grade = '紧';
      title = '年关紧巴，少盐无肉';
      summary = '路上盘缠、雨赔和修箱花了不少，年终份银薄。若有人寒心，明年怕是要被别的班挖角。';
    } else {
      grade = '困';
      title = '箱底见空，年关难过';
      summary = '账上抵不过一年辛苦，股份钱发不出，戏班面临散伙。要么来年换戏路、赶庙会，要么只能典当戏箱。';
    }

    const settlement: YearSettlement = {
      settledDayIndex: s.dayIndex,
      totalIncome: Math.round(totalIncome * 10) / 10,
      totalPerformanceIncome: Math.round(totalPerformanceIncome * 10) / 10,
      totalExpense: Math.round(totalExpense * 10) / 10,
      operatingNet,
      reserveRate: Math.round(reserveRate * 1000) / 1000,
      reserve,
      bonusPool,
      totalShares,
      payouts,
      paidShares: memberShares,
      finalCash,
      grade,
      title,
      summary,
    };
    s.settlement = settlement;
    this.addLog('story', `年终封箱算账：全年进项${settlement.totalIncome}元，花销${settlement.totalExpense}元，净余${operatingNet}元。`);
    this.emit();
    return settlement;
  }
}

function roleLabel(role: Role): string {
  return {
    qianxian: '签手',
    shangshou: '上手',
    xiashou: '下手',
    huqin: '拉胡琴',
    luogu: '打锣鼓',
  }[role];
}
