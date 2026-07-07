import { router } from 'expo-router';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarDays,
  Download,
  FileText,
  RefreshCw,
  Scale,
  Share2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileEmptyState,
  MobileErrorState,
  MobileFormSection,
  MobileIconButton,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
  MobileTextInput,
  MobileToast,
} from '@/components/mobile';
import { getAssociationIncomeStatement, type IncomeStatement, type IncomeStatementLineItem } from '@/services/report-service';
import { useNaneTheme, type KpiTone, type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber, formatTzs } from '@/utils/format';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';

type StatementTab = 'income' | 'expenses' | 'summary';

type DateFilterErrors = {
  startDate?: string;
  endDate?: string;
};

const TODAY = new Date();
const DEFAULT_END_DATE = toIsoDate(TODAY);
const DEFAULT_START_DATE = toIsoDate(new Date(TODAY.getFullYear(), 0, 1));

export default function MobileIncomeStatementReportScreen() {
  const { activeView, associationId, user } = useAuth();
  const theme = useNaneTheme();
  const [startDate, setStartDate] = useState(DEFAULT_START_DATE);
  const [endDate, setEndDate] = useState(DEFAULT_END_DATE);
  const [data, setData] = useState<IncomeStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<DateFilterErrors>({});
  const [activeTab, setActiveTab] = useState<StatementTab>('income');
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  const validateDates = useCallback(() => {
    const nextErrors: DateFilterErrors = {};
    const startValid = isIsoDate(startDate);
    const endValid = isIsoDate(endDate);

    if (!startDate) nextErrors.startDate = 'Start date is required.';
    if (!endDate) nextErrors.endDate = 'End date is required.';
    if (startDate && !startValid) nextErrors.startDate = 'Use YYYY-MM-DD.';
    if (endDate && !endValid) nextErrors.endDate = 'Use YYYY-MM-DD.';

    if (startValid && endValid && new Date(`${startDate}T00:00:00`).getTime() > new Date(`${endDate}T00:00:00`).getTime()) {
      nextErrors.endDate = 'End date must be after start date.';
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [endDate, startDate]);

  const loadReport = useCallback(
    async (mode: 'initial' | 'refresh' | 'generate' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before loading reports.');
        return;
      }

      if (!validateDates()) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (mode === 'initial') {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);
      setShareMessage(null);

      try {
        const statement = await getAssociationIncomeStatement(associationId, { startDate, endDate });
        setData(statement);
        if (!statement.revenues.length && statement.expenses.length) {
          setActiveTab('expenses');
        } else {
          setActiveTab('income');
        }
      } catch (loadError) {
        if (!data) setData(null);
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId, data, endDate, startDate, validateDates],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadReport('initial'));
    // Initial load intentionally uses the default date range only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [associationId]);

  const periodLabel = useMemo(() => buildPeriodLabel(data?.startDate || startDate, data?.endDate || endDate), [data, endDate, startDate]);
  const netTone: KpiTone = (data?.netIncome || 0) >= 0 ? 'blue' : 'red';
  const netStatusTone: StatusTone = (data?.netIncome || 0) >= 0 ? 'success' : 'danger';
  const totalLines = (data?.revenues.length || 0) + (data?.expenses.length || 0);

  const tabs = useMemo(
    () => [
      { value: 'income', label: 'Income', count: data?.revenues.length || 0 },
      { value: 'expenses', label: 'Expenses', count: data?.expenses.length || 0 },
      { value: 'summary', label: 'Summary', count: totalLines },
    ],
    [data, totalLines],
  );

  const handleGenerate = () => {
    void loadReport('generate');
  };

  const handleShare = async () => {
    if (!data) return;
    const csv = buildShareText(data, user?.associationName || 'Association');
    await Share.share({
      title: 'Income statement',
      message: csv,
    });
    setShareMessage('Income statement is ready to share.');
  };

  if (activeView !== 'ADMIN') {
    return (
      <AccessDeniedScreen
        title="Income statement"
        description="This native page is available for association admin workspaces only."
      />
    );
  }

  if (loading && !data) {
    return <MobilePageLoadingState kind="list" message="Loading income statement" />;
  }

  if (!associationId) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Reports" title="Income statement" subtitle="Association context unavailable" />
        <MobileErrorState title="Association not selected" description="Sign in through an association account before opening reports." />
      </MobileScreen>
    );
  }

  if (error && !data) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Reports"
          title="Income statement"
          subtitle={periodLabel}
          onBack={() => router.back()}
          rightAction={
            <MobileIconButton
              icon={RefreshCw}
              label="Retry"
              variant="secondary"
              disabled={refreshing}
              onPress={() => void loadReport('refresh')}
            />
          }
        />
        <DateRangeForm
          startDate={startDate}
          endDate={endDate}
          errors={formErrors}
          loading={refreshing}
          onStartDateChange={(value) => {
            setStartDate(value);
            setFormErrors((current) => ({ ...current, startDate: undefined }));
          }}
          onEndDateChange={(value) => {
            setEndDate(value);
            setFormErrors((current) => ({ ...current, endDate: undefined }));
          }}
          onGenerate={handleGenerate}
        />
        <MobileErrorState title="Income statement could not load" description={error} retryLabel="Retry" onRetry={() => void loadReport('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Reports"
        title="Income statement"
        subtitle={`${user?.associationName || 'Association report'} · ${periodLabel}`}
        onBack={() => router.back()}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Refresh report"
            variant="secondary"
            disabled={refreshing}
            onPress={() => void loadReport('refresh')}
          />
        }
      />

      {error ? <MobileToast title="Report refresh failed" description={error} tone="warning" /> : null}
      {shareMessage ? <MobileToast title="Share prepared" description={shareMessage} tone="success" /> : null}

      <DateRangeForm
        startDate={startDate}
        endDate={endDate}
        errors={formErrors}
        loading={refreshing}
        onStartDateChange={(value) => {
          setStartDate(value);
          setFormErrors((current) => ({ ...current, startDate: undefined }));
        }}
        onEndDateChange={(value) => {
          setEndDate(value);
          setFormErrors((current) => ({ ...current, endDate: undefined }));
        }}
        onGenerate={handleGenerate}
      />

      {data ? (
        <>
          <MobileKpiGrid>
            <MobileKpiGridItem>
              <MobileKpiCard title="Income" value={formatTzs(data.totalRevenue)} description={`${formatNumber(data.revenues.length)} revenue lines`} tone="green" icon={ArrowUpCircle} />
            </MobileKpiGridItem>
            <MobileKpiGridItem>
              <MobileKpiCard title="Expenses" value={formatTzs(data.totalExpenses)} description={`${formatNumber(data.expenses.length)} expense lines`} tone="red" icon={ArrowDownCircle} />
            </MobileKpiGridItem>
            <MobileKpiGridItem>
              <MobileKpiCard title="Net income" value={formatTzs(data.netIncome)} description={data.netIncome >= 0 ? 'Surplus for period' : 'Deficit for period'} tone={netTone} icon={data.netIncome >= 0 ? TrendingUp : TrendingDown} />
            </MobileKpiGridItem>
            <MobileKpiGridItem>
              <MobileKpiCard title="Line items" value={formatNumber(totalLines)} description="Income and expense groups" tone="teal" icon={FileText} />
            </MobileKpiGridItem>
          </MobileKpiGrid>

          <MobileCard compact accent={netTone}>
            <View style={styles.statementHeader}>
              <View style={styles.statementTitleBlock}>
                <MobileText variant="tiny" tone="secondary" weight="bold" style={styles.uppercase}>
                  Generated statement
                </MobileText>
                <MobileText variant="section" weight="bold">
                  {user?.associationName || 'Association'}
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  {periodLabel} · Amounts in Tanzanian Shillings
                </MobileText>
              </View>
              <MobileStatusBadge status={data.netIncome >= 0 ? 'Surplus' : 'Deficit'} tone={netStatusTone} />
            </View>
            <MobileInfoRow label="Income before taxes" value={formatTzs(data.netIncome)} helper="Income tax expense is recorded as TZS 0 in the current web report." icon={Scale} status="Net" />
          </MobileCard>

          <MobileStatusTabs tabs={tabs} value={activeTab} onChange={(value) => setActiveTab(value as StatementTab)} />

          {activeTab === 'income' ? (
            <StatementSection
              title="Income"
              description="Revenue categories grouped by the selected period."
              emptyTitle="No income records"
              emptyDescription="No revenue categories were returned for this date range."
              items={data.revenues}
              totalLabel="Total income"
              total={data.totalRevenue}
              tone="success"
            />
          ) : null}

          {activeTab === 'expenses' ? (
            <StatementSection
              title="Expenses"
              description="Expense categories grouped by the selected period."
              emptyTitle="No expense records"
              emptyDescription="No expense categories were returned for this date range."
              items={data.expenses}
              totalLabel="Total expenses"
              total={data.totalExpenses}
              tone="danger"
            />
          ) : null}

          {activeTab === 'summary' ? (
            <MobileCard compact>
              <View style={styles.sectionHeader}>
                <View style={styles.statementTitleBlock}>
                  <MobileText variant="section" weight="bold">
                    Period summary
                  </MobileText>
                  <MobileText variant="small" tone="secondary">
                    Final totals copied from the generated income statement.
                  </MobileText>
                </View>
                <MobileStatusBadge status={data.netIncome >= 0 ? 'Healthy' : 'Review'} tone={netStatusTone} />
              </View>
              <MobileInfoRow label="Total income" value={formatTzs(data.totalRevenue)} icon={ArrowUpCircle} status="Income" />
              <MobileInfoRow label="Total expenses" value={formatTzs(data.totalExpenses)} icon={ArrowDownCircle} status="Expenses" />
              <MobileInfoRow label="Income tax expense" value={formatTzs(0)} helper="Tax is not calculated by the current income statement endpoint." icon={Scale} />
              <View style={[styles.netStrip, { backgroundColor: theme.colors.status[netStatusTone] }]}>
                <View>
                  <MobileText variant="tiny" weight="bold" tone="inverse" style={styles.uppercase}>
                    Net income
                  </MobileText>
                  <MobileText variant="value" weight="bold" tone="inverse" adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1}>
                    {formatTzs(data.netIncome)}
                  </MobileText>
                </View>
              </View>
            </MobileCard>
          ) : null}

          <View style={styles.actions}>
            <MobileButton label="Share report" icon={Share2} variant="secondary" onPress={handleShare} style={styles.flexButton} />
            <MobileButton label="Regenerate" icon={Download} onPress={handleGenerate} loading={refreshing} style={styles.flexButton} />
          </View>
        </>
      ) : (
        <MobileEmptyState
          title="Generate an income statement"
          description="Choose a valid date range to load income, expenses, and net income for this association."
          actionLabel="Generate"
          onAction={handleGenerate}
        />
      )}
    </MobileScreen>
  );
}

