import { router, useLocalSearchParams } from 'expo-router';
import {
  Banknote,
  Building2,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  FileText,
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
  createAssociationExpense,
  createAssociationExpenseCategory,
  getAssociationExpense,
  getAssociationExpenseCategories,
  updateAssociationExpense,
  type Expense,
  type ExpenseCategory,
  type ExpensePayload,
} from '@/services/expense-service';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate } from '@/utils/format';

type ExpenseFormState = {
  expenseCategoryId: string;
  supplierName: string;
  transactionDate: string;
  amount: string;
  description: string;
  paymentMethod: string;
  supportingDocumentPath: string;
};

const paymentMethodOptions = [
  { value: '', label: 'Not specified' },
  { value: 'Bank Transfer/Deposit', label: 'Bank Transfer / Deposit' },
  { value: 'Cash', label: 'Cash' },
  { value: 'Cheque', label: 'Cheque' },
  { value: 'Mobile Money (e.g., M-Pesa, Airtel Money)', label: 'Mobile Money' },
  { value: 'Credit/Debit Card', label: 'Credit / Debit Card' },
  { value: 'Online Payment Gateway', label: 'Online Payment Gateway' },
];

const emptyForm = (): ExpenseFormState => ({
  expenseCategoryId: '',
  supplierName: '',
  transactionDate: todayIsoDate(),
  amount: '',
  description: '',
  paymentMethod: '',
  supportingDocumentPath: '',
});

type MobileExpenseFormScreenProps = {
  mode?: 'create' | 'edit';
  expenseId?: string;
};

