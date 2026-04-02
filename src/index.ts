import { parseTTL } from './parse-ttl'
import { observeVisibility } from './observe-visibility'
import { observeIntersection } from './observe-intersection'
import { observeDOMRemoval } from './observe-dom-removal'
import type { StaleOptions, StaleBinding, StaleConfig, StaleStatus } from './types'

export type { StaleOptions, StaleBinding, StaleConfig, StaleStatus }

// ---------------------------------------------------------------------------
// Global config defaults
// ---------------------------------------------------------------------------

let globalDefaults: StaleConfig = {}

// ---------------------------------------------------------------------------
// Internal registry — WeakMap so elements can be GC'd freely
// ---------------------------------------------------------------------------

const registry = new WeakMap<HTMLElement, StaleBinding>()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveTarget(
  target: string | HTMLElement | NodeList | NodeListOf<HTMLElement>,
): HTMLElement[] {
  if (typeof target === 'string') {
    return Array.from(document.querySelectorAll<HTMLElement>(target))
  }
  if (target instanceof HTMLElement) {
    return [target]
  }
  // NodeList / NodeListOf
  return Array.from(target as NodeListOf<HTMLElement>)
}

function isStale(binding: StaleBinding): boolean {
  if (binding.lastFetched === 0) return true
  return Date.now() - binding.lastFetched >= binding.ttlMs
}

async function doRefetch(binding: StaleBinding): Promise<void> {
  if (binding.isFetching) return
  binding.isFetching = true
  try {
    const data = await binding.options.refetch()
    binding.lastFetched = Date.now()
    binding.lastError = null
    binding.options.update(binding.el, data)
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    binding.lastError = error
    binding.options.onError(error)
  } finally {
    binding.isFetching = false
  }
}

function startInterval(binding: StaleBinding): void {
  if (binding.intervalId !== null) return
  // Poll every ~1/4 of the TTL (min 500ms) to stay responsive
  const pollMs = Math.max(binding.ttlMs / 4, 500)
  binding.intervalId = setInterval(() => {
    if (!binding.paused && isStale(binding)) {
      doRefetch(binding)
    }
  }, pollMs)
}

function stopInterval(binding: StaleBinding): void {
  if (binding.intervalId !== null) {
    clearInterval(binding.intervalId)
    binding.intervalId = null
  }
}

function cleanupBinding(binding: StaleBinding): void {
  stopInterval(binding)
  for (const fn of binding.cleanupFns) fn()
  binding.cleanupFns.length = 0
  registry.delete(binding.el)
}

// ---------------------------------------------------------------------------
// Core stale() function
// ---------------------------------------------------------------------------

function staleImpl(
  target: string | HTMLElement | NodeList | NodeListOf<HTMLElement>,
  options: StaleOptions,
): () => void {
  const elements = resolveTarget(target)
  if (elements.length === 0) return () => { /* noop */ }

  const merged: Required<StaleOptions> = {
    eager: globalDefaults.eager ?? true,
    visibilityPause: globalDefaults.visibilityPause ?? true,
    intersectionPause: globalDefaults.intersectionPause ?? true,
    reconnectRefetch: globalDefaults.reconnectRefetch ?? true,
    focusRefetch: globalDefaults.focusRefetch ?? true,
    onError: () => { /* noop */ },
    ...options,
  }

  const ttlMs = parseTTL(merged.ttl)
  const bindings: StaleBinding[] = []

  for (const el of elements) {
    // Clean up any existing binding for this element
    const existing = registry.get(el)
    if (existing) cleanupBinding(existing)

    const binding: StaleBinding = {
      el,
      options: merged,
      lastFetched: 0,
      ttlMs,
      paused: false,
      intervalId: null,
      isFetching: false,
      lastError: null,
      cleanupFns: [],
    }

    registry.set(el, binding)
    bindings.push(binding)

    // -- Tab visibility --
    if (merged.visibilityPause || merged.focusRefetch) {
      const cleanup = observeVisibility(
        () => {
          // tab hidden
          if (merged.visibilityPause) binding.paused = true
        },
        () => {
          // tab visible
          if (merged.visibilityPause) binding.paused = false
          if (merged.focusRefetch && isStale(binding)) {
            doRefetch(binding)
          }
        },
      )
      binding.cleanupFns.push(cleanup)
    }

    // -- Intersection --
    if (merged.intersectionPause) {
      const cleanup = observeIntersection(
        el,
        () => {
          // entered viewport
          binding.paused = false
          if (isStale(binding)) doRefetch(binding)
        },
        () => {
          // left viewport
          binding.paused = true
        },
      )
      binding.cleanupFns.push(cleanup)
    }

    // -- Network reconnect --
    if (merged.reconnectRefetch) {
      const handler = () => doRefetch(binding)
      window.addEventListener('online', handler)
      binding.cleanupFns.push(() => window.removeEventListener('online', handler))
    }

    // -- DOM removal auto-cleanup --
    const domCleanup = observeDOMRemoval(el, () => cleanupBinding(binding))
    binding.cleanupFns.push(domCleanup)

    // -- Start polling interval --
    startInterval(binding)

    // -- Eager fetch --
    if (merged.eager) {
      doRefetch(binding)
    }
  }

  return () => {
    for (const b of bindings) cleanupBinding(b)
  }
}

// ---------------------------------------------------------------------------
// Static methods
// ---------------------------------------------------------------------------

staleImpl.invalidate = function (
  target: string | HTMLElement | NodeList | NodeListOf<HTMLElement>,
): void {
  for (const el of resolveTarget(target)) {
    const binding = registry.get(el)
    if (binding) {
      binding.lastFetched = 0
      doRefetch(binding)
    }
  }
}

staleImpl.pause = function (
  target: string | HTMLElement | NodeList | NodeListOf<HTMLElement>,
): void {
  for (const el of resolveTarget(target)) {
    const binding = registry.get(el)
    if (binding) binding.paused = true
  }
}

staleImpl.resume = function (
  target: string | HTMLElement | NodeList | NodeListOf<HTMLElement>,
): void {
  for (const el of resolveTarget(target)) {
    const binding = registry.get(el)
    if (binding) {
      binding.paused = false
      if (isStale(binding)) doRefetch(binding)
    }
  }
}

staleImpl.configure = function (config: StaleConfig): void {
  globalDefaults = { ...globalDefaults, ...config }
}

staleImpl.getStatus = function (
  target: string | HTMLElement | NodeList | NodeListOf<HTMLElement>,
): StaleStatus | null {
  const els = resolveTarget(target)
  if (els.length === 0) return null
  const binding = registry.get(els[0])
  if (!binding) return null
  const age = binding.lastFetched === 0 ? Infinity : Date.now() - binding.lastFetched
  return {
    paused: binding.paused,
    fetching: binding.isFetching,
    lastFetched: binding.lastFetched,
    age,
    stale: isStale(binding),
    error: binding.lastError,
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const stale = staleImpl
export { parseTTL }
