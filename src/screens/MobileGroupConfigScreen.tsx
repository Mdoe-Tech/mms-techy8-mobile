import { router } from 'expo-router';
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  Coins,
  Edit3,
  FileText,
  Gavel,
  Landmark,
  Percent,
  Plus,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Users,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { isSaccosAssociation, isVikobaAssociation } from '@/auth/association-type';
import {
  MobileButton,
  MobileCard,
  MobileConfirmSheet,
  MobileDataList,
  type MobileDataListItem,
  MobileEmptyState,
  MobileErrorState,
  MobileIconButton,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileSearchToolbar,
  MobileSheet,
  MobileSortSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
  MobileToast,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  deleteGroupConfig,
  getAssociationGroupConfigs,
  type GroupConfig,
} from '@/services/member-service';
import { type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate, formatNumber } from '@/utils/format';

type ConfigTab = 'all' | 'activeFy' | 'loanReady' | 'contributions';
type SortOption = 'nameAsc' | 'fyEndAsc' | 'shareDesc' | 'loanDesc';

const sortOptions = [
  { value: 'nameAsc', label: 'Name', description: 'Configuration name A to Z.' },
  { value: 'fyEndAsc', label: 'Financial year end', description: 'Earliest year-end date first.' },
  { value: 'shareDesc', label: 'Highest share value', description: 'Largest configured share amount first.' },
  { value: 'loanDesc', label: 'Highest loan multiplier', description: 'Largest borrowing multiplier first.' },
];

type MobileGroupConfigScreenProps = {
  initialConfigId?: string;
};

