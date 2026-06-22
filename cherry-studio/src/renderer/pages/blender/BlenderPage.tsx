import { Navbar, NavbarCenter, NavbarRight } from '@renderer/components/app/Navbar'
import { cn } from '@renderer/utils'
import { Wifi, WifiOff } from 'lucide-react'
import type { FC } from 'react'

import { ConnectionStatusCard } from './components/ConnectionStatusCard'
import { QuickActionsPanel } from './components/QuickActionsPanel'
import { SceneInspectorPanel } from './components/SceneInspectorPanel'
import { ViewportPanel } from './components/ViewportPanel'
import { useBlenderConnection } from './hooks/useBlenderConnection'

const BlenderPage: FC = () => {
  const { connectionState, isChecking, checkConnection } = useBlenderConnection()
  const isConnected = connectionState.status === 'connected'

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Navbar>
        <NavbarCenter>Blender Studio</NavbarCenter>
        <NavbarRight>
          <div
            className={cn(
              'mr-4 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
              isConnected
                ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                : 'bg-muted text-muted-foreground'
            )}>
            {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
            <span>{isConnected ? `localhost:${connectionState.port}` : 'Not connected'}</span>
          </div>
        </NavbarRight>
      </Navbar>

      <div className="flex flex-1 gap-4 overflow-hidden p-4">
        {/* Left column — status + inspector */}
        <div className="flex w-72 shrink-0 flex-col gap-4 overflow-hidden">
          <ConnectionStatusCard
            status={connectionState.status}
            host={connectionState.host}
            port={connectionState.port}
            checkedAt={connectionState.checkedAt}
            isChecking={isChecking}
            onCheck={checkConnection}
          />
          <SceneInspectorPanel isConnected={isConnected} />
        </div>

        {/* Right column — viewport + quick actions */}
        <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto">
          <ViewportPanel isConnected={isConnected} />
          <QuickActionsPanel isConnected={isConnected} />
        </div>
      </div>
    </div>
  )
}

export default BlenderPage
