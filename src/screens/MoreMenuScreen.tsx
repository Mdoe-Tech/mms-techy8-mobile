import { router } from 'expo-router';
import { Boxes, ChevronRight, Layers3, Moon, Smartphone, Sun } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, useColorScheme } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileCard,
  MobilePageHeader,
  MobileScreen,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
} from '@/components/mobile';
import {
  getModuleSummariesForRole,
  mobileRoles,
  roleForMobileView,
  roleLabels,
  type MobileModuleSummary,
  type MobileRole,
} from '@/navigation/route-registry';
import { useNaneTheme } from '@/theme/tokens';

export default function MoreMenuScreen() {
  const { activeView } = useAuth();
  const defaultRole = roleForMobileView(activeView);
  const [selectedRole, setSelectedRole] = useState<MobileRole | null>(null);
  const role = selectedRole || defaultRole;
  const modules = useMemo(() => getModuleSummariesForRole(role), [role]);
  const theme = useNaneTheme();
  const scheme = useColorScheme();
  const SchemeIcon = scheme === 'dark' ? Moon : Sun;

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Navigation"
        title="More"
        subtitle="Module directory, previews, and system surfaces."
      />

      <MobileStatusTabs
        tabs={mobileRoles.map((item) => ({
          value: item,
          label: roleLabels[item].short,
          count: getModuleSummariesForRole(item).length,
        }))}
        value={role}
        onChange={(nextRole) => setSelectedRole(nextRole as MobileRole)}
      />

      <MobileCard compact accent="blue">
        <View style={styles.systemRow}>
          <View style={[styles.systemIcon, { backgroundColor: theme.colors.primary }]}>
            <Smartphone color={theme.colors.onPrimary} size={22} strokeWidth={2.4} />
          </View>
          <View style={styles.systemCopy}>
            <MobileText variant="section" weight="bold">
              Mobile foundation
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Shared navigation, roles, components, loading, skeletons, and design previews.
            </MobileText>
          </View>
          <MobileStatusBadge status="Ready" label="Phase 1" tone="success" />
        </View>
      </MobileCard>

      <View style={styles.sectionHeader}>
        <MobileText variant="section" weight="bold">
          Module directory
        </MobileText>
        <MobileText variant="small" tone="secondary">
          Every module visible to {roleLabels[role].short}.
        </MobileText>
      </View>

      <View style={styles.menuList}>
        {modules.map((module) => (
          <ModuleMenuRow key={module.id} module={module} role={role} />
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <MobileText variant="section" weight="bold">
          Design previews
        </MobileText>
        <MobileText variant="small" tone="secondary">
          Keep these until real pages replace the preview screens.
        </MobileText>
      </View>

      <View style={styles.menuList}>
        <MenuRow
          title="Association preview"
          subtitle="Current admin mobile dashboard sample"
          icon={Boxes}
          badge="Preview"
          onPress={() => router.push('/')}
        />
        <MenuRow
          title="Member preview"
          subtitle="Current member mobile dashboard sample"
          icon={Boxes}
          badge="Preview"
          onPress={() => router.push('/member')}
        />
        <MenuRow
          title="Component library"
          subtitle="Mobile UI system samples and states"
          icon={Layers3}
          badge="Design"
          onPress={() => router.push('/components')}
        />
        <MenuRow
          title="Record details"
          subtitle="Detail page, timeline, files, and form pattern"
          icon={Layers3}
          badge="Design"
          onPress={() => router.push('/records')}
        />
        <MenuRow
          title={`${scheme === 'dark' ? 'Dark' : 'Light'} mode`}
          subtitle="Uses the device appearance setting"
          icon={SchemeIcon}
          badge="Theme"
          onPress={() => undefined}
        />
      </View>
    </MobileScreen>
  );
}

function ModuleMenuRow({ module, role }: { module: MobileModuleSummary; role: MobileRole }) {
  return (
    <MenuRow
      title={module.label}
      subtitle={`${module.routeCount} routes · ${module.primaryCount} primary · ${module.dynamicCount} dynamic`}
      icon={module.icon}
      badge={roleLabels[role].short}
      onPress={() => router.push({ pathname: '/module', params: { module: module.id, role } } as never)}
    />
  );
}

function MenuRow({
  title,
  subtitle,
  icon: Icon,
  badge,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: MobileModuleSummary['icon'];
  badge: string;
  onPress: () => void;
}) {
  const theme = useNaneTheme();

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.84 : 1 }]}>
      <MobileCard compact style={styles.rowCard}>
        <View style={[styles.rowIcon, { backgroundColor: theme.colors.primary }]}>
          <Icon color={theme.colors.onPrimary} size={19} strokeWidth={2.4} />
        </View>
        <View style={styles.rowCopy}>
          <View style={styles.rowTitle}>
            <MobileText variant="body" weight="bold" numberOfLines={1} style={styles.rowTitleText}>
              {title}
            </MobileText>
            <MobileStatusBadge status="More" label={badge} tone="neutral" showDot={false} />
          </View>
          <MobileText variant="small" tone="secondary" numberOfLines={2}>
            {subtitle}
          </MobileText>
        </View>
        <ChevronRight color={theme.colors.textMuted} size={18} />
      </MobileCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  systemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  systemIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  systemCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  sectionHeader: {
    gap: 3,
  },
  menuList: {
    gap: 10,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  rowTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowTitleText: {
    flex: 1,
  },
});
