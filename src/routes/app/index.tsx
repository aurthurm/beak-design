import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/app/')({
  beforeLoad: () => {
    // Redirect to canvas by default
    throw redirect({ to: '/app/canvas' })
  },
})
