/**
 * Threaded conversation helper built on top of the Perplexity client.
 */
import type { PerplexityClient } from "./client";
import type { PerplexityResponse, QueryOptions, StreamUpdate, ThreadOptions } from "./types";

export class PerplexityThread {
	private client: PerplexityClient;
	private threadId: string;
	private lastEntryId?: string;
	private defaults: QueryOptions;

	constructor(client: PerplexityClient, options: ThreadOptions = {}) {
		this.client = client;
		this.threadId = options.id ?? crypto.randomUUID();
		this.defaults = options.defaults ?? {};
	}

	/** Stable thread identifier sent with requests. */
	get id(): string {
		return this.threadId;
	}

	/** Last entry UUID returned by Perplexity. */
	get lastEntryUuid(): string | undefined {
		return this.lastEntryId;
	}

	/** Update default query options for the thread. */
	updateDefaults(update: QueryOptions): void {
		this.defaults = { ...this.defaults, ...update };
	}

	/** Reset the thread to start a fresh conversation. */
	reset(newId?: string): void {
		this.threadId = newId ?? crypto.randomUUID();
		this.lastEntryId = undefined;
	}

	/** Ask a question and return the final response. */
	async ask(query: string, options: QueryOptions = {}): Promise<PerplexityResponse> {
		const response = await this.client.ask(query, this.mergeOptions(options));
		this.lastEntryId = response.entry.uuid;
		return response;
	}

	/** Stream updates for a question within this thread. */
	async *stream(query: string, options: QueryOptions = {}): AsyncGenerator<StreamUpdate, PerplexityResponse, void> {
		const generator = this.client.stream(query, this.mergeOptions(options));

		while (true) {
			const { value, done } = await generator.next();
			if (done) {
				if (value?.entry?.uuid) {
					this.lastEntryId = value.entry.uuid;
				}
				return value;
			}
			yield value;
		}
	}

	private mergeOptions(options: QueryOptions): QueryOptions {
		return {
			...this.defaults,
			...options,
			threadId: this.threadId,
			existingEntryId: this.lastEntryId,
		};
	}
}
