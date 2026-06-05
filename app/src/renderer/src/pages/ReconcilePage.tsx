import { ArrowLeftRight, Receipt } from 'lucide-react'
import { Button } from '../components/ui/button'

export function ReconcilePage({ onNavigate }: { onNavigate?: (page: string) => void }) {
  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Reconcile</h2>
          <p className="text-sm text-muted-foreground mt-1">Match unlinked receipts to transactions</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center border-2 border-dashed rounded-lg">
        <div className="text-center text-muted-foreground">
          <ArrowLeftRight className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">Reconciliation coming soon</p>
          <p className="text-sm mt-2 max-w-xs mx-auto">
            In the meantime, you can view and manually link unlinked receipts from the Receipts page.
          </p>
          {onNavigate && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => onNavigate('receipts')}
            >
              <Receipt className="h-4 w-4 mr-2" />
              View Receipts
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
