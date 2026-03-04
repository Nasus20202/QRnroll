import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { NotificationOptInCard } from '../NotificationOptInCard'

describe('NotificationOptInCard', () => {
  it('renders enable button when permission is default and fires handler', () => {
    const onRequest = vi.fn()

    render(<NotificationOptInCard permission="default" onRequest={onRequest} />)

    const button = screen.getByRole('button', { name: /enable notifications/i })
    fireEvent.click(button)
    expect(onRequest).toHaveBeenCalled()
  })

  it('shows enabled badge when permission granted', () => {
    render(<NotificationOptInCard permission="granted" onRequest={vi.fn()} />)

    expect(screen.getByText('Enabled')).toBeTruthy()
  })

  it('warns when permission denied', () => {
    render(<NotificationOptInCard permission="denied" onRequest={vi.fn()} />)

    expect(
      screen.getByText(/permission blocked — allow notifications/i),
    ).toBeTruthy()
  })
})
