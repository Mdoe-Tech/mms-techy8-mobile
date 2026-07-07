import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { router, useLocalSearchParams } from 'expo-router';
import {
  BarChart3,
  CheckCircle2,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, ScrollView, Share, StyleSheet, View } from 'react-native';

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
  MobileProgressBar,
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
  closeMemberVoiceQuestionnaire,
  createMemberVoiceQuestionnaire,
  deleteMemberVoiceQuestionnaire,
  downloadMemberVoiceExport,
  getMemberVoiceAnalytics,
  getMemberVoicePackages,
  getMemberVoiceQuestionnaires,
  getMemberVoiceResponses,
  notifyMemberVoiceQuestionnaire,
  publishMemberVoiceQuestionnaire,
  updateMemberVoiceQuestionnaire,
  type MemberVoiceAnalytics,
  type MemberVoicePackage,
  type MemberVoiceQuestion,
  type MemberVoiceQuestionnaire,
  type MemberVoiceQuestionnairePayload,
  type MemberVoiceQuestionType,
  type MemberVoiceStatus,
  type MemberVoiceSubmission,
  type MemberVoiceTargetAudience,
} from '@/services/member-voice-service';
import { type KpiTone, type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber, formatPercent } from '@/utils/format';

type StatusFilter = 'ALL' | 'DRAFT' | 'PUBLISHED' | 'CLOSED';
type SortOption = 'updatedDesc' | 'titleAsc' | 'responsesDesc' | 'questionsDesc' | 'targetDesc';
type PendingAction = 'publish' | 'close' | 'notify' | 'delete';

type VoiceQuestionForm = {
  questionText: string;
  questionType: MemberVoiceQuestionType;
  required: boolean;
  options: string[];
  minRating: string;
  maxRating: string;
};

type VoiceForm = {
  title: string;
  description: string;
  targetAudience: MemberVoiceTargetAudience;
  targetPackageIds: string[];
  closesAt: string;
  questions: VoiceQuestionForm[];
};

const questionTypeOptions = [
  { value: 'OPEN_TEXT', label: 'Open text' },
  { value: 'MULTIPLE_CHOICE', label: 'Multiple choice' },
  { value: 'RATING_SCALE', label: 'Rating scale' },
  { value: 'YES_NO', label: 'Yes / No' },
];

const audienceOptions = [
  { value: 'ALL_MEMBERS', label: 'All members' },
  { value: 'SPECIFIC_PACKAGES', label: 'Specific packages' },
];

const sortOptions = [
  { value: 'updatedDesc', label: 'Recently updated', description: 'Latest questionnaire changes first.' },
  { value: 'titleAsc', label: 'Title', description: 'Alphabetical questionnaire order.' },
  { value: 'responsesDesc', label: 'Most responses', description: 'Questionnaires with more answers first.' },
  { value: 'questionsDesc', label: 'Most questions', description: 'Longer questionnaires first.' },
  { value: 'targetDesc', label: 'Largest target', description: 'More targeted members first.' },
];

const emptyQuestion = (): VoiceQuestionForm => ({
  questionText: '',
  questionType: 'OPEN_TEXT',
  required: true,
  options: ['', ''],
  minRating: '1',
  maxRating: '5',
});

const emptyForm = (): VoiceForm => ({
  title: '',
  description: '',
  targetAudience: 'ALL_MEMBERS',
  targetPackageIds: [],
  closesAt: '',
  questions: [emptyQuestion()],
});

