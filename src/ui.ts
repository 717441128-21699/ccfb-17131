import {
  PLAYS,
  PLAY_MAP,
  PUPPET_KINDS,
  PUPPET_MAP,
  ROLE_LABELS,
  TAG_LABELS,
  VILLAGES,
  VILLAGE_MAP,
} from './data';
import {
  baseAffinity,
  CORE_ROLES,
  dateLabel,
  fairDay,
  getAdjacent,
  getAffinityView,
  getContractOffer,
  getPlayBlockers,
  getPuppetReadiness,
  getVacantRoles,
  travelDaysForLi,
} from './engine';
import type { GameState, LedgerEntry, PerformanceRecord, RoleId } from './types';

export type LedgerFilter = 'all' | 'income' | 'expense';

export function money(n: number): string {
  return `${Math.round(n).toLocaleString('zh-CN')}文`;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch] as string);
}

function bar(value: number, lowAt = 35): string {
  const low = value < lowAt ? ' low' : '';
  return `<div class="bar${low}"><i style="width:${Math.max(0, Math.min(100, value))}%"></i></div>`;
}

export function topStats(state: GameState): string {
  const v = VILLAGE_MAP[state.currentVillageId];
  const due = state.members.reduce((s, m) => s + m.accruedShare, 0);
  return `
    <header class="app-header">
      <div class="title-block">
        <div class="seal">影</div>
        <div>
          <h1>一箱皮影走村乡</h1>
          <div class="subtitle">第 ${state.year} 年 · ${dateLabel(state.day)} · ${v.name}地面 · 天色${state.weather}，后三日 ${state.forecast.join(' / ')}</div>
        </div>
      </div>
      <div class="header-side">
        <button class="btn help-btn" data-action="open-help">玩法规矩</button>
        <div class="header-stats">
          <div class="stat cash ${state.cash < 0 ? 'bad' : ''}"><span class="k">柜上现银</span><span class="v">${money(state.cash)}</span></div>
          <div class="stat"><span class="k">班社名声</span><span class="v">${Math.round(state.reputation)} / 100</span></div>
          <div class="stat"><span class="k">本年上台</span><span class="v">${state.performances.filter((p) => p.year === state.year && !p.cancelled).length} 场</span></div>
          <div class="stat ${state.debt > 0 ? 'bad' : ''}"><span class="k">外债</span><span class="v">${money(state.debt)}</span></div>
          <div class="stat ${due > state.cash ? 'bad' : ''}"><span class="k">欠记身股</span><span class="v">${money(due)}</span></div>
        </div>
      </div>
    </header>
  `;
}

export function tabs(active: string): string {
  const items: Array<[string, string, string]> = [
    ['map', '地图巡演', '🗺️'],
    ['troupe', '戏班人员', '🎭'],
    ['chest', '戏箱唱本', '📜'],
    ['ledger', '年终账本', '📒'],
  ];
  return `<nav class="tabs">${items.map(([id, label, icon]) => `
    <button class="tab-btn ${active === id ? 'active' : ''}" data-action="tab" data-tab="${id}">
      <span aria-hidden="true">${icon}</span> ${label}
    </button>`).join('')}</nav>`;
}

function shortestRoute(state: GameState, fromId: string, toId: string) {
  const queue: Array<{ id: string; path: string[]; li: number }> = [{ id: fromId, path: [fromId], li: 0 }];
  const seen = new Set([fromId]);
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur.id === toId) return cur;
    for (const adj of getAdjacent(state, cur.id)) {
      if (seen.has(adj.village.id)) continue;
      seen.add(adj.village.id);
      queue.push({ id: adj.village.id, path: [...cur.path, adj.village.id], li: cur.li + adj.edge.li });
    }
  }
  return null;
}

