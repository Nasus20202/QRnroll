import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ScannerPage from '../ScannerPage'
import type { CodeItem, ScannerPageProps } from '../ScannerPage'

let decodeCallback:
  | ((result: { getText: () => string }, err: unknown) => void)
  | null = null

vi.mock('@zxing/browser', () => {
  class MockReader {
    decodeFromVideoDevice = vi.fn(
      (
        _id: string,
        _video: unknown,
        cb: (result: { getText: () => string } | null, err: unknown) => void,
      ) => {
        decodeCallback = cb
        return Promise.resolve(undefined)
      },
    )
    reset = vi.fn()
  }

  return {
    BrowserMultiFormatReader: MockReader,
  }
})

describe('ScannerPage', () => {
  const submitCode = vi.fn<ScannerPageProps['submitCode']>()
  const fetchCodes = vi.fn<ScannerPageProps['fetchCodes']>()

  beforeEach(() => {
    decodeCallback = null

    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({}),
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
})
