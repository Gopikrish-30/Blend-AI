import { assistantTable } from '@data/db/schemas/assistant'
import { insertWithOrderKey } from '@data/services/utils/orderKey'
import { BLENDER_ASSISTANT_SEED } from '@shared/data/presets/blenderAssistant'
import { isNull, eq } from 'drizzle-orm'

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
        .select({ id: assistantTable.id })
        .from(assistantTable)
        .where(eq(assistantTable.name, BLENDER_ASSISTANT_SEED.name))
        .limit(1)

      if (existing) {
        // Update the prompt and settings so changes propagate on version bump
        await tx
          .update(assistantTable)
          .set({
            prompt: BLENDER_ASSISTANT_SEED.prompt,
            description: BLENDER_ASSISTANT_SEED.description,
            settings: { ...BLENDER_ASSISTANT_SEED.settings }
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
