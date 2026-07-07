import { router, useLocalSearchParams } from 'expo-router';
import {
  Banknote,
  Building2,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  FileText,
  Hash,
  Plus,
  ReceiptText,
  Save,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileAmountInput,
  MobileButton,
  MobileCard,
  MobileErrorState,
  MobileFormSection,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileSelect,
  MobileStatusBadge,
  MobileText,
  MobileTextInput,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  createAssociationGeneralRevenue,
  createAssociationRevenueCategory,
  getAssociationGeneralRevenue,
  getAssociationRevenueCategories,
  updateAssociationGeneralRevenue,
  type GeneralRevenue,
  type GeneralRevenuePayload,
  type RevenueCategory,
} from '@/services/general-revenue-service';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate } from '@/utils/format';

type RevenueFormState = {
  revenueCategoryId: string;
  sourceName: string;
  transactionDate: string;
  amount: string;
  description: string;
  paymentMethod: string;
  referenceNumber: string;
  notes: string;
};

type MobileRevenueFormScreenProps = {
  mode?: 'create' | 'edit';
  revenueId?: string;
};

const paymentMethodOptions = [
  { value: '', label: 'Select payment method' },
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'CHECK', label: 'Cheque' },
  { value: 'OTHER', label: 'Other' },
];

const emptyForm = (): RevenueFormState => ({
  revenueCategoryId: '',
  sourceName: '',
  transactionDate: todayIsoDate(),
  amount: '',
  description: '',
  paymentMethod: '',
  referenceNumber: '',
  notes: '',
});

