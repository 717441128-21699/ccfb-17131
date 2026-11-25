import { PLAYS, VILLAGES } from '../src/data';
import {
  getAdjacent,
  getContractOffer,
  getPerformance,
  getPlayBlockers,
  getVacantRoles,
  newGame,
  borrowMoney,
  resolveEvent,
  settleYear,
  signAndPerform,
  startNewYear,
  travelTo,
  hireMember,
  treatMember,
  restDay,
  rehearsePlay,
  fairDay,
  travelDaysForLi,
} from '../src/engine';
import type { GameState } from '../src/types';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function safeResolveEvents(s: GameState) {
  let guard = 0;
  while (s.pendingEvent && guard < 4) {
    guard += 1;
    const ev = s.pendingEvent;
    let choice = 'endure';
    if (ev.type === 'poach') choice = s.cash >= 260 ? 'counter' : 'letgo';
    if (ev.type === 'illness') choice = 'medicine';
    let res = resolveEvent(s, choice);
    if (!res.ok && choice === 'counter') res = resolveEvent(s, 'letgo');
    if (!res.ok && choice === 'medicine') res = resolveEvent(s, 'endure');
  }
  for (const role of getVacantRoles(s)) {
    hireMember(s, role);
  }
  for (const m of s.members) {
    if (m.status !== '正常' && m.status !== '被挖走') treatMember(s, m.id);
  }
}

// 路程规则
assert(travelDaysForLi(28) === 1, '28里应走1日');
assert(travelDaysForLi(35) === 1, '35里应走1日');
assert(travelDaysForLi(36) === 2, '36里应走2日');

let s = newGame();
assert(s.currentVillageId === 'longquan', '新游戏应在龙泉寨');
const nonAdjacent = travelTo(s, 'baiyu');
assert(!nonAdjacent.ok, '不能从龙泉寨一步跳到不相邻的柏峪村');

const firstHop = getAdjacent(s, s.currentVillageId)[0];
const travel = travelTo(s, firstHop.village.id);
assert(travel.ok, `应能去邻村：${travel.error}`);
assert(s.currentVillageId === firstHop.village.id, '旅行后应抵达邻村');

// 回到龙泉寨测试重复戏口味
safeResolveEvents(s);
const back = travelTo(s, 'longquan');
assert(back.ok, '应能返回龙泉寨');
safeResolveEvents(s);
s.weather = '晴';
const offer1 = getContractOffer(s);
assert(offer1, '龙泉寨初始应有还愿戏机会');
const r1 = signAndPerform(s, ['baxian']);
assert(r1.ok, `第一场应能唱：${r1.error}`);
const p1 = getPerformance(s, r1.performanceIds![0])!;
assert(!p1.cancelled, '第一场不应因天气取消');
const after1 = p1.affinityAfter;

s.villageState.longquan.lastRegularDay = -100;
s.weather = '晴';
const r2 = signAndPerform(s, ['baxian']);
assert(r2.ok, `重复场应能唱：${r2.error}`);
const p2 = getPerformance(s, r2.performanceIds![0])!;
assert(p2.affinityAfter < after1, `同一出戏连唱后口味应下降：${after1} -> ${p2.affinityAfter}`);

// 账目穿透
for (const e of s.ledger) {
  if (e.kind === 'income') {
    assert(e.performanceId, `每一块进项都必须关联具体场次：${e.title}`);
    assert(getPerformance(s, e.performanceId), `账目关联场次必须存在：${e.id}`);
  }
  if (['戏钱', '赏钱', '管饭折银'].includes(e.category)) {
    assert(e.performanceId, `${e.category} 必须关联具体场次：${e.title}`);
    assert(getPerformance(s, e.performanceId), `账目关联场次必须存在：${e.id}`);
  }
}

