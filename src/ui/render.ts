import { CORE_ROLES, PLAYS, REGION_NAMES, ROLE_NAMES } from '../game/data';
import { OWNER_PUBLIC_SHARES, type GameEngine } from '../game/engine';
import type { GameState, LedgerEntry, Play } from '../game/types';
import { clamp, dateLabel, silver } from '../game/utils';
import {
  baseAffinity,
  castReadiness,
  fairCountdown,
  findPath,
  getAffinity,
  getPlay,
  getVillage,
  neighborsOf,
  playBlockers,
  puppetReadiness,
  rivalAtVillage,
  routeBetween,
} from '../game/world';
import { demandReport, estimateShow, repairCost } from '../game/simulation';

export type Tab = 'map' | 'people' | 'box' | 'ledger';
export type LedgerFilter = 'all' | 'in' | 'out' | 'share';
export type ModalState =
  | { type: 'help' }
  | { type: 'settlement' }
  | { type: 'entry'; entryId: string }
  | { type: 'run'; runId: string; highlightDayId?: string };

export interface UiState {
  tab: Tab;
  selectedVillageId: string;
  selectedPlayId: string | null;
  days: number;
  ledgerFilter: LedgerFilter;
  modal: ModalState | null;
}

export function isBusy(state: GameState): boolean {
  return Boolean(state.travel || state.activeRunId || state.study || state.pendingChoice || state.settlement);
}

function esc(value: string | number): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function bar(label: string, value: number, kind: 'skill' | 'health' | 'loyalty' | 'condition'): string {
  const rounded = Math.round(value);
  return `
    <div class="bar-label"><span>${label}</span><b>${rounded}</b></div>
    <div class="progress ${kind}"><i style="width:${Math.max(2, rounded)}%"></i></div>
  `;
}

export function renderHeader(engine: GameEngine): string {
  const s = engine.state;
  const village = getVillage(s.currentVillageId);
  const weather = s.forecast[0];
  let location = `${village.name} · ${REGION_NAMES[village.region]}`;
  if (s.travel) {
    const to = getVillage(s.travel.toVillageId);
    location = `赶路往${to.name}（${s.travel.elapsedDays}/${s.travel.totalDays}日）`;
  }

  let advanceLabel = '推进一日';
  let advanceHint = '过一天，饭钱、天气、人情和行情都走动';
  if (s.settlement) {
    advanceLabel = '今年已经封箱';
    advanceHint = '可在年终账本查看分账，或重开一班';
  } else if (s.pendingChoice) {
    advanceLabel = '先决断挖角之事';
    advanceHint = '弹窗中的选择会决定人员去留';
  } else if (s.travel) {
    advanceLabel = `赶路一日（${s.travel.elapsedDays}/${s.travel.totalDays}）`;
    advanceHint = `正沿村路往${getVillage(s.travel.toVillageId).name}去`;
  } else if (s.activeRunId) {
    const run = s.runs.find((r) => r.id === s.activeRunId);
    advanceLabel = `唱今日戏（${run?.dayIds.length ?? 0}/${run?.agreedDays ?? 0}）`;
    advanceHint = '当日天气决定能否开台，戏钱和彩钱逐笔入账';
  } else if (s.study) {
    advanceLabel = `学艺一日（${s.study.elapsedDays}/${s.study.totalDays}）`;
    advanceHint = `正在拜${s.study.master}学《${getPlay(s.study.playId).title}》`;
  } else if (s.dayIndex >= 359) {
    advanceLabel = '腊月三十 · 封箱算账';
    advanceHint = '结算全年进项、花销和按股份钱';
  }

  return `
    <div class="title-block">
      <h1>一棚灯影</h1>
      <p>${esc(s.yearName)} · 老皮影戏班经营 · 一副戏箱走村串乡</p>
    </div>
    <div class="header-stats">
      <div class="stat-pill"><span class="k">日子</span><span class="v">${dateLabel(s.dayIndex)}</span></div>
      <div class="stat-pill"><span class="k">天气</span><span class="v">${weather?.icon ?? ''} ${weather?.kind ?? '—'}</span></div>
      <div class="stat-pill"><span class="k">所在</span><span class="v">${esc(location)}</span></div>
      <div class="stat-pill cash"><span class="k">公账现银</span><span class="v ${s.cash < 20 ? 'negative' : ''}">${silver(s.cash)} 元</span></div>
      <div class="stat-pill"><span class="k">班社名声</span><span class="v">${Math.round(s.reputation)}</span></div>
      <div class="stat-pill"><span class="k">全年台口</span><span class="v">${s.totalShows} 场 / ${s.totalAudiences}人</span></div>
    </div>
    <div class="header-actions">
      <div class="advance-wrap">
        <button class="btn primary" data-action="advance" ${s.pendingChoice || s.settlement ? 'disabled' : ''}>${advanceLabel}</button>
        <span class="advance-hint">${advanceHint}</span>
      </div>
      <button class="btn gold" data-action="tab" data-tab="ledger">年终账本</button>
      <button class="btn ghost" data-action="help">玩法规矩</button>
      <button class="btn danger sm" data-action="restart">重开一班</button>
    </div>
  `;
}

