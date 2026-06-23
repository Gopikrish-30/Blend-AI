import { Button } from '@cherrystudio/ui'
import ModelAvatar from '@renderer/components/Avatar/ModelAvatar'
import EmojiIcon from '@renderer/components/EmojiIcon'
import HorizontalScrollContainer from '@renderer/components/HorizontalScrollContainer'
import { ModelSelector } from '@renderer/components/ModelSelector'
import { useAssistant } from '@renderer/hooks/useAssistant'
import { useProviderDisplayName } from '@renderer/hooks/useProvider'
import { getLeadingEmoji } from '@renderer/utils'
import type { Model as SharedModel } from '@shared/data/types/model'
import { isNonChatModel, isWebSearchModel } from '@shared/utils/model'
import { ChevronDown } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import Tools from '../Tools'

type TopicContentProps = {
  /** `undefined` when the topic has no associated assistant. */
  assistantId: string | undefined
  topicId: string
}

const modelFilter = (m: SharedModel) => !isNonChatModel(m)

const TopicContent = ({ assistantId, topicId: _topicId }: TopicContentProps) => {
  const { t } = useTranslation()
  const { assistant, model: currentSharedModel, setModel } = useAssistant(assistantId)
  const assistantName = useMemo(() => assistant?.name || t('chat.default.name'), [assistant?.name, t])
  const providerName = useProviderDisplayName(currentSharedModel?.providerId)

  const handleModelSelect = useCallback(
    (model: SharedModel | undefined) => {
      if (!model || !assistant) return
      const enabledWebSearch = isWebSearchModel(model)
      setModel(model, { enableWebSearch: enabledWebSearch && assistant.settings.enableWebSearch })
    },
    [assistant, setModel]
  )

  return (
    <>
      <HorizontalScrollContainer className="ml-2 flex-initial">
        <div className="flex flex-nowrap items-center gap-2">
          <div className="flex h-7 items-center gap-1.5 rounded-full px-2 text-xs">
            <EmojiIcon emoji={assistant?.emoji || getLeadingEmoji(assistantName)} size={20} />
            <span className="max-w-40 truncate font-medium">{assistantName}</span>
          </div>

          <ModelSelector
            multiple={false}
            value={currentSharedModel}
            onSelect={handleModelSelect}
            filter={modelFilter}
            shortcut="chat.model.select"
            trigger={
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 rounded-full px-2 text-xs">
                <ModelAvatar model={currentSharedModel} size={20} />
                <span className="max-w-60 truncate">
                  {currentSharedModel ? currentSharedModel.name : t('button.select_model')}
                  {providerName ? ` | ${providerName}` : ''}
                </span>
                <ChevronDown size={14} className="text-muted-foreground" />
              </Button>
            }
          />
        </div>
      </HorizontalScrollContainer>
      <Tools assistantId={assistantId} />
    </>
  )
}

export default TopicContent
