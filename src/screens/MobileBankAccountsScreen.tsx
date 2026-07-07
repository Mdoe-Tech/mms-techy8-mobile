import { router, useLocalSearchParams } from 'expo-router';
import {
  Building2,
  Edit3,
  Landmark,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  WalletCards,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

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
  MobileFormSection,
  MobileIconButton,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobilePageLoadingState,
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
import {
  createAssociationBankAccount,
  deleteAssociationBankAccount,
  getAssociationBankAccounts,
  isBankAccountPrimary,
  setAssociationBankAccountPrimary,
  updateAssociationBankAccount,
  type BankAccount,
  type BankAccountPayload,
} from '@/services/wallet-service';
import { getApiErrorMessage } from '@/types/api';
import { formatNumber } from '@/utils/format';

type BankAccountTab = 'all' | 'primary' | 'standard';
type BankAccountFormMode = 'create' | 'edit';

type BankAccountFormState = {
  accountName: string;
  accountNumber: string;
  bankName: string;
  bankBranch: string;
  isPrimary: boolean;
};

type BankAccountFormSheet = {
  mode: BankAccountFormMode;
  account?: BankAccount;
} | null;

type ConfirmAction =
  | { type: 'delete'; account: BankAccount }
  | { type: 'primary'; account: BankAccount }
  | null;

const tanzanianBankOptions = [
  'CRDB Bank PLC',
  'NMB Bank PLC',
  'NBC (National Bank of Commerce)',
  'Equity Bank Tanzania',
  'Stanbic Bank Tanzania',
  'Standard Chartered Bank Tanzania',
  'Absa Bank Tanzania',
  'Exim Bank Tanzania',
  'I&M Bank Tanzania',
  'Azania Bank',
  'UBA Tanzania',
  'DTB (Diamond Trust Bank)',
  'Mkombozi Commercial Bank',
  'TPB Bank (Tanzania Postal Bank)',
  'Kilimanjaro Cooperative Bank',
  'Mwanga Community Bank',
  'FINCA Tanzania',
  'AccessBank Tanzania',
  "People's Bank of Zanzibar (PBZ)",
  'NCBA Tanzania',
  'Letshego Bank Tanzania',
  'Maendeleo Bank',
  'Bank M Tanzania',
  'Akiba Commercial Bank',
  'Other',
].map((bank) => ({ label: bank, value: bank }));

export default function MobileBankAccountsScreen() {
  const params = useLocalSearchParams();
  const { activeView, associationId, user } = useAuth();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<BankAccountTab>('all');
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
  const [formSheet, setFormSheet] = useState<BankAccountFormSheet>(null);
  const [form, setForm] = useState<BankAccountFormState>(() => emptyForm());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [handledPreviewKey, setHandledPreviewKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const previewMode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const previewAccountId = Array.isArray(params.accountId) ? params.accountId[0] : params.accountId;
  const canManageAccounts = useMemo(() => hasSettingsUpdatePermission(user), [user]);

  const loadAccounts = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before loading bank accounts.');
        return;
      }

      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        const loaded = await getAssociationBankAccounts(associationId);
        setAccounts([...loaded].sort(sortAccounts));
      } catch (loadError) {
        setAccounts([]);
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId],
  );

  const openCreateForm = useCallback(() => {
    setNotice(null);
    setError(null);
    setSelectedAccount(null);
    setForm(emptyForm());
    setFormErrors({});
    setFormSheet({ mode: 'create' });
  }, []);

  const openEditForm = useCallback((account: BankAccount) => {
    setNotice(null);
    setError(null);
    setSelectedAccount(null);
    setForm(formFromAccount(account));
    setFormErrors({});
    setFormSheet({ mode: 'edit', account });
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadAccounts();
    });
    return () => {
      active = false;
    };
  }, [loadAccounts]);

  useEffect(() => {
    if (loading) return;
    const previewKey = `${previewMode || 'detail'}:${previewAccountId || 'none'}`;
    if (handledPreviewKey === previewKey) return;

    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      if (previewMode === 'create') {
        openCreateForm();
        setHandledPreviewKey(previewKey);
        return;
      }

      if (previewAccountId) {
        const account = accounts.find((item) => item.id === previewAccountId);
        if (!account) return;
        if (previewMode === 'edit') {
          openEditForm(account);
        } else {
          setSelectedAccount(account);
        }
        setHandledPreviewKey(previewKey);
      }
    });

    return () => {
      active = false;
    };
  }, [accounts, handledPreviewKey, loading, openCreateForm, openEditForm, previewAccountId, previewMode]);

  const metrics = useMemo(() => {
    const primary = accounts.find((account) => isBankAccountPrimary(account));
    const standardCount = accounts.filter((account) => !isBankAccountPrimary(account)).length;
    const bankCount = new Set(accounts.map((account) => account.bankName).filter(Boolean)).size;
    return {
      total: accounts.length,
      primary,
      standardCount,
      bankCount,
      ready: Boolean(primary),
    };
  }, [accounts]);

  const tabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: accounts.length },
      { value: 'primary', label: 'Primary', count: metrics.primary ? 1 : 0 },
      { value: 'standard', label: 'Standard', count: metrics.standardCount },
    ],
    [accounts.length, metrics.primary, metrics.standardCount],
  );

  const visibleAccounts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return accounts.filter((account) => {
      if (activeTab === 'primary' && !isBankAccountPrimary(account)) return false;
      if (activeTab === 'standard' && isBankAccountPrimary(account)) return false;
      if (!query) return true;
      return [account.accountName, account.accountNumber, account.bankName, account.bankBranch]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [accounts, activeTab, searchTerm]);

  const listItems = useMemo<MobileDataListItem[]>(
    () =>
      visibleAccounts.map((account) => ({
        id: account.id,
        title: account.accountName || 'Bank account',
        subtitle: maskAccountNumber(account.accountNumber),
        meta: `${account.bankName || 'Bank not set'} · ${account.bankBranch || 'Branch not set'}`,
        status: isBankAccountPrimary(account) ? 'Primary' : 'Standard',
        statusTone: isBankAccountPrimary(account) ? 'success' : 'neutral',
        accent: isBankAccountPrimary(account) ? 'success' : 'info',
      })),
    [visibleAccounts],
  );

  const updateForm = <K extends keyof BankAccountFormState>(field: K, value: BankAccountFormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((current) => ({ ...current, [field]: '' }));
    }
  };

  const closeForm = () => {
    setFormSheet(null);
    setForm(emptyForm());
    setFormErrors({});
  };

  const saveAccount = async () => {
    if (!associationId || !formSheet) return;
    if (!canManageAccounts) {
      setError('Your role cannot update bank accounts.');
      return;
    }

    const validation = validateForm(form);
    setFormErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const payload = buildPayload(form, formSheet.mode === 'create' && accounts.length === 0);
      if (formSheet.mode === 'edit' && formSheet.account?.id) {
        await updateAssociationBankAccount(formSheet.account.id, payload);
        setNotice('Bank account updated.');
      } else {
        const createdAccount = await createAssociationBankAccount(associationId, payload);
        if (payload.isPrimary && createdAccount.id) {
          try {
            await setAssociationBankAccountPrimary(createdAccount.id);
          } catch (primaryError) {
            const message = getApiErrorMessage(primaryError).toLowerCase();
            if (!message.includes('already') || !message.includes('primary')) {
              throw primaryError;
            }
          }
        }
        setNotice('Bank account created.');
      }
      closeForm();
      await loadAccounts('refresh');
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const runConfirmAction = async () => {
    if (!confirmAction) return;
    if (!canManageAccounts) {
      setError('Your role cannot update bank accounts.');
      setConfirmAction(null);
      return;
    }

    setSaving(confirmAction.type === 'primary');
    setError(null);
    setNotice(null);

    try {
      if (confirmAction.type === 'delete') {
        await deleteAssociationBankAccount(confirmAction.account.id);
        setNotice('Bank account deleted.');
      } else {
        await setAssociationBankAccountPrimary(confirmAction.account.id);
        setNotice('Primary bank account updated.');
      }
      setSelectedAccount(null);
      await loadAccounts('refresh');
    } catch (actionError) {
      setError(getApiErrorMessage(actionError));
    } finally {
      setConfirmAction(null);
      setSaving(false);
    }
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Bank accounts" description="Bank account settings are available for association admin workspaces only." />;
  }

  if (loading) {
    return <MobilePageLoadingState kind="list" message="Loading bank accounts" />;
  }

  if (!associationId) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Settings" title="Bank accounts" subtitle="Association context unavailable" onBack={() => router.back()} />
        <MobileErrorState title="Association not selected" description="Sign in through an association account before managing bank accounts." />
      </MobileScreen>
    );
  }

  if (error && accounts.length === 0 && !notice) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Settings"
          title="Bank accounts"
          subtitle="Payment destination setup"
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry" variant="secondary" disabled={refreshing} onPress={() => void loadAccounts('refresh')} />}
        />
        <MobileErrorState title="Bank accounts could not load" description={error} retryLabel="Retry" onRetry={() => void loadAccounts('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Settings"
        title="Bank accounts"
        subtitle="Manage payment destination accounts."
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={Plus} label="Add bank account" variant="primary" disabled={!canManageAccounts} onPress={openCreateForm} />}
      />

      {error ? <MobileStatusBadge status="Failed" label={error} tone="danger" /> : null}
      {notice ? <MobileToast title="Bank account updated" description={notice} tone="success" /> : null}
      {!canManageAccounts ? <MobileStatusBadge status="Read only" label="Your role can review bank accounts but cannot change them." tone="info" /> : null}

      <MobileCard compact accent={metrics.ready ? 'green' : 'orange'}>
        <View style={styles.heroRow}>
          <View style={[styles.heroIcon, { backgroundColor: metrics.ready ? '#15803D' : '#C2410C' }]}>
            <Landmark color="#FFFFFF" size={22} strokeWidth={2.5} />
          </View>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold" numberOfLines={2}>
              {metrics.primary?.bankName || 'No primary bank account'}
            </MobileText>
            <MobileText variant="small" tone="secondary" numberOfLines={2}>
              {metrics.primary ? `${metrics.primary.accountName || 'Primary account'} · ${maskAccountNumber(metrics.primary.accountNumber)}` : 'Add a primary account for member payments.'}
            </MobileText>
          </View>
          <MobileStatusBadge status={metrics.ready ? 'Ready' : 'Required'} tone={metrics.ready ? 'success' : 'warning'} />
        </View>
      </MobileCard>

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Accounts" value={formatNumber(metrics.total)} description="Configured accounts" icon={WalletCards} tone="blue" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Primary" value={metrics.primary ? 'Ready' : 'Missing'} description="Member payment account" icon={Star} tone={metrics.primary ? 'green' : 'orange'} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Banks" value={formatNumber(metrics.bankCount)} description="Unique bank names" icon={Building2} tone="purple" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Standard" value={formatNumber(metrics.standardCount)} description="Backup accounts" icon={ShieldCheck} tone="teal" />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileSearchToolbar value={searchTerm} onChange={setSearchTerm} placeholder="Search bank, branch, account..." />
      <MobileStatusTabs tabs={tabs} value={activeTab} onChange={(value) => setActiveTab(value as BankAccountTab)} />

      {listItems.length > 0 ? (
        <MobileDataList
          items={listItems}
          onPressItem={(item) => {
            const account = visibleAccounts.find((candidate) => candidate.id === item.id);
            if (account) setSelectedAccount(account);
          }}
        />
      ) : (
        <MobileEmptyState
          title={accounts.length ? 'No matching bank accounts' : 'No bank accounts configured'}
          description={accounts.length ? 'Clear search or status filters to see more accounts.' : 'Add an association bank account so members and wallet workflows have a payment destination.'}
          actionLabel={canManageAccounts ? 'Add bank account' : undefined}
          onAction={canManageAccounts ? openCreateForm : undefined}
        />
      )}

      <BankAccountDetailSheet
        account={selectedAccount}
        canManage={canManageAccounts}
        onClose={() => setSelectedAccount(null)}
        onEdit={openEditForm}
        onSetPrimary={(account) => setConfirmAction({ type: 'primary', account })}
        onDelete={(account) => setConfirmAction({ type: 'delete', account })}
      />

      <MobileSheet
        visible={Boolean(formSheet)}
        title={formSheet?.mode === 'edit' ? 'Edit bank account' : 'Add bank account'}
        description={formSheet?.mode === 'edit' ? 'Update account details. Primary status is changed from the account actions.' : 'Create a bank account for member payments and wallet withdrawals.'}
        onClose={closeForm}
      >
        <MobileFormSection title="Account details" description="Use the official bank name and branch so payment instructions are clear.">
          <MobileTextInput
            label="Account name *"
            value={form.accountName}
            onChangeText={(value) => updateForm('accountName', value)}
            placeholder="Association Main Account"
            error={formErrors.accountName}
            icon={WalletCards}
            disabled={saving}
          />
          <MobileTextInput
            label="Account number *"
            value={form.accountNumber}
            onChangeText={(value) => updateForm('accountNumber', value)}
            placeholder="0150012345678"
            error={formErrors.accountNumber}
            icon={Search}
            keyboardType="number-pad"
            disabled={saving}
          />
          <MobileSelect
            label="Bank name *"
            value={form.bankName}
            options={tanzanianBankOptions}
            onChange={(value) => updateForm('bankName', value)}
            placeholder="Select a bank"
            disabled={saving}
          />
          {formErrors.bankName ? (
            <MobileText variant="small" style={styles.errorText}>
              {formErrors.bankName}
            </MobileText>
          ) : null}
          <MobileTextInput
            label="Bank branch *"
            value={form.bankBranch}
            onChangeText={(value) => updateForm('bankBranch', value)}
            placeholder="Mikocheni Branch"
            error={formErrors.bankBranch}
            icon={Building2}
            disabled={saving}
          />
          {formSheet?.mode === 'create' ? (
            <MobileCheckboxRow
              label="Set as primary account"
              description={accounts.length === 0 ? 'The first account becomes primary automatically.' : 'Show this account to members as the main payment destination.'}
              checked={form.isPrimary || accounts.length === 0}
              onChange={(checked) => updateForm('isPrimary', checked)}
              disabled={saving || accounts.length === 0}
            />
          ) : null}
          <MobileButton label={formSheet?.mode === 'edit' ? 'Save changes' : 'Create account'} icon={Save} loading={saving} disabled={saving || !canManageAccounts} fullWidth onPress={() => void saveAccount()} />
        </MobileFormSection>
      </MobileSheet>

      <MobileConfirmSheet
        visible={Boolean(confirmAction)}
        title={confirmAction?.type === 'delete' ? 'Delete bank account?' : 'Set as primary account?'}
        description={
          confirmAction?.type === 'delete'
            ? `This will permanently delete ${confirmAction.account.accountName || 'this bank account'}. Primary accounts cannot be deleted.`
            : `${confirmAction?.account.accountName || 'This account'} will become the main account shown to members for payments.`
        }
        confirmLabel={confirmAction?.type === 'delete' ? 'Delete account' : 'Set primary'}
        destructive={confirmAction?.type === 'delete'}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void runConfirmAction()}
      />
    </MobileScreen>
  );
}

