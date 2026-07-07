import { router, useLocalSearchParams } from 'expo-router';
import {
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock3,
  RadioTower,
  RefreshCw,
  ShieldCheck,
  Users,
  Vote,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
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
  MobileSheet,
  MobileSortSheet,
  type MobileSortOption,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileSummaryPanel,
  MobileText,
  MobileToast,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  getMemberGovernancePolls,
  submitMemberGovernanceVote,
  type GovernancePoll,
} from '@/services/governance-service';
import { getCurrentMemberByUserId, type AssociationMember } from '@/services/member-service';
import { type KpiTone, type StatusTone, useNaneTheme } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber } from '@/utils/format';

type StatusFilter = 'all' | 'pending' | 'open' | 'voted' | 'results';
type SortOption = 'actionFirst' | 'closingSoon' | 'newest' | 'turnout';
type Notice = { title: string; description?: string; tone?: StatusTone } | null;
type PendingVote = { poll: GovernancePoll; voteValue: string } | null;

const sortOptions: MobileSortOption[] = [
  { value: 'actionFirst', label: 'Action first', description: 'Votes awaiting your response first.' },
  { value: 'closingSoon', label: 'Closing soon', description: 'Earliest closing time first.' },
  { value: 'newest', label: 'Newest first', description: 'Recently published votes first.' },
  { value: 'turnout', label: 'Highest turnout', description: 'Votes with strongest participation first.' },
];

