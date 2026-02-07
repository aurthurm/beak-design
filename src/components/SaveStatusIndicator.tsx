import { useStore } from '@tanstack/react-store'
import { canvasStore } from '@/lib/canvas/store'
import { Check, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'

interface SaveStatusIndicatorProps {
  status: SaveStatus | null
  className?: string
  showText?: boolean
}

export function SaveStatusIndicator({ status, className, showText = true }: SaveStatusIndicatorProps) {
  // When status is null, show saved state (green checkmark)
  const effectiveStatus = status || 'saved'
  
  const getStatusConfig = () => {
    switch (effectiveStatus) {
      case 'saved':
        return {
          icon: Check,
          text: 'Saved',
          color: 'text-green-600 dark:text-green-400',
          bgColor: '',
          iconColor: 'text-green-600 dark:text-green-400',
        }
      case 'saving':
        return {
          icon: Loader2,
          text: 'Saving...',
          color: 'text-blue-600 dark:text-blue-400',
          bgColor: '',
          iconColor: 'text-blue-600 dark:text-blue-400',
        }
      case 'unsaved':
        return {
          icon: AlertCircle,
          text: 'Unsaved',
          color: 'text-amber-600 dark:text-amber-400',
          bgColor: '',
          iconColor: 'text-amber-600 dark:text-amber-400',
        }
      case 'error':
        return {
          icon: AlertCircle,
          text: 'Error',
          color: 'text-red-600 dark:text-red-400',
          bgColor: '',
          iconColor: 'text-red-600 dark:text-red-400',
        }
    }
  }

  const config = getStatusConfig()
  const Icon = config.icon

  return (
    <div
      className={cn(
        'flex items-center gap-1.5',
        'transition-all duration-300 ease-in-out',
        className
      )}
    >
      <Icon
        className={cn(
          'size-3.5 transition-all duration-300',
          config.iconColor,
          effectiveStatus === 'saving' && 'animate-spin'
        )}
      />
      {showText && (
        <span className={cn('text-xs font-normal transition-opacity duration-300', config.color)}>
          {config.text}
        </span>
      )}
    </div>
  )
}

export function SaveStatusIndicatorContainer() {
  const saveStatus = useStore(canvasStore, (state) => state.saveStatus)

  if (!saveStatus) return null

  return <SaveStatusIndicator status={saveStatus} />
}
