import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View, type ViewProps } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';

import { useNaneTheme } from '@/theme/tokens';

type MobileScreenProps = ViewProps & {
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  keyboardAware?: boolean;
  footer?: ReactNode;
};

export function MobileScreen({
  children,
  style,
  scroll = true,
  refreshing = false,
  onRefresh,
  keyboardAware = true,
  footer,
  ...props
}: MobileScreenProps) {
  const theme = useNaneTheme();
  const insets = useSafeAreaInsets();
  const content = (
    <View style={[styles.content, { paddingBottom: insets.bottom + 88 }, style]} {...props}>
      {children}
    </View>
  );
  const refreshControl = onRefresh ? (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={theme.colors.primary}
      colors={[theme.colors.primary]}
      progressBackgroundColor={theme.colors.surface}
    />
  ) : undefined;

  const screen = (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      {scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          refreshControl={refreshControl}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
      {footer ? (
        <View
          style={[
            styles.footer,
            {
              paddingBottom: insets.bottom + 10,
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </SafeAreaView>
  );

  if (!keyboardAware) return screen;

  return (
    <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {screen}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
  },
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 18,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
});
