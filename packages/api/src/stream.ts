import { createParser } from "eventsource-parser";
import { applyPatch, type Operation } from "fast-json-patch";
import { PerplexityStreamError } from "./errors";
import type { Block, Entry, MarkdownBlock, SourceLink, StreamUpdate, WebResult } from "./types";

/** Default block types requested by the client. */
export const SUPPORTED_BLOCKS = [
	"answer_modes",
	"media_items",
	"knowledge_cards",
	"inline_entity_cards",
	"place_widgets",
	"finance_widgets",
	"sports_widgets",
	"search_result_widgets",
	"inline_images",
	"diff_blocks",
];

function mergeMarkdownBlock(existing: MarkdownBlock | undefined, incoming: MarkdownBlock): MarkdownBlock {
	if (!existing) return { ...incoming };

	const result: MarkdownBlock = { ...existing, ...incoming };

	if (incoming.chunks?.length) {
		const offset = incoming.chunk_starting_offset ?? 0;
		const existingChunks = existing.chunks ?? [];
		if (offset === 0) {
			result.chunks = [...incoming.chunks];
		} else {
			result.chunks = [...existingChunks.slice(0, offset), ...incoming.chunks];
		}
	}

	return result;
}

function mergeBlocks(existing: Block[], incoming: Block[]): Block[] {
	const blockMap = new Map<string, Block>(existing.map(b => [b.intended_usage, b]));

	for (const block of incoming) {
		const prev = blockMap.get(block.intended_usage);

		if (block.markdown_block) {
			blockMap.set(block.intended_usage, {
				...prev,
				intended_usage: block.intended_usage,
				markdown_block: mergeMarkdownBlock(prev?.markdown_block, block.markdown_block),
			});
			continue;
		}

		if (block.diff_block) {
			const field = block.diff_block.field;
			const current = (prev?.[field] as unknown) ?? (block.diff_block.patches?.[0]?.path?.startsWith("/") ? {} : "");
			const patches = (block.diff_block.patches ?? []) as Operation[];
			try {
				const patched = applyPatch(current, patches, false, false).newDocument;
				blockMap.set(block.intended_usage, {
					...prev,
					intended_usage: block.intended_usage,
					[field]: patched,
				});
				continue;
			} catch {
				blockMap.set(block.intended_usage, { ...prev, ...block });
				continue;
			}
		}

		blockMap.set(block.intended_usage, { ...prev, ...block });
	}

	return Array.from(blockMap.values());
}

/** Merge incremental entry updates into a single snapshot. */
export function mergeEntries(existing: Partial<Entry>, incoming: Partial<Entry>): Partial<Entry> {
	const { blocks: incomingBlocks, ...incomingRest } = incoming;
	const merged: Partial<Entry> = { ...existing, ...incomingRest };

	if (incomingBlocks && incomingBlocks.length > 0) {
		merged.blocks = mergeBlocks(existing.blocks ?? [], incomingBlocks);
	} else {
		merged.blocks = existing.blocks ?? [];
	}

	return merged;
}

/** Extract the best available markdown answer from a stream entry. */
export function extractAnswer(entry: Partial<Entry>): string {
	if (!entry.blocks?.length) return "";

	const markdownBlock = entry.blocks.find(block => block.intended_usage?.includes("markdown") && block.markdown_block);
	if (markdownBlock?.markdown_block) {
		const block = markdownBlock.markdown_block;
		if (block.answer) return block.answer;
		if (block.chunks?.length) return block.chunks.join("");
	}

	const textBlock = entry.blocks.find(block => block.intended_usage === "ask_text" && block.markdown_block);
	if (textBlock?.markdown_block) {
		const block = textBlock.markdown_block;
		if (block.answer) return block.answer;
		if (block.chunks?.length) return block.chunks.join("");
	}

	return "";
}

/** Extract raw web results from an entry. */
export function extractWebResults(entry: Partial<Entry>): WebResult[] {
	if (!entry.blocks?.length) return [];

	const webBlock = entry.blocks.find(block => block.intended_usage === "web_results");
	return webBlock?.web_result_block?.web_results ?? [];
}

/** Extract display-ready sources from an entry. */
export function extractSources(entry: Partial<Entry>): SourceLink[] {
	return extractWebResults(entry)
		.filter(result => result.url && result.name)
		.map(result => ({
			title: result.name,
			url: result.url,
		}));
}

/**
 * Accumulates streaming updates into a rolling snapshot with deltas.
 */
export class StreamAccumulator {
	private entry: Partial<Entry> = { blocks: [] };
	private answer = "";

	update(incoming: Partial<Entry>): StreamUpdate {
		this.entry = mergeEntries(this.entry, incoming);

		const answer = extractAnswer(this.entry);
		const delta = answer.startsWith(this.answer) ? answer.slice(this.answer.length) : answer;

		this.answer = answer;

		return {
			entry: this.entry,
			answer,
			delta,
			sources: extractSources(this.entry),
			isFinal: Boolean(incoming.final) || incoming.status === "COMPLETED",
		};
	}

	getEntry(): Partial<Entry> {
		return this.entry;
	}

	getAnswer(): string {
		return this.answer;
	}
}

/**
 * Parse Perplexity's SSE stream into JSON payloads.
 */
export async function* parseEventStream(body: ReadableStream<Uint8Array>): AsyncGenerator<Partial<Entry>, void, void> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	const queue: string[] = [];

	const parser = createParser({
		onEvent: event => {
			queue.push(event.data);
		},
	});

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			parser.feed(decoder.decode(value, { stream: true }));

			while (queue.length > 0) {
				const data = queue.shift()?.trim();
				if (!data || data === "[DONE]") continue;

				let parsed: Partial<Entry> | null = null;
				try {
					parsed = JSON.parse(data) as Partial<Entry>;
				} catch (error) {
					if (error instanceof SyntaxError) continue;
					throw error;
				}

				if ((parsed as any).status === "failed" || (parsed as any).status === "FAILED") {
					const message = (parsed as any).text ?? "Perplexity stream failed";
					throw new PerplexityStreamError(message, (parsed as any).error_code);
				}

				if ((parsed as any).error_code) {
					const message = (parsed as any).text ?? (parsed as any).error_code;
					throw new PerplexityStreamError(message ?? "Perplexity stream failed", (parsed as any).error_code);
				}

				yield parsed;
			}
		}
	} finally {
		reader.releaseLock();
	}
}
