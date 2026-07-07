import { router } from 'expo-router';
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  Coins,
  Edit3,
  Gavel,
  Hash,
  Landmark,
  Percent,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Users,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileConfirmSheet,
  MobileDetailHeader,
  MobileEmptyState,
  MobileErrorState,
  MobileIconButton,
  MobileInfoRow,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileStatusBadge,
  MobileSummaryPanel,
  MobileText,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  deleteGroupConfig,
  getGroupConfigById,
  type GroupConfig,
} from '@/services/member-service';
import type { KpiTone, StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate, formatNumber } from '@/utils/format';

type MobileGroupConfigDetailScreenProps = {
  configId?: string | null;
};

export default function MobileGroupConfigDetailScreen({ configId }: MobileGroupConfigDetailScreenProps) {
  const { activeView, user } = useAuth();
  const [config, setConfig] = useState<GroupConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = useMemo(() => hasLoanConfigManagePermission(user), [user]);
  const listRoute = getRouteByPath('/associations/group-config');
  const editRoute = getRouteByPath('/associations/group-config/edit/:id');

  const loadConfig = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!configId) {
        setLoading(false);
        setError('Configuration context is missing.');
        return;
      }

      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const loaded = await getGroupConfigById(configId);
        setConfig(loaded);
      } catch (loadError) {
        setConfig(null);
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [configId],
  );

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadConfig('initial');
    });
    return () => {
      active = false;
    };
  }, [loadConfig]);

  const goToList = (selectedConfig?: GroupConfig | null) => {
    if (!listRoute) {
      router.back();
      return;
    }
    router.replace({
      pathname: '/work/route-preview',
      params: {
        routeId: listRoute.id,
        configId: selectedConfig?.id,
        id: selectedConfig?.id,
      },
    } as never);
  };

  const goToEdit = () => {
    if (!config?.id || !editRoute) return;
    router.push({
      pathname: '/work/route-preview',
      params: {
        routeId: editRoute.id,
        configId: config.id,
        id: config.id,
      },
    } as never);
  };

  const deleteConfig = async () => {
    if (!config?.id || !canManage) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteGroupConfig(config.id);
      setConfirmDelete(false);
      goToList();
    } catch (deleteError) {
      setError(getApiErrorMessage(deleteError));
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Group configuration" description="Configuration details are available in association admin workspaces only." />;
  }

  if (String(user?.associationType || '').toUpperCase() !== 'VIKOBA') {
    return <AccessDeniedScreen title="Group configuration" description="Loan group configuration is available for VIKOBA associations only." />;
  }

  if (!configId) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Settings" title="Configuration details" subtitle="Missing configuration context" onBack={() => router.back()} />
        <MobileEmptyState
          title="No configuration selected"
          description="Open this screen from the group configuration register so the record ID is available."
          actionLabel="Back to configurations"
          onAction={() => goToList()}
        />
      </MobileScreen>
    );
  }

  if (loading && !config) {
    return <MobilePageLoadingState kind="detail" message="Loading group configuration" />;
  }

  if (error && !config) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Settings"
          title="Configuration details"
          subtitle={shortId(configId)}
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry" variant="secondary" disabled={refreshing} onPress={() => void loadConfig('refresh')} />}
        />
        <MobileErrorState title="Configuration could not load" description={error} retryLabel="Retry" onRetry={() => void loadConfig('refresh')} />
      </MobileScreen>
    );
  }

  if (!config) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Settings" title="Configuration details" subtitle={shortId(configId)} onBack={() => router.back()} />
        <MobileEmptyState title="Configuration not found" description="The selected group configuration was not returned by the server." />
      </MobileScreen>
    );
  }

  const fyStatus = financialYearStatus(config);
  const summaryTone = summaryToneFor(config);
  const configName = labelForConfig(config);

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Settings"
        title="Configuration details"
        subtitle={shortId(config.id || configId)}
        onBack={() => goToList(config)}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Refresh configuration"
            variant="secondary"
            disabled={refreshing}
            onPress={() => void loadConfig('refresh')}
          />
        }
      />

      {error ? <MobileStatusBadge status="Refresh failed" label={error} tone="warning" /> : null}

      <MobileDetailHeader
        eyebrow="VIKOBA ruleset"
        title={configName}
        subtitle={`Version ${config.version ?? 1} · FY ${formatDate(config.financialYearStartDate)} - ${formatDate(config.financialYearEndDate)}`}
        avatarName={configName}
        avatarTone={fyStatus.tone}
        status={fyStatus.key}
        statusLabel={fyStatus.label}
        statusTone={fyStatus.tone}
      />

      <MobileSummaryPanel
        title="Share value"
        value={formatCurrency(toNumber(config.shareValue))}
        description={`${config.sharePurchaseFrequency || 'Frequency not set'} shares · ${formatNumber(toNumber(config.loanMultiplier))}x loan multiplier`}
        tone={summaryTone}
        icon={SlidersHorizontal}
        footer={
          <View style={styles.summaryFooter}>
            <MobileStatusBadge status={fyStatus.key} label={fyStatus.label} tone={fyStatus.tone} />
            <MobileStatusBadge status="Loans" label={`${formatNumber(toNumber(config.interestRate))}% interest`} tone="review" />
          </View>
        }
      />

      <View style={styles.actions}>
        <MobileButton label="Back to list" variant="secondary" onPress={() => goToList(config)} size="sm" />
        {canManage ? <MobileButton label="Edit" icon={Edit3} variant="secondary" onPress={goToEdit} size="sm" disabled={!editRoute} /> : null}
        {canManage ? <MobileButton label="Delete" icon={Trash2} variant="danger" onPress={() => setConfirmDelete(true)} loading={deleting} size="sm" /> : null}
      </View>

      {!canManage ? <MobileStatusBadge status="Read only" label="Your role can review this configuration but cannot change it." tone="info" /> : null}

      <MobileCard compact accent="green">
        <SectionHeader title="Shares and social contributions" status="Contrib." tone="success" />
        <MobileInfoRow label="Share value" value={formatCurrency(toNumber(config.shareValue))} helper={config.sharePurchaseFrequency || 'Frequency not set'} icon={Coins} />
        <MobileInfoRow label="Minimum shares" value={formatNumber(toNumber(config.minShares))} helper="Minimum shares expected from a member." icon={Users} />
        <MobileInfoRow label="Social amount" value={formatCurrency(toNumber(config.socialAmount))} helper={config.socialFrequency || 'Frequency not set'} icon={Banknote} />
      </MobileCard>

      <MobileCard compact accent="purple">
        <SectionHeader title="Loans and penalties" status="Loan rules" tone="review" />
        <MobileInfoRow label="Loan multiplier" value={`${formatNumber(toNumber(config.loanMultiplier))}x`} helper="Borrowing limit against shares." icon={Landmark} />
        <MobileInfoRow label="Interest" value={`${formatNumber(toNumber(config.interestRate))}%`} helper={config.interestType || 'Interest type not set'} icon={Percent} />
        <MobileInfoRow label="Insurance" value={`${formatNumber(toNumber(config.insuranceRate))}%`} helper={config.deductInsuranceOnDisbursement ? 'Deducted on disbursement' : 'Not deducted on disbursement'} icon={ShieldCheck} />
        <MobileInfoRow label="Penalty rate" value={`${formatNumber(toNumber(config.penaltyRate))}%`} helper={`${formatNumber(toNumber(config.loanRepaymentGracePeriodDays))} grace days`} icon={AlertTriangle} />
        <MobileInfoRow label="Default installments" value={formatNumber(toNumber(config.defaultInstallmentCount))} helper="Used when no repayment rule matches." icon={Gavel} />
        <MobileInfoRow label="Disbursement basis" value={config.disburseGrossAmount ? 'Gross amount' : 'Net amount'} helper={config.interestCalculationMethod || 'Calculation method not set'} icon={Banknote} />
      </MobileCard>

      <MobileCard compact accent="orange">
        <SectionHeader title="Fines and attendance" status="Fines" tone="warning" />
        <MobileInfoRow label="Contribution fine" value={fineLabel(config.fineType, config.fineAmount, config.finePercentage)} helper={config.fineType || 'Fine type not set'} icon={Gavel} />
        <MobileInfoRow label="Attendance fine" value={fineLabel(config.attendanceFineType, config.attendanceFineAmount, config.attendanceFinePercentage)} helper={config.attendanceFineFrequency || 'Frequency not set'} icon={Gavel} />
      </MobileCard>

      <MobileCard compact accent="blue">
        <SectionHeader title="Financial year" status={fyStatus.label} tone={fyStatus.tone} />
        <MobileInfoRow label="Start" value={formatDate(config.financialYearStartDate)} helper="Current financial year start." icon={CalendarDays} />
        <MobileInfoRow label="End" value={formatDate(config.financialYearEndDate)} helper="Current financial year end." icon={CalendarDays} />
        <MobileInfoRow label="Last closed" value={formatDate(config.lastFinancialYearClosedAt)} helper={lastClosedRange(config)} icon={CalendarDays} />
        <MobileInfoRow label="Created" value={formatDateTime(config.createdAt)} helper="Configuration creation time." icon={Hash} />
        <MobileInfoRow label="Updated" value={formatDateTime(config.updatedAt)} helper="Most recent update time." icon={Hash} />
      </MobileCard>

      <MobileCard compact accent="teal">
        <SectionHeader title="Dividends" status="Rules" tone="info" />
        <MobileInfoRow label="Weighting" value={String(config.additionalRules?.['dividends.weighting'] || 'SHARE_COUNT')} helper="Dividend allocation basis." icon={Percent} />
        <MobileInfoRow label="Minimum months" value={formatNumber(toNumber(config.additionalRules?.['dividends.minMonthsSinceJoin']))} helper="Membership age required for dividends." icon={CalendarDays} />
      </MobileCard>

      {config.repaymentRules?.length ? (
        <MobileCard compact accent="slate">
          <SectionHeader title="Repayment rules" status={`${config.repaymentRules.length} rules`} tone="neutral" />
          <View style={styles.ruleList}>
            {config.repaymentRules.map((rule, index) => (
              <MobileCard key={`${rule.minAmount}-${rule.maxAmount}-${index}`} compact>
                <MobileText variant="body" weight="bold">
                  Rule {index + 1}
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  {formatCurrency(toNumber(rule.minAmount))} - {formatCurrency(toNumber(rule.maxAmount))}
                </MobileText>
                <MobileText variant="small" weight="bold">
                  {formatNumber(toNumber(rule.months))} months · {formatNumber(toNumber(rule.installments))} installments
                </MobileText>
              </MobileCard>
            ))}
          </View>
        </MobileCard>
      ) : (
        <MobileCard compact accent="slate">
          <SectionHeader title="Repayment rules" status="Default" tone="neutral" />
          <MobileText variant="body" tone="secondary">
            No amount-based repayment rules are configured. The default installment count applies.
          </MobileText>
        </MobileCard>
      )}

      <MobileConfirmSheet
        visible={confirmDelete}
        title="Delete group configuration"
        description={`Delete ${configName}? This can affect loan, share, fine, and financial-year workflows.`}
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        destructive
        onCancel={() => (deleting ? undefined : setConfirmDelete(false))}
        onConfirm={() => void deleteConfig()}
      />
    </MobileScreen>
  );
}

