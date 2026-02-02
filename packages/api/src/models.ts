const API_VERSION = "2.18";
const DEFAULT_BASE_URL = "https://www.perplexity.ai";
const DEFAULT_USER_AGENT = "WindowsApp";

/** Model metadata returned by Perplexity. */
export interface ModelInfo {
	label: string;
	description: string;
	mode?: string;
}

/** Model configuration metadata used by the web app. */
export interface ModelConfig {
	label: string;
	description: string;
	subheading?: string | null;
	has_new_tag?: boolean;
	subscription_tier?: string;
	non_reasoning_model?: string | null;
	reasoning_model?: string | null;
	text_only_model?: boolean;
}

/** Response payload returned from the models config endpoint. */
export interface ModelsConfigResponse {
	config_schema: string;
	models: Record<string, ModelInfo>;
	config: ModelConfig[];
	default_models: Record<string, string>;
}

/** Options for fetching model configuration. */
export interface FetchModelsOptions {
	baseUrl?: string;
	apiVersion?: string;
	headers?: Record<string, string>;
	userAgent?: string;
}

const SECRET_MODELS: Record<string, ModelInfo> = {
	r1: {
		label: "R1 1776",
		description: "Perplexity's unbiased reasoning model",
		mode: "search",
	},
	pplx_reasoning: {
		label: "Reasoning",
		description: "Advanced problem solving",
		mode: "search",
	},
	pplx_gamma: {
		label: "Gamma",
		description: "Fast model for routine research",
		mode: "search",
	},
	copilot: {
		label: "Copilot",
		description: "Legacy Pro Search",
		mode: "search",
	},
	gpt4: {
		label: "GPT-4",
		description: "OpenAI's previous generation model",
		mode: "search",
	},
	o3mini: {
		label: "o3-mini",
		description: "OpenAI's reasoning model",
		mode: "search",
	},
	o3: {
		label: "o3",
		description: "OpenAI's reasoning model",
		mode: "search",
	},
	o3_research: {
		label: "o3",
		description: "OpenAI's reasoning model",
		mode: "research",
	},
	o3pro_research: {
		label: "o3-pro",
		description: "OpenAI's most powerful reasoning model",
		mode: "research",
	},
	o3_labs: {
		label: "o3",
		description: "OpenAI's reasoning model",
		mode: "studio",
	},
	o3pro_labs: {
		label: "o3-pro",
		description: "OpenAI's most powerful reasoning model",
		mode: "studio",
	},
	claude3opus: {
		label: "Claude 3 Opus",
		description: "Anthropic's previous generation model",
		mode: "search",
	},
	claude35haiku: {
		label: "Claude 3.5 Haiku",
		description: "Anthropic's smaller model",
		mode: "search",
	},
	claude_ombre_eap: {
		label: "Claude Ombre",
		description: "Anthropic's research preview",
		mode: "search",
	},
	claude_lace_eap: {
		label: "Claude Lace",
		description: "Anthropic's opus research preview",
		mode: "search",
	},
	claude40sonnet_research: {
		label: "Claude Sonnet 4.0",
		description: "Anthropic's advanced model",
		mode: "research",
	},
	claude40sonnetthinking_research: {
		label: "Claude Sonnet 4.0 Thinking",
		description: "Anthropic's reasoning model",
		mode: "research",
	},
	claude40opus_research: {
		label: "Claude Opus 4.0",
		description: "Anthropic's most advanced model",
		mode: "research",
	},
	claude40opusthinking_research: {
		label: "Claude Opus 4.0 Thinking",
		description: "Anthropic's advanced reasoning model",
		mode: "research",
	},
	claude40sonnetthinking_labs: {
		label: "Claude Sonnet 4.0 Thinking",
		description: "Anthropic's reasoning model",
		mode: "studio",
	},
	claude40opusthinking_labs: {
		label: "Claude Opus 4.0 Thinking",
		description: "Anthropic's advanced reasoning model",
		mode: "studio",
	},
	gemini: {
		label: "Gemini",
		description: "Previous version of Google's Gemini model",
		mode: "search",
	},
	gemini2flash: {
		label: "Gemini 2.5 Pro",
		description: "Google's latest model",
		mode: "search",
	},
	grok2: {
		label: "Grok-2",
		description: "xAI's latest model",
		mode: "search",
	},
	llama_x_large: {
		label: "Llama X Large",
		description: "Meta's large Llama model",
		mode: "search",
	},
	mistral: {
		label: "Mistral",
		description: "Mistral AI model",
		mode: "search",
	},
	testing_model_c: {
		label: "Testing Model C",
		description: "Debug model for testing",
		mode: "search",
	},
	comet_browser_agent: {
		label: "Control browser",
		description: "Performs actions in your browser",
		mode: "browser_agent",
	},
};