type BankAccountDetailSheetProps = {
  account: BankAccount | null;
  canManage: boolean;
  onClose: () => void;
  onEdit: (account: BankAccount) => void;
  onSetPrimary: (account: BankAccount) => void;
  onDelete: (account: BankAccount) => void;
};

function BankAccountDetailSheet({ account, canManage, onClose, onEdit, onSetPrimary, onDelete }: BankAccountDetailSheetProps) {
  return (
    <MobileSheet visible={Boolean(account)} title={account?.accountName || 'Bank account'} description={account?.bankName || 'Account details'} onClose={onClose}>
      {account ? (
        <View style={styles.sheetContent}>
          <MobileCard compact accent={isBankAccountPrimary(account) ? 'green' : 'slate'}>
            <View style={styles.detailHeader}>
              <View style={styles.flex}>
                <MobileText variant="section" weight="bold">
                  {account.accountName || 'Bank account'}
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  {account.bankName || 'Bank not set'}
                </MobileText>
              </View>
              <MobileStatusBadge status={isBankAccountPrimary(account) ? 'Primary' : 'Standard'} tone={isBankAccountPrimary(account) ? 'success' : 'neutral'} />
            </View>
          </MobileCard>

          <MobileInfoRow label="Account number" value={maskAccountNumber(account.accountNumber)} helper={account.accountNumber || 'Full number unavailable'} icon={WalletCards} status={isBankAccountPrimary(account) ? 'Primary' : undefined} />
          <MobileInfoRow label="Bank" value={account.bankName || 'Not set'} helper={account.bankBranch || 'Branch not set'} icon={Landmark} />
          <MobileInfoRow label="Branch" value={account.bankBranch || 'Not set'} icon={Building2} />

          {canManage ? (
            <View style={styles.sheetActions}>
              <MobileButton label="Edit" icon={Edit3} variant="secondary" onPress={() => onEdit(account)} />
              {!isBankAccountPrimary(account) ? <MobileButton label="Set primary" icon={Star} onPress={() => onSetPrimary(account)} /> : null}
              {!isBankAccountPrimary(account) ? <MobileButton label="Delete" icon={Trash2} variant="danger" onPress={() => onDelete(account)} /> : null}
            </View>
          ) : null}
          {isBankAccountPrimary(account) ? (
            <MobileText variant="small" tone="secondary">
              Primary accounts are protected from deletion. Set another account as primary before removing this one.
            </MobileText>
          ) : null}
        </View>
      ) : null}
    </MobileSheet>
  );
}

