import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { PageHero } from '../PageHero'

describe('PageHero', () => {
  it('renders eyebrow as link when href is provided', () => {
    render(
      <PageHero
        eyebrow={{ label: 'QRnroll', href: '/' }}
        title="Live scanner"
        description={<p>Use the camera.</p>}
      >
        <span>Child content</span>
      </PageHero>,
    )

    const eyebrowLink = screen.getByText('QRnroll')
    expect(eyebrowLink.getAttribute('href')).toBe('/')
    expect(screen.getByText('Live scanner')).toBeTruthy()
    expect(screen.getByText('Child content')).toBeTruthy()
  })

  it('falls back to plain text eyebrow without href', () => {
    render(
      <PageHero
        eyebrow={{ label: 'QRnroll' }}
        title="No link"
        description={<p>Use the camera.</p>}
      />,
    )

    const eyebrowText = screen.getByText('QRnroll', { selector: 'p' })
    expect(eyebrowText.tagName).toBe('P')
  })
})
