import { router, useLocalSearchParams } from 'expo-router';
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CheckCircle2,
  Link as LinkIcon,
  Plus,
  RadioTower,
  RefreshCw,
  Save,
  Send,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';

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
  closeGovernancePoll,
  createGovernancePoll,
  deleteGovernancePoll,
  getGovernancePollPackages,
  getGovernancePolls,
  notifyGovernancePoll,
  publishGovernancePoll,
  updateGovernancePoll,
  type GovernancePackageOption,
  type GovernancePoll,
  type GovernancePollAudience,
  type GovernancePollBallotType,
  type GovernancePollPayload,
  type GovernancePollStatus,
} from '@/services/governance-service';
import { type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber, formatPercent } from '@/utils/format';

type StatusFilter = 'all' | 'DRAFT' | 'SCHEDULED' | 'OPEN' | 'CLOSED';
type SortOption = 'createdDesc' | 'titleAsc' | 'turnoutDesc' | 'eligibleDesc' | 'votedDesc';
type PollAction = 'publish' | 'notify' | 'close' | 'delete';

type PollForm = {
  title: string;
  question: string;
  ballotType: GovernancePollBallotType;
  options: string[];
  targetAudience: GovernancePollAudience;
  targetPackageIds: string[];
  startsAt: string;
  endsAt: string;
};

const emptyForm: PollForm = {
  title: '',
  question: '',
  ballotType: 'YES_NO',
  options: ['Approve', 'Reject'],
  targetAudience: 'ALL_MEMBERS',
  targetPackageIds: [],
  startsAt: '',
  endsAt: '',
};

const ballotOptions = [
  { value: 'YES_NO', label: 'Yes / No resolution' },
  { value: 'SINGLE_CHOICE', label: 'Single choice' },
];

const audienceOptions = [
  { value: 'ALL_MEMBERS', label: 'All active members' },
  { value: 'PACKAGE_MEMBERS', label: 'Membership packages' },
];

const sortOptions = [
  { value: 'createdDesc', label: 'Newest created' },
  { value: 'titleAsc', label: 'Vote title' },
  { value: 'turnoutDesc', label: 'Highest turnout' },
  { value: 'eligibleDesc', label: 'Most eligible voters' },
  { value: 'votedDesc', label: 'Most votes cast' },
];

