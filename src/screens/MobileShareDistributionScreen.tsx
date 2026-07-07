import { router } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import {
  CalendarDays,
  CheckCircle2,
  Info,
  RefreshCw,
  Share2,
  TrendingUp,
  UserRound,
  Users,
  WalletCards,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileAmountInput,
  MobileButton,
  MobileCard,
  MobileCheckboxRow,
  MobileConfirmSheet,
  MobileDataList,
  type MobileDataListItem,
  MobileEmptyState,
  MobileErrorState,
  MobileFormSection,
  MobileIconButton,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileSearchToolbar,
  MobileSelect,
  MobileStatusBadge,
  MobileText,
} from '@/components/mobile';
import {
  getAllAssociationMembers,
  getAssociationGroupConfigs,
  type AssociationMember,
  type GroupConfig,
} from '@/services/member-service';
import { distributeMonthlySharesToWeekly } from '@/services/revenue-transaction-service';
import { useNaneTheme } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatNumber, formatTzs, initialsFromName } from '@/utils/format';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const defaultWeeks = [1, 2, 3, 4];

type SuccessData = {
  memberName: string;
  period: string;
  totalShares: number;
  totalAmount: number;
  selectedWeeks: number[];
  weeklyShares: number[];
  socialTotal: number;
};

