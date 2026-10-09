const root = document.documentElement;

/* ── Dither field: one fixed canvas, light glowing behind the headline ── */
const field = (() => {
	const cv = document.getElementById("field");
	const ctx = cv.getContext("2d");
	const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
	let seed = 11;
	const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
	const G = 128;
	const grid = Float32Array.from({ length: G * G }, rnd);
	const sm = (t) => t * t * (3 - 2 * t);
	const vn = (x, y) => {
		const xf = x - Math.floor(x), yf = y - Math.floor(y);
		const xi = Math.floor(x) & (G - 1), yi = Math.floor(y) & (G - 1), xj = (xi + 1) & (G - 1), yj = (yi + 1) & (G - 1);
		const u = sm(xf), v = sm(yf), a = grid[yi * G + xi], b = grid[yi * G + xj], c = grid[yj * G + xi], d = grid[yj * G + xj];
		return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
	};
	const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
	const PALETTES = {
		dark: [[0, 0, 0], [8, 10, 26], [16, 24, 66], [36, 52, 150], [86, 106, 235], [190, 200, 255]],
		light: [[255, 255, 255], [240, 242, 255], [218, 224, 255], [176, 188, 255], [118, 134, 245], [70, 86, 220]],
	};
	const CELL = 3;
	// Long-form pages keep the glow faint so it never sits behind body text.
	const intensity = document.querySelector(".post") ? 0.45 : 1;
	const draw = (t) => {
		const w = Math.ceil(innerWidth / CELL), h = Math.ceil(innerHeight / CELL);
		if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
		const PAL = PALETTES[root.dataset.theme === "dark" ? "dark" : "light"];
		const img = ctx.createImageData(w, h), d = img.data, s = t * 0.035, ar = w / h;
		const k = Math.max(0, 1 - scrollY / (innerHeight * 0.9)) * intensity, cx = ar / 2, rx = Math.min(ar * 0.5, 0.8);
		for (let y = 0; y < h; y++) {
			const v = y / h, top = Math.min(1, v / 0.14);
			for (let x = 0; x < w; x++) {
				const u = x / h;
				const n = vn(u * 2.4 + s, v * 2.4 - s * 0.6) * 0.65 + vn(u * 6 - s, v * 6 + s) * 0.35;
				const leak = Math.exp(-(((u - cx) / rx) ** 2 + ((v - 0.34) / 0.44) ** 2)) * k;
				let f = n * 0.06 * k + leak * (0.3 + 0.36 * n) * (0.4 + 0.6 * top) - 0.02;
				f = Math.min(0.999, Math.max(0, f)) * (PAL.length - 1);
				const lo = Math.floor(f), c = PAL[f - lo > BAYER[(y & 3) * 4 + (x & 3)] ? lo + 1 : lo], i = (y * w + x) * 4;
				d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
			}
		}
		ctx.putImageData(img, 0, 0);
	};
	let last = 0;
	let faded = false; // glow fully faded out: one last frame is enough until we scroll back up
	const loop = (now) => {
		const far = scrollY >= innerHeight * 0.9;
		if (now - last > 110 && !(far && faded)) { last = now; draw(now / 1000); faded = far; }
		requestAnimationFrame(loop);
	};
	draw(0);
	if (!still) requestAnimationFrame(loop);
	else addEventListener("scroll", () => draw(0), { passive: true });
	return { redraw: () => draw(performance.now() / 1000) };
})();

