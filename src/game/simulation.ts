import {
  getAffinity,
  getPlay,
  getVillage,
  playBlockers,
  puppetReadiness,
  castReadiness,
  rivalAtVillage,
  isFairWindow,
} from './world';
import type { GameState, Village, WeatherDay } from './types';
import { clamp } from './utils';

export interface DemandReport {
  affinity: number;
  expectedQuality: number;
  audienceRate: number;
  competition: number;
  fair: boolean;
  rivalName: string | null;
  blockers: string[];
  reasons: string[];
}

export function hostDailyBase(village: Village): number {
  return (
    1.6 +
    (village.population / 105) *
      (0.62 + village.wealth * 0.5) *
      (0.7 + village.harvest * 0.42)
  );
}

export function demandReport(
  state: GameState,
  villageId: string,
  playId: string,
  affinityOverride?: number,
): DemandReport {
  const village = getVillage(villageId);
  const play = getPlay(playId);
  const affinity = affinityOverride ?? getAffinity(state, villageId, playId);
  const cast = castReadiness(state, play);
  const puppets = puppetReadiness(state, play);
  const rival = rivalAtVillage(state, villageId);
  const fair = isFairWindow(state, village, 3);
  const blockers = playBlockers(state, play);

  const puppetScore = puppets.averageCondition;
  const expectedQuality = clamp(
    cast.averageSkill * 0.56 +
      play.appeal * 0.16 +
      puppetScore * 0.14 +
      affinity * 0.14 -
      play.difficulty * 0.7,
    5,
    99,
  );

  let audienceRate =
    0.2 +
    (expectedQuality / 100) * 0.3 +
    (affinity / 100) * 0.2 +
    village.wealth * 0.06 +
    village.harvest * 0.04;
  let competition = 0;
  const reasons: string[] = [];

  if (fair) {
    audienceRate += 0.13;
    reasons.push('正值庙会前后，四乡八镇都来人');
  }
  if (rival) {
    competition = rival.skill;
    audienceRate -= 0.13 + (rival.reputation / 100) * 0.08;
    reasons.push(`${rival.name}也在本村台面，看客被分走`);
  }
  if (affinity >= 78) reasons.push('这出戏正对本村脾胃');
  if (affinity <= 42) reasons.push('前番唱过，村里人耳熟，点戏兴致低');
  if (puppets.minimumCondition < 35) reasons.push('有一堂影人太旧，台上光彩不足');
  if (cast.substitutePenalty > 0) reasons.push('行当靠学徒替手，手艺要打折扣');
  if (village.harvest < 0.68) reasons.push('收成薄，会首和看客出手都紧');
  if (village.wealth > 0.82) reasons.push('地面富庶，彩钱和赏银可期');

  audienceRate = clamp(audienceRate, 0.06, 0.94);
  return {
    affinity,
    expectedQuality,
    audienceRate,
    competition,
    fair,
    rivalName: rival?.name ?? null,
    blockers,
    reasons,
  };
}

export interface ShowEstimate {
  blockers: string[];
  affinity: number;
  quality: number;
  audienceLow: number;
  audienceHigh: number;
  hostFeeLow: number;
  hostFeeHigh: number;
  tipsLow: number;
  tipsHigh: number;
  fairBonus: number;
  dailyLow: number;
  dailyHigh: number;
  rainCompensation: number;
  weatherHint: string;
}

export function estimateShow(
  state: GameState,
  villageId: string,
  playId: string,
  weather?: WeatherDay,
  affinityOverride?: number,
): ShowEstimate {
  const village = getVillage(villageId);
  const report = demandReport(state, villageId, playId, affinityOverride);
  const base = hostDailyBase(village);
  const fairMultiplier = report.fair ? 1.28 : 1;
  const qualityPay = 0.82 + (report.expectedQuality / 100) * 0.34;
  const hostFee = base * qualityPay * fairMultiplier;
  const market =
    village.population *
    (0.72 + village.harvest * 0.34 + village.wealth * 0.26 + (report.fair ? 0.72 : 0));
  const audience = market * report.audienceRate;
  const tips = audience * (0.006 + village.wealth * 0.009) * (0.75 + report.expectedQuality / 200);
  const fairBonus = report.fair ? base * 0.28 : 0;
  const rain = weather?.rain ?? false;
  const weatherHint = rain ? '预报有雨：当日停唱，戏钱彩钱皆无，还要包赔' : '天气大致可唱';
  const rainCompensation = rain ? Math.round(base * 0.38 * 10) / 10 : 0;
  const hostLow = rain ? 0 : hostFee * 0.9;
  const hostHigh = rain ? 0 : hostFee * 1.1;
  const tipsLow = rain ? 0 : tips * 0.8;
  const tipsHigh = rain ? 0 : tips * 1.2;
  const fair = rain ? 0 : fairBonus;

  return {
    blockers: report.blockers,
    affinity: report.affinity,
    quality: Math.round(report.expectedQuality),
    audienceLow: rain ? 0 : Math.round(audience * 0.88),
    audienceHigh: rain ? 0 : Math.round(audience * 1.12),
    hostFeeLow: Math.round(hostLow / 0.5) * 0.5,
    hostFeeHigh: Math.round(hostHigh / 0.5) * 0.5,
    tipsLow: Math.round(tipsLow),
    tipsHigh: Math.round(tipsHigh),
    fairBonus: Math.round(fair * 10) / 10,
    dailyLow: Math.round((hostLow + tipsLow + fair) * 10) / 10,
    dailyHigh: Math.round((hostHigh + tipsHigh + fair) * 10) / 10,
    rainCompensation,
    weatherHint,
  };
}

export interface ActualShowResult {
  quality: number;
  affinity: number;
  audience: number;
  hostFee: number;
  tips: number;
  fairBonus: number;
  reasons: string[];
}

export function rollShow(
  state: GameState,
  villageId: string,
  playId: string,
  random: () => number,
): ActualShowResult {
  const village = getVillage(villageId);
  const report = demandReport(state, villageId, playId);
  const quality = Math.round(clamp(report.expectedQuality + (random() - 0.5) * 11, 4, 100));
  const market =
    village.population *
    (0.72 + village.harvest * 0.34 + village.wealth * 0.26 + (report.fair ? 0.72 : 0));
  const audience = Math.max(
    20,
    Math.round(market * report.audienceRate * (0.88 + random() * 0.24)),
  );

  const base = hostDailyBase(village);
  const qualityPay = 0.78 + (quality / 100) * 0.42;
  const hostFee = Math.round(base * qualityPay * (report.fair ? 1.28 : 1) * (0.94 + random() * 0.12) * 2) / 2;
  const tips = Math.round(audience * (0.006 + village.wealth * 0.009) * (0.68 + quality / 130) * (0.85 + random() * 0.3));
  const fairBonus = report.fair ? Math.round(base * (0.22 + random() * 0.12) * 10) / 10 : 0;
  const reasons = [...report.reasons];
  if (quality >= 86) reasons.unshift('唱得严丝合缝，台下叫好声不断');
  if (quality <= 52) reasons.unshift('台上出了纰漏，懂戏的老人直摇头');
  return {
    quality,
    affinity: report.affinity,
    audience,
    hostFee,
    tips,
    fairBonus,
    reasons,
  };
}

export function repairCost(condition: number, unitCost: number, count: number): number {
  return Math.ceil(((100 - condition) / 100) * unitCost * count * 0.35);
}
