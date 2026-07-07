import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Mail,
  Megaphone,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Send,
  User,
  X,
  XCircle,
  Zap,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileConfirmSheet,
  MobileDataList,
  type MobileDataListItem,
  MobileEmptyState,
  MobileErrorState,
  MobileFileUpload,
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
  MobileSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileSummaryPanel,
  MobileText,
  MobileTextInput,
  MobileToast,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  broadcastSystemAdminEmail,
  broadcastSystemAdminSms,
  getSystemAdminEmailBreakdown,
  listSystemAdminEmailEvents,
  type SystemAdminBroadcastResult,
  type SystemAdminEmailBreakdown,
  type SystemAdminEmailEvent,
  type SystemAdminMessagingAttachment,
} from '@/services/system-admin-messaging-service';
import { labelFromStatus, type KpiTone, type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber, formatPercent, initialsFromName } from '@/utils/format';

type MessagingMode = 'detail' | 'broadcast' | 'sms';
type BroadcastChannel = 'EMAIL' | 'SMS';

type MobileSystemAdminMessagingScreenProps = {
  initialMode?: MessagingMode;
  initialStatus?: string;
};

type BroadcastForm = {
  channel: BroadcastChannel;
  subject: string;
  body: string;
  attachments: SystemAdminMessagingAttachment[];
};

const emptyBroadcastForm: BroadcastForm = {
  channel: 'EMAIL',
  subject: '',
  body: '',
  attachments: [],
};

