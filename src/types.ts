export interface StaleOptions {
  /** Time before data is considered stale. String ('30s', '5m', '1h') or ms number. */
  ttl: string | number
  /** Async function that returns fresh data. */
  refetch: () => Promise<unknown>
  /** Apply fetched data to the element. */
  update: (el: HTMLElement, data: unknown) => void
  /** Called when refetch throws. */
  onError?: (err: Error) => void
  /** Refetch immediately on init (default: true). */
  eager?: boolean
  /** Pause TTL clock when tab is hidden (default: true). */
  visibilityPause?: boolean
  /** Pause TTL clock when element is out of viewport (default: true). */
  intersectionPause?: boolean
  /** Refetch immediately when network comes back online (default: true). */
  reconnectRefetch?: boolean
  /** Refetch when tab regains focus if data is stale (default: true). */
  focusRefetch?: boolean
}

export interface StaleConfig {
  ttl?: string | number
  visibilityPause?: boolean
  intersectionPause?: boolean
  reconnectRefetch?: boolean
  focusRefetch?: boolean
  eager?: boolean
}

export interface StaleBinding {
  el: HTMLElement
  options: Required<StaleOptions>
  lastFetched: number
  ttlMs: number
  paused: boolean
  intervalId: ReturnType<typeof setInterval> | null
  isFetching: boolean
  cleanupFns: Array<() => void>
}