export function renderTabs(active: Tab): string {
  const tabs: Array<[Tab, string, string]> = [
    ['map', '🗺️ 地图巡演', '地图、村情、赶路、点戏'],
    ['people', '👥 戏班人员', '行当、病情、忠心、股份'],
    ['box', '🎭 戏箱唱本', '影人状况与拜师学戏'],
    ['ledger', '📒 年终账本', '每笔进项可查村、查场'],
  ];
  return tabs.map(([id, label, title]) => `
    <button class="tab-btn ${active === id ? 'active' : ''}" data-action="tab" data-tab="${id}" title="${title}">${label}</button>
  `).join('');
}

export function renderLog(engine: GameEngine): string {
  const entries = engine.state.log.slice(0, 42);
  return `
    <div class="card log-card">
      <h3>班中日志</h3>
      <div class="log-list">
        ${entries.map((entry) => `
          <div class="log-line ${entry.tone}">
            <span class="log-date">${entry.dateLabel}</span>
            <span class="log-text">${esc(entry.text)}</span>
          </div>`).join('')}
      </div>
    </div>`;
}

export function renderMapBottom(engine: GameEngine): string {
  const s = engine.state;
  return `
    <div class="card" style="margin-top:12px">
      <h3>未来几日天色</h3>
      <div class="forecast-strip">
        ${s.forecast.slice(0, 7).map((w, i) => `
          <div class="forecast-day ${w.rain ? 'rain' : ''}" title="${w.label}${w.severe ? '，恶劣天气' : ''}">
            <span>${i === 0 ? '今日' : i === 1 ? '明日' : w.label}</span>
            <span class="icon">${w.icon}</span>
            <b>${w.kind}</b>
          </div>`).join('')}
      </div>
      <p class="muted" style="margin-bottom:0">皮影幕面怕雨淋。预报有雨的日子不要硬排大戏；若立了合约，雨天停唱没有戏钱，还要按乡规包赔。</p>
    </div>
  `;
}

export function renderVillagePanel(engine: GameEngine, ui: UiState): string {
  const s = engine.state;
  const selectedId = ui.selectedVillageId || s.currentVillageId;
  const village = getVillage(selectedId);
  const current = getVillage(s.currentVillageId);
  const isCurrent = village.id === s.currentVillageId;
  const direct = routeBetween(s.currentVillageId, village.id);
  const path = findPath(s.currentVillageId, village.id);
  const neighbors = neighborsOf(village.id);
  const fairIn = fairCountdown(s, village);
  const rival = rivalAtVillage(s, village.id);
  const busy = isBusy(s);

  const fairClass = fairIn >= -1 && fairIn <= 3 ? 'fair-banner live' : 'fair-banner';
  const fairText = fairIn === 0
    ? `今日正是${village.templeName}正日`
    : fairIn > 0
      ? `${village.templeName}还有 ${fairIn} 天（${village.templeMonth}月${village.templeDay}）`
      : fairIn >= -2
        ? `${village.templeName}刚过，余场仍有人客`
        : `今年${village.templeMonth}月${village.templeDay}是${village.templeName}，眼下还早`;

  let actionHtml = '';
  const selectedIsTravelRoute = Boolean(
    s.travel && (s.travel.toVillageId === village.id || s.travel.fromVillageId === village.id),
  );
  if (selectedIsTravelRoute && s.travel) {
    const to = getVillage(s.travel.toVillageId);
    actionHtml = `<div class="busy-strip">🧳 戏班正沿村路往${to.name}赶路：${s.travel.elapsedDays}/${s.travel.totalDays} 天。地图上的“班”字会沿路移动。</div>`;
  } else if (!isCurrent) {
    if (direct) {
      actionHtml = `<button class="btn primary block" data-action="travel" data-to="${village.id}" ${busy ? 'disabled' : ''}>
        启程往${village.name} · ${direct.li}里 / ${direct.days}天
      </button>`;
    } else if (path && path.ids.length > 1) {
      const first = getVillage(path.ids[1]);
      actionHtml = `
        <div class="path-line">村路不直通，需逐村转场：<b>${path.ids.map((id) => getVillage(id).name).join(' → ')}</b><br>全程约 ${path.totalLi} 里，走 ${path.totalDays} 天。</div>
        <button class="btn primary block" data-action="travel" data-to="${first.id}" ${busy ? 'disabled' : ''}>先到第一站 ${first.name}</button>`;
    }
  } else if (s.travel) {
    actionHtml = `<div class="busy-strip">🧳 正在往${getVillage(s.travel.toVillageId).name}赶路：${s.travel.elapsedDays}/${s.travel.totalDays} 天</div>`;
  } else if (s.activeRunId) {
    const run = s.runs.find((r) => r.id === s.activeRunId);
    actionHtml = `<div class="busy-strip">🎭 ${village.name}合约演出：${run?.dayIds.length ?? 0}/${run?.agreedDays ?? 0} 天。点左上角“唱今日戏”推进。</div>`;
  } else if (s.study) {
    actionHtml = `<div class="busy-strip">📜 在${village.name}向${s.study.master}学《${getPlay(s.study.playId).title}》：${s.study.elapsedDays}/${s.study.totalDays} 天</div>`;
  } else {
    actionHtml = renderBooking(engine, ui);
  }

  return `
    <h2>${village.name} ${isCurrent ? '<span class="tag green">戏班在此</span>' : ''}</h2>
    <div class="muted">${REGION_NAMES[village.region]} · ${esc(village.taste)}</div>
    <div class="kv-grid">
      <div class="kv"><span class="k">人口</span><span class="v">${village.population}</span></div>
      <div class="kv"><span class="k">收成</span><span class="v">${Math.round(village.harvest * 100)}%</span></div>
      <div class="kv"><span class="k">富庶</span><span class="v">${Math.round(village.wealth * 100)}%</span></div>
    </div>
    <div class="${fairClass}">🏮 ${fairText}</div>
    <div class="gold-rule"></div>
    <div class="muted"><b>会首请戏：</b>按唱天数给戏钱，正日子管饭；收成和家底决定彩钱，庙会前后外村人最多。</div>
    ${rival ? `<div class="busy-strip" style="margin-top:10px">⚔️ ${rival.name}（手艺${rival.skill}、名声${rival.reputation}）正在此村唱《${getPlay(rival.playId).title}》，会分走看客。</div>` : ''}
    <div class="gold-rule"></div>
    ${actionHtml}
    <div class="gold-rule"></div>
    <h3>${isCurrent ? '邻村村路' : `${village.name}的邻村（点击规划路线）`}</h3>
    <div class="route-list">
      ${neighbors.map(({ village: n, li, days }) => {
        const chipAction = isCurrent ? 'travel' : 'select-village';
        const idAttribute = isCurrent ? `data-to="${n.id}"` : `data-id="${n.id}"`;
        const chipDisabled = isCurrent && busy ? 'disabled' : '';
        return `
        <button class="route-chip" data-action="${chipAction}" ${idAttribute} ${chipDisabled} title="${isCurrent ? `从当前所在${current.name}前往${n.name}` : '查看该村，并计算从戏班现位置出发的路线'}">
          <span><b>${n.name}</b><br><span class="muted small">${REGION_NAMES[n.region]} · ${n.templeName}</span></span>
          <span class="tag">${li}里</span>
          <span class="tag gold">${days}天</span>
        </button>`;
      }).join('')}
    </div>
    <p class="muted small">${isCurrent ? '点邻村 chip 可直接启程。' : '这里的里数是被查看村与邻村的距离；点击后会显示从戏班现位置出发的第一站。'}戏箱车日行三十里，只能沿村路逐村推进。当前所在：${current.name}。</p>
  `;
}