export default function MobileMembersVoiceScreen() {
  const params = useLocalSearchParams();
  const { activeView, associationId } = useAuth();
  const [questionnaires, setQuestionnaires] = useState<MemberVoiceQuestionnaire[]>([]);
  const [packages, setPackages] = useState<MemberVoicePackage[]>([]);
  const [analytics, setAnalytics] = useState<MemberVoiceAnalytics | null>(null);
  const [responses, setResponses] = useState<MemberVoiceSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [sortValue, setSortValue] = useState<SortOption>('updatedDesc');
  const [sortOpen, setSortOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState<MemberVoiceQuestionnaire | null>(null);
  const [form, setForm] = useState<VoiceForm>(() => emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{ action: PendingAction; questionnaire: MemberVoiceQuestionnaire } | null>(null);
  const [openedQuestionnaireId, setOpenedQuestionnaireId] = useState<string | null>(null);
  const [openedCreateParam, setOpenedCreateParam] = useState(false);

  const initialQuestionnaireId = Array.isArray(params.questionnaireId) ? params.questionnaireId[0] : params.questionnaireId;
  const shouldOpenCreate = normalizeParamFlag(params.createQuestionnaire);

  const loadVoice = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before loading Members Voice.');
        return;
      }

      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);
      setNotice(null);

      try {
        const [questionnaireRows, packageRows] = await Promise.all([
          getMemberVoiceQuestionnaires(associationId),
          getMemberVoicePackages(associationId).catch(() => []),
        ]);
        setQuestionnaires(questionnaireRows);
        setPackages(packageRows);
      } catch (loadError) {
        setQuestionnaires([]);
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId],
  );

  const loadAnalytics = useCallback(
    async (questionnaire: MemberVoiceQuestionnaire) => {
      if (!associationId) return;
      setAnalyticsLoading(true);
      setError(null);

      try {
        const [analyticsResponse, responseRows] = await Promise.all([
          getMemberVoiceAnalytics(associationId, questionnaire.id),
          getMemberVoiceResponses(associationId, questionnaire.id),
        ]);
        setAnalytics(analyticsResponse);
        setResponses(responseRows);
      } catch (analyticsError) {
        setAnalytics(null);
        setResponses([]);
        setError(getApiErrorMessage(analyticsError));
      } finally {
        setAnalyticsLoading(false);
      }
    },
    [associationId],
  );

  const openQuestionnaire = useCallback(
    async (questionnaire: MemberVoiceQuestionnaire) => {
      setBuilderOpen(false);
      setSelectedQuestionnaire(questionnaire);
      setAnalytics(null);
      setResponses([]);
      await loadAnalytics(questionnaire);
    },
    [loadAnalytics],
  );

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadVoice();
    });
    return () => {
      active = false;
    };
  }, [loadVoice]);

  useEffect(() => {
    if (!initialQuestionnaireId || questionnaires.length === 0) return;
    if (
      openedQuestionnaireId === initialQuestionnaireId &&
      selectedQuestionnaire?.id === initialQuestionnaireId &&
      !builderOpen
    ) {
      return;
    }
    const questionnaire = questionnaires.find((row) => row.id === initialQuestionnaireId);
    if (questionnaire) {
      void Promise.resolve().then(() => {
        void openQuestionnaire(questionnaire);
        setOpenedQuestionnaireId(initialQuestionnaireId);
      });
    }
  }, [builderOpen, initialQuestionnaireId, openQuestionnaire, openedQuestionnaireId, questionnaires, selectedQuestionnaire?.id]);

  useEffect(() => {
    if (!shouldOpenCreate || openedCreateParam) return;
    void Promise.resolve().then(() => {
      openBuilder();
      setOpenedCreateParam(true);
    });
  }, [openedCreateParam, shouldOpenCreate]);

  const totals = useMemo(() => {
    const published = questionnaires.filter((item) => item.status === 'PUBLISHED').length;
    const closed = questionnaires.filter((item) => item.status === 'CLOSED').length;
    const responsesTotal = questionnaires.reduce((sum, item) => sum + Number(item.responseCount || 0), 0);
    return {
      total: questionnaires.length,
      draft: questionnaires.filter((item) => item.status === 'DRAFT').length,
      published,
      closed,
      responses: responsesTotal,
      target: selectedQuestionnaire?.targetMemberCount || analytics?.targetMemberCount || 0,
      responseRate: analytics?.responseRate || 0,
    };
  }, [analytics, questionnaires, selectedQuestionnaire]);

  const statusTabs = useMemo(
    () => [
      { value: 'ALL', label: 'All', count: totals.total },
      { value: 'PUBLISHED', label: 'Published', count: totals.published },
      { value: 'DRAFT', label: 'Draft', count: totals.draft },
      { value: 'CLOSED', label: 'Closed', count: totals.closed },
    ],
    [totals],
  );

  const filteredQuestionnaires = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const rows = questionnaires.filter((item) => {
      const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
      const haystack = [item.title, item.description, item.status, item.shareableLink].filter(Boolean).join(' ').toLowerCase();
      return matchesStatus && (!query || haystack.includes(query));
    });
    return sortQuestionnaires(rows, sortValue);
  }, [questionnaires, searchTerm, sortValue, statusFilter]);

  const questionnaireItems = useMemo<MobileDataListItem[]>(
    () =>
      filteredQuestionnaires.map((questionnaire) => ({
        id: questionnaire.id,
        title: questionnaire.title,
        subtitle: `${formatQuestionCount(questionnaire.questions)} · ${targetAudienceLabel(questionnaire.targetAudience)}`,
        meta: `${formatNumber(Number(questionnaire.responseCount || 0))} responses · Updated ${formatDate(questionnaire.updatedAt || questionnaire.createdAt)}`,
        amount: questionnaire.targetMemberCount ? `${formatNumber(Number(questionnaire.targetMemberCount))} target` : undefined,
        status: statusLabel(questionnaire.status),
        statusTone: statusTone(questionnaire.status),
        initials: statusInitials(questionnaire.status),
        accent: statusAccent(questionnaire.status),
      })),
    [filteredQuestionnaires],
  );

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Association admin only" description="Members Voice is available from the association admin workspace." />;
  }

  if (loading) {
    return <MobilePageLoadingState kind="list" message="Loading Members Voice" />;
  }

  const refresh = () => {
    void loadVoice('refresh');
  };

  function openBuilder(questionnaire?: MemberVoiceQuestionnaire) {
    setSelectedQuestionnaire(null);
    setPendingAction(null);
    setOpenedQuestionnaireId(null);
    setAnalytics(null);
    setResponses([]);
    setEditingId(questionnaire?.id || null);
    setForm(questionnaire ? formFromQuestionnaire(questionnaire) : emptyForm());
    setError(null);
    setBuilderOpen(true);
  }

  function updateQuestion(index: number, patch: Partial<VoiceQuestionForm>) {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question, questionIndex) => (questionIndex === index ? { ...question, ...patch } : question)),
    }));
  }

  function addQuestion() {
    setForm((current) => ({ ...current, questions: [...current.questions, emptyQuestion()] }));
  }

  function removeQuestion(index: number) {
    setForm((current) => ({
      ...current,
      questions: current.questions.length === 1 ? current.questions : current.questions.filter((_, questionIndex) => questionIndex !== index),
    }));
  }

  function togglePackage(packageId: string, checked: boolean) {
    setForm((current) => ({
      ...current,
      targetPackageIds: checked
        ? [...new Set([...current.targetPackageIds, packageId])]
        : current.targetPackageIds.filter((id) => id !== packageId),
    }));
  }

  function validateForm() {
    setError(null);
    if (!form.title.trim()) {
      setError('Questionnaire title is required.');
      return false;
    }
    if (form.targetAudience === 'SPECIFIC_PACKAGES' && form.targetPackageIds.length === 0) {
      setError('Select at least one membership package.');
      return false;
    }
    for (const [index, question] of form.questions.entries()) {
      if (!question.questionText.trim()) {
        setError(`Question ${index + 1} text is required.`);
        return false;
      }
      if (question.questionType === 'MULTIPLE_CHOICE') {
        const options = question.options.map((option) => option.trim()).filter(Boolean);
        if (options.length < 2) {
          setError(`Question ${index + 1} needs at least two options.`);
          return false;
        }
      }
      if (question.questionType === 'RATING_SCALE' && Number(question.maxRating) <= Number(question.minRating)) {
        setError(`Question ${index + 1} rating maximum must be greater than minimum.`);
        return false;
      }
    }
    return true;
  }

  async function saveQuestionnaire(status: MemberVoiceStatus = 'DRAFT') {
    if (!associationId || !validateForm()) return;
    setSaving(true);
    setNotice(null);

    const payload: MemberVoiceQuestionnairePayload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      status,
      targetAudience: form.targetAudience,
      targetPackageIds: form.targetAudience === 'SPECIFIC_PACKAGES' ? form.targetPackageIds : [],
      closesAt: toRequestDate(form.closesAt),
      questions: form.questions.map((question, index) => ({
        questionText: question.questionText.trim(),
        questionType: question.questionType,
        required: question.required,
        displayOrder: index + 1,
        options: question.questionType === 'MULTIPLE_CHOICE' ? question.options.map((option) => option.trim()).filter(Boolean) : [],
        minRating: question.questionType === 'RATING_SCALE' ? Number(question.minRating || 1) : 1,
        maxRating: question.questionType === 'RATING_SCALE' ? Number(question.maxRating || 5) : 5,
      })),
    };

    try {
      const saved = editingId
        ? await updateMemberVoiceQuestionnaire(associationId, editingId, payload)
        : await createMemberVoiceQuestionnaire(associationId, payload);
      setBuilderOpen(false);
      setEditingId(null);
      setNotice(status === 'PUBLISHED' ? 'Questionnaire published.' : 'Questionnaire saved.');
      await loadVoice('refresh');
      await openQuestionnaire(saved);
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function runPendingAction() {
    if (!associationId || !pendingAction) return;
    const { action, questionnaire } = pendingAction;
    setSaving(true);
    setNotice(null);

    try {
      if (action === 'publish') {
        const updated = await publishMemberVoiceQuestionnaire(associationId, questionnaire.id);
        setNotice('Questionnaire published.');
        await loadVoice('refresh');
        await openQuestionnaire(updated);
      } else if (action === 'close') {
        const updated = await closeMemberVoiceQuestionnaire(associationId, questionnaire.id);
        setNotice('Questionnaire closed.');
        await loadVoice('refresh');
        await openQuestionnaire(updated);
      } else if (action === 'notify') {
        await notifyMemberVoiceQuestionnaire(associationId, questionnaire.id);
        setNotice('Member notifications queued.');
      } else if (action === 'delete') {
        await deleteMemberVoiceQuestionnaire(associationId, questionnaire.id);
        setSelectedQuestionnaire(null);
        setAnalytics(null);
        setResponses([]);
        setNotice('Questionnaire deleted.');
        await loadVoice('refresh');
      }
      setPendingAction(null);
    } catch (actionError) {
      setError(getApiErrorMessage(actionError));
    } finally {
      setSaving(false);
    }
  }

  async function shareLink(questionnaire: MemberVoiceQuestionnaire) {
    if (!questionnaire.shareableLink) {
      setError('This questionnaire has no shareable link yet. Save or publish it first.');
      return;
    }
    await Share.share({
      title: questionnaire.title,
      message: `${questionnaire.title}\n${questionnaire.shareableLink}`,
      url: questionnaire.shareableLink,
    });
  }

  async function openLink(questionnaire: MemberVoiceQuestionnaire) {
    if (!questionnaire.shareableLink) return;
    await Linking.openURL(questionnaire.shareableLink);
  }

  async function exportSelected(format: 'xlsx' | 'pdf') {
    if (!associationId || !selectedQuestionnaire) return;
    setExporting(format);
    setError(null);

    try {
      const response = await downloadMemberVoiceExport(associationId, selectedQuestionnaire.id, format);
      const fileName = `members-voice-${safeFileName(selectedQuestionnaire.title)}-${Date.now()}.${format}`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, arrayBufferToBase64(response.data), {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: `Share Members Voice ${format.toUpperCase()} export`,
        });
      }
    } catch (exportError) {
      setError(getApiErrorMessage(exportError));
    } finally {
      setExporting(null);
    }
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        title="Members Voice"
        eyebrow="Community"
        subtitle="Build questionnaires, share feedback links, and review responses."
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh" onPress={refresh} disabled={refreshing} />}
      />

      {error ? <MobileErrorState title="Members Voice issue" description={error} onRetry={() => setError(null)} retryLabel="Dismiss" /> : null}
      {notice ? <MobileToast title="Members Voice" description={notice} tone="success" /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Questionnaires" value={formatNumber(totals.total)} description={`${formatNumber(totals.draft)} draft`} icon={MessageSquare} tone="blue" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Published" value={formatNumber(totals.published)} description="Live member links" icon={Send} tone="green" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Responses" value={formatNumber(totals.responses)} description="All questionnaires" icon={BarChart3} tone="orange" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Response Rate" value={formatPercent(totals.responseRate)} description={selectedQuestionnaire ? 'Selected questionnaire' : 'Select to inspect'} icon={FileText} tone="slate" />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard compact>
        <View style={styles.toolbarTop}>
          <View style={styles.toolbarCopy}>
            <MobileText variant="body" weight="bold">
              Questionnaire List
            </MobileText>
            <MobileText variant="small" tone="secondary">
              {formatNumber(filteredQuestionnaires.length)} of {formatNumber(questionnaires.length)} records shown.
            </MobileText>
          </View>
          <MobileStatusBadge label={totals.published > 0 ? 'Live feedback' : 'Drafting'} tone={totals.published > 0 ? 'success' : 'info'} />
        </View>
        <View style={styles.actions}>
          <MobileButton label="New" icon={Plus} onPress={() => openBuilder()} size="sm" />
        </View>
      </MobileCard>

      <MobileSearchToolbar value={searchTerm} onChange={setSearchTerm} placeholder="Search title, status, link..." onFilterPress={() => setSortOpen(true)} filterLabel="Sort" />
      <MobileStatusTabs tabs={statusTabs} value={statusFilter} onChange={(value) => setStatusFilter(value as StatusFilter)} />

      {questionnaireItems.length === 0 ? (
        <MobileEmptyState
          title={questionnaires.length === 0 ? 'No questionnaires yet' : 'No matching questionnaires'}
          description={questionnaires.length === 0 ? 'Create the first questionnaire to collect structured member feedback.' : 'Adjust search, status, or sort to find the questionnaire you need.'}
          actionLabel={questionnaires.length === 0 ? 'New Questionnaire' : 'Reset Filters'}
          onAction={questionnaires.length === 0 ? () => openBuilder() : () => {
            setSearchTerm('');
            setStatusFilter('ALL');
          }}
        />
      ) : (
        <MobileDataList items={questionnaireItems} onPressItem={(item) => void openQuestionnaire(questionnaires.find((questionnaire) => questionnaire.id === item.id) || filteredQuestionnaires[0])} />
      )}

      <MobileSortSheet
        visible={sortOpen}
        value={sortValue}
        options={sortOptions}
        onChange={(value) => setSortValue(value as SortOption)}
        onClose={() => setSortOpen(false)}
      />

      <QuestionnaireBuilderSheet
        visible={builderOpen}
        form={form}
        packages={packages}
        editing={Boolean(editingId)}
        saving={saving}
        onClose={() => {
          if (!saving) setBuilderOpen(false);
        }}
        onChange={setForm}
        onUpdateQuestion={updateQuestion}
        onAddQuestion={addQuestion}
        onRemoveQuestion={removeQuestion}
        onTogglePackage={togglePackage}
        onSaveDraft={() => void saveQuestionnaire('DRAFT')}
        onPublish={() => void saveQuestionnaire('PUBLISHED')}
      />

      <QuestionnaireDetailSheet
        questionnaire={selectedQuestionnaire}
        analytics={analytics}
        responses={responses}
        loading={analyticsLoading}
        exporting={exporting}
        onClose={() => setSelectedQuestionnaire(null)}
        onEdit={(questionnaire) => openBuilder(questionnaire)}
        onShare={shareLink}
        onOpenLink={openLink}
        onExport={exportSelected}
        onAction={(action, questionnaire) => setPendingAction({ action, questionnaire })}
      />

      <MobileConfirmSheet
        visible={Boolean(pendingAction)}
        title={pendingAction ? pendingTitle(pendingAction.action) : 'Confirm action'}
        description={pendingAction ? pendingDescription(pendingAction.action, pendingAction.questionnaire) : 'Continue?'}
        confirmLabel={pendingAction ? pendingConfirmLabel(pendingAction.action) : 'Confirm'}
        destructive={pendingAction?.action === 'delete' || pendingAction?.action === 'close'}
        onCancel={() => setPendingAction(null)}
        onConfirm={runPendingAction}
      />
    </MobileScreen>
  );
}

