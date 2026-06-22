import { Box, Layers, Loader2, RefreshCw } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useEffect, useState } from 'react'

interface SceneObject {
  name: string
  type: string
  location?: [number, number, number]
  visible?: boolean
}

interface SceneInfo {
  objects: SceneObject[]
  active_object?: string
  total_objects?: number
  frame_current?: number
}

interface Props {
  isConnected: boolean
}

const TYPE_COLORS: Record<string, string> = {
  MESH: 'text-blue-500',
  LIGHT: 'text-yellow-500',
  CAMERA: 'text-purple-500',
  ARMATURE: 'text-green-500',
  CURVE: 'text-orange-500',
  EMPTY: 'text-muted-foreground'
}

export const SceneInspectorPanel: FC<Props> = ({ isConnected }) => {
  const [sceneInfo, setSceneInfo] = useState<SceneInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!isConnected) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await window.api.blender.executeCommand('get_scene_info', {})
      if (res.success && res.result) {
        setSceneInfo(res.result as unknown as SceneInfo)
      } else {
        setError(res.error ?? 'Failed to get scene info')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }, [isConnected])

  useEffect(() => {
    if (isConnected) {
      void refresh()
    } else {
      setSceneInfo(null)
    }
  }, [isConnected, refresh])

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Layers size={15} className="text-muted-foreground" />
          <span className="font-semibold text-sm text-foreground">Scene Inspector</span>
          {sceneInfo && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
              {sceneInfo.objects?.length ?? 0} objects
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={!isConnected || isLoading}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50">
          {isLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 [&::-webkit-scrollbar]:hidden">
        {!isConnected && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <Box size={32} className="opacity-30" />
            <span className="text-sm">Connect to Blender to inspect the scene</span>
          </div>
        )}

        {isConnected && isLoading && !sceneInfo && (
          <div className="flex h-full items-center justify-center">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-destructive text-xs">{error}</div>
        )}

        {sceneInfo && sceneInfo.objects && (
          <div className="space-y-0.5">
            {sceneInfo.frame_current !== undefined && (
              <div className="mb-2 rounded-md bg-muted/40 px-3 py-1.5 text-muted-foreground text-xs">
                Frame: {sceneInfo.frame_current}
              </div>
            )}
            {sceneInfo.objects.map((obj) => (
              <div
                key={obj.name}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent/60 ${
                  obj.name === sceneInfo.active_object ? 'bg-accent/40 font-medium' : ''
                }`}>
                <Box size={12} className={TYPE_COLORS[obj.type] ?? 'text-muted-foreground'} />
                <span className="flex-1 truncate text-foreground">{obj.name}</span>
                <span className="shrink-0 text-muted-foreground text-xs">{obj.type}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
