import { loggerService } from '@logger'
import { useToolApprovalRespond } from '@renderer/hooks/ToolApprovalContext'
import { usePartsMap } from '@renderer/pages/home/Messages/Blocks'
import type { NormalToolResponse } from '@renderer/types'
import { cn } from '@renderer/utils'
import { Button, Tag } from 'antd'
import { CheckCircle2, ChevronDown, ChevronUp, ClipboardList, Pencil, X } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import { SkeletonValue } from './MessageAgentTools/GenericTools'
import { APPROVAL_REQUESTED, findToolPartByCallId } from './toolResponse'

const logger = loggerService.withContext('BlenderPlanCard')

// ── Parsing ──────────────────────────────────────────────────────────────────

interface Phase {
  name: string
  steps: string[]
  estimated_calls?: number
}

interface ParsedPlan {
  title: string
  summary: string
  phases: Phase[]
  estimated_total_calls?: number
  notes?: string
}

function parsePhases(raw: unknown): Phase[] {
  let arr = raw
  if (typeof arr === 'string') {
    try {
      arr = JSON.parse(arr)
    } catch {
      return []
    }
  }
  if (!Array.isArray(arr)) return []
  return arr.map((p) => {
    if (!p || typeof p !== 'object') return { name: 'Phase', steps: [] }
    const obj = p as Record<string, unknown>
    let steps: string[] = []
    if (Array.isArray(obj.steps)) {
      steps = obj.steps.map(String)
    } else if (typeof obj.steps === 'string') {
      try {
        const parsed = JSON.parse(obj.steps as string)
        steps = Array.isArray(parsed) ? parsed.map(String) : [obj.steps as string]
      } catch {
        steps = (obj.steps as string).split('\n').filter(Boolean)
      }
    }
    const ec = obj.estimated_calls
    return {
      name: typeof obj.name === 'string' ? obj.name : 'Phase',
      steps,
      estimated_calls: typeof ec === 'number' ? ec : typeof ec === 'string' ? parseInt(ec) || undefined : undefined
    }
  })
}

function parsePlan(source: unknown): ParsedPlan | null {
  if (!source || typeof source !== 'object') return null
  const obj = source as Record<string, unknown>
  return {
    title: typeof obj.title === 'string' ? obj.title : 'Task Plan',
    summary: typeof obj.summary === 'string' ? obj.summary : '',
    phases: parsePhases(obj.phases),
    estimated_total_calls:
      typeof obj.estimated_total_calls === 'number'
        ? obj.estimated_total_calls
        : typeof obj.estimated_total_calls === 'string'
          ? parseInt(obj.estimated_total_calls) || undefined
          : undefined,
    notes: typeof obj.notes === 'string' ? obj.notes : undefined
  }
}

// ── Sub-components ──────────────────────────────────────────────────────────