export default function MobileMemberVotingScreen() {
  const theme = useNaneTheme();
  const { activeView, associationId, user } = useAuth();
  const params = useLocalSearchParams();
  const focusPollId = Array.isArray(params.poll) ? params.poll[0] : params.poll;
  const handledFocusRef = useRef(false);
  const userId = user?.userId;

  const [member, setMember] = useState<AssociationMember | null>(null);
  const [polls, setPolls] = useState<GovernancePoll[]>([]);
  const [selectedPoll, setSelectedPoll] = useState<GovernancePoll | null>(null);
  const [selectedValues, setSelectedValues] = useState<Record<string, string>>({});
  const [pendingVote, setPendingVote] = useState<PendingVote>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortValue, setSortValue] = useState<SortOption>('actionFirst');
  const [sortOpen, setSortOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const loadVoting = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!userId) {
        setLoading(false);
        setError('Member session is missing the user identifier.');
        return;
      }

      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);
      setNotice(null);

      try {
        const currentMember = await getCurrentMemberByUserId(userId);
        const effectiveAssociationId = currentMember.associationId || associationId;
        if (!effectiveAssociationId) {
          throw new Error('Association context is required before opening voting.');
        }

        const rows = await getMemberGovernancePolls(effectiveAssociationId);
        setMember(currentMember);
        setPolls(rows);
        setSelectedPoll((current) => {
          if (!handledFocusRef.current && focusPollId) {
            const focusedPoll = rows.find((poll) => poll.id === focusPollId);
            if (focusedPoll) {
              handledFocusRef.current = true;
              return focusedPoll;
            }
          }
          return rows.find((poll) => poll.id === current?.id) || null;
        });
        if (mode === 'refresh') {
          setNotice({ title: 'Voting refreshed', description: 'Latest association votes are loaded.', tone: 'success' });
        }
      } catch (loadError) {
        setMember(null);
        setPolls([]);
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId, focusPollId, userId],
  );

  useEffect(() => {
    if (activeView === 'MEMBER') {
      void Promise.resolve().then(() => loadVoting());
    }
  }, [activeView, loadVoting]);

  const summary = useMemo(() => buildSummary(polls), [polls]);
  const filteredPolls = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    const filtered = polls.filter((poll) => {
      const status = pollStatus(poll);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'pending' && Boolean(poll.canVote)) ||
        (statusFilter === 'open' && ['OPEN', 'SCHEDULED'].includes(status)) ||
        (statusFilter === 'voted' && Boolean(poll.myVote)) ||
        (statusFilter === 'results' && (status === 'CLOSED' || Number(poll.totalVotes || 0) > 0));

      if (!matchesStatus) return false;
      if (!needle) return true;
      return [poll.title, poll.question, poll.status, poll.eligibleVoters, poll.ballotType]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });

    return sortPolls(filtered, sortValue);
  }, [polls, searchTerm, sortValue, statusFilter]);

  const statusTabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: summary.total },
      { value: 'pending', label: 'Pending', count: summary.pending },
      { value: 'open', label: 'Open', count: summary.open },
      { value: 'voted', label: 'Voted', count: summary.voted },
      { value: 'results', label: 'Results', count: summary.results },
    ],
    [summary],
  );

  const pollItems = useMemo<MobileDataListItem[]>(
    () =>
      filteredPolls.map((poll) => {
        const status = pollStatus(poll);
        const voted = Boolean(poll.myVote);
        const awaiting = Boolean(poll.canVote);
        const tone = awaiting ? 'warning' : voted ? 'success' : pollStatusTone(status);
        return {
          id: poll.id,
          title: poll.title,
          subtitle: poll.question,
          meta: voteWindowLabel(poll),
          amount: awaiting ? 'Vote now' : `${formatNumber(Number(poll.votedCount || 0))}/${formatNumber(Number(poll.eligibleCount || 0))}`,
          status: awaiting ? 'Pending' : voted ? 'Voted' : formatStatus(status),
          statusLabel: awaiting ? 'Pending' : voted ? 'Voted' : formatStatus(status),
          statusTone: tone,
          accent: tone,
          initials: awaiting ? '!' : voted ? 'OK' : 'VT',
        };
      }),
    [filteredPolls],
  );

  const effectiveAssociationId = member?.associationId || associationId;

  const openPollFromItem = (item: MobileDataListItem) => {
    const poll = polls.find((row) => row.id === item.id);
    if (poll) setSelectedPoll(poll);
  };

  const chooseVote = (poll: GovernancePoll, voteValue: string) => {
    setSelectedValues((current) => ({ ...current, [poll.id]: voteValue }));
  };

  const requestSubmit = (poll: GovernancePoll) => {
    const voteValue = selectedValues[poll.id];
    if (!voteValue) {
      setNotice({ title: 'Choose an option', description: 'Select one response before submitting your vote.', tone: 'warning' });
      return;
    }
    setPendingVote({ poll, voteValue });
  };

  const submitConfirmedVote = async () => {
    if (!pendingVote || !effectiveAssociationId) return;
    setSubmittingId(pendingVote.poll.id);
    setError(null);
    setNotice(null);

    try {
      await submitMemberGovernanceVote(effectiveAssociationId, pendingVote.poll.id, pendingVote.voteValue);
      setPendingVote(null);
      setSelectedPoll(null);
      setSelectedValues((current) => {
        const next = { ...current };
        delete next[pendingVote.poll.id];
        return next;
      });
      setNotice({ title: 'Vote submitted', description: 'Your response has been recorded securely.', tone: 'success' });
      await loadVoting('refresh');
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setSubmittingId(null);
    }
  };

  if (activeView !== 'MEMBER') {
    return (
      <AccessDeniedScreen
        title="Member workspace required"
        description="Voting is available from the member portal workspace."
      />
    );
  }

  if (loading) {
    return <MobilePageLoadingState kind="list" message="Loading member voting" />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Governance"
        title="Voting"
        subtitle={member?.membershipNumber || user?.associationName || 'Member portal'}
        onBack={() => router.back()}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Refresh voting"
            variant="secondary"
            disabled={refreshing}
            onPress={() => void loadVoting('refresh')}
          />
        }
      />

      {notice ? <MobileToast title={notice.title} description={notice.description} tone={notice.tone || 'info'} /> : null}
      {error ? (
        <MobileErrorState
          title="Voting issue"
          description={error}
          retryLabel={polls.length ? 'Dismiss' : 'Retry'}
          onRetry={() => (polls.length ? setError(null) : void loadVoting('refresh'))}
        />
      ) : null}

      <MobileSummaryPanel
        title="Member Voting"
        value={`${formatNumber(summary.pending)} pending`}
        description={summary.pending ? 'Review and submit required responses.' : 'No vote currently needs your response.'}
        tone={summary.pending ? 'orange' : 'green'}
        icon={Vote}
        footer={
          <View style={styles.summaryFooter}>
            <MobileInfoRow label="Member" value={member?.fullLegalName || user?.fullName || user?.email || 'Member'} helper={member?.membershipNumber || 'Membership number pending'} icon={ShieldCheck} />
          </View>
        }
      />

      <MobileSearchToolbar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Find vote"
        onFilterPress={() => setSortOpen(true)}
        filterLabel="Sort"
      />
      <MobileStatusTabs tabs={statusTabs} value={statusFilter} onChange={(value) => setStatusFilter(value as StatusFilter)} />

      {pollItems.length ? (
        <MobileDataList items={pollItems} onPressItem={openPollFromItem} />
      ) : (
        <MobileEmptyState
          title={polls.length ? 'No matching votes' : 'No votes available'}
          description={polls.length ? 'Adjust search, tabs, or sorting to find a vote.' : 'When your association publishes a vote for you, it will appear here.'}
          actionLabel={polls.length ? 'Reset filters' : 'Refresh'}
          onAction={() => {
            if (polls.length) {
              setSearchTerm('');
              setStatusFilter('all');
              setSortValue('actionFirst');
            } else {
              void loadVoting('refresh');
            }
          }}
        />
      )}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Pending" value={formatNumber(summary.pending)} description="Needs your vote" tone="orange" icon={Clock3} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Open" value={formatNumber(summary.open)} description="Visible votes" tone="blue" icon={RadioTower} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Voted" value={formatNumber(summary.voted)} description="Recorded responses" tone="green" icon={CheckCircle2} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Turnout" value={`${Math.round(summary.turnout)}%`} description="Average participation" tone="teal" icon={BarChart3} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileSortSheet
        visible={sortOpen}
        value={sortValue}
        options={sortOptions}
        onChange={(value) => setSortValue(value as SortOption)}
        onClose={() => setSortOpen(false)}
      />

      <MobileSheet
        visible={Boolean(selectedPoll)}
        title="Vote details"
        description="Review the question, choose a response, and confirm submission."
        onClose={() => setSelectedPoll(null)}
      >
        {selectedPoll ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailContent}>
            <MobileCard compact accent={pollKpiAccent(selectedPoll)}>
              <View style={styles.detailTitleRow}>
                <View style={styles.detailTitleCopy}>
                  <MobileText variant="section" weight="bold">
                    {selectedPoll.title}
                  </MobileText>
                  <MobileText variant="small" tone="secondary">
                    {selectedPoll.question}
                  </MobileText>
                </View>
                <MobileStatusBadge
                  status={selectedPoll.canVote ? 'Pending' : selectedPoll.myVote ? 'Voted' : formatStatus(selectedPoll.status)}
                  tone={selectedPoll.canVote ? 'warning' : selectedPoll.myVote ? 'success' : pollStatusTone(selectedPoll.status)}
                />
              </View>
            </MobileCard>

            <MobileCard compact>
              <MobileInfoRow label="Voting window" value={voteWindowLabel(selectedPoll)} helper={formatBallotType(selectedPoll.ballotType)} icon={CalendarClock} />
              <MobileInfoRow label="Eligible voters" value={formatNumber(Number(selectedPoll.eligibleCount || 0))} helper={selectedPoll.eligibleVoters || 'All active members'} icon={Users} />
              <MobileInfoRow label="Votes cast" value={formatNumber(Number(selectedPoll.votedCount || 0))} helper={`${formatNumber(Number(selectedPoll.pendingCount || 0))} pending`} icon={CheckCircle2} />
            </MobileCard>

            {selectedPoll.canVote ? (
              <MobileCard compact style={styles.optionCard}>
                <MobileText variant="body" weight="bold">
                  Choose your response
                </MobileText>
                {(selectedPoll.options || []).map((option) => {
                  const selected = selectedValues[selectedPoll.id] === option;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => chooseVote(selectedPoll, option)}
                      style={({ pressed }) => [
                        styles.voteOption,
                        {
                          backgroundColor: selected ? theme.colors.surfaceStrong : theme.colors.surface,
                          borderColor: selected ? theme.colors.primary : theme.colors.border,
                          opacity: pressed ? 0.84 : 1,
                        },
                      ]}
                    >
                      <View style={[styles.optionDot, { borderColor: selected ? theme.colors.primary : theme.colors.borderStrong }]}>
                        {selected ? <View style={[styles.optionDotFill, { backgroundColor: theme.colors.primary }]} /> : null}
                      </View>
                      <MobileText variant="body" weight="bold" style={selected ? { color: theme.colors.primary } : null}>
                        {option}
                      </MobileText>
                    </Pressable>
                  );
                })}
                <MobileButton
                  label="Submit vote"
                  icon={Vote}
                  loading={submittingId === selectedPoll.id}
                  disabled={!selectedValues[selectedPoll.id] || submittingId === selectedPoll.id}
                  onPress={() => requestSubmit(selectedPoll)}
                />
              </MobileCard>
            ) : (
              <MobileCard compact style={styles.optionCard}>
                <MobileText variant="body" weight="bold">
                  {selectedPoll.myVote ? `You voted: ${selectedPoll.myVote}` : 'Results'}
                </MobileText>
                {(selectedPoll.options || []).map((option) => {
                  const count = Number(selectedPoll.resultCounts?.[option] || 0);
                  const percent = Number(selectedPoll.totalVotes || 0) > 0 ? Math.round((count * 100) / Number(selectedPoll.totalVotes || 0)) : 0;
                  return (
                    <MobileProgressBar
                      key={option}
                      label={`${option} · ${formatNumber(count)} ${count === 1 ? 'vote' : 'votes'}`}
                      value={percent}
                      tone="blue"
                    />
                  );
                })}
                {(selectedPoll.options || []).length === 0 ? (
                  <MobileEmptyState title="No result options" description="Results will appear when vote options are available." />
                ) : null}
              </MobileCard>
            )}
          </ScrollView>
        ) : null}
      </MobileSheet>

      <MobileConfirmSheet
        visible={Boolean(pendingVote)}
        title="Submit vote?"
        description={pendingVote ? `Submit "${pendingVote.voteValue}" for "${pendingVote.poll.title}"? You cannot change this after it is recorded.` : 'Submit your vote?'}
        confirmLabel="Submit vote"
        loading={Boolean(submittingId)}
        onCancel={() => setPendingVote(null)}
        onConfirm={submitConfirmedVote}
      />
    </MobileScreen>
  );
}