type BuilderProps = {
  visible: boolean;
  form: VoiceForm;
  packages: MemberVoicePackage[];
  editing: boolean;
  saving: boolean;
  onClose: () => void;
  onChange: (form: VoiceForm | ((current: VoiceForm) => VoiceForm)) => void;
  onUpdateQuestion: (index: number, patch: Partial<VoiceQuestionForm>) => void;
  onAddQuestion: () => void;
  onRemoveQuestion: (index: number) => void;
  onTogglePackage: (packageId: string, checked: boolean) => void;
  onSaveDraft: () => void;
  onPublish: () => void;
};

function QuestionnaireBuilderSheet({
  visible,
  form,
  packages,
  editing,
  saving,
  onClose,
  onChange,
  onUpdateQuestion,
  onAddQuestion,
  onRemoveQuestion,
  onTogglePackage,
  onSaveDraft,
  onPublish,
}: BuilderProps) {
  return (
    <MobileSheet
      visible={visible}
      title={editing ? 'Edit Questionnaire' : 'New Questionnaire'}
      description="Define audience, close window, and questions members will answer."
      onClose={onClose}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScroll}>
        <MobileTextInput label="Title" value={form.title} onChangeText={(value) => onChange((current) => ({ ...current, title: value }))} placeholder="Member satisfaction survey" disabled={saving} />
        <MobileTextInput label="Description" value={form.description} onChangeText={(value) => onChange((current) => ({ ...current, description: value }))} placeholder="Explain what members are being asked to respond to" disabled={saving} />
        <MobileTextInput label="Close date" value={form.closesAt} onChangeText={(value) => onChange((current) => ({ ...current, closesAt: value }))} placeholder="YYYY-MM-DDTHH:mm" helperText="Optional. Example: 2026-12-31T17:00" disabled={saving} />
        <MobileSelect
          label="Target audience"
          value={form.targetAudience}
          options={audienceOptions}
          onChange={(value) =>
            onChange((current) => ({
              ...current,
              targetAudience: value as MemberVoiceTargetAudience,
              targetPackageIds: value === 'ALL_MEMBERS' ? [] : current.targetPackageIds,
            }))
          }
        />

        {form.targetAudience === 'SPECIFIC_PACKAGES' ? (
          <MobileCard compact>
            <View style={styles.sectionHeader}>
              <MobileText variant="body" weight="bold">
                Target Packages
              </MobileText>
              <MobileStatusBadge label={`${formatNumber(form.targetPackageIds.length)} selected`} tone={form.targetPackageIds.length > 0 ? 'success' : 'warning'} />
            </View>
            {packages.length === 0 ? (
              <MobileEmptyState title="No packages available" description="Package targeting is unavailable for this association type or setup." />
            ) : (
              <View style={styles.packageList}>
                {packages.map((pkg) => (
                  <MobileCheckboxRow
                    key={pkg.id}
                    label={pkg.name || 'Membership package'}
                    description={pkg.description || (pkg.active === false ? 'Inactive package' : 'Target this package')}
                    checked={form.targetPackageIds.includes(pkg.id)}
                    onChange={(checked) => onTogglePackage(pkg.id, checked)}
                    disabled={saving}
                  />
                ))}
              </View>
            )}
          </MobileCard>
        ) : null}

        <View style={styles.sectionHeader}>
          <View style={styles.toolbarCopy}>
            <MobileText variant="body" weight="bold">
              Questions
            </MobileText>
            <MobileText variant="small" tone="secondary">
              {formatNumber(form.questions.length)} question{form.questions.length === 1 ? '' : 's'} configured.
            </MobileText>
          </View>
          <MobileButton label="Add" icon={Plus} onPress={onAddQuestion} size="sm" variant="secondary" disabled={saving} />
        </View>

        {form.questions.map((question, index) => (
          <MobileCard compact key={`question-${index}`} accent={questionAccent(question.questionType)}>
            <View style={styles.questionHeader}>
              <MobileText variant="body" weight="bold">
                Question {index + 1}
              </MobileText>
              <MobileIconButton icon={XCircle} label="Remove question" variant="secondary" onPress={() => onRemoveQuestion(index)} disabled={saving || form.questions.length === 1} />
            </View>
            <MobileTextInput label="Question text" value={question.questionText} onChangeText={(value) => onUpdateQuestion(index, { questionText: value })} placeholder="Ask a clear question" disabled={saving} />
            <MobileSelect label="Answer type" value={question.questionType} options={questionTypeOptions} onChange={(value) => onUpdateQuestion(index, { questionType: value as MemberVoiceQuestionType })} />
            <MobileCheckboxRow label="Required question" checked={question.required} onChange={(checked) => onUpdateQuestion(index, { required: checked })} disabled={saving} />
            {question.questionType === 'MULTIPLE_CHOICE' ? (
              <View style={styles.optionList}>
                {question.options.map((option, optionIndex) => (
                  <MobileTextInput
                    key={`option-${optionIndex}`}
                    label={`Option ${optionIndex + 1}`}
                    value={option}
                    onChangeText={(value) => {
                      const nextOptions = [...question.options];
                      nextOptions[optionIndex] = value;
                      onUpdateQuestion(index, { options: nextOptions });
                    }}
                    placeholder={`Option ${optionIndex + 1}`}
                    disabled={saving}
                  />
                ))}
                <MobileButton label="Add Option" icon={Plus} variant="secondary" size="sm" onPress={() => onUpdateQuestion(index, { options: [...question.options, ''] })} disabled={saving} />
              </View>
            ) : null}
            {question.questionType === 'RATING_SCALE' ? (
              <View style={styles.ratingRow}>
                <View style={styles.ratingField}>
                  <MobileTextInput label="Minimum" value={question.minRating} onChangeText={(value) => onUpdateQuestion(index, { minRating: value })} keyboardType="number-pad" disabled={saving} />
                </View>
                <View style={styles.ratingField}>
                  <MobileTextInput label="Maximum" value={question.maxRating} onChangeText={(value) => onUpdateQuestion(index, { maxRating: value })} keyboardType="number-pad" disabled={saving} />
                </View>
              </View>
            ) : null}
          </MobileCard>
        ))}

        <View style={styles.formActions}>
          <MobileButton label="Save Draft" variant="secondary" icon={Edit3} loading={saving} disabled={saving} onPress={onSaveDraft} />
          <MobileButton label="Publish" icon={Send} loading={saving} disabled={saving} onPress={onPublish} fullWidth style={styles.flexAction} />
        </View>
      </ScrollView>
    </MobileSheet>
  );
}