/* ── Liquid glass lens: per-element displacement map so the backdrop bends near the rim ── */
const defs = document.getElementById("lens-defs");
const supportsLens = CSS.supports("backdrop-filter", "url(#x)") && !/^((?!chrome|android).)*safari/i.test(navigator.userAgent);
let lensId = 0;
function lensMap(w, h, r, band) {
	const c = document.createElement("canvas");
	c.width = w; c.height = h;
	const cx = c.getContext("2d"), img = cx.createImageData(w, h), d = img.data;
	const sdf = (x, y) => {
		const qx = Math.abs(x - w / 2) - (w / 2 - r), qy = Math.abs(y - h / 2) - (h / 2 - r);
		return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
	};
	for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
		const i = (y * w + x) * 4, inside = -sdf(x + 0.5, y + 0.5);
		let dx = 0, dy = 0;
		if (inside > 0 && inside < band) {
			const gx = sdf(x + 1.5, y + 0.5) - sdf(x - 0.5, y + 0.5), gy = sdf(x + 0.5, y + 1.5) - sdf(x + 0.5, y - 0.5);
			const len = Math.hypot(gx, gy) || 1, t = 1 - inside / band, m = t * t * t;
			dx = (-gx / len) * m; dy = (-gy / len) * m;
		}
		d[i] = 128 + dx * 127; d[i + 1] = 128 + dy * 127; d[i + 2] = 128; d[i + 3] = 255;
	}
	cx.putImageData(img, 0, 0);
	return c.toDataURL();
}
const CHANNEL = { r: "1 0 0 0 0 0 0 0 0 0 0 0 0 0 0", g: "0 0 0 0 0 0 1 0 0 0 0 0 0 0 0", b: "0 0 0 0 0 0 0 0 0 0 0 0 1 0 0" };
function applyLens(el) {
	if (!supportsLens) return;
	const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
	if (!w || !h) return;
	const r = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, h / 2, w / 2), scale = +el.dataset.lens || 20;
	const id = el.dataset.lensId || `lens${lensId++}`;
	el.dataset.lensId = id;
	const ch = (k, s) => `<feDisplacementMap in="SourceGraphic" in2="m" scale="${s}" xChannelSelector="R" yChannelSelector="G" result="d${k}"/><feColorMatrix in="d${k}" type="matrix" values="${CHANNEL[k]} 0 0 0 1 0" result="c${k}"/>`;
	let f = document.getElementById(id);
	if (!f) { f = document.createElementNS("http://www.w3.org/2000/svg", "filter"); f.id = id; defs.appendChild(f); }
	for (const [k, v] of Object.entries({ x: 0, y: 0, width: w, height: h, filterUnits: "userSpaceOnUse", primitiveUnits: "userSpaceOnUse", "color-interpolation-filters": "sRGB" })) f.setAttribute(k, v);
	f.innerHTML = `<feImage href="${lensMap(w, h, r, Math.min(h, w) * 0.42)}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="m"/>${ch("r", scale)}${ch("g", scale * 1.08)}${ch("b", scale * 1.16)}<feBlend in="cr" in2="cg" mode="screen" result="rg"/><feBlend in="rg" in2="cb" mode="screen" result="rgb"/><feGaussianBlur in="rgb" stdDeviation="0.5" result="s"/><feColorMatrix in="s" type="saturate" values="1.4"/>`;
	el.dataset.bf = `url(#${id})`;
	setBackdrop(el);
}
function setBackdrop(el) {
	if (!el.dataset.bf) return;
	el.style.backdropFilter = el.dataset.bf + (el.classList.contains("nav") && document.body.classList.contains("scrolled") ? " blur(14px) saturate(140%)" : "");
}
const relens = () => document.querySelectorAll("[data-lens]").forEach(applyLens);
relens();
addEventListener("resize", () => { clearTimeout(relens.t); relens.t = setTimeout(relens, 150); });

const onScroll = () => {
	const on = scrollY > innerHeight * 0.5;
	if (on !== document.body.classList.contains("scrolled")) {
		document.body.classList.toggle("scrolled", on);
		document.querySelectorAll(".nav").forEach(setBackdrop);
	}
};
addEventListener("scroll", onScroll, { passive: true });
onScroll();

document.addEventListener("pointermove", (ev) => {
	const g = ev.target.closest(".lg");
	if (!g) return;
	const r = g.getBoundingClientRect();
	g.style.setProperty("--mx", `${ev.clientX - r.left}px`);
	g.style.setProperty("--my", `${ev.clientY - r.top}px`);
});

/* ── Segmented controls with a liquid droplet ── */
function placeDrop(seg, el, animate) {
	const drop = seg.querySelector(".drop");
	if (!drop || !el) { if (drop) drop.style.width = "0"; return; }
	const from = { left: drop.offsetLeft, width: drop.offsetWidth };
	drop.style.left = `${el.offsetLeft}px`;
	drop.style.width = `${el.offsetWidth}px`;
	if (animate && from.width) {
		drop.animate([
			{ left: `${from.left}px`, width: `${from.width}px`, transform: "scale(1,1)" },
			{ transform: "scale(1.2,.88)", offset: 0.35 },
			{ transform: "scale(.97,1.04)", offset: 0.75 },
			{ left: `${el.offsetLeft}px`, width: `${el.offsetWidth}px`, transform: "scale(1,1)" },
		], { duration: 500, easing: "cubic-bezier(.3,1.2,.4,1)" });
	}
}
const segs = [...document.querySelectorAll("[data-seg]")];
const syncSegs = () => segs.forEach((seg) => placeDrop(seg, seg.querySelector(":scope > .on"), false));
document.fonts.ready.then(syncSegs);
syncSegs();
addEventListener("resize", syncSegs);

