import site from "../site.config.js";
import { slugifyTerm } from "./content.js";
import { attr, e, en, formatDate, html, icon, isoDate, ko, t, tHtml } from "./html.js";

export const categoryUrl = (name) => `/categories/${slugifyTerm(name)}/`;
export const tagUrl = (name) => `/tags/${slugifyTerm(name)}/`;
const term = (name) => t(name, site.terms[name] ?? name);
// Site chrome and the About page stay English in both modes; only post content switches language.
const U = (a, b) => e(b === undefined ? en(a) : b);

/* ───────────────────────── Layout ───────────────────────── */

// Language and theme are global settings: chosen in the nav, saved in localStorage,
// and applied before first paint. Language defaults to English. Every page carries both languages.
const HEAD_SCRIPT = `(function(){var d=document.documentElement,s={};try{s.t=localStorage.getItem("theme");s.l=localStorage.getItem("lang")}catch(_){}d.dataset.theme=s.t==="dark"||s.t==="light"?s.t:matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";var l=s.l==="ko"?"ko":"en";d.dataset.lang=l;d.lang=l;if(l==="en"&&d.dataset.titleEn)document.title=d.dataset.titleEn})()`;

const LINK_ICONS = { dreamhack: "dreamhack" };
const linkIcon = (name) => icon(LINK_ICONS[name] ?? `si:${name}`);

