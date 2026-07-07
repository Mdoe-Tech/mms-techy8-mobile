import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Download,
  FileText,
  FolderOpen,
  HardDrive,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileConfirmSheet,
  MobileDocumentCard,
  MobileEmptyState,
  MobileErrorState,
  MobileFileUpload,
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
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
  MobileTextInput,
  MobileToast,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  deleteGovernanceDocument,
  downloadGovernanceDocument,
  getGovernanceDocumentCategories,
  getGovernanceDocuments,
  uploadGovernanceDocument,
  type GovernanceDocument,
  type GovernanceDocumentUploadFile,
} from '@/services/governance-service';
import { type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber } from '@/utils/format';

type VisibilityFilter = 'all' | 'Internal' | 'Members' | 'Public';
type SortOption = 'createdDesc' | 'dateDesc' | 'dateAsc' | 'titleAsc' | 'sizeDesc' | 'categoryAsc';

type UploadForm = {
  title: string;
  category: string;
  description: string;
  visibility: string;
  documentDate: string;
};

const allCategories = '__all_categories__';
const visibilityOptions = ['Internal', 'Members', 'Public'];

const sortOptions = [
  { value: 'createdDesc', label: 'Newest uploaded' },
  { value: 'dateDesc', label: 'Newest document date' },
  { value: 'dateAsc', label: 'Oldest document date' },
  { value: 'titleAsc', label: 'Document title' },
  { value: 'sizeDesc', label: 'Largest file' },
  { value: 'categoryAsc', label: 'Category' },
];

const todayInputValue = () => new Date().toISOString().slice(0, 10);

