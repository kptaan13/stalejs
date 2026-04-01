/**
 * Observe document visibility changes.
 * Returns a cleanup function that removes the listener.
 */
export function observeVisibility(
  onHide: () => void,
  onShow: () => void,
): () => void {
  const handler = () => {
    if (document.hidden) {
      onHide()
    } else {
      onShow()
    }
  }

  document.addEventListener('visibilitychange', handler)

  return () => {
    document.removeEventListener('visibilitychange', handler)
  }
}