function villageContractPanel(state: GameState, villageId: string): string {
  const v = VILLAGE_MAP[villageId];
  const isCurrent = villageId === state.currentVillageId;
  const offer = isCurrent ? getContractOffer(state) : null;
  const fd = fairDay(v);
  const toFair = fd - state.day;
  const fairText = toFair === 0 ? '今日正期' : toFair > 0 ? `还有 ${toFair} 日` : `已过 ${-toFair} 日`;
  const prefs = Object.entries(v.preferences)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 5)
    .map(([tag, val]) => `<span class="tag">${TAG_LABELS[tag] ?? tag} ×${(val ?? 1).toFixed(2)}</span>`)
    .join('');

  let action = '';
  if (state.settlement) {
    action = `<button class="btn primary block" data-action="open-settlement">查看年终账本</button>`;
  } else if (isCurrent) {
    if (offer) {
      action = `
        <div class="offer-box">
          <h4>${offer.kind} · ${offer.eventName}</h4>
          <div class="small-note">${offer.reason ?? ''}</div>
          <div class="price-line">
            <span class="pill">${offer.nights} 夜</span>
            <span class="pill green">每夜 ${money(offer.payPerNight)}</span>
            <span class="pill blue">每夜管饭折 ${money(offer.mealPerPerson * state.members.length)}</span>
          </div>
          <button class="btn primary block" data-action="open-booking">请会首点戏、签台口</button>
        </div>`;
    } else {
      action = `<div class="empty">会首说眼下没有庙会或还愿帖子；可休整、排戏，或往下一个村子赶。</div>`;
    }
  } else {
    const edge = state.routes.find(
      (r) => (r.from === state.currentVillageId && r.to === villageId) ||
        (r.to === state.currentVillageId && r.from === villageId),
    );
    if (edge) {
      const days = travelDaysForLi(edge.li);
      const cost = days * 85 + Math.round(edge.li * 0.8);
      action = `<button class="btn green block" data-action="travel" data-id="${v.id}">启程去${v.name} · ${edge.li}里 / ${days}日 / ${money(cost)}盘缠</button>`;
    } else {
      const route = shortestRoute(state, state.currentVillageId, villageId);
      action = route
        ? `<div class="hint-box">${v.name}不搭邻路，不能一步跳到。规划路径：${route.path.map((id) => VILLAGE_MAP[id].name).join(' → ')}；合计 ${route.li} 里，约 ${travelDaysForLi(route.li)} 日，需逐村启程。</div>`
        : '<div class="empty">没有找着村路。</div>';
    }
  }

  return `
    <section class="paper-card card-pad">
      <h2 class="card-title"><span class="title-text">${esc(v.name)} <span class="small-note">· ${v.region}</span></span></h2>
      <p class="small-note" style="margin-top:0">${esc(v.blurb)}</p>
      <dl class="kv">
        <dt>人户</dt><dd>${v.population} 口 / ${v.households} 户</dd>
        <dt>收成</dt><dd>${Math.round(v.harvest * 100)} 成年景 ${bar(v.harvest * 100, 75)}</dd>
        <dt>庙会</dt><dd>${v.fairMonth}月${v.fairDay}日 · ${v.fairName}（${fairText}）</dd>
        <dt>戏台</dt><dd>${v.stage}；雨雪天可能回戏赔钱</dd>
        <dt>口味</dt><dd><div class="tag-row">${prefs}</div></dd>
      </dl>
      ${v.favoritePlayId ? `<div class="hint-box">本村偏爱：<b>《${PLAY_MAP[v.favoritePlayId].name}》</b>，初始缘分约 ${baseAffinity(v.id, v.favoritePlayId)}。</div>` : ''}
      ${action}
    </section>`;
}

export function renderMapTab(state: GameState, selectedId: string): string {
  const sid = VILLAGE_MAP[selectedId] ? selectedId : state.currentVillageId;
  const adjacent = getAdjacent(state, state.currentVillageId);
  const logs = state.logs.slice(0, 18).map((l) => `
    <div class="log-line ${l.tone}">
      <span class="d">${l.dateLabel}</span>
      <span>${esc(l.text)}</span>
    </div>`).join('');

  return `
  <div class="grid-map">
    <div style="display:grid;gap:16px;min-width:0">
      <section class="paper-card map-canvas-wrap">
        <div class="card-pad" style="padding-bottom:8px">
          <h2 class="card-title"><span class="title-text">三乡庙会村路图</span>
            <span class="pill gray">邻村才能走 · 35里/日</span>
          </h2>
        </div>
        <canvas id="map-canvas" aria-label="皮影戏班巡演地图"></canvas>
      </section>
      <section class="paper-card card-pad">
        <h2 class="card-title"><span class="title-text">班社日志</span></h2>
        <div class="log-list">${logs || '<div class="empty">还没有日志。</div>'}</div>
      </section>
    </div>

    <div class="side-stack">
      ${villageContractPanel(state, sid)}
      <section class="paper-card card-pad">
        <h2 class="card-title"><span class="title-text">当前村手脚</span></h2>
        <div class="btn-row">
          <button class="btn" data-action="rest">休整一日（${money(78)}饭钱）</button>
          <button class="btn blue" data-action="reward">犒赏全班（${money(130)}）</button>
          <button class="btn ghost" data-action="borrow" data-amount="500">借银500</button>
          <button class="btn ghost" data-action="borrow" data-amount="1000">借银1000</button>
        </div>
        <div class="small-note" style="margin-top:8px">借钱上限 3000 文，年关加二行息并优先偿还；柜上转不开时可救命，但会拉低年成。</div>
        <div class="route-list">
          ${adjacent.map((a) => `
            <div class="route-item">
              <div class="route-main">
                <b>${a.village.name}</b>
                <span>${a.edge.li}里 · 走${a.days}日 · ${a.village.fairMonth}/${a.village.fairDay} ${a.village.fairName}</span>
              </div>
              <button class="btn sm primary" data-action="${sid === a.village.id ? 'travel-selected' : 'travel'}" data-id="${a.village.id}">去</button>
            </div>`).join('')}
        </div>
      </section>
    </div>
  </div>`;
}

