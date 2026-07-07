import { router } from 'expo-router';
import {
  Bell,
  BriefcaseBusiness,
  CalendarClock,
  Clock3,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  Newspaper,
  RefreshCw,
  Share2,
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
  MobileStatusTabs,
  MobileSummaryPanel,
  MobileText,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import { getCurrentMemberByUserId, type AssociationMember } from '@/services/member-service';
import { getAssociationPosts, type CommunityPost, type CommunityPostStatus, type CommunityPostType } from '@/services/post-service';
import { type KpiTone, type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber } from '@/utils/format';

type NewsFilter = 'all' | 'JOB' | 'TENDER' | 'ACTIVE' | 'CLOSED';
type NewsSort = 'createdDesc' | 'deadlineAsc' | 'titleAsc' | 'typeAsc';

const PAGE_SIZE = 100;

const sortOptions: MobileSortOption[] = [
  { value: 'createdDesc', label: 'Newest first', description: 'Recently posted bulletins appear first.' },
  { value: 'deadlineAsc', label: 'Deadline soonest', description: 'Posts closing soon appear first.' },
  { value: 'titleAsc', label: 'Title A-Z', description: 'Sort alphabetically by post title.' },
  { value: 'typeAsc', label: 'Type', description: 'Group jobs and tenders together.' },
];

export default function MobileMemberNewsScreen() {
  const { activeView, associationId, user } = useAuth();
  const [member, setMember] = useState<AssociationMember | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<NewsFilter>('all');
  const [sortValue, setSortValue] = useState<NewsSort>('createdDesc');
  const [sortOpen, setSortOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = user?.userId;

  const loadPosts = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!userId || !associationId) {
        setLoading(false);
        setError('Member and association context are required before opening community news.');
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
        setMember(currentMember);
        setPosts(response.posts);
        setSelectedPost((current) => response.posts.find((post) => post.id === current?.id) || null);
      } catch (loadError) {
        setPosts([]);
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
      void Promise.resolve().then(() => loadPosts());
    }
  }, [activeView, loadPosts]);

  const visibleSource = useMemo(() => posts.filter((post) => post.status !== 'DRAFT'), [posts]);
  const summary = useMemo(() => buildSummary(posts, visibleSource), [posts, visibleSource]);

  const filteredPosts = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    const filtered = visibleSource.filter((post) => {
      const matchesFilter =
        statusFilter === 'all' ||
        post.postType === statusFilter ||
        post.status === statusFilter;

      if (!matchesFilter) return false;
      if (!needle) return true;
      return [
        post.title,
        post.description,
        post.departmentUnit,
        post.locationRegion,
        post.tenderReferenceNumber,
        post.tenderCategory,
        post.employmentType,
        post.applicationEmail,
        post.contactPersonEmail,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });

    return sortPosts(filtered, sortValue);
  }, [searchTerm, sortValue, statusFilter, visibleSource]);

  const tabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: summary.visible },
      { value: 'TENDER', label: 'Tenders', count: summary.tenders },
      { value: 'JOB', label: 'Jobs', count: summary.jobs },
      { value: 'ACTIVE', label: 'Active', count: summary.active },
      { value: 'CLOSED', label: 'Closed', count: summary.closed },
    ],
    [summary],
  );

  const listItems = useMemo<MobileDataListItem[]>(
    () =>
      filteredPosts.map((post) => ({
        id: post.id,
        title: post.title,
        subtitle: [postTypeLabel(post.postType), post.locationRegion || post.departmentUnit || 'Association bulletin'].join(' · '),
        meta: post.deadlineDate ? `Deadline ${formatDate(post.deadlineDate)}` : `Posted ${formatDate(post.createdAt)}`,
        status: postStatusLabel(post.status),
        statusTone: postStatusTone(post.status),
        amount: postAmountLabel(post),
        initials: post.postType === 'TENDER' ? 'TN' : 'JB',
        accent: postTypeTone(post.postType),
      })),
    [filteredPosts],
  );

  if (activeView !== 'MEMBER') {
    return (
      <AccessDeniedScreen
        title="Member workspace required"
        description="Community news is available from the member portal workspace."
      />
    );
  }

  if (loading) {
    return <MobilePageLoadingState kind="list" message="Loading community news" />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Community"
        title="Newsroom"
        subtitle={member?.membershipNumber || user?.associationName || 'Member portal'}
        onBack={() => router.back()}
        rightAction={<MobileStatusBadge status={refreshing ? 'Refreshing' : 'Ready'} tone={refreshing ? 'info' : 'success'} />}
      />

      {error ? (
        <MobileErrorState
          title="News could not load"
          description={error}
          retryLabel="Retry"
          onRetry={() => void loadPosts('refresh')}
        />
      ) : null}

      <MobileSummaryPanel
        title="Community Bulletin"
        value={formatNumber(summary.visible)}
        description={
          summary.nextDeadline
            ? `Next deadline: ${summary.nextDeadline.title}`
            : summary.closed > 0
              ? 'Archived tender and job notices'
              : 'Jobs, tenders, notices and association updates'
        }
        icon={Newspaper}
        tone={summary.active > 0 ? 'blue' : 'slate'}
        footer={
          <View style={styles.summaryActions}>
            <MobileButton
              label="Refresh"
              icon={RefreshCw}
              variant="secondary"
              size="sm"
              loading={refreshing}
              disabled={refreshing}
              onPress={() => void loadPosts('refresh')}
              style={styles.summaryButton}
            />
            <MobileButton
              label="Tenders"
              icon={FileText}
              variant="ghost"
              size="sm"
              onPress={() => setStatusFilter('TENDER')}
              style={styles.summaryButton}
            />
          </View>
        }
      />

      <MobileCard compact>
        <View style={styles.toolbarHeader}>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold">
              Bulletin Feed
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Showing {formatNumber(filteredPosts.length)} of {formatNumber(summary.visible)} member-visible posts.
            </MobileText>
          </View>
          <MobileStatusBadge status={summary.active > 0 ? 'Active' : 'Archive'} tone={summary.active > 0 ? 'success' : 'neutral'} />
        </View>
        <MobileSearchToolbar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search posts"
          onFilterPress={() => setSortOpen(true)}
          filterLabel="Sort"
        />
        <MobileStatusTabs tabs={tabs} value={statusFilter} onChange={(value) => setStatusFilter(value as NewsFilter)} />
      </MobileCard>

      {filteredPosts.length > 0 ? (
        <MobileDataList
          items={listItems}
          onPressItem={(item) => {
            const post = filteredPosts.find((entry) => entry.id === item.id);
            if (post) setSelectedPost(post);
          }}
        />
      ) : (
        <MobileEmptyState
          title={searchTerm || statusFilter !== 'all' ? 'No matching posts' : 'No community posts'}
          description={
            searchTerm || statusFilter !== 'all'
              ? 'Adjust search or tabs to see more posts.'
              : 'Association bulletins, jobs and tenders will appear here when published.'
          }
          actionLabel={searchTerm || statusFilter !== 'all' ? 'Clear filters' : 'Refresh'}
          onAction={() => {
            if (searchTerm || statusFilter !== 'all') {
              setSearchTerm('');
              setStatusFilter('all');
            } else {
              void loadPosts('refresh');
            }
          }}
        />
      )}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Tenders" value={formatNumber(summary.tenders)} description="Member-visible tenders" icon={FileText} tone="purple" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Jobs" value={formatNumber(summary.jobs)} description="Career openings" icon={BriefcaseBusiness} tone="blue" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Active" value={formatNumber(summary.active)} description="Currently open" icon={Bell} tone="green" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Closed" value={formatNumber(summary.closed)} description="Archive records" icon={Clock3} tone="slate" />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <PostDetailSheet post={selectedPost} onClose={() => setSelectedPost(null)} />

      <MobileSortSheet
        visible={sortOpen}
        value={sortValue}
        options={sortOptions}
        onChange={(value) => setSortValue(value as NewsSort)}
        onClose={() => setSortOpen(false)}
      />
    </MobileScreen>
  );
}

