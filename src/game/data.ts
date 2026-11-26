import type {
  Member,
  Play,
  PuppetItem,
  Route,
  RivalTroupe,
  Village,
} from './types';

export const SAVE_KEY = 'shadow-troupe-save-v1';
export const DAYS_PER_MONTH = 30;
export const YEAR_DAYS = 360;
export const START_DAY_INDEX = 5; // 正月初六
export const TRAVEL_LI_PER_DAY = 30;

export const REGION_NAMES = {
  beimang: '北蟒塬',
  weihe: '渭河川',
  nanshan: '南山坳',
} as const;

export const VILLAGES: Village[] = [
  {
    id: 'yaotou', name: '尧头村', region: 'beimang', x: 105, y: 125,
    population: 310, harvest: 0.64, wealth: 0.55,
    templeMonth: 2, templeDay: 15, templeName: '老君庙会',
    taste: '塬上人爱听封神、三国，唱苦戏也能掉泪，最嫌文戏拖腔。',
    preferences: { 神怪: 1.35, 历史: 1.2, 苦戏: 1.1, 武打: 1.15, 文戏: 0.55 },
    favoritePlayIds: ['nezha', 'sangu'],
  },
  {
    id: 'baima', name: '白马窑', region: 'beimang', x: 260, y: 82,
    population: 370, harvest: 0.69, wealth: 0.72,
    templeMonth: 3, templeDay: 16, templeName: '窑神春会',
    taste: '烧窑人家出手爽，爱热闹吉祥，神怪武打最能招满场。',
    preferences: { 热闹: 1.35, 神怪: 1.25, 吉祥: 1.2, 武打: 1.05, 爱情: 0.7 },
    favoritePlayIds: ['baxian', 'xiyou'],
  },
  {
    id: 'tielu', name: '铁炉寨', region: 'beimang', x: 430, y: 126,
    population: 520, harvest: 0.72, wealth: 0.82,
    templeMonth: 4, templeDay: 8, templeName: '火神会',
    taste: '铁匠炉匠多，爱看忠臣烈将和硬桥硬马的武戏。',
    preferences: { 忠烈: 1.4, 历史: 1.25, 武打: 1.3, 公案: 0.9, 爱情: 0.55 },
    favoritePlayIds: ['yangjia', 'yuefei'],
  },
  {
    id: 'hejia', name: '贺家洼', region: 'beimang', x: 600, y: 84,
    population: 340, harvest: 0.61, wealth: 0.58,
    templeMonth: 7, templeDay: 7, templeName: '七夕赛会',
    taste: '村子偏，一年难得一班戏，西厢、白蛇这类文戏反倒稀罕。',
    preferences: { 爱情: 1.25, 文戏: 1.2, 喜庆: 1.05, 历史: 0.85 },
    favoritePlayIds: ['xixiang', 'baishe'],
  },
  {
    id: 'bajiao', name: '八角庙', region: 'beimang', x: 780, y: 136,
    population: 440, harvest: 0.7, wealth: 0.68,
    templeMonth: 8, templeDay: 15, templeName: '八角庙秋会',
    taste: '庙大地宽，秋收后肯出钱，就怕戏不热闹、留不住远客。',
    preferences: { 热闹: 1.3, 神怪: 1.15, 武打: 1.15, 喜庆: 1.1, 文戏: 0.65 },
    favoritePlayIds: ['xiyou', 'bainv'],
  },
  {
    id: 'taoyuan', name: '桃园堡', region: 'weihe', x: 145, y: 302,
    population: 470, harvest: 0.84, wealth: 0.8,
    templeMonth: 3, templeDay: 18, templeName: '圣母娘娘会',
    taste: '娘娘会前唱吉祥旦戏，婆媳妯娌多，爱团圆、不爱太苦。',
    preferences: { 爱情: 1.2, 喜庆: 1.3, 吉祥: 1.25, 文戏: 1.05, 苦戏: 0.65 },
    favoritePlayIds: ['bainv', 'baishe'],
  },
  {
    id: 'liulin', name: '柳林镇', region: 'weihe', x: 315, y: 248,
    population: 780, harvest: 0.91, wealth: 0.96,
    templeMonth: 5, templeDay: 13, templeName: '关帝大刀会',
    taste: '大镇码头，懂戏的老戏骨多。三国、公案唱差一点就有人喝倒彩。',
    preferences: { 历史: 1.45, 忠烈: 1.35, 公案: 1.2, 武打: 1.2, 文戏: 0.85 },
    favoritePlayIds: ['sangu', 'zhamei'],
  },
  {
    id: 'shigu', name: '石鼓村', region: 'weihe', x: 486, y: 312,
    population: 430, harvest: 0.82, wealth: 0.74,
    templeMonth: 2, templeDay: 19, templeName: '观音春会',
    taste: '石鼓人耳朵刁，讲究唱腔和签手稳，神怪戏的机关影人最讨彩。',
    preferences: { 神怪: 1.25, 文戏: 1.15, 公案: 1.05, 热闹: 1.0, 武打: 0.9 },
    favoritePlayIds: ['baishe', 'xiyou'],
  },
  {
    id: 'fenghe', name: '沣河渡', region: 'weihe', x: 330, y: 397,
    population: 510, harvest: 0.86, wealth: 0.83,
    templeMonth: 6, templeDay: 19, templeName: '龙王谢雨会',
    taste: '渡口南北人杂，什么都能看，最肯打彩钱；夏天怕雨，龙王戏要恭敬。',
    preferences: { 热闹: 1.2, 神怪: 1.2, 吉祥: 1.1, 历史: 1.0, 爱情: 0.95 },
    favoritePlayIds: ['baxian', 'zhamei'],
  },
  {
    id: 'changning', name: '长宁驿', region: 'weihe', x: 665, y: 276,
    population: 640, harvest: 0.88, wealth: 0.9,
    templeMonth: 9, templeDay: 9, templeName: '重阳驿会',
    taste: '驿路官商来往，赏银厚，角色不齐、行头不新便压不住台面。',
    preferences: { 历史: 1.2, 忠烈: 1.15, 喜庆: 1.15, 武打: 1.1, 爱情: 0.9 },
    favoritePlayIds: ['sangu', 'bainv'],
  },
  {
    id: 'xinfeng', name: '新丰店', region: 'weihe', x: 846, y: 342,
    population: 490, harvest: 0.8, wealth: 0.86,
    templeMonth: 10, templeDay: 1, templeName: '城隍十月会',
    taste: '秋收后钱粮足，连唱三五日是常事；公案苦戏最容易传名。',
    preferences: { 公案: 1.35, 苦戏: 1.25, 历史: 1.05, 喜庆: 1.0, 神怪: 0.9 },
    favoritePlayIds: ['zhamei', 'zhouren'],
  },
  {
    id: 'qingzhu', name: '青竹沟', region: 'nanshan', x: 148, y: 518,
    population: 285, harvest: 0.74, wealth: 0.52,
    templeMonth: 10, templeDay: 15, templeName: '山神庙会',
    taste: '山沟路远，请一班戏不容易，爱看热闹武打，人少但管饭实在。',
    preferences: { 武打: 1.3, 热闹: 1.25, 神怪: 1.1, 喜庆: 0.9, 文戏: 0.6 },
    favoritePlayIds: ['xiyou', 'nezha'],
  },
  {
    id: 'shiqiao', name: '石桥峪', region: 'nanshan', x: 350, y: 562,
    population: 325, harvest: 0.7, wealth: 0.57,
    templeMonth: 4, templeDay: 4, templeName: '石桥奶奶会',
    taste: '春末茶余饭后，爱听家庭喜庆和爱情小戏，拿腔拿调反而受欢迎。',
    preferences: { 爱情: 1.2, 喜庆: 1.25, 文戏: 1.15, 苦戏: 0.8, 历史: 0.75 },
    favoritePlayIds: ['bainv', 'xixiang'],
  },
  {
    id: 'tianjia', name: '田家湾', region: 'nanshan', x: 545, y: 506,
    population: 365, harvest: 0.78, wealth: 0.62,
    templeMonth: 8, templeDay: 10, templeName: '田家秋报会',
    taste: '秋收后还愿，村风忠孝，苦戏、忠义戏能让老人带头凑钱。',
    preferences: { 苦戏: 1.3, 忠烈: 1.2, 公案: 1.05, 吉祥: 1.0, 热闹: 0.8 },
    favoritePlayIds: ['zhouren', 'yangjia'],
  },
  {
    id: 'laojun', name: '老君岭', region: 'nanshan', x: 735, y: 566,
    population: 300, harvest: 0.66, wealth: 0.54,
    templeMonth: 2, templeDay: 15, templeName: '老君岭上元会',
    taste: '岭上风寒，看神怪斗法最提神，也敬老君，不敢在台上失礼。',
    preferences: { 神怪: 1.4, 热闹: 1.2, 武打: 1.15, 吉祥: 1.0, 爱情: 0.65 },
    favoritePlayIds: ['nezha', 'baxian'],
  },
  {
    id: 'huaxi', name: '花溪寨', region: 'nanshan', x: 890, y: 494,
    population: 405, harvest: 0.76, wealth: 0.69,
    templeMonth: 3, templeDay: 3, templeName: '花溪上巳会',
    taste: '溪水边搭台，年轻看客多，旦角爱情戏和新鲜影人才有彩声。',
    preferences: { 爱情: 1.35, 文戏: 1.1, 喜庆: 1.1, 神怪: 0.95, 历史: 0.7 },
    favoritePlayIds: ['xixiang', 'baishe'],
  },
];

