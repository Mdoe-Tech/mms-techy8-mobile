import { router, useLocalSearchParams } from 'expo-router';
import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  Edit3,
  FileText,
  FolderOpen,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

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
  MobileSortSheet,
  MobileStatusBadge,
  MobileText,
  MobileTextInput,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  createAssociationRevenueCategory,
  deleteAssociationRevenueCategory,
  getAllAssociationGeneralRevenues,
  getAssociationRevenueCategories,
  updateAssociationRevenueCategory,
  type GeneralRevenue,
  type RevenueCategory,
} from '@/services/general-revenue-service';
import type { StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate, formatNumber } from '@/utils/format';

type CategoryFilter = 'all' | 'inUse' | 'unused';
type CategorySortOption = 'nameAsc' | 'nameDesc' | 'mostUsed' | 'unusedFirst' | 'newest';
type CategoryFormMode = 'create' | 'edit';
type CategoryUsage = {
  count: number;
  amount: number;
};

type CategoryFormState = {
  name: string;
  description: string;
};

type CategoryFormSheet = {
  mode: CategoryFormMode;
  category?: RevenueCategory;
} | null;

const PAGE_SIZE = 500;

const sortOptions = [
  { value: 'nameAsc', label: 'Name A-Z', description: 'Alphabetical category list.' },
  { value: 'nameDesc', label: 'Name Z-A', description: 'Reverse alphabetical category list.' },
  { value: 'mostUsed', label: 'Most Used', description: 'Categories with more loaded revenue records appear first.' },
  { value: 'unusedFirst', label: 'Unused First', description: 'Review categories that can usually be cleaned up.' },
  { value: 'newest', label: 'Newest First', description: 'Recently created categories appear first.' },
];

