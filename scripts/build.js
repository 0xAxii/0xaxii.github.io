import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import matter from "gray-matter";
import * as pagefind from "pagefind";
import site from "../site.config.js";
import { POSTS_DIR, groupBy, loadPosts, readingStats } from "../lib/content.js";
import { e, isoDate } from "../lib/html.js";
import { createRenderer } from "../lib/markdown.js";
import { blogPage, categoryUrl, homePage, notFoundPage, postPage, redirectPage, tagUrl, termPage } from "../lib/templates.js";

const require = createRequire(import.meta.url);
const DEV = process.argv.includes("--dev");
const DRAFTS = process.argv.includes("--drafts"); // preview draft posts locally
const OUT = path.resolve("dist");
const started = performance.now();

function write(urlPath, content) {
	const file = path.join(OUT, urlPath.endsWith("/") ? `${urlPath}index.html` : urlPath);
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, content);
}
const copy = (from, to) => fs.cpSync(from, path.join(OUT, to), { recursive: true });
const pkgDir = (name) => path.dirname(require.resolve(`${name}/package.json`));

/* ── Static files & vendored assets ── */
fs.rmSync(OUT, { recursive: true, force: true });
copy("static", "/");
copy("assets", "assets");
copy(path.join(pkgDir("pretendard"), "dist/web/variable/pretendardvariable-dynamic-subset.css"), "assets/fonts/pretendard/pretendardvariable-dynamic-subset.css");
copy(path.join(pkgDir("pretendard"), "dist/web/variable/woff2-dynamic-subset"), "assets/fonts/pretendard/woff2-dynamic-subset");
for (const f of ["index.css", "files"]) copy(path.join(pkgDir("@fontsource-variable/jetbrains-mono"), f), `assets/fonts/jetbrains-mono/${f}`);
for (const f of ["katex.min.css", "fonts"]) copy(path.join(pkgDir("katex"), "dist", f), `assets/katex/${f}`);

/* ── Content ── */
const profile = matter(`---\n${fs.readFileSync("content/profile.yml", "utf8")}\n---`).data;
const posts = loadPosts({ includeDrafts: DRAFTS });
const listed = posts.filter((p) => p.listed);
const render = await createRenderer();

for (const post of posts) {
	const baseUrl = post.url;
	post.rendered = {};
	for (const [lang, source] of Object.entries(post.languages ?? { ko: post.body })) {
		// Both languages share one page, so English heading ids get a prefix.
		post.rendered[lang] = { ...render(source, { baseUrl, idPrefix: lang === "en" ? "en-" : "", title: lang === "en" ? post.titleEn : post.title }), ...readingStats(source) };
	}
}
// Co-located images and files, including asset-only subfolders.
// Draft posts are skipped in production, and so are their folders.
const draftDirs = DRAFTS ? [] : loadPosts({ includeDrafts: true }).filter((p) => p.draft).map((p) => p.dir + path.sep);
fs.cpSync(POSTS_DIR, path.join(OUT, "posts"), {
	recursive: true,
	filter: (src) => !src.endsWith(".md") && !draftDirs.some((d) => (src + path.sep).startsWith(d)),
});

// Unlisted posts belong to the listed post that links to them (e.g. a writeup index),
// and get prev/next navigation in the order they are linked.
const bySlug = new Map(posts.map((p) => [p.slug, p]));
const series = new Map();
for (const parent of listed) {
	const html = parent.rendered.ko.html;
	const children = [...html.matchAll(/href="\/posts\/([^"#?]+?)\/?(?:#[^"]*)?"/g)]
		.map((m) => bySlug.get(m[1]) ?? bySlug.get(m[1].replace(/\/(kr|en)$/, "")))
		.filter((p, i, arr) => p && !p.listed && p !== parent && arr.indexOf(p) === i && !series.has(p.slug));
	children.forEach((child, i) => series.set(child.slug, { parent, prev: children[i - 1], next: children[i + 1], position: [i + 1, children.length] }));
}

for (const post of posts) {
	let nav;
	if (post.listed) {
		const i = listed.indexOf(post);
		nav = { prev: listed[i + 1], next: listed[i - 1] };
	} else {
		nav = series.get(post.slug) ?? {};
	}
	write(post.url, postPage({ post, rendered: post.rendered, path: post.url, ...nav }));
	// Legacy per-language URLs from the previous blog: switch the language, then redirect.
	if (post.languages) {
		for (const [suffix, lang] of [["kr", "ko"], ["en", "en"]]) {
			write(`${post.url}${suffix}/`, redirectPage(post.url, `try{localStorage.setItem("lang","${lang}")}catch(_){}`));
		}
	}
}

/* ── Index pages ── */
const usedCategories = groupBy(listed, (p) => p.category);
const categories = [
	...site.categories.map((name) => [name, listed.filter((p) => p.category === name)]),
	...usedCategories.filter(([name]) => !site.categories.includes(name)),
];
const tags = groupBy(listed, (p) => p.tags);
write("/", homePage({ profile, posts: listed, allPosts: posts }));
write("/blog/", blogPage({ posts: listed, categories, tags }));
for (const [name, list] of categories) {
	write(categoryUrl(name), termPage({ kind: "category", name, posts: list, path: categoryUrl(name), siblings: categories.map(([n, l]) => [n, l.length, categoryUrl(n)]), total: listed.length }));
}
for (const [name, list] of tags) {
	write(tagUrl(name), termPage({ kind: "tag", name, posts: list, path: tagUrl(name) }));
}
write("/404.html", notFoundPage());

// Old routes from the Fuwari theme
const categoryMap = Object.fromEntries(categories.map(([n]) => [n, categoryUrl(n)]));
const tagMap = Object.fromEntries(tags.map(([n]) => [n, tagUrl(n)]));
write("/archive/", redirectPage("/blog/", `var q=new URLSearchParams(location.search),c=${JSON.stringify(categoryMap)},t=${JSON.stringify(tagMap)},u=c[q.get("category")]||t[q.get("tag")];if(u)location.replace(u)`));
write("/about/", redirectPage("/"));

/* ── Feeds ── */
const rssItems = listed.slice(0, 30).map(
	(p) => `<item><title>${e(p.title)}</title><link>${site.url}${p.url}</link><guid>${site.url}${p.url}</guid><pubDate>${p.published.toUTCString()}</pubDate><description>${e(p.description)}</description>${p.category ? `<category>${e(p.category)}</category>` : ""}</item>`,
);
write("/rss.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${e(site.title)}</title><link>${site.url}/</link><description>${e(site.description)}</description><language>${site.lang}</language><atom:link href="${site.url}/rss.xml" rel="self" type="application/rss+xml"/>${rssItems.join("")}</channel></rss>\n`);

const sitemapUrls = [
	["/", null],
	["/blog/", null],
	...posts.map((p) => [p.url, p.updated ?? p.published]),
	...categories.map(([n]) => [categoryUrl(n), null]),
	...tags.map(([n]) => [tagUrl(n), null]),
];
write("/sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapUrls.map(([u, d]) => `<url><loc>${site.url}${u}</loc>${d ? `<lastmod>${isoDate(d)}</lastmod>` : ""}</url>`).join("")}</urlset>\n`);
write("/robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`);

/* ── Search index ── */
const { index } = await pagefind.createIndex();
await index.addDirectory({ path: OUT });
await index.writeFiles({ outputPath: path.join(OUT, "pagefind") });
await pagefind.close();

console.log(`Built ${posts.length} posts (${listed.length} listed) in ${Math.round(performance.now() - started)}ms${DEV ? " [dev]" : ""}${DRAFTS ? " [drafts]" : ""}`);
