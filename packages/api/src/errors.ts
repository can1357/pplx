/** Base error for Perplexity SDK failures. */
export class PerplexityError extends Error {
	constructor(message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = "PerplexityError";
	}
}

/** HTTP-level error returned by Perplexity endpoints. */
export class PerplexityApiError extends PerplexityError {
	readonly status: number;
	readonly statusText: string;
	readonly url: string;
	readonly body?: string;

	constructor(status: number, statusText: string, url: string, body?: string) {
		super(`HTTP ${status} ${statusText}`);
		this.name = "PerplexityApiError";
		this.status = status;
		this.statusText = statusText;
		this.url = url;
		this.body = body;
	}
}

/** Error emitted when the streaming API returns a failure payload. */
export class PerplexityStreamError extends PerplexityError {
	readonly code?: string;

	constructor(message: string, code?: string) {
		super(message);
		this.name = "PerplexityStreamError";
		this.code = code;
	}
}
