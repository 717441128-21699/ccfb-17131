export type ID = string;

export type Role = 'qianxian' | 'shangshou' | 'xiashou' | 'huqin' | 'luogu';
export type MemberRole = Role | 'banzhu' | 'xuetu';
export type MemberStatus = 'ok' | 'sick' | 'left';

export interface Member {
  id: ID;
  name: string;
  role: MemberRole;
  covers: Role[];
  age: number;
  skill: number;
  health: number;
  loyalty: number;
  shares: number;
  status: MemberStatus;
  sickDays: number;
  bio: string;
}

export type PuppetKind =
  | 'sheng'
  | 'dan'
  | 'jing'
  | 'chou'
  | 'wu'
  | 'shen'
  | 'desk'
  | 'carriage';

export interface PuppetItem {
  id: PuppetKind;
  name: string;
  count: number;
  condition: number;
  unitCost: number;
  note: string;
}

export type PlayTag =
  | '历史'
  | '忠烈'
  | '神怪'
  | '爱情'
  | '公案'
  | '苦戏'
  | '武打'
  | '喜庆'
  | '吉祥'
  | '热闹'
  | '文戏';

export interface Play {
  id: ID;
  title: string;
  subtitle: string;
  tags: PlayTag[];
  requiredPuppets: PuppetKind[];
  difficulty: number;
  appeal: number;
  wear: number;
  master: string;
  studyCost: number;
  studyDays: number;
  blurb: string;
}

export type RegionId = 'weihe' | 'beimang' | 'nanshan';

export interface Village {
  id: ID;
  name: string;
  region: RegionId;
  x: number;
  y: number;
  population: number;
  harvest: number;
  wealth: number;
  templeMonth: number;
  templeDay: number;
  templeName: string;
  taste: string;
  preferences: Partial<Record<PlayTag, number>>;
  favoritePlayIds: ID[];
}

export interface Route {
  from: ID;
  to: ID;
  li: number;
}

export type WeatherKind = '晴' | '多云' | '阴' | '小雨' | '大雨' | '雪';

export interface WeatherDay {
  dayIndex: number;
  label: string;
  kind: WeatherKind;
  rain: boolean;
  severe: boolean;
  icon: string;
}

export interface TravelState {
  fromVillageId: ID;
  toVillageId: ID;
  li: number;
  totalDays: number;
  elapsedDays: number;
  reason?: string;
}

export interface StudyState {
  playId: ID;
  master: string;
  totalDays: number;
  elapsedDays: number;
  cost: number;
}

export type LedgerDirection = 'in' | 'out' | 'share';
export type LedgerCategory =
  | '演出戏钱'
  | '观众彩钱'
  | '庙会赏银'
  | '雨灾赔偿'
  | '日常饭食'
  | '行路盘缠'
  | '修补影人'
  | '新添影箱'
  | '拜师学戏'
  | '医药调理'
  | '挽留花红'
  | '请人入伙'
  | '年终分账'
  | '其他';

export interface LedgerSource {
  type: 'performance' | 'travel' | 'study' | 'member' | 'puppet' | 'settlement' | 'daily';
  runId?: ID;
  dayId?: ID;
  villageId?: ID;
  memberId?: ID;
}

export interface LedgerEntry {
  id: ID;
  serial: number;
  dayIndex: number;
  dateLabel: string;
  direction: LedgerDirection;
  category: LedgerCategory;
  title: string;
  amount: number;
  note: string;
  source: LedgerSource;
}

export interface PerformanceDay {
  id: ID;
  runId: ID;
  dayIndex: number;
  dateLabel: string;
  weather: WeatherKind;
  rain: boolean;
  playId: ID;
  villageId: ID;
  quality: number;
  appeal: number;
  audience: number;
  capacity: number;
  hostFee: number;
  tips: number;
  fairBonus: number;
  rainCompensation: number;
  income: number;
  expense: number;
  canceled: boolean;
  cancelKind?: 'rain' | 'cast' | 'box' | 'breach';
  compensation?: number;
  reasons: string[];
}

export interface PerformanceRun {
  id: ID;
  villageId: ID;
  playId: ID;
  agreedDays: number;
  startDayIndex: number;
  endDayIndex?: number;
  completed: boolean;
  dayIds: ID[];
  totalIncome: number;
  totalExpense: number;
}

export interface RivalTroupe {
  id: ID;
  name: string;
  color: string;
  skill: number;
  reputation: number;
  villageId: ID;
  playId: ID;
  untilDayIndex: number;
}

export type LogTone = 'info' | 'good' | 'bad' | 'money' | 'story';

export interface LogEntry {
  id: ID;
  dayIndex: number;
  dateLabel: string;
  tone: LogTone;
  text: string;
}

export interface ChoiceOption {
  id: string;
  label: string;
  detail: string;
  cost?: number;
}

export interface PendingChoice {
  id: ID;
  kind: 'poach' | 'crisis';
  title: string;
  body: string;
  memberId?: ID;
  rivalId?: ID;
  options: ChoiceOption[];
}

export interface SharePayout {
  memberId: ID;
  name: string;
  role: MemberRole;
  shares: number;
  amount: number;
}

export interface YearSettlement {
  settledDayIndex: number;
  totalIncome: number;
  totalPerformanceIncome: number;
  totalExpense: number;
  operatingNet: number;
  reserveRate: number;
  reserve: number;
  bonusPool: number;
  totalShares: number;
  payouts: SharePayout[];
  paidShares: number;
  finalCash: number;
  grade: string;
  title: string;
  summary: string;
}

export interface GameState {
  serial: number;
  yearName: string;
  dayIndex: number;
  cash: number;
  reputation: number;
  currentVillageId: ID;
  travel: TravelState | null;
  activeRunId: ID | null;
  study: StudyState | null;
  members: Member[];
  puppets: PuppetItem[];
  ownedPlayIds: ID[];
  learnedAt: Record<ID, number>;
  affinity: Record<string, number>;
  runs: PerformanceRun[];
  days: PerformanceDay[];
  ledger: LedgerEntry[];
  log: LogEntry[];
  rivals: RivalTroupe[];
  forecast: WeatherDay[];
  pendingChoice: PendingChoice | null;
  settlement: YearSettlement | null;
  totalShows: number;
  totalAudiences: number;
}
