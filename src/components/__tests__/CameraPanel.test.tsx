import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

import { CameraPanel } from '@/components/CameraPanel'

afterEach(() => cleanup())

const DEFAULT_ZOOM_RANGE = { min: 1, max: 5, step: 0.1 }

const baseProps = {
  videoRef: { current: document.createElement('video') },
  scanned: null,
  status: { kind: 'idle' as const, message: '' },
  zoom: 1,
  zoomRange: DEFAULT_ZOOM_RANGE,
  onZoomChange: vi.fn(),
}

describe('CameraPanel', () => {
  it('shows scanned code and status', () => {
    render(
      <CameraPanel
        {...baseProps}
        scanned="abc"
        status={{ kind: 'success', message: 'Saved' }}
      />,
    )

    expect(screen.getByText('abc')).toBeTruthy()
    expect(screen.getByText('Saved')).toBeTruthy()
  })

  it('always renders zoom controls', () => {
    render(<CameraPanel {...baseProps} />)

    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeTruthy()
    expect(screen.getByRole('slider', { name: 'Zoom level' })).toBeTruthy()
  })

  it('displays the current zoom level as text', () => {
    render(<CameraPanel {...baseProps} zoom={2.4} />)
    expect(screen.getByLabelText('Current zoom').textContent).toBe('2.4×')
  })

  it('calls onZoomChange with incremented value when zoom-in is clicked', () => {
    const onZoomChange = vi.fn()
    render(
      <CameraPanel
        {...baseProps}
        zoom={1}
        zoomRange={DEFAULT_ZOOM_RANGE}
        onZoomChange={onZoomChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    // step = (5 - 1) / 10 = 0.4, capped at max 5
    expect(onZoomChange).toHaveBeenCalledWith(1.4)
  })

  it('calls onZoomChange with decremented value when zoom-out is clicked', () => {
    const onZoomChange = vi.fn()
    render(
      <CameraPanel
        {...baseProps}
        zoom={3}
        zoomRange={DEFAULT_ZOOM_RANGE}
        onZoomChange={onZoomChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    // step = 0.4, 3 - 0.4 = 2.6
    expect(onZoomChange).toHaveBeenCalledWith(2.6)
  })

  it('clamps zoom-out to zoomRange.min', () => {
    const onZoomChange = vi.fn()
    render(
      <CameraPanel
        {...baseProps}
        zoom={1}
        zoomRange={DEFAULT_ZOOM_RANGE}
        onZoomChange={onZoomChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    expect(onZoomChange).toHaveBeenCalledWith(1)
  })

  it('clamps zoom-in to zoomRange.max', () => {
    const onZoomChange = vi.fn()
    render(
      <CameraPanel
        {...baseProps}
        zoom={5}
        zoomRange={DEFAULT_ZOOM_RANGE}
        onZoomChange={onZoomChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(onZoomChange).toHaveBeenCalledWith(5)
  })
})