export default function MobileRevenueCategoriesScreen() {
  const params = useLocalSearchParams();
  const { activeView, associationId, user } = useAuth();
  const [categories, setCategories] = useState<RevenueCategory[]>([]);
  const [revenues, setRevenues] = useState<GeneralRevenue[]>([]);
  const [totalRevenues, setTotalRevenues] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [sortValue, setSortValue] = useState<CategorySortOption>('nameAsc');
  const [sortOpen, setSortOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<RevenueCategory | null>(null);
  const [formSheet, setFormSheet] = useState<CategoryFormSheet>(null);
  const [form, setForm] = useState<CategoryFormState>(() => emptyForm());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [confirmCategory, setConfirmCategory] = useState<RevenueCategory | null>(null);
  const [handledPreviewKey, setHandledPreviewKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const previewMode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const previewCategoryId = Array.isArray(params.categoryId) ? params.categoryId[0] : params.categoryId;
  const canManageCategories = useMemo(() => hasRevenueManagePermission(user), [user]);

  const loadCategories = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before loading revenue categories.');
        return;
      }

      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        const [categoryList, revenuePage] = await Promise.all([
          getAssociationRevenueCategories(associationId),
          getAllAssociationGeneralRevenues(associationId, { size: PAGE_SIZE, sort: 'transactionDate,desc' }, { maxPages: 20 }),
        ]);

        setCategories([...categoryList].sort((a, b) => a.name.localeCompare(b.name)));
        setRevenues(revenuePage.revenues);
        setTotalRevenues(revenuePage.totalElements || revenuePage.revenues.length);
      } catch (loadError) {
        setCategories([]);
        setRevenues([]);
        setTotalRevenues(0);
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
      if (active) void loadCategories();
    });
    return () => {
      active = false;
    };
  }, [loadCategories]);

  useEffect(() => {
    if (loading) return;
    const previewKey = `${previewMode || 'detail'}:${previewCategoryId || 'none'}`;
    if (handledPreviewKey === previewKey) return;

    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      if (previewMode === 'create') {
        setSelectedCategory(null);
        setFormSheet({ mode: 'create' });
        setForm(emptyForm());
        setFormErrors({});
        setHandledPreviewKey(previewKey);
        return;
      }

      if (previewCategoryId) {
        const category = categories.find((item) => item.id === previewCategoryId);
        if (!category) return;
        if (previewMode === 'edit') {
          setSelectedCategory(null);
          setFormSheet({ mode: 'edit', category });
          setForm({ name: category.name, description: category.description || '' });
          setFormErrors({});
        } else {
          setFormSheet(null);
          setSelectedCategory(category);
        }
        setHandledPreviewKey(previewKey);
      }
    });
    return () => {
      active = false;
    };
  }, [categories, handledPreviewKey, loading, previewCategoryId, previewMode]);

  const usageByCategory = useMemo(() => buildCategoryUsage(revenues), [revenues]);

  const metrics = useMemo(() => {
    const usedCategories = categories.filter((category) => usageFor(category.id, usageByCategory).count > 0);
    const mappedAmount = [...usageByCategory.values()].reduce((total, usage) => total + usage.amount, 0);
    const topCategory = [...categories]
      .map((category) => ({ category, usage: usageFor(category.id, usageByCategory) }))
      .sort((a, b) => b.usage.amount - a.usage.amount)[0];

    return {
      categoryCount: categories.length,
      usedCount: usedCategories.length,
      unusedCount: Math.max(categories.length - usedCategories.length, 0),
      mappedAmount,
      topCategory: topCategory && topCategory.usage.count > 0 ? topCategory : null,
    };
  }, [categories, usageByCategory]);

  const tabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: categories.length },
      { value: 'inUse', label: 'In Use', count: metrics.usedCount },
      { value: 'unused', label: 'Unused', count: metrics.unusedCount },
    ],
    [categories.length, metrics.unusedCount, metrics.usedCount],
  );

  const visibleCategories = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const filtered = categories.filter((category) => {
      const usage = usageFor(category.id, usageByCategory);
      if (filter === 'inUse' && usage.count === 0) return false;
      if (filter === 'unused' && usage.count > 0) return false;
      if (!query) return true;
      return [category.name, category.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });

    return [...filtered].sort((a, b) => sortCategories(a, b, sortValue, usageByCategory));
  }, [categories, filter, searchTerm, sortValue, usageByCategory]);

  const listItems = useMemo<MobileDataListItem[]>(
    () =>
      visibleCategories.map((category) => {
        const usage = usageFor(category.id, usageByCategory);
        return {
          id: category.id,
          title: category.name,
          subtitle: `${formatNumber(usage.count)} loaded ${plural(usage.count, 'revenue record')} · ${formatDate(category.createdAt)}`,
          meta: category.description || `Updated ${formatDate(category.updatedAt)}`,
          amount: usage.count > 0 ? formatCurrency(usage.amount) : undefined,
          status: usage.count > 0 ? 'In Use' : 'Unused',
          statusTone: usage.count > 0 ? 'success' : 'neutral',
          initials: categoryInitials(category.name),
          accent: toneForCategory(category, usage),
        };
      }),
    [usageByCategory, visibleCategories],
  );

  const categoryReportOptions = useMemo(
    () => ({
      title: 'Revenue Categories',
      associationName: user?.associationName || 'Association',
      purpose: 'A current-view report of revenue categories, loaded usage, mapped revenue, and audit dates.',
      rows: visibleCategories,
      fileName: 'nane-revenue-categories',
      metrics: [
        { label: 'Categories', value: formatNumber(metrics.categoryCount), helper: 'Configured revenue classes' },
        { label: 'In use', value: formatNumber(metrics.usedCount), helper: `${formatNumber(totalRevenues)} records in system` },
        { label: 'Unused', value: formatNumber(metrics.unusedCount), helper: 'Usually safe to review' },
        { label: 'Mapped revenue', value: formatCurrency(metrics.mappedAmount), helper: metrics.topCategory ? `Top: ${metrics.topCategory.category.name}` : 'No loaded revenue' },
      ],
      filters: [
        { label: 'Search', value: searchTerm || 'All' },
        { label: 'Status', value: tabs.find((tab) => tab.value === filter)?.label || filter },
        { label: 'Sort', value: sortOptions.find((option) => option.value === sortValue)?.label || sortValue },
      ],
      columns: [
        { key: 'number', label: '#', align: 'center' as const, width: '6%', value: (_row: RevenueCategory, index: number) => index + 1 },
        { key: 'name', label: 'Category', width: '22%', value: (row: RevenueCategory) => row.name || '-' },
        { key: 'description', label: 'Description', width: '28%', value: (row: RevenueCategory) => row.description || '-' },
        { key: 'records', label: 'Loaded Records', align: 'right' as const, width: '13%', value: (row: RevenueCategory) => formatNumber(usageFor(row.id, usageByCategory).count) },
        { key: 'amount', label: 'Mapped Revenue', align: 'right' as const, width: '15%', value: (row: RevenueCategory) => formatCurrency(usageFor(row.id, usageByCategory).amount) },
        { key: 'createdAt', label: 'Created', width: '11%', value: (row: RevenueCategory) => formatDate(row.createdAt) },
        { key: 'updatedAt', label: 'Updated', width: '11%', value: (row: RevenueCategory) => formatDate(row.updatedAt) },
      ],
    }),
    [filter, metrics, searchTerm, sortValue, tabs, totalRevenues, usageByCategory, user?.associationName, visibleCategories],
  );

  const openCreateForm = () => {
    setSelectedCategory(null);
    setFormSheet({ mode: 'create' });
    setForm(emptyForm());
    setFormErrors({});
    setNotice(null);
  };

  const openEditForm = (category: RevenueCategory) => {
    setSelectedCategory(null);
    setFormSheet({ mode: 'edit', category });
    setForm({ name: category.name, description: category.description || '' });
    setFormErrors({});
    setNotice(null);
  };

  const closeForm = () => {
    if (saving) return;
    setFormSheet(null);
    setForm(emptyForm());
    setFormErrors({});
  };

  const saveCategory = async () => {
    if (!associationId || !canManageCategories || !formSheet) return;
    const nextErrors = validateCategoryForm(form, categories, formSheet.category?.id);
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = {
        name: form.name.trim(),
        description: textOrNull(form.description),
      };
      const saved = formSheet.mode === 'edit' && formSheet.category
        ? await updateAssociationRevenueCategory(associationId, formSheet.category.id, payload)
        : await createAssociationRevenueCategory(associationId, payload);

      setNotice(formSheet.mode === 'edit' ? 'Revenue category updated successfully.' : 'Revenue category created successfully.');
      setSelectedCategory(saved);
      setFormSheet(null);
      setForm(emptyForm());
      await loadCategories('refresh');
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const requestDelete = (category: RevenueCategory) => {
    const usage = usageFor(category.id, usageByCategory);
    if (usage.count > 0) {
      setNotice('Move or edit the loaded revenue records using this category before deleting it.');
      return;
    }
    setConfirmCategory(category);
  };

  const deleteCategory = async () => {
    if (!associationId || !confirmCategory) return;
    setDeleting(true);
    setError(null);
    setNotice(null);
    try {
      await deleteAssociationRevenueCategory(associationId, confirmCategory.id);
      setNotice('Revenue category deleted successfully.');
      setSelectedCategory(null);
      setConfirmCategory(null);
      await loadCategories('refresh');
    } catch (deleteError) {
      setError(getApiErrorMessage(deleteError));
      setConfirmCategory(null);
    } finally {
      setDeleting(false);
    }
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Association admin only" description="Revenue categories are available from the association admin workspace." />;
  }

  if (!canManageCategories) {
    return <AccessDeniedScreen title="Permission required" description="You need finance management permission to manage revenue categories." />;
  }

  if (loading && categories.length === 0) {
    return <MobilePageLoadingState kind="list" message="Loading revenue categories" />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        title="Revenue Categories"
        eyebrow="Financials"
        subtitle="Organize general revenue before recording income."
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh" onPress={() => void loadCategories('refresh')} disabled={refreshing} />}
      />

      {error ? <MobileErrorState title="Revenue categories issue" description={error} onRetry={() => void loadCategories('refresh')} /> : null}
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
          <MobileKpiCard title="Categories" value={formatNumber(metrics.categoryCount)} description="Configured revenue classes" tone="blue" icon={FolderOpen} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="In Use" value={formatNumber(metrics.usedCount)} description={`${formatNumber(totalRevenues)} records in system`} tone="green" icon={ReceiptText} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Unused" value={formatNumber(metrics.unusedCount)} description="Usually safe to review" tone="orange" icon={FileText} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Mapped Revenue"
            value={formatCurrency(metrics.mappedAmount)}
            description={metrics.topCategory ? `Top: ${metrics.topCategory.category.name}` : 'No loaded revenue'}
            tone="green"
            icon={Banknote}
          />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileFilterControls
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search categories..."
        onFilterPress={() => setSortOpen(true)}
        filterLabel="Sort"
        tabs={tabs}
        value={filter}
        onChange={(value) => setFilter(value as CategoryFilter)}
        primaryAction={{ label: 'New Category', icon: Plus, onPress: openCreateForm }}
        actionSlot={<MobileReportExportButton fullWidth options={categoryReportOptions} onError={(exportError) => setError(getApiErrorMessage(exportError))} />}
      />

      {visibleCategories.length === 0 && !loading ? (
        <MobileEmptyState
          title="No revenue categories found"
          description={searchTerm || filter !== 'all' ? 'Adjust the search or status tab to find more categories.' : 'Create categories such as Donations, Event Income, Interest Income, or Membership Fees before recording revenue.'}
          actionLabel="New Category"
          onAction={openCreateForm}
        />
      ) : (
        <MobileDataList items={listItems} onPressItem={(item) => setSelectedCategory(categories.find((category) => category.id === item.id) || null)} />
      )}

      <MobileSheet
        visible={Boolean(selectedCategory)}
        title={selectedCategory?.name || 'Category details'}
        description={selectedCategory ? categorySheetDescription(selectedCategory, usageFor(selectedCategory.id, usageByCategory)) : undefined}
        onClose={() => setSelectedCategory(null)}
      >
        {selectedCategory ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>
            <View style={styles.badges}>
              <MobileStatusBadge
                status={usageFor(selectedCategory.id, usageByCategory).count > 0 ? 'In Use' : 'Unused'}
                tone={usageFor(selectedCategory.id, usageByCategory).count > 0 ? 'success' : 'neutral'}
              />
              <MobileStatusBadge status="Category" tone="primary" />
            </View>

            <View style={styles.detailActions}>
              <MobileButton label="Edit" icon={Edit3} variant="secondary" onPress={() => openEditForm(selectedCategory)} size="sm" />
              {usageFor(selectedCategory.id, usageByCategory).count > 0 ? (
                <MobileButton label="In Use" icon={Trash2} variant="secondary" disabled size="sm" />
              ) : (
                <MobileButton label="Delete" icon={Trash2} variant="danger" onPress={() => requestDelete(selectedCategory)} loading={deleting} size="sm" />
              )}
            </View>

            {usageFor(selectedCategory.id, usageByCategory).count > 0 ? (
              <MobileCard compact accent="orange">
                <MobileText variant="small" weight="bold">
                  Delete is blocked while revenue records use this category.
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  Move or edit those revenue records first. The backend will also prevent deletion if older records still reference it.
                </MobileText>
              </MobileCard>
            ) : null}

            <MobileCard compact>
              <MobileInfoRow label="Name" value={selectedCategory.name} icon={FolderOpen} status="Revenue" />
              <MobileInfoRow label="Loaded Records" value={formatNumber(usageFor(selectedCategory.id, usageByCategory).count)} icon={ReceiptText} />
              <MobileInfoRow label="Loaded Amount" value={formatCurrency(usageFor(selectedCategory.id, usageByCategory).amount)} icon={Banknote} />
              <MobileInfoRow label="Created" value={formatDate(selectedCategory.createdAt)} icon={CalendarDays} />
              <MobileInfoRow label="Updated" value={formatDate(selectedCategory.updatedAt)} />
              <MobileInfoRow label="Version" value={String(selectedCategory.version ?? 0)} />
            </MobileCard>

            <MobileCard compact>
              <MobileText variant="small" tone="secondary" weight="bold">
                Description
              </MobileText>
              <MobileText variant="body">
                {selectedCategory.description || 'No description recorded for this category.'}
              </MobileText>
            </MobileCard>
          </ScrollView>
        ) : null}
      </MobileSheet>

      <MobileSheet
        visible={Boolean(formSheet)}
        title={formSheet?.mode === 'edit' ? 'Edit Category' : 'New Category'}
        description={formSheet?.mode === 'edit' ? 'Update the category name and audit description.' : 'Create a reusable revenue classification.'}
        onClose={closeForm}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>
          <MobileFormSection title="Category Details" description="Use clear names that finance users can recognize later.">
            <MobileTextInput
              label="Category Name *"
              value={form.name}
              onChangeText={(value) => updateFormField('name', value, setForm, setFormErrors)}
              placeholder="Donations"
              helperText="Maximum 100 characters."
              error={formErrors.name}
              icon={FolderOpen}
            />
            <MobileTextInput
              label="Description"
              value={form.description}
              onChangeText={(value) => updateFormField('description', value, setForm, setFormErrors)}
              placeholder="Grants, donations and other external income."
              error={formErrors.description}
              icon={FileText}
              multiline
              numberOfLines={4}
            />
          </MobileFormSection>
          <View style={styles.formActions}>
            <MobileButton label="Cancel" variant="secondary" onPress={closeForm} disabled={saving} />
            <MobileButton
              label={saving ? 'Saving...' : formSheet?.mode === 'edit' ? 'Update Category' : 'Create Category'}
              icon={formSheet?.mode === 'edit' ? Save : Plus}
              onPress={saveCategory}
              loading={saving}
              disabled={saving}
            />
          </View>
        </ScrollView>
      </MobileSheet>

      <MobileSortSheet
        visible={sortOpen}
        value={sortValue}
        options={sortOptions}
        onChange={(value) => setSortValue(value as CategorySortOption)}
        onClose={() => setSortOpen(false)}
      />

      <MobileConfirmSheet
        visible={Boolean(confirmCategory)}
        title="Delete revenue category"
        description={confirmCategory ? `Delete ${confirmCategory.name}? This cannot be undone. Categories already used by revenue records cannot be deleted.` : ''}
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        destructive
        onCancel={() => setConfirmCategory(null)}
        onConfirm={deleteCategory}
      />
    </MobileScreen>
  );
}

