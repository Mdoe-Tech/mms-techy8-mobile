import { router } from 'expo-router';
import {
  BriefcaseBusiness,
  CalendarClock,
  ExternalLink,
  Mail,
  MapPin,
  RefreshCw,
  SearchCheck,
  Share2,
  Users,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, ScrollView, Share, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileDataList,
  type MobileDataListItem,
  MobileEmptyState,
  MobileErrorState,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileSearchToolbar,
  MobileSheet,
  MobileSortSheet,
  type MobileSortOption,
  MobileStatusBadge,
  MobileSummaryPanel,
  MobileText,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import { getCurrentMemberByUserId, type AssociationMember } from '@/services/member-service';
import { getAssociationPosts, type CommunityPost, type EmploymentType } from '@/services/post-service';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber } from '@/utils/format';

type JobSort = 'deadlineAsc' | 'createdDesc' | 'titleAsc' | 'positionsDesc';

const PAGE_SIZE = 100;

const sortOptions: MobileSortOption[] = [
  { value: 'deadlineAsc', label: 'Deadline soonest', description: 'Open roles closing soon appear first.' },
  { value: 'createdDesc', label: 'Newest first', description: 'Recently posted roles appear first.' },
  { value: 'titleAsc', label: 'Title A-Z', description: 'Sort alphabetically by role title.' },
  { value: 'positionsDesc', label: 'Most positions', description: 'Roles with more openings appear first.' },
];

