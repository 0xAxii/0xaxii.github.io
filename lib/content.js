import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export const POSTS_DIR = path.resolve("content/posts");

const LANG_PANEL = /^:::section\{data-post-language-panel="(\w+)"\}\s*\n([\s\S]*?)\n:::\s*$/gm;

function walk(dir) {
	const out = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) out.push(...walk(full));
		else if (entry.name.endsWith(".md") && !entry.name.endsWith(".en.md")) out.push(full);
	}
	return out;
}

function toDate(value) {
	if (!value) return null;
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${value}`);
	return date;
}

// Splits `:::section{data-post-language-panel="xx"}` blocks into per-language bodies.
// Returns null when the post is single-language.
function splitLanguages(body) {
	const panels = {};
	for (const [, lang, text] of body.matchAll(LANG_PANEL)) panels[lang] = text;
	return Object.keys(panels).length ? panels : null;
}

export function loadPosts({ includeDrafts = false } = {}) {
	const posts = [];
	for (const file of walk(POSTS_DIR)) {
		const rel = path.relative(POSTS_DIR, file);
		const slug = (path.basename(rel) === "index.md" ? path.dirname(rel) : rel.replace(/\.md$/, ""))
			.split(path.sep)
			.join("/");
		const { data, content } = matter(fs.readFileSync(file, "utf8"));
		if (!data.title) throw new Error(`${rel}: missing title`);
		const published = toDate(data.published);
		if (!published) throw new Error(`${rel}: missing published date`);
		const draft = data.draft === true;
		if (draft && !includeDrafts) continue;

		// English version: a sibling `<name>.en.md` (title/description in its own frontmatter),
		// or `:::section{data-post-language-panel}` blocks inside the Korean file.
		const enFile = file.replace(/\.md$/, ".en.md");
		const en = fs.existsSync(enFile) ? matter(fs.readFileSync(enFile, "utf8")) : null;
		const languages = en ? { ko: content, en: en.content } : splitLanguages(content);

		posts.push({
			slug,
			file,
			dir: path.dirname(file),
			url: `/posts/${slug}/`,
			title: String(data.title),
			description: data.description ?? "",
			titleEn: en?.data.title ?? data.titleEn ?? String(data.title),
			descriptionEn: en?.data.description ?? data.descriptionEn ?? data.description ?? "",
			published,
			updated: toDate(data.updated),
			category: data.category ? String(data.category).trim() : "",
			tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
			draft,
			listed: data.listed !== false,
			body: content,
			languages,
		});
	}
	return posts.sort((a, b) => b.published - a.published || a.slug.localeCompare(b.slug));
}

export function slugifyTerm(term) {
	return term
		.toLowerCase()
		.replace(/[\s/]+/g, "-")
		.replace(/[^\p{L}\p{N}_-]/gu, "")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

export function groupBy(posts, keyFn) {
	const map = new Map();
	for (const post of posts) {
		for (const key of [keyFn(post)].flat()) {
			if (!key) continue;
			if (!map.has(key)) map.set(key, []);
			map.get(key).push(post);
		}
	}
	return [...map.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
}

// Korean is counted per character, everything else per word.
export function readingStats(text) {
	const stripped = text.replace(/```[\s\S]*?```/g, " ");
	const hangul = (stripped.match(/[ㄱ-힝]/g) ?? []).length;
	const words = (stripped.replace(/[ㄱ-힝]/g, " ").match(/[A-Za-z0-9_]+/g) ?? []).length;
	return { minutes: Math.max(1, Math.round(hangul / 500 + words / 220)) };
}
