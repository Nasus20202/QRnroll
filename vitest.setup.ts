// Ensure CommonJS globals for packages that expect `module` in JSDOM
if (typeof (globalThis as { module?: unknown }).module === 'undefined') {
  ;(globalThis as { module: { exports: Record<string, unknown> } }).module = {
    exports: {},
  }
}
