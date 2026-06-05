import { cn } from '../../lib/utils'
import {
  Receipt,
  ArrowLeftRight,
  FileText,
  Settings,
  MessageSquare,
  Import,
  List,
  Sun,
  Moon
} from 'lucide-react'

interface SidebarProps {
  currentPage: string
  onNavigate: (page: string) => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
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

function LedgerBoxLogo() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-6 w-6 shrink-0 text-primary"
    >
      {/* Book body */}
      <rect x="4" y="2" width="12" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      {/* Spine */}
      <line x1="7" y1="2" x2="7" y2="18" stroke="currentColor" strokeWidth="1.5" />
      {/* Ledger rows */}
      <line x1="9.5" y1="7"  x2="14" y2="7"  stroke="currentColor" strokeWidth="1.5" />
      <line x1="9.5" y1="11" x2="14" y2="11" stroke="currentColor" strokeWidth="1.5" />
      <line x1="9.5" y1="15" x2="12" y2="15" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

export function Sidebar({ currentPage, onNavigate, theme, onToggleTheme }: SidebarProps) {
  return (
    <aside className="w-56 border-r bg-muted/30 flex flex-col">
      <div className="p-4 border-b flex items-center gap-2.5">
        <LedgerBoxLogo />
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
      <div className="p-3 border-t">
        <button
          onClick={onToggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'dark'
            ? <><Sun className="h-4 w-4" /><span>Light mode</span></>
            : <><Moon className="h-4 w-4" /><span>Dark mode</span></>
          }
        </button>
      </div>
    </aside>
  )
}
