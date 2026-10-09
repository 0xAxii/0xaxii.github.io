import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ICON_SETS = {
	lucide: require("@iconify-json/lucide/icons.json"),
	si: require("@iconify-json/simple-icons/icons.json"),
};
const CUSTOM_ICONS = {
	dreamhack: fs.readFileSync(new URL("../static/dreamhack.svg", import.meta.url), "utf8"),
};

export function escapeHtml(value) {
	return String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}
export const e = escapeHtml;

// Joins template parts, flattening arrays and dropping null/false values.
export function html(strings, ...values) {
	let out = strings[0];
	for (let i = 0; i < values.length; i++) out += join(values[i]) + strings[i + 1];
	return out;
}
function join(value) {
	if (Array.isArray(value)) return value.map(join).join("");
	return value === null || value === undefined || value === false ? "" : String(value);
}

// icon("lucide:sun"), icon("si:github"), icon("dreamhack")
export function icon(name, className = "icon") {
	if (CUSTOM_ICONS[name]) {
		return CUSTOM_ICONS[name].replace("<svg", `<svg class="${className}" aria-hidden="true"`).replace(/\s+/g, " ");
	}
	const [set, key] = name.split(":");
	const data = ICON_SETS[set]?.icons[key];
	if (!data) throw new Error(`Unknown icon: ${name}`);
	const size = ICON_SETS[set].width ?? 24;
	return `<svg class="${className}" viewBox="0 0 ${data.width ?? size} ${data.height ?? size}" aria-hidden="true">${data.body}</svg>`;
}

// Bilingual text. Both versions are emitted; CSS shows the one matching <html data-lang>.
// Values may be plain strings or { ko, en } objects.
export const ko = (v) => (v && typeof v === "object" ? v.ko : String(v ?? ""));
export const en = (v) => (v && typeof v === "object" ? (v.en ?? v.ko) : String(v ?? ""));
export function t(koValue, enValue) {
	const k = enValue === undefined ? ko(koValue) : koValue;
	const n = enValue === undefined ? en(koValue) : enValue;
	return k === n ? e(k) : `<span data-l="ko">${e(k)}</span><span data-l="en">${e(n)}</span>`;
}
// Same for markup that is already HTML.
export const tHtml = (koHtml, enHtml, tag = "span") =>
	koHtml === enHtml ? koHtml : `<${tag} data-l="ko">${koHtml}</${tag}><${tag} data-l="en">${enHtml}</${tag}>`;
// Bilingual attribute, swapped by main.js: attr("aria-label", "검색", "Search")
export const attr = (name, koValue, enValue) =>
	`${name}="${e(koValue)}" data-i18n="${name}" data-ko-${name}="${e(koValue)}" data-en-${name}="${e(enValue)}"`;

const pad = (n) => String(n).padStart(2, "0");
export const formatDate = (d) => `${d.getUTCFullYear()}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())}`;
export const formatShortDate = (d) => `${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())}`;
export const isoDate = (d) => d.toISOString().slice(0, 10);
