import { loggerService } from '@logger'
import type { McpCallToolResponse } from '@main/ai/mcp/types'
import { application } from '@main/core/application'
import { mcpServerService } from '@main/data/services/McpServerService'
import { isMcpToolForcePromptBySource } from '@shared/ai/tools/mcpSourcePolicy'
import { isFunctionCallToolNameForServer } from '@shared/ai/tools/mcpToolName'
import type { McpServer } from '@shared/data/types/mcpServer'
import type { McpTool } from '@shared/types/mcp'
import { jsonSchema, type JSONSchema7, type Tool } from 'ai'

import { registry, type ToolRegistry } from '../registry'
import type { ToolEntry } from '../types'
import { mcpResultToTextSummary } from './utils'

const logger = loggerService.withContext('mcpTools')

// ── Schema liberalization + arg coercion ──────────────────────────────────────
//
// Some models (notably Gemini) return array-typed tool-call parameters as JSON
// strings (e.g. location: "[0,0,0]") instead of actual arrays. The AI SDK
// validates args against the inputSchema before calling execute, so the raw
// schema would reject these and produce a StreamError before the tool runs.
//
// Fix: widen every array/integer property in the schema to also accept strings,
// then coerce the string values back to the proper type inside execute().

type JSONSchema7Obj = Exclude<JSONSchema7, boolean>

/** Recursively widen array/integer-typed properties to also accept strings. */
function liberalizeSchema(schema: JSONSchema7): JSONSchema7 {
  if (typeof schema !== 'object' || schema === null) return schema
  const s = schema as JSONSchema7Obj

  if (s.type === 'array') {
    return { anyOf: [s, { type: 'string' as const }], description: s.description }
  }

  if (s.type === 'integer') {
    return { anyOf: [s, { type: 'string' as const }], description: s.description }
  }

  if (s.properties) {
    const props: Record<string, JSONSchema7> = {}
    for (const [k, v] of Object.entries(s.properties)) {
      // s.properties values can be JSONSchema7 | boolean (draft-7 allows true/false as schemas).
      // Boolean schemas need no liberalization; cast them through as-is.
      props[k] = typeof v === 'object' && v !== null ? liberalizeSchema(v as JSONSchema7) : (v as unknown as JSONSchema7)
    }
    return { ...s, properties: props }
  }

  return s
}

/** Coerce string values back to proper types using the ORIGINAL (strict) schema. */
function coerceArgs(args: Record<string, unknown>, schema: JSONSchema7): Record<string, unknown> {
  if (typeof schema !== 'object' || schema === null) return args
  const s = schema as JSONSchema7Obj

  // Strip nulls first — models pass null for optional params that should simply be omitted.
  // Python MCP servers use Pydantic v2, which rejects None for non-Optional-annotated fields.
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(args)) {
    if (v !== null && v !== undefined) out[k] = v
  }

  if (!s.properties) return out

  for (const [key, rawProp] of Object.entries(s.properties)) {
    if (!(key in out)) continue
    if (typeof rawProp !== 'object' || rawProp === null) continue
    const prop = rawProp as JSONSchema7Obj
    const val = out[key]

    if (prop.type === 'array' && typeof val === 'string') {
      try {
        const parsed = JSON.parse(val)
        if (Array.isArray(parsed)) { out[key] = parsed; continue }
      } catch { /* fall through to comma-split */ }
      out[key] = val.split(',').map((v) => {
        const t = v.trim()
        const n = Number(t)
        return Number.isNaN(n) ? t : n
      })
    } else if (prop.type === 'integer' && typeof val === 'string') {
      const n = Number(val)
      if (!Number.isNaN(n)) out[key] = Math.round(n)
    } else if (prop.type === 'object' && typeof val === 'object' && val !== null && !Array.isArray(val)) {
      out[key] = coerceArgs(val as Record<string, unknown>, prop)
    }
  }
  return out
}

async function resolveActiveServerById(serverId: string): Promise<McpServer | undefined> {
  // Direct point lookup instead of listing every active server on each tool call.
  const server = await mcpServerService.getById(serverId).catch(() => undefined)
  return server?.isActive ? server : undefined
}

/** Build the AI SDK Tool wrapper around a single McpTool. */
function createMcpTool(mcpTool: McpTool, forcePrompt: boolean): Tool {
  const originalSchema = mcpTool.inputSchema as JSONSchema7
  const liberalizedSchema = liberalizeSchema(originalSchema)
  return {
    type: 'function',
    description: mcpTool.description || mcpTool.name,
    inputSchema: jsonSchema(liberalizedSchema),
    needsApproval: async () => forcePrompt,
    execute: async (rawArgs: Record<string, unknown>, { toolCallId }) => {
      const args = coerceArgs(rawArgs, originalSchema)
      const server = await resolveActiveServerById(mcpTool.serverId)
      if (!server) {
        throw new Error(`MCP server ${mcpTool.serverId} is not active or no longer registered`)
      }
      const result: McpCallToolResponse = await application.get('McpRuntimeService').callTool({
        serverId: server.id,
        name: mcpTool.name,
        args,
        callId: toolCallId
      })

      if (result.isError) {
        throw new Error(mcpResultToTextSummary(result) || 'MCP tool call failed')
      }

      // Full McpCallToolResponse for the renderer's ToolUIPart (multimodal
      // parts intact); `toModelOutput` below produces the string view.
      return {
        ...result,
        metadata: {
          serverName: mcpTool.serverName,
          serverId: mcpTool.serverId,
          type: 'mcp' as const
        }
      }
    },
    toModelOutput({ output }) {
      const result = output as McpCallToolResponse
      return { type: 'text' as const, value: mcpResultToTextSummary(result) }
    }
  }
}

