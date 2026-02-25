import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

import { CodesList } from '../CodesList'
import type { CodeItem } from '@/pages/ScannerPage'

describe('CodesList', () => {
  afterEach(() => cleanup())

  it('shows empty state when no codes', () => {
    render(
      <CodesList
        codes={[]}
        onCopy={vi.fn()}
        onRefresh={vi.fn()}
        onOpen={vi.fn()}
      />,
    )

    expect(screen.getByText('No active codes yet.')).toBeTruthy()
  })

  it('renders codes and calls handlers', async () => {
    const codes: CodeItem[] = [
      { code: 'foo', ts: Date.now() - 1000 },
      { code: 'bar', ts: Date.now() - 2000 },
    ]
    const onCopy = vi.fn().mockResolvedValue(undefined)
    const onRefresh = vi.fn()
    const onOpen = vi.fn()

    render(
      <CodesList
        codes={codes}
        onCopy={onCopy}
        onRefresh={onRefresh}
        onOpen={onOpen}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(onRefresh).toHaveBeenCalled()

    fireEvent.click(screen.getByText('foo'))
    expect(onOpen).toHaveBeenCalledWith('foo')

    const copyButtons = screen.getAllByLabelText('Copy code')
    fireEvent.click(copyButtons[0])
    expect(onCopy).toHaveBeenCalledWith('foo')
  })
})