export default function MobileShareDistributionScreen() {
  const { activeView, associationId } = useAuth();
  const [members, setMembers] = useState<AssociationMember[]>([]);
  const [configs, setConfigs] = useState<GroupConfig[]>([]);
  const [memberId, setMemberId] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [totalAmount, setTotalAmount] = useState('');
  const [selectedWeeks, setSelectedWeeks] = useState<number[]>(defaultWeeks);
  const [includeSocial, setIncludeSocial] = useState(false);
  const [socialAmountPerWeek, setSocialAmountPerWeek] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<SuccessData | null>(null);

  const loadData = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before loading share distribution.');
        return;
      }

      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const [loadedMembers, loadedConfigs] = await Promise.all([
          getAllAssociationMembers(associationId, { size: 250, sort: 'membershipNumber,asc' }),
          getAssociationGroupConfigs(associationId),
        ]);

        setMembers(loadedMembers.content || []);
        setConfigs(loadedConfigs || []);
        const firstConfig = loadedConfigs?.[0];
        setSocialAmountPerWeek(firstConfig?.socialAmount != null ? String(firstConfig.socialAmount) : '');
      } catch (loadError) {
        setMembers([]);
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
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadData();
    });
    return () => {
      active = false;
    };
  }, [loadData]);

  const groupConfig = configs[0] || null;
  const shareValue = toAmount(groupConfig?.shareValue);
  const socialPerWeek = toAmount(socialAmountPerWeek);
  const numericTotalAmount = toAmount(totalAmount);
  const selectedMonth = Number(month) || new Date().getMonth() + 1;
  const selectedYear = Number(year) || new Date().getFullYear();
  const selectedMember = useMemo(() => members.find((member) => member.id === memberId), [memberId, members]);
  const socialTotal = includeSocial ? socialPerWeek * selectedWeeks.length : 0;
  const amountRemainder = shareValue > 0 && numericTotalAmount > 0 ? numericTotalAmount % shareValue : 0;
  const derivedShares =
    shareValue > 0 && numericTotalAmount > 0 && amountRemainder === 0
      ? Math.floor(numericTotalAmount / shareValue)
      : 0;
  const perWeekShares = useMemo(() => {
    const weeks = selectedWeeks.length || 1;
    const base = Math.floor(derivedShares / weeks);
    const remainder = derivedShares % weeks;
    return selectedWeeks.map((_, index) => base + (index < remainder ? 1 : 0));
  }, [derivedShares, selectedWeeks]);

  const validationMessage = useMemo(() => {
    if (!memberId) return 'Select a member before distributing shares.';
    if (!groupConfig) return 'Share configuration is not available.';
    if (!shareValue || shareValue <= 0) return 'Share value is not configured.';
    if (!numericTotalAmount || numericTotalAmount <= 0) return 'Enter a valid total amount.';
    if (amountRemainder !== 0) return `Amount must be a multiple of ${formatTzs(shareValue)}.`;
    if (!selectedWeeks.length) return 'Select at least one week.';
    if (includeSocial && (!socialPerWeek || socialPerWeek <= 0)) return 'Enter a valid social amount per week.';
    return null;
  }, [amountRemainder, groupConfig, includeSocial, memberId, numericTotalAmount, selectedWeeks.length, shareValue, socialPerWeek]);

  const memberListItems = useMemo<MobileDataListItem[]>(() => {
    const query = memberSearch.trim().toLowerCase();
    return members
      .filter((member) => {
        if (!query) return !memberId || member.id === memberId;
        return [member.fullLegalName, member.membershipNumber, member.contactInfo?.email]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query);
      })
      .slice(0, query ? 8 : 1)
      .map((member) => ({
        id: member.id,
        title: member.fullLegalName || 'Unknown member',
        subtitle: member.membershipNumber || member.contactInfo?.email || 'No membership number',
        meta: member.id === memberId ? 'Selected for distribution' : 'Tap to select this member',
        status: member.id === memberId ? 'Selected' : member.status || 'Available',
        statusTone: member.id === memberId ? 'primary' : 'neutral',
        initials: initialsFromName(member.fullLegalName || member.membershipNumber || 'Member'),
        accent: member.id === memberId ? 'primary' : 'neutral',
      }));
  }, [memberId, memberSearch, members]);

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 10 }, (_, index) => {
      const value = current - 2 + index;
      return { label: String(value), value: String(value) };
    });
  }, []);

  const monthOptions = useMemo(
    () => monthNames.map((label, index) => ({ label, value: String(index + 1) })),
    [],
  );

  const handleSubmit = async () => {
    if (validationMessage || !selectedMember) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      await distributeMonthlySharesToWeekly({
        memberId,
        year: selectedYear,
        month: selectedMonth,
        totalShareCount: derivedShares,
        totalAmount: numericTotalAmount,
        selectedWeeks,
        includeSocial,
        socialAmountPerWeek: includeSocial ? socialPerWeek : undefined,
      });

      setSuccessData({
        memberName: selectedMember.fullLegalName || 'Unknown member',
        period: `${monthNames[selectedMonth - 1]} ${selectedYear}`,
        totalShares: derivedShares,
        totalAmount: numericTotalAmount,
        selectedWeeks: [...selectedWeeks],
        weeklyShares: [...perWeekShares],
        socialTotal,
      });
      setMemberId('');
      setMemberSearch('');
      setTotalAmount('');
      setSelectedWeeks(defaultWeeks);
      setIncludeSocial(false);
    } catch (submitFailure) {
      setSubmitError(getApiErrorMessage(submitFailure));
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  };

  const toggleWeek = (week: number) => {
    setSelectedWeeks((current) =>
      current.includes(week)
        ? current.filter((value) => value !== week)
        : [...current, week].sort((a, b) => a - b),
    );
  };

  if (activeView !== 'ADMIN') {
    return (
      <AccessDeniedScreen
        title="Share distribution"
        description="This native page is available for association admin workspaces only."
      />
    );
  }

  if (loading) {
    return <MobilePageLoadingState kind="form" message="Loading share setup" />;
  }

  if (error && !members.length && !configs.length) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Finance" title="Share distribution" subtitle="Monthly to weekly shares" onBack={() => router.back()} />
        <MobileErrorState title="Share setup could not load" description={error} retryLabel="Retry" onRetry={() => void loadData('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Finance"
        title="Share distribution"
        subtitle="Monthly to weekly shares"
        onBack={() => router.back()}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Refresh share setup"
            variant="secondary"
            disabled={refreshing}
            onPress={() => void loadData('refresh')}
          />
        }
      />

      {error ? <MobileStatusBadge status="Refresh issue" label={error} tone="warning" /> : null}
      {submitError ? <MobileStatusBadge status="Submit issue" label={submitError} tone="danger" /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Members loaded" value={formatNumber(members.length)} description="Available for selection" tone="blue" icon={Users} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Share value" value={formatTzs(shareValue)} description="Configured value per share" tone="teal" icon={Share2} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Derived shares" value={formatNumber(derivedShares)} description={totalAmount ? 'From entered amount' : 'Enter amount to calculate'} tone="green" icon={TrendingUp} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Selected weeks" value={formatNumber(selectedWeeks.length)} description={selectedWeeks.length ? `Weeks ${selectedWeeks.join(', ')}` : 'No weeks selected'} tone="orange" icon={CalendarDays} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileFormSection title="Member and amount" description="Choose a member and enter the monthly share amount.">
        <MobileSearchToolbar value={memberSearch} onChange={setMemberSearch} placeholder="Search members..." />
        {memberListItems.length ? (
          <MobileDataList
            items={memberListItems}
            onPressItem={(item) => {
              setMemberId(item.id);
              setMemberSearch('');
            }}
            showChevron={false}
          />
        ) : (
          <MobileEmptyState title="No matching members" description="Change the search term to find another member." />
        )}
        <MobileAmountInput
          label="Amount"
          value={totalAmount}
          onChangeText={setTotalAmount}
          helperText={shareValue ? `Share value is ${formatTzs(shareValue)}. Derived shares: ${formatNumber(derivedShares)}.` : 'No share value is configured.'}
          error={amountRemainder !== 0 ? `Amount must be a multiple of ${formatTzs(shareValue)}.` : undefined}
        />
      </MobileFormSection>

      <MobileFormSection title="Distribution period" description="Select the exact month and weeks to receive entries.">
        <View style={styles.periodGrid}>
          <MobileSelect label="Year" value={year} options={yearOptions} onChange={setYear} />
          <MobileSelect label="Month" value={month} options={monthOptions} onChange={setMonth} />
        </View>
        <View style={styles.weekGrid}>
          {[1, 2, 3, 4, 5].map((week) => (
            <WeekChip key={week} week={week} selected={selectedWeeks.includes(week)} onPress={() => toggleWeek(week)} />
          ))}
        </View>
        <MobileCheckboxRow
          label="Include social contribution"
          description="Create social contribution entries for each selected week."
          checked={includeSocial}
          onChange={setIncludeSocial}
        />
        {includeSocial ? (
          <MobileAmountInput
            label="Social amount per week"
            value={socialAmountPerWeek}
            onChangeText={setSocialAmountPerWeek}
            helperText={`Total social contribution: ${formatTzs(socialTotal)}`}
            error={includeSocial && socialPerWeek <= 0 ? 'Enter a valid social amount per week.' : undefined}
          />
        ) : null}
      </MobileFormSection>

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold">
              Distribution preview
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Review calculated entries before submitting.
            </MobileText>
          </View>
          <MobileStatusBadge
            status={validationMessage ? 'Pending' : 'Approved'}
            label={validationMessage ? 'Incomplete' : 'Ready'}
            tone={validationMessage ? 'warning' : 'success'}
          />
        </View>

        {selectedMember && totalAmount ? (
          <View style={styles.previewRows}>
            <PreviewRow label="Member" value={selectedMember.fullLegalName || 'Unknown member'} icon={UserRound} />
            <PreviewRow label="Period" value={`${monthNames[selectedMonth - 1]} ${selectedYear}`} icon={CalendarDays} />
            <PreviewRow label="Monthly amount" value={formatTzs(numericTotalAmount)} icon={WalletCards} />
            <PreviewRow label="Total shares" value={formatNumber(derivedShares)} icon={Share2} />
            <PreviewRow label="Weeks" value={selectedWeeks.join(', ') || '-'} icon={CheckCircle2} />
            {includeSocial ? <PreviewRow label="Social total" value={formatTzs(socialTotal)} icon={WalletCards} /> : null}
            <MobileCard compact style={styles.breakdownCard}>
              <MobileText variant="small" weight="bold">
                Per-week shares
              </MobileText>
              {perWeekShares.map((shares, index) => (
                <PreviewLine
                  key={selectedWeeks[index]}
                  label={`Week ${selectedWeeks[index]}`}
                  value={`${formatNumber(shares)} shares`}
                />
              ))}
            </MobileCard>
          </View>
        ) : (
          <MobileEmptyState
            title="Preview unavailable"
            description="Select a member and enter an amount to preview the weekly distribution."
          />
        )}

        {validationMessage ? (
          <View style={styles.validationBox}>
            <Info size={17} color="#C2410C" />
            <MobileText variant="small" weight="bold" style={styles.validationText}>
              {validationMessage}
            </MobileText>
          </View>
        ) : null}

        <MobileButton
          label="Distribute shares"
          icon={Share2}
          fullWidth
          loading={submitting}
          disabled={Boolean(validationMessage)}
          onPress={() => setConfirmOpen(true)}
        />
      </MobileCard>

      {successData ? (
        <MobileCard compact accent="green">
          <View style={styles.sectionHeader}>
            <View style={styles.flex}>
              <MobileText variant="section" weight="bold">
                Distribution complete
              </MobileText>
              <MobileText variant="small" tone="secondary">
                Weekly entries were created for the selected period.
              </MobileText>
            </View>
            <MobileStatusBadge status="Completed" tone="success" />
          </View>
          <View style={styles.previewRows}>
            <PreviewLine label="Member" value={successData.memberName} />
            <PreviewLine label="Period" value={successData.period} />
            <PreviewLine label="Amount" value={formatTzs(successData.totalAmount)} />
            <PreviewLine label="Shares" value={formatNumber(successData.totalShares)} />
            <PreviewLine label="Weekly entries" value={formatNumber(successData.selectedWeeks.length)} />
            {successData.socialTotal > 0 ? <PreviewLine label="Social total" value={formatTzs(successData.socialTotal)} /> : null}
          </View>
          <MobileButton label="Close result" variant="secondary" fullWidth onPress={() => setSuccessData(null)} />
        </MobileCard>
      ) : null}

      <MobileFormSection title="How it works" description="The system converts one monthly amount into weekly paid entries.">
        <GuidanceRow text="Select a member and enter an amount that matches the configured share value." />
        <GuidanceRow text="Choose the weeks that should receive the generated share entries." />
        <GuidanceRow text="Confirm once to create the weekly share records and optional social contribution entries." />
      </MobileFormSection>

      <MobileConfirmSheet
        visible={confirmOpen}
        title="Distribute shares?"
        description={`This will create ${formatNumber(selectedWeeks.length)} weekly share entries for ${selectedMember?.fullLegalName || 'the selected member'} in ${monthNames[selectedMonth - 1]} ${selectedYear}.`}
        confirmLabel="Distribute"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void handleSubmit()}
      />
    </MobileScreen>
  );
}