function PhaseRow({ phase, index }: { phase: Phase; index: number }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="rounded-lg border border-default-200 bg-default-50 overflow-hidden">
      <button
        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-default-100 transition-colors"
        onClick={() => setOpen((v) => !v)}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">
            {index + 1}
          </span>
          <span className="font-medium text-default-700 text-sm truncate">{phase.name}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {phase.estimated_calls !== undefined && (
            <span className="text-default-400 text-xs">~{phase.estimated_calls} calls</span>
          )}
          {open ? <ChevronUp size={14} className="text-default-400" /> : <ChevronDown size={14} className="text-default-400" />}
        </div>
      </button>
      {open && phase.steps.length > 0 && (
        <ul className="px-3 pb-2 space-y-1">
          {phase.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-default-600 text-xs">
              <span className="mt-1 shrink-0 h-1.5 w-1.5 rounded-full bg-default-400" />
              <span>{step}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export function BlenderPlanCard({ toolResponse }: { toolResponse: NormalToolResponse }) {
  const partsMap = usePartsMap()
  const respondToolApproval = useToolApprovalRespond()

  const match = useMemo(
    () => findToolPartByCallId(partsMap, toolResponse.toolCallId),
    [partsMap, toolResponse.toolCallId]
  )
  const isPending = match?.state === APPROVAL_REQUESTED
  const pendingInput = match?.input

  const plan = useMemo(() => {
    const source = isPending ? pendingInput : toolResponse.arguments
    return parsePlan(source)
  }, [isPending, pendingInput, toolResponse.arguments])

  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [editFeedback, setEditFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  // result stored for completed state rendering
  const [completedAction, setCompletedAction] = useState<'accepted' | 'edited' | 'rejected' | null>(null)
  const [completedFeedback, setCompletedFeedback] = useState('')

  const baseInput = useMemo(() => (pendingInput as Record<string, unknown>) ?? {}, [pendingInput])

  const handleAccept = useCallback(async () => {
    if (!match?.approvalId || !respondToolApproval) return
    setIsSubmitting(true)
    try {
      await respondToolApproval({ match, approved: true, updatedInput: { ...baseInput, user_action: 'accepted' } })
      setCompletedAction('accepted')
    } catch (err) {
      logger.error('BlenderPlanCard accept failed', err as Error)
    } finally {
      setIsSubmitting(false)
    }
  }, [match, baseInput, respondToolApproval])

  const handleSubmitEdit = useCallback(async () => {
    if (!match?.approvalId || !respondToolApproval) return
    setIsSubmitting(true)
    try {
      await respondToolApproval({
        match,
        approved: true,
        updatedInput: { ...baseInput, user_action: 'edited', user_feedback: editFeedback }
      })
      setCompletedAction('edited')
      setCompletedFeedback(editFeedback)
    } catch (err) {
      logger.error('BlenderPlanCard edit failed', err as Error)
    } finally {
      setIsSubmitting(false)
    }
  }, [match, baseInput, editFeedback, respondToolApproval])

  const handleReject = useCallback(async () => {
    if (!match?.approvalId || !respondToolApproval) return
    setIsSubmitting(true)
    try {
      await respondToolApproval({ match, approved: false, reason: 'User rejected the plan' })
      setCompletedAction('rejected')
    } catch (err) {
      logger.error('BlenderPlanCard reject failed', err as Error)
    } finally {
      setIsSubmitting(false)
    }
  }, [match, respondToolApproval])

  // Loading state while args stream in
  if (isPending && !plan) {
    return (
      <div className="rounded-xl border border-default-200 bg-default-100 px-4 py-3 text-default-500 text-sm">
        <SkeletonValue value={null} width="200px" />
      </div>
    )
  }

  // ── Completed state ──────────────────────────────────────────────────────
  if (!isPending) {
    const action = completedAction
    return (
      <div className="w-full max-w-xl rounded-xl border border-default-200 bg-default-100 px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <ClipboardList size={18} className={cn(
            action === 'accepted' ? 'text-(--color-primary)' :
            action === 'edited' ? 'text-warning' :
            action === 'rejected' ? 'text-danger' :
            'text-default-500'
          )} />
          <span className="font-semibold text-default-700 text-sm">
            {plan?.title ?? 'Task Plan'}
          </span>
          {action === 'accepted' && <Tag color="success" className="m-0">Accepted</Tag>}
          {action === 'edited' && <Tag color="warning" className="m-0">Modified</Tag>}
          {action === 'rejected' && <Tag color="error" className="m-0">Rejected</Tag>}
          {!action && <Tag color="default" className="m-0">Done</Tag>}
        </div>
        {plan?.summary && (
          <p className="mt-1 text-default-500 text-xs">{plan.summary}</p>
        )}
        {action === 'edited' && completedFeedback && (
          <div className="mt-2 rounded-lg bg-warning/10 border border-warning/30 px-3 py-2">
            <span className="text-warning text-xs">Feedback: {completedFeedback}</span>
          </div>
        )}
      </div>
    )
  }

  // ── Edit mode ────────────────────────────────────────────────────────────
  if (mode === 'edit') {
    return (
      <div className="w-full max-w-xl rounded-xl border border-default-200 bg-default-100 px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Pencil size={18} className="text-default-500" />
            <span className="font-semibold text-default-700 text-sm">Describe your changes</span>
          </div>
          <textarea
            className="w-full rounded-lg border border-default-300 bg-default-50 px-3 py-2 text-sm text-default-700 resize-none focus:outline-none focus:border-primary/50"
            rows={4}
            placeholder="Tell the agent what you want to change about the plan…"
            value={editFeedback}
            onChange={(e) => setEditFeedback(e.target.value)}
            autoFocus
          />
          <div className="flex items-center justify-between border-default-200 border-t pt-3">
            <Button onClick={() => setMode('view')} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="primary"
              loading={isSubmitting}
              disabled={!editFeedback.trim() || isSubmitting}
              onClick={handleSubmitEdit}>
              Submit Changes
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main pending view ─────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-xl rounded-xl border border-default-200 bg-default-100 px-4 py-3 shadow-sm">
      <div className="flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList size={18} className="text-(--color-primary)" />
            <span className="font-semibold text-default-700">
              <SkeletonValue value={plan?.title ?? null} width="140px" />
            </span>
          </div>
          <Tag color="processing" className="m-0">Awaiting Approval</Tag>
        </div>

        {/* Summary */}
        {plan?.summary && (
          <p className="text-default-600 text-sm">{plan.summary}</p>
        )}

        {/* Phases */}
        {plan && plan.phases.length > 0 && (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {plan.phases.map((phase, i) => (
              <PhaseRow key={i} phase={phase} index={i} />
            ))}
          </div>
        )}

        {/* Total + Notes */}
        <div className="flex flex-wrap gap-3 text-xs text-default-500">
          {plan?.estimated_total_calls !== undefined && (
            <span>~{plan.estimated_total_calls} total tool calls</span>
          )}
          {plan?.notes && <span className="text-warning">⚠ {plan.notes}</span>}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-default-200 border-t pt-3">
          <Button
            danger
            icon={<X size={14} />}
            disabled={isSubmitting}
            onClick={handleReject}
            className="flex items-center gap-1">
            Reject
          </Button>
          <div className="flex items-center gap-2">
            <Button
              icon={<Pencil size={14} />}
              disabled={isSubmitting}
              onClick={() => setMode('edit')}
              className="flex items-center gap-1">
              Edit
            </Button>
            <Button
              type="primary"
              icon={<CheckCircle2 size={14} />}
              loading={isSubmitting}
              disabled={isSubmitting}
              onClick={handleAccept}
              className="flex items-center gap-1">
              Accept
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BlenderPlanCard
