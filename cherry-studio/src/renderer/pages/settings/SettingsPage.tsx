import { MenuDivider, MenuItem, MenuList, PageHeader } from '@cherrystudio/ui'
import { McpLogo } from '@renderer/components/Icons'
import Scrollbar from '@renderer/components/Scrollbar'
import useMacTransparentWindow from '@renderer/hooks/useMacTransparentWindow'
import { cn } from '@renderer/utils/style'
import { Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import { Cloud, HardDrive, Package, Settings2 } from 'lucide-react'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'

import {
  settingsSubmenuDividerClassName,
  settingsSubmenuItemClassName,
  settingsSubmenuItemLabelClassName,
  settingsSubmenuListClassName,
  settingsSubmenuSectionTitleClassName
} from '.'


const SettingsPage: FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { pathname } = location
  const { t } = useTranslation()
  const isMacTransparentWindow = useMacTransparentWindow()

  const isActive = (path: string) => pathname === path || pathname.startsWith(`${path}/`)
  const go = (path: string) => navigate({ to: path })

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col',
        isMacTransparentWindow ? 'bg-transparent' : 'bg-white dark:bg-background'
      )}>
      <div className="flex min-h-0 flex-1 flex-row">
        <div
          className={cn(
            'flex min-h-0 w-(--settings-width) min-w-(--settings-width) flex-col',
            isMacTransparentWindow ? 'bg-transparent' : 'bg-white dark:bg-background'
          )}>
          <PageHeader title={t('settings.menuGroups.appSettings')} />
          <Scrollbar className="min-h-0 flex-1 select-none">
            <MenuList className={settingsSubmenuListClassName}>
              <MenuItem
                className={settingsSubmenuItemClassName}
                labelClassName={settingsSubmenuItemLabelClassName}
                icon={<Cloud />}
                label={t('settings.provider.title')}
                active={isActive('/settings/provider')}
                onClick={() => go('/settings/provider')}
              />
              <MenuItem
                className={settingsSubmenuItemClassName}
                labelClassName={settingsSubmenuItemLabelClassName}
                icon={<Package />}
                label={t('settings.model')}
                active={isActive('/settings/model')}
                onClick={() => go('/settings/model')}
              />
              <MenuDivider className={settingsSubmenuDividerClassName} />
              <div className={settingsSubmenuSectionTitleClassName}>{t('settings.menuGroups.services')}</div>
              <MenuItem
                className={settingsSubmenuItemClassName}
                labelClassName={settingsSubmenuItemLabelClassName}
                icon={<McpLogo width={16} height={16} className="text-foreground" />}
                label={t('agent.settings.toolsMcp.mcp.tab')}
                active={isActive('/settings/mcp')}
                onClick={() => go('/settings/mcp')}
              />
              <MenuDivider className={settingsSubmenuDividerClassName} />
              <div className={settingsSubmenuSectionTitleClassName}>{t('settings.menuGroups.appSettings')}</div>
              <MenuItem
                className={settingsSubmenuItemClassName}
                labelClassName={settingsSubmenuItemLabelClassName}
                icon={<Settings2 />}
                label={t('settings.general.common.title')}
                active={isActive('/settings/general')}
                onClick={() => go('/settings/general')}
              />
              <MenuItem
                className={settingsSubmenuItemClassName}
                labelClassName={settingsSubmenuItemLabelClassName}
                icon={<HardDrive />}
                label={t('settings.data.title')}
                active={isActive('/settings/data')}
                onClick={() => go('/settings/data')}
              />
            </MenuList>
          </Scrollbar>
        </div>
        <div className="flex h-full min-h-0 min-w-0 flex-1">
          <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden border-border/40 border-l bg-white text-foreground dark:bg-background">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
