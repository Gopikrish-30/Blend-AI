import { loggerService } from '@logger'
import { useToolApprovalRespond } from '@renderer/hooks/ToolApprovalContext'
import { usePartsMap } from '@renderer/pages/home/Messages/Blocks'
import type { NormalToolResponse } from '@renderer/types'
import { cn } from '@renderer/utils'
import { Button, Tag } from 'antd'
import { CheckCircle2, HelpCircle, Send } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import { SkeletonValue } from './MessageAgentTools/GenericTools'
import { APPROVAL_REQUESTED, findToolPartByCallId } from './toolResponse'

const logger = loggerService.withContext('BlenderQuestionCard')

interface ParsedQuestion {
  question: string
  context?: string
  options?: string[]
}

function parseQuestion(source: unknown): ParsedQuestion | null {
  if (!source || typeof source !== 'object') return null
  const obj = source as Record<string, unknown>
  if (typeof obj.question !== 'string') return null

  let options: string[] | undefined
  if (Array.isArray(obj.options)) {
    options = obj.options.map(String)
  } else if (typeof obj.options === 'string') {
    try {
      const parsed = JSON.parse(obj.options as string)
      options = Array.isArray(parsed) ? parsed.map(String) : undefined
    } catch {
      options = undefined
    }
  }

  return {
    question: obj.question as string,
    context: typeof obj.context === 'string' ? obj.context : undefined,
    options
  }
}

export function BlenderQuestionCard({ toolResponse }: { toolResponse: NormalToolResponse }) {
  const partsMap = usePartsMap()
  const respondToolApproval = useToolApprovalRespond()

  const match = useMemo(
    () => findToolPartByCallId(partsMap, toolResponse.toolCallId),
    [partsMap, toolResponse.toolCallId]
  )
  const isPending = match?.state === APPROVAL_REQUESTED
  const pendingInput = match?.input

  const parsed = useMemo(() => {
    const source = isPending ? pendingInput : toolResponse.arguments
    return parseQuestion(source)
  }, [isPending, pendingInput, toolResponse.arguments])

  const [answer, setAnswer] = useState('')
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittedAnswer, setSubmittedAnswer] = useState<string | null>(null)

  const baseInput = useMemo(() => (pendingInput as Record<string, unknown>) ?? {}, [pendingInput])

  const effectiveAnswer = selectedOption ?? answer

  const handleSubmit = useCallback(async () => {
    if (!match?.approvalId || !respondToolApproval || !effectiveAnswer.trim()) return
    setIsSubmitting(true)
    try {
      await respondToolApproval({
        match,
        approved: true,
        updatedInput: { ...baseInput, user_answer: effectiveAnswer.trim() }
      })
      setSubmittedAnswer(effectiveAnswer.trim())
    } catch (err) {
      logger.error('BlenderQuestionCard submit failed', err as Error)
    } finally {
      setIsSubmitting(false)
    }
  }, [match, baseInput, effectiveAnswer, respondToolApproval])

  const handleOptionClick = useCallback(
    (opt: string) => {
      if (!isPending) return
      setSelectedOption((prev) => (prev === opt ? null : opt))
      setAnswer('')
    },
    [isPending]
  )

  if (isPending && !parsed) {
    return (
      <div className="rounded-xl border border-default-200 bg-default-100 px-4 py-3 text-default-500 text-sm">
        <SkeletonValue value={null} width="180px" />
      </div>
    )
  }

  // ── Completed state ──────────────────────────────────────────────────────
  if (!isPending) {
    const displayed = submittedAnswer ?? (
      typeof (toolResponse.arguments as Record<string, unknown>)?.user_answer === 'string'
        ? (toolResponse.arguments as Record<string, unknown>).user_answer as string
        : null
    )
    return (
      <div className="w-full max-w-xl rounded-xl border border-default-200 bg-default-100 px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={18} className="text-(--color-primary)" />
          <span className="font-semibold text-default-700 text-sm">Question Answered</span>
        </div>
        {parsed?.question && (
          <p className="mt-1 text-default-600 text-sm">{parsed.question}</p>
        )}
        {displayed && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
            <CheckCircle2 size={14} className="shrink-0 text-(--color-primary)" />
            <span className="text-(--color-primary) text-sm">{displayed}</span>
          </div>
        )}
      </div>
    )
  }

  // ── Pending state ─────────────────────────────────────────────────────────
  const hasOptions = parsed?.options && parsed.options.length > 0

  return (
    <div className="w-full max-w-xl rounded-xl border border-default-200 bg-default-100 px-4 py-3 shadow-sm">
      <div className="flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <HelpCircle size={18} className="text-(--color-primary)" />
          <span className="font-semibold text-default-700">Clarifying Question</span>
          <Tag color="processing" className="m-0 ml-auto">Needs Answer</Tag>
        </div>

        {/* Question */}
        <div className="font-medium text-default-700 text-sm">
          <SkeletonValue value={parsed?.question ?? null} width="100%" />
        </div>

        {/* Context */}
        {parsed?.context && (
          <p className="text-default-500 text-xs">{parsed.context}</p>
        )}

        {/* Option chips */}
        {hasOptions && (
          <div className="flex flex-wrap gap-2">
            {parsed!.options!.map((opt) => (
              <button
                key={opt}
                onClick={() => handleOptionClick(opt)}
                disabled={isSubmitting}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm transition-colors',
                  selectedOption === opt
                    ? 'border-(--color-primary) bg-primary/15 text-primary font-medium'
                    : 'border-default-300 bg-default-50 text-default-600 hover:border-primary/50 hover:bg-primary/10'
                )}>
                {opt}
              </button>
            ))}
          </div>
        )}

        {/* Free-text input (always shown, or shown only for "other" when options exist) */}
        {(!hasOptions || !selectedOption) && (
          <textarea
            className="w-full rounded-lg border border-default-300 bg-default-50 px-3 py-2 text-sm text-default-700 resize-none focus:outline-none focus:border-primary/50"
            rows={3}
            placeholder="Type your answer…"
            value={answer}
            disabled={isSubmitting}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && effectiveAnswer.trim()) {
                e.preventDefault()
                void handleSubmit()
              }
            }}
          />
        )}

        {/* Submit */}
        <div className="flex justify-end border-default-200 border-t pt-3">
          <Button
            type="primary"
            icon={<Send size={14} />}
            loading={isSubmitting}
            disabled={!effectiveAnswer.trim() || isSubmitting}
            onClick={handleSubmit}>
            Submit
          </Button>
        </div>
      </div>
    </div>
  )
}

export default BlenderQuestionCard
