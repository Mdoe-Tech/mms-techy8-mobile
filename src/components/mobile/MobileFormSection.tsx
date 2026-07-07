import { StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';

import { useNaneTheme } from '@/theme/tokens';
import { MobileText } from './MobileText';

type MobileFormSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  rightAction?: ReactNode;
  footer?: ReactNode;
  compact?: boolean;
};

export function MobileFormSection({ title, description, children, rightAction, footer, compact }: MobileFormSectionProps) {
  const theme = useNaneTheme();

  return (
    <View
      style={[
        styles.section,
        compact ? styles.compactSection : null,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, shadowColor: theme.colors.shadow },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <MobileText variant="section" weight="bold">
            {title}
          </MobileText>
          {description ? (
            <MobileText variant="small" tone="secondary">
              {description}
            </MobileText>
          ) : null}
        </View>
        {rightAction ? <View style={styles.rightAction}>{rightAction}</View> : null}
      </View>
      <View style={styles.content}>{children}</View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 14,
    shadowOpacity: 0.02,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 0,
  },
  compactSection: {
    padding: 14,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rightAction: {
    maxWidth: '44%',
    minWidth: 0,
    flexShrink: 1,
    alignItems: 'flex-end',
  },
  content: {
    gap: 12,
  },
  footer: {
    paddingTop: 2,
  },
});