export default function MobileGovernanceDocumentsScreen() {
  const params = useLocalSearchParams();
  const { activeView, associationId, user } = useAuth();
  const [documents, setDocuments] = useState<GovernanceDocument[]>([]);
  const [categories, setCategories] = useState<string[]>(['General']);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState(allCategories);
  const [sortValue, setSortValue] = useState<SortOption>('createdDesc');
  const [filterOpen, setFilterOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<GovernanceDocumentUploadFile | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<GovernanceDocument | null>(null);
  const [documentToDelete, setDocumentToDelete] = useState<GovernanceDocument | null>(null);
  const [openedDocumentId, setOpenedDocumentId] = useState<string | null>(null);
  const [openedUploadParam, setOpenedUploadParam] = useState(false);
  const [form, setForm] = useState<UploadForm>(() => createUploadForm('General'));

  const initialDocumentId = Array.isArray(params.documentId) ? params.documentId[0] : params.documentId;
  const shouldOpenUpload = normalizeParamFlag(params.uploadDocument);

  const loadDocuments = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before loading governance documents.');
        return;
      }

      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);
      setNotice(null);

      try {
        const [documentRows, categoryRows] = await Promise.all([
          getGovernanceDocuments(associationId),
          getGovernanceDocumentCategories(associationId),
        ]);
        setDocuments(documentRows);
        const names = buildCategoryOptions(documentRows, categoryRows.map((category) => category.name));
        setCategories(names);
        setForm((current) => ({
          ...current,
          category: current.category || names[0] || 'General',
        }));
      } catch (loadError) {
        setDocuments([]);
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
      if (active) void loadDocuments();
    });
    return () => {
      active = false;
    };
  }, [loadDocuments]);

  useEffect(() => {
    if (!initialDocumentId || openedDocumentId === initialDocumentId || documents.length === 0) return;
    const document = documents.find((row) => row.id === initialDocumentId);
    if (document) {
      void Promise.resolve().then(() => {
        setSelectedDocument(document);
        setOpenedDocumentId(initialDocumentId);
      });
    }
  }, [documents, initialDocumentId, openedDocumentId]);

  useEffect(() => {
    if (!shouldOpenUpload || openedUploadParam) return;
    void Promise.resolve().then(() => {
      setForm(createUploadForm(categories[0] || 'General'));
      setSelectedFile(null);
      setError(null);
      setUploadOpen(true);
      setOpenedUploadParam(true);
    });
  }, [categories, openedUploadParam, shouldOpenUpload]);

  const summary = useMemo(() => {
    const shared = documents.filter((document) => ['Public', 'Members'].includes(document.visibility || '')).length;
    const totalBytes = documents.reduce((sum, document) => sum + Number(document.fileSize || 0), 0);
    const categoryCount = new Set(documents.map((document) => document.category).filter(Boolean)).size;
    return {
      total: documents.length,
      categoryCount,
      shared,
      totalBytes,
    };
  }, [documents]);

  const visibilityCounts = useMemo(() => {
    const counts = { Internal: 0, Members: 0, Public: 0 };
    documents.forEach((document) => {
      if (document.visibility === 'Members') counts.Members += 1;
      else if (document.visibility === 'Public') counts.Public += 1;
      else counts.Internal += 1;
    });
    return counts;
  }, [documents]);

  const visibilityTabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: documents.length },
      { value: 'Internal', label: 'Internal', count: visibilityCounts.Internal },
      { value: 'Members', label: 'Members', count: visibilityCounts.Members },
      { value: 'Public', label: 'Public', count: visibilityCounts.Public },
    ],
    [documents.length, visibilityCounts],
  );

  const filteredDocuments = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const rows = documents.filter((document) => {
      const matchesVisibility = visibilityFilter === 'all' || document.visibility === visibilityFilter;
      const matchesCategory = categoryFilter === allCategories || document.category === categoryFilter;
      const haystack = [
        document.title,
        document.category,
        document.visibility,
        document.uploadedBy,
        document.fileName,
        document.documentDate,
        document.createdAt,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return matchesVisibility && matchesCategory && (!query || haystack.includes(query));
    });
    return sortDocuments(rows, sortValue);
  }, [categoryFilter, documents, searchTerm, sortValue, visibilityFilter]);

  const documentReportOptions = useMemo(
    () => ({
      title: 'Governance Documents',
      associationName: user?.associationName || 'Association',
      purpose: 'A current-view report of governance documents, categories, visibility, file size, owners, and dates.',
      rows: filteredDocuments,
      fileName: 'nane-governance-documents',
      metrics: [
        { label: 'Documents', value: formatNumber(summary.total), helper: 'Official files' },
        { label: 'Categories', value: formatNumber(summary.categoryCount), helper: 'Document groups' },
        { label: 'Shared', value: formatNumber(summary.shared), helper: 'Members or public' },
        { label: 'Storage', value: formatBytes(summary.totalBytes), helper: 'Uploaded size' },
      ],
      filters: [
        { label: 'Search', value: searchTerm || 'All' },
        { label: 'Visibility', value: visibilityTabs.find((tab) => tab.value === visibilityFilter)?.label || visibilityFilter },
        { label: 'Category', value: categoryFilter === allCategories ? 'All' : categoryFilter },
        { label: 'Sort', value: sortOptions.find((option) => option.value === sortValue)?.label || sortValue },
      ],
      columns: [
        { key: 'title', label: 'Title', width: '20%', value: (row: GovernanceDocument) => row.title || '-' },
        { key: 'category', label: 'Category', width: '13%', value: (row: GovernanceDocument) => row.category || '-' },
        { key: 'visibility', label: 'Visibility', width: '11%', value: (row: GovernanceDocument) => row.visibility || '-' },
        { key: 'documentDate', label: 'Document Date', width: '12%', value: (row: GovernanceDocument) => formatDate(row.documentDate) },
        { key: 'uploadedBy', label: 'Uploaded By', width: '16%', value: (row: GovernanceDocument) => row.uploadedBy || '-' },
        { key: 'fileName', label: 'File Name', width: '18%', value: (row: GovernanceDocument) => row.fileName || '-' },
        { key: 'size', label: 'Size', align: 'right' as const, width: '10%', value: (row: GovernanceDocument) => formatBytes(row.fileSize) },
        { key: 'uploaded', label: 'Uploaded', width: '11%', value: (row: GovernanceDocument) => formatDate(row.createdAt) },
      ],
    }),
    [categoryFilter, filteredDocuments, searchTerm, sortValue, summary, user?.associationName, visibilityFilter, visibilityTabs],
  );

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Association admin only" description="Governance documents are available from the association admin workspace." />;
  }

  if (loading) {
    return <MobilePageLoadingState kind="list" message="Loading governance documents" />;
  }

  const refresh = () => {
    void loadDocuments('refresh');
  };

  const resetUploadForm = (category = categories[0] || 'General') => {
    setForm(createUploadForm(category));
    setSelectedFile(null);
    setError(null);
  };

  const openUpload = () => {
    resetUploadForm();
    setUploadOpen(true);
  };

  const pickFile = async () => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/jpeg',
        'image/png',
      ],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (picked.canceled || !picked.assets?.length) return;
    const asset = picked.assets[0];
    setSelectedFile({
      uri: asset.uri,
      name: asset.name || 'governance-document',
      mimeType: asset.mimeType || 'application/octet-stream',
      size: asset.size,
    });
    setNotice(null);
  };

  const uploadDocument = async () => {
    if (!associationId) return;
    if (!form.title.trim()) {
      setError('Document title is required.');
      return;
    }
    if (!form.documentDate.trim()) {
      setError('Document date is required.');
      return;
    }
    if (!selectedFile) {
      setError('Choose a file before uploading the governance document.');
      return;
    }

    setUploading(true);
    setError(null);
    setNotice(null);

    try {
      await uploadGovernanceDocument(associationId, {
        title: form.title.trim(),
        category: form.category || 'General',
        description: form.description.trim(),
        visibility: form.visibility || 'Internal',
        documentDate: form.documentDate || todayInputValue(),
        file: selectedFile,
      });
      setUploadOpen(false);
      resetUploadForm();
      setNotice('Governance document uploaded successfully.');
      await loadDocuments('refresh');
    } catch (uploadError) {
      setError(getApiErrorMessage(uploadError));
    } finally {
      setUploading(false);
    }
  };

  const downloadDocument = async (document: GovernanceDocument) => {
    if (!associationId) return;
    setDownloadingId(document.id);
    setError(null);

    try {
      const response = await downloadGovernanceDocument(associationId, document.id);
      const fileName = safeFileName(document.fileName || `governance-document-${document.id}`);
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, arrayBufferToBase64(response.data), {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: response.headers.get('content-type') || document.contentType || 'application/octet-stream',
          dialogTitle: 'Share governance document',
        });
      }
      setNotice(`Downloaded ${fileName}.`);
    } catch (downloadError) {
      setError(getApiErrorMessage(downloadError));
    } finally {
      setDownloadingId(null);
    }
  };

  const deleteDocument = async () => {
    if (!associationId || !documentToDelete) return;
    setDeletingId(documentToDelete.id);
    setError(null);
    setNotice(null);

    try {
      await deleteGovernanceDocument(associationId, documentToDelete.id);
      setNotice('Governance document deleted.');
      setSelectedDocument(null);
      setDocumentToDelete(null);
      await loadDocuments('refresh');
    } catch (deleteError) {
      setError(getApiErrorMessage(deleteError));
    } finally {
      setDeletingId(null);
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setVisibilityFilter('all');
    setCategoryFilter(allCategories);
    setSortValue('createdDesc');
  };

  return (
    <MobileScreen>
      <MobilePageHeader
        title="Governance Documents"
        eyebrow="Governance"
        subtitle="Policies, minutes, bylaws, and official files."
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh" onPress={refresh} disabled={refreshing} />}
      />

      {notice ? <MobileToast title="Documents" description={notice} tone="info" /> : null}
      {error ? <MobileErrorState title="Document issue" description={error} retryLabel="Dismiss" onRetry={() => setError(null)} /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Documents" value={formatNumber(summary.total)} description="Official files" tone="blue" icon={FileText} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Categories" value={formatNumber(summary.categoryCount)} description="Document groups" tone="green" icon={FolderOpen} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Shared" value={formatNumber(summary.shared)} description="Members or public" tone="teal" icon={Users} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Storage" value={formatBytes(summary.totalBytes)} description="Uploaded size" tone="orange" icon={HardDrive} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard compact>
        <View style={styles.toolbarTop}>
          <View style={styles.toolbarCopy}>
            <MobileText variant="body" weight="bold">
              Document Library
            </MobileText>
            <MobileText variant="small" tone="secondary">
              {formatNumber(filteredDocuments.length)} of {formatNumber(documents.length)} documents shown.
            </MobileText>
          </View>
          <MobileStatusBadge label={summary.shared > 0 ? `${summary.shared} shared` : 'Internal records'} tone={summary.shared > 0 ? 'info' : 'neutral'} />
        </View>
        <View style={styles.actions}>
          <MobileButton label="Upload" icon={Upload} onPress={openUpload} size="sm" />
          <MobileReportExportButton options={documentReportOptions} size="sm" onSuccess={(_uri, format) => setNotice(`${format.toUpperCase()} document report is ready.`)} onError={(exportError) => setError(getApiErrorMessage(exportError))} />
        </View>
      </MobileCard>

      <MobileSearchToolbar value={searchTerm} onChange={setSearchTerm} placeholder="Search document, category, owner..." onFilterPress={() => setFilterOpen(true)} filterLabel="Filter" />
      <MobileStatusTabs tabs={visibilityTabs} value={visibilityFilter} onChange={(value) => setVisibilityFilter(value as VisibilityFilter)} />

      {filteredDocuments.length === 0 ? (
        <MobileEmptyState
          title={documents.length === 0 ? 'No governance documents' : 'No matching documents'}
          description={documents.length === 0 ? 'Upload the first official document to keep governance records organized.' : 'Adjust search, visibility, or category filters.'}
          actionLabel={documents.length === 0 ? 'Upload Document' : 'Reset Filters'}
          onAction={documents.length === 0 ? openUpload : resetFilters}
        />
      ) : (
        <View style={styles.documentStack}>
          {filteredDocuments.map((document) => (
            <MobileDocumentCard
              key={document.id}
              title={document.title}
              meta={`${document.category || 'General'} · ${formatBytes(document.fileSize)} · ${formatDate(document.documentDate)}`}
              status={document.visibility || 'Internal'}
              onView={() => setSelectedDocument(document)}
              onDownload={() => void downloadDocument(document)}
            />
          ))}
        </View>
      )}

      <MobileSheet visible={filterOpen} title="Filter Documents" description="Narrow the library without losing context." onClose={() => setFilterOpen(false)}>
        <MobileSelect
          label="Category"
          value={categoryFilter}
          options={[{ value: allCategories, label: 'All categories' }, ...categories.map((category) => ({ value: category, label: category }))]}
          onChange={setCategoryFilter}
        />
        <MobileSelect label="Sort by" value={sortValue} options={sortOptions} onChange={(value) => setSortValue(value as SortOption)} />
        <View style={styles.filterActions}>
          <MobileButton label="Reset" variant="secondary" onPress={resetFilters} />
          <MobileButton label="Apply" fullWidth onPress={() => setFilterOpen(false)} style={styles.flexAction} />
        </View>
      </MobileSheet>

      <MobileSheet
        visible={uploadOpen}
        title="Upload Governance Document"
        description="Add official files with category, visibility, date, and supporting context."
        onClose={() => {
          if (!uploading) setUploadOpen(false);
        }}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScroll}>
          <MobileTextInput label="Document title" value={form.title} onChangeText={(value) => setForm((current) => ({ ...current, title: value }))} placeholder="Board meeting minutes" disabled={uploading} />
          <MobileSelect label="Category" value={form.category} options={categories.map((category) => ({ value: category, label: category }))} onChange={(value) => setForm((current) => ({ ...current, category: value }))} />
          <MobileSelect label="Visibility" value={form.visibility} options={visibilityOptions.map((visibility) => ({ value: visibility, label: visibility }))} onChange={(value) => setForm((current) => ({ ...current, visibility: value }))} />
          <MobileTextInput label="Date created" value={form.documentDate} onChangeText={(value) => setForm((current) => ({ ...current, documentDate: value }))} placeholder="YYYY-MM-DD" helperText="Use the backend date format, for example 2026-12-31." disabled={uploading} />
          <MobileTextInput label="Description" value={form.description} onChangeText={(value) => setForm((current) => ({ ...current, description: value }))} placeholder="Purpose, approval notes, or meeting context" disabled={uploading} />
          <MobileFileUpload
            title={selectedFile ? selectedFile.name : 'Choose document file'}
            description={selectedFile ? `${selectedFile.mimeType || 'Selected file'} · ${formatBytes(selectedFile.size)}` : 'PDF, Word, Excel, JPG, and PNG are supported.'}
            onPress={pickFile}
          />
          <View style={styles.formActions}>
            <MobileButton label="Cancel" variant="secondary" onPress={() => setUploadOpen(false)} disabled={uploading} />
            <MobileButton label="Upload" icon={Upload} loading={uploading} disabled={!selectedFile || uploading} onPress={uploadDocument} fullWidth style={styles.flexAction} />
          </View>
        </ScrollView>
      </MobileSheet>

      <MobileSheet visible={Boolean(selectedDocument)} title="Document Details" description="Review visibility, ownership, dates, and file metadata." onClose={() => setSelectedDocument(null)}>
        {selectedDocument ? (
          <View style={styles.detailContent}>
            <MobileCard compact accent={visibilityAccent(selectedDocument.visibility)}>
              <View style={styles.detailTitleRow}>
                <View style={styles.detailTitleCopy}>
                  <MobileText variant="section" weight="bold">
                    {selectedDocument.title}
                  </MobileText>
                  {selectedDocument.description ? (
                    <MobileText variant="small" tone="secondary">
                      {selectedDocument.description}
                    </MobileText>
                  ) : null}
                </View>
                <MobileStatusBadge label={selectedDocument.visibility || 'Internal'} tone={visibilityTone(selectedDocument.visibility)} />
              </View>
            </MobileCard>
            <MobileCard compact>
              <MobileInfoRow label="Category" value={selectedDocument.category || 'General'} helper="Document group for filtering." icon={FolderOpen} />
              <MobileInfoRow label="Document date" value={formatDate(selectedDocument.documentDate)} helper="Date assigned by governance team." icon={FileText} />
              <MobileInfoRow label="Uploaded by" value={selectedDocument.uploadedBy || 'Unknown'} helper={`Uploaded ${formatDate(selectedDocument.createdAt)}.`} icon={ShieldCheck} />
              <MobileInfoRow label="File" value={selectedDocument.fileName || 'governance-document'} helper={`${formatBytes(selectedDocument.fileSize)} · ${selectedDocument.contentType || 'application/octet-stream'}`} icon={HardDrive} />
            </MobileCard>
            <View style={styles.actions}>
              <MobileButton label="Download" icon={Download} loading={downloadingId === selectedDocument.id} onPress={() => void downloadDocument(selectedDocument)} size="sm" />
              <MobileButton label="Delete" variant="danger" icon={Trash2} disabled={deletingId === selectedDocument.id} onPress={() => setDocumentToDelete(selectedDocument)} size="sm" />
            </View>
          </View>
        ) : null}
      </MobileSheet>

      <MobileConfirmSheet
        visible={Boolean(documentToDelete)}
        title="Delete governance document?"
        description={documentToDelete ? `Delete "${documentToDelete.title}"? This will remove the file permanently.` : 'Delete this document?'}
        confirmLabel="Delete Document"
        destructive
        onCancel={() => setDocumentToDelete(null)}
        onConfirm={deleteDocument}
      />
    </MobileScreen>
  );
}

