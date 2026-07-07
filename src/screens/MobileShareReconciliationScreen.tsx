import { router } from 'expo-router';
import {
  ArrowDownUp,
  Calculator,
  CheckCircle2,
  Database,
  Eye,
  Lock,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileConfirmSheet,
  MobileDataList,
  type MobileDataListItem,
  MobileEmptyState,
  MobileErrorState,
  MobileIconButton,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobileReportExportButton,
  MobileScreen,
  MobileSearchToolbar,
  MobileSortSheet,
  MobileStatusBadge,
  MobileText,
} from '@/components/mobile';
import {
  applyShareReconciliation,
  previewShareReconciliation,
  type ShareReconciliationResult,
} from '@/services/revenue-transaction-service';
import { getApiErrorMessage } from '@/types/api';
import { formatNumber, formatTzs, initialsFromName } from '@/utils/format';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';

type PageState = 'idle' | 'previewing' | 'previewed' | 'applying' | 'applied';
type ResultStage = 'preview' | 'applied';
type SortKey = 'member_asc' | 'shares_desc' | 'value_desc' | 'purchases_desc' | 'deductions_desc';

type ReconciliationRow = {
  memberId: string;
  name: string;
  membershipNo: string;
  shareBefore: number;
  shareAfter: number;
  valueBefore: number;
  valueAfter: number;
  purchases: number;
  deductions: number;
  reversals: number;
  detail: string;
  searchText: string;
};

const sortOptions = [
  { label: 'Member name', value: 'member_asc', description: 'Alphabetical member order.' },
  { label: 'Largest share movement', value: 'shares_desc', description: 'Biggest share-count delta first.' },
  { label: 'Largest value movement', value: 'value_desc', description: 'Biggest value delta first.' },
  { label: 'Highest purchases', value: 'purchases_desc', description: 'Largest paid share-purchase totals first.' },
  { label: 'Highest deductions', value: 'deductions_desc', description: 'Largest deduction totals first.' },
];

