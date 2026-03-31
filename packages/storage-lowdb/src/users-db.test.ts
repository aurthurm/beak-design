// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { createUsersDb } from './users-db'

afterEach(() => {
  localStorage.clear()
})

describe('createUsersDb', () => {
  it('seeds a default admin user and verifies credentials', async () => {
    const store = createUsersDb({ key: 'beak-users-db-test-1' })

    await store.initUsersDb()

    expect(await store.getUserByUsername('admin')).toEqual({
      username: 'admin',
      password: 'admin',
    })
    expect(await store.verifyCredentials('admin', 'admin')).toBe(true)
    expect(await store.verifyCredentials('admin', 'bad')).toBe(false)
  })

  it('reads users from the shared local storage preset', async () => {
    const store = createUsersDb({ key: 'beak-users-db-test-2' })
    await store.initUsersDb()

    const usersDb = store.db
    usersDb.data.users.push({ username: 'alice', password: 'secret' })
    await usersDb.write()

    expect(await store.getUserByUsername('alice')).toEqual({
      username: 'alice',
      password: 'secret',
    })
  })
})
