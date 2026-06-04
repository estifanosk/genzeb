import { create } from 'zustand'
import type { AppSettings } from '@core/types'

interface SettingsState {
  settings: AppSettings | null
  isLoading: boolean
  error: string | null
  loadSettings: () => Promise<void>
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>
  selectDataFolder: () => Promise<string | null>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  isLoading: true,
  error: null,

  loadSettings: async () => {
    set({ isLoading: true, error: null })
    try {
      const settings = await window.api.getSettings()
      set({ settings, isLoading: false })
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false })
    }
  },

  updateSettings: async (partial) => {
    const current = get().settings
    if (!current) return

    try {
      await window.api.saveSettings(partial)
      set({ settings: { ...current, ...partial } })
    } catch (err) {
      set({ error: (err as Error).message })
    }
  },

  selectDataFolder: async () => {
    try {
      const folder = await window.api.selectDataFolder()
      if (folder) {
        await get().updateSettings({ dataFolder: folder })
        await window.api.ensureDataStructure()
      }
      return folder
    } catch (err) {
      set({ error: (err as Error).message })
      return null
    }
  }
}))
