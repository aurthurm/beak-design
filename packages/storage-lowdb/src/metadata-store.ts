import { LocalStoragePreset } from 'lowdb/browser'

export interface ProjectHistory {
  filePath: string
  name: string
  lastOpened: string
  lastEdited: string
  workspacePath: string
}

export interface WorkspaceHistory {
  path: string
  name: string
  lastUsed: string
  handleId?: string
}

export interface AppMetadata {
  currentWorkspace: string | null
  currentWorkspaceHandleId: string | null
  projectHistory: ProjectHistory[]
  workspaceHistory: WorkspaceHistory[]
  lastOpenedProject: string | null
}

export interface MetadataStoreDeps {
  isTauri: () => boolean
  storeDirectoryHandle: (handle: FileSystemDirectoryHandle, key: string) => Promise<string>
  getDirectoryHandle: (handleId: string) => Promise<FileSystemDirectoryHandle | null>
  now: () => string
}

export interface MetadataStore {
  initMetadataDb(): Promise<void>
  getCurrentWorkspace(): string | null
  setCurrentWorkspace(
    workspacePath: string,
    workspaceHandle?: string | FileSystemDirectoryHandle | null,
    workspaceName?: string
  ): Promise<void>
  getCurrentWorkspaceHandle(): Promise<string | FileSystemDirectoryHandle | null>
  addProjectToHistory(filePath: string, name: string, workspacePath: string): Promise<void>
  updateProjectLastEdited(filePath: string): Promise<void>
  getProjectHistory(): ProjectHistory[]
  getWorkspaceHistory(): WorkspaceHistory[]
  getLastOpenedProject(): ProjectHistory | null
  getMostRecentlyEditedProject(): ProjectHistory | null
}

const defaultData: AppMetadata = {
  currentWorkspace: null,
  currentWorkspaceHandleId: null,
  projectHistory: [],
  workspaceHistory: [],
  lastOpenedProject: null,
}

function createDefaultData(): AppMetadata {
  return {
    ...defaultData,
    projectHistory: [],
    workspaceHistory: [],
  }
}

