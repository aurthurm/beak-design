import { beforeEach, describe, expect, it } from 'vitest'
import { createAuthStore, type StorageLike } from './auth-store'

function createMemoryStorage(): StorageLike {
  const store = new Map<string, string>()

  return {
    getItem(key) {
      return store.get(key) ?? null
    },
    setItem(key, value) {
      store.set(key, value)
    },
    removeItem(key) {
      store.delete(key)
    },
  }
}

describe('createAuthStore', () => {
  let storage: StorageLike

  beforeEach(() => {
    storage = createMemoryStorage()
  })

  it('logs in and persists auth state', async () => {
    const auth = createAuthStore({
      storage,
      usersDb: {
        initUsersDb: async () => null,
        verifyCredentials: async (username, password) =>
          username === 'admin' && password === 'admin',
      },
    })

    await expect(auth.login('admin', 'admin')).resolves.toBe(true)
    expect(auth.authStore.state).toEqual({
      isAuthenticated: true,
      username: 'admin',
    })
    expect(storage.getItem('beak-auth')).toContain('"isAuthenticated":true')
  })

  it('logs out and clears auth state', () => {
    const auth = createAuthStore({ storage })

    auth.authStore.setState({
      isAuthenticated: true,
      username: 'admin',
    })
    auth.logout()

    expect(auth.authStore.state).toEqual({
      isAuthenticated: false,
      username: null,
    })
    expect(storage.getItem('beak-auth')).toContain('"isAuthenticated":false')
  })

  it('hydrates auth state from storage', () => {
    storage.setItem(
      'beak-auth',
      JSON.stringify({
        isAuthenticated: true,
        username: 'admin',
      }),
    )

    const auth = createAuthStore({ storage })

    expect(auth.isAuthenticated()).toBe(true)
    expect(auth.authStore.state).toEqual({
      isAuthenticated: true,
      username: 'admin',
    })
  })
})
