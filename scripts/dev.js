// Local server for dist/. Rebuilds on file changes and live-reloads open pages.
//   pnpm dev      → build + watch (add --drafts to preview draft posts)
//   pnpm preview  → serve the existing production build
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const WATCH = !process.argv.includes("--no-watch");
const PORT = Number(process.env.PORT ?? 4321);
const OUT = path.resolve("dist");
const WATCHED = ["content", "assets", "static", "lib", "scripts/build.js", "site.config.js"];
const TYPES = {
	".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript",
	".json": "application/json", ".xml": "application/xml", ".txt": "text/plain; charset=utf-8",
	".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml", ".webp": "image/webp",
	".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".wasm": "application/wasm",
};
const RELOAD_SNIPPET = `<script>new EventSource("/__reload").onmessage=()=>location.reload()</script>`;
const clients = new Set();

function build() {
	return new Promise((resolve) => {
		const child = spawn(process.execPath, ["scripts/build.js", "--dev", ...(process.argv.includes("--drafts") ? ["--drafts"] : [])], { stdio: "inherit" });
		child.on("exit", (code) => resolve(code === 0));
	});
}

function resolveFile(urlPath) {
	let file = path.join(OUT, decodeURIComponent(urlPath));
	if (!file.startsWith(OUT)) return null;
	if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
	return fs.existsSync(file) ? file : null;
}

const server = http.createServer((req, res) => {
	const { pathname } = new URL(req.url, "http://localhost");
	if (pathname === "/__reload") {
		res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
		clients.add(res);
		req.on("close", () => clients.delete(res));
		return;
	}
	// Mirror GitHub Pages: /foo → /foo/ when it's a directory.
	if (!pathname.endsWith("/") && !path.extname(pathname) && resolveFile(`${pathname}/`)) {
		res.writeHead(301, { Location: `${pathname}/` });
		return res.end();
	}
	const file = resolveFile(pathname);
	const status = file ? 200 : 404;
	const target = file ?? path.join(OUT, "404.html");
	const type = TYPES[path.extname(target)] ?? "application/octet-stream";
	let body;
	try {
		body = fs.readFileSync(target);
	} catch {
		// dist/ is being rebuilt; ask the browser to retry instead of crashing.
		res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "1" });
		return res.end("Rebuilding…");
	}
	if (WATCH && type.startsWith("text/html")) body = body.toString().replace("</body>", `${RELOAD_SNIPPET}</body>`);
	res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
	res.end(body);
});

if (WATCH) {
	await build();
	let timer;
	let running = false;
	let queued = false;
	const rebuild = async () => {
		if (running) return void (queued = true);
		running = true;
		const ok = await build();
		running = false;
		if (ok) for (const client of clients) client.write("data: reload\n\n");
		if (queued) {
			queued = false;
			rebuild();
		}
	};
	for (const target of WATCHED) {
		fs.watch(target, { recursive: true }, () => {
			clearTimeout(timer);
			timer = setTimeout(rebuild, 150);
		});
	}
} else if (!fs.existsSync(OUT)) {
	console.error("dist/ not found. Run `pnpm build` first.");
	process.exit(1);
}

server.listen(PORT, () => console.log(`→ http://localhost:${PORT}/${WATCH ? "  (watching for changes)" : ""}`));
