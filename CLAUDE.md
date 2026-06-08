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

## Electron automation (Playwright)

Use `playwright`'s `_electron` launcher for **any task that requires running the app**: E2E tests, screenshot capture, UI verification, smoke testing. It attaches directly to the Electron binary — no browser download, no CDP wiring needed.

### Prerequisites

```bash
# Playwright is already a dev dep in app/package.json
# Build the app first so out/main/index.js exists
cd app && npm run build
# Seed sample data if needed
NODE_PATH=./node_modules npx tsx --tsconfig tsconfig.node.json ../scripts/seed.ts
# Start a virtual display on Linux (headless env)
Xvfb :99 -screen 0 1280x900x24 &
export DISPLAY=:99
```

### Boilerplate

```ts
import { _electron as electron } from 'playwright'
import * as path from 'path'

const appPath = path.resolve(__dirname, '../app')
const app = await electron.launch({
  executablePath: path.resolve(appPath, 'node_modules/.bin/electron'),
  args: [path.resolve(appPath, 'out/main/index.js')],
  env: { ...process.env, NODE_ENV: 'production', DISPLAY: process.env.DISPLAY || ':99' },
})
const page = await app.firstWindow()
await page.waitForLoadState('domcontentloaded')
// page is a normal Playwright Page — use locator(), click(), screenshot(), evaluate(), etc.
await app.close()
```

### Running scripts

```bash
cd app
DISPLAY=:99 NODE_PATH=./node_modules npx tsx --tsconfig tsconfig.node.json ../scripts/<script>.ts
```

### Navigation

The sidebar nav items are plain buttons with text labels. Navigate by clicking the label text:

```ts
await page.locator('text="Transactions"').first().click()
```

Page IDs: `dashboard`, `transactions`, `receipts`, `items`, `import`, `reconcile`, `ask`, `settings`.

### DOM notes

- The transactions table is **virtualised** — rows render as `[data-index]` divs, not `<tr>` elements.
- Receipt thumbnails are `<img>` elements; click the image to open the detail viewer.
- The settings file is at `~/.config/Electron/settings.json` in Linux environments (`dataFolder` key).

### Existing scripts

| Script | Purpose |
|--------|---------|
| `scripts/capture-screenshots.ts` | Captures one screenshot per page |
| `scripts/capture-screenshots-detail.ts` | Captures transaction and receipt detail views |

## Key conventions

- All user edits write to `changes.csv` via `appendChangeRow()` — never mutate `ledger.csv` or `transactions.csv` directly.
- The data folder path comes from settings (`~/Library/Application Support/genzeb/settings.json`), not hardcoded.
- IPC channels are defined in `core/types/ipc.ts` — add new channels there first, then wire handler in `app/src/main/ipc/index.ts`, expose in `app/src/preload/index.ts`.
- Main process changes require a full dev server restart (`pkill -f electron && npm run dev`) — renderer-only changes hot-reload.
- Run scripts from `app/` with `NODE_PATH=./node_modules npx tsx --tsconfig tsconfig.node.json ../scripts/<script>.ts`.
