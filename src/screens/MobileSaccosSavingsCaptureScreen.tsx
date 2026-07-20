import { router } from 'expo-router';
import { CalendarDays, CheckCircle2, PiggyBank, RefreshCw, Save, Users } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { isSaccosAssociation } from '@/auth/association-type';
import {
  MobileAmountInput,
  MobileButton,
  MobileCard,
  MobileConfirmSheet,
  MobileEmptyState,
  MobileErrorState,
  MobileIconButton,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileSearchToolbar,
  MobileStatusBadge,
  MobileSummaryPanel,
  MobileText,
  MobileTextInput,
  MobileToast,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import { getAllAssociationMembers, type AssociationMember } from '@/services/member-service';
import { createBulkRevenueTransactions } from '@/services/revenue-transaction-service';
import { getApiErrorMessage } from '@/types/api';
import { formatNumber, formatTzs } from '@/utils/format';

const MAX_VISIBLE_MEMBERS = 60;

export default function MobileSaccosSavingsCaptureScreen() {
  const { activeView, associationId, user } = useAuth();
  const [members, setMembers] = useState<AssociationMember[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [transactionDate, setTransactionDate] = useState(today());
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const ledgerRoute = getRouteByPath('/associations/revenue-transactions');

  const loadMembers = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!associationId) {
      setLoading(false);
      return;
    }
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const page = await getAllAssociationMembers(associationId, { size: 250, sort: 'membershipNumber,asc' });
      setMembers((page.content || []).filter((member) => Boolean(member.id)));
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [associationId]);

  useEffect(() => {
    void Promise.resolve().then(() => loadMembers());
  }, [loadMembers]);

  const visibleMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return members
      .filter((member) => !query || [member.fullLegalName, member.membershipNumber, member.contactInfo?.email, member.contactInfo?.phoneNumber]
        .filter(Boolean).join(' ').toLowerCase().includes(query))
      .slice(0, MAX_VISIBLE_MEMBERS);
  }, [members, search]);

  const prepared = useMemo(() => members
    .map((member) => ({ member, amount: toAmount(amounts[member.id] || '') }))
    .filter((row) => row.amount > 0), [amounts, members]);
  const total = prepared.reduce((sum, row) => sum + row.amount, 0);
  const dateError = !isIsoDate(transactionDate)
    ? 'Transaction date must use YYYY-MM-DD.'
    : dueDate && !isIsoDate(dueDate)
      ? 'Due date must use YYYY-MM-DD.'
      : null;

  const submit = async () => {
    if (!associationId || !prepared.length || dateError) return;
    setConfirmOpen(false);
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await createBulkRevenueTransactions(prepared.map(({ member, amount }) => ({
        memberId: member.id,
        paymentDetails: { SAVINGS: amount },
        paymentStatus: 'PAID',
        transactionDate: `${transactionDate}T00:00:00`,
        dueDate: dueDate ? `${dueDate}T00:00:00` : undefined,
        description: 'SACCOS savings contribution',
      })));
      setNotice(`${prepared.length} paid savings record${prepared.length === 1 ? '' : 's'} created successfully.`);
      setAmounts({});
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Capture Savings" description="Savings capture is available in association admin workspaces only." />;
  }
  if (!isSaccosAssociation(user?.associationType)) {
    return <AccessDeniedScreen title="Capture Savings" description="Savings are a separate SACCOS ledger and are not a VIKOBA share contribution." />;
  }
  if (loading && !members.length) return <MobilePageLoadingState kind="form" message="Loading SACCOS members" />;
  if (!associationId) return <AccessDeniedScreen title="Capture Savings" description="Select an association before recording savings." />;

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo eyebrow="SACCOS finance" title="Capture Savings"
        subtitle="Monthly savings are separate from equity shares and never include socials."
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh members" variant="secondary" disabled={refreshing || submitting} onPress={() => void loadMembers('refresh')} />}
      />
      {error ? <MobileErrorState title="Savings issue" description={error} retryLabel="Reload members" onRetry={() => void loadMembers('refresh')} /> : null}
      {notice ? <MobileToast title="Savings recorded" description={notice} tone="success" /> : null}

      <MobileSummaryPanel title="Savings batch" value={formatTzs(total)} description={`${formatNumber(prepared.length)} member(s) with a positive amount`} tone={total > 0 ? 'green' : 'slate'} icon={PiggyBank} />

      <MobileCard compact>
        <View style={styles.dateGrid}>
          <MobileTextInput label="Transaction date *" value={transactionDate} onChangeText={setTransactionDate} placeholder="YYYY-MM-DD" helperText="Date recorded for every saving" icon={CalendarDays} error={!isIsoDate(transactionDate) ? 'Use YYYY-MM-DD' : undefined} disabled={submitting} />
          <MobileTextInput label="Due date" value={dueDate} onChangeText={setDueDate} placeholder="Optional YYYY-MM-DD" helperText="Optional deadline" icon={CalendarDays} error={dueDate && !isIsoDate(dueDate) ? 'Use YYYY-MM-DD' : undefined} disabled={submitting} />
        </View>
      </MobileCard>

      <MobileSearchToolbar value={search} onChange={setSearch} placeholder="Search member, number, phone or email..." />
      <MobileStatusBadge status="Members" label={`${visibleMembers.length} shown of ${members.length}`} tone="info" />

      {visibleMembers.length ? (
        <View style={styles.memberList}>
          {visibleMembers.map((member) => (
            <MobileCard key={member.id} compact>
              <View style={styles.memberHeader}>
                <View style={styles.flex}>
                  <MobileText variant="body" weight="bold">{member.fullLegalName || 'Unnamed member'}</MobileText>
                  <MobileText variant="small" tone="secondary">{member.membershipNumber || member.contactInfo?.phoneNumber || 'No membership number'}</MobileText>
                </View>
                {toAmount(amounts[member.id] || '') > 0 ? <CheckCircle2 color="#16A34A" size={20} /> : <Users color="#64748B" size={20} />}
              </View>
              <MobileAmountInput
                label="Savings amount"
                value={amounts[member.id] || ''}
                onChangeText={(value) => setAmounts((current) => ({ ...current, [member.id]: value }))}
                helperText="Any positive amount; no share-value multiple and no social."
                disabled={submitting}
              />
            </MobileCard>
          ))}
        </View>
      ) : <MobileEmptyState title="No members found" description="Change the search or refresh the member register." />}

      <View style={styles.actions}>
        {ledgerRoute ? <MobileButton label="View ledger" variant="secondary" onPress={() => router.push({ pathname: '/work/route-preview', params: { routeId: ledgerRoute.id } } as never)} /> : null}
        <MobileButton label={`Review ${prepared.length} saving${prepared.length === 1 ? '' : 's'}`} icon={Save} fullWidth style={styles.flex} disabled={Boolean(dateError) || !prepared.length || submitting} loading={submitting} onPress={() => setConfirmOpen(true)} />
      </View>

      <MobileConfirmSheet visible={confirmOpen} title="Record paid savings?" description={`${prepared.length} member record(s), totaling ${formatTzs(total)}, will be posted as PAID savings. This does not create shares or socials.`} confirmLabel="Record paid savings" onCancel={() => setConfirmOpen(false)} onConfirm={() => void submit()} />
    </MobileScreen>
  );
}

function toAmount(value: string) {
  const amount = Number(String(value || '').replace(/[^\d.]/g, ''));
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function today() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  dateGrid: { gap: 12 },
  flex: { flex: 1 },
  memberHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  memberList: { gap: 10 },
});
