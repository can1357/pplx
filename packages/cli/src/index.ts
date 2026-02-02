#!/usr/bin/env bun
import { formatModelsHelp, getAllModels, type QueryOptions } from "@pplx/api";
import stringWidth from "string-width";
import { login, logout, resolveCookies } from "./auth";
import { runAsk } from "./commands/ask";
import { runChat } from "./commands/chat";
import { getModelsConfig } from "./models-cache";
import { renderBanner, renderDivider, renderPanel, renderSectionTitle, renderSpacer } from "./ui/layout";
import { theme } from "./ui/theme";

type Command = "ask" | "chat" | "models" | "login" | "logout" | "help";

interface ParsedArgs {
	command: Command;
	query: string;
	options: QueryOptions;
}

function parseArgs(args: string[]): ParsedArgs {
	const options: QueryOptions = { incognito: true };
	let command: Command = "ask";
	const queryParts: string[] = [];

	if (args.includes("--help") || args.includes("-h")) {
		return { command: "help", query: "", options };
	}
	if (args.includes("--login")) {
		return { command: "login", query: "", options };
	}
	if (args.includes("--logout")) {
		return { command: "logout", query: "", options };
	}

	if (args[0] === "chat") {
		command = "chat";
		args = args.slice(1);
	} else if (args[0] === "models") {
		command = "models";
		args = args.slice(1);
	} else if (args[0] === "ask") {
		args = args.slice(1);
	}

	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i]!;
		if (arg === "-f" || arg === "--focus") {
			options.focus = args[++i] as QueryOptions["focus"];
			continue;
		}
		if (arg === "-m" || arg === "--model") {
			options.model = args[++i] as QueryOptions["model"];
			continue;
		}
		if (arg === "--mode") {
			options.mode = args[++i] as QueryOptions["mode"];
			continue;
		}
		if (arg === "--pro") {
			options.mode = "copilot";
			continue;
		}
		if (arg === "--concise") {
			options.mode = "concise";
			continue;
		}
		if (arg === "--recency") {
			options.recency = args[++i] as QueryOptions["recency"];
			continue;
		}
		if (arg === "--incognito") {
			options.incognito = true;
			continue;
		}
		if (arg === "--no-incognito") {
			options.incognito = false;
			continue;
		}
		if (!arg.startsWith("-")) {
			queryParts.push(arg);
		}
	}

	return { command, query: queryParts.join(" "), options };
}

function renderHelp(): string {
	const pad = (text: string, width: number) => `${text}${" ".repeat(Math.max(0, width - stringWidth(text)))}`;
	const columnWidth = 28;

	const commands = [
		{ left: "pplx <query>", right: "Ask a question" },
		{ left: "pplx chat", right: "Interactive thread mode" },
		{ left: "pplx models", right: "List available models" },
		{ left: "pplx --login", right: "Extract cookies from desktop app" },
		{ left: "pplx --logout", right: "Clear stored session" },
	].map(entry => `${pad(theme.query(entry.left), columnWidth)} ${theme.muted(entry.right)}`);

	const commandPanel = [renderSectionTitle("Commands", theme.brand), renderPanel(commands)].join("\n");

	const options = [
		{ left: "-f, --focus <focus>", right: "internet | academic | youtube | reddit | writing" },
		{ left: "-m, --model <model>", right: "Model identifier" },
		{ left: "--mode <mode>", right: "copilot | concise" },
		{ left: "--pro | --concise", right: "Shortcuts for modes" },
		{ left: "--recency <filter>", right: "day | week | month | year" },
		{ left: "--incognito", right: "Do not save to history (default)" },
		{ left: "--no-incognito", right: "Save to history" },
	].map(entry => `${pad(theme.query(entry.left), columnWidth)} ${theme.muted(entry.right)}`);

	const optionsPanel = [renderSectionTitle("Options", theme.accent), renderPanel(options)].join("\n");

	const examples = [
		"pplx 'What is quantum entanglement?'",
		"pplx -f academic 'CRISPR gene editing papers 2024'",
		"pplx chat --model claude45sonnet",
	].map(entry => theme.query(entry));

	const examplesPanel = [renderSectionTitle("Examples", theme.query), renderPanel(examples)].join("\n");

	return [renderBanner(), commandPanel, renderSpacer(), optionsPanel, renderSpacer(), examplesPanel].join("\n");
}

async function runModels(): Promise<void> {
	const config = await getModelsConfig(resolveCookies());
	const models = getAllModels(config);
	process.stdout.write(`${renderBanner()}\n`);
	process.stdout.write(`${renderSectionTitle("Models", theme.accent)}\n`);
	process.stdout.write(`${renderPanel(formatModelsHelp(models).split("\n"))}\n`);
	process.stdout.write(`${renderDivider()}\n`);
}

async function main() {
	const parsed = parseArgs(process.argv.slice(2));

	try {
		switch (parsed.command) {
			case "help":
				process.stdout.write(`${renderHelp()}\n`);
				return;
			case "login":
				await login();
				return;
			case "logout":
				await logout();
				return;
			case "models":
				await runModels();
				return;
			case "chat":
				await runChat(parsed.options);
				return;
			default:
				if (!parsed.query) {
					process.stdout.write(`${renderHelp()}\n`);
					return;
				}
				await runAsk(parsed.query, parsed.options);
				return;
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		process.stderr.write(`${theme.answer("Error:")} ${message}\n`);
		process.exitCode = 1;
	}
}

main();
