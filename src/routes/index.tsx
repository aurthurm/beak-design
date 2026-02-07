import { createFileRoute, redirect } from '@tanstack/react-router'
import { isAuthenticated } from '@/lib/auth-store'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    // On server-side, always redirect to login
    if (typeof window === 'undefined') {
      throw redirect({ to: '/login' })
    }
    
    // Redirect to login if not authenticated, otherwise to app
    if (!isAuthenticated()) {
      throw redirect({ to: '/login' })
    } else {
      throw redirect({ to: '/app' })
    }
  },
})
