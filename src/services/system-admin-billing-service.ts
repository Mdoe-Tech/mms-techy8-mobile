import { apiBinaryRequest, apiRequest } from '@/api/client';

export type AdminBillingFeatureStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type AdminBillingPlanStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type AssociationBillingSubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED';
export type NaneBillingCycle = 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL';
export type NaneBillingInvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type NaneBillingInvoiceType = 'SUBSCRIPTION' | 'MANUAL_ADJUSTMENT' | 'CREDIT_NOTE';
export type NaneBillingUsageStatus = 'OK' | 'WARNING' | 'OVER_LIMIT' | 'UNLIMITED' | 'UNKNOWN';

export type AdminBillingFeature = {
  id: string;
  featureKey: string;
  name: string;
  description?: string | null;
  groupKey: string;
  status: AdminBillingFeatureStatus;
  supportedAssociationTypes?: string[];
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type AdminBillingPlanPrice = {
  id: string;
  planId: string;
  currency: string;
  billingCycle: NaneBillingCycle;
  amount: number;
  active: boolean;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
};

export type AdminBillingPlanFeature = {
  id: string;
  planId: string;
  featureId: string;
  featureKey: string;
  featureName: string;
  enabled: boolean;
  limitValue?: number | null;
  limitUnit?: string | null;
  config?: Record<string, unknown> | null;
};

export type AdminBillingPlan = {
  id: string;
  planCode: string;
  name: string;
  description?: string | null;
  status: AdminBillingPlanStatus;
  trialDays?: number | null;
  graceDays?: number | null;
  sortOrder?: number | null;
  prices?: AdminBillingPlanPrice[];
  entitlements?: AdminBillingPlanFeature[];
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type AdminBillingOverride = {
  id: string;
  subscriptionId: string;
  featureId?: string | null;
  featureKey?: string | null;
  featureName?: string | null;
  overrideKey: string;
  enabled?: boolean | null;
  limitValue?: number | null;
  limitUnit?: string | null;
  reason?: string | null;
  active: boolean;
  createdBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type AdminBillingSubscription = {
  id: string;
  associationId: string;
  associationName: string;
  associationType?: string | null;
  plan?: AdminBillingPlan | null;
  status: AssociationBillingSubscriptionStatus;
  billingCycle: NaneBillingCycle;
  currency: string;
  priceAmount: number;
  trialStartDate?: string | null;
  trialEndDate?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  nextInvoiceDate?: string | null;
  graceUntil?: string | null;
  suspendedAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  notes?: string | null;
  overrides?: AdminBillingOverride[];
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type AdminBillingFeatureEntitlement = {
  featureId?: string | null;
  featureKey: string;
  featureName: string;
  groupKey: string;
  available: boolean;
  planIncluded: boolean;
  overrideEnabled?: boolean | null;
  limitValue?: number | null;
  limitUnit?: string | null;
  denialReason?: string | null;
  config?: Record<string, unknown> | null;
};

export type AdminBillingEntitlements = {
  associationId: string;
  associationName: string;
  associationType?: string | null;
  subscriptionId?: string | null;
  subscriptionStatus?: AssociationBillingSubscriptionStatus | null;
  planId?: string | null;
  planCode?: string | null;
  planName?: string | null;
  subscriptionAllowsAccess: boolean;
  accessUntil?: string | null;
  features?: AdminBillingFeatureEntitlement[];
  evaluatedAt?: string | null;
};

export type NaneBillingUsageMetric = {
  metricKey: string;
  label: string;
  usedQuantity: number;
  limitValue?: number | null;
  limitUnit?: string | null;
  percentUsed?: number | null;
  status: NaneBillingUsageStatus;
  source?: string | null;
  featureKey?: string | null;
  featureName?: string | null;
  calculatedAt?: string | null;
};

export type NaneBillingUsageSummary = {
  associationId: string;
  associationName: string;
  associationType?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  metrics?: NaneBillingUsageMetric[];
  calculatedAt?: string | null;
};

export type NaneBillingInvoiceItem = {
  id: string;
  invoiceId?: string | null;
  itemCode?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
};

export type NaneBillingInvoice = {
  id: string;
  associationId: string;
  associationName: string;
  associationType?: string | null;
  subscriptionId: string;
  planId: string;
  planName: string;
  planCode: string;
  invoiceNumber: string;
  status: NaneBillingInvoiceStatus;
  type: NaneBillingInvoiceType;
  billingCycle: NaneBillingCycle;
  currency: string;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  issueDate?: string | null;
  dueDate?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  paidAt?: string | null;
  paymentReference?: string | null;
  reconciliationNotes?: string | null;
  notes?: string | null;
  items?: NaneBillingInvoiceItem[];
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type AdminBillingLifecycleAction = {
  action: string;
  associationId: string;
  associationName?: string | null;
  subscriptionId?: string | null;
  invoiceId?: string | null;
  channel?: string | null;
  status?: string | null;
  message?: string | null;
  referenceDate?: string | null;
};

export type AdminBillingLifecycleRun = {
  asOfDate: string;
  dryRun: boolean;
  subscriptionsEvaluated: number;
  invoicesGenerated: number;
  invoicesAlreadyCurrent: number;
  subscriptionsPastDue: number;
  subscriptionsSuspended: number;
  subscriptionsReactivated: number;
  notificationsQueued: number;
  notificationsSkipped: number;
  actions?: AdminBillingLifecycleAction[];
};

export type AdminBillingLifecycleNotification = {
  id: string;
  associationId: string;
  subscriptionId: string;
  invoiceId?: string | null;
  notificationType: string;
  channel: string;
  status: string;
  referenceDate?: string | null;
  recipient?: string | null;
  subject?: string | null;
  message?: string | null;
  errorMessage?: string | null;
  createdAt?: string | null;
};

export type AdminBillingPlanRevenue = {
  planId: string;
  planCode: string;
  planName: string;
  openSubscriptions: number;
  trialSubscriptions: number;
  monthlyRecurringRevenue: number;
  annualRecurringRevenue: number;
  invoiceCount: number;
  paidAmount: number;
  outstandingAmount: number;
};

export type AdminBillingPastDueAssociation = {
  associationId: string;
  associationName: string;
  associationType?: string | null;
  subscriptionId?: string | null;
  planCode?: string | null;
  planName?: string | null;
  subscriptionStatus?: AssociationBillingSubscriptionStatus | null;
  graceUntil?: string | null;
  overdueInvoiceCount: number;
  overdueAmount: number;
  oldestDueDate?: string | null;
};

export type AdminBillingFeatureAdoption = {
  featureId: string;
  featureKey: string;
  featureName: string;
  groupKey: string;
  includedPlanCount: number;
  associationCount: number;
  activeAssociationCount: number;
};

export type AdminBillingUsageByAssociation = {
  associationId: string;
  associationName: string;
  associationType?: string | null;
  smsMonthly: number;
  emailMonthly: number;
  whatsappMonthly: number;
  calculatedAt?: string | null;
};

export type AdminBillingTrialRisk = {
  associationId: string;
  associationName: string;
  associationType?: string | null;
  subscriptionId: string;
  planCode?: string | null;
  planName?: string | null;
  subscriptionStatus: AssociationBillingSubscriptionStatus;
  riskType: string;
  severity: string;
  referenceDate?: string | null;
  monthlyRecurringRevenue: number;
  outstandingAmount: number;
};

export type AdminBillingReport = {
  fromDate: string;
  toDate: string;
  generatedAt: string;
  currency: string;
  monthlyRecurringRevenue: number;
  annualRecurringRevenue: number;
  trialMonthlyRecurringRevenue: number;
  churnRiskMonthlyRecurringRevenue: number;
  openSubscriptions: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  pastDueSubscriptions: number;
  suspendedSubscriptions: number;
  cancelledSubscriptions: number;
  expiredSubscriptions: number;
  invoiceCount: number;
  paidInvoiceCount: number;
  paidInvoiceAmount: number;
  issuedInvoiceCount: number;
  issuedInvoiceAmount: number;
  overdueInvoiceCount: number;
  overdueInvoiceAmount: number;
  unpaidInvoiceCount: number;
  outstandingInvoiceAmount: number;
  totalInvoicedAmount: number;
  trialConversionRate: number;
  revenueByPlan?: AdminBillingPlanRevenue[];
  pastDueAssociations?: AdminBillingPastDueAssociation[];
  featureAdoption?: AdminBillingFeatureAdoption[];
  usageByAssociation?: AdminBillingUsageByAssociation[];
  trialConversionAndChurnRisks?: AdminBillingTrialRisk[];
};

export type AdminBillingBackfillAssociationResult = {
  associationId: string;
  associationName: string;
  associationType?: string | null;
  subscriptionId?: string | null;
  result?: string | null;
  status: string;
  message?: string | null;
};

export type AdminBillingBackfillRun = {
  asOfDate: string;
  dryRun: boolean;
  associationId?: string | null;
  planCode: string;
  planId?: string | null;
  currency: string;
  billingCycle: NaneBillingCycle;
  priceAmount: number;
  planAvailable: boolean;
  planCreated: boolean;
  priceAvailable: boolean;
  priceCreated: boolean;
  activeFeatureCount: number;
  planFeaturesEnabled: number;
  planFeaturesAlreadyEnabled: number;
  associationsEvaluated: number;
  subscriptionsPlanned: number;
  subscriptionsCreated: number;
  subscriptionsSkipped: number;
  invoiceLinksBackfilled: number;
  invoiceLinkageNote?: string | null;
  generatedAt?: string | null;
  results?: AdminBillingBackfillAssociationResult[];
};

export type AdminBillingFeaturePayload = {
  featureKey: string;
  name: string;
  description?: string;
  groupKey: string;
  status?: AdminBillingFeatureStatus;
  supportedAssociationTypes?: string[];
};

export type AdminBillingPlanPayload = {
  planCode: string;
  name: string;
  description?: string;
  status?: AdminBillingPlanStatus;
  trialDays?: number;
  graceDays?: number;
  sortOrder?: number;
};

export type AdminBillingPlanPricePayload = {
  currency: string;
  billingCycle: NaneBillingCycle;
  amount: number;
  active?: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
};

export type AdminBillingPlanFeaturePayload = {
  enabled: boolean;
  limitValue?: number | null;
  limitUnit?: string | null;
  config?: Record<string, unknown>;
};

export type AdminBillingSubscriptionPayload = {
  planId?: string;
  billingCycle?: NaneBillingCycle;
  status?: AssociationBillingSubscriptionStatus;
  trialStartDate?: string | null;
  trialEndDate?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  nextInvoiceDate?: string | null;
  graceUntil?: string | null;
  notes?: string | null;
};

export type AdminBillingOverridePayload = {
  featureId?: string | null;
  overrideKey?: string | null;
  enabled?: boolean | null;
  limitValue?: number | null;
  limitUnit?: string | null;
  reason: string;
  active?: boolean;
};

export type NaneBillingInvoiceGeneratePayload = {
  subscriptionId: string;
  issueDate?: string;
  dueDate?: string;
  periodStart?: string;
  periodEnd?: string;
  notes?: string;
};

export type NaneBillingInvoicePaymentPayload = {
  paidAt?: string;
  paymentReference?: string;
  notes?: string;
};

export type AdminBillingPage<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
};

export type SystemAdminBillingInvoiceItem = {
  id?: string | null;
  description?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  totalAmount?: number | null;
};

export type SystemAdminBillingInvoice = {
  id: string;
  associationId?: string | null;
  associationName?: string | null;
  invoiceNumber?: string | null;
  status?: string | null;
  type?: string | null;
  currency?: string | null;
  netAmount?: number | null;
  taxAmount?: number | null;
  totalAmount?: number | null;
  issueDate?: string | null;
  dueDate?: string | null;
  paidAt?: string | null;
  notes?: string | null;
  billToName?: string | null;
  billToEmail?: string | null;
  billToPhone?: string | null;
  billToAddress?: string | null;
  billToTin?: string | null;
  billToVrn?: string | null;
  memberName?: string | null;
  memberEmail?: string | null;
  memberPhone?: string | null;
  membershipNumber?: string | null;
  items?: SystemAdminBillingInvoiceItem[];
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type SystemAdminBillingInvoicePage = {
  invoices: SystemAdminBillingInvoice[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type SystemAdminBillingInvoiceCreatePayload = {
  status: 'ISSUED' | 'DRAFT';
  type: 'GENERAL';
  currency: string;
  dueDate?: string;
  notes?: string;
  billToName?: string;
  billToEmail?: string;
  billToPhone?: string;
  billToAddress?: string;
  billToTin?: string;
  billToVrn?: string;
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
  }[];
};

export async function listSystemAdminBillingInvoices(
  associationId: string,
  params: { page?: number; size?: number; sort?: string } = {},
) {
  const query = new URLSearchParams();
  query.set('associationId', associationId);
  query.set('page', String(params.page ?? 0));
  query.set('size', String(params.size ?? 100));
  query.set('sort', params.sort || 'createdAt,desc');

  const payload = await apiRequest<unknown>(`/admin/billing/invoices?${query.toString()}`);
  return normalizeInvoicePage(payload, params.size ?? 100);
}

export async function createSystemAdminBillingInvoice(
  associationId: string,
  payload: SystemAdminBillingInvoiceCreatePayload,
) {
  const query = new URLSearchParams({ associationId });
  const invoice = await apiRequest<SystemAdminBillingInvoice>(`/admin/billing/invoices?${query.toString()}`, {
    method: 'POST',
    body: payload,
  });
  return normalizeInvoice(invoice);
}

export async function markSystemAdminBillingInvoicePaid(associationId: string, invoiceId: string) {
  const query = new URLSearchParams({ associationId });
  const invoice = await apiRequest<SystemAdminBillingInvoice>(
    `/admin/billing/invoices/${encodeURIComponent(invoiceId)}/mark-paid?${query.toString()}`,
    { method: 'POST' },
  );
  return normalizeInvoice(invoice);
}

export async function markSystemAdminBillingInvoiceUnpaid(associationId: string, invoiceId: string) {
  const query = new URLSearchParams({ associationId });
  const invoice = await apiRequest<SystemAdminBillingInvoice>(
    `/admin/billing/invoices/${encodeURIComponent(invoiceId)}/mark-unpaid?${query.toString()}`,
    { method: 'POST' },
  );
  return normalizeInvoice(invoice);
}

export function listAdminBillingFeatures(params: { page?: number; size?: number } = {}) {
  const query = new URLSearchParams({
    page: String(params.page ?? 0),
    size: String(params.size ?? 300),
    sort: 'groupKey,asc',
  });
  return apiRequest<unknown>(`/admin/billing/catalog/features?${query.toString()}`).then((payload) =>
    normalizePage<AdminBillingFeature>(payload, params.size ?? 300),
  );
}

export function createAdminBillingFeature(payload: AdminBillingFeaturePayload) {
  return apiRequest<AdminBillingFeature>('/admin/billing/catalog/features', { method: 'POST', body: payload });
}

export function updateAdminBillingFeature(featureId: string, payload: AdminBillingFeaturePayload) {
  return apiRequest<AdminBillingFeature>(`/admin/billing/catalog/features/${encodeURIComponent(featureId)}`, {
    method: 'PUT',
    body: payload,
  });
}

export function listAdminBillingPlans(params: { page?: number; size?: number } = {}) {
  const query = new URLSearchParams({
    page: String(params.page ?? 0),
    size: String(params.size ?? 100),
    sort: 'sortOrder,asc',
  });
  return apiRequest<unknown>(`/admin/billing/catalog/plans?${query.toString()}`).then((payload) =>
    normalizePage<AdminBillingPlan>(payload, params.size ?? 100),
  );
}

export function createAdminBillingPlan(payload: AdminBillingPlanPayload) {
  return apiRequest<AdminBillingPlan>('/admin/billing/catalog/plans', { method: 'POST', body: payload });
}

export function updateAdminBillingPlan(planId: string, payload: AdminBillingPlanPayload) {
  return apiRequest<AdminBillingPlan>(`/admin/billing/catalog/plans/${encodeURIComponent(planId)}`, {
    method: 'PUT',
    body: payload,
  });
}

export function addAdminBillingPlanPrice(planId: string, payload: AdminBillingPlanPricePayload) {
  return apiRequest<AdminBillingPlanPrice>(`/admin/billing/catalog/plans/${encodeURIComponent(planId)}/prices`, {
    method: 'POST',
    body: payload,
  });
}

export function updateAdminBillingPlanFeature(planId: string, featureId: string, payload: AdminBillingPlanFeaturePayload) {
  return apiRequest<AdminBillingPlanFeature>(
    `/admin/billing/catalog/plans/${encodeURIComponent(planId)}/features/${encodeURIComponent(featureId)}`,
    { method: 'PUT', body: payload },
  );
}

export function listAdminBillingSubscriptions(params: { page?: number; size?: number } = {}) {
  const query = new URLSearchParams({
    page: String(params.page ?? 0),
    size: String(params.size ?? 300),
    sort: 'updatedAt,desc',
  });
  return apiRequest<unknown>(`/admin/billing/subscriptions?${query.toString()}`).then((payload) =>
    normalizePage<AdminBillingSubscription>(payload, params.size ?? 300),
  );
}

export function assignAdminBillingSubscription(associationId: string, payload: Required<Pick<AdminBillingSubscriptionPayload, 'planId' | 'billingCycle'>> & AdminBillingSubscriptionPayload) {
  return apiRequest<AdminBillingSubscription>(`/admin/billing/associations/${encodeURIComponent(associationId)}/subscription`, {
    method: 'POST',
    body: payload,
  });
}

export function updateAdminBillingSubscription(subscriptionId: string, payload: AdminBillingSubscriptionPayload) {
  return apiRequest<AdminBillingSubscription>(`/admin/billing/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: 'PUT',
    body: payload,
  });
}

export function suspendAdminBillingSubscription(subscriptionId: string, reason?: string) {
  return apiRequest<AdminBillingSubscription>(`/admin/billing/subscriptions/${encodeURIComponent(subscriptionId)}/suspend`, {
    method: 'POST',
    body: reason ? { reason } : undefined,
  });
}

export function reactivateAdminBillingSubscription(subscriptionId: string) {
  return apiRequest<AdminBillingSubscription>(`/admin/billing/subscriptions/${encodeURIComponent(subscriptionId)}/reactivate`, {
    method: 'POST',
  });
}

export function cancelAdminBillingSubscription(subscriptionId: string, reason?: string) {
  return apiRequest<AdminBillingSubscription>(`/admin/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
    method: 'POST',
    body: reason ? { reason } : undefined,
  });
}

export function upsertAdminBillingSubscriptionOverride(subscriptionId: string, payload: AdminBillingOverridePayload) {
  return apiRequest<AdminBillingOverride>(`/admin/billing/subscriptions/${encodeURIComponent(subscriptionId)}/overrides`, {
    method: 'POST',
    body: payload,
  });
}

export function getAdminBillingAssociationEntitlements(associationId: string) {
  return apiRequest<AdminBillingEntitlements>(`/admin/billing/associations/${encodeURIComponent(associationId)}/entitlements`);
}

export function getNaneBillingUsage(associationId: string) {
  return apiRequest<NaneBillingUsageSummary>(`/admin/billing/associations/${encodeURIComponent(associationId)}/usage`);
}

export function refreshNaneBillingUsage(associationId: string) {
  return apiRequest<NaneBillingUsageSummary>(`/admin/billing/associations/${encodeURIComponent(associationId)}/usage/refresh`, {
    method: 'POST',
  });
}

export function listNaneBillingInvoices(params: {
  associationId?: string;
  status?: NaneBillingInvoiceStatus;
  page?: number;
  size?: number;
} = {}) {
  const query = new URLSearchParams({
    page: String(params.page ?? 0),
    size: String(params.size ?? 100),
    sort: 'createdAt,desc',
  });
  if (params.associationId) query.set('associationId', params.associationId);
  if (params.status) query.set('status', params.status);
  return apiRequest<unknown>(`/admin/billing/platform-invoices?${query.toString()}`).then((payload) =>
    normalizePage<NaneBillingInvoice>(payload, params.size ?? 100),
  );
}

export function generateNaneBillingInvoice(payload: NaneBillingInvoiceGeneratePayload) {
  return apiRequest<NaneBillingInvoice>('/admin/billing/platform-invoices/generate', { method: 'POST', body: payload });
}

export function markNaneBillingInvoicePaid(invoiceId: string, payload?: NaneBillingInvoicePaymentPayload) {
  return apiRequest<NaneBillingInvoice>(`/admin/billing/platform-invoices/${encodeURIComponent(invoiceId)}/mark-paid`, {
    method: 'POST',
    body: payload,
  });
}

export function markNaneBillingInvoiceUnpaid(invoiceId: string, payload?: NaneBillingInvoicePaymentPayload) {
  return apiRequest<NaneBillingInvoice>(`/admin/billing/platform-invoices/${encodeURIComponent(invoiceId)}/mark-unpaid`, {
    method: 'POST',
    body: payload,
  });
}

export function runAdminBillingLifecycle(payload: {
  associationId?: string;
  asOfDate?: string;
  dryRun?: boolean;
}) {
  return apiRequest<AdminBillingLifecycleRun>('/admin/billing/lifecycle/run', { method: 'POST', body: payload });
}

export function listAdminBillingLifecycleNotifications(params: {
  associationId?: string;
  page?: number;
  size?: number;
} = {}) {
  const query = new URLSearchParams({
    page: String(params.page ?? 0),
    size: String(params.size ?? 100),
    sort: 'createdAt,desc',
  });
  if (params.associationId) query.set('associationId', params.associationId);
  return apiRequest<unknown>(`/admin/billing/lifecycle/notifications?${query.toString()}`).then((payload) =>
    normalizePage<AdminBillingLifecycleNotification>(payload, params.size ?? 100),
  );
}

export function getAdminBillingReport(params: { fromDate?: string; toDate?: string } = {}) {
  const query = new URLSearchParams();
  if (params.fromDate) query.set('fromDate', params.fromDate);
  if (params.toDate) query.set('toDate', params.toDate);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<AdminBillingReport>(`/admin/billing/reports/summary${suffix}`);
}

export function exportAdminBillingReportCsv(params: { fromDate?: string; toDate?: string } = {}) {
  const query = new URLSearchParams();
  if (params.fromDate) query.set('fromDate', params.fromDate);
  if (params.toDate) query.set('toDate', params.toDate);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiBinaryRequest(`/admin/billing/reports/export${suffix}`);
}

export function runAdminBillingBackfill(payload: {
  associationId?: string;
  asOfDate?: string;
  dryRun?: boolean;
  planCode?: string;
  currency?: string;
  billingCycle?: NaneBillingCycle;
  priceAmount?: number;
}) {
  return apiRequest<AdminBillingBackfillRun>('/admin/billing/backfill/run', { method: 'POST', body: payload });
}

function normalizeInvoicePage(payload: unknown, fallbackSize: number): SystemAdminBillingInvoicePage {
  const record = toRecord(payload);
  const pageMeta = toRecord(record.page);
  const rawRows = Array.isArray(record.content) ? record.content : Array.isArray(pageMeta.content) ? pageMeta.content : [];

  return {
    invoices: rawRows.map((row) => normalizeInvoice(row as SystemAdminBillingInvoice)).filter((invoice) => Boolean(invoice.id)),
    page: toNumber(pageMeta.number ?? record.number ?? record.page ?? 0),
    size: toNumber(pageMeta.size ?? record.size ?? fallbackSize),
    totalElements: toNumber(pageMeta.totalElements ?? record.totalElements ?? rawRows.length),
    totalPages: toNumber(pageMeta.totalPages ?? record.totalPages ?? 1),
  };
}

function normalizePage<T>(payload: unknown, fallbackSize: number): AdminBillingPage<T> {
  const record = toRecord(payload);
  const nestedData = toRecord(record.data);
  const pageMeta = toRecord(record.page);
  const nestedPageMeta = toRecord(nestedData.page);
  const content =
    arrayValue(record.content) ||
    arrayValue(pageMeta.content) ||
    arrayValue(nestedData.content) ||
    arrayValue(nestedPageMeta.content) ||
    [];

  return {
    content: content as T[],
    page: toNumber(pageMeta.number ?? pageMeta.page ?? nestedPageMeta.number ?? nestedPageMeta.page ?? record.number ?? record.page ?? 0),
    size: toNumber(pageMeta.size ?? nestedPageMeta.size ?? record.size ?? fallbackSize),
    totalElements: toNumber(pageMeta.totalElements ?? nestedPageMeta.totalElements ?? record.totalElements ?? content.length),
    totalPages: toNumber(pageMeta.totalPages ?? nestedPageMeta.totalPages ?? record.totalPages ?? 1),
  };
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value : null;
}

function normalizeInvoice(invoice: Partial<SystemAdminBillingInvoice> | null | undefined): SystemAdminBillingInvoice {
  return {
    id: String(invoice?.id || ''),
    associationId: invoice?.associationId || null,
    associationName: invoice?.associationName || null,
    invoiceNumber: invoice?.invoiceNumber || null,
    status: invoice?.status || 'ISSUED',
    type: invoice?.type || 'GENERAL',
    currency: invoice?.currency || 'TZS',
    netAmount: toNumber(invoice?.netAmount),
    taxAmount: toNumber(invoice?.taxAmount),
    totalAmount: toNumber(invoice?.totalAmount),
    issueDate: invoice?.issueDate || null,
    dueDate: invoice?.dueDate || null,
    paidAt: invoice?.paidAt || null,
    notes: invoice?.notes || null,
    billToName: invoice?.billToName || null,
    billToEmail: invoice?.billToEmail || null,
    billToPhone: invoice?.billToPhone || null,
    billToAddress: invoice?.billToAddress || null,
    billToTin: invoice?.billToTin || null,
    billToVrn: invoice?.billToVrn || null,
    memberName: invoice?.memberName || null,
    memberEmail: invoice?.memberEmail || null,
    memberPhone: invoice?.memberPhone || null,
    membershipNumber: invoice?.membershipNumber || null,
    items: Array.isArray(invoice?.items) ? invoice.items : [],
    createdAt: invoice?.createdAt || null,
    updatedAt: invoice?.updatedAt || null,
  };
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toNumber(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}
