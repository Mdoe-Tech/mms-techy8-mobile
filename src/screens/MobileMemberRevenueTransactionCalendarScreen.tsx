import { router } from 'expo-router';
import {
  AlertCircle,
  Banknote,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ShieldCheck,
  UserRound,
  WalletCards,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileEmptyState,
  MobileErrorState,
  MobileIconButton,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobileLoadingState,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileSummaryPanel,
  MobileText,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import { getCurrentMemberByUserId, type AssociationMember } from '@/services/member-service';
import {
  getMemberContributionCalendar,
  labelFromPaymentType,
  type RevenueCalendarTransaction,
  type RevenueCalendarWeek,
  type RevenueContributionCalendar,
} from '@/services/revenue-transaction-service';
import { statusToneFor, useNaneTheme } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber, formatTzs } from '@/utils/format';

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

const SHORT_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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
  totalAmount: number;
  transactions: RevenueCalendarTransaction[];
};

type WeeklyRow = {
  key: string;
  count: number;
  totalAmount: number;
};

export default function MobileMemberRevenueTransactionCalendarScreen() {
  const { activeView, user } = useAuth();
  const theme = useNaneTheme();
  const userId = user?.userId;
  const [member, setMember] = useState<AssociationMember | null>(null);
  const [calendarData, setCalendarData] = useState<RevenueContributionCalendar | null>(null);
  const [calendarYear, setCalendarYear] = useState(DEFAULT_YEAR);
  const [selectedMonth, setSelectedMonth] = useState(DEFAULT_MONTH);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCalendar = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!userId) {
        setLoading(false);
        setError('Member session is missing the user identifier.');
        return;
      }

      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const loadedMember = await getCurrentMemberByUserId(userId);
        const loadedCalendar = await getMemberContributionCalendar(loadedMember.id, calendarYear);
        setMember(loadedMember);
        setCalendarData(loadedCalendar || null);
        setSelectedDay(null);
      } catch (loadError) {
        setMember(null);
        setCalendarData(null);
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [calendarYear, userId],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadCalendar());
  }, [loadCalendar]);

  const effectiveYear = toNumber(calendarData?.year) || calendarYear;
  const selectedMonthName = MONTH_NAMES[selectedMonth];
  const monthLabel = new Date(effectiveYear, selectedMonth).toLocaleString('en-TZ', {
    month: 'long',
    year: 'numeric',
  });
  const monthWeeks = useMemo(() => calendarData?.calendarData?.[selectedMonthName] || {}, [calendarData, selectedMonthName]);
  const monthData = useMemo(() => aggregateMonth(monthWeeks), [monthWeeks]);
  const yearData = useMemo(() => aggregateCalendar(calendarData), [calendarData]);
  const calendarDays = useMemo(() => buildCalendarDays(effectiveYear, selectedMonth), [effectiveYear, selectedMonth]);
  const selectedDayDetails = selectedDay ? getDayContribution(monthData.transactions, selectedDay, selectedMonth, effectiveYear) : null;
  const activeWeeklyRows = useMemo(() => buildWeeklyRows(monthWeeks).filter((row) => row.count > 0 || row.totalAmount > 0), [monthWeeks]);
  const monthTabs = useMemo(
    () =>
      MONTH_NAMES.map((month, index) => {
        const aggregate = aggregateMonth(calendarData?.calendarData?.[month] || {});
        return {
          value: String(index),
          label: SHORT_MONTH_NAMES[index],
          count: aggregate.transactions.length,
        };
      }),
    [calendarData],
  );

  const hasMonthActivity = monthData.transactions.length > 0;
  const outstandingAmount = monthData.totalFine + monthData.totalPenalty;

  const previousYear = () => {
    setCalendarYear((current) => current - 1);
    setSelectedDay(null);
  };

  const nextYear = () => {
    setCalendarYear((current) => current + 1);
    setSelectedDay(null);
  };

  const previousMonth = () => {
    setSelectedDay(null);
    setSelectedMonth((current) => {
      if (current === 0) {
        setCalendarYear((year) => year - 1);
        return 11;
      }
      return current - 1;
    });
  };

  const nextMonth = () => {
    setSelectedDay(null);
    setSelectedMonth((current) => {
      if (current === 11) {
        setCalendarYear((year) => year + 1);
        return 0;
      }
      return current + 1;
    });
  };

  if (activeView !== 'MEMBER') {
    return (
      <AccessDeniedScreen
        title="Contribution calendar"
        description="This native contribution calendar is available from the member portal workspace."
      />
    );
  }

  if (loading && !member) {
    return <MobilePageLoadingState kind="detail" message="Loading contribution calendar" />;
  }

  if (error && !member) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Member portal"
          title="Contribution calendar"
          subtitle="Calendar unavailable"
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry calendar" variant="secondary" onPress={() => void loadCalendar('refresh')} />}
        />
        <MobileErrorState title="Calendar could not load" description={error} retryLabel="Retry" onRetry={() => void loadCalendar('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Member portal"
        title="Contribution calendar"
        subtitle={member?.associationName || user?.associationName || 'Your yearly contribution activity'}
        onBack={() => router.back()}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Refresh calendar"
            variant="secondary"
            disabled={refreshing}
            onPress={() => void loadCalendar('refresh')}
          />
        }
      />

      {error ? <MobileErrorState title="Some calendar data could not refresh" description={error} retryLabel="Retry" onRetry={() => void loadCalendar('refresh')} /> : null}

      <MobileSummaryPanel
        title="Year contribution value"
        value={formatTzs(yearData.totalAmount)}
        description={`${formatNumber(yearData.transactions.length)} calendar transaction day(s) in ${effectiveYear}`}
        tone={yearData.totalAmount > 0 ? 'blue' : 'slate'}
        icon={CalendarDays}
        footer={
          <View style={styles.summaryFooter}>
            <MobileStatusBadge status={member?.status || 'Active'} label={member?.status || 'Active'} tone={statusToneFor(member?.status)} />
            <MobileStatusBadge status="Year" label={String(effectiveYear)} tone="info" />
          </View>
        }
      />

      <MobileCard accent="blue" compact>
        <MobileInfoRow
          icon={UserRound}
          label="Member"
          value={calendarData?.memberName || member?.fullLegalName || user?.fullName || 'Current member'}
          helper={member?.membershipNumber || member?.contactInfo?.email || 'Membership details unavailable'}
          status={member?.status || undefined}
        />
      </MobileCard>

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Total shares" value={formatNumber(toNumber(calendarData?.totalShares))} description="Current share balance" tone="green" icon={ShieldCheck} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Share value" value={formatTzs(toNumber(calendarData?.totalShareValue))} description="Current net value" tone="teal" icon={WalletCards} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Month activity" value={formatTzs(monthData.totalAmount)} description={`${formatNumber(monthData.transactions.length)} transaction day(s)`} tone="blue" icon={Banknote} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Fines / penalties" value={formatTzs(outstandingAmount)} description={outstandingAmount > 0 ? 'Recorded this month' : 'None this month'} tone={outstandingAmount > 0 ? 'red' : 'slate'} icon={AlertCircle} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard compact>
        <View style={styles.yearHeader}>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold">
              Calendar year
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Move across years without changing your member context.
            </MobileText>
          </View>
          <MobileStatusBadge status="Year" label={String(calendarYear)} tone="primary" />
        </View>
        <View style={styles.actionRow}>
          <MobileButton label="Previous" icon={ChevronLeft} variant="secondary" onPress={previousYear} style={styles.flexButton} />
          <MobileButton label="Current" variant="secondary" onPress={() => setCalendarYear(DEFAULT_YEAR)} style={styles.flexButton} />
          <MobileButton label="Next" icon={ChevronRight} variant="secondary" onPress={nextYear} style={styles.flexButton} />
        </View>
      </MobileCard>

      <MobileStatusTabs
        tabs={monthTabs}
        value={String(selectedMonth)}
        onChange={(value) => {
          setSelectedMonth(Number(value));
          setSelectedDay(null);
        }}
      />

      <MobileCard compact>
        <View style={styles.monthHeader}>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold">
              {monthLabel}
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Contribution days are highlighted with their daily totals.
            </MobileText>
          </View>
          <View style={styles.iconActions}>
            <MobileIconButton icon={ChevronLeft} label="Previous month" variant="secondary" onPress={previousMonth} />
            <MobileIconButton icon={ChevronRight} label="Next month" variant="secondary" onPress={nextMonth} />
          </View>
        </View>

        {refreshing ? <MobileLoadingState compact message="Refreshing calendar" /> : null}

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
                      borderColor: selected ? theme.colors.primary : hasContribution ? theme.colors.borderStrong : theme.colors.border,
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

        {!hasMonthActivity && !refreshing ? (
          <MobileEmptyState
            title="No activity this month"
            description="There are no contribution transactions in this month for the selected year."
          />
        ) : null}
      </MobileCard>

      {selectedDay && selectedDayDetails ? (
        <MobileCard compact accent={selectedDayDetails.totalAmount > 0 ? 'blue' : undefined}>
          <View style={styles.sectionHeader}>
            <View style={styles.flex}>
              <MobileText variant="section" weight="bold">
                {selectedDay} {monthLabel}
              </MobileText>
              <MobileText variant="small" tone="secondary">
                {formatNumber(selectedDayDetails.transactions.length)} transaction day record(s)
              </MobileText>
            </View>
            <MobileStatusBadge status={selectedDayDetails.transactions[0]?.paymentStatus || 'No activity'} />
          </View>
          <MobileInfoRow label="Daily total" value={formatTzs(selectedDayDetails.totalAmount)} icon={WalletCards} />
          {Object.entries(selectedDayDetails.details).length ? (
            Object.entries(selectedDayDetails.details).map(([category, amount]) => (
              <MobileInfoRow key={category} label={labelFromPaymentType(category)} value={formatTzs(amount)} icon={Banknote} />
            ))
          ) : (
            <MobileEmptyState title="No payment lines" description="This calendar day has no payment detail lines." />
          )}
          {selectedDayDetails.transactions.slice(0, 3).map((transaction, index) => (
            <MobileInfoRow
              key={`${transaction.date || 'transaction'}-${index}`}
              label={transaction.description || 'Contribution record'}
              value={formatDate(transaction.date)}
              helper={transaction.dueDate ? `Due ${formatDate(transaction.dueDate)}` : transaction.dayOfWeek || undefined}
              icon={CalendarDays}
              status={transaction.paymentStatus || undefined}
            />
          ))}
        </MobileCard>
      ) : null}

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold">
              Weekly summary
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Weeks with contribution activity in {monthLabel}.
            </MobileText>
          </View>
          <MobileStatusBadge status="Weeks" label={String(activeWeeklyRows.length)} tone="info" />
        </View>
        {activeWeeklyRows.length ? (
          activeWeeklyRows.slice(0, 6).map((week) => (
            <MobileInfoRow
              key={week.key}
              label={week.key}
              value={formatTzs(week.totalAmount)}
              helper={`${formatNumber(week.count)} transaction day record(s)`}
              icon={CalendarDays}
            />
          ))
        ) : (
          <MobileEmptyState title="No weekly activity" description="This month has no contribution weeks with activity." />
        )}
      </MobileCard>

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <MobileText variant="section" weight="bold">
            Contribution schedule
          </MobileText>
          <MobileStatusBadge status={calendarData?.shareFrequency || calendarData?.socialFrequency || 'Not configured'} />
        </View>
        <MobileInfoRow label="Social contribution" value={formatSchedule(calendarData?.socialFrequency)} helper={formatTzs(toNumber(calendarData?.socialAmount))} icon={CalendarDays} />
        <MobileInfoRow label="Share purchase" value={formatSchedule(calendarData?.shareFrequency)} helper={formatTzs(toNumber(calendarData?.shareAmount))} icon={ShieldCheck} />
      </MobileCard>
    </MobileScreen>
  );
}