type DetailProps = {
  questionnaire: MemberVoiceQuestionnaire | null;
  analytics: MemberVoiceAnalytics | null;
  responses: MemberVoiceSubmission[];
  loading: boolean;
  exporting: string | null;
  onClose: () => void;
  onEdit: (questionnaire: MemberVoiceQuestionnaire) => void;
  onShare: (questionnaire: MemberVoiceQuestionnaire) => Promise<void>;
  onOpenLink: (questionnaire: MemberVoiceQuestionnaire) => Promise<void>;
  onExport: (format: 'xlsx' | 'pdf') => Promise<void>;
  onAction: (action: PendingAction, questionnaire: MemberVoiceQuestionnaire) => void;
};

function QuestionnaireDetailSheet({
  questionnaire,
  analytics,
  responses,
  loading,
  exporting,
  onClose,
  onEdit,
  onShare,
  onOpenLink,
  onExport,
  onAction,
}: DetailProps) {
  if (!questionnaire) return null;
  const responseRate = Number(analytics?.responseRate || 0);
  const questionSummaries = analytics?.questionSummaries || [];

  return (
    <MobileSheet visible={Boolean(questionnaire)} title="Questionnaire Details" description="Review publication, links, analytics, and response activity." onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailContent}>
        <MobileCard compact accent={statusCardAccent(questionnaire.status)}>
          <View style={styles.detailTitleRow}>
            <View style={styles.detailTitleCopy}>
              <MobileText variant="section" weight="bold">
                {questionnaire.title}
              </MobileText>
              {questionnaire.description ? (
                <MobileText variant="small" tone="secondary">
                  {questionnaire.description}
                </MobileText>
              ) : null}
            </View>
            <MobileStatusBadge label={statusLabel(questionnaire.status)} tone={statusTone(questionnaire.status)} />
          </View>
        </MobileCard>

        <View style={styles.actions}>
          <MobileButton label="Edit" icon={Edit3} onPress={() => onEdit(questionnaire)} size="sm" />
          {questionnaire.status === 'DRAFT' ? (
            <MobileButton label="Publish" icon={Send} onPress={() => onAction('publish', questionnaire)} size="sm" />
          ) : null}
          {questionnaire.status === 'PUBLISHED' ? (
            <MobileButton label="Notify" icon={Send} variant="secondary" onPress={() => onAction('notify', questionnaire)} size="sm" />
          ) : null}
          {questionnaire.status !== 'CLOSED' ? (
            <MobileButton label="Close" icon={CheckCircle2} variant="secondary" onPress={() => onAction('close', questionnaire)} size="sm" />
          ) : null}
          {questionnaire.shareableLink ? (
            <>
              <MobileButton label="Share Link" icon={Copy} onPress={() => void onShare(questionnaire)} size="sm" />
              <MobileButton label="Open Link" icon={ExternalLink} variant="secondary" onPress={() => void onOpenLink(questionnaire)} size="sm" />
            </>
          ) : null}
          <MobileButton label="Excel" icon={Download} variant="secondary" loading={exporting === 'xlsx'} onPress={() => void onExport('xlsx')} size="sm" />
          <MobileButton label="PDF" icon={Download} variant="secondary" loading={exporting === 'pdf'} onPress={() => void onExport('pdf')} size="sm" />
          <MobileButton label="Delete" icon={Trash2} variant="danger" onPress={() => onAction('delete', questionnaire)} size="sm" />
        </View>

        <MobileCard compact>
          <MobileInfoRow label="Target" value={targetAudienceLabel(questionnaire.targetAudience)} helper={`${formatNumber(Number(questionnaire.targetMemberCount || analytics?.targetMemberCount || 0))} targeted members`} icon={Users} />
          <MobileInfoRow label="Questions" value={formatNumber((questionnaire.questions || []).length)} helper="Configured member questions." icon={MessageSquare} />
          <MobileInfoRow label="Responses" value={formatNumber(Number(analytics?.responseCount || questionnaire.responseCount || 0))} helper={`Response rate ${formatPercent(responseRate)}.`} icon={BarChart3} />
          <MobileInfoRow label="Close date" value={formatDate(questionnaire.closesAt)} helper={questionnaire.closedAt ? `Closed ${formatDate(questionnaire.closedAt)}` : 'Optional submission deadline.'} icon={FileText} />
          {questionnaire.shareableLink ? (
            <MobileInfoRow label="Public link" value={questionnaire.shareableLink} helper="Share this link with eligible members." icon={ExternalLink} />
          ) : null}
        </MobileCard>

        {loading ? (
          <MobileCard compact>
            <MobileText variant="body" weight="bold">
              Loading analytics...
            </MobileText>
          </MobileCard>
        ) : (
          <>
            <MobileCard compact accent={responseRate > 0 ? 'green' : 'slate'}>
              <View style={styles.sectionHeader}>
                <View style={styles.toolbarCopy}>
                  <MobileText variant="body" weight="bold">
                    Response Rate
                  </MobileText>
                  <MobileText variant="small" tone="secondary">
                    {formatNumber(Number(analytics?.responseCount || 0))} of {formatNumber(Number(analytics?.targetMemberCount || 0))} targeted members responded.
                  </MobileText>
                </View>
                <MobileStatusBadge label={formatPercent(responseRate)} tone={responseRate > 0 ? 'success' : 'neutral'} />
              </View>
              <MobileProgressBar value={responseRate} tone={responseRate > 0 ? 'green' : 'slate'} />
            </MobileCard>

            {questionSummaries.length === 0 ? (
              <MobileEmptyState title="No analytics yet" description="Question analytics will appear after members submit responses." />
            ) : (
              questionSummaries.slice(0, 4).map((question) => <QuestionAnalyticsCard key={question.questionId} question={question} />)
            )}

            <MobileCard compact>
              <View style={styles.sectionHeader}>
                <MobileText variant="body" weight="bold">
                  Recent Responses
                </MobileText>
                <MobileStatusBadge label={`${formatNumber(responses.length)} loaded`} tone="primary" />
              </View>
              {responses.length === 0 ? (
                <MobileEmptyState title="No responses yet" description="Submissions will appear here as members answer the questionnaire." />
              ) : (
                <View style={styles.responseList}>
                  {responses.slice(0, 4).map((response) => (
                    <MobileInfoRow
                      key={response.id}
                      label={response.memberName || response.respondentName || 'Respondent'}
                      value={formatDate(response.submittedAt)}
                      helper={`${response.membershipNumber || response.respondentEmail || response.respondentPhone || 'No contact'} · ${formatNumber((response.answers || []).length)} answers`}
                      icon={MessageSquare}
                    />
                  ))}
                </View>
              )}
            </MobileCard>
          </>
        )}
      </ScrollView>
    </MobileSheet>
  );
}