function PostDetailSheet({ post, onClose }: { post: CommunityPost | null; onClose: () => void }) {
  if (!post) return null;

  return (
    <MobileSheet
      visible={Boolean(post)}
      title={post.title}
      description={`${postTypeLabel(post.postType)} · ${postStatusLabel(post.status)}`}
      onClose={onClose}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailContent}>
        <MobileCard compact accent={postTypeKpiTone(post.postType)}>
          <View style={styles.detailHeader}>
            <View style={styles.flex}>
              <MobileStatusBadge status={postTypeLabel(post.postType)} tone={postTypeTone(post.postType)} />
              <MobileText variant="section" weight="bold">
                {post.deadlineDate ? `Due ${formatDate(post.deadlineDate)}` : `Posted ${formatDate(post.createdAt)}`}
              </MobileText>
              <MobileText variant="small" tone="secondary">
                {post.locationRegion || post.departmentUnit || 'Association bulletin'}
              </MobileText>
            </View>
            <MobileStatusBadge status={postStatusLabel(post.status)} tone={postStatusTone(post.status)} />
          </View>
        </MobileCard>

        <MobileCard compact>
          <MobileInfoRow label="Type" value={postTypeLabel(post.postType)} icon={post.postType === 'TENDER' ? FileText : BriefcaseBusiness} />
          <MobileInfoRow label="Status" value={postStatusLabel(post.status)} icon={Bell} />
          <MobileInfoRow label="Location" value={post.locationRegion || 'Not recorded'} icon={MapPin} />
          <MobileInfoRow label="Department" value={post.departmentUnit || 'Not recorded'} icon={BriefcaseBusiness} />
          <MobileInfoRow label="Deadline" value={formatDate(post.deadlineDate)} icon={CalendarClock} />
          <MobileInfoRow label="Posted" value={formatDate(post.createdAt)} icon={Clock3} />
        </MobileCard>

        {post.description ? (
          <MobileCard compact>
            <MobileText variant="section" weight="bold">
              Details
            </MobileText>
            <MobileText variant="small" tone="secondary">
              {post.description}
            </MobileText>
          </MobileCard>
        ) : null}

        {post.postType === 'TENDER' ? <TenderInfo post={post} /> : <JobInfo post={post} />}

        <View style={styles.actions}>
          {post.applicationEmail ? <MobileButton label="Email" icon={Mail} variant="secondary" onPress={() => void Linking.openURL(`mailto:${post.applicationEmail}`)} /> : null}
          {post.applicationLink ? <MobileButton label="Open Link" icon={ExternalLink} variant="secondary" onPress={() => void openLink(post.applicationLink)} /> : null}
          {post.documentCollectionLink ? <MobileButton label="Documents" icon={ExternalLink} variant="secondary" onPress={() => void openLink(post.documentCollectionLink)} /> : null}
          {post.contactPersonEmail ? <MobileButton label="Contact" icon={Mail} variant="secondary" onPress={() => void Linking.openURL(`mailto:${post.contactPersonEmail}`)} /> : null}
        </View>

        <MobileButton
          label="Share Post"
          icon={Share2}
          variant="secondary"
          fullWidth
          onPress={() => void sharePost(post)}
        />
      </ScrollView>
    </MobileSheet>
  );
}

