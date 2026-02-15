export type StateInfo = {
  searchUrlId: string
  fipsCode: number
  name: string
  slug: string
}

export const STATE_INFO: Record<string, StateInfo> = {} as const