function buildSummary(polls: GovernancePoll[]) {
  const total = polls.length;
  const pending = polls.filter((poll) => poll.canVote).length;
  const open = polls.filter((poll) => ['OPEN', 'SCHEDULED'].includes(pollStatus(poll))).length;
  const voted = polls.filter((poll) => poll.myVote).length;
  const results = polls.filter((poll) => pollStatus(poll) === 'CLOSED' || Number(poll.totalVotes || 0) > 0).length;
  const turnout = total ? polls.reduce((sum, poll) => sum + Number(poll.participationRate || 0), 0) / total : 0;
  return { total, pending, open, voted, results, turnout };
}

function sortPolls(polls: GovernancePoll[], sortValue: SortOption) {
  const rows = [...polls];
  if (sortValue === 'closingSoon') {
    return rows.sort((left, right) => endTime(left) - endTime(right));
  }
  if (sortValue === 'newest') {
    return rows.sort((left, right) => dateTime(right.publishedAt || right.createdAt) - dateTime(left.publishedAt || left.createdAt));
  }
  if (sortValue === 'turnout') {
    return rows.sort((left, right) => Number(right.participationRate || 0) - Number(left.participationRate || 0));
  }
  return rows.sort((left, right) => Number(Boolean(right.canVote)) - Number(Boolean(left.canVote)) || endTime(left) - endTime(right));
}