function SectionHeader({ title, status, tone }: { title: string; status: string; tone: StatusTone }) {
  return (
    <View style={styles.sectionHeader}>
      <MobileText variant="section" weight="bold">
        {title}
      </MobileText>
      <MobileStatusBadge status={status} tone={tone} />
    </View>
  );
}

function financialYearStatus(config: GroupConfig): { key: 'active' | 'upcoming' | 'ended' | 'missing'; label: string; tone: StatusTone } {
  const start = dateMs(config.financialYearStartDate);
  const end = dateMs(config.financialYearEndDate);
  const now = Date.now();

  if (!start || !end) return { key: 'missing', label: 'No FY', tone: 'neutral' };
  if (now < start) return { key: 'upcoming', label: 'Upcoming', tone: 'warning' };
  if (now > end + 86_399_999) return { key: 'ended', label: 'Ended', tone: 'danger' };
  return { key: 'active', label: 'Active FY', tone: 'success' };
}

function summaryToneFor(config: GroupConfig): KpiTone {
  const fy = financialYearStatus(config);
  if (fy.tone === 'success') return 'green';
  if (fy.tone === 'warning') return 'orange';
  if (fy.tone === 'danger') return 'red';
  return 'blue';
}

function labelForConfig(config: GroupConfig) {
  return String(config.name || 'Group configuration');
}

