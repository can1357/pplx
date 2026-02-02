/**
 * Perplexity API SDK with streaming, threading, and model helpers.
 *
 * Overview: create a client with cookies, then stream or await responses.
 *
 * # Example
 * ```ts
 * import { createClient } from "@pplx/api";
 *
 * const client = createClient({ cookies: process.env.PPLX_COOKIES ?? "" });
 * for await (const update of client.stream("What is quantum entanglement?")) {
 * 	if (update.delta) process.stdout.write(update.delta);
 * }
 * ```
 */
export { createClient, PerplexityClient } from "./client";
export { PerplexityApiError, PerplexityError, PerplexityStreamError } from "./errors";
export {
	categorizeModels,
	type FetchModelsOptions,
	fetchModelsConfig,
	formatModelsHelp,
	getAllModels,
	isValidModel,
	type ModelConfig,
	type ModelInfo,
	type ModelsConfigResponse,
	mergeWithSecretModels,
} from "./models";
export {
	extractAnswer,
	extractSources,
	extractWebResults,
	mergeEntries,
	parseEventStream,
	StreamAccumulator,
	SUPPORTED_BLOCKS,
} from "./stream";
export { PerplexityThread } from "./thread";
export * from "./types";
