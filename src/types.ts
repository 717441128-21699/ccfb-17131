export type TabId = 'map' | 'troupe' | 'chest' | 'ledger';

export type RoleId =
  | 'qianshou'
  | 'shangshou'
  | 'xiashou'
  | 'huqin'
  | 'luogu'
  | 'xuetu';

export type Weather = '晴' | '多云' | '阴' | '小雨' | '连阴雨' | '雪' | '西北风';

export type PlayTag =
  | 'shenguai'
  | 'lishi'
  | 'wenxi'
  | 'wuxi'
  | 'kuixi'
  | 'aiqing'
  | 'jixiang'
  | 'chou';

export type PuppetKindId =
  | 'wensheng'
  | 'huadan'
  | 'laosheng'
  | 'jingjue'
  | 'choujue'
  | 'kaojiang'
  | 'shenfo'
  | 'yaoguai'
  | 'qimo';

export interface Village {
  id: string;
  name: string;
  region: string;
  x: number;
  y: number;
  population: number;
  households: number;
  harvest: number;
  fairMonth: number;
  fairDay: number;
  fairName: string;
  stage: '庙台' | '棚台' | '土台';
  preferences: Partial<Record<PlayTag, number>>;
  favoritePlayId?: string;
  masterScriptId?: string;
  blurb: string;
}

export interface RouteEdge {
  from: string;
  to: string;
  li: number;
  path?: Array<{ x: number; y: number }>;
}

export interface PlayDef {
  id: string;
  name: string;
  subtitle: string;
  tags: PlayTag[];
  difficulty: number;
  baseAppeal: number;
  tuition: number;
  learnDays: number;
  masterName?: string;
  masterVillageId?: string;
  requiredPuppets: PuppetKindId[];
  intro: string;
}

export interface PuppetKindDef {
  id: PuppetKindId;
  name: string;
  baseCost: number;
  note: string;
}

export interface PuppetStock {
  kindId: PuppetKindId;
  count: number;
  condition: number;
}

export type MemberStatus = '正常' | '小病' | '卧病' | '被挖走';

export interface Member {
  id: string;
  name: string;
  role: RoleId;
  age: number;
  skill: number;
  share: number;
  health: number;
  stamina: number;
  loyalty: number;
  status: MemberStatus;
  illnessDays: number;
  accruedShare: number;
  shows: number;
  bio: string;
}

export interface TravelState {
  fromId: string;
  toId: string;
  li: number;
  totalDays: number;
  elapsedDays: number;
}

export interface RivalTroupe {
  id: string;
  name: string;
  master: string;
  color: string;
  quality: number;
  villageId: string;
  stayDays: number;
  travel?: TravelState;
  malice: number;
}

export type ContractKind = '庙会戏' | '谢秋戏' | '还愿戏';

export interface ContractOffer {
  kind: ContractKind;
  eventName: string;
  nights: number;
  payPerNight: number;
  mealPerPerson: number;
  reason?: string;
}

export interface Engagement {
  id: string;
  villageId: string;
  kind: ContractKind;
  eventName: string;
  startDay: number;
  totalNights: number;
  currentNight: number;
  payPerNight: number;
  mealPerPerson: number;
  rivalId?: string;
  performanceIds: string[];
  status: 'active' | 'completed' | 'broken';
}

export interface QualityFactor {
  label: string;
  value: number;
  detail: string;
}

export interface PerformanceRecord {
  id: string;
  year: number;
  day: number;
  dateLabel: string;
  villageId: string;
  engagementId: string;
  contractKind: ContractKind;
  eventName: string;
  night: number;
  totalNights: number;
  playId: string;
  weather: Weather;
  cancelled: boolean;
  cancellationReason?: string;
  quality: number;
  audience: number;
  population: number;
  basePay: number;
  bonus: number;
  mealValue: number;
  penalty: number;
  sharePool: number;
  totalSharePoints: number;
  rivalId?: string;
  rivalName?: string;
  rivalQuality?: number;
  competitionResult?: 'win' | 'lose' | 'draw';
  affinityBefore: number;
  affinityAfter: number;
  factors: QualityFactor[];
  notes: string[];
  payouts: Array<{ memberId: string; name: string; role: RoleId; share: number; amount: number }>;
}

export type LedgerKind = 'income' | 'expense' | 'transfer';

export type LedgerCategory =
  | '戏钱'
  | '赏钱'
  | '管饭折银'
  | '赔偿罚银'
  | '日常饭食'
  | '盘缠脚钱'
  | '医药'
  | '犒赏'
  | '修影人'
  | '添影人'
  | '拜师学费'
  | '招人安家'
  | '辞班结账'
  | '年份分红'
  | '借款'
  | '还款'
  | '其他';

export interface LedgerEntry {
  id: string;
  year: number;
  day: number;
  dateLabel: string;
  kind: LedgerKind;
  category: LedgerCategory;
  title: string;
  amount: number;
  villageId?: string;
  performanceId?: string;
  memberId?: string;
  inKind?: boolean;
  note?: string;
}

export interface LogEntry {
  id: string;
  day: number;
  dateLabel: string;
  tone: 'normal' | 'good' | 'bad' | 'event';
  text: string;
}

export interface GameEventChoice {
  id: string;
  label: string;
  hint?: string;
}

export interface GameEvent {
  id: string;
  day: number;
  type: 'poach' | 'illness' | 'weather' | 'rival' | 'visitor' | 'year';
  title: string;
  body: string;
  memberId?: string;
  choices: GameEventChoice[];
}

export interface YearSettlement {
  year: number;
  settledDay: number;
  totalIncome: number;
  totalExpense: number;
  debtDue: number;
  debtPaid: number;
  shareDue: number;
  sharePaid: number;
  shortfall: number;
  cashBeforePayout: number;
  cashAfter: number;
  grade: '红火大年' | '体面过年' | '紧巴年关' | '散班难关';
  summary: string;
  shows: number;
  audience: number;
  reputation: number;
}

export interface VillageYearState {
  fairDone: boolean;
  autumnDone: boolean;
  lastRegularDay?: number;
}

export interface AffinityState {
  base: number;
  value: number;
  lastDay?: number;
  recentDays: number[];
}

export interface GameState {
  schemaVersion: number;
  seed: number;
  rngState: number;
  year: number;
  day: number;
  cash: number;
  debt: number;
  reputation: number;
  currentVillageId: string;
  travel?: TravelState;
  weather: Weather;
  forecast: Weather[];
  villages: Village[];
  routes: RouteEdge[];
  villageState: Record<string, VillageYearState>;
  affinity: Record<string, Record<string, AffinityState>>;
  members: Member[];
  puppets: PuppetStock[];
  knownScriptIds: string[];
  rehearsal: Record<string, number>;
  rivals: RivalTroupe[];
  engagement?: Engagement;
  ledger: LedgerEntry[];
  performances: PerformanceRecord[];
  logs: LogEntry[];
  pendingEvent?: GameEvent;
  settlement?: YearSettlement;
  nextId: number;
  totalShows: number;
  totalAudience: number;
  autosaveAt?: string;
}
