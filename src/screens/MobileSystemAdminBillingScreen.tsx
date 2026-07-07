import * as FileSystem from 'expo-file-system/legacy';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Coins,
  FileDown,
  Layers3,
  Package,
  Plus,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

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
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileProgressBar,
  MobileScreen,
  MobileSearchToolbar,
  MobileSelect,
  MobileSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
  MobileTextInput,
  MobileToast,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import { getAllSystemAdminAssociationMetrics, type SystemAdminAssociationMetricsRow } from '@/services/dashboard-service';
import {
  addAdminBillingPlanPrice,
  assignAdminBillingSubscription,
  cancelAdminBillingSubscription,
  createAdminBillingFeature,
  createAdminBillingPlan,
  exportAdminBillingReportCsv,
  generateNaneBillingInvoice,
  getAdminBillingAssociationEntitlements,
  getAdminBillingReport,
  getNaneBillingUsage,
  listAdminBillingFeatures,
  listAdminBillingLifecycleNotifications,
  listAdminBillingPlans,
  listAdminBillingSubscriptions,
  listNaneBillingInvoices,
  markNaneBillingInvoicePaid,
  markNaneBillingInvoiceUnpaid,
  reactivateAdminBillingSubscription,
  refreshNaneBillingUsage,
  runAdminBillingBackfill,
  runAdminBillingLifecycle,
  suspendAdminBillingSubscription,
  updateAdminBillingFeature,
  updateAdminBillingPlan,
  updateAdminBillingPlanFeature,
  updateAdminBillingSubscription,
  upsertAdminBillingSubscriptionOverride,
  type AdminBillingBackfillRun,
  type AdminBillingEntitlements,
  type AdminBillingFeature,
  type AdminBillingFeaturePayload,
  type AdminBillingLifecycleNotification,
  type AdminBillingLifecycleRun,
  type AdminBillingOverridePayload,
  type AdminBillingPlan,
  type AdminBillingPlanFeaturePayload,
  type AdminBillingPlanPayload,
  type AdminBillingReport,
  type AdminBillingSubscription,
  type AdminBillingSubscriptionPayload,
  type AssociationBillingSubscriptionStatus,
  type NaneBillingCycle,
  type NaneBillingInvoice,
  type NaneBillingInvoiceStatus,
  type NaneBillingUsageMetric,
  type NaneBillingUsageSummary,
} from '@/services/system-admin-billing-service';
import { labelFromStatus, statusToneFor, useNaneTheme, type KpiTone, type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate, formatNumber, formatPercent } from '@/utils/format';

type BillingTab = 'plans' | 'features' | 'access' | 'subscriptions' | 'usage' | 'invoices' | 'lifecycle' | 'reports';
type InitialMode = 'plan' | 'feature' | 'price' | 'subscription' | 'override' | 'invoice' | 'lifecycle' | 'backfill';
type ConfirmAction =
  | { type: 'subscription-status'; action: 'suspend' | 'reactivate' | 'cancel'; subscription: AdminBillingSubscription }
  | { type: 'usage-refresh' }
  | { type: 'lifecycle'; dryRun: boolean }
  | { type: 'backfill'; dryRun: boolean }
  | { type: 'invoice-generate' }
  | { type: 'invoice-status'; invoice: NaneBillingInvoice; action: 'paid' | 'unpaid' }
  | null;

type PlanForm = {
  planCode: string;
  name: string;
  description: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  trialDays: string;
  graceDays: string;
  sortOrder: string;
};

type FeatureForm = {
  featureKey: string;
  name: string;
  description: string;
  groupKey: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  supportedAssociationTypes: string[];
};

type PriceForm = {
  currency: string;
  billingCycle: NaneBillingCycle;
  amount: string;
  active: boolean;
  effectiveFrom: string;
  effectiveTo: string;
};

type SubscriptionForm = {
  associationId: string;
  planId: string;
  billingCycle: NaneBillingCycle;
  status: AssociationBillingSubscriptionStatus;
  trialStartDate: string;
  trialEndDate: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  nextInvoiceDate: string;
  graceUntil: string;
  notes: string;
};

type OverrideForm = {
  featureId: string;
  overrideKey: string;
  enabled: boolean;
  limitValue: string;
  limitUnit: string;
  reason: string;
  active: boolean;
};

type FeatureAccessDraft = {
  feature: AdminBillingFeature;
  enabled: boolean;
  limitValue: string;
  limitUnit: string;
};

type MobileSystemAdminBillingScreenProps = {
  initialTab?: BillingTab;
  initialAssociationId?: string;
  initialMode?: InitialMode;
};

const billingTabs: { value: BillingTab; label: string }[] = [
  { value: 'plans', label: 'Plans' },
  { value: 'features', label: 'Features' },
  { value: 'access', label: 'Access' },
  { value: 'subscriptions', label: 'Subs' },
  { value: 'usage', label: 'Usage' },
  { value: 'invoices', label: 'Invoices' },
  { value: 'lifecycle', label: 'Jobs' },
  { value: 'reports', label: 'Reports' },
];

const billingCycles: NaneBillingCycle[] = ['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL'];
const subscriptionStatuses: AssociationBillingSubscriptionStatus[] = ['TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED', 'EXPIRED'];
const invoiceStatuses: ('ALL' | NaneBillingInvoiceStatus)[] = ['ALL', 'ISSUED', 'PAID', 'OVERDUE', 'DRAFT', 'CANCELLED'];
const associationTypes = ['ALL', 'GENERIC', 'VIKOBA', 'UNION'];

const emptyPlanForm: PlanForm = {
  planCode: '',
  name: '',
  description: '',
  status: 'DRAFT',
  trialDays: '0',
  graceDays: '0',
  sortOrder: '0',
};

const emptyFeatureForm: FeatureForm = {
  featureKey: '',
  name: '',
  description: '',
  groupKey: '',
  status: 'ACTIVE',
  supportedAssociationTypes: ['ALL'],
};

const emptyPriceForm: PriceForm = {
  currency: 'TZS',
  billingCycle: 'MONTHLY',
  amount: '',
  active: true,
  effectiveFrom: '',
  effectiveTo: '',
};

const emptySubscriptionForm: SubscriptionForm = {
  associationId: '',
  planId: '',
  billingCycle: 'MONTHLY',
  status: 'ACTIVE',
  trialStartDate: '',
  trialEndDate: '',
  currentPeriodStart: '',
  currentPeriodEnd: '',
  nextInvoiceDate: '',
  graceUntil: '',
  notes: '',
};

const emptyOverrideForm: OverrideForm = {
  featureId: '',
  overrideKey: '',
  enabled: true,
  limitValue: '',
  limitUnit: '',
  reason: 'Admin billing override',
  active: true,
};

const samplePlanForm: PlanForm = {
  planCode: 'MOBILE_PREVIEW',
  name: 'Mobile Preview Plan',
  description: 'Preview-only draft plan for simulator review.',
  status: 'DRAFT',
  trialDays: '14',
  graceDays: '7',
  sortOrder: '99',
};

const sampleFeatureForm: FeatureForm = {
  featureKey: 'mobile.preview.feature',
  name: 'Mobile Preview Feature',
  description: 'Preview-only feature form state for simulator review.',
  groupKey: 'mobile',
  status: 'ACTIVE',
  supportedAssociationTypes: ['ALL'],
};