function emptyForm(): BankAccountFormState {
  return {
    accountName: '',
    accountNumber: '',
    bankName: '',
    bankBranch: '',
    isPrimary: false,
  };
}

function formFromAccount(account: BankAccount): BankAccountFormState {
  return {
    accountName: account.accountName || '',
    accountNumber: account.accountNumber || '',
    bankName: account.bankName || '',
    bankBranch: account.bankBranch || '',
    isPrimary: isBankAccountPrimary(account),
  };
}

function buildPayload(form: BankAccountFormState, forcePrimary = false): BankAccountPayload {
  return {
    accountName: form.accountName.trim(),
    accountNumber: form.accountNumber.trim(),
    bankName: form.bankName.trim(),
    bankBranch: form.bankBranch.trim(),
    isPrimary: forcePrimary || form.isPrimary,
  };
}

function validateForm(form: BankAccountFormState) {
  const errors: Record<string, string> = {};
  if (form.accountName.trim().length < 2) errors.accountName = 'Account name is required.';
  if (form.accountNumber.trim().length < 5) errors.accountNumber = 'Account number must have at least 5 digits.';
  if (form.bankName.trim().length < 2) errors.bankName = 'Bank name is required.';
  if (form.bankBranch.trim().length < 2) errors.bankBranch = 'Bank branch is required.';
  return errors;
}

function sortAccounts(a: BankAccount, b: BankAccount) {
  if (isBankAccountPrimary(a) && !isBankAccountPrimary(b)) return -1;
  if (!isBankAccountPrimary(a) && isBankAccountPrimary(b)) return 1;
  return String(a.bankName || '').localeCompare(String(b.bankName || '')) || String(a.accountName || '').localeCompare(String(b.accountName || ''));
}

function maskAccountNumber(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return 'No account number';
  if (raw.length <= 4) return raw;
  return `${raw.slice(0, 4)} ${'*'.repeat(Math.max(4, raw.length - 8))} ${raw.slice(-4)}`;
}

function hasSettingsUpdatePermission(user: { permissions?: string[]; roles?: string[]; associationRole?: string; systemRole?: string } | null) {
  const values = [...(user?.permissions || []), ...(user?.roles || []), user?.associationRole || '', user?.systemRole || ''].map((value) => value.toLowerCase());
  return values.some((value) => ['settings.update', 'config_write', 'platform_admin', 'association_admin', 'admin'].includes(value));
}

const styles = StyleSheet.create({
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  errorText: {
    color: '#B91C1C',
  },
  sheetContent: {
    gap: 12,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  sheetActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
