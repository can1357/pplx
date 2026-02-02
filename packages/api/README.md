# @pplx/api

Streaming-first Perplexity API client for Node/Bun.

## Install

```bash
bun add @pplx/api
```

## Stream a response

```ts
import { createClient } from "@pplx/api";

const client = createClient({ cookies: process.env.PPLX_COOKIES ?? "" });

for await (const update of client.stream("What is quantum entanglement?")) {
	if (update.delta) process.stdout.write(update.delta);
}
```

## Fetch the final response

```ts
const response = await client.ask("Summarize GPT-5");
console.log(response.answer);
```

## Threads

```ts
const thread = client.thread({
	defaults: { model: "claude45sonnet", focus: "academic" },
});

for await (const update of thread.stream("Outline CRISPR papers since 2022")) {
	process.stdout.write(update.delta);
}
```

## Models

```ts
import { fetchModelsConfig, getAllModels } from "@pplx/api";

const config = await fetchModelsConfig(process.env.PPLX_COOKIES ?? "");
const models = getAllModels(config);
```
