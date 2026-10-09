export default {
	url: "https://0xaxii.github.io",
	title: "Axii",
	description: "Axii — notes on security research.",
	lang: "ko",
	author: "Axii",
	license: {
		name: "CC BY-NC-SA 4.0",
		url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
	},
	nav: [
		{ label: { ko: "소개", en: "About" }, href: "/" },
		{ label: { ko: "블로그", en: "Blog" }, href: "/blog/" },
	],
	// Blog categories, in display order. Empty ones are still listed.
	categories: ["BugBounty", "CTF/Wargame", "개발", "공모전/자격증", "논문/컨퍼런스", "블로그/기술문서"],
	// English names for Korean categories and tags.
	terms: {
		"개발": "Dev",
		"공모전/자격증": "Contests/Certs",
		"논문/컨퍼런스": "Papers/Talks",
		"블로그/기술문서": "Tech Notes",
		"논문리뷰": "Paper Review",
	},
	// Shiki themes used for code blocks in light / dark mode.
	codeThemes: { light: "github-light-default", dark: "github-dark-default" },
};
