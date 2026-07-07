import { router, useLocalSearchParams } from 'expo-router';
import {
  BarChart3,
  CheckCircle2,
  Copy,
  Edit3,
  Mail,
  MessageCircle,
  MessageSquare,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileCheckboxRow,
  MobileConfirmSheet,
  MobileDataList,
  type MobileDataListItem,
  MobileEmptyState,
  MobileErrorState,
  MobileFilterControls,
  MobileFormSection,
  MobileIconButton,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileReportExportButton,
  MobileScreen,
  MobileSelect,
  MobileSheet,
  MobileStatusBadge,
  MobileText,
  MobileTextInput,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  createCrmCampaign,
  deleteCrmCampaign,
  getCrmCampaign,
  getCrmCampaignReport,
  getCrmCampaigns,
  launchCrmCampaign,
  previewCrmCampaignTargets,
  relaunchCrmCampaign,
  stopCrmCampaign,
  updateCrmCampaign,
  type CampaignStatus,
  type CampaignType,
  type CrmCampaign,
  type CrmCampaignPayload,
  type CrmCampaignReport,
} from '@/services/crm-service';
import { type KpiTone, type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber } from '@/utils/format';

type StatusFilter = 'ALL' | 'DRAFT' | 'SENDING' | 'COMPLETED' | 'FAILED';
type FormMode = 'create' | 'edit' | 'duplicate';
type AudiencePreset = 'ALL' | 'ACTIVE' | 'PENDING' | 'PARTIAL' | 'UNDER_REVIEW' | 'SUSPENDED' | 'INACTIVE' | 'REJECTED' | 'TERMINATED' | 'CUSTOM';
type PendingAction = 'launch' | 'stop' | 'relaunch' | 'delete' | null;

type FormState = {
  id?: string;
  name: string;
  campaignType: CampaignType;
  audience: AudiencePreset;
  customCriteria: string;
  emailSubject: string;
  emailHtmlBody: string;
  smsMessageBody: string;
  scheduledAt: string;
  scheduleTimezone: string;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
};

const PAGE_SIZE = 25;
const SMS_MAX_CHARS = 160 * 3;

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  SENDING: 'Sending',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
};

const campaignTypeLabels: Record<string, string> = {
  EMAIL: 'Email',
  SMS: 'SMS',
  WHATSAPP: 'WhatsApp',
};