function aggregateCalendar(calendarData: RevenueContributionCalendar | null): MonthAggregate {
  return MONTH_NAMES.reduce<MonthAggregate>(
    (acc, month) => {
      const monthAggregate = aggregateMonth(calendarData?.calendarData?.[month] || {});
      acc.totalSocialContribution += monthAggregate.totalSocialContribution;
      acc.totalSharePurchase += monthAggregate.totalSharePurchase;
      acc.totalDisbursement += monthAggregate.totalDisbursement;
      acc.totalLoanRepayment += monthAggregate.totalLoanRepayment;
      acc.totalFine += monthAggregate.totalFine;
      acc.totalPenalty += monthAggregate.totalPenalty;
      acc.totalAmount += monthAggregate.totalAmount;
      acc.transactions.push(...monthAggregate.transactions);
      return acc;
    },
    createEmptyMonthAggregate(),
  );
}

function aggregateMonth(monthWeeks: Record<string, RevenueCalendarWeek | null | undefined>): MonthAggregate {
  return Object.values(monthWeeks).reduce<MonthAggregate>((acc, week) => {
    const transactions = week?.transactions || [];
    acc.totalSocialContribution += toNumber(week?.totalSocialContribution);
    acc.totalSharePurchase += toNumber(week?.totalSharePurchase);
    acc.totalDisbursement += toNumber(week?.totalDisbursement);
    acc.totalLoanRepayment += toNumber(week?.totalLoanRepayment);
    acc.totalFine += toNumber(week?.totalFine);
    acc.totalPenalty += toNumber(week?.totalPenalty);
    acc.transactions.push(...transactions);
    transactions.forEach((transaction) => {
      acc.totalAmount += sumPaymentDetails(transaction.paymentDetails);
    });
    return acc;
  }, createEmptyMonthAggregate());
}