function QuestionAnalyticsCard({ question }: { question: NonNullable<MemberVoiceAnalytics['questionSummaries']>[number] }) {
  const counts = question.questionType === 'YES_NO' ? question.yesNoCounts || {} : question.optionCounts || {};
  const maxCount = Math.max(1, ...Object.values(counts).map(Number));
  const hasCounts = Object.keys(counts).length > 0;

  return (
    <MobileCard compact accent={questionAccent(question.questionType as MemberVoiceQuestionType)}>
      <View style={styles.sectionHeader}>
        <View style={styles.toolbarCopy}>
          <MobileText variant="body" weight="bold">
            {question.questionText}
          </MobileText>
          <MobileText variant="small" tone="secondary">
            {questionTypeLabel(question.questionType)} · {formatNumber(Number(question.responseCount || 0))} answers
          </MobileText>
        </View>
        {typeof question.averageRating === 'number' ? <MobileStatusBadge label={`Avg ${question.averageRating.toFixed(1)}`} tone="primary" /> : null}
      </View>
      {question.questionType === 'OPEN_TEXT' ? (
        <View style={styles.responseList}>
          {(question.textResponses || []).slice(0, 3).map((text, index) => (
            <MobileCard key={`${text}-${index}`} compact>
              <MobileText variant="small" tone="secondary">
                {text}
              </MobileText>
            </MobileCard>
          ))}
          {(question.textResponses || []).length === 0 ? (
            <MobileText variant="small" tone="secondary">
              No text responses yet.
            </MobileText>
          ) : null}
        </View>
      ) : question.questionType === 'RATING_SCALE' ? (
        <MobileProgressBar value={Math.min(((Number(question.averageRating || 0) / 5) * 100), 100)} tone="blue" />
      ) : hasCounts ? (
        <View style={styles.responseList}>
          {Object.entries(counts).map(([label, count]) => (
            <MobileProgressBar key={label} value={(Number(count) / maxCount) * 100} label={`${label} (${formatNumber(Number(count))})`} tone="blue" />
          ))}
        </View>
      ) : (
        <MobileText variant="small" tone="secondary">
          No distribution yet.
        </MobileText>
      )}
    </MobileCard>
  );
}

