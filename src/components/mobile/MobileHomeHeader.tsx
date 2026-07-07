import {
  Building2,
  Check,
  ChevronRight,
  Hand,
  LogOut,
  Mail,
  Monitor,
  Moon,
  Palette,
  RefreshCw,
  ShieldCheck,
  Sun,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { useWorkspaceIdentity } from '@/auth/workspace-identity';
import type { MobileViewMode } from '@/types/auth';
import { useNaneThemePreference, type NaneThemePreference } from '@/theme/theme-preference';
import { useNaneTheme } from '@/theme/tokens';
import { MobileConfirmSheet } from './MobileConfirmSheet';
import { MobileIconButton } from './MobileIconButton';
import { MobileInfoRow } from './MobileInfoRow';
import { MobileSheet } from './MobileSheet';
import { MobileText } from './MobileText';
import { MobileWorkspaceLogo } from './MobileWorkspaceLogo';

type MobileHomeHeaderProps = {
  displayName?: string;
  workspaceLabel: string;
  workspaceName?: string;
  subtitle?: string;
  updatedText?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
};

type ThemeOption = {
  value: NaneThemePreference;
  title: string;
  description: string;
  icon: LucideIcon;
};

type WorkspaceOption = {
  value: MobileViewMode;
  title: string;
  description: string;
  icon: LucideIcon;
};

const themeOptions: ThemeOption[] = [
  { value: 'system', title: 'System', description: 'Match this phone automatically.', icon: Monitor },
  { value: 'light', title: 'Light', description: 'Bright white workspace.', icon: Sun },
  { value: 'dark', title: 'Dark', description: 'Comfortable low-light mode.', icon: Moon },
];

export function MobileHomeHeader({
  displayName,
  workspaceLabel,
  workspaceName,
  subtitle,
  updatedText,
  onRefresh,
  refreshing,
}: MobileHomeHeaderProps) {
  const theme = useNaneTheme();
  const {
    activeView,
    canUseAssociationAdmin,
    canUseMemberPortal,
    canUseSystemAdmin,
    setActiveView,
    user,
    signOut,
    loading,
  } = useAuth();
  const workspaceIdentity = useWorkspaceIdentity();
  const { preference, resolvedScheme, setPreference } = useNaneThemePreference();
  const [profileOpen, setProfileOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [switchingWorkspace, setSwitchingWorkspace] = useState<MobileViewMode | null>(null);
  const name = displayName || user?.fullName || 'there';
  const firstName = firstDisplayName(name);
  const initials = initialsFor(name);
  const greeting = useMemo(() => greetingForHour(new Date().getHours()), []);
  const role = user?.associationRole || user?.systemRole || readableRole(user?.roles?.[0]) || 'Mobile user';
  const workspace = workspaceIdentity.workspaceName || workspaceName || user?.associationName || workspaceLabel;
  const themeLabel = preference === 'system' ? `System (${resolvedScheme})` : toTitle(preference);
  const workspaceOptions = useMemo<WorkspaceOption[]>(
    () =>
      [
        canUseAssociationAdmin
          ? {
              value: 'ADMIN' as const,
              title: 'Association admin',
              description: 'Manage members, payments, loans, reports, and settings.',
              icon: Building2,
            }
          : null,
        canUseMemberPortal
          ? {
              value: 'MEMBER' as const,
              title: 'Member portal',
              description: 'Open your profile, invoices, wallet, loans, and member services.',
              icon: UserRound,
            }
          : null,
        canUseSystemAdmin
          ? {
              value: 'SYSTEM_ADMIN' as const,
              title: 'System admin',
              description: 'Review platform clients, billing, operations, and support tools.',
              icon: ShieldCheck,
            }
          : null,
      ].filter(Boolean) as WorkspaceOption[],
    [canUseAssociationAdmin, canUseMemberPortal, canUseSystemAdmin],
  );

  const switchWorkspace = async (view: MobileViewMode) => {
    if (view === activeView || switchingWorkspace) return;
    setSwitchingWorkspace(view);
    try {
      await setActiveView(view);
      setProfileOpen(false);
      router.replace('/' as never);
    } finally {
      setSwitchingWorkspace(null);
    }
  };

  return (
    <>
      <View style={styles.header}>
        <View style={styles.topRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            onPress={() => setProfileOpen(true)}
            style={({ pressed }) => [styles.avatarButton, { backgroundColor: theme.colors.primary, opacity: pressed ? 0.82 : 1 }]}
          >
            <MobileText variant="section" weight="bold" style={{ color: theme.colors.onPrimary }}>
              {initials}
            </MobileText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            onPress={() => setProfileOpen(true)}
            style={({ pressed }) => [styles.greetingButton, { opacity: pressed ? 0.82 : 1 }]}
          >
            <View style={styles.greetingLine}>
              <Hand color={theme.colors.primary} size={16} strokeWidth={2.4} />
              <MobileText variant="small" weight="bold" style={{ color: theme.colors.textSecondary }}>
                {greeting}
              </MobileText>
            </View>
            <View style={styles.nameLine}>
              <MobileText variant="title" weight="bold" numberOfLines={1} style={styles.nameText}>
                {firstName}
              </MobileText>
              <ChevronRight color={theme.colors.textMuted} size={19} strokeWidth={2.4} />
            </View>
          </Pressable>
        </View>

        <View style={styles.contextRow}>
          <MobileWorkspaceLogo
            name={workspace}
            source={workspaceIdentity.isAssociationWorkspace ? workspaceIdentity.workspaceLogoSource : null}
            size="sm"
          />
          <View style={styles.workspaceCopy}>
            <MobileText variant="small" weight="bold" numberOfLines={1}>
              {workspace}
            </MobileText>
            <MobileText variant="tiny" tone="secondary" numberOfLines={1}>
              {updatedText ? `Updated ${updatedText}` : subtitle || role}
            </MobileText>
          </View>
          {onRefresh ? <MobileIconButton icon={RefreshCw} label="Refresh" variant="secondary" disabled={refreshing} onPress={onRefresh} /> : null}
        </View>
      </View>

      <MobileSheet
        visible={profileOpen}
        title="Account"
        description="Profile, workspace, display, and session controls."
        onClose={() => setProfileOpen(false)}
      >
        <View style={[styles.profileHero, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <View style={[styles.profileAvatar, { backgroundColor: theme.colors.primary }]}>
            <MobileText variant="title" weight="bold" style={{ color: theme.colors.onPrimary }}>
              {initials}
            </MobileText>
          </View>
          <View style={styles.profileCopy}>
            <MobileText variant="section" weight="bold" numberOfLines={1}>
              {name}
            </MobileText>
            <MobileText variant="small" tone="secondary" numberOfLines={1}>
              {user?.email || subtitle || role}
            </MobileText>
          </View>
        </View>

        <View style={[styles.workspacePanel, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <MobileWorkspaceLogo
            name={workspace}
            source={workspaceIdentity.isAssociationWorkspace ? workspaceIdentity.workspaceLogoSource : null}
            size="lg"
          />
          <View style={styles.workspacePanelCopy}>
            <MobileText variant="section" weight="bold" numberOfLines={2}>
              {workspace}
            </MobileText>
            <MobileText variant="small" tone="secondary" numberOfLines={2}>
              {workspaceLabel} workspace · {role}
            </MobileText>
          </View>
        </View>

        {workspaceOptions.length > 1 ? (
          <>
            <View style={styles.sheetSectionHeader}>
              <View style={[styles.sheetSectionIcon, { backgroundColor: theme.colors.surfaceStrong }]}>
                <Building2 color={theme.colors.primary} size={17} strokeWidth={2.5} />
              </View>
              <View style={styles.sheetSectionCopy}>
                <MobileText variant="body" weight="bold">
                  Workspace
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  Choose the side of Nane you want to use now.
                </MobileText>
              </View>
            </View>
            <View style={styles.workspaceList}>
              {workspaceOptions.map((option) => {
                const active = option.value === activeView;
                const Icon = option.icon;
                const switching = switchingWorkspace === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active, disabled: loading || switchingWorkspace !== null }}
                    disabled={loading || switchingWorkspace !== null}
                    onPress={() => void switchWorkspace(option.value)}
                    style={({ pressed }) => [
                      styles.workspaceOption,
                      {
                        backgroundColor: active ? theme.colors.surfaceStrong : theme.colors.surface,
                        borderColor: active ? theme.colors.primary : theme.colors.border,
                        opacity: pressed ? 0.82 : 1,
                      },
                    ]}
                  >
                    <View style={[styles.workspaceSwitchIcon, { backgroundColor: active ? theme.colors.primary : theme.colors.surfaceMuted }]}>
                      <Icon color={active ? theme.colors.onPrimary : theme.colors.textSecondary} size={18} strokeWidth={2.5} />
                    </View>
                    <View style={styles.workspaceSwitchCopy}>
                      <MobileText variant="body" weight="bold">
                        {option.title}
                      </MobileText>
                      <MobileText variant="small" tone="secondary" numberOfLines={2}>
                        {option.description}
                      </MobileText>
                    </View>
                    {active || switching ? <Check color={theme.colors.primary} size={20} strokeWidth={3} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        <View style={styles.infoBlock}>
          <MobileInfoRow label="Workspace" value={workspace} helper={workspaceLabel} icon={Building2} />
          <MobileInfoRow label="Role" value={role} helper="Current access level" icon={ShieldCheck} />
          <MobileInfoRow label="Email" value={user?.email || subtitle || 'Not available'} helper="Signed-in account" icon={Mail} />
          {updatedText ? <MobileInfoRow label="Dashboard" value={`Updated ${updatedText}`} helper="Latest dashboard refresh" icon={RefreshCw} /> : null}
        </View>

        <View style={styles.sheetSectionHeader}>
          <View style={[styles.sheetSectionIcon, { backgroundColor: theme.colors.surfaceStrong }]}>
            <Palette color={theme.colors.primary} size={17} strokeWidth={2.5} />
          </View>
          <View style={styles.sheetSectionCopy}>
            <MobileText variant="body" weight="bold">
              Display
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Current theme: {themeLabel}
            </MobileText>
          </View>
        </View>
        <View style={styles.themeList}>
          {themeOptions.map((option) => {
            const active = preference === option.value;
            const Icon = option.icon;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  void setPreference(option.value);
                }}
                style={({ pressed }) => [
                  styles.themeOption,
                  {
                    backgroundColor: active ? theme.colors.surfaceStrong : theme.colors.surface,
                    borderColor: active ? theme.colors.primary : theme.colors.border,
                    opacity: pressed ? 0.82 : 1,
                  },
                ]}
              >
                <View style={[styles.themeIcon, { backgroundColor: active ? theme.colors.primary : theme.colors.surfaceMuted }]}>
                  <Icon color={active ? theme.colors.onPrimary : theme.colors.textSecondary} size={18} strokeWidth={2.5} />
                </View>
                <View style={styles.themeCopy}>
                  <MobileText variant="body" weight="bold">
                    {option.title}
                  </MobileText>
                  <MobileText variant="small" tone="secondary">
                    {option.description}
                  </MobileText>
                </View>
                {active ? <Check color={theme.colors.primary} size={20} strokeWidth={3} /> : null}
              </Pressable>
            );
          })}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          onPress={() => {
            setProfileOpen(false);
            setLogoutOpen(true);
          }}
          style={({ pressed }) => [
            styles.logoutButton,
            {
              backgroundColor: theme.colors.status.danger,
              opacity: pressed ? 0.82 : 1,
            },
          ]}
        >
          <LogOut color={theme.colors.onPrimary} size={18} strokeWidth={2.5} />
          <MobileText variant="body" weight="bold" style={{ color: theme.colors.onPrimary }}>
            Sign out
          </MobileText>
        </Pressable>
      </MobileSheet>

      <MobileConfirmSheet
        visible={logoutOpen}
        title="Sign out?"
        description="You will return to the sign-in screen. Any saved session on this device will be cleared."
        confirmLabel="Sign out"
        destructive
        loading={loading}
        onCancel={() => setLogoutOpen(false)}
        onConfirm={() => {
          setLogoutOpen(false);
          setProfileOpen(false);
          void signOut();
        }}
      />
    </>
  );
}

function greetingForHour(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function firstDisplayName(name: string) {
  return name.trim().split(/\s+/)[0] || 'there';
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = `${parts[0]?.[0] || 'N'}${parts[1]?.[0] || ''}`;
  return initials.toUpperCase();
}

function readableRole(role?: string | null) {
  if (!role) return null;
  return role
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function toTitle(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  header: {
    gap: 14,
    paddingTop: 2,
    paddingBottom: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  greetingButton: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  greetingLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  nameText: {
    flexShrink: 1,
  },
  avatarButton: {
    width: 54,
    height: 54,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  workspaceCopy: {
    flex: 1,
    minWidth: 0,
  },
  profileHero: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCopy: {
    flex: 1,
    minWidth: 0,
  },
  workspacePanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  workspacePanelCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  workspaceList: {
    gap: 10,
  },
  workspaceOption: {
    minHeight: 82,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  workspaceSwitchIcon: {
    width: 40,
    height: 40,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workspaceSwitchCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  infoBlock: {
    gap: 0,
  },
  sheetSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetSectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetSectionCopy: {
    flex: 1,
    minWidth: 0,
  },
  themeList: {
    gap: 10,
  },
  themeOption: {
    minHeight: 76,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  themeIcon: {
    width: 40,
    height: 40,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeCopy: {
    flex: 1,
    minWidth: 0,
  },
  logoutButton: {
    minHeight: 48,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
});
