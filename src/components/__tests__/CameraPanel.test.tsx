import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { CameraPanel } from '../CameraPanel'

describe('CameraPanel', () => {
  it('shows scanned code and status', () => {
    render(
      <CameraPanel
        videoRef={{ current: document.createElement('video') }}
        scanned="abc"
        status={{ kind: 'success', message: 'Saved' }}
      />,
    )

    expect(screen.getByText('abc')).toBeTruthy()
    expect(screen.getByText('Saved')).toBeTruthy()
  })
})
