import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { CameraPanel } from '../CameraPanel'

describe('CameraPanel', () => {
  it('calls zoom handlers', () => {
    const onZoom = vi.fn()
    render(
      <CameraPanel
        videoRef={{ current: document.createElement('video') }}
        onZoom={onZoom}
        scanned={null}
        status=""
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(onZoom).toHaveBeenCalledWith(0.1)

    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    expect(onZoom).toHaveBeenCalledWith(-0.1)
  })

  it('shows scanned code and status', () => {
    const onZoom = vi.fn()
    render(
      <CameraPanel
        videoRef={{ current: document.createElement('video') }}
        onZoom={onZoom}
        scanned="abc"
        status="Saved"
      />,
    )

    expect(screen.getByText('abc')).toBeTruthy()
    expect(screen.getByText('Saved')).toBeTruthy()
  })
})
