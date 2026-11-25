import type {
  Member,
  PlayDef,
  PuppetKindDef,
  PuppetStock,
  RouteEdge,
  Village,
} from './types';

export const CALENDAR_MONTH_DAYS = 30;
export const YEAR_DAYS = 360;
export const TRAVEL_LI_PER_DAY = 35;

export const REGIONS = [
  {
    name: '渭北旱塬',
    blurb: '塬宽土厚，庙会讲老规矩，爱听列国三国、神怪武戏。',
    color: '#d9b36c',
    points: [
      [54, 78], [210, 42], [420, 70], [455, 210], [360, 360],
      [170, 350], [58, 285],
    ] as Array<[number, number]>,
  },
  {
    name: '洛河川道',
    blurb: '水地收成稳，镇子人稠，文戏苦戏、才子佳人最能叫座。',
    color: '#9fbf8a',
    points: [
      [360, 300], [520, 260], [720, 330], [735, 520], [610, 590],
      [455, 555], [350, 430],
    ] as Array<[number, number]>,
  },
  {
    name: '黄龙山东',
    blurb: '山乡矿镇手头活泛，龙王、关帝、东岳庙会热闹，对台戏也多。',
    color: '#c98a6b',
    points: [
      [650, 58], [820, 55], [955, 170], [940, 430], [805, 470],
      [675, 360], [650, 190],
    ] as Array<[number, number]>,
  },
];

