import { Store } from '@tanstack/store'

interface AuthState {
  isAuthenticated: boolean
  username: string | null
}

const AUTH_STORAGE_KEY = 'beak-auth'

// Load initial state from localStorage
function loadAuthFromStorage(): AuthState {
  if (typeof window === 'undefined') {
    return { isAuthenticated: false, username: null }
  }

  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return {
        isAuthenticated: parsed.isAuthenticated || false,
        username: parsed.username || null,
      }
    }
  } catch (error) {
    console.error('Failed to load auth from localStorage:', error)
  }

  return { isAuthenticated: false, username: null }
}

// Save auth state to localStorage
function saveAuthToStorage(state: AuthState) {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state))
  } catch (error) {
    console.error('Failed to save auth to localStorage:', error)
  }
}

// Initialize store with localStorage data
const initialAuthState = loadAuthFromStorage()
export const authStore = new Store<AuthState>(initialAuthState)

// Subscribe to state changes and persist to localStorage
authStore.subscribe((state) => {
  saveAuthToStorage(state)
})

// Ensure auth state is synced on module load (for SSR/hydration scenarios)
if (typeof window !== 'undefined') {
  // Re-sync from localStorage in case it was updated elsewhere
  const stored = loadAuthFromStorage()
  if (stored.isAuthenticated !== authStore.state.isAuthenticated || 
      stored.username !== authStore.state.username) {
    authStore.setState(stored)
  }
}

export async function login(username: string, password: string): Promise<boolean> {
  try {
    // Ensure database is initialized
    const { initUsersDb, verifyCredentials } = await import('./db/users')
    await initUsersDb()
    
    const isValid = await verifyCredentials(username, password)
    
    if (isValid) {
      const newState = {
        isAuthenticated: true,
        username: username,
      }
      authStore.setState(newState)
      
      // Force immediate localStorage update
      saveAuthToStorage(newState)
      
      return true
    }
    return false
  } catch (error) {
    console.error('Login error:', error)
    throw error
  }
}

export function logout() {
  authStore.setState({
    isAuthenticated: false,
    username: null,
  })
}

// Initialize auth state from localStorage (call this on app startup)
export function initializeAuth() {
  const stored = loadAuthFromStorage()
  authStore.setState(stored)
}

// Check if user is authenticated (always checks localStorage for latest state)
export function isAuthenticated(): boolean {
  // Always check localStorage directly to ensure we have the latest state
  // This is important for beforeLoad hooks that run before React hydration
  if (typeof window === 'undefined') {
    return false
  }
  
  const stored = loadAuthFromStorage()
  
  // Sync store state if it differs from localStorage
  if (stored.isAuthenticated !== authStore.state.isAuthenticated ||
      stored.username !== authStore.state.username) {
    authStore.setState(stored)
  }
  
  return stored.isAuthenticated
}