export default function MobileExpenseFormScreen({ mode = 'create', expenseId: propExpenseId }: MobileExpenseFormScreenProps) {
  const params = useLocalSearchParams();
  const { activeView, associationId, user } = useAuth();
  const routeExpenseId = Array.isArray(params.expenseId) ? params.expenseId[0] : params.expenseId;
  const idParam = Array.isArray(params.id) ? params.id[0] : params.id;
  const expenseId = propExpenseId || routeExpenseId || idParam;
  const isEdit = mode === 'edit' || Boolean(expenseId);

  const [form, setForm] = useState<ExpenseFormState>(() => emptyForm());
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expense, setExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canManageExpenses = useMemo(() => hasExpenseManagePermission(user), [user]);
  const manageRoute = useMemo(() => getRouteByPath('/associations/expenses/manage'), []);

  const loadForm = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before opening the expense form.');
        return;
      }

      if (mode === 'initial') setLoading(true);
      setError(null);
      setNotice(null);

      try {
        const [categoryPage, loadedExpense] = await Promise.all([
          getAssociationExpenseCategories(associationId, { size: 250 }),
          expenseId ? getAssociationExpense(associationId, expenseId) : Promise.resolve(null),
        ]);
        const loadedCategories = categoryPage.categories;
        setCategories(loadedCategories);
        setExpense(loadedExpense);
        setForm(loadedExpense ? formFromExpense(loadedExpense) : emptyFormWithDefaultCategory(loadedCategories));
      } catch (loadError) {
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
      }
    },
    [associationId, expenseId],
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

  const updateField = <K extends keyof ExpenseFormState>(field: K, value: ExpenseFormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setValidationErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const goToManage = (savedExpense?: Expense) => {
    if (!manageRoute) {
      router.back();
      return;
    }
    router.replace({
      pathname: '/work/route-preview',
      params: {
        routeId: manageRoute.id,
        expenseId: savedExpense?.id,
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
      const category = await createAssociationExpenseCategory(associationId, {
        name: newCategoryName.trim(),
        description: 'Created from the mobile expense form.',
      });
      setCategories((current) => [...current, category].sort((a, b) => a.name.localeCompare(b.name)));
      updateField('expenseCategoryId', category.id);
      setNewCategoryName('');
      setNotice(`Category "${category.name}" created and selected.`);
    } catch (categoryError) {
      setError(getApiErrorMessage(categoryError));
    } finally {
      setCreatingCategory(false);
    }
  };

  const saveExpense = async () => {
    if (!associationId || !canManageExpenses) return;
    const nextErrors = validateForm(form);
    setValidationErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError('Please correct the highlighted fields before saving this expense.');
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = buildPayload(form, user?.userId);
      const saved = isEdit && expenseId
        ? await updateAssociationExpense(associationId, expenseId, payload)
        : await createAssociationExpense(associationId, payload);
      setExpense(saved);
      setForm(formFromExpense(saved));
      setNotice(isEdit ? 'Expense updated successfully.' : 'Expense recorded successfully.');
      goToManage(saved);
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Association admin only" description="Expense recording is available from the association admin workspace." />;
  }

  if (!canManageExpenses) {
    return <AccessDeniedScreen title="Permission required" description="You need finance management permission to record or edit expenses." />;
  }

  if (loading) {
    return <MobilePageLoadingState kind="form" message={isEdit ? 'Loading expense details' : 'Preparing expense form'} />;
  }

  const selectedCategory = categories.find((category) => category.id === form.expenseCategoryId);
  const amountValue = parseAmount(form.amount);

  return (
    <MobileScreen>
      <MobilePageHeader
        title={isEdit ? 'Edit Expense' : 'Record Expense'}
        eyebrow="Financials"
        subtitle={isEdit ? 'Update category, amount, date and supporting details.' : 'Capture group expenses quickly and accurately.'}
        onBack={() => goToManage(expense || undefined)}
      />

      {error ? <MobileErrorState title="Expense form issue" description={error} onRetry={() => setError(null)} retryLabel="Dismiss" /> : null}
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

      <MobileCard compact accent={form.expenseCategoryId ? 'red' : 'orange'}>
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

      <MobileFormSection title="Required Details" description="Category, date and amount are required by the finance ledger.">
        <MobileSelect
          label="Category *"
          value={form.expenseCategoryId}
          options={categories.map((category) => ({ value: category.id, label: category.name }))}
          onChange={(value) => updateField('expenseCategoryId', value)}
          placeholder={categories.length === 0 ? 'Create a category first' : 'Select expense category'}
        />
        {validationErrors.expenseCategoryId ? (
          <MobileText variant="small" style={styles.errorText}>
            {validationErrors.expenseCategoryId}
          </MobileText>
        ) : null}

        {categories.length === 0 ? (
          <MobileCard compact accent="orange" style={styles.inlineCard}>
            <MobileText variant="small" weight="bold">
              No expense categories yet
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Create one category here, then continue recording this expense.
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
              placeholder="Operations"
              error={validationErrors.newCategoryName}
              icon={ReceiptText}
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

        <MobileTextInput
          label="Transaction Date *"
          value={form.transactionDate}
          onChangeText={(value) => updateField('transactionDate', value)}
          placeholder="YYYY-MM-DD"
          helperText="Use the actual payment date. Future dates are not allowed."
          error={validationErrors.transactionDate}
          icon={CalendarDays}
        />

        <MobileAmountInput
          label="Amount *"
          value={form.amount}
          onChangeText={(value) => updateField('amount', value)}
          helperText="Enter the amount paid in TZS."
          error={validationErrors.amount}
        />
      </MobileFormSection>

      <MobileFormSection title="Payment Context" description="These details make expense reviews and reports easier to audit.">
        <MobileTextInput
          label="Supplier / Paid To"
          value={form.supplierName}
          onChangeText={(value) => updateField('supplierName', value)}
          placeholder="Office Stationery Ltd"
          icon={Building2}
        />
        <MobileSelect
          label="Payment Method"
          value={form.paymentMethod}
          options={paymentMethodOptions}
          onChange={(value) => updateField('paymentMethod', value)}
          placeholder="Select payment method"
        />
        <MobileTextInput
          label="Supporting Document Path"
          value={form.supportingDocumentPath}
          onChangeText={(value) => updateField('supportingDocumentPath', value)}
          placeholder="receipt-office.pdf"
          helperText="Native upload will be connected in the document upload pass; saved paths are preserved."
          icon={FileText}
        />
      </MobileFormSection>

      <MobileFormSection title="Notes" description="Optional narrative for invoices, receipts, or committee review.">
        <MobileTextInput
          label="Description / Notes"
          value={form.description}
          onChangeText={(value) => updateField('description', value)}
          placeholder="Invoice number, items purchased, approval reference..."
          multiline
          numberOfLines={4}
          icon={CreditCard}
        />
      </MobileFormSection>

      <View style={styles.actions}>
        <MobileButton label="Cancel" variant="secondary" onPress={() => goToManage(expense || undefined)} disabled={saving} />
        <MobileButton
          label={saving ? 'Saving...' : isEdit ? 'Update Expense' : 'Record Expense'}
          icon={isEdit ? Save : Banknote}
          onPress={saveExpense}
          loading={saving}
          disabled={saving}
        />
      </View>
    </MobileScreen>
  );
}

function emptyFormWithDefaultCategory(categories: ExpenseCategory[]) {
  const form = emptyForm();
  if (categories.length === 1) {
    form.expenseCategoryId = categories[0].id;
  }
  return form;
}

function formFromExpense(expense: Expense): ExpenseFormState {
  return {
    expenseCategoryId: expense.expenseCategory?.id || '',
    supplierName: expense.supplierName || '',
    transactionDate: expense.transactionDate || todayIsoDate(),
    amount: expense.amount ? String(expense.amount) : '',
    description: expense.description || '',
    paymentMethod: expense.paymentMethod || '',
    supportingDocumentPath: expense.supportingDocumentPath || expense.receiptPath || '',
  };
}

function validateForm(form: ExpenseFormState) {
  const errors: Record<string, string> = {};
  if (!form.expenseCategoryId) errors.expenseCategoryId = 'Select an expense category.';
  if (!isIsoDate(form.transactionDate)) {
    errors.transactionDate = 'Use a valid date in YYYY-MM-DD format.';
  } else if (form.transactionDate > todayIsoDate()) {
    errors.transactionDate = 'Transaction date cannot be in the future.';
  }
  if (parseAmount(form.amount) <= 0) errors.amount = 'Amount must be greater than zero.';
  return errors;
}

function buildPayload(form: ExpenseFormState, userId?: string): ExpensePayload {
  return {
    expenseCategoryId: form.expenseCategoryId,
    supplierName: textOrNull(form.supplierName),
    transactionDate: form.transactionDate,
    amount: parseAmount(form.amount),
    description: textOrNull(form.description),
    paymentMethod: textOrNull(form.paymentMethod),
    supportingDocumentPath: textOrNull(form.supportingDocumentPath),
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

function hasExpenseManagePermission(user: { permissions?: string[]; roles?: string[]; associationRole?: string } | null) {
  const values = [...(user?.permissions || []), ...(user?.roles || []), user?.associationRole || ''].map((value) => value.toLowerCase());
  return values.some((value) =>
    [
      'finance.transactions.create',
      'finance.transactions.update',
      'expenses_manage',
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
