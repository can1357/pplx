import { createClient, type QueryOptions } from "@pplx/api";
import { resolveCookies } from "../auth";
import {
	formatMarkdown,
	renderBanner,
	renderDivider,
	renderQuery,
	renderSectionTitle,
	renderSession,
	renderSources,
	renderSpacer,
	StreamWriter,
} from "../ui/layout";
import { createSpinner } from "../ui/spinner";
import { theme } from "../ui/theme";

export async function runAsk(query: string, options: QueryOptions): Promise<void> {
	const cookies = resolveCookies();
	if (!cookies) {
		throw new Error("Not logged in. Run 'pplx --login' first or set PPLX_COOKIES.");
	}

	const client = createClient({ cookies });
	const spinner = createSpinner("Connecting to Perplexity");
	let started = false;
	let writer: StreamWriter | null = null;

	process.stdout.write(`${renderBanner()}\n`);
	process.stdout.write(`${renderQuery(query)}\n`);
	spinner.start();

	try {
		for await (const update of client.stream(query, options)) {
			if (!started) {
				spinner.stop();
				const session = renderSession(update.entry);
				if (session) {
					process.stdout.write(`${session}\n`);
				}
				process.stdout.write(`${renderSectionTitle("Answer", theme.answer)}\n`);
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
