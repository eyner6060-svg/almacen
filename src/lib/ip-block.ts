interface BlockEntry {
  attempts: number
  firstAttempt: number
  blockedUntil: number | null
}

const ipStore = new Map<string, BlockEntry>()

const WINDOW_MS = 15 * 60 * 1000

export { ipStore, WINDOW_MS }