function emptyForm(): CategoryFormState {
  return {
    name: '',
    description: '',
  };
}

function updateFormField(
  field: keyof CategoryFormState,
  value: string,
  setForm: React.Dispatch<React.SetStateAction<CategoryFormState>>,
  setFormErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>,
) {
  setForm((current) => ({ ...current, [field]: value }));
  setFormErrors((current) => {
    if (!current[field]) return current;
    const next = { ...current };
    delete next[field];
    return next;
  });
}

function validateCategoryForm(
  form: CategoryFormState,
  categories: RevenueCategory[],
  currentCategoryId?: string,
) {
  const errors: Record<string, string> = {};
  const name = form.name.trim();
  if (!name) errors.name = 'Category name is required.';
  if (name.length > 100) errors.name = 'Category name must be 100 characters or fewer.';
  const duplicate = categories.some(
    (category) => category.id !== currentCategoryId && category.name.trim().toLowerCase() === name.toLowerCase(),
  );
  if (duplicate) errors.name = 'A category with this name already exists.';
  return errors;
}

function buildCategoryUsage(revenues: GeneralRevenue[]) {
  const usage = new Map<string, CategoryUsage>();
  revenues.forEach((revenue) => {
    const categoryId = revenue.revenueCategory?.id;
    if (!categoryId) return;
    const current = usage.get(categoryId) || { count: 0, amount: 0 };
    current.count += 1;
    current.amount += Number(revenue.amount || 0);
    usage.set(categoryId, current);
  });
  return usage;
}

