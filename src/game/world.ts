import {
  PLAYS,
  ROUTES,
  TRAVEL_LI_PER_DAY,
  VILLAGES,
} from './data';
import type {
  GameState,
  Member,
  Play,
  PuppetItem,
  Role,
  Village,
} from './types';
import { clamp, daysUntilFair } from './utils';

export const villageMap = new Map(VILLAGES.map((v) => [v.id, v]));
export const playMap = new Map(PLAYS.map((p) => [p.id, p]));

export function getVillage(id: string): Village {
  const village = villageMap.get(id);
  if (!village) throw new Error(`未知村子: ${id}`);
  return village;
}

export function getPlay(id: string): Play {
  const play = playMap.get(id);
  if (!play) throw new Error(`未知剧目: ${id}`);
  return play;
}

export function travelDaysForLi(li: number): number {
  return Math.max(1, Math.ceil(li / TRAVEL_LI_PER_DAY));
}

export interface NeighborInfo {
  village: Village;
  li: number;
  days: number;
}

export function neighborsOf(villageId: string): NeighborInfo[] {
  return ROUTES
    .filter((route) => route.from === villageId || route.to === villageId)
    .map((route) => {
      const otherId = route.from === villageId ? route.to : route.from;
      const village = getVillage(otherId);
      return { village, li: route.li, days: travelDaysForLi(route.li) };
    })
    .sort((a, b) => a.village.name.localeCompare(b.village.name, 'zh-CN'));
}

export function routeBetween(aId: string, bId: string) {
  const route = ROUTES.find(
    (r) => (r.from === aId && r.to === bId) || (r.from === bId && r.to === aId),
  );
  if (!route) return null;
  return { ...route, days: travelDaysForLi(route.li) };
}

export interface VillagePath {
  ids: string[];
  totalLi: number;
  totalDays: number;
}

export function findPath(fromId: string, toId: string): VillagePath | null {
  if (fromId === toId) return { ids: [fromId], totalLi: 0, totalDays: 0 };
  const queue: string[][] = [[fromId]];
  const visited = new Set<string>([fromId]);

  while (queue.length) {
    const path = queue.shift()!;
    const last = path[path.length - 1];
    for (const neighbor of neighborsOf(last)) {
      if (visited.has(neighbor.village.id)) continue;
      const nextPath = [...path, neighbor.village.id];
      if (neighbor.village.id === toId) {
        let totalLi = 0;
        let totalDays = 0;
        for (let i = 0; i < nextPath.length - 1; i += 1) {
          const route = routeBetween(nextPath[i], nextPath[i + 1]);
          totalLi += route?.li ?? 0;
          totalDays += route?.days ?? 0;
        }
        return { ids: nextPath, totalLi, totalDays };
      }
      visited.add(neighbor.village.id);
      queue.push(nextPath);
    }
  }
  return null;
}

export function affinityKey(villageId: string, playId: string): string {
  return `${villageId}::${playId}`;
}

export function baseAffinity(village: Village, play: Play): number {
  const weights = play.tags.map((tag) => village.preferences[tag] ?? 0.9);
  const average = weights.reduce((sum, value) => sum + value, 0) / weights.length;
  let score = 52 + (average - 0.95) * 78;
  if (village.favoritePlayIds.includes(play.id)) score += 17;
  return Math.round(clamp(score, 8, 98));
}

export function getAffinity(state: GameState, villageId: string, playId: string): number {
  const key = affinityKey(villageId, playId);
  if (state.affinity[key] !== undefined) return Math.round(state.affinity[key]);
  return baseAffinity(getVillage(villageId), getPlay(playId));
}

export interface CastRequirement {
  role: Role;
  label: string;
  member: Member | null;
  substituted: boolean;
  penalty: number;
}

export interface CastReadiness {
  ready: boolean;
  requirements: CastRequirement[];
  missingRoles: string[];
  averageSkill: number;
  averageHealth: number;
  substitutePenalty: number;
}

const ROLE_LABELS: Record<Role, string> = {
  qianxian: '签手',
  shangshou: '上手',
  xiashou: '下手',
  huqin: '拉胡琴',
  luogu: '打锣鼓',
};

