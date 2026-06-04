import { cn } from '../../lib/utils'
import {
  Receipt,
  ArrowLeftRight,
  FileText,
  Settings,
  MessageSquare,
  Import,
  List
} from 'lucide-react'

interface SidebarProps {
  currentPage: string
  onNavigate: (page: string) => void
}

const navItems = [
  { id: 'transactions', label: 'Transactions', icon: FileText },
  { id: 'items', label: 'Item Explorer', icon: List },
  { id: 'receipts', label: 'Receipts', icon: Receipt },
  { id: 'reconcile', label: 'Reconcile', icon: ArrowLeftRight },
  { id: 'import', label: 'Import', icon: Import },
  { id: 'ask', label: 'Ask AI', icon: MessageSquare },
  { id: 'settings', label: 'Settings', icon: Settings }
]

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="w-56 border-r bg-muted/30 flex flex-col">
      <div className="p-4 border-b">
        <h1 className="text-lg font-semibold">LedgerBox</h1>
      </div>
      <nav className="flex-1 p-2">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = currentPage === item.id
            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
