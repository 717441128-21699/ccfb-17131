import { PLAY_MAP, PLAYS, VILLAGES } from '../src/data';
import {
  fairDay,
  getAdjacent,
  getAffinityView,
  getContractOffer,
  getPlayBlockers,
  getVacantRoles,
  hireMember,
  newGame,
  rehearsePlay,
  resolveEvent,
  settleYear,
  signAndPerform,
  travelTo,
  treatMember,
  restDay,
  learnPlay,
  canLearnPlay,
} from '../src/engine';
import type { GameState } from '../src/types';

function bfsFirstStep(s: GameState, target: string): string | null {
  if (s.currentVillageId === target) return null;
  const prev = new Map<string, string>();
  const queue = [s.currentVillageId];
  const seen = new Set(queue);
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === target) break;
    for (const a of getAdjacent(s, cur)) {
      if (seen.has(a.village.id)) continue;
      seen.add(a.village.id);
      prev.set(a.village.id, cur);
      queue.push(a.village.id);
    }
  }
  if (!seen.has(target)) return null;
  let cur = target;
  while (prev.get(cur) && prev.get(cur) !== s.currentVillageId) cur = prev.get(cur)!;
  return cur;
}

function resolve(s: GameState) {
  let guard = 0;
  while (s.pendingEvent && guard++ < 5) {
    const ev = s.pendingEvent;
    const choice = ev.type === 'poach' && s.cash > 1800 ? 'counter' : ev.type === 'illness' ? 'medicine' : 'letgo';
    const res = resolveEvent(s, choice);
    if (!res.ok) resolveEvent(s, ev.type === 'illness' ? 'endure' : 'letgo');
  }
  for (const role of getVacantRoles(s)) hireMember(s, role);
  for (const m of s.members) if (m.status !== '正常' && m.status !== '被挖走') treatMember(s, m.id);
}

function choosePlays(s: GameState, nights: number): string[] {
  const scored = PLAYS
    .map((p) => {
      const blockers = getPlayBlockers(s, p.id);
      if (blockers.length) return null;
      const aff = getAffinityView(s, s.currentVillageId, p.id).projected;
      const reh = s.rehearsal[p.id] ?? 40;
      const score = aff * 0.34 + reh * 0.24 + p.baseAppeal * 0.25 - p.difficulty * 0.08 + (p.tags.includes('jixiang') ? 3 : 0);
      return { id: p.id, score };
    })
    .filter(Boolean) as Array<{ id: string; score: number }>;
  scored.sort((a, b) => b.score - a.score);
  return Array.from({ length: nights }, (_, i) => scored[Math.min(i, scored.length - 1)]?.id ?? 'baxian');
}

const s = newGame();
let learned = false;
let steps = 0;
while (s.day < 360 && steps++ < 900) {
  resolve(s);
  if (s.settlement) break;

  // 龙泉寨有名师严文举，开局先学《三打白骨精》。
  if (!learned && s.currentVillageId === 'longquan' && canLearnPlay(s, 'xiyou').ok && s.cash > 2500) {
    learnPlay(s, 'xiyou');
    learned = true;
    continue;
  }

  const offer = getContractOffer(s);
  if (offer) {
    const ids = choosePlays(s, offer.nights);
    const res = signAndPerform(s, ids);
    if (!res.ok && !res.performanceIds?.length) restDay(s);
    continue;
  }

  const adjOffer = getAdjacent(s, s.currentVillageId).find((a) => getContractOffer(s, a.village.id));
  if (adjOffer) {
    const res = travelTo(s, adjOffer.village.id);
    if (!res.ok) restDay(s);
    continue;
  }

  // 选一个近期庙会；秋冬优先谢秋/重阳。
  const candidates = VILLAGES.map((v) => {
    let fd = fairDay(v);
    if (fd < s.day - 3) fd += 360;
    const delta = fd - s.day;
    const step = bfsFirstStep(s, v.id);
    return { id: v.id, delta, pop: v.population, fair: delta >= -1 && delta <= 24, step };
  }).filter((x) => x.step || x.id === s.currentVillageId);

  const target = candidates
    .filter((x) => x.delta >= -2 && x.delta <= 35)
    .sort((a, b) => {
      const av = (a.fair ? 1200 : 0) + a.pop * 1.2 - Math.max(0, a.delta - 12) * 20;
      const bv = (b.fair ? 1200 : 0) + b.pop * 1.2 - Math.max(0, b.delta - 12) * 20;
      return bv - av;
    })[0];

  if (target && target.id !== s.currentVillageId) {
    const res = travelTo(s, target.step!);
    if (!res.ok) restDay(s);
    continue;
  }

  const bestRehearsal = PLAYS
    .filter((p) => s.knownScriptIds.includes(p.id))
    .map((p) => ({ id: p.id, value: s.rehearsal[p.id] ?? 40 }))
    .sort((a, b) => a.value - b.value)[0];
  if (bestRehearsal && bestRehearsal.value < 82 && s.cash > 900 && s.day < 330) {
    rehearsePlay(s, bestRehearsal.id);
  } else {
    restDay(s);
  }
}

const settlement = settleYear(s);
const successful = s.performances.filter((p) => p.year === 1 && !p.cancelled);
const avgQuality = successful.reduce((sum, p) => sum + p.quality, 0) / Math.max(1, successful.length);
const categoryTotals = s.ledger.reduce<Record<string, number>>((acc, e) => {
  if (!e.inKind) acc[`${e.kind}:${e.category}`] = (acc[`${e.kind}:${e.category}`] ?? 0) + e.amount;
  return acc;
}, {});
console.log(JSON.stringify({
  day: s.day,
  steps,
  shows: successful.length,
  cancelled: s.performances.filter((p) => p.cancelled).length,
  avgQuality: Math.round(avgQuality),
  cash: Math.round(s.cash),
  debt: s.debt,
  reputation: Math.round(s.reputation),
  grade: settlement.grade,
  cashAfter: settlement.cashAfter,
  cashBeforePayout: settlement.cashBeforePayout,
  totalIncome: settlement.totalIncome,
  totalExpense: settlement.totalExpense,
  categoryTotals,
  shareDue: settlement.shareDue,
  summary: settlement.summary,
}, null, 2));
