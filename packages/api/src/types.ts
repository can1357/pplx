/**
 * Public types and request/response shapes for the Perplexity SDK.
 */
/** Stream lifecycle status emitted by the API. */
export type StreamStatus = "PENDING" | "RESUMING" | "COMPLETED" | "FAILED" | "BLOCKED";

/** Where Perplexity should search for sources. */
export type SearchFocus = "internet" | "writing" | "academic" | "youtube" | "reddit";

/** Output mode used by Perplexity. */
export type Mode = "copilot" | "concise";

/** Recency filter for sources. */
export type RecencyFilter = "day" | "week" | "month" | "year";

/** Internal Perplexity search mode values surfaced in metadata. */
export type SearchMode = "search" | "research" | "agentic_research" | "studio" | "study" | "browser_agent" | "asi";

/** Known model identifiers surfaced by Perplexity. */
export type KnownModelId =
	| "turbo"
	| "default"
	| "pplx_pro"
	| "pplx_pro_upgraded"
	| "experimental"
	| "pplx_reasoning"
	| "pplx_alpha"
	| "pplx_beta"
	| "pplx_study"
	| "pplx_agentic_research"
	| "pplx_asi"
	| "pplx_gamma"
	| "pplx_sonar_internal_testing"
	| "pplx_sonar_internal_testing_v2"
	| "r1"
	| "copilot"
	| "gpt4"
	| "gpt4o"
	| "gpt41"
	| "gpt5"
	| "gpt5_thinking"
	| "gpt5_pro"
	| "gpt5_mini"
	| "gpt5_nano"
	| "gpt51"
	| "gpt51_thinking"
	| "gpt51_low_thinking"
	| "gpt52"
	| "gpt52_thinking"
	| "gpt52_pro"
	| "chatgpt_tools"
	| "o3mini"
	| "o3"
	| "o3pro"
	| "o3pro_research"
	| "o3pro_labs"
	| "o3_research"
	| "o3_labs"
	| "o4mini"
	| "claude2"
	| "claude3opus"
	| "claude35haiku"
	| "claude37sonnetthinking"
	| "claude40opus"
	| "claude41opus"
	| "claude45opus"
	| "claude40opusthinking"
	| "claude41opusthinking"
	| "claude45opusthinking"
	| "claude45sonnet"
	| "claude45sonnetthinking"
	| "claude45haiku"
	| "claude45haikuthinking"
	| "claude_ombre_eap"
	| "claude_lace_eap"
	| "claude40sonnet_research"
	| "claude40sonnetthinking_research"
	| "claude40opus_research"
	| "claude40opusthinking_research"
	| "claude40sonnetthinking_labs"
	| "claude40opusthinking_labs"
	| "gemini"
	| "gemini2flash"
	| "gemini25pro"
	| "gemini30pro"
	| "gemini30flash"
	| "gemini30flash_high"
	| "grok"
	| "grok2"
	| "grok4"
	| "grok4nonthinking"
	| "grok41reasoning"
	| "grok41nonreasoning"
	| "kimik2thinking"
	| "kimik25thinking"
	| "llama_x_large"
	| "mistral"
	| "testing_model_c"
	| "comet_browser_agent"
	| "comet_browser_agent_sonnet"
	| "comet_browser_agent_opus";

/**
 * Model identifier to request. Accepts known IDs plus future model names.
 */
export type ModelPreference = KnownModelId | (string & {});

/** Configuration for the Perplexity client instance. */
export interface ClientOptions {
	baseUrl?: string;
	cookies?: string;
	headers?: Record<string, string>;
	apiVersion?: string;
	userAgent?: string;
}

/**
 * Options for asking a question or streaming a response.
 */
export interface QueryOptions {
	focus?: SearchFocus;
	recency?: RecencyFilter | null;
	mode?: Mode;
	model?: ModelPreference;
	incognito?: boolean;
	sources?: string[];
	attachments?: string[];
	language?: string;
	timezone?: string;
	threadId?: string;
	frontendId?: string;
	existingEntryId?: string;
	querySource?: string;
	useSchematizedApi?: boolean;
	skipSearch?: boolean;
	supportedBlockUseCases?: string[];
	headers?: Record<string, string>;
	signal?: AbortSignal;
}