export function createMetadataStore(deps: MetadataStoreDeps): MetadataStore {
  let db: ReturnType<typeof LocalStoragePreset<AppMetadata>> | null = null

  async function initMetadataDb(): Promise<void> {
    if (typeof window === 'undefined') return

    db = LocalStoragePreset<AppMetadata>('beak_metadata', defaultData)

    if (!db.data) {
      db.data = createDefaultData()
      db.write()
    }
  }

  function getDb(): ReturnType<typeof LocalStoragePreset<AppMetadata>> {
    if (!db) {
      throw new Error('Metadata database not initialized. Call initMetadataDb() first.')
    }
    return db
  }

  function getCurrentWorkspace(): string | null {
    return getDb().data.currentWorkspace
  }

  async function setCurrentWorkspace(
    workspacePath: string,
    workspaceHandle?: string | FileSystemDirectoryHandle | null,
    workspaceName?: string
  ): Promise<void> {
    const metadataDb = getDb()
    metadataDb.data.currentWorkspace = workspacePath

    let handleId: string | null = null
    if (workspaceHandle && typeof workspaceHandle !== 'string') {
      try {
        handleId = await deps.storeDirectoryHandle(workspaceHandle, `workspace_${Date.now()}`)
        metadataDb.data.currentWorkspaceHandleId = handleId
      } catch (error) {
        console.error('Failed to store workspace handle:', error)
      }
    } else {
      metadataDb.data.currentWorkspaceHandleId = null
    }

    const existingIndex = metadataDb.data.workspaceHistory.findIndex((entry) => entry.path === workspacePath)
    const workspaceEntry: WorkspaceHistory = {
      path: workspacePath,
      name: workspaceName || workspacePath.split(/[/\\]/).pop() || 'Workspace',
      lastUsed: deps.now(),
      handleId: handleId || undefined,
    }

    if (existingIndex >= 0) {
      metadataDb.data.workspaceHistory[existingIndex] = workspaceEntry
    } else {
      metadataDb.data.workspaceHistory.unshift(workspaceEntry)
    }

    metadataDb.data.workspaceHistory = metadataDb.data.workspaceHistory.slice(0, 10)
    metadataDb.write()
  }

  async function getCurrentWorkspaceHandle(): Promise<string | FileSystemDirectoryHandle | null> {
    const metadataDb = getDb()
    const workspacePath = metadataDb.data.currentWorkspace

    if (!workspacePath) {
      return null
    }

    if (deps.isTauri()) {
      return workspacePath
    }

    if (metadataDb.data.currentWorkspaceHandleId) {
      const handle = await deps.getDirectoryHandle(metadataDb.data.currentWorkspaceHandleId)
      if (handle) {
        return handle
      }
    }

    return null
  }

  async function addProjectToHistory(filePath: string, name: string, workspacePath: string): Promise<void> {
    const metadataDb = getDb()
    const now = deps.now()

    metadataDb.data.projectHistory = metadataDb.data.projectHistory.filter((project) => project.filePath !== filePath)
    metadataDb.data.projectHistory.unshift({
      filePath,
      name,
      lastOpened: now,
      lastEdited: now,
      workspacePath,
    })
    metadataDb.data.projectHistory = metadataDb.data.projectHistory.slice(0, 50)
    metadataDb.data.lastOpenedProject = filePath
    metadataDb.write()
  }

  async function updateProjectLastEdited(filePath: string): Promise<void> {
    const metadataDb = getDb()
    const project = metadataDb.data.projectHistory.find((entry) => entry.filePath === filePath)
    if (project) {
      project.lastEdited = deps.now()
      metadataDb.write()
    }
  }

  function getProjectHistory(): ProjectHistory[] {
    return [...getDb().data.projectHistory]
  }

  function getWorkspaceHistory(): WorkspaceHistory[] {
    return [...getDb().data.workspaceHistory]
  }

  function getLastOpenedProject(): ProjectHistory | null {
    const metadataDb = getDb()
    if (!metadataDb.data.lastOpenedProject) return null
    return metadataDb.data.projectHistory.find((project) => project.filePath === metadataDb.data.lastOpenedProject) || null
  }

  function getMostRecentlyEditedProject(): ProjectHistory | null {
    const metadataDb = getDb()
    if (metadataDb.data.projectHistory.length === 0) return null

    const sorted = [...metadataDb.data.projectHistory].sort(
      (a, b) => new Date(b.lastEdited).getTime() - new Date(a.lastEdited).getTime()
    )
    return sorted[0] || null
  }

  return {
    initMetadataDb,
    getCurrentWorkspace,
    setCurrentWorkspace,
    getCurrentWorkspaceHandle,
    addProjectToHistory,
    updateProjectLastEdited,
    getProjectHistory,
    getWorkspaceHistory,
    getLastOpenedProject,
    getMostRecentlyEditedProject,
  }
}

const defaultStore = createMetadataStore({
  isTauri: () => false,
  storeDirectoryHandle: async () => {
    throw new Error('storeDirectoryHandle is not configured')
  },
  getDirectoryHandle: async () => null,
  now: () => new Date().toISOString(),
})

export const initMetadataDb = defaultStore.initMetadataDb
export const getCurrentWorkspace = defaultStore.getCurrentWorkspace
export const setCurrentWorkspace = defaultStore.setCurrentWorkspace
export const getCurrentWorkspaceHandle = defaultStore.getCurrentWorkspaceHandle
export const addProjectToHistory = defaultStore.addProjectToHistory
export const updateProjectLastEdited = defaultStore.updateProjectLastEdited
export const getProjectHistory = defaultStore.getProjectHistory
export const getWorkspaceHistory = defaultStore.getWorkspaceHistory
export const getLastOpenedProject = defaultStore.getLastOpenedProject
export const getMostRecentlyEditedProject = defaultStore.getMostRecentlyEditedProject
