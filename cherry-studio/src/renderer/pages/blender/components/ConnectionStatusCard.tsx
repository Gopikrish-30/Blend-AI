import { cn } from '@renderer/utils'
import { Loader2, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import type { FC } from 'react'

interface Props {
  status: 'connected' | 'disconnected'
  host: string
  port: number
  checkedAt: number
  isChecking: boolean
  onCheck: () => void
}

export const ConnectionStatusCard: FC<Props> = ({ status, host, port, checkedAt, isChecking, onCheck }) => {
  const isConnected = status === 'connected'
  const lastChecked = checkedAt ? new Date(checkedAt).toLocaleTimeString() : '—'

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-semibold text-sm text-foreground">Blender Connection</span>
        <button
          type="button"
          onClick={onCheck}
          disabled={isChecking}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50">
          {isChecking ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
            isConnected ? 'bg-green-500/10 text-green-500' : 'bg-destructive/10 text-destructive'
          )}>
          {isConnected ? <Wifi size={20} /> : <WifiOff size={20} />}
        </div>
        <div className="min-w-0">
          <div className={cn('font-semibold text-sm', isConnected ? 'text-green-500' : 'text-destructive')}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
          <div className="font-mono text-muted-foreground text-xs">
            {host}:{port}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <span>Last checked</span>
        <span className="font-mono">{lastChecked}</span>
      </div>

      {!isConnected && (
        <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
          <div className="mb-1 font-semibold">To connect:</div>
          <ol className="list-inside list-decimal space-y-0.5">
            <li>Open Blender</li>
            <li>Enable the BlenderMCP addon</li>
            <li>Click Connect in the N-Panel → BlenderMCP tab</li>
          </ol>
        </div>
      )}
    </div>
  )
}
