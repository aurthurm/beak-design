import { createFileRoute, useNavigate, redirect } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { LoginForm } from '@/components/login-form'
import { authStore, login, isAuthenticated } from '@/lib/auth-store'
import { useStore } from '@tanstack/react-store'

export const Route = createFileRoute('/login')({
  component: LoginPage,
  beforeLoad: async () => {
    // On server-side, allow access (client will handle redirect)
    if (typeof window === 'undefined') {
      return
    }
    
    // Redirect to app if already authenticated
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

  // Redirect if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: '/app' })
    }
  }, [isAuthenticated, navigate])

  const handleSubmit = async (emailOrUsername: string, password: string) => {
    setError(null)
    setIsLoading(true)

    try {
      // Extract username from email or use as-is if it's already a username
      // For admin login, accept "admin" or any email with "admin" in it
      const username = emailOrUsername.toLowerCase().includes('admin') 
        ? 'admin' 
        : emailOrUsername.split('@')[0] || emailOrUsername

      const success = await login(username, password)
      
      if (success) {
        navigate({ to: '/app' })
      } else {
        setError('Invalid username or password. Use admin:admin')
      }
    } catch (err) {
      console.error('Login error:', err)
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