export default function MobileRevenueFormScreen({ mode = 'create', revenueId: propRevenueId }: MobileRevenueFormScreenProps) {
  const params = useLocalSearchParams();
  const { activeView, associationId, user } = useAuth();
  const routeRevenueId = Array.isArray(params.revenueId) ? params.revenueId[0] : params.revenueId;
  const idParam = Array.isArray(params.id) ? params.id[0] : params.id;
  const revenueId = propRevenueId || routeRevenueId || idParam;
  const isEdit = mode === 'edit' || Boolean(revenueId);

  const [form, setForm] = useState<RevenueFormState>(() => emptyForm());
  const [categories, setCategories] = useState<RevenueCategory[]>([]);
  const [revenue, setRevenue] = useState<GeneralRevenue | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canManageRevenue = useMemo(() => hasRevenueManagePermission(user), [user]);
  const manageRoute = useMemo(() => getRouteByPath('/associations/revenue/manage'), []);

  const loadForm = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before opening the revenue form.');
        return;
      }

      if (mode === 'initial') setLoading(true);
      setError(null);
      setNotice(null);

      try {
        const [categoryList, loadedRevenue] = await Promise.all([
          getAssociationRevenueCategories(associationId),
          revenueId ? getAssociationGeneralRevenue(associationId, revenueId) : Promise.resolve(null),
        ]);
        const sortedCategories = [...categoryList].sort((a, b) => a.name.localeCompare(b.name));
        setCategories(sortedCategories);
        setRevenue(loadedRevenue);
        setForm(loadedRevenue ? formFromRevenue(loadedRevenue) : emptyFormWithDefaultCategory(sortedCategories));
      } catch (loadError) {
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
      }
    },
    [associationId, revenueId],
  );

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadForm();
    });
    return () => {
      active = false;
    };
  }, [loadForm]);

  const updateField = <K extends keyof RevenueFormState>(field: K, value: RevenueFormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setValidationErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const goToManage = (savedRevenue?: GeneralRevenue) => {
    if (!manageRoute) {
      router.back();
      return;
    }
    router.replace({
      pathname: '/work/route-preview',
      params: {
        routeId: manageRoute.id,
        revenueId: savedRevenue?.id,
        id: savedRevenue?.id,
      },
    } as never);
  };

  const createQuickCategory = async () => {
    if (!associationId || !newCategoryName.trim()) {
      setValidationErrors((current) => ({ ...current, newCategoryName: 'Category name is required.' }));
      return;
    }

    setCreatingCategory(true);
    setError(null);
    setNotice(null);
    try {
      const category = await createAssociationRevenueCategory(associationId, {
        name: newCategoryName.trim(),
        description: 'Created from the mobile revenue form.',
      });
      setCategories((current) => [...current, category].sort((a, b) => a.name.localeCompare(b.name)));
      updateField('revenueCategoryId', category.id);
      setNewCategoryName('');
      setNotice(`Category "${category.name}" created and selected.`);
    } catch (categoryError) {
      setError(getApiErrorMessage(categoryError));
    } finally {
      setCreatingCategory(false);
    }
  };

  const saveRevenue = async () => {
    if (!associationId || !canManageRevenue) return;
    const nextErrors = validateForm(form);
    setValidationErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError('Please correct the highlighted fields before saving this revenue record.');
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = buildPayload(form, user?.userId);
      const saved = isEdit && revenueId
        ? await updateAssociationGeneralRevenue(associationId, revenueId, payload)
        : await createAssociationGeneralRevenue(associationId, payload);
      setRevenue(saved);
      setForm(formFromRevenue(saved));
      setNotice(isEdit ? 'Revenue updated successfully.' : 'Revenue created successfully.');
      goToManage(saved);
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Association admin only" description="Revenue recording is available from the association admin workspace." />;
  }

  if (!canManageRevenue) {
    return <AccessDeniedScreen title="Permission required" description="You need finance management permission to create or edit revenue records." />;
  }

  if (loading) {
    return <MobilePageLoadingState kind="form" message={isEdit ? 'Loading revenue details' : 'Preparing revenue form'} />;
  }

  const selectedCategory = categories.find((category) => category.id === form.revenueCategoryId);
  const amountValue = parseAmount(form.amount);

  return (
    <MobileScreen>
      <MobilePageHeader
        title={isEdit ? 'Edit Revenue' : 'New Revenue'}
        eyebrow="Financials"
        subtitle={isEdit ? 'Update amount, category, source and payment details.' : 'Record general income with clear audit details.'}
        onBack={() => goToManage(revenue || undefined)}
      />

      {error ? <MobileErrorState title="Revenue form issue" description={error} onRetry={() => setError(null)} retryLabel="Dismiss" /> : null}
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

      <MobileCard compact accent={form.revenueCategoryId ? 'green' : 'orange'}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCopy}>
            <MobileText variant="section" weight="bold">
              {amountValue > 0 ? formatCurrency(amountValue) : 'TZS 0'}
            </MobileText>
            <MobileText variant="small" tone="secondary">
              {[selectedCategory?.name || 'No category selected', formatDate(form.transactionDate)].join(' · ')}
            </MobileText>
          </View>
          <MobileStatusBadge status={isEdit ? 'Editing' : 'New'} tone={isEdit ? 'review' : 'primary'} />
        </View>
      </MobileCard>

      <MobileFormSection title="Required Details" description="Amount, date, description, category and payment method are required.">
        <MobileAmountInput
          label="Amount *"
          value={form.amount}
          onChangeText={(value) => updateField('amount', value)}
          helperText="Enter the amount received in TZS."
          error={validationErrors.amount}
        />

        <MobileTextInput
          label="Transaction Date *"
          value={form.transactionDate}
          onChangeText={(value) => updateField('transactionDate', value)}
          placeholder="YYYY-MM-DD"
          helperText="Use the actual date the revenue was received."
          error={validationErrors.transactionDate}
          icon={CalendarDays}
        />

        <MobileTextInput
          label="Description *"
          value={form.description}
          onChangeText={(value) => updateField('description', value)}
          placeholder="Annual grant, hall rental, registration income..."
          multiline
          numberOfLines={3}
          error={validationErrors.description}
          icon={ReceiptText}
        />

        <MobileSelect
          label="Category *"
          value={form.revenueCategoryId}
          options={categories.map((category) => ({ value: category.id, label: category.name }))}
          onChange={(value) => updateField('revenueCategoryId', value)}
          placeholder={categories.length === 0 ? 'Create a category first' : 'Select revenue category'}
        />
        {validationErrors.revenueCategoryId ? (
          <MobileText variant="small" style={styles.errorText}>
            {validationErrors.revenueCategoryId}
          </MobileText>
        ) : null}

        {categories.length === 0 ? (
          <MobileCard compact accent="orange" style={styles.inlineCard}>
            <MobileText variant="small" weight="bold">
              No revenue categories yet
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Create one category here, then continue recording this revenue.
            </MobileText>
            <MobileTextInput
              label="New Category Name"
              value={newCategoryName}
              onChangeText={(value) => {
                setNewCategoryName(value);
                setValidationErrors((current) => {
                  if (!current.newCategoryName) return current;
                  const next = { ...current };
                  delete next.newCategoryName;
                  return next;
                });
              }}
              placeholder="Donations"
              error={validationErrors.newCategoryName}
              icon={FileText}
            />
            <MobileButton
              label={creatingCategory ? 'Creating...' : 'Create Category'}
              icon={Plus}
              onPress={createQuickCategory}
              loading={creatingCategory}
              disabled={creatingCategory}
              size="sm"
            />
          </MobileCard>
        ) : null}

        <MobileSelect
          label="Payment Method *"
          value={form.paymentMethod}
          options={paymentMethodOptions}
          onChange={(value) => updateField('paymentMethod', value)}
          placeholder="Select payment method"
        />
        {validationErrors.paymentMethod ? (
          <MobileText variant="small" style={styles.errorText}>
            {validationErrors.paymentMethod}
          </MobileText>
        ) : null}
      </MobileFormSection>

      <MobileFormSection title="Source And Reference" description="Optional context helps users audit the revenue later.">
        <MobileTextInput
          label="Source"
          value={form.sourceName}
          onChangeText={(value) => updateField('sourceName', value)}
          placeholder="Amani Foundation"
          icon={Building2}
        />
        <MobileTextInput
          label="Reference Number"
          value={form.referenceNumber}
          onChangeText={(value) => updateField('referenceNumber', value)}
          placeholder="DON-2026-001"
          icon={Hash}
        />
        <MobileTextInput
          label="Notes"
          value={form.notes}
          onChangeText={(value) => updateField('notes', value)}
          placeholder="Receipt note, bank narration, committee approval..."
          multiline
          numberOfLines={3}
          icon={CreditCard}
        />
      </MobileFormSection>

      <View style={styles.actions}>
        <MobileButton label="Cancel" variant="secondary" onPress={() => goToManage(revenue || undefined)} disabled={saving} />
        <MobileButton
          label={saving ? 'Saving...' : isEdit ? 'Update Revenue' : 'Create Revenue'}
          icon={isEdit ? Save : Banknote}
          onPress={saveRevenue}
          loading={saving}
          disabled={saving}
        />
      </View>
    </MobileScreen>
  );
}

