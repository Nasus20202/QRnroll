import {
  describe,
  expect,
  it,
  vi,
  beforeEach,
  beforeAll,
  afterEach,
} from 'vitest'
import type { Mock } from 'vitest'
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from '@testing-library/react'
import ScannerPage from '../ScannerPage'
import type { CodeItem, ScannerPageProps } from '../ScannerPage'

// jsdom's HTMLVideoElement.srcObject setter rejects plain objects.
// Override it with a WeakMap-backed getter/setter so tests can simulate
// a MediaStream being attached to video elements in the pipeline.
const srcObjectStore = new WeakMap<HTMLVideoElement, unknown>()
beforeAll(() => {
  Object.defineProperty(HTMLVideoElement.prototype, 'srcObject', {
    get(this: HTMLVideoElement) {
      return srcObjectStore.get(this) ?? null
    },
    set(this: HTMLVideoElement, val: unknown) {
      srcObjectStore.set(this, val)
    },
    configurable: true,
  })
})

let decodeCallback:
  | ((result: { getText: () => string } | null, err: unknown) => void)
  | null = null

// Tracks the deviceId passed to getUserMedia in each startDecoding call.
const decodeCalls: string[] = []

vi.mock('@zxing/browser', () => {
  class MockReader {
    decodeFromStream = vi.fn(
      (
        stream: unknown,
        video: unknown,
        cb: (result: { getText: () => string } | null, err: unknown) => void,
      ) => {
        decodeCallback = cb
        // Wire the stream to the video element so applyZoom can read the
        // track (hardware path) and so srcObject is set on the display video.
        if (
          video instanceof HTMLVideoElement &&
          stream != null &&
          typeof (stream as { getVideoTracks?: unknown }).getVideoTracks ===
            'function'
        ) {
          ;(video as { srcObject: unknown }).srcObject = stream
        }
        return Promise.resolve(undefined)
      },
    )
    reset = vi.fn()
  }

  return { BrowserMultiFormatReader: MockReader }
})

// Default mock stream — no hardware zoom capability.
const makeNoZoomStream = () => ({
  getVideoTracks: () => [
    {
      getSettings: () => ({ deviceId: 'dev' }),
      getCapabilities: () => ({}),
      stop: vi.fn(),
    },
  ],
  getTracks: () => [{ stop: vi.fn() }],
})

