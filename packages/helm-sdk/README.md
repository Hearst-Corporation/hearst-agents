# @hearst/helm-sdk

TypeScript client SDK for the [Helm (hearst-os)](https://hearst-os.vercel.app) API.  
Works in **Node 18+** and modern browsers — zero runtime dependencies (native `fetch`).

## Installation

```bash
pnpm add @hearst/helm-sdk
# or
npm install @hearst/helm-sdk
```

## Quick start

```ts
import { createHelmClient } from "@hearst/helm-sdk";

const helm = createHelmClient({
  apiKey: process.env.HELM_API_KEY!, // must start with hsk_
  // baseUrl: "https://hearst-os.vercel.app" (default)
});
```

### Chat (streaming)

```ts
const { text, runId } = await helm.chat(
  {
    message: "Analyse the Q2 results",
    conversationId: "conv_001",        // optional — maintain context
    history: [                          // optional — prepend turns
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there!" },
    ],
  },
  (delta) => process.stdout.write(delta), // called for each text chunk
);

console.log("Full response:", text);
console.log("Run ID:", runId);
```

### Swarm kickoff

```ts
const { runId, swarmName, status } = await helm.swarm.kickoff({
  swarmId: "market-analysis",
  context: { ticker: "AAPL", period: "Q2-2026" },
});

// Poll status
const run = await helm.swarm.status(runId);
console.log(run.status, run.output);
```

### Memory search

```ts
const results = await helm.memory.search({
  query: "previous decisions about pricing",
  limit: 5,
});

for (const r of results) {
  console.log(`[${r.similarity.toFixed(2)}] ${r.textExcerpt}`);
}
```

### Runs

```ts
// List recent swarm runs
const runs = await helm.runs.list({ limit: 20, kind: "swarm" });

// Get a specific run (returns null if 404)
const run = await helm.runs.get("run_xyz");
if (run) console.log(run.status);
```

## Error handling

All methods throw an `Error` with a human-readable message on HTTP errors or stream failures.  
`runs.get()` is the only method that silently returns `null` on 404 instead of throwing.

```ts
try {
  const result = await helm.chat({ message: "hello" });
} catch (err) {
  // err.message: "Helm SDK: HTTP 401 Unauthorized — ..."
  //           or "Helm SDK: Agent crashed"
  //           or "Helm SDK: network error — ..."
}
```

## Options

| Option    | Type     | Default                          | Description                            |
| --------- | -------- | -------------------------------- | -------------------------------------- |
| `apiKey`  | `string` | **required**                     | API key (`hsk_...`)                    |
| `baseUrl` | `string` | `https://hearst-os.vercel.app`   | Override for local / staging           |
| `timeout` | `number` | `30000`                          | Request timeout in ms (not for `chat`) |

## Build

```bash
pnpm build   # outputs to dist/
pnpm test    # vitest run
```
