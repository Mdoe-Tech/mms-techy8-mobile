import { router, useLocalSearchParams } from 'expo-router';
import {
  Building2,
  CheckCircle2,
  Edit3,
  Hash,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  MobileSheet,
  MobileSortSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
  MobileTextInput,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  createGovernanceStructureEntry,
  deleteGovernanceStructureEntry,
  getGovernanceStructure,
  updateGovernanceStructureEntry,
  type GovernanceStructureEntry,
} from '@/services/governance-service';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber } from '@/utils/format';

type StatusFilter = 'all' | 'active' | 'inactive' | 'vacant' | 'assigned';
type SortOption = 'orderAsc' | 'titleAsc' | 'roleAsc' | 'assignedAsc' | 'updatedDesc';

type StructureForm = {
  title: string;
  roleName: string;
  memberName: string;
  description: string;
  displayOrder: string;
  active: boolean;
};

const emptyForm: StructureForm = {
  title: '',
  roleName: '',
  memberName: '',
  description: '',
  displayOrder: '0',
  active: true,
};

const sortOptions = [
  { value: 'orderAsc', label: 'Display order', description: 'Follow the official governance sequence.' },
  { value: 'titleAsc', label: 'Structure body', description: 'Sort by board, committee, or body name.' },
  { value: 'roleAsc', label: 'Role name', description: 'Sort alphabetically by role.' },
  { value: 'assignedAsc', label: 'Assigned person', description: 'Show named office holders together.' },
  { value: 'updatedDesc', label: 'Recently updated', description: 'Latest edits first.' },
];

