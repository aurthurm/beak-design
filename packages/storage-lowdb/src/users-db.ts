export interface User {
  username: string
  password: string
}

export interface UsersData {
  users: User[]
}

export interface UsersDbOptions {
  key?: string
}

function createDefaultData(): UsersData {
  return { users: [] }
}

export interface UsersDbStore {
  db: any
  initUsersDb(): Promise<any>
  getUserByUsername(username: string): Promise<User | null>
  verifyCredentials(username: string, password: string): Promise<boolean>
}

export function createUsersDb(options: UsersDbOptions = {}): UsersDbStore {
  const dbKey = options.key ?? 'beak-users-db'
  let db: any = null

  async function initUsersDb(): Promise<any> {
    if (typeof window === 'undefined') {
      return null
    }

    try {
      if (!db) {
        const { LocalStoragePreset } = await import('lowdb/browser')
        db = await LocalStoragePreset<UsersData>(dbKey, createDefaultData())
      }

      if (db.data.users.length === 0) {
        db.data.users = [
          {
            username: 'admin',
            password: 'admin',
          },
        ]
        await db.write()
      }

      return db
    } catch (error) {
      console.error('Failed to initialize users database:', error)
      throw error
    }
  }

  async function getUserByUsername(username: string): Promise<User | null> {
    if (typeof window === 'undefined') {
      return null
    }

    if (!db) {
      await initUsersDb()
    }

    if (!db) {
      return null
    }

    return db.data.users.find((user: User) => user.username === username) || null
  }

  async function verifyCredentials(username: string, password: string): Promise<boolean> {
    if (typeof window === 'undefined') {
      return false
    }

    try {
      if (!db) {
        await initUsersDb()
      }

      if (!db) {
        console.error('Database not initialized')
        return false
      }

      const user = db.data.users.find(
        (candidate: User) => candidate.username === username && candidate.password === password
      )

      return !!user
    } catch (error) {
      console.error('Error verifying credentials:', error)
      return false
    }
  }

  return {
    get db() {
      return db
    },
    initUsersDb,
    getUserByUsername,
    verifyCredentials,
  }
}

const defaultStore = createUsersDb()

export let usersDb: any = null

export async function initUsersDb(): Promise<any> {
  usersDb = await defaultStore.initUsersDb()
  return usersDb
}

export function getUserByUsername(username: string): Promise<User | null> {
  return defaultStore.getUserByUsername(username)
}

export function verifyCredentials(username: string, password: string): Promise<boolean> {
  return defaultStore.verifyCredentials(username, password)
}

export function getUsersDb() {
  return defaultStore.db
}