export const ROUTES: Route[] = [
  { from: 'yaotou', to: 'baima', li: 28 },
  { from: 'baima', to: 'tielu', li: 34 },
  { from: 'tielu', to: 'hejia', li: 33 },
  { from: 'hejia', to: 'bajiao', li: 39 },
  { from: 'yaotou', to: 'taoyuan', li: 38 },
  { from: 'baima', to: 'liulin', li: 32 },
  { from: 'tielu', to: 'liulin', li: 41 },
  { from: 'tielu', to: 'shigu', li: 36 },
  { from: 'hejia', to: 'changning', li: 42 },
  { from: 'bajiao', to: 'changning', li: 43 },
  { from: 'bajiao', to: 'xinfeng', li: 36 },
  { from: 'taoyuan', to: 'liulin', li: 24 },
  { from: 'liulin', to: 'shigu', li: 29 },
  { from: 'liulin', to: 'fenghe', li: 27 },
  { from: 'shigu', to: 'fenghe', li: 24 },
  { from: 'shigu', to: 'changning', li: 39 },
  { from: 'changning', to: 'xinfeng', li: 34 },
  { from: 'taoyuan', to: 'qingzhu', li: 42 },
  { from: 'fenghe', to: 'shiqiao', li: 35 },
  { from: 'qingzhu', to: 'shiqiao', li: 31 },
  { from: 'shiqiao', to: 'tianjia', li: 37 },
  { from: 'shigu', to: 'tianjia', li: 43 },
  { from: 'tianjia', to: 'changning', li: 36 },
  { from: 'tianjia', to: 'laojun', li: 34 },
  { from: 'laojun', to: 'huaxi', li: 33 },
  { from: 'huaxi', to: 'xinfeng', li: 39 },
  { from: 'xinfeng', to: 'laojun', li: 47 },
];

