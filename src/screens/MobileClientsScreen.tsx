import { router, useLocalSearchParams } from 'expo-router';
import {
  Building2,
  CheckCircle2,
  Edit3,
  Mail,
  MapPin,
  Phone,
  Plus,
  ReceiptText,
  RefreshCw,
  Trash2,
  Users,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
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
  MobileSheet,
  MobileStatusBadge,
  MobileText,
  MobileTextInput,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  createAssociationClient,
  deleteAssociationClient,
  getAssociationClients,
  updateAssociationClient,
  type AssociationClient,
  type AssociationClientPayload,
} from '@/services/client-service';
import { type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber } from '@/utils/format';

type ClientFilter = 'all' | 'active' | 'missingTin' | 'withVrn';
type FormMode = 'create' | 'edit' | null;

type ClientFormState = {
  id?: string;
  name: string;
  email: string;
  phoneNumber: string;
  address: string;
  tin: string;
  vrn: string;
};

const PAGE_SIZE = 100;

const emptyForm = (): ClientFormState => ({
  name: '',
  email: '',
  phoneNumber: '',
  address: '',
  tin: '',
  vrn: '',
});

export default function MobileClientsScreen() {
  const params = useLocalSearchParams();
  const { activeView, user } = useAuth();
  const [clients, setClients] = useState<AssociationClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<ClientFilter>('all');
  const [selectedClient, setSelectedClient] = useState<AssociationClient | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const initialMode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const initialClientId = Array.isArray(params.clientId) ? params.clientId[0] : params.clientId;
  const [formMode, setFormMode] = useState<FormMode>(() => (initialMode === 'create' ? 'create' : null));
  const [form, setForm] = useState<ClientFormState>(() => emptyForm());
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [deleteClient, setDeleteClient] = useState<AssociationClient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const initialDetailConsumed = useRef(false);

  const canManageClients = useMemo(() => hasClientManagePermission(user), [user]);

  const loadClients = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      setError(null);
      try {
        const response = await getAssociationClients({
          size: PAGE_SIZE,
          query: searchTerm,
          sort: 'name,asc',
        });
        setClients(response.clients);
      } catch (loadError) {
        setError(getApiErrorMessage(loadError));
        setClients([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [searchTerm],
  );

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (active) void loadClients('initial');
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [loadClients]);

  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      if (filter === 'active') return (client.status || '').toUpperCase() === 'ACTIVE';
      if (filter === 'missingTin') return !client.tin;
      if (filter === 'withVrn') return Boolean(client.vrn);
      return true;
    });
  }, [clients, filter]);

  const metrics = useMemo(
    () => ({
      total: clients.length,
      active: clients.filter((client) => (client.status || '').toUpperCase() === 'ACTIVE').length,
      missingTin: clients.filter((client) => !client.tin).length,
      withVrn: clients.filter((client) => Boolean(client.vrn)).length,
    }),
    [clients],
  );

  const tabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: clients.length },
      { value: 'active', label: 'Active', count: metrics.active },
      { value: 'missingTin', label: 'No TIN', count: metrics.missingTin },
      { value: 'withVrn', label: 'VRN', count: metrics.withVrn },
    ],
    [clients.length, metrics],
  );

  const listItems = useMemo<MobileDataListItem[]>(
    () =>
      filteredClients.map((client) => ({
        id: client.id,
        title: client.name,
        subtitle: [client.email || 'No email', client.phoneNumber || 'No phone'].join(' · '),
        meta: client.tin ? `TIN ${client.tin}` : 'TIN not recorded',
        amount: client.vrn ? `VRN ${client.vrn}` : undefined,
        status: client.status || 'ACTIVE',
        statusTone: clientStatusTone(client.status),
        accent: client.vrn ? 'success' : client.tin ? 'primary' : 'warning',
      })),
    [filteredClients],
  );

  const openDetails = useCallback(
    (item: MobileDataListItem) => {
      const client = clients.find((entry) => entry.id === item.id);
      if (!client) return;
      setSelectedClient(client);
      setDetailOpen(true);
    },
    [clients],
  );

  useEffect(() => {
    if (!initialClientId || initialDetailConsumed.current || clients.length === 0 || formMode) return;
    const client = clients.find((item) => item.id === initialClientId);
    if (!client) return;
    initialDetailConsumed.current = true;
    const timer = setTimeout(() => {
      openDetails({ id: client.id, title: client.name });
    }, 0);
    return () => clearTimeout(timer);
  }, [clients, formMode, initialClientId, openDetails]);

  const openCreate = () => {
    if (!canManageClients) return;
    setForm(emptyForm());
    setValidationErrors({});
    setNotice(null);
    setError(null);
    setFormMode('create');
    setDetailOpen(false);
    setSelectedClient(null);
    setDeleteClient(null);
  };

  const openEdit = (client: AssociationClient) => {
    if (!canManageClients) return;
    setForm(formFromClient(client));
    setValidationErrors({});
    setNotice(null);
    setFormMode('edit');
    setDetailOpen(false);
  };

  const updateField = <K extends keyof ClientFormState>(field: K, value: ClientFormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setValidationErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const saveClient = async () => {
    if (!canManageClients) return;
    const nextErrors = validateForm(form);
    setValidationErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError('Please correct the highlighted fields before saving this client.');
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = buildPayload(form);
      const saved = formMode === 'edit' && form.id
        ? await updateAssociationClient(form.id, payload)
        : await createAssociationClient(payload);
      setNotice(`Client "${saved.name}" saved successfully.`);
      setSelectedClient(saved);
      setFormMode(null);
      await loadClients('refresh');
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteClient || !canManageClients) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteAssociationClient(deleteClient.id);
      setNotice(`Client "${deleteClient.name}" deleted successfully.`);
      setSelectedClient(null);
      setDetailOpen(false);
      setDeleteClient(null);
      await loadClients('refresh');
    } catch (deleteError) {
      setError(getApiErrorMessage(deleteError));
    } finally {
      setDeleting(false);
    }
  };

  const clientReportOptions = useMemo(
    () => ({
      title: 'Clients Report',
      associationName: user?.associationName || 'Association',
      purpose: 'A filtered register of bill-to client profiles, tax identifiers, contacts, and status.',
      rows: filteredClients,
      fileName: 'nane-clients',
      metrics: [
        { label: 'Clients', value: formatNumber(metrics.total), helper: 'Loaded bill-to profiles' },
        { label: 'Active', value: formatNumber(metrics.active), helper: 'Ready for billing' },
        { label: 'Missing TIN', value: formatNumber(metrics.missingTin), helper: 'Need tax details' },
        { label: 'With VRN', value: formatNumber(metrics.withVrn), helper: 'VAT registered' },
      ],
      filters: [
        { label: 'Search', value: searchTerm || 'All' },
        { label: 'Filter', value: tabs.find((tab) => tab.value === filter)?.label || filter },
      ],
      columns: [
        { key: 'number', label: '#', align: 'center' as const, width: '5%', value: (_client: AssociationClient, index: number) => index + 1 },
        { key: 'name', label: 'Client', width: '20%', value: (client: AssociationClient) => client.name || '-' },
        { key: 'email', label: 'Email', width: '18%', value: (client: AssociationClient) => client.email || '-' },
        { key: 'phoneNumber', label: 'Phone', width: '13%', value: (client: AssociationClient) => client.phoneNumber || '-' },
        { key: 'address', label: 'Address', width: '18%', value: (client: AssociationClient) => client.address || '-' },
        { key: 'tin', label: 'TIN', width: '10%', value: (client: AssociationClient) => client.tin || '-' },
        { key: 'vrn', label: 'VRN', width: '8%', value: (client: AssociationClient) => client.vrn || '-' },
        { key: 'status', label: 'Status', width: '8%', value: (client: AssociationClient) => client.status || 'ACTIVE' },
      ],
    }),
    [filter, filteredClients, metrics, searchTerm, tabs, user?.associationName],
  );

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Association admin only" description="Client billing profiles are available from the association admin workspace." />;
  }

  if (loading && clients.length === 0) {
    return <MobilePageLoadingState kind="list" message="Loading clients" />;
  }

  if (formMode) {
    return (
      <MobileScreen>
        <MobilePageHeader
          title={formMode === 'edit' ? 'Edit Client' : 'New Client'}
          eyebrow="Billing"
          subtitle="Manage bill-to contact, tax and address details."
          onBack={() => setFormMode(null)}
        />

        {error ? <MobileErrorState title="Client form issue" description={error} onRetry={() => setError(null)} retryLabel="Dismiss" /> : null}
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

        <MobileCard compact accent={form.vrn ? 'green' : form.tin ? 'blue' : 'orange'}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCopy}>
              <MobileText variant="section" weight="bold">
                {form.name || 'Unnamed client'}
              </MobileText>
              <MobileText variant="small" tone="secondary">
                {[form.email || 'No email', form.phoneNumber || 'No phone'].join(' · ')}
              </MobileText>
            </View>
            <MobileStatusBadge status={form.vrn ? 'VRN' : form.tin ? 'TIN' : 'Incomplete'} tone={form.vrn ? 'success' : form.tin ? 'primary' : 'warning'} />
          </View>
        </MobileCard>

        <MobileFormSection title="Client Details" description="Company name and billing contact information.">
          <MobileTextInput
            label="Client / Company Name *"
            value={form.name}
            onChangeText={(value) => updateField('name', value)}
            placeholder="Acme Corp Ltd"
            error={validationErrors.name}
            icon={Building2}
          />
          <MobileTextInput
            label="Email"
            value={form.email}
            onChangeText={(value) => updateField('email', value)}
            placeholder="billing@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            error={validationErrors.email}
            icon={Mail}
          />
          <MobileTextInput
            label="Phone"
            value={form.phoneNumber}
            onChangeText={(value) => updateField('phoneNumber', value)}
            placeholder="+255..."
            keyboardType="phone-pad"
            icon={Phone}
          />
          <MobileTextInput
            label="Address"
            value={form.address}
            onChangeText={(value) => updateField('address', value)}
            placeholder="Physical or P.O. Box address"
            multiline
            numberOfLines={3}
            icon={MapPin}
          />
        </MobileFormSection>

        <MobileFormSection title="Tax Details" description="Optional tax identifiers used on invoices and receipts.">
          <MobileTextInput
            label="TIN"
            value={form.tin}
            onChangeText={(value) => updateField('tin', value)}
            placeholder="9-digit TIN"
            keyboardType="number-pad"
            error={validationErrors.tin}
            icon={ReceiptText}
          />
          <MobileTextInput
            label="VRN"
            value={form.vrn}
            onChangeText={(value) => updateField('vrn', value)}
            placeholder="VAT registration number"
            autoCapitalize="characters"
            icon={ReceiptText}
          />
        </MobileFormSection>

        <View style={styles.actions}>
          <MobileButton label="Cancel" variant="secondary" onPress={() => setFormMode(null)} disabled={saving} />
          <MobileButton label={saving ? 'Saving...' : formMode === 'edit' ? 'Update Client' : 'Create Client'} icon={CheckCircle2} onPress={saveClient} loading={saving} disabled={saving} />
        </View>
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        title="Clients"
        eyebrow="Billing"
        subtitle="Manage external clients and bill-to profiles."
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh" onPress={() => void loadClients('refresh')} disabled={refreshing} />}
      />

      {error ? <MobileErrorState title="Clients issue" description={error} onRetry={() => void loadClients('refresh')} /> : null}
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
          <MobileKpiCard title="Clients" value={formatNumber(metrics.total)} description="Loaded bill-to profiles" tone="blue" icon={Users} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Active" value={formatNumber(metrics.active)} description="Ready for billing" tone="green" icon={CheckCircle2} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Missing TIN" value={formatNumber(metrics.missingTin)} description="Need tax details" tone="orange" icon={ReceiptText} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="With VRN" value={formatNumber(metrics.withVrn)} description="VAT registered" tone="purple" icon={ReceiptText} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileFilterControls
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search clients by name, email or TIN..."
        tabs={tabs}
        value={filter}
        onChange={(value) => setFilter(value as ClientFilter)}
        primaryAction={canManageClients ? { label: 'New Client', icon: Plus, onPress: openCreate } : null}
        actionSlot={<MobileReportExportButton fullWidth options={clientReportOptions} onError={(exportError) => setError(getApiErrorMessage(exportError))} />}
      />

      {filteredClients.length === 0 && !loading ? (
        <MobileEmptyState
          title="No clients found"
          description={searchTerm ? 'Adjust the search or clear filters to see more clients.' : 'Create the first bill-to profile for invoices and receipts.'}
          actionLabel={canManageClients ? 'New Client' : undefined}
          onAction={canManageClients ? openCreate : undefined}
        />
      ) : (
        <MobileDataList items={listItems} onPressItem={openDetails} />
      )}

      <MobileSheet
        visible={detailOpen}
        title={selectedClient?.name || 'Client details'}
        description="Bill-to profile"
        onClose={() => setDetailOpen(false)}
      >
        {selectedClient ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>
            <View style={styles.sheetBadges}>
              <MobileStatusBadge status={selectedClient.status || 'ACTIVE'} tone={clientStatusTone(selectedClient.status)} />
              {selectedClient.tin ? <MobileStatusBadge status="TIN" label="TIN recorded" tone="primary" /> : <MobileStatusBadge status="Missing TIN" tone="warning" />}
              {selectedClient.vrn ? <MobileStatusBadge status="VRN" label="VRN recorded" tone="success" /> : null}
            </View>

            <MobileCard compact>
              <MobileInfoRow label="Email" value={selectedClient.email || 'Not recorded'} icon={Mail} />
              <MobileInfoRow label="Phone" value={selectedClient.phoneNumber || 'Not recorded'} icon={Phone} />
              <MobileInfoRow label="Address" value={selectedClient.address || 'Not recorded'} icon={MapPin} />
              <MobileInfoRow label="TIN" value={selectedClient.tin || 'Not recorded'} icon={ReceiptText} />
              <MobileInfoRow label="VRN" value={selectedClient.vrn || 'Not recorded'} icon={ReceiptText} />
              <MobileInfoRow label="Created" value={formatDate(selectedClient.createdAt)} />
              <MobileInfoRow label="Updated" value={formatDate(selectedClient.updatedAt)} />
            </MobileCard>

            <View style={styles.detailActions}>
              {selectedClient.email ? (
                <MobileButton label="Email" icon={Mail} variant="secondary" onPress={() => void Linking.openURL(`mailto:${selectedClient.email}`)} size="sm" />
              ) : null}
              {selectedClient.phoneNumber ? (
                <MobileButton label="Call" icon={Phone} variant="secondary" onPress={() => void Linking.openURL(`tel:${selectedClient.phoneNumber}`)} size="sm" />
              ) : null}
              {canManageClients ? (
                <>
                  <MobileButton label="Edit" icon={Edit3} variant="secondary" onPress={() => openEdit(selectedClient)} size="sm" />
                  <MobileButton label="Delete" icon={Trash2} variant="danger" onPress={() => setDeleteClient(selectedClient)} loading={deleting} disabled={deleting} size="sm" />
                </>
              ) : null}
            </View>
          </ScrollView>
        ) : null}
      </MobileSheet>

      <MobileConfirmSheet
        visible={Boolean(deleteClient)}
        title="Delete client"
        description={`Delete "${deleteClient?.name || 'this client'}"? This cannot be undone and may fail if invoices still depend on this profile.`}
        confirmLabel={deleting ? 'Deleting...' : 'Delete Client'}
        destructive
        onCancel={() => setDeleteClient(null)}
        onConfirm={confirmDelete}
      />
    </MobileScreen>
  );
}

