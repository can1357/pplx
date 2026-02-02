import chalk from "chalk";

export const palette = {
	brand: "#0d9488", // teal-600, more aqua/green
	query: "#0d9488", // Match brand color
	answer: "#20b8cd",
	sources: "#525252", // neutral-600, subtle
	accent: "#0ea5e9",
	divider: "#1e293b",
	muted: "#64748b",
	dim: "#404040", // neutral-700, very subtle
};

export const theme = {
	brand: chalk.hex(palette.brand),
	query: chalk.hex(palette.query),
	answer: chalk.hex(palette.answer),
	sources: chalk.hex(palette.sources),
	accent: chalk.hex(palette.accent),
	divider: chalk.hex(palette.divider),
	muted: chalk.hex(palette.muted),
	dim: chalk.hex(palette.dim),
	bold: chalk.bold,
};

export const symbols = {
	dot: "•",
	prompt: "›",
	bullet: "•",
	spark: "✦",
};