const campaignTypeOptions = [
  { value: 'SMS', label: 'SMS' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
];

const audienceOptions = [
  { value: 'ALL', label: 'All association members' },
  { value: 'ACTIVE', label: 'Active members' },
  { value: 'PENDING', label: 'Pending members' },
  { value: 'PARTIAL', label: 'Partially registered' },
  { value: 'UNDER_REVIEW', label: 'Under review' },
  { value: 'SUSPENDED', label: 'Suspended members' },
  { value: 'INACTIVE', label: 'Inactive members' },
  { value: 'REJECTED', label: 'Rejected members' },
  { value: 'TERMINATED', label: 'Terminated members' },
  { value: 'CUSTOM', label: 'Custom criteria' },
];

const emptyForm = (): FormState => ({
  name: '',
  campaignType: 'SMS',
  audience: 'ALL',
  customCriteria: '',
  emailSubject: '',
  emailHtmlBody: '',
  smsMessageBody: '',
  scheduledAt: '',
  scheduleTimezone: 'Africa/Nairobi',
  quietHoursEnabled: false,
  quietHoursStart: '21:00',
  quietHoursEnd: '08:00',
});

export default function MobileCrmCampaignsScreen() {
  const params = useLocalSearchParams();
  const { activeView, associationId, user } = useAuth();
  const [campaigns, setCampaigns] = useState<CrmCampaign[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [selectedCampaign, setSelectedCampaign] = useState<CrmCampaign | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [report, setReport] = useState<CrmCampaignReport | null>(null);
  const initialMode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const initialCampaignId = Array.isArray(params.campaignId) ? params.campaignId[0] : params.campaignId;
  const [formMode, setFormMode] = useState<FormMode | null>(() => (initialMode === 'create' ? 'create' : null));
  const initialDetailConsumed = useRef(false);
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [previewTotal, setPreviewTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionCampaign, setActionCampaign] = useState<CrmCampaign | null>(null);

  const loadCampaigns = useCallback(
    async (mode: 'initial' | 'refresh' | 'more' = 'initial', nextPage = 0) => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before opening CRM campaigns.');
        return;
      }
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      if (mode === 'more') setLoadingMore(true);
      setError(null);

      try {
        const response = await getCrmCampaigns(associationId, {
          page: nextPage,
          size: PAGE_SIZE,
          status: statusFilter,
          search: searchTerm,
          sort: 'createdAt,desc',
        });
        setPage(response.page);
        setTotalPages(response.totalPages);
        setTotalElements(response.totalElements);
        setCampaigns((current) => (mode === 'more' ? mergeCampaigns(current, response.campaigns) : response.campaigns));
      } catch (loadError) {
        setError(getApiErrorMessage(loadError));
        if (mode !== 'more') {
          setCampaigns([]);
          setTotalPages(0);
          setTotalElements(0);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [associationId, searchTerm, statusFilter],
  );

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (active) void loadCampaigns('initial', 0);
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [loadCampaigns]);

  const metrics = useMemo(() => {
    const loadedTotal = campaigns.length;
    return {
      total: totalElements || loadedTotal,
      sending: campaigns.filter((campaign) => campaign.status === 'SENDING').length,
      completed: campaigns.filter((campaign) => campaign.status === 'COMPLETED').length,
      failed: campaigns.filter((campaign) => campaign.status === 'FAILED').length,
      recipients: campaigns.reduce((sum, campaign) => sum + Number(campaign.totalRecipientsCalculated || 0), 0),
    };
  }, [campaigns, totalElements]);

  const tabs = useMemo(
    () => [
      { value: 'ALL', label: 'All', count: totalElements || campaigns.length },
      { value: 'DRAFT', label: 'Draft', count: campaigns.filter((item) => item.status === 'DRAFT').length },
      { value: 'SENDING', label: 'Sending', count: campaigns.filter((item) => item.status === 'SENDING').length },
      { value: 'COMPLETED', label: 'Done', count: campaigns.filter((item) => item.status === 'COMPLETED').length },
      { value: 'FAILED', label: 'Failed', count: campaigns.filter((item) => item.status === 'FAILED').length },
    ],
    [campaigns, totalElements],
  );

  const listItems = useMemo<MobileDataListItem[]>(
    () =>
      campaigns.map((campaign) => ({
        id: campaign.id,
        title: campaign.name,
        subtitle: `${campaignTypeLabels[campaign.campaignType] || campaign.campaignType} · ${formatTargetCriteria(campaign.targetCriteria)}`,
        meta: `Created ${formatDate(campaign.createdAt)}`,
        amount: formatCampaignProgress(campaign),
        status: statusLabels[campaign.status] || campaign.status,
        statusTone: statusTone(campaign.status),
        initials: typeInitials(campaign.campaignType),
        accent: typeStatusTone(campaign.campaignType),
      })),
    [campaigns],
  );

  const campaignReportOptions = useMemo(
    () => ({
      title: 'CRM Campaigns',
      associationName: user?.associationName || 'Association',
      purpose: 'A loaded-view report of CRM campaigns, target audience, delivery progress, and status.',
      rows: campaigns,
      fileName: 'nane-crm-campaigns',
      metrics: [
        { label: 'Campaigns', value: formatNumber(metrics.total), helper: 'Matching current filters' },
        { label: 'Sending', value: formatNumber(metrics.sending), helper: 'Currently in progress' },
        { label: 'Completed', value: formatNumber(metrics.completed), helper: 'Finished campaigns' },
        { label: 'Recipients', value: formatNumber(metrics.recipients), helper: 'Loaded target count' },
      ],
      filters: [
        { label: 'Search', value: searchTerm || 'All' },
        { label: 'Status', value: tabs.find((tab) => tab.value === statusFilter)?.label || statusFilter },
        { label: 'Loaded rows', value: `${formatNumber(campaigns.length)} of ${formatNumber(totalElements || campaigns.length)}` },
      ],
      columns: [
        { key: 'name', label: 'Campaign', width: '20%', value: (row: CrmCampaign) => row.name || '-' },
        { key: 'type', label: 'Type', width: '10%', value: (row: CrmCampaign) => campaignTypeLabels[row.campaignType] || row.campaignType },
        { key: 'status', label: 'Status', width: '11%', value: (row: CrmCampaign) => statusLabels[row.status] || row.status },
        { key: 'audience', label: 'Audience', width: '20%', value: (row: CrmCampaign) => formatTargetCriteria(row.targetCriteria) },
        { key: 'recipients', label: 'Recipients', align: 'right' as const, width: '11%', value: (row: CrmCampaign) => formatNumber(Number(row.totalRecipientsCalculated || 0)) },
        { key: 'sent', label: 'Sent', align: 'right' as const, width: '10%', value: (row: CrmCampaign) => formatNumber(Number(row.totalSent || 0)) },
        { key: 'failed', label: 'Failed', align: 'right' as const, width: '10%', value: (row: CrmCampaign) => formatNumber(Number(row.totalFailed || 0)) },
        { key: 'createdAt', label: 'Created', width: '12%', value: (row: CrmCampaign) => formatDate(row.createdAt) },
      ],
    }),
    [campaigns, metrics, searchTerm, statusFilter, tabs, totalElements, user?.associationName],
  );

  const openDetails = useCallback(async (item: MobileDataListItem) => {
    const local = campaigns.find((campaign) => campaign.id === item.id);
    if (local) {
      setSelectedCampaign(local);
      setDetailOpen(true);
    }
    setDetailLoading(true);
    try {
      const full = await getCrmCampaign(item.id);
      setSelectedCampaign(full);
      setDetailOpen(true);
    } catch (detailError) {
      setError(getApiErrorMessage(detailError));
    } finally {
      setDetailLoading(false);
    }
  }, [campaigns]);

  useEffect(() => {
    if (!initialCampaignId || initialDetailConsumed.current || formMode || campaigns.length === 0) return;
    const campaign = campaigns.find((item) => item.id === initialCampaignId);
    if (!campaign) return;
    initialDetailConsumed.current = true;
    const timer = setTimeout(() => {
      void openDetails({
        id: campaign.id,
        title: campaign.name,
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [campaigns, formMode, initialCampaignId, openDetails]);

  const openCreate = () => {
    setForm(emptyForm());
    setValidationErrors({});
    setPreviewTotal(null);
    setNotice(null);
    setFormMode('create');
    setDetailOpen(false);
  };

  const openEdit = (campaign: CrmCampaign) => {
    setForm(formFromCampaign(campaign));
    setValidationErrors({});
    setPreviewTotal(null);
    setFormMode('edit');
    setDetailOpen(false);
  };

  const openDuplicate = (campaign: CrmCampaign) => {
    setForm({ ...formFromCampaign(campaign), id: undefined, name: `${campaign.name} Copy` });
    setValidationErrors({});
    setPreviewTotal(null);
    setFormMode('duplicate');
    setDetailOpen(false);
  };

  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setValidationErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    if (field === 'audience' || field === 'customCriteria') setPreviewTotal(null);
  };

  const buildPayload = () => {
    if (!associationId) throw new Error('Association context is required.');
    const targetCriteriaString = targetCriteriaFromForm(form);
    const payload: CrmCampaignPayload = {
      name: form.name.trim(),
      campaignType: form.campaignType,
      associationId,
      targetCriteriaString,
      targetCriteriaJson: null,
      selectedMemberIds: [],
      excludedMemberIds: [],
      scheduledAt: form.scheduledAt.trim() || null,
      scheduleTimezone: form.scheduledAt.trim() ? form.scheduleTimezone : null,
      emailSubject: form.campaignType === 'EMAIL' ? textOrNull(form.emailSubject) : null,
      emailHtmlBody: form.campaignType === 'EMAIL' ? textOrNull(form.emailHtmlBody) : null,
      smsMessageBody: form.campaignType === 'SMS' || form.campaignType === 'WHATSAPP' ? textOrNull(form.smsMessageBody) : null,
      quietHoursEnabled: form.campaignType === 'SMS' ? form.quietHoursEnabled : false,
      quietHoursStart: form.campaignType === 'SMS' && form.quietHoursEnabled ? form.quietHoursStart : null,
      quietHoursEnd: form.campaignType === 'SMS' && form.quietHoursEnabled ? form.quietHoursEnd : null,
    };
    return payload;
  };

  const previewAudience = async () => {
    const nextErrors = validateForm(form, { allowEmptyMessage: true });
    setValidationErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError('Please correct the highlighted fields before previewing the audience.');
      return;
    }
    setPreviewing(true);
    setError(null);
    try {
      const response = await previewCrmCampaignTargets(buildPayload(), 0, 10);
      setPreviewTotal(response.totalElements);
      setNotice(`Audience preview found ${formatNumber(response.totalElements)} matching member${response.totalElements === 1 ? '' : 's'}.`);
    } catch (previewError) {
      setError(getApiErrorMessage(previewError));
    } finally {
      setPreviewing(false);
    }
  };

  const saveCampaign = async () => {
    const nextErrors = validateForm(form);
    setValidationErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError('Please correct the highlighted fields before saving this campaign.');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = buildPayload();
      const saved = formMode === 'edit' && form.id
        ? await updateCrmCampaign(form.id, payload)
        : await createCrmCampaign(payload);
      setNotice(`Campaign "${saved.name}" saved as a draft.`);
      setFormMode(null);
      setSelectedCampaign(saved);
      await loadCampaigns('refresh', 0);
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const openReport = async (campaign: CrmCampaign) => {
    setReportOpen(true);
    setReport(null);
    setReportLoading(true);
    try {
      const nextReport = await getCrmCampaignReport(campaign.id);
      setSelectedCampaign(campaign);
      setReport(nextReport);
    } catch (reportError) {
      setError(getApiErrorMessage(reportError));
    } finally {
      setReportLoading(false);
    }
  };

  const askAction = (campaign: CrmCampaign, action: PendingAction) => {
    setActionCampaign(campaign);
    setPendingAction(action);
  };

  const confirmAction = async () => {
    if (!actionCampaign || !pendingAction) return;
    setActionBusy(actionCampaign.id);
    setError(null);
    try {
      if (pendingAction === 'launch') {
        const updated = await launchCrmCampaign(actionCampaign.id);
        updateCampaignInState(updated);
        setSelectedCampaign(updated);
        setNotice(`Campaign "${updated.name}" has been launched.`);
      } else if (pendingAction === 'stop') {
        const updated = await stopCrmCampaign(actionCampaign.id);
        updateCampaignInState(updated);
        setSelectedCampaign(updated);
        setNotice(`Campaign "${updated.name}" has been stopped.`);
      } else if (pendingAction === 'relaunch') {
        const updated = await relaunchCrmCampaign(actionCampaign.id);
        updateCampaignInState(updated);
        setSelectedCampaign(updated);
        setNotice(`Campaign "${updated.name}" has been relaunched.`);
      } else if (pendingAction === 'delete') {
        await deleteCrmCampaign(actionCampaign.id);
        setNotice(`Campaign "${actionCampaign.name}" has been deleted.`);
        setSelectedCampaign(null);
        setDetailOpen(false);
        await loadCampaigns('refresh', 0);
      }
    } catch (actionError) {
      setError(getApiErrorMessage(actionError));
    } finally {
      setActionBusy(null);
      setActionCampaign(null);
      setPendingAction(null);
    }
  };

  const updateCampaignInState = (campaign: CrmCampaign) => {
    setCampaigns((current) => current.map((item) => (item.id === campaign.id ? campaign : item)));
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Association admin only" description="CRM campaigns are available from the association admin workspace." />;
  }

  if (loading && campaigns.length === 0) {
    return <MobilePageLoadingState kind="list" message="Loading CRM campaigns" />;
  }

  if (formMode) {
    return (
      <MobileScreen>
        <MobilePageHeader
          title={formMode === 'edit' ? 'Edit Campaign' : formMode === 'duplicate' ? 'Duplicate Campaign' : 'Create Campaign'}
          eyebrow="CRM"
          subtitle="Prepare a targeted communication draft before launching."
          onBack={() => setFormMode(null)}
        />

        {error ? <MobileErrorState title="Campaign form issue" description={error} onRetry={() => setError(null)} retryLabel="Dismiss" /> : null}
        {notice ? (
          <MobileCard compact accent="green">
            <View style={styles.noticeRow}>
              <CheckCircle2 size={18} color="#15803D" />
              <MobileText variant="small" weight="bold" style={styles.noticeText}>
                {notice}
              </MobileText>
            </View>
          </MobileCard>
        ) : null}

        <MobileCard compact accent={typeCardTone(form.campaignType)}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCopy}>
              <MobileText variant="section" weight="bold">
                {form.name || 'Untitled campaign'}
              </MobileText>
              <MobileText variant="small" tone="secondary">
                {campaignTypeLabels[form.campaignType] || form.campaignType} · {formatTargetCriteria(targetCriteriaFromForm(form))}
              </MobileText>
            </View>
            <MobileStatusBadge status="Draft" tone="neutral" />
          </View>
          {typeof previewTotal === 'number' ? (
            <MobileText variant="small" weight="bold" style={styles.previewText}>
              Preview audience: {formatNumber(previewTotal)} member{previewTotal === 1 ? '' : 's'}
            </MobileText>
          ) : null}
        </MobileCard>

        <MobileFormSection title="Campaign Basics" description="Name the campaign and choose the delivery channel.">
          <MobileTextInput
            label="Campaign Name *"
            value={form.name}
            onChangeText={(value) => updateField('name', value)}
            placeholder="Weekly member reminder"
            error={validationErrors.name}
            icon={Send}
          />
          <MobileSelect
            label="Campaign Type"
            value={String(form.campaignType)}
            options={campaignTypeOptions}
            onChange={(value) => updateField('campaignType', value)}
          />
        </MobileFormSection>

        <MobileFormSection title="Audience" description="Use safe presets or paste advanced backend criteria.">
          <MobileSelect
            label="Target Audience"
            value={form.audience}
            options={audienceOptions}
            onChange={(value) => updateField('audience', value as AudiencePreset)}
          />
          {form.audience === 'CUSTOM' ? (
            <MobileTextInput
              label="Custom Criteria *"
              value={form.customCriteria}
              onChangeText={(value) => updateField('customCriteria', value)}
              placeholder="STATUS:ACTIVE"
              autoCapitalize="none"
              error={validationErrors.customCriteria}
              icon={Users}
            />
          ) : null}
          <MobileButton
            label="Preview Audience"
            icon={Users}
            variant="secondary"
            onPress={previewAudience}
            loading={previewing}
            disabled={previewing || saving}
          />
        </MobileFormSection>

        <MobileFormSection title="Message" description="Required fields change based on the campaign type.">
          {form.campaignType === 'EMAIL' ? (
            <>
              <MobileTextInput
                label="Email Subject *"
                value={form.emailSubject}
                onChangeText={(value) => updateField('emailSubject', value)}
                placeholder="Important member update"
                error={validationErrors.emailSubject}
                icon={Mail}
              />
              <MobileTextInput
                label="Email Body *"
                value={form.emailHtmlBody}
                onChangeText={(value) => updateField('emailHtmlBody', value)}
                placeholder="Write the email body or HTML content"
                multiline
                numberOfLines={6}
                error={validationErrors.emailHtmlBody}
                icon={Mail}
              />
            </>
          ) : (
            <MobileTextInput
              label={form.campaignType === 'WHATSAPP' ? 'WhatsApp Message *' : 'SMS Message *'}
              value={form.smsMessageBody}
              onChangeText={(value) => updateField('smsMessageBody', value)}
              placeholder="Write a clear message for members"
              multiline
              numberOfLines={5}
              error={validationErrors.smsMessageBody}
              icon={form.campaignType === 'WHATSAPP' ? MessageCircle : MessageSquare}
            />
          )}
        </MobileFormSection>

        <MobileFormSection title="Scheduling & Quiet Hours" description="Optional scheduling and SMS quiet-hour controls.">
          <MobileTextInput
            label="Scheduled At"
            value={form.scheduledAt}
            onChangeText={(value) => updateField('scheduledAt', value)}
            placeholder="YYYY-MM-DDTHH:mm:ss"
            autoCapitalize="none"
            error={validationErrors.scheduledAt}
          />
          <MobileTextInput
            label="Schedule Timezone"
            value={form.scheduleTimezone}
            onChangeText={(value) => updateField('scheduleTimezone', value)}
            placeholder="Africa/Nairobi"
            autoCapitalize="none"
          />
          <MobileCheckboxRow
            label="SMS quiet hours"
            description="Prevent SMS campaigns from sending during the configured quiet window."
            checked={form.quietHoursEnabled}
            onChange={(checked) => updateField('quietHoursEnabled', checked)}
            disabled={form.campaignType !== 'SMS'}
          />
          {form.campaignType === 'SMS' && form.quietHoursEnabled ? (
            <View style={styles.twoColumn}>
              <MobileTextInput
                label="Quiet Start"
                value={form.quietHoursStart}
                onChangeText={(value) => updateField('quietHoursStart', value)}
                placeholder="21:00"
                error={validationErrors.quietHoursStart}
              />
              <MobileTextInput
                label="Quiet End"
                value={form.quietHoursEnd}
                onChangeText={(value) => updateField('quietHoursEnd', value)}
                placeholder="08:00"
                error={validationErrors.quietHoursEnd}
              />
            </View>
          ) : null}
        </MobileFormSection>

        <View style={styles.actions}>
          <MobileButton label="Cancel" variant="secondary" onPress={() => setFormMode(null)} disabled={saving} />
          <MobileButton label={saving ? 'Saving...' : 'Save Draft'} icon={Send} onPress={saveCampaign} loading={saving} disabled={saving} />
        </View>
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        title="CRM Campaigns"
        eyebrow="CRM"
        subtitle="Create, monitor and manage member communication campaigns."
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh" onPress={() => void loadCampaigns('refresh', 0)} disabled={refreshing} />}
      />

      {error ? <MobileErrorState title="CRM issue" description={error} onRetry={() => void loadCampaigns('refresh', 0)} /> : null}
      {notice ? (
        <MobileCard compact accent="green">
          <View style={styles.noticeRow}>
            <CheckCircle2 size={18} color="#15803D" />
            <MobileText variant="small" weight="bold" style={styles.noticeText}>
              {notice}
            </MobileText>
          </View>
        </MobileCard>
      ) : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Campaigns" value={formatNumber(metrics.total)} description="Matching current filters" tone="purple" icon={Send} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Sending" value={formatNumber(metrics.sending)} description="Currently in progress" tone="orange" icon={PlayCircle} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Completed" value={formatNumber(metrics.completed)} description="Finished campaigns" tone="green" icon={CheckCircle2} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Recipients" value={formatNumber(metrics.recipients)} description="Loaded target count" tone="blue" icon={Users} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileFilterControls
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search campaigns or targeting..."
        tabs={tabs}
        value={statusFilter}
        onChange={(value) => setStatusFilter(value as StatusFilter)}
        primaryAction={{ label: 'Create', icon: Plus, onPress: openCreate }}
        actionSlot={<MobileReportExportButton fullWidth options={campaignReportOptions} onSuccess={(_uri, format) => setNotice(`${format.toUpperCase()} campaign report is ready.`)} onError={(exportError) => setError(getApiErrorMessage(exportError))} />}
      />

      {campaigns.length === 0 && !loading ? (
        <MobileEmptyState
          title="No campaigns found"
          description="Create a campaign draft or adjust your filters to see communication activity."
          actionLabel="Create Campaign"
          onAction={openCreate}
        />
      ) : (
        <MobileDataList items={listItems} onPressItem={openDetails} />
      )}

      {page + 1 < totalPages ? (
        <MobileButton
          label={loadingMore ? 'Loading...' : 'Load More'}
          variant="secondary"
          onPress={() => void loadCampaigns('more', page + 1)}
          loading={loadingMore}
          disabled={loadingMore}
          fullWidth
        />
      ) : null}

      <MobileSheet
        visible={detailOpen}
        title={selectedCampaign?.name || 'Campaign details'}
        description={selectedCampaign ? `${campaignTypeLabels[selectedCampaign.campaignType] || selectedCampaign.campaignType} campaign` : undefined}
        onClose={() => setDetailOpen(false)}
      >
        {selectedCampaign ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>
            <View style={styles.sheetBadges}>
              <MobileStatusBadge status={statusLabels[selectedCampaign.status] || selectedCampaign.status} tone={statusTone(selectedCampaign.status)} />
              <MobileStatusBadge status={campaignTypeLabels[selectedCampaign.campaignType] || selectedCampaign.campaignType} tone={typeStatusTone(selectedCampaign.campaignType)} />
            </View>
            <MobileKpiGrid>
              <MobileKpiGridItem>
                <MobileKpiCard title="Recipients" value={formatNumber(selectedCampaign.totalRecipientsCalculated || 0)} tone="blue" icon={Users} />
              </MobileKpiGridItem>
              <MobileKpiGridItem>
                <MobileKpiCard title="Sent" value={formatNumber(selectedCampaign.totalSent || 0)} tone="green" icon={CheckCircle2} />
              </MobileKpiGridItem>
              <MobileKpiGridItem>
                <MobileKpiCard title="Failed" value={formatNumber(selectedCampaign.totalFailed || 0)} tone="red" icon={XCircle} />
              </MobileKpiGridItem>
            </MobileKpiGrid>
            <MobileCard compact>
              <MobileInfoRow label="Target Audience" value={formatTargetCriteria(selectedCampaign.targetCriteria)} icon={Users} />
              <MobileInfoRow label="Created" value={formatDate(selectedCampaign.createdAt)} helper={selectedCampaign.createdByFullName || undefined} />
              <MobileInfoRow label="Updated" value={formatDate(selectedCampaign.updatedAt)} />
              {selectedCampaign.startedAt ? <MobileInfoRow label="Started" value={formatDate(selectedCampaign.startedAt)} /> : null}
              {selectedCampaign.completedAt ? <MobileInfoRow label="Completed" value={formatDate(selectedCampaign.completedAt)} /> : null}
              {selectedCampaign.scheduledAt ? <MobileInfoRow label="Scheduled" value={formatDate(selectedCampaign.scheduledAt)} helper={selectedCampaign.scheduleTimezone || undefined} /> : null}
            </MobileCard>
            <MobileCard compact accent={typeCardTone(selectedCampaign.campaignType)}>
              <MobileText variant="body" weight="bold">
                Message Preview
              </MobileText>
              {selectedCampaign.campaignType === 'EMAIL' ? (
                <>
                  <MobileText variant="small" weight="bold">
                    {selectedCampaign.emailSubject || 'No subject'}
                  </MobileText>
                  <MobileText variant="small" tone="secondary" numberOfLines={6}>
                    {stripHtml(selectedCampaign.emailHtmlBody || 'No email body saved.')}
                  </MobileText>
                </>
              ) : (
                <MobileText variant="small" tone="secondary" numberOfLines={6}>
                  {selectedCampaign.smsMessageBody || 'No message body saved.'}
                </MobileText>
              )}
            </MobileCard>
            <View style={styles.detailActions}>
              <MobileButton label="Report" icon={BarChart3} variant="secondary" onPress={() => void openReport(selectedCampaign)} size="sm" />
              <MobileButton label="Edit" icon={Edit3} variant="secondary" onPress={() => openEdit(selectedCampaign)} disabled={selectedCampaign.status !== 'DRAFT'} size="sm" />
              <MobileButton label="Duplicate" icon={Copy} variant="secondary" onPress={() => openDuplicate(selectedCampaign)} size="sm" />
              {selectedCampaign.status === 'DRAFT' ? (
                <MobileButton label="Launch" icon={PlayCircle} onPress={() => askAction(selectedCampaign, 'launch')} loading={actionBusy === selectedCampaign.id} size="sm" />
              ) : null}
              {selectedCampaign.status === 'SENDING' ? (
                <MobileButton label="Stop" icon={PauseCircle} variant="danger" onPress={() => askAction(selectedCampaign, 'stop')} loading={actionBusy === selectedCampaign.id} size="sm" />
              ) : null}
              {selectedCampaign.status === 'FAILED' ? (
                <MobileButton label="Relaunch" icon={RotateCcw} onPress={() => askAction(selectedCampaign, 'relaunch')} loading={actionBusy === selectedCampaign.id} size="sm" />
              ) : null}
              <MobileButton label="Delete" icon={Trash2} variant="danger" onPress={() => askAction(selectedCampaign, 'delete')} loading={actionBusy === selectedCampaign.id} size="sm" />
            </View>
            {detailLoading ? (
              <MobileText variant="small" tone="secondary">
                Refreshing campaign details...
              </MobileText>
            ) : null}
          </ScrollView>
        ) : null}
      </MobileSheet>

      <MobileSheet
        visible={reportOpen}
        title="Campaign Report"
        description={selectedCampaign?.name}
        onClose={() => setReportOpen(false)}
      >
        {reportLoading ? (
          <MobilePageLoadingState kind="list" message="Loading report" fullScreen={false} />
        ) : report ? (
          <MobileKpiGrid>
            <MobileKpiGridItem>
              <MobileKpiCard title="Logs" value={formatNumber(report.totalLogs)} tone="blue" icon={BarChart3} />
            </MobileKpiGridItem>
            <MobileKpiGridItem>
              <MobileKpiCard title="Delivered" value={formatNumber(report.delivered)} tone="green" icon={CheckCircle2} />
            </MobileKpiGridItem>
            <MobileKpiGridItem>
              <MobileKpiCard title="Failed" value={formatNumber(report.failedToSend)} tone="red" icon={XCircle} />
            </MobileKpiGridItem>
            <MobileKpiGridItem>
              <MobileKpiCard title="Opened" value={formatNumber(report.opened)} tone="purple" icon={Mail} />
            </MobileKpiGridItem>
          </MobileKpiGrid>
        ) : (
          <MobileEmptyState title="No report data" description="No delivery report is available for this campaign yet." />
        )}
      </MobileSheet>

      <MobileConfirmSheet
        visible={Boolean(pendingAction)}
        title={confirmTitle(pendingAction)}
        description={confirmDescription(pendingAction, actionCampaign)}
        confirmLabel={confirmLabel(pendingAction)}
        destructive={pendingAction === 'delete' || pendingAction === 'stop'}
        onCancel={() => {
          setPendingAction(null);
          setActionCampaign(null);
        }}
        onConfirm={confirmAction}
      />
    </MobileScreen>
  );
}

function mergeCampaigns(current: CrmCampaign[], incoming: CrmCampaign[]) {
  const map = new Map(current.map((campaign) => [campaign.id, campaign]));
  incoming.forEach((campaign) => map.set(campaign.id, campaign));
  return Array.from(map.values());
}

function formFromCampaign(campaign: CrmCampaign): FormState {
  const audience = audienceFromCriteria(campaign.targetCriteria);
  return {
    id: campaign.id,
    name: campaign.name || '',
    campaignType: campaign.campaignType || 'SMS',
    audience,
    customCriteria: audience === 'CUSTOM' ? campaign.targetCriteria || '' : '',
    emailSubject: campaign.emailSubject || '',
    emailHtmlBody: campaign.emailHtmlBody || '',
    smsMessageBody: campaign.smsMessageBody || '',
    scheduledAt: toLocalDateTimeText(campaign.scheduledAt),
    scheduleTimezone: campaign.scheduleTimezone || 'Africa/Nairobi',
    quietHoursEnabled: campaign.quietHoursEnabled === true,
    quietHoursStart: campaign.quietHoursStart || '21:00',
    quietHoursEnd: campaign.quietHoursEnd || '08:00',
  };
}

function validateForm(form: FormState, options: { allowEmptyMessage?: boolean } = {}) {
  const errors: Record<string, string> = {};
  if (!form.name.trim()) errors.name = 'Campaign name is required.';
  if (!form.campaignType) errors.campaignType = 'Campaign type is required.';
  if (form.audience === 'CUSTOM' && !form.customCriteria.trim()) errors.customCriteria = 'Custom criteria is required.';

  if (!options.allowEmptyMessage) {
    if (form.campaignType === 'EMAIL') {
      if (!form.emailSubject.trim()) errors.emailSubject = 'Email subject is required.';
      if (!form.emailHtmlBody.trim()) errors.emailHtmlBody = 'Email body is required.';
    } else {
      if (!form.smsMessageBody.trim()) errors.smsMessageBody = `${campaignTypeLabels[form.campaignType] || 'Message'} body is required.`;
      if (form.campaignType === 'SMS' && form.smsMessageBody.length > SMS_MAX_CHARS) {
        errors.smsMessageBody = `SMS is too long. Use ${SMS_MAX_CHARS} characters or fewer.`;
      }
    }
  }

  if (form.scheduledAt.trim() && Number.isNaN(new Date(form.scheduledAt).getTime())) {
    errors.scheduledAt = 'Use YYYY-MM-DDTHH:mm:ss.';
  }
  if (form.quietHoursEnabled) {
    if (!isValidTime(form.quietHoursStart)) errors.quietHoursStart = 'Use HH:mm.';
    if (!isValidTime(form.quietHoursEnd)) errors.quietHoursEnd = 'Use HH:mm.';
  }
  return errors;
}

function audienceFromCriteria(criteria?: string | null): AudiencePreset {
  const value = (criteria || '').trim().toUpperCase();
  if (!value || value === 'ALL_MEMBERS' || value === 'ALL_IN_ASSOCIATION' || value === 'ALL_IN_ASSOCIATION:TRUE') return 'ALL';
  if (value.startsWith('STATUS:')) {
    const status = value.replace('STATUS:', '') as AudiencePreset;
    if (audienceOptions.some((option) => option.value === status)) return status;
  }
  return 'CUSTOM';
}

function targetCriteriaFromForm(form: FormState) {
  if (form.audience === 'CUSTOM') return form.customCriteria.trim();
  if (form.audience === 'ALL') return 'ALL_IN_ASSOCIATION:true';
  return `STATUS:${form.audience}`;
}

function formatTargetCriteria(criteria?: string | null) {
  const audience = audienceFromCriteria(criteria);
  if (audience !== 'CUSTOM') {
    return audienceOptions.find((option) => option.value === audience)?.label || audience;
  }
  return (criteria || 'Custom criteria').replace(/_/g, ' ');
}

function formatCampaignProgress(campaign: CrmCampaign) {
  if (campaign.status === 'COMPLETED' || campaign.status === 'SENDING') {
    return `${formatNumber(campaign.totalSent || 0)} / ${formatNumber(campaign.totalRecipientsCalculated || 0)}`;
  }
  if (campaign.status === 'FAILED') {
    return `${formatNumber(campaign.totalFailed || 0)} failed`;
  }
  return `${formatNumber(campaign.totalRecipientsCalculated || 0)} targets`;
}

function statusTone(status?: CampaignStatus | null): StatusTone {
  if (status === 'COMPLETED') return 'success';
  if (status === 'SENDING') return 'warning';
  if (status === 'FAILED') return 'danger';
  return 'neutral';
}

function typeStatusTone(type?: CampaignType | null): StatusTone {
  if (type === 'EMAIL') return 'primary';
  if (type === 'WHATSAPP') return 'success';
  return 'info';
}

function typeCardTone(type?: CampaignType | null): KpiTone {
  if (type === 'EMAIL') return 'blue';
  if (type === 'WHATSAPP') return 'green';
  return 'teal';
}

function typeInitials(type?: CampaignType | null) {
  if (type === 'EMAIL') return 'EM';
  if (type === 'WHATSAPP') return 'WA';
  return 'SM';
}

function textOrNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toLocalDateTimeText(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 19);
}

function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function confirmTitle(action: PendingAction) {
  if (action === 'launch') return 'Launch campaign';
  if (action === 'stop') return 'Stop campaign';
  if (action === 'relaunch') return 'Relaunch campaign';
  if (action === 'delete') return 'Delete campaign';
  return 'Confirm action';
}

function confirmLabel(action: PendingAction) {
  if (action === 'launch') return 'Launch';
  if (action === 'stop') return 'Stop';
  if (action === 'relaunch') return 'Relaunch';
  if (action === 'delete') return 'Delete';
  return 'Confirm';
}

function confirmDescription(action: PendingAction, campaign: CrmCampaign | null) {
  const name = campaign?.name || 'this campaign';
  if (action === 'launch') return `Launching "${name}" starts sending messages to the targeted audience.`;
  if (action === 'stop') return `Stopping "${name}" interrupts a campaign in progress. Messages already sent cannot be recalled.`;
  if (action === 'relaunch') return `Relaunching "${name}" retries a failed campaign.`;
  if (action === 'delete') return `Deleting "${name}" permanently removes the campaign draft/history entry.`;
  return 'Please confirm this campaign action.';
}

const styles = StyleSheet.create({
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  noticeText: {
    flex: 1,
    color: '#15803D',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  previewText: {
    color: '#2563EB',
  },
  twoColumn: {
    gap: 12,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sheetScroll: {
    gap: 14,
    paddingBottom: 14,
  },
  sheetBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
