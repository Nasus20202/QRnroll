// Radix UI primitives (e.g. Slider) use ResizeObserver internally.
// jsdom does not ship it, so we provide a no-op stub for tests.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.ResizeObserver = ResizeObserverStub

// jsdom does not implement HTMLCanvasElement.captureStream.
// The software-zoom pipeline calls it to produce a MediaStream from a canvas;
// return a minimal stub so tests can exercise that path.
HTMLCanvasElement.prototype.captureStream = function () {
  return {
    getVideoTracks: () => [],
    getTracks: () => [],
  } as unknown as MediaStream
}

// jsdom does not implement HTMLMediaElement.prototype.play and related methods.
// Our camera components use <video autoPlay> or call .play() directly.
// We provide no-op stubs to prevent 'Not implemented' errors in unit tests.
if (typeof HTMLMediaElement !== 'undefined') {
  HTMLMediaElement.prototype.play = async () => {}
  HTMLMediaElement.prototype.pause = () => {}
  HTMLMediaElement.prototype.load = () => {}
}

// jsdom v30.0.0 has a bug in lib/jsdom/living/css/helpers/font-sizes.js:116 where
// FONT_SIZE_REGEXP.exec(resolvedSize) returns null without null checking, causing
// "TypeError: object null is not iterable". This occurs when @testing-library/dom
// calls getComputedStyle via isSubtreeInaccessible during getByRole queries.
// The bug is triggered in CSS resolution of certain calc() values.
// TODO: Remove this patch when jsdom fixes the bug upstream or provides a patch version.
// See: https://github.com/jsdom/jsdom/blob/main/lib/jsdom/living/css/helpers/font-sizes.js#L116
const originalGetComputedStyle = window.getComputedStyle
window.getComputedStyle = function (
  element: Element,
  pseudoElt?: string | null,
) {
  try {
    return originalGetComputedStyle(element, pseudoElt)
  } catch (error) {
    // jsdom v30 font-size resolution error: "object null is not iterable"
    // Return a minimal fallback CSSStyleDeclaration so role queries don't crash.
    if (error instanceof TypeError && error.message.includes('not iterable')) {
      return Object.create(CSSStyleDeclaration.prototype) as CSSStyleDeclaration
    }
    throw error
  }
}