function renderBooking(engine: GameEngine, ui: UiState): string {
  const s = engine.state;
  const village = getVillage(s.currentVillageId);
  const owned = s.ownedPlayIds.map(getPlay);
  const chosen = owned.find((p) => p.id === ui.selectedPlayId) ?? owned[0];
  if (!chosen) return '<p class="muted">戏箱里没有唱本。</p>';

  const days = ui.days;
  const blockers = playBlockers(s, chosen).filter((b) => b !== '有一桩班务待决断' && b !== '今年已经封箱算账');
  const cast = castReadiness(s, chosen);
  const puppets = puppetReadiness(s, chosen);
  const base = baseAffinity(village, chosen);
  const recentCount = s.days.filter(
    (d) =>
      d.villageId === village.id &&
      d.playId === chosen.id &&
      !d.canceled &&
      d.dayIndex > s.dayIndex - 35,
  ).length;

  let projectedAffinity = getAffinity(s, village.id, chosen.id);
  const projections = Array.from({ length: days }, (_, index) => {
    if (projectedAffinity < base) {
      projectedAffinity += Math.max(0.18, (base - projectedAffinity) * 0.04);
    }
    const weather = s.forecast[Math.min(index + 1, s.forecast.length - 1)];
    const affinityUsed = clamp(projectedAffinity, 4, 98);
    const estimate = estimateShow(s, village.id, chosen.id, weather, affinityUsed);
    if (!weather?.rain) {
      projectedAffinity = clamp(affinityUsed - (22 + (recentCount + index) * 9), 4, 98);
    }
    return { weather, estimate, affinity: Math.round(affinityUsed) };
  });
  const firstEstimate = projections[0].estimate;

  let low = 0;
  let high = 0;
  let rainDays = 0;
  projections.forEach(({ weather, estimate }) => {
    low += estimate.dailyLow - estimate.rainCompensation - (0.7 + chosen.difficulty * 0.08);
    high += estimate.dailyHigh - estimate.rainCompensation - (0.7 + chosen.difficulty * 0.08);
    if (weather?.rain) rainDays += 1;
  });

  return `
    <h3>派戏排戏</h3>
    <p class="muted small">老人说：唱戏全看排得好不好。同一出戏近期唱得越多，本村喜欢程度掉得越狠；搁久了才慢慢恢复。</p>
    <div class="play-list">
      ${owned.map((play) => {
        const report = demandReport(s, village.id, play.id);
        const playBlock = playBlockers(s, play).filter((b) => !b.includes('班务') && !b.includes('封箱'));
        return `
          <button class="play-option ${chosen.id === play.id ? 'selected' : ''}" data-action="select-play" data-play="${play.id}">
            <span class="row1"><span>《${play.title}》</span><span class="tag gold">对路 ${report.affinity}</span></span>
            <span class="play-tags">${play.tags.slice(0, 4).map((t) => `<span class="tag">${t}</span>`).join('')}<span class="tag green">预期成色 ${Math.round(report.expectedQuality)}</span></span>
            ${playBlock.length ? `<div class="blocker">${playBlock.join('；')}</div>` : ''}
          </button>`;
      }).join('')}
    </div>

    <div class="detail-grid">
      <div class="estimate-cell">本村喜欢程度<b>${firstEstimate.affinity}/100</b></div>
      <div class="estimate-cell">预期演唱成色<b>${firstEstimate.quality}/100</b></div>
      <div class="estimate-cell">明日观众<b>${firstEstimate.audienceLow}–${firstEstimate.audienceHigh}</b></div>
      <div class="estimate-cell">单日毛进项<b>${firstEstimate.dailyLow}–${firstEstimate.dailyHigh}元</b></div>
    </div>
    <div class="muted small">
       cast：${cast.requirements.map((r) => `${r.label}${r.member ? `·${r.member.name}${r.substituted ? '替' : ''}` : '·缺'}`).join('，')}<br>
      影人平均成色 ${Math.round(puppets.averageCondition)}，最低 ${Math.round(puppets.minimumCondition)}。
    </div>

    <h3 style="margin-top:12px">连唱几天</h3>
    <div class="days-selector">
      ${[1, 2, 3, 4, 5].map((n) => `<button class="btn sm ${days === n ? 'primary' : ''}" data-action="set-days" data-days="${n}">${n}天</button>`).join('')}
    </div>
    <div class="forecast-strip">
      ${projections.map(({ weather, affinity }, i) => `
        <div class="forecast-day ${weather?.rain ? 'rain' : ''}" title="第${i + 1}天预计喜好 ${affinity}">
          <span>第${i + 1}天</span>
          <span class="icon">${weather?.icon ?? '🌤️'}</span>
          <b>${weather?.kind ?? '—'}</b>
          <span class="muted small">对路${affinity}</span>
        </div>
      `).join('')}
    </div>
    <div class="estimate-grid">
      <div class="estimate-cell">${days}天预计净进项<br><b>${silver(Math.max(0, low))}–${silver(Math.max(0, high))} 元</b></div>
      <div class="estimate-cell">雨日风险<br><b style="color:${rainDays ? 'var(--bad)' : 'var(--green)'}">${rainDays ? `${rainDays}日有雨/雪` : '近日无雨'}</b></div>
    </div>
    ${blockers.length ? `<div class="blocker" style="font-size:13px;margin-bottom:8px">还不能开戏：${blockers.join('；')}</div>` : ''}
    <button class="btn primary block" data-action="start-run" data-play="${chosen.id}" data-days="${days}" ${blockers.length ? 'disabled' : ''}>
      请会首写戏单 · 连唱${days}天《${chosen.title}》
    </button>
  `;
}