function createEmptyMonthAggregate(): MonthAggregate {
  return {
    totalSocialContribution: 0,
    totalSharePurchase: 0,
    totalDisbursement: 0,
    totalLoanRepayment: 0,
    totalFine: 0,
    totalPenalty: 0,
    totalAmount: 0,
    transactions: [],
  };
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

function buildWeeklyRows(monthWeeks: Record<string, RevenueCalendarWeek | null | undefined>): WeeklyRow[] {
  return Object.entries(monthWeeks).map(([key, week]) => ({
    key,
    count: week?.transactions?.length || 0,
    totalAmount:
      sumPaymentDetailsFromTransactions(week?.transactions || []) ||
      toNumber(week?.totalSocialContribution) +
        toNumber(week?.totalSharePurchase) +
        toNumber(week?.totalDisbursement) +
        toNumber(week?.totalLoanRepayment) +
        toNumber(week?.totalFine) +
        toNumber(week?.totalPenalty),
  }));
}

function sumPaymentDetailsFromTransactions(transactions: RevenueCalendarTransaction[]): number {
  return transactions.reduce((sum, transaction) => sum + sumPaymentDetails(transaction.paymentDetails), 0);
}

function sumPaymentDetails(paymentDetails?: Record<string, number | string | null | undefined> | null): number {
  return Object.values(paymentDetails || {}).reduce<number>((sum, value) => sum + toNumber(value), 0);
}

function toNumber(value: unknown) {
  return Number(value || 0) || 0;
}

function formatShortAmount(value: number) {
  if (value >= 1000000) return `${Math.round(value / 1000000)}M`;
  if (value >= 1000) return `${Math.round(value / 1000)}K`;
  return String(Math.round(value));
}

function formatSchedule(value?: string | null) {
  return value ? labelFromPaymentType(value) : 'Not configured';
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minWidth: 0,
  },
  summaryFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  yearHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  flexButton: {
    flex: 1,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  iconActions: {
    flexDirection: 'row',
    gap: 8,
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
});
