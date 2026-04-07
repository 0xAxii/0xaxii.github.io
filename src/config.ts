import type {
	ExpressiveCodeConfig,
	LicenseConfig,
	NavBarConfig,
	ProfileConfig,
	SiteConfig,
} from "./types/config";
import { LinkPreset } from "./types/config";

export const siteConfig: SiteConfig = {
	title: "Axii's Blog",
	subtitle: "Security Research & Development",
	lang: "ko", // Korean
	themeColor: {
		hue: 175, // Teal green to match banner
		fixed: true,
	},
	banner: {
		enable: true,
		src: "assets/images/banner.png",
		position: "center",
		credit: {
			enable: false,
			text: "",
			url: "",
		},
	},
	toc: {
		enable: true,
		depth: 3,
	},
	favicon: [],
};

export const navBarConfig: NavBarConfig = {
	links: [
		LinkPreset.Home,
		LinkPreset.Archive,
		LinkPreset.About,
	],
};

export const profileConfig: ProfileConfig = {
	avatar: "assets/images/avatar.png",
	name: "Axii",
	bio: "Security Researcher",
	links: [
		{
			name: "GitHub",
			icon: "fa6-brands:github",
			url: "https://github.com/0xAxii",
		},
		{
			name: "Discord",
			icon: "fa6-brands:discord",
			url: "https://www.discord.com/users/495238318699839498",
		},
		{
			name: "X",
			icon: "fa6-brands:x-twitter",
			url: "https://x.com/axii7777",
		},
		{
			name: "Dreamhack",
			icon: "dreamhack",
			url: "https://dreamhack.io/users/77698",
		},
	],
};

export const licenseConfig: LicenseConfig = {
	enable: true,
	name: "CC BY-NC-SA 4.0",
	url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

export const expressiveCodeConfig: ExpressiveCodeConfig = {
	// Note: Some styles (such as background color) are being overridden, see the astro.config.mjs file.
	// Please select a dark theme, as this blog theme currently only supports dark background color
	theme: "github-dark",
};
