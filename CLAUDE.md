# Genzeb — Claude Instructions

## Decision logging

Any design or product decision made during a session must be appended to `docs/decisions.md` before the session ends or the relevant PR is pushed.

A decision is anything that answers "why did we do it this way?" — a trade-off chosen, a feature deferred, an approach picked over an alternative, a scope change, or a structural choice about data, architecture, or UX.

**Format:**

```markdown
## YYYY-MM-DD — Short title

One or two sentences describing the decision and the reason behind it.
```

Use today's date. If multiple decisions were made in one session, group them under the same date heading.

Do not log implementation details that are already obvious from the code or commit messages. Log the *why*, not the *what*.

## Docs overview

| File | Purpose |
|---|---|
| `docs/decisions.md` | Dated decision journal — always update this |
| `docs/backlog.md` | Feature backlog — add items here when deferred |
| `docs/mcp-setup.md` | How to connect the MCP agent to Claude Code / Claude Desktop |
| `docs/architecture.md` | Process model, feature status table, data layout |
| `docs/design-doc.md` | Original design spec |
| `docs/seed-data.md` | How to run seed and clean scripts |
| `docs/smoke-test.md` | Manual smoke test steps |

## Genzeb MCP agent

A `genzeb` MCP server is registered in this project. When the user asks about their **expenses, transactions, spending, receipts, categories, or anything financial**, use the Genzeb tools rather than reading CSV files directly. The tools query the user's live data folder and keep changes in sync with the app.

Key tools: `query_transactions`, `set_category`, `import_statements`, `get_receipts`, `link_receipt`.

See `docs/mcp-setup.md` for setup instructions if the server isn't connected.

## Key conventions

- All user edits write to `changes.csv` via `appendChangeRow()` — never mutate `ledger.csv` or `transactions.csv` directly.
- The data folder path comes from settings (`~/Library/Application Support/genzeb/settings.json`), not hardcoded.
- IPC channels are defined in `core/types/ipc.ts` — add new channels there first, then wire handler in `app/src/main/ipc/index.ts`, expose in `app/src/preload/index.ts`.
- Main process changes require a full dev server restart (`pkill -f electron && npm run dev`) — renderer-only changes hot-reload.
- Run scripts from `app/` with `NODE_PATH=./node_modules npx tsx --tsconfig tsconfig.node.json ../scripts/<script>.ts`.
