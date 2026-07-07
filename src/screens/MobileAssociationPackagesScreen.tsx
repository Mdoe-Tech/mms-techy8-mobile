import { router, useLocalSearchParams } from 'expo-router';
import {
  Banknote,
  CheckCircle2,
  Edit3,
  Eye,
  Package,
  Plus,
  RefreshCw,
  ShieldAlert,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Users,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

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
  MobileReportExportButton,
  MobileScreen,
  MobileSearchToolbar,
  MobileSelect,
  MobileSheet,
  MobileSortSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
  MobileTextInput,
  MobileToast,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  createMembershipPackage,
  deleteMembershipPackage,
  getAssociationPackages,
  getMembershipPackageById,
  toggleMembershipPackageStatus,
  updateMembershipPackage,
  type MembershipPackage,
  type MembershipPackagePayload,
} from '@/services/package-service';
import { type KpiTone, type StatusTone, useNaneTheme } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate, formatNumber, initialsFromName } from '@/utils/format';

type PackageFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'FREE' | 'WITH_MEMBERS';
type PackageSort = 'updatedDesc' | 'nameAsc' | 'membersDesc' | 'amountAsc' | 'statusAsc';
type FormMode = 'create' | 'edit' | null;
type ConfirmTarget =
  | { type: 'delete'; pkg: MembershipPackage }
  | { type: 'toggle'; pkg: MembershipPackage }
  | null;

type PackageFormState = {
  name: string;
  description: string;
  benefits: string[];
  currency: string;
  weekly: boolean;
  biWeekly: boolean;
  monthly: boolean;
  quarterly: boolean;
  semiAnnual: boolean;
  annual: boolean;
  weeklyAmount: string;
  biWeeklyAmount: string;
  monthlyAmount: string;
  quarterlyAmount: string;
  semiAnnualAmount: string;
  annualAmount: string;
};

type MobileAssociationPackagesScreenProps = {
  initialMode?: 'create';
};

const sortOptions = [
  { value: 'updatedDesc', label: 'Recently updated', description: 'Packages changed most recently first.' },
  { value: 'nameAsc', label: 'Package name', description: 'Alphabetical package order.' },
  { value: 'membersDesc', label: 'Subscribed members', description: 'Highest member count first.' },
  { value: 'amountAsc', label: 'Starting price', description: 'Lowest starting amount first.' },
  { value: 'statusAsc', label: 'Status', description: 'Active packages first.' },
];

const currencyOptions = ['TZS', 'USD', 'EUR', 'GBP', 'KES', 'UGX', 'ZAR'].map((currency) => ({
  value: currency,
  label: currency,
}));

const billingCycles = [
  { key: 'weekly', amountKey: 'weeklyAmount', label: 'Weekly', description: 'Member can pay every week.' },
  { key: 'biWeekly', amountKey: 'biWeeklyAmount', label: 'Bi-weekly', description: 'Member can pay every two weeks.' },
  { key: 'monthly', amountKey: 'monthlyAmount', label: 'Monthly', description: 'Member can pay every month.' },
  { key: 'quarterly', amountKey: 'quarterlyAmount', label: 'Quarterly', description: 'Member can pay every quarter.' },
  { key: 'semiAnnual', amountKey: 'semiAnnualAmount', label: 'Semi-annual', description: 'Member can pay twice per year.' },
  { key: 'annual', amountKey: 'annualAmount', label: 'Annual', description: 'Member can pay once per year.' },
] as const;

