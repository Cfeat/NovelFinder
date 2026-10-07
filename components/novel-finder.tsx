"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Search, Heart, Plus, Check, ChevronRight, ChevronLeft, RefreshCw, SlidersHorizontal, Library, ExternalLink, ArrowUpRight, Compass, BookmarkCheck, EyeOff, Fingerprint, Download, LoaderCircle } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { novels, TAGS, recommend, recommendFeed, normalizeTitle, type Tag, type Recommendation, type Novel, type ExplorationMode } from "@/lib/novels";
import { platforms, sourceName, mergeCatalog, catalogKey, type CatalogPayload, type SourceState } from "@/lib/catalog/model";
import { snapshotBooks, snapshotSources } from "@/lib/catalog/snapshot";
import { validateFavorite } from "@/lib/favorite-input";
import { emptyProfile, parseProfile, PROFILE_STORAGE_KEY, type ReaderProfile } from "@/lib/reader-profile";

const INITIAL_CATALOG = mergeCatalog(snapshotBooks);
const CATEGORIES = [
  ["全部", ""], ["玄幻", "玄幻"], ["奇幻", "奇幻"], ["仙侠", "修仙"], ["都市", "都市"],
  ["历史", "历史"], ["科幻", "科幻"], ["悬疑", "悬疑"], ["言情", "情感"], ["游戏", "游戏"], ["竞技", "竞技"],
] as const;
type Section = "discover" | "catalog" | "shelf";
const MODE_LABELS: Record<ExplorationMode, string> = { focused: "更贴合", balanced: "平衡推荐", explore: "多探索" };
function inCategory(book: Novel, category: string) {
  const match = CATEGORIES.find(c => c[0] === category);
  return !match?.[1] || book.genre.includes(category) || book.genre.includes(match[1]) || book.tags.includes(match[1] as Tag);
}
function matchesSelection(book: Novel, query: string, platform: string, category = "全部") {
  return inCategory(book, category) && (platform === "all" || (platform === "curated" ? !book.platform : book.platform === platform)) && (!query.trim() || normalizeTitle(book.title + " " + book.author).includes(normalizeTitle(query)));
}
function Jacket({ book, small = false }: { book: Novel; small?: boolean }) {
  return <div className={"jacket" + (small ? " jacket-small" : "")} style={{ backgroundColor: book.color }} aria-hidden="true">
    <span className="jacket-label">拾页书库</span><span className="jacket-title">{book.title}</span>
    <span className="jacket-author">{book.author || "阅读的下一站"}</span><span className="jacket-rule"/><span className="jacket-genre">{book.genre}</span>
  </div>;
}
function fallbackDetail(book: Novel): Recommendation {
  return { book, score: 0, shared: [], reason: "已收录的书目。添加喜好或选择阅读元素后，可以查看与你的偏好有什么关联。", level: "书目详情", channels: [] };
}


type BookCardProps = {
  item: Recommendation; shelf: boolean; discover: boolean; liked: boolean; disabled: boolean;
  onOpen: (book: Novel) => void; onAdd: (book: Novel) => void;
  onRemove: (book: Novel) => void; onDismiss: (book: Novel) => void;
};
function BookCard({ item, shelf, discover, liked, disabled, onOpen, onAdd, onRemove, onDismiss }: BookCardProps) {
  const book = item.book;
  return <article className="book-card">
    <button className="cover-button" onClick={() => onOpen(book)} aria-label={"查看《" + book.title + "》详情"}><Jacket book={book} small/></button>
    <div className="book-card-copy">
      <button className="book-title" onClick={() => onOpen(book)}>{book.title}</button>
      <p className="book-byline">{book.author || "作者未填写"}<span>·</span>{book.genre}</p>
      <p className="book-description">{book.description}</p>
      <div className="book-tags">{(item.shared.length ? item.shared : book.tags).slice(0, 2).map(tag => <span key={tag}>{tag}</span>)}<span className="source-label">{sourceName(book.platform)}</span></div>
      {discover && <p className="book-reason"><Fingerprint size={12}/>{item.reason}</p>}
      <div className="book-card-actions">
        {shelf ? <button onClick={() => onRemove(book)} disabled={disabled}>移出喜好</button> : <button className={liked ? "saved" : ""} disabled={liked || disabled} onClick={() => onAdd(book)}>{liked ? <Check size={13}/> : <Plus size={13}/>}{liked ? "已加入喜好" : "加入喜好"}</button>}
        {!shelf && discover && <button className="dismiss-button" onClick={() => onDismiss(book)} disabled={disabled} aria-label={"不感兴趣：" + book.title}>不感兴趣</button>}
        <button className="detail-link" onClick={() => onOpen(book)}>详情<ChevronRight size={12}/></button>
      </div>
    </div>
  </article>;
}