export default function MobileGovernanceElectionsScreen() {
  const params = useLocalSearchParams();
  const { activeView, associationId, user } = useAuth();
  const [polls, setPolls] = useState<GovernancePoll[]>([]);
  const [packages, setPackages] = useState<GovernancePackageOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mutatingAction, setMutatingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortValue, setSortValue] = useState<SortOption>('createdDesc');
  const [filterOpen, setFilterOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedPoll, setSelectedPoll] = useState<GovernancePoll | null>(null);
  const [pendingAction, setPendingAction] = useState<{ poll: GovernancePoll; action: PollAction } | null>(null);
  const [form, setForm] = useState<PollForm>(emptyForm);
  const [editingPollId, setEditingPollId] = useState<string | null>(null);
  const [openedPollId, setOpenedPollId] = useState<string | null>(null);
  const [openedCreateParam, setOpenedCreateParam] = useState(false);

  const initialPollId = Array.isArray(params.pollId) ? params.pollId[0] : params.pollId;
  const shouldOpenCreate = normalizeParamFlag(params.createVote);

  const loadPolls = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before loading governance votes.');
        return;
      }
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);
      setNotice(null);

      try {
        const [pollRows, packageRows] = await Promise.all([
          getGovernancePolls(associationId),
          getGovernancePollPackages(associationId).catch(() => []),
        ]);
        setPolls(pollRows);
        setPackages(packageRows);
      } catch (loadError) {
        setPolls([]);
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
      if (active) void loadPolls();
    });
    return () => {
      active = false;
    };
  }, [loadPolls]);

  useEffect(() => {
    if (!initialPollId || openedPollId === initialPollId || polls.length === 0) return;
    const poll = polls.find((row) => row.id === initialPollId);
    if (poll) {
      void Promise.resolve().then(() => {
        setSelectedPoll(poll);
        setOpenedPollId(initialPollId);
      });
    }
  }, [initialPollId, openedPollId, polls]);

  useEffect(() => {
    if (!shouldOpenCreate || openedCreateParam) return;
    void Promise.resolve().then(() => {
      setForm(emptyForm);
      setEditingPollId(null);
      setFormOpen(true);
      setOpenedCreateParam(true);
    });
  }, [openedCreateParam, shouldOpenCreate]);

  const totals = useMemo(() => {
    const open = polls.filter((poll) => poll.status === 'OPEN').length;
    const eligible = polls.reduce((sum, poll) => sum + Number(poll.eligibleCount || 0), 0);
    const voted = polls.reduce((sum, poll) => sum + Number(poll.votedCount || 0), 0);
    const pending = polls.reduce((sum, poll) => sum + Number(poll.pendingCount || 0), 0);
    return {
      open,
      eligible,
      voted,
      pending,
      turnout: eligible > 0 ? (voted * 100) / eligible : 0,
    };
  }, [polls]);

  const statusCounts = useMemo(() => ({
    DRAFT: polls.filter((poll) => poll.status === 'DRAFT').length,
    SCHEDULED: polls.filter((poll) => poll.status === 'SCHEDULED').length,
    OPEN: polls.filter((poll) => poll.status === 'OPEN').length,
    CLOSED: polls.filter((poll) => poll.status === 'CLOSED').length,
  }), [polls]);

  const statusTabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: polls.length },
      { value: 'DRAFT', label: 'Draft', count: statusCounts.DRAFT },
      { value: 'SCHEDULED', label: 'Scheduled', count: statusCounts.SCHEDULED },
      { value: 'OPEN', label: 'Open', count: statusCounts.OPEN },
      { value: 'CLOSED', label: 'Closed', count: statusCounts.CLOSED },
    ],
    [polls.length, statusCounts],
  );

  const filteredPolls = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const rows = polls.filter((poll) => {
      const matchesStatus = statusFilter === 'all' || poll.status === statusFilter;
      const haystack = [poll.title, poll.question, poll.status, poll.eligibleVoters]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return matchesStatus && (!query || haystack.includes(query));
    });
    return sortPolls(rows, sortValue);
  }, [polls, searchTerm, sortValue, statusFilter]);

  const pollItems = useMemo<MobileDataListItem[]>(
    () => filteredPolls.map((poll) => ({
      id: poll.id,
      title: poll.title,
      subtitle: poll.question,
      meta: `${formatAudience(poll.targetAudience)} · ${formatNumber(Number(poll.votedCount || 0))}/${formatNumber(Number(poll.eligibleCount || 0))} voted`,
      amount: formatPercent(Number(poll.participationRate || 0)),
      status: formatStatus(poll.status),
      statusTone: pollStatusTone(poll.status),
      initials: 'VT',
      accent: pollStatusTone(poll.status),
    })),
    [filteredPolls],
  );

  const voteReportOptions = useMemo(
    () => ({
      title: 'Governance Vote Register',
      associationName: user?.associationName || 'Association',
      purpose: 'A current-view report of governance votes, eligibility, responses, turnout, scheduling, and status.',
      rows: filteredPolls,
      fileName: 'nane-governance-votes',
      metrics: [
        { label: 'Open votes', value: formatNumber(totals.open), helper: 'Accepting responses' },
        { label: 'Eligible', value: formatNumber(totals.eligible), helper: 'Voting roll' },
        { label: 'Voted', value: formatNumber(totals.voted), helper: 'Responses received' },
        { label: 'Turnout', value: formatPercent(totals.turnout), helper: `${formatNumber(totals.pending)} pending` },
      ],
      filters: [
        { label: 'Search', value: searchTerm || 'All' },
        { label: 'Status', value: statusTabs.find((tab) => tab.value === statusFilter)?.label || statusFilter },
        { label: 'Sort', value: sortOptions.find((option) => option.value === sortValue)?.label || sortValue },
      ],
      columns: [
        { key: 'title', label: 'Vote', width: '18%', value: (row: GovernancePoll) => row.title || '-' },
        { key: 'status', label: 'Status', width: '10%', value: (row: GovernancePoll) => formatStatus(row.status) },
        { key: 'ballot', label: 'Ballot', width: '13%', value: (row: GovernancePoll) => formatBallotType(row.ballotType) },
        { key: 'audience', label: 'Audience', width: '15%', value: (row: GovernancePoll) => row.eligibleVoters || formatAudience(row.targetAudience) },
        { key: 'eligible', label: 'Eligible', align: 'right' as const, width: '10%', value: (row: GovernancePoll) => formatNumber(Number(row.eligibleCount || 0)) },
        { key: 'voted', label: 'Voted', align: 'right' as const, width: '10%', value: (row: GovernancePoll) => formatNumber(Number(row.votedCount || 0)) },
        { key: 'pending', label: 'Pending', align: 'right' as const, width: '10%', value: (row: GovernancePoll) => formatNumber(Number(row.pendingCount || 0)) },
        { key: 'turnout', label: 'Turnout', align: 'right' as const, width: '10%', value: (row: GovernancePoll) => formatPercent(Number(row.participationRate || 0)) },
        { key: 'starts', label: 'Starts', width: '11%', value: (row: GovernancePoll) => formatDate(row.startsAt) },
        { key: 'closes', label: 'Closes', width: '11%', value: (row: GovernancePoll) => formatDate(row.endsAt) },
      ],
    }),
    [filteredPolls, searchTerm, sortValue, statusFilter, statusTabs, totals, user?.associationName],
  );

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Association admin only" description="Governance voting is available from the association admin workspace." />;
  }

  if (loading) {
    return <MobilePageLoadingState kind="list" message="Loading governance votes" />;
  }

  const refresh = () => {
    void loadPolls('refresh');
  };

  const openNewVote = () => {
    setForm(emptyForm);
    setEditingPollId(null);
    setFormOpen(true);
  };

  const openEditVote = (poll: GovernancePoll) => {
    setForm(pollToForm(poll));
    setEditingPollId(poll.id);
    setFormOpen(true);
  };

  const validateForm = () => {
    setError(null);
    if (!form.title.trim() || !form.question.trim()) {
      setError('Add a vote title and question before saving.');
      return false;
    }
    if (form.ballotType === 'SINGLE_CHOICE' && normalizeOptions(form).length < 2) {
      setError('Choice votes need at least two options.');
      return false;
    }
    if (form.targetAudience === 'PACKAGE_MEMBERS' && form.targetPackageIds.length === 0) {
      setError('Select at least one package for the voting roll.');
      return false;
    }
    return true;
  };

  const saveDraft = async () => {
    if (!associationId || !validateForm()) return;
    setSaving(true);
    setNotice(null);
    try {
      const payload = buildPollPayload(form, 'DRAFT');
      const saved = editingPollId
        ? await updateGovernancePoll(associationId, editingPollId, payload)
        : await createGovernancePoll(associationId, payload);
      setFormOpen(false);
      setEditingPollId(null);
      setNotice('Vote draft saved.');
      await loadPolls('refresh');
      const refreshed = await getGovernancePolls(associationId);
      setPolls(refreshed);
      setSelectedPoll(refreshed.find((poll) => poll.id === saved.id) || saved);
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const runConfirmedAction = async () => {
    if (!associationId || !pendingAction) return;
    const { poll, action } = pendingAction;
    setMutatingAction(`${poll.id}:${action}`);
    setNotice(null);
    setError(null);

    try {
      if (action === 'publish') await publishGovernancePoll(associationId, poll.id);
      if (action === 'notify') await notifyGovernancePoll(associationId, poll.id);
      if (action === 'close') await closeGovernancePoll(associationId, poll.id);
      if (action === 'delete') await deleteGovernancePoll(associationId, poll.id);
      setNotice(actionNotice(action));
      setPendingAction(null);
      setSelectedPoll(null);
      await loadPolls('refresh');
    } catch (actionError) {
      setError(getApiErrorMessage(actionError));
    } finally {
      setMutatingAction(null);
    }
  };

  const shareLink = async (poll: GovernancePoll) => {
    if (!poll.shareableLink) {
      setError('Publish the vote before sharing the voting link.');
      return;
    }
    await Share.share({
      title: poll.title,
      message: `${poll.title}\n${poll.shareableLink}`,
    });
  };

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setSortValue('createdDesc');
  };

  return (
    <MobileScreen>
      <MobilePageHeader
        title="Elections & Voting"
        eyebrow="Governance"
        subtitle="Create governed votes and track turnout."
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh" onPress={refresh} disabled={refreshing} />}
      />

      {notice ? <MobileToast title="Voting" description={notice} tone="info" /> : null}
      {error ? <MobileErrorState title="Voting issue" description={error} retryLabel="Dismiss" onRetry={() => setError(null)} /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Open Votes" value={formatNumber(totals.open)} description="Accepting responses" tone="blue" icon={RadioTower} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Eligible" value={formatNumber(totals.eligible)} description="Voting roll" tone="green" icon={Users} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Voted" value={formatNumber(totals.voted)} description="Responses received" tone="teal" icon={CheckCircle2} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Pending" value={formatNumber(totals.pending)} description={`${formatPercent(totals.turnout)} turnout`} tone="orange" icon={Bell} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard compact>
        <View style={styles.toolbarTop}>
          <View style={styles.toolbarCopy}>
            <MobileText variant="body" weight="bold">
              Vote Register
            </MobileText>
            <MobileText variant="small" tone="secondary">
              {formatNumber(filteredPolls.length)} of {formatNumber(polls.length)} votes shown.
            </MobileText>
          </View>
          <MobileStatusBadge label={`${formatPercent(totals.turnout)} turnout`} tone={totals.turnout > 0 ? 'success' : 'neutral'} />
        </View>
        <View style={styles.actions}>
          <MobileButton label="New Vote" icon={Plus} onPress={openNewVote} size="sm" />
          <MobileReportExportButton options={voteReportOptions} size="sm" onSuccess={(_uri, format) => setNotice(`${format.toUpperCase()} vote register is ready.`)} onError={(exportError) => setError(getApiErrorMessage(exportError))} />
        </View>
      </MobileCard>

      <MobileSearchToolbar value={searchTerm} onChange={setSearchTerm} placeholder="Search vote, question, status..." onFilterPress={() => setFilterOpen(true)} filterLabel="Sort" />
      <MobileStatusTabs tabs={statusTabs} value={statusFilter} onChange={(value) => setStatusFilter(value as StatusFilter)} />

      {pollItems.length === 0 ? (
        <MobileEmptyState
          title={polls.length === 0 ? 'No governance votes' : 'No matching votes'}
          description={polls.length === 0 ? 'Create the first draft vote to begin tracking member decisions.' : 'Adjust search, status, or sort filters.'}
          actionLabel={polls.length === 0 ? 'New Vote' : 'Reset Filters'}
          onAction={polls.length === 0 ? openNewVote : resetFilters}
        />
      ) : (
        <MobileDataList items={pollItems} onPressItem={(item) => setSelectedPoll(polls.find((poll) => poll.id === item.id) || null)} />
      )}

      <MobileSheet visible={filterOpen} title="Sort Votes" description="Choose how the vote register should be ordered." onClose={() => setFilterOpen(false)}>
        <MobileSelect label="Sort by" value={sortValue} options={sortOptions} onChange={(value) => setSortValue(value as SortOption)} />
        <View style={styles.filterActions}>
          <MobileButton label="Reset" variant="secondary" onPress={resetFilters} />
          <MobileButton label="Apply" fullWidth onPress={() => setFilterOpen(false)} style={styles.flexAction} />
        </View>
      </MobileSheet>

      <MobileSheet
        visible={formOpen}
        title={editingPollId ? 'Edit Draft Vote' : 'Create Vote'}
        description="Define the ballot, audience, voting window, and notification-ready content."
        onClose={() => {
          if (!saving) setFormOpen(false);
        }}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScroll}>
          <MobileTextInput label="Title" value={form.title} onChangeText={(value) => setForm((current) => ({ ...current, title: value }))} placeholder="Approve operating budget" disabled={saving} />
          <MobileTextInput label="Question" value={form.question} onChangeText={(value) => setForm((current) => ({ ...current, question: value }))} placeholder="Should the association approve the proposed budget?" disabled={saving} />
          <MobileSelect label="Ballot" value={form.ballotType} options={ballotOptions} onChange={(value) => setForm((current) => ({ ...current, ballotType: value as GovernancePollBallotType }))} />
          {form.ballotType === 'SINGLE_CHOICE' ? (
            <MobileCard compact>
              <MobileText variant="small" weight="bold">Options</MobileText>
              {form.options.map((option, index) => (
                <MobileTextInput
                  key={`${index}`}
                  label={`Option ${index + 1}`}
                  value={option}
                  onChangeText={(value) => setForm((current) => {
                    const next = [...current.options];
                    next[index] = value;
                    return { ...current, options: next };
                  })}
                  placeholder={`Option ${index + 1}`}
                  disabled={saving}
                />
              ))}
              <MobileButton label="Add Option" variant="secondary" icon={Plus} size="sm" onPress={() => setForm((current) => ({ ...current, options: [...current.options, ''] }))} />
            </MobileCard>
          ) : null}
          <MobileSelect label="Audience" value={form.targetAudience} options={audienceOptions} onChange={(value) => setForm((current) => ({ ...current, targetAudience: value as GovernancePollAudience }))} />
          {form.targetAudience === 'PACKAGE_MEMBERS' ? (
            <View style={styles.packageStack}>
              {packages.length === 0 ? (
                <MobileEmptyState title="No packages found" description="Use all active members or create membership packages first." />
              ) : packages.map((pkg) => (
                <MobileCheckboxRow
                  key={pkg.id}
                  label={pkg.name || 'Membership package'}
                  checked={form.targetPackageIds.includes(pkg.id)}
                  onChange={(checked) => setForm((current) => ({
                    ...current,
                    targetPackageIds: checked
                      ? [...current.targetPackageIds, pkg.id]
                      : current.targetPackageIds.filter((id) => id !== pkg.id),
                  }))}
                />
              ))}
            </View>
          ) : null}
          <MobileTextInput label="Starts" value={form.startsAt} onChangeText={(value) => setForm((current) => ({ ...current, startsAt: value }))} placeholder="YYYY-MM-DDTHH:mm" helperText="Optional. Leave blank to open immediately when published." disabled={saving} />
          <MobileTextInput label="Closes" value={form.endsAt} onChangeText={(value) => setForm((current) => ({ ...current, endsAt: value }))} placeholder="YYYY-MM-DDTHH:mm" disabled={saving} />
          <View style={styles.formActions}>
            <MobileButton label="Cancel" variant="secondary" onPress={() => setFormOpen(false)} disabled={saving} />
            <MobileButton label="Save Draft" icon={Save} loading={saving} onPress={saveDraft} fullWidth style={styles.flexAction} />
          </View>
        </ScrollView>
      </MobileSheet>

      <MobileSheet visible={Boolean(selectedPoll)} title="Vote Details" description="Review turnout, result options, delivery, and actions." onClose={() => setSelectedPoll(null)}>
        {selectedPoll ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailContent}>
            <MobileCard compact accent={pollStatusKpiAccent(selectedPoll.status)}>
              <View style={styles.detailTitleRow}>
                <View style={styles.detailTitleCopy}>
                  <MobileText variant="section" weight="bold">
                    {selectedPoll.title}
                  </MobileText>
                  <MobileText variant="small" tone="secondary">
                    {selectedPoll.question}
                  </MobileText>
                </View>
                <MobileStatusBadge label={formatStatus(selectedPoll.status)} tone={pollStatusTone(selectedPoll.status)} />
              </View>
            </MobileCard>

            <View style={styles.actions}>
              {selectedPoll.status === 'DRAFT' ? (
                <>
                  <MobileButton label="Edit" variant="secondary" icon={Save} size="sm" onPress={() => openEditVote(selectedPoll)} />
                  <MobileButton label="Publish" icon={Send} size="sm" loading={mutatingAction === `${selectedPoll.id}:publish`} onPress={() => setPendingAction({ poll: selectedPoll, action: 'publish' })} />
                </>
              ) : null}
              {selectedPoll.status !== 'DRAFT' && selectedPoll.status !== 'CLOSED' ? (
                <>
                  <MobileButton label="Notify" variant="secondary" icon={Bell} size="sm" loading={mutatingAction === `${selectedPoll.id}:notify`} onPress={() => setPendingAction({ poll: selectedPoll, action: 'notify' })} />
                  <MobileButton label="Close" variant="secondary" icon={XCircle} size="sm" loading={mutatingAction === `${selectedPoll.id}:close`} onPress={() => setPendingAction({ poll: selectedPoll, action: 'close' })} />
                </>
              ) : null}
              <MobileButton label="Share Link" variant="secondary" icon={LinkIcon} size="sm" onPress={() => void shareLink(selectedPoll)} />
              <MobileButton label="Delete" variant="danger" icon={Trash2} size="sm" disabled={Boolean(mutatingAction)} onPress={() => setPendingAction({ poll: selectedPoll, action: 'delete' })} />
            </View>

            <MobileCard compact>
              <MobileInfoRow label="Eligible voters" value={formatNumber(Number(selectedPoll.eligibleCount || 0))} helper={selectedPoll.eligibleVoters || formatAudience(selectedPoll.targetAudience)} icon={Users} />
              <MobileInfoRow label="Votes cast" value={formatNumber(Number(selectedPoll.votedCount || 0))} helper={`${formatNumber(Number(selectedPoll.pendingCount || 0))} pending`} icon={CheckCircle2} />
              <MobileInfoRow label="Voting window" value={`${formatDate(selectedPoll.startsAt)} - ${formatDate(selectedPoll.endsAt)}`} helper={formatBallotType(selectedPoll.ballotType)} icon={CalendarClock} />
            </MobileCard>

            <MobileCard compact>
              <MobileText variant="body" weight="bold">Results</MobileText>
              {(selectedPoll.options || []).map((option) => {
                const count = Number(selectedPoll.resultCounts?.[option] || 0);
                const percent = Number(selectedPoll.totalVotes || 0) > 0 ? (count * 100) / Number(selectedPoll.totalVotes || 0) : 0;
                return (
                  <MobileProgressBar key={option} label={`${option} · ${formatNumber(count)}`} value={Math.round(percent)} tone="blue" />
                );
              })}
              {(selectedPoll.options || []).length === 0 ? <MobileEmptyState title="No result options" description="Results appear when vote options are available." /> : null}
            </MobileCard>

            <MobileCard compact>
              <MobileInfoRow label="Notifications sent" value={formatNumber(Number(selectedPoll.sentCount || 0))} helper={`${formatNumber(Number(selectedPoll.openedCount || 0))} links opened`} icon={Send} />
              <MobileInfoRow label="Failed or no contact" value={formatNumber(Number(selectedPoll.failedCount || 0))} helper="Delivery records needing attention." icon={AlertTriangle} />
            </MobileCard>
          </ScrollView>
        ) : null}
      </MobileSheet>

      <MobileConfirmSheet
        visible={Boolean(pendingAction)}
        title={confirmTitle(pendingAction?.action)}
        description={pendingAction ? confirmDescription(pendingAction.poll, pendingAction.action) : 'Confirm this vote action?'}
        confirmLabel={confirmLabel(pendingAction?.action)}
        destructive={pendingAction?.action === 'delete' || pendingAction?.action === 'close' || pendingAction?.action === 'publish' || pendingAction?.action === 'notify'}
        onCancel={() => setPendingAction(null)}
        onConfirm={runConfirmedAction}
      />
    </MobileScreen>
  );
}

