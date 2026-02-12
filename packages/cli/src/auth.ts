import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";

const CONFIG_DIR = join(homedir(), ".config", "pplx");
const COOKIES_FILE = join(CONFIG_DIR, "cookies");
const PPLX_MACOS_BUNDLE_ID = "ai.perplexity.mac";
const API_VERSION = "2.18";
const APP_USER_AGENT = "Perplexity/641 CFNetwork/1568 Darwin/25.2.0";
const WS_URL = "wss://www.perplexity.ai/socket.io/?EIO=4&transport=websocket";
const CONNECT_TIMEOUT_MS = 10_000;
const RPC_TIMEOUT_MS = 30_000;

function shouldSkipDesktopToken(): boolean {
	return process.env.PPLX_AUTH_NO_BORROW === "1";
}
/** Load cookies from the environment or local config file. */
export function resolveCookies(): string | null {
	if (process.env.PPLX_COOKIES) {
		const cookies = normalizeCookies(process.env.PPLX_COOKIES);
		return cookies || null;
	}

	try {
		if (existsSync(COOKIES_FILE)) {
			const cookies = normalizeCookies(readFileSync(COOKIES_FILE, "utf-8"));
			return cookies || null;
		}
	} catch {
		return null;
	}

	if (!shouldSkipDesktopToken()) {
		const nativeToken = extractTokenFromUserDefaults();
		if (nativeToken) {
			return jwtToCookie(nativeToken);
		}
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

/**
 * Login to Perplexity.
 *
 * Tries native app token extraction first, then runs HTTP email OTP flow.
 */
export async function login(): Promise<string> {
	if (!shouldSkipDesktopToken()) {
		const nativeToken = extractTokenFromUserDefaults();
		if (nativeToken) {
			const cookies = jwtToCookie(nativeToken);
			storeCookies(cookies);
			console.log("✓ Logged in from macOS Perplexity app token");
			return cookies;
		}
	}

	const jwt = await loginWithEmailOtp();
	const cookies = jwtToCookie(jwt);
	storeCookies(cookies);
	console.log("✓ Logged in with Perplexity email OTP");
	return cookies;
}

/**
 * Refresh a Perplexity JWT via Socket.IO `refreshJWT` RPC.
 * Returns the current JWT if refresh fails.
 */
export async function refreshToken(currentJwt: string): Promise<string> {
	const socket = new PerplexitySocket({ jwt: currentJwt });
	try {
		await socket.ready();
		const response = await socket.emitWithAck<Record<string, unknown>>("refreshJWT", { jwt: currentJwt });
		const refreshed =
			typeof response?.perplexity_jwt === "string"
				? response.perplexity_jwt
				: typeof response?.jwt === "string"
					? response.jwt
					: undefined;
		if (!refreshed) {
			return currentJwt;
		}
		return refreshed;
	} catch {
		return currentJwt;
	} finally {
		socket.close();
	}
}
/** Clear stored cookies. */
export async function logout(): Promise<void> {
	clearCookies();
	console.log("✓ Logged out. Cookies cleared.");
}

/**
 * Read the auth token from the macOS Perplexity app's UserDefaults.
 *
 * The macOS app stores its session token in UserDefaults (not Keychain),
 * readable via `defaults read ai.perplexity.mac authToken`.
 */
function extractTokenFromUserDefaults(): string | null {
	if (process.platform !== "darwin") {
		return null;
	}

	try {
		const token = execSync(`defaults read ${PPLX_MACOS_BUNDLE_ID} authToken`, {
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
		if (!token || token === "(null)") {
			return null;
		}

		return token;
	} catch {
		return null;
	}
}

/** Request a one-time code over email and exchange it for a JWT. */
async function loginWithEmailOtp(): Promise<string> {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	try {
		const emailInput = await rl.question("Perplexity email: ");
		const email = emailInput.trim();
		if (!email) {
			throw new Error("Email is required for Perplexity login");
		}

		console.log("• Fetching CSRF token...");
		const csrfResponse = await fetch("https://www.perplexity.ai/api/auth/csrf", {
			headers: {
				"User-Agent": APP_USER_AGENT,
				"X-App-ApiVersion": API_VERSION,
			},
		});
		if (!csrfResponse.ok) {
			throw new Error(`Perplexity CSRF request failed: ${csrfResponse.status}`);
		}

		const csrfData = (await csrfResponse.json()) as { csrfToken?: string };
		if (!csrfData.csrfToken) {
			throw new Error("Perplexity CSRF response missing csrfToken");
		}

		console.log("• Sending login code...");
		const sendResponse = await fetch("https://www.perplexity.ai/api/auth/signin-email", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"User-Agent": APP_USER_AGENT,
				"X-App-ApiVersion": API_VERSION,
			},
			body: JSON.stringify({
				email,
				csrfToken: csrfData.csrfToken,
			}),
		});
		if (!sendResponse.ok) {
			const body = await sendResponse.text();
			throw new Error(`Perplexity send login code failed (${sendResponse.status}): ${body}`);
		}

		const otpInput = await rl.question("OTP code: ");
		const otp = otpInput.trim();
		if (!otp) {
			throw new Error("OTP code is required");
		}

		console.log("• Verifying code...");
		const verifyResponse = await fetch("https://www.perplexity.ai/api/auth/signin-otp", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"User-Agent": APP_USER_AGENT,
				"X-App-ApiVersion": API_VERSION,
			},
			body: JSON.stringify({
				email,
				otp,
				csrfToken: csrfData.csrfToken,
			}),
		});

		const verifyData = (await verifyResponse.json()) as {
			token?: string;
			status?: string;
			error_code?: string;
			text?: string;
		};
		if (!verifyResponse.ok) {
			const reason = verifyData.text ?? verifyData.error_code ?? verifyData.status ?? "OTP verification failed";
			throw new Error(`Perplexity OTP verification failed: ${reason}`);
		}
		if (!verifyData.token) {
			throw new Error("Perplexity OTP verification response missing token");
		}
		return verifyData.token;
	} finally {
		rl.close();
	}
}

