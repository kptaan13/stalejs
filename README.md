# stalejs

**Zero-dependency DOM content-freshness primitive.**
Keep any element automatically up to date — tab visibility, network reconnects, scroll intersection, and TTL expiry all handled out of the box.

[![npm](https://img.shields.io/badge/npm-0.1.0-blue)](https://npmjs.com/package/stalejs)
[![size](https://img.shields.io/badge/size-1.3kb_gzipped-green)](https://bundlephobia.com/package/stalejs)
[![license](https://img.shields.io/github/license/kptaan13/stalejs)](LICENSE)

## [→ Live Demo](https://kptaan13.github.io/stalejs/demo)

---

## The problem

This is what keeping one element fresh actually looks like:

```js
let intervalId, isVisible = true, isOnline = navigator.onLine, lastFetched = null

function fetchPrice() {
  if (!isVisible || !isOnline) return
  fetch('/api/price').then(r => r.json()).then(data => {
    document.querySelector('#price').textContent = data.price
    lastFetched = Date.now()
  }).catch(console.error)
}

intervalId = setInterval(fetchPrice, 30_000)
fetchPrice()

document.addEventListener('visibilitychange', () => {
  isVisible = !document.hidden
  if (!document.hidden && Date.now() - lastFetched > 30_000) fetchPrice()
})
window.addEventListener('online',  () => { isOnline = true;  fetchPrice() })
window.addEventListener('offline', () => { isOnline = false })

const io = new IntersectionObserver(([e]) => {
  isVisible = e.isIntersecting
  if (e.isIntersecting) fetchPrice()
})
io.observe(document.querySelector('#price'))

// cleanup you'll definitely forget
function destroy() {
  clearInterval(intervalId)
  io.disconnect()
  // ...removeEventListener × 3
}
```

40+ lines. Leaks if you forget cleanup. Multiply by every live widget in your app.

## The solution

```js
import { stale } from 'stalejs'

const unsub = stale('#price', {
  ttl: '30s',
  refetch: () => fetch('/api/price').then(r => r.json()),
  update:  (el, data) => { el.textContent = data.price },
})

unsub() // full cleanup — one call
```

Everything else is automatic.

---

## Install

```bash
npm install stalejs
```

```js
import { stale } from 'stalejs'        // ESM
const { stale } = require('stalejs')   // CJS
```

---

## How it works

Every `stale()` call creates a binding that:

1. Runs an initial fetch (unless `eager: false`)
2. Starts a TTL interval — when it expires, refetches
3. Pauses the clock when the tab is hidden
4. Immediately refetches when the tab regains focus (if stale)
5. Immediately refetches when the network comes back online
6. Pauses when the element scrolls out of the viewport
7. Resumes and refetches when it scrolls back in
8. Auto-cleans up if the element is removed from the DOM

Call `unsub()` to manually tear everything down.

---

## API

### `stale(target, options)`

```ts
import { stale } from 'stalejs'

const unsub = stale(target, options)
unsub() // removes all listeners, observers, and intervals
```

#### `target`

```ts
string | HTMLElement | NodeList | NodeListOf<HTMLElement>
```

A CSS selector, a direct element reference, or a NodeList. When a selector matches multiple elements each gets an independent binding.

#### `options`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ttl` | `string \| number` | — | Time before data is considered stale. See [TTL format](#ttl-format). |
| `refetch` | `() => Promise<any>` | — | Async function that returns fresh data. |
| `update` | `(el, data) => void` | — | Applies the fetched data to the element. |
| `onError` | `(err: Error) => void` | `undefined` | Called when `refetch` throws. Silent by default. |
| `eager` | `boolean` | `true` | Fetch immediately on init. |
| `visibilityPause` | `boolean` | `true` | Pause TTL when tab is hidden. |
| `focusRefetch` | `boolean` | `true` | Refetch on tab focus if data is stale. |
| `intersectionPause` | `boolean` | `true` | Pause TTL when element is out of viewport. |
| `reconnectRefetch` | `boolean` | `true` | Refetch immediately when network comes back online. |

#### TTL format

| Value | Resolves to |
|-------|-------------|
| `'500ms'` | 500 ms |
| `'30s'` | 30,000 ms |
| `'5m'` | 300,000 ms |
| `'1h'` | 3,600,000 ms |
| `2000` _(number)_ | 2,000 ms |

---

### `stale.invalidate(target)`

Force an immediate refetch, regardless of TTL.

```ts
stale.invalidate('#price')
stale.invalidate(el)
```

---

### `stale.pause(target)` / `stale.resume(target)`

Manually pause or resume a binding.

```ts
stale.pause('#price')    // stop polling
stale.resume('#price')   // resume — refetches immediately if stale
```

---

### `stale.configure(defaults)`

Set global defaults for all future `stale()` calls.

```ts
stale.configure({
  ttl: '60s',
  visibilityPause: true,
  reconnectRefetch: true,
})
```

---

## Examples

### Price ticker

```js
import { stale } from 'stalejs'

stale('#btc-price', {
  ttl: '10s',
  refetch: () => fetch('/api/btc').then(r => r.json()),
  update:  (el, data) => { el.textContent = `$${data.usd.toLocaleString()}` },
  onError: (err) => console.warn('fetch failed:', err),
})
```

### Notification badge

```js
stale('#notif-count', {
  ttl: '1m',
  refetch: () => fetch('/api/notifications/unread').then(r => r.json()),
  update:  (el, { count }) => {
    el.textContent = count > 99 ? '99+' : String(count)
    el.hidden = count === 0
  },
})
```

### Multiple elements via selector

```js
// Each `.score-widget` gets its own independent binding
stale('.score-widget', {
  ttl: '5s',
  refetch: () => fetch('/api/score').then(r => r.json()),
  update:  (el, data) => { el.textContent = `${data.home} — ${data.away}` },
})
```

---

## Framework usage

**Vanilla JS**

```js
import { stale } from 'stalejs'

const unsub = stale('#price', {
  ttl: '30s',
  refetch: () => fetch('/api/price').then(r => r.json()),
  update:  (el, data) => { el.textContent = data.price },
})

window.addEventListener('unload', unsub)
```

**Vue 3**

```vue
<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { stale } from 'stalejs'

const el = ref(null)
let unsub

onMounted(()  => { unsub = stale(el.value, { ttl: '15s', refetch, update }) })
onUnmounted(() => unsub?.())
</script>

<template><span ref="el">Loading…</span></template>
```

**Svelte**

```svelte
<script>
  import { onMount } from 'svelte'
  import { stale } from 'stalejs'

  let el

  onMount(() => {
    return stale(el, { ttl: '15s', refetch, update }) // return = auto cleanup
  })
</script>

<span bind:this={el}>Loading…</span>
```

**React** _(for non-React-state DOM needs)_

```jsx
import { useEffect, useRef } from 'react'
import { stale } from 'stalejs'

function PriceTicker() {
  const ref = useRef(null)

  useEffect(() => {
    return stale(ref.current, {
      ttl: '10s',
      refetch: () => fetch('/api/price').then(r => r.json()),
      update:  (el, data) => { el.textContent = data.price },
    })
  }, [])

  return <span ref={ref}>Loading…</span>
}
```

---

## vs. SWR / React Query

|  | stalejs | SWR / React Query |
|--|---------|-------------------|
| Framework | None — any DOM | React only |
| Virtual DOM dependency | No | Yes |
| Bundle size | **1.3 kb gz** | ~13 kb+ |
| Works with | Any HTML element | React component state |
| SSR pages, HTMX, Web Components | ✅ | ❌ |

`stalejs` is not a replacement for SWR or React Query inside React apps. It's the answer for everything else — server-rendered pages, vanilla dashboards, HTMX partials, Web Components, and Vue/Svelte apps that need DOM-level freshness control.

---

## License

[MIT](LICENSE) © RK