function pollStatus(poll: GovernancePoll) {
  return String(poll.status || 'UNKNOWN').trim().toUpperCase();
}

function dateTime(value?: string | null) {
  return new Date(value || '').getTime() || 0;
}

function endTime(poll: GovernancePoll) {
  return dateTime(poll.endsAt) || Number.MAX_SAFE_INTEGER;
}

function voteWindowLabel(poll: GovernancePoll) {
  const status = pollStatus(poll);
  if (poll.endsAt && ['OPEN', 'SCHEDULED'].includes(status)) return `Closes ${formatDate(poll.endsAt)}`;
  if (poll.startsAt && status === 'SCHEDULED') return `Opens ${formatDate(poll.startsAt)}`;
  if (poll.closedAt || status === 'CLOSED') return `Closed ${formatDate(poll.closedAt || poll.endsAt)}`;
  return poll.startsAt ? `Started ${formatDate(poll.startsAt)}` : 'Voting window not set';
}

function formatStatus(status?: string | null) {
  return String(status || 'Unknown')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatBallotType(value?: string | null) {
  return value === 'SINGLE_CHOICE' ? 'Single choice ballot' : 'Yes / No resolution';
}

function pollStatusTone(status?: string | null): StatusTone {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'OPEN') return 'success';
  if (normalized === 'SCHEDULED') return 'warning';
  if (normalized === 'CLOSED') return 'neutral';
  if (normalized === 'DRAFT') return 'info';
  return 'neutral';
}

function pollKpiAccent(poll: GovernancePoll): KpiTone {
  if (poll.canVote) return 'orange';
  if (poll.myVote) return 'green';
  const status = pollStatus(poll);
  if (status === 'OPEN') return 'green';
  if (status === 'SCHEDULED') return 'blue';
  if (status === 'CLOSED') return 'slate';
  return 'teal';
}

const styles = StyleSheet.create({
  summaryFooter: {
    gap: 12,
  },
  detailContent: {
    gap: 12,
    paddingBottom: 10,
  },
  detailTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailTitleCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  optionCard: {
    gap: 12,
  },
  voteOption: {
    minHeight: 54,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionDot: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionDotFill: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
});
