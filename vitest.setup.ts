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
