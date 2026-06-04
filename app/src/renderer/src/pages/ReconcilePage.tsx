import { ArrowLeftRight } from 'lucide-react'

export function ReconcilePage() {
  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Reconcile</h2>
      </div>

      <div className="flex-1 flex items-center justify-center border-2 border-dashed rounded-lg">
        <div className="text-center text-muted-foreground">
          <ArrowLeftRight className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">Nothing to reconcile</p>
          <p className="text-sm mt-1">Import transactions and receipts to start matching</p>
        </div>
      </div>
    </div>
  )
}
