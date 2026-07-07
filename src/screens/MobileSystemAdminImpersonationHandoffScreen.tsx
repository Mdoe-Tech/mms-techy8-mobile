import { router } from 'expo-router';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  LogIn,
  Mail,
  Route,
  ShieldCheck,
  UserRound,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileConfirmSheet,
  MobileEmptyState,
  MobileFormSection,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobileScreen,
  MobileStatusBadge,
  MobileSummaryPanel,
  MobileText,
  MobileTextInput,
  MobileToast,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  impersonateAssociationAdmin,
  impersonateAssociationUser,
  type SystemAdminImpersonationResponse,
} from '@/services/dashboard-service';
import { type KpiTone, useNaneTheme } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';

type HandoffTarget = 'admin' | 'user';
type HandoffState = 'missing' | 'ready' | 'confirm';

type MobileSystemAdminImpersonationHandoffScreenProps = {
  initialState?: HandoffState;
  initialTarget?: HandoffTarget;
  initialSchemaName?: string | null;
  initialEmail?: string | null;
};

export default function MobileSystemAdminImpersonationHandoffScreen({
  initialState,
  initialTarget = 'admin',
  initialSchemaName,
  initialEmail,
}: MobileSystemAdminImpersonationHandoffScreenProps = {}) {
  const { activeView, replaceSession, user } = useAuth();
  const [target, setTarget] = useState<HandoffTarget>(initialTarget);
  const [schemaName, setSchemaName] = useState((initialSchemaName || '').trim());
  const [email, setEmail] = useState((initialEmail || '').trim().toLowerCase());
  const [confirmVisible, setConfirmVisible] = useState(initialState === 'confirm');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ title: string; description?: string; tone?: 'success' | 'danger' | 'warning' | 'info' } | null>(null);

  const hasHandoffData = Boolean(schemaName);
  const ready = initialState !== 'missing' && hasHandoffData && (target === 'admin' || isValidEmail(email));
  const summary = useMemo(() => buildSummary(hasHandoffData, ready, target), [hasHandoffData, ready, target]);

  if (activeView !== 'SYSTEM_ADMIN') {
    return (
      <AccessDeniedScreen
        title="Impersonation handoff"
        description="Opening tenant sessions from platform support tools is available only to system administrators."
      />
    );
  }

  const openAssociations = () => {
    router.push('/work/route-preview?routeId=system-admin-admin-associations&previewSession=env' as never);
  };

  const requestHandoff = () => {
    if (!schemaName) {
      setNotice({
        title: 'No handoff data',
        description: 'Open this route from the Associations support controls so the target tenant schema is provided.',
        tone: 'warning',
      });
      return;
    }
    if (target === 'user' && !isValidEmail(email)) {
      setNotice({
        title: 'User email required',
        description: 'Enter the exact tenant user email before opening a user session.',
        tone: 'warning',
      });
      return;
    }
    setNotice(null);
    setConfirmVisible(true);
  };

  const startHandoff = async () => {
    if (!schemaName) return;
    setLoading(true);
    setNotice(null);
    try {
      const result = target === 'admin'
        ? await impersonateAssociationAdmin(schemaName)
        : await impersonateAssociationUser(email.trim().toLowerCase(), schemaName);
      await activateImpersonatedSession(result, replaceSession);
      setConfirmVisible(false);
      setNotice({
        title: 'Impersonation active',
        description: `Opening ${result.fullName || result.email || 'tenant session'}...`,
        tone: 'success',
      });
      router.replace('/' as never);
    } catch (error) {
      setConfirmVisible(false);
      setNotice({
        title: 'Impersonation failed',
        description: getApiErrorMessage(error),
        tone: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Platform support"
        title="Impersonation handoff"
        subtitle={user?.fullName ? `${user.fullName} · guarded tenant session switch` : 'Guarded tenant session switch'}
        onBack={() => router.back()}
      />

      {notice ? <MobileToast title={notice.title} description={notice.description} tone={notice.tone} /> : null}

      <MobileSummaryPanel
        title="Session handoff"
        value={summary.value}
        description={summary.description}
        tone={summary.tone}
        icon={summary.icon}
      />

      {!hasHandoffData && initialState === 'missing' ? (
        <MobileEmptyState
          title="No impersonation data found"
          description="This handoff needs an association workspace key from the Associations support flow."
          actionLabel="Open Associations"
          onAction={openAssociations}
        />
      ) : null}

      <MobileFormSection
        title="Handoff details"
        description="Use this route only after choosing an association from the platform support register."
      >
        <View style={styles.segmented}>
          <SegmentButton label="Admin" active={target === 'admin'} onPress={() => setTarget('admin')} />
          <SegmentButton label="User" active={target === 'user'} onPress={() => setTarget('user')} />
        </View>

        <MobileTextInput
          label="Workspace key"
          value={schemaName}
          onChangeText={(value) => {
            setSchemaName(value.trim());
            setNotice(null);
          }}
          placeholder="assoc_xxxxxxxxxxxx"
          autoCapitalize="none"
          helperText="Use the workspace key passed from the Associations support controls."
          icon={Route}
        />

        {target === 'user' ? (
          <MobileTextInput
            label="User email"
            value={email}
            onChangeText={(value) => {
              setEmail(value.trim().toLowerCase());
              setNotice(null);
            }}
            placeholder="user@association.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            helperText="Required only when opening a specific tenant user session."
            error={email && !isValidEmail(email) ? 'Enter a valid email address.' : undefined}
            icon={Mail}
          />
        ) : null}
      </MobileFormSection>

      <View style={styles.actions}>
        <MobileButton label="Open Associations" variant="secondary" icon={Route} onPress={openAssociations} />
        <MobileButton label="Start handoff" icon={LogIn} loading={loading} disabled={!ready} fullWidth onPress={requestHandoff} style={styles.primaryAction} />
      </View>

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Handoff data"
            value={hasHandoffData ? 'Ready' : 'Missing'}
            description={hasHandoffData ? 'Workspace key available' : 'Open from Associations'}
            tone={hasHandoffData ? 'green' : 'orange'}
            icon={Route}
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Target"
            value={target === 'admin' ? 'Admin' : 'User'}
            description={target === 'admin' ? 'First tenant admin' : 'Exact email session'}
            tone={target === 'admin' ? 'purple' : 'teal'}
            icon={target === 'admin' ? ShieldCheck : UserRound}
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Confirmation"
            value={ready ? 'Ready' : 'Required'}
            description={ready ? 'Can switch after approval' : 'Complete handoff details'}
            tone={ready ? 'blue' : 'slate'}
            icon={KeyRound}
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Audit"
            value="Logged"
            description="Backend records platform action"
            tone="green"
            icon={CheckCircle2}
          />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard compact accent={ready ? 'blue' : 'orange'}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitle}>
            <MobileText variant="section" weight="bold">
              Session switch rules
            </MobileText>
            <MobileText variant="small" tone="secondary">
              The current platform session will be replaced by the tenant session after confirmation.
            </MobileText>
          </View>
          <MobileStatusBadge label={ready ? 'Ready' : 'Review'} tone={ready ? 'primary' : 'warning'} />
        </View>
        <MobileInfoRow icon={Route} label="Workspace key" value={schemaName || 'Not provided'} helper="Supplied by the platform association register." />
        <MobileInfoRow
          icon={target === 'admin' ? ShieldCheck : Mail}
          label="Target session"
          value={target === 'admin' ? 'Association admin' : email || 'User email required'}
          helper={target === 'admin' ? 'Backend selects the first tenant ADMIN user.' : 'Backend opens the exact tenant user account.'}
        />
        <MobileInfoRow icon={ArrowRight} label="Destination" value={target === 'admin' ? 'Association workspace' : 'Member or association workspace'} helper="The app derives the mobile workspace from the returned impersonation token." />
      </MobileCard>

      <MobileConfirmSheet
        visible={confirmVisible}
        title="Open impersonated session?"
        description={
          target === 'admin'
            ? `This will replace the current system-admin session with the tenant admin session for ${schemaName}.`
            : `This will replace the current system-admin session with ${email || 'the selected user'} in ${schemaName}.`
        }
        confirmLabel="Open session"
        loading={loading}
        onCancel={() => setConfirmVisible(false)}
        onConfirm={startHandoff}
      />
    </MobileScreen>
  );
}

async function activateImpersonatedSession(
  result: SystemAdminImpersonationResponse,
  replaceSession: (accessToken: string, refreshToken: string, preferredView?: 'SYSTEM_ADMIN' | 'ADMIN' | 'MEMBER' | null) => Promise<unknown>,
) {
  const systemRole = String(result.systemRole || '').toUpperCase();
  const associationRole = String(result.associationRole || '').toUpperCase();
  const nextView = systemRole === 'ASSOCIATION_USER' || associationRole === 'MEMBER' ? 'MEMBER' : 'ADMIN';
  await replaceSession(result.accessToken, result.refreshToken, nextView);
}

function buildSummary(hasHandoffData: boolean, ready: boolean, target: HandoffTarget): {
  value: string;
  description: string;
  tone: KpiTone;
  icon: typeof AlertTriangle;
} {
  if (!hasHandoffData) {
    return {
      value: 'Missing details',
      description: 'No association workspace key was provided. Start from the Associations support flow.',
      tone: 'orange',
      icon: AlertTriangle,
    };
  }
  if (!ready) {
    return {
      value: 'Review',
      description: target === 'user' ? 'A valid user email is required before switching session.' : 'Review the tenant schema before switching session.',
      tone: 'slate',
      icon: KeyRound,
    };
  }
  return {
    value: 'Ready',
    description: target === 'admin' ? 'The next action opens the tenant admin workspace.' : 'The next action opens the selected tenant user workspace.',
    tone: 'blue',
    icon: LogIn,
  };
}

function SegmentButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useNaneTheme();
  const backgroundColor = active ? theme.colors.primary : theme.colors.surface;

  return (
    <MobileButton
      label={label}
      variant={active ? 'primary' : 'secondary'}
      size="sm"
      onPress={onPress}
      style={[
        styles.segmentButton,
        {
          backgroundColor,
          borderColor: active ? theme.colors.primary : theme.colors.borderStrong,
        },
      ]}
    />
  );
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

const styles = StyleSheet.create({
  segmented: {
    flexDirection: 'row',
    gap: 10,
  },
  segmentButton: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    flex: 1,
    gap: 3,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryAction: {
    flex: 1,
  },
});
