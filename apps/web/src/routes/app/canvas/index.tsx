import { createFileRoute } from '@tanstack/react-router'
import { useStore } from '@tanstack/react-store'
import { CanvasViewport } from '@/components/canvas/CanvasViewport'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { useChat } from '@/hooks/useChat'
import { canvasStore } from '@/lib/canvas/store'

export const Route = createFileRoute('/app/canvas/')({
  component: CanvasPage,
})

function CanvasPage() {
  const selection = useStore(canvasStore, (state) => state.selection)
  const selectedIDs = selection.selectedIds
  const chat = useChat({ selectedIDs })

  return (
    <div className="relative h-full w-full overflow-hidden">
      <CanvasViewport className="h-full w-full" />
      <ChatPanel
        selectedIDs={selectedIDs}
        {...chat}
      />
    </div>
  )
}