function pollToForm(poll: GovernancePoll): PollForm {
  return {
    title: poll.title,
    question: poll.question,
    ballotType: poll.ballotType === 'SINGLE_CHOICE' ? 'SINGLE_CHOICE' : 'YES_NO',
    options: poll.ballotType === 'SINGLE_CHOICE' && poll.options?.length ? poll.options : ['Approve', 'Reject'],
    targetAudience: poll.targetAudience === 'PACKAGE_MEMBERS' ? 'PACKAGE_MEMBERS' : 'ALL_MEMBERS',
    targetPackageIds: poll.targetPackageIds || [],
    startsAt: toDateTimeInput(poll.startsAt),
    endsAt: toDateTimeInput(poll.endsAt),
  };
}

function buildPollPayload(form: PollForm, status: GovernancePollStatus): GovernancePollPayload {
  return {
    title: form.title.trim(),
    question: form.question.trim(),
    eligibleVoters: form.targetAudience === 'ALL_MEMBERS' ? 'All active members' : 'Selected membership packages',
    ballotType: form.ballotType,
    options: normalizeOptions(form),
    targetAudience: form.targetAudience,
    targetPackageIds: form.targetAudience === 'PACKAGE_MEMBERS' ? form.targetPackageIds : [],
    status,
    startsAt: toApiDateTime(form.startsAt),
    endsAt: toApiDateTime(form.endsAt),
    sendNotifications: false,
  };
}

