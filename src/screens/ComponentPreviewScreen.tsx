import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { AlertTriangle, Banknote, Download, Filter, RefreshCw, Search, Send, Trash2, UserPlus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import {
  MobileAmountInput,
  MobileAlertBanner,
  MobileButton,
  MobileCard,
  MobileConfirmSheet,
  MobileDataList,
  MobileDatePicker,
  MobileDetailSkeleton,
  MobileEmptyState,
  MobileErrorPanel,
  MobileErrorState,
  MobileFilterSheet,
  MobileFormSkeleton,
  MobileFormSection,
  MobileIconButton,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobileLoadingState,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileSearchToolbar,
  MobileSelect,
  MobileSkeletonCard,
  MobileSkeletonKpiGrid,
  MobileSkeletonList,
  MobileSortSheet,
  MobileSpinner,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
  MobileTextInput,
  useMobileFeedback,
} from '@/components/mobile';
import { moneyMovements, statusTabs } from '@/data/demo';
import { formatTzs } from '@/utils/format';

export default function ComponentPreviewScreen() {
  const params = useLocalSearchParams<{ section?: string | string[] }>();
  const section = Array.isArray(params.section) ? params.section[0] : params.section;
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [name, setName] = useState('Upendo Fatukubonye');
  const [amount, setAmount] = useState('20000');
  const [packageId, setPackageId] = useState('weekly');
  const [date, setDate] = useState('2026-07-04');
  const [sort, setSort] = useState('latest');

  if (section === 'loading' || section === 'loading-detail') {
    return <LoadingSystemPreview focus={section === 'loading-detail' ? 'detail' : 'overview'} />;
  }

  if (section === 'feedback') {
    return <FeedbackSystemPreview />;
  }

  if (section === 'feedback-session') {
    return <FeedbackSessionPreview />;
  }

  if (section === 'feedback-global') {
    return <GlobalFeedbackPreview />;
  }

  if (section === 'feedback-global-toasts') {
    return <GlobalFeedbackPreview auto="toasts" />;
  }

  if (section === 'feedback-global-confirm') {
    return <GlobalFeedbackPreview auto="confirm" />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Design system"
        title="Mobile UI foundation"
        subtitle="Component decisions for native Nane iOS."
      />

      <MobileCard>
        <MobileText variant="section" weight="bold">
          Direction check
        </MobileText>
        <MobileText variant="small" tone="secondary" style={styles.paragraph}>
          This preview is intentionally financial and operational: money first, attention queues second, then fast work.
          Generic desktop tables are replaced with native lists and sheets.
        </MobileText>
      </MobileCard>

      <MobileKpiCard
        featured
        title="Featured financial KPI"
        value={formatTzs(12450000)}
        description="Used for wallet balance, net shares, collection totals"
        icon={Banknote}
        trend={{ value: '+8%', label: 'this week', direction: 'up' }}
      />

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Members" value="320" description="Active records" tone="blue" icon={UserPlus} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Pending" value="8" description="Needs action" tone="orange" icon={AlertTriangle} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <View style={styles.statusRow}>
        {['Paid', 'Pending', 'Failed', 'Review', 'Inactive'].map((item) => (
          <MobileStatusBadge key={item} status={item} />
        ))}
      </View>

      <View style={styles.buttonRow}>
        <MobileButton label="Primary" icon={Send} />
        <MobileButton label="Secondary" icon={Download} variant="secondary" />
        <MobileIconButton icon={RefreshCw} label="Refresh" />
        <MobileIconButton icon={Trash2} label="Delete" variant="danger" onPress={() => setConfirmOpen(true)} />
      </View>

      <MobileSearchToolbar value={search} onChange={setSearch} placeholder="Search members, payments..." onFilterPress={() => setFilterOpen(true)} />
      <MobileStatusTabs tabs={statusTabs} value={status} onChange={setStatus} />
      <MobileButton label="Open sort sheet" icon={Filter} variant="secondary" onPress={() => setSortOpen(true)} />

      <MobileDataList items={moneyMovements} />

      <MobileCard>
        <MobileText variant="section" weight="bold">
          Loading system
        </MobileText>
        <MobileText variant="small" tone="secondary" style={styles.paragraph}>
          Shared states for route loads, record details, lists, forms, and inline refreshes.
        </MobileText>
        <View style={styles.loadingPreview}>
          <MobileSpinner message="Syncing Nane records" size="md" />
          <MobileSkeletonCard compact lines={2} />
        </View>
      </MobileCard>

      <MobileSkeletonKpiGrid count={2} />
      <MobileSkeletonList rows={2} />
      <MobileDetailSkeleton />
      <MobileFormSkeleton fields={3} />
      <MobilePageLoadingState kind="list" message="Preparing list workspace" fullScreen={false} />

      <MobileFormSection title="Payment form" description="Compact field groups for real mobile entry.">
        <MobileTextInput label="Member name" value={name} onChangeText={setName} icon={Search} />
        <MobileAmountInput label="Amount" value={amount} onChangeText={setAmount} helperText="Amounts are formatted as TZS in summaries." />
        <MobileSelect
          label="Package"
          value={packageId}
          onChange={setPackageId}
          options={[
            { value: 'weekly', label: 'Weekly shares' },
            { value: 'loan', label: 'Loan repayment' },
            { value: 'event', label: 'Event registration' },
          ]}
        />
        <MobileDatePicker label="Payment date" value={date} onChange={setDate} />
      </MobileFormSection>

      <MobileLoadingState message="Loading member records" />
      <MobileEmptyState title="No payments found" description="Try clearing filters or record a new payment for this member." actionLabel="Record payment" />
      <MobileErrorState title="Could not load approvals" description="Check your connection and try again." onRetry={() => undefined} />

      <MobileFilterSheet
        visible={filterOpen}
        statusTabs={statusTabs}
        status={status}
        onStatusChange={setStatus}
        onApply={() => setFilterOpen(false)}
        onReset={() => setStatus('all')}
        onClose={() => setFilterOpen(false)}
      />

      <MobileSortSheet
        visible={sortOpen}
        value={sort}
        onChange={setSort}
        onClose={() => setSortOpen(false)}
        options={[
          { value: 'latest', label: 'Latest first', description: 'Most recent records at the top' },
          { value: 'amount', label: 'Highest amount', description: 'Large money movements first' },
          { value: 'name', label: 'Member name', description: 'Alphabetical member order' },
        ]}
      />

      <MobileConfirmSheet
        visible={confirmOpen}
        title="Delete this record?"
        description="This action is permanent and should only be used when the record was captured incorrectly."
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => setConfirmOpen(false)}
      />
    </MobileScreen>
  );
}

