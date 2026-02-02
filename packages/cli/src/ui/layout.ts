import type { Entry, SourceLink } from "@pplx/api";
import { symbols, theme } from "./theme";

type Styler = (value: string) => string;

const MAX_WIDTH = 100;

function terminalWidth(): number {
	return Math.min(process.stdout.columns ?? 88, MAX_WIDTH);
}

/**
 * Streaming-aware text writer that wraps lines at terminal width.
 * Tracks active ANSI codes and re-emits them after line wraps.
 */
export class StreamWriter {
	private readonly width: number;
	readonly prefix: string;
	private col = 0;
	private ansiBuffer = "";
	private inAnsi = false;
	private activeAnsi = ""; // Current active ANSI styling codes

	constructor(prefix: string) {
		this.prefix = prefix;
		this.width = terminalWidth() - Bun.stringWidth(prefix) - 1;
	}

	private wrap(): void {
		process.stdout.write(`\x1b[0m\n${this.prefix}${this.activeAnsi}`);
		this.col = 0;
	}

	write(text: string): void {
		for (const char of text) {
			if (this.inAnsi) {
				this.ansiBuffer += char;
				if (char === "m") {
					// Track styling codes (not reset)
					if (this.ansiBuffer === "\x1b[0m") {
						this.activeAnsi = "";
					} else {
						this.activeAnsi += this.ansiBuffer;
					}
					process.stdout.write(this.ansiBuffer);
					this.ansiBuffer = "";
					this.inAnsi = false;
				}
			} else if (char === "\x1b") {
				this.inAnsi = true;
				this.ansiBuffer = char;
			} else if (char === "\n") {
				this.wrap();
			} else {
				const charWidth = Bun.stringWidth(char);
				if (this.col + charWidth > this.width) {
					this.wrap();
				}
				process.stdout.write(char);
				this.col += charWidth;
			}
		}
	}

	flush(): void {
		if (this.ansiBuffer) {
			process.stdout.write(this.ansiBuffer);
			this.ansiBuffer = "";
			this.inAnsi = false;
		}
	}
}

const superscripts: Record<string, string> = {
	"0": "⁰",
	"1": "¹",
	"2": "²",
	"3": "³",
	"4": "⁴",
	"5": "⁵",
	"6": "⁶",
	"7": "⁷",
	"8": "⁸",
	"9": "⁹",
};