export const VILLAGES: Village[] = [
  {
    id: 'changting', name: '长亭堡', region: '渭北旱塬', x: 150, y: 125,
    population: 420, households: 94, harvest: 0.9,
    fairMonth: 1, fairDay: 15, fairName: '上元灯会', stage: '棚台',
    preferences: { jixiang: 1.35, shenguai: 1.15, lishi: 0.95 },
    favoritePlayId: 'baxian',
    blurb: '上元灯棚连三里，开台戏必要吉祥热闹，会首赏钱大方。',
  },
  {
    id: 'baima', name: '白马坡', region: '渭北旱塬', x: 305, y: 92,
    population: 310, households: 68, harvest: 0.72,
    fairMonth: 2, fairDay: 2, fairName: '龙抬头会', stage: '土台',
    preferences: { wuxi: 1.35, lishi: 1.2, shenguai: 1.05 },
    favoritePlayId: 'shuihu',
    blurb: '坡上风硬，人爱看刀马武戏，唱软了会被起哄。',
  },
  {
    id: 'doujia', name: '窦家庄', region: '渭北旱塬', x: 92, y: 268,
    population: 365, households: 82, harvest: 0.86,
    fairMonth: 2, fairDay: 19, fairName: '观音白衣会', stage: '庙台',
    preferences: { kuixi: 1.35, wenxi: 1.15, jixiang: 1.05 },
    masterScriptId: 'doue',
    blurb: '庄里老婆婆多，苦戏唱到落泪，供品和红包都不薄。',
  },
  {
    id: 'longquan', name: '龙泉寨', region: '渭北旱塬', x: 262, y: 248,
    population: 530, households: 121, harvest: 1.04,
    fairMonth: 3, fairDay: 18, fairName: '后土圣母会', stage: '庙台',
    preferences: { lishi: 1.25, shenguai: 1.2, wenxi: 1.0 },
    masterScriptId: 'xiyou',
    blurb: '班社常落脚的老寨子，庙台宽，会首懂戏，糊弄不得。',
  },
  {
    id: 'yukou', name: '峪口镇', region: '渭北旱塬', x: 414, y: 178,
    population: 680, households: 158, harvest: 1.16,
    fairMonth: 4, fairDay: 8, fairName: '药王庙会', stage: '棚台',
    preferences: { wenxi: 1.2, lishi: 1.1, jixiang: 1.1 },
    blurb: '药材行和粮行都出钱，唱得好能连台，食宿也周到。',
  },
  {
    id: 'jiaokou', name: '交口河', region: '洛河川道', x: 430, y: 392,
    population: 490, households: 112, harvest: 1.12,
    fairMonth: 3, fairDay: 3, fairName: '文昌帝君会', stage: '棚台',
    preferences: { wenxi: 1.3, aiqing: 1.05, lishi: 1.0 },
    blurb: '河码头人杂，客商多，消息灵， rival 班社也常经过。',
  },
  {
    id: 'tianjia', name: '田家湾', region: '洛河川道', x: 560, y: 326,
    population: 405, households: 91, harvest: 1.28,
    fairMonth: 8, fairDay: 15, fairName: '中秋报谢会', stage: '棚台',
    preferences: { aiqing: 1.35, wenxi: 1.25, kuixi: 0.9 },
    masterScriptId: 'pipa',
    blurb: '川道好水田，秋收后囤里有粮，最爱才子佳人、悲欢离合。',
  },
  {
    id: 'luochuan', name: '洛川城', region: '洛河川道', x: 516, y: 486,
    population: 920, households: 220, harvest: 1.02,
    fairMonth: 5, fairDay: 13, fairName: '关帝磨刀会', stage: '庙台',
    preferences: { lishi: 1.35, wuxi: 1.25, shenguai: 0.95 },
    blurb: '县城地面，帮会、粮商、驻军都来看，对台戏输了最伤名声。',
  },
  {
    id: 'shitou', name: '石头街', region: '洛河川道', x: 682, y: 430,
    population: 575, households: 134, harvest: 0.96,
    fairMonth: 6, fairDay: 24, fairName: '二郎降妖会', stage: '土台',
    preferences: { shenguai: 1.3, wuxi: 1.2, chou: 1.1 },
    blurb: '石匠和脚夫多，爱看热闹神怪，变脸、打虎最讨彩。',
  },
  {
    id: 'huaibai', name: '槐柏村', region: '洛河川道', x: 650, y: 552,
    population: 335, households: 76, harvest: 0.92,
    fairMonth: 7, fairDay: 7, fairName: '七夕乞巧会', stage: '棚台',
    preferences: { aiqing: 1.4, wenxi: 1.15, kuixi: 1.0 },
    blurb: '村里槐树成荫，七夕唱鹊桥、西厢，姑娘媳妇听得最真。',
  },
  {
    id: 'huangfu', name: '皇甫村', region: '黄龙山东', x: 760, y: 150,
    population: 445, households: 99, harvest: 0.82,
    fairMonth: 3, fairDay: 28, fairName: '东岳泰山会', stage: '庙台',
    preferences: { shenguai: 1.2, lishi: 1.15, kuixi: 1.1 },
    blurb: '山道入口，香客上下山都要歇脚听戏，四月前最热闹。',
  },
  {
    id: 'yuntai', name: '云台观', region: '黄龙山东', x: 682, y: 88,
    population: 300, households: 64, harvest: 0.7,
    fairMonth: 10, fairDay: 15, fairName: '下元解厄会', stage: '庙台',
    preferences: { shenguai: 1.4, jixiang: 1.25, kuixi: 1.05 },
    masterScriptId: 'nezha',
    blurb: '观里藏经版和老唱本，老道脾气怪，心不诚不给说戏。',
  },
  {
    id: 'getai', name: '圪台镇', region: '黄龙山东', x: 884, y: 248,
    population: 625, households: 146, harvest: 0.76,
    fairMonth: 4, fairDay: 15, fairName: '龙王祈雨会', stage: '土台',
    preferences: { shenguai: 1.35, wuxi: 1.1, jixiang: 1.15 },
    blurb: '山镇靠林木、药材过活，求雨谢龙的戏最舍得花钱。',
  },
  {
    id: 'shimen', name: '石门驿', region: '黄龙山东', x: 820, y: 366,
    population: 520, households: 121, harvest: 0.9,
    fairMonth: 6, fairDay: 6, fairName: '天贶晒经会', stage: '棚台',
    preferences: { lishi: 1.15, wenxi: 1.1, shenguai: 1.05 },
    blurb: '旧驿站，南北班子在此打尖换箱，消息和人手都好找。',
  },
  {
    id: 'baiyu', name: '柏峪村', region: '黄龙山东', x: 918, y: 472,
    population: 355, households: 80, harvest: 0.86,
    fairMonth: 9, fairDay: 9, fairName: '重阳谢秋会', stage: '土台',
    preferences: { lishi: 1.2, jixiang: 1.2, kuixi: 1.0 },
    blurb: '秋粮和山货下场后，村里人请戏谢山，现钱不拖欠。',
  },
];