function GlobalFeedbackPreview({ auto }: { auto?: 'toasts' | 'confirm' }) {
  const { confirm, toast } = useMobileFeedback();
  const toastRef = useRef(toast);
  const confirmRef = useRef(confirm);

  useEffect(() => {
    toastRef.current = toast;
    confirmRef.current = confirm;
  }, [confirm, toast]);

  useEffect(() => {
    if (auto === 'toasts') {
      toastRef.current.success({
        id: 'preview-toast-success',
        title: 'Member saved',
        description: 'The member record was updated successfully.',
        durationMs: 0,
      });
      toastRef.current.error({
        id: 'preview-toast-error',
        title: 'Export failed',
        description: 'Try again or contact support if this continues.',
        durationMs: 0,
      });
      toastRef.current.warning({
        id: 'preview-toast-warning',
        title: 'Review required',
        description: 'Some records need approval before export.',
        durationMs: 0,
      });
    }

    if (auto === 'confirm') {
      void confirmRef.current({
        title: 'Delete attendance records?',
        description: 'This action is permanent and should only be used when duplicate or incorrect attendance was captured.',
        confirmLabel: 'Delete records',
        destructive: true,
      });
    }
  }, [auto]);

  async function runConfirmPreview() {
    const confirmed = await confirm({
      title: 'Delete attendance records?',
      description: 'This action is permanent and should only be used when duplicate or incorrect attendance was captured.',
      confirmLabel: 'Delete records',
      destructive: true,
    });

    if (confirmed) {
      toast.success({
        title: 'Action confirmed',
        description: 'The destructive action can now run from the calling screen.',
      });
    } else {
      toast.info({
        title: 'Action cancelled',
        description: 'No records were changed.',
      });
    }
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Design system"
        title="Global feedback"
        subtitle="Sonner-style toasts and promise-based confirmations."
      />

      <MobileCard style={styles.previewCard}>
        <MobileText variant="section" weight="bold">
          Toast queue
        </MobileText>
        <MobileText variant="small" tone="secondary" style={styles.paragraph}>
          Any screen can now show a global success, error, warning, or info toast without owning local toast state.
        </MobileText>
        <View style={styles.buttonRow}>
          <MobileButton
            label="Success"
            size="sm"
            onPress={() =>
              toast.success({
                title: 'Member saved',
                description: 'The member record was updated successfully.',
              })
            }
          />
          <MobileButton
            label="Error"
            size="sm"
            variant="danger"
            onPress={() =>
              toast.error({
                title: 'Export failed',
                description: 'Try again or contact support if this continues.',
              })
            }
          />
          <MobileButton
            label="Warning"
            size="sm"
            variant="secondary"
            onPress={() =>
              toast.warning({
                title: 'Review required',
                description: 'Some records need approval before export.',
              })
            }
          />
          <MobileButton
            label="Info"
            size="sm"
            variant="secondary"
            onPress={() =>
              toast.info({
                title: 'Sync started',
                description: 'Nane is refreshing the latest records.',
              })
            }
          />
        </View>
      </MobileCard>

      <MobileCard style={styles.previewCard}>
        <MobileText variant="section" weight="bold">
          Confirmation dialog
        </MobileText>
        <MobileText variant="small" tone="secondary" style={styles.paragraph}>
          Critical actions can now await a shared Nane confirmation sheet instead of managing screen-local state.
        </MobileText>
        <MobileButton label="Open destructive confirm" icon={Trash2} variant="danger" onPress={() => void runConfirmPreview()} />
      </MobileCard>
    </MobileScreen>
  );
}

