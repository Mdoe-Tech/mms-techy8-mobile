import { router } from 'expo-router';
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, RefreshCw, User, WalletCards } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileEmptyState,
  MobileFormSection,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobileLoadingState,
  MobilePageHeader,
  MobileScreen,
  MobileSearchToolbar,
  MobileStatusBadge,
  MobileText,
  MobileTextInput,
} from '@/components/mobile';
import { getAllAssociationMembers, type AssociationMember } from '@/services/member-service';
import {
  getMemberContributionCalendar,
  type RevenueCalendarTransaction,
  type RevenueCalendarWeek,
  type RevenueContributionCalendar,
} from '@/services/revenue-transaction-service';
import { useNaneTheme } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatNumber, formatTzs } from '@/utils/format';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';

const MONTH_NAMES = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
];

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MEMBER_LOAD_COUNT = 6;
const DEFAULT_DATE = new Date();
const DEFAULT_YEAR = DEFAULT_DATE.getFullYear();
const DEFAULT_MONTH = DEFAULT_DATE.getMonth();

type CalendarDay = {
  day: number;
  active: boolean;
};

type DayContribution = {
  transactions: RevenueCalendarTransaction[];
  totalAmount: number;
  details: Record<string, number>;
};

type MonthAggregate = {
  totalSocialContribution: number;
  totalSharePurchase: number;
  totalDisbursement: number;
  totalLoanRepayment: number;
  totalFine: number;
  totalPenalty: number;
  transactions: RevenueCalendarTransaction[];
};