function createUploadForm(category: string): UploadForm {
  return {
    title: '',
    category,
    description: '',
    visibility: 'Internal',
    documentDate: todayInputValue(),
  };
}

function buildCategoryOptions(documents: GovernanceDocument[], categoryNames: string[]) {
  const names = new Set<string>();
  categoryNames.forEach((name) => {
    if (name) names.add(name);
  });
  documents.forEach((document) => {
    if (document.category) names.add(document.category);
  });
  if (names.size === 0) names.add('General');
  return Array.from(names).sort((left, right) => left.localeCompare(right));
}

function sortDocuments(documents: GovernanceDocument[], sortValue: SortOption) {
  const rows = [...documents];
  if (sortValue === 'dateDesc') return rows.sort((left, right) => dateTime(right.documentDate) - dateTime(left.documentDate));
  if (sortValue === 'dateAsc') return rows.sort((left, right) => dateTime(left.documentDate) - dateTime(right.documentDate));
  if (sortValue === 'titleAsc') return rows.sort((left, right) => left.title.localeCompare(right.title));
  if (sortValue === 'sizeDesc') return rows.sort((left, right) => Number(right.fileSize || 0) - Number(left.fileSize || 0));
  if (sortValue === 'categoryAsc') return rows.sort((left, right) => String(left.category || '').localeCompare(String(right.category || '')));
  return rows.sort((left, right) => dateTime(right.createdAt) - dateTime(left.createdAt));
}

function dateTime(value?: string | null) {
  return new Date(value || '').getTime() || 0;
}

function formatBytes(value?: number | null) {
  const bytes = Number(value || 0);
  if (!bytes) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function visibilityTone(visibility?: string | null): StatusTone {
  if (visibility === 'Public') return 'success';
  if (visibility === 'Members') return 'info';
  return 'neutral';
}

function visibilityAccent(visibility?: string | null) {
  if (visibility === 'Public') return 'green';
  if (visibility === 'Members') return 'teal';
  return 'slate';
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'governance-document';
}

function normalizeParamFlag(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'true' || raw === '1' || raw === 'yes';
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  if (typeof globalThis.btoa !== 'function') {
    throw new Error('This device cannot encode the downloaded document.');
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return globalThis.btoa(binary);
}

const styles = StyleSheet.create({
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
  documentStack: {
    gap: 10,
  },
  filterActions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
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
  flexAction: {
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
