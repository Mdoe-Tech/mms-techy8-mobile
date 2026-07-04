import { Download, Eye, FileText } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useNaneTheme } from '@/theme/tokens';
import { MobileIconButton } from './MobileIconButton';
import { MobileStatusBadge } from './MobileStatusBadge';
import { MobileText } from './MobileText';

type MobileDocumentCardProps = {
  title: string;
  meta?: string;
  status?: string;
  onView?: () => void;
  onDownload?: () => void;
};

export function MobileDocumentCard({ title, meta, status, onView, onDownload }: MobileDocumentCardProps) {
  const theme = useNaneTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <View style={[styles.icon, { backgroundColor: theme.colors.surfaceStrong }]}>
        <FileText color={theme.colors.primary} size={20} strokeWidth={2.4} />
      </View>
      <View style={styles.text}>
        <MobileText variant="body" weight="bold" numberOfLines={1}>
          {title}
        </MobileText>
        {meta ? (
          <MobileText variant="small" tone="secondary" numberOfLines={1}>
            {meta}
          </MobileText>
        ) : null}
        {status ? <MobileStatusBadge status={status} /> : null}
      </View>
      <View style={styles.actions}>
        {onView ? <MobileIconButton icon={Eye} label="View document" variant="ghost" onPress={onView} /> : null}
        {onDownload ? <MobileIconButton icon={Download} label="Download document" variant="ghost" onPress={onDownload} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 2,
  },
});