function formFromClient(client: AssociationClient): ClientFormState {
  return {
    id: client.id,
    name: client.name || '',
    email: client.email || '',
    phoneNumber: client.phoneNumber || '',
    address: client.address || '',
    tin: client.tin || '',
    vrn: client.vrn || '',
  };
}

function validateForm(form: ClientFormState) {
  const errors: Record<string, string> = {};
  if (!form.name.trim()) errors.name = 'Client name is required.';
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = 'Use a valid email address.';
  }
  if (form.tin.trim() && !/^\d{6,20}$/.test(form.tin.trim())) {
    errors.tin = 'Use digits only.';
  }
  return errors;
}

function buildPayload(form: ClientFormState): AssociationClientPayload {
  return {
    name: form.name.trim(),
    email: textOrNull(form.email),
    phoneNumber: textOrNull(form.phoneNumber),
    address: textOrNull(form.address),
    tin: textOrNull(form.tin),
    vrn: textOrNull(form.vrn),
    status: 'ACTIVE',
  };
}

function textOrNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function clientStatusTone(status?: string | null): StatusTone {
  const value = (status || '').toUpperCase();
  if (value === 'ACTIVE') return 'success';
  if (value === 'INACTIVE') return 'neutral';
  if (value === 'SUSPENDED') return 'warning';
  return 'primary';
}

function hasClientManagePermission(user: { permissions?: string[]; roles?: string[]; associationRole?: string } | null) {
  const values = [...(user?.permissions || []), ...(user?.roles || []), user?.associationRole || ''].map((value) => value.toLowerCase());
  return values.some((value) =>
    [
      'finance.transactions.create',
      'finance.transactions.update',
      'invoices_manage',
      'finance_manage',
      'association_admin',
      'admin',
    ].includes(value),
  );
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
