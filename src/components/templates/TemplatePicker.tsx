import { useState } from 'react'
import { DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { TemplateManager, type Template } from '@/lib/templates/template-manager'
import { canvasActions } from '@/lib/canvas/store'
import { cn } from '@/lib/utils'

interface TemplatePickerProps {
  onSelect?: (templateId: string) => void
  onClose?: () => void
  styleGuidesOnly?: boolean
}

export function TemplatePicker({
  onSelect,
  onClose,
  styleGuidesOnly = false,
}: TemplatePickerProps) {
  const [isLoading, setIsLoading] = useState(false)
  const templates = TemplateManager.getTemplates()

  const handleSelectTemplate = async (templateId: string) => {
    setIsLoading(true)
    try {
      const document = await TemplateManager.loadTemplate(templateId)
      if (document) {
        canvasActions.setDocument(document)
        canvasActions.setActivePage(document.activePageId)
        onSelect?.(templateId)
        onClose?.()
      }
    } catch (error) {
      console.error('Failed to load template:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (styleGuidesOnly) {
    // Style guides section (for future implementation)
    return (
      <DialogContent className="w-[90vw] min-w-[740px] max-w-[1024px] p-1 gap-4 rounded-lg">
        <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto p-4">
          <div className="flex items-center justify-center">
            <span className="text-lg font-semibold">Pick a Style Guide</span>
          </div>
          <div className="text-sm text-muted-foreground text-center">
            Style guides coming soon
          </div>
        </div>
      </DialogContent>
    )
  }

  return (
    <DialogContent
      className={cn(
        'w-[90vw] min-w-[740px] max-w-[1024px] p-1 gap-4 rounded-lg',
        'bg-background border'
      )}
    >
      <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto p-4">
        <div className="flex items-center justify-center">
          <span className="text-lg font-semibold">Choose a Template</span>
        </div>

        <div className="flex flex-wrap gap-6 justify-center">
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              className={cn(
                'flex flex-col gap-2 w-[200px] flex-shrink-0 group',
                'focus:outline-none transition-opacity',
                isLoading && 'opacity-50 cursor-not-allowed'
              )}
              onClick={() => handleSelectTemplate(template.id)}
              disabled={isLoading}
            >
              <div
                className={cn(
                  'w-full h-[120px] rounded-md border-2',
                  'bg-muted flex items-center justify-center',
                  'group-hover:border-primary transition-colors',
                  template.thumbnail && 'bg-cover bg-center'
                )}
                style={
                  template.thumbnail
                    ? {
                        backgroundImage: `url(${template.thumbnail})`,
                      }
                    : undefined
                }
              >
                {!template.thumbnail && (
                  <div className="text-muted-foreground text-sm">
                    {template.name}
                  </div>
                )}
              </div>
              <div className="text-center">
                <div className="text-sm font-medium">{template.name}</div>
                {template.description && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {template.description}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading template...</span>
          </div>
        )}
      </div>
    </DialogContent>
  )
}
