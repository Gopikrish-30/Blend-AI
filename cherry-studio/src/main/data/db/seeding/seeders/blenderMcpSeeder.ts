import { mcpServerTable } from '@data/db/schemas/mcpServer'
import { eq } from 'drizzle-orm'
import { app } from 'electron'
import path from 'path'

import type { DbType, ISeeder } from '../../types'
import { hashObject } from '../hashObject'

/**
 * Tools that require explicit user approval before executing.
 * These are asset download/import and code execution tools that
 * have irreversible effects or trigger network downloads.
 */
const BLENDER_MCP_APPROVAL_GATED_TOOLS = [
  // Asset downloads — network + scene modification
  'download_polyhaven_asset',
  'download_sketchfab_model',
  // 3D generation — expensive API calls
  'generate_hyper3d_model_via_text',
  'generate_hyper3d_model_via_images',
  'generate_hunyuan3d_model',
  // Asset imports — scene modification
  'import_generated_asset',
  'import_generated_asset_hunyuan',
  // Texture application — scene modification
  'set_texture',
  // Code execution — arbitrary Python in Blender
  'execute_blender_code'
] as const

const getBlenderMcpDir = (): string => {
  if (process.env.BLENDER_MCP_DIR) {
    return process.env.BLENDER_MCP_DIR
  }
  try {
    const appRoot = app.getAppPath()
    if (app.isPackaged) {
      return path.resolve(appRoot, '../../blender-mcp')
    }
    return path.resolve(appRoot, '../blender-mcp')
  } catch {
    return 'C:/Users/admin/Desktop/Blender-Agent-RW/blender-mcp'
  }
}

const getBlenderMcpSeed = () => ({
  name: 'Blender MCP',
  type: 'stdio' as const,
  description: 'Connect AI to a live Blender instance via MCP — create scenes, import assets, run scripts.',
  command: 'uv',
  args: ['run', '--directory', getBlenderMcpDir(), 'blender-mcp'],
  env: {
    BLENDER_HOST: 'localhost',
    BLENDER_PORT: '9876'
  },
  isActive: true,
  installSource: 'builtin' as const,
  isTrusted: false,
  sortOrder: 0,
  disabledAutoApproveTools: [...BLENDER_MCP_APPROVAL_GATED_TOOLS]
})

export class BlenderMcpSeeder implements ISeeder {
  readonly name = 'blenderMcp'
  readonly description = 'Seed Blender MCP server with pre-configured asset approval gating'
  readonly executionPolicy = 'run-on-change' as const
  readonly version: string

  constructor() {
    this.version = hashObject(getBlenderMcpSeed())
  }

  async run(db: DbType): Promise<void> {
    const seed = getBlenderMcpSeed()
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: mcpServerTable.id })
        .from(mcpServerTable)
        .where(eq(mcpServerTable.name, seed.name))
        .limit(1)

      if (existing) {
        // Update approval-gated tools and env if server already exists
        await tx
          .update(mcpServerTable)
          .set({
            description: seed.description,
            command: seed.command,
            args: seed.args,
            env: seed.env,
            disabledAutoApproveTools: seed.disabledAutoApproveTools,
            installSource: seed.installSource
          })
          .where(eq(mcpServerTable.id, existing.id))
        return
      }

      await tx.insert(mcpServerTable).values(seed)
    })
  }
}