function memberCard(m: GameState['members'][number]): string {
  const due = Math.round(m.accruedShare);
  const sick = m.status !== '正常' && m.status !== '被挖走';
  return `
  <article class="member-card" style="${m.status === '被挖走' ? 'opacity:.62' : ''}">
    <div class="member-head">
      <div style="display:flex;gap:10px;min-width:0">
        <div class="avatar">${esc(m.name[0])}</div>
        <div style="min-width:0">
          <div class="member-name">${esc(m.name)}</div>
          <div class="role-tag">${ROLE_LABELS[m.role]} · ${m.age}岁 · 技艺 ${m.skill}</div>
          ${m.status !== '正常' ? `<div class="status-bad">${m.status}${sick ? ` · 还需将养${m.illnessDays}日` : ''}</div>` : ''}
        </div>
      </div>
      <div class="pill">${m.share} 股</div>
    </div>
    <p class="bio">${esc(m.bio)}</p>
    <div class="bar-grid">
      <div class="bar-row"><span>身子</span>${bar(m.health, 45)}<b>${Math.round(m.health)}</b></div>
      <div class="bar-row"><span>气力</span>${bar(m.stamina)}<b>${Math.round(m.stamina)}</b></div>
      <div class="bar-row"><span>人心</span>${bar(m.loyalty, 45)}<b>${Math.round(m.loyalty)}</b></div>
    </div>
    <div class="share-line"><span>本年已唱 ${m.shows} 场 · 滚存身股</span><span>${money(due)}</span></div>
    ${sick ? `<button class="btn sm primary" data-action="medicine-member" data-id="${m.id}">请医抓药 ${money(70)}</button>` : ''}
  </article>`;
}

export function renderTroupeTab(state: GameState): string {
  const vacant = getVacantRoles(state);
  return `
    <section class="paper-card card-pad" style="margin-bottom:16px">
      <div class="toolbar" style="margin-bottom:8px">
        <h2 class="card-title" style="margin:0"><span class="title-text">班社人员与老规矩股份</span></h2>
        <button class="btn blue" data-action="reward">割肉打酒犒赏全班（${money(130)}）</button>
      </div>
      <p class="small-note" style="margin:0">
        每唱一夜，戏钱加赏钱先留公摊，再提 <b>38%</b> 按在场人员的股份分派并滚存到本人名下；其余 <b>62%</b> 为箱股、脚钱、饭食、修补和班主余利。年景越好、越少出事，年下余银越厚。
        年下封箱时，账上有钱便按各人名下一次发清。签手、上手是顶梁柱，股份最重；打锣鼓和拉胡琴各掌一场场面。
      </p>
      ${vacant.length ? `<div class="hint-box danger-box"><b>缺角：</b>${vacant.map((r) => ROLE_LABELS[r]).join('、')}。核心五档缺一个，对应戏就开不了台；可托当前村会首寻人。</div>` : ''}
    </section>

    ${vacant.length ? `
      <section class="paper-card card-pad" style="margin-bottom:16px">
        <h3>张榜请人搭班 · 安家钱 ${money(240)}</h3>
        <div class="btn-row">
          ${vacant.map((r) => `<button class="btn primary" data-action="hire" data-role="${r}">请${ROLE_LABELS[r]}</button>`).join('')}
        </div>
      </section>` : ''}

    <div class="section-grid">${state.members.map((m) => memberCard(m)).join('')}</div>
  `;
}

