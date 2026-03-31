import { Store } from '@tanstack/store'
import { initUsersDb as initDefaultUsersDb, verifyCredentials as verifyDefaultCredentials } from './users-db'

export interface AuthState {
  isAuthenticated: boolean
  username: string | null
}

export interface AuthDependencies {
  storage?: StorageLike
  storageKey?: string
  usersDb?: {
    initUsersDb(): Promise<any>
    verifyCredentials(username: string, password: string): Promise<boolean>
  }
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const DEFAULT_STORAGE_KEY = 'beak-auth'

function getStorage(deps: AuthDependencies): StorageLike | null {
  if (deps.storage) {
    return deps.storage
  }

  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage
}

export function createAuthStore(deps: AuthDependencies = {}) {
  const storageKey = deps.storageKey ?? DEFAULT_STORAGE_KEY
  const storage = getStorage(deps)
  const usersDb = deps.usersDb ?? {
    initUsersDb: initDefaultUsersDb,
    verifyCredentials: verifyDefaultCredentials,
  }

  function readStateFromStorage(): AuthState {
    if (!storage) {
      return { isAuthenticated: false, username: null }
    }

    try {
      const stored = storage.getItem(storageKey)
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<AuthState>
        return {
          isAuthenticated: parsed.isAuthenticated || false,
          username: parsed.username || null,
        }
      }
    } catch (error) {
      console.error('Failed to load auth from storage:', error)
    }

    return { isAuthenticated: false, username: null }
  }

  function persistState(state: AuthState) {
    if (!storage) {
      return
    }

    try {
      storage.setItem(storageKey, JSON.stringify(state))
    } catch (error) {
      console.error('Failed to save auth to storage:', error)
    }
  }

  const authStore = new Store<AuthState>(readStateFromStorage())

  authStore.subscribe((state) => {
    persistState(state)
  })

  if (storage) {
    const stored = readStateFromStorage()
    if (
      stored.isAuthenticated !== authStore.state.isAuthenticated ||
      stored.username !== authStore.state.username
    ) {
      authStore.setState(stored)
    }
  }

  async function login(username: string, password: string): Promise<boolean> {
    try {
      await usersDb.initUsersDb()

      const isValid = await usersDb.verifyCredentials(username, password)

      if (isValid) {
        const newState: AuthState = {
          isAuthenticated: true,
          username,
        }
        authStore.setState(newState)
        persistState(newState)
        return true
      }

      return false
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  }

  function logout() {
    authStore.setState({
      isAuthenticated: false,
      username: null,
    })
  }

  function initializeAuth() {
    authStore.setState(readStateFromStorage())
  }

  function isAuthenticated(): boolean {
    if (!storage) {
      return false
    }

    const stored = readStateFromStorage()

    if (
      stored.isAuthenticated !== authStore.state.isAuthenticated ||
      stored.username !== authStore.state.username
    ) {
      authStore.setState(stored)
    }

    return stored.isAuthenticated
  }

  return {
    authStore,
    initializeAuth,
    isAuthenticated,
    login,
    logout,
  }
}

const defaultAuth = createAuthStore()

export const authStore = defaultAuth.authStore
export const initializeAuth = defaultAuth.initializeAuth
export const isAuthenticated = defaultAuth.isAuthenticated
export const login = defaultAuth.login
export const logout = defaultAuth.logout
