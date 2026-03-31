import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Button, Separator, SidebarProvider, useIsMobile } from './index'

describe('shared-ui package', () => {
  it('exports the shared primitives and hooks', () => {
    expect(typeof Button).toBe('function')
    expect(typeof Separator).toBe('function')
    expect(typeof SidebarProvider).toBe('function')
    expect(typeof useIsMobile).toBe('function')
  })

  it('renders core primitives without throwing', () => {
    const markup = renderToStaticMarkup(
      <SidebarProvider>
        <div>
          <Button>Save</Button>
          <Separator orientation="horizontal" />
        </div>
      </SidebarProvider>
    )

    expect(markup).toContain('Save')
  })
})
