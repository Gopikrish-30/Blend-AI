import type { InsertUserModelRow } from '@data/db/schemas/userModel'
import { userModelTable } from '@data/db/schemas/userModel'
import { userProviderTable } from '@data/db/schemas/userProvider'
import { preferenceTable } from '@data/db/schemas/preference'
import { insertManyWithOrderKey } from '@data/services/utils/orderKey'
import { MODEL_CAPABILITY } from '@shared/data/types/model'
import { and, eq, inArray, isNull } from 'drizzle-orm'

import type { DbType, ISeeder } from '../../types'
import { hashObject } from '../hashObject'

type ModelSeed = Omit<InsertUserModelRow, 'orderKey'>

const LOCAL_PROVIDERS = ['lmstudio', 'ollama'] as const

// GitHub Copilot models with function-call support. Seeded so capabilities
// are set correctly even if the model was synced from the Copilot API before
// this seeder last ran (the API returns capabilities:[]).
const COPILOT_FUNCTION_CALL_MODELS: ModelSeed[] = [
  {
    id: 'copilot::gpt-4o',
    providerId: 'copilot',
    modelId: 'gpt-4o',
    presetModelId: null,
    name: 'GPT-4o',
    description: 'OpenAI GPT-4o via GitHub Copilot. Excellent function calling.',
    group: 'OpenAI',
    capabilities: [MODEL_CAPABILITY.FUNCTION_CALL],
    inputModalities: null,
    outputModalities: null,
    endpointTypes: null,
    customEndpointUrl: null,
    contextWindow: 128000,
    maxInputTokens: null,
    maxOutputTokens: null,
    supportsStreaming: true,
    reasoning: null,
    parameters: null,
    pricing: null,
    isEnabled: false,
    isHidden: false,
    isDeprecated: false,
    notes: null,
    userOverrides: null
  },
  {
    id: 'copilot::gpt-4o-mini',
    providerId: 'copilot',
    modelId: 'gpt-4o-mini',
    presetModelId: null,
    name: 'GPT-4o Mini',
    description: 'Fast, cost-effective GPT-4o Mini via GitHub Copilot.',
    group: 'OpenAI',
    capabilities: [MODEL_CAPABILITY.FUNCTION_CALL],
    inputModalities: null,
    outputModalities: null,
    endpointTypes: null,
    customEndpointUrl: null,
    contextWindow: 128000,
    maxInputTokens: null,
    maxOutputTokens: null,
    supportsStreaming: true,
    reasoning: null,
    parameters: null,
    pricing: null,
    isEnabled: false,
    isHidden: false,
    isDeprecated: false,
    notes: null,
    userOverrides: null
  },
  {
    id: 'copilot::claude-3.7-sonnet',
    providerId: 'copilot',
    modelId: 'claude-3.7-sonnet',
    presetModelId: null,
    name: 'Claude 3.7 Sonnet',
    description: 'Anthropic Claude 3.7 Sonnet via GitHub Copilot. Excellent for complex tasks.',
    group: 'Anthropic',
    capabilities: [MODEL_CAPABILITY.FUNCTION_CALL],
    inputModalities: null,
    outputModalities: null,
    endpointTypes: null,
    customEndpointUrl: null,
    contextWindow: 200000,
    maxInputTokens: null,
    maxOutputTokens: null,
    supportsStreaming: true,
    reasoning: null,
    parameters: null,
    pricing: null,
    isEnabled: false,
    isHidden: false,
    isDeprecated: false,
    notes: null,
    userOverrides: null
  },
  {
    id: 'copilot::claude-3.5-sonnet',
    providerId: 'copilot',
    modelId: 'claude-3.5-sonnet',
    presetModelId: null,
    name: 'Claude 3.5 Sonnet',
    description: 'Anthropic Claude 3.5 Sonnet via GitHub Copilot.',
    group: 'Anthropic',
    capabilities: [MODEL_CAPABILITY.FUNCTION_CALL],
    inputModalities: null,
    outputModalities: null,
    endpointTypes: null,
    customEndpointUrl: null,
    contextWindow: 200000,
    maxInputTokens: null,
    maxOutputTokens: null,
    supportsStreaming: true,
    reasoning: null,
    parameters: null,
    pricing: null,
    isEnabled: false,
    isHidden: false,
    isDeprecated: false,
    notes: null,
    userOverrides: null
  },
  {
    id: 'copilot::o3-mini',
    providerId: 'copilot',
    modelId: 'o3-mini',
    presetModelId: null,
    name: 'o3-mini',
    description: 'OpenAI o3-mini reasoning model via GitHub Copilot.',
    group: 'OpenAI',
    capabilities: [MODEL_CAPABILITY.FUNCTION_CALL],
    inputModalities: null,
    outputModalities: null,
    endpointTypes: null,
    customEndpointUrl: null,
    contextWindow: 200000,
    maxInputTokens: null,
    maxOutputTokens: null,
    supportsStreaming: true,
    reasoning: null,
    parameters: null,
    pricing: null,
    isEnabled: false,
    isHidden: false,
    isDeprecated: false,
    notes: null,
    userOverrides: null
  }
]