export default function MobileSystemAdminBillingScreen({
  initialTab = 'plans',
  initialAssociationId,
  initialMode,
}: MobileSystemAdminBillingScreenProps = {}) {
  const { activeView, user } = useAuth();
  const theme = useNaneTheme();
  const [activeTab, setActiveTab] = useState<BillingTab>(initialTab);
  const [features, setFeatures] = useState<AdminBillingFeature[]>([]);
  const [plans, setPlans] = useState<AdminBillingPlan[]>([]);
  const [associations, setAssociations] = useState<SystemAdminAssociationMetricsRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<AdminBillingSubscription[]>([]);
  const [invoices, setInvoices] = useState<NaneBillingInvoice[]>([]);
  const [notifications, setNotifications] = useState<AdminBillingLifecycleNotification[]>([]);
  const [entitlements, setEntitlements] = useState<AdminBillingEntitlements | null>(null);
  const [usage, setUsage] = useState<NaneBillingUsageSummary | null>(null);
  const [report, setReport] = useState<AdminBillingReport | null>(null);
  const [lifecycleRun, setLifecycleRun] = useState<AdminBillingLifecycleRun | null>(null);
  const [backfillRun, setBackfillRun] = useState<AdminBillingBackfillRun | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [selectedAssociationId, setSelectedAssociationId] = useState(initialAssociationId || '');
  const [invoiceStatus, setInvoiceStatus] = useState<'ALL' | NaneBillingInvoiceStatus>('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [planSearch, setPlanSearch] = useState('');
  const [featureSearch, setFeatureSearch] = useState('');
  const [subscriptionSearch, setSubscriptionSearch] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [associationSearch, setAssociationSearch] = useState('');
  const [selectedPlanForDetail, setSelectedPlanForDetail] = useState<AdminBillingPlan | null>(null);
  const [selectedFeatureForDetail, setSelectedFeatureForDetail] = useState<AdminBillingFeature | null>(null);
  const [selectedSubscriptionForDetail, setSelectedSubscriptionForDetail] = useState<AdminBillingSubscription | null>(null);
  const [selectedInvoiceForDetail, setSelectedInvoiceForDetail] = useState<NaneBillingInvoice | null>(null);
  const [planFormOpen, setPlanFormOpen] = useState(false);
  const [featureFormOpen, setFeatureFormOpen] = useState(false);
  const [priceFormOpen, setPriceFormOpen] = useState(false);
  const [subscriptionFormOpen, setSubscriptionFormOpen] = useState(false);
  const [overrideFormOpen, setOverrideFormOpen] = useState(false);
  const [associationPickerOpen, setAssociationPickerOpen] = useState(false);
  const [accessDraft, setAccessDraft] = useState<FeatureAccessDraft | null>(null);
  const [editingPlan, setEditingPlan] = useState<AdminBillingPlan | null>(null);
  const [editingFeature, setEditingFeature] = useState<AdminBillingFeature | null>(null);
  const [planForm, setPlanForm] = useState<PlanForm>(emptyPlanForm);
  const [featureForm, setFeatureForm] = useState<FeatureForm>(emptyFeatureForm);
  const [priceForm, setPriceForm] = useState<PriceForm>(emptyPriceForm);
  const [subscriptionForm, setSubscriptionForm] = useState<SubscriptionForm>(emptySubscriptionForm);
  const [overrideForm, setOverrideForm] = useState<OverrideForm>(emptyOverrideForm);
  const [lifecycleAsOfDate, setLifecycleAsOfDate] = useState(todayInputDate());
  const [reportFromDate, setReportFromDate] = useState(monthStartInputDate());
  const [reportToDate, setReportToDate] = useState(todayInputDate());
  const [backfillAsOfDate, setBackfillAsOfDate] = useState(todayInputDate());
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const handledInitialModeRef = useRef(false);

  const selectedPlan = useMemo(() => plans.find((plan) => plan.id === selectedPlanId) || null, [plans, selectedPlanId]);
  const selectedAssociation = useMemo(
    () => associations.find((association) => association.associationId === selectedAssociationId) || null,
    [associations, selectedAssociationId],
  );
  const selectedSubscription = useMemo(
    () => subscriptions.find((subscription) => subscription.associationId === selectedAssociationId) || null,
    [selectedAssociationId, subscriptions],
  );

  const loadCatalog = useCallback(async () => {
    const [featurePage, planPage] = await Promise.all([
      listAdminBillingFeatures({ size: 300 }),
      listAdminBillingPlans({ size: 100 }),
    ]);
    setFeatures(featurePage.content || []);
    setPlans(planPage.content || []);
    setSelectedPlanId((current) => current || planPage.content?.[0]?.id || '');
  }, []);

  const loadSubscriptions = useCallback(async () => {
    const [associationPage, subscriptionPage] = await Promise.all([
      getAllSystemAdminAssociationMetrics({ size: 500 }),
      listAdminBillingSubscriptions({ size: 300 }),
    ]);
    setAssociations(associationPage.rows || []);
    setSubscriptions(subscriptionPage.content || []);
    setSelectedAssociationId((current) => {
      if (current && associationPage.rows.some((row) => row.associationId === current)) return current;
      return associationPage.rows.find((row) => row.associationName === 'Generic Association')?.associationId || associationPage.rows[0]?.associationId || subscriptionPage.content?.[0]?.associationId || '';
    });
  }, []);

  const loadInvoices = useCallback(
    async (associationId = selectedAssociationId) => {
      const page = await listNaneBillingInvoices({
        associationId: associationId || undefined,
        status: invoiceStatus === 'ALL' ? undefined : invoiceStatus,
        size: 100,
      });
      setInvoices(page.content || []);
    },
    [invoiceStatus, selectedAssociationId],
  );

  const loadReport = useCallback(async () => {
    const nextReport = await getAdminBillingReport({
      fromDate: reportFromDate || undefined,
      toDate: reportToDate || undefined,
    });
    setReport(nextReport);
  }, [reportFromDate, reportToDate]);

  const loadEntitlements = useCallback(async (associationId = selectedAssociationId) => {
    if (!associationId) {
      setEntitlements(null);
      return;
    }
    const nextEntitlements = await getAdminBillingAssociationEntitlements(associationId);
    setEntitlements({ ...nextEntitlements, features: nextEntitlements.features || [] });
  }, [selectedAssociationId]);

  const loadUsage = useCallback(async (associationId = selectedAssociationId) => {
    if (!associationId) {
      setUsage(null);
      return;
    }
    const nextUsage = await getNaneBillingUsage(associationId);
    setUsage({ ...nextUsage, metrics: nextUsage.metrics || [] });
  }, [selectedAssociationId]);

  const loadNotifications = useCallback(async (associationId = selectedAssociationId) => {
    const page = await listAdminBillingLifecycleNotifications({ associationId: associationId || undefined, size: 100 });
    setNotifications(page.content || []);
  }, [selectedAssociationId]);

  const loadInitial = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);
      setNotice(null);
      try {
        await Promise.all([loadCatalog(), loadSubscriptions(), loadReport()]);
        setNotice(mode === 'refresh' ? 'Billing workspace refreshed.' : null);
      } catch (loadError) {
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loadCatalog, loadReport, loadSubscriptions],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadInitial('initial'));
  }, [loadInitial]);

  useEffect(() => {
    if (!selectedAssociationId) return;
    if (activeTab === 'subscriptions') {
      void Promise.resolve().then(() => loadEntitlements(selectedAssociationId).catch((loadError) => setError(getApiErrorMessage(loadError))));
    }
    if (activeTab === 'usage') {
      void Promise.resolve().then(() => loadUsage(selectedAssociationId).catch((loadError) => setError(getApiErrorMessage(loadError))));
    }
    if (activeTab === 'invoices') {
      void Promise.resolve().then(() => loadInvoices(selectedAssociationId).catch((loadError) => setError(getApiErrorMessage(loadError))));
    }
    if (activeTab === 'lifecycle') {
      void Promise.resolve().then(() => loadNotifications(selectedAssociationId).catch((loadError) => setError(getApiErrorMessage(loadError))));
    }
  }, [activeTab, loadEntitlements, loadInvoices, loadNotifications, loadUsage, selectedAssociationId]);

  useEffect(() => {
    if (activeTab !== 'invoices') return;
    void Promise.resolve().then(() => loadInvoices().catch((loadError) => setError(getApiErrorMessage(loadError))));
  }, [activeTab, invoiceStatus, loadInvoices]);

  useEffect(() => {
    if (loading || handledInitialModeRef.current || !initialMode) return;
    handledInitialModeRef.current = true;
    void Promise.resolve().then(() => {
      if (initialMode === 'plan') {
        setEditingPlan(null);
        setPlanForm(samplePlanForm);
        setPlanFormOpen(true);
      } else if (initialMode === 'feature') {
        setEditingFeature(null);
        setFeatureForm(sampleFeatureForm);
        setFeatureFormOpen(true);
      } else if (initialMode === 'price' && selectedPlan) {
        setSelectedPlanId(selectedPlan.id);
        setPriceForm(emptyPriceForm);
        setPriceFormOpen(true);
      } else if (initialMode === 'subscription') {
        const subscription = selectedSubscription;
        setSubscriptionForm(subscription ? {
          associationId: subscription.associationId,
          planId: subscription.plan?.id || '',
          billingCycle: subscription.billingCycle,
          status: subscription.status,
          trialStartDate: subscription.trialStartDate || '',
          trialEndDate: subscription.trialEndDate || '',
          currentPeriodStart: subscription.currentPeriodStart || '',
          currentPeriodEnd: subscription.currentPeriodEnd || '',
          nextInvoiceDate: subscription.nextInvoiceDate || '',
          graceUntil: subscription.graceUntil || '',
          notes: subscription.notes || '',
        } : {
          ...emptySubscriptionForm,
          associationId: selectedAssociationId,
          planId: selectedPlanId || plans[0]?.id || '',
          billingCycle: selectedPlan?.prices?.[0]?.billingCycle || plans[0]?.prices?.[0]?.billingCycle || 'MONTHLY',
        });
        setSubscriptionFormOpen(true);
      } else if (initialMode === 'override' && selectedSubscription) {
        setSelectedAssociationId(selectedSubscription.associationId);
        setOverrideForm({
          ...emptyOverrideForm,
          featureId: features[0]?.id || 'custom',
        });
        setOverrideFormOpen(true);
      }
    });
  }, [features, initialMode, loading, plans, selectedAssociationId, selectedPlan, selectedPlanId, selectedSubscription]);

  const activePlans = useMemo(() => plans.filter((plan) => plan.status === 'ACTIVE').length, [plans]);
  const activeFeatures = useMemo(() => features.filter((feature) => feature.status === 'ACTIVE').length, [features]);
  const openSubscriptions = useMemo(
    () => subscriptions.filter((subscription) => ['TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED'].includes(subscription.status)).length,
    [subscriptions],
  );
  const invoiceTotals = useMemo(() => aggregateInvoices(invoices, report), [invoices, report]);
  const billingHealth = useMemo(() => calculateBillingHealth(activePlans, activeFeatures, openSubscriptions, report), [activeFeatures, activePlans, openSubscriptions, report]);

  const sectionTabs = useMemo(
    () =>
      billingTabs.map((tab) => ({
        ...tab,
        count: countForTab(tab.value, {
          plans: plans.length,
          features: features.length,
          subscriptions: subscriptions.length,
          invoices: invoices.length || report?.invoiceCount || 0,
          notifications: notifications.length,
          report,
        }),
      })),
    [features.length, invoices.length, notifications.length, plans.length, report, subscriptions.length],
  );

  const filteredPlans = useMemo(() => {
    const query = planSearch.trim().toLowerCase();
    return plans.filter((plan) => !query || [plan.name, plan.planCode, plan.description, plan.status].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [planSearch, plans]);

  const filteredFeatures = useMemo(() => {
    const query = featureSearch.trim().toLowerCase();
    return features.filter((feature) => !query || [feature.name, feature.featureKey, feature.groupKey, feature.description, feature.status].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [featureSearch, features]);

  const filteredSubscriptions = useMemo(() => {
    const query = subscriptionSearch.trim().toLowerCase();
    return subscriptions.filter((subscription) => !query || [subscription.associationName, subscription.associationType, subscription.plan?.name, subscription.status, subscription.billingCycle].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [subscriptionSearch, subscriptions]);

  const filteredInvoices = useMemo(() => {
    const query = invoiceSearch.trim().toLowerCase();
    return invoices.filter((invoice) => !query || [invoice.invoiceNumber, invoice.associationName, invoice.planName, invoice.status, invoice.billingCycle].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [invoiceSearch, invoices]);

  const filteredAssociations = useMemo(() => {
    const query = associationSearch.trim().toLowerCase();
    return associations.filter((association) => !query || [association.associationName, association.associationType, association.schemaName, association.adminEmail].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [associationSearch, associations]);

  if (activeView !== 'SYSTEM_ADMIN') {
    return <AccessDeniedScreen title="Nane billing" description="The billing catalog is available only to system administrators." />;
  }

  if (loading && plans.length === 0 && features.length === 0) {
    return <MobilePageLoadingState kind="dashboard" message="Loading Nane billing catalog" />;
  }

  if (error && plans.length === 0 && features.length === 0) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Platform billing"
          title="Nane billing"
          subtitle="Catalog, subscriptions, usage, invoices, and lifecycle operations."
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry" variant="secondary" onPress={() => void loadInitial('refresh')} />}
        />
        <MobileErrorState title="Billing catalog unavailable" description={error} retryLabel="Retry" onRetry={() => void loadInitial('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Platform billing"
        title="Nane billing"
        subtitle={user?.fullName ? `${user.fullName} · SaaS catalog and lifecycle control` : 'SaaS catalog and lifecycle control'}
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh billing" variant="secondary" disabled={refreshing} onPress={() => void loadInitial('refresh')} />}
      />

      {error ? <MobileStatusBadge status="Failed" label={error} tone="danger" /> : null}
      {notice ? <MobileToast title="Nane billing" description={notice} tone="success" /> : null}

      <MobileCard compact accent={billingHealth.tone}>
        <View style={styles.heroRow}>
          <View style={[styles.heroIcon, { backgroundColor: theme.colors.kpi[billingHealth.tone] }]}>
            <ShieldCheck color={theme.colors.onPrimary} size={24} strokeWidth={2.5} />
          </View>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold" numberOfLines={2}>
              {billingHealth.label}
            </MobileText>
            <MobileText variant="small" tone="secondary" numberOfLines={3}>
              {activePlans} active plans, {activeFeatures} active features, {formatNumber(openSubscriptions)} open association subscriptions.
            </MobileText>
          </View>
          <MobileStatusBadge status={billingHealth.label} tone={billingHealth.statusTone} />
        </View>
      </MobileCard>

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Plans" value={`${activePlans}/${plans.length}`} description="Active catalog plans" icon={Package} tone={activePlans > 0 ? 'blue' : 'orange'} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Features" value={`${activeFeatures}/${features.length}`} description="Enabled feature catalog" icon={Layers3} tone={activeFeatures > 0 ? 'purple' : 'orange'} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Subscriptions" value={formatNumber(openSubscriptions)} description={`${formatNumber(report?.pastDueSubscriptions || 0)} past due`} icon={Building2} tone={(report?.pastDueSubscriptions || 0) > 0 ? 'orange' : 'green'} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Outstanding" value={formatCompactCurrency(invoiceTotals.outstanding, report?.currency || invoiceTotals.currency)} description={`${formatNumber(invoiceTotals.unpaidCount)} unpaid invoices`} icon={CircleDollarSign} tone={invoiceTotals.outstanding > 0 ? 'orange' : 'green'} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileStatusTabs tabs={sectionTabs} value={activeTab} onChange={(value) => setActiveTab(value as BillingTab)} />

      {activeTab === 'plans' ? renderPlansTab() : null}
      {activeTab === 'features' ? renderFeaturesTab() : null}
      {activeTab === 'access' ? renderAccessTab() : null}
      {activeTab === 'subscriptions' ? renderSubscriptionsTab() : null}
      {activeTab === 'usage' ? renderUsageTab() : null}
      {activeTab === 'invoices' ? renderInvoicesTab() : null}
      {activeTab === 'lifecycle' ? renderLifecycleTab() : null}
      {activeTab === 'reports' ? renderReportsTab() : null}

      {renderPlanFormSheet()}
      {renderFeatureFormSheet()}
      {renderPriceFormSheet()}
      {renderAccessSheet()}
      {renderSubscriptionFormSheet()}
      {renderOverrideFormSheet()}
      {renderAssociationPicker()}
      {renderPlanDetailSheet()}
      {renderFeatureDetailSheet()}
      {renderSubscriptionDetailSheet()}
      {renderInvoiceDetailSheet()}
      {renderConfirmSheet()}
    </MobileScreen>
  );

  function renderPlansTab() {
    return (
      <>
        <MobileSearchToolbar value={planSearch} onChange={setPlanSearch} placeholder="Search plans" />
        <View style={styles.actionsRow}>
          <MobileButton label="New plan" icon={Plus} size="sm" onPress={() => openPlanForm()} />
          <MobileButton label="Add price" icon={Coins} variant="secondary" size="sm" onPress={() => openPriceForm(selectedPlanId)} disabled={!selectedPlan} />
        </View>
        {selectedPlan ? (
          <MobileCard compact accent={selectedPlanReady(selectedPlan) ? 'green' : 'orange'}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.flex}>
                <MobileText variant="body" weight="bold" numberOfLines={1}>
                  {selectedPlan.name}
                </MobileText>
                <MobileText variant="small" tone="secondary" numberOfLines={2}>
                  {selectedPlan.planCode} · {selectedPlan.prices?.length || 0} prices · {enabledFeatureCount(selectedPlan)} features
                </MobileText>
              </View>
              <MobileStatusBadge status={selectedPlan.status} tone={statusToneFor(selectedPlan.status)} />
            </View>
            <View style={styles.actionsRow}>
              <MobileButton label="Edit" variant="secondary" size="sm" onPress={() => openPlanForm(selectedPlan)} />
              <MobileButton label="Plan features" variant="primary" size="sm" onPress={() => setActiveTab('access')} />
            </View>
          </MobileCard>
        ) : null}
        {filteredPlans.length ? (
          <MobileDataList
            items={filteredPlans.map(planListItem)}
            onPressItem={(item) => {
              const plan = plans.find((candidate) => candidate.id === item.id);
              if (plan) {
                setSelectedPlanId(plan.id);
                setSelectedPlanForDetail(plan);
              }
            }}
          />
        ) : (
          <MobileEmptyState title="No plans found" description={plans.length ? 'Adjust the search term.' : 'Create a plan, then add pricing and feature access.'} actionLabel="Create plan" onAction={() => openPlanForm()} />
        )}
      </>
    );
  }

  function renderFeaturesTab() {
    return (
      <>
        <MobileSearchToolbar value={featureSearch} onChange={setFeatureSearch} placeholder="Search features" />
        <View style={styles.actionsRow}>
          <MobileButton label="New feature" icon={Plus} size="sm" onPress={() => openFeatureForm()} />
        </View>
        {filteredFeatures.length ? (
          <MobileDataList
            items={filteredFeatures.map(featureListItem)}
            onPressItem={(item) => {
              const feature = features.find((candidate) => candidate.id === item.id);
              if (feature) setSelectedFeatureForDetail(feature);
            }}
          />
        ) : (
          <MobileEmptyState title="No features found" description={features.length ? 'Adjust the search term.' : 'Create feature rules before building plan access.'} actionLabel="Create feature" onAction={() => openFeatureForm()} />
        )}
      </>
    );
  }

  function renderAccessTab() {
    if (!selectedPlan) {
      return <MobileEmptyState title="Select a plan" description="Create or select a plan before configuring feature access." actionLabel="Go to plans" onAction={() => setActiveTab('plans')} />;
    }
    return (
      <>
        <MobileCard compact accent="blue">
          <MobileInfoRow label="Selected plan" value={selectedPlan.name} helper={`${selectedPlan.planCode} · ${enabledFeatureCount(selectedPlan)} enabled features`} icon={Package} status={selectedPlan.status} />
          <MobileButton label="Change plan" variant="secondary" size="sm" onPress={() => setActiveTab('plans')} />
        </MobileCard>
        <MobileSearchToolbar value={featureSearch} onChange={setFeatureSearch} placeholder="Search feature access" />
        {filteredFeatures.length ? (
          <View style={styles.stack}>
            {filteredFeatures.map((feature) => {
              const entitlement = selectedPlan.entitlements?.find((item) => item.featureId === feature.id);
              const enabled = Boolean(entitlement?.enabled);
              return (
                <MobileCard key={feature.id} compact accent={enabled ? 'green' : 'slate'}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.flex}>
                      <MobileText variant="body" weight="bold" numberOfLines={1}>
                        {feature.name}
                      </MobileText>
                      <MobileText variant="small" tone="secondary" numberOfLines={2}>
                        {feature.featureKey} · {feature.groupKey}
                      </MobileText>
                    </View>
                    <MobileStatusBadge status={enabled ? 'Allowed' : 'Blocked'} tone={enabled ? 'success' : 'neutral'} />
                  </View>
                  <MobileText variant="small" tone="secondary">
                    Limit: {entitlement?.limitValue == null ? 'No explicit limit' : `${formatNumber(entitlement.limitValue)} ${entitlement.limitUnit || ''}`}
                  </MobileText>
                  <MobileButton label="Edit access" icon={SlidersHorizontal} variant="secondary" size="sm" onPress={() => openAccessDraft(feature)} />
                </MobileCard>
              );
            })}
          </View>
        ) : (
          <MobileEmptyState title="No access rows" description="Create catalog features before assigning them to a plan." />
        )}
      </>
    );
  }

  function renderSubscriptionsTab() {
    return (
      <>
        <AssociationSelectorCard description="Assign plans, inspect entitlements, and manage overrides." />
        <MobileSearchToolbar value={subscriptionSearch} onChange={setSubscriptionSearch} placeholder="Search subscriptions" />
        <View style={styles.actionsRow}>
          <MobileButton label={selectedSubscription ? 'Update' : 'Assign'} icon={Save} size="sm" onPress={openSubscriptionForm} />
          <MobileButton label="Override" icon={SlidersHorizontal} variant="secondary" size="sm" onPress={() => selectedSubscription && openOverrideForm(selectedSubscription)} disabled={!selectedSubscription} />
        </View>
        {entitlements ? (
          <MobileCard compact accent={entitlements.subscriptionAllowsAccess ? 'green' : 'orange'}>
            <MobileInfoRow label="Runtime access" value={entitlements.subscriptionAllowsAccess ? 'Allowed' : 'Restricted'} helper={`${entitlements.planName || 'No plan'} · ${labelFromStatus(entitlements.subscriptionStatus || 'Unknown')}`} icon={ShieldCheck} status={entitlements.subscriptionAllowsAccess ? 'Active' : 'Restricted'} />
          </MobileCard>
        ) : null}
        {filteredSubscriptions.length ? (
          <MobileDataList
            items={filteredSubscriptions.map(subscriptionListItem)}
            onPressItem={(item) => {
              const subscription = subscriptions.find((candidate) => candidate.id === item.id);
              if (subscription) {
                setSelectedAssociationId(subscription.associationId);
                setSelectedSubscriptionForDetail(subscription);
              }
            }}
          />
        ) : (
          <MobileEmptyState title="No subscriptions found" description={subscriptions.length ? 'Adjust the search term.' : 'Assign the first association to a billing plan.'} actionLabel="Assign subscription" onAction={openSubscriptionForm} />
        )}
      </>
    );
  }

  function renderUsageTab() {
    return (
      <>
        <AssociationSelectorCard description="Review plan limits and usage for the selected association." />
        <View style={styles.actionsRow}>
          <MobileButton label="Load usage" icon={RefreshCw} variant="secondary" loading={sectionLoading && activeTab === 'usage'} onPress={() => void runSectionLoad('usage')} />
          <MobileButton label="Refresh snapshot" icon={RotateCcw} variant="primary" disabled={!selectedAssociationId} onPress={() => setConfirmAction({ type: 'usage-refresh' })} />
        </View>
        {usage?.metrics?.length ? (
          <View style={styles.stack}>
            {usage.metrics.map((metric) => (
              <MobileCard key={metric.metricKey} compact accent={usageTone(metric.status)}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.flex}>
                    <MobileText variant="body" weight="bold" numberOfLines={1}>
                      {metric.label || metric.metricKey}
                    </MobileText>
                    <MobileText variant="small" tone="secondary" numberOfLines={2}>
                      {metric.featureName || metric.featureKey || metric.source || 'Usage metric'}
                    </MobileText>
                  </View>
                  <MobileStatusBadge status={metric.status} tone={usageStatusTone(metric.status)} />
                </View>
                <MobileProgressBar value={usagePercent(metric)} label={`${formatNumber(metric.usedQuantity)} of ${metric.limitValue == null ? 'unlimited' : formatNumber(metric.limitValue)} ${metric.limitUnit || ''}`} tone={usageTone(metric.status)} />
              </MobileCard>
            ))}
          </View>
        ) : (
          <MobileEmptyState title="No usage loaded" description={selectedAssociationId ? 'Load usage or refresh the snapshot for this association.' : 'Select an association first.'} />
        )}
      </>
    );
  }

  function renderInvoicesTab() {
    const invoiceTabs = invoiceStatuses.map((status) => ({
      value: status,
      label: status === 'ALL' ? 'All' : labelFromStatus(status),
      count: status === 'ALL' ? invoices.length : invoices.filter((invoice) => invoice.status === status).length,
    }));
    return (
      <>
        <AssociationSelectorCard description="Generate platform subscription invoices and reconcile payment state." />
        <MobileSearchToolbar value={invoiceSearch} onChange={setInvoiceSearch} placeholder="Search invoices" />
        <View style={styles.actionsRow}>
          <MobileButton label="Generate" icon={ReceiptText} size="sm" onPress={() => setConfirmAction({ type: 'invoice-generate' })} disabled={!selectedSubscription} />
          <MobileButton label="Reload" icon={RefreshCw} variant="secondary" size="sm" onPress={() => void runSectionLoad('invoices')} />
        </View>
        <MobileStatusTabs tabs={invoiceTabs} value={invoiceStatus} onChange={(value) => setInvoiceStatus(value as 'ALL' | NaneBillingInvoiceStatus)} />
        {filteredInvoices.length ? (
          <MobileDataList
            items={filteredInvoices.map(invoiceListItem)}
            onPressItem={(item) => {
              const invoice = invoices.find((candidate) => candidate.id === item.id);
              if (invoice) setSelectedInvoiceForDetail(invoice);
            }}
          />
        ) : (
          <MobileEmptyState title="No invoices found" description={invoices.length ? 'Change search or status.' : 'Load invoices or generate from the selected subscription.'} />
        )}
      </>
    );
  }

  function renderLifecycleTab() {
    return (
      <>
        <AssociationSelectorCard description="Run lifecycle checks and inspect notification delivery." />
        <MobileCard compact accent="orange">
          <MobileFormSection title="Lifecycle run" description="Dry run first to preview invoice generation, past-due transitions, suspensions, and notifications.">
            <MobileTextInput label="As of date" value={lifecycleAsOfDate} onChangeText={setLifecycleAsOfDate} placeholder="YYYY-MM-DD" icon={BarChart3} />
            <View style={styles.actionsRow}>
              <MobileButton label="Dry run" icon={Search} variant="secondary" onPress={() => setConfirmAction({ type: 'lifecycle', dryRun: true })} />
              <MobileButton label="Run job" icon={AlertTriangle} variant="danger" onPress={() => setConfirmAction({ type: 'lifecycle', dryRun: false })} />
            </View>
          </MobileFormSection>
        </MobileCard>
        {lifecycleRun ? (
          <MobileKpiGrid>
            <MobileKpiGridItem>
              <MobileKpiCard title="Evaluated" value={formatNumber(lifecycleRun.subscriptionsEvaluated)} description={lifecycleRun.dryRun ? 'Dry run' : 'Executed'} icon={CheckCircle2} tone="blue" />
            </MobileKpiGridItem>
            <MobileKpiGridItem>
              <MobileKpiCard title="Generated" value={formatNumber(lifecycleRun.invoicesGenerated)} description="Invoices" icon={ReceiptText} tone="green" />
            </MobileKpiGridItem>
            <MobileKpiGridItem>
              <MobileKpiCard title="Past due" value={formatNumber(lifecycleRun.subscriptionsPastDue)} description="Subscriptions" icon={AlertTriangle} tone={lifecycleRun.subscriptionsPastDue > 0 ? 'orange' : 'green'} />
            </MobileKpiGridItem>
            <MobileKpiGridItem>
              <MobileKpiCard title="Actions" value={formatNumber(lifecycleRun.actions?.length || 0)} description="Lifecycle actions" icon={Bell} tone="purple" />
            </MobileKpiGridItem>
          </MobileKpiGrid>
        ) : null}
        <MobileCard compact>
          <View style={styles.cardHeaderRow}>
            <View style={styles.flex}>
              <MobileText variant="body" weight="bold">
                Notifications
              </MobileText>
              <MobileText variant="small" tone="secondary">
                Recent lifecycle messages for the selected association or platform.
              </MobileText>
            </View>
            <MobileButton label="Reload" icon={RefreshCw} variant="secondary" size="sm" onPress={() => void runSectionLoad('lifecycle')} />
          </View>
        </MobileCard>
        {notifications.length ? (
          <MobileDataList items={notifications.slice(0, 20).map(notificationListItem)} showChevron={false} />
        ) : (
          <MobileEmptyState title="No lifecycle notifications" description="Run a dry run or reload notifications to inspect recent lifecycle messages." />
        )}
      </>
    );
  }

  function renderReportsTab() {
    return (
      <>
        <MobileCard compact accent="blue">
          <MobileFormSection title="Report period" description="Review recurring revenue, outstanding invoices, risk, feature adoption, and usage trends.">
            <View style={styles.twoColumn}>
              <MobileTextInput label="From" value={reportFromDate} onChangeText={setReportFromDate} placeholder="YYYY-MM-DD" icon={BarChart3} />
              <MobileTextInput label="To" value={reportToDate} onChangeText={setReportToDate} placeholder="YYYY-MM-DD" icon={BarChart3} />
            </View>
            <View style={styles.actionsRow}>
              <MobileButton label="Load report" icon={RefreshCw} variant="secondary" loading={sectionLoading && activeTab === 'reports'} onPress={() => void runSectionLoad('reports')} />
              <MobileButton label="Export CSV" icon={FileDown} variant="primary" disabled={!report} onPress={() => void exportReport()} />
            </View>
          </MobileFormSection>
        </MobileCard>
        {report ? (
          <>
            <MobileKpiGrid>
              <MobileKpiGridItem>
                <MobileKpiCard title="MRR" value={formatCompactCurrency(report.monthlyRecurringRevenue, report.currency)} description="Monthly recurring" icon={TrendingUp} tone="green" />
              </MobileKpiGridItem>
              <MobileKpiGridItem>
                <MobileKpiCard title="ARR" value={formatCompactCurrency(report.annualRecurringRevenue, report.currency)} description="Annual recurring" icon={BarChart3} tone="blue" />
              </MobileKpiGridItem>
              <MobileKpiGridItem>
                <MobileKpiCard title="Outstanding" value={formatCompactCurrency(report.outstandingInvoiceAmount, report.currency)} description={`${formatNumber(report.unpaidInvoiceCount)} unpaid`} icon={ReceiptText} tone={report.outstandingInvoiceAmount > 0 ? 'orange' : 'green'} />
              </MobileKpiGridItem>
              <MobileKpiGridItem>
                <MobileKpiCard title="Trial conversion" value={formatPercent(report.trialConversionRate || 0)} description={`${formatNumber(report.trialSubscriptions)} trials`} icon={ShieldCheck} tone="purple" />
              </MobileKpiGridItem>
            </MobileKpiGrid>
            {report.revenueByPlan?.length ? (
              <MobileDataList items={report.revenueByPlan.slice(0, 12).map(revenuePlanListItem(report.currency))} showChevron={false} />
            ) : null}
          </>
        ) : (
          <MobileEmptyState title="No report loaded" description="Load the billing report for the selected period." />
        )}
        <MobileCard compact accent="orange">
          <MobileFormSection title="Backfill operations" description="Dry run first. Executing can create missing subscriptions and backfill invoice links.">
            <MobileTextInput label="As of date" value={backfillAsOfDate} onChangeText={setBackfillAsOfDate} placeholder="YYYY-MM-DD" icon={RotateCcw} />
            <View style={styles.actionsRow}>
              <MobileButton label="Dry run" variant="secondary" icon={Search} onPress={() => setConfirmAction({ type: 'backfill', dryRun: true })} />
              <MobileButton label="Run backfill" variant="danger" icon={AlertTriangle} onPress={() => setConfirmAction({ type: 'backfill', dryRun: false })} />
            </View>
          </MobileFormSection>
        </MobileCard>
        {backfillRun ? (
          <MobileDataList items={(backfillRun.results || []).slice(0, 20).map(backfillResultListItem)} showChevron={false} />
        ) : null}
      </>
    );
  }

  function AssociationSelectorCard({ description }: { description: string }) {
    return (
      <MobileCard compact accent="blue">
        <View style={styles.cardHeaderRow}>
          <View style={styles.flex}>
            <MobileText variant="body" weight="bold" numberOfLines={1}>
              {selectedAssociation?.associationName || selectedSubscription?.associationName || 'Select association'}
            </MobileText>
            <MobileText variant="small" tone="secondary" numberOfLines={2}>
              {description}
            </MobileText>
          </View>
          <MobileButton label="Change" icon={Search} variant="secondary" size="sm" onPress={() => setAssociationPickerOpen(true)} />
        </View>
      </MobileCard>
    );
  }

  function renderPlanFormSheet() {
    return (
      <MobileSheet visible={planFormOpen} title={editingPlan ? 'Edit plan' : 'Create plan'} description="Plan identity, trial behavior, and visibility." onClose={() => setPlanFormOpen(false)}>
        <MobileFormSection title="Plan details" description="Use a stable plan code. Prices and features are configured after the plan exists.">
          <MobileTextInput label="Plan code" value={planForm.planCode} onChangeText={(value) => setPlanForm((current) => ({ ...current, planCode: value }))} placeholder="ENTERPRISE" autoCapitalize="characters" />
          <MobileTextInput label="Name" value={planForm.name} onChangeText={(value) => setPlanForm((current) => ({ ...current, name: value }))} placeholder="Enterprise" />
          <MobileTextInput label="Description" value={planForm.description} onChangeText={(value) => setPlanForm((current) => ({ ...current, description: value }))} placeholder="Plan description" multiline numberOfLines={3} />
          <MobileSelect label="Status" value={planForm.status} onChange={(value) => setPlanForm((current) => ({ ...current, status: value as PlanForm['status'] }))} options={['DRAFT', 'ACTIVE', 'ARCHIVED'].map(selectOption)} />
          <View style={styles.twoColumn}>
            <MobileTextInput label="Trial days" value={planForm.trialDays} onChangeText={(value) => setPlanForm((current) => ({ ...current, trialDays: numericText(value) }))} keyboardType="number-pad" />
            <MobileTextInput label="Grace days" value={planForm.graceDays} onChangeText={(value) => setPlanForm((current) => ({ ...current, graceDays: numericText(value) }))} keyboardType="number-pad" />
          </View>
          <MobileTextInput label="Sort order" value={planForm.sortOrder} onChangeText={(value) => setPlanForm((current) => ({ ...current, sortOrder: numericText(value) }))} keyboardType="number-pad" />
          <MobileButton label={editingPlan ? 'Save plan' : 'Create plan'} icon={Save} fullWidth loading={saving} onPress={() => void savePlan()} />
        </MobileFormSection>
      </MobileSheet>
    );
  }

  function renderFeatureFormSheet() {
    return (
      <MobileSheet visible={featureFormOpen} title={editingFeature ? 'Edit feature' : 'Create feature'} description="Catalog feature visible to plan entitlement rules." onClose={() => setFeatureFormOpen(false)}>
        <MobileFormSection title="Feature details" description="Feature keys should be stable because they are used by backend access checks.">
          <MobileTextInput label="Feature key" value={featureForm.featureKey} onChangeText={(value) => setFeatureForm((current) => ({ ...current, featureKey: value }))} placeholder="members.manage" autoCapitalize="none" />
          <MobileTextInput label="Name" value={featureForm.name} onChangeText={(value) => setFeatureForm((current) => ({ ...current, name: value }))} placeholder="Manage members" />
          <MobileTextInput label="Group" value={featureForm.groupKey} onChangeText={(value) => setFeatureForm((current) => ({ ...current, groupKey: value }))} placeholder="members" autoCapitalize="none" />
          <MobileTextInput label="Description" value={featureForm.description} onChangeText={(value) => setFeatureForm((current) => ({ ...current, description: value }))} placeholder="What this feature controls" multiline numberOfLines={3} />
          <MobileSelect label="Status" value={featureForm.status} onChange={(value) => setFeatureForm((current) => ({ ...current, status: value as FeatureForm['status'] }))} options={['ACTIVE', 'INACTIVE', 'ARCHIVED'].map(selectOption)} />
          <View style={styles.stack}>
            {associationTypes.map((type) => (
              <MobileCheckboxRow
                key={type}
                label={type === 'ALL' ? 'All association types' : labelFromStatus(type)}
                checked={featureForm.supportedAssociationTypes.includes(type)}
                onChange={(checked) => toggleSupportedAssociationType(type, checked)}
              />
            ))}
          </View>
          <MobileButton label={editingFeature ? 'Save feature' : 'Create feature'} icon={Save} fullWidth loading={saving} onPress={() => void saveFeature()} />
        </MobileFormSection>
      </MobileSheet>
    );
  }

  function renderPriceFormSheet() {
    return (
      <MobileSheet visible={priceFormOpen} title="Add plan price" description={selectedPlan?.name || 'Select a plan before adding pricing.'} onClose={() => setPriceFormOpen(false)}>
        <MobileFormSection title="Price details" description="Pricing becomes available to subscription assignment once active.">
          <MobileSelect label="Plan" value={selectedPlanId} onChange={setSelectedPlanId} options={plans.map((plan) => ({ value: plan.id, label: `${plan.name} · ${plan.planCode}` }))} />
          <MobileTextInput label="Currency" value={priceForm.currency} onChangeText={(value) => setPriceForm((current) => ({ ...current, currency: value.toUpperCase() }))} placeholder="TZS" autoCapitalize="characters" />
          <MobileSelect label="Billing cycle" value={priceForm.billingCycle} onChange={(value) => setPriceForm((current) => ({ ...current, billingCycle: value as NaneBillingCycle }))} options={billingCycles.map(selectOption)} />
          <MobileAmountInput label="Amount" value={priceForm.amount} onChangeText={(value) => setPriceForm((current) => ({ ...current, amount: amountText(value) }))} />
          <MobileCheckboxRow label="Active price" description="Available for subscription assignment." checked={priceForm.active} onChange={(active) => setPriceForm((current) => ({ ...current, active }))} />
          <View style={styles.twoColumn}>
            <MobileTextInput label="Effective from" value={priceForm.effectiveFrom} onChangeText={(value) => setPriceForm((current) => ({ ...current, effectiveFrom: value }))} placeholder="YYYY-MM-DD" />
            <MobileTextInput label="Effective to" value={priceForm.effectiveTo} onChangeText={(value) => setPriceForm((current) => ({ ...current, effectiveTo: value }))} placeholder="YYYY-MM-DD" />
          </View>
          <MobileButton label="Add price" icon={Coins} fullWidth loading={saving} disabled={!selectedPlan} onPress={() => void savePrice()} />
        </MobileFormSection>
      </MobileSheet>
    );
  }

  function renderAccessSheet() {
    return (
      <MobileSheet visible={Boolean(accessDraft)} title="Plan feature access" description={accessDraft?.feature.name || selectedPlan?.name || 'Feature rule'} onClose={() => setAccessDraft(null)}>
        {accessDraft ? (
          <MobileFormSection title="Access rule" description="Toggle access and set an optional limit for this plan feature.">
            <MobileCheckboxRow label="Feature enabled" description={accessDraft.feature.featureKey} checked={accessDraft.enabled} onChange={(enabled) => setAccessDraft((current) => current ? { ...current, enabled } : current)} />
            <MobileTextInput label="Limit value" value={accessDraft.limitValue} onChangeText={(value) => setAccessDraft((current) => current ? { ...current, limitValue: numericText(value) } : current)} keyboardType="number-pad" placeholder="No limit" />
            <MobileTextInput label="Limit unit" value={accessDraft.limitUnit} onChangeText={(value) => setAccessDraft((current) => current ? { ...current, limitUnit: value } : current)} placeholder="records / sms / users" />
            <MobileButton label="Save feature access" icon={Save} fullWidth loading={saving} onPress={() => void savePlanFeature()} />
          </MobileFormSection>
        ) : null}
      </MobileSheet>
    );
  }

  function renderSubscriptionFormSheet() {
    return (
      <MobileSheet visible={subscriptionFormOpen} title={selectedSubscription ? 'Update subscription' : 'Assign subscription'} description="Association billing plan, billing cycle, dates, and notes." onClose={() => setSubscriptionFormOpen(false)}>
        <MobileFormSection title="Subscription setup" description="Changing status or plan affects runtime feature access for the association.">
          <MobileSelect label="Association" value={subscriptionForm.associationId} onChange={(associationId) => setSubscriptionForm((current) => ({ ...current, associationId }))} options={associations.map((association) => ({ value: association.associationId, label: `${association.associationName} · ${association.associationType}` }))} />
          <MobileSelect label="Plan" value={subscriptionForm.planId} onChange={(planId) => setSubscriptionForm((current) => ({ ...current, planId }))} options={plans.map((plan) => ({ value: plan.id, label: `${plan.name} · ${plan.planCode}` }))} />
          <View style={styles.twoColumn}>
            <MobileSelect label="Cycle" value={subscriptionForm.billingCycle} onChange={(billingCycle) => setSubscriptionForm((current) => ({ ...current, billingCycle: billingCycle as NaneBillingCycle }))} options={billingCycles.map(selectOption)} />
            <MobileSelect label="Status" value={subscriptionForm.status} onChange={(status) => setSubscriptionForm((current) => ({ ...current, status: status as AssociationBillingSubscriptionStatus }))} options={subscriptionStatuses.map(selectOption)} />
          </View>
          <View style={styles.twoColumn}>
            <MobileTextInput label="Period start" value={subscriptionForm.currentPeriodStart} onChangeText={(value) => setSubscriptionForm((current) => ({ ...current, currentPeriodStart: value }))} placeholder="YYYY-MM-DD" />
            <MobileTextInput label="Period end" value={subscriptionForm.currentPeriodEnd} onChangeText={(value) => setSubscriptionForm((current) => ({ ...current, currentPeriodEnd: value }))} placeholder="YYYY-MM-DD" />
          </View>
          <View style={styles.twoColumn}>
            <MobileTextInput label="Next invoice" value={subscriptionForm.nextInvoiceDate} onChangeText={(value) => setSubscriptionForm((current) => ({ ...current, nextInvoiceDate: value }))} placeholder="YYYY-MM-DD" />
            <MobileTextInput label="Grace until" value={subscriptionForm.graceUntil} onChangeText={(value) => setSubscriptionForm((current) => ({ ...current, graceUntil: value }))} placeholder="YYYY-MM-DD" />
          </View>
          <MobileTextInput label="Notes" value={subscriptionForm.notes} onChangeText={(value) => setSubscriptionForm((current) => ({ ...current, notes: value }))} placeholder="Internal billing notes" multiline numberOfLines={3} />
          <MobileButton label={selectedSubscription ? 'Update subscription' : 'Assign subscription'} icon={Save} fullWidth loading={saving} onPress={() => void saveSubscription()} />
        </MobileFormSection>
      </MobileSheet>
    );
  }

  function renderOverrideFormSheet() {
    return (
      <MobileSheet visible={overrideFormOpen} title="Subscription override" description={selectedSubscription?.associationName || 'Feature override'} onClose={() => setOverrideFormOpen(false)}>
        <MobileFormSection title="Override rule" description="Overrides should include a clear audit reason.">
          <MobileSelect
            label="Feature"
            value={overrideForm.featureId}
            onChange={(featureId) => setOverrideForm((current) => ({ ...current, featureId }))}
            options={[{ value: 'custom', label: 'Custom override key' }, ...features.map((feature) => ({ value: feature.id, label: `${feature.name} · ${feature.featureKey}` }))]}
          />
          {overrideForm.featureId === 'custom' ? (
            <MobileTextInput label="Override key" value={overrideForm.overrideKey} onChangeText={(value) => setOverrideForm((current) => ({ ...current, overrideKey: value }))} placeholder="custom.feature.key" autoCapitalize="none" />
          ) : null}
          <MobileCheckboxRow label="Enabled" description="Allow this feature override." checked={overrideForm.enabled} onChange={(enabled) => setOverrideForm((current) => ({ ...current, enabled }))} />
          <View style={styles.twoColumn}>
            <MobileTextInput label="Limit value" value={overrideForm.limitValue} onChangeText={(value) => setOverrideForm((current) => ({ ...current, limitValue: numericText(value) }))} keyboardType="number-pad" />
            <MobileTextInput label="Limit unit" value={overrideForm.limitUnit} onChangeText={(value) => setOverrideForm((current) => ({ ...current, limitUnit: value }))} placeholder="records" />
          </View>
          <MobileTextInput label="Reason" value={overrideForm.reason} onChangeText={(value) => setOverrideForm((current) => ({ ...current, reason: value }))} multiline numberOfLines={3} />
          <MobileCheckboxRow label="Active override" checked={overrideForm.active} onChange={(active) => setOverrideForm((current) => ({ ...current, active }))} />
          <MobileButton label="Save override" icon={Save} fullWidth loading={saving} disabled={!selectedSubscription} onPress={() => void saveOverride()} />
        </MobileFormSection>
      </MobileSheet>
    );
  }

  function renderAssociationPicker() {
    return (
      <MobileSheet visible={associationPickerOpen} title="Select association" description="Choose billing workspace context." onClose={() => setAssociationPickerOpen(false)}>
        <MobileSearchToolbar value={associationSearch} onChange={setAssociationSearch} placeholder="Search association" />
        <MobileDataList
          items={filteredAssociations.map(associationListItem)}
          onPressItem={(item) => {
            setSelectedAssociationId(item.id);
            setAssociationPickerOpen(false);
          }}
        />
      </MobileSheet>
    );
  }

  function renderPlanDetailSheet() {
    const plan = selectedPlanForDetail;
    return (
      <MobileSheet visible={Boolean(plan)} title={plan?.name || 'Plan'} description={plan?.planCode || 'Plan detail'} onClose={() => setSelectedPlanForDetail(null)}>
        {plan ? (
          <>
            <MobileInfoRow label="Status" value={labelFromStatus(plan.status)} icon={ShieldCheck} status={plan.status} />
            <MobileInfoRow label="Pricing" value={`${plan.prices?.length || 0} prices`} helper={priceSummary(plan)} icon={Coins} />
            <MobileInfoRow label="Features" value={`${enabledFeatureCount(plan)} enabled`} helper={`${plan.entitlements?.length || 0} configured`} icon={Layers3} />
            <View style={styles.actionsRow}>
              <MobileButton label="Edit" variant="secondary" onPress={() => openPlanForm(plan)} />
              <MobileButton label="Add price" onPress={() => openPriceForm(plan.id)} />
            </View>
          </>
        ) : null}
      </MobileSheet>
    );
  }

  function renderFeatureDetailSheet() {
    const feature = selectedFeatureForDetail;
    return (
      <MobileSheet visible={Boolean(feature)} title={feature?.name || 'Feature'} description={feature?.featureKey || 'Feature detail'} onClose={() => setSelectedFeatureForDetail(null)}>
        {feature ? (
          <>
            <MobileInfoRow label="Status" value={labelFromStatus(feature.status)} helper={feature.groupKey} icon={Layers3} status={feature.status} />
            <MobileInfoRow label="Supported types" value={(feature.supportedAssociationTypes || ['ALL']).join(', ')} icon={Building2} />
            <MobileInfoRow label="Description" value={feature.description || 'No description'} icon={ReceiptText} />
            <MobileButton label="Edit feature" icon={Save} onPress={() => openFeatureForm(feature)} />
          </>
        ) : null}
      </MobileSheet>
    );
  }

  function renderSubscriptionDetailSheet() {
    const subscription = selectedSubscriptionForDetail;
    return (
      <MobileSheet visible={Boolean(subscription)} title={subscription?.associationName || 'Subscription'} description={subscription?.plan?.name || 'Billing plan'} onClose={() => setSelectedSubscriptionForDetail(null)}>
        {subscription ? (
          <>
            <MobileInfoRow label="Status" value={labelFromStatus(subscription.status)} helper={`${subscription.billingCycle} · ${formatCurrency(subscription.priceAmount, subscription.currency || 'TZS')}`} icon={ShieldCheck} status={subscription.status} />
            <MobileInfoRow label="Period" value={`${formatDate(subscription.currentPeriodStart)} - ${formatDate(subscription.currentPeriodEnd)}`} helper={`Next invoice ${formatDate(subscription.nextInvoiceDate)}`} icon={BarChart3} />
            <MobileInfoRow label="Overrides" value={formatNumber(subscription.overrides?.length || 0)} helper="Custom access rules" icon={SlidersHorizontal} />
            <View style={styles.actionsRow}>
              <MobileButton label="Edit" variant="secondary" onPress={openSubscriptionForm} />
              <MobileButton label="Override" variant="secondary" onPress={() => openOverrideForm(subscription)} />
            </View>
            <View style={styles.actionsRow}>
              <MobileButton label="Suspend" variant="danger" size="sm" disabled={subscription.status === 'SUSPENDED'} onPress={() => setConfirmAction({ type: 'subscription-status', action: 'suspend', subscription })} />
              <MobileButton label="Reactivate" variant="secondary" size="sm" disabled={subscription.status === 'ACTIVE'} onPress={() => setConfirmAction({ type: 'subscription-status', action: 'reactivate', subscription })} />
              <MobileButton label="Cancel" variant="danger" size="sm" disabled={subscription.status === 'CANCELLED'} onPress={() => setConfirmAction({ type: 'subscription-status', action: 'cancel', subscription })} />
            </View>
          </>
        ) : null}
      </MobileSheet>
    );
  }

  function renderInvoiceDetailSheet() {
    const invoice = selectedInvoiceForDetail;
    return (
      <MobileSheet visible={Boolean(invoice)} title={invoice?.invoiceNumber || 'Invoice'} description={invoice?.associationName || 'Platform invoice'} onClose={() => setSelectedInvoiceForDetail(null)}>
        {invoice ? (
          <>
            <MobileInfoRow label="Status" value={labelFromStatus(invoice.status)} helper={`${invoice.billingCycle} · ${invoice.planName}`} icon={ReceiptText} status={invoice.status} />
            <MobileInfoRow label="Amount" value={formatCurrency(invoice.totalAmount, invoice.currency || 'TZS')} helper={`Due ${formatDate(invoice.dueDate)}`} icon={CircleDollarSign} />
            <MobileInfoRow label="Period" value={`${formatDate(invoice.periodStart)} - ${formatDate(invoice.periodEnd)}`} helper={invoice.paymentReference || invoice.notes || 'No payment reference'} icon={BarChart3} />
            <View style={styles.actionsRow}>
              <MobileButton label="Mark paid" variant="primary" disabled={invoice.status === 'PAID'} onPress={() => setConfirmAction({ type: 'invoice-status', invoice, action: 'paid' })} />
              <MobileButton label="Mark unpaid" variant="secondary" disabled={invoice.status !== 'PAID'} onPress={() => setConfirmAction({ type: 'invoice-status', invoice, action: 'unpaid' })} />
            </View>
          </>
        ) : null}
      </MobileSheet>
    );
  }

  function renderConfirmSheet() {
    const content = confirmContent(confirmAction);
    return (
      <MobileConfirmSheet
        visible={Boolean(confirmAction)}
        title={content.title}
        description={content.description}
        confirmLabel={content.confirmLabel}
        destructive={content.destructive}
        loading={saving}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void runConfirmedAction()}
      />
    );
  }

  function openPlanForm(plan?: AdminBillingPlan, seed?: PlanForm) {
    setEditingPlan(plan || null);
    setPlanForm(seed || (plan ? {
      planCode: plan.planCode,
      name: plan.name,
      description: plan.description || '',
      status: plan.status,
      trialDays: String(plan.trialDays ?? 0),
      graceDays: String(plan.graceDays ?? 0),
      sortOrder: String(plan.sortOrder ?? 0),
    } : emptyPlanForm));
    setPlanFormOpen(true);
  }

  function openFeatureForm(feature?: AdminBillingFeature, seed?: FeatureForm) {
    setEditingFeature(feature || null);
    setFeatureForm(seed || (feature ? {
      featureKey: feature.featureKey,
      name: feature.name,
      description: feature.description || '',
      groupKey: feature.groupKey,
      status: feature.status,
      supportedAssociationTypes: feature.supportedAssociationTypes?.length ? feature.supportedAssociationTypes : ['ALL'],
    } : emptyFeatureForm));
    setFeatureFormOpen(true);
  }

  function openPriceForm(planId?: string) {
    if (planId) setSelectedPlanId(planId);
    setPriceForm(emptyPriceForm);
    setPriceFormOpen(true);
  }

  function openAccessDraft(feature: AdminBillingFeature) {
    const entitlement = selectedPlan?.entitlements?.find((item) => item.featureId === feature.id);
    setAccessDraft({
      feature,
      enabled: Boolean(entitlement?.enabled),
      limitValue: entitlement?.limitValue == null ? '' : String(entitlement.limitValue),
      limitUnit: entitlement?.limitUnit || '',
    });
  }

  function openSubscriptionForm() {
    const subscription = selectedSubscription;
    setSubscriptionForm(subscription ? {
      associationId: subscription.associationId,
      planId: subscription.plan?.id || '',
      billingCycle: subscription.billingCycle,
      status: subscription.status,
      trialStartDate: subscription.trialStartDate || '',
      trialEndDate: subscription.trialEndDate || '',
      currentPeriodStart: subscription.currentPeriodStart || '',
      currentPeriodEnd: subscription.currentPeriodEnd || '',
      nextInvoiceDate: subscription.nextInvoiceDate || '',
      graceUntil: subscription.graceUntil || '',
      notes: subscription.notes || '',
    } : {
      ...emptySubscriptionForm,
      associationId: selectedAssociationId,
      planId: selectedPlanId || plans[0]?.id || '',
      billingCycle: selectedPlan?.prices?.[0]?.billingCycle || plans[0]?.prices?.[0]?.billingCycle || 'MONTHLY',
    });
    setSubscriptionFormOpen(true);
  }

  function openOverrideForm(subscription: AdminBillingSubscription) {
    setSelectedAssociationId(subscription.associationId);
    setOverrideForm({
      ...emptyOverrideForm,
      featureId: features[0]?.id || 'custom',
    });
    setOverrideFormOpen(true);
  }

  function toggleSupportedAssociationType(type: string, checked: boolean) {
    setFeatureForm((current) => {
      const next = checked
        ? [...new Set([...current.supportedAssociationTypes, type])]
        : current.supportedAssociationTypes.filter((value) => value !== type);
      return { ...current, supportedAssociationTypes: next.length ? next : ['ALL'] };
    });
  }

  async function savePlan() {
    if (!planForm.planCode.trim() || !planForm.name.trim()) {
      setError('Plan code and name are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: AdminBillingPlanPayload = {
        planCode: planForm.planCode.trim(),
        name: planForm.name.trim(),
        description: cleanString(planForm.description),
        status: planForm.status,
        trialDays: toNumber(planForm.trialDays),
        graceDays: toNumber(planForm.graceDays),
        sortOrder: toNumber(planForm.sortOrder),
      };
      const result = editingPlan ? await updateAdminBillingPlan(editingPlan.id, payload) : await createAdminBillingPlan(payload);
      setSelectedPlanId(result.id);
      setNotice(editingPlan ? 'Plan updated.' : 'Plan created.');
      setPlanFormOpen(false);
      await loadCatalog();
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function saveFeature() {
    if (!featureForm.featureKey.trim() || !featureForm.name.trim() || !featureForm.groupKey.trim()) {
      setError('Feature key, name, and group are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: AdminBillingFeaturePayload = {
        featureKey: featureForm.featureKey.trim(),
        name: featureForm.name.trim(),
        description: cleanString(featureForm.description),
        groupKey: featureForm.groupKey.trim(),
        status: featureForm.status,
        supportedAssociationTypes: featureForm.supportedAssociationTypes.length ? featureForm.supportedAssociationTypes : ['ALL'],
      };
      await (editingFeature ? updateAdminBillingFeature(editingFeature.id, payload) : createAdminBillingFeature(payload));
      setNotice(editingFeature ? 'Feature updated.' : 'Feature created.');
      setFeatureFormOpen(false);
      await loadCatalog();
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function savePrice() {
    if (!selectedPlan || !priceForm.currency.trim() || !priceForm.amount.trim()) {
      setError('Select a plan and enter price amount.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await addAdminBillingPlanPrice(selectedPlan.id, {
        currency: priceForm.currency.trim().toUpperCase(),
        billingCycle: priceForm.billingCycle,
        amount: toNumber(priceForm.amount),
        active: priceForm.active,
        effectiveFrom: cleanString(priceForm.effectiveFrom),
        effectiveTo: cleanString(priceForm.effectiveTo),
      });
      setNotice('Plan price added.');
      setPriceFormOpen(false);
      await loadCatalog();
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function savePlanFeature() {
    if (!selectedPlan || !accessDraft) return;
    setSaving(true);
    setError(null);
    try {
      const payload: AdminBillingPlanFeaturePayload = {
        enabled: accessDraft.enabled,
        limitValue: accessDraft.limitValue.trim() ? toNumber(accessDraft.limitValue) : null,
        limitUnit: cleanString(accessDraft.limitUnit),
      };
      await updateAdminBillingPlanFeature(selectedPlan.id, accessDraft.feature.id, payload);
      setNotice('Plan feature access saved.');
      setAccessDraft(null);
      await loadCatalog();
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function saveSubscription() {
    if (!subscriptionForm.associationId || !subscriptionForm.planId || !subscriptionForm.billingCycle) {
      setError('Association, plan, and billing cycle are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: AdminBillingSubscriptionPayload = {
        planId: subscriptionForm.planId,
        billingCycle: subscriptionForm.billingCycle,
        status: subscriptionForm.status,
        trialStartDate: cleanString(subscriptionForm.trialStartDate) || null,
        trialEndDate: cleanString(subscriptionForm.trialEndDate) || null,
        currentPeriodStart: cleanString(subscriptionForm.currentPeriodStart) || null,
        currentPeriodEnd: cleanString(subscriptionForm.currentPeriodEnd) || null,
        nextInvoiceDate: cleanString(subscriptionForm.nextInvoiceDate) || null,
        graceUntil: cleanString(subscriptionForm.graceUntil) || null,
        notes: cleanString(subscriptionForm.notes) || null,
      };
      if (selectedSubscription && selectedSubscription.associationId === subscriptionForm.associationId) {
        await updateAdminBillingSubscription(selectedSubscription.id, payload);
      } else {
        await assignAdminBillingSubscription(subscriptionForm.associationId, {
          ...payload,
          planId: subscriptionForm.planId,
          billingCycle: subscriptionForm.billingCycle,
        });
      }
      setSelectedAssociationId(subscriptionForm.associationId);
      setNotice('Subscription saved.');
      setSubscriptionFormOpen(false);
      await Promise.all([loadSubscriptions(), loadEntitlements(subscriptionForm.associationId), loadInvoices(subscriptionForm.associationId)]);
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function saveOverride() {
    if (!selectedSubscription) {
      setError('Select a subscription first.');
      return;
    }
    if (overrideForm.featureId === 'custom' && !overrideForm.overrideKey.trim()) {
      setError('Custom override key is required.');
      return;
    }
    if (!overrideForm.reason.trim()) {
      setError('Override reason is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: AdminBillingOverridePayload = {
        featureId: overrideForm.featureId === 'custom' ? null : overrideForm.featureId,
        overrideKey: overrideForm.featureId === 'custom' ? cleanString(overrideForm.overrideKey) : null,
        enabled: overrideForm.enabled,
        limitValue: overrideForm.limitValue.trim() ? toNumber(overrideForm.limitValue) : null,
        limitUnit: cleanString(overrideForm.limitUnit),
        reason: overrideForm.reason.trim(),
        active: overrideForm.active,
      };
      await upsertAdminBillingSubscriptionOverride(selectedSubscription.id, payload);
      setNotice('Subscription override saved.');
      setOverrideFormOpen(false);
      await Promise.all([loadSubscriptions(), loadEntitlements(selectedSubscription.associationId)]);
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function runSectionLoad(tab: BillingTab) {
    setSectionLoading(true);
    setError(null);
    try {
      if (tab === 'usage') await loadUsage();
      if (tab === 'invoices') await loadInvoices();
      if (tab === 'lifecycle') await loadNotifications();
      if (tab === 'reports') await loadReport();
      setNotice('Section reloaded.');
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setSectionLoading(false);
    }
  }

  async function runConfirmedAction() {
    if (!confirmAction) return;
    setSaving(true);
    setError(null);
    try {
      if (confirmAction.type === 'subscription-status') {
        const reason = confirmAction.action === 'reactivate' ? undefined : `Mobile admin billing ${confirmAction.action}`;
        if (confirmAction.action === 'suspend') await suspendAdminBillingSubscription(confirmAction.subscription.id, reason);
        if (confirmAction.action === 'reactivate') await reactivateAdminBillingSubscription(confirmAction.subscription.id);
        if (confirmAction.action === 'cancel') await cancelAdminBillingSubscription(confirmAction.subscription.id, reason);
        await Promise.all([loadSubscriptions(), loadEntitlements(confirmAction.subscription.associationId), loadInvoices(confirmAction.subscription.associationId)]);
        setNotice('Subscription status updated.');
      }
      if (confirmAction.type === 'usage-refresh' && selectedAssociationId) {
        const nextUsage = await refreshNaneBillingUsage(selectedAssociationId);
        setUsage({ ...nextUsage, metrics: nextUsage.metrics || [] });
        setNotice('Usage snapshot refreshed.');
      }
      if (confirmAction.type === 'lifecycle') {
        const result = await runAdminBillingLifecycle({
          associationId: selectedAssociationId || undefined,
          asOfDate: lifecycleAsOfDate || undefined,
          dryRun: confirmAction.dryRun,
        });
        setLifecycleRun(result);
        await loadNotifications(selectedAssociationId);
        if (!confirmAction.dryRun) await Promise.all([loadSubscriptions(), loadInvoices(selectedAssociationId), loadReport()]);
        setNotice(confirmAction.dryRun ? 'Lifecycle dry run complete.' : 'Lifecycle job executed.');
      }
      if (confirmAction.type === 'backfill') {
        const result = await runAdminBillingBackfill({
          asOfDate: backfillAsOfDate || undefined,
          dryRun: confirmAction.dryRun,
        });
        setBackfillRun(result);
        if (!confirmAction.dryRun) await Promise.all([loadCatalog(), loadSubscriptions(), loadReport()]);
        setNotice(confirmAction.dryRun ? 'Backfill dry run complete.' : 'Backfill executed.');
      }
      if (confirmAction.type === 'invoice-generate') {
        if (!selectedSubscription) throw new Error('Select a subscription before generating an invoice.');
        await generateNaneBillingInvoice({
          subscriptionId: selectedSubscription.id,
          periodStart: selectedSubscription.currentPeriodStart || undefined,
          periodEnd: selectedSubscription.currentPeriodEnd || undefined,
          notes: `Generated from mobile admin billing for ${selectedSubscription.associationName}`,
        });
        await loadInvoices(selectedSubscription.associationId);
        setNotice('Invoice generated.');
      }
      if (confirmAction.type === 'invoice-status') {
        if (confirmAction.action === 'paid') {
          await markNaneBillingInvoicePaid(confirmAction.invoice.id, {
            paidAt: new Date().toISOString().slice(0, 19),
            paymentReference: `Mobile ${confirmAction.invoice.invoiceNumber}`,
            notes: 'Marked paid from mobile admin billing reconciliation',
          });
        } else {
          await markNaneBillingInvoiceUnpaid(confirmAction.invoice.id, {
            notes: 'Marked unpaid from mobile admin billing reconciliation',
          });
        }
        await loadInvoices(confirmAction.invoice.associationId);
        setNotice(confirmAction.action === 'paid' ? 'Invoice marked paid.' : 'Invoice marked unpaid.');
      }
      setConfirmAction(null);
    } catch (actionError) {
      setError(getApiErrorMessage(actionError));
    } finally {
      setSaving(false);
    }
  }

  async function exportReport() {
    setSaving(true);
    setError(null);
    try {
      const response = await exportAdminBillingReportCsv({
        fromDate: reportFromDate || undefined,
        toDate: reportToDate || undefined,
      });
      const fileUri = `${FileSystem.cacheDirectory || ''}nane-billing-report-${reportToDate || todayInputDate()}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, arrayBufferToBase64(response.data), { encoding: FileSystem.EncodingType.Base64 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Share Nane billing report' });
      }
      setNotice('Billing report exported.');
    } catch (exportError) {
      setError(getApiErrorMessage(exportError));
    } finally {
      setSaving(false);
    }
  }
}

function planListItem(plan: AdminBillingPlan): MobileDataListItem {
  const enabled = enabledFeatureCount(plan);
  return {
    id: plan.id,
    title: plan.name,
    subtitle: plan.planCode,
    meta: `${plan.prices?.length || 0} prices · ${enabled} features`,
    amount: priceSummary(plan),
    status: plan.status,
    statusTone: statusToneFor(plan.status),
    accent: plan.status === 'ACTIVE' ? 'success' : plan.status === 'DRAFT' ? 'primary' : 'neutral',
  };
}

function featureListItem(feature: AdminBillingFeature): MobileDataListItem {
  return {
    id: feature.id,
    title: feature.name,
    subtitle: feature.featureKey,
    meta: `${feature.groupKey} · ${(feature.supportedAssociationTypes || ['ALL']).join(', ')}`,
    status: feature.status,
    statusTone: statusToneFor(feature.status),
    accent: feature.status === 'ACTIVE' ? 'success' : feature.status === 'INACTIVE' ? 'warning' : 'neutral',
  };
}

function subscriptionListItem(subscription: AdminBillingSubscription): MobileDataListItem {
  return {
    id: subscription.id,
    title: subscription.associationName,
    subtitle: subscription.plan?.name || 'No plan',
    meta: `${subscription.billingCycle} · next ${formatDate(subscription.nextInvoiceDate)}`,
    amount: formatCurrency(subscription.priceAmount, subscription.currency || 'TZS'),
    status: subscription.status,
    statusTone: statusToneFor(subscription.status),
    accent: subscription.status === 'ACTIVE' ? 'success' : subscription.status === 'PAST_DUE' ? 'warning' : subscription.status === 'SUSPENDED' ? 'danger' : 'primary',
  };
}

function invoiceListItem(invoice: NaneBillingInvoice): MobileDataListItem {
  return {
    id: invoice.id,
    title: invoice.invoiceNumber,
    subtitle: invoice.associationName,
    meta: `${invoice.planName} · due ${formatDate(invoice.dueDate)}`,
    amount: formatCurrency(invoice.totalAmount, invoice.currency || 'TZS'),
    status: invoice.status,
    statusTone: statusToneFor(invoice.status),
    accent: invoice.status === 'PAID' ? 'success' : invoice.status === 'OVERDUE' ? 'danger' : invoice.status === 'ISSUED' ? 'warning' : 'neutral',
  };
}

function notificationListItem(notification: AdminBillingLifecycleNotification): MobileDataListItem {
  return {
    id: notification.id,
    title: labelFromStatus(notification.notificationType),
    subtitle: notification.subject || notification.recipient || 'Lifecycle notification',
    meta: `${notification.channel} · ${formatDate(notification.referenceDate || notification.createdAt)}`,
    status: notification.status,
    statusTone: statusToneFor(notification.status),
    accent: notification.status === 'SENT' ? 'success' : notification.status === 'FAILED' ? 'danger' : 'neutral',
  };
}

function revenuePlanListItem(currency: string) {
  return (row: { planId: string; planName: string; planCode: string; openSubscriptions: number; monthlyRecurringRevenue: number; outstandingAmount: number }): MobileDataListItem => ({
    id: row.planId || row.planCode,
    title: row.planName,
    subtitle: row.planCode,
    meta: `${formatNumber(row.openSubscriptions)} open subscriptions`,
    amount: formatCompactCurrency(row.monthlyRecurringRevenue, currency),
    status: row.outstandingAmount > 0 ? 'Outstanding' : 'Current',
    statusTone: row.outstandingAmount > 0 ? 'warning' : 'success',
    accent: row.outstandingAmount > 0 ? 'warning' : 'success',
  });
}

function backfillResultListItem(row: { associationId: string; associationName: string; status: string; message?: string | null }): MobileDataListItem {
  return {
    id: row.associationId,
    title: row.associationName,
    subtitle: row.message || 'Backfill result',
    status: row.status,
    statusTone: statusToneFor(row.status),
    accent: row.status === 'CREATED' || row.status === 'UPDATED' ? 'success' : row.status === 'FAILED' ? 'danger' : 'neutral',
  };
}

function associationListItem(association: SystemAdminAssociationMetricsRow): MobileDataListItem {
  return {
    id: association.associationId,
    title: association.associationName,
    subtitle: association.schemaName || association.adminEmail || undefined,
    meta: `${association.associationType} · ${formatNumber(association.totalMembers)} members`,
    status: association.accountStatus || 'Active',
    statusTone: statusToneFor(association.accountStatus || 'Active'),
    accent: association.accountStatus === 'DISABLED' ? 'danger' : 'primary',
  };
}

function countForTab(tab: BillingTab, counts: { plans: number; features: number; subscriptions: number; invoices: number; notifications: number; report: AdminBillingReport | null }) {
  if (tab === 'plans') return counts.plans;
  if (tab === 'features') return counts.features;
  if (tab === 'access') return counts.features;
  if (tab === 'subscriptions') return counts.subscriptions;
  if (tab === 'invoices') return counts.invoices;
  if (tab === 'lifecycle') return counts.notifications;
  if (tab === 'reports') return counts.report?.revenueByPlan?.length || 0;
  return undefined;
}

function aggregateInvoices(invoices: NaneBillingInvoice[], report: AdminBillingReport | null) {
  const total = invoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount || 0), 0);
  const paid = invoices.filter((invoice) => invoice.status === 'PAID').reduce((sum, invoice) => sum + Number(invoice.totalAmount || 0), 0);
  const unpaidCount = invoices.filter((invoice) => invoice.status !== 'PAID' && invoice.status !== 'CANCELLED').length || report?.unpaidInvoiceCount || 0;
  return {
    total: report?.totalInvoicedAmount || total,
    paid: report?.paidInvoiceAmount || paid,
    outstanding: report?.outstandingInvoiceAmount ?? Math.max(0, total - paid),
    unpaidCount,
    currency: report?.currency || invoices[0]?.currency || 'TZS',
  };
}

function calculateBillingHealth(activePlans: number, activeFeatures: number, openSubscriptions: number, report: AdminBillingReport | null): { label: string; tone: KpiTone; statusTone: StatusTone } {
  if ((report?.pastDueSubscriptions || 0) > 0 || (report?.outstandingInvoiceAmount || 0) > 0) return { label: 'Needs attention', tone: 'orange', statusTone: 'warning' };
  if (activePlans > 0 && activeFeatures > 0 && openSubscriptions > 0) return { label: 'Healthy', tone: 'green', statusTone: 'success' };
  return { label: 'Setup needed', tone: 'blue', statusTone: 'primary' };
}

function enabledFeatureCount(plan: AdminBillingPlan) {
  return plan.entitlements?.filter((entitlement) => entitlement.enabled).length || 0;
}

function selectedPlanReady(plan: AdminBillingPlan) {
  return plan.status === 'ACTIVE' && (plan.prices?.some((price) => price.active) || false) && enabledFeatureCount(plan) > 0;
}

function priceSummary(plan: AdminBillingPlan) {
  const activePrice = plan.prices?.find((price) => price.active) || plan.prices?.[0];
  if (!activePrice) return 'No price';
  return `${formatCurrency(activePrice.amount, activePrice.currency || 'TZS')} / ${labelFromStatus(activePrice.billingCycle).toLowerCase()}`;
}

function usagePercent(metric: NaneBillingUsageMetric) {
  if (metric.percentUsed != null && Number.isFinite(Number(metric.percentUsed))) {
    return Math.max(0, Math.min(100, Math.round(Number(metric.percentUsed))));
  }
  if (!metric.limitValue) return 0;
  return Math.max(0, Math.min(100, Math.round((Number(metric.usedQuantity || 0) / Number(metric.limitValue)) * 100)));
}

function usageTone(status: string): KpiTone {
  if (status === 'OVER_LIMIT') return 'red';
  if (status === 'WARNING') return 'orange';
  if (status === 'UNLIMITED') return 'blue';
  if (status === 'OK') return 'green';
  return 'slate';
}

function usageStatusTone(status: string): StatusTone {
  if (status === 'OVER_LIMIT') return 'danger';
  if (status === 'WARNING') return 'warning';
  if (status === 'OK' || status === 'UNLIMITED') return 'success';
  return 'neutral';
}

function selectOption(value: string) {
  return { value, label: labelFromStatus(value) };
}

function confirmContent(action: ConfirmAction) {
  if (!action) return { title: 'Confirm action', description: 'Confirm this billing action.', confirmLabel: 'Confirm', destructive: false };
  if (action.type === 'subscription-status') {
    return {
      title: `${labelFromStatus(action.action)} subscription`,
      description: `${labelFromStatus(action.action)} billing for ${action.subscription.associationName}. This changes runtime access state.`,
      confirmLabel: labelFromStatus(action.action),
      destructive: action.action !== 'reactivate',
    };
  }
  if (action.type === 'usage-refresh') {
    return { title: 'Refresh usage snapshot', description: 'Recalculate usage and limits for the selected association.', confirmLabel: 'Refresh', destructive: false };
  }
  if (action.type === 'lifecycle') {
    return {
      title: action.dryRun ? 'Run lifecycle dry run' : 'Run lifecycle job',
      description: action.dryRun ? 'Preview invoices, notifications, and status transitions without applying changes.' : 'This may generate invoices, update subscription states, and queue notifications.',
      confirmLabel: action.dryRun ? 'Dry run' : 'Run job',
      destructive: !action.dryRun,
    };
  }
  if (action.type === 'backfill') {
    return {
      title: action.dryRun ? 'Run backfill dry run' : 'Run backfill',
      description: action.dryRun ? 'Preview missing subscriptions and invoice linkage updates.' : 'This can create missing subscriptions and update invoice linkages.',
      confirmLabel: action.dryRun ? 'Dry run' : 'Run backfill',
      destructive: !action.dryRun,
    };
  }
  if (action.type === 'invoice-generate') {
    return { title: 'Generate invoice', description: 'Generate a platform subscription invoice for the selected association subscription.', confirmLabel: 'Generate', destructive: false };
  }
  return {
    title: action.action === 'paid' ? 'Mark invoice paid' : 'Mark invoice unpaid',
    description: `${action.invoice.invoiceNumber} will be marked ${action.action}.`,
    confirmLabel: action.action === 'paid' ? 'Mark paid' : 'Mark unpaid',
    destructive: action.action === 'unpaid',
  };
}

function cleanString(value?: string | null) {
  const cleaned = String(value || '').trim();
  return cleaned || undefined;
}

function numericText(value: string) {
  return value.replace(/[^\d.-]/g, '');
}

function amountText(value: string) {
  return value.replace(/[^\d.]/g, '');
}

function toNumber(value: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function todayInputDate() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartInputDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function formatCompactCurrency(value: number, currency = 'TZS') {
  const amount = Number(value || 0);
  if (Math.abs(amount) >= 1_000_000) return `${currency} ${(amount / 1_000_000).toFixed(1)}M`;
  if (Math.abs(amount) >= 1_000) return `${currency} ${(amount / 1_000).toFixed(1)}K`;
  return formatCurrency(amount, currency);
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minWidth: 0,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  twoColumn: {
    gap: 10,
  },
  stack: {
    gap: 10,
  },
});