function TenderInfo({ post }: { post: CommunityPost }) {
  return (
    <MobileCard compact>
      <MobileInfoRow label="Reference" value={post.tenderReferenceNumber || 'Not recorded'} icon={FileText} />
      <MobileInfoRow label="Category" value={post.tenderCategory || 'Not recorded'} />
      <MobileInfoRow label="Opening" value={formatDate(post.openingDateTime)} />
      <MobileInfoRow label="Eligibility" value={post.eligibilityCriteria || 'Not recorded'} />
      <MobileInfoRow label="Submission" value={post.submissionInstructions || 'Not recorded'} />
      <MobileInfoRow label="Tender Document" value={post.tenderDocumentPath ? 'Attached' : 'Not attached'} />
    </MobileCard>
  );
}

function JobInfo({ post }: { post: CommunityPost }) {
  return (
    <MobileCard compact>
      <MobileInfoRow label="Employment" value={labelFromEnum(post.employmentType)} icon={BriefcaseBusiness} />
      <MobileInfoRow label="Positions" value={post.positionsCount ? formatNumber(post.positionsCount) : 'Not recorded'} />
      <MobileInfoRow label="Experience" value={post.experienceYears ? `${formatNumber(post.experienceYears)} years` : 'Not recorded'} />
      <MobileInfoRow label="Qualifications" value={post.requiredQualifications || 'Not recorded'} />
      <MobileInfoRow label="Skills" value={post.skillsCompetencies || 'Not recorded'} />
      <MobileInfoRow label="Job Document" value={post.jobDescriptionPath ? 'Attached' : 'Not attached'} />
    </MobileCard>
  );
}

