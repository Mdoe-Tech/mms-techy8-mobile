import { ScrollView, StyleSheet, View, type ViewProps } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useNaneTheme } from '@/theme/tokens';

type MobileScreenProps = ViewProps & {
  scroll?: boolean;
};

export function MobileScreen({ children, style, scroll = true, ...props }: MobileScreenProps) {
  const theme = useNaneTheme();
  const insets = useSafeAreaInsets();
  const content = (
    <View style={[styles.content, { paddingBottom: insets.bottom + 88 }, style]} {...props}>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      {scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
});