function fineLabel(type?: string | null, amount?: number | string | null, percentage?: number | string | null) {
  if (String(type || '').toUpperCase() === 'PERCENTAGE') return `${formatNumber(toNumber(percentage))}%`;
  return formatCurrency(toNumber(amount));
}

function lastClosedRange(config: GroupConfig) {
  if (!config.lastClosedFinancialYearStartDate && !config.lastClosedFinancialYearEndDate) return 'No previous close recorded.';
  return `${formatDate(config.lastClosedFinancialYearStartDate)} - ${formatDate(config.lastClosedFinancialYearEndDate)}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en-TZ', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function shortId(value?: string | null) {
  if (!value) return 'No ID';
  return value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

function toNumber(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function dateMs(value?: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function hasLoanConfigManagePermission(user: { permissions?: string[]; roles?: string[]; associationRole?: string } | null) {
  const values = [...(user?.permissions || []), ...(user?.roles || []), user?.associationRole || ''].map((value) => value.toLowerCase());
  return values.some((value) =>
    [
      'loans.manage',
      'loans_manage',
      'loans.create',
      'loans.approve',
      'association_admin',
      'admin',
      'chairperson',
      'treasurer',
      'secretary',
    ].includes(value),
  );
}

const styles = StyleSheet.create({
  summaryFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  ruleList: {
    gap: 10,
  },
});
