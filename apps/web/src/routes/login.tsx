import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useStore } from '@tanstack/react-store'
import { LoginForm } from '@/components/login-form'
import { authStore, isAuthenticated, login } from '@/lib/auth-store'

export const Route = createFileRoute('/login')({
  component: LoginPage,
  beforeLoad: () => {
    if (typeof window === 'undefined') {
      return
    }

    if (isAuthenticated()) {
      throw redirect({ to: '/app' })
    }
  },
})

function LoginPage() {
  const navigate = useNavigate()
  const isAuthenticatedState = useStore(authStore, (state) => state.isAuthenticated)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isAuthenticatedState) {
      navigate({ to: '/app' })
    }
  }, [isAuthenticatedState, navigate])

  const handleSubmit = async (emailOrUsername: string, password: string) => {
    setError(null)
    setIsLoading(true)

    try {
      const username = emailOrUsername.toLowerCase().includes('admin')
        ? 'admin'
        : emailOrUsername.split('@')[0] || emailOrUsername

      const success = await login(username, password)

      if (success) {
        navigate({ to: '/app' })
      } else {
        setError('Invalid username or password. Use admin:admin')
      }
    } catch (loginError) {
      console.error('Login error:', loginError)
      setError('An error occurred during login. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-4xl">
        <LoginForm
          onSubmit={handleSubmit}
          error={error}
          isLoading={isLoading}
        />
      </div>
    </div>
  )
}