for (const seg of segs) {
	seg.addEventListener("click", (ev) => {
		const el = ev.target.closest("a, button");
		if (!el || el.parentElement !== seg) return;
		if (el.tagName === "A") {
			if (el.classList.contains("on")) return;
			ev.preventDefault();
			setTimeout(() => (location.href = el.href), 240);
		}
		if (seg.dataset.tabs !== undefined) {
			for (const list of document.querySelectorAll(".results")) list.hidden = list.dataset.g !== el.dataset.g;
		}
		if (!el.dataset.setLang) {
			seg.querySelectorAll(":scope > a, :scope > button").forEach((x) => x.classList.toggle("on", x === el));
			placeDrop(seg, el, true);
		}
	});
}

/* ── Theme ── */
document.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
	const next = root.dataset.theme === "dark" ? "light" : "dark";
	root.dataset.theme = next;
	try { localStorage.setItem("theme", next); } catch {}
	field.redraw();
});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (event) => {
	let stored = null;
	try { stored = localStorage.getItem("theme"); } catch {}
	if (!stored) { root.dataset.theme = event.matches ? "dark" : "light"; field.redraw(); }
});

/* ── Language ── */
const langSeg = document.querySelector("[data-set-lang]")?.parentElement;
function applyLanguage(lang, animate) {
	root.dataset.lang = lang;
	root.lang = lang;
	document.title = root.dataset[lang === "en" ? "titleEn" : "titleKo"] ?? document.title;
	for (const el of document.querySelectorAll("[data-i18n]")) {
		const name = el.dataset.i18n;
		el.setAttribute(name, el.getAttribute(`data-${lang}-${name}`));
	}
	if (langSeg) {
		const btn = langSeg.querySelector(`[data-set-lang="${lang}"]`);
		langSeg.querySelectorAll("[data-set-lang]").forEach((b) => b.classList.toggle("on", b === btn));
		placeDrop(langSeg, btn, animate);
	}
	syncSegs();
	requestAnimationFrame(relens);
}
applyLanguage(root.dataset.lang === "ko" ? "ko" : "en", false);
document.addEventListener("click", (event) => {
	const button = event.target.closest("[data-set-lang]");
	if (!button) return;
	const lang = button.dataset.setLang;
	if (lang === root.dataset.lang) return;
	applyLanguage(lang, true);
	try { localStorage.setItem("lang", lang); } catch {}
	if (dialog.open) runSearch(input.value);
});

/* ── Code copy ── */
document.addEventListener("click", async (event) => {
	const button = event.target.closest(".copy");
	if (!button) return;
	const code = button.closest(".code").querySelector("code");
	const text = [...code.querySelectorAll(".line")].map((line) => line.textContent).join("\n");
	try {
		await navigator.clipboard.writeText(text);
		button.classList.add("copied");
		clearTimeout(button._timer);
		button._timer = setTimeout(() => button.classList.remove("copied"), 1400);
	} catch {}
});

/* ── Long code blocks ── */
document.addEventListener("click", (event) => {
	const more = event.target.closest(".code-more");
	if (!more) return;
	const fig = more.closest(".code");
	const open = fig.classList.toggle("open");
	more.textContent = open ? "Show less" : `Show all ${more.dataset.lines} lines`;
	if (!open) fig.scrollIntoView({ block: "nearest" });
});

