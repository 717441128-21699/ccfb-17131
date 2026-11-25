import {
  PLAYS,
  PLAY_MAP,
  PUPPET_MAP,
  RIVAL_NAMES,
  ROLE_LABELS,
  ROUTES,
  VILLAGES,
  VILLAGE_MAP,
  YEAR_DAYS,
  CALENDAR_MONTH_DAYS,
  TRAVEL_LI_PER_DAY,
  INITIAL_MEMBERS,
  INITIAL_PUPPETS,
} from './data';
import type {
  AffinityState,
  ContractOffer,
  Engagement,
  GameEvent,
  GameState,
  LedgerEntry,
  Member,
  PerformanceRecord,
  PlayDef,
  RoleId,
  Weather,
  YearSettlement,
} from './types';

export interface ActionResult {
  ok: boolean;
  error?: string;
  days?: number;
  performanceIds?: string[];
}

export const DAILY_FOOD = 78;
export const MEDICINE_COST = 70;
export const RETAIN_COST = 260;
export const RECRUIT_COST = 240;
export const MAX_DEBT = 3000;
export const SHARE_RATE = 0.38;

export const CORE_ROLES: RoleId[] = ['qianshou', 'shangshou', 'xiashou', 'huqin', 'luogu'];

export const ROLE_BASE_SHARE: Record<RoleId, number> = {
  qianshou: 1.8,
  shangshou: 1.5,
  xiashou: 1.0,
  huqin: 1.2,
  luogu: 1.2,
  xuetu: 0.5,
};

export const BAD_SHOW_WEATHER: Weather[] = ['小雨', '连阴雨', '雪'];

const HIRE_SURNAMES = ['马', '郭', '常', '贺', '阎', '秦', '尤', '许', '何', '吕', '施', '张'];
const HIRE_GIVEN = ['满仓', '铁栓', '鸣锣', '二弦', '巧嘴', '云生', '小满', '进宝', '连山', '阿庆'];

export function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

export function dayToDate(day: number): { month: number; day: number } {
  const d = Math.min(YEAR_DAYS, Math.max(1, Math.floor(day)));
  return {
    month: Math.floor((d - 1) / CALENDAR_MONTH_DAYS) + 1,
    day: ((d - 1) % CALENDAR_MONTH_DAYS) + 1,
  };
}

export function dateLabel(day: number): string {
  const d = dayToDate(day);
  return `${d.month}月${d.day}日`;
}

export function fairDay(v: { fairMonth: number; fairDay: number }): number {
  return (v.fairMonth - 1) * CALENDAR_MONTH_DAYS + v.fairDay;
}

export function travelDaysForLi(li: number): number {
  return Math.max(1, Math.ceil(li / TRAVEL_LI_PER_DAY));
}

export function edgeBetween(fromId: string, toId: string) {
  return ROUTES.find(
    (r) => (r.from === fromId && r.to === toId) || (r.from === toId && r.to === fromId),
  );
}

export function getAdjacent(state: GameState, villageId: string) {
  return state.routes
    .filter((r) => r.from === villageId || r.to === villageId)
    .map((edge) => {
      const toId = edge.from === villageId ? edge.to : edge.from;
      return {
        village: VILLAGE_MAP[toId],
        edge,
        days: travelDaysForLi(edge.li),
      };
    })
    .sort((a, b) => a.days - b.days || a.village.name.localeCompare(b.village.name, 'zh'));
}

export function rand(state: GameState): number {
  let x = state.rngState | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  state.rngState = x | 0;
  return (state.rngState >>> 0) / 4294967296;
}

function randInt(state: GameState, min: number, max: number): number {
  return min + Math.floor(rand(state) * (max - min + 1));
}

function uid(state: GameState, prefix: string): string {
  state.nextId += 1;
  return `${prefix}_${state.year}_${state.nextId}`;
}

function addLog(state: GameState, text: string, tone: 'normal' | 'good' | 'bad' | 'event' = 'normal') {
  state.logs.unshift({
    id: uid(state, 'log'),
    day: state.day,
    dateLabel: dateLabel(state.day),
    tone,
    text,
  });
  if (state.logs.length > 180) state.logs.length = 180;
}

interface LedgerInput {
  kind: LedgerEntry['kind'];
  category: LedgerEntry['category'];
  title: string;
  amount: number;
  villageId?: string;
  performanceId?: string;
  memberId?: string;
  inKind?: boolean;
  note?: string;
  day?: number;
}

function addLedger(state: GameState, input: LedgerInput): LedgerEntry {
  const day = input.day ?? state.day;
  const entry: LedgerEntry = {
    id: uid(state, '账'),
    year: state.year,
    day,
    dateLabel: dateLabel(day),
    kind: input.kind,
    category: input.category,
    title: input.title,
    amount: Math.round(input.amount),
    villageId: input.villageId,
    performanceId: input.performanceId,
    memberId: input.memberId,
    inKind: input.inKind,
    note: input.note,
  };
  state.ledger.push(entry);
  return entry;
}

function rollWeather(state: GameState, month = dayToDate(state.day).month): Weather {
  const r = rand(state);
  const table: Array<[Weather, number]> =
    month <= 2 || month === 12
      ? [['晴', 0.34], ['多云', 0.24], ['阴', 0.14], ['雪', 0.13], ['西北风', 0.1], ['小雨', 0.05]]
      : month >= 3 && month <= 5
        ? [['晴', 0.3], ['多云', 0.24], ['阴', 0.14], ['小雨', 0.18], ['西北风', 0.08], ['连阴雨', 0.06]]
        : month >= 6 && month <= 8
          ? [['晴', 0.42], ['多云', 0.22], ['阴', 0.1], ['小雨', 0.16], ['连阴雨', 0.08], ['西北风', 0.02]]
          : [['晴', 0.5], ['多云', 0.24], ['阴', 0.1], ['小雨', 0.1], ['连阴雨', 0.03], ['西北风', 0.03]];
  let acc = 0;
  for (const [w, p] of table) {
    acc += p;
    if (r <= acc) return w;
  }
  return '晴';
}

export function baseAffinity(villageId: string, playId: string): number {
  const v = VILLAGE_MAP[villageId];
  const play = PLAY_MAP[playId];
  let score = 61 + (play.baseAppeal - 80) * 0.35;
  for (const tag of play.tags) {
    const pref = v.preferences[tag] ?? 0.92;
    score += (pref - 1) * 46;
  }
  if (v.favoritePlayId === playId) score += 15;
  return Math.round(clamp(score, 34, 96));
}

export function ensureAffinity(state: GameState, villageId: string, playId: string): AffinityState {
  if (!state.affinity[villageId]) state.affinity[villageId] = {};
  let a = state.affinity[villageId][playId];
  if (!a) {
    const base = baseAffinity(villageId, playId);
    a = { base, value: base, recentDays: [] };
    state.affinity[villageId][playId] = a;
  }
  return a;
}