function emptyFormWithDefaultCategory(categories: RevenueCategory[]) {
  const form = emptyForm();
  if (categories.length === 1) {
    form.revenueCategoryId = categories[0].id;
  }
  return form;
}

function formFromRevenue(revenue: GeneralRevenue): RevenueFormState {
  return {
    revenueCategoryId: revenue.revenueCategory?.id || '',
    sourceName: revenue.sourceName || '',
    transactionDate: revenue.transactionDate || todayIsoDate(),
    amount: revenue.amount ? String(revenue.amount) : '',
    description: revenue.description || '',
    paymentMethod: revenue.paymentMethod || '',
    referenceNumber: revenue.referenceNumber || '',
    notes: revenue.notes || '',
  };
}

function validateForm(form: RevenueFormState) {
  const errors: Record<string, string> = {};
  if (parseAmount(form.amount) <= 0) errors.amount = 'Amount must be greater than zero.';
  if (!isIsoDate(form.transactionDate)) errors.transactionDate = 'Use a valid date in YYYY-MM-DD format.';
  if (!form.description.trim()) errors.description = 'Description is required.';
  if (!form.revenueCategoryId) errors.revenueCategoryId = 'Select a revenue category.';
  if (!form.paymentMethod) errors.paymentMethod = 'Select a payment method.';
  return errors;
}

function buildPayload(form: RevenueFormState, userId?: string): GeneralRevenuePayload {
  return {
    revenueCategoryId: form.revenueCategoryId,
    sourceName: textOrNull(form.sourceName),
    transactionDate: form.transactionDate,
    amount: parseAmount(form.amount),
    description: textOrNull(form.description),
    notes: textOrNull(form.notes),
    paymentMethod: textOrNull(form.paymentMethod),
    referenceNumber: textOrNull(form.referenceNumber),
    recordedById: userId || null,
  };
}

function parseAmount(value: string) {
  const cleaned = String(value || '').replace(/[^\d.]/g, '');
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : 0;
}

function todayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
}

function textOrNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function hasRevenueManagePermission(user: { permissions?: string[]; roles?: string[]; associationRole?: string } | null) {
  const values = [...(user?.permissions || []), ...(user?.roles || []), user?.associationRole || ''].map((value) => value.toLowerCase());
  return values.some((value) =>
    [
      'finance.transactions.create',
      'finance.transactions.update',
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  inlineCard: {
    gap: 10,
  },
  errorText: {
    color: '#B91C1C',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 12,
  },
});
