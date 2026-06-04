import { Receipt } from 'lucide-react'

export function ReceiptsPage() {
  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Receipts</h2>
      </div>

      <div className="flex-1 flex items-center justify-center border-2 border-dashed rounded-lg">
        <div className="text-center text-muted-foreground">
          <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No receipts yet</p>
          <p className="text-sm mt-1">Drop receipt images into your Inbox folder</p>
        </div>
      </div>
    </div>
  )
}
