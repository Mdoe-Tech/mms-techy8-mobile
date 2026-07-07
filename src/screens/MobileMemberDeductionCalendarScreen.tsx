import { router } from 'expo-router';
import {
  Banknote,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
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
import { getMemberUnionDeductionCalendar, type UnionDeductionCalendar } from '@/services/union-service';
import { labelFromStatus, statusToneFor, useNaneTheme } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber, formatTzs } from '@/utils/format';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DEFAULT_DATE = new Date();
const DEFAULT_YEAR = DEFAULT_DATE.getFullYear();
const DEFAULT_MONTH = DEFAULT_DATE.getMonth();

type CalendarDay = {
  day: number;
  active: boolean;
  dateKey?: string;
};

type DeductionDay = {
  dateKey: string;
  date: Date;
  amount: number;
};

export default function MobileMemberDeductionCalendarScreen() {
  const { activeView, user } = useAuth();
  const theme = useNaneTheme();
  const userId = user?.userId;
  const [member, setMember] = useState<AssociationMember | null>(null);
  const [calendar, setCalendar] = useState<UnionDeductionCalendar | null>(null);
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
        const loadedCalendar = await getMemberUnionDeductionCalendar(loadedMember.id, calendarYear);
        setMember(loadedMember);
        setCalendar(loadedCalendar);
        setSelectedDay(null);
      } catch (loadError) {
        setMember(null);
        setCalendar(null);
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [calendarYear, userId],
  );

  useEffect(() => {
    if (activeView === 'MEMBER') {
      void Promise.resolve().then(() => loadCalendar());
    }
  }, [activeView, loadCalendar]);

  const effectiveYear = calendar?.year || calendarYear;
  const deductionDays = useMemo(() => buildDeductionDays(calendar), [calendar]);
  const monthDeductionDays = useMemo(
    () => deductionDays.filter((day) => day.date.getFullYear() === effectiveYear && day.date.getMonth() === selectedMonth),
    [deductionDays, effectiveYear, selectedMonth],
  );
  const monthTotal = useMemo(() => monthDeductionDays.reduce((sum, day) => sum + day.amount, 0), [monthDeductionDays]);
  const activeMonths = useMemo(() => new Set(deductionDays.map((day) => `${day.date.getFullYear()}-${day.date.getMonth()}`)).size, [deductionDays]);
  const calendarDays = useMemo(() => buildCalendarDays(effectiveYear, selectedMonth), [effectiveYear, selectedMonth]);
  const visibleSelectedDay = selectedDay ?? monthDeductionDays[0]?.date.getDate() ?? null;
  const selectedDateKey = visibleSelectedDay ? dateKeyFor(effectiveYear, selectedMonth, visibleSelectedDay) : null;
  const selectedDeduction = selectedDateKey ? monthDeductionDays.find((day) => day.dateKey === selectedDateKey) : null;
  const monthLabel = new Date(effectiveYear, selectedMonth).toLocaleString('en-TZ', { month: 'long', year: 'numeric' });
  const yearTotal = calendar?.totalDeductions || deductionDays.reduce((sum, day) => sum + day.amount, 0);

  const monthTabs = useMemo(
    () =>
      MONTH_NAMES.map((label, index) => ({
        value: String(index),
        label,
        count: deductionDays.filter((day) => day.date.getFullYear() === effectiveYear && day.date.getMonth() === index).length,
      })),
    [deductionDays, effectiveYear],
  );

  const previousYear = () => {
    setCalendarYear((year) => year - 1);
    setSelectedDay(null);
  };

  const nextYear = () => {
    setCalendarYear((year) => year + 1);
    setSelectedDay(null);
  };

  const currentYear = () => {
    setCalendarYear(DEFAULT_YEAR);
    setSelectedDay(null);
  };

  const previousMonth = () => {
    setSelectedDay(null);
    setSelectedMonth((month) => {
      if (month === 0) {
        setCalendarYear((year) => year - 1);
        return 11;
      }
      return month - 1;
    });
  };

  const nextMonth = () => {
    setSelectedDay(null);
    setSelectedMonth((month) => {
      if (month === 11) {
        setCalendarYear((year) => year + 1);
        return 0;
      }
      return month + 1;
    });
  };

  if (activeView !== 'MEMBER') {
    return (
      <AccessDeniedScreen
        title="Deductions calendar"
        description="This native deduction calendar is available from the member portal workspace."
      />
    );
  }

  if (user?.associationType && user.associationType !== 'UNION') {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Member portal"
          title="Deductions calendar"
          subtitle={user.associationName || 'Union payroll deductions'}
          onBack={() => router.back()}
        />
        <MobileEmptyState
          title="Calendar is for UNION members"
          description="This association does not use the UNION salary deduction calendar."
          actionLabel="Back"
          onAction={() => router.back()}
        />
      </MobileScreen>
    );
  }

  if (loading && !member) {
    return <MobilePageLoadingState kind="detail" message="Loading deduction calendar" />;
  }

  if (error && !member) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Member portal"
          title="Deductions calendar"
          subtitle="Calendar unavailable"
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry calendar" variant="secondary" onPress={() => void loadCalendar('refresh')} />}
        />
        <MobileErrorState title="Deduction calendar could not load" description={error} retryLabel="Retry" onRetry={() => void loadCalendar('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Member portal"
        title="Deductions calendar"
        subtitle={member?.associationName || user?.associationName || 'Union payroll deduction calendar'}
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

      <MobileStatusBadge
        status={labelFromStatus(member?.status)}
        label={`${calendar?.memberName || member?.fullLegalName || user?.fullName || 'Current member'} · ${member?.membershipNumber || 'No membership number'}`}
        tone={statusToneFor(member?.status)}
      />

      <MobileSummaryPanel
        title={`${effectiveYear} deductions`}
        value={formatTzs(yearTotal)}
        description={`${formatNumber(deductionDays.length)} deduction day(s) across ${formatNumber(activeMonths)} active month(s).`}
        tone={yearTotal > 0 ? 'green' : 'slate'}
        icon={CalendarDays}
        footer={
          <View style={styles.yearControls}>
            <MobileIconButton icon={ChevronLeft} label="Previous year" variant="secondary" onPress={previousYear} />
            <MobileButton label="Current" variant="secondary" size="sm" onPress={currentYear} />
            <MobileIconButton icon={ChevronRight} label="Next year" variant="secondary" onPress={nextYear} />
          </View>
        }
      />

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
              Days with payroll deductions show their daily total.
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
            {calendarDays.map((day, index) => {
              const amount = day.dateKey ? calendar?.calendarData[day.dateKey] || 0 : 0;
              const selected = Boolean(day.active && visibleSelectedDay === day.day);
              const hasDeduction = amount > 0;
              return (
                <Pressable
                  key={`${day.day}-${index}`}
                  disabled={!day.active}
                  onPress={() => setSelectedDay(day.day)}
                  style={({ pressed }) => [
                    styles.dayCell,
                    {
                      backgroundColor: selected
                        ? theme.colors.primary
                        : hasDeduction
                          ? theme.colors.surfaceStrong
                          : theme.colors.surface,
                      borderColor: selected ? theme.colors.primary : hasDeduction ? theme.colors.borderStrong : theme.colors.border,
                      opacity: day.active ? (pressed ? 0.82 : 1) : 0.28,
                    },
                  ]}
                >
                  <MobileText variant="small" weight="bold" style={selected ? { color: theme.colors.onPrimary } : null}>
                    {day.active ? day.day : ''}
                  </MobileText>
                  {hasDeduction ? (
                    <MobileText variant="tiny" weight="bold" style={{ color: selected ? theme.colors.onPrimary : theme.colors.primary }} numberOfLines={1}>
                      {formatShortAmount(amount)}
                    </MobileText>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        {!monthDeductionDays.length && !refreshing ? (
          <MobileEmptyState
            title="No deductions this month"
            description="There are no payroll deduction records in this month for the selected year."
          />
        ) : null}
      </MobileCard>

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Month total" value={formatTzs(monthTotal)} description={`${formatNumber(monthDeductionDays.length)} deduction day(s)`} tone={monthTotal > 0 ? 'green' : 'slate'} icon={WalletCards} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Selected day" value={formatTzs(selectedDeduction?.amount || 0)} description={selectedDateKey ? formatDate(selectedDateKey) : 'Tap a date'} tone={selectedDeduction ? 'blue' : 'slate'} icon={Banknote} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Active months" value={formatNumber(activeMonths)} description="Months with deductions" tone="purple" icon={CalendarDays} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      {visibleSelectedDay ? (
        <MobileCard compact accent={selectedDeduction ? 'blue' : undefined}>
          <View style={styles.sectionHeader}>
            <View style={styles.flex}>
              <MobileText variant="section" weight="bold">
                {visibleSelectedDay} {monthLabel}
              </MobileText>
              <MobileText variant="small" tone="secondary">
                {selectedDeduction ? 'Payroll deduction recorded' : 'No payroll deduction on this date'}
              </MobileText>
            </View>
            <MobileStatusBadge status={selectedDeduction ? 'Completed' : 'No Data'} tone={selectedDeduction ? 'success' : 'neutral'} />
          </View>
          <MobileInfoRow label="Daily deduction" value={formatTzs(selectedDeduction?.amount || 0)} helper={selectedDateKey || undefined} icon={WalletCards} />
          <MobileInfoRow label="Member" value={calendar?.memberName || member?.fullLegalName || 'Current member'} helper={member?.membershipNumber || undefined} icon={UserRound} />
        </MobileCard>
      ) : null}

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold">
              Monthly deduction days
            </MobileText>
            <MobileText variant="small" tone="secondary">
              All deduction days in {monthLabel}.
            </MobileText>
          </View>
          <MobileStatusBadge status="Days" label={String(monthDeductionDays.length)} tone="info" />
        </View>
        {monthDeductionDays.length ? (
          monthDeductionDays.map((day) => (
            <MobileInfoRow
              key={day.dateKey}
              label={formatDate(day.dateKey)}
              value={formatTzs(day.amount)}
              helper={day.dateKey}
              icon={CalendarDays}
              status="Recorded"
            />
          ))
        ) : (
          <MobileEmptyState title="No deduction days" description="This month has no salary deduction entries." />
        )}
      </MobileCard>
    </MobileScreen>
  );
}

function buildDeductionDays(calendar: UnionDeductionCalendar | null): DeductionDay[] {
  return Object.entries(calendar?.calendarData || {})
    .map(([dateKey, amount]) => {
      const date = new Date(`${dateKey}T00:00:00`);
      return { dateKey, date, amount: Number(amount || 0) || 0 };
    })
    .filter((day) => !Number.isNaN(day.date.getTime()))
    .sort((left, right) => right.date.getTime() - left.date.getTime());
}

function buildCalendarDays(year: number, month: number): CalendarDay[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const days: CalendarDay[] = [];
  for (let index = 0; index < firstDay; index += 1) days.push({ day: 0, active: false });
  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push({ day, active: true, dateKey: dateKeyFor(year, month, day) });
  }
  while (days.length % 7 !== 0) days.push({ day: 0, active: false });
  return days;
}

function dateKeyFor(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatShortAmount(value: number) {
  if (value >= 1000000) return `${Math.round(value / 1000000)}M`;
  if (value >= 1000) return `${Math.round(value / 1000)}K`;
  return String(Math.round(value));
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minWidth: 0,
  },
  yearControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