export function castReadiness(state: GameState, _play?: Play): CastReadiness {
  const roles: Role[] = ['qianxian', 'shangshou', 'xiashou', 'huqin', 'luogu'];
  const requirements: CastRequirement[] = roles.map((role) => {
    const exact = state.members
      .filter((m) => m.role === role && m.status === 'ok')
      .sort((a, b) => b.skill - a.skill)[0];
    if (exact) {
      return { role, label: ROLE_LABELS[role], member: exact, substituted: false, penalty: 0 };
    }

    const cover = state.members
      .filter((m) => m.status === 'ok' && m.covers.includes(role))
      .sort((a, b) => b.skill - a.skill)[0];

    if (cover) {
      const penalty = cover.role === 'xuetu' ? 18 : 9;
      return { role, label: ROLE_LABELS[role], member: cover, substituted: true, penalty };
    }

    const unavailableHolder = state.members.find(
      (m) => m.role === role && m.status !== 'left',
    ) ?? null;
    return {
      role,
      label: ROLE_LABELS[role],
      member: unavailableHolder,
      substituted: false,
      penalty: 0,
    };
  });

  const missing = requirements.filter((r) => !r.member || r.member.status !== 'ok');
  const usable = requirements.filter((r) => r.member && r.member.status === 'ok');
  const averageSkill = usable.length
    ? usable.reduce((sum, r) => sum + (r.member?.skill ?? 0) - r.penalty, 0) / usable.length
    : 0;
  const averageHealth = usable.length
    ? usable.reduce((sum, r) => sum + (r.member?.health ?? 0), 0) / usable.length
    : 0;
  const substitutePenalty = requirements.reduce((sum, r) => sum + r.penalty, 0);

  return {
    ready: missing.length === 0,
    requirements,
    missingRoles: missing.map((r) => r.label),
    averageSkill: clamp(averageSkill, 0, 100),
    averageHealth,
    substitutePenalty,
  };
}

export interface PuppetReadiness {
  ready: boolean;
  missing: PuppetItem[];
  required: PuppetItem[];
  averageCondition: number;
  minimumCondition: number;
}

export function puppetReadiness(state: GameState, play: Play): PuppetReadiness {
  const required = play.requiredPuppets
    .map((id) => state.puppets.find((p) => p.id === id))
    .filter((p): p is PuppetItem => Boolean(p));
  const missing = required.filter((p) => p.count <= 0 || p.condition <= 0);
  const conditions = required.map((p) => p.condition);
  return {
    ready: missing.length === 0,
    missing,
    required,
    averageCondition: conditions.reduce((a, b) => a + b, 0) / Math.max(1, conditions.length),
    minimumCondition: Math.min(...conditions, 100),
  };
}

export function playBlockers(state: GameState, play: Play): string[] {
  const blockers: string[] = [];
  if (!state.ownedPlayIds.includes(play.id)) blockers.push('尚未拜师学会');
  const cast = castReadiness(state, play);
  if (!cast.ready) blockers.push(`缺${cast.missingRoles.join('、')}，开不了戏`);
  const puppets = puppetReadiness(state, play);
  if (!puppets.ready) blockers.push(`缺${puppets.missing.map((p) => p.name).join('、')}`);
  if (state.pendingChoice) blockers.push('有一桩班务待决断');
  if (state.settlement) blockers.push('今年已经封箱算账');
  return blockers;
}

export function canBookPlay(state: GameState, play: Play): boolean {
  if (state.travel || state.activeRunId || state.study) return false;
  return playBlockers(state, play).length === 0;
}

export function rivalAtVillage(state: GameState, villageId: string) {
  return state.rivals.find((r) => r.villageId === villageId);
}

export function fairCountdown(state: GameState, village: Village): number {
  return daysUntilFair(state.dayIndex, village.templeMonth, village.templeDay);
}

export function isFairWindow(state: GameState, village: Village, window = 3): boolean {
  const until = fairCountdown(state, village);
  return until >= -1 && until <= window;
}