// 启发式跑两年，确保没有死循环或账目/分成异常
let actions = 0;
while (actions < 5000) {
  actions += 1;
  if (!s.pendingEvent && s.cash < 500 && s.debt < 3000) {
    borrowMoney(s, Math.min(1000, 3000 - s.debt));
  }
  safeResolveEvents(s);
  if (s.settlement) {
    const oldYear = s.year;
    s = startNewYear(s);
    assert(s.year === oldYear + 1, '应进入新的一年');
    if (s.year >= 3) break;
    continue;
  }
  if (s.day >= 360) {
    settleYear(s);
    continue;
  }

  const offer = getContractOffer(s);
  const playable = PLAYS.map((p) => p.id).filter((id) => getPlayBlockers(s, id).length === 0);
  if (offer && playable.length > 0) {
    const ids = Array.from({ length: offer.nights }, (_, i) => playable[i % playable.length]);
    const res = signAndPerform(s, ids);
    if (!res.ok && !res.performanceIds?.length) {
      // 若被状态卡住，下面用休整/治疗恢复；不应直接抛异常。
      safeResolveEvents(s);
      if (s.cash >= 88 && s.knownScriptIds[0]) rehearsePlay(s, s.knownScriptIds[0]);
      else restDay(s);
    }
    continue;
  }

  // 优先去当前有帖的邻村
  const adj = getAdjacent(s, s.currentVillageId);
  const withOffer = adj.find((a) => getContractOffer(s, a.village.id));
  if (withOffer) {
    const res = travelTo(s, withOffer.village.id);
    if (!res.ok) restDay(s);
    continue;
  }

  // 朝最近的未来庙会移动
  const targets = VILLAGES
    .map((v) => {
      let fd = fairDay(v);
      if (fd < s.day - 2) fd += 360;
      return { id: v.id, delta: fd - s.day };
    })
    .sort((a, b) => a.delta - b.delta);
  let moved = false;
  for (const target of targets.slice(0, 5)) {
    if (target.id === s.currentVillageId) continue;
    // BFS 找第一步
    const queue = [s.currentVillageId];
    const prev = new Map<string, string>();
    const seen = new Set([s.currentVillageId]);
    while (queue.length) {
      const cur = queue.shift()!;
      if (cur === target.id) break;
      for (const a of getAdjacent(s, cur)) {
        if (seen.has(a.village.id)) continue;
        seen.add(a.village.id);
        prev.set(a.village.id, cur);
        queue.push(a.village.id);
      }
    }
    if (seen.has(target.id)) {
      let cur = target.id;
      while (prev.get(cur) && prev.get(cur) !== s.currentVillageId) cur = prev.get(cur)!;
      const res = travelTo(s, cur);
      if (res.ok) moved = true;
      break;
    }
  }
  if (!moved) {
    if (s.cash > 200 && s.knownScriptIds[0] && actions % 2 === 0) rehearsePlay(s, s.knownScriptIds[0]);
    else {
      const res = restDay(s);
      if (!res.ok) safeResolveEvents(s);
    }
  }
}

if (!s.settlement) settleYear(s);
assert(s.settlement, '两年模拟后应能生成年终结算');
assert(s.performances.length > 12, `应至少完成十余场演出，实际 ${s.performances.length}`);

for (const p of s.performances) {
  if (p.cancelled) continue;
  const payoutSum = p.payouts.reduce((sum, x) => sum + x.amount, 0);
  assert(payoutSum === p.sharePool, `场次分成之和必须等于股份池：${p.id} ${payoutSum} != ${p.sharePool}`);
  for (const payout of p.payouts) {
    assert(payout.amount >= 0, '分红不能为负');
  }
}

const incomeCount = s.ledger.filter((e) => e.kind === 'income' && e.category !== '其他').length;
assert(incomeCount >= 20, `应有多笔可追溯进项，实际 ${incomeCount}`);
for (const e of s.ledger) {
  if (e.kind === 'income') {
    assert(e.performanceId, `全年每一块进项都必须能点到场次：${e.title}`);
    assert(getPerformance(s, e.performanceId!), `进项关联场次必须存在：${e.id}`);
  }
}

console.log(JSON.stringify({
  ok: true,
  actions,
  performances: s.performances.length,
  ledgerEntries: s.ledger.length,
  finalCash: Math.round(s.cash),
  reputation: Math.round(s.reputation),
  grade: s.settlement.grade,
  showsThisYear: s.settlement.shows,
}, null, 2));
