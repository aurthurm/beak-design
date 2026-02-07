import { createFileRoute, redirect, Outlet } from '@tanstack/react-router'
import { PagesPanel } from '@/components/editor/PagesPanel'
import { InspectorPanel } from '@/components/editor/InspectorPanel'
import { SidebarProvider, SidebarInset, SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { authStore, isAuthenticated } from '@/lib/auth-store'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useStore } from '@tanstack/react-store'
import { canvasStore, canvasActions } from '@/lib/canvas/store'
import { CanvasToolbar, type ToolType } from '@/components/editor/CanvasToolbar'
import { FloatingCanvasToolbar } from '@/components/canvas/FloatingCanvasToolbar'
import { initializePersistence, setupAutoSave } from '@/lib/db/persistence'
import { AppMenubar } from '@/components/AppMenubar'
import { createEmptyDocument } from '@/lib/canvas/document-init'
import { getDefaultFilePath, createRootFilePath } from '@/lib/utils/path'
import { initMetadataDb, getCurrentWorkspace, getMostRecentlyEditedProject } from '@/lib/db/metadata'

export const Route = createFileRoute('/app')({
  component: AppLayout,
  beforeLoad: async () => {
    // On server-side, allow access (client will handle redirect)
    if (typeof window === 'undefined') {
      return
    }
    
    // Redirect to login if not authenticated
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
  
  // Mark as mounted on client side to prevent hydration mismatches
  useEffect(() => {
    setIsMounted(true)
  }, [])
  
  // Initialize metadata DB and load last edited project
  useEffect(() => {
    let mounted = true
    
    const initialize = async () => {
      if (typeof window === 'undefined') return
      
      await initMetadataDb()
      
      if (!mounted) return
      
      const state = canvasStore.state
      
      // Try to load last edited project (only in Tauri, not browser)
      const { isTauri, readFile, fileExists } = await import('@/lib/utils/tauri-fs')
      const lastProject = getMostRecentlyEditedProject()
      
      if (lastProject && !state.document && isTauri() && lastProject.filePath) {
        console.log('[App Init] Found last edited project:', lastProject.name, 'at', lastProject.filePath)
        
        // Check if file exists before trying to load it
        const exists = await fileExists(lastProject.filePath)
        console.log('[App Init] File exists:', exists)
        
        if (exists) {
          try {
            console.log('[App Init] Loading file:', lastProject.filePath)
            const content = await readFile(lastProject.filePath)
            const { deserializeBeaki } = await import('@/lib/beaki/file-handler')
            const project = deserializeBeaki(content)
            
            console.log('[App Init] File loaded successfully, setting document')
            canvasActions.setDocument(project.document)
            canvasActions.setActivePage(project.document.activePageId)
            canvasActions.setCurrentFilePath(lastProject.filePath)
            
            // Restore viewport if available
            if (project.viewport) {
              canvasActions.setViewport(project.viewport.panX, project.viewport.panY, project.viewport.zoom)
            }
            
            // Restore selection if available
            if (project.selection) {
              canvasActions.setSelection(project.selection)
            }
            
            canvasActions.setSaveStatus('saved')
            console.log('[App Init] ✓ Last edited project loaded successfully')
            return // Don't create default document
          } catch (error) {
            console.error('[App Init] Failed to load last edited project:', error)
            // Fall through to create default document
          }
        } else {
          console.log('[App Init] File does not exist, will create new document')
        }
      } else if (lastProject && !state.document) {
        console.log('[App Init] Last edited project found but cannot auto-load (browser mode or no file path):', lastProject.name, 'at', lastProject.filePath)
      }
      
      // If no document exists, create default
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
        // If document exists but no file path, set default file path
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

  // Initialize persistence and auto-save on mount
  useEffect(() => {
    let unsubscribe: (() => void) | null = null
    
    initializePersistence().then(() => {
      unsubscribe = setupAutoSave()
    }).catch((error) => {
      console.error('Failed to initialize persistence:', error)
    })
    
    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [])
  
  // Show right sidebar when items are selected, hide when nothing is selected
  useEffect(() => {
    const hasSelection = canvasState.selection.selectedIds.length > 0
    setRightSidebarOpen(hasSelection)
  }, [canvasState.selection.selectedIds.length])

  const handleToolChange = (tool: ToolType) => {
    canvasActions.setActiveTool(tool)
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden relative flex-col">
        <AppMenubar />
        <div className="flex flex-1 overflow-hidden relative">
          <PagesPanel />
          <FloatingSidebarTrigger />
          <SidebarInset className="flex flex-col flex-1 min-w-0 relative z-10">
            {/* Floating tools bar - only render on client to prevent hydration mismatch */}
            {isMounted && (
              <div className="absolute top-[32px] left-1/2 -translate-x-1/2 z-20">
                <CanvasToolbar activeTool={activeTool} onToolChange={handleToolChange} />
              </div>
            )}
            <div className="flex flex-1 overflow-hidden relative">
              <main className="flex-1 relative z-0">
                <Outlet />
              </main>
              <div 
                className={cn(
                  "overflow-hidden transition-all duration-300 ease-in-out relative z-20",
                  rightSidebarOpen ? "w-80" : "w-0"
                )}
              >
                <aside 
                  className={cn(
                    "w-80 border-l bg-background h-full overflow-y-auto transition-transform duration-300 ease-in-out",
                    rightSidebarOpen ? "translate-x-0" : "translate-x-full"
                  )}
                >
                  <InspectorPanel />
                </aside>
              </div>
            </div>
            {/* Bottom floating toolbar - only render on client to prevent hydration mismatch */}
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
        left: isOpen ? 'calc(var(--sidebar-width) - 1px)' : 'calc(var(--sidebar-width-icon) - 1px)',
      }}
    >
      <SidebarTrigger 
        className={cn(
          "rounded-r-md rounded-l-none shadow-md border border-l-0 bg-background hover:bg-accent"
        )}
      />
    </div>
  )
}
