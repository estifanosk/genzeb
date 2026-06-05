# Genzeb — Feature Backlog

Features to build next, roughly in priority order.

---

## Ask AI: multi-turn conversation

Upgrade from single-shot to multi-turn. Send prior turns as message history so the AI can reference earlier answers. Transaction CSV goes in the system prompt once per conversation, not re-sent every turn. Add a "New conversation" button to reset the thread.

---

## Transaction split UI

Core and materializer already handle splits — there's just no UI for it. Add a split button on a transaction row that lets the user divide it into child rows with separate amounts, categories, and notes. Writes a `split` change to `changes.csv`.

---

## Re-run OCR on failed receipts

The `RUN_OCR` IPC handler is a no-op stub. Wire it to `runReceiptLlmExtract()` so the Receipts page can retry OCR on receipts with `ocr_status = 'failed'`. Requires OpenAI key.

---

## Expand E2E test coverage

Current Playwright suite covers launch, seeded transactions, and navigation. Missing:
- Reconcile flow — link a receipt to a transaction, verify it moves to linked
- AI badge — seed an agent change, verify badge appears in transactions table
- Import via UI — drive the full import flow rather than pre-seeding
- Settings — API key entry and data folder selection

---

## Virtualise transactions table

The transactions table renders all rows in the DOM. Use `@tanstack/react-virtual` (already in dependencies) to render only visible rows. Needed once datasets grow past a few hundred transactions.
