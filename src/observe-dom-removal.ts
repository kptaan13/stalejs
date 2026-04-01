/**
 * Watch for an element being removed from the DOM.
 * Fires onRemoved once and disconnects automatically.
 * Returns a cleanup function.
 */
export function observeDOMRemoval(
  el: HTMLElement,
  onRemoved: () => void,
): () => void {
  const parent = el.parentNode
  if (!parent) {
    // Element has no parent — nothing to observe
    return () => { /* noop */ }
  }

  const observer = new MutationObserver(() => {
    if (!document.contains(el)) {
      observer.disconnect()
      onRemoved()
    }
  })

  observer.observe(parent, { childList: true, subtree: true })

  return () => {
    observer.disconnect()
  }
}