/* ── Reading progress & back to top (posts) ── */
const progress = document.querySelector(".progress");
const toTop = document.querySelector(".to-top");
if (progress) {
	let pending = false;
	const update = () => {
		pending = false;
		const max = document.documentElement.scrollHeight - innerHeight;
		progress.style.setProperty("--p", max > 0 ? Math.min(1, scrollY / max) : 0);
		toTop.classList.toggle("show", scrollY > innerHeight * 2);
	};
	addEventListener("scroll", () => { if (!pending) { pending = true; requestAnimationFrame(update); } }, { passive: true });
	update();
	toTop.addEventListener("click", () => scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
}

/* ── TOC scroll spy ── */
const allTocLinks = [...document.querySelectorAll(".toc-aside .toc a")];
if (allTocLinks.length) {
	let ticking = false;
	const update = () => {
		ticking = false;
		const tocLinks = allTocLinks.filter((a) => a.checkVisibility());
		const headings = tocLinks.map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1)))).filter(Boolean);
		let current = headings[0];
		for (const h of headings) {
			if (h.getBoundingClientRect().top - 120 <= 0) current = h;
			else break;
		}
		for (const a of tocLinks) a.classList.toggle("active", decodeURIComponent(a.hash.slice(1)) === current?.id);
	};
	addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
	document.addEventListener("click", (event) => event.target.closest("[data-set-lang]") && update());
	update();
}
document.querySelector(".toc-mobile")?.addEventListener("click", (event) => {
	if (event.target.closest("a")) event.currentTarget.open = false;
});

/* ── Search (Pagefind) ── */
const dialog = document.getElementById("search");
const input = dialog.querySelector("input");
const results = dialog.querySelector(".search-results");
const hint = results.innerHTML;
let pagefind;
let selected = -1;
let searchId = 0;

async function loadPagefind() {
	if (!pagefind) {
		pagefind = await import("/pagefind/pagefind.js");
		await pagefind.options({ excerptLength: 24 });
		pagefind.init();
	}
	return pagefind;
}
function openSearch() {
	if (dialog.open) return;
	dialog.showModal();
	input.select();
	loadPagefind();
	requestAnimationFrame(() => applyLens(dialog));
}
function setSelected(index) {
	const items = [...results.querySelectorAll(".search-result")];
	if (!items.length) return;
	selected = (index + items.length) % items.length;
	items.forEach((item, i) => item.setAttribute("aria-selected", String(i === selected)));
	items[selected].scrollIntoView({ block: "nearest" });
}
const escapeText = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

async function runSearch(query) {
	const id = ++searchId;
	if (!query.trim()) { results.innerHTML = hint; return; }
	const pf = await loadPagefind();
	const search = await pf.debouncedSearch(query, {}, 120);
	if (search === null || id !== searchId) return;
	const data = await Promise.all(search.results.slice(0, 12).map((r) => r.data()));
	if (id !== searchId) return;
	selected = -1;
	if (!data.length) {
		const message = `No results for “${escapeText(query)}”.`;
		results.innerHTML = `<p class="search-hint">${message}</p>`;
		return;
	}
	// Pagefind excerpts are pre-escaped HTML with <mark> highlights.
	results.innerHTML = data
		.map((d) => `<a class="search-result" role="option" href="${d.url}"><div class="search-result-title">${escapeText((root.dataset.lang === "en" && d.meta.title_en) || d.meta.title || d.url)}</div><div class="search-result-excerpt">${d.excerpt}</div></a>`)
		.join("");
	setSelected(0);
}

input.addEventListener("input", () => runSearch(input.value));
input.addEventListener("keydown", (event) => {
	if (event.key === "ArrowDown" || event.key === "ArrowUp") {
		event.preventDefault();
		setSelected(selected + (event.key === "ArrowDown" ? 1 : -1));
	} else if (event.key === "Escape") {
		// type=search swallows the first Escape to clear itself; close the dialog right away instead.
		event.preventDefault();
		dialog.close();
	} else if (event.key === "Enter") {
		const item = results.querySelectorAll(".search-result")[selected];
		if (item) { event.preventDefault(); location.href = item.href; }
	}
});
results.addEventListener("mousemove", (event) => {
	const item = event.target.closest(".search-result");
	if (item) setSelected([...results.querySelectorAll(".search-result")].indexOf(item));
});
dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
document.addEventListener("click", (event) => { if (event.target.closest("[data-search-open]")) openSearch(); });
document.addEventListener("keydown", (event) => {
	const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
	if ((event.key === "k" && (event.metaKey || event.ctrlKey)) || (event.key === "/" && !typing)) {
		event.preventDefault();
		openSearch();
	}
});
