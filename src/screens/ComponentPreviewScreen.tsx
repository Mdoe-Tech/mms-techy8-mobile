import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { AlertTriangle, Banknote, Download, Filter, RefreshCw, Search, Send, Trash2, UserPlus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import {
  MobileAmountInput,
  MobileButton,
  MobileCard,
  MobileConfirmSheet,
  MobileDataList,
  MobileDatePicker,
  MobileDetailSkeleton,
  MobileEmptyState,
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
});
