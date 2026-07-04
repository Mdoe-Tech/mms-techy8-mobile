import { StyleSheet, View, type ViewProps } from 'react-native';

export function MobileKpiGrid({ style, ...props }: ViewProps) {
  return <View style={[styles.grid, style]} {...props} />;
}

export function MobileKpiGridItem({ style, ...props }: ViewProps) {
  return <View style={[styles.item, style]} {...props} />;
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  item: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 150,
  },
});