export function renderPeoplePage(engine: GameEngine): string {
  const s = engine.state;
  const net = s.ledger.filter((e) => e.direction === 'in').reduce((a, e) => a + e.amount, 0)
    - s.ledger.filter((e) => e.direction === 'out').reduce((a, e) => a + e.amount, 0);
  const active = s.members.filter((m) => m.status !== 'left');
  const memberShares = active.reduce((sum, m) => sum + m.shares, 0);
  const totalShares = OWNER_PUBLIC_SHARES + memberShares;
  const shareValue = Math.max(0, net) / totalShares;

  return `
    <div class="card" style="margin-bottom:16px">
      <h2>老规矩股份与行当</h2>
      <p class="muted">戏班不是发死工钱：全年刨去饭钱、盘缠、医药、雨赔和添置，净余按股份分派。班主的戏箱占三十股，公中香火/公积金占十五股；其余是签手、上手、下手、胡琴、锣鼓和学徒的身股。谁病倒、被挖走，对应的一摊就可能开不了戏。</p>
      <div class="table-wrap" style="overflow-x:auto">
        <table class="share-table">
          <thead><tr><th>股份账</th><th>股数</th><th class="num">若今日封箱每股/本人可得</th></tr></thead>
          <tbody>
            <tr><td>班主箱股 + 公中</td><td>${OWNER_PUBLIC_SHARES}</td><td class="num">留作来年箱底</td></tr>
            ${active.map((m) => `<tr><td>${esc(m.name)} · ${ROLE_NAMES[m.role]}</td><td>${m.shares}</td><td class="num">≈ ${silver(m.shares * shareValue)} 元</td></tr>`).join('')}
            <tr><td><b>合计</b></td><td><b>${totalShares}</b></td><td class="num"><b>每股 ${silver(shareValue)} 元</b></td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="section-grid">
      ${s.members.map((m) => {
        if (m.status === 'left') {
          return `<div class="member-card" style="opacity:.62">
            <div class="member-head"><div><div class="member-name">${esc(m.name)}</div><span class="role-badge">${ROLE_NAMES[m.role]}</span></div><span class="status-badge left">已离班</span></div>
            <p class="muted">${esc(m.bio)}</p><p class="blocker">此人已被别的班挖走，需另请人补行当。</p>
          </div>`;
        }
        return `
          <div class="member-card">
            <div class="member-head">
              <div><div class="member-name">${esc(m.name)}</div><span class="role-badge">${ROLE_NAMES[m.role]}</span>${m.covers.length ? `<span class="tag" style="margin-left:6px">可替：${m.covers.map((r) => ROLE_NAMES[r]).join('、')}</span>` : ''}</div>
              <span class="status-badge ${m.status}">${m.status === 'sick' ? `病倒·${m.sickDays}日` : '能上场'}</span>
            </div>
            <p class="muted small">${esc(m.bio)}</p>
            ${bar('手艺', m.skill, 'skill')}
            ${bar('身子骨', m.health, 'health')}
            ${bar('忠心', m.loyalty, 'loyalty')}
            <div class="muted small">老规矩身股：<b>${m.shares} 股</b> · 年龄 ${m.age}</div>
            <div class="member-actions">
              <button class="btn green sm" data-action="treat" data-id="${m.id}" ${s.settlement || s.cash < 4 ? 'disabled' : ''}>抓药 ¥4</button>
              <button class="btn ghost sm" data-action="reward" data-id="${m.id}" data-amount="5" ${s.settlement || s.cash < 5 ? 'disabled' : ''}>赏茶钱 ¥5</button>
              <button class="btn gold sm" data-action="reward" data-id="${m.id}" data-amount="12" ${s.settlement || s.cash < 12 ? 'disabled' : ''}>封花红 ¥12</button>
              <button class="btn primary sm" data-action="reward" data-id="${m.id}" data-amount="18" ${s.settlement || s.cash < 18 ? 'disabled' : ''}>厚赏 ¥18</button>
            </div>
          </div>`;
      }).join('')}

      <div class="member-card">
        <h3>托会首寻人搭班</h3>
        <p class="muted small">关键行当空了，可以请成熟把式，也可以收便宜学徒；学徒能顶基础活路，但压不住大戏。</p>
        ${CORE_ROLES.map(({ role, label }) => `
          <div class="route-chip" style="grid-template-columns:1fr auto auto">
            <span><b>${label}</b></span>
            <button class="btn primary sm" data-action="hire" data-role="${role}" data-apprentice="false" ${s.settlement || s.cash < 16 ? 'disabled' : ''}>把式 ¥16</button>
            <button class="btn ghost sm" data-action="hire" data-role="${role}" data-apprentice="true" ${s.settlement || s.cash < 6 ? 'disabled' : ''}>学徒 ¥6</button>
          </div>`).join('')}
      </div>
    </div>
  `;
}

