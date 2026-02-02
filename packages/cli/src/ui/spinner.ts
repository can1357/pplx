import spinners from "cli-spinners";
import { theme } from "./theme";

export function createSpinner(label: string): {
	start: () => void;
	stop: () => void;
	update: (next: string) => void;
} {
	const { frames, interval } = spinners.dots;
	let index = 0;
	let timer: NodeJS.Timeout | null = null;
	let text = label;

	const render = () => {
		const frame = frames[index % frames.length];
		index += 1;
		process.stderr.write(`\r${theme.accent(frame)} ${theme.muted(text)}`);
	};

	const start = () => {
		if (timer) return;
		render();
		timer = setInterval(render, interval);
	};

	const stop = () => {
		if (!timer) return;
		clearInterval(timer);
		timer = null;
		process.stderr.write("\r\x1b[K");
	};

	const update = (next: string) => {
		text = next;
		if (timer) render();
	};

	return { start, stop, update };
}
