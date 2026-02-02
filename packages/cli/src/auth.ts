import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CONFIG_DIR = join(homedir(), ".config", "pplx");
const COOKIES_FILE = join(CONFIG_DIR, "cookies");
const PERPLEXITY_APP_COOKIES = join(homedir(), ".config", "Perplexity", "Cookies");

/** Load cookies from the environment or local config file. */
export function resolveCookies(): string | null {
	if (process.env.PPLX_COOKIES) {
		const cookies = process.env.PPLX_COOKIES.trim();
		return cookies || null;
	}

	try {
		if (existsSync(COOKIES_FILE)) {
			const cookies = readFileSync(COOKIES_FILE, "utf-8").trim();
			return cookies || null;
		}
	} catch {
		return null;
	}

	return null;
}

/** Persist cookies to the local config store. */
export function storeCookies(cookies: string): void {
	mkdirSync(CONFIG_DIR, { recursive: true });
	writeFileSync(COOKIES_FILE, cookies, { mode: 0o600 });
}

/** Clear any stored cookies. */
export function clearCookies(): void {
	try {
		if (existsSync(COOKIES_FILE)) {
			writeFileSync(COOKIES_FILE, "");
		}
	} catch {}
}

function hasSqlite3(): boolean {
	try {
		execSync("sqlite3 --version", { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

function extractFromDesktopApp(): string | null {
	if (!existsSync(PERPLEXITY_APP_COOKIES)) {
		return null;
	}

	if (!hasSqlite3()) {
		throw new Error("sqlite3 is required to read Perplexity desktop cookies.");
	}

	const query = "SELECT name, value FROM cookies WHERE host_key LIKE '%perplexity%' AND value != ''";
	const result = execSync(`sqlite3 "${PERPLEXITY_APP_COOKIES}" "${query}"`, {
		encoding: "utf-8",
	});

	const cookies = result
		.trim()
		.split("\n")
		.filter(line => line.includes("|"))
		.map(line => {
			const [name, value] = line.split("|");
			return `${name}=${value}`;
		})
		.join("; ");

	if (cookies.includes("next-auth.session-token") || cookies.includes("__Secure-next-auth.session-token")) {
		return cookies;
	}

	return null;
}

/**
 * Extract cookies from the Perplexity desktop app and store them locally.
 */
export async function login(): Promise<string> {
	const appCookies = extractFromDesktopApp();
	if (appCookies) {
		storeCookies(appCookies);
		console.log("✓ Extracted cookies from the Perplexity desktop app");
		return appCookies;
	}

	if (!existsSync(PERPLEXITY_APP_COOKIES)) {
		throw new Error("Perplexity desktop app not found. Install it from https://www.perplexity.ai/download");
	}

	throw new Error("No valid session found. Please log in to the desktop app.");
}

/** Clear stored cookies. */
export async function logout(): Promise<void> {
	clearCookies();
	console.log("✓ Logged out. Cookies cleared.");
}