function toEntry(mcpTool: McpTool, server: McpServer): ToolEntry {
  // A force-prompt (approval-gated) tool must never defer: deferring removes it from the SDK
  // tool-set, so the SDK's native `needsApproval` gate never fires and it becomes reachable only
  // via `tool_invoke` — which would run it with no approval card. Keep it inline. Reading
  // `forcePrompt` once keeps `defer` and `needsApproval` in lock-step (they must always agree).
  const forcePrompt = isMcpToolForcePromptBySource(server, mcpTool)
  // Servers tagged 'defer:never' opt out of deferred exposition — all their tools
  // stay inline in request.tools so the model can call them by name directly.
  const serverNeverDefer = server.tags?.includes('defer:never') ?? false
  return {
    // Use the short protocol-level name (e.g. 'get_full_scene_context') as the
    // tools-object key so the model can call it by the same name the system
    // prompt uses. The full function-call id (mcpTool.id) is kept for the
    // applies() predicate only — mcpToolIds always carries full ids.
    name: mcpTool.name,
    namespace: `mcp:${server.name}`,
    description: mcpTool.description || mcpTool.name,
    defer: forcePrompt || serverNeverDefer ? 'never' : 'auto',
    tool: createMcpTool(mcpTool, forcePrompt),
    applies: (scope) => scope.mcpToolIds.has(mcpTool.id)
  }
}

/** Keep servers that own at least one selected tool id (see `buildFunctionCallToolName`). */
function filterServersByToolIds(
  servers: readonly McpServer[],
  selectedToolIds: ReadonlySet<string>
): readonly McpServer[] {
  if (!selectedToolIds.size) return []
  return servers.filter((server) => {
    for (const id of selectedToolIds) {
      if (isFunctionCallToolNameForServer(server.name, id)) return true
    }
    return false
  })
}

export interface SyncMcpToolsToRegistryOptions {
  /**
   * Restrict the per-server `listTools` round-trip to servers owning a
   * selected tool. Stale-server cleanup still runs globally. Omit for
   * full reconcile (bootstrap / admin).
   */
  readonly selectedToolIds?: ReadonlySet<string>
}

/**
 * Reconcile the registry against the live server snapshot. Adds new
 * tools, replaces existing (so schema changes take effect), drops
 * deactivated — covers server uninstall and `tools/list_changed`
 * without subscribing to events.
 */
export async function syncMcpToolsToRegistry(
  reg: ToolRegistry = registry,
  opts: SyncMcpToolsToRegistryOptions = {}
): Promise<void> {
  const { items: activeServers } = await mcpServerService.list({ isActive: true })

  const targetServers = opts.selectedToolIds
    ? filterServersByToolIds(activeServers, opts.selectedToolIds)
    : activeServers
  const targetNamespaces = new Set(targetServers.map((s) => `mcp:${s.name}`))
  const activeNamespaces = new Set(activeServers.map((s) => `mcp:${s.name}`))

  const freshNames = new Set<string>()
  // Only namespaces whose `listTools` actually succeeded. A transient connection drop
  // must NOT evict a still-active server's previously-registered tools — without this
  // guard the eviction loop below sees every prior tool as `missing` and deregisters them.
  const refreshedNamespaces = new Set<string>()
  for (const server of targetServers) {
    try {
      const enabledTools = await application.get('McpCatalogService').listTools(server.id, { includeDisabled: false })
      for (const mcpTool of enabledTools) {
        reg.register(toEntry(mcpTool, server))
        freshNames.add(mcpTool.name)
      }
      refreshedNamespaces.add(`mcp:${server.name}`)
    } catch (error) {
      logger.error('Failed to list MCP tools for server', {
        serverId: server.id,
        serverName: server.name,
        error
      })
    }
  }

  for (const entry of reg.getAll()) {
    if (!entry.namespace.startsWith('mcp:')) continue
    const serverDeactivated = !activeNamespaces.has(entry.namespace)
    // Gate the in-scope eviction on a successful refresh, so a failed `listTools` leaves
    // the prior snapshot intact. A truly deactivated server is still evicted regardless.
    const inSyncScope = targetNamespaces.has(entry.namespace) && refreshedNamespaces.has(entry.namespace)
    const missing = !freshNames.has(entry.name)
    if (serverDeactivated || (inSyncScope && missing)) {
      reg.deregister(entry.name)
    }
  }
}
