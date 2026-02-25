import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

import EnrollPage from '../EnrollPage'
import type { CodesResponse } from '@/server/codes'

describe('EnrollPage', () => {
  const fetchCodes = vi.fn<() => Promise<CodesResponse>>()
  const openSpy = vi.fn()
  const realOpen = window.open

  beforeEach(() => {
    vi.useFakeTimers()
    fetchCodes.mockResolvedValue([])
    window.open = openSpy as unknown as typeof window.open
  })

  afterEach(() => {
    fetchCodes.mockReset()
    openSpy.mockReset()
    window.open = realOpen
    vi.useRealTimers()
  })

  it('shows waiting status when no codes', async () => {
    render(<EnrollPage fetchCodes={fetchCodes} />)
    await vi.advanceTimersByTimeAsync(600)
    expect(fetchCodes).toHaveBeenCalled()
    expect(screen.getByText(/waiting for valid codes/i)).toBeTruthy()
  })

  it('opens unseen codes and updates status', async () => {
    fetchCodes.mockResolvedValueOnce([
      { code: 'https://a.test', ts: Date.now() },
    ])
    fetchCodes.mockResolvedValue([])

    render(<EnrollPage fetchCodes={fetchCodes} />)

    await vi.advanceTimersByTimeAsync(600)
    await vi.waitFor(() =>
      expect(openSpy).toHaveBeenCalledWith(
        'https://a.test',
        '_blank',
        'noopener,noreferrer',
      ),
    )
    await vi.waitFor(() =>
      expect(screen.getByText(/opening https:\/\/a.test/i)).toBeTruthy(),
    )
  })
})
