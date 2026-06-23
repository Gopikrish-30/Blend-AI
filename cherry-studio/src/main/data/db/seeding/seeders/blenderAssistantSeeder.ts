import { assistantTable } from '@data/db/schemas/assistant'
import { insertWithOrderKey } from '@data/services/utils/orderKey'
import { BLENDER_ASSISTANT_SEED } from '@shared/data/presets/blenderAssistant'
import { eq, isNull, or } from 'drizzle-orm'

import type { DbType, ISeeder } from '../../types'
import { hashObject } from '../hashObject'

export class BlenderAssistantSeeder implements ISeeder {
  readonly name = 'blenderAssistant'
  readonly description = 'Seed Blender-focused assistant with MCP system prompt'
  readonly executionPolicy = 'run-on-change' as const
  readonly version: string

  constructor() {
    this.version = hashObject(BLENDER_ASSISTANT_SEED)
  }

  async run(db: DbType): Promise<void> {
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: assistantTable.id, modelId: assistantTable.modelId })
        .from(assistantTable)
        .where(
          or(
            eq(assistantTable.name, BLENDER_ASSISTANT_SEED.name),
            eq(assistantTable.name, 'Blender Assistant')
          )
        )
        .limit(1)

      if (existing) {
        // Update name/prompt/settings on version bump.
        // Only set modelId if the user hasn't picked one yet — don't overwrite their choice.
        await tx
          .update(assistantTable)
          .set({
            name: BLENDER_ASSISTANT_SEED.name,
            prompt: BLENDER_ASSISTANT_SEED.prompt,
            description: BLENDER_ASSISTANT_SEED.description,
            settings: { ...BLENDER_ASSISTANT_SEED.settings },
            ...(existing.modelId == null ? { modelId: BLENDER_ASSISTANT_SEED.modelId } : {})
          })
          .where(eq(assistantTable.id, existing.id))
        return
      }

      const insertValues = {
        ...BLENDER_ASSISTANT_SEED,
        settings: { ...BLENDER_ASSISTANT_SEED.settings }
      } satisfies Omit<typeof assistantTable.$inferInsert, 'orderKey'>

      await insertWithOrderKey(tx, assistantTable, insertValues, {
        pkColumn: assistantTable.id,
        scope: isNull(assistantTable.deletedAt)
      })
    })
  }
}
