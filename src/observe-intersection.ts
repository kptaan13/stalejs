/**
 * Observe when an element enters/leaves the viewport.
 * Returns a cleanup function that disconnects the observer.
 */
export function observeIntersection(
  el: HTMLElement,
  onEnter: () => void,
  onLeave: () => void,
): () => void {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        onEnter()
      } else {
        onLeave()
      }
    }
  })

  observer.observe(el)

  return () => {
    observer.disconnect()
  }
}