export const ROUTES: RouteEdge[] = [
  { from: 'changting', to: 'baima', li: 32 },
  { from: 'changting', to: 'doujia', li: 28 },
  { from: 'baima', to: 'longquan', li: 35 },
  { from: 'baima', to: 'yukou', li: 43 },
  { from: 'doujia', to: 'longquan', li: 30 },
  { from: 'longquan', to: 'yukou', li: 29 },
  { from: 'longquan', to: 'jiaokou', li: 46 },
  { from: 'yukou', to: 'jiaokou', li: 39 },
  { from: 'yukou', to: 'huangfu', li: 58 },
  { from: 'jiaokou', to: 'tianjia', li: 32 },
  { from: 'jiaokou', to: 'luochuan', li: 41 },
  { from: 'tianjia', to: 'shitou', li: 31 },
  { from: 'tianjia', to: 'luochuan', li: 36 },
  { from: 'luochuan', to: 'shitou', li: 39 },
  { from: 'luochuan', to: 'huaibai', li: 34 },
  { from: 'shitou', to: 'huaibai', li: 32 },
  { from: 'shitou', to: 'shimen', li: 37 },
  { from: 'huangfu', to: 'yuntai', li: 31 },
  { from: 'huangfu', to: 'getai', li: 39 },
  { from: 'huangfu', to: 'shimen', li: 52 },
  { from: 'getai', to: 'shimen', li: 34 },
  { from: 'shimen', to: 'baiyu', li: 43 },
];

