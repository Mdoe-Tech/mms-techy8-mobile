import { router, useLocalSearchParams } from 'expo-router';
import { Clock3, Edit3, FileText, FolderOpen, Plus, RefreshCw, Save, Search, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
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
  MobileSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
  MobileTextInput,
  MobileToast,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  createGovernanceDocumentCategory,
  deleteGovernanceDocumentCategory,
  getGovernanceDocumentCategories,
  updateGovernanceDocumentCategory,
  type GovernanceDocumentCategory,
} from '@/services/governance-service';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber } from '@/utils/format';

type CategoryFilter = 'all' | 'described' | 'missing-description';
type FormSheet = { mode: 'create' } | { mode: 'edit'; item: GovernanceDocumentCategory } | null;

export default function MobileDocumentCategoriesScreen() {
  const params = useLocalSearchParams();
  const { activeView, associationId, user } = useAuth();
  const [categories, setCategories] = useState<GovernanceDocumentCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<GovernanceDocumentCategory | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<GovernanceDocumentCategory | null>(null);
  const [formSheet, setFormSheet] = useState<FormSheet>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [formErrors, setFormErrors] = useState<{ name?: string; description?: string }>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [handledPreviewKey, setHandledPreviewKey] = useState<string | null>(null);

  const previewMode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const previewId = Array.isArray(params.categoryId) ? params.categoryId[0] : params.categoryId;
  const canManage = useMemo(() => hasDocumentCategoryManagePermission(user), [user]);

  const loadCategories = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before loading document categories.');
        return;
      }

      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        const rows = await getGovernanceDocumentCategories(associationId);
        setCategories([...rows].sort(sortCategories));
      } catch (loadError) {
        setCategories([]);
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId],
  );

  const openCreateForm = useCallback(() => {
    if (!canManage) {
      setError('Your role cannot update document categories.');
      return;
    }
    setNotice(null);
    setError(null);
    setSelectedCategory(null);
    setName('');
    setDescription('');
    setFormErrors({});
    setFormSheet({ mode: 'create' });
  }, [canManage]);

  const openEditForm = useCallback(
    (item: GovernanceDocumentCategory) => {
      if (!canManage) {
        setError('Your role cannot update document categories.');
        return;
      }
      setNotice(null);
      setError(null);
      setSelectedCategory(null);
      setName(item.name || '');
      setDescription(item.description || '');
      setFormErrors({});
      setFormSheet({ mode: 'edit', item });
    },
    [canManage],
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
    const previewKey = `${previewMode || 'detail'}:${previewId || 'none'}`;
    if (handledPreviewKey === previewKey) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      if (previewMode === 'create') {
        openCreateForm();
        setHandledPreviewKey(previewKey);
        return;
      }
      if (!previewId) return;
      const item = categories.find((candidate) => candidate.id === previewId || candidate.name === previewId);
      if (!item) return;
      if (previewMode === 'edit') openEditForm(item);
      else setSelectedCategory(item);
      setHandledPreviewKey(previewKey);
    });
    return () => {
      active = false;
    };
  }, [categories, handledPreviewKey, loading, openCreateForm, openEditForm, previewId, previewMode]);

  const metrics = useMemo(() => {
    const described = categories.filter((category) => Boolean(category.description?.trim())).length;
    const latest = [...categories]
      .filter((category) => category.createdAt)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
    return {
      total: categories.length,
      described,
      missingDescription: categories.length - described,
      latestLabel: latest?.createdAt ? formatDate(latest.createdAt) : 'Not tracked',
    };
  }, [categories]);

  const filteredCategories = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return categories.filter((category) => {
      const hasDescription = Boolean(category.description?.trim());
      if (filter === 'described' && !hasDescription) return false;
      if (filter === 'missing-description' && hasDescription) return false;
      if (!query) return true;
      return [category.name, category.description || ''].some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [categories, filter, searchTerm]);

  const tabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: metrics.total },
      { value: 'described', label: 'Described', count: metrics.described },
      { value: 'missing-description', label: 'No desc.', count: metrics.missingDescription },
    ],
    [metrics.described, metrics.missingDescription, metrics.total],
  );

  const listItems = useMemo<MobileDataListItem[]>(
    () =>
      filteredCategories.map((category) => {
        const hasDescription = Boolean(category.description?.trim());
        return {
          id: category.id,
          title: category.name || 'Document category',
          subtitle: hasDescription ? category.description || '' : 'No description provided',
          meta: category.updatedAt ? `Updated ${formatDate(category.updatedAt)}` : category.createdAt ? `Created ${formatDate(category.createdAt)}` : 'Governance document category',
          status: hasDescription ? 'Ready' : 'Needs description',
          statusTone: hasDescription ? 'success' : 'warning',
          accent: hasDescription ? 'primary' : 'warning',
          initials: category.name?.slice(0, 2).toUpperCase() || 'DC',
        };
      }),
    [filteredCategories],
  );

  const closeForm = () => {
    setFormSheet(null);
    setName('');
    setDescription('');
    setFormErrors({});
  };

  const saveCategory = async () => {
    if (!associationId) return;
    if (!canManage) {
      setError('Your role cannot update document categories.');
      return;
    }

    const nextErrors: typeof formErrors = {};
    const cleanName = name.trim();
    const cleanDescription = description.trim();
    if (!cleanName) nextErrors.name = 'Category name is required.';
    if (cleanName.length > 100) nextErrors.name = 'Category name must be at most 100 characters.';
    if (cleanDescription.length > 1000) nextErrors.description = 'Description must be at most 1000 characters.';
    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = { name: cleanName, description: cleanDescription };
      if (formSheet?.mode === 'edit') {
        await updateGovernanceDocumentCategory(associationId, formSheet.item.id, payload);
        setNotice('Document category updated.');
      } else {
        await createGovernanceDocumentCategory(associationId, payload);
        setNotice('Document category added.');
      }
      closeForm();
      await loadCategories('refresh');
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async () => {
    if (!associationId || !categoryToDelete) return;
    if (!canManage) {
      setError('Your role cannot update document categories.');
      setCategoryToDelete(null);
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await deleteGovernanceDocumentCategory(associationId, categoryToDelete.id);
      setSelectedCategory(null);
      setCategoryToDelete(null);
      setNotice('Document category deleted.');
      await loadCategories('refresh');
    } catch (deleteError) {
      setError(getApiErrorMessage(deleteError));
    } finally {
      setSaving(false);
    }
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Document categories" description="Document category settings are available from association admin workspaces only." />;
  }

  if (loading) {
    return <MobilePageLoadingState kind="list" message="Loading document categories" />;
  }

  if (error && categories.length === 0 && !notice) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Settings"
          title="Document categories"
          subtitle="Governance document library"
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry" variant="secondary" disabled={refreshing} onPress={() => void loadCategories('refresh')} />}
        />
        <MobileErrorState title="Document categories could not load" description={error} retryLabel="Retry" onRetry={() => void loadCategories('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Settings"
        title="Document categories"
        subtitle="Manage upload categories for governance documents."
        onBack={() => router.back()}
        rightAction={canManage ? <MobileIconButton icon={Plus} label="Add category" variant="primary" onPress={openCreateForm} /> : undefined}
      />

      {error ? <MobileStatusBadge status="Failed" label={error} tone="danger" /> : null}
      {notice ? <MobileToast title="Document categories" description={notice} tone="success" /> : null}
      {!canManage ? <MobileStatusBadge status="Read only" label="Your role can review document categories but cannot change them." tone="info" /> : null}

      <MobileCard compact accent={metrics.missingDescription > 0 ? 'orange' : 'blue'}>
        <View style={styles.heroRow}>
          <View style={[styles.heroIcon, { backgroundColor: metrics.missingDescription > 0 ? '#C2410C' : '#2563EB' }]}>
            <FolderOpen color="#FFFFFF" size={22} strokeWidth={2.5} />
          </View>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold">
              {formatNumber(metrics.total)} document categories
            </MobileText>
            <MobileText variant="small" tone="secondary">
              {metrics.missingDescription > 0
                ? `${formatNumber(metrics.missingDescription)} categories need clearer descriptions.`
                : 'Upload categories are documented for governance users.'}
            </MobileText>
          </View>
          <MobileStatusBadge status={metrics.missingDescription > 0 ? 'Review' : 'Ready'} tone={metrics.missingDescription > 0 ? 'warning' : 'primary'} />
        </View>
      </MobileCard>

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Total" value={formatNumber(metrics.total)} description="Categories" icon={FolderOpen} tone="blue" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Described" value={formatNumber(metrics.described)} description="With context" icon={FileText} tone="green" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Needs copy" value={formatNumber(metrics.missingDescription)} description="Missing descriptions" icon={Search} tone={metrics.missingDescription > 0 ? 'orange' : 'slate'} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Latest" value={metrics.latestLabel} description="Newest category" icon={Clock3} tone="purple" />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileSearchToolbar value={searchTerm} onChange={setSearchTerm} placeholder="Search category name or description..." />
      <MobileStatusTabs tabs={tabs} value={filter} onChange={(value) => setFilter(value as CategoryFilter)} />

      {listItems.length > 0 ? (
        <MobileDataList
          items={listItems}
          onPressItem={(item) => {
            const category = filteredCategories.find((candidate) => candidate.id === item.id);
            if (category) setSelectedCategory(category);
          }}
        />
      ) : (
        <MobileEmptyState
          title={categories.length ? 'No categories match this view' : 'No document categories configured'}
          description={categories.length ? 'Clear search or filter choices to see more categories.' : 'Add categories such as Policies, Minutes, or Financial Reports for governance uploads.'}
          actionLabel={canManage ? 'Add category' : undefined}
          onAction={canManage ? openCreateForm : undefined}
        />
      )}

      <CategoryDetailSheet
        category={selectedCategory}
        canManage={canManage}
        onClose={() => setSelectedCategory(null)}
        onEdit={openEditForm}
        onDelete={(category) => setCategoryToDelete(category)}
      />

      <MobileSheet
        visible={Boolean(formSheet)}
        title={formSheet?.mode === 'edit' ? 'Edit document category' : 'Add document category'}
        description={formSheet?.mode === 'edit' ? 'Update the category label and helper description.' : 'Create an upload category for governance documents.'}
        onClose={closeForm}
      >
        <MobileFormSection title="Category details" description="Use a short label and a clear description so admins choose the right upload category.">
          <MobileTextInput
            label="Category name *"
            value={name}
            onChangeText={(value) => {
              setName(value);
              if (formErrors.name) setFormErrors((current) => ({ ...current, name: undefined }));
            }}
            placeholder="Meeting Minutes"
            error={formErrors.name}
            icon={FolderOpen}
            disabled={saving}
          />
          <MobileTextInput
            label="Description"
            value={description}
            onChangeText={(value) => {
              setDescription(value);
              if (formErrors.description) setFormErrors((current) => ({ ...current, description: undefined }));
            }}
            placeholder="Board, AGM, and committee meeting records."
            helperText={`${formatNumber(description.trim().length)}/1000 characters`}
            error={formErrors.description}
            icon={FileText}
            disabled={saving}
            multiline
            numberOfLines={3}
          />
          <MobileButton
            label={formSheet?.mode === 'edit' ? 'Save changes' : 'Add category'}
            icon={Save}
            loading={saving}
            disabled={saving || !canManage || !name.trim()}
            fullWidth
            onPress={() => void saveCategory()}
          />
        </MobileFormSection>
      </MobileSheet>

      <MobileConfirmSheet
        visible={Boolean(categoryToDelete)}
        title="Delete document category?"
        description={`This will remove ${categoryToDelete?.name || 'this category'} from future upload selections. Existing documents may still show the old category name.`}
        confirmLabel="Delete"
        destructive
        onCancel={() => setCategoryToDelete(null)}
        onConfirm={() => void deleteCategory()}
      />
    </MobileScreen>
  );
}

type DetailProps = {
  category: GovernanceDocumentCategory | null;
  canManage: boolean;
  onClose: () => void;
  onEdit: (category: GovernanceDocumentCategory) => void;
  onDelete: (category: GovernanceDocumentCategory) => void;
};

function CategoryDetailSheet({ category, canManage, onClose, onEdit, onDelete }: DetailProps) {
  const hasDescription = Boolean(category?.description?.trim());

  return (
    <MobileSheet visible={Boolean(category)} title={category?.name || 'Document category'} description="Governance upload category" onClose={onClose}>
      {category ? (
        <View style={styles.sheetContent}>
          <MobileCard compact accent={hasDescription ? 'blue' : 'orange'}>
            <View style={styles.detailHeader}>
              <View style={styles.flex}>
                <MobileText variant="section" weight="bold">
                  {category.name || 'Document category'}
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  {category.description || 'No description provided'}
                </MobileText>
              </View>
              <MobileStatusBadge status={hasDescription ? 'Ready' : 'Needs copy'} tone={hasDescription ? 'success' : 'warning'} />
            </View>
          </MobileCard>
          <MobileInfoRow label="Category name" value={category.name || 'Not set'} icon={FolderOpen} />
          <MobileInfoRow label="Description" value={category.description || 'No description provided'} icon={FileText} />
          <MobileInfoRow label="Created" value={category.createdAt ? formatDate(category.createdAt) : 'Not tracked'} icon={Clock3} />
          <MobileInfoRow label="Updated" value={category.updatedAt ? formatDate(category.updatedAt) : 'Not tracked'} icon={RefreshCw} />

          {canManage ? (
            <View style={styles.sheetActions}>
              <MobileButton label="Edit" icon={Edit3} variant="secondary" onPress={() => onEdit(category)} />
              <MobileButton label="Delete" icon={Trash2} variant="danger" onPress={() => onDelete(category)} />
            </View>
          ) : null}
        </View>
      ) : null}
    </MobileSheet>
  );
}

function sortCategories(a: GovernanceDocumentCategory, b: GovernanceDocumentCategory) {
  return String(a.name || '').localeCompare(String(b.name || ''));
}

function hasDocumentCategoryManagePermission(user: { permissions?: string[]; roles?: string[]; associationRole?: string; systemRole?: string } | null) {
  const values = [...(user?.permissions || []), ...(user?.roles || []), user?.associationRole || '', user?.systemRole || ''].map((value) => value.toLowerCase());
  return values.some((value) => ['settings.update', 'governance.manage', 'config_write', 'platform_admin', 'association_admin', 'admin'].includes(value));
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