describe('ScannerPage', () => {
  const submitCode = vi.fn<ScannerPageProps['submitCode']>()
  const fetchCodes = vi.fn<ScannerPageProps['fetchCodes']>()

  beforeEach(() => {
    decodeCallback = null
    decodeCalls.length = 0

    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      configurable: true,
      value: {
        getUserMedia: vi
          .fn()
          .mockImplementation((constraints: MediaStreamConstraints) => {
            // Track the deviceId used in each startDecoding call
            // (permission calls use facingMode and have no deviceId.exact).
            const deviceId = (
              constraints.video as { deviceId?: { exact?: string } } | undefined
            )?.deviceId?.exact
            if (deviceId) decodeCalls.push(deviceId)
            return Promise.resolve(makeNoZoomStream())
          }),
        enumerateDevices: vi
          .fn()
          .mockResolvedValue([
            { deviceId: 'dev', kind: 'videoinput', label: 'Test Camera' },
          ]),
      },
    })

    submitCode.mockResolvedValue({ ok: true, stored: true })
    fetchCodes.mockResolvedValue([])
  })

  afterEach(() => {
    cleanup()
    decodeCallback = null
    submitCode.mockReset()
    fetchCodes.mockReset()
    vi.restoreAllMocks()
  })

  it('renders and refreshes codes', async () => {
    render(<ScannerPage submitCode={submitCode} fetchCodes={fetchCodes} />)
    await waitFor(() => expect(fetchCodes).toHaveBeenCalled())
    fireEvent.click(screen.getByText('Refresh'))
    expect(fetchCodes).toHaveBeenCalledTimes(2)
  })

  it('submits a scanned code and updates status', async () => {
    render(<ScannerPage submitCode={submitCode} fetchCodes={fetchCodes} />)
    await waitFor(() => expect(decodeCallback).toBeTruthy())
    decodeCallback?.({ getText: () => 'scanned-code' }, null)
    await waitFor(() => expect(screen.getByText('scanned-code')).toBeTruthy())
    await waitFor(() => expect(submitCode).toHaveBeenCalledWith('scanned-code'))
    await waitFor(() => expect(screen.getByText('Saved')).toBeTruthy())
  })

  it('copies and opens codes from list', async () => {
    const codes: CodeItem[] = [{ code: 'https://example.com', ts: Date.now() }]
    fetchCodes.mockResolvedValueOnce(codes)
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    render(<ScannerPage submitCode={submitCode} fetchCodes={fetchCodes} />)
    await waitFor(() => expect(fetchCodes).toHaveBeenCalled())

    fireEvent.click(screen.getByLabelText('Copy code'))
    expect(writeText).toHaveBeenCalledWith('https://example.com')

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    fireEvent.click(screen.getByText('https://example.com'))
    expect(openSpy).toHaveBeenCalledWith(
      'https://example.com',
      '_blank',
      'noopener,noreferrer',
    )
    openSpy.mockRestore()
  })

  it('switches cameras when multiple devices exist', async () => {
    ;(navigator.mediaDevices.enumerateDevices as Mock).mockResolvedValueOnce([
      { deviceId: 'dev-1', kind: 'videoinput', label: 'Cam 1' },
      { deviceId: 'dev-2', kind: 'videoinput', label: 'Cam 2' },
    ])

    render(<ScannerPage submitCode={submitCode} fetchCodes={fetchCodes} />)

    await waitFor(() => expect(decodeCalls.length).toBe(1))
    expect(decodeCalls[0]).toBe('dev-1')

    fireEvent.click(screen.getByRole('button', { name: /switch camera/i }))

    await waitFor(() => expect(decodeCalls.length).toBe(2))
    expect(decodeCalls[1]).toBe('dev-2')
  })

  it('always shows zoom controls (software zoom by default)', async () => {
    render(<ScannerPage submitCode={submitCode} fetchCodes={fetchCodes} />)

    // Zoom controls are rendered immediately with the software-zoom defaults.
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeTruthy()
  })

  it('software zoom updates zoom state without calling applyConstraints', async () => {
    render(<ScannerPage submitCode={submitCode} fetchCodes={fetchCodes} />)

    await waitFor(() => expect(decodeCallback).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))

    // Default software range 1–5, step = (5-1)/10 = 0.4 → new zoom = 1.4
    await waitFor(() => {
      const thumb = screen.getByRole('slider', { name: 'Zoom level' })
      expect(
        parseFloat(thumb.getAttribute('aria-valuenow') ?? '0'),
      ).toBeCloseTo(1.4, 5)
    })
  })

  it('applies hardware applyConstraints when camera exposes zoom capability', async () => {
    const applyConstraints = vi.fn().mockResolvedValue(undefined)
    const hwTrack = {
      getSettings: () => ({ deviceId: 'dev', zoom: 1 }),
      getCapabilities: () => ({ zoom: { min: 1, max: 5, step: 0.1 } }),
      applyConstraints,
      stop: vi.fn(),
    }
    const hwStream = {
      getVideoTracks: () => [hwTrack],
      getTracks: () => [hwTrack],
    }
    ;(navigator.mediaDevices.getUserMedia as Mock).mockResolvedValue(hwStream)

    render(<ScannerPage submitCode={submitCode} fetchCodes={fetchCodes} />)

    await waitFor(() => expect(decodeCallback).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))

    await waitFor(() => expect(applyConstraints).toHaveBeenCalled())
    const [constraints] = applyConstraints.mock.calls[0] as [
      { advanced: Array<{ zoom: number }> },
    ]
    expect(constraints.advanced[0].zoom).toBeGreaterThan(1)
  })
})
