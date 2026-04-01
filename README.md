# stalejs

> Zero-dependency DOM content-freshness primitive. Keeps elements up to date automatically.

[![npm](https://img.shields.io/npm/v/stalejs)](https://npmjs.com/package/stalejs)
[![size](https://img.shields.io/bundlephobia/minzip/stalejs)](https://bundlephobia.com/package/stalejs)
[![license](https://img.shields.io/npm/l/stalejs)](LICENSE)

## [→ Live Demo](https://kptaan13.github.io/stalejs)

---

## The problem

Here's what most developers write today to keep a price ticker up to date:

```js
let intervalId = null
let isVisible = true
let isOnline = navigator.onLine

function fetchPrice() {
  if (!isVisible || !isOnline) return
  fetch('/api/price')
    .then(r => r.json())
    .then(data => {
      document.getElementById('price').textContent = data.price
    })
    .catch(err => console.error(err))
}

// Poll every 30 seconds
intervalId = setInterval(fetchPrice, 30_000)
fetchPrice()

// Pause when tab is hidden
document.addEventListener('visibilitychange', () => {
  isVisible = !document.hidden
  if (!document.hidden) fetchPrice() // refetch when tab returns
})

// Refetch when network comes back
window.addEventListener('online', () => {
  isOnline = true
  fetchPrice()
})
window.addEventListener('offline', () => { isOnline = false })

// Pause when scrolled off screen
const observer = new IntersectionObserver(([entry]) => {
  isVisible = entry.isIntersecting
  if (entry.isIntersecting) fetchPrice()
})
observer.observe(document.getElementById('price'))

// Remember to clean up... which you'll forget
function destroy() {
  clearInterval(intervalId)
  observer.disconnect()
  document.removeEventListener('visibilitychange', ...)
  window.removeEventListener('online', ...)
}
```

That's 40+ lines for one element. It leaks listeners if you forget cleanup. Now multiply by every dynamic element in your app.

---

## The solution

```js
import { stale } from 'stalejs'

const unsub = stale('#price', {
  ttl: '30s',
  refetch: () => fetch('/api/price').then(r => r.json()),
  update: (el, data) => { el.textContent = data.price },
})

unsub() // full cleanup whenever you need it
```

All edge cases handled automatically: tab visibility, network reconnect, viewport intersection, TTL expiry, DOM removal cleanup.

---

## Install

```bash
npm install stalejs
```

---

## API

### `stale(target, options)`

```ts
import { stale } from 'stalejs'

const unsub = stale(target, options)
unsub() // cleanup all listeners, observers, and intervals
```

#### `target`

```ts
type Target = string | HTMLElement | NodeList | NodeListOf<HTMLElement>
```

- CSS selector string: `'#price'`, `'.ticker'`
- `HTMLElement` instance
- `NodeList` / `NodeListOf<HTMLElement>`

When a selector matches multiple elements, each gets its own independent binding.

#### `options`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ttl` | `string \| number` | required | Time before data is stale. `'30s'`, `'5m'`, `'1h'`, or ms number. |
| `refetch` | `() => Promise<any>` | required | Async function that returns fresh data. |
| `update` | `(el, data) => void` | required | Apply data to the element. |
| `onError` | `(err: Error) => void` | `undefined` | Called when `refetch` throws. |
| `eager` | `boolean` | `true` | Refetch immediately on init. |
| `visibilityPause` | `boolean` | `true` | Pause TTL clock when tab is hidden. |
| `intersectionPause` | `boolean` | `true` | Pause TTL clock when element is out of viewport. |
| `reconnectRefetch` | `boolean` | `true` | Refetch immediately when network comes back online. |
| `focusRefetch` | `boolean` | `true` | Refetch when tab regains focus if data is stale. |

#### TTL string format

| String | Milliseconds |
|--------|-------------|
| `'500ms'` | 500 |
| `'30s'` | 30,000 |
| `'5m'` | 300,000 |
| `'1h'` | 3,600,000 |
| `2000` | 2,000 |

---

### `stale.invalidate(target)`

Immediately marks matching elements as stale and triggers a refetch.

```ts
stale.invalidate('#price')
stale.invalidate(el)
```

---

### `stale.pause(target)` / `stale.resume(target)`

Pause or resume refetching for specific elements.

```ts
stale.pause('#price')   // stops polling
stale.resume('#price')  // resumes; refetches immediately if stale
```

---

### `stale.configure(defaults)`

Set global defaults applied to all future `stale()` calls.

```ts
stale.configure({
  ttl: '60s',
  visibilityPause: true,
  reconnectRefetch: true,
})
```

---

## Examples

### Live price ticker

```html
<span id="price">Loading...</span>
```

```js
import { stale } from 'stalejs'

stale('#price', {
  ttl: '10s',
  refetch: () => fetch('/api/btc-price').then(r => r.json()),
  update: (el, data) => {
    el.textContent = `$${data.usd.toLocaleString()}`
  },
  onError: (err) => console.warn('Price fetch failed:', err),
})
```

---

### Sports score widget

```js
import { stale } from 'stalejs'

stale('.score-widget', {
  ttl: '5s',
  eager: true,
  refetch: () => fetch('/api/live-score').then(r => r.json()),
  update: (el, data) => {
    el.innerHTML = `${data.home} — ${data.away}`
  },
})
```

---

### Notification badge

```js
import { stale } from 'stalejs'

stale('#notif-count', {
  ttl: '1m',
  refetch: () => fetch('/api/notifications/unread').then(r => r.json()),
  update: (el, { count }) => {
    el.textContent = count > 99 ? '99+' : String(count)
    el.hidden = count === 0
  },
})
```

---

### Framework snippets

**Vanilla JS**

```js
import { stale } from 'stalejs'

const unsub = stale('#price', {
  ttl: '30s',
  refetch: () => fetch('/api/price').then(r => r.json()),
  update: (el, data) => { el.textContent = data.price },
})

// Cleanup when done
window.addEventListener('unload', unsub)
```

**Vue 3**

```vue
<template>
  <span ref="priceEl">Loading...</span>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { stale } from 'stalejs'

const priceEl = ref(null)
let unsub

onMounted(() => {
  unsub = stale(priceEl.value, {
    ttl: '15s',
    refetch: () => fetch('/api/price').then(r => r.json()),
    update: (el, data) => { el.textContent = data.price },
  })
})

onUnmounted(() => unsub?.())
</script>
```

**Svelte**

```svelte
<script>
  import { onMount } from 'svelte'
  import { stale } from 'stalejs'

  let priceEl

  onMount(() => {
    const unsub = stale(priceEl, {
      ttl: '15s',
      refetch: () => fetch('/api/price').then(r => r.json()),
      update: (el, data) => { el.textContent = data.price },
    })
    return unsub // Svelte calls this on destroy
  })
</script>

<span bind:this={priceEl}>Loading...</span>
```

---

## How it compares to SWR / React Query

| | `stalejs` | SWR / React Query |
|---|---|---|
| Framework requirement | None — works with any DOM | React only |
| Virtual DOM | No | Yes |
| Bundle size | ~1.3kb gzipped | ~13kb+ |
| Target | DOM elements | React state |
| Use case | Any HTML element | React component data |

`stalejs` is not a replacement for SWR or React Query in React apps. It's the answer for everything *outside* React — vanilla JS dashboards, server-rendered pages with interactive widgets, Web Components, Vue/Svelte apps that need DOM-level control.

---

## License

MIT