export default function MobileShareReconciliationScreen() {
  const { activeView, associationId, user } = useAuth();
  const [state, setState] = useState<PageState>('idle');
  const [previewData, setPreviewData] = useState<ShareReconciliationResult | null>(null);
  const [appliedData, setAppliedData] = useState<ShareReconciliationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('member_asc');
  const [sortOpen, setSortOpen] = useState(false);
  const [lastExport, setLastExport] = useState<string | null>(null);

  const previewRows = useMemo(() => buildRows(previewData), [previewData]);
  const appliedRows = useMemo(() => buildRows(appliedData), [appliedData]);
  const activeRows = state === 'applied' ? appliedRows : previewRows;
  const stage: ResultStage = state === 'applied' ? 'applied' : 'preview';
  const isLoading = state === 'previewing' || state === 'applying';
  const meta = stateMeta(state);
  const correctionValue = activeRows.reduce((sum, row) => sum + Math.abs(row.valueAfter - row.valueBefore), 0);
  const correctionShares = activeRows.reduce((sum, row) => sum + Math.abs(row.shareAfter - row.shareBefore), 0);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = query ? activeRows.filter((row) => row.searchText.includes(query)) : activeRows;
    return sortRows(filtered, sortBy);
  }, [activeRows, search, sortBy]);

  const listItems = useMemo<MobileDataListItem[]>(
    () =>
      visibleRows.map((row) => ({
        id: row.memberId,
        title: row.name,
        subtitle: row.membershipNo,
        meta: `Shares ${formatNumber(row.shareBefore)} -> ${formatNumber(row.shareAfter)} · Value ${formatTzs(row.valueBefore)} -> ${formatTzs(row.valueAfter)}`,
        amount: formatTzs(Math.abs(row.valueAfter - row.valueBefore)),
        status: stage === 'applied' ? 'Corrected' : 'Needs correction',
        statusTone: stage === 'applied' ? 'success' : 'warning',
        initials: initialsFromName(row.name),
        accent: stage === 'applied' ? 'success' : 'warning',
      })),
    [stage, visibleRows],
  );

  const reconciliationReportOptions = useMemo(
    () => ({
      title: stage === 'applied' ? 'Applied Share Reconciliation' : 'Share Reconciliation Preview',
      associationName: user?.associationName || 'Association',
      purpose:
        stage === 'applied'
          ? 'A report of share balance corrections applied from paid transaction history.'
          : 'A preview report of proposed share balance corrections before applying changes.',
      rows: visibleRows,
      fileName: `nane-share-reconciliation-${stage}`,
      metadata: [
        { label: 'Stage', value: stage === 'applied' ? 'Applied corrections' : 'Preview results' },
        { label: 'Workflow status', value: meta.label },
      ],
      metrics: [
        { label: 'Preview corrections', value: formatNumber(previewRows.length), helper: 'Members that need correction' },
        { label: 'Applied corrections', value: formatNumber(appliedRows.length), helper: 'Members updated in this run' },
        { label: 'Value delta', value: formatTzs(correctionValue), helper: `${formatNumber(correctionShares)} share count movement` },
        { label: 'Visible rows', value: formatNumber(visibleRows.length), helper: `${formatNumber(activeRows.length)} total rows` },
      ],
      filters: [
        { label: 'Search', value: search || 'All' },
        { label: 'Sort', value: sortOptions.find((option) => option.value === sortBy)?.label || sortBy },
      ],
      columns: [
        { key: 'number', label: '#', align: 'center' as const, width: '5%', value: (_row: ReconciliationRow, index: number) => index + 1 },
        { key: 'member', label: 'Member', width: '18%', value: (row: ReconciliationRow) => row.name },
        { key: 'membershipNo', label: 'Membership No.', width: '12%', value: (row: ReconciliationRow) => row.membershipNo || '-' },
        { key: 'shareBefore', label: 'Shares Before', align: 'right' as const, width: '12%', value: (row: ReconciliationRow) => formatNumber(row.shareBefore) },
        { key: 'shareAfter', label: 'Shares After', align: 'right' as const, width: '12%', value: (row: ReconciliationRow) => formatNumber(row.shareAfter) },
        { key: 'valueBefore', label: 'Value Before', align: 'right' as const, width: '12%', value: (row: ReconciliationRow) => formatTzs(row.valueBefore) },
        { key: 'valueAfter', label: 'Value After', align: 'right' as const, width: '12%', value: (row: ReconciliationRow) => formatTzs(row.valueAfter) },
        { key: 'purchases', label: 'Paid Purchases', align: 'right' as const, width: '12%', value: (row: ReconciliationRow) => formatTzs(row.purchases) },
        { key: 'deductions', label: 'Loan Deductions', align: 'right' as const, width: '12%', value: (row: ReconciliationRow) => formatTzs(row.deductions) },
        { key: 'reversals', label: 'Reversals', align: 'right' as const, width: '10%', value: (row: ReconciliationRow) => formatTzs(row.reversals) },
      ],
    }),
    [activeRows.length, appliedRows.length, correctionShares, correctionValue, meta.label, previewRows.length, search, sortBy, stage, user?.associationName, visibleRows],
  );

  const resetWorkflow = useCallback(() => {
    setState('idle');
    setPreviewData(null);
    setAppliedData(null);
    setError(null);
    setConfirmOpen(false);
    setSearch('');
    setLastExport(null);
  }, []);

  const runPreview = useCallback(async () => {
    if (!associationId) return;
    setState('previewing');
    setPreviewData(null);
    setAppliedData(null);
    setError(null);
    setLastExport(null);
    try {
      const data = await previewShareReconciliation(associationId);
      setPreviewData(data || {});
      setState('previewed');
    } catch (previewError) {
      setState('idle');
      setError(getApiErrorMessage(previewError));
    }
  }, [associationId]);

  const runApply = async () => {
    if (!associationId) return;
    setConfirmOpen(false);
    setState('applying');
    setError(null);
    try {
      const data = await applyShareReconciliation(associationId);
      setAppliedData(data || {});
      setPreviewData(null);
      setState('applied');
    } catch (applyError) {
      setState('previewed');
      setError(getApiErrorMessage(applyError));
    }
  };

  if (activeView !== 'ADMIN') {
    return (
      <AccessDeniedScreen
        title="Share reconciliation"
        description="This native page is available for association admin workspaces only."
      />
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Finance"
        title="Share reconciliation"
        subtitle="Preview and fix share balance drift"
        onBack={() => router.back()}
        rightAction={
          state === 'applied' ? (
            <MobileIconButton icon={RefreshCw} label="Run reconciliation again" variant="secondary" onPress={resetWorkflow} />
          ) : (
            <MobileIconButton icon={Eye} label="Preview changes" variant="secondary" disabled={isLoading || !associationId} onPress={() => void runPreview()} />
          )
        }
      />

      {error ? <MobileErrorState title="Reconciliation issue" description={error} retryLabel="Preview again" onRetry={() => void runPreview()} /> : null}
      {lastExport ? <MobileStatusBadge status="Completed" label={`Exported ${lastExport}`} tone="success" /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Workflow status" value={meta.label} description={associationId ? 'Association context active' : 'Missing association context'} tone={meta.tone} icon={ShieldCheck} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Preview corrections" value={formatNumber(previewRows.length)} description="Members that need correction" tone={previewRows.length ? 'orange' : 'blue'} icon={Eye} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Applied corrections" value={formatNumber(appliedRows.length)} description="Members updated in this run" tone={appliedRows.length ? 'green' : 'teal'} icon={CheckCircle2} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Value delta" value={formatTzs(correctionValue)} description={`${formatNumber(correctionShares)} share count movement`} tone={correctionValue ? 'orange' : 'green'} icon={Calculator} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold">
              Preview changes
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Scan paid transactions before applying any correction.
            </MobileText>
          </View>
          <MobileStatusBadge status={meta.status} label={meta.label} tone={meta.badgeTone} />
        </View>
        <MobileText variant="small" tone="secondary">
          Correct balance = paid share purchases - paid share deductions + paid share reversals. Pending, overdue, failed, and cancelled transactions are ignored.
        </MobileText>
        <View style={styles.actions}>
          <MobileButton label={state === 'previewing' ? 'Scanning' : 'Preview changes'} icon={Eye} loading={state === 'previewing'} disabled={isLoading || !associationId} onPress={() => void runPreview()} style={styles.actionButton} />
          {state !== 'idle' ? <MobileButton label="Reset" variant="secondary" disabled={isLoading} onPress={resetWorkflow} style={styles.actionButton} /> : null}
        </View>
      </MobileCard>

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold">
              Safety guarantees
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Correct derived balances without changing ledger transactions.
            </MobileText>
          </View>
          <MobileStatusBadge status="Approved" label="Safe workflow" tone="success" />
        </View>
        <SafetyRow icon={Lock} title="Transactions are never touched" description="Revenue transaction records stay exactly as they are." />
        <SafetyRow icon={Database} title="Only counters change" description="Stored share count and total value are corrected from paid transaction history." />
        <SafetyRow icon={Eye} title="Preview before applying" description="The first step is read-only so every correction can be inspected first." />
      </MobileCard>

      {isLoading ? (
        <MobileCard compact>
          <MobileText variant="section" weight="bold">
            {state === 'previewing' ? 'Scanning paid transactions' : 'Applying corrections'}
          </MobileText>
          <MobileText variant="small" tone="secondary">
            This may take a moment for associations with many members.
          </MobileText>
        </MobileCard>
      ) : null}

      {(state === 'previewed' || state === 'applied') ? (
        <MobileCard compact>
          <View style={styles.sectionHeader}>
            <View style={styles.flex}>
              <MobileText variant="section" weight="bold">
                {state === 'applied' ? 'Applied corrections' : 'Preview results'}
              </MobileText>
              <MobileText variant="small" tone="secondary">
                {formatNumber(visibleRows.length)} of {formatNumber(activeRows.length)} records
              </MobileText>
            </View>
            <MobileStatusBadge
              status={activeRows.length ? (state === 'applied' ? 'Completed' : 'Pending') : 'Completed'}
              label={activeRows.length ? `${formatNumber(activeRows.length)} rows` : 'Nothing to fix'}
              tone={state === 'applied' || activeRows.length === 0 ? 'success' : 'warning'}
            />
          </View>

          {activeRows.length ? (
            <>
              <MobileSearchToolbar value={search} onChange={setSearch} placeholder="Search members..." />
              <View style={styles.headerActions}>
                <MobileButton label="Sort" icon={ArrowDownUp} variant="secondary" onPress={() => setSortOpen(true)} style={styles.actionButton} />
                <MobileReportExportButton options={reconciliationReportOptions} variant="secondary" onSuccess={(_uri, format) => setLastExport(`${format.toUpperCase()} report prepared`)} onError={(exportError) => setError(getApiErrorMessage(exportError))} />
              </View>
              <MobileDataList items={listItems} showChevron={false} />
              {state === 'previewed' ? (
                <MobileButton
                  label={`Apply ${formatNumber(activeRows.length)} correction${activeRows.length === 1 ? '' : 's'}`}
                  icon={ShieldCheck}
                  fullWidth
                  onPress={() => setConfirmOpen(true)}
                />
              ) : null}
            </>
          ) : (
            <MobileEmptyState
              title="All share balances are correct"
              description={state === 'previewed' ? 'No changes would be needed.' : 'No changes were needed.'}
            />
          )}
        </MobileCard>
      ) : null}

      <MobileSortSheet
        visible={sortOpen}
        value={sortBy}
        options={sortOptions}
        onChange={(value) => setSortBy(value as SortKey)}
        onClose={() => setSortOpen(false)}
      />

      <MobileConfirmSheet
        visible={confirmOpen}
        title={`Apply ${formatNumber(previewRows.length)} correction${previewRows.length === 1 ? '' : 's'}?`}
        description="This updates only stored share counters. Revenue transactions are not modified, deleted, or created."
        confirmLabel="Apply corrections"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void runApply()}
      />
    </MobileScreen>
  );
}