export const PLAYS: PlayDef[] = [
  {
    id: 'baxian', name: '八仙庆寿', subtitle: '吉祥开场戏',
    tags: ['jixiang', 'shenguai'], difficulty: 48, baseAppeal: 76,
    tuition: 0, learnDays: 0,
    requiredPuppets: ['shenfo', 'choujue', 'qimo'],
    intro: '群仙祝寿，热闹稳妥，庙会开场和主家喜庆都少不了。',
  },
  {
    id: 'sanguo', name: '空城计', subtitle: '三国老戏',
    tags: ['lishi', 'wenxi'], difficulty: 84, baseAppeal: 88,
    tuition: 0, learnDays: 0,
    requiredPuppets: ['wensheng', 'laosheng', 'jingjue', 'qimo'],
    intro: '孔明城楼抚琴，司马懿兵退四十里。最考签手稳劲和上手唱功。',
  },
  {
    id: 'xixiang', name: '西厢记·拷红', subtitle: '才子佳人',
    tags: ['aiqing', 'wenxi'], difficulty: 72, baseAppeal: 82,
    tuition: 0, learnDays: 0,
    requiredPuppets: ['wensheng', 'huadan', 'choujue'],
    intro: '红娘利嘴驳老夫人，川道村子最爱听，唱得俏皮才有赏。',
  },
  {
    id: 'yangjia', name: '穆柯寨', subtitle: '杨家将刀马戏',
    tags: ['lishi', 'wuxi', 'aiqing'], difficulty: 78, baseAppeal: 85,
    tuition: 0, learnDays: 0,
    requiredPuppets: ['kaojiang', 'huadan', 'jingjue', 'qimo'],
    intro: '穆桂英走马擒宗保，刀枪把子要快，锣鼓必须咬得紧。',
  },
  {
    id: 'nezha', name: '哪吒闹海', subtitle: '封神榜',
    tags: ['shenguai', 'wuxi'], difficulty: 86, baseAppeal: 91,
    tuition: 260, learnDays: 7, masterName: '云台子', masterVillageId: 'yuntai',
    requiredPuppets: ['shenfo', 'yaoguai', 'kaojiang', 'qimo'],
    intro: '哪吒斗龙王、抽龙筋，变化多，需龙形、水旗和神怪影人齐全。',
  },
  {
    id: 'xiyou', name: '三打白骨精', subtitle: '西游记',
    tags: ['shenguai', 'wuxi'], difficulty: 90, baseAppeal: 94,
    tuition: 320, learnDays: 8, masterName: '严文举', masterVillageId: 'longquan',
    requiredPuppets: ['shenfo', 'yaoguai', 'huadan', 'kaojiang', 'qimo'],
    intro: '白骨精三变，孙悟空三打。最容易叫座，也最考影人换场功夫。',
  },
  {
    id: 'doue', name: '窦娥冤', subtitle: '苦戏',
    tags: ['kuixi', 'wenxi'], difficulty: 82, baseAppeal: 86,
    tuition: 240, learnDays: 6, masterName: '窦老儒', masterVillageId: 'doujia',
    requiredPuppets: ['huadan', 'laosheng', 'choujue'],
    intro: '六月飞雪，血溅白练。塬上老婆婆听一场哭一场，赏钱也重。',
  },
  {
    id: 'pipa', name: '赵五娘吃糠', subtitle: '琵琶记',
    tags: ['kuixi', 'wenxi', 'aiqing'], difficulty: 76, baseAppeal: 81,
    tuition: 220, learnDays: 6, masterName: '高砚秋', masterVillageId: 'tianjia',
    requiredPuppets: ['huadan', 'laosheng', 'qimo'],
    intro: '糟糠自厌、剪发卖发，川道秋收后唱最合景。',
  },
  {
    id: 'shuihu', name: '武松打虎', subtitle: '水浒武戏',
    tags: ['wuxi', 'lishi'], difficulty: 83, baseAppeal: 87,
    tuition: 250, learnDays: 6, masterName: '冯铁腿', masterVillageId: 'baima',
    requiredPuppets: ['kaojiang', 'jingjue', 'qimo'],
    intro: '景阳冈醉打猛虎，需虎形影人和硬桥硬马的锣鼓点。',
  },
];

export const PUPPET_KINDS: PuppetKindDef[] = [
  { id: 'wensheng', name: '文生公子', baseCost: 180, note: '许仙、张生、孔明一类儒雅人物。' },
  { id: 'huadan', name: '花旦青衣', baseCost: 210, note: '小旦、青衣、红娘、穆桂英。' },
  { id: 'laosheng', name: '老生须生', baseCost: 190, note: '孔明、赵五娘公公、忠义长者。' },
  { id: 'jingjue', name: '花脸净角', baseCost: 230, note: '包公、曹操、张飞、二郎神。' },
  { id: 'choujue', name: '丑角彩旦', baseCost: 150, note: '店家、媒婆、歪嘴和尚，负责逗笑。' },
  { id: 'kaojiang', name: '靠甲武將', baseCost: 280, note: '扎靠武将，带刀枪翎子。' },
  { id: 'shenfo', name: '神佛仙真', baseCost: 260, note: '八仙、哪吒、关公、玉帝。' },
  { id: 'yaoguai', name: '妖魔鬼怪', baseCost: 240, note: '白骨精、龙虎、鬼怪变化。' },
  { id: 'qimo', name: '桌椅车马切末', baseCost: 120, note: '城帐、刀枪、云片、水旗等道具。' },
];

export const INITIAL_PUPPETS: PuppetStock[] = [
  { kindId: 'wensheng', count: 3, condition: 82 },
  { kindId: 'huadan', count: 3, condition: 76 },
  { kindId: 'laosheng', count: 2, condition: 88 },
  { kindId: 'jingjue', count: 2, condition: 72 },
  { kindId: 'choujue', count: 2, condition: 84 },
  { kindId: 'kaojiang', count: 2, condition: 68 },
  { kindId: 'shenfo', count: 3, condition: 90 },
  { kindId: 'yaoguai', count: 1, condition: 58 },
  { kindId: 'qimo', count: 1, condition: 64 },
];

