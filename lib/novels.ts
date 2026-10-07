export const TAGS = ["悬疑", "世界观", "冒险", "成长", "群像", "幽默", "权谋", "修仙", "热血", "科幻", "日常", "情感", "历史", "推理", "克系", "慢热", "轻松", "竞技", "神话", "建设"] as const;
export type Tag = typeof TAGS[number];
export type Novel = { id: string; title: string; author: string; genre: string; tags: Tag[]; description: string; color: string; source?: string };
export type Favorite = Novel & { createdAt?: number };
export const novels: Novel[] = [
  { id: "mysteries", title: "诡秘之主", author: "爱潜水的乌贼", genre: "奇幻", tags: ["悬疑", "世界观", "冒险", "成长", "克系", "慢热"], description: "蒸汽时代的日常之下，隐藏着魔药、秘密组织与通往未知的阶梯。", color: "#293a53", source: "https://h5.if.qidian.com/h5/workSet/main?albumId=131&bookId=1010868264&catelogId=69153" },
  { id: "dawn", title: "黎明之剑", author: "远瞳", genre: "科幻", tags: ["世界观", "冒险", "幽默", "科幻", "建设", "群像"], description: "高文在异世界醒来，从一片废墟开始，探索文明与世界的秘密。", color: "#286267", source: "https://acts.qidian.com/2018/6182667/index.html" },
  { id: "strange", title: "道诡异仙", author: "狐尾的笔", genre: "玄幻", tags: ["悬疑", "世界观", "冒险", "克系", "修仙"], description: "李火旺在虚实难辨的世界里寻找答案，面对诡异的仙佛与自己的困惑。", color: "#793a36", source: "https://www.qidian.com/book/1031794030/" },
  { id: "joy", title: "庆余年", author: "猫腻", genre: "历史", tags: ["权谋", "历史", "群像", "幽默", "成长", "慢热"], description: "少年范闲走入京都，在人情、家国与权力之间，寻找自己的选择。", color: "#8c6542", source: "https://book.qidian.com/info/114559b" },
  { id: "zetian", title: "择天记", author: "猫腻", genre: "玄幻", tags: ["成长", "热血", "群像", "情感", "冒险", "慢热"], description: "陈长生离开山村，来到京都，与伙伴一起面对命运和成长。", color: "#666348", source: "https://acts.qidian.com/zetianji/" },
  { id: "mortal", title: "凡人修仙传", author: "忘语", genre: "仙侠", tags: ["修仙", "成长", "冒险", "世界观", "慢热"], description: "出身平凡的韩立谨慎求索，在漫长的修行路上一步步改变命运。", color: "#345852", source: "https://acts.qidian.com/2017/6008661/index.html" },
  { id: "sage", title: "一世之尊", author: "爱潜水的乌贼", genre: "玄幻", tags: ["神话", "世界观", "悬疑", "成长", "冒险", "热血"], description: "从少林到轮回任务，孟奇追寻身世与命运背后的层层布局。", color: "#765947" },
  { id: "glory", title: "全职高手", author: "蝴蝶蓝", genre: "游戏", tags: ["竞技", "热血", "群像", "成长", "幽默"], description: "叶修从网吧重新出发，集结队友，再次走向荣耀的赛场。", color: "#375074" },
  { id: "arcane", title: "奥术神座", author: "爱潜水的乌贼", genre: "奇幻", tags: ["世界观", "成长", "科幻", "冒险", "推理"], description: "路西恩以知识探索魔法世界，在科学、信仰与音乐之间走出自己的路。", color: "#655180" },
  { id: "cultivation", title: "修真聊天群", author: "圣骑士的传说", genre: "都市", tags: ["修仙", "幽默", "日常", "轻松", "群像"], description: "宋书航误入一个修真聊天群，原本普通的大学生活逐渐变得不同。", color: "#ac713e" },
  { id: "night", title: "将夜", author: "猫腻", genre: "玄幻", tags: ["成长", "世界观", "冒险", "情感", "热血", "慢热"], description: "宁缺与桑桑来到长安，在书院与江湖中，寻找守护彼此的力量。", color: "#4d5660" },
  { id: "watchmen", title: "大奉打更人", author: "卖报小郎君", genre: "仙侠", tags: ["推理", "悬疑", "幽默", "权谋", "修仙", "群像"], description: "许七安从案件入手，逐渐走进大奉朝廷与修行世界的复杂局势。", color: "#46707b" },
  { id: "embers", title: "长夜余火", author: "爱潜水的乌贼", genre: "科幻", tags: ["科幻", "悬疑", "冒险", "世界观", "群像", "幽默"], description: "小队穿行于旧世界的遗迹，在危险和谜团中追寻文明失落的原因。", color: "#946541" },
  { id: "redheart", title: "赤心巡天", author: "情何以甚", genre: "仙侠", tags: ["修仙", "群像", "热血", "世界观", "成长", "慢热"], description: "姜望以赤诚之心走过纷争与修行，面对人与天下的选择。", color: "#7e463e" },
  { id: "female", title: "知否？知否？应是绿肥红瘦", author: "关心则乱", genre: "言情", tags: ["情感", "日常", "历史", "成长", "群像", "慢热"], description: "明兰在家庭与人情之间成长，学会经营生活，也寻找自己的归处。", color: "#785668" },
  { id: "silent", title: "默读", author: "priest", genre: "悬疑", tags: ["悬疑", "推理", "情感", "群像"], description: "骆闻舟与费渡在案件中寻找真相，也逐渐理解彼此。", color: "#3a5360" },
];
export function normalizeTitle(value: string) { return value.normalize("NFKC").toLowerCase().replace(/[\s《》？?，,。.!！·]/g, ""); }
export function preferenceTags(favorites: Favorite[]) {
  const counts = new Map<Tag, number>();
  for (const book of favorites) for (const tag of book.tags) counts.set(tag, (counts.get(tag) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]);
}
export type Recommendation = { book: Novel; score: number; shared: Tag[]; closest?: Favorite; reason: string; level: string };
export function recommend(favorites: Favorite[]): Recommendation[] {
  const profile = preferenceTags(favorites);
  const weights = new Map(profile.map(([tag, count]) => [tag, count / Math.max(1, favorites.length) * Math.log(1 + novels.length / (1 + novels.filter(n => n.tags.includes(tag)).length))]));
  const total = [...weights.values()].reduce((a, b) => a + b, 0);
  return novels.filter(n => !favorites.some(f => f.id === n.id || normalizeTitle(f.title) === normalizeTitle(n.title))).map(book => {
    const neighbors = favorites.map(f => ({ f, shared: book.tags.filter(t => f.tags.includes(t)).sort((a, b) => (weights.get(b) || 0) - (weights.get(a) || 0)), similarity: book.tags.filter(t => f.tags.includes(t)).length / Math.sqrt(book.tags.length * f.tags.length) + (book.author === f.author ? 0.14 : 0) })).sort((a, b) => b.similarity - a.similarity);
    const nearest = neighbors[0];
    const coverage = book.tags.reduce((a, t) => a + (weights.get(t) || 0), 0) / (total || 1);
    const score = (nearest?.similarity || 0) * 0.65 + coverage * 0.35;
    const shared = book.tags.filter(t => weights.has(t)).sort((a, b) => (weights.get(b) || 0) - (weights.get(a) || 0));
    const sameAuthor = nearest && nearest.f.author === book.author;
    const reason = nearest && nearest.shared.length ? `你喜欢《${nearest.f.title}》里的${nearest.shared.slice(0, 2).join("、")}元素，这本书延续了这些阅读体验${sameAuthor ? "，也出自同一位作者" : ""}。` : sameAuthor ? `同样出自${book.author}，可以试试这位作者的另一种故事。` : favorites.length ? "与现有喜好的共同点较少，适合想换一种阅读体验时尝试。" : "先从不同题材的作品中挑一本。添加喜欢的小说后，这里会变成你的专属推荐。";
    return { book, score, shared, closest: nearest?.similarity ? nearest.f : undefined, reason, level: !favorites.length ? "书库精选" : score >= 0.58 ? "高度契合" : score >= 0.32 ? "值得一试" : "探索推荐" };
  }).sort((a, b) => b.score - a.score || novels.indexOf(a.book) - novels.indexOf(b.book));
}
