import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fetchModelsConfig, type ModelsConfigResponse } from "@pplx/api";

const CONFIG_DIR = join(homedir(), ".config", "pplx");
const MODELS_CACHE_FILE = join(CONFIG_DIR, "models.json");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CachedModels {
	fetched_at: number;
	data: ModelsConfigResponse;
}

const FALLBACK_CONFIG: ModelsConfigResponse = {
	config_schema: "v1",
	models: {},
	config: [],
	default_models: {},
};

function readCache(): CachedModels | null {
	try {
		if (existsSync(MODELS_CACHE_FILE)) {
			return JSON.parse(readFileSync(MODELS_CACHE_FILE, "utf-8")) as CachedModels;
		}
	} catch {}
	return null;
}

function writeCache(data: ModelsConfigResponse): void {
	try {
		mkdirSync(CONFIG_DIR, { recursive: true });
		writeFileSync(MODELS_CACHE_FILE, JSON.stringify({ fetched_at: Date.now(), data }, null, 2));
	} catch {}
}

/**
 * Load the models config from cache, refreshing when cookies are available.
 */
export async function getModelsConfig(cookies?: string | null): Promise<ModelsConfigResponse> {
	const cached = readCache();
	const now = Date.now();

	if (cached && now - cached.fetched_at < CACHE_TTL_MS) {
		return cached.data;
	}

	if (cookies) {
		try {
			const data = await fetchModelsConfig(cookies);
			writeCache(data);
			return data;
		} catch {
			if (cached) return cached.data;
		}
	}

	if (cached) return cached.data;

	return FALLBACK_CONFIG;
}
