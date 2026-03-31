export interface MigrationStep<T extends { schemaVersion: string }> {
  fromVersion: string
  toVersion: string
  migrate(value: T): T
}

export interface MigrationResult<T extends { schemaVersion: string }> {
  applied: string[]
  fromVersion: string
  toVersion: string
  value: T
}

export function applyMigrations<T extends { schemaVersion: string }>(
  value: T,
  steps: MigrationStep<T>[]
): MigrationResult<T> {
  const applied: string[] = []
  const visited = new Set<string>()
  let current = value

  while (true) {
    if (visited.has(current.schemaVersion)) {
      throw new Error(`Migration cycle detected at ${current.schemaVersion}`)
    }

    visited.add(current.schemaVersion)

    const step = steps.find((candidate) => candidate.fromVersion === current.schemaVersion)
    if (!step) {
      break
    }

    current = step.migrate(current)
    applied.push(`${step.fromVersion} -> ${step.toVersion}`)
  }

  return {
    applied,
    fromVersion: value.schemaVersion,
    toVersion: current.schemaVersion,
    value: current,
  }
}
