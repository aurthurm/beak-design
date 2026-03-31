import { Fragment, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-konva', () => ({
  Group: ({ children }: { children?: ReactNode }) => <Fragment>{children}</Fragment>,
  Rect: () => null,
  Text: ({ text }: { text?: string }) => <span>{text}</span>,
  Line: () => null,
  Ellipse: () => null,
  Image: () => null,
  Path: () => null,
}))

import { FrameRenderer } from './canvas/FrameRenderer'
import { Grid } from './canvas/Grid'

describe('editor-react render smoke', () => {
  it('renders grid and frame primitives without throwing', () => {
    const gridMarkup = renderToStaticMarkup(
      <Grid
        panX={0}
        panY={0}
        zoom={1}
        width={100}
        height={100}
        enabled={false}
        size={10}
        color="#000000"
        opacity={0.25}
      />
    )

    const frameMarkup = renderToStaticMarkup(
      <FrameRenderer
        frame={{
          id: 'frame-1',
          name: 'Frame',
          rect: { x: 0, y: 0, w: 120, h: 80 },
          background: { kind: 'none' },
          flags: {},
        } as any}
        frameId="frame-1"
        panX={0}
        panY={0}
        zoom={1}
        screenWidth={200}
        screenHeight={200}
        isSelected={false}
      />
    )

    expect(gridMarkup).toBe('')
    expect(frameMarkup).toContain('Frame')
  })
})
