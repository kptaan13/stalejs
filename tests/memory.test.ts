import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { stale } from '../src/index'

describe('memory leak detection', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('no lingering window listeners after 100 create/destroy cycles', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')

    const unsubs: Array<() => void> = []

    for (let i = 0; i < 100; i++) {
      const el = document.createElement('div')
      document.body.appendChild(el)
      const unsub = stale(el, {
        ttl: '30s',
        eager: false,
        refetch: vi.fn().mockResolvedValue('data'),
        update: vi.fn(),
        reconnectRefetch: true,
        visibilityPause: false,
        intersectionPause: false,
        focusRefetch: false,
      })
      unsubs.push(unsub)
    }

    // All added
    const addedCount = addSpy.mock.calls.filter((c) => c[0] === 'online').length
    expect(addedCount).toBe(100)

    // Destroy all
    for (const unsub of unsubs) unsub()

    const removedCount = removeSpy.mock.calls.filter((c) => c[0] === 'online').length
    expect(removedCount).toBe(100)

    addSpy.mockRestore()
    removeSpy.mockRestore()
  })

  it('no lingering document listeners after 100 create/destroy cycles', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const removeSpy = vi.spyOn(document, 'removeEventListener')

    const unsubs: Array<() => void> = []

    for (let i = 0; i < 100; i++) {
      const el = document.createElement('div')
      document.body.appendChild(el)
      const unsub = stale(el, {
        ttl: '30s',
        eager: false,
        refetch: vi.fn().mockResolvedValue('data'),
        update: vi.fn(),
        reconnectRefetch: false,
        visibilityPause: true,
        intersectionPause: false,
        focusRefetch: false,
      })
      unsubs.push(unsub)
    }

    const addedCount = addSpy.mock.calls.filter((c) => c[0] === 'visibilitychange').length
    expect(addedCount).toBe(100)

    for (const unsub of unsubs) unsub()

    const removedCount = removeSpy.mock.calls.filter((c) => c[0] === 'visibilitychange').length
    expect(removedCount).toBe(100)

    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})