export const PLAYS: Play[] = [
  {
    id: 'baishe', title: '白蛇传', subtitle: '借伞 · 盗草 · 水漫金山',
    tags: ['爱情', '神怪', '文戏'], requiredPuppets: ['sheng', 'dan', 'shen', 'desk'],
    difficulty: 3, appeal: 84, wear: 4, master: '华县 李丝线', studyCost: 18, studyDays: 6,
    blurb: '文唱做打俱全，旦角和神怪影人出彩，娘娘庙会最相宜。',
  },
  {
    id: 'sangu', title: '三国演义', subtitle: '古城会 · 挑袍 · 长坂坡',
    tags: ['历史', '忠烈', '武打'], requiredPuppets: ['sheng', 'jing', 'wu', 'carriage'],
    difficulty: 4, appeal: 88, wear: 5, master: '同州 王铜嗓', studyCost: 24, studyDays: 8,
    blurb: '大镇码头的压台戏，讲究唱功、架势和千军万马的排场。',
  },
  {
    id: 'xiyou', title: '西游记', subtitle: '三打白骨精 · 大闹天宫',
    tags: ['神怪', '武打', '热闹'], requiredPuppets: ['shen', 'chou', 'wu'],
    difficulty: 3, appeal: 90, wear: 6, master: '周至 孙翻筋', studyCost: 22, studyDays: 7,
    blurb: '老少都看得懂，翻打变化最费神怪影人，也最招满场。',
  },
  {
    id: 'nezha', title: '哪吒闹海', subtitle: '剔骨还父 · 莲花化身',
    tags: ['神怪', '武打', '热闹'], requiredPuppets: ['shen', 'wu', 'chou'],
    difficulty: 4, appeal: 86, wear: 7, master: '华阴 陈火彩', studyCost: 26, studyDays: 8,
    blurb: '火彩、水怪、龙形齐上，塬上和岭上的村子最爱点。',
  },
  {
    id: 'yangjia', title: '杨家将', subtitle: '金沙滩 · 李陵碑',
    tags: ['忠烈', '历史', '苦戏', '武打'], requiredPuppets: ['sheng', 'jing', 'wu'],
    difficulty: 4, appeal: 85, wear: 5, master: '同州 王铜嗓', studyCost: 24, studyDays: 7,
    blurb: '忠良死节，老人爱听；铁炉寨、田家湾一类地方格外敬重。',
  },
  {
    id: 'yuefei', title: '岳飞传', subtitle: '枪挑小梁王 · 风波亭',
    tags: ['历史', '忠烈', '武打', '苦戏'], requiredPuppets: ['sheng', 'wu', 'jing'],
    difficulty: 5, appeal: 89, wear: 6, master: '蒲城 赵铁弦', studyCost: 32, studyDays: 10,
    blurb: '难度高、排场硬，唱好了赏银和名声一起来，唱砸也传得快。',
  },
  {
    id: 'xixiang', title: '西厢记', subtitle: '惊艳 · 拷红 · 长亭送别',
    tags: ['爱情', '文戏'], requiredPuppets: ['sheng', 'dan', 'desk'],
    difficulty: 3, appeal: 78, wear: 3, master: '渭南 苏婉词', studyCost: 16, studyDays: 6,
    blurb: '唱腔细腻，靠上手一条嗓子；山沟小村若少见文戏，反而新鲜。',
  },
  {
    id: 'zhamei', title: '铡美案', subtitle: '秦香莲 · 包龙图 · 铜铡美',
    tags: ['公案', '苦戏'], requiredPuppets: ['jing', 'dan', 'sheng', 'desk'],
    difficulty: 3, appeal: 87, wear: 4, master: '蒲城 赵铁弦', studyCost: 20, studyDays: 7,
    blurb: '包公一出场台下就静，秋收后的集镇连唱几天也有人追。',
  },
  {
    id: 'bainv', title: '五女拜寿', subtitle: '祝寿 · 冷暖 · 团圆',
    tags: ['喜庆', '爱情', '文戏'], requiredPuppets: ['dan', 'sheng', 'chou', 'desk'],
    difficulty: 2, appeal: 80, wear: 3, master: '渭南 苏婉词', studyCost: 14, studyDays: 5,
    blurb: '庙会祝寿的稳妥戏，行当齐、气氛圆，不容易大砸锅。',
  },
  {
    id: 'baxian', title: '八仙过海', subtitle: '庆寿 · 过海 · 各显神通',
    tags: ['吉祥', '神怪', '热闹', '喜庆'], requiredPuppets: ['shen', 'chou', 'dan', 'sheng'],
    difficulty: 3, appeal: 83, wear: 5, master: '华县 李丝线', studyCost: 18, studyDays: 6,
    blurb: '吉祥讨彩，庙会正日常开台；影人多，旧了便不显光鲜。',
  },
  {
    id: 'zhouren', title: '周仁回府', subtitle: '踏纱帽 · 哭墓 · 全忠义',
    tags: ['苦戏', '忠烈', '文戏'], requiredPuppets: ['sheng', 'dan', 'desk'],
    difficulty: 5, appeal: 86, wear: 4, master: '华阴 陈火彩', studyCost: 28, studyDays: 9,
    blurb: '签手和上手的硬功戏，唱作极重，唱好了能在一个县传名。',
  },
  {
    id: 'lang', title: '东郭救狼', subtitle: '中山狼 · 负恩 · 老农评理',
    tags: ['公案', '热闹', '文戏'], requiredPuppets: ['sheng', 'chou', 'shen'],
    difficulty: 2, appeal: 74, wear: 3, master: '周至 孙翻筋', studyCost: 12, studyDays: 4,
    blurb: '短打寓言戏，丑角讨喜，适合垫台或人手略有缺口时应急。',
  },
];

