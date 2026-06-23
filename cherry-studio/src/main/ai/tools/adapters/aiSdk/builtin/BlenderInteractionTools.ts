import { BLENDER_ASSISTANT_NAME } from '@shared/data/presets/blenderAssistant'
import { jsonSchema, type JSONSchema7, type Tool } from 'ai'

import type { ToolEntry } from '../types'

// ── present_plan ──────────────────────────────────────────────────────────────
//
// Called by the Blender agent before executing any complex multi-step task.
// The tool suspends via needsApproval so the UI can show a rich plan card with
// Accept / Edit / Reject buttons. The user's decision arrives as updatedInput:
//   • accepted:  execute() receives { user_action: 'accepted' }
//   • edited:    execute() receives { user_action: 'edited', user_feedback: '...' }
//   • rejected:  approved=false → execute() is skipped; model sees tool error

const PRESENT_PLAN_SCHEMA: JSONSchema7 = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Short task name, e.g. "Living Room Setup"' },
    summary: { type: 'string', description: 'One sentence describing what will be done' },
    phases: {
      anyOf: [
        {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Phase name' },
              steps: {
                anyOf: [
                  { type: 'array', items: { type: 'string' } },
                  { type: 'string' }
                ],
                description: 'Steps to execute in this phase'
              },
              estimated_calls: {
                anyOf: [{ type: 'integer' }, { type: 'string' }],
                description: 'Estimated tool call count for this phase'
              }
            },
            required: ['name', 'steps']
          }
        },
        { type: 'string', description: 'JSON-encoded phases array' }
      ],
      description: 'Ordered execution phases'
    },
    estimated_total_calls: {
      anyOf: [{ type: 'integer' }, { type: 'string' }],
      description: 'Total estimated tool calls'
    },
    notes: { type: 'string', description: 'Foreseeable issues or caveats' }
  },
  required: ['title', 'summary', 'phases']
}

const presentPlanTool: Tool = {
  type: 'function',
  description:
    'Present a structured task plan to the user. Shows an interactive card with Accept / Edit / Reject buttons. ALWAYS call this before executing any task with 3+ steps or multiple phases. Do NOT write the plan as plain chat text.',
  inputSchema: jsonSchema(PRESENT_PLAN_SCHEMA),
  needsApproval: async () => true,
  execute: async (rawArgs: Record<string, unknown>) => {
    const action = (rawArgs.user_action as string) ?? 'accepted'
    const feedback = (rawArgs.user_feedback as string) ?? ''
    if (action === 'edited') {
      return `Plan modified. User feedback: "${feedback}". Incorporate this feedback into your execution plan and proceed.`
    }
    return 'User accepted the plan. Proceed with execution as planned.'
  }
}

export function createBlenderPlanToolEntry(): ToolEntry {
  return {
    name: 'present_plan',
    namespace: 'blender:interaction',
    description: 'Show an interactive plan card to the user before executing a complex task',
    defer: 'never',
    applies: (scope) => scope.assistant?.name === BLENDER_ASSISTANT_NAME,
    tool: presentPlanTool
  }
}

// ── ask_clarifying_question ───────────────────────────────────────────────────
//
// Called by the Blender agent when it needs clarification before proceeding.
// Shows a question card in the chat UI. The user's text answer arrives as
// updatedInput.user_answer, which execute() returns to the model.

const ASK_QUESTION_SCHEMA: JSONSchema7 = {
  type: 'object',
  properties: {
    question: { type: 'string', description: 'The specific question to ask the user' },
    context: { type: 'string', description: 'Why you need this information (optional)' },
    options: {
      anyOf: [
        { type: 'array', items: { type: 'string' } },
        { type: 'string' }
      ],
      description: 'Optional suggested answer options'
    }
  },
  required: ['question']
}

const askQuestionTool: Tool = {
  type: 'function',
  description:
    'Ask the user a clarifying question and wait for their answer. Shows an interactive question card. NEVER ask questions as plain chat text — always use this tool.',
  inputSchema: jsonSchema(ASK_QUESTION_SCHEMA),
  needsApproval: async () => true,
  execute: async (rawArgs: Record<string, unknown>) => {
    const answer = (rawArgs.user_answer as string) ?? ''
    return `User answered: "${answer}"`
  }
}

export function createBlenderQuestionToolEntry(): ToolEntry {
  return {
    name: 'ask_clarifying_question',
    namespace: 'blender:interaction',
    description: 'Ask the user a clarifying question and wait for their typed answer',
    defer: 'never',
    applies: (scope) => scope.assistant?.name === BLENDER_ASSISTANT_NAME,
    tool: askQuestionTool
  }
}