function puppetCard(state: GameState, kindId: string): string {
  const def = PUPPET_MAP[kindId];
  const stock = state.puppets.find((p) => p.kindId === kindId);
  const count = stock?.count ?? 0;
  const condition = stock?.condition ?? 0;
  const repairCost = stock ? Math.ceil(((100 - stock.condition) * stock.count * 1.35) / 5) * 5 : 0;
  return `
    <article class="chest-card">
      <div class="member-head">
        <div>
          <div class="member-name" style="font-size:18px">${def.name}</div>
          <div class="small-note">${def.note}</div>
        </div>
        <span class="pill ${count ? 'green' : 'gray'}">${count ? `${count}件` : '未置'}</span>
      </div>
      <div class="bar-row"><span>完好</span>${bar(condition, 35)}<b>${Math.round(condition)}</b></div>
      <div class="btn-row">
        <button class="btn sm" data-action="repair" data-id="${kindId}" ${!stock || condition >= 100 ? 'disabled' : ''}>
          整修 ${repairCost > 0 ? money(repairCost) : '已齐整'}
        </button>
        <button class="btn sm primary" data-action="buy-puppet" data-id="${kindId}">新添 ${money(def.baseCost)}</button>
      </div>
    </article>`;
}

function scriptCard(state: GameState, playId: string): string {
  const p = PLAY_MAP[playId];
  const known = state.knownScriptIds.includes(playId);
  const rehearsal = state.rehearsal[playId] ?? (known ? 55 : 0);
  const readiness = known ? getPlayBlockers(state, playId) : [];
  const puppet = getPuppetReadiness(state, playId);
  const affinity = getAffinityView(state, state.currentVillageId, playId);
  const masterHere = p.masterVillageId === state.currentVillageId;
  return `
    <article class="paper-card card-pad script-card">
      <div class="member-head">
        <div>
          <div class="member-name">《${p.name}》</div>
          <div class="role-tag">${p.subtitle} · 难度 ${p.difficulty} · 号召力 ${p.baseAppeal}</div>
        </div>
        <span class="pill ${known ? 'green' : 'gray'}">${known ? '有唱本' : '未拜师'}</span>
      </div>
      <p class="bio">${p.intro}</p>
      <div class="tag-row">${p.tags.map((t) => `<span class="tag">${TAG_LABELS[t] ?? t}</span>`).join('')}</div>
      <div>
        <b>所需影人/切末：</b>
        <div class="tag-row" style="margin-top:5px">
          ${p.requiredPuppets.map((k) => {
            const missing = puppet.missing.includes(PUPPET_MAP[k].name);
            const worn = puppet.worn.includes(PUPPET_MAP[k].name);
            return `<span class="tag ${missing || worn ? 'required' : ''}">${PUPPET_MAP[k].name}${missing ? '·缺' : worn ? '·旧' : ''}</span>`;
          }).join('')}
        </div>
      </div>
      ${known ? `
        <div class="bar-grid">
          <div class="bar-row"><span>排熟</span>${bar(rehearsal, 45)}<b>${Math.round(rehearsal)}</b></div>
          <div class="affinity-meter"><span>本村口味</span>${bar(affinity.projected, 45)}<b>${affinity.projected}</b></div>
        </div>
        ${readiness.length ? `<div class="hint-box danger-box">开台阻碍：${readiness.join('；')}</div>` : '<div class="hint-box">角色、影人和唱本都能支应。</div>'}
        <button class="btn blue" data-action="rehearse" data-id="${playId}">排演一日（${money(88)}）</button>
      ` : `
        <div class="hint-box">
          师傅：<b>${p.masterName ?? '老艺人'}</b>，在<b>${p.masterVillageId ? VILLAGE_MAP[p.masterVillageId].name : '云游'}</b>。
          束脩 ${money(p.tuition)}，学 ${p.learnDays} 日，饭钱另计约 ${money(p.learnDays * 78)}。
          ${masterHere ? '<br><b style="color:var(--green)">师傅正在此村，可登门拜师。</b>' : ''}
        </div>
        <button class="btn primary" data-action="learn" data-id="${playId}" ${masterHere ? '' : 'disabled'}>拜师学这本戏</button>
      `}
    </article>`;
}

