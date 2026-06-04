import type { LedgerBoxAPI } from '../shared/types/ipc'

declare global {
  interface Window {
    api: LedgerBoxAPI
  }
}