export default function MobileMemberJobPostsScreen() {
  const { activeView, associationId, user } = useAuth();
  const [member, setMember] = useState<AssociationMember | null>(null);
  const [jobs, setJobs] = useState<CommunityPost[]>([]);
  const [selectedJob, setSelectedJob] = useState<CommunityPost | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortValue, setSortValue] = useState<JobSort>('deadlineAsc');
  const [sortOpen, setSortOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = user?.userId;

  const loadJobs = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!userId || !associationId) {
        setLoading(false);
        setError('Member and association context are required before opening job opportunities.');
        return;
      }

      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const currentMember = await getCurrentMemberByUserId(userId);
        const memberAssociationId = currentMember.associationId || associationId;
        const response = await getAssociationPosts(memberAssociationId, {
          size: PAGE_SIZE,
          sort: 'createdAt,desc',
        });
        const activeJobs = response.posts.filter((post) => post.postType === 'JOB' && post.status === 'ACTIVE');
        setMember(currentMember);
        setJobs(activeJobs);
        setSelectedJob((current) => activeJobs.find((job) => job.id === current?.id) || null);
      } catch (loadError) {
        setJobs([]);
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId, userId],
  );

  useEffect(() => {
    if (activeView === 'MEMBER') {
      void Promise.resolve().then(() => loadJobs());
    }
  }, [activeView, loadJobs]);

  const summary = useMemo(() => buildSummary(jobs), [jobs]);
  const filteredJobs = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    const filtered = jobs.filter((job) => {
      if (!needle) return true;
      return [
        job.title,
        job.description,
        job.departmentUnit,
        job.locationRegion,
        job.employmentType,
        job.requiredQualifications,
        job.skillsCompetencies,
        job.applicationEmail,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });

    return sortJobs(filtered, sortValue);
  }, [jobs, searchTerm, sortValue]);

  const listItems = useMemo<MobileDataListItem[]>(
    () =>
      filteredJobs.map((job) => ({
        id: job.id,
        title: job.title,
        subtitle: [job.departmentUnit || labelFromEnum(job.employmentType), job.locationRegion || 'Location not recorded'].join(' · '),
        meta: job.deadlineDate ? `Deadline ${formatDate(job.deadlineDate)}` : 'No deadline recorded',
        amount: job.positionsCount ? `${formatNumber(job.positionsCount)} role${job.positionsCount === 1 ? '' : 's'}` : undefined,
        status: 'Open',
        statusTone: 'success',
        initials: 'JB',
        accent: 'info',
      })),
    [filteredJobs],
  );

  if (activeView !== 'MEMBER') {
    return (
      <AccessDeniedScreen
        title="Member workspace required"
        description="Job opportunities are available from the member portal workspace."
      />
    );
  }

  if (loading) {
    return <MobilePageLoadingState kind="list" message="Loading job opportunities" />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Community"
        title="Job Opportunities"
        subtitle={member?.membershipNumber || user?.associationName || 'Member portal'}
        onBack={() => router.back()}
        rightAction={<MobileStatusBadge status={refreshing ? 'Refreshing' : 'Ready'} tone={refreshing ? 'info' : 'success'} />}
      />

      {error ? (
        <MobileErrorState
          title="Jobs could not load"
          description={error}
          retryLabel="Retry"
          onRetry={() => void loadJobs('refresh')}
        />
      ) : null}

      <MobileSummaryPanel
        title="Open Roles"
        value={formatNumber(summary.total)}
        description={summary.nextDeadline ? `Next deadline: ${summary.nextDeadline.title}` : 'Career openings shared by the association'}
        icon={BriefcaseBusiness}
        tone={summary.total > 0 ? 'blue' : 'slate'}
        footer={
          <View style={styles.summaryActions}>
            <MobileButton
              label="Refresh"
              icon={RefreshCw}
              variant="secondary"
              size="sm"
              loading={refreshing}
              disabled={refreshing}
              onPress={() => void loadJobs('refresh')}
              style={styles.summaryButton}
            />
            <MobileButton
              label="Sort"
              icon={SearchCheck}
              variant="ghost"
              size="sm"
              onPress={() => setSortOpen(true)}
              style={styles.summaryButton}
            />
          </View>
        }
      />

      <MobileCard compact>
        <View style={styles.toolbarHeader}>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold">
              Vacancies
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Showing {formatNumber(filteredJobs.length)} of {formatNumber(summary.total)} open roles.
            </MobileText>
          </View>
          <MobileStatusBadge status={summary.total > 0 ? 'Open' : 'No Openings'} tone={summary.total > 0 ? 'success' : 'neutral'} />
        </View>
        <MobileSearchToolbar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search roles"
          onFilterPress={() => setSortOpen(true)}
          filterLabel="Sort"
        />
      </MobileCard>

      {filteredJobs.length > 0 ? (
        <MobileDataList
          items={listItems}
          onPressItem={(item) => {
            const job = filteredJobs.find((entry) => entry.id === item.id);
            if (job) setSelectedJob(job);
          }}
        />
      ) : (
        <MobileEmptyState
          title={searchTerm ? 'No matching roles' : 'No vacancies at the moment'}
          description={
            searchTerm
              ? 'Adjust your search to see more opportunities.'
              : 'New opportunities will appear here as soon as the association publishes active job posts.'
          }
          actionLabel={searchTerm ? 'Clear search' : 'Refresh'}
          onAction={() => {
            if (searchTerm) setSearchTerm('');
            else void loadJobs('refresh');
          }}
        />
      )}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Openings" value={formatNumber(summary.total)} description="Active job posts" icon={BriefcaseBusiness} tone="blue" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Positions" value={formatNumber(summary.positions)} description="Total role slots" icon={Users} tone="green" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="With Deadline" value={formatNumber(summary.withDeadline)} description="Time-bound roles" icon={CalendarClock} tone="orange" />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <JobDetailSheet job={selectedJob} onClose={() => setSelectedJob(null)} />

      <MobileSortSheet
        visible={sortOpen}
        value={sortValue}
        options={sortOptions}
        onChange={(value) => setSortValue(value as JobSort)}
        onClose={() => setSortOpen(false)}
      />
    </MobileScreen>
  );
}

