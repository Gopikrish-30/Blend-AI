import { IpcChannel } from '@shared/IpcChannel'
import { useCallback, useEffect, useState } from 'react'

export interface BlenderConnectionState {
  status: 'connected' | 'disconnected'
  host: string
  port: number
  checkedAt: number
}

const DEFAULT_STATE: BlenderConnectionState = {
  status: 'disconnected',
  host: 'localhost',
  port: 9876,
  checkedAt: 0
}

/**
 * Subscribes to Blender connection status pushed from BlenderConnectionService.
 * Seeds initial state via a pull on mount and listens for change events.
 */
export function useBlenderConnection() {
  const [connectionState, setConnectionState] = useState<BlenderConnectionState>(DEFAULT_STATE)
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    let cancelled = false

    void window.api.blender.getConnectionStatus().then((state) => {
      if (!cancelled) setConnectionState(state)
    })

    const cleanup = window.electron.ipcRenderer.on(
      IpcChannel.Blender_ConnectionStatusChanged,
      (_event, state: BlenderConnectionState) => {
        setConnectionState(state)
      }
    )

    return () => {
      cancelled = true
      cleanup()
    }
  }, [])

  const checkConnection = useCallback(async () => {
    setIsChecking(true)
    try {
      const state = await window.api.blender.checkConnection()
      setConnectionState(state)
    } finally {
      setIsChecking(false)
    }
  }, [])

  return { connectionState, isChecking, checkConnection }
}
