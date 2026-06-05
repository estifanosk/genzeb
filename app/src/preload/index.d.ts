import type { GenzebAPI } from '@core/types/ipc'

declare global {
  interface Window {
    api: GenzebAPI
  }
}
