import { StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';

import { useNaneTheme } from '@/theme/tokens';
import { MobileText } from './MobileText';

type MobileFormSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function MobileFormSection({ title, description, children }: MobileFormSectionProps) {
  const theme = useNaneTheme();

  return (
    <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <View style={styles.header}>
        <MobileText variant="section" weight="bold">
          {title}
        </MobileText>
        {description ? (
          <MobileText variant="small" tone="secondary">
            {description}
          </MobileText>
        ) : null}
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 14,
  },
  header: {
    gap: 2,
  },
  content: {
    gap: 12,
  },
});
