import { describe, expect, it } from 'vitest'

import { applyMigrations, type MigrationStep } from './migration'

describe('storage-core migrations', () => {
  it('applies migrations in sequence', () => {
    const steps: MigrationStep<{ schemaVersion: string; value: number }>[] = [
      {
        fromVersion: '1.0.0',
        toVersion: '1.1.0',
        migrate: (input) => ({ ...input, schemaVersion: '1.1.0', value: input.value + 1 }),
      },
      {
        fromVersion: '1.1.0',
        toVersion: '1.2.0',
        migrate: (input) => ({ ...input, schemaVersion: '1.2.0', value: input.value + 1 }),
      },
    ]

    const result = applyMigrations({ schemaVersion: '1.0.0', value: 1 }, steps)

    expect(result.fromVersion).toBe('1.0.0')
    expect(result.toVersion).toBe('1.2.0')
    expect(result.applied).toEqual(['1.0.0 -> 1.1.0', '1.1.0 -> 1.2.0'])
    expect(result.value).toEqual({ schemaVersion: '1.2.0', value: 3 })
  })

  it('rejects migration cycles', () => {
    const step: MigrationStep<{ schemaVersion: string }> = {
      fromVersion: '1.0.0',
      toVersion: '1.0.0',
      migrate: (input) => ({ ...input }),
    }

    expect(() => applyMigrations({ schemaVersion: '1.0.0' }, [step])).toThrow(
      'Migration cycle detected at 1.0.0'
    )
  })
})
