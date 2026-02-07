import { createFileRoute } from '@tanstack/react-router'
import { CanvasViewport } from '@/components/canvas/CanvasViewport'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { useChat } from '@/hooks/useChat'
import { useStore } from '@tanstack/react-store'
import { canvasStore } from '@/lib/canvas/store'

export const Route = createFileRoute('/app/canvas/')({
  component: CanvasPage,
})

function CanvasPage() {
  // Note: Default document initialization happens in AppLayout
  // This component just ensures the canvas is ready to render
  const selection = useStore(canvasStore, (state) => state.selection)
  const selectedIDs = selection.selectedIds || []

  const chat = useChat({ selectedIDs })

  return (
    <div className="w-full h-full relative overflow-hidden">
      <CanvasViewport className="w-full h-full" />
      <ChatPanel
        selectedIDs={selectedIDs}
        {...chat}
      />
    </div>
  )
}
