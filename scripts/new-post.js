// pnpm new-post <slug> ["Title"]
import fs from "node:fs";
import path from "node:path";

const [slug, title = slug] = process.argv.slice(2);
if (!slug || !/^[a-z0-9][a-z0-9/-]*$/.test(slug)) {
	console.error('Usage: pnpm new-post <slug> ["Title"]   (slug: lowercase, digits, -)');
	process.exit(1);
}
const file = path.join("content/posts", slug, "index.md");
if (fs.existsSync(file)) {
	console.error(`Already exists: ${file}`);
	process.exit(1);
}
const today = new Date().toLocaleDateString("sv-SE");
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(
	file,
	`---
title: ${JSON.stringify(title)}
published: ${today}
description: ""
category: ""
tags: []
draft: true
---

`,
);
console.log(`Created ${file}`);