function formFromQuestionnaire(questionnaire: MemberVoiceQuestionnaire): VoiceForm {
  return {
    title: questionnaire.title || '',
    description: questionnaire.description || '',
    targetAudience: (questionnaire.targetAudience as MemberVoiceTargetAudience) || 'ALL_MEMBERS',
    targetPackageIds: questionnaire.targetPackageIds || [],
    closesAt: toInputDateTime(questionnaire.closesAt),
    questions: questionnaire.questions?.length ? questionnaire.questions.map(questionFromApi) : [emptyQuestion()],
  };
}

function questionFromApi(question: MemberVoiceQuestion): VoiceQuestionForm {
  return {
    questionText: question.questionText || '',
    questionType: question.questionType || 'OPEN_TEXT',
    required: question.required !== false,
    options: question.options?.length ? question.options : ['', ''],
    minRating: String(question.minRating || 1),
    maxRating: String(question.maxRating || 5),
  };
}

function sortQuestionnaires(questionnaires: MemberVoiceQuestionnaire[], sortValue: SortOption) {
  const rows = [...questionnaires];
  if (sortValue === 'titleAsc') return rows.sort((left, right) => left.title.localeCompare(right.title));
  if (sortValue === 'responsesDesc') return rows.sort((left, right) => Number(right.responseCount || 0) - Number(left.responseCount || 0));
  if (sortValue === 'questionsDesc') return rows.sort((left, right) => (right.questions?.length || 0) - (left.questions?.length || 0));
  if (sortValue === 'targetDesc') return rows.sort((left, right) => Number(right.targetMemberCount || 0) - Number(left.targetMemberCount || 0));
  return rows.sort((left, right) => dateTime(right.updatedAt || right.createdAt) - dateTime(left.updatedAt || left.createdAt));
}