// Groq models known to support function calling — seeded so they appear with
// the correct capability even before the user manually edits them after a sync.
const GROQ_FUNCTION_CALL_MODELS: ModelSeed[] = [
  {
    id: 'groq::llama-3.3-70b-versatile',
    providerId: 'groq',
    modelId: 'llama-3.3-70b-versatile',
    presetModelId: null,
    name: 'Llama 3.3 70B Versatile',
    description: 'Fast function-calling model on Groq. Free tier available.',
    group: 'Meta',
    capabilities: [MODEL_CAPABILITY.FUNCTION_CALL],
    inputModalities: null,
    outputModalities: null,
    endpointTypes: null,
    customEndpointUrl: null,
    contextWindow: 128000,
    maxInputTokens: null,
    maxOutputTokens: null,
    supportsStreaming: true,
    reasoning: null,
    parameters: null,
    pricing: null,
    isEnabled: true,
    isHidden: false,
    isDeprecated: false,
    notes: null,
    userOverrides: null
  },
  {
    id: 'groq::llama-3.1-70b-versatile',
    providerId: 'groq',
    modelId: 'llama-3.1-70b-versatile',
    presetModelId: null,
    name: 'Llama 3.1 70B Versatile',
    description: 'Groq fast inference with function calling support.',
    group: 'Meta',
    capabilities: [MODEL_CAPABILITY.FUNCTION_CALL],
    inputModalities: null,
    outputModalities: null,
    endpointTypes: null,
    customEndpointUrl: null,
    contextWindow: 128000,
    maxInputTokens: null,
    maxOutputTokens: null,
    supportsStreaming: true,
    reasoning: null,
    parameters: null,
    pricing: null,
    isEnabled: true,
    isHidden: false,
    isDeprecated: false,
    notes: null,
    userOverrides: null
  }
]

const LOCAL_MODEL_SEEDS: ModelSeed[] = [
  {
    id: 'lmstudio::local-model',
    providerId: 'lmstudio',
    modelId: 'local-model',
    presetModelId: null,
    name: 'Local Model (LM Studio)',
    description: 'Replace with the model ID shown in LM Studio → Developer tab',
    group: 'lmstudio',
    capabilities: [MODEL_CAPABILITY.FUNCTION_CALL],
    inputModalities: null,
    outputModalities: null,
    endpointTypes: null,
    customEndpointUrl: null,
    contextWindow: null,
    maxInputTokens: null,
    maxOutputTokens: null,
    supportsStreaming: true,
    reasoning: null,
    parameters: null,
    pricing: null,
    isEnabled: true,
    isHidden: false,
    isDeprecated: false,
    notes: null,
    userOverrides: null
  },
  {
    id: 'ollama::qwen2.5-coder:7b',
    providerId: 'ollama',
    modelId: 'qwen2.5-coder:7b',
    presetModelId: null,
    name: 'Qwen2.5-Coder 7B',
    description: 'Code-specialized model ideal for Blender Python scripting. Install: ollama pull qwen2.5-coder:7b',
    group: 'ollama',
    capabilities: [MODEL_CAPABILITY.FUNCTION_CALL],
    inputModalities: null,
    outputModalities: null,
    endpointTypes: null,
    customEndpointUrl: null,
    contextWindow: null,
    maxInputTokens: null,
    maxOutputTokens: null,
    supportsStreaming: true,
    reasoning: null,
    parameters: null,
    pricing: null,
    isEnabled: true,
    isHidden: false,
    isDeprecated: false,
    notes: null,
    userOverrides: null
  },
  {
    id: 'ollama::llama3.2',
    providerId: 'ollama',
    modelId: 'llama3.2',
    presetModelId: null,
    name: 'Llama 3.2',
    description: 'General-purpose local model. Install: ollama pull llama3.2',
    group: 'ollama',
    capabilities: [MODEL_CAPABILITY.FUNCTION_CALL],
    inputModalities: null,
    outputModalities: null,
    endpointTypes: null,
    customEndpointUrl: null,
    contextWindow: null,
    maxInputTokens: null,
    maxOutputTokens: null,
    supportsStreaming: true,
    reasoning: null,
    parameters: null,
    pricing: null,
    isEnabled: true,
    isHidden: false,
    isDeprecated: false,
    notes: null,
    userOverrides: null
  }
]