export function getAffinityView(state: GameState, villageId: string, playId: string): AffinityState & { projected: number; repeatCount: number } {
  const a = ensureAffinity(state, villageId, playId);
  a.recentDays = a.recentDays.filter((d) => state.day - d <= 75);
  let projected = a.value;
  if (a.lastDay !== undefined && state.day > a.lastDay) {
    const gap = state.day - a.lastDay;
    projected = Math.min(a.base, a.value + gap * 0.78);
  }
  return { ...a, projected: Math.round(clamp(projected, 5, 100)), repeatCount: a.recentDays.length };
}

function recordShowAffinity(state: GameState, villageId: string, playId: string, quality: number): number {
  const view = getAffinityView(state, villageId, playId);
  const a = ensureAffinity(state, villageId, playId);
  const before = view.projected;
  const repeatCount = view.repeatCount;
  const drop = 15 + repeatCount * 7 + (quality < 58 ? 5 : 0);
  a.value = Math.max(6, before - drop);
  a.lastDay = state.day;
  a.recentDays.push(state.day);
  a.recentDays = a.recentDays.filter((d) => state.day - d <= 75);
  return before;
}

export function newGame(): GameState {
  const seed = 20261126;
  const state: GameState = {
    schemaVersion: 1,
    seed,
    rngState: seed,
    year: 1,
    day: 8,
    cash: 8200,
    debt: 0,
    reputation: 56,
    currentVillageId: 'longquan',
    weather: '晴',
    forecast: [],
    villages: structuredClone(VILLAGES),
    routes: structuredClone(ROUTES),
    villageState: Object.fromEntries(
      VILLAGES.map((v) => [v.id, { fairDone: false, autumnDone: false }]),
    ),
    affinity: {},
    members: structuredClone(INITIAL_MEMBERS),
    puppets: structuredClone(INITIAL_PUPPETS),
    knownScriptIds: PLAYS.filter((p) => p.tuition === 0).map((p) => p.id),
    rehearsal: Object.fromEntries(PLAYS.filter((p) => p.tuition === 0).map((p) => [p.id, 64])),
    rivals: RIVAL_NAMES.map((r) => ({ ...r, stayDays: 3 + Math.floor((seed % 5)), travel: undefined })),
    ledger: [],
    performances: [],
    logs: [],
    nextId: 1,
    totalShows: 0,
    totalAudience: 0,
  };
  state.weather = rollWeather(state, dayToDate(state.day).month);
  state.forecast = [rollWeather(state), rollWeather(state), rollWeather(state)];
  addLog(state, '班主带着六个人、一副戏箱落脚龙泉寨。三月十八后土庙会是近处的大台口。', 'event');
  return state;
}

export function getCastReadiness(state: GameState): string[] {
  const blockers: string[] = [];
  for (const role of CORE_ROLES) {
    const m = state.members.find((x) => x.role === role);
    if (!m) blockers.push(`${ROLE_LABELS[role]}无人`);
    else if (m.status !== '正常') blockers.push(`${ROLE_LABELS[role]}${m.status}`);
  }
  return blockers;
}

export function getVacantRoles(state: GameState): RoleId[] {
  const vacant: RoleId[] = [];
  for (const role of Object.keys(ROLE_BASE_SHARE) as RoleId[]) {
    const active = state.members.some((m) => m.role === role && m.status !== '被挖走');
    if (!active) vacant.push(role);
  }
  return vacant;
}

export function getPuppetReadiness(state: GameState, playId: string) {
  const play = PLAY_MAP[playId];
  const missing: string[] = [];
  const worn: string[] = [];
  let conditionSum = 0;
  let conditionCount = 0;
  for (const kindId of play.requiredPuppets) {
    const stock = state.puppets.find((p) => p.kindId === kindId);
    const def = PUPPET_MAP[kindId];
    if (!stock || stock.count <= 0) {
      missing.push(def.name);
    } else {
      conditionSum += stock.condition;
      conditionCount += 1;
      if (stock.condition < 35) worn.push(def.name);
    }
  }
  return {
    missing,
    worn,
    avgCondition: conditionCount ? conditionSum / conditionCount : 0,
  };
}

export function getPlayBlockers(state: GameState, playId: string): string[] {
  const blockers: string[] = [];
  if (!state.knownScriptIds.includes(playId)) blockers.push('没有学会这本唱本');
  const cast = getCastReadiness(state);
  blockers.push(...cast);
  const puppet = getPuppetReadiness(state, playId);
  if (puppet.missing.length) blockers.push(`缺影人/切末：${puppet.missing.join('、')}`);
  if (state.settlement) blockers.push('今年已经封箱');
  return blockers;
}

function illnessUpdate(state: GameState, activity: 'rest' | 'travel' | 'ordinary' | 'show' | 'study') {
  for (const m of state.members) {
    if (m.status === '被挖走') continue;
    if (m.status !== '正常') {
      m.illnessDays = Math.max(0, m.illnessDays - 1);
      const recovery = m.health >= 70 ? 0.55 : m.health >= 45 ? 0.32 : 0.16;
      if (m.illnessDays <= 0 || rand(state) < recovery) {
        m.status = '正常';
        m.illnessDays = 0;
        m.health = Math.max(52, m.health + 8);
        addLog(state, `${m.name}病体好转，已经能起来走动。`, 'good');
      }
      continue;
    }

    let chance = 0.006;
    if (BAD_SHOW_WEATHER.includes(state.weather)) chance += 0.01;
    if (activity === 'travel') chance += 0.008;
    if (m.stamina < 35) chance += 0.014;
    if (m.age >= 45) chance += 0.004;
    if (rand(state) < chance) {
      const severe = m.health < 70 || rand(state) < 0.32;
      m.status = severe ? '卧病' : '小病';
      m.illnessDays = severe ? randInt(state, 3, 5) : randInt(state, 2, 3);
      m.health = clamp(m.health - randInt(state, 8, 17), 5, 100);
      addLog(state, `${m.name}路上受了风寒，${m.status}，得将养几日。`, 'bad');
      if (!state.pendingEvent) {
        state.pendingEvent = {
          id: uid(state, '事'),
          day: state.day,
          type: 'illness',
          title: `${m.name}病倒了`,
          body: `${ROLE_LABELS[m.role]} ${m.name} 发着寒热。请镇上大夫抓药要 ${MEDICINE_COST} 文，也可以先熬姜汤硬扛；硬扛伤人心，也未必快。`,
          memberId: m.id,
          choices: [
            { id: 'medicine', label: `请医抓药（${MEDICINE_COST}文）`, hint: '恢复健康并缩短病期' },
            { id: 'endure', label: '熬姜汤硬扛', hint: '不花钱，忠诚略降' },
          ],
        };
      }
    }
  }
}