export const INITIAL_PUPPETS: PuppetItem[] = [
  { id: 'sheng', name: '生角皇帽巾', count: 6, condition: 84, unitCost: 18, note: '文生、武生、帝王巾帽都在这一堂。' },
  { id: 'dan', name: '旦角头面衣衫', count: 7, condition: 77, unitCost: 20, note: '正旦、小旦、彩旦头面，怕潮怕摔。' },
  { id: 'jing', name: '净角花脸壳子', count: 5, condition: 62, unitCost: 22, note: '包公、关公、霸王全靠花脸神气。' },
  { id: 'chou', name: '丑角三花脸', count: 4, condition: 88, unitCost: 12, note: '鼻子上一块白，垫台逗笑离不了。' },
  { id: 'wu', name: '武将靠子刀枪', count: 6, condition: 70, unitCost: 26, note: '硬靠、软靠、翎子和刀枪架子。' },
  { id: 'shen', name: '神怪朵子火彩', count: 5, condition: 45, unitCost: 24, note: '龙形、鬼怪、莲花和变脸朵子，最易损坏。' },
  { id: 'desk', name: '桌椅帐幔公案', count: 8, condition: 90, unitCost: 8, note: '一桌二椅变化出公堂、绣楼、帅帐。' },
  { id: 'carriage', name: '车马銮驾旗子', count: 4, condition: 57, unitCost: 16, note: '车旗、马形、銮驾和龙套旗子。' },
];