type DateRangeFormProps = {
  startDate: string;
  endDate: string;
  errors: DateFilterErrors;
  loading: boolean;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onGenerate: () => void;
};

function DateRangeForm({
  startDate,
  endDate,
  errors,
  loading,
  onStartDateChange,
  onEndDateChange,
  onGenerate,
}: DateRangeFormProps) {
  return (
    <MobileFormSection title="Date range" description="Use YYYY-MM-DD to match the backend report contract.">
      <View style={styles.dateGrid}>
        <View style={styles.dateField}>
          <MobileTextInput
            label="Start date"
            value={startDate}
            onChangeText={onStartDateChange}
            placeholder="YYYY-MM-DD"
            icon={CalendarDays}
            autoCapitalize="none"
            error={errors.startDate}
            disabled={loading}
          />
        </View>
        <View style={styles.dateField}>
          <MobileTextInput
            label="End date"
            value={endDate}
            onChangeText={onEndDateChange}
            placeholder="YYYY-MM-DD"
            icon={CalendarDays}
            autoCapitalize="none"
            error={errors.endDate}
            disabled={loading}
          />
        </View>
      </View>
      <MobileButton label="Generate statement" icon={FileText} onPress={onGenerate} loading={loading} fullWidth />
    </MobileFormSection>
  );
}

