import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { LiveStatus } from '../LiveStatus'

describe('LiveStatus', () => {
  it('shows status and last opened link', () => {
    render(<LiveStatus status="Opening" lastOpened="https://foo" />)

    expect(screen.getByText(/status: Opening/i)).toBeTruthy()
    expect(screen.getByText(/Last opened: https:\/\/foo/i)).toBeTruthy()
  })

  it('renders empty state when no last opened', () => {
    render(<LiveStatus status="Waiting" lastOpened={null} />)

    expect(screen.getByText(/status: Waiting/i)).toBeTruthy()
    expect(screen.getByText(/No codes opened yet/i)).toBeTruthy()
  })
})
