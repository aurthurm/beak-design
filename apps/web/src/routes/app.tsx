import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { useStore } from '@tanstack/react-store'
import { useEffect, useState } from 'react'

import type { ToolType } from '@/components/editor/CanvasToolbar'
import { canvasActions, canvasStore } from '@/lib/canvas/store'
import { createEmptyDocument } from '@/lib/canvas/document-init'
import { FloatingCanvasToolbar } from '@/components/canvas/FloatingCanvasToolbar'
import { PagesPanel } from '@/components/editor/PagesPanel'
import { InspectorPanel } from '@/components/editor/InspectorPanel'
import { AppMenubar } from '@/components/AppMenubar'
import { CanvasToolbar } from '@/components/editor/CanvasToolbar'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { isAuthenticated } from '@/lib/auth-store'
import { cn } from '@/lib/utils'
import { initializePersistence, setupAutoSave } from '@/lib/db/persistence'
import { createRootFilePath, getDefaultFilePath } from '@/lib/utils/path'
import {
  getCurrentWorkspace,
  getMostRecentlyEditedProject,
  initMetadataDb,
} from '@/lib/db/metadata'

export const Route = createFileRoute('/app')({
  component: AppLayout,
  beforeLoad: () => {
    if (typeof window === 'undefined') {
      return
    }

    if (!isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
  },
})

function AppLayout() {
  const canvasState = useStore(canvasStore)
  const activeTool = useStore(canvasStore, (state) => state.activeTool)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    let mounted = true

    const initialize = async () => {
      if (typeof window === 'undefined') return

      await initMetadataDb()

      if (!mounted) return

      const state = canvasStore.state
      const { isTauri, readFile, fileExists } = await import('@/lib/utils/tauri-fs')
      const lastProject = getMostRecentlyEditedProject()

      if (lastProject && !state.document && isTauri() && lastProject.filePath) {
        const exists = await fileExists(lastProject.filePath)

        if (exists) {
          try {
            const content = await readFile(lastProject.filePath)
            const { deserializeBeaki } = await import('@/lib/beaki/file-handler')
            const project = deserializeBeaki(content)

            canvasActions.setDocument(project.document)
            canvasActions.setActivePage(project.document.activePageId)
            canvasActions.setCurrentFilePath(lastProject.filePath)

            if (project.viewport) {
              canvasActions.setViewport(
                project.viewport.panX,
                project.viewport.panY,
                project.viewport.zoom,
              )
            }

            if (project.selection) {
              canvasActions.setSelection(project.selection)
            }

            canvasActions.setSaveStatus('saved')
            return
          } catch (error) {
            console.error('[App Init] Failed to load last edited project:', error)
          }
        }
      }

      if (!state.document) {
        const workspace = getCurrentWorkspace()
        const defaultFilePath = workspace
          ? createRootFilePath('New-Design', workspace)
          : getDefaultFilePath()
        const newDoc = createEmptyDocument('New-Design')
        canvasActions.setDocument(newDoc)
        canvasActions.setActivePage(newDoc.activePageId)
        canvasActions.setCurrentFilePath(defaultFilePath)
        canvasActions.setSaveStatus(null)
      } else if (!state.currentFilePath) {
        const workspace = getCurrentWorkspace()
        const defaultFilePath = workspace
          ? createRootFilePath('New-Design', workspace)
          : getDefaultFilePath()
        canvasActions.setCurrentFilePath(defaultFilePath)
      }
    }

    initialize()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let unsubscribe: (() => void) | null = null

    initializePersistence()
      .then(() => {
        unsubscribe = setupAutoSave()
      })
      .catch((error) => {
        console.error('Failed to initialize persistence:', error)
      })

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [])

  useEffect(() => {
    const hasSelection = canvasState.selection.selectedIds.length > 0
    setRightSidebarOpen(hasSelection)
  }, [canvasState.selection.selectedIds.length])

  const handleToolChange = (tool: ToolType) => {
    canvasActions.setActiveTool(tool)
  }

  return (
    <SidebarProvider>
      <div className="relative flex h-screen w-full flex-col overflow-hidden">
        <AppMenubar />
        <div className="relative flex flex-1 overflow-hidden">
          <PagesPanel />
          <FloatingSidebarTrigger />
          <SidebarInset className="relative z-10 flex min-w-0 flex-1 flex-col">
            {isMounted && (
              <div className="absolute left-1/2 top-[32px] z-20 -translate-x-1/2">
                <CanvasToolbar
                  activeTool={activeTool}
                  onToolChange={handleToolChange}
                />
              </div>
            )}
            <div className="relative flex flex-1 overflow-hidden">
              <main className="relative z-0 flex-1">
                <Outlet />
              </main>
              <div
                className={cn(
                  'relative z-20 overflow-hidden transition-all duration-300 ease-in-out',
                  rightSidebarOpen ? 'w-80' : 'w-0',
                )}
              >
                <aside
                  className={cn(
                    'h-full w-80 overflow-y-auto border-l bg-background transition-transform duration-300 ease-in-out',
                    rightSidebarOpen ? 'translate-x-0' : 'translate-x-full',
                  )}
                >
                  <InspectorPanel />
                </aside>
              </div>
            </div>
            {isMounted && <FloatingCanvasToolbar />}
          </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  )
}

function FloatingSidebarTrigger() {
  const { state } = useSidebar()
  const isOpen = state === 'expanded'

  return (
    <div
      className="absolute top-[calc(2rem+1rem)] z-30 transition-all duration-300"
      data-state={state}
      style={{
        left: isOpen
          ? 'calc(var(--sidebar-width) - 1px)'
          : 'calc(var(--sidebar-width-icon) - 1px)',
      }}
    >
      <SidebarTrigger className="rounded-l-none rounded-r-md border border-l-0 bg-background shadow-md hover:bg-accent" />
    </div>
  )
}
