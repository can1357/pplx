import { PerplexityApiError, PerplexityError } from "./errors";
import { extractSources, extractWebResults, parseEventStream, StreamAccumulator, SUPPORTED_BLOCKS } from "./stream";
import { PerplexityThread } from "./thread";
import type {
	ClientOptions,
	Entry,
	PerplexityResponse,
	QueryOptions,
	StreamUpdate,
	SubmitParams,
	ThreadOptions,
} from "./types";

const DEFAULT_API_VERSION = "2.18";
const DEFAULT_BASE_URL = "https://www.perplexity.ai";
const DEFAULT_USER_AGENT = "WindowsApp";

/**
 * Perplexity API client for streaming and one-shot queries.
 */
export class PerplexityClient {
	private baseUrl: string;
	private cookies: string;
	private headers: Record<string, string>;
	private apiVersion: string;
	private userAgent: string;

	constructor(options: ClientOptions = {}) {
		this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
		this.cookies = options.cookies ?? "";
		this.headers = options.headers ?? {};
		this.apiVersion = options.apiVersion ?? DEFAULT_API_VERSION;
		this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
	}

	/** Create a threaded conversation session. */
	thread(options: ThreadOptions = {}): PerplexityThread {
		return new PerplexityThread(this, options);
	}

	/**
	 * Return the final response for a query.
	 * Throws {@link PerplexityError} on request or stream failures.
	 */
	async ask(query: string, options: QueryOptions = {}): Promise<PerplexityResponse> {
		const stream = this.stream(query, options);

		while (true) {
			const { done, value } = await stream.next();
			if (done) {
				if (!value) throw new PerplexityError("Stream finished without a response");
				return value;
			}
		}
	}

	/**
	 * Stream updates as Perplexity responds.
	 * Throws {@link PerplexityError} on request or stream failures.
	 */
	async *stream(query: string, options: QueryOptions = {}): AsyncGenerator<StreamUpdate, PerplexityResponse, void> {
		const params = this.buildSubmitParams(query, options);
		const url = `${this.baseUrl}/rest/sse/perplexity_ask`;
		const headers = this.buildHeaders("submit", options.headers);

		const response = await fetch(url, {
			method: "POST",
			headers,
			body: JSON.stringify({ query_str: query, params }),
			signal: options.signal,
		});

		if (!response.ok) {
			const body = await response.text().catch(() => undefined);
			throw new PerplexityApiError(response.status, response.statusText, url, body);
		}

		if (!response.body) {
			throw new PerplexityError("Perplexity response contained no body");
		}

		const accumulator = new StreamAccumulator();

		for await (const entry of parseEventStream(response.body)) {
			const update = accumulator.update(entry);
			yield update;

			if (update.isFinal) {
				return this.buildResponse(accumulator);
			}
		}

		return this.buildResponse(accumulator);
	}

	/**
	 * Reconnect to an existing stream using the entry UUID.
	 * Throws {@link PerplexityError} on request or stream failures.
	 */
	async *reconnect(
		entryUuid: string,
		cursor?: string,
		options: QueryOptions = {},
	): AsyncGenerator<StreamUpdate, PerplexityResponse, void> {
		const url = `${this.baseUrl}/rest/sse/perplexity_ask/reconnect/${entryUuid}${cursor ? `?cursor=${cursor}` : ""}`;
		const headers = this.buildHeaders("reconnect", options.headers);

		const response = await fetch(url, {
			method: "GET",
			headers,
			signal: options.signal,
		});

		if (!response.ok) {
			const body = await response.text().catch(() => undefined);
			throw new PerplexityApiError(response.status, response.statusText, url, body);
		}

		if (!response.body) {
			throw new PerplexityError("Perplexity response contained no body");
		}

		const accumulator = new StreamAccumulator();

		for await (const entry of parseEventStream(response.body)) {
			const update = accumulator.update(entry);
			yield update;

			if (update.isFinal) {
				return this.buildResponse(accumulator);
			}
		}

		return this.buildResponse(accumulator);
	}

	private buildHeaders(reason: string, overrides?: Record<string, string>): Record<string, string> {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			Accept: "text/event-stream",
			Origin: this.baseUrl,
			Referer: `${this.baseUrl}/`,
			"User-Agent": this.userAgent,
			"X-App-ApiClient": "default",
			"X-App-ApiVersion": this.apiVersion,
			"X-Perplexity-Request-Reason": reason,
			"X-Request-ID": crypto.randomUUID(),
			...this.headers,
			...overrides,
		};

		if (this.cookies && !headers.Cookie) {
			headers.Cookie = this.cookies;
		}

		return headers;
	}

	private buildSubmitParams(query: string, options: QueryOptions): SubmitParams {
		const frontendUuid = options.frontendId ?? crypto.randomUUID();
		const frontendContextUuid = options.threadId ?? crypto.randomUUID();

		return {
			query_str: query,
			search_focus: options.focus ?? "internet",
			mode: options.mode ?? "copilot",
			model_preference: options.model ?? "pplx_pro_upgraded",
			sources: options.sources ?? ["web"],
			attachments: options.attachments ?? [],
			frontend_uuid: frontendUuid,
			frontend_context_uuid: frontendContextUuid,
			existing_entry_uuid: options.existingEntryId,
			query_source: options.querySource,
			version: this.apiVersion,
			language: options.language ?? "en-US",
			timezone: options.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
			search_recency_filter: options.recency ?? null,
			is_incognito: options.incognito ?? true,
			use_schematized_api: options.useSchematizedApi ?? true,
			skip_search_enabled: options.skipSearch ?? true,
			supported_block_use_cases: options.supportedBlockUseCases ?? SUPPORTED_BLOCKS,
		};
	}

	private buildResponse(accumulator: StreamAccumulator): PerplexityResponse {
		const entry = accumulator.getEntry() as Entry;
		return {
			entry,
			answer: accumulator.getAnswer(),
			sources: extractSources(entry),
			webResults: extractWebResults(entry),
		};
	}
}

/** Construct a Perplexity client with shared defaults. */
export function createClient(options?: ClientOptions): PerplexityClient {
	return new PerplexityClient(options);
}