export default function NovelFinder() {
  const [profile, setProfile] = useState<ReaderProfile>(emptyProfile);
  const profileRef = useRef(profile);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [catalog, setCatalog] = useState<Novel[]>(INITIAL_CATALOG);
  const [sources, setSources] = useState<SourceState[]>(snapshotSources);
  const [catalogError, setCatalogError] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [section, setSection] = useState<Section>("discover");
  const [category, setCategory] = useState("全部");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [batch, setBatch] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [detail, setDetail] = useState<Recommendation | null>(null);
  const [addTab, setAddTab] = useState<"catalog" | "custom">("catalog");
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerSource, setPickerSource] = useState("all");
  const [customTitle, setCustomTitle] = useState("");
  const [customAuthor, setCustomAuthor] = useState("");
  const [customTags, setCustomTags] = useState<Tag[]>([]);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchNote, setSearchNote] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const options = useMemo(() => ({ preferredTags: profile.preferredTags, blockedTags: profile.blockedTags, feedback: profile.feedback, exploration: profile.exploration }), [profile]);
  const ranked = useMemo(() => recommend(profile.favorites, catalog, options), [profile.favorites, catalog, options]);
  const scopedCatalog = useMemo(() => catalog.filter(book => matchesSelection(book, search, sourceFilter, category)), [catalog, search, sourceFilter, category]);
  const feed = useMemo(() => recommendFeed(profile.favorites, scopedCatalog, options, 64), [profile.favorites, scopedCatalog, options]);
  const rankMap = useMemo(() => new Map(ranked.map(r => [r.book.id, r])), [ranked]);
  const favorites = profile.favorites;
  const personalized = !!favorites.length || !!profile.preferredTags.length;
  const filteredFeed = feed;
  const visibleRanked = ranked.filter(r => matchesSelection(r.book, search, sourceFilter, category));
  const batches = Math.max(1, Math.ceil(filteredFeed.length / 8));
  const currentBatch = Math.min(batch, batches - 1);
  const picks = filteredFeed.slice(currentBatch * 8, currentBatch * 8 + 8);
  const feature = picks[0];
  const collection = section === "shelf" ? favorites.filter(book => matchesSelection(book, search, sourceFilter, category)) : scopedCatalog;
  const pages = Math.max(1, Math.ceil(collection.length / 18));
  const currentPage = Math.min(page, pages - 1);
  const pickerBooks = catalog.filter(b => (pickerSource === "all" || (pickerSource === "curated" ? !b.platform : b.platform === pickerSource)) && (!pickerQuery.trim() || normalizeTitle(b.title + " " + b.author).includes(normalizeTitle(pickerQuery))));
  const hasFavorite = (book: Novel) => favorites.some(f => normalizeTitle(f.title) === normalizeTitle(book.title));

  useEffect(() => {
    function loadProfile() {
      try { const next = parseProfile(localStorage.getItem(PROFILE_STORAGE_KEY)); profileRef.current = next; setProfile(next); setStorageError(""); }
      catch { setStorageError("本地书单暂时无法读取。原数据已保留，可以先导出备份，再检查浏览器存储。"); }
      setReady(true);
    }
    loadProfile();
    const onStorage = (event: StorageEvent) => { if (event.key === PROFILE_STORAGE_KEY || event.key === null) loadProfile(); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  useEffect(() => { if (message) { const timer = setTimeout(() => setMessage(""), 3500); return () => clearTimeout(timer); } }, [message]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/catalog", { cache: "no-store" }).then(async response => {
      const data = await response.json() as CatalogPayload;
      if (!response.ok) throw new Error(data.error);
      if (!cancelled) { setCatalog(data.books); setSources(data.sources); }
    }).catch(() => { if (!cancelled) setCatalogError("增量书库暂时不可用，当前使用已收录的公开书目。"); });
    return () => { cancelled = true; };
  }, []);

  const commit = useCallback((next: ReaderProfile) => {
    if (!ready || storageError) { setError("请先恢复本地书单的读取，再进行修改。"); return false; }
    try {
      const checked = parseProfile(JSON.stringify(next));
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(checked));
      profileRef.current = checked; setProfile(checked); setBatch(0); setPage(0); setError(""); return true;
    } catch { setError("保存失败，请检查浏览器存储空间或访问权限。你的输入已保留。"); return false; }
  }, [ready, storageError]);
  const addFavorite = useCallback(async (input: unknown) => {
    if (saving || !ready || storageError) return;
    setSaving(true); setError("");
    try {
      const book = await validateFavorite(input, catalog);
      const current = profileRef.current;
      if (current.favorites.some(f => normalizeTitle(f.title) === normalizeTitle(book.title))) throw new Error("这本小说已经在你的喜好书架中。");
      if (current.favorites.length >= 100) throw new Error("喜好书架最多保存 100 本，请先移除一些作品。");
      const next = { ...current, favorites: [{ ...book, createdAt: Date.now() }, ...current.favorites], feedback: current.feedback.filter(f => normalizeTitle(f.book.title) !== normalizeTitle(book.title)) };
      if (commit(next)) { setAddOpen(false); setDetail(null); setCustomTitle(""); setCustomAuthor(""); setCustomTags([]); setMessage("已加入《" + book.title + "》，推荐已更新"); }
    } catch (e) { setError(e instanceof Error ? e.message : "保存失败，请重试。"); }
    finally { setSaving(false); }
  }, [saving, ready, storageError, catalog, commit]);
  function removeFavorite(book: Novel) {
    if (commit({ ...profileRef.current, favorites: profileRef.current.favorites.filter(f => f.id !== book.id) })) setMessage("已移出喜好书架，推荐已更新");
  }
  const feedback = useCallback((book: Novel, kind: "dismissed" | "read") => {
    const current = profileRef.current;
    const next = { ...current, feedback: [{ book, kind, at: Date.now() }, ...current.feedback.filter(f => normalizeTitle(f.book.title) !== normalizeTitle(book.title))].slice(0, 200) };
    if (commit(next)) { setDetail(null); setMessage(kind === "read" ? "已记录为读过，将不再推荐这本书" : "已排除这本书，可在阅读偏好中恢复"); }
  }, [commit]);
  function toggleTag(tag: Tag, field: "preferredTags" | "blockedTags") {
    const current = profileRef.current;
    const other = field === "preferredTags" ? "blockedTags" : "preferredTags";
    commit({ ...current, [field]: current[field].includes(tag) ? current[field].filter(t => t !== tag) : [...current[field], tag], [other]: current[other].filter(t => t !== tag) });
  }
  function openBook(book: Novel) { setError(""); setDetail(rankMap.get(book.id) || fallbackDetail(book)); }
  function openAdd() { setError(""); setAddOpen(true); }
  function navigate(next: Section) { setSection(next); setPage(0); setBatch(0); setCategory("全部"); setSourceFilter("all"); setSearch(""); }
  function exportProfile() {
    try {
      const data = localStorage.getItem(PROFILE_STORAGE_KEY) || JSON.stringify(profileRef.current);
      const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = "拾页-本地书单.json"; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError("导出失败，请检查浏览器下载权限。"); }
  }
  async function reloadCatalog() {
    setCatalogLoading(true); setCatalogError("");
    try {
      const response = await fetch("/api/catalog", { cache: "no-store" }); const data = await response.json() as CatalogPayload;
      if (!response.ok) throw new Error(data.error || "书库读取失败。");
      setCatalog(data.books); setSources(data.sources);
    } catch { setCatalogError("暂时无法读取增量书库，已收录的书目仍可使用。"); }
    finally { setCatalogLoading(false); }
  }
  async function updateCatalog() {
    setSyncing(true); setCatalogError("");
    try {
      const response = await fetch("/api/catalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force: true }) });
      const data = await response.json() as CatalogPayload;
      if (!response.ok) throw new Error(data.error || "更新失败。");
      setCatalog(data.books); setSources(data.sources); setMessage(data.syncing ? "已有更新正在进行，请稍后重新读取" : "书源检查完成，每个平台最多每小时检查一次");
    } catch (e) { setCatalogError(e instanceof Error ? e.message : "更新失败，已收录书目仍可使用。"); }
    finally { setSyncing(false); }
  }
  async function searchPlatform() {
    setSearching(true); setSearchNote(""); setError("");
    try {
      const response = await fetch("/api/catalog/search?q=" + encodeURIComponent(pickerQuery.trim()), { cache: "no-store" });
      const data = await response.json() as { books: Novel[]; error?: string };
      if (!response.ok) throw new Error(data.error || "平台搜索失败。");
      setCatalog(old => { const index = new Map(old.map(b => [catalogKey(b), b])); for (const book of data.books) if (!index.has(catalogKey(book))) index.set(catalogKey(book), book); return [...index.values()]; });
      setPickerSource("jjwxc"); setSearchNote(data.books.length ? "已加入 " + data.books.length + " 条晋江公开搜索结果。" : "未返回结果，可以手动添加；这不代表其他平台没有此书。");
    } catch (e) { setError(e instanceof Error ? e.message : "平台搜索失败。"); }
    finally { setSearching(false); }
  }

  function renderBookCard(item: Recommendation, shelf = false) {
    return <BookCard key={item.book.id} item={item} shelf={shelf} discover={section === "discover"}
      liked={hasFavorite(item.book)} disabled={saving || !ready || !!storageError}
      onOpen={openBook} onAdd={book => void addFavorite({ id: book.id })}
      onRemove={removeFavorite} onDismiss={book => feedback(book, "dismissed")}/>;
  }

  return <div className="reader-app">
    <div className="utility-bar"><div className="container"><span>拾页小说发现 · 公开书目推荐</span><div><span>书单保存在当前浏览器</span><button onClick={exportProfile}><Download size={12}/>导出书架</button></div></div></div>
    <header className="masthead container">
      <button className="brand" onClick={() => navigate("discover")} aria-label="拾页首页"><span className="brand-mark"><BookOpen size={27}/></span><span><strong>拾页</strong><small>阅读的下一站</small></span></button>
      <form className="global-search" onSubmit={event => { event.preventDefault(); setSection("catalog"); setPage(0); }}><input aria-label="搜索小说或作者" placeholder="搜索书名、作者，找到你喜欢的故事" value={search} onChange={event => { setSearch(event.target.value); setPage(0); setBatch(0); }}/><button aria-label="搜索" type="submit"><Search size={20}/></button></form>
      <button className="shelf-link" onClick={() => navigate("shelf")}><Library size={19}/>我的喜好书架<span>{favorites.length}</span></button>
    </header>
    <nav className="main-nav" aria-label="主导航"><div className="container"><span className="category-nav"><Library size={17}/>作品分类</span><button className={section === "discover" ? "active" : ""} onClick={() => navigate("discover")}>猜你喜欢</button><button className={section === "catalog" ? "active" : ""} onClick={() => navigate("catalog")}>全部作品</button><button className={section === "shelf" ? "active" : ""} onClick={() => navigate("shelf")}>我的书架</button><button onClick={() => setPrefsOpen(true)}>阅读偏好</button><button className="nav-source" onClick={() => setSourcesOpen(true)}>书源与覆盖<ArrowUpRight size={14}/></button></div></nav>
    <main className="container main-layout">
      <aside className="left-column">
        <section className="category-panel"><h2>作品分类</h2><div className="category-grid">{CATEGORIES.map(([name]) => <button key={name} className={category === name ? "selected" : ""} onClick={() => { setCategory(name); setPage(0); setBatch(0); if (section === "shelf") setSection("catalog"); }}><span>{name}</span><small>{catalog.filter(b => inCategory(b, name)).length}</small></button>)}</div></section>
        <section className="shelf-summary panel"><div className="section-title"><h2>我的阅读线索</h2><Heart size={16}/></div><strong className="shelf-count">{favorites.length}<small>本喜欢的小说</small></strong><p>每一本喜欢的书，都是下一次相遇的线索。</p><button className="red-button full" onClick={openAdd} disabled={!ready || !!storageError}><Plus size={15}/>添加喜欢的小说</button>{!favorites.length && <button className="plain-button full" onClick={() => { if (commit({ ...profileRef.current, favorites: [novels[0], novels[1], novels[2]].map(b => ({ ...b, createdAt: Date.now() })) })) setMessage("已添加 3 本示例喜好，可在书架中移除"); }} disabled={!ready || !!storageError}>用示例书单开始</button>}
        {favorites.slice(0, 4).map(book => <button className="shelf-mini" key={book.id} onClick={() => openBook(book)}><span>{book.title}</span><ChevronRight size={12}/></button>)}
        <button className="side-link" onClick={() => setPrefsOpen(true)}>管理偏好与反馈<ChevronRight size={12}/></button></section>
        <div className="side-note"><Compass size={20}/><p>读过与不感兴趣的书会从推荐中排除，随时可以恢复。</p></div>
      </aside>
      <div className="center-column">
        {storageError && <div className="error-banner" role="alert">{storageError}<button onClick={exportProfile}>导出原数据</button></div>}
        {error && !addOpen && !detail && !prefsOpen && <div className="error-banner" role="alert">{error}</div>}
        {section === "discover" && <>
          <section className="discovery-hero">
            <div className="hero-copy"><span className="hero-eyebrow">拾页 · 发现好故事</span><h1>下一本，<br/>向你的喜好靠近。</h1><p>{personalized ? "从喜欢的小说出发，也给意料之外的故事留一点位置。" : "选几本喜欢的小说，或告诉我们你想看的元素。"}</p><div className="hero-actions"><button className="red-button" onClick={personalized && feature ? () => openBook(feature.book) : openAdd}>{personalized && feature ? "看看本期推荐" : "开启我的推荐"}<ChevronRight size={15}/></button><button className="hero-secondary" onClick={() => setPrefsOpen(true)}>选择阅读偏好</button></div><div className="hero-stats"><span><strong>{catalog.length}</strong>本收录书目</span><span><strong>{sources.filter(s => s.count > 0).length}</strong>个平台来源</span></div></div>
            <div className="hero-books" aria-hidden="true"><div className="hero-orbit"/>{(feature ? [feature.book, picks[1]?.book || novels[1]] : [novels[0], novels[1]]).map((book, index) => <div className={"hero-book hero-book-" + index} key={book.id + index}><Jacket book={book}/></div>)}<span className="hero-caption">{feature?.book.title || "从一本喜欢的书开始"}</span></div>
          </section>
          <div className="catalog-strip"><span><Library size={14}/>{catalog.length} 本可浏览作品 · 公开书目部分覆盖</span><button onClick={() => setSourcesOpen(true)}>查看书源<ChevronRight size={13}/></button></div>
          <section className="recommendation-section">
            <div className="section-heading"><div><h2>{personalized ? "猜你喜欢" : "从这些故事开始"}</h2><p>{personalized ? "由你的喜好与主动偏好生成，探索候选会单独标注。" : "还没有偏好时展示书库精选，添加喜好后会重新排序。"}</p></div><button className="refresh-button" disabled={batches < 2} onClick={() => setBatch((currentBatch + 1) % batches)}><RefreshCw size={14}/>换一组</button></div>
            <div className="recommend-toolbar"><div className="mode-tabs" aria-label="推荐模式">{(["focused", "balanced", "explore"] as const).map(mode => <button key={mode} aria-pressed={profile.exploration === mode} className={profile.exploration === mode ? "active" : ""} disabled={!ready || !!storageError} onClick={() => commit({ ...profileRef.current, exploration: mode })}>{MODE_LABELS[mode]}</button>)}</div><span>{personalized ? "基于 " + favorites.length + " 本喜好 / " + profile.preferredTags.length + " 项主动偏好" : "先了解你的阅读兴趣"}</span></div>
            {picks.length ? <div className="books-grid">{picks.map(item => <div className="recommend-entry" key={item.book.id}><div className="entry-label"><span className={item.exploration ? "explore-label" : ""}>{item.exploration ? "探索发现" : item.level}</span><small>{item.channels.slice(0, 2).join(" · ")}</small></div>{renderBookCard(item)}</div>)}</div> : <div className="empty-state"><Library size={30}/><h3>当前条件下暂无候选作品</h3><p>可切换分类、放宽“不想看”的元素，或在全部作品中继续寻找。</p><button className="outline-button" onClick={() => navigate("catalog")}>浏览全部作品</button></div>}
            {!!picks.length && <div className="feed-footer"><span>第 {currentBatch + 1} / {batches} 组 · 已读与不感兴趣的作品已排除</span><button onClick={() => setInfoOpen(true)}>推荐依据<ChevronRight size={12}/></button></div>}
          </section>
        </>}
        {section !== "discover" && <section className="library-section"><div className="section-heading"><div><span className="section-kicker">{section === "shelf" ? "MY BOOKSHELF" : "EXPLORE STORIES"}</span><h1>{section === "shelf" ? "我的喜好书架" : "全部作品"}</h1><p>{section === "shelf" ? "保存真正喜欢的故事，让下一次推荐更合心意。" : "按分类与来源寻找故事，喜欢的作品可以加入书架。"}</p></div><button className="red-button" onClick={openAdd} disabled={!ready || !!storageError}><Plus size={15}/>添加小说</button></div><div className="library-filters"><span>{category} · {collection.length} 本</span><label>书目来源<select value={sourceFilter} onChange={e => { setSourceFilter(e.target.value); setPage(0); setBatch(0); }}><option value="all">全部来源</option>{platforms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}<option value="curated">本站整理</option></select></label></div>{collection.length ? <div className="books-grid library-grid">{collection.slice(currentPage * 18, currentPage * 18 + 18).map(book => renderBookCard(rankMap.get(book.id) || fallbackDetail(book), section === "shelf"))}</div> : <div className="empty-state"><BookOpen size={30}/><h3>{section === "shelf" && !favorites.length ? "你的喜好书架还是空的" : "没有找到匹配的小说"}</h3><p>试试其他书名、分类或来源，也可以手动添加喜欢的作品。</p><button className="outline-button" onClick={openAdd}>添加喜欢的小说</button></div>}<div className="pagination"><button aria-label="上一页" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={16}/></button><span>{currentPage + 1} / {pages}</span><button aria-label="下一页" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}><ChevronRight size={16}/></button></div></section>}
      </div>
      <aside className="right-column">
        <section className="panel recommendation-ranking"><div className="section-title"><h2>{personalized ? "你的推荐榜" : "书库精选"}</h2><span className="red-dot"/></div><p className="ranking-note">{personalized ? "按偏好匹配排序" : "已整理作品，非人气排行"}</p><ol>{visibleRanked.slice(0, 8).map((item, index) => <li key={item.book.id}><span className={"rank-number" + (index < 3 ? " top-rank" : "")}>{index + 1}</span><button onClick={() => openBook(item.book)}><strong>{item.book.title}</strong><small>{index === 0 ? item.book.author + " · " + item.level : item.book.genre}</small></button>{index === 0 && <Jacket book={item.book} small/>}</li>)}</ol>{!visibleRanked.length && <p className="muted">放宽偏好后可以继续发现作品。</p>}</section>
        <section className="panel preference-summary"><div className="section-title"><h2>你的阅读偏好</h2><SlidersHorizontal size={15}/></div><p>你想看的元素优先参与推荐。</p><div className="preference-chips">{profile.preferredTags.length ? profile.preferredTags.slice(0, 6).map(tag => <span key={tag}>{tag}</span>) : <span className="unselected">还没有选择</span>}</div><button className="outline-button full" onClick={() => setPrefsOpen(true)}>调整阅读偏好</button><div className="feedback-counts"><span><BookmarkCheck size={13}/>{profile.feedback.filter(f => f.kind === "read").length} 本已读</span><span><EyeOff size={13}/>{profile.feedback.filter(f => f.kind === "dismissed").length} 本已排除</span></div></section>
        <button className="about-card" onClick={() => setInfoOpen(true)}><Fingerprint size={23}/><span><strong>为什么推荐这本书？</strong><small>了解每一次推荐的阅读线索</small></span><ChevronRight size={15}/></button>
      </aside>
    </main>
    <footer className="container site-footer"><div><strong>拾页</strong><span>从喜欢的故事，找到下一本。</span></div><p>提供书目介绍与推荐 · 阅读请前往作品原站 · 公开书库部分覆盖</p></footer>
    {message && <div className="toast" role="status"><Check size={16}/>{message}</div>}

    <Dialog open={addOpen} onOpenChange={setAddOpen}><DialogContent className="reader-dialog add-dialog"><DialogTitle>添加喜欢的小说</DialogTitle><DialogDescription>选择读过且喜欢的作品，也可以手动补充书库外的小说。</DialogDescription><div className="dialog-tabs"><button className={addTab === "catalog" ? "active" : ""} onClick={() => setAddTab("catalog")}>从书库添加</button><button className={addTab === "custom" ? "active" : ""} onClick={() => setAddTab("custom")}>手动添加</button></div>{addTab === "catalog" ? <><div className="picker-search"><Search size={17}/><input aria-label="搜索已收录书目" placeholder="输入书名或作者" value={pickerQuery} onChange={e => setPickerQuery(e.target.value)}/></div><label className="picker-source">书目来源<select value={pickerSource} onChange={e => setPickerSource(e.target.value)}><option value="all">全部来源</option>{platforms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}<option value="curated">本站整理</option></select></label><div className="picker-list">{pickerBooks.slice(0, 60).map(book => <button key={book.id} disabled={hasFavorite(book) || saving || !ready || !!storageError} onClick={() => void addFavorite({ id: book.id })}><Jacket book={book} small/><span><strong>{book.title}</strong><small>{book.author} · {sourceName(book.platform)}</small></span>{hasFavorite(book) ? <Check size={17}/> : <Plus size={17}/>}</button>)}{!pickerBooks.length && <p className="picker-empty">没有匹配结果，可以试试平台公开搜索或手动添加。</p>}</div><p className="form-hint">共匹配 {pickerBooks.length} 本，最多展示 60 本，请输入书名缩小范围。</p><button className="plain-button" onClick={() => void searchPlatform()} disabled={pickerQuery.trim().length < 2 || searching}>{searching ? <LoaderCircle size={15} className="spinner"/> : <Search size={15}/>}搜索晋江公开书目</button>{searchNote && <p className="form-hint" role="status">{searchNote}</p>}</> : <form className="custom-form" onSubmit={e => { e.preventDefault(); void addFavorite({ title: customTitle, author: customAuthor, tags: customTags }); }}><label>小说名称<input required maxLength={80} value={customTitle} onChange={e => setCustomTitle(e.target.value)} placeholder="你最近读完的小说"/></label><label>作者<span>（选填）</span><input maxLength={50} value={customAuthor} onChange={e => setCustomAuthor(e.target.value)} placeholder="作者名"/></label><fieldset><legend>你喜欢它的哪些元素？</legend><p className="form-hint">选择 1–6 项，作为推荐的阅读线索。</p><div className="tag-picker">{TAGS.map(tag => <button type="button" key={tag} aria-pressed={customTags.includes(tag)} className={customTags.includes(tag) ? "selected" : ""} disabled={!customTags.includes(tag) && customTags.length >= 6} onClick={() => setCustomTags(old => old.includes(tag) ? old.filter(t => t !== tag) : [...old, tag])}>{tag}</button>)}</div></fieldset><button type="submit" className="red-button full" disabled={saving || !customTitle.trim() || !customTags.length || !ready || !!storageError}>{saving ? "正在保存…" : "保存并更新推荐"}</button></form>}{error && <div className="error-banner" role="alert">{error}</div>}</DialogContent></Dialog>

    <Dialog open={!!detail} onOpenChange={open => { if (!open) setDetail(null); }}><DialogContent className="reader-dialog detail-dialog">{detail && <><div className="detail-header"><Jacket book={detail.book}/><div><span className="section-kicker">{sourceName(detail.book.platform)} · {detail.book.genre}</span><DialogTitle>{detail.book.title}</DialogTitle><DialogDescription>{detail.book.author || "作者未填写"}</DialogDescription><div className="book-tags">{detail.book.tags.map(tag => <span key={tag}>{tag}</span>)}</div></div></div><p className="detail-description">{detail.book.description}</p><div className="reason-box"><Fingerprint size={18}/><div><strong>{detail.level === "书目详情" ? "关于这本书" : "推荐依据"}</strong><p>{detail.reason}</p>{!!detail.channels.length && <small>{detail.channels.join(" · ")}{detail.exploration ? " · 探索候选" : ""}</small>}</div></div><div className="provenance"><strong>书目信息来源：{sourceName(detail.book.platform)}</strong><p>{detail.book.metadataKind === "public" ? "信息来自平台公开页面。推荐元素由公开分类、原站标签映射；已有人工标签的作品保留人工整理结果。" : "简介与标签由本站整理，作品详情以原站为准。"}标签不代表全文分析。</p>{detail.book.syncedAt && <small>采集时间：{new Date(detail.book.syncedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</small>}{detail.book.sourceTags?.length ? <p>原站标签：{detail.book.sourceTags.join("、")}</p> : null}</div><div className="detail-actions"><button className="red-button" disabled={hasFavorite(detail.book) || saving || !ready || !!storageError} onClick={() => void addFavorite({ id: detail.book.id })}><Heart size={15}/>{hasFavorite(detail.book) ? "已在喜好书架" : "加入喜好书架"}</button>{detail.book.source && <a className="outline-button" href={detail.book.source} target="_blank" rel="noopener noreferrer">前往原站<ExternalLink size={14}/></a>}</div>{!hasFavorite(detail.book) && <div className="feedback-actions"><button onClick={() => feedback(detail.book, "read")} disabled={!ready || !!storageError}><BookmarkCheck size={15}/>我已经读过</button><button onClick={() => feedback(detail.book, "dismissed")} disabled={!ready || !!storageError}><EyeOff size={15}/>不感兴趣</button></div>}{error && <div className="error-banner" role="alert">{error}</div>}</>}</DialogContent></Dialog>

    <Dialog open={prefsOpen} onOpenChange={setPrefsOpen}><DialogContent className="reader-dialog preferences-dialog"><DialogTitle>我的阅读偏好</DialogTitle><DialogDescription>选择后立即更新推荐。主动偏好与不想看的元素不能同时选中。</DialogDescription><section className="preference-group"><h3>我想看</h3><p>这些元素会获得额外匹配权重。</p><div className="tag-picker">{TAGS.map(tag => <button key={tag} aria-pressed={profile.preferredTags.includes(tag)} className={profile.preferredTags.includes(tag) ? "selected" : ""} disabled={!ready || !!storageError} onClick={() => toggleTag(tag, "preferredTags")}>{tag}</button>)}</div></section><section className="preference-group"><h3>暂时不想看</h3><p>包含任意已选元素的小说会从推荐中排除，全部作品仍可浏览。</p><div className="tag-picker negative-tags">{TAGS.map(tag => <button key={tag} aria-pressed={profile.blockedTags.includes(tag)} className={profile.blockedTags.includes(tag) ? "selected" : ""} disabled={!ready || !!storageError} onClick={() => toggleTag(tag, "blockedTags")}>{tag}</button>)}</div></section><section className="preference-group"><h3>探索程度</h3><div className="mode-tabs">{(["focused", "balanced", "explore"] as const).map(mode => <button key={mode} aria-pressed={profile.exploration === mode} className={profile.exploration === mode ? "active" : ""} disabled={!ready || !!storageError} onClick={() => commit({ ...profileRef.current, exploration: mode })}>{MODE_LABELS[mode]}</button>)}</div><p>“更贴合”专注相似作品；“平衡推荐”每 6 个位置尝试 1 个探索候选；“多探索”每 3 个位置尝试 1 个。候选不足时保留匹配结果。</p></section><section className="preference-group"><h3>已读与不感兴趣 <small>{profile.feedback.length} 本</small></h3><p>最近 200 条反馈保存在当前浏览器。恢复后，这本书可以重新参与推荐。</p><div className="feedback-list">{profile.feedback.map(f => <div key={f.book.id}><span><strong>{f.book.title}</strong><small>{f.kind === "read" ? "已经读过" : "不感兴趣"}</small></span><button disabled={!ready || !!storageError} onClick={() => { if (commit({ ...profileRef.current, feedback: profileRef.current.feedback.filter(item => item.book.id !== f.book.id) })) setMessage("已恢复《" + f.book.title + "》"); }}>恢复推荐</button></div>)}{!profile.feedback.length && <p className="muted">还没有反馈记录。</p>}</div></section>{error && <div className="error-banner" role="alert">{error}</div>}</DialogContent></Dialog>

    <Dialog open={sourcesOpen} onOpenChange={setSourcesOpen}><DialogContent className="reader-dialog sources-dialog"><DialogTitle>书源与覆盖</DialogTitle><DialogDescription>{catalog.length} 本收录书目，公开页面部分覆盖。平台访问验证或页面变化会影响更新。</DialogDescription><div className="source-grid">{platforms.map(platform => { const state = sources.find(s => s.platform === platform.id); return <section className="source-card" key={platform.id}><div><h3>{platform.name}</h3><span className={state?.status === "ok" ? "status-ok" : "status-limited"}>{!state ? "待检查" : state.status === "ok" ? "部分收录" : state.status === "partial" ? "更新受限" : state.status === "blocked" ? "访问验证" : "暂时不可用"}</span></div><p>{platform.scope}</p><strong>{state?.count || 0} 条公开书目</strong>{state && <small>检查于 {new Date(state.checkedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</small>}{state && state.status !== "ok" && <p className="source-message">{state.message}</p>}<a href={platform.url} target="_blank" rel="noopener noreferrer">访问原站<ExternalLink size={12}/></a></section>; })}</div><p className="form-hint">手动检查间隔至少 1 小时；更新失败时保留已收录书目。采集时间不代表作品发布时间或当前上架状态。</p>{catalogError && <div className="error-banner" role="alert">{catalogError}</div>}<div className="detail-actions"><button className="red-button" disabled={syncing} onClick={() => void updateCatalog()}>{syncing && <LoaderCircle size={15} className="spinner"/>}{syncing ? "正在检查…" : "检查书源更新"}</button><button className="outline-button" disabled={catalogLoading} onClick={() => void reloadCatalog()}>重新读取书库</button></div></DialogContent></Dialog>

    <Dialog open={infoOpen} onOpenChange={setInfoOpen}><DialogContent className="reader-dialog"><DialogTitle>每一次推荐，都有阅读线索</DialogTitle><DialogDescription>相似作品、主动偏好与同作者匹配，结合反馈和探索程度生成推荐。</DialogDescription><ol className="mechanism-list"><li><strong>先找候选</strong><p>从已收录书库寻找标签相似、符合主动偏好、同作者或同分类的小说，同时保留探索候选。</p></li><li><strong>过滤与排序</strong><p>排除喜好书单、已读、不感兴趣和“不想看”的元素，再综合共同元素、整体偏好与同作者信号打分。</p></li><li><strong>让推荐更丰富</strong><p>降低连续出现相似标签与同一作者的倾向，按探索程度插入不同阅读方向；推荐榜仍按匹配分排序。</p></li></ol><div className="reason-box"><p>当前没有跨读者协同过滤、全文分析、阅读时长模型或真实人气榜单。匹配分不是喜欢概率，也不代表作品质量。书单与反馈保存在当前浏览器，可以导出备份。</p></div><button className="outline-button" onClick={exportProfile}><Download size={15}/>导出本地书单</button></DialogContent></Dialog>
  </div>;
}
