export function debounce<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs: number,
): (...args: Args) => void {
  let timerId: number | undefined;

  return (...args: Args) => {
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
    }

    timerId = window.setTimeout(() => {
      callback(...args);
    }, delayMs);
  };
}