type StatementSectionProps = {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  items: IncomeStatementLineItem[];
  totalLabel: string;
  total: number;
  tone: StatusTone;
};

function StatementSection({
  title,
  description,
  emptyTitle,
  emptyDescription,
  items,
  totalLabel,
  total,
  tone,
}: StatementSectionProps) {
  const theme = useNaneTheme();
  const color = theme.colors.status[tone];

  return (
    <MobileCard compact>
      <View style={styles.sectionHeader}>
        <View style={styles.statementTitleBlock}>
          <MobileText variant="section" weight="bold">
            {title}
          </MobileText>
          <MobileText variant="small" tone="secondary">
            {description}
          </MobileText>
        </View>
        <MobileStatusBadge status={totalLabel} label={formatTzs(total)} tone={tone} />
      </View>

      {items.length ? (
        <View style={styles.lineList}>
          {items.map((item, index) => (
            <View key={`${item.category}-${index}`} style={[styles.lineRow, { borderColor: theme.colors.border }]}>
              <View style={[styles.lineIndex, { backgroundColor: color }]}>
                <MobileText variant="tiny" weight="bold" tone="inverse">
                  {index + 1}
                </MobileText>
              </View>
              <View style={styles.lineText}>
                <MobileText variant="body" weight="bold" numberOfLines={2}>
                  {item.category}
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  {title} line item
                </MobileText>
              </View>
              <MobileText variant="body" weight="bold" numberOfLines={1} style={styles.amount}>
                {formatTzs(item.amount)}
              </MobileText>
            </View>
          ))}
        </View>
      ) : (
        <MobileEmptyState title={emptyTitle} description={emptyDescription} />
      )}

      <View style={[styles.totalRow, { borderColor: color }]}>
        <MobileText variant="small" weight="bold" style={{ color }}>
          {totalLabel}
        </MobileText>
        <MobileText variant="section" weight="bold" style={{ color }} adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1}>
          {formatTzs(total)}
        </MobileText>
      </View>
    </MobileCard>
  );
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00`);
  return !Number.isNaN(parsed.getTime()) && value === toIsoDate(parsed);
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildPeriodLabel(startDate: string, endDate: string) {
  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

function buildShareText(data: IncomeStatement, associationName: string) {
  const lines = [
    `${associationName}`,
    'Income Statement',
    `${buildPeriodLabel(data.startDate, data.endDate)}`,
    '',
    'Income',
    ...(data.revenues.length ? data.revenues.map((item) => `${item.category},${formatTzs(item.amount)}`) : ['No income records']),
    `Total income,${formatTzs(data.totalRevenue)}`,
    '',
    'Expenses',
    ...(data.expenses.length ? data.expenses.map((item) => `${item.category},${formatTzs(item.amount)}`) : ['No expense records']),
    `Total expenses,${formatTzs(data.totalExpenses)}`,
    '',
    `Net income,${formatTzs(data.netIncome)}`,
  ];
  return lines.join('\n');
}

const styles = StyleSheet.create({
  dateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  dateField: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 150,
  },
  statementHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  statementTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  uppercase: {
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  lineList: {
    gap: 8,
  },
  lineRow: {
    minHeight: 66,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  lineIndex: {
    width: 30,
    height: 30,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  amount: {
    maxWidth: 132,
    textAlign: 'right',
  },
  totalRow: {
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  netStrip: {
    borderRadius: 18,
    padding: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  flexButton: {
    flex: 1,
  },
});