function moveRivals(state: GameState) {
  for (const rival of state.rivals) {
    rival.stayDays -= 1;
    if (rival.stayDays > 0) continue;
    const candidates = new Set<string>();
    for (const r of state.routes) {
      if (r.from === rival.villageId) candidates.add(r.to);
      if (r.to === rival.villageId) candidates.add(r.from);
    }
    const list = [...candidates];
    if (!list.length) {
      rival.stayDays = 4;
      continue;
    }
    const weights = list.map((id) => {
      const v = VILLAGE_MAP[id];
      let w = v.population * (0.75 + v.harvest * 0.35);
      const fd = fairDay(v);
      const toFair = fd - state.day;
      if (toFair >= -2 && toFair <= 12) w *= 3.2;
      if (id === state.currentVillageId) w *= 1.35;
      if (v.region.includes('东') && rival.id === 'rival_desheng') w *= 1.1;
      return w;
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let pick = rand(state) * total;
    let nextId = list[0];
    for (let i = 0; i < list.length; i += 1) {
      pick -= weights[i];
      if (pick <= 0) {
        nextId = list[i];
        break;
      }
    }
    const from = VILLAGE_MAP[rival.villageId].name;
    rival.villageId = nextId;
    rival.stayDays = randInt(state, 4, 8);
    addLog(state, `${rival.name}从${from}拔营，往${VILLAGE_MAP[nextId].name}抢场子去了。`, 'event');
  }
}

function maybePoach(state: GameState) {
  if (state.pendingEvent || state.day % 24 !== 0) return;
  const candidates = state.members
    .filter((m) => m.status !== '被挖走')
    .sort((a, b) => a.loyalty - b.loyalty);
  const target = candidates[0];
  if (!target || target.loyalty > 72 || rand(state) > 0.72) return;
  const rival = state.rivals[randInt(state, 0, state.rivals.length - 1)];
  state.pendingEvent = {
    id: uid(state, '事'),
    day: state.day,
    type: 'poach',
    title: `${rival.name}暗地挖角`,
    body: `${rival.name}的${rival.master}托人请 ${target.name} 吃酒，许他更高的包银和头牌名分。若放人，这一摊一时便没人顶；若挽留，得立刻拿出 ${RETAIN_COST} 文定银。`,
    memberId: target.id,
    choices: [
      { id: 'counter', label: `出定银挽留（${RETAIN_COST}文）`, hint: '忠诚大增' },
      { id: 'letgo', label: '结账放人', hint: '该角色空缺，需另请人' },
    ],
  };
}

function passDay(
  state: GameState,
  activity: 'rest' | 'travel' | 'ordinary' | 'show' | 'study' = 'ordinary',
) {
  if (state.settlement) return;
  state.day += 1;
  if (state.day > YEAR_DAYS) state.day = YEAR_DAYS;
  state.weather = state.forecast.shift() ?? rollWeather(state);
  state.forecast.push(rollWeather(state));

  for (const m of state.members) {
    if (m.status === '被挖走') continue;
    if (activity === 'rest') {
      m.stamina = clamp(m.stamina + 17);
      m.health = clamp(m.health + 3);
    } else if (activity === 'travel') {
      m.stamina = clamp(m.stamina - randInt(state, 7, 11));
    } else if (activity === 'study') {
      m.stamina = clamp(m.stamina - 4);
    } else if (activity === 'show') {
      m.stamina = clamp(m.stamina - 2);
    }
    if (m.stamina < 24) m.loyalty = clamp(m.loyalty - 1, 0, 100);
  }

  illnessUpdate(state, activity);
  moveRivals(state);
  maybePoach(state);
  if (state.day >= YEAR_DAYS && !state.settlement) settleYear(state);
}

export function travelTo(state: GameState, toId: string): ActionResult {
  if (state.pendingEvent) return { ok: false, error: '先把眼前的人或事处置完。' };
  if (state.engagement?.status === 'active') return { ok: false, error: '这台口还没唱完，不能拔营。' };
  if (state.settlement) return { ok: false, error: '今年已经封箱，请开启新岁。' };
  const fromId = state.currentVillageId;
  const edge = edgeBetween(fromId, toId);
  if (!edge) return { ok: false, error: '只能沿村路去相邻的村子，不能跳过中间村。' };
  const days = travelDaysForLi(edge.li);
  if (state.day + days > YEAR_DAYS) return { ok: false, error: '年关已近，路程会越过封箱日，不如就地封箱。' };
  const cost = days * 85 + Math.round(edge.li * 0.8);
  if (state.cash < cost) return { ok: false, error: `柜上不够这一程盘缠，需 ${cost} 文。` };

  const from = VILLAGE_MAP[fromId];
  const to = VILLAGE_MAP[toId];
  state.cash -= cost;
  addLedger(state, {
    kind: 'expense',
    category: '盘缠脚钱',
    title: `${from.name} → ${to.name}：${edge.li}里，行${days}日`,
    amount: cost,
    villageId: toId,
    note: '人畜口粮、店钱与车脚杂用合并记账。',
  });
  addLog(state, `戏箱上车，班社从${from.name}往${to.name}，路程${edge.li}里，要走${days}日。`);
  for (let i = 0; i < days; i += 1) passDay(state, 'travel');
  state.currentVillageId = toId;
  if (!state.settlement) addLog(state, `一行人抵达${to.name}，先拜会首、看庙台。`, 'normal');
  return { ok: true, days };
}

export function restDay(state: GameState): ActionResult {
  if (state.pendingEvent) return { ok: false, error: '先处置眼前事。' };
  if (state.engagement?.status === 'active') return { ok: false, error: '台口期间不能独自休整。' };
  // 哪怕柜上没钱，也可在村里赊饭休整；现金允许短暂为负，年关总算。
  state.cash -= DAILY_FOOD;
  addLedger(state, {
    kind: 'expense',
    category: '日常饭食',
    title: '在村里休整一日的饭食钱',
    amount: DAILY_FOOD,
    villageId: state.currentVillageId,
  });
  passDay(state, 'rest');
  return { ok: true };
}

export function rehearsePlay(state: GameState, playId: string): ActionResult {
  if (state.pendingEvent) return { ok: false, error: '先处置眼前事。' };
  if (!state.knownScriptIds.includes(playId)) return { ok: false, error: '还没有这本唱本。' };
  if (state.engagement?.status === 'active') return { ok: false, error: '台口正忙，不能另行排戏。' };
  const cost = 88;
  if (state.cash < cost) return { ok: false, error: `排戏灯油、茶水和加饭需 ${cost} 文。` };
  state.cash -= cost;
  const play = PLAY_MAP[playId];
  state.rehearsal[playId] = clamp((state.rehearsal[playId] ?? 42) + 8, 0, 100);
  addLedger(state, {
    kind: 'expense',
    category: '其他',
    title: `排演《${play.name}》的灯油加饭钱`,
    amount: cost,
    villageId: state.currentVillageId,
  });
  addLog(state, `全班排了一日《${play.name}》，熟戏又细了几分。`, 'good');
  passDay(state, 'study');
  return { ok: true };
}

export function repairPuppet(state: GameState, kindId: string): ActionResult {
  const stock = state.puppets.find((p) => p.kindId === kindId);
  if (!stock) return { ok: false, error: '箱中没有这一行影人。' };
  if (stock.condition >= 100) return { ok: false, error: '这一行影人还齐整，不用修。' };
  const cost = Math.ceil(((100 - stock.condition) * stock.count * 1.35) / 5) * 5;
  if (state.cash < cost) return { ok: false, error: `修影人需 ${cost} 文。` };
  state.cash -= cost;
  const def = PUPPET_MAP[kindId];
  const before = Math.round(stock.condition);
  stock.condition = 100;
  addLedger(state, {
    kind: 'expense',
    category: '修影人',
    title: `修补${def.name} ${stock.count} 件`,
    amount: cost,
    villageId: state.currentVillageId,
    note: `完好度由 ${before} 修到 100；换关节、补彩绘、整签杆。`,
  });
  return { ok: true };
}

export function buyPuppet(state: GameState, kindId: string): ActionResult {
  const def = PUPPET_MAP[kindId];
  if (state.cash < def.baseCost) return { ok: false, error: `添一件${def.name}需 ${def.baseCost} 文。` };
  state.cash -= def.baseCost;
  const stock = state.puppets.find((p) => p.kindId === kindId);
  if (stock) {
    const totalCondition = stock.condition * stock.count + 92;
    stock.count += 1;
    stock.condition = totalCondition / stock.count;
  } else {
    state.puppets.push({ kindId: kindId as never, count: 1, condition: 92 });
  }
  addLedger(state, {
    kind: 'expense',
    category: '添影人',
    title: `新添${def.name}一件`,
    amount: def.baseCost,
    villageId: state.currentVillageId,
    note: def.note,
  });
  return { ok: true };
}

export function canLearnPlay(state: GameState, playId: string): { ok: boolean; error?: string } {
  const play = PLAY_MAP[playId];
  if (state.knownScriptIds.includes(playId)) return { ok: false, error: '已经学会。' };
  if (!play.masterVillageId || state.currentVillageId !== play.masterVillageId) {
    return { ok: false, error: `需到${play.masterVillageId ? VILLAGE_MAP[play.masterVillageId].name : '师傅处'}拜师。` };
  }
  if (state.cash < play.tuition + play.learnDays * DAILY_FOOD) return { ok: false, error: '束脩和拜师期间饭食钱不足。' };
  if (state.day + play.learnDays > YEAR_DAYS - 2) return { ok: false, error: '年关太近，来不及学完整本。' };
  return { ok: true };
}

export function learnPlay(state: GameState, playId: string): ActionResult {
  const check = canLearnPlay(state, playId);
  if (!check.ok) return check;
  const play = PLAY_MAP[playId];
  const living = play.learnDays * DAILY_FOOD;
  state.cash -= play.tuition + living;
  addLedger(state, {
    kind: 'expense',
    category: '拜师学费',
    title: `拜${play.masterName}学《${play.name}》束脩`,
    amount: play.tuition,
    villageId: play.masterVillageId,
  });
  addLedger(state, {
    kind: 'expense',
    category: '日常饭食',
    title: `学戏${play.learnDays}日的饭食杂费`,
    amount: living,
    villageId: play.masterVillageId,
  });
  state.knownScriptIds.push(playId);
  state.rehearsal[playId] = 43;
  addLog(state, `在${VILLAGE_MAP[play.masterVillageId!].name}拜${play.masterName}为师，学得了《${play.name}》。`, 'good');
  for (let i = 0; i < play.learnDays; i += 1) passDay(state, 'study');
  return { ok: true, days: play.learnDays };
}

export function hireMember(state: GameState, role: RoleId): ActionResult {
  const vacant = getVacantRoles(state);
  if (!vacant.includes(role)) return { ok: false, error: '这一行并不缺人。' };
  // 会首/牙行可作保记一部分安家账，不能让缺角把班彻底憋死。
  state.cash -= RECRUIT_COST;
  const name = HIRE_SURNAMES[randInt(state, 0, HIRE_SURNAMES.length - 1)] +
    HIRE_GIVEN[randInt(state, 0, HIRE_GIVEN.length - 1)];
  const member: Member = {
    id: uid(state, '人'),
    name,
    role,
    age: randInt(state, 18, 41),
    skill: randInt(state, 57, 76),
    share: ROLE_BASE_SHARE[role],
    health: randInt(state, 72, 94),
    stamina: 90,
    loyalty: 62,
    status: '正常',
    illnessDays: 0,
    accruedShare: 0,
    shows: 0,
    bio: '临时托会首、牙行找来的把式，本事要在台上见真章。',
  };
  state.members.push(member);
  addLedger(state, {
    kind: 'expense',
    category: '招人安家',
    title: `请${ROLE_LABELS[role]} ${name} 搭班的安家钱`,
    amount: RECRUIT_COST,
    villageId: state.currentVillageId,
    memberId: member.id,
  });
  addLog(state, `${name}应募入班，顶${ROLE_LABELS[role]}这一摊。`, 'event');
  return { ok: true };
}

export function borrowMoney(state: GameState, amount: number): ActionResult {
  if (state.pendingEvent) return { ok: false, error: '先处置眼前事。' };
  if (state.settlement) return { ok: false, error: '今年已经封箱。' };
  const rounded = Math.round(amount / 50) * 50;
  const available = MAX_DEBT - state.debt;
  if (rounded <= 0) return { ok: false, error: '借银数目不对。' };
  if (rounded > available) return { ok: false, error: `会首和钱庄至多还肯周转 ${Math.max(0, available)} 文。` };
  state.debt += rounded;
  state.cash += rounded;
  addLedger(state, {
    kind: 'transfer',
    category: '借款',
    title: `在${VILLAGE_MAP[state.currentVillageId].name}向会首、钱庄周转借银`,
    amount: rounded,
    villageId: state.currentVillageId,
    note: '救命钱按年加二起息，封箱时先还外债，再发身股。',
  });
  addLog(state, `柜上太紧，班主借了 ${rounded} 文周转；这笔账年关要先还。`, 'event');
  return { ok: true };
}

export function rewardTroupe(state: GameState): ActionResult {
  const cost = 130;
  if (state.cash < cost) return { ok: false, error: `割肉打酒、全员犒赏需 ${cost} 文。` };
  state.cash -= cost;
  for (const m of state.members) {
    if (m.status === '被挖走') continue;
    m.loyalty = clamp(m.loyalty + 9);
    m.stamina = clamp(m.stamina + 12);
  }
  addLedger(state, {
    kind: 'expense',
    category: '犒赏',
    title: '割肉打酒，犒赏全班',
    amount: cost,
    villageId: state.currentVillageId,
  });
  addLog(state, '全班吃了一顿热乎的，人心又拢住些。', 'good');
  return { ok: true };
}

export function treatMember(state: GameState, memberId: string): ActionResult {
  const m = state.members.find((x) => x.id === memberId);
  if (!m || m.status === '被挖走') return { ok: false, error: '找不着这个人。' };
  // 药铺可记在班社账上，先治病要紧；现金可为负。
  state.cash -= MEDICINE_COST;
  m.health = clamp(m.health + 22);
  m.illnessDays = Math.max(0, m.illnessDays - 3);
  if (m.illnessDays <= 0 && m.status !== '正常') {
    m.status = '正常';
    m.health = Math.max(60, m.health);
  }
  addLedger(state, {
    kind: 'expense',
    category: '医药',
    title: `给${m.name}请医抓药`,
    amount: MEDICINE_COST,
    memberId: m.id,
    villageId: state.currentVillageId,
  });
  addLog(state, `${m.name}服了药，病势轻了几分。`, 'good');
  return { ok: true };
}

export function resolveEvent(state: GameState, choiceId: string): ActionResult {
  const ev: GameEvent | undefined = state.pendingEvent;
  if (!ev) return { ok: true };
  const m = ev.memberId ? state.members.find((x) => x.id === ev.memberId) : undefined;
  if (ev.type === 'poach' && m) {
    if (choiceId === 'counter') {
      if (state.cash < RETAIN_COST) return { ok: false, error: '柜上拿不出这么多定银。' };
      state.cash -= RETAIN_COST;
      m.loyalty = clamp(m.loyalty + 24);
      addLedger(state, {
        kind: 'expense',
        category: '犒赏',
        title: `挽留${m.name}的加赏定银`,
        amount: RETAIN_COST,
        memberId: m.id,
        note: '当场封银，应承年下分红不短他的。',
      });
      addLog(state, `${m.name}收下定银，回绝了别家班社。`, 'good');
    } else {
      m.status = '被挖走';
      m.loyalty = 0;
      state.reputation = clamp(state.reputation - 3);
      addLog(state, `${m.name}卷了自己的铺盖，随别家班社走了。`, 'bad');
    }
  }
  if (ev.type === 'illness' && m) {
    if (choiceId === 'medicine') {
      state.cash -= MEDICINE_COST;
      m.health = clamp(m.health + 22);
      m.illnessDays = Math.max(0, m.illnessDays - 3);
      if (m.illnessDays <= 0) {
        m.status = '正常';
        m.health = Math.max(60, m.health);
      }
      addLedger(state, {
        kind: 'expense',
        category: '医药',
        title: `给${m.name}请医抓药`,
        amount: MEDICINE_COST,
        memberId: m.id,
        villageId: state.currentVillageId,
      });
      addLog(state, `${m.name}服了药，热退了些。`, 'good');
    } else {
      m.loyalty = clamp(m.loyalty - 3);
      addLog(state, `班里给${m.name}熬了姜汤，只好多将养几日。`);
    }
  }
  state.pendingEvent = undefined;
  return { ok: true };
}

export function getContractOffer(
  state: GameState,
  villageId = state.currentVillageId,
): ContractOffer | null {
  if (state.settlement || state.engagement?.status === 'active') return null;
  const v = VILLAGE_MAP[villageId];
  const vs = state.villageState[villageId];
  if (!v || !vs) return null;
  const fd = fairDay(v);
  const wealth = 0.55 + v.harvest * 0.55;

  if (!vs.fairDone && state.day >= fd - 1 && state.day <= fd + 1) {
    const pay = Math.round((v.population * 1.08 * 2.15 * wealth) / 10) * 10;
    return {
      kind: '庙会戏',
      eventName: v.fairName,
      nights: 3,
      payPerNight: pay,
      mealPerPerson: Math.round(15 + v.harvest * 8),
      reason: `正期 ${dateLabel(fd)}；会首按三夜给戏钱，庙台对台也最常见。`,
    };
  }

  if (!vs.autumnDone && state.day >= 241 && state.day <= 330 && v.harvest >= 0.72) {
    const pay = Math.round((v.population * 1.02 * 1.42 * wealth) / 10) * 10;
    return {
      kind: '谢秋戏',
      eventName: '秋收谢土还愿',
      nights: 2,
      payPerNight: pay,
      mealPerPerson: Math.round(16 + v.harvest * 9),
      reason: '秋收上场，村里有闲钱，唱两夜谢秋戏。',
    };
  }

  const last = vs.lastRegularDay ?? -999;
  if (state.day - last >= 42) {
    const pay = Math.round((v.population * 1.02 * 0.88 * wealth) / 10) * 10;
    return {
      kind: '还愿戏',
      eventName: '私家还愿/邻里喜庆',
      nights: 1,
      payPerNight: Math.max(120, pay),
      mealPerPerson: Math.round(14 + v.harvest * 7),
      reason: '会首或主家请一台单夜戏，钱不算厚，但能维持名头。',
    };
  }

  return null;
}

export function getContractHindrance(state: GameState): string | null {
  if (state.pendingEvent) return '先处置眼前的人或事。';
  if (state.engagement?.status === 'active') return '已有台口在身。';
  if (state.settlement) return '今年已经封箱。';
  if (state.day > YEAR_DAYS - 5) return '年关太近，不宜再接连台口。';
  return null;
}

function makeCancelledRecord(args: {
  state: GameState;
  engagement: Engagement;
  play: PlayDef;
  night: number;
  reason: string;
  penalty: number;
}): PerformanceRecord {
  const { state, engagement, play, night, reason, penalty } = args;
  const v = VILLAGE_MAP[engagement.villageId];
  const aff = getAffinityView(state, v.id, play.id);
  const rival = engagement.rivalId ? state.rivals.find((r) => r.id === engagement.rivalId) : undefined;
  const record: PerformanceRecord = {
    id: uid(state, '演'),
    year: state.year,
    day: state.day,
    dateLabel: dateLabel(state.day),
    villageId: v.id,
    engagementId: engagement.id,
    contractKind: engagement.kind,
    eventName: engagement.eventName,
    night,
    totalNights: engagement.totalNights,
    playId: play.id,
    weather: state.weather,
    cancelled: true,
    cancellationReason: reason,
    quality: 0,
    audience: 0,
    population: v.population,
    basePay: 0,
    bonus: 0,
    mealValue: 0,
    penalty,
    sharePool: 0,
    totalSharePoints: 0,
    rivalId: rival?.id,
    rivalName: rival?.name,
    rivalQuality: rival?.quality,
    affinityBefore: aff.projected,
    affinityAfter: aff.projected,
    factors: [],
    notes: [reason, `天气：${state.weather}`, `赔偿 ${penalty} 文`],
    payouts: [],
  };
  state.performances.push(record);
  engagement.performanceIds.push(record.id);
  state.cash -= penalty;
  addLedger(state, {
    kind: 'expense',
    category: '赔偿罚银',
    title: `${v.name}《${play.name}》第${night}夜回台赔偿`,
    amount: penalty,
    villageId: v.id,
    performanceId: record.id,
    note: reason,
  });
  return record;
}

function performOneNight(
  state: GameState,
  engagement: Engagement,
  playId: string,
  night: number,
): PerformanceRecord | null {
  const v = VILLAGE_MAP[engagement.villageId];
  const play = PLAY_MAP[playId];
  const blockers = getPlayBlockers(state, playId);
  if (blockers.length) {
    const remaining = engagement.totalNights - night + 1;
    const penalty = Math.round(engagement.payPerNight * 0.38 * remaining);
    makeCancelledRecord({
      state,
      engagement,
      play,
      night,
      reason: `无法开台：${blockers.join('；')}`,
      penalty,
    });
    engagement.status = 'broken';
    return state.performances[state.performances.length - 1] ?? null;
  }

  if (BAD_SHOW_WEATHER.includes(state.weather)) {
    const penalty = Math.round(engagement.payPerNight * 0.22);
    const cancelled = makeCancelledRecord({
      state,
      engagement,
      play,
      night,
      reason: `${state.weather}冲了场，影窗湿滑、看客散尽，依规矩回戏并赔会首台钱。`,
      penalty,
    });
    return cancelled;
  }

  const affView = getAffinityView(state, v.id, playId);
  const puppet = getPuppetReadiness(state, playId);
  const coreMembers = CORE_ROLES.map((role) => state.members.find((m) => m.role === role && m.status === '正常')!)
    .filter(Boolean);
  const skillWeights: Record<RoleId, number> = {
    qianshou: 0.28, shangshou: 0.26, xiashou: 0.12, huqin: 0.16, luogu: 0.18, xuetu: 0,
  };
  const skillScore = coreMembers.reduce((sum, m) => sum + m.skill * skillWeights[m.role], 0);
  const apprentice = state.members.find((m) => m.role === 'xuetu' && m.status === '正常');
  const rehearsalScore = state.rehearsal[playId] ?? 42;
  const crewState = coreMembers.reduce(
    (sum, m) => sum + m.stamina * 0.45 + m.health * 0.35 + m.loyalty * 0.2,
    0,
  ) / coreMembers.length;
  const puppetScore = puppet.avgCondition;

  const factors = [
    { label: '唱签功夫', value: Math.round(skillScore), detail: '签手、上手与场面五行的技艺加权。' },
    { label: '排戏熟度', value: Math.round(rehearsalScore), detail: '常排的戏咬合更紧，临场少出错。' },
    { label: '本村口味', value: affView.projected, detail: `初始缘分 ${affView.base}；近75日唱过 ${affView.repeatCount} 次，隔久了会恢复。` },
    { label: '戏本号召力', value: play.baseAppeal, detail: `${play.name} 在方圆各村的名头。` },
    { label: '影人箱底', value: Math.round(puppetScore), detail: puppet.worn.length ? `将坏：${puppet.worn.join('、')}` : '所需影人、切末齐全。' },
    { label: '人马状态', value: Math.round(crewState), detail: '体力、健康、人心三项合计。' },
  ];

  let quality =
    skillScore * 0.31 +
    rehearsalScore * 0.18 +
    affView.projected * 0.23 +
    play.baseAppeal * 0.12 +
    puppetScore * 0.08 +
    crewState * 0.08;
  if (apprentice) quality += 1.2;

  const capability = skillScore * 0.65 + rehearsalScore * 0.35;
  const difficultyGap = play.difficulty - capability;
  if (difficultyGap > 0) quality -= difficultyGap * 0.35;

  const weatherMod: Record<Weather, number> = {
    晴: 2, 多云: 1, 阴: -2, 小雨: 0, 连阴雨: 0, 雪: 0, 西北风: -5,
  };
  quality += weatherMod[state.weather];

  const rival = engagement.rivalId ? state.rivals.find((r) => r.id === engagement.rivalId) : undefined;
  let competitionResult: PerformanceRecord['competitionResult'];
  if (rival) {
    const ours = quality + state.reputation * 0.12;
    const theirs = rival.quality + rand(state) * 12 - 6;
    if (ours > theirs + 6) {
      competitionResult = 'win';
      quality += 3;
    } else if (theirs > ours + 6) {
      competitionResult = 'lose';
      quality -= 5;
    } else {
      competitionResult = 'draw';
      quality -= 1;
    }
  }
  quality += rand(state) * 7 - 3.5;
  quality = Math.round(clamp(quality, 8, 100));

  const turnout = 0.28 + (quality / 100) * 0.42;
  const eventAud = engagement.kind === '庙会戏' ? 1.36 : engagement.kind === '谢秋戏' ? 1.12 : 0.86;
  const weatherAud: Record<Weather, number> = {
    晴: 1.05, 多云: 1, 阴: 0.92, 小雨: 0.4, 连阴雨: 0.25, 雪: 0.35, 西北风: 0.8,
  };
  let rivalAud = 1;
  if (rival) rivalAud = competitionResult === 'win' ? 1.09 : competitionResult === 'lose' ? 0.72 : 0.94;
  const audience = Math.round(
    v.population * turnout * eventAud * weatherAud[state.weather] * rivalAud,
  );

  const basePay = engagement.payPerNight;
  const bonus = Math.round((basePay * Math.max(0, quality - 72)) / 100 / 10) * 10;
  const mealValue = engagement.mealPerPerson * state.members.length;
  const revenue = basePay + bonus;
  const sharePool = Math.round(revenue * SHARE_RATE);

  state.cash += revenue;
  const recordId = uid(state, '演');
  addLedger(state, {
    kind: 'income',
    category: '戏钱',
    title: `${v.name}${engagement.eventName}《${play.name}》第${night}夜戏钱`,
    amount: basePay,
    villageId: v.id,
    performanceId: recordId,
  });
  if (bonus > 0) {
    addLedger(state, {
      kind: 'income',
      category: '赏钱',
      title: `${v.name}《${play.name}》第${night}夜会首赏钱`,
      amount: bonus,
      villageId: v.id,
      performanceId: recordId,
    });
  }

  addLedger(state, {
    kind: 'income',
    category: '管饭折银',
    title: `${v.name}台口第${night}夜管饭`,
    amount: mealValue,
    villageId: v.id,
    performanceId: recordId,
    inKind: true,
    note: '会首按人头送馍、面、烩菜与牲口草料；此为折算，不收现银。',
  });

  const performers = state.members.filter((m) => m.status === '正常');
  const totalSharePoints = performers.reduce((sum, m) => sum + m.share, 0);
  let allocated = 0;
  const payouts = performers.map((m, idx) => {
    let amount: number;
    if (idx === performers.length - 1) amount = sharePool - allocated;
    else amount = Math.round((sharePool * m.share) / totalSharePoints);
    allocated += amount;
    m.accruedShare += amount;
    m.shows += 1;
    return { memberId: m.id, name: m.name, role: m.role, share: m.share, amount };
  });

  for (const kindId of play.requiredPuppets) {
    const stock = state.puppets.find((p) => p.kindId === kindId);
    if (stock) stock.condition = clamp(stock.condition - (4 + play.difficulty / 18 + rand(state) * 3), 0, 100);
  }
  for (const m of performers) {
    m.stamina = clamp(m.stamina - randInt(state, 9, 15));
    m.health = clamp(m.health - (rand(state) < 0.25 ? 1 : 0));
    if (quality >= 78) m.loyalty = clamp(m.loyalty + 2);
    else if (quality < 55) m.loyalty = clamp(m.loyalty - 2);
  }

  let repDelta = quality >= 88 ? 4 : quality >= 78 ? 2 : quality < 55 ? -3 : 0;
  if (competitionResult === 'win') repDelta += 3;
  if (competitionResult === 'lose') repDelta -= 3;
  state.reputation = clamp(state.reputation + repDelta);
  state.totalShows += 1;
  state.totalAudience += audience;

  const affinityBefore = affView.projected;
  recordShowAffinity(state, v.id, playId, quality);
  const affinityAfter = getAffinityView(state, v.id, playId).projected;

  const notes: string[] = [];
  notes.push(`到场看客约 ${audience} 人，本村册载 ${v.population} 口。`);
  if (rival) {
    notes.push(
      competitionResult === 'win'
        ? `与${rival.name}对台获胜，村口传名。`
        : competitionResult === 'lose'
          ? `对台输给${rival.name}，明日得换硬戏。`
          : `与${rival.name}唱了个平分秋色。`,
    );
  }
  if (puppet.worn.length) notes.push(`影人磨损偏重：${puppet.worn.join('、')}，下戏后宜修。`);
  if (quality >= 88) notes.push('彩声不断，会首当场加了赏。');
  if (quality < 55) notes.push('台上有冷场或失手，台下走了不少人。');

  const record: PerformanceRecord = {
    id: recordId,
    year: state.year,
    day: state.day,
    dateLabel: dateLabel(state.day),
    villageId: v.id,
    engagementId: engagement.id,
    contractKind: engagement.kind,
    eventName: engagement.eventName,
    night,
    totalNights: engagement.totalNights,
    playId,
    weather: state.weather,
    cancelled: false,
    quality,
    audience,
    population: v.population,
    basePay,
    bonus,
    mealValue,
    penalty: 0,
    sharePool,
    totalSharePoints,
    rivalId: rival?.id,
    rivalName: rival?.name,
    rivalQuality: rival?.quality,
    competitionResult,
    affinityBefore,
    affinityAfter,
    factors,
    notes,
    payouts,
  };
  state.performances.push(record);
  engagement.performanceIds.push(record.id);
  addLog(
    state,
    `${v.name}第${night}夜唱《${play.name}》，成色 ${quality} 分，看客约 ${audience} 人。`,
    quality >= 78 ? 'good' : quality < 55 ? 'bad' : 'normal',
  );
  return record;
}

export function signAndPerform(state: GameState, playIds: string[]): ActionResult {
  const hindrance = getContractHindrance(state);
  if (hindrance) return { ok: false, error: hindrance };
  const offer = getContractOffer(state);
  if (!offer) return { ok: false, error: '眼下没有会首下帖请戏。' };
  if (playIds.length !== offer.nights) return { ok: false, error: `这台口要备 ${offer.nights} 夜戏。` };
  for (const pid of playIds) {
    const blockers = getPlayBlockers(state, pid);
    if (blockers.length) return { ok: false, error: `《${PLAY_MAP[pid]?.name ?? pid}》不能唱：${blockers.join('；')}` };
  }
  if (state.day + offer.nights > YEAR_DAYS - 2) return { ok: false, error: '年关太近，唱不完这台连戏。' };

  const vs = state.villageState[state.currentVillageId];
  if (offer.kind === '庙会戏') vs.fairDone = true;
  if (offer.kind === '谢秋戏') vs.autumnDone = true;
  if (offer.kind === '还愿戏') vs.lastRegularDay = state.day;

  const rival = state.rivals.find((r) => r.villageId === state.currentVillageId);
  const engagement: Engagement = {
    id: uid(state, '约'),
    villageId: state.currentVillageId,
    kind: offer.kind,
    eventName: offer.eventName,
    startDay: state.day,
    totalNights: offer.nights,
    currentNight: 0,
    payPerNight: offer.payPerNight,
    mealPerPerson: offer.mealPerPerson,
    rivalId: rival?.id,
    performanceIds: [],
    status: 'active',
  };
  state.engagement = engagement;
  addLog(state, `会首签下${offer.kind}“${offer.eventName}”，共 ${offer.nights} 夜，每夜戏钱 ${offer.payPerNight} 文。`, 'event');

  const ids: string[] = [];
  for (let i = 0; i < offer.nights; i += 1) {
    engagement.currentNight = i + 1;
    const rec = performOneNight(state, engagement, playIds[i], i + 1);
    if (rec) ids.push(rec.id);
    if (engagement.status === 'broken') break;
    if (state.settlement) break;
    if (i < offer.nights - 1) passDay(state, 'show');
  }
  engagement.status = engagement.status === 'broken' ? 'broken' : 'completed';
  state.engagement = undefined;
  return { ok: engagement.status === 'completed', performanceIds: ids, error: engagement.status === 'broken' ? '台口因缺人或坏天气中途回了戏，详见账页。' : undefined };
}

export function settleYear(state: GameState): YearSettlement {
  if (state.settlement) return state.settlement;
  state.day = YEAR_DAYS;
  const due = state.members.reduce((sum, m) => sum + Math.max(0, m.accruedShare), 0);
  const cashBefore = state.cash;
  let paid = 0;

  // 外债优先：年关按本金加二分行息结算；还不清的余数带入新年。
  const debtDue = Math.round(state.debt * 1.2);
  const debtPaid = Math.min(Math.max(0, state.cash), debtDue);
  if (debtDue > 0) {
    state.cash -= debtPaid;
    if (debtPaid > 0) {
      addLedger(state, {
        kind: 'expense',
        category: '还款',
        title: debtPaid === debtDue ? '还清本年周转借银本利（加二行息）' : '年关先还一部分周转借银',
        amount: debtPaid,
        day: YEAR_DAYS,
        note: `原本 ${state.debt} 文，本利合计 ${debtDue} 文。`,
      });
    }
    state.debt = debtDue - debtPaid;
  }

  if (state.cash >= due) {
    for (const m of state.members) {
      if (m.accruedShare <= 0) continue;
      const amount = Math.round(m.accruedShare);
      state.cash -= amount;
      paid += amount;
      addLedger(state, {
        kind: 'expense',
        category: '年份分红',
        title: `年下按股分钱：${m.name}（${ROLE_LABELS[m.role]}，${m.share}股）`,
        amount,
        memberId: m.id,
        day: YEAR_DAYS,
        note: `按本年各场戏份银的三成八（${Math.round(SHARE_RATE * 100)}%）合计，逐场累积到此。`,
      });
      m.accruedShare = 0;
    }
  } else if (due > 0) {
    const rate = Math.max(0, state.cash) / due;
    let remainingCash = Math.max(0, state.cash);
    const payable = state.members.filter((m) => m.accruedShare > 0);
    payable.forEach((m, idx) => {
      let amount = idx === payable.length - 1
        ? remainingCash
        : Math.min(remainingCash, Math.floor(m.accruedShare * rate));
      amount = Math.max(0, amount);
      remainingCash -= amount;
      paid += amount;
      if (amount > 0) {
        state.cash -= amount;
        addLedger(state, {
          kind: 'expense',
          category: '年份分红',
          title: `年下不足额分红：${m.name}（${ROLE_LABELS[m.role]}，${m.share}股）`,
          amount,
          memberId: m.id,
          day: YEAR_DAYS,
          note: '柜银不敷股钱，只能按成数先发；欠项伤人心。',
        });
      }
      m.accruedShare = 0;
    });
  }

  const shortfall = Math.max(0, due - paid);
  const yearEntries = state.ledger.filter((e) => e.year === state.year && !e.inKind);
  const totalIncome = yearEntries.filter((e) => e.kind === 'income').reduce((s, e) => s + e.amount, 0);
  const totalExpense = yearEntries.filter((e) => e.kind === 'expense').reduce((s, e) => s + e.amount, 0);
  const yearPerformances = state.performances.filter((p) => p.year === state.year && !p.cancelled);
  const shows = yearPerformances.length;
  const audience = yearPerformances.reduce((s, p) => s + p.audience, 0);
  const cashAfter = state.cash;

  let grade: YearSettlement['grade'];
  let summary: string;
  if (shortfall > 0 || state.debt > 0 || cashAfter < 500 || shows < 5) {
    grade = '散班难关';
    summary = shortfall > 0
      ? `有 ${shortfall} 文身股发不齐，年关怕有人要卷箱另投。`
      : state.debt > 0
        ? `周转债还有 ${state.debt} 文本利没还清，这个年得躲着债主过。`
        : '一年没唱开几场，柜底太薄，怕是凑不齐过年的钱粮。';
  } else if (cashAfter < 2000 || shows < 10) {
    grade = '紧巴年关';
    summary = '股钱发清了，可余下的钱只够割肉买布、凑合过年，明年还得早赶庙会。';
  } else if (cashAfter < 5200 || state.reputation < 65) {
    grade = '体面过年';
    summary = '股钱清楚，箱里有肉、孩子有新衣，来年会首也愿意先下帖。';
  } else {
    grade = '红火大年';
    summary = '戏唱红了，账也漂亮，全班能过个肥年，明年的帖子怕是要提前来订。';
  }

  const settlement: YearSettlement = {
    year: state.year,
    settledDay: state.day,
    totalIncome,
    totalExpense,
    debtDue,
    debtPaid,
    shareDue: due,
    sharePaid: paid,
    shortfall,
    cashBeforePayout: cashBefore,
    cashAfter,
    grade,
    summary,
    shows,
    audience,
    reputation: state.reputation,
  };
  state.settlement = settlement;
  addLog(state, `封箱算账：${grade}。${summary}`, grade === '红火大年' || grade === '体面过年' ? 'good' : 'bad');
  return settlement;
}

export function startNewYear(state: GameState): GameState {
  const next: GameState = {
    ...state,
    year: state.year + 1,
    day: 8,
    settlement: undefined,
    engagement: undefined,
    travel: undefined,
    pendingEvent: undefined,
    weather: '晴',
    forecast: [],
    villageState: Object.fromEntries(
      VILLAGES.map((v) => [v.id, { fairDone: false, autumnDone: false }]),
    ),
  };
  next.weather = rollWeather(next, dayToDate(next.day).month);
  next.forecast = [rollWeather(next), rollWeather(next), rollWeather(next)];
  for (const m of next.members) {
    if (m.status === '被挖走') continue;
    m.stamina = 100;
    m.health = clamp(m.health + 24, 60, 100);
    m.illnessDays = 0;
    m.status = '正常';
    if (state.settlement?.grade === '红火大年') m.loyalty = clamp(m.loyalty + 8);
    if (state.settlement?.grade === '体面过年') m.loyalty = clamp(m.loyalty + 3);
    if (state.settlement?.grade === '紧巴年关') m.loyalty = clamp(m.loyalty - 5);
    if (state.settlement?.grade === '散班难关') m.loyalty = clamp(m.loyalty - 16);
  }
  addLog(next, `新岁正月初八，戏箱重新开封。去年的口味记忆仍在，但日子隔得久了，老戏也慢慢新鲜回来。`, 'event');
  return next;
}

export function getYearEntries(state: GameState, year = state.year): LedgerEntry[] {
  return state.ledger
    .filter((e) => e.year === year)
    .sort((a, b) => b.day - a.day || b.id.localeCompare(a.id, 'zh'));
}

export function getPerformance(state: GameState, id: string): PerformanceRecord | undefined {
  return state.performances.find((p) => p.id === id);
}

export function getVillagePerformances(state: GameState, villageId: string): PerformanceRecord[] {
  return state.performances
    .filter((p) => p.villageId === villageId)
    .sort((a, b) => b.year - a.year || b.day - a.day);
}