function FeedbackSessionPreview() {
  const { showFeedback } = useMobileFeedback();

  useEffect(() => {
    showFeedback({
      id: 'preview-session-expired',
      kind: 'session',
      tone: 'warning',
      title: 'Session expired',
      description: 'For security, your Nane session has ended. Sign in again to continue from a fresh secure session.',
      details: {
        code: 'SESSION_EXPIRED',
      },
      primaryAction: {
        label: 'Sign in again',
      },
      secondaryAction: {
        label: 'Dismiss',
      },
      dismissible: true,
    });
  }, [showFeedback]);

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Design system"
        title="Session feedback"
        subtitle="Previewing the global feedback host over normal page content."
      />
      <MobileCard>
        <MobileText variant="section" weight="bold">
          Page content stays stable
        </MobileText>
        <MobileText variant="small" tone="secondary" style={styles.paragraph}>
          Session problems are shown as a focused global decision instead of a cramped top-of-screen message.
        </MobileText>
      </MobileCard>
    </MobileScreen>
  );
}

function FeedbackSystemPreview() {
  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Design system"
        title="Feedback system"
        subtitle="Global session, page, inline, and action error patterns."
      />

      <MobileAlertBanner
        title="Refresh issue"
        description="The latest records could not be refreshed. Existing records are still available."
        tone="warning"
        actionLabel="Retry"
        onAction={() => undefined}
        details={{
          status: 503,
          code: 'SERVICE_UNAVAILABLE',
          path: '/api/v1/associations/members',
          traceId: 'demo-trace-id',
        }}
      />

      <MobileErrorPanel
        title="Transactions could not load"
        description="Nane could not prepare this list right now. Try again, and share the details with support if it keeps happening."
        primaryLabel="Retry"
        onPrimary={() => undefined}
        secondaryLabel="Go back"
        onSecondary={() => undefined}
        details={{
          status: 500,
          code: 'INTERNAL_ERROR',
          path: '/api/v1/associations/revenue-transactions',
          traceId: '64716092-0e17-4fb7-a4d1-bc95a965062f',
        }}
      />

      <MobileAlertBanner
        title="Export prepared"
        description="The report is ready to share with your finance team."
        tone="success"
        compact
      />
    </MobileScreen>
  );
}

function LoadingSystemPreview({ focus = 'overview' }: { focus?: 'overview' | 'detail' }) {
  const title = focus === 'detail' ? 'Detail loading' : 'Loading system';
  const subtitle =
    focus === 'detail'
      ? 'Record detail and form skeletons for native data flows.'
      : 'Shared route, list, detail, form, and inline loading states.';

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Design system"
        title={title}
        subtitle={subtitle}
      />

      {focus === 'overview' ? (
        <>
          <MobileCard>
            <MobileText variant="section" weight="bold">
              Branded loading
            </MobileText>
            <MobileText variant="small" tone="secondary" style={styles.paragraph}>
              The logo spinner is reserved for route, sync, and important blocking loading moments.
            </MobileText>
            <View style={styles.loadingPreview}>
              <MobileSpinner message="Syncing Nane records" size="md" />
              <MobileSkeletonCard compact lines={2} />
            </View>
          </MobileCard>

          <MobileSkeletonKpiGrid count={2} />
          <MobileSkeletonList rows={2} />
          <MobilePageLoadingState kind="list" message="Preparing list workspace" fullScreen={false} />
          <MobileLoadingState message="Loading member records" compact />
        </>
      ) : (
        <>
          <MobileDetailSkeleton />
          <MobileFormSkeleton fields={3} />
          <MobilePageLoadingState kind="detail" message="Preparing record detail" fullScreen={false} />
          <MobilePageLoadingState kind="form" message="Preparing form fields" fullScreen={false} />
        </>
      )}
    </MobileScreen>
  );
}

const styles = StyleSheet.create({
  paragraph: {
    marginTop: 8,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  loadingPreview: {
    marginTop: 16,
    gap: 16,
  },
  previewCard: {
    gap: 12,
  },
});
