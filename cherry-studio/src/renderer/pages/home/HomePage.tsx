import { cacheService } from '@data/CacheService'
import { usePreference } from '@data/hooks/usePreference'
import { ErrorBoundary } from '@renderer/components/ErrorBoundary'
import { useCommandHandler } from '@renderer/hooks/command'
import { useNavbarPosition } from '@renderer/hooks/useNavbar'
import { useAssistantsApi } from '@renderer/hooks/useAssistant'
import { useTemporaryTopic } from '@renderer/hooks/useTemporaryTopic'
import { useActiveTopic, useTopicMutations } from '@renderer/hooks/useTopic'
import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService'
import NavigationService from '@renderer/services/NavigationService'
import type { Topic } from '@renderer/types'
import { BLENDER_ASSISTANT_NAME } from '@shared/data/presets/blenderAssistant'
import { MIN_WINDOW_HEIGHT, MIN_WINDOW_WIDTH, SECOND_MIN_WINDOW_WIDTH } from '@shared/utils/window'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import type { FC } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import styled from 'styled-components'

import Chat from './Chat'
import Navbar from './Navbar'
import HomeTabs from './Tabs'

function buildPendingTemporaryTopic(id: string, assistantId?: string): Topic {
  const nowIso = new Date().toISOString()
  return {
    id,
    assistantId,
    name: '',
    createdAt: nowIso,
    updatedAt: nowIso,
    messages: [],
    pinned: false,
    isNameManuallyEdited: false
  }
}

const HomePage: FC = () => {
  const navigate = useNavigate()
  const { isLeftNavbar } = useNavbarPosition()

  const location = useLocation()
  const state = location.state as { topic?: Topic } | undefined

  const [shouldUseTemporary] = useState(() => {
    if (state?.topic) return false
    // Use a temp topic only when there is no cached active topic to restore.
    // This covers first launch AND re-mounts where the user navigated away
    // before their first send (useTemporaryTopic cleanup cleared topic.active).
    return !(cacheService.get('topic.active') as { id: string } | null)?.id
  })

  const { assistants } = useAssistantsApi()
  const blenderAssistantId = assistants.find((a) => a.name === BLENDER_ASSISTANT_NAME)?.id

  // Only lease the temp topic once Blend AI's UUID is known so it's always
  // bound to the right assistant from the first message.
  const { topicId: tempTopicId, persist: persistTemporaryTopic } = useTemporaryTopic({
    enabled: shouldUseTemporary && blenderAssistantId !== undefined,
    assistantId: blenderAssistantId
  })

  const { refreshTopics } = useTopicMutations()

  const initialTopic = useMemo<Topic | undefined>(() => {
    if (state?.topic) return state.topic
    if (shouldUseTemporary && tempTopicId) {
      return buildPendingTemporaryTopic(tempTopicId, blenderAssistantId)
    }
    return undefined
  }, [state?.topic, shouldUseTemporary, tempTopicId, blenderAssistantId])

  const { activeTopic, setActiveTopic } = useActiveTopic(initialTopic, {
    // While we're waiting for the temporary topic to lease, suppress the
    // auto-pick-first-topic effect so the UI doesn't flash a stale topic
    // before our blank one shows up.
    autoPickFirst: !shouldUseTemporary
  })

  const persistTemporaryTopicAndRefresh = useCallback(
    async (initialName?: string) => {
      await persistTemporaryTopic(initialName)
      await refreshTopics()
    },
    [persistTemporaryTopic, refreshTopics]
  )
  const [showSidebar, setShowSidebar] = usePreference('topic.tab.show')
  const [topicPosition] = usePreference('topic.position')

  useCommandHandler('app.sidebar.toggle', () => {
    if (topicPosition === 'right') {
      void setShowSidebar(!showSidebar)
      return
    }

    if (!showSidebar) {
      void setShowSidebar(true)
      requestAnimationFrame(() => {
        void EventEmitter.emit(EVENT_NAMES.SHOW_ASSISTANTS)
      })
      return
    }

    void EventEmitter.emit(EVENT_NAMES.SHOW_ASSISTANTS)
  })

  useCommandHandler('topic.sidebar.toggle', () => {
    if (topicPosition === 'right') {
      void setShowSidebar(!showSidebar)
      return
    }

    if (!showSidebar) {
      void setShowSidebar(true)
      requestAnimationFrame(() => {
        void EventEmitter.emit(EVENT_NAMES.SHOW_TOPIC_SIDEBAR)
      })
      return
    }

    void EventEmitter.emit(EVENT_NAMES.SHOW_TOPIC_SIDEBAR)
  })

  useEffect(() => {
    NavigationService.setNavigate(navigate)
  }, [navigate])

  useEffect(() => {
    state?.topic && setActiveTopic(state?.topic)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  useEffect(() => {
    void window.api.window.setMinimumSize(showSidebar ? MIN_WINDOW_WIDTH : SECOND_MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT)

    return () => {
      void window.api.window.resetMinimumSize()
    }
  }, [showSidebar])

  if (!activeTopic) {
    return <Container id="home-page" />
  }

  return (
    <Container id="home-page">
      {isLeftNavbar && <Navbar position="left" />}
      <ContentContainer id={isLeftNavbar ? 'content-container' : undefined}>
        <AnimatePresence initial={false}>
          {showSidebar && (
            <ErrorBoundary>
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 'var(--assistants-width)', opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                style={{ overflow: 'hidden' }}>
                <HomeTabs activeTopic={activeTopic} setActiveTopic={setActiveTopic} position="left" />
              </motion.div>
            </ErrorBoundary>
          )}
        </AnimatePresence>
        <ErrorBoundary>
          <Chat
            activeTopic={activeTopic}
            setActiveTopic={setActiveTopic}
            // Wire the persist callback only while the temp lease is the
            // currently-active topic. If the user clicks a sidebar topic
            // before sending, the active id no longer matches the lease and
            // the next send won't accidentally persist an empty lease.
            onPersistTemporaryTopic={
              tempTopicId && activeTopic.id === tempTopicId ? persistTemporaryTopicAndRefresh : undefined
            }
          />
        </ErrorBoundary>
      </ContentContainer>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  [navbar-position='left'] & {
    max-width: calc(100vw - var(--sidebar-width));
  }
  [navbar-position='top'] & {
    max-width: 100vw;
  }
`

const ContentContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: row;
  min-height: 0;
  overflow: hidden;

  [navbar-position='top'] & {
    max-width: calc(100vw - 12px);
  }
`

export default HomePage