export default function MobileGroupConfigScreen({ initialConfigId }: MobileGroupConfigScreenProps) {
  const { activeView, associationId, user } = useAuth();
  const isSaccos = isSaccosAssociation(user?.associationType);
  const [configs, setConfigs] = useState<GroupConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<ConfigTab>('all');
  const [sortValue, setSortValue] = useState<SortOption>('fyEndAsc');
  const [sortOpen, setSortOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<GroupConfig | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<GroupConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const initialConfigConsumed = useRef(false);

  const canManage = useMemo(() => hasLoanConfigManagePermission(user), [user]);
  const createRoute = getRouteByPath('/associations/group-config/create');
  const editRoute = getRouteByPath('/associations/group-config/edit/:id');

  const loadConfigs = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before loading group configuration.');
        return;
      }

      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      setError(null);

      try {
        const rows = await getAssociationGroupConfigs(associationId);
        setConfigs(rows);
      } catch (loadError) {
        setConfigs([]);
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadConfigs('initial'));
  }, [loadConfigs]);

  const primaryConfig = useMemo(() => choosePrimaryConfig(configs), [configs]);

  const metrics = useMemo(() => {
    const activeFy = configs.filter((config) => financialYearStatus(config).key === 'active').length;
    const loanReady = configs.filter((config) => toNumber(config.loanMultiplier) > 0 && toNumber(config.interestRate) >= 0).length;
    const contributions = configs.filter((config) => toNumber(config.shareValue) > 0 || toNumber(config.socialAmount) > 0).length;
    return {
      total: configs.length,
      activeFy,
      loanReady,
      contributions,
    };
  }, [configs]);

  const tabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: configs.length },
      { value: 'activeFy', label: 'Active FY', count: metrics.activeFy },
      { value: 'loanReady', label: 'Loans', count: metrics.loanReady },
      { value: 'contributions', label: 'Contrib.', count: metrics.contributions },
    ],
    [configs.length, metrics],
  );

  const visibleConfigs = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const filtered = configs.filter((config) => {
      if (activeTab === 'activeFy' && financialYearStatus(config).key !== 'active') return false;
      if (activeTab === 'loanReady' && !(toNumber(config.loanMultiplier) > 0 && toNumber(config.interestRate) >= 0)) return false;
      if (activeTab === 'contributions' && !(toNumber(config.shareValue) > 0 || toNumber(config.socialAmount) > 0)) return false;
      if (!query) return true;
      return [config.name, config.sharePurchaseFrequency, config.socialFrequency, config.fineType, config.interestType]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
    });

    return filtered.sort((left, right) => {
      if (sortValue === 'fyEndAsc') return dateMs(left.financialYearEndDate) - dateMs(right.financialYearEndDate);
      if (sortValue === 'shareDesc') return toNumber(right.shareValue) - toNumber(left.shareValue);
      if (sortValue === 'loanDesc') return toNumber(right.loanMultiplier) - toNumber(left.loanMultiplier);
      return labelForConfig(left).localeCompare(labelForConfig(right));
    });
  }, [activeTab, configs, searchTerm, sortValue]);

  const listItems = useMemo<MobileDataListItem[]>(
    () =>
      visibleConfigs.map((config) => {
        const fy = financialYearStatus(config);
        return {
          id: String(config.id || labelForConfig(config)),
          title: labelForConfig(config),
          subtitle: `FY ${formatDate(config.financialYearStartDate)} - ${formatDate(config.financialYearEndDate)}`,
          meta: isSaccos ? 'Equity shares · Savings-based lending' : `Share ${config.sharePurchaseFrequency || 'Not set'} · Social ${config.socialFrequency || 'Not set'}`,
          amount: formatCurrency(toNumber(config.shareValue)),
          status: fy.key,
          statusLabel: fy.label,
          statusTone: fy.tone,
          accent: fy.tone === 'success' ? 'success' : fy.tone === 'warning' ? 'warning' : fy.tone === 'danger' ? 'danger' : 'primary',
        };
      }),
    [isSaccos, visibleConfigs],
  );

  useEffect(() => {
    if (initialConfigConsumed.current || !initialConfigId || configs.length === 0) return;
    const config = configs.find((candidate) => candidate.id === initialConfigId);
    if (config) {
      initialConfigConsumed.current = true;
      const timer = setTimeout(() => setSelectedConfig(config), 0);
      return () => clearTimeout(timer);
    }
  }, [configs, initialConfigId]);

  const openCreate = () => {
    if (createRoute) router.push({ pathname: '/work/route-preview', params: { routeId: createRoute.id } } as never);
  };

  const openEdit = (config: GroupConfig) => {
    if (!config.id || !editRoute) return;
    setSelectedConfig(null);
    router.push({ pathname: '/work/route-preview', params: { routeId: editRoute.id, id: config.id } } as never);
  };

  const handleDelete = async () => {
    if (!confirmDelete?.id || !canManage) return;
    setDeleting(true);
    setError(null);
    setNotice(null);

    try {
      await deleteGroupConfig(confirmDelete.id);
      setNotice(`${labelForConfig(confirmDelete)} was deleted.`);
      setConfirmDelete(null);
      setSelectedConfig(null);
      await loadConfigs('refresh');
    } catch (deleteError) {
      setError(getApiErrorMessage(deleteError));
    } finally {
      setDeleting(false);
    }
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Group configuration" description="Group configuration is available in association admin workspaces only." />;
  }

  if (!isVikobaAssociation(user?.associationType) && !isSaccos) {
    return <AccessDeniedScreen title="Group configuration" description="Loan group configuration is available for VIKOBA and SACCOS associations." />;
  }

  if (loading && configs.length === 0) {
    return <MobilePageLoadingState kind="list" message="Loading group configuration" />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Settings"
        title="Group configuration"
        subtitle={isSaccos ? 'Equity shares, savings-based loans, and financial-year rules.' : 'Shares, loans, fines, and financial-year rules.'}
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh configuration" variant="secondary" disabled={refreshing} onPress={() => void loadConfigs('refresh')} />}
      />

      {error ? <MobileStatusBadge status="Failed" label={error} tone="danger" /> : null}
      {notice ? <MobileToast title="Configuration updated" description={notice} tone="success" /> : null}

      <MobileCard compact accent="blue">
        <View style={styles.heroRow}>
          <View style={styles.heroIcon}>
            <SlidersHorizontal color="#FFFFFF" size={22} strokeWidth={2.5} />
          </View>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold" numberOfLines={2}>
              {primaryConfig ? labelForConfig(primaryConfig) : 'No configuration yet'}
            </MobileText>
            <MobileText variant="small" tone="secondary" numberOfLines={3}>
              {primaryConfig
                ? `Financial year ${formatDate(primaryConfig.financialYearStartDate)} to ${formatDate(primaryConfig.financialYearEndDate)}.`
                : `Create a configuration before using ${isSaccos ? 'SACCOS savings, equity shares, and loans' : 'VIKOBA shares, loans, fines, and financial-year workflows'}.`}
            </MobileText>
          </View>
          {primaryConfig ? <MobileStatusBadge status={financialYearStatus(primaryConfig).key} label={financialYearStatus(primaryConfig).label} tone={financialYearStatus(primaryConfig).tone} /> : null}
        </View>
      </MobileCard>

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Configurations" value={`${metrics.total}`} description="Association rulesets" icon={FileText} tone="blue" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title={isSaccos ? 'Equity share value' : 'Share value'} value={formatCurrency(toNumber(primaryConfig?.shareValue))} description={isSaccos ? 'Used for ownership and dividends' : primaryConfig?.sharePurchaseFrequency || 'Not configured'} icon={Coins} tone="green" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Loan multiplier" value={`${formatNumber(toNumber(primaryConfig?.loanMultiplier))}x`} description={`${formatNumber(toNumber(primaryConfig?.interestRate))}% interest`} icon={Landmark} tone="purple" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Active FY" value={`${metrics.activeFy}`} description={primaryConfig ? formatDate(primaryConfig.financialYearEndDate) : 'No year end'} icon={CalendarDays} tone="orange" />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard compact>
        <View style={styles.actionHeader}>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold">
              Configuration register
            </MobileText>
            <MobileText variant="small" tone="secondary">
              {isSaccos ? 'Review equity, savings-based loan, and financial-year rules.' : 'Review active rules before creating contributions, loans, and fines.'}
            </MobileText>
          </View>
          <MobileStatusBadge status="Tracked" label={`${visibleConfigs.length} shown`} tone="primary" />
        </View>
        {canManage ? (
          <View style={styles.actionsWrap}>
            <MobileButton label="New config" icon={Plus} size="sm" onPress={openCreate} disabled={!createRoute} />
          </View>
        ) : null}
      </MobileCard>

      {!canManage ? <MobileToast title="Read only" description="Your account can review this configuration, but cannot change it." tone="info" /> : null}

      <MobileSearchToolbar value={searchTerm} onChange={setSearchTerm} placeholder="Search configurations..." onFilterPress={() => setSortOpen(true)} filterLabel="Sort" />
      <MobileStatusTabs tabs={tabs} value={activeTab} onChange={(value) => setActiveTab(value as ConfigTab)} />

      {error && configs.length === 0 ? (
        <MobileErrorState title="Group configuration could not load" description={error} retryLabel="Retry" onRetry={() => void loadConfigs('refresh')} />
      ) : listItems.length > 0 ? (
        <MobileDataList
          items={listItems}
          onPressItem={(item) => {
            const config = configs.find((candidate) => String(candidate.id || labelForConfig(candidate)) === item.id);
            if (config) setSelectedConfig(config);
          }}
        />
      ) : (
        <MobileEmptyState
          title="No configuration found"
          description={searchTerm ? 'No configuration matches your search or filter.' : `Create a group configuration before using ${isSaccos ? 'SACCOS' : 'VIKOBA'} financial workflows.`}
          actionLabel={canManage ? 'Create configuration' : 'Refresh'}
          onAction={canManage ? openCreate : () => void loadConfigs('refresh')}
        />
      )}

      <GroupConfigDetailSheet
        config={selectedConfig}
        canManage={canManage}
        onClose={() => setSelectedConfig(null)}
        onEdit={openEdit}
        onDelete={(config) => {
          setSelectedConfig(null);
          setConfirmDelete(config);
        }}
      />

      <MobileSortSheet
        visible={sortOpen}
        value={sortValue}
        options={sortOptions}
        onChange={(value) => setSortValue(value as SortOption)}
        onClose={() => setSortOpen(false)}
      />

      <MobileConfirmSheet
        visible={Boolean(confirmDelete)}
        title="Delete group configuration"
        description={confirmDelete ? `Delete ${labelForConfig(confirmDelete)}? This can affect loan, share, fine, and financial-year workflows.` : ''}
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        destructive
        onCancel={() => (deleting ? undefined : setConfirmDelete(null))}
        onConfirm={() => void handleDelete()}
      />
    </MobileScreen>
  );
}