const ALL_MODEL_SEEDS = [...LOCAL_MODEL_SEEDS, ...GROQ_FUNCTION_CALL_MODELS, ...COPILOT_FUNCTION_CALL_MODELS]

// Version hash covers seed content — changes here trigger a re-run
const DEFAULT_MODEL_ID = 'groq::llama-3.3-70b-versatile'

const SEED_DATA = {
  v: 4,
  providers: LOCAL_PROVIDERS,
  models: ALL_MODEL_SEEDS.map((m) => ({ id: m.id, caps: m.capabilities })),
  defaultModel: DEFAULT_MODEL_ID
}

export class BlenderLocalProvidersSeeder implements ISeeder {
  readonly name = 'blenderLocalProviders'
  readonly description = 'Enable LM Studio/Ollama/Groq providers and seed models with function-call capability'
  readonly executionPolicy = 'run-on-change' as const
  readonly version: string

  constructor() {
    this.version = hashObject(SEED_DATA)
  }

  async run(db: DbType): Promise<void> {
    await db.transaction(async (tx) => {
      // Enable localhost providers (no API key required)
      for (const providerId of LOCAL_PROVIDERS) {
        await tx
          .update(userProviderTable)
          .set({ isEnabled: true })
          .where(eq(userProviderTable.providerId, providerId))
      }

      const seedIds = ALL_MODEL_SEEDS.map((m) => m.id)
      const existing = await tx
        .select({ id: userModelTable.id })
        .from(userModelTable)
        .where(inArray(userModelTable.id, seedIds))

      const existingIds = new Set(existing.map((r) => r.id))

      for (const model of ALL_MODEL_SEEDS) {
        if (existingIds.has(model.id)) {
          // Patch capabilities on existing rows — fixes models that were synced
          // from the API without function-call set (e.g. Groq sync via OpenAI-compat)
          await tx
            .update(userModelTable)
            .set({ capabilities: model.capabilities })
            .where(eq(userModelTable.id, model.id))
        } else {
          await insertManyWithOrderKey(tx, userModelTable, [model], {
            pkColumn: userModelTable.id,
            scope: eq(userModelTable.providerId, model.providerId)
          })
        }
      }

      // Set the default model preference so topics with no assistantId can still
      // resolve a model. Two steps: INSERT is a safety net for edge-case missing
      // rows; UPDATE fills in the null that PreferenceSeeder writes for fresh
      // installs. Neither step overwrites a model the user has already chosen.
      await tx
        .insert(preferenceTable)
        .values({ scope: 'default', key: 'chat.default_model_id', value: DEFAULT_MODEL_ID })
        .onConflictDoNothing()
      await tx
        .update(preferenceTable)
        .set({ value: DEFAULT_MODEL_ID })
        .where(
          and(
            eq(preferenceTable.scope, 'default'),
            eq(preferenceTable.key, 'chat.default_model_id'),
            isNull(preferenceTable.value)
          )
        )
    })
  }
}