function normalizeOptions(form: PollForm) {
  if (form.ballotType === 'YES_NO') return ['YES', 'NO'];
  return form.options.map((option) => option.trim()).filter(Boolean);
}

function toDateTimeInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (input: number) => String(input).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toApiDateTime(value: string) {
  if (!value.trim()) return null;
  if (/:\d{2}:\d{2}$/.test(value)) return value;
  return `${value}:00`;
}

function sortPolls(polls: GovernancePoll[], sortValue: SortOption) {
  const rows = [...polls];
  if (sortValue === 'titleAsc') return rows.sort((left, right) => left.title.localeCompare(right.title));
  if (sortValue === 'turnoutDesc') return rows.sort((left, right) => Number(right.participationRate || 0) - Number(left.participationRate || 0));
  if (sortValue === 'eligibleDesc') return rows.sort((left, right) => Number(right.eligibleCount || 0) - Number(left.eligibleCount || 0));
  if (sortValue === 'votedDesc') return rows.sort((left, right) => Number(right.votedCount || 0) - Number(left.votedCount || 0));
  return rows.sort((left, right) => dateTime(right.createdAt) - dateTime(left.createdAt));
}

function dateTime(value?: string | null) {
  return new Date(value || '').getTime() || 0;
}

function formatStatus(status?: string | null) {
  return String(status || 'UNKNOWN')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatBallotType(value?: string | null) {
  return value === 'SINGLE_CHOICE' ? 'Single choice' : 'Yes / No resolution';
}

function formatAudience(value?: string | null) {
  return value === 'PACKAGE_MEMBERS' ? 'Membership packages' : 'All active members';
}

function pollStatusTone(status?: string | null): StatusTone {
  if (status === 'OPEN') return 'success';
  if (status === 'SCHEDULED') return 'warning';
  if (status === 'CLOSED') return 'neutral';
  return 'info';
}

function pollStatusKpiAccent(status?: string | null) {
  if (status === 'OPEN') return 'green';
  if (status === 'SCHEDULED') return 'orange';
  if (status === 'CLOSED') return 'slate';
  return 'blue';
}

function actionNotice(action: PollAction) {
  if (action === 'publish') return 'Vote published and notifications queued.';
  if (action === 'notify') return 'Vote notifications queued.';
  if (action === 'close') return 'Vote closed.';
  return 'Vote deleted.';
}

function confirmTitle(action?: PollAction) {
  if (action === 'publish') return 'Publish vote?';
  if (action === 'notify') return 'Notify voters?';
  if (action === 'close') return 'Close vote?';
  if (action === 'delete') return 'Delete vote?';
  return 'Confirm action?';
}

function confirmLabel(action?: PollAction) {
  if (action === 'publish') return 'Publish';
  if (action === 'notify') return 'Notify';
  if (action === 'close') return 'Close Vote';
  if (action === 'delete') return 'Delete Vote';
  return 'Confirm';
}

function confirmDescription(poll: GovernancePoll, action: PollAction) {
  if (action === 'publish') return `Publish "${poll.title}" and queue voting notifications for eligible members?`;
  if (action === 'notify') return `Queue SMS/email voting notifications for "${poll.title}"?`;
  if (action === 'close') return `Close "${poll.title}" so members can no longer submit responses?`;
  return `Delete "${poll.title}" permanently?`;
}

function normalizeParamFlag(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'true' || raw === '1' || raw === 'yes';
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
  packageStack: {
    gap: 8,
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
});