/**
 * Fetch the live model configuration from Perplexity.
 */
export async function fetchModelsConfig(
	cookies: string,
	options: FetchModelsOptions = {},
): Promise<ModelsConfigResponse> {
	const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
	const apiVersion = options.apiVersion ?? API_VERSION;
	const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;

	const response = await fetch(`${baseUrl}/rest/models/config`, {
		headers: {
			Cookie: cookies,
			"User-Agent": userAgent,
			"X-App-ApiClient": "default",
			"X-App-ApiVersion": apiVersion,
			...options.headers,
		},
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch models config: ${response.status}`);
	}

	return (await response.json()) as ModelsConfigResponse;
}

/** Merge Perplexity's hidden models into a config response. */
export function mergeWithSecretModels(apiModels: Record<string, ModelInfo>): Record<string, ModelInfo> {
	return { ...apiModels, ...SECRET_MODELS };
}

/** Return all models, including hidden and legacy options. */
export function getAllModels(config: ModelsConfigResponse): Record<string, ModelInfo> {
	return mergeWithSecretModels(config.models);
}

type ModelCategory = {
	name: string;
	prefixes: string[];
	models: Array<{ id: string; info: ModelInfo }>;
};

/** Group models into display categories. */
export function categorizeModels(models: Record<string, ModelInfo>): ModelCategory[] {
	const categories: ModelCategory[] = [
		{ name: "Perplexity", prefixes: ["pplx_", "experimental", "turbo", "copilot", "r1"], models: [] },
		{ name: "OpenAI", prefixes: ["gpt", "o3", "o4", "chatgpt"], models: [] },
		{ name: "Anthropic", prefixes: ["claude"], models: [] },
		{ name: "Google", prefixes: ["gemini"], models: [] },
		{ name: "xAI", prefixes: ["grok"], models: [] },
		{ name: "Kimi", prefixes: ["kimi"], models: [] },
		{ name: "Browser Agent", prefixes: ["comet_browser"], models: [] },
		{ name: "Other", prefixes: [], models: [] },
	];

	for (const [id, info] of Object.entries(models)) {
		let placed = false;
		for (const category of categories) {
			if (category.prefixes.some(prefix => id.startsWith(prefix) || id === prefix)) {
				category.models.push({ id, info });
				placed = true;
				break;
			}
		}
		if (!placed) {
			const other = categories.find(category => category.name === "Other");
			if (other) other.models.push({ id, info });
		}
	}

	for (const category of categories) {
		category.models.sort((a, b) => a.id.localeCompare(b.id));
	}

	return categories.filter(category => category.models.length > 0);
}

/** Render a CLI-friendly models list with categories. */
export function formatModelsHelp(models: Record<string, ModelInfo>): string {
	const categories = categorizeModels(models);
	const lines: string[] = [];

	const maxIdLen = Math.max(...Object.keys(models).map(id => id.length));
	const padWidth = Math.min(maxIdLen + 2, 32);

	for (const category of categories) {
		lines.push(`  ${category.name}:`);
		for (const { id, info } of category.models) {
			const padded = id.padEnd(padWidth);
			lines.push(`    ${padded}${info.label} - ${info.description}`);
		}
	}

	return lines.join("\n");
}

/** Check if a model identifier exists in a config set. */
export function isValidModel(model: string, models: Record<string, ModelInfo>): boolean {
	return model in models;
}
