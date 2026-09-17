export const NO_ENVIRONMENT = '__none__' as const
export const CREATE_ENVIRONMENT = '__create_environment__' as const
export type EnvironmentSelectValue = string // uuid | '__none__'

export function toSendAccessId(value: EnvironmentSelectValue): string | undefined {
  if (value === NO_ENVIRONMENT || value === CREATE_ENVIRONMENT) return undefined
  return value
}

export function autoSelectAccessId(
  accesses: { id: string }[],
  current: EnvironmentSelectValue
): EnvironmentSelectValue | null {
  if (accesses.length === 1 && current === NO_ENVIRONMENT) {
    return accesses[0].id
  }
  return null
}