export default function MobileGovernanceStructureScreen() {
  const params = useLocalSearchParams();
  const { activeView, associationId, user } = useAuth();
  const [entries, setEntries] = useState<GovernanceStructureEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mutatingEntryId, setMutatingEntryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortValue, setSortValue] = useState<SortOption>('orderAsc');
  const [sortOpen, setSortOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<StructureForm>(emptyForm);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<GovernanceStructureEntry | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<GovernanceStructureEntry | null>(null);
  const [openedEntryId, setOpenedEntryId] = useState<string | null>(null);
  const [openedCreateParam, setOpenedCreateParam] = useState(false);

  const initialEntryId = Array.isArray(params.structureId) ? params.structureId[0] : params.structureId;
  const shouldOpenCreate = normalizeParamFlag(params.createRole);

  const loadEntries = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before loading governance structure.');
        return;
      }

      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);
      setNotice(null);

      try {
        const rows = await getGovernanceStructure(associationId);
        setEntries(rows);
      } catch (loadError) {
        setEntries([]);
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId],
  );

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadEntries();
    });
    return () => {
      active = false;
    };
  }, [loadEntries]);

  useEffect(() => {
    if (!initialEntryId || openedEntryId === initialEntryId || entries.length === 0) return;
    const entry = entries.find((row) => row.id === initialEntryId);
    if (entry) {
      void Promise.resolve().then(() => {
        setSelectedEntry(entry);
        setOpenedEntryId(initialEntryId);
      });
    }
  }, [entries, initialEntryId, openedEntryId]);

  useEffect(() => {
    if (!shouldOpenCreate || openedCreateParam) return;
    void Promise.resolve().then(() => {
      openCreate();
      setOpenedCreateParam(true);
    });
  }, [openedCreateParam, shouldOpenCreate]);

  const summary = useMemo(() => {
    const active = entries.filter((entry) => entry.active !== false).length;
    const assigned = entries.filter((entry) => Boolean(entry.memberName?.trim() || entry.memberId)).length;
    return {
      total: entries.length,
      active,
      inactive: entries.length - active,
      assigned,
      vacant: entries.length - assigned,
    };
  }, [entries]);

  const statusTabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: summary.total },
      { value: 'active', label: 'Active', count: summary.active },
      { value: 'vacant', label: 'Vacant', count: summary.vacant },
      { value: 'assigned', label: 'Assigned', count: summary.assigned },
      { value: 'inactive', label: 'Inactive', count: summary.inactive },
    ],
    [summary],
  );

  const filteredEntries = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const rows = entries.filter((entry) => {
      const assigned = Boolean(entry.memberName?.trim() || entry.memberId);
      const active = entry.active !== false;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && active) ||
        (statusFilter === 'inactive' && !active) ||
        (statusFilter === 'vacant' && !assigned) ||
        (statusFilter === 'assigned' && assigned);
      const haystack = [entry.title, entry.roleName, entry.memberName, entry.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return matchesStatus && (!query || haystack.includes(query));
    });

    return sortEntries(rows, sortValue);
  }, [entries, searchTerm, sortValue, statusFilter]);

  const structureItems = useMemo<MobileDataListItem[]>(
    () =>
      filteredEntries.map((entry) => {
        const assigned = Boolean(entry.memberName?.trim() || entry.memberId);
        const active = entry.active !== false;
        return {
          id: entry.id,
          title: entry.roleName,
          subtitle: `${entry.title} · ${assigned ? entry.memberName : 'Vacant'}`,
          meta: `Order ${formatNumber(Number(entry.displayOrder || 0))} · Updated ${formatDate(entry.updatedAt || entry.createdAt)}`,
          status: active ? 'Active' : 'Inactive',
          statusTone: active ? 'success' : 'neutral',
          initials: assigned ? initials(entry.memberName || entry.roleName) : 'VA',
          accent: assigned ? 'primary' : 'warning',
        };
      }),
    [filteredEntries],
  );

  const structureReportOptions = useMemo(
    () => ({
      title: 'Governance Structure',
      associationName: user?.associationName || 'Association',
      purpose: 'A current-view report of leadership bodies, roles, assigned office holders, vacancies, and update dates.',
      rows: filteredEntries,
      fileName: 'nane-governance-structure',
      metrics: [
        { label: 'Total roles', value: formatNumber(summary.total), helper: 'Structure entries' },
        { label: 'Active roles', value: formatNumber(summary.active), helper: 'Currently active' },
        { label: 'Assigned', value: formatNumber(summary.assigned), helper: 'Named office holders' },
        { label: 'Vacant', value: formatNumber(summary.vacant), helper: 'Need assignment' },
      ],
      filters: [
        { label: 'Search', value: searchTerm || 'All' },
        { label: 'Status', value: statusTabs.find((tab) => tab.value === statusFilter)?.label || statusFilter },
        { label: 'Sort', value: sortOptions.find((option) => option.value === sortValue)?.label || sortValue },
      ],
      columns: [
        { key: 'order', label: 'Order', align: 'center' as const, width: '7%', value: (row: GovernanceStructureEntry) => formatNumber(Number(row.displayOrder ?? 0)) },
        { key: 'body', label: 'Body', width: '18%', value: (row: GovernanceStructureEntry) => row.title || '-' },
        { key: 'role', label: 'Role', width: '16%', value: (row: GovernanceStructureEntry) => row.roleName || '-' },
        { key: 'assignedPerson', label: 'Assigned Person', width: '18%', value: (row: GovernanceStructureEntry) => row.memberName || 'Vacant' },
        { key: 'status', label: 'Status', width: '10%', value: (row: GovernanceStructureEntry) => (row.active === false ? 'Inactive' : 'Active') },
        { key: 'description', label: 'Description', width: '22%', value: (row: GovernanceStructureEntry) => row.description || '-' },
        { key: 'updated', label: 'Updated', width: '11%', value: (row: GovernanceStructureEntry) => formatDate(row.updatedAt || row.createdAt) },
      ],
    }),
    [filteredEntries, searchTerm, sortValue, statusFilter, statusTabs, summary, user?.associationName],
  );

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Association admin only" description="Governance structure is available from the association admin workspace." />;
  }

  if (loading) {
    return <MobilePageLoadingState kind="list" message="Loading governance structure" />;
  }

  const refresh = () => {
    void loadEntries('refresh');
  };

  function openCreate() {
    setEditingEntryId(null);
    setSelectedEntry(null);
    setDeleteEntry(null);
    setForm(emptyForm);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(entry: GovernanceStructureEntry) {
    setEditingEntryId(entry.id);
    setSelectedEntry(null);
    setDeleteEntry(null);
    setForm({
      title: entry.title,
      roleName: entry.roleName,
      memberName: entry.memberName || '',
      description: entry.description || '',
      displayOrder: String(entry.displayOrder ?? 0),
      active: entry.active !== false,
    });
    setError(null);
    setFormOpen(true);
  }

  function validateForm() {
    setError(null);
    if (!form.title.trim()) {
      setError('Structure body is required.');
      return false;
    }
    if (!form.roleName.trim()) {
      setError('Role name is required.');
      return false;
    }
    if (Number.isNaN(Number(form.displayOrder))) {
      setError('Display order must be a number.');
      return false;
    }
    return true;
  }

  const saveEntry = async () => {
    if (!associationId || !validateForm()) return;
    setSaving(true);
    setNotice(null);

    const payload = {
      title: form.title.trim(),
      roleName: form.roleName.trim(),
      memberName: form.memberName.trim() || null,
      description: form.description.trim() || null,
      displayOrder: Number(form.displayOrder || 0),
      active: form.active,
    };

    try {
      if (editingEntryId) {
        await updateGovernanceStructureEntry(associationId, editingEntryId, payload);
        setNotice('Governance role updated.');
      } else {
        await createGovernanceStructureEntry(associationId, payload);
        setNotice('Governance role created.');
      }
      setFormOpen(false);
      setEditingEntryId(null);
      setForm(emptyForm);
      setSelectedEntry(null);
      await loadEntries('refresh');
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const removeEntry = async () => {
    if (!associationId || !deleteEntry) return;
    setMutatingEntryId(deleteEntry.id);
    setNotice(null);

    try {
      await deleteGovernanceStructureEntry(associationId, deleteEntry.id);
      setNotice('Governance role deleted.');
      setDeleteEntry(null);
      setSelectedEntry(null);
      await loadEntries('refresh');
    } catch (deleteError) {
      setError(getApiErrorMessage(deleteError));
    } finally {
      setMutatingEntryId(null);
    }
  };

  return (
    <MobileScreen>
      <MobilePageHeader
        title="Governance Structure"
        eyebrow="Governance"
        subtitle="Manage leadership bodies, roles, office holders and vacancies."
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh" onPress={refresh} disabled={refreshing} />}
      />

      {error ? <MobileErrorState title="Governance structure issue" description={error} onRetry={() => setError(null)} retryLabel="Dismiss" /> : null}
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
          <MobileKpiCard title="Total Roles" value={formatNumber(summary.total)} description="Structure entries" icon={Building2} tone="blue" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Active Roles" value={formatNumber(summary.active)} description="Currently active" icon={ShieldCheck} tone="green" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Assigned" value={formatNumber(summary.assigned)} description="Named office holders" icon={UserCheck} tone="teal" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Vacant" value={formatNumber(summary.vacant)} description="Need assignment" icon={UserX} tone={summary.vacant > 0 ? 'orange' : 'green'} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard compact>
        <View style={styles.toolbarTop}>
          <View style={styles.toolbarCopy}>
            <MobileText variant="body" weight="bold">
              Leadership Roles
            </MobileText>
            <MobileText variant="small" tone="secondary">
              {formatNumber(filteredEntries.length)} of {formatNumber(entries.length)} roles shown.
            </MobileText>
          </View>
          <MobileStatusBadge
            label={summary.vacant > 0 ? 'Vacancies' : 'Fully assigned'}
            tone={summary.vacant > 0 ? 'warning' : 'success'}
          />
        </View>
        <View style={styles.actions}>
          <MobileButton label="Add Role" icon={Plus} onPress={openCreate} size="sm" />
          <MobileReportExportButton options={structureReportOptions} size="sm" onSuccess={(_uri, format) => setNotice(`${format.toUpperCase()} governance structure report is ready.`)} onError={(exportError) => setError(getApiErrorMessage(exportError))} />
        </View>
      </MobileCard>

      <MobileSearchToolbar value={searchTerm} onChange={setSearchTerm} placeholder="Search body, role, person..." onFilterPress={() => setSortOpen(true)} filterLabel="Sort" />
      <MobileStatusTabs tabs={statusTabs} value={statusFilter} onChange={(value) => setStatusFilter(value as StatusFilter)} />

      {structureItems.length === 0 ? (
        <MobileEmptyState
          title={entries.length === 0 ? 'No governance roles yet' : 'No matching roles'}
          description={entries.length === 0 ? 'Add the first leadership role to define this association structure.' : 'Adjust search or status filters to find the role you need.'}
          actionLabel={entries.length === 0 ? 'Add Role' : 'Reset Filters'}
          onAction={entries.length === 0 ? openCreate : () => {
            setSearchTerm('');
            setStatusFilter('all');
          }}
        />
      ) : (
        <MobileDataList items={structureItems} onPressItem={(item) => setSelectedEntry(entries.find((entry) => entry.id === item.id) || null)} />
      )}

      <MobileSortSheet
        visible={sortOpen}
        value={sortValue}
        options={sortOptions}
        onChange={(value) => setSortValue(value as SortOption)}
        onClose={() => setSortOpen(false)}
      />

      <MobileSheet
        visible={formOpen}
        title={editingEntryId ? 'Edit Governance Role' : 'Add Governance Role'}
        description="Define the body, role, assigned person, ordering and active status."
        onClose={() => {
          if (!saving) setFormOpen(false);
        }}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScroll}>
          <MobileTextInput label="Structure body" value={form.title} onChangeText={(value) => setForm((prev) => ({ ...prev, title: value }))} placeholder="Board, Committee, Council" disabled={saving} />
          <MobileTextInput label="Role name" value={form.roleName} onChangeText={(value) => setForm((prev) => ({ ...prev, roleName: value }))} placeholder="Chairperson, Secretary, Treasurer" disabled={saving} />
          <MobileTextInput label="Assigned person" value={form.memberName} onChangeText={(value) => setForm((prev) => ({ ...prev, memberName: value }))} placeholder="Optional member or office holder" disabled={saving} />
          <MobileTextInput label="Display order" value={form.displayOrder} onChangeText={(value) => setForm((prev) => ({ ...prev, displayOrder: value }))} keyboardType="number-pad" placeholder="0" disabled={saving} />
          <MobileTextInput label="Description" value={form.description} onChangeText={(value) => setForm((prev) => ({ ...prev, description: value }))} placeholder="Responsibilities, term notes, or appointment details" disabled={saving} />
          <MobileCheckboxRow
            label="Active role"
            description="Inactive roles stay in history but do not count as active leadership."
            checked={form.active}
            onChange={(checked) => setForm((prev) => ({ ...prev, active: checked }))}
            disabled={saving}
          />
          <View style={styles.formActions}>
            <MobileButton label="Cancel" variant="secondary" onPress={() => setFormOpen(false)} disabled={saving} />
            <MobileButton label={editingEntryId ? 'Update Role' : 'Create Role'} icon={editingEntryId ? Edit3 : Plus} loading={saving} onPress={saveEntry} fullWidth style={styles.formSubmit} />
          </View>
        </ScrollView>
      </MobileSheet>

      <MobileSheet visible={Boolean(selectedEntry)} title="Role Details" description="Review role assignment, status and ordering." onClose={() => setSelectedEntry(null)}>
        {selectedEntry ? (
          <View style={styles.detailContent}>
            <MobileCard compact accent={selectedEntry.active === false ? 'slate' : selectedEntry.memberName ? 'green' : 'orange'}>
              <View style={styles.detailTitleRow}>
                <View style={styles.detailTitleCopy}>
                  <MobileText variant="section" weight="bold">
                    {selectedEntry.roleName}
                  </MobileText>
                  <MobileText variant="small" tone="secondary">
                    {selectedEntry.title}
                  </MobileText>
                </View>
                <MobileStatusBadge label={selectedEntry.active === false ? 'Inactive' : 'Active'} tone={selectedEntry.active === false ? 'neutral' : 'success'} />
              </View>
            </MobileCard>

            <View style={styles.actions}>
              <MobileButton label="Edit" icon={Edit3} onPress={() => openEdit(selectedEntry)} size="sm" />
              <MobileButton label="Delete" variant="danger" icon={Trash2} disabled={mutatingEntryId === selectedEntry.id} onPress={() => setDeleteEntry(selectedEntry)} size="sm" />
            </View>

            <MobileCard compact>
              <MobileInfoRow label="Assigned person" value={selectedEntry.memberName || 'Vacant'} helper="Office holder currently recorded for this role." icon={selectedEntry.memberName ? UserCheck : UserX} status={selectedEntry.memberName ? 'Assigned' : 'Vacant'} />
              <MobileInfoRow label="Display order" value={formatNumber(Number(selectedEntry.displayOrder || 0))} helper="Lower values appear earlier in the official structure." icon={Hash} />
              <MobileInfoRow label="Last updated" value={formatDate(selectedEntry.updatedAt || selectedEntry.createdAt)} helper="Latest saved governance structure change." icon={RefreshCw} />
              <MobileInfoRow label="Description" value={selectedEntry.description || 'No notes recorded'} helper="Responsibilities, term notes, or appointment details." icon={Building2} />
            </MobileCard>
          </View>
        ) : null}
      </MobileSheet>

      <MobileConfirmSheet
        visible={Boolean(deleteEntry)}
        title="Delete governance role?"
        description={deleteEntry ? `Delete "${deleteEntry.roleName}" from ${deleteEntry.title}? This action cannot be undone.` : 'Delete this governance role?'}
        confirmLabel="Delete Role"
        destructive
        onCancel={() => setDeleteEntry(null)}
        onConfirm={removeEntry}
      />
    </MobileScreen>
  );
}

function sortEntries(entries: GovernanceStructureEntry[], sortValue: SortOption) {
  const rows = [...entries];
  if (sortValue === 'orderAsc') {
    return rows.sort((left, right) => Number(left.displayOrder || 0) - Number(right.displayOrder || 0) || left.roleName.localeCompare(right.roleName));
  }
  if (sortValue === 'titleAsc') return rows.sort((left, right) => left.title.localeCompare(right.title) || left.roleName.localeCompare(right.roleName));
  if (sortValue === 'roleAsc') return rows.sort((left, right) => left.roleName.localeCompare(right.roleName));
  if (sortValue === 'assignedAsc') return rows.sort((left, right) => (left.memberName || '').localeCompare(right.memberName || '') || left.roleName.localeCompare(right.roleName));
  return rows.sort((left, right) => dateTime(right.updatedAt || right.createdAt) - dateTime(left.updatedAt || left.createdAt));
}

function dateTime(value?: string | null) {
  return new Date(value || '').getTime() || 0;
}

function normalizeParamFlag(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'true' || raw === '1' || raw === 'yes';
}

function initials(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

const styles = StyleSheet.create({
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noticeText: {
    flex: 1,
  },
  toolbarTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  toolbarCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  formScroll: {
    gap: 12,
    paddingBottom: 10,
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  formSubmit: {
    flex: 1,
  },
  detailContent: {
    gap: 12,
  },
  detailTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  detailTitleCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
});