/**
 * Streaming update emitted as Perplexity responds.
 */
export interface StreamUpdate {
	entry: Partial<Entry>;
	answer: string;
	delta: string;
	sources: SourceLink[];
	isFinal: boolean;
}

/** Display-friendly source extracted from web results. */
export interface SourceLink {
	title: string;
	url: string;
}

/**
 * Final response returned once streaming completes.
 */
export interface PerplexityResponse {
	entry: Entry;
	answer: string;
	sources: SourceLink[];
	webResults: WebResult[];
}

/** Options for creating a threaded session. */
export interface ThreadOptions {
	id?: string;
	defaults?: QueryOptions;
}

/** Raw request payload shape used by Perplexity's SSE endpoint. */
export interface SubmitParams {
	query_str: string;
	search_focus?: SearchFocus;
	search_recency_filter?: RecencyFilter | null;
	mode?: Mode;
	model_preference?: ModelPreference;
	sources?: string[];
	attachments?: string[];
	frontend_uuid?: string;
	frontend_context_uuid?: string;
	existing_entry_uuid?: string;
	query_source?: string;
	version?: string;
	language?: string;
	timezone?: string;
	is_incognito?: boolean;
	use_schematized_api?: boolean;
	skip_search_enabled?: boolean;
	supported_block_use_cases?: string[];
}

export interface ReconnectParams {
	resume_entry_uuid: string;
	cursor?: string;
}

export interface SocialInfo {
	like_count: number;
	view_count: number;
	fork_count: number;
	user_likes: boolean;
}

export interface Source {
	url?: string;
	title?: string;
	snippet?: string;
	is_attachment?: boolean;
}

export interface DiffBlock {
	field: string;
	patches?: JsonPatch[];
}

export interface MarkdownBlock {
	progress?: "IN_PROGRESS" | "DONE";
	chunks?: string[];
	chunk_starting_offset?: number;
	answer?: string;
	inline_token_annotations?: unknown[];
}

export interface WebResult {
	name: string;
	url: string;
	snippet?: string;
	timestamp?: string;
	meta_data?: {
		citation_domain_name?: string;
		domain_name?: string;
		images?: string[];
	};
}

export interface WebResultBlock {
	progress?: "IN_PROGRESS" | "DONE";
	web_results?: WebResult[];
}

export interface Block {
	intended_usage: string;
	diff_block?: DiffBlock;
	markdown_block?: MarkdownBlock;
	web_result_block?: WebResultBlock;
	markdown?: string;
	content?: string;
	[key: string]: unknown;
}

export interface JsonPatch {
	op: "add" | "remove" | "replace" | "move" | "copy" | "test";
	path: string;
	value?: unknown;
	from?: string;
}

/** Full response entry emitted by the Perplexity stream. */
export interface Entry {
	status: StreamStatus;
	query_str: string;
	backend_uuid: string;
	uuid: string;
	frontend_uuid: string;
	context_uuid: string;
	frontend_context_uuid: string;
	search_focus: SearchFocus;
	search_recency_filter?: string;
	mode: Mode;
	model_preference?: ModelPreference;
	display_model?: string;
	personalized: boolean;
	final: boolean;
	reconnectable?: boolean;
	cursor?: string;

	text?: string;
	blocks: Block[];
	sources: { sources: string[] };
	sources_list: Source[];
	attachments: string[];

	related_queries: string[];
	related_query_items: unknown[];
	media_items: unknown[];
	widget_data: unknown[];
	widget_intents: unknown[];
	knowledge_cards: unknown[];
	answer_modes: unknown[];

	social_info: SocialInfo;
	author_username?: string;
	author_image?: string;

	thread_url_slug?: string;
	thread_title?: string;
	thread_access?: number;
	read_write_token?: string;
	collection_info?: unknown;

	updated_datetime?: string;
	created_datetime?: string;
	stream_created_at?: string;
	expiry_time?: string;

	plan?: unknown;
	reasoning_plan?: unknown;
	summary?: unknown;
	form?: unknown;
	parent_info?: unknown;
	side_by_side_metadata?: unknown;
}
