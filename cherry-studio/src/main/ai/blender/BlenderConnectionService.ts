import { application } from '@application'
import { loggerService } from '@logger'
import { BaseService, DependsOn, Injectable, Phase, ServicePhase } from '@main/core/lifecycle'
import { WindowType } from '@main/core/window/types'
import { IpcChannel } from '@shared/IpcChannel'
import { app } from 'electron'
import { readFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { connect } from 'net'

const logger = loggerService.withContext('BlenderConnectionService')

const POLL_INTERVAL_MS = 5_000
const CONNECT_TIMEOUT_MS = 2_000
const COMMAND_TIMEOUT_MS = 15_000

export type BlenderConnectionStatus = 'connected' | 'disconnected'

export interface BlenderConnectionState {
  status: BlenderConnectionStatus
  host: string
  port: number
  checkedAt: number
}

export interface BlenderCommandResult {
  success: boolean
  result?: Record<string, unknown>
  error?: string
}

/**
 * Monitors liveness of the Blender TCP socket at localhost:9876.
 * Polls every 5 seconds and pushes status changes to the main window renderer.
 */
@Injectable('BlenderConnectionService')
@ServicePhase(Phase.WhenReady)
@DependsOn(['WindowManager'])
export class BlenderConnectionService extends BaseService {
  private connectionState: BlenderConnectionState = {
    status: 'disconnected',
    host: 'localhost',
    port: 9876,
    checkedAt: 0
  }

  protected onInit(): void {
    this.ipcHandle(IpcChannel.Blender_GetConnectionStatus, () => this.connectionState)
    this.ipcHandle(IpcChannel.Blender_CheckConnection, async () => {
      await this.check()
      return this.connectionState
    })
    this.ipcHandle(
      IpcChannel.Blender_ExecuteCommand,
      async (_event, payload: { type: string; params?: Record<string, unknown> }) => {
        if (payload.type === 'get_viewport_screenshot') {
          return this.captureViewportScreenshot(payload.params ?? {})
        }
        return this.executeCommand(payload.type, payload.params ?? {})
      }
    )
  }

  protected onReady(): void {
    void this.check()
    this.registerInterval(() => this.check(), POLL_INTERVAL_MS)
  }

  private async check(): Promise<void> {
    const { host, port } = this.connectionState
    const isReachable = await this.probe(host, port)
    const newStatus: BlenderConnectionStatus = isReachable ? 'connected' : 'disconnected'
    const previousStatus = this.connectionState.status

    this.connectionState = { ...this.connectionState, status: newStatus, checkedAt: Date.now() }

    if (newStatus !== previousStatus) {
      logger.info(`Blender connection status: ${previousStatus} -> ${newStatus}`, { host, port })
      application
        .get('WindowManager')
        .broadcastToType(WindowType.Main, IpcChannel.Blender_ConnectionStatusChanged, this.connectionState)
    }
  }

  /**
   * Execute a command on the Blender TCP socket.
   * Opens a fresh connection per call, sends the JSON command, reads the JSON response.
   * Same framing as blender-mcp's server.py send_command().
   */
  async executeCommand(type: string, params: Record<string, unknown> = {}): Promise<BlenderCommandResult> {
    const { host, port } = this.connectionState
    return new Promise((resolve) => {
      const socket = connect({ host, port })
      let rawData = Buffer.alloc(0)
      let settled = false

      const settle = (result: BlenderCommandResult) => {
        if (settled) return
        settled = true
        socket.destroy()
        resolve(result)
      }

      const timer = setTimeout(() => settle({ success: false, error: 'Command timed out' }), COMMAND_TIMEOUT_MS)

      socket.on('connect', () => {
        const request = JSON.stringify({ type, params })
        socket.write(request)
      })

      socket.on('data', (chunk: Buffer) => {
        rawData = Buffer.concat([rawData, chunk])
        try {
          const response = JSON.parse(rawData.toString('utf8')) as {
            status: string
            result?: Record<string, unknown>
            message?: string
          }
          clearTimeout(timer)
          if (response.status === 'success') {
            settle({ success: true, result: response.result ?? {} })
          } else {
            settle({ success: false, error: response.message ?? 'Command failed' })
          }
        } catch {
          // incomplete JSON — wait for more data
        }
      })

      socket.on('error', (err) => {
        clearTimeout(timer)
        settle({ success: false, error: err.message })
      })

      socket.on('close', () => {
        clearTimeout(timer)
        if (!settled) {
          settle({ success: false, error: 'Connection closed unexpectedly' })
        }
      })
    })
  }

  /**
   * Captures a viewport screenshot by injecting a temp filepath, reading the saved
   * PNG back from disk, base64-encoding it, and returning { image: base64String }.
   * The addon's get_viewport_screenshot requires a filepath; it does not stream pixels.
   */
  private async captureViewportScreenshot(params: Record<string, unknown>): Promise<BlenderCommandResult> {
    const tempPath = join(app.getPath('temp'), `blender_viewport_${Date.now()}.png`)
    const res = await this.executeCommand('get_viewport_screenshot', { ...params, filepath: tempPath })
    if (!res.success) return res
    try {
      const imageData = readFileSync(tempPath)
      const base64 = imageData.toString('base64')
      try { unlinkSync(tempPath) } catch { /* best-effort cleanup */ }
      return { success: true, result: { image: base64, width: res.result?.width, height: res.result?.height } }
    } catch (err) {
      return { success: false, error: `Screenshot saved but could not be read: ${String(err)}` }
    }
  }

  private probe(host: string, port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = connect({ host, port })
      let settled = false

      const settle = (result: boolean) => {
        if (settled) return
        settled = true
        socket.destroy()
        resolve(result)
      }

      const timer = setTimeout(() => settle(false), CONNECT_TIMEOUT_MS)

      socket.on('connect', () => {
        clearTimeout(timer)
        settle(true)
      })
      socket.on('error', () => {
        clearTimeout(timer)
        settle(false)
      })
    })
  }
}
