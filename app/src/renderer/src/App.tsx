import { useState, useEffect } from 'react'
import { Sidebar } from './components/layout/Sidebar'
import { TransactionsPage } from './pages/TransactionsPage'
import { ItemExplorerPage } from './pages/ItemExplorerPage'
import { ReceiptsPage } from './pages/ReceiptsPage'
import { ReconcilePage } from './pages/ReconcilePage'
import { ImportPage } from './pages/ImportPage'
import { AskPage } from './pages/AskPage'
import { SettingsPage } from './pages/SettingsPage'
import { useSettingsStore } from './stores/settings'

type PageId =
  | 'transactions'
  | 'items'
  | 'receipts'
  | 'reconcile'
  | 'import'
  | 'ask'
  | 'settings'

function App() {
  const [currentPage, setCurrentPage] = useState<PageId>('transactions')
  const { loadSettings, settings } = useSettingsStore()

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
      case 'transactions':
        return <TransactionsPage />
      case 'items':
        return <ItemExplorerPage />
      case 'receipts':
        return <ReceiptsPage />
      case 'reconcile':
        return <ReconcilePage />
      case 'import':
        return <ImportPage />
      case 'ask':
        return <AskPage />
      case 'settings':
        return <SettingsPage />
      default:
        return <TransactionsPage />
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar currentPage={currentPage} onNavigate={(page) => setCurrentPage(page as PageId)} />
      <main className="flex-1 overflow-auto">{renderPage()}</main>
    </div>
  )
}

export default App
