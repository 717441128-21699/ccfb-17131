import { DAYS_PER_MONTH, YEAR_DAYS } from './data';

const MONTH_NAMES = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];
const DAY_PREFIX = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十'];

export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function silver(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

export function dateParts(dayIndex: number): { month: number; day: number } {
  const safe = ((dayIndex % YEAR_DAYS) + YEAR_DAYS) % YEAR_DAYS;
  return {
    month: Math.floor(safe / DAYS_PER_MONTH) + 1,
    day: (safe % DAYS_PER_MONTH) + 1,
  };
}

export function dayIndexOf(month: number, day: number): number {
  return (month - 1) * DAYS_PER_MONTH + (day - 1);
}

export function lunarDayName(day: number): string {
  if (day <= 10) return DAY_PREFIX[day - 1];
  if (day < 20) return `十${DAY_PREFIX[day - 11].slice(1)}`;
  if (day === 20) return '二十';
  if (day < 30) return `廿${DAY_PREFIX[day - 21].slice(1)}`;
  return '三十';
}

export function dateLabel(dayIndex: number): string {
  const { month, day } = dateParts(dayIndex);
  return `${MONTH_NAMES[month - 1]}${lunarDayName(day)}`;
}

export function shortDateLabel(dayIndex: number): string {
  const { month, day } = dateParts(dayIndex);
  return `${month}/${day}`;
}

export function daysUntilFair(dayIndex: number, month: number, day: number): number {
  const fair = dayIndexOf(month, day);
  return fair - dayIndex;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}

export function chance(random: () => number, probability: number): boolean {
  return random() < probability;
}
