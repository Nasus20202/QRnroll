import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { CameraPanel } from '../CameraPanel'

const baseProps = {
  videoRef: { current: document.createElement('video') },
  scanned: null,
  status: { kind: 'idle' as const, message: '' },
  zoom: 1,
  zoomRange: null,
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

  it('does not render zoom controls when zoomRange is null', () => {
    render(<CameraPanel {...baseProps} zoomRange={null} />)

    expect(screen.queryByLabelText('Zoom out')).toBeNull()
    expect(screen.queryByLabelText('Zoom in')).toBeNull()
  })

  it('renders zoom controls when zoomRange is provided', () => {
    render(
      <CameraPanel
        {...baseProps}
        zoom={1}
        zoomRange={{ min: 1, max: 5, step: 0.1 }}
      />,
    )

    expect(screen.getByLabelText('Zoom out')).toBeTruthy()
    expect(screen.getByLabelText('Zoom in')).toBeTruthy()
    expect(screen.getByLabelText('Zoom level')).toBeTruthy()
  })

  it('calls onZoomChange with incremented value when zoom-in is clicked', () => {
    const onZoomChange = vi.fn()
    render(
      <CameraPanel
        {...baseProps}
        zoom={1}
        zoomRange={{ min: 1, max: 5, step: 0.1 }}
        onZoomChange={onZoomChange}
      />,
    )

    fireEvent.click(screen.getByLabelText('Zoom in'))
    // step = (5 - 1) / 10 = 0.4, capped at max 5
    expect(onZoomChange).toHaveBeenCalledWith(1.4)
  })

  it('calls onZoomChange with decremented value when zoom-out is clicked', () => {
    const onZoomChange = vi.fn()
    render(
      <CameraPanel
        {...baseProps}
        zoom={3}
        zoomRange={{ min: 1, max: 5, step: 0.1 }}
        onZoomChange={onZoomChange}
      />,
    )

    fireEvent.click(screen.getByLabelText('Zoom out'))
    // step = 0.4, 3 - 0.4 = 2.6
    expect(onZoomChange).toHaveBeenCalledWith(2.6)
  })

  it('clamps zoom-out to zoomRange.min', () => {
    const onZoomChange = vi.fn()
    render(
      <CameraPanel
        {...baseProps}
        zoom={1}
        zoomRange={{ min: 1, max: 5, step: 0.1 }}
        onZoomChange={onZoomChange}
      />,
    )

    fireEvent.click(screen.getByLabelText('Zoom out'))
    expect(onZoomChange).toHaveBeenCalledWith(1)
  })

  it('clamps zoom-in to zoomRange.max', () => {
    const onZoomChange = vi.fn()
    render(
      <CameraPanel
        {...baseProps}
        zoom={5}
        zoomRange={{ min: 1, max: 5, step: 0.1 }}
        onZoomChange={onZoomChange}
      />,
    )

    fireEvent.click(screen.getByLabelText('Zoom in'))
    expect(onZoomChange).toHaveBeenCalledWith(5)
  })
})