function GroupConfigDetailSheet({
  config,
  canManage,
  onClose,
  onEdit,
  onDelete,
}: {
  config: GroupConfig | null;
  canManage: boolean;
  onClose: () => void;
  onEdit: (config: GroupConfig) => void;
  onDelete: (config: GroupConfig) => void;
}) {
  const fyStatus = config ? financialYearStatus(config) : null;

  return (
    <MobileSheet visible={Boolean(config)} title={config ? labelForConfig(config) : 'Group configuration'} description="Shares, loans, fines, and financial-year rules." onClose={onClose}>
      {config ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
          <MobileCard compact accent={fyStatus?.tone === 'success' ? 'green' : fyStatus?.tone === 'warning' ? 'orange' : fyStatus?.tone === 'danger' ? 'red' : 'blue'}>
            <View style={styles.detailHeader}>
              <View style={styles.heroIcon}>
                <SlidersHorizontal color="#FFFFFF" size={22} strokeWidth={2.5} />
              </View>
              <View style={styles.flex}>
                <MobileText variant="section" weight="bold" numberOfLines={2}>
                  {labelForConfig(config)}
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  Version {config.version ?? 1} · {fyStatus?.label || 'Financial year not set'}
                </MobileText>
              </View>
              {fyStatus ? <MobileStatusBadge status={fyStatus.key} label={fyStatus.label} tone={fyStatus.tone} /> : null}
            </View>
          </MobileCard>

          <SectionTitle title="Shares and social" />
          <MobileInfoRow label="Share value" value={formatCurrency(toNumber(config.shareValue))} helper={config.sharePurchaseFrequency || 'Frequency not set'} icon={Coins} />
          <MobileInfoRow label="Minimum shares" value={formatNumber(toNumber(config.minShares))} helper="Minimum required shares for members." icon={Users} />
          <MobileInfoRow label="Social amount" value={formatCurrency(toNumber(config.socialAmount))} helper={config.socialFrequency || 'Frequency not set'} icon={Banknote} />

          <SectionTitle title="Loans and penalties" />
          <MobileInfoRow label="Loan multiplier" value={`${formatNumber(toNumber(config.loanMultiplier))}x`} helper="Borrowing limit against member shares." icon={Landmark} />
          <MobileInfoRow label="Interest" value={`${formatNumber(toNumber(config.interestRate))}%`} helper={config.interestType || 'Interest type not set'} icon={Percent} />
          <MobileInfoRow label="Insurance" value={`${formatNumber(toNumber(config.insuranceRate))}%`} helper={config.deductInsuranceOnDisbursement ? 'Deducted on disbursement' : 'Not deducted on disbursement'} icon={ShieldCheck} />
          <MobileInfoRow label="Penalty rate" value={`${formatNumber(toNumber(config.penaltyRate))}%`} helper={`${formatNumber(toNumber(config.loanRepaymentGracePeriodDays))} grace days`} icon={AlertTriangle} />
          <MobileInfoRow label="Default installments" value={formatNumber(toNumber(config.defaultInstallmentCount))} helper="Used when no repayment rule matches." icon={Gavel} />

          <SectionTitle title="Fines" />
          <MobileInfoRow label="Contribution fine" value={fineLabel(config.fineType, config.fineAmount, config.finePercentage)} helper={config.fineType || 'Fine type not set'} icon={Gavel} />
          <MobileInfoRow label="Attendance fine" value={fineLabel(config.attendanceFineType, config.attendanceFineAmount, config.attendanceFinePercentage)} helper={config.attendanceFineFrequency || 'Frequency not set'} icon={Gavel} />

          <SectionTitle title="Financial year" />
          <MobileInfoRow label="Start" value={formatDate(config.financialYearStartDate)} helper="Current financial year start." icon={CalendarDays} />
          <MobileInfoRow label="End" value={formatDate(config.financialYearEndDate)} helper="Current financial year end." icon={CalendarDays} />
          <MobileInfoRow label="Last closed" value={formatDate(config.lastFinancialYearClosedAt)} helper={lastClosedRange(config)} icon={CalendarDays} />

          <SectionTitle title="Dividends" />
          <MobileInfoRow label="Weighting" value={String(config.additionalRules?.['dividends.weighting'] || 'SHARE_COUNT')} helper="Dividend allocation basis." icon={Percent} />
          <MobileInfoRow label="Minimum months" value={formatNumber(toNumber(config.additionalRules?.['dividends.minMonthsSinceJoin']))} helper="Membership age required for dividends." icon={CalendarDays} />

          {config.repaymentRules?.length ? (
            <>
              <SectionTitle title="Repayment rules" />
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
            </>
          ) : null}

          <View style={styles.sheetActions}>
            <MobileButton label="Close" variant="secondary" onPress={onClose} />
            {canManage ? <MobileButton label="Edit" icon={Edit3} size="sm" onPress={() => onEdit(config)} disabled={!config.id} /> : null}
            {canManage ? <MobileButton label="Delete" icon={Trash2} size="sm" variant="danger" onPress={() => onDelete(config)} disabled={!config.id} /> : null}
          </View>
        </ScrollView>
      ) : null}
    </MobileSheet>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <MobileText variant="small" weight="bold" tone="secondary" style={styles.sectionTitle}>
      {title}
    </MobileText>
  );
}

function choosePrimaryConfig(configs: GroupConfig[]) {
  return configs.find((config) => financialYearStatus(config).key === 'active') || configs[0] || null;
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
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
  },
  flex: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sheetContent: {
    gap: 12,
    paddingBottom: 10,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  sectionTitle: {
    textTransform: 'uppercase',
    letterSpacing: 0.35,
    marginTop: 2,
  },
  ruleList: {
    gap: 10,
  },
  sheetActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
});