export function renderChestTab(state: GameState): string {
  return `
    <section class="paper-card card-pad" style="margin-bottom:16px">
      <h2 class="card-title"><span class="title-text">戏箱与唱本</span></h2>
      <p class="small-note" style="margin:0">影人每唱一场都会磨关节、掉颜色；完好太低会拖成色，也容易在台上出险。旧了就修，缺行当即添。唱本可到指定村子拜师，学后还要排熟。</p>
    </section>
    <h3>影人行当</h3>
    <div class="section-grid" style="margin-bottom:20px">${PUPPET_KINDS.map((k) => puppetCard(state, k.id)).join('')}</div>
    <h3>唱本戏码</h3>
    <div class="section-grid">
      ${PLAYS.map((p) => scriptCard(state, p.id)).join('')}
    </div>
  `;
}

export function renderLedgerTab(state: GameState, filter: LedgerFilter, year: number): string {
  const entriesAll = state.ledger.filter((e) => e.year === year);
  const entries = entriesAll
    .filter((e) => filter === 'all' || e.kind === filter)
    .sort((a, b) => b.day - a.day || b.id.localeCompare(a.id, 'zh'));
  const cashEntries = entriesAll.filter((e) => !e.inKind);
  const income = cashEntries.filter((e) => e.kind === 'income').reduce((s, e) => s + e.amount, 0);
  const expense = cashEntries.filter((e) => e.kind === 'expense').reduce((s, e) => s + e.amount, 0);
  const inKind = entriesAll.filter((e) => e.inKind && e.kind === 'income').reduce((s, e) => s + e.amount, 0);
  const due = state.members.reduce((s, m) => s + m.accruedShare, 0);
  const years = [...new Set(state.ledger.map((e) => e.year))].sort((a, b) => b - a);
  if (!years.includes(state.year)) years.unshift(state.year);

  return `
    <section class="paper-card card-pad">
      <div class="toolbar">
        <h2 class="card-title" style="margin:0"><span class="title-text">年终账本</span></h2>
        <div class="btn-row">
          ${years.map((y) => `<button class="chip ${y === year ? 'active' : ''}" data-action="ledger-year" data-year="${y}">第${y}年</button>`).join('')}
          <button class="btn primary" data-action="settle">${state.settlement ? '查看封箱总账' : '封箱算账/提前年结'}</button>
          <button class="btn ghost sm" data-action="reset-game">重新开班</button>
        </div>
      </div>
      <div class="summary-grid">
        <div class="summary-box good"><div class="k">现金进项</div><div class="v">${money(income)}</div></div>
        <div class="summary-box bad"><div class="k">现金出项</div><div class="v">${money(expense)}</div></div>
        <div class="summary-box ${income - expense >= 0 ? 'good' : 'bad'}"><div class="k">账面净余</div><div class="v">${money(income - expense)}</div></div>
        <div class="summary-box"><div class="k">管饭折银（不入现金）</div><div class="v">${money(inKind)}</div></div>
        <div class="summary-box ${due > state.cash ? 'bad' : ''}"><div class="k">尚欠各人股钱</div><div class="v">${money(due)}</div></div>
        <div class="summary-box"><div class="k">当前柜银</div><div class="v">${money(state.cash)}</div></div>
      </div>
      <div class="filter-group" style="margin-bottom:12px">
        ${([['all', '全部'], ['income', '只看进项'], ['expense', '只看出项']] as Array<[LedgerFilter, string]>).map(([id, label]) =>
          `<button class="chip ${filter === id ? 'active' : ''}" data-action="ledger-filter" data-filter="${id}">${label}</button>`).join('')}
        <span class="small-note" style="align-self:center">戏钱、赏钱、管饭每一笔都能点开，查到村、会、哪一夜和具体戏码。</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>日期</th><th>账目</th><th>分类</th><th>村/场</th><th style="text-align:right">银钱</th></tr></thead>
          <tbody>
            ${entries.map((e) => ledgerRow(e)).join('') || '<tr><td colspan="5"><div class="empty">这一年还没有账目。</div></td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function ledgerRow(e: LedgerEntry): string {
  const village = e.villageId ? VILLAGE_MAP[e.villageId]?.name ?? '' : '';
  const clickable = Boolean(e.performanceId);
  const sign = e.kind === 'income' ? '+' : e.kind === 'expense' ? '−' : '借';
  const amountClass = e.inKind ? 'muted' : e.kind;
  return `
    <tr class="ledger-row ${e.kind} ${clickable ? 'income' : ''}" ${clickable ? `data-action="open-entry" data-id="${e.id}"` : ''}>
      <td style="white-space:nowrap">第${e.year}年<br>${e.dateLabel}</td>
      <td>${esc(e.title)}${clickable ? '<span class="click-hint">点开查场 →</span>' : ''}${e.note ? `<div class="small-note">${esc(e.note)}</div>` : ''}</td>
      <td><span class="pill ${e.kind === 'income' ? 'green' : ''}">${e.category}${e.inKind ? '·折物' : ''}</span></td>
      <td>${village || '—'}</td>
      <td class="amount ${amountClass}">${sign}${money(e.amount)}</td>
    </tr>`;
}

export function helpModal(): string {
  return `
    <div class="modal-overlay" data-action="close-modal-overlay">
      <div class="modal wide" role="dialog" aria-modal="true">
        <div class="modal-head"><h3>老戏班经营规矩</h3><button class="close-x" data-action="close-modal" aria-label="关闭">×</button></div>
        <div class="modal-body">
          <div class="detail-grid">
            <div class="detail-box"><div class="k">一、赶场</div><p class="small-note" style="margin:6px 0 0">地图上只能沿虚线去相邻村。脚程按 <b>35里/日</b> 向上取整；远邻要走两日，不能跳村。绿圈是当前村可去的邻村。</p></div>
            <div class="detail-box"><div class="k">二、请戏</div><p class="small-note" style="margin:6px 0 0">庙会前后可唱三夜大戏；九至十一月有“谢秋戏”；平时能接一夜还愿戏。人口、收成、庙会大小决定戏钱和看客。</p></div>
            <div class="detail-box"><div class="k">三、排戏</div><p class="small-note" style="margin:6px 0 0">成色看签手、上手、场面、排熟程度、本村口味、戏本、影人状态和人马状态。唱前最好先排演。</p></div>
            <div class="detail-box"><div class="k">四、口味</div><p class="small-note" style="margin:6px 0 0">同一出戏近期唱得越多，本村喜欢程度掉得越狠；放置越久恢复越多。换戏、赶新村和隔些日子再回来都重要。</p></div>
            <div class="detail-box"><div class="k">五、人马股份</div><p class="small-note" style="margin:6px 0 0">签手、上手、下手、胡琴、锣鼓各管一摊，核心五档缺一个就开不了台。每夜戏钱加赏钱提 <b>38%</b> 按股滚存，年下兑现；其余先管箱钱、脚钱、饭食和修补。</p></div>
            <div class="detail-box"><div class="k">六、戏箱唱本</div><p class="small-note" style="margin:6px 0 0">影人会磨损，太低会拖成色；缺行当即唱不了相关戏。特定村子有师傅，可花束脩和时日学新唱本。</p></div>
            <div class="detail-box"><div class="k">七、风雨与对台</div><p class="small-note" style="margin:6px 0 0">小雨、连阴雨、雪会冲场，依规矩回戏并赔台钱。其他戏班在同村时会唱对台，输赢影响赏钱和名声。</p></div>
            <div class="detail-box"><div class="k">八、年终结账</div><p class="small-note" style="margin:6px 0 0">腊月可提前封箱，也可等到除夕。外债加二行息并优先还，随后按股发钱；余银、场次和名声决定能不能过红火年。每笔戏钱、赏钱、管饭都能在账本点开查村、查会、查场次。</p></div>
          </div>
          <div class="hint-box">上手提示：先接龙泉寨的还愿戏练手，再沿白马坡—长亭堡赶正月十五上元会；之后可顺洛河川道赶三月初三交口河、五月十三洛川城和九月初九柏峪重阳会。</div>
          <div class="footer-actions"><button class="btn primary" data-action="close-modal">知道了，开班</button></div>
        </div>
      </div>
    </div>`;
}

export function eventModal(state: GameState): string {
  const ev = state.pendingEvent;
  if (!ev) return '';
  return `
    <div class="modal-overlay" data-action="overlay-event">
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-head"><h3>${esc(ev.title)}</h3></div>
        <div class="modal-body">
          <p style="font-size:16px;line-height:1.8">${esc(ev.body)}</p>
          <div class="footer-actions">
            ${ev.choices.map((c) => `<button class="btn ${c.id === 'letgo' || c.id === 'endure' ? 'danger' : 'primary'}" data-action="event-choice" data-choice="${c.id}">${esc(c.label)}${c.hint ? `<br><small>${esc(c.hint)}</small>` : ''}</button>`).join('')}
          </div>
        </div>
      </div>
    </div>`;
}

export function bookingModal(state: GameState): string {
  const offer = getContractOffer(state);
  if (!offer) return '';
  const playable = state.knownScriptIds
    .map((id) => PLAY_MAP[id])
    .filter((p) => getPlayBlockers(state, p.id).length === 0);
  const allKnown = state.knownScriptIds.map((id) => PLAY_MAP[id]);
  const defaultId = playable[0]?.id ?? allKnown[0]?.id;
  return `
    <div class="modal-overlay" data-action="close-booking-overlay">
      <form class="modal wide" id="booking-form">
        <div class="modal-head">
          <h3>会首点戏 · ${offer.kind} ${offer.eventName}</h3>
          <button type="button" class="close-x" data-action="close-modal" aria-label="关闭">×</button>
        </div>
        <div class="modal-body">
          <p class="small-note">${offer.reason ?? ''} 共 <b>${offer.nights}</b> 夜，每夜戏钱 <b>${money(offer.payPerNight)}</b>，会首按人数管饭。最好把吉祥、拿手和本村口味搭配开；同一出戏连唱，本村喜欢程度会明显下落。</p>
          ${Array.from({ length: offer.nights }, (_, i) => `
            <div class="booking-night">
              <b>第 ${i + 1} 夜</b>
              <select name="night-${i}" data-night="${i}">
                ${allKnown.map((p) => {
                  const blockers = getPlayBlockers(state, p.id);
                  return `<option value="${p.id}" ${p.id === defaultId ? 'selected' : ''} ${blockers.length ? 'disabled' : ''}>
                    《${p.name}》${blockers.length ? `（不能唱：${blockers[0]}）` : `· 本村口味${getAffinityView(state, state.currentVillageId, p.id).projected}`}
                  </option>`;
                }).join('')}
              </select>
            </div>`).join('')}
          <div class="hint-box">雨雪夜无法挂影窗，依规矩要回戏并赔会首台钱；接帖前可看顶部天色和后三日预报。</div>
          <div class="footer-actions">
            <button type="submit" class="btn primary">封帖开唱，连唱 ${offer.nights} 夜</button>
            <button type="button" class="btn ghost" data-action="close-modal">再商量商量</button>
          </div>
        </div>
      </form>
    </div>`;
}

export function performanceModal(_state: GameState, perf: PerformanceRecord, entry?: LedgerEntry): string {
  const v = VILLAGE_MAP[perf.villageId];
  const play = PLAY_MAP[perf.playId];
  return `
    <div class="modal-overlay" data-action="close-modal-overlay">
      <div class="modal wide" role="dialog" aria-modal="true">
        <div class="modal-head">
          <h3>${perf.cancelled ? '回戏赔偿' : '演出明细'} · ${v.name}《${play.name}》</h3>
          <button class="close-x" data-action="close-modal" aria-label="关闭">×</button>
        </div>
        <div class="modal-body">
          <div class="detail-grid">
            <div class="detail-box"><div class="k">哪一年/哪一天</div><div class="v">第${perf.year}年 ${perf.dateLabel}</div></div>
            <div class="detail-box"><div class="k">村/会/夜次</div><div class="v" style="font-size:16px">${v.name} · ${perf.eventName}<br>第${perf.night}/${perf.totalNights}夜</div></div>
            <div class="detail-box"><div class="k">天气</div><div class="v">${perf.weather}</div></div>
            <div class="detail-box"><div class="k">成色/看客</div><div class="v">${perf.cancelled ? '未唱' : `${perf.quality}分 / ${perf.audience}人`}</div></div>
            <div class="detail-box"><div class="k">本村口味</div><div class="v">${perf.affinityBefore} → ${perf.affinityAfter}</div></div>
            ${perf.rivalName ? `<div class="detail-box"><div class="k">对台戏班</div><div class="v" style="font-size:16px">${perf.rivalName}（${perf.competitionResult === 'win' ? '我胜' : perf.competitionResult === 'lose' ? '我负' : '平局'}）</div></div>` : ''}
          </div>

          ${perf.cancelled ? `<div class="hint-box danger-box"><b>${esc(perf.cancellationReason ?? '本场取消')}</b><br>赔偿 ${money(perf.penalty)}。</div>` : `
            <h4>成色从哪来</h4>
            <div class="factor-list">
              ${perf.factors.map((f) => `
                <div class="factor"><span title="${esc(f.detail)}">${f.label}</span>${bar(f.value, 45)}<b>${f.value}</b></div>
                <div class="small-note" style="grid-column:1/-1;margin:-4px 0 4px">${esc(f.detail)}</div>
              `).join('')}
            </div>
            <h4>银钱与股份</h4>
            <div class="table-wrap">
              <table style="min-width:520px">
                <tbody>
                  <tr><td>会首戏钱</td><td class="amount income">+${money(perf.basePay)}</td></tr>
                  <tr><td>成色赏钱</td><td class="amount income">+${money(perf.bonus)}</td></tr>
                  <tr><td>管饭折银（不入现金）</td><td class="amount muted">${money(perf.mealValue)}</td></tr>
                  <tr><td>按股分派池（戏钱+赏钱的38%）</td><td class="amount">${money(perf.sharePool)} / ${perf.totalSharePoints}股</td></tr>
                </tbody>
              </table>
            </div>
            <h4>这一场每人滚存多少</h4>
            <div class="table-wrap">
              <table style="min-width:520px">
                <thead><tr><th>人</th><th>行当</th><th>股份</th><th style="text-align:right">本场滚存</th></tr></thead>
                <tbody>${perf.payouts.map((p) => `<tr><td>${esc(p.name)}</td><td>${ROLE_LABELS[p.role]}</td><td>${p.share}</td><td class="amount income">+${money(p.amount)}</td></tr>`).join('')}</tbody>
              </table>
            </div>
          `}
          ${entry?.note ? `<p class="small-note" style="margin-top:12px">账本备注：${esc(entry.note)}</p>` : ''}
          ${perf.notes.length ? `<div class="hint-box">${perf.notes.map(esc).join('<br>')}</div>` : ''}
        </div>
      </div>
    </div>`;
}

export function settlementModal(state: GameState): string {
  const s = state.settlement;
  if (!s) return '';
  const gradeClass = s.grade === '红火大年' ? 'good' : s.grade === '体面过年' ? '' : s.grade === '紧巴年关' ? 'warn' : 'bad';
  return `
    <div class="modal-overlay" data-action="overlay-settlement">
      <div class="modal wide" role="dialog" aria-modal="true">
        <div class="modal-head"><h3>第 ${s.year} 年封箱总账</h3><button class="close-x" data-action="close-modal" aria-label="关闭">×</button></div>
        <div class="modal-body">
          <div class="settlement-hero">
            <div class="small-note">唱了 ${s.shows} 场，约 ${s.audience.toLocaleString('zh-CN')} 人次看过影窗；年终名声 ${Math.round(s.reputation)}。</div>
            <div class="grade ${gradeClass}">${s.grade}</div>
            <p style="font-size:17px;line-height:1.8;max-width:720px;margin:0 auto">${esc(s.summary)}</p>
          </div>
          <div class="summary-grid">
            <div class="summary-box good"><div class="k">全年现金进项</div><div class="v">${money(s.totalIncome)}</div></div>
            <div class="summary-box bad"><div class="k">全年现金出项</div><div class="v">${money(s.totalExpense)}</div></div>
            <div class="summary-box ${s.debtDue ? 'bad' : ''}"><div class="k">外债本利/已还</div><div class="v" style="font-size:20px">${money(s.debtDue)} / ${money(s.debtPaid)}</div></div>
            <div class="summary-box"><div class="k">应发身股</div><div class="v">${money(s.shareDue)}</div></div>
            <div class="summary-box ${s.shortfall ? 'bad' : 'good'}"><div class="k">实发/欠项</div><div class="v">${money(s.sharePaid)}${s.shortfall ? `<br><small>欠${money(s.shortfall)}</small>` : ''}</div></div>
            <div class="summary-box ${s.cashAfter >= 0 ? 'good' : 'bad'}"><div class="k">封箱后柜银</div><div class="v">${money(s.cashAfter)}</div></div>
          </div>
          <div class="footer-actions">
            <button class="btn primary" data-action="new-year">开封第二年</button>
            <button class="btn ghost" data-action="close-modal">先翻账本</button>
          </div>
        </div>
      </div>
    </div>`;
}

export function settlementBanner(state: GameState): string {
  if (!state.settlement) return '';
  return `<div class="offer-box" style="margin:0 0 14px;display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap">
    <b>今年已封箱：${state.settlement.grade}。</b>
    <span class="btn-row">
      <button class="btn primary" data-action="new-year">开启新岁</button>
      <button class="btn ghost" data-action="open-settlement">看总账</button>
    </span>
  </div>`;
}

export function toastStack(toasts: Array<{ id: number; text: string; tone: string }>): string {
  return `<div class="toast-stack">${toasts.map((t) => `<div class="toast ${t.tone}">${esc(t.text)}</div>`).join('')}</div>`;
}

export { VILLAGES, CORE_ROLES };
export type { RoleId };
