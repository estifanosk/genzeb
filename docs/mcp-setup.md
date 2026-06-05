# Genzeb MCP Agent — Setup

The Genzeb MCP server lets Claude drive the full workflow — import statements, categorize transactions, link receipts — using the same core functions as the app. Changes made by Claude are tagged in `changes.csv` and show an **AI** badge in the UI.

## Find your data folder

```bash
cat ~/Library/Application\ Support/genzeb/settings.json
```

Note the `dataFolder` value. You'll use it below.

---

## Option A — Claude Code (recommended)

Run once in your terminal:

```bash
claude mcp add genzeb \
  -e GENZEB_DATA_FOLDER=/path/to/your/data/folder \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -- npm --prefix /path/to/genzeb/app run agent
```

Use `OPENAI_API_KEY=sk-...` instead if you prefer OpenAI.

Verify it's registered:

```bash
claude mcp list
```

From then on, Genzeb tools are available in every Claude Code session. You can say things like:
- *"Show me my uncategorized transactions"*
- *"Import this CSV and categorize everything"*
- *"Which receipts are unlinked?"*

---

## Option B — Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "genzeb": {
      "command": "npm",
      "args": ["run", "agent"],
      "cwd": "/path/to/genzeb/app",
      "env": {
        "GENZEB_DATA_FOLDER": "/path/to/your/data/folder",
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

Restart Claude Desktop. The Genzeb tools will appear in the tools panel.

---

## Available tools

| Tool | What it does |
|---|---|
| `import_statements` | Import CSV bank/credit card files |
| `query_transactions` | Search and filter transactions |
| `set_category` | Categorize a transaction (AI-tagged) |
| `set_merchant` | Normalize a merchant name (AI-tagged) |
| `set_notes` | Add a note to a transaction (AI-tagged) |
| `get_receipts` | List all receipts |
| `import_receipts` | Ingest receipt images |
| `run_ocr` | Extract data from a receipt with LLM vision |
| `get_match_candidates` | Find transactions that match a receipt |
| `link_receipt` | Link a receipt to a transaction |
| `materialize` | Rebuild the transaction view after changes |
| `get_changes` | View the full change history |

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `GENZEB_DATA_FOLDER` | Yes | Path to your Genzeb data folder |
| `ANTHROPIC_API_KEY` | One of these | Anthropic API key |
| `OPENAI_API_KEY` | One of these | OpenAI API key (for `run_ocr`) |
| `GENZEB_AGENT_NAME` | No | Name recorded in changes.csv (default: `claude`) |
