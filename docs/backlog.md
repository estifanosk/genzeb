# Genzeb — Feature Backlog

Features and cleanup that are still genuinely outstanding, roughly in priority order.

## Ask AI context handling

Ask AI now supports multi-turn conversation history, but each turn still rebuilds and sends the filtered transaction CSV in the system prompt.

Decide whether to keep that simpler behavior or optimize by creating a conversation-scoped transaction context so rows are sent once per conversation. If optimized, add a "New conversation" reset that clears both turns and the cached data context.

---

## Reconcile IPC cleanup

The Reconcile page is receipt-centric and uses `GET_CANDIDATES_FOR_RECEIPT`, `LINK_RECEIPT`, `UNLINK_RECEIPT`, and `GET_LINKS`.

`GET_MATCH_SUGGESTIONS` is an older transaction-centric endpoint that still returns `[]`. Either remove it from the IPC surface or wire it to real scoring if a transaction-centric reconcile flow is still useful.

---

## E2E test hardening

The Playwright suite now covers launch, navigation, transactions, search/edit, split creation, import UI, AI badge, reconcile link/unlink, Ask AI empty/key states, settings basics, and receipts.

Remaining high-value coverage:

- Make E2E seed fixtures work without network access; they currently invoke `npx tsx`.
- Settings data folder selection and persistence.
- Receipt OCR retry button state and failure handling with a mocked provider.
