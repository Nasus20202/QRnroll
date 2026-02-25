import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

let decodeCallback:
  | ((result: { getText: () => string }, err: unknown) => void)
  | null = null

vi.mock('@zxing/browser', () => {
  const listVideoInputDevices = vi.fn().mockResolvedValue([{ deviceId: 'dev' }])

  class MockReader {
    decodeFromVideoDevice = vi.fn((_id: string, _video: unknown, cb: any) => {
      decodeCallback = cb
      return Promise.resolve(undefined)
    })
    reset = vi.fn()
    static listVideoInputDevices = listVideoInputDevices
  }
  return {
    BrowserMultiFormatReader: MockReader,
    BrowserCodeReader: vi.fn(),
    listVideoInputDevices,
  }
})

import ScannerPage from '../ScannerPage'
import type { CodeItem, ScannerPageProps } from '../ScannerPage'

describe('ScannerPage', () => {
  const submitCode = vi.fn<ScannerPageProps['submitCode']>()
  const fetchCodes = vi.fn<ScannerPageProps['fetchCodes']>()

  beforeEach(() => {
    submitCode.mockResolvedValue({ ok: true, stored: true })
    fetchCodes.mockResolvedValue([])
  })

  afterEach(() => {
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

    await waitFor(() => expect(submitCode).toHaveBeenCalledWith('scanned-code'))
    expect(screen.getByText(/saved|duplicate/i)).toBeTruthy()
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