export default function MobileAssociationPackagesScreen({ initialMode }: MobileAssociationPackagesScreenProps) {
  const params = useLocalSearchParams();
  const { activeView, associationId, user } = useAuth();
  const paramMode = firstParam(params.mode);
  const paramPackageId = firstParam(params.packageId) || firstParam(params.id);
  const [packages, setPackages] = useState<MembershipPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<MembershipPackage | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>(() => (initialMode === 'create' || paramMode === 'create' ? 'create' : null));
  const [form, setForm] = useState<PackageFormState>(() => emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<PackageFilter>('ALL');
  const [sortBy, setSortBy] = useState<PackageSort>('updatedDesc');
  const [sortOpen, setSortOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [featureUnavailable, setFeatureUnavailable] = useState(false);
  const initialDetailConsumed = useRef(false);

  const canManagePackages = useMemo(() => hasPackageManagePermission(user), [user]);

  const loadPackages = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        return;
      }

      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);

      setError(null);
      setFeatureUnavailable(false);
      try {
        const rows = await getAssociationPackages(associationId);
        setPackages(rows.filter((pkg) => Boolean(pkg?.id)));
      } catch (loadError) {
        const message = getApiErrorMessage(loadError);
        setPackages([]);
        if (isFeatureUnavailable(message)) {
          setFeatureUnavailable(true);
          setError(null);
        } else {
          setError(message);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadPackages());
  }, [loadPackages]);

  const openPackage = useCallback(
    async (packageId: string) => {
      setError(null);
      const shallow = packages.find((pkg) => pkg.id === packageId) || null;
      setSelectedPackage(shallow);
      setDetailOpen(true);
      try {
        setSelectedPackage(await getMembershipPackageById(packageId));
      } catch (openError) {
        setError(getApiErrorMessage(openError));
      }
    },
    [packages],
  );

  useEffect(() => {
    if (!paramPackageId || initialDetailConsumed.current || packages.length === 0) return;
    const pkg = packages.find((item) => item.id === paramPackageId);
    if (!pkg) return;
    initialDetailConsumed.current = true;
    const timer = setTimeout(() => {
      void openPackage(pkg.id);
    }, 0);
    return () => clearTimeout(timer);
  }, [paramPackageId, packages, openPackage]);

  const metrics = useMemo(() => computePackageMetrics(packages), [packages]);

  const tabs = useMemo(() => [
    { value: 'ALL', label: 'All', count: packages.length },
    { value: 'ACTIVE', label: 'Active', count: metrics.active },
    { value: 'INACTIVE', label: 'Inactive', count: metrics.inactive },
    { value: 'FREE', label: 'Free', count: metrics.free },
    { value: 'WITH_MEMBERS', label: 'With members', count: metrics.withMembers },
  ].filter((tab) => tab.value === 'ALL' || tab.count > 0), [metrics, packages.length]);

  const visiblePackages = useMemo(() => {
    const term = search.trim().toLowerCase();
    return packages
      .filter((pkg) => {
        if (filter === 'ACTIVE' && !pkg.active) return false;
        if (filter === 'INACTIVE' && pkg.active) return false;
        if (filter === 'FREE' && !isFreePackage(pkg)) return false;
        if (filter === 'WITH_MEMBERS' && memberCount(pkg) <= 0) return false;
        if (!term) return true;
        return [
          pkg.name,
          pkg.description,
          pkg.currency,
          pkg.associationName,
          ...(pkg.benefits || []),
        ].filter(Boolean).some((value) => String(value).toLowerCase().includes(term));
      })
      .sort((a, b) => sortPackages(a, b, sortBy));
  }, [filter, packages, search, sortBy]);

  const listItems = useMemo<MobileDataListItem[]>(
    () => visiblePackages.map((pkg) => ({
      id: pkg.id,
      title: pkg.name || 'Unnamed package',
      subtitle: packageSubtitle(pkg),
      meta: `${formatNumber(memberCount(pkg))} members • ${cycleCount(pkg)} cycles`,
      amount: startingPriceLabel(pkg),
      status: pkg.active ? 'Active' : 'Inactive',
      statusTone: pkg.active ? 'success' : 'neutral',
      initials: initialsFromName(pkg.name || 'Package'),
      accent: packageListAccent(pkg),
    })),
    [visiblePackages],
  );

  const packageReportOptions = useMemo(
    () => ({
      title: 'Membership Packages',
      associationName: user?.associationName || 'Association',
      purpose: 'A current-view report of membership package pricing, benefits, billing cycles, and subscriber counts.',
      rows: visiblePackages,
      fileName: 'nane-membership-packages',
      metrics: [
        { label: 'Packages', value: formatNumber(metrics.total), helper: 'Configured plans' },
        { label: 'Active', value: formatNumber(metrics.active), helper: 'Visible to members' },
        { label: 'Members', value: formatNumber(metrics.members), helper: 'Subscribed accounts' },
        { label: 'Starting from', value: metrics.startingPrice, helper: 'Lowest package price' },
      ],
      filters: [
        { label: 'Search', value: search || 'All' },
        { label: 'Status', value: tabs.find((tab) => tab.value === filter)?.label || filter },
        { label: 'Sort', value: sortOptions.find((option) => option.value === sortBy)?.label || sortBy },
      ],
      columns: [
        { key: 'number', label: '#', align: 'center' as const, width: '5%', value: (_row: MembershipPackage, index: number) => index + 1 },
        { key: 'name', label: 'Package', width: '17%', value: (row: MembershipPackage) => row.name || '-' },
        { key: 'status', label: 'Status', width: '9%', value: (row: MembershipPackage) => (row.active ? 'Active' : 'Inactive') },
        { key: 'members', label: 'Members', align: 'right' as const, width: '9%', value: (row: MembershipPackage) => formatNumber(memberCount(row)) },
        { key: 'startingPrice', label: 'Starting Price', align: 'right' as const, width: '14%', value: (row: MembershipPackage) => startingPriceLabel(row) },
        { key: 'cycles', label: 'Billing Cycles', width: '13%', value: (row: MembershipPackage) => formatNumber(cycleCount(row)) },
        { key: 'benefits', label: 'Benefits', width: '20%', value: (row: MembershipPackage) => (row.benefits || []).join('; ') || '-' },
        { key: 'updatedAt', label: 'Updated', width: '11%', value: (row: MembershipPackage) => formatDate(row.updatedAt) },
      ],
    }),
    [filter, metrics, search, sortBy, tabs, user?.associationName, visiblePackages],
  );

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Association workspace required" description="Package management is available from the association admin workspace." />;
  }

  if (loading) {
    return <MobilePageLoadingState kind="list" message="Loading membership packages" />;
  }

  function openCreateForm() {
    setErrors({});
    setSelectedPackage(null);
    setForm(emptyForm());
    setFormMode('create');
  }

  function openEditForm(pkg: MembershipPackage) {
    setErrors({});
    setSelectedPackage(pkg);
    setForm(formFromPackage(pkg));
    setFormMode('edit');
    setDetailOpen(false);
  }

  function closeForm() {
    setFormMode(null);
    setErrors({});
    if (initialMode === 'create' || paramMode === 'create') {
      router.back();
    }
  }

  async function savePackage() {
    const validation = validateForm(form);
    setErrors(validation);
    if (Object.keys(validation).length > 0 || !associationId) return;

    setSaving(true);
    setError(null);
    try {
      const payload = payloadFromForm(form);
      const saved = formMode === 'edit' && selectedPackage
        ? await updateMembershipPackage(selectedPackage.id, payload)
        : await createMembershipPackage(associationId, payload);
      setNotice(formMode === 'edit' ? 'Package updated successfully.' : 'Package created successfully.');
      setFormMode(null);
      setSelectedPackage(saved);
      setDetailOpen(true);
      await loadPackages('refresh');
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function confirmAction() {
    if (!confirmTarget) return;
    setWorkingId(confirmTarget.pkg.id);
    setError(null);
    try {
      if (confirmTarget.type === 'delete') {
        await deleteMembershipPackage(confirmTarget.pkg.id);
        setNotice('Package deleted successfully.');
        setSelectedPackage(null);
        setDetailOpen(false);
      } else {
        const updated = await toggleMembershipPackageStatus(confirmTarget.pkg.id);
        setNotice(`Package marked ${updated.active ? 'active' : 'inactive'}.`);
        setSelectedPackage(updated);
      }
      setConfirmTarget(null);
      await loadPackages('refresh');
    } catch (actionError) {
      setError(getApiErrorMessage(actionError));
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        title="Membership Packages"
        eyebrow="Subscriptions"
        subtitle="Manage package pricing, benefits, and member access."
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh packages" onPress={() => loadPackages('refresh')} disabled={refreshing} />}
      />

      {notice ? <MobileToast title={notice} tone="success" /> : null}
      {error ? <MobileErrorState title="Package action failed" description={error} onRetry={() => loadPackages('refresh')} /> : null}

      {featureUnavailable ? (
        <FeatureUnavailableState onRefresh={() => loadPackages('refresh')} />
      ) : (
        <>
          <MobileKpiGrid>
            <MobileKpiGridItem>
              <MobileKpiCard title="Packages" value={formatNumber(metrics.total)} description="Configured plans" tone="blue" icon={Package} />
            </MobileKpiGridItem>
            <MobileKpiGridItem>
              <MobileKpiCard title="Active" value={formatNumber(metrics.active)} description="Visible to members" tone="green" icon={CheckCircle2} />
            </MobileKpiGridItem>
            <MobileKpiGridItem>
              <MobileKpiCard title="Members" value={formatNumber(metrics.members)} description="Subscribed accounts" tone="purple" icon={Users} />
            </MobileKpiGridItem>
            <MobileKpiGridItem>
              <MobileKpiCard title="Starting From" value={metrics.startingPrice} description="Lowest package price" tone="orange" icon={Banknote} />
            </MobileKpiGridItem>
          </MobileKpiGrid>

          <View style={styles.actionsRow}>
            <MobileButton label="New package" icon={Plus} onPress={openCreateForm} disabled={!canManagePackages} />
            <MobileReportExportButton options={packageReportOptions} onError={(exportError) => setError(getApiErrorMessage(exportError))} />
          </View>

          {!canManagePackages ? (
            <MobileCard compact accent="orange" style={styles.noticeCard}>
              <ShieldAlert size={20} />
              <View style={styles.noticeCopy}>
                <MobileText variant="small" weight="bold">
                  Read-only access
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  Your account can review packages, but package creation and edits require package management permission.
                </MobileText>
              </View>
            </MobileCard>
          ) : null}

          <MobileSearchToolbar
            value={search}
            onChange={setSearch}
            placeholder="Search packages"
            onFilterPress={() => setSortOpen(true)}
            filterLabel="Sort"
          />

          <MobileStatusTabs tabs={tabs} value={filter} onChange={(value) => setFilter(value as PackageFilter)} />

          {listItems.length > 0 ? (
            <MobileDataList items={listItems} onPressItem={(item) => openPackage(item.id)} />
          ) : (
            <MobileEmptyState
              title={packages.length === 0 ? 'No packages yet' : 'No matching packages'}
              description={packages.length === 0 ? 'Create your first membership package with prices, benefits, and billing cycles.' : 'Try another search term, status tab, or sort option.'}
              actionLabel={packages.length === 0 && canManagePackages ? 'Create package' : undefined}
              onAction={packages.length === 0 && canManagePackages ? openCreateForm : undefined}
            />
          )}
        </>
      )}

      <PackageDetailSheet
        pkg={selectedPackage}
        visible={detailOpen}
        working={workingId === selectedPackage?.id}
        canManage={canManagePackages}
        onClose={() => setDetailOpen(false)}
        onEdit={openEditForm}
        onToggle={(pkg) => setConfirmTarget({ type: 'toggle', pkg })}
        onDelete={(pkg) => setConfirmTarget({ type: 'delete', pkg })}
      />

      <PackageFormSheet
        visible={Boolean(formMode)}
        mode={formMode || 'create'}
        form={form}
        errors={errors}
        saving={saving}
        onChange={setForm}
        onClose={closeForm}
        onSubmit={savePackage}
      />

      <MobileSortSheet
        visible={sortOpen}
        value={sortBy}
        options={sortOptions}
        onChange={(value) => {
          setSortBy(value as PackageSort);
          setSortOpen(false);
        }}
        onClose={() => setSortOpen(false)}
      />

      <MobileConfirmSheet
        visible={Boolean(confirmTarget)}
        title={confirmTarget?.type === 'delete' ? 'Delete package?' : confirmTarget?.pkg.active ? 'Deactivate package?' : 'Activate package?'}
        description={
          confirmTarget?.type === 'delete'
            ? memberCount(confirmTarget.pkg) > 0
              ? 'This package has subscribed members. The server may block deletion while active subscriptions exist.'
              : 'This removes the package from the association catalog.'
            : confirmTarget?.pkg.active
              ? 'Members will no longer be able to select this package while it is inactive.'
              : 'The package will become available again where active packages are shown.'
        }
        confirmLabel={confirmTarget?.type === 'delete' ? 'Delete' : 'Confirm'}
        destructive={confirmTarget?.type === 'delete' || Boolean(confirmTarget?.pkg.active)}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={confirmAction}
      />
    </MobileScreen>
  );
}

function PackageDetailSheet({
  pkg,
  visible,
  working,
  canManage,
  onClose,
  onEdit,
  onToggle,
  onDelete,
}: {
  pkg: MembershipPackage | null;
  visible: boolean;
  working: boolean;
  canManage: boolean;
  onClose: () => void;
  onEdit: (pkg: MembershipPackage) => void;
  onToggle: (pkg: MembershipPackage) => void;
  onDelete: (pkg: MembershipPackage) => void;
}) {
  if (!pkg) return null;
  const cycles = packageCycles(pkg);

  return (
    <MobileSheet visible={visible} title={pkg.name || 'Package details'} description={pkg.description || 'Membership package setup'} onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
        <View style={styles.detailActions}>
          <MobileButton label="Edit" icon={Edit3} size="sm" onPress={() => onEdit(pkg)} disabled={!canManage || working} />
          <MobileButton
            label={pkg.active ? 'Deactivate' : 'Activate'}
            icon={pkg.active ? ToggleLeft : ToggleRight}
            size="sm"
            variant="secondary"
            onPress={() => onToggle(pkg)}
            disabled={!canManage || working}
          />
          <MobileButton label="Delete" icon={Trash2} size="sm" variant="danger" onPress={() => onDelete(pkg)} disabled={!canManage || working} />
        </View>

        <MobileCard compact accent={packageAccent(pkg)}>
          <View style={styles.detailHeader}>
            <View style={styles.detailTitle}>
              <MobileText variant="section" weight="bold">
                {pkg.name || 'Unnamed package'}
              </MobileText>
              <MobileText variant="small" tone="secondary">
                {packageSubtitle(pkg)}
              </MobileText>
            </View>
            <MobileStatusBadge status={pkg.active ? 'Active' : 'Inactive'} tone={pkg.active ? 'success' : 'neutral'} />
          </View>
          <MobileInfoRow label="Subscribed members" value={formatNumber(memberCount(pkg))} icon={Users} />
          <MobileInfoRow label="Starting price" value={startingPriceLabel(pkg)} helper={`${cycleCount(pkg)} billing cycles configured`} icon={Banknote} />
          <MobileInfoRow label="Updated" value={formatDate(pkg.updatedAt || pkg.createdAt)} icon={Eye} />
        </MobileCard>

        <MobileFormSection title="Billing cycles" description="Prices members can use when subscribing.">
          {cycles.length === 0 ? (
            <MobileEmptyState title="No billing cycles" description="This package has no visible amount configured." />
          ) : cycles.map((cycle) => (
            <MobileInfoRow key={cycle.key} label={cycle.label} value={formatCurrency(cycle.amount, pkg.currency || 'TZS')} icon={Banknote} />
          ))}
        </MobileFormSection>

        <MobileFormSection title="Benefits" description="Member-facing package benefits.">
          {(pkg.benefits || []).filter(Boolean).length > 0 ? (
            (pkg.benefits || []).filter(Boolean).map((benefit, index) => (
              <MobileInfoRow key={`${benefit}-${index}`} label={`Benefit ${index + 1}`} value={benefit} icon={CheckCircle2} />
            ))
          ) : (
            <MobileEmptyState title="No benefits listed" description="Add benefits so members understand what the package includes." />
          )}
        </MobileFormSection>
      </ScrollView>
    </MobileSheet>
  );
}

function PackageFormSheet({
  visible,
  mode,
  form,
  errors,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  mode: 'create' | 'edit';
  form: PackageFormState;
  errors: Record<string, string>;
  saving: boolean;
  onChange: (form: PackageFormState) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const update = (patch: Partial<PackageFormState>) => onChange({ ...form, ...patch });
  const updateBenefit = (index: number, value: string) => {
    const benefits = [...form.benefits];
    benefits[index] = value;
    update({ benefits });
  };
  const removeBenefit = (index: number) => {
    const benefits = form.benefits.filter((_, itemIndex) => itemIndex !== index);
    update({ benefits: benefits.length > 0 ? benefits : [''] });
  };

  return (
    <MobileSheet
      visible={visible}
      title={mode === 'edit' ? 'Edit package' : 'Create package'}
      description="Set benefits and the payment cycles this package supports."
      onClose={onClose}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
        <MobileFormSection title="Package identity" description="Keep names short enough for member invoices and package selectors.">
          <MobileTextInput
            label="Package name"
            value={form.name}
            onChangeText={(name) => update({ name })}
            placeholder="Gold member package"
            error={errors.name}
            disabled={saving}
            icon={Package}
          />
          <MobileTextInput
            label="Description"
            value={form.description}
            onChangeText={(description) => update({ description })}
            placeholder="Short description for members"
            helperText="Maximum 500 characters."
            error={errors.description}
            disabled={saving}
            multiline
            numberOfLines={3}
          />
          <MobileSelect label="Currency" value={form.currency} options={currencyOptions} onChange={(currency) => update({ currency })} />
        </MobileFormSection>

        <MobileFormSection title="Benefits" description="Add at least one clear benefit.">
          {form.benefits.map((benefit, index) => (
            <View key={`benefit-${index}`} style={styles.benefitRow}>
              <View style={styles.benefitInput}>
                <MobileTextInput
                  label={`Benefit ${index + 1}`}
                  value={benefit}
                  onChangeText={(value) => updateBenefit(index, value)}
                  placeholder="Priority support"
                  error={index === 0 ? errors.benefits : undefined}
                  disabled={saving}
                  icon={CheckCircle2}
                />
              </View>
              <MobileIconButton icon={Trash2} label="Remove benefit" variant="danger" onPress={() => removeBenefit(index)} disabled={saving || form.benefits.length <= 1} />
            </View>
          ))}
          <MobileButton label="Add benefit" icon={Plus} variant="secondary" onPress={() => update({ benefits: [...form.benefits, ''] })} disabled={saving} />
        </MobileFormSection>

        <MobileFormSection title="Billing cycles" description="Select every cycle members can use and set its amount. Zero means free.">
          {errors.cycles ? <MobileToast title="Select a billing cycle" description={errors.cycles} tone="warning" /> : null}
          {billingCycles.map((cycle) => {
            const checked = Boolean(form[cycle.key]);
            return (
              <View key={cycle.key} style={styles.cycleBlock}>
                <MobileCheckboxRow
                  label={cycle.label}
                  description={cycle.description}
                  checked={checked}
                  onChange={(value) => update({ [cycle.key]: value } as Partial<PackageFormState>)}
                  disabled={saving}
                />
                {checked ? (
                  <MobileAmountInput
                    label={`${cycle.label} amount`}
                    value={form[cycle.amountKey]}
                    onChangeText={(value) => update({ [cycle.amountKey]: value } as Partial<PackageFormState>)}
                    helperText={`Currency: ${form.currency}`}
                    error={errors[cycle.amountKey]}
                    disabled={saving}
                  />
                ) : null}
              </View>
            );
          })}
        </MobileFormSection>

        <View style={styles.formActions}>
          <MobileButton label="Cancel" variant="secondary" onPress={onClose} disabled={saving} />
          <MobileButton label={mode === 'edit' ? 'Save package' : 'Create package'} icon={Package} loading={saving} onPress={onSubmit} fullWidth style={styles.submitButton} />
        </View>
      </ScrollView>
    </MobileSheet>
  );
}

function FeatureUnavailableState({ onRefresh }: { onRefresh: () => void }) {
  const theme = useNaneTheme();

  return (
    <MobileCard compact accent="orange" style={styles.featureUnavailable}>
      <View style={[styles.featureUnavailableIcon, { backgroundColor: theme.colors.status.warning }]}>
        <ShieldAlert color={theme.colors.onPrimary} size={24} />
      </View>
      <MobileText variant="section" weight="bold">
        Packages are not enabled for this association type
      </MobileText>
      <MobileText variant="body" tone="secondary">
        The backend currently enables membership packages for eligible generic associations. This VIKOBA-style workspace can continue using member, revenue, loan, and attendance workflows without package setup.
      </MobileText>
      <MobileButton label="Refresh" icon={RefreshCw} variant="secondary" onPress={onRefresh} />
    </MobileCard>
  );
}

function emptyForm(): PackageFormState {
  return {
    name: '',
    description: '',
    benefits: [''],
    currency: 'TZS',
    weekly: false,
    biWeekly: false,
    monthly: false,
    quarterly: false,
    semiAnnual: false,
    annual: true,
    weeklyAmount: '0',
    biWeeklyAmount: '0',
    monthlyAmount: '0',
    quarterlyAmount: '0',
    semiAnnualAmount: '0',
    annualAmount: '0',
  };
}

function formFromPackage(pkg: MembershipPackage): PackageFormState {
  const amount = (value: MembershipPackage[keyof MembershipPackage]) => String(amountNumber(value));
  return {
    name: pkg.name || '',
    description: pkg.description || '',
    benefits: (pkg.benefits || []).filter(Boolean).length > 0 ? (pkg.benefits || []).filter(Boolean) as string[] : [''],
    currency: (pkg.currency || 'TZS').toUpperCase(),
    weekly: pkg.weeklyAmount !== null && pkg.weeklyAmount !== undefined,
    biWeekly: pkg.biWeeklyAmount !== null && pkg.biWeeklyAmount !== undefined,
    monthly: pkg.monthlyAmount !== null && pkg.monthlyAmount !== undefined,
    quarterly: pkg.quarterlyAmount !== null && pkg.quarterlyAmount !== undefined,
    semiAnnual: pkg.semiAnnualAmount !== null && pkg.semiAnnualAmount !== undefined,
    annual: pkg.annualAmount !== null && pkg.annualAmount !== undefined,
    weeklyAmount: amount(pkg.weeklyAmount),
    biWeeklyAmount: amount(pkg.biWeeklyAmount),
    monthlyAmount: amount(pkg.monthlyAmount),
    quarterlyAmount: amount(pkg.quarterlyAmount),
    semiAnnualAmount: amount(pkg.semiAnnualAmount),
    annualAmount: amount(pkg.annualAmount),
  };
}

function validateForm(form: PackageFormState) {
  const errors: Record<string, string> = {};
  if (form.name.trim().length < 2) errors.name = 'Package name must be at least 2 characters.';
  if (form.name.trim().length > 100) errors.name = 'Package name cannot exceed 100 characters.';
  if (form.description.trim().length > 500) errors.description = 'Description cannot exceed 500 characters.';
  if (!/^[A-Z]{3}$/.test(form.currency.trim().toUpperCase())) errors.currency = 'Currency must be a 3-letter code.';
  const benefits = form.benefits.map((benefit) => benefit.trim()).filter(Boolean);
  if (benefits.length === 0) errors.benefits = 'At least one benefit is required.';
  const selectedCycles = billingCycles.filter((cycle) => Boolean(form[cycle.key]));
  if (selectedCycles.length === 0) errors.cycles = 'You must offer at least one payment frequency.';
  selectedCycles.forEach((cycle) => {
    const amount = parseAmount(form[cycle.amountKey]);
    if (amount === null || amount < 0) errors[cycle.amountKey] = 'Enter a valid non-negative amount.';
  });
  return errors;
}

function payloadFromForm(form: PackageFormState): MembershipPackagePayload {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    benefits: form.benefits.map((benefit) => benefit.trim()).filter(Boolean),
    currency: form.currency.trim().toUpperCase(),
    weeklyAmount: form.weekly ? parseAmount(form.weeklyAmount) ?? 0 : undefined,
    biWeeklyAmount: form.biWeekly ? parseAmount(form.biWeeklyAmount) ?? 0 : undefined,
    monthlyAmount: form.monthly ? parseAmount(form.monthlyAmount) ?? 0 : undefined,
    quarterlyAmount: form.quarterly ? parseAmount(form.quarterlyAmount) ?? 0 : undefined,
    semiAnnualAmount: form.semiAnnual ? parseAmount(form.semiAnnualAmount) ?? 0 : undefined,
    annualAmount: form.annual ? parseAmount(form.annualAmount) ?? 0 : undefined,
  };
}

function computePackageMetrics(packages: MembershipPackage[]) {
  const active = packages.filter((pkg) => pkg.active).length;
  const inactive = packages.length - active;
  const members = packages.reduce((sum, pkg) => sum + memberCount(pkg), 0);
  const free = packages.filter(isFreePackage).length;
  const withMembers = packages.filter((pkg) => memberCount(pkg) > 0).length;
  const lowest = packages.flatMap((pkg) => packageCycles(pkg).map((cycle) => ({ amount: cycle.amount, currency: pkg.currency || 'TZS' }))).sort((a, b) => a.amount - b.amount)[0];
  return {
    total: packages.length,
    active,
    inactive,
    members,
    free,
    withMembers,
    startingPrice: lowest ? formatCurrency(lowest.amount, lowest.currency) : 'No price',
  };
}

function packageCycles(pkg: MembershipPackage) {
  return [
    { key: 'weekly', label: 'Weekly', amount: amountNumber(pkg.weeklyAmount) },
    { key: 'biWeekly', label: 'Bi-weekly', amount: amountNumber(pkg.biWeeklyAmount) },
    { key: 'monthly', label: 'Monthly', amount: amountNumber(pkg.monthlyAmount) },
    { key: 'quarterly', label: 'Quarterly', amount: amountNumber(pkg.quarterlyAmount) },
    { key: 'semiAnnual', label: 'Semi-annual', amount: amountNumber(pkg.semiAnnualAmount) },
    { key: 'annual', label: 'Annual', amount: amountNumber(pkg.annualAmount) },
  ].filter((cycle) => amountExists(pkg, cycle.key));
}

function amountExists(pkg: MembershipPackage, key: string) {
  const map: Record<string, keyof MembershipPackage> = {
    weekly: 'weeklyAmount',
    biWeekly: 'biWeeklyAmount',
    monthly: 'monthlyAmount',
    quarterly: 'quarterlyAmount',
    semiAnnual: 'semiAnnualAmount',
    annual: 'annualAmount',
  };
  const value = pkg[map[key]];
  return value !== null && value !== undefined;
}

function cycleCount(pkg: MembershipPackage) {
  return packageCycles(pkg).length;
}

function packageSubtitle(pkg: MembershipPackage) {
  const cycles = packageCycles(pkg);
  if (cycles.length === 0) return pkg.description || 'No pricing cycles configured';
  return cycles.slice(0, 3).map((cycle) => `${cycle.label} ${formatCurrency(cycle.amount, pkg.currency || 'TZS')}`).join(' • ');
}

function startingPriceLabel(pkg: MembershipPackage) {
  const cycles = packageCycles(pkg).sort((a, b) => a.amount - b.amount);
  if (cycles.length === 0) return 'No price';
  return cycles[0].amount === 0 ? 'Free' : formatCurrency(cycles[0].amount, pkg.currency || 'TZS');
}

function isFreePackage(pkg: MembershipPackage) {
  const cycles = packageCycles(pkg);
  return cycles.length > 0 && cycles.every((cycle) => cycle.amount === 0);
}

function packageAccent(pkg: MembershipPackage): KpiTone {
  if (!pkg.active) return 'slate';
  if (isFreePackage(pkg)) return 'green';
  if (memberCount(pkg) > 0) return 'purple';
  return 'blue';
}

function packageListAccent(pkg: MembershipPackage): StatusTone {
  if (!pkg.active) return 'neutral';
  if (isFreePackage(pkg)) return 'success';
  if (memberCount(pkg) > 0) return 'review';
  return 'primary';
}

function sortPackages(a: MembershipPackage, b: MembershipPackage, sortBy: PackageSort) {
  if (sortBy === 'nameAsc') return String(a.name || '').localeCompare(String(b.name || ''));
  if (sortBy === 'membersDesc') return memberCount(b) - memberCount(a);
  if (sortBy === 'amountAsc') return lowestAmount(a) - lowestAmount(b);
  if (sortBy === 'statusAsc') return Number(b.active) - Number(a.active) || String(a.name || '').localeCompare(String(b.name || ''));
  return dateValue(b.updatedAt || b.createdAt) - dateValue(a.updatedAt || a.createdAt);
}

function lowestAmount(pkg: MembershipPackage) {
  const amounts = packageCycles(pkg).map((cycle) => cycle.amount);
  return amounts.length === 0 ? Number.MAX_SAFE_INTEGER : Math.min(...amounts);
}

function memberCount(pkg: MembershipPackage) {
  const value = Number(pkg.memberCount ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function amountNumber(value: unknown) {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? next : 0;
}

function parseAmount(value: string) {
  const normalized = value.replace(/,/g, '').trim();
  if (!normalized) return 0;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function dateValue(value?: string | null) {
  if (!value) return 0;
  const date = new Date(value).getTime();
  return Number.isFinite(date) ? date : 0;
}

function isFeatureUnavailable(message: string) {
  return /feature not available|association type/i.test(message);
}

function hasPackageManagePermission(user: { permissions?: string[]; roles?: string[]; associationRole?: string } | null) {
  const values = [...(user?.permissions || []), ...(user?.roles || []), user?.associationRole || ''].map((value) => value.toLowerCase());
  return values.some((value) =>
    [
      'packages_manage',
      'packages.manage',
      'subscriptions.manage',
      'members.create',
      'association_admin',
      'admin',
      'platform_admin',
      'chairperson',
      'treasurer',
    ].includes(value),
  );
}

function firstParam(value: unknown) {
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' ? value : undefined;
}

const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  noticeCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  sheetContent: {
    gap: 14,
    paddingBottom: 18,
  },
  detailActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  detailTitle: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  benefitInput: {
    flex: 1,
    minWidth: 0,
  },
  cycleBlock: {
    gap: 8,
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
  },
  submitButton: {
    flex: 1,
  },
  featureUnavailable: {
    gap: 12,
  },
  featureUnavailableIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