export function layout({ title, titleEn = title, description = site.description, path, body, type = "website", head = "", math = false, published, profile }) {
	const suffix = ` · ${site.title}`;
	const fullTitle = title ? title + suffix : `${site.title} — Security Research`;
	const fullTitleEn = titleEn ? titleEn + suffix : fullTitle;
	const canonical = site.url + path;
	const section = path === "/" ? "/" : /^\/(blog|posts|tags|categories)\//.test(path) ? "/blog/" : "";
	const nav = site.nav.map((item) => html`<a href="${item.href}"${item.href === section ? ' class="on" aria-current="page"' : ""}>${U(item.label)}</a>`);

	return html`<!doctype html>
<html lang="en" data-title-ko="${e(fullTitle)}" data-title-en="${e(fullTitleEn)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(fullTitle)}</title>
<script>${HEAD_SCRIPT}</script>
<meta name="description" content="${e(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${e(title ?? site.title)}">
<meta property="og:description" content="${e(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${site.url}/og-image.png">
<meta property="og:site_name" content="${e(site.title)}">
${published ? html`<meta property="article:published_time" content="${published.toISOString()}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/favicon/favicon-light-32.png" sizes="32x32" media="(prefers-color-scheme: light)">
<link rel="icon" href="/favicon/favicon-dark-32.png" sizes="32x32" media="(prefers-color-scheme: dark)">
<link rel="apple-touch-icon" href="/favicon/favicon-light-180.png">
<link rel="alternate" type="application/rss+xml" title="${e(site.title)}" href="/rss.xml">
<link rel="stylesheet" href="/assets/fonts/pretendard/pretendardvariable-dynamic-subset.css">
<link rel="stylesheet" href="/assets/fonts/jetbrains-mono/index.css">
${math ? '<link rel="stylesheet" href="/assets/katex/katex.min.css">' : ""}
<link rel="stylesheet" href="/assets/style.css">
${head}
</head>
<body>
<canvas id="field" aria-hidden="true"></canvas><div class="veil"></div><div class="edge"></div>
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs id="lens-defs"></defs></svg>
<a class="skip-link" href="#main">${U("본문으로 건너뛰기", "Skip to content")}</a>
<nav class="nav lg" data-lens="20" ${attr("aria-label", "주 메뉴", "Main")}>
	<a class="me" href="/"><img src="/avatar.png" alt="" width="36" height="36"><span>${e(site.title)}</span></a>
	<div class="seg" data-seg><span class="drop"></span>${nav}</div>
	<span class="vr"></span>
	<button type="button" class="ib" data-search-open ${attr("aria-label", "검색", "Search")}>${icon("lucide:search")}</button>
	<div class="seg small" data-seg role="group" ${attr("aria-label", "언어", "Language")}><span class="drop"></span><button type="button" data-set-lang="en" lang="en">EN</button><button type="button" data-set-lang="ko" lang="ko">KR</button></div>
	<button type="button" class="ib" data-theme-toggle ${attr("aria-label", "테마 전환", "Toggle theme")}>${icon("lucide:sun", "icon icon-sun")}${icon("lucide:moon", "icon icon-moon")}</button>
</nav>
<main id="main" class="wrap">
${body}
<footer class="foot">
	<span>© ${new Date().getFullYear()} ${e(site.author)}</span>
	<span><a href="/rss.xml">RSS</a> · <a href="https://github.com/0xAxii/0xaxii.github.io" target="_blank" rel="noopener noreferrer">Source</a></span>
</footer>
</main>
<dialog class="search lg" id="search" data-lens="18" ${attr("aria-label", "검색", "Search")}>
	<div class="search-row">${icon("lucide:search")}<input type="search" ${attr("placeholder", "글 검색…", "Search posts…")} autocomplete="off" spellcheck="false" ${attr("aria-label", "검색어", "Search query")}><kbd>Esc</kbd></div>
	<div class="search-results" role="listbox" aria-live="polite"><p class="search-hint">${U("제목, 본문, 코드까지 검색합니다.", "Search titles, content and code.")}</p></div>
</dialog>
<script type="module" src="/assets/main.js"></script>
</body>
</html>
`;
}

/* ───────────────────────── Shared pieces ───────────────────────── */

const ORDINAL = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th"}`;
const RESULT_WORDS = { 장려상: "Honorable Mention", 우수상: "Excellence Award", 최우수상: "Grand Prize", 대상: "Grand Prize" };

// "3위 / 27팀" → { rank: 3, total: 27, players: false }
function parseResult(result) {
	const text = ko(result);
	const m = text.match(/^(\d+)\s*위(?:\s*\/\s*(\d+)\s*(팀|명))?/);
	if (!m) return { rank: null, total: null, players: false, label: typeof result === "object" ? result : { ko: text, en: RESULT_WORDS[text] ?? text } };
	return { rank: Number(m[1]), total: m[2] ? Number(m[2]) : null, players: m[3] === "명", label: null };
}

// "International CTF" → "International<span class="tab-rest"> CTF</span>"; the rest is hidden on narrow screens.
function tabLabel(title) {
	const [first, ...rest] = title.split(" ");
	return html`<span>${e(first)}${rest.length ? html`<span class="tab-rest"> ${e(rest.join(" "))}</span>` : ""}</span>`;
}

function rankBadge(rank) {
	const tier = rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : "";
	return html`<span class="rk ${tier}">${rank ? ORDINAL(rank) : "—"}</span>`;
}

// "2nd / 20 teams" — or the raw text when there is no rank (e.g. "Advanced to finals").
function resultText(r) {
	if (!r.rank) return t(r.label);
	if (!r.total) return ORDINAL(r.rank);
	return U(`${r.rank}위 / ${r.total}${r.players ? "명" : "팀"}`, `${ORDINAL(r.rank)} / ${r.total} ${r.players ? "players" : "teams"}`);
}
function fieldText(r) {
	if (!r.rank) return t(r.label);
	if (!r.total) return "";
	return U(`${r.total}${r.players ? "명" : "팀"}`, `${r.total} ${r.players ? "players" : "teams"}`);
}

function postCard(post, { lead = false } = {}) {
	return html`<a class="card${lead ? " lead" : ""}" href="${post.url}">
		${post.category ? html`<span class="k">${term(post.category)}</span>` : ""}
		<h2>${t(post.title, post.titleEn)}${post.draft ? ' <span class="badge">draft</span>' : ""}</h2>
		${post.description ? html`<p>${t(post.description, post.descriptionEn)}</p>` : ""}
		<time datetime="${isoDate(post.published)}">${formatDate(post.published)}</time>
	</a>`;
}

function chips(items, current) {
	return html`<div class="chips">${items.map(
		([name, count, url]) => html`<a class="chip lg press${name === current ? " on" : ""}${count ? "" : " empty"}" data-lens="6" href="${url}">${name === null ? U("전체", "All") : term(name)}<span>${count}</span></a>`,
	)}</div>`;
}

/* ───────────────────────── About (/) ───────────────────────── */

export function homePage({ profile }) {
	const withStages = (entry) => {
		const stages = (entry.stages ?? [{ result: entry.result }]).map((st) => ({ stage: st.stage, ...parseResult(st.result) }));
		return { ...entry, stages, ...stages[0] };
	};
	const groups = profile.competitions.map((g) => {
		const years = g.years.map((y) => ({ year: y.year, entries: y.entries.map(withStages) })).sort((a, b) => b.year - a.year);
		return { title: g.title, years, entries: years.flatMap((y) => y.entries) };
	});
	const ctf = groups.filter((g) => !en(g.title).startsWith("Other")).flatMap((g) => g.entries);
	const ctfStages = ctf.flatMap((x) => x.stages);
	const wins = ctfStages.filter((x) => x.rank === 1).length;

	const body = html`
<header class="hero">
	<p class="eyebrow">${U(profile.role)}</p>
	<h1 class="name">${e(ko(profile.name))}</h1>
	<p class="tag">${U(profile.intro)}</p>
	<div class="social">
		${profile.links.map((l) => html`<a class="soc lg press" data-lens="12" href="${e(l.url)}" target="_blank" rel="noopener noreferrer" title="${e(l.name)}" aria-label="${e(l.name)}">${linkIcon(l.icon)}</a>`)}
		${profile.email ? html`<a class="soc lg press" data-lens="12" href="mailto:${e(profile.email)}" title="Mail" aria-label="Mail">${icon("lucide:mail")}</a>` : ""}
	</div>
</header>

${profile.background.map(
	(g) => html`<section class="sec">
	<h2>${U(g.section)}.</h2>
	<ul class="tile affs">${g.items.map(
		(a) => html`<li><b>${a.url ? html`<a class="org-link" href="${e(a.url)}" target="_blank" rel="noopener noreferrer">${t(a.name)}${icon("lucide:arrow-up-right")}</a>` : t(a.name)}</b>${a.roles?.length ? html`<ol class="roles">${a.roles.map((r) => html`<li><span>${t(r.title)}</span><em>${e(r.period ?? "")}</em></li>`)}</ol>` : ""}</li>`,
	)}</ul>
</section>`,
)}

<section class="sec">
	<h2>${U("대회 기록.", "Competitions.")}</h2>
	<p class="sub">${U(`2026년 CTF ${ctf.length}개 대회, 우승 ${wins}회.`, `${wins} first places across ${ctf.length} CTFs in 2026.`)}</p>
	<div class="ctl lg" data-lens="14"><div class="seg" data-seg data-tabs><span class="drop"></span>${groups.map((g, i) => html`<button type="button" class="${i ? "" : "on"}" data-g="${i}">${tabLabel(en(g.title))}</button>`)}</div></div>
	<div class="tile">
		${groups.map(
			(g, i) => html`<div class="results" data-g="${i}"${i ? " hidden" : ""}>${g.years.map(
				(y) => html`<h3 class="yr">${y.year}</h3><ol>${y.entries.map(
				(r) => html`<li>
				${rankBadge(r.rank)}
				<span class="nm">${U(r.name)}${r.team || r.scope ? html`<small>${[r.scope && t(r.scope), r.team && t(r.team)].filter(Boolean).join(" · ")}</small>` : ""}</span>
				<span class="fld">${r.stages.length > 1 ? r.stages.map((st) => html`<span class="stg"><i>${U(st.stage)}</i>${resultText(st)}</span>`) : fieldText(r)}</span>
			</li>`,
				)}</ol>`,
			)}</div>`,
		)}
	</div>
</section>`;

	return layout({ path: "/", body, description: `${ko(profile.name)} — ${en(profile.role)}. ${en(profile.intro)}` });
}

/* ───────────────────────── Blog & taxonomies ───────────────────────── */

function listingPage({ eyebrow, title, tag, posts, chipItems, current, path, metaTitle, metaTitleEn, description }) {
	const body = html`
<header class="hero bhero">
	${eyebrow ? html`<p class="eyebrow">${eyebrow}</p>` : ""}
	<h1 class="name">${title}</h1>
	<p class="tag">${tag}</p>
	${chipItems ? chips(chipItems, current) : ""}
</header>
<section class="cards">${posts.map((p, i) => postCard(p, { lead: i === 0 }))}</section>`;
	return layout({ title: metaTitle, titleEn: metaTitleEn, path, body, description });
}

export function blogPage({ posts, categories }) {
	return listingPage({
		title: U("블로그", "Blog"),
		tag: U("Notes on security research."),
		posts,
		chipItems: [[null, posts.length, "/blog/"], ...categories.map(([n, l]) => [n, l.length, categoryUrl(n)])],
		current: null,
		path: "/blog/",
		metaTitle: "블로그",
		metaTitleEn: "Blog",
		description: "Notes on security research.",
	});
}

export function termPage({ kind, name, posts, path, siblings, total }) {
	const label = kind === "tag" ? { ko: "태그", en: "Tag" } : { ko: "카테고리", en: "Category" };
	return listingPage({
		eyebrow: U(label),
		title: html`${kind === "tag" ? "#" : ""}${term(name)}`,
		tag: U(`${posts.length}개의 글.`, `${posts.length} post${posts.length === 1 ? "" : "s"}.`),
		posts,
		chipItems: siblings ? [[null, total, "/blog/"], ...siblings] : null,
		current: name,
		path,
		metaTitle: `${label.ko}: ${name}`,
		metaTitleEn: `${label.en}: ${site.terms[name] ?? name}`,
		description: `${name} — ${posts.length} posts`,
	});
}

/* ───────────────────────── Post ───────────────────────── */

function tocBlock(toc) {
	return html`<nav class="toc"><p class="toc-title">${U("목차", "On this page")}</p><ol>${toc.map(
		(h) => html`<li class="toc-l${h.level}"><a href="#${e(h.id)}">${e(h.text)}</a></li>`,
	)}</ol></nav>`;
}
// Renders `fn(version)` once per language, or once when the post is Korean-only.
const perLang = (versions, fn, tag = "div") => (versions.en ? tHtml(fn(versions.ko), fn(versions.en), tag) : fn(versions.ko));

function navCard(post, dir) {
	if (!post) return "<span></span>";
	return html`<a class="nav-card nav-${dir}" href="${post.url}">
		<span class="nav-dir">${dir === "prev" ? html`${icon("lucide:arrow-left")}${U("이전 글", "Previous")}` : html`${U("다음 글", "Next")}${icon("lucide:arrow-right")}`}</span>
		<span class="nav-title">${t(post.title, post.titleEn)}</span>
	</a>`;
}

export function postPage({ post, rendered, path, prev, next, parent, position }) {
	const hasToc = Object.values(rendered).some((r) => r.toc.length >= 2);
	const tocFor = (r) => (r.toc.length >= 2 ? tocBlock(r.toc) : "");

	const body = html`
<div class="progress" aria-hidden="true"><span></span></div>
<button type="button" class="to-top lg press" data-lens="10" aria-label="Back to top">${icon("lucide:arrow-up")}</button>
<div class="post-layout${hasToc ? " has-toc" : ""}">
	<article class="post" data-pagefind-body>
		<header class="post-head">
			<a class="back" href="${parent ? parent.url : "/blog/"}">${icon("lucide:chevron-left")}${parent ? t(parent.title, parent.titleEn) : U("블로그", "Blog")}</a>
			${post.category ? html`<a class="eyebrow" href="${categoryUrl(post.category)}">${term(post.category)}</a>` : ""}
			<h1>${t(post.title, post.titleEn)}</h1>
			<span hidden data-pagefind-meta="title">${e(post.title)}</span><span hidden data-pagefind-meta="title_en">${e(post.titleEn)}</span>
			${post.description ? html`<p class="post-desc">${t(post.description, post.descriptionEn)}</p>` : ""}
			<div class="post-meta">
				${position ? html`<span class="part">Part ${position[0]} of ${position[1]}</span>` : ""}
				<time datetime="${isoDate(post.published)}">${formatDate(post.published)}</time>
				${post.updated ? html`<span>${U("수정", "Updated")} ${formatDate(post.updated)}</span>` : ""}
				<span>${perLang(rendered, (r) => `${r.minutes} min read`, "span")}</span>
			</div>
			${post.tags.length ? html`<div class="tags">${post.tags.map((tag) => html`<a href="${tagUrl(tag)}">#${term(tag)}</a>`)}</div>` : ""}
		</header>
		${hasToc ? html`<details class="toc-mobile tile"><summary>${icon("lucide:list")}${U("목차", "Contents")}</summary>${perLang(rendered, tocFor)}</details>` : ""}
		${perLang(rendered, (r) => `<div class="prose">\n${r.html}\n</div>`)}
		<footer class="post-foot">
			<p class="license">© ${e(site.author)} · <a href="${site.license.url}" target="_blank" rel="noopener noreferrer">${site.license.name}</a></p>
			${prev || next ? html`<nav class="post-nav" aria-label="More posts">${navCard(prev, "prev")}${navCard(next, "next")}</nav>` : ""}
		</footer>
	</article>
	${hasToc ? html`<aside class="toc-aside"><div class="lg toc-glass" data-lens="16">${perLang(rendered, tocFor)}</div></aside>` : ""}
</div>`;

	const jsonLd = {
		"@context": "https://schema.org",
		"@type": "BlogPosting",
		headline: post.title,
		description: post.description || post.title,
		datePublished: isoDate(post.published),
		...(post.updated && { dateModified: isoDate(post.updated) }),
		keywords: post.tags,
		inLanguage: rendered.en ? ["ko", "en"] : "ko",
		author: { "@type": "Person", name: site.author, url: site.url },
	};

	return layout({
		title: post.title,
		titleEn: post.titleEn,
		description: post.description || post.title,
		path,
		body,
		type: "article",
		published: post.published,
		math: Object.values(rendered).some((r) => r.html.includes('class="katex')),
		head: `<script type="application/ld+json">${JSON.stringify(jsonLd).replaceAll("<", "\\u003c")}</script>`,
	});
}

/* ───────────────────────── Misc ───────────────────────── */

export function notFoundPage() {
	const body = html`
<header class="hero bhero">
	<p class="eyebrow">404</p>
	<h1 class="name">${U("페이지를 찾을 수 없습니다.", "Page not found.")}</h1>
	<p class="tag">${U("주소가 바뀌었거나 삭제된 페이지입니다.", "The page may have moved or been removed.")}</p>
	<div class="chips"><a class="chip lg press" data-lens="10" href="/">${U("홈으로", "Home")}</a><button type="button" class="chip lg press" data-lens="10" data-search-open>${U("검색", "Search")}</button></div>
</header>`;
	return layout({ title: "404", path: "/404.html", body });
}

export function redirectPage(to, script = "") {
	return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>Redirecting…</title><link rel="canonical" href="${site.url}${to}"><meta name="robots" content="noindex">${script ? `<script>${script}</script>` : ""}<meta http-equiv="refresh" content="0; url=${to}"></head><body><a href="${to}">${to}</a></body></html>`;
}
