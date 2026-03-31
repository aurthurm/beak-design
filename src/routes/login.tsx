import { createFileRoute, useNavigate, redirect } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { LoginForm } from '@/components/login-form'
import { authStore, login, isAuthenticated } from '@/lib/auth-store'
import { useStore } from '@tanstack/react-store'

export const Route = createFileRoute('/login')({
  component: LoginPage,
  beforeLoad: async () => {
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
  const isAuthenticated = useStore(authStore, (state) => state.isAuthenticated)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: '/app' })
    }
  }, [isAuthenticated, navigate])

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
    } catch (error) {
      console.error('Login error:', error)
      setError('An error occurred during login. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-4xl">
        <LoginForm onSubmit={handleSubmit} error={error} isLoading={isLoading} />
      </div>
    </div>
  )
}