export const INITIAL_MEMBERS: Member[] = [
  {
    id: 'm_qianshou', name: '卫线儿', role: 'qianshou', age: 42, skill: 91,
    share: 2.0, health: 88, stamina: 86, loyalty: 78, status: '正常',
    illnessDays: 0, accruedShare: 0, shows: 0,
    bio: '签手出身，十指能让影人转头、理髯、拔剑，是班里的顶梁柱。',
  },
  {
    id: 'm_shangshou', name: '金满堂', role: 'shangshou', age: 47, skill: 88,
    share: 1.7, health: 82, stamina: 75, loyalty: 72, status: '正常',
    illnessDays: 0, accruedShare: 0, shows: 0,
    bio: '上手主唱念，嗓门能压过庙会人声，肚子里有七十多本戏。',
  },
  {
    id: 'm_xiashou', name: '石柱', role: 'xiashou', age: 29, skill: 74,
    share: 1.0, health: 95, stamina: 94, loyalty: 68, status: '正常',
    illnessDays: 0, accruedShare: 0, shows: 0,
    bio: '下手帮签、装人、换影人，手脚快，正等着攒钱自立门户。',
  },
  {
    id: 'm_huqin', name: '周弦声', role: 'huqin', age: 36, skill: 84,
    share: 1.25, health: 79, stamina: 80, loyalty: 70, status: '正常',
    illnessDays: 0, accruedShare: 0, shows: 0,
    bio: '一把胡琴托腔保调，戏唱得舒不舒服，一半在他的弦上。',
  },
  {
    id: 'm_luogu', name: '雷大鼓', role: 'luogu', age: 33, skill: 81,
    share: 1.25, health: 91, stamina: 89, loyalty: 74, status: '正常',
    illnessDays: 0, accruedShare: 0, shows: 0,
    bio: '打锣鼓兼钹铙，武戏节奏全看他，三声鼓能让全场静下来。',
  },
  {
    id: 'm_xuetu', name: '豆儿', role: 'xuetu', age: 15, skill: 46,
    share: 0.5, health: 96, stamina: 98, loyalty: 82, status: '正常',
    illnessDays: 0, accruedShare: 0, shows: 0,
    bio: '挑箱、点灯、跑龙套，半份工钱，偶尔能替下手递影人。',
  },
];

export const RIVAL_NAMES = [
  { id: 'rival_desheng', name: '德盛班', master: '崔一口', color: '#8e3b2e', quality: 86, villageId: 'shimen', malice: 0.55 },
  { id: 'rival_sanyi', name: '三意社', master: '孟签子', color: '#2f5d7c', quality: 80, villageId: 'jiaokou', malice: 0.45 },
  { id: 'rival_fushun', name: '福顺影班', master: '罗半台', color: '#6b4e16', quality: 74, villageId: 'getai', malice: 0.35 },
];

export const ROLE_LABELS: Record<Member['role'], string> = {
  qianshou: '签手',
  shangshou: '上手',
  xiashou: '下手',
  huqin: '拉胡琴',
  luogu: '打锣鼓',
  xuetu: '学徒/杂务',
};

export const TAG_LABELS: Record<string, string> = {
  shenguai: '神怪',
  lishi: '历史',
  wenxi: '文戏',
  wuxi: '武戏',
  kuixi: '苦戏',
  aiqing: '言情',
  jixiang: '吉祥',
  chou: '诙谐',
};

export const PUPPET_MAP = Object.fromEntries(
  PUPPET_KINDS.map((p) => [p.id, p]),
) as Record<string, PuppetKindDef>;

export const PLAY_MAP = Object.fromEntries(PLAYS.map((p) => [p.id, p])) as Record<string, PlayDef>;
export const VILLAGE_MAP = Object.fromEntries(VILLAGES.map((v) => [v.id, v])) as Record<string, Village>;