function dateTime(value?: string | null) {
  return new Date(value || '').getTime() || 0;
}

function toRequestDate(value: string) {
  if (!value.trim()) return null;
  return value.length === 16 ? `${value}:00` : value;
}

function toInputDateTime(value?: string | null) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const local = new Date(parsed);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 16);
}

function normalizeParamFlag(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'true' || raw === '1' || raw === 'yes';
}

function statusLabel(status?: string | null) {
  return String(status || 'DRAFT')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(status?: string | null): StatusTone {
  if (status === 'PUBLISHED') return 'success';
  if (status === 'CLOSED') return 'neutral';
  return 'info';
}

function statusAccent(status?: string | null): StatusTone {
  if (status === 'PUBLISHED') return 'success';
  if (status === 'CLOSED') return 'neutral';
  return 'info';
}

function statusCardAccent(status?: string | null): KpiTone {
  if (status === 'PUBLISHED') return 'green';
  if (status === 'CLOSED') return 'slate';
  return 'blue';
}

function statusInitials(status?: string | null) {
  if (status === 'PUBLISHED') return 'PB';
  if (status === 'CLOSED') return 'CL';
  return 'DR';
}

function targetAudienceLabel(value?: string | null) {
  return value === 'SPECIFIC_PACKAGES' ? 'Specific packages' : 'All members';
}

function questionTypeLabel(value?: string | null) {
  return String(value || 'OPEN_TEXT')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function questionAccent(value?: MemberVoiceQuestionType | string | null): KpiTone {
  if (value === 'MULTIPLE_CHOICE') return 'purple';
  if (value === 'RATING_SCALE') return 'orange';
  if (value === 'YES_NO') return 'green';
  return 'blue';
}

function formatQuestionCount(questions?: MemberVoiceQuestion[] | null) {
  const count = questions?.length || 0;
  return `${formatNumber(count)} question${count === 1 ? '' : 's'}`;
}

function pendingTitle(action: PendingAction) {
  if (action === 'publish') return 'Publish questionnaire?';
  if (action === 'close') return 'Close questionnaire?';
  if (action === 'notify') return 'Notify members?';
  return 'Delete questionnaire?';
}

function pendingDescription(action: PendingAction, questionnaire: MemberVoiceQuestionnaire) {
  if (action === 'publish') return `Publish "${questionnaire.title}" and queue member notifications?`;
  if (action === 'close') return `Close "${questionnaire.title}" so members can no longer submit responses?`;
  if (action === 'notify') return `Queue notifications for "${questionnaire.title}"?`;
  return `Delete "${questionnaire.title}"? This action cannot be undone.`;
}

function pendingConfirmLabel(action: PendingAction) {
  if (action === 'publish') return 'Publish';
  if (action === 'close') return 'Close';
  if (action === 'notify') return 'Notify';
  return 'Delete';
}

function safeFileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'questionnaire';
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  if (typeof globalThis.btoa !== 'function') {
    throw new Error('This device cannot encode the downloaded export.');
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  packageList: {
    gap: 10,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  optionList: {
    gap: 10,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 10,
  },
  ratingField: {
    flex: 1,
  },
  detailContent: {
    gap: 12,
    paddingBottom: 10,
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
  responseList: {
    gap: 10,
  },
});
