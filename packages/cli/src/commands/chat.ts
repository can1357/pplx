import { createInterface } from "node:readline/promises";
import { createClient, type Mode, type QueryOptions, type RecencyFilter, type SearchFocus } from "@pplx/api";
import { resolveCookies } from "../auth";
import {
	formatMarkdown,
	renderBanner,
	renderCommandHelp,
	renderDivider,
	renderSectionTitle,
	renderSession,
	renderSources,
	renderSpacer,
	StreamWriter,
} from "../ui/layout";
import { createSpinner } from "../ui/spinner";
import { symbols, theme } from "../ui/theme";

const FOCUS_VALUES: SearchFocus[] = ["internet", "academic", "youtube", "reddit", "writing"];
const MODE_VALUES: Mode[] = ["copilot", "concise"];
const RECENCY_VALUES: RecencyFilter[] = ["day", "week", "month", "year"];

export async function runChat(defaults: QueryOptions): Promise<void> {
	const cookies = resolveCookies();
	if (!cookies) {
		throw new Error("Not logged in. Run 'pplx --login' first or set PPLX_COOKIES.");
	}

	const client = createClient({ cookies });
	const thread = client.thread({ defaults });
	const rl = createInterface({ input: process.stdin, output: process.stdout });

	process.stdout.write(`${renderBanner()}\n`);
	process.stdout.write(`${renderCommandHelp()}\n`);
	process.stdout.write(`${renderDivider()}\n`);

	const updateDefaults = (update: QueryOptions) => {
		Object.assign(defaults, update);
		thread.updateDefaults(update);
	};

	while (true) {
		const input = await rl.question(theme.query(`${symbols.prompt} `));
		const prompt = input.trim();
		if (!prompt) continue;

		if (prompt.startsWith("/")) {
			const shouldExit = handleCommand(prompt, updateDefaults, thread.reset.bind(thread));
			if (shouldExit) break;
			continue;
		}

		process.stdout.write(`${renderSectionTitle("You", theme.query)}${theme.muted("│ ")}${theme.query(prompt)}\n`);
		const spinner = createSpinner("Searching");
		spinner.start();

		let started = false;
		let writer: StreamWriter | null = null;
		try {
			for await (const update of thread.stream(prompt)) {
				if (!started) {
					spinner.stop();
					const session = renderSession(update.entry);
					if (session) {
						process.stdout.write(`${session}\n`);
					}
					process.stdout.write(`${renderSectionTitle("Perplexity", theme.answer)}\n`);
					writer = new StreamWriter(theme.muted("│ "));
					process.stdout.write(writer.prefix);
					started = true;
				}

				if (update.delta) {
					writer?.write(theme.answer(formatMarkdown(update.delta)));
				}

				if (update.isFinal) {
					writer?.flush();
					process.stdout.write("\n");
					process.stdout.write(`${renderSpacer()}\n`);
					const sources = renderSources(update.sources);
					if (sources) {
						process.stdout.write(`${sources}\n`);
					}
					process.stdout.write(`${renderDivider()}\n`);
				}
			}
		} finally {
			if (!started) {
				spinner.stop();
			}
		}
	}

	rl.close();
}

function handleCommand(
	input: string,
	updateDefaults: (update: QueryOptions) => void,
	resetThread: () => void,
): boolean {
	const [command, ...args] = input.slice(1).split(/\s+/);

	switch (command) {
		case "exit":
		case "quit":
			return true;
		case "help":
			process.stdout.write(`${renderCommandHelp()}\n`);
			return false;
		case "new":
			resetThread();
			process.stdout.write(theme.muted("Started a new thread.\n"));
			return false;
		case "model": {
			const model = args.join(" ");
			if (!model) {
				process.stdout.write(theme.muted("Usage: /model <id>\n"));
				return false;
			}
			updateDefaults({ model });
			process.stdout.write(theme.muted(`Model set to ${model}.\n`));
			return false;
		}
		case "focus": {
			const focus = args[0] as SearchFocus | undefined;
			if (!focus || !FOCUS_VALUES.includes(focus)) {
				process.stdout.write(theme.muted(`Focus must be one of: ${FOCUS_VALUES.join(", ")}\n`));
				return false;
			}
			updateDefaults({ focus });
			process.stdout.write(theme.muted(`Focus set to ${focus}.\n`));
			return false;
		}
		case "mode": {
			const mode = args[0] as Mode | undefined;
			if (!mode || !MODE_VALUES.includes(mode)) {
				process.stdout.write(theme.muted(`Mode must be one of: ${MODE_VALUES.join(", ")}\n`));
				return false;
			}
			updateDefaults({ mode });
			process.stdout.write(theme.muted(`Mode set to ${mode}.\n`));
			return false;
		}
		case "recency": {
			const recency = args[0] as RecencyFilter | "off" | undefined;
			if (!recency) {
				process.stdout.write(theme.muted("Usage: /recency <day|week|month|year|off>\n"));
				return false;
			}
			if (recency !== "off" && !RECENCY_VALUES.includes(recency)) {
				process.stdout.write(theme.muted(`Recency must be one of: ${RECENCY_VALUES.join(", ")}\n`));
				return false;
			}
			updateDefaults({ recency: recency === "off" ? null : recency });
			process.stdout.write(theme.muted(`Recency set to ${recency === "off" ? "off" : recency}.\n`));
			return false;
		}
		case "incognito": {
			const toggle = args[0];
			if (!toggle || !["on", "off"].includes(toggle)) {
				process.stdout.write(theme.muted("Usage: /incognito <on|off>\n"));
				return false;
			}
			updateDefaults({ incognito: toggle === "on" });
			process.stdout.write(theme.muted(`Incognito ${toggle}.\n`));
			return false;
		}
		default:
			process.stdout.write(theme.muted("Unknown command. Try /help.\n"));
			return false;
	}
}