const MAX_SMS_CHARS = 700;
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export default function MobileSystemAdminMessagingScreen({
  initialMode,
  initialStatus = 'ALL',
}: MobileSystemAdminMessagingScreenProps = {}) {
  const { activeView, user } = useAuth();
  const [breakdown, setBreakdown] = useState<SystemAdminEmailBreakdown>({});
  const [events, setEvents] = useState<SystemAdminEmailEvent[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [activeStatus, setActiveStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [broadcastOpen, setBroadcastOpen] = useState(initialMode === 'broadcast' || initialMode === 'sms');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [form, setForm] = useState<BroadcastForm>({
    ...emptyBroadcastForm,
    channel: initialMode === 'sms' ? 'SMS' : 'EMAIL',
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [broadcastResult, setBroadcastResult] = useState<SystemAdminBroadcastResult | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<SystemAdminEmailEvent | null>(null);
  const handledInitialModeRef = useRef(false);

  const loadMessaging = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);
      setNotice(null);
      try {
        const [nextBreakdown, nextEvents] = await Promise.all([
          getSystemAdminEmailBreakdown(),
          listSystemAdminEmailEvents({
            page: 0,
            size: 50,
            status: activeStatus === 'ALL' ? undefined : activeStatus,
          }),
        ]);
        setBreakdown(nextBreakdown);
        setEvents(nextEvents.content);
        setTotalElements(Math.max(nextEvents.totalElements, nextEvents.content.length));
        if (mode === 'refresh') setNotice('Messaging analytics refreshed.');
      } catch (loadError) {
        setError(getApiErrorMessage(loadError));
        if (mode === 'initial') {
          setBreakdown({});
          setEvents([]);
          setTotalElements(0);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeStatus],
  );

  useEffect(() => {
    if (activeView !== 'SYSTEM_ADMIN') return undefined;
    const timer = setTimeout(() => {
      void loadMessaging('initial');
    }, 0);
    return () => clearTimeout(timer);
  }, [activeView, loadMessaging]);

  useEffect(() => {
    if (handledInitialModeRef.current || loading) return undefined;
    handledInitialModeRef.current = true;
    const timer = setTimeout(() => {
      if (initialMode === 'detail' && events[0]) setSelectedEvent(events[0]);
    }, 0);
    return () => clearTimeout(timer);
  }, [events, initialMode, loading]);

  const stats = useMemo(() => messagingStats(breakdown), [breakdown]);
  const tabs = useMemo(() => statusTabs(breakdown), [breakdown]);
  const filteredEvents = useMemo(() => filterEvents(events, searchTerm), [events, searchTerm]);
  const listItems = useMemo<MobileDataListItem[]>(() => filteredEvents.map(eventListItem), [filteredEvents]);
  const health = messagingHealth(stats);

  if (activeView !== 'SYSTEM_ADMIN') {
    return <AccessDeniedScreen title="Messaging analytics" description="Platform messaging analytics are available only to system administrators." />;
  }

  if (loading && !events.length && !Object.keys(breakdown).length) {
    return <MobilePageLoadingState kind="list" message="Loading messaging analytics" />;
  }

  if (error && !events.length && !Object.keys(breakdown).length) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Platform operations"
          title="Messaging"
          subtitle="Email delivery and admin broadcast"
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry" variant="secondary" onPress={() => void loadMessaging('refresh')} />}
        />
        <MobileErrorState title="Messaging unavailable" description={error} retryLabel="Retry" onRetry={() => void loadMessaging('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Platform operations"
        title="Messaging"
        subtitle={user?.fullName ? `${user.fullName} · delivery monitor` : 'Email delivery and admin broadcast'}
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh messaging" variant="secondary" disabled={refreshing} onPress={() => void loadMessaging('refresh')} />}
      />

      {error ? <MobileStatusBadge status="Failed" label={error} tone="danger" /> : null}
      {notice ? <MobileToast title="Messaging" description={notice} tone="success" /> : null}
      {broadcastResult ? (
        <MobileToast
          title={broadcastResult.channel === 'SMS' ? 'SMS broadcast sent' : 'Email broadcast sent'}
          description={`${formatNumber(broadcastResult.sent)} association admin${broadcastResult.sent === 1 ? '' : 's'} reached.`}
          tone="success"
        />
      ) : null}

      <MobileSummaryPanel
        title={health.title}
        value={formatPercent(stats.deliveryRate)}
        description={`${formatNumber(stats.total)} total emails · ${formatNumber(stats.failed)} failed · ${formatNumber(totalElements)} recent events`}
        tone={health.tone}
        icon={Mail}
        footer={<MobileProgressBar value={stats.deliveryRate} tone={health.tone} label="Delivered or sent" />}
      />

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Total emails" value={formatNumber(stats.total)} description="Delivery signals" tone="blue" icon={Mail} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Delivered" value={formatNumber(stats.delivered)} description={`${formatPercent(stats.deliveryRate)} delivery`} tone="green" icon={CheckCircle2} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Engaged" value={formatNumber(stats.opened)} description={`${formatPercent(stats.openRate)} open/click`} tone="purple" icon={Eye} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Failed" value={formatNumber(stats.failed)} description={`${formatPercent(stats.failureRate)} bounce/fail`} tone={stats.failed ? 'red' : 'slate'} icon={XCircle} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileStatusTabs tabs={tabs} value={activeStatus} onChange={setActiveStatus} />
      <MobileSearchToolbar value={searchTerm} onChange={setSearchTerm} placeholder="Find email events" />

      <View style={styles.actionsRow}>
        <MobileButton label="Broadcast" icon={Megaphone} size="sm" onPress={() => setBroadcastOpen(true)} />
        <MobileButton label="Export" icon={Download} size="sm" variant="secondary" loading={exporting} disabled={!filteredEvents.length} onPress={() => void exportEvents()} />
      </View>

      {listItems.length ? (
        <MobileDataList
          items={listItems}
          onPressItem={(item) => {
            const event = filteredEvents.find((row) => row.id === item.id);
            if (event) setSelectedEvent(event);
          }}
        />
      ) : (
        <MobileEmptyState
          title="No email events found"
          description={searchTerm || activeStatus !== 'ALL' ? 'Adjust search or status filters.' : 'Delivery events will appear here once providers report activity.'}
          actionLabel={searchTerm || activeStatus !== 'ALL' ? 'Reset filters' : undefined}
          onAction={searchTerm || activeStatus !== 'ALL' ? resetFilters : undefined}
        />
      )}

      <MobileCard compact accent={stats.failed ? 'red' : 'blue'}>
        <View style={styles.cardTitleRow}>
          <View style={styles.titleWithIcon}>
            <BarChart3 size={18} color={health.color} />
            <MobileText variant="body" weight="bold">
              Delivery breakdown
            </MobileText>
          </View>
          <MobileStatusBadge status={stats.failed ? 'Failed' : 'Delivered'} label={`${formatNumber(stats.total)} total`} tone={stats.failed ? 'danger' : 'success'} />
        </View>
        <View style={styles.breakdownList}>
          {Object.entries(breakdown).length ? (
            Object.entries(breakdown)
              .sort((a, b) => statusPriority(a[0]) - statusPriority(b[0]))
              .map(([status, count]) => {
                const percent = stats.total ? Math.round((count / stats.total) * 100) : 0;
                const tone = statusTone(status);
                return (
                  <View key={status} style={styles.breakdownItem}>
                    <View style={styles.breakdownText}>
                      <MobileStatusBadge status={labelFromStatus(status)} label={statusLabel(status)} tone={tone} />
                      <MobileText variant="small" tone="secondary">
                        {formatNumber(count)} emails
                      </MobileText>
                    </View>
                    <View style={styles.breakdownProgress}>
                      <MobileProgressBar value={percent} tone={kpiToneForStatus(status)} />
                      <MobileText variant="small" weight="bold">
                        {percent}%
                      </MobileText>
                    </View>
                  </View>
                );
              })
          ) : (
            <MobileText variant="small" tone="secondary">
              No delivery breakdown has been reported yet.
            </MobileText>
          )}
        </View>
      </MobileCard>

      {renderEventSheet()}
      {renderBroadcastSheet()}
      <MobileConfirmSheet
        visible={confirmOpen}
        title={form.channel === 'SMS' ? 'Send SMS broadcast?' : 'Send email broadcast?'}
        description={confirmDescription(form)}
        confirmLabel={form.channel === 'SMS' ? 'Send SMS' : 'Send Email'}
        loading={sending}
        confirmDisabled={sending}
        destructive
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void sendBroadcast()}
      />
    </MobileScreen>
  );

  function renderEventSheet() {
    const event = selectedEvent;
    return (
      <MobileSheet visible={Boolean(event)} title="Email event" description={event?.recipientAddress || 'Delivery event'} onClose={() => setSelectedEvent(null)}>
        {event ? (
          <>
            <MobileInfoRow label="Recipient" value={event.recipientAddress} helper={event.associationId ? `Association ${event.associationId}` : 'Platform email event'} icon={User} status={statusLabel(event.status)} />
            <MobileInfoRow label="Status" value={statusLabel(event.status)} helper="Provider delivery status" icon={Activity} status={statusLabel(event.status)} />
            <MobileInfoRow label="Provider ID" value={event.providerMessageId || 'Not available'} helper="External provider message reference" icon={Zap} />
            <MobileInfoRow label="Template" value={event.templateId || 'Not available'} helper="Template identifier if the email was templated" icon={FileText} />
            <MobileInfoRow label="Created" value={formatDate(event.createdAt)} helper={event.createdAt ? new Date(event.createdAt).toLocaleTimeString() : 'No timestamp reported'} icon={Mail} />
          </>
        ) : null}
      </MobileSheet>
    );
  }

  function renderBroadcastSheet() {
    return (
      <MobileSheet visible={broadcastOpen} title="Broadcast" description="Send a platform-wide message to active association admins." onClose={() => setBroadcastOpen(false)}>
        <View style={styles.channelRow}>
          <MobileButton
            label="Email"
            icon={Mail}
            size="sm"
            variant={form.channel === 'EMAIL' ? 'primary' : 'secondary'}
            onPress={() => updateForm('channel', 'EMAIL')}
            style={styles.channelButton}
          />
          <MobileButton
            label="SMS"
            icon={MessageSquare}
            size="sm"
            variant={form.channel === 'SMS' ? 'primary' : 'secondary'}
            onPress={() => updateForm('channel', 'SMS')}
            style={styles.channelButton}
          />
        </View>
        <MobileFormSection title="Message" description={form.channel === 'SMS' ? 'SMS broadcasts are limited to 700 characters.' : 'Email can include a subject, HTML body, and up to five attachments.'}>
          {form.channel === 'EMAIL' ? (
            <MobileTextInput
              label="Subject *"
              value={form.subject}
              onChangeText={(value) => updateForm('subject', value)}
              placeholder="Email subject"
              error={validationErrors.subject}
              icon={Mail}
            />
          ) : null}
          <MobileTextInput
            label={form.channel === 'SMS' ? 'SMS message *' : 'Message body *'}
            value={form.body}
            onChangeText={(value) => updateForm('body', value)}
            placeholder={form.channel === 'SMS' ? 'Write a concise SMS message' : 'Write the email body. HTML is supported.'}
            helperText={form.channel === 'SMS' ? `${form.body.length} / ${MAX_SMS_CHARS} characters` : 'This content is sent to active association admins.'}
            error={validationErrors.body}
            icon={form.channel === 'SMS' ? MessageSquare : FileText}
            multiline
            numberOfLines={form.channel === 'SMS' ? 4 : 5}
            maxLength={form.channel === 'SMS' ? MAX_SMS_CHARS : undefined}
          />
        </MobileFormSection>

        <MobileButton
          label={form.channel === 'SMS' ? 'Review SMS Broadcast' : 'Review Email Broadcast'}
          icon={Send}
          fullWidth
          loading={sending}
          onPress={reviewBroadcast}
        />

        {form.channel === 'EMAIL' ? (
          <MobileFormSection title="Attachments" description={`${form.attachments.length} of ${MAX_ATTACHMENTS} selected. Each file must be 10 MB or smaller.`}>
            <MobileFileUpload title="Add attachment" description="PDF, documents, images, or other admin broadcast files." onPress={() => void pickAttachments()} />
            {validationErrors.attachments ? (
              <MobileText variant="small" tone="primary">
                {validationErrors.attachments}
              </MobileText>
            ) : null}
            {form.attachments.map((attachment, index) => (
              <View key={`${attachment.name}-${index}`} style={styles.attachmentRow}>
                <View style={styles.attachmentText}>
                  <Paperclip size={16} />
                  <MobileText variant="small" weight="bold" numberOfLines={1} style={styles.attachmentName}>
                    {attachment.name}
                  </MobileText>
                </View>
                <Pressable onPress={() => removeAttachment(index)} style={styles.removeButton}>
                  <X size={16} />
                </Pressable>
              </View>
            ))}
          </MobileFormSection>
        ) : null}
      </MobileSheet>
    );
  }

  async function exportEvents() {
    if (!filteredEvents.length) return;
    setExporting(true);
    setNotice(null);
    try {
      const csv = toCsv(filteredEvents);
      const fileUri = `${FileSystem.cacheDirectory || ''}system-admin-email-events-${new Date().toISOString().slice(0, 10)}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Export email events' });
      } else {
        setNotice(`CSV saved to ${fileUri}`);
      }
    } catch (exportError) {
      setError(getApiErrorMessage(exportError));
    } finally {
      setExporting(false);
    }
  }

  async function pickAttachments() {
    const remaining = MAX_ATTACHMENTS - form.attachments.length;
    if (remaining <= 0) {
      setValidationErrors((current) => ({ ...current, attachments: `A maximum of ${MAX_ATTACHMENTS} attachments is allowed.` }));
      return;
    }

    const picked = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
      multiple: true,
    });
    if (picked.canceled || !picked.assets?.length) return;

    const nextAttachments = picked.assets.slice(0, remaining).map((asset) => ({
      uri: asset.uri,
      name: asset.name || 'broadcast-attachment',
      mimeType: asset.mimeType || 'application/octet-stream',
      size: asset.size ?? null,
    }));
    const oversized = nextAttachments.find((attachment) => Number(attachment.size || 0) > MAX_ATTACHMENT_BYTES);
    if (oversized) {
      setValidationErrors((current) => ({ ...current, attachments: `${oversized.name} is larger than 10 MB.` }));
      return;
    }
    setForm((current) => ({ ...current, attachments: [...current.attachments, ...nextAttachments] }));
    setValidationErrors((current) => {
      const next = { ...current };
      delete next.attachments;
      return next;
    });
  }

  function removeAttachment(index: number) {
    setForm((current) => ({
      ...current,
      attachments: current.attachments.filter((_, attachmentIndex) => attachmentIndex !== index),
    }));
  }

  function updateForm<Key extends keyof BroadcastForm>(key: Key, value: BroadcastForm[Key]) {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'channel' && value === 'SMS' ? { attachments: [] } : null),
    }));
    setBroadcastResult(null);
    setValidationErrors((current) => {
      const next = { ...current };
      delete next[String(key)];
      if (key === 'channel') {
        delete next.subject;
        delete next.body;
        delete next.attachments;
      }
      return next;
    });
  }

  function reviewBroadcast() {
    const nextErrors = validateBroadcast(form);
    setValidationErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setConfirmOpen(true);
  }

  async function sendBroadcast() {
    if (sending) return;
    setSending(true);
    setError(null);
    setNotice(null);
    setBroadcastResult(null);
    try {
      const result =
        form.channel === 'SMS'
          ? await broadcastSystemAdminSms(form.body)
          : await broadcastSystemAdminEmail({
              subject: form.subject,
              htmlBody: form.body,
              attachments: form.attachments,
            });
      setBroadcastResult(result);
      setConfirmOpen(false);
      setBroadcastOpen(false);
      setForm({ ...emptyBroadcastForm, channel: form.channel });
      await loadMessaging('refresh');
    } catch (sendError) {
      setError(getApiErrorMessage(sendError));
    } finally {
      setSending(false);
    }
  }

  function resetFilters() {
    setSearchTerm('');
    setActiveStatus('ALL');
  }
}

function messagingStats(breakdown: SystemAdminEmailBreakdown) {
  const entries = Object.entries(breakdown);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  const delivered = entries.reduce((sum, [status, count]) => (isDelivered(status) ? sum + count : sum), 0);
  const opened = entries.reduce((sum, [status, count]) => (isEngaged(status) ? sum + count : sum), 0);
  const failed = entries.reduce((sum, [status, count]) => (isFailed(status) ? sum + count : sum), 0);
  return {
    total,
    delivered,
    opened,
    failed,
    deliveryRate: total ? Math.round((delivered / total) * 100) : 0,
    openRate: total ? Math.round((opened / total) * 100) : 0,
    failureRate: total ? Math.round((failed / total) * 100) : 0,
  };
}

function messagingHealth(stats: ReturnType<typeof messagingStats>): { title: string; tone: KpiTone; color: string } {
  if (!stats.total) return { title: 'No delivery data yet', tone: 'slate', color: '#475569' };
  if (stats.failed && stats.failed === stats.total) return { title: 'Delivery needs attention', tone: 'red', color: '#B91C1C' };
  if (stats.failed) return { title: 'Some delivery failures', tone: 'orange', color: '#C2410C' };
  return { title: 'Messaging delivery healthy', tone: 'green', color: '#15803D' };
}

function statusTabs(breakdown: SystemAdminEmailBreakdown) {
  const entries = Object.entries(breakdown).sort((a, b) => statusPriority(a[0]) - statusPriority(b[0]));
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  return [
    { value: 'ALL', label: 'All', count: total },
    ...entries.map(([status, count]) => ({
      value: status,
      label: compactStatusLabel(status),
      count,
    })),
  ];
}

function filterEvents(events: SystemAdminEmailEvent[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return events;
  return events.filter((event) =>
    [event.recipientAddress, event.status, event.providerMessageId, event.templateId, event.associationId]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalized)),
  );
}

function eventListItem(event: SystemAdminEmailEvent): MobileDataListItem {
  const label = statusLabel(event.status);
  const tone = statusTone(event.status);
  return {
    id: event.id,
    title: event.recipientAddress,
    subtitle: event.associationId ? `Association ${event.associationId}` : 'Platform email event',
    meta: `Created ${formatDate(event.createdAt)}`,
    amount: event.providerMessageId ? 'Provider ref' : undefined,
    status: label,
    statusLabel: label,
    statusTone: tone,
    initials: initialsFromName(event.recipientAddress),
    accent: tone,
  };
}

function validateBroadcast(form: BroadcastForm) {
  const errors: Record<string, string> = {};
  if (form.channel === 'EMAIL' && !form.subject.trim()) errors.subject = 'Subject is required.';
  if (!form.body.trim()) errors.body = form.channel === 'SMS' ? 'SMS message body is required.' : 'Message body is required.';
  if (form.channel === 'SMS' && form.body.length > MAX_SMS_CHARS) errors.body = `SMS body must be ${MAX_SMS_CHARS} characters or fewer.`;
  if (form.attachments.length > MAX_ATTACHMENTS) errors.attachments = `A maximum of ${MAX_ATTACHMENTS} attachments is allowed.`;
  const oversized = form.attachments.find((attachment) => Number(attachment.size || 0) > MAX_ATTACHMENT_BYTES);
  if (oversized) errors.attachments = `${oversized.name} is larger than 10 MB.`;
  return errors;
}

function confirmDescription(form: BroadcastForm) {
  if (form.channel === 'SMS') {
    return `This sends one SMS broadcast to active association admins. Message length: ${form.body.length} of ${MAX_SMS_CHARS} characters.`;
  }
  return `This sends an email broadcast to active association admins. Subject: "${form.subject.trim()}". Attachments: ${form.attachments.length}.`;
}

function statusLabel(status: string) {
  return labelFromStatus(status).replace(/\bTo\b/g, 'to');
}

function compactStatusLabel(status: string) {
  const label = statusLabel(status);
  if (/failed to send/i.test(label)) return 'Failed';
  if (/delivered/i.test(label)) return 'Delivered';
  if (/sent/i.test(label)) return 'Sent';
  if (/open|click/i.test(label)) return 'Engaged';
  if (/pending|queued/i.test(label)) return 'Pending';
  return label;
}

function statusTone(status: string): StatusTone {
  if (isFailed(status)) return 'danger';
  if (isDelivered(status)) return 'success';
  if (isEngaged(status)) return 'info';
  if (/pending|queued/i.test(status)) return 'warning';
  return 'neutral';
}

function kpiToneForStatus(status: string): KpiTone {
  if (isFailed(status)) return 'red';
  if (isDelivered(status)) return 'green';
  if (isEngaged(status)) return 'purple';
  if (/pending|queued/i.test(status)) return 'orange';
  return 'slate';
}

function statusPriority(status: string) {
  if (isFailed(status)) return 0;
  if (/pending|queued/i.test(status)) return 1;
  if (isDelivered(status)) return 2;
  if (isEngaged(status)) return 3;
  return 4;
}

function isDelivered(status: string) {
  return /delivered|sent/i.test(status);
}

function isEngaged(status: string) {
  return /open|click/i.test(status);
}

function isFailed(status: string) {
  return /bounce|failed|error/i.test(status);
}

function toCsv(rows: SystemAdminEmailEvent[]) {
  const header = ['Recipient', 'Status', 'Provider Message ID', 'Template ID', 'Association ID', 'Created At'];
  return [header, ...rows.map((row) => [row.recipientAddress, row.status, row.providerMessageId || '', row.templateId || '', row.associationId || '', row.createdAt || ''])]
    .map((row) => row.map(csvCell).join(','))
    .join('\n');
}

function csvCell(value: string) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  channelRow: {
    flexDirection: 'row',
    gap: 10,
  },
  channelButton: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  breakdownList: {
    gap: 12,
    marginTop: 12,
  },
  breakdownItem: {
    gap: 8,
  },
  breakdownText: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  breakdownProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  attachmentRow: {
    minHeight: 42,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  attachmentText: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  attachmentName: {
    flex: 1,
  },
  removeButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
