import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { setCachedSettings } from './file-system'
import type { AppSettings } from '@core/types'

const DEFAULT_SETTINGS: AppSettings = {
  dataFolder: '',
  autoMaterialize: true
}

function getDefaultDataFolder(): string {
  return join(app.getPath('documents'), 'Genzeb')
}

function getSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

// Load settings from disk
export function loadSettings(): AppSettings {
  const settingsPath = getSettingsPath()

  if (!existsSync(settingsPath)) {
    const defaults: AppSettings = {
      ...DEFAULT_SETTINGS,
      dataFolder: getDefaultDataFolder()
    }
    saveSettings(defaults)
    return defaults
  }

  try {
    const content = readFileSync(settingsPath, 'utf-8')
    const settings = JSON.parse(content) as AppSettings

    // Ensure dataFolder has a default
    if (!settings.dataFolder) {
      settings.dataFolder = getDefaultDataFolder()
    }

    setCachedSettings(settings)
    return settings
  } catch {
    const defaults: AppSettings = {
      ...DEFAULT_SETTINGS,
      dataFolder: getDefaultDataFolder()
    }
    return defaults
  }
}

// Save settings to disk
export function saveSettings(settings: AppSettings): void {
  const settingsPath = getSettingsPath()
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8')
  setCachedSettings(settings)
}

// Update partial settings
export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  const current = loadSettings()
  const updated = { ...current, ...partial }
  saveSettings(updated)
  return updated
}

// Get settings (alias for loadSettings)
export function getSettings(): AppSettings {
  return loadSettings()
}
