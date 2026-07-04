import { UploadCloud } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { useNaneTheme } from '@/theme/tokens';
import { MobileText } from './MobileText';

type MobileFileUploadProps = {
  title: string;
  description?: string;
  onPress?: () => void;
};

export function MobileFileUpload({ title, description, onPress }: MobileFileUploadProps) {
  const theme = useNaneTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.dropzone,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: theme.colors.borderStrong,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: theme.colors.primary }]}>
        <UploadCloud color={theme.colors.onPrimary} size={22} strokeWidth={2.4} />
      </View>
      <MobileText variant="body" weight="bold" style={styles.center}>
        {title}
      </MobileText>
      {description ? (
        <MobileText variant="small" tone="secondary" style={styles.center}>
          {description}
        </MobileText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dropzone: {
    minHeight: 148,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    gap: 8,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    textAlign: 'center',
  },
});
