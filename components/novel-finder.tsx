"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Plus, Sparkles, Heart, X, Check, Compass, Library, Fingerprint, Info, ExternalLink, LoaderCircle } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { novels, TAGS, recommend, preferenceTags, normalizeTitle, type Favorite, type Tag, type Recommendation, type Novel } from "@/lib/novels";

type FavoritesPayload = { favorites: Favorite[]; signedIn: boolean; addedTitle?: string; error?: string };
type SaveResult = { ok: true; title: string; favorites: Favorite[] } | { ok: false; error: string };
type ModelContext = { registerTool: (tool: { name: string; title: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }; execute: (input: unknown) => unknown }, options: { signal: AbortSignal }) => void | Promise<void> };

function Jacket({ book, small = false }: { book: Novel; small?: boolean }) {
  return <div className={`jacket ${small ? "jacket-small" : ""}`} style={{ backgroundColor: book.color }} aria-hidden="true"><span className="jacket-label">拾页 · 阅读</span><span className="jacket-title">{book.title}</span><span className="jacket-author">{book.author}</span><span className="jacket-number">NOVEL / {book.genre}</span></div>;
}

export default function NovelFinder() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [signedIn, setSignedIn] = useState(true);
  const [saving, setSaving] = useState(false);
  const [demo, setDemo] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [detail, setDetail] = useState<Recommendation | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [tags, setTags] = useState<Tag[]>([]);
  const [addTab, setAddTab] = useState("catalog");
  const activeFavorites = demo ? [novels[0], novels[1], novels[2]] : favorites;
  const recommendations = useMemo(() => recommend(activeFavorites), [favorites, demo]);
  const profile = preferenceTags(activeFavorites);
  const featured = recommendations[0];

  async function load() {
    setLoading(true); setLoadError("");
    try {
      const res = await fetch("/api/favorites", { cache: "no-store" });
      const data = await res.json() as FavoritesPayload;
      if (!res.ok) throw new Error(data.error || "暂时无法读取喜好书单，请重试。");
      setFavorites(data.favorites); setSignedIn(data.signedIn);
    } catch (e) { setLoadError(e instanceof Error ? e.message : "无法连接，请重试。"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (!message) return; const t = setTimeout(() => setMessage(""), 3500); return () => clearTimeout(t); }, [message]);

  async function addFavorite(book: Partial<Favorite>): Promise<SaveResult> {
    if (saving || loading || loadError) return { ok: false, error: "正在处理书单，请稍后重试。" };
    setError(""); setSaving(true);
    try {
      const res = await fetch("/api/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(book) });
      const data = await res.json() as FavoritesPayload;
      if (!res.ok) { if (res.status === 401) setSignedIn(false); throw new Error(data.error || "保存失败，请重试。"); }
      setFavorites(data.favorites); setDemo(false); setAddOpen(false); setDetail(null); setTitle(""); setAuthor(""); setTags([]); setQuery(""); setMessage(`已添加《${data.addedTitle}》，推荐已更新`);
      return { ok: true, title: data.addedTitle || "", favorites: data.favorites };
    } catch (e) { const message = e instanceof Error ? e.message : "保存失败，请重试。"; setError(message); return { ok: false, error: message }; }
    finally { setSaving(false); }
  }
  async function removeFavorite(id: string) {
    if (saving) return;
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/favorites?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json() as FavoritesPayload;
      if (!res.ok) throw new Error(data.error || "移除失败，请重试。");
      setFavorites(data.favorites); setMessage("已移除，推荐已更新");
    } catch (e) { setError(e instanceof Error ? e.message : "移除失败，请重试。"); }
    finally { setSaving(false); }
  }
  function openAdd() { setDemo(false); setError(""); setAddOpen(true); }

  const actions = useRef({ addFavorite, favorites: activeFavorites, loading, loadError });
  actions.current = { addFavorite, favorites: activeFavorites, loading, loadError };
  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: Parameters<ModelContext["registerTool"]>[0]) => {
      try { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => console.warn("Browser tools are unavailable")); }
      catch { console.warn("Browser tools are unavailable"); }
    };
    register({ name: "get_novel_recommendations", title: "读取小说推荐", description: "读取页面当前喜好及前四本推荐，包含具体推荐理由。示例模式时返回示例偏好。", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute: input => {
      if (!input || typeof input !== "object" || Object.keys(input).length) throw new Error("参数必须为空对象。");
      if (actions.current.loading || actions.current.loadError) throw new Error("喜好书单尚未成功加载。");
      return { favorites: actions.current.favorites.map(f => ({ id: f.id, title: f.title })), recommendations: recommend(actions.current.favorites).slice(0, 4).map(r => ({ id: r.book.id, title: r.book.title, author: r.book.author, reason: r.reason, level: r.level })) };
    }});
    register({ name: "add_liked_novel", title: "保存喜欢的小说", description: "按书库作品 ID 将小说保存到当前登录用户的喜好书单，同时更新页面推荐。", inputSchema: { type: "object", properties: { id: { type: "string", enum: novels.map(n => n.id) } }, required: ["id"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: true }, execute: async input => {
      if (!input || typeof input !== "object" || Object.keys(input).length !== 1 || !("id" in input) || typeof input.id !== "string" || !novels.some(n => n.id === input.id)) throw new Error("请选择有效的书库作品 ID。");
      const result = await actions.current.addFavorite({ id: input.id });
      if (!result.ok) throw new Error(result.error);
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      return { addedTitle: result.title, favoriteCount: result.favorites.length, recommendations: recommend(result.favorites).slice(0, 4).map(r => ({ id: r.book.id, title: r.book.title, reason: r.reason })) };
    }});
    return () => lifecycle.abort();
  }, []);

  return <div className="site-shell">
    <header className="topbar"><a className="brand" href="/" aria-label="拾页首页"><span className="brand-icon"><BookOpen size={22}/></span><span>拾页<span className="brand-en">NOVEL FINDER</span></span></a><div className="header-note"><Compass size={16}/> 寻找与你共鸣的故事</div><button className="subtle-button" onClick={() => setInfoOpen(true)}><Info size={16}/><span>推荐如何产生</span></button></header>
    <main className="workspace">
      <div className="page-intro"><div><div className="eyebrow">YOUR NEXT CHAPTER</div><h1>从喜欢的故事，找到下一本<span>。</span></h1><p>告诉拾页你读过的好书，让下一次相遇更合心意。</p></div><div className="intro-mark"><Fingerprint size={22}/><span>每个人的喜好<br/><strong>都值得被理解</strong></span></div></div>
      <div className="content-grid">
        <aside className="taste-panel">
          <div className="panel-heading"><div><Heart size={18}/><h2>我的喜好</h2></div><span className="count">{activeFavorites.length} 本</span></div>
          <p className="panel-description">从你喜欢的小说开始。</p>
          <button className="primary-button add-button" onClick={openAdd} disabled={loading || !!loadError}><Plus size={18}/> 添加喜欢的小说</button>
          {loading ? <div className="loading-shelf" aria-label="正在读取喜好"><Skeleton className="h-16 w-full"/><Skeleton className="h-16 w-full"/></div> : loadError ? <div className="inline-error" role="alert">{loadError}<button onClick={() => void load()}>重新读取</button></div> : activeFavorites.length ? <div className="favorite-list">{activeFavorites.map(book => <div className="favorite-row" key={book.id}><Jacket book={book} small/><div className="favorite-copy"><strong>{book.title}</strong><span>{book.author || "自定义作品"}</span></div>{!demo && <button className="remove-button" disabled={saving} onClick={() => void removeFavorite(book.id)} aria-label={`移除${book.title}`}><X size={15}/></button>}</div>)}</div> : <div className="empty-shelf"><Library size={32} strokeWidth={1.4}/><strong>还没遇见你的书单</strong><p>添加 1 本就能开始推荐。<br/>多添加几本，偏好会更清晰。</p><button className="text-button" onClick={() => setDemo(true)}>试试示例书单</button></div>}
          {demo && <div className="demo-note">正在体验示例偏好，未保存到你的书单。<button onClick={() => setDemo(false)}>退出示例</button></div>}
          {!!profile.length && <div className="taste-profile"><div className="profile-heading"><Fingerprint size={17}/><h3>你的阅读偏好</h3></div><div className="profile-tags">{profile.slice(0, 6).map(([tag, count]) => <span key={tag}>{tag}<small>{count}</small></span>)}</div><p>从喜欢的书中归纳，共同元素越多，偏好越明显。</p></div>}
          <div className="sidebar-footer"><BookOpen size={17}/><p>好故事很多，<br/>适合你的那一本更特别。</p></div>
        </aside>
        <section className="recommendation-panel" aria-label="小说推荐">
          <div className="results-heading"><div><div className="section-eyebrow"><span className="short-rule"/>{demo ? "示例推荐" : activeFavorites.length ? "为你发现" : "先认识几本好书"}</div><h2>{activeFavorites.length ? "下一本，或许就是它" : "你的喜好，是推荐的起点"}</h2></div><span className="result-note"><Sparkles size={15}/>{activeFavorites.length ? `基于 ${activeFavorites.length} 本喜欢的小说` : `${novels.length} 本起步书库`}</span></div>
          {featured && <article className="featured-card"><div className="featured-jacket"><Jacket book={featured.book}/><span className="jacket-caption">{featured.book.genre} · {featured.book.tags[0]}</span></div><div className="featured-copy"><div className="book-overline"><span className="recommendation-label"><Sparkles size={13}/>{featured.level}</span><span className="rank">01 / PICK FOR YOU</span></div><h3>{featured.book.title}</h3><p className="book-author">{featured.book.author} <span>著</span></p><p className="book-summary">{featured.book.description}</p><div className="tag-list">{featured.book.tags.slice(0, 4).map(t => <span key={t}>{t}</span>)}</div><div className="recommendation-reason"><span className="reason-icon"><Fingerprint size={18}/></span><div><strong>{activeFavorites.length ? "为什么推荐给你" : "认识这本书"}</strong><p>{featured.reason}</p></div></div><div className="book-actions"><button className="primary-button" onClick={() => { setError(""); setDetail(featured); }}>看看这本书</button><button className="like-button" disabled={saving || loading || !!loadError} onClick={() => void addFavorite({ id: featured.book.id })}><Heart size={17}/> 我也喜欢</button></div></div></article>}
          {!featured && <Empty className="catalog-exhausted"><EmptyHeader><Library size={32}/><EmptyTitle>你已经认识书库里的全部作品</EmptyTitle><EmptyDescription>当前书库没有其他小说可推荐。可以继续补充喜好，等待书库扩充。</EmptyDescription></EmptyHeader></Empty>}
          {recommendations.length > 1 && <div className="more-heading"><h3>还有这些故事，值得翻开</h3><span>不同故事，相同共鸣</span></div>}
          <div className="recommendation-grid">{recommendations.slice(1, 4).map((item, index) => <article className="mini-card" key={item.book.id}><div className="mini-card-top"><Jacket book={item.book} small/><span className="mini-rank">0{index + 2}</span></div><span className="mini-genre">{item.book.genre} · {item.level}</span><h3>{item.book.title}</h3><p className="mini-author">{item.book.author}</p><div className="mini-tags">{(item.shared.length ? item.shared : item.book.tags).slice(0, 2).map(t => <span key={t}>{t}</span>)}</div><p className="mini-reason">{activeFavorites.length ? item.reason : item.book.description}</p><button className="card-detail-button" onClick={() => { setError(""); setDetail(item); }}><BookOpen size={15}/> 查看推荐理由</button></article>)}</div>
          <div className="recommendation-footnote"><Info size={15}/><p>推荐基于题材、风格与作者的共同点；契合程度表示相似性，不代表作品评分。</p></div>
        </section>
      </div>
      {error && !addOpen && !detail && <div className="page-error" role="alert">{error}{!signedIn && <a href="/signin-with-chatgpt?return_to=%2F" target="_top">登录后保存喜好</a>}</div>}
    </main>
    <footer className="site-footer"><span>拾页 <span className="footer-dot">/</span> 把时间留给喜欢的故事</span><span>一本喜欢的书，是下一本的线索。</span></footer>
    {message && <div className="toast" role="status"><Check size={17}/>{message}</div>}

    <Dialog open={addOpen} onOpenChange={open => { if (!saving) setAddOpen(open); }}><DialogContent className="novel-dialog"><DialogTitle className="dialog-title">添加喜欢的小说</DialogTitle><DialogDescription>喜欢的题材、人物或文风，都会成为下一本书的线索。</DialogDescription><Tabs value={addTab} onValueChange={setAddTab}><TabsList className="add-tabs"><TabsTrigger value="catalog">从书库添加</TabsTrigger><TabsTrigger value="custom">手动添加</TabsTrigger></TabsList><TabsContent value="catalog"><Command className="book-picker"><CommandInput placeholder="搜索书名或作者…" value={query} onValueChange={setQuery} aria-label="搜索书名或作者"/><CommandList><CommandEmpty>没有找到这本书。你可以切换到「手动添加」。</CommandEmpty><CommandGroup>{novels.map(book => { const exists = favorites.some(f => normalizeTitle(f.title) === normalizeTitle(book.title)); return <CommandItem key={book.id} value={`${book.title} ${book.author}`} disabled={exists || saving} onSelect={() => void addFavorite({ id: book.id })}><Jacket book={book} small/><span className="picker-copy"><strong>{book.title}</strong><span>{book.author} · {book.genre}</span></span>{exists ? <Check size={17}/> : <Plus size={17}/>}</CommandItem>; })}</CommandGroup></CommandList></Command><p className="form-hint">书库暂未收录的作品，可手动添加并标记喜欢的元素。</p></TabsContent><TabsContent value="custom"><form onSubmit={e => { e.preventDefault(); void addFavorite({ title, author, tags }); }} className="custom-form"><label htmlFor="novel-title">小说名称 <span>*</span></label><input id="novel-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="例如：你最近读完的小说" maxLength={80} required/><label htmlFor="novel-author">作者 <span className="optional">选填</span></label><input id="novel-author" value={author} onChange={e => setAuthor(e.target.value)} placeholder="作者名" maxLength={50}/><fieldset><legend>你喜欢它的哪些元素？ <span>*</span></legend><p className="form-hint">选择 1–6 项，帮助推荐理解书库外的作品。</p><div className="custom-tags">{TAGS.map(tag => <label key={tag} className={tags.includes(tag) ? "checked" : ""}><Checkbox checked={tags.includes(tag)} disabled={!tags.includes(tag) && tags.length >= 6} onCheckedChange={checked => setTags(old => checked ? [...old, tag] : old.filter(t => t !== tag))}/>{tag}</label>)}</div></fieldset><button className="primary-button form-submit" type="submit" disabled={saving || !title.trim() || !tags.length}>{saving ? <LoaderCircle size={17} className="spinner"/> : <Plus size={17}/>}保存并更新推荐</button></form></TabsContent></Tabs>{saving && addTab === "catalog" && <p role="status" className="form-hint">正在保存并更新推荐…</p>}{error && <div className="inline-error" role="alert">{error}{!signedIn && <a href="/signin-with-chatgpt?return_to=%2F" target="_top">登录后保存喜好</a>}</div>}</DialogContent></Dialog>
    <Dialog open={!!detail} onOpenChange={open => { if (!open) setDetail(null); }}><DialogContent className="novel-dialog detail-dialog">{detail && <><div className="detail-head"><Jacket book={detail.book} small/><div><span className="mini-genre">{detail.book.genre} · {detail.level}</span><DialogTitle className="dialog-title">{detail.book.title}</DialogTitle><DialogDescription>{detail.book.author} 著</DialogDescription></div></div><p className="detail-summary">{detail.book.description}</p><div className="tag-list">{detail.book.tags.map(t => <span key={t}>{t}</span>)}</div><div className="recommendation-reason"><span className="reason-icon"><Fingerprint size={20}/></span><div><strong>{activeFavorites.length ? "与你的喜好有什么关联" : "添加喜好，让推荐更懂你"}</strong><p>{detail.reason}</p></div></div><p className="form-hint">标签与简介为本站整理；作品详情以原始平台为准。</p><div className="detail-actions"><button className="primary-button" disabled={saving || loading || !!loadError} onClick={() => void addFavorite({ id: detail.book.id })}>{saving ? <LoaderCircle size={16} className="spinner"/> : <Heart size={16}/>}添加到我的喜好</button>{detail.book.source && <a href={detail.book.source} target="_blank" rel="noopener noreferrer" className="subtle-button"><ExternalLink size={15}/> 作品来源</a>}</div>{error && <div className="inline-error" role="alert">{error}{!signedIn && <a href="/signin-with-chatgpt?return_to=%2F" target="_top">登录后保存喜好</a>}</div>}</>}</DialogContent></Dialog>
    <Dialog open={infoOpen} onOpenChange={setInfoOpen}><DialogContent className="novel-dialog"><DialogTitle className="dialog-title">每一条推荐，都有线索</DialogTitle><DialogDescription>从你喜欢的书中，寻找共同的阅读体验。</DialogDescription><div className="explanation-step"><span>01</span><div><h3>先了解你喜欢什么</h3><p>归纳小说里的题材与风格。书库没有的小说，由你补充喜欢的元素。</p></div></div><div className="explanation-step"><span>02</span><div><h3>找到相似的故事</h3><p>比较共同标签，并适度考虑同一作者。较少见的共同元素有更高权重。</p></div></div><div className="explanation-step"><span>03</span><div><h3>说明为什么适合你</h3><p>推荐会指出对应的喜好作品和共同元素；已经喜欢的小说会被排除。</p></div></div><div className="algorithm-note">当前使用本站整理的 {novels.length} 本小说进行标签匹配。推荐理由来自明确的共同点，未使用大模型，也不包含实时榜单或读者评分。</div></DialogContent></Dialog>
  </div>;
}
