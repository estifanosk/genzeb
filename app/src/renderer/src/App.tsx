import { useState, useEffect } from 'react'
import { Sidebar } from './components/layout/Sidebar'
import { useTheme } from './hooks/useTheme'
import { DashboardPage } from './pages/DashboardPage'
import { TransactionsPage } from './pages/TransactionsPage'
import { ItemExplorerPage } from './pages/ItemExplorerPage'
import { ReceiptsPage } from './pages/ReceiptsPage'
import { ReconcilePage } from './pages/ReconcilePage'
import { ImportPage } from './pages/ImportPage'
import { AskPage } from './pages/AskPage'
import { SettingsPage } from './pages/SettingsPage'
import { useSettingsStore } from './stores/settings'

type PageId =
  | 'dashboard'
  | 'transactions'
  | 'items'
  | 'receipts'
  | 'reconcile'
  | 'import'
  | 'ask'
  | 'settings'

function App() {
  const [currentPage, setCurrentPage] = useState<PageId>('dashboard')
  const { loadSettings, settings } = useSettingsStore()
  const { theme, toggleTheme } = useTheme()

  // Load settings on mount
  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // If no data folder is set, redirect to settings
  useEffect(() => {
    if (settings && !settings.dataFolder) {
      setCurrentPage('settings')
    }
  }, [settings])

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage />
      case 'transactions':
        return <TransactionsPage onNavigate={(page) => setCurrentPage(page as PageId)} />
      case 'items':
        return <ItemExplorerPage />
      case 'receipts':
        return <ReceiptsPage onNavigate={(page) => setCurrentPage(page as PageId)} />
      case 'reconcile':
        return <ReconcilePage onNavigate={(page) => setCurrentPage(page as PageId)} />
      case 'import':
        return <ImportPage />
      case 'ask':
        return <AskPage />
      case 'settings':
        return <SettingsPage />
      default:
        return <DashboardPage />
    }
  }

  return (
    <div className="flex h-screen min-h-0 min-w-0 bg-background">
      <Sidebar currentPage={currentPage} onNavigate={(page) => setCurrentPage(page as PageId)} theme={theme} onToggleTheme={toggleTheme} />
      <main className="min-h-0 min-w-0 flex-1 overflow-hidden">{renderPage()}</main>
    </div>
  )
}

export default App
