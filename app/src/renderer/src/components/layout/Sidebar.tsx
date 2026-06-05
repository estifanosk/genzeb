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

type NavItem = { id: string; label: string; icon: React.ElementType }
type NavGroup = { label?: string; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    items: [
      { id: 'transactions', label: 'Transactions', icon: FileText },
      { id: 'receipts',     label: 'Receipts',     icon: Receipt },
      { id: 'items',        label: 'Item Explorer', icon: List },
    ]
  },
  {
    label: 'Manage',
    items: [
      { id: 'import',     label: 'Import',     icon: Import },
      { id: 'reconcile',  label: 'Reconcile',  icon: ArrowLeftRight },
    ]
  },
  {
    label: 'Tools',
    items: [
      { id: 'ask',      label: 'Ask AI',   icon: MessageSquare },
      { id: 'settings', label: 'Settings', icon: Settings },
    ]
  }
]

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="w-56 border-r bg-muted/30 flex flex-col">
      <div className="p-4 border-b">
        <h1 className="text-lg font-semibold">LedgerBox</h1>
      </div>
      <nav className="flex-1 p-2 overflow-y-auto">
        {navGroups.map((group, gi) => (
          <div key={gi} className={gi > 0 ? 'mt-4' : ''}>
            {group.label && (
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
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
          </div>
        ))}
      </nav>
    </aside>
  )
}
