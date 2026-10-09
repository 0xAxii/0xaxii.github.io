import path from "node:path";
import MarkdownIt from "markdown-it";
import markdownItKatex from "@vscode/markdown-it-katex";
import GithubSlugger from "github-slugger";
import { createHighlighter } from "shiki";
import site from "../site.config.js";
import { escapeHtml, icon } from "./html.js";

const LANGS = ["solidity", "python", "bash", "c", "cpp", "javascript", "typescript", "html", "java", "sql", "xml", "json", "yaml", "rust", "go", "diff", "asm"];
const LANG_ALIASES = { plain: "text", plaintext: "text", txt: "text", "": "text", shell: "bash", sh: "bash", shellsession: "bash", console: "bash", js: "javascript", ts: "typescript" };
const NO_LINE_NUMBERS = new Set(["text", "bash"]);
const TERMINAL = new Set(["bash"]);
const COLLAPSE_AFTER = 30; // longer blocks start collapsed with a "show all" button

let highlighter;

export async function createRenderer() {
	highlighter ??= await createHighlighter({
		themes: Object.values(site.codeThemes),
		langs: LANGS,
	});
	const loaded = new Set(highlighter.getLoadedLanguages());

	const md = new MarkdownIt({ html: true, linkify: true, typographer: false });
	md.use(markdownItKatex.default ?? markdownItKatex, { throwOnError: false });

	// Code blocks: Shiki dual-theme output wrapped in a figure with a language label and copy button.
	md.renderer.rules.fence = (tokens, idx) => {
		const token = tokens[idx];
		const info = token.info.trim().split(/\s+/)[0].toLowerCase();
		const lang = LANG_ALIASES[info] ?? info;
		const code = token.content.replace(/\n$/, "");
		const highlightLang = loaded.has(lang) ? lang : "text";
		const html = highlighter.codeToHtml(code, {
			lang: highlightLang,
			themes: site.codeThemes,
			defaultColor: false,
		});
		const lines = code.split("\n").length;
		const numbered = !NO_LINE_NUMBERS.has(lang) && lines > 1;
		const terminal = TERMINAL.has(lang);
		const long = lines > COLLAPSE_AFTER;
		const classes = ["code", numbered && "numbered", terminal && "terminal", long && "long"].filter(Boolean).join(" ");
		const label = terminal ? `${icon("lucide:square-terminal")}<span>Terminal</span>` : `<span>${escapeHtml(lang)}</span>`;
		const more = long ? `<button type="button" class="code-more" data-lines="${lines}">Show all ${lines} lines</button>` : "";
		return `<figure class="${classes}"><figcaption>${label}<button type="button" class="copy" aria-label="Copy code">${icon("lucide:copy")}${icon("lucide:check")}</button></figcaption>${html}${more}</figure>\n`;
	};

	// Headings: GitHub-style ids, a hover anchor, and a TOC entry per heading.
	md.core.ruler.push("heading_ids", (state) => {
		const slugger = new GithubSlugger();
		const toc = (state.env.toc ??= []);
		const tokens = state.tokens;
		const first = tokens.findIndex((t) => t.type === "heading_open");
		if (first !== -1 && first < 3 && /^h[12]$/.test(tokens[first].tag) && state.env.title) {
			// A leading heading that only repeats the post title is redundant under the page header.
			const norm = (x) => x.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
			const text = norm(tokens[first + 1].content);
			if (text && norm(state.env.title).includes(text)) tokens.splice(first, 3);
		}
		for (let i = 0; i < tokens.length; i++) {
			if (tokens[i].type !== "heading_open") continue;
			const inline = tokens[i + 1];
			const text = inline.children.filter((t) => t.type === "text" || t.type === "code_inline").map((t) => t.content).join("");
			const id = (state.env.idPrefix ?? "") + slugger.slug(text);
			tokens[i].attrSet("id", id);
			toc.push({ depth: Number(tokens[i].tag.slice(1)), text, id });
		}
	});
	const headingClose = md.renderer.rules.heading_close ?? ((t, i, o, e, self) => self.renderToken(t, i, o));
	md.renderer.rules.heading_close = (tokens, idx, options, env, self) => {
		const id = tokens[idx - 2].attrGet("id");
		return `<a class="anchor" href="#${id}" aria-hidden="true" tabindex="-1">#</a>${headingClose(tokens, idx, options, env, self)}`;
	};

	// Images: resolve relative paths against the post directory and lazy-load.
	md.renderer.rules.image = (tokens, idx, options, env, self) => {
		const token = tokens[idx];
		const src = token.attrGet("src");
		if (src && env.baseUrl && !/^([a-z]+:|\/|#)/i.test(src)) {
			token.attrSet("src", path.posix.normalize(env.baseUrl + src));
		}
		token.attrSet("loading", "lazy");
		token.attrSet("decoding", "async");
		return self.renderToken(tokens, idx, options);
	};

	// External links open in a new tab.
	const linkOpen = md.renderer.rules.link_open ?? ((t, i, o, e, self) => self.renderToken(t, i, o));
	md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
		const href = tokens[idx].attrGet("href") ?? "";
		if (/^https?:\/\//.test(href) && !href.startsWith(site.url)) {
			tokens[idx].attrSet("target", "_blank");
			tokens[idx].attrSet("rel", "noopener noreferrer");
		}
		return linkOpen(tokens, idx, options, env, self);
	};

	// Tables scroll horizontally on narrow screens.
	md.renderer.rules.table_open = () => '<div class="table-wrap"><table>\n';
	md.renderer.rules.table_close = () => "</table></div>\n";

	return function render(source, { baseUrl, idPrefix, title } = {}) {
		const env = { baseUrl, idPrefix, title, toc: [] };
		const html = md.render(source, env);
		return { html, toc: normalizeToc(env.toc) };
	};
}

// Keep the top two heading levels present in the document.
function normalizeToc(toc) {
	if (!toc.length) return [];
	const levels = [...new Set(toc.map((h) => h.depth))].sort();
	const allowed = levels.slice(0, 2);
	return toc.filter((h) => allowed.includes(h.depth)).map((h) => ({ ...h, level: allowed.indexOf(h.depth) }));
}