export function formatMarkdown(text: string): string {
	// Citations [1] -> ¹
	let formatted = text.replace(/\[(\d+)\]/g, (_, nums) => {
		const sup = nums
			.split("")
			.map((n: string) => superscripts[n] ?? n)
			.join("");
		return sup;
	});

	// Headers ## Title -> Title (Bold)
	formatted = formatted.replace(/^#{2,6}\s+(.*)$/gm, (_, title) => theme.bold(title));

	// Bold **text** -> text (Bold)
	formatted = formatted.replace(/\*\*(.*?)\*\*/g, (_, content) => theme.bold(content));

	return formatted;
}

function _renderTopBorder(innerWidth: number, border: Styler, title?: string, titleStyle?: Styler): string {
	if (!title) {
		return `${border("╭")}${border("─".repeat(innerWidth))}${border("╮")}`;
	}

	const label = ` ${title} `;
	const labelWidth = Bun.stringWidth(label);
	const left = Math.max(0, Math.floor((innerWidth - labelWidth) / 2));
	const right = Math.max(0, innerWidth - labelWidth - left);
	const styledTitle = titleStyle ? theme.bold(titleStyle(label)) : label;

	return `${border("╭")}${border("─".repeat(left))}${styledTitle}${border("─".repeat(right))}${border("╮")}`;
}

function padLine(text: string, width: number): string {
	const pad = Math.max(0, width - Bun.stringWidth(text));
	return `${text}${" ".repeat(pad)}`;
}

function wrapLines(line: string, width: number): string[] {
	return Bun.wrapAnsi(line, width, { hard: true }).split("\n");
}

function renderFreeformPanel(lines: string[], options: { border?: Styler; indent?: number } = {}): string {
	const width = terminalWidth();
	const contentWidth = width - 4;
	const border = options.border ?? theme.muted;

	const bodyLines = lines.length ? lines : [""];
	const wrapped = bodyLines.flatMap(line => wrapLines(line, contentWidth));
	const content = wrapped.map(line => `${border("│")} ${line}`);

	return content.join("\n");
}

export function renderIndentedPanel(lines: string[], indent = 0): string {
	const spacer = " ".repeat(indent);
	return renderFreeformPanel(lines)
		.split("\n")
		.map(l => {
			return l.replace(/^([^│]*)│/, `$1│${spacer}`);
		})
		.join("\n");
}

export function renderSpacer(): string {
	return theme.muted("│");
}

export function renderPanel(lines: string[]): string {
	return renderFreeformPanel(lines);
}

export function renderBanner(): string {
	// Minimal header with inverted logic: spark then text, all brand color
	return ["", `${theme.brand("pplx")} ${theme.brand(symbols.spark)}`].join("\n");
}

export function renderDivider(): string {
	const width = terminalWidth();
	return theme.divider("─".repeat(width));
}

export function renderQuery(query: string): string {
	return renderFreeformPanel([theme.query(query)]);
}

export function renderSession(entry: Partial<Entry>): string {
	const model = String(entry.display_model ?? entry.model_preference ?? "default");
	const mode = entry.mode ?? "concise";
	const focus = entry.search_focus ?? "internet";

	// Minimal table-like structure
	// ┌───────┬─────────┐
	// │ model │ copilot │
	// └───────┴─────────┘
	// styled with text only

	const col1 = 20;
	const col2 = 15;

	const header = `${padLine(theme.muted("model"), col1)} ${padLine(theme.muted("mode"), col2)} ${theme.muted("focus")}`;
	const values = `${padLine(theme.accent(model), col1)} ${padLine(theme.accent(mode), col2)} ${theme.accent(focus)}`;
	const separator = theme.divider("──────────────────────────────────────────────");

	return [renderSpacer(), renderFreeformPanel([header, separator, values]), renderSpacer()].join("\n");
}

export function renderSectionTitle(label: string, tone: Styler): string {
	return [`${tone(symbols.spark)} ${theme.bold(tone(label))}`, theme.muted("│")].join("\n");
}

export function prefixLines(text: string, prefix: string): string {
	return text.replace(/\n/g, `\n${prefix}`);
}

export function renderSources(sources: SourceLink[]): string {
	if (!sources.length) return "";

	const lines: string[] = [];
	for (const [index, source] of sources.entries()) {
		const num = (index + 1)
			.toString()
			.split("")
			.map(n => superscripts[n] ?? n)
			.join("");
		const title = source.title.length > 50 ? `${source.title.slice(0, 50)}…` : source.title;
		// OSC 8 hyperlink: \x1b]8;;URL\x07TEXT\x1b]8;;\x07
		const shortUrl = source.url.replace(/^https?:\/\//, "").slice(0, 30);
		const link = `\x1b]8;;${source.url}\x07${theme.muted(shortUrl)}\x1b]8;;\x07`;
		lines.push(`${theme.muted(num)} ${theme.dim(title)} ${theme.dim("·")} ${link}`);
	}

	return [
		`${theme.dim(symbols.spark)} ${theme.dim("Sources")}`,
		theme.dim("│"),
		renderFreeformPanel(lines, { border: theme.dim }),
	].join("\n");
}

function renderHelpItem(cmd: string, desc: string, width: number): string {
	return `${padLine(theme.query(cmd), width)} ${theme.muted(desc)}`;
}

export function renderCommandHelp(): string {
	const entries = [
		{ cmd: "/help", desc: "Show chat commands" },
		{ cmd: "/new", desc: "Start a new thread" },
		{ cmd: "/model <id>", desc: "Set the model" },
		{ cmd: "/focus <focus>", desc: "Set search focus" },
		{ cmd: "/mode <mode>", desc: "Set mode: copilot | concise" },
		{ cmd: "/recency <filter>", desc: "Set recency: day | week | month | year" },
		{ cmd: "/incognito <on|off>", desc: "Toggle history" },
		{ cmd: "/exit", desc: "Exit chat" },
	];

	const lines = entries.map(e => renderHelpItem(e.cmd, e.desc, 22));

	return [renderSectionTitle("Commands", theme.query), renderFreeformPanel(lines), renderSpacer()].join("\n");
}