function SafetyRow({ icon: Icon, title, description }: { icon: typeof Lock; title: string; description: string }) {
  return (
    <View style={styles.safetyRow}>
      <Icon color="#15803D" size={18} strokeWidth={2.4} />
      <View style={styles.flex}>
        <MobileText variant="small" weight="bold">
          {title}
        </MobileText>
        <MobileText variant="small" tone="secondary">
          {description}
        </MobileText>
      </View>
    </View>
  );
}

function stateMeta(state: PageState) {
  if (state === 'previewing') return { label: 'Scanning', status: 'Processing', tone: 'blue' as const, badgeTone: 'info' as const };
  if (state === 'previewed') return { label: 'Preview ready', status: 'Pending', tone: 'orange' as const, badgeTone: 'warning' as const };
  if (state === 'applying') return { label: 'Applying', status: 'Processing', tone: 'blue' as const, badgeTone: 'info' as const };
  if (state === 'applied') return { label: 'Applied', status: 'Completed', tone: 'green' as const, badgeTone: 'success' as const };
  return { label: 'Ready', status: 'Draft', tone: 'slate' as const, badgeTone: 'neutral' as const };
}

function buildRows(data: ShareReconciliationResult | null): ReconciliationRow[] {
  return Object.entries(data ?? {}).map(([memberId, detail]) => parseDetail(memberId, detail));
}

