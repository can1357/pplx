# @pplx/cli

A polished Perplexity terminal client with streaming output and interactive threads.

## Usage

```bash
# One-off query
pplx "What is quantum entanglement?"

# Interactive thread mode
pplx chat

# List available models
pplx models
```

## Authentication

```bash
# Extract cookies from the Perplexity desktop app
pplx --login

# Clear stored session
pplx --logout
```

You can also set `PPLX_COOKIES` to bypass local storage.

## Options

| Flag | Description |
| --- | --- |
| `-f, --focus <focus>` | `internet`, `academic`, `youtube`, `reddit`, `writing` |
| `-m, --model <model>` | Model identifier |
| `--mode <mode>` | `copilot` or `concise` |
| `--pro` | Alias for `--mode copilot` |
| `--concise` | Alias for `--mode concise` |
| `--recency <filter>` | `day`, `week`, `month`, `year` |
| `--incognito` | Do not save to history (default) |
| `--no-incognito` | Save to history |

## Chat commands

| Command | Description |
| --- | --- |
| `/help` | Show chat commands |
| `/new` | Start a new thread |
| `/model <id>` | Set the model |
| `/focus <focus>` | Set search focus |
| `/mode <mode>` | Set mode (`copilot`, `concise`) |
| `/recency <filter>` | Set recency (`day`, `week`, `month`, `year`, `off`) |
| `/incognito <on|off>` | Toggle history |
| `/exit` | Exit chat |