function usageFor(categoryId: string, usageByCategory: Map<string, CategoryUsage>): CategoryUsage {
  return usageByCategory.get(categoryId) || { count: 0, amount: 0 };
}

function sortCategories(
  a: RevenueCategory,
  b: RevenueCategory,
  sortValue: CategorySortOption,
  usageByCategory: Map<string, CategoryUsage>,
) {
  if (sortValue === 'nameDesc') return b.name.localeCompare(a.name);
  if (sortValue === 'mostUsed') return usageFor(b.id, usageByCategory).count - usageFor(a.id, usageByCategory).count || a.name.localeCompare(b.name);
  if (sortValue === 'unusedFirst') return usageFor(a.id, usageByCategory).count - usageFor(b.id, usageByCategory).count || a.name.localeCompare(b.name);
  if (sortValue === 'newest') return dateValue(b.createdAt) - dateValue(a.createdAt);
  return a.name.localeCompare(b.name);
}

function toneForCategory(category: RevenueCategory, usage: CategoryUsage): StatusTone {
  if (usage.count > 0 && usage.amount >= 1_000_000) return 'paid';
  if (usage.count > 0 && usage.amount >= 250_000) return 'success';
  if (usage.count > 0) return 'primary';
  if (category.description) return 'info';
  return 'neutral';
}

function categoryInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function categorySheetDescription(category: RevenueCategory, usage: CategoryUsage) {
  if (usage.count === 0) return 'Unused category';
  return `${formatNumber(usage.count)} loaded ${plural(usage.count, 'revenue record')} · ${formatCurrency(usage.amount)}`;
}

function plural(count: number, singular: string) {
  return count === 1 ? singular : `${singular}s`;
}

function textOrNull(value?: string | null) {
  const trimmed = String(value || '').trim();
  return trimmed ? trimmed : null;
}

function dateValue(value?: string | null) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function hasRevenueManagePermission(user: { permissions?: string[]; roles?: string[]; associationRole?: string } | null) {
  const values = [...(user?.permissions || []), ...(user?.roles || []), user?.associationRole || ''].map((value) => value.toLowerCase());
  return values.some((value) =>
    [
      'finance.transactions.create',
      'finance.transactions.update',
      'finance.transactions.delete',
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
  sheetScroll: {
    gap: 12,
    paddingBottom: 10,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  formActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
