import { MessageSquare } from 'lucide-react'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'

export function AskPage() {
  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Ask AI</h2>
      </div>

      <div className="flex-1 flex items-center justify-center border-2 border-dashed rounded-lg mb-4">
        <div className="text-center text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">AI Assistant</p>
          <p className="text-sm mt-1">
            Ask questions about your expenses using natural language
          </p>
          <p className="text-xs mt-4 text-muted-foreground/70">Coming soon</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Input placeholder="Ask a question about your expenses..." disabled className="flex-1" />
        <Button disabled>Ask</Button>
      </div>
    </div>
  )
}
