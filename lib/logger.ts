const isDevRuntime =
  (typeof __DEV__ !== 'undefined' && __DEV__) ||
  (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production');

export function debugLog(...args: any[]) {
  if (isDevRuntime) {
    console.log(...args);
  }
}