function JobDetailSheet({ job, onClose }: { job: CommunityPost | null; onClose: () => void }) {
  if (!job) return null;

  return (
    <MobileSheet
      visible={Boolean(job)}
      title={job.title}
      description={`${labelFromEnum(job.employmentType)} · ${job.locationRegion || 'Location not recorded'}`}
      onClose={onClose}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailContent}>
        <MobileCard compact accent="blue">
          <View style={styles.detailHeader}>
            <View style={styles.flex}>
              <MobileStatusBadge status="Open" tone="success" />
              <MobileText variant="section" weight="bold">
                {job.deadlineDate ? `Apply by ${formatDate(job.deadlineDate)}` : 'Application timeline not recorded'}
              </MobileText>
              <MobileText variant="small" tone="secondary">
                {job.departmentUnit || 'Association opportunity'}
              </MobileText>
            </View>
            <MobileStatusBadge status={job.positionsCount ? `${formatNumber(job.positionsCount)} roles` : 'Role'} tone="info" />
          </View>
        </MobileCard>

        <MobileCard compact>
          <MobileInfoRow label="Employment" value={labelFromEnum(job.employmentType)} icon={BriefcaseBusiness} />
          <MobileInfoRow label="Department" value={job.departmentUnit || 'Not recorded'} icon={BriefcaseBusiness} />
          <MobileInfoRow label="Location" value={job.locationRegion || 'Not recorded'} icon={MapPin} />
          <MobileInfoRow label="Deadline" value={formatDate(job.deadlineDate)} icon={CalendarClock} />
          <MobileInfoRow label="Positions" value={job.positionsCount ? formatNumber(job.positionsCount) : 'Not recorded'} icon={Users} />
          <MobileInfoRow label="Experience" value={job.experienceYears ? `${formatNumber(job.experienceYears)} years` : 'Not recorded'} />
        </MobileCard>

        {job.description ? (
          <MobileCard compact>
            <MobileText variant="section" weight="bold">
              Description
            </MobileText>
            <MobileText variant="small" tone="secondary">
              {job.description}
            </MobileText>
          </MobileCard>
        ) : null}

        <MobileCard compact>
          <MobileInfoRow label="Qualifications" value={job.requiredQualifications || 'Not recorded'} />
          <MobileInfoRow label="Skills" value={job.skillsCompetencies || 'Not recorded'} />
          <MobileInfoRow label="Application Email" value={job.applicationEmail || 'Not recorded'} icon={Mail} />
          <MobileInfoRow label="Application Link" value={job.applicationLink ? 'Available' : 'Not recorded'} icon={ExternalLink} />
          <MobileInfoRow label="Job Document" value={job.jobDescriptionPath ? 'Attached' : 'Not attached'} />
        </MobileCard>

        <View style={styles.actions}>
          {job.applicationLink ? <MobileButton label="Apply" icon={ExternalLink} onPress={() => void openLink(job.applicationLink)} /> : null}
          {job.applicationEmail ? <MobileButton label="Email" icon={Mail} variant="secondary" onPress={() => void Linking.openURL(`mailto:${job.applicationEmail}`)} /> : null}
        </View>

        <MobileButton
          label="Share Job"
          icon={Share2}
          variant="secondary"
          fullWidth
          onPress={() => void shareJob(job)}
        />
      </ScrollView>
    </MobileSheet>
  );
}

function buildSummary(jobs: CommunityPost[]) {
  const upcoming = jobs
    .filter((job) => job.deadlineDate && new Date(job.deadlineDate).getTime() >= Date.now())
    .sort((left, right) => deadlineValue(left.deadlineDate) - deadlineValue(right.deadlineDate));

  return {
    total: jobs.length,
    positions: jobs.reduce((sum, job) => sum + Number(job.positionsCount || 0), 0),
    withDeadline: jobs.filter((job) => Boolean(job.deadlineDate)).length,
    nextDeadline: upcoming[0] || null,
  };
}

function sortJobs(jobs: CommunityPost[], sortValue: JobSort) {
  return [...jobs].sort((left, right) => {
    if (sortValue === 'createdDesc') return dateValue(right.createdAt) - dateValue(left.createdAt);
    if (sortValue === 'titleAsc') return left.title.localeCompare(right.title);
    if (sortValue === 'positionsDesc') return Number(right.positionsCount || 0) - Number(left.positionsCount || 0);
    return deadlineValue(left.deadlineDate) - deadlineValue(right.deadlineDate);
  });
}

function labelFromEnum(value?: EmploymentType | null) {
  return String(value || 'Not recorded')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function dateValue(value?: string | null) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function deadlineValue(value?: string | null) {
  const time = value ? new Date(value).getTime() : Number.MAX_SAFE_INTEGER;
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

async function openLink(link?: string | null) {
  if (!link) return;
  const canOpen = await Linking.canOpenURL(link);
  if (canOpen) await Linking.openURL(link);
}

async function shareJob(job: CommunityPost) {
  await Share.share({
    title: job.title,
    message: `${job.title}\n${job.locationRegion || 'Location not recorded'}\n${job.deadlineDate ? `Deadline: ${formatDate(job.deadlineDate)}` : ''}`,
  });
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minWidth: 0,
  },
  summaryActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryButton: {
    flexGrow: 1,
  },
  toolbarHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  detailContent: {
    gap: 12,
    paddingBottom: 24,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