export const INITIAL_MEMBERS: Member[] = [
  {
    id: 'pei', name: '裴一线', role: 'qianxian', covers: [], age: 53,
    skill: 92, health: 86, loyalty: 72, shares: 14, status: 'ok', sickDays: 0,
    bio: '班中头一把签手，一根丝线能让影人转头理髯。脾气硬，敬重懂戏的会首。',
  },
  {
    id: 'zhou', name: '周映红', role: 'shangshou', covers: [], age: 34,
    skill: 89, health: 91, loyalty: 67, shares: 12, status: 'ok', sickDays: 0,
    bio: '上手主唱，真假嗓转换清亮。别的班早想来挖，全看一年分红和情面。',
  },
  {
    id: 'ma', name: '马满仓', role: 'xiashou', covers: [], age: 42,
    skill: 72, health: 78, loyalty: 64, shares: 8, status: 'ok', sickDays: 0,
    bio: '下手帮签、递影人、帮腔，戏熟力气足。',
  },
  {
    id: 'zhao', name: '赵桐音', role: 'huqin', covers: [], age: 48,
    skill: 84, health: 74, loyalty: 75, shares: 10, status: 'ok', sickDays: 0,
    bio: '一把板胡托腔保调，弦上能听出演员嗓子舒不舒服。',
  },
  {
    id: 'he', name: '何雷震', role: 'luogu', covers: [], age: 29,
    skill: 81, health: 93, loyalty: 62, shares: 8, status: 'ok', sickDays: 0,
    bio: '锣鼓经熟，武戏气势全靠他。年轻手活好，也最容易被红包装动。',
  },
  {
    id: 'dou', name: '豆官', role: 'xuetu', covers: ['xiashou', 'luogu'], age: 16,
    skill: 46, health: 96, loyalty: 80, shares: 3, status: 'ok', sickDays: 0,
    bio: '学徒，跑腿、装箱、帮场，能顶几下下手和锣鼓，只是压不住大戏。',
  },
];

export const INITIAL_OWNED_PLAYS = ['baishe', 'sangu', 'xiyou', 'bainv', 'lang'];

export const INITIAL_RIVALS: RivalTroupe[] = [
  {
    id: 'deqing', name: '德庆班', color: '#7f1d1d', skill: 86, reputation: 82,
    villageId: 'tielu', playId: 'yuefei', untilDayIndex: 70,
  },
  {
    id: 'yihe', name: '义合社', color: '#1e3a8a', skill: 76, reputation: 68,
    villageId: 'fenghe', playId: 'zhamei', untilDayIndex: 48,
  },
  {
    id: 'fushun', name: '福顺班', color: '#14532d', skill: 70, reputation: 58,
    villageId: 'bajiao', playId: 'baxian', untilDayIndex: 85,
  },
];

export const ROLE_NAMES: Record<string, string> = {
  banzhu: '班主',
  qianxian: '签手',
  shangshou: '上手',
  xiashou: '下手',
  huqin: '拉胡琴',
  luogu: '打锣鼓',
  xuetu: '学徒',
};

export const CORE_ROLES: Array<{ role: keyof typeof ROLE_NAMES; label: string }> = [
  { role: 'qianxian', label: '签手' },
  { role: 'shangshou', label: '上手' },
  { role: 'xiashou', label: '下手' },
  { role: 'huqin', label: '胡琴' },
  { role: 'luogu', label: '锣鼓' },
];