export default function MobileRevenueTransactionCalendarScreen() {
  const { activeView, associationId } = useAuth();
  const theme = useNaneTheme();
  const [members, setMembers] = useState<AssociationMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberVisibleCount, setMemberVisibleCount] = useState(MEMBER_LOAD_COUNT);
  const [calendarYear, setCalendarYear] = useState(String(DEFAULT_YEAR));
  const [selectedMonth, setSelectedMonth] = useState(DEFAULT_MONTH);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [calendarData, setCalendarData] = useState<RevenueContributionCalendar | null>(null);
  const [membersLoading, setMembersLoading] = useState(true);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadMembers() {
      if (!associationId) {
        if (active) {
          setError('Association context is required before opening the contribution calendar.');
          setMembersLoading(false);
        }
        return;
      }

      try {
        const response = await getAllAssociationMembers(associationId, { size: 250 });
        if (!active) return;
        const loadedMembers = response.content || [];
        setMembers(loadedMembers);
        setSelectedMemberId(loadedMembers[0]?.id || null);
      } catch (loadError) {
        if (active) {
          setError(getApiErrorMessage(loadError));
        }
      } finally {
        if (active) {
          setMembersLoading(false);
        }
      }
    }

    void loadMembers();
    return () => {
      active = false;
    };
  }, [associationId]);

  useEffect(() => {
    let active = true;
    const numericYear = Number(calendarYear);

    async function loadCalendar() {
      if (!selectedMemberId || !Number.isFinite(numericYear)) return;
      setCalendarLoading(true);
      setError(null);

      try {
        const response = await getMemberContributionCalendar(selectedMemberId, numericYear);
        if (!active) return;
        setCalendarData(response || null);
        setSelectedDay(null);
      } catch (loadError) {
        if (active) {
          setCalendarData(null);
          setError(getApiErrorMessage(loadError));
        }
      } finally {
        if (active) {
          setCalendarLoading(false);
        }
      }
    }

    void loadCalendar();
    return () => {
      active = false;
    };
  }, [calendarYear, refreshNonce, selectedMemberId]);

  const selectedMember = useMemo(() => members.find((member) => member.id === selectedMemberId) || null, [members, selectedMemberId]);
  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    return members.filter((member) => {
      if (!query) return true;
      return (
        String(member.fullLegalName || '').toLowerCase().includes(query) ||
        String(member.membershipNumber || '').toLowerCase().includes(query) ||
        String(member.contactInfo?.email || '').toLowerCase().includes(query)
      );
    });
  }, [memberSearch, members]);

  const monthName = MONTH_NAMES[selectedMonth];
  const effectiveYear = Number(calendarYear) || DEFAULT_YEAR;
  const monthLabel = new Date(effectiveYear, selectedMonth).toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });
  const monthWeeks = useMemo(() => calendarData?.calendarData?.[monthName] || {}, [calendarData, monthName]);
  const monthData = useMemo(() => aggregateMonth(monthWeeks), [monthWeeks]);
  const monthPaid = monthData.totalSocialContribution + monthData.totalSharePurchase + monthData.totalLoanRepayment + monthData.totalDisbursement;
  const monthOutstanding = monthData.totalFine + monthData.totalPenalty;
  const calendarDays = useMemo(() => buildCalendarDays(effectiveYear, selectedMonth), [effectiveYear, selectedMonth]);
  const selectedDayDetails = selectedDay ? getDayContribution(monthData.transactions, selectedDay, selectedMonth, effectiveYear) : null;
  const weeklyRows = useMemo(() => buildWeeklyRows(monthWeeks), [monthWeeks]);

  const previousMonth = () => {
    setSelectedDay(null);
    setSelectedMonth((current) => {
      if (current === 0) {
        setCalendarYear((year) => String(Number(year || DEFAULT_YEAR) - 1));
        return 11;
      }
      return current - 1;
    });
  };

  const nextMonth = () => {
    setSelectedDay(null);
    setSelectedMonth((current) => {
      if (current === 11) {
        setCalendarYear((year) => String(Number(year || DEFAULT_YEAR) + 1));
        return 0;
      }
      return current + 1;
    });
  };

  if (activeView !== 'ADMIN') {
    return (
      <AccessDeniedScreen
        title="Contribution calendar"
        description="This native page is available for association admin workspaces only."
      />
    );
  }

  if (membersLoading) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Finance" title="Contribution calendar" subtitle="Loading members" onBack={() => router.back()} />
        <MobileLoadingState />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader showLogo eyebrow="Finance" title="Contribution calendar" subtitle="Member activity by month" onBack={() => router.back()} />

      {error ? <MobileStatusBadge status="Calendar issue" label={error} tone="danger" /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Members" value={formatNumber(members.length)} description="Available in selector" tone="blue" icon={User} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Month paid" value={formatTzs(monthPaid)} description={monthLabel} tone="green" icon={WalletCards} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Total shares" value={formatNumber(toNumber(calendarData?.totalShares))} description={formatTzs(toNumber(calendarData?.totalShareValue))} tone="teal" icon={WalletCards} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Fines / penalties" value={formatTzs(monthOutstanding)} description={monthOutstanding > 0 ? 'Outstanding this month' : 'No outstanding amount'} tone={monthOutstanding > 0 ? 'red' : 'slate'} icon={AlertCircle} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileFormSection title="Member & year" description="Choose whose contribution calendar should be shown.">
        <MobileSearchToolbar
          value={memberSearch}
          onChange={(value) => {
            setMemberSearch(value);
            setMemberVisibleCount(MEMBER_LOAD_COUNT);
          }}
          placeholder="Search members..."
        />
        <View style={styles.memberList}>
          {filteredMembers.slice(0, memberVisibleCount).map((member) => {
            const selected = member.id === selectedMemberId;
            return (
              <Pressable
                key={member.id}
                onPress={() => {
                  setSelectedMemberId(member.id);
                  setSelectedDay(null);
                }}
                style={({ pressed }) => [
                  styles.memberRow,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: selected ? theme.colors.primary : theme.colors.border,
                    opacity: pressed ? 0.82 : 1,
                  },
                ]}
              >
                <View style={styles.flex}>
                  <MobileText variant="small" weight="bold" numberOfLines={1}>
                    {member.fullLegalName || member.membershipNumber || 'Unknown member'}
                  </MobileText>
                  <MobileText variant="small" tone="secondary" numberOfLines={1}>
                    {member.contactInfo?.email || 'No email'}
                  </MobileText>
                </View>
                <MobileStatusBadge status={selected ? 'Selected' : member.status || 'Active'} label={selected ? 'Selected' : member.status || 'Ready'} tone={selected ? 'primary' : undefined} />
              </Pressable>
            );
          })}
        </View>
        {memberVisibleCount < filteredMembers.length ? <MobileButton label="Load more members" variant="secondary" fullWidth onPress={() => setMemberVisibleCount((current) => current + MEMBER_LOAD_COUNT)} /> : null}
        <MobileTextInput label="Year" value={calendarYear} onChangeText={setCalendarYear} placeholder="YYYY" icon={CalendarDays} keyboardType="number-pad" />
        <MobileButton label="Refresh calendar" icon={RefreshCw} loading={calendarLoading} disabled={!selectedMemberId || calendarLoading} fullWidth onPress={() => setRefreshNonce((current) => current + 1)} />
      </MobileFormSection>

      <MobileFormSection title={monthLabel} description="Contribution days are highlighted. Select a day to inspect details.">
        <View style={styles.actionRow}>
          <MobileButton label="Previous" icon={ChevronLeft} variant="secondary" onPress={previousMonth} style={styles.flexButton} />
          <MobileButton label="Next" icon={ChevronRight} variant="secondary" onPress={nextMonth} style={styles.flexButton} />
        </View>

        {calendarLoading ? <MobileLoadingState compact message="Loading calendar" /> : null}

        {!calendarLoading && selectedMemberId && calendarData ? (
          <View style={styles.calendarWrap}>
            <View style={styles.weekHeader}>
              {WEEK_DAYS.map((day) => (
                <MobileText key={day} variant="tiny" weight="bold" tone="secondary" style={styles.dayLabel}>
                  {day}
                </MobileText>
              ))}
            </View>
            <View style={styles.dayGrid}>
              {calendarDays.map((item, index) => {
                const contribution = item.active ? getDayContribution(monthData.transactions, item.day, selectedMonth, effectiveYear) : null;
                const selected = item.active && selectedDay === item.day;
                const hasContribution = Boolean(contribution && contribution.transactions.length > 0);
                return (
                  <Pressable
                    key={`${item.day}-${index}`}
                    disabled={!item.active}
                    onPress={() => setSelectedDay(selected ? null : item.day)}
                    style={({ pressed }) => [
                      styles.dayCell,
                      {
                        backgroundColor: selected
                          ? theme.colors.primary
                          : hasContribution
                            ? theme.colors.surfaceStrong
                            : theme.colors.surface,
                        borderColor: selected ? theme.colors.primary : theme.colors.border,
                        opacity: item.active ? (pressed ? 0.82 : 1) : 0.32,
                      },
                    ]}
                  >
                    <MobileText variant="small" weight="bold" style={selected ? { color: theme.colors.onPrimary } : null}>
                      {item.active ? item.day : ''}
                    </MobileText>
                    {hasContribution ? (
                      <MobileText variant="tiny" weight="bold" style={{ color: selected ? theme.colors.onPrimary : theme.colors.primary }} numberOfLines={1}>
                        {formatShortAmount(contribution?.totalAmount || 0)}
                      </MobileText>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {!calendarLoading && (!selectedMemberId || !calendarData) ? (
          <MobileEmptyState title="Select a member" description="Choose a member and year to view contribution activity." />
        ) : null}
      </MobileFormSection>

      {selectedDay && selectedDayDetails ? (
        <MobileCard compact>
          <View style={styles.sectionHeader}>
            <MobileText variant="section" weight="bold">
              {selectedDay} {monthLabel}
            </MobileText>
            <MobileStatusBadge status={selectedDayDetails.transactions[0]?.paymentStatus || 'Paid'} />
          </View>
          <MobileInfoRow label="Total amount" value={formatTzs(selectedDayDetails.totalAmount)} icon={WalletCards} helper={`${formatNumber(selectedDayDetails.transactions.length)} transaction(s)`} />
          {Object.entries(selectedDayDetails.details).map(([category, amount]) => (
            <MobileInfoRow key={category} label={formatCategory(category)} value={formatTzs(amount)} icon={WalletCards} />
          ))}
        </MobileCard>
      ) : null}

      {calendarData ? (
        <MobileCard compact>
          <View style={styles.sectionHeader}>
            <MobileText variant="section" weight="bold">
              Weekly summary
            </MobileText>
            <MobileStatusBadge status="Published" label={`${formatNumber(weeklyRows.length)} weeks`} tone="info" />
          </View>
          {weeklyRows.slice(0, 6).map((week) => (
            <MobileInfoRow
              key={week.key}
              label={week.key}
              value={formatTzs(week.totalAmount)}
              helper={`${formatNumber(week.count)} transaction(s)`}
              icon={CalendarDays}
            />
          ))}
        </MobileCard>
      ) : null}

      {selectedMember ? (
        <MobileCard compact>
          <MobileInfoRow label="Selected member" value={calendarData?.memberName || selectedMember.fullLegalName || 'Member'} helper={selectedMember.contactInfo?.email || 'No email'} icon={User} status="Active" />
          <MobileInfoRow label="Social schedule" value={calendarData?.socialFrequency || 'N/A'} helper={formatTzs(toNumber(calendarData?.socialAmount))} icon={CalendarDays} />
          <MobileInfoRow label="Share amount" value={formatTzs(toNumber(calendarData?.shareAmount))} helper={calendarData?.shareFrequency || 'Configured amount'} icon={WalletCards} />
        </MobileCard>
      ) : null}
    </MobileScreen>
  );
}

function aggregateMonth(monthWeeks: Record<string, RevenueCalendarWeek | null | undefined>): MonthAggregate {
  return Object.values(monthWeeks).reduce<MonthAggregate>(
    (acc, week) => {
      acc.totalSocialContribution += toNumber(week?.totalSocialContribution);
      acc.totalSharePurchase += toNumber(week?.totalSharePurchase);
      acc.totalDisbursement += toNumber(week?.totalDisbursement);
      acc.totalLoanRepayment += toNumber(week?.totalLoanRepayment);
      acc.totalFine += toNumber(week?.totalFine);
      acc.totalPenalty += toNumber(week?.totalPenalty);
      acc.transactions.push(...(week?.transactions || []));
      return acc;
    },
    {
      totalSocialContribution: 0,
      totalSharePurchase: 0,
      totalDisbursement: 0,
      totalLoanRepayment: 0,
      totalFine: 0,
      totalPenalty: 0,
      transactions: [] as RevenueCalendarTransaction[],
    },
  );
}

function buildCalendarDays(year: number, month: number): CalendarDay[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const days: CalendarDay[] = [];
  for (let index = 0; index < firstDay; index += 1) days.push({ day: 0, active: false });
  for (let day = 1; day <= daysInMonth; day += 1) days.push({ day, active: true });
  while (days.length % 7 !== 0) days.push({ day: 0, active: false });
  return days;
}

function getDayContribution(transactions: RevenueCalendarTransaction[], day: number, month: number, year: number): DayContribution {
  const dayTransactions = transactions.filter((transaction) => {
    const parsed = new Date(String(transaction.date || ''));
    if (Number.isNaN(parsed.getTime())) return false;
    return parsed.getFullYear() === year && parsed.getMonth() === month && parsed.getDate() === day;
  });
  const details = dayTransactions.reduce<Record<string, number>>((acc, transaction) => {
    Object.entries(transaction.paymentDetails || {}).forEach(([category, amount]) => {
      acc[category] = (acc[category] || 0) + toNumber(amount);
    });
    return acc;
  }, {});
  return {
    transactions: dayTransactions,
    details,
    totalAmount: Object.values(details).reduce((sum, amount) => sum + amount, 0),
  };
}

function buildWeeklyRows(monthWeeks: Record<string, RevenueCalendarWeek | null | undefined>) {
  return Object.entries(monthWeeks).map(([key, week]) => ({
    key,
    count: week?.transactions?.length || 0,
    totalAmount:
      toNumber(week?.totalSocialContribution) +
      toNumber(week?.totalSharePurchase) +
      toNumber(week?.totalDisbursement) +
      toNumber(week?.totalLoanRepayment) +
      toNumber(week?.totalFine) +
      toNumber(week?.totalPenalty),
  }));
}

function toNumber(value: unknown) {
  return Number(value || 0) || 0;
}

function formatCategory(category: string) {
  return category
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatShortAmount(value: number) {
  if (value >= 1000000) return `${Math.round(value / 1000000)}M`;
  if (value >= 1000) return `${Math.round(value / 1000)}K`;
  return String(Math.round(value));
}

const styles = StyleSheet.create({
  memberList: {
    gap: 8,
  },
  memberRow: {
    minHeight: 62,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  flexButton: {
    flex: 1,
  },
  calendarWrap: {
    gap: 8,
  },
  weekHeader: {
    flexDirection: 'row',
    gap: 4,
  },
  dayLabel: {
    flex: 1,
    textAlign: 'center',
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  dayCell: {
    width: '12.8%',
    aspectRatio: 0.86,
    borderWidth: 1,
    borderRadius: 13,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
});
