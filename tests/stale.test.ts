import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { stale } from '../src/index'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEl(id = 'el'): HTMLElement {
  const el = document.createElement('div')
  el.id = id
  document.body.appendChild(el)
  return el
}

function makeOptions(overrides: Partial<Parameters<typeof stale>[1]> = {}) {
  const refetch = vi.fn().mockResolvedValue('fresh-data')
  const update = vi.fn()
  return {
    refetch,
    update,
    ttl: '5s',
    eager: false,
    visibilityPause: false,
    intersectionPause: false,
    reconnectRefetch: false,
    focusRefetch: false,
    ...overrides,
  } as Parameters<typeof stale>[1]
}

// Constructor-compatible IntersectionObserver mock
function makeIntersectionObserverMock(
  onObserve: (cb: IntersectionObserverCallback, observer: { observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }) => void,
) {
  const mockObserve = vi.fn()
  const mockDisconnect = vi.fn()

  function MockIO(this: IntersectionObserver, cb: IntersectionObserverCallback) {
    onObserve(cb, { observe: mockObserve, disconnect: mockDisconnect })
    ;(this as unknown as Record<string, unknown>)['observe'] = mockObserve
    ;(this as unknown as Record<string, unknown>)['disconnect'] = mockDisconnect
  }
  MockIO.prototype.observe = mockObserve
  MockIO.prototype.disconnect = mockDisconnect
  MockIO.prototype.unobserve = vi.fn()
  MockIO.prototype.takeRecords = vi.fn().mockReturnValue([])

  return MockIO as unknown as typeof IntersectionObserver
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('stale()', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  // -------------------------------------------------------------------------
  it('refetches when TTL expires', async () => {
    const el = makeEl()
    const opts = makeOptions({ ttl: '4s', eager: false })
    stale(el, opts)

    // Advance past TTL; interval fires at ~1s (1/4 of 4s)
    await vi.advanceTimersByTimeAsync(5000)
    expect(opts.refetch).toHaveBeenCalled()
  })

  it('does not refetch before TTL expires', async () => {
    const el = makeEl()
    const opts = makeOptions({ ttl: '10s', eager: false })
    stale(el, opts)
    await vi.advanceTimersByTimeAsync(2000)
    expect(opts.refetch).not.toHaveBeenCalled()
  })

  it('calls update with fetched data', async () => {
    const el = makeEl()
    const opts = makeOptions({ ttl: '5s', eager: true })
    stale(el, opts)
    // Flush microtasks so the eager async refetch completes
    await vi.advanceTimersByTimeAsync(0)
    expect(opts.update).toHaveBeenCalledWith(el, 'fresh-data')
  })

  it('does NOT refetch when tab is hidden (visibilityPause)', async () => {
    const el = makeEl()
    const opts = makeOptions({ ttl: '1s', eager: false, visibilityPause: true })
    stale(el, opts)

    // Hide the tab
    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    await vi.advanceTimersByTimeAsync(3000)
    expect(opts.refetch).not.toHaveBeenCalled()

    // Restore
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
  })

  it('refetches on tab focus if stale (focusRefetch)', async () => {
    const el = makeEl()
    // eager: false, so lastFetched=0 → data is immediately stale
    const opts = makeOptions({ ttl: '30s', eager: false, focusRefetch: true, visibilityPause: false })
    stale(el, opts)

    // No timers advanced — data is still stale (lastFetched=0)
    expect((opts.refetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0)

    // Tab becomes visible → focusRefetch should trigger a refetch
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)

    expect((opts.refetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1)
  })

  it('refetches on network reconnect (reconnectRefetch)', async () => {
    const el = makeEl()
    const opts = makeOptions({ ttl: '5s', eager: true, reconnectRefetch: true })
    stale(el, opts)
    await vi.advanceTimersByTimeAsync(100)

    const callsBefore = (opts.refetch as ReturnType<typeof vi.fn>).mock.calls.length
    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(100)

    expect((opts.refetch as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(callsBefore)
  })

  it('calls onError when refetch throws', async () => {
    const el = makeEl()
    const onError = vi.fn()
    const opts = makeOptions({
      ttl: '1s',
      eager: true,
      refetch: vi.fn().mockRejectedValue(new Error('network fail')),
      onError,
    })
    stale(el, opts)
    await vi.advanceTimersByTimeAsync(100)
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'network fail' }))
  })

  it('removes all listeners after unsub()', () => {
    const el = makeEl()
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')

    const opts = makeOptions({ reconnectRefetch: true })
    const unsub = stale(el, opts)
    unsub()

    const added = addSpy.mock.calls.map((c) => c[0])
    const removed = removeSpy.mock.calls.map((c) => c[0])
    for (const evt of added) {
      expect(removed).toContain(evt)
    }
    addSpy.mockRestore()
    removeSpy.mockRestore()
  })

  it('stale.invalidate() triggers immediate refetch', async () => {
    const el = makeEl()
    const opts = makeOptions({ ttl: '5s', eager: false })
    stale(el, opts)

    stale.invalidate(el)
    await vi.advanceTimersByTimeAsync(100)

    expect(opts.refetch).toHaveBeenCalled()
  })

  it('stale.pause() stops refetching', async () => {
    const el = makeEl()
    const opts = makeOptions({ ttl: '1s', eager: false })
    stale(el, opts)

    stale.pause(el)
    await vi.advanceTimersByTimeAsync(3000)
    expect(opts.refetch).not.toHaveBeenCalled()
  })

  it('stale.resume() restarts refetching when stale', async () => {
    const el = makeEl()
    const opts = makeOptions({ ttl: '1s', eager: false })
    stale(el, opts)

    stale.pause(el)
    await vi.advanceTimersByTimeAsync(2000)
    stale.resume(el)
    await vi.advanceTimersByTimeAsync(100)

    expect(opts.refetch).toHaveBeenCalled()
  })

  it('targets multiple elements via CSS selector', async () => {
    const a = makeEl('a')
    const b = makeEl('b')
    a.className = 'multi'
    b.className = 'multi'

    const update = vi.fn()
    stale('.multi', {
      ttl: '5s',
      eager: true,
      refetch: vi.fn().mockResolvedValue('ok'),
      update,
      visibilityPause: false,
      intersectionPause: false,
      reconnectRefetch: false,
      focusRefetch: false,
    })

    await vi.advanceTimersByTimeAsync(100)

    expect(update).toHaveBeenCalledWith(a, 'ok')
    expect(update).toHaveBeenCalledWith(b, 'ok')
  })

  it('pauses when element leaves viewport (intersectionPause)', async () => {
    const el = makeEl()
    const opts = makeOptions({ ttl: '1s', eager: false, intersectionPause: true })

    let savedCb: IntersectionObserverCallback | null = null

    vi.stubGlobal(
      'IntersectionObserver',
      makeIntersectionObserverMock((cb) => {
        savedCb = cb
      }),
    )

    stale(el, opts)

    // Trigger "out of viewport"
    savedCb!([{ isIntersecting: false, target: el } as IntersectionObserverEntry], {} as IntersectionObserver)
    await vi.advanceTimersByTimeAsync(3000)
    expect(opts.refetch).not.toHaveBeenCalled()
  })

  it('resumes and refetches when element re-enters viewport', async () => {
    const el = makeEl()
    const opts = makeOptions({ ttl: '1s', eager: false, intersectionPause: true })

    let savedCb: IntersectionObserverCallback | null = null

    vi.stubGlobal(
      'IntersectionObserver',
      makeIntersectionObserverMock((cb) => {
        savedCb = cb
      }),
    )

    stale(el, opts)

    // Leave viewport to make binding paused
    savedCb!([{ isIntersecting: false, target: el } as IntersectionObserverEntry], {} as IntersectionObserver)
    await vi.advanceTimersByTimeAsync(2000)
    expect(opts.refetch).not.toHaveBeenCalled()

    // Re-enter viewport — should trigger refetch immediately (stale since lastFetched=0)
    savedCb!([{ isIntersecting: true, target: el } as IntersectionObserverEntry], {} as IntersectionObserver)
    await vi.advanceTimersByTimeAsync(100)

    expect(opts.refetch).toHaveBeenCalled()
  })
})