function buildSummary(allPosts: CommunityPost[], visiblePosts: CommunityPost[]) {
  const upcoming = visiblePosts
    .filter((post) => post.deadlineDate && new Date(post.deadlineDate).getTime() >= Date.now())
    .sort((left, right) => dateValue(left.deadlineDate) - dateValue(right.deadlineDate));

  return {
    total: allPosts.length,
    visible: visiblePosts.length,
    hiddenDrafts: allPosts.filter((post) => post.status === 'DRAFT').length,
    tenders: visiblePosts.filter((post) => post.postType === 'TENDER').length,
    jobs: visiblePosts.filter((post) => post.postType === 'JOB').length,
    active: visiblePosts.filter((post) => post.status === 'ACTIVE').length,
    closed: visiblePosts.filter((post) => post.status === 'CLOSED').length,
    nextDeadline: upcoming[0] || null,
  };
}

function sortPosts(posts: CommunityPost[], sortValue: NewsSort) {
  return [...posts].sort((left, right) => {
    if (sortValue === 'titleAsc') return left.title.localeCompare(right.title);
    if (sortValue === 'typeAsc') return String(left.postType).localeCompare(String(right.postType)) || left.title.localeCompare(right.title);
    if (sortValue === 'deadlineAsc') return deadlineValue(left.deadlineDate) - deadlineValue(right.deadlineDate);
    return dateValue(right.createdAt) - dateValue(left.createdAt);
  });
}

function postTypeLabel(type?: CommunityPostType | null) {
  const normalized = String(type || '').toUpperCase();
  if (normalized === 'JOB') return 'Job';
  if (normalized === 'TENDER') return 'Tender';
  return normalized ? labelFromEnum(normalized) : 'Post';
}

function postStatusLabel(status?: CommunityPostStatus | null) {
  return labelFromEnum(status || 'Unknown');
}

function postStatusTone(status?: CommunityPostStatus | null): StatusTone {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'ACTIVE') return 'success';
  if (normalized === 'CLOSED') return 'neutral';
  if (normalized === 'DRAFT') return 'review';
  return 'primary';
}

function postTypeTone(type?: CommunityPostType | null): StatusTone {
  const normalized = String(type || '').toUpperCase();
  if (normalized === 'TENDER') return 'review';
  if (normalized === 'JOB') return 'info';
  return 'primary';
}

function postTypeKpiTone(type?: CommunityPostType | null): KpiTone {
  return String(type || '').toUpperCase() === 'TENDER' ? 'purple' : 'blue';
}

function postAmountLabel(post: CommunityPost) {
  if (post.postType === 'JOB' && post.positionsCount) {
    return `${formatNumber(post.positionsCount)} role${post.positionsCount === 1 ? '' : 's'}`;
  }
  return undefined;
}

function labelFromEnum(value?: string | null) {
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

async function sharePost(post: CommunityPost) {
  await Share.share({
    title: post.title,
    message: `${post.title}\n${postTypeLabel(post.postType)} · ${post.locationRegion || 'Association bulletin'}\n${post.deadlineDate ? `Deadline: ${formatDate(post.deadlineDate)}` : ''}`,
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
