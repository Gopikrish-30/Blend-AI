import { Camera, Loader2, Monitor, RefreshCw, Timer } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

interface Props {
  isConnected: boolean
}

export const ViewportPanel: FC<Props> = ({ isConnected }) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [capturedAt, setCapturedAt] = useState<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const capture = useCallback(async () => {
    if (!isConnected || isCapturing) return
    setIsCapturing(true)
    setError(null)
    try {
      const res = await window.api.blender.executeCommand('get_viewport_screenshot', { max_size: 1024 })
      if (res.success && res.result?.image) {
        setImageSrc(`data:image/png;base64,${res.result.image as string}`)
        setCapturedAt(Date.now())
      } else {
        setError(res.error ?? 'Screenshot failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsCapturing(false)
    }
  }, [isConnected, isCapturing])

  // Auto-refresh every 3 seconds when enabled and connected
  useEffect(() => {
    if (autoRefresh && isConnected) {
      intervalRef.current = setInterval(() => void capture(), 3000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [autoRefresh, isConnected, capture])

  // Clear image when disconnected
  useEffect(() => {
    if (!isConnected) {
      setImageSrc(null)
      setCapturedAt(null)
      setAutoRefresh(false)
    }
  }, [isConnected])

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Monitor size={15} className="text-muted-foreground" />
          <span className="font-semibold text-sm text-foreground">Viewport</span>
          {capturedAt && (
            <span className="text-muted-foreground text-xs">{new Date(capturedAt).toLocaleTimeString()}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setAutoRefresh((v) => !v)}
            disabled={!isConnected}
            title={autoRefresh ? 'Disable auto-refresh' : 'Enable auto-refresh (3s)'}
            className={`flex h-7 items-center gap-1 rounded-md px-2 text-xs transition-colors disabled:opacity-50 ${
              autoRefresh
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}>
            <Timer size={12} />
            <span>Auto</span>
          </button>
          <button
            type="button"
            onClick={capture}
            disabled={!isConnected || isCapturing}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50">
            {isCapturing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>
      </div>

      <div className="relative aspect-video w-full bg-black/20">
        {!isConnected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <Camera size={36} className="opacity-30" />
            <span className="text-sm">Connect to Blender to capture the viewport</span>
          </div>
        )}

        {isConnected && !imageSrc && !isCapturing && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Camera size={36} className="opacity-30" />
            <button
              type="button"
              onClick={capture}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground text-sm font-medium transition-opacity hover:opacity-90">
              <Camera size={14} />
              Capture Viewport
            </button>
          </div>
        )}

        {isCapturing && !imageSrc && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={28} className="animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="rounded-lg bg-destructive/10 p-3 text-center text-destructive text-xs max-w-64">{error}</div>
          </div>
        )}

        {imageSrc && (
          <>
            <img
              src={imageSrc}
              alt="Blender viewport"
              className="h-full w-full object-contain"
              draggable={false}
            />
            {isCapturing && (
              <div className="absolute top-2 right-2">
                <Loader2 size={16} className="animate-spin text-white drop-shadow-md" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
