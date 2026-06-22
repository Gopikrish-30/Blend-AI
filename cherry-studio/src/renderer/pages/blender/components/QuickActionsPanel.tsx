import { useTabs } from '@renderer/hooks/useTabs'
import { getDefaultRouteTitle } from '@renderer/utils/routeTitle'
import { ArrowRight, MessageSquare, Settings, Wrench } from 'lucide-react'
import type { FC } from 'react'

interface Props {
  isConnected: boolean
}

interface QuickAction {
  icon: typeof MessageSquare
  label: string
  description: string
  onClick: () => void
  disabled?: boolean
  highlight?: boolean
}

export const QuickActionsPanel: FC<Props> = ({ isConnected }) => {
  const { openTab } = useTabs()

  const actions: QuickAction[] = [
    {
      icon: MessageSquare,
      label: 'Open Blender Chat',
      description: 'Start a new conversation with the Blender Assistant',
      onClick: () => openTab('/app/chat', { forceNew: true, title: getDefaultRouteTitle('/app/chat') }),
      highlight: true
    },
    {
      icon: Settings,
      label: 'MCP Settings',
      description: 'Configure Blender MCP server connection and tool approvals',
      onClick: () => openTab('/settings/mcp', { forceNew: true, title: 'MCP Settings' })
    },
    {
      icon: Wrench,
      label: 'Model Settings',
      description: 'Add LM Studio, Groq, or other AI providers',
      onClick: () => openTab('/settings/model', { forceNew: true, title: 'Model Settings' })
    }
  ]

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 font-semibold text-sm text-foreground">Quick Actions</div>
      <div className="space-y-2">
        {actions.map((action) => (
          <button
            type="button"
            key={action.label}
            onClick={action.onClick}
            disabled={action.disabled}
            className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              action.highlight
                ? 'bg-primary/5 hover:bg-primary/10 border border-primary/20'
                : 'hover:bg-accent/60'
            }`}>
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              action.highlight ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
            <action.icon size={15} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-foreground text-sm">{action.label}</div>
            <div className="truncate text-muted-foreground text-xs">{action.description}</div>
          </div>
          <ArrowRight
            size={14}
            className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          />
          </button>
        ))}
      </div>

      {!isConnected && (
        <div className="mt-3 rounded-lg bg-muted/40 px-3 py-2 text-muted-foreground text-xs">
          Install blender-mcp:{' '}
          <code className="rounded bg-muted px-1 font-mono text-xs">pip install blender-mcp</code>
          {' '}then enable the addon in Blender.
        </div>
      )}
    </div>
  )
}