function normalizeCookies(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) {
		return "";
	}
	if (trimmed.includes("next-auth.session-token=") || trimmed.includes("__Secure-next-auth.session-token=")) {
		return trimmed;
	}
	if (isLikelyJwt(trimmed)) {
		return jwtToCookie(trimmed);
	}
	return trimmed;
}

function jwtToCookie(jwt: string): string {
	return `__Secure-next-auth.session-token=${jwt}`;
}

function isLikelyJwt(value: string): boolean {
	const parts = value.split(".");
	if (parts.length !== 3) {
		return false;
	}
	return parts.every(part => part.length > 0);
}

/** Minimal Socket.IO v4 client over Engine.IO v4 WebSocket transport. */
class PerplexitySocket {
	#ws: WebSocket;
	#nextAckId = 0;
	#pendingAcks = new Map<
		number,
		{ resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }
	>();
	#ready: Promise<void>;

	constructor(auth?: Record<string, string>) {
		this.#ws = new WebSocket(WS_URL, {
			headers: {
				"User-Agent": "PerplexityApp",
				"X-App-ApiVersion": API_VERSION,
			},
		} as unknown as string[]);

		const { promise, resolve, reject } = Promise.withResolvers<void>();
		this.#ready = promise;

		const timeout = setTimeout(() => reject(new Error("Socket.IO connection timeout")), CONNECT_TIMEOUT_MS);
		let phase = 0;

		this.#ws.onmessage = event => {
			const data = String(event.data);
			if (data === "2") {
				this.#ws.send("3");
				return;
			}

			if (data.startsWith("0{") && phase === 0) {
				phase = 1;
				const payload = auth ? `40${JSON.stringify(auth)}` : "40";
				this.#ws.send(payload);
				return;
			}

			if (data.startsWith("40") && phase === 1) {
				clearTimeout(timeout);
				phase = 2;
				this.#installRpcHandler();
				resolve();
				return;
			}

			if (data.startsWith("44")) {
				clearTimeout(timeout);
				reject(new Error(`Socket.IO connect error: ${data.slice(2)}`));
			}
		};

		this.#ws.onerror = () => {
			clearTimeout(timeout);
			reject(new Error("WebSocket error"));
		};
		this.#ws.onclose = () => {
			clearTimeout(timeout);
			reject(new Error("WebSocket closed during handshake"));
		};
	}

	#installRpcHandler(): void {
		this.#ws.onmessage = event => {
			const data = String(event.data);
			if (data === "2") {
				this.#ws.send("3");
				return;
			}

			if (!data.startsWith("43")) {
				return;
			}

			const match = data.match(/^43(\d+)([\s\S]*)/);
			if (!match) {
				return;
			}

			const ackId = Number.parseInt(match[1], 10);
			const pending = this.#pendingAcks.get(ackId);
			if (!pending) {
				return;
			}

			this.#pendingAcks.delete(ackId);
			clearTimeout(pending.timer);

			let payload: unknown;
			try {
				payload = match[2] ? JSON.parse(match[2]) : undefined;
			} catch {
				pending.reject(new Error(`Malformed ACK payload for ack ${ackId}`));
				return;
			}

			const result = Array.isArray(payload) ? payload[0] : payload;
			if (result && typeof result === "object" && "error" in result) {
				const response = result as Record<string, unknown>;
				const message = (response.error_message ?? response.error_code ?? response.error ?? "RPC error") as string;
				pending.reject(new Error(message));
				return;
			}

			pending.resolve(result);
		};

		this.#ws.onclose = () => {
			for (const pending of this.#pendingAcks.values()) {
				clearTimeout(pending.timer);
				pending.reject(new Error("Socket closed"));
			}
			this.#pendingAcks.clear();
		};
	}

	ready(): Promise<void> {
		return this.#ready;
	}

	emitWithAck<T = unknown>(event: string, data: unknown, timeoutMs = RPC_TIMEOUT_MS): Promise<T> {
		const ackId = this.#nextAckId++;
		const { promise, resolve, reject } = Promise.withResolvers<T>();

		const timer = setTimeout(() => {
			this.#pendingAcks.delete(ackId);
			reject(new Error(`RPC timeout: ${event}`));
		}, timeoutMs);

		this.#pendingAcks.set(ackId, {
			resolve: resolve as (value: unknown) => void,
			reject,
			timer,
		});

		this.#ws.send(`42${ackId}${JSON.stringify([event, data])}`);
		return promise;
	}

	close(): void {
		for (const pending of this.#pendingAcks.values()) {
			clearTimeout(pending.timer);
			pending.reject(new Error("Socket closed"));
		}
		this.#pendingAcks.clear();
		try {
			this.#ws.close();
		} catch {}
	}
}
