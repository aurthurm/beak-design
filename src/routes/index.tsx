import { createFileRoute, redirect } from '@tanstack/react-router'
import { isAuthenticated } from '@/lib/auth-store'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    if (typeof window === 'undefined') {
      throw redirect({ to: '/login' })
    }

    if (!isAuthenticated()) {
      throw redirect({ to: '/login' })
    } else {
      throw redirect({ to: '/app' })
    }
  },
})