function parseDetail(memberId: string, detail: string): ReconciliationRow {
  const nameMatch = detail.match(/^Member (.+?) \((.+?)\):/);
  const shareMatch = detail.match(/shareCount ([\d.]+) -> ([\d.]+)/);
  const valueMatch = detail.match(/totalValue ([\d.]+) -> ([\d.]+)/);
  const purchasesMatch = detail.match(/purchases=([\d.]+)/);
  const deductionsMatch = detail.match(/deductions=([\d.]+)/);
  const reversalsMatch = detail.match(/reversals=([\d.]+)/);
  const row = {
    memberId,
    name: nameMatch?.[1] ?? 'Unknown member',
    membershipNo: nameMatch?.[2] ?? '-',
    shareBefore: toNumber(shareMatch?.[1]),
    shareAfter: toNumber(shareMatch?.[2]),
    valueBefore: toNumber(valueMatch?.[1]),
    valueAfter: toNumber(valueMatch?.[2]),
    purchases: toNumber(purchasesMatch?.[1]),
    deductions: toNumber(deductionsMatch?.[1]),
    reversals: toNumber(reversalsMatch?.[1]),
    detail,
  };
  return {
    ...row,
    searchText: `${row.name} ${row.membershipNo} ${row.memberId} ${row.detail}`.toLowerCase(),
  };
}

function sortRows(rows: ReconciliationRow[], sortBy: SortKey) {
  return [...rows].sort((a, b) => {
    if (sortBy === 'member_asc') return a.name.localeCompare(b.name);
    if (sortBy === 'shares_desc') return Math.abs(b.shareAfter - b.shareBefore) - Math.abs(a.shareAfter - a.shareBefore);
    if (sortBy === 'value_desc') return Math.abs(b.valueAfter - b.valueBefore) - Math.abs(a.valueAfter - a.valueBefore);
    if (sortBy === 'purchases_desc') return b.purchases - a.purchases;
    if (sortBy === 'deductions_desc') return b.deductions - a.deductions;
    return 0;
  });
}

function toNumber(value?: string | null) {
  const parsed = Number.parseFloat(String(value ?? '0'));
  return Number.isFinite(parsed) ? parsed : 0;
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  safetyRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  actionButton: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
});