export function renderBoxPage(engine: GameEngine): string {
  const s = engine.state;
  const repairAllCost = s.puppets.reduce((sum, p) => sum + repairCost(p.condition, p.unitCost, p.count), 0);

  return `
    <div class="card" style="margin-bottom:16px">
      <div class="toolbar" style="justify-content:space-between">
        <div><h2 style="margin:0">影人行头</h2><p class="muted" style="margin:4px 0 0">影人每唱一场都会旧；成色差了影响台面，旧到极点便难以撑戏。</p></div>
        <button class="btn primary" data-action="repair-all" ${s.settlement || repairAllCost === 0 || s.cash < repairAllCost ? 'disabled' : ''}>全园检修 · ¥${repairAllCost}</button>
      </div>
      <div class="section-grid">
        ${s.puppets.map((p) => {
          const cost = repairCost(p.condition, p.unitCost, p.count);
          return `
            <div class="asset-card">
              <div class="member-head"><h3 style="margin:0">${p.name}</h3><span class="tag gold">${p.count} 件</span></div>
              <p class="muted small">${esc(p.note)}</p>
              ${bar('成色', p.condition, 'condition')}
              <div class="member-actions">
                <button class="btn green sm" data-action="repair" data-id="${p.id}" ${s.settlement || cost === 0 || s.cash < cost ? 'disabled' : ''}>修补 ¥${cost}</button>
                <button class="btn gold sm" data-action="buy" data-id="${p.id}" ${s.settlement || s.cash < p.unitCost ? 'disabled' : ''}>添新一件 ¥${p.unitCost}</button>
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>

    <div class="card">
      <h2>唱本与拜师</h2>
      <p class="muted">戏箱里的影人、行当和唱本共同决定能唱哪些戏。未学会的戏可拜民间老艺人为师，花束脩、住几天学全本。</p>
      <div class="section-grid">
        ${PLAYS.map((play) => renderScriptCard(engine, play)).join('')}
      </div>
    </div>
  `;
}

function renderScriptCard(engine: GameEngine, play: Play): string {
  const s = engine.state;
  const owned = s.ownedPlayIds.includes(play.id);
  const studyThis = s.study?.playId === play.id;
  const played = s.days.filter((d) => d.playId === play.id && !d.canceled).length;
  const blockers = owned ? playBlockers(s, play).filter((b) => !b.includes('封箱') && !b.includes('班务')) : [];
  const puppetNames = play.requiredPuppets
    .map((id) => s.puppets.find((p) => p.id === id)?.name ?? id)
    .join('、');

  return `
    <div class="script-card">
      <div class="member-head">
        <h3 style="margin:0">《${play.title}》</h3>
        ${owned ? '<span class="tag green">已在唱本</span>' : '<span class="tag">未学</span>'}
      </div>
      <div class="muted small">${esc(play.subtitle)}</div>
      <p class="muted">${esc(play.blurb)}</p>
      <div class="play-tags">${play.tags.map((t) => `<span class="tag">${t}</span>`).join('')}<span class="tag gold">难度 ${play.difficulty}/5</span>${played ? `<span class="tag green">本班唱过 ${played} 场</span>` : ''}</div>
      <p class="muted small" style="margin-top:9px">所需影人：${puppetNames}</p>
      ${owned ? `
        ${blockers.length ? `<div class="blocker">眼下不能唱：${blockers.join('；')}</div>` : '<div class="muted small" style="color:var(--good)">行当、唱本、影人齐备，可排。</div>'}
      ` : `
        <p class="muted small">师父：<b>${play.master}</b> · 束脩 <b>¥${play.studyCost}</b> · 学期 <b>${play.studyDays}天</b></p>
        ${studyThis ? `<div class="busy-strip">学艺中 ${s.study?.elapsedDays}/${s.study?.totalDays} 天</div>` : `
          <button class="btn primary sm block" data-action="learn" data-id="${play.id}" ${s.study || s.travel || s.activeRunId || s.cash < play.studyCost || s.pendingChoice || s.settlement ? 'disabled' : ''}>
            拜师学戏 · ¥${play.studyCost} / ${play.studyDays}天
          </button>`}
      `}
    </div>
  `;
}

export function renderLedgerPage(engine: GameEngine, ui: UiState): string {
  const s = engine.state;
  const income = s.ledger.filter((e) => e.direction === 'in').reduce((a, e) => a + e.amount, 0);
  const expense = s.ledger.filter((e) => e.direction === 'out').reduce((a, e) => a + e.amount, 0);
  const shared = s.ledger.filter((e) => e.direction === 'share').reduce((a, e) => a + e.amount, 0);
  const net = income - expense;
  const filter = ui.ledgerFilter;
  const entries = [...s.ledger]
    .reverse()
    .filter((e) => filter === 'all' || e.direction === filter);

  return `
    ${s.settlement ? renderSettlementHero(engine) : `
      <div class="card" style="margin-bottom:14px">
        <div class="toolbar" style="justify-content:space-between">
          <div><h2 style="margin:0">年终账本</h2><p class="muted" style="margin:4px 0 0">每一笔演出戏钱、彩钱、赏银都挂着村子、合约和当日场次，可点击核查。</p></div>
          <button class="btn danger" data-action="settle" ${s.pendingChoice ? 'disabled' : ''}>立即封箱算账</button>
        </div>
      </div>`}

    <div class="ledger-summary">
      <div class="summary-box"><span class="k">全年进项</span><span class="v in">${silver(income)}</span></div>
      <div class="summary-box"><span class="k">经营花销</span><span class="v out">${silver(expense)}</span></div>
      <div class="summary-box"><span class="k">未分净余</span><span class="v ${net >= 0 ? 'net-good' : 'net-bad'}">${silver(net)}</span></div>
      <div class="summary-box"><span class="k">已发股份钱</span><span class="v out">${silver(shared)}</span></div>
      <div class="summary-box"><span class="k">现存公账</span><span class="v">${silver(s.cash)}</span></div>
    </div>

    <div class="card">
      <div class="toolbar">
        ${([
          ['all', '全部账目'], ['in', '各项进项'], ['out', '花销赔偿'], ['share', '年终分账'],
        ] as Array<[LedgerFilter, string]>).map(([id, label]) => `
          <button class="btn sm filter-btn ${filter === id ? 'active' : 'ghost'}" data-action="ledger-filter" data-filter="${id}">${label}</button>
        `).join('')}
        <span class="muted small">共 ${entries.length} 笔</span>
      </div>
      <div class="ledger-list">
        ${entries.length === 0 ? '<p class="muted">这一类还没有账目。</p>' : entries.map(renderLedgerRow).join('')}
      </div>
    </div>
  `;
}

function renderLedgerRow(entry: LedgerEntry): string {
  const villageName = entry.source.villageId ? getVillage(entry.source.villageId).name : '';
  const clickable = entry.direction === 'in' || Boolean(entry.source.runId);
  const sign = entry.direction === 'in' ? '+' : entry.direction === 'share' ? '份 ' : '-';
  const amountClass = entry.direction;
  const content = `
    <span class="ledger-date">${entry.dateLabel}</span>
    <span>
      <span class="ledger-title">${esc(entry.title)}${entry.direction === 'in' ? '<span class="click-hint">点开查村查场 →</span>' : ''}</span>
      <span class="ledger-sub">${entry.category}${villageName ? ` · ${villageName}` : ''}${entry.note ? ` · ${esc(entry.note)}` : ''}</span>
    </span>
    <span class="ledger-amount ${amountClass}">${sign}${silver(entry.amount)}</span>
  `;
  return clickable
    ? `<button class="ledger-row" data-action="open-entry" data-id="${entry.id}">${content}</button>`
    : `<div class="ledger-row">${content}</div>`;
}

function renderSettlementHero(engine: GameEngine): string {
  const settlement = engine.state.settlement!;
  return `
    <div class="settlement-hero">
      <div class="settlement-grade">${settlement.grade}</div>
      <h2>${settlement.title}</h2>
      <p style="max-width:760px;margin:8px auto 14px;line-height:1.8;color:rgba(255,241,199,.88)">${settlement.summary}</p>
      <button class="btn gold" data-action="open-settlement">查看股份分派</button>
    </div>
  `;
}

export function renderModal(engine: GameEngine, ui: UiState): string {
  const s = engine.state;
  if (s.pendingChoice) return renderChoiceModal(engine);
  if (!ui.modal) return '';
  if (ui.modal.type === 'help') return renderHelpModal();
  if (ui.modal.type === 'settlement') return renderSettlementModal(engine);
  if (ui.modal.type === 'entry') return renderEntryModal(engine, ui.modal.entryId);
  if (ui.modal.type === 'run') return renderRunModal(engine, ui.modal.runId, ui.modal.highlightDayId);
  return '';
}

function modalShell(title: string, body: string, wide = false): string {
  return `
    <div class="modal-overlay">
      <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
        <div class="modal-head">
          <h2 class="modal-title">${title}</h2>
          <button class="close-x" data-action="close-modal" aria-label="关闭">×</button>
        </div>
        ${body}
      </div>
    </div>`;
}

function renderChoiceModal(engine: GameEngine): string {
  const choice = engine.state.pendingChoice!;
  const member = engine.state.members.find((m) => m.id === choice.memberId);
  const rival = engine.state.rivals.find((r) => r.id === choice.rivalId);
  return `
    <div class="modal-overlay">
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-head"><h2 class="modal-title">${choice.title}</h2></div>
        <p style="font-size:15px;line-height:1.9">${esc(choice.body)}</p>
        <p class="muted">当事人：<b>${member?.name ?? '班里人'}</b> · 挖角戏班：<b>${rival?.name ?? '外班'}</b> · 当前忠心 ${Math.round(member?.loyalty ?? 0)}</p>
        <div class="choice-options">
          ${choice.options.map((option) => {
            const disabled = option.cost !== undefined && engine.state.cash < option.cost;
            return `
              <button class="choice-option" data-action="resolve-choice" data-choice="${option.id}" ${disabled ? 'disabled' : ''}>
                <span><b>${esc(option.label)}</b><br><span class="muted small">${esc(option.detail)}</span>${disabled ? '<br><span class="blocker">公账现银不足</span>' : ''}</span>
                ${option.cost !== undefined ? `<span class="cost">¥${option.cost}</span>` : '<span></span>'}
              </button>`;
          }).join('')}
        </div>
      </div>
    </div>`;
}

function renderHelpModal(): string {
  return modalShell('老戏班经营规矩', `
    <div class="help-grid">
      <div class="help-item"><b>① 看村情排戏</b><br>每村有人口、收成、富庶、庙会日子和爱听的行当。关帝会爱三国忠烈，娘娘会爱旦角吉祥戏。</div>
      <div class="help-item"><b>② 喜欢程度会起落</b><br>同一出戏近期唱过会明显掉热度，连续唱更腻；隔些日子不唱，喜欢程度会慢慢恢复。</div>
      <div class="help-item"><b>③ 赶路按里数</b><br>戏箱车日行三十里，路线和里数画在 Canvas 地图上。只能到邻村，远村要一站站走。</div>
      <div class="help-item"><b>④ 行当不能缺</b><br>签手、上手、下手、胡琴、锣鼓各管一摊。病倒或被挖走，可用学徒顶替，也可托会首请人。</div>
      <div class="help-item"><b>⑤ 影人要修要添</b><br>常唱的神怪、武打影人磨损最快；成色太低会降低演出质量，需花钱修补或添新。</div>
      <div class="help-item"><b>⑥ 唱本靠拜师</b><br>未会的戏要花束脩和数日学全。难戏报酬高，但要求手艺、行当和影人都硬。</div>
      <div class="help-item"><b>⑦ 雨天要赔</b><br>皮影怕雨淋。雨日不能唱，当日收入归零，还要赔会首定钱；未来七日天气可提前看。</div>
      <div class="help-item"><b>⑧ 年底按股分账</b><br>每笔进项都能点开查村、查合约、查当日观众、成色和天气。腊月三十封箱，看箱底评年景。</div>
    </div>
    <div style="margin-top:16px;text-align:right"><button class="btn primary" data-action="close-modal">知道了</button></div>
  `, true);
}

function renderSettlementModal(engine: GameEngine): string {
  const z = engine.state.settlement;
  if (!z) return '';
  return modalShell(`${z.grade} · ${z.title}`, `
    <p style="line-height:1.9">${z.summary}</p>
    <div class="detail-grid">
      <div class="estimate-cell">全年总进项<b>${silver(z.totalIncome)}</b></div>
      <div class="estimate-cell">演出进项<b>${silver(z.totalPerformanceIncome)}</b></div>
      <div class="estimate-cell">经营花销<b>${silver(z.totalExpense)}</b></div>
      <div class="estimate-cell">封箱前净余<b>${silver(z.operatingNet)}</b></div>
      <div class="estimate-cell">同人股份支出<b>${silver(z.payouts.reduce((a, p) => a + p.amount, 0))}</b></div>
      <div class="estimate-cell">最终箱底<b>${silver(z.finalCash)}</b></div>
    </div>
    <div style="overflow-x:auto">
      <table class="share-table">
        <thead><tr><th>领份人</th><th>行当</th><th>身股</th><th class="num">分到银钱</th></tr></thead>
        <tbody>
          ${z.payouts.map((p) => `<tr><td>${esc(p.name)}</td><td>${ROLE_NAMES[p.role]}</td><td>${p.shares}</td><td class="num"><b>¥${silver(p.amount)}</b></td></tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="toolbar" style="justify-content:flex-end;margin-top:16px">
      <button class="btn ghost" data-action="close-modal">再看看账本</button>
      <button class="btn primary" data-action="close-and-ledger">打开年终账本页</button>
    </div>
  `, true);
}

function renderEntryModal(engine: GameEngine, entryId: string): string {
  const entry = engine.state.ledger.find((e) => e.id === entryId);
  if (!entry) return modalShell('账目找不着了', '<p>这笔账可能已被重开清除。</p>');
  const village = entry.source.villageId ? getVillage(entry.source.villageId) : null;
  const run = entry.source.runId ? engine.state.runs.find((r) => r.id === entry.source.runId) : null;
  const day = entry.source.dayId ? engine.state.days.find((d) => d.id === entry.source.dayId) : null;

  return modalShell(`账目核查 · ${entry.category}`, `
    <div class="detail-grid">
      <div class="estimate-cell">日期<b>${entry.dateLabel}</b></div>
      <div class="estimate-cell">方向<b>${entry.direction === 'in' ? '进项' : entry.direction === 'share' ? '分账' : '花销'}</b></div>
      <div class="estimate-cell">银钱<b>${entry.direction === 'in' ? '+' : entry.direction === 'share' ? '份 ' : '-'}${silver(entry.amount)} 元</b></div>
      ${village ? `<div class="estimate-cell">村子<b>${village.name}</b></div>` : ''}
    </div>
    <h3>${esc(entry.title)}</h3>
    <p class="muted">${esc(entry.note || '这笔账没有更多备注。')}</p>
    ${day ? renderPerfDay(engine, day.id, true) : ''}
    ${run ? `
      <div class="toolbar" style="margin-top:12px">
        <button class="btn blue" data-action="open-run" data-run="${run.id}" data-highlight="${day?.id ?? ''}">查看这一整场 ${run.agreedDays} 天合约</button>
      </div>` : ''}
    <div style="text-align:right;margin-top:14px"><button class="btn primary" data-action="close-modal">合上账本</button></div>
  `, true);
}

function renderRunModal(engine: GameEngine, runId: string, highlightDayId?: string): string {
  const run = engine.state.runs.find((r) => r.id === runId);
  if (!run) return modalShell('合约找不着了', '<p>没有这场戏的记录。</p>');
  const village = getVillage(run.villageId);
  const play = getPlay(run.playId);
  const days = engine.state.days.filter((d) => d.runId === run.id).sort((a, b) => a.dayIndex - b.dayIndex);
  return modalShell(`${village.name} · 《${play.title}》`, `
    <p class="muted">会首写戏 ${run.agreedDays} 天，实际记录 ${days.length} 天；合约${run.completed ? '已唱满收口' : '尚未唱完'}。总进项 ${silver(run.totalIncome)} 元，杂用/赔偿 ${silver(run.totalExpense)} 元。</p>
    ${days.map((d) => renderPerfDay(engine, d.id, d.id === highlightDayId)).join('')}
    <div style="text-align:right;margin-top:14px"><button class="btn primary" data-action="close-modal">合上戏单</button></div>
  `, true);
}

function renderPerfDay(engine: GameEngine, dayId: string, highlight: boolean): string {
  const day = engine.state.days.find((d) => d.id === dayId);
  if (!day) return '';
  const play = getPlay(day.playId);
  const village = getVillage(day.villageId);
  const compensation = day.compensation ?? day.rainCompensation;
  const cancelLabel = day.cancelKind === 'rain'
    ? '雨阻停唱'
    : day.cancelKind === 'cast'
      ? '行当不齐 · 回戏'
      : '停唱';
  return `
    <div class="perf-day ${highlight ? 'highlight' : ''}">
      <div class="toolbar" style="justify-content:space-between;margin:0">
        <b>${day.dateLabel} · ${village.name} · 《${play.title}》</b>
        <span class="tag ${day.canceled ? '' : 'green'}">${day.weather}${day.canceled ? ` · ${cancelLabel}` : ` · 成色${day.quality}`}</span>
      </div>
      ${day.canceled ? `
        <p class="blocker" style="margin:8px 0">${day.reasons.map(esc).join('；')}</p>
        <div class="muted small">当日无观众、无戏钱；${compensation > 0 ? `包赔 <b>¥${silver(compensation)}</b>。` : '未另出现金赔偿，但合约日数照耗、名声受损。'}</div>
      ` : `
        <div class="detail-grid" style="margin-bottom:0">
          <div class="estimate-cell">到场看客<b>${day.audience}人</b></div>
          <div class="estimate-cell">会首戏钱<b>¥${silver(day.hostFee)}</b></div>
          <div class="estimate-cell">观众彩钱<b>¥${silver(day.tips)}</b></div>
          <div class="estimate-cell">庙会赏银<b>¥${silver(day.fairBonus)}</b></div>
        </div>
        <p class="muted small" style="margin-bottom:0">${day.reasons.map(esc).join('；')}</p>
      `}
    </div>`;
}
