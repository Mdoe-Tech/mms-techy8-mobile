import { ArrowLeft, Bell } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';

import { useWorkspaceIdentity } from '@/auth/workspace-identity';
import { MobileIconButton } from './MobileIconButton';
import { MobileText } from './MobileText';
import { MobileWorkspaceLogo } from './MobileWorkspaceLogo';

type MobilePageHeaderProps = {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  showLogo?: boolean;
  onBack?: () => void;
  rightAction?: ReactNode;
};

export function MobilePageHeader({
  title,
  eyebrow,
  subtitle,
  showLogo = true,
  onBack,
  rightAction,
}: MobilePageHeaderProps) {
  const workspaceIdentity = useWorkspaceIdentity();
  const useWorkspaceLogo = showLogo && workspaceIdentity.isAssociationWorkspace;

  return (
    <View style={styles.header}>
      <View style={styles.left}>
        {onBack ? <MobileIconButton icon={ArrowLeft} label="Back" variant="ghost" onPress={onBack} /> : null}
        {showLogo ? (
          <MobileWorkspaceLogo
            appLogo={!useWorkspaceLogo}
            name={workspaceIdentity.workspaceName || title}
            source={useWorkspaceLogo ? workspaceIdentity.workspaceLogoSource : null}
            size="md"
          />
        ) : null}
        <View style={styles.titleBlock}>
          {eyebrow ? (
            <MobileText variant="tiny" tone="secondary" weight="bold" style={styles.eyebrow}>
              {eyebrow}
            </MobileText>
          ) : null}
          <MobileText variant="section" weight="bold" numberOfLines={2} style={styles.title}>
            {title}
          </MobileText>
          {subtitle ? (
            <MobileText variant="small" tone="secondary" numberOfLines={2}>
              {subtitle}
            </MobileText>
          ) : null}
        </View>
      </View>
      <View style={styles.right}>
        {rightAction || <MobileIconButton icon={Bell} label="Notifications" />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  left: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  right: {
    maxWidth: '46%',
    minWidth: 0,
    flexShrink: 1,
    alignItems: 'flex-end',
  },
  title: {
    lineHeight: 24,
  },
  eyebrow: {
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