function WeekChip({ week, selected, onPress }: { week: number; selected: boolean; onPress: () => void }) {
  const theme = useNaneTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.weekChip,
        {
          backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <MobileText variant="small" weight="bold" style={{ color: selected ? theme.colors.onPrimary : theme.colors.text }}>
        Week {week}
      </MobileText>
    </Pressable>
  );
}

function PreviewRow({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  const theme = useNaneTheme();
  return (
    <View style={styles.previewRow}>
      <View style={[styles.previewIcon, { backgroundColor: theme.colors.primary }]}>
        <Icon color={theme.colors.onPrimary} size={16} strokeWidth={2.4} />
      </View>
      <View style={styles.flex}>
        <MobileText variant="small" tone="secondary">
          {label}
        </MobileText>
        <MobileText variant="body" weight="bold">
          {value}
        </MobileText>
      </View>
    </View>
  );
}

function PreviewLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.previewLine}>
      <MobileText variant="small" tone="secondary">
        {label}
      </MobileText>
      <MobileText variant="small" weight="bold" style={styles.previewLineValue}>
        {value}
      </MobileText>
    </View>
  );
}

function GuidanceRow({ text }: { text: string }) {
  return (
    <View style={styles.guidanceRow}>
      <CheckCircle2 color="#15803D" size={17} strokeWidth={2.4} />
      <MobileText variant="small" tone="secondary" style={styles.flex}>
        {text}
      </MobileText>
    </View>
  );
}

function toAmount(value: unknown) {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

const styles = StyleSheet.create({
  periodGrid: {
    gap: 12,
  },
  weekGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  weekChip: {
    minHeight: 38,
    minWidth: 88,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
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
  previewRows: {
    gap: 10,
  },
  previewRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  previewIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewLine: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  previewLineValue: {
    flexShrink: 1,
    textAlign: 'right',
  },
  breakdownCard: {
    shadowOpacity: 0.015,
  },
  validationBox: {
    marginTop: 12,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDBA74',
    backgroundColor: '#FFF7ED',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  validationText: {
    color: '#C2410C',
    flex: 1,
  },
  guidanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
});
