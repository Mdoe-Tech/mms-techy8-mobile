import { router, useLocalSearchParams } from 'expo-router';
import {
  BellRing,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  Edit3,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  Plus,
  RefreshCw,
  Send,
  Trash2,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

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
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  deleteAssociationPost,
  getAssociationPosts,
  notifyAssociationPost,
  publishAssociationPost,
  type CommunityPost,
  type CommunityPostStatus,
  type CommunityPostType,
} from '@/services/post-service';
import { type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber } from '@/utils/format';

type PostStatusFilter = 'all' | 'ACTIVE' | 'DRAFT' | 'CLOSED';
type PostSortOption = 'deadlineAsc' | 'createdDesc' | 'titleAsc' | 'statusAsc';
type ConfirmAction = {
  kind: 'delete' | 'publish' | 'notify';
  post: CommunityPost;
} | null;

const PAGE_SIZE = 100;

const sortOptions = [
  { value: 'deadlineAsc', label: 'Deadline soonest', description: 'Posts closing soon appear first.' },
  { value: 'createdDesc', label: 'Newest first', description: 'Recently created posts appear first.' },
  { value: 'titleAsc', label: 'Title A-Z', description: 'Sort alphabetically by title.' },
  { value: 'statusAsc', label: 'Status', description: 'Group drafts, active, and closed posts.' },
];

type MobilePostsManageScreenProps = {
  forcedPostType?: CommunityPostType;
};

export default function MobilePostsManageScreen({ forcedPostType }: MobilePostsManageScreenProps) {
  const params = useLocalSearchParams();
  const { activeView, associationId, user } = useAuth();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<PostStatusFilter>('all');
  const [sortValue, setSortValue] = useState<PostSortOption>('deadlineAsc');
  const [sortOpen, setSortOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [openedPostId, setOpenedPostId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [nowMs] = useState(() => Date.now());

  const initialPostId = Array.isArray(params.postId) ? params.postId[0] : params.postId;
  const typeScope = (forcedPostType || '').toUpperCase();
  const isJobScope = typeScope === 'JOB';
  const canManagePosts = useMemo(() => hasPostManagePermission(user), [user]);

  const loadPosts = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before loading community posts.');
        return;
      }

      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        const response = await getAssociationPosts(associationId, {
          size: PAGE_SIZE,
          sort: 'createdAt,desc',
        });
        setPosts(response.posts);
      } catch (loadError) {
        setPosts([]);
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
      if (active) void loadPosts();
    });
    return () => {
      active = false;
    };
  }, [loadPosts]);

  const scopedPosts = useMemo(() => {
    return typeScope ? posts.filter((post) => post.postType?.toUpperCase() === typeScope) : posts;
  }, [posts, typeScope]);

  const metrics = useMemo(() => {
    const soonCutoff = nowMs + 14 * 24 * 60 * 60 * 1000;
    const active = scopedPosts.filter((post) => post.status === 'ACTIVE').length;
    const draft = scopedPosts.filter((post) => post.status === 'DRAFT').length;
    const closingSoon = scopedPosts.filter((post) => {
      if (!post.deadlineDate || post.status === 'CLOSED') return false;
      const time = new Date(post.deadlineDate).getTime();
      return Number.isFinite(time) && time >= nowMs && time <= soonCutoff;
    }).length;

    return {
      total: scopedPosts.length,
      active,
      draft,
      closed: scopedPosts.filter((post) => post.status === 'CLOSED').length,
      closingSoon,
    };
  }, [nowMs, scopedPosts]);

  const tabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: scopedPosts.length },
      { value: 'ACTIVE', label: 'Active', count: metrics.active },
      { value: 'DRAFT', label: 'Draft', count: metrics.draft },
      { value: 'CLOSED', label: 'Closed', count: metrics.closed },
    ],
    [metrics, scopedPosts.length],
  );

  const visiblePosts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const filtered = scopedPosts.filter((post) => {
      if (statusFilter !== 'all' && post.status !== statusFilter) return false;
      if (!query) return true;
      return [
        post.title,
        post.departmentUnit,
        post.locationRegion,
        post.description,
        post.employmentType,
        post.applicationEmail,
        post.applicationLink,
        post.tenderReferenceNumber,
        post.tenderCategory,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });

    return [...filtered].sort((a, b) => {
      if (sortValue === 'titleAsc') return a.title.localeCompare(b.title);
      if (sortValue === 'statusAsc') return String(a.status).localeCompare(String(b.status)) || a.title.localeCompare(b.title);
      if (sortValue === 'createdDesc') return dateValue(b.createdAt) - dateValue(a.createdAt);
      return deadlineValue(a.deadlineDate) - deadlineValue(b.deadlineDate);
    });
  }, [scopedPosts, searchTerm, sortValue, statusFilter]);

  const listItems = useMemo<MobileDataListItem[]>(
    () =>
      visiblePosts.map((post) => ({
        id: post.id,
        title: post.title,
        subtitle: [post.departmentUnit || postTypeLabel(post.postType), post.locationRegion || 'Location not recorded'].join(' · '),
        meta: post.deadlineDate ? `Deadline ${formatDate(post.deadlineDate)}` : 'No deadline recorded',
        amount: post.positionsCount ? `${formatNumber(post.positionsCount)} position${post.positionsCount === 1 ? '' : 's'}` : undefined,
        status: post.status,
        statusTone: postStatusTone(post.status),
        initials: post.postType === 'JOB' ? 'JB' : 'TN',
        accent: postStatusTone(post.status),
      })),
    [visiblePosts],
  );

  const title = isJobScope ? 'Jobs' : 'Posts';

  const postReportOptions = useMemo(
    () => ({
      title: isJobScope ? 'Jobs Register' : 'Community Posts Register',
      associationName: user?.associationName || 'Association',
      purpose: `A current-view report of ${isJobScope ? 'job opportunities' : 'community posts and tenders'}, publication status, deadlines, and application details.`,
      rows: visiblePosts,
      fileName: `nane-${isJobScope ? 'jobs' : 'posts'}`,
      metrics: [
        { label: title, value: formatNumber(metrics.total), helper: isJobScope ? 'Loaded job posts' : 'Loaded records' },
        { label: 'Active', value: formatNumber(metrics.active), helper: 'Visible to members' },
        { label: 'Draft', value: formatNumber(metrics.draft), helper: 'Not yet published' },
        { label: 'Closing soon', value: formatNumber(metrics.closingSoon), helper: 'Within 14 days' },
      ],
      filters: [
        { label: 'Search', value: searchTerm || 'All' },
        { label: 'Status', value: tabs.find((tab) => tab.value === statusFilter)?.label || statusFilter },
        { label: 'Sort', value: sortOptions.find((option) => option.value === sortValue)?.label || sortValue },
      ],
      columns: [
        { key: 'type', label: 'Type', width: '10%', value: (row: CommunityPost) => postTypeLabel(row.postType) },
        { key: 'status', label: 'Status', width: '10%', value: (row: CommunityPost) => row.status || '-' },
        { key: 'title', label: 'Title', width: '22%', value: (row: CommunityPost) => row.title || '-' },
        { key: 'departmentUnit', label: 'Department', width: '14%', value: (row: CommunityPost) => row.departmentUnit || '-' },
        { key: 'locationRegion', label: 'Location', width: '13%', value: (row: CommunityPost) => row.locationRegion || '-' },
        { key: 'deadlineDate', label: 'Deadline', width: '11%', value: (row: CommunityPost) => formatDate(row.deadlineDate) },
        { key: 'positionsCount', label: 'Positions', align: 'right' as const, width: '10%', value: (row: CommunityPost) => row.positionsCount ? formatNumber(row.positionsCount) : '-' },
        { key: 'employmentType', label: 'Employment Type', width: '13%', value: (row: CommunityPost) => row.employmentType || '-' },
        { key: 'applicationEmail', label: 'Application Email', width: '18%', value: (row: CommunityPost) => row.applicationEmail || '-' },
      ],
    }),
    [isJobScope, metrics, searchTerm, sortValue, statusFilter, tabs, title, user?.associationName, visiblePosts],
  );

  const openPost = useCallback(
    (item: MobileDataListItem) => {
      const post = posts.find((entry) => entry.id === item.id);
      if (!post) return;
      setSelectedPost(post);
      setNotice(null);
    },
    [posts],
  );

  useEffect(() => {
    if (!initialPostId || openedPostId === initialPostId || posts.length === 0) return;
    const post = posts.find((entry) => entry.id === initialPostId);
    if (!post) return;
    void Promise.resolve().then(() => {
      setSelectedPost(post);
      setOpenedPostId(initialPostId);
    });
  }, [initialPostId, openedPostId, posts]);

  useEffect(() => {
    if (initialPostId || !openedPostId) return;
    void Promise.resolve().then(() => {
      setOpenedPostId(null);
      setSelectedPost(null);
    });
  }, [initialPostId, openedPostId]);

  const openForm = (post?: CommunityPost) => {
    const path = isJobScope ? '/associations/jobs/add' : '/associations/posts/add';
    const route = getRouteByPath(path);
    if (!route) return;
    router.push({
      pathname: '/work/route-preview',
      params: {
        routeId: route.id,
        postType: isJobScope ? 'JOB' : post?.postType || forcedPostType || 'JOB',
        postId: post?.id,
      },
    } as never);
  };

  const runConfirmedAction = async () => {
    if (!associationId || !confirmAction) return;
    const { kind, post } = confirmAction;
    setActionLoading(`${kind}:${post.id}`);
    setError(null);
    setNotice(null);
    try {
      if (kind === 'delete') {
        await deleteAssociationPost(associationId, post.id);
        setNotice(`${postTypeLabel(post.postType)} deleted successfully.`);
        setSelectedPost(null);
      } else if (kind === 'publish') {
        const updated = await publishAssociationPost(associationId, post.id);
        setSelectedPost(updated);
        setNotice(`${postTypeLabel(post.postType)} published successfully.`);
      } else {
        await notifyAssociationPost(associationId, post.id);
        setNotice('Notifications sent successfully.');
      }
      setConfirmAction(null);
      await loadPosts('refresh');
    } catch (actionError) {
      setError(getApiErrorMessage(actionError));
    } finally {
      setActionLoading(null);
    }
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Association admin only" description="Community posts are available from the association admin workspace." />;
  }

  if (loading && posts.length === 0) {
    return <MobilePageLoadingState kind="list" message={isJobScope ? 'Loading jobs' : 'Loading posts'} />;
  }

  const subtitle = isJobScope ? 'Publish job opportunities for members.' : 'Manage jobs and tenders for members.';

  return (
    <MobileScreen>
      <MobilePageHeader
        title={title}
        eyebrow="Community"
        subtitle={subtitle}
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh" onPress={() => void loadPosts('refresh')} disabled={refreshing} />}
      />

      {error ? <MobileErrorState title={`${title} issue`} description={error} onRetry={() => void loadPosts('refresh')} /> : null}
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
          <MobileKpiCard title={title} value={formatNumber(metrics.total)} description={isJobScope ? 'Loaded job posts' : 'Loaded records'} tone="blue" icon={BriefcaseBusiness} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Active" value={formatNumber(metrics.active)} description="Visible to members" tone="green" icon={Send} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Draft" value={formatNumber(metrics.draft)} description="Not yet published" tone="orange" icon={FileText} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Closing Soon" value={formatNumber(metrics.closingSoon)} description="Within 14 days" tone="purple" icon={CalendarClock} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileFilterControls
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={isJobScope ? 'Search jobs by title, location or department...' : 'Search posts...'}
        tabs={tabs}
        value={statusFilter}
        onChange={(value) => setStatusFilter(value as PostStatusFilter)}
        primaryAction={canManagePosts ? { label: isJobScope ? 'New Job' : 'New Post', icon: Plus, onPress: () => openForm() } : null}
        secondaryActions={[
          { label: 'Sort', icon: CalendarClock, variant: 'secondary', onPress: () => setSortOpen(true) },
        ]}
        actionSlot={<MobileReportExportButton fullWidth options={postReportOptions} onSuccess={(_uri, format) => setNotice(`${format.toUpperCase()} ${isJobScope ? 'jobs' : 'posts'} report is ready.`)} onError={(exportError) => setError(getApiErrorMessage(exportError))} />}
      />

      {visiblePosts.length === 0 && !loading ? (
        <MobileEmptyState
          title={isJobScope ? 'No jobs found' : 'No posts found'}
          description={searchTerm ? 'Adjust search or status filters to see more records.' : isJobScope ? 'Create the first job opportunity for members.' : 'Create the first job or tender post.'}
          actionLabel={canManagePosts ? (isJobScope ? 'New Job' : 'New Post') : undefined}
          onAction={canManagePosts ? () => openForm() : undefined}
        />
      ) : (
        <MobileDataList items={listItems} onPressItem={openPost} />
      )}

      <MobileSheet
        visible={Boolean(selectedPost)}
        title={selectedPost?.title || `${title} details`}
        description={selectedPost ? `${postTypeLabel(selectedPost.postType)} profile` : undefined}
        onClose={() => setSelectedPost(null)}
      >
        {selectedPost ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>
            <View style={styles.badges}>
              <MobileStatusBadge status={postTypeLabel(selectedPost.postType)} tone="primary" />
              <MobileStatusBadge status={selectedPost.status} tone={postStatusTone(selectedPost.status)} />
              {selectedPost.deadlineDate ? <MobileStatusBadge status="Deadline" label={`Due ${formatDate(selectedPost.deadlineDate)}`} tone={deadlineTone(selectedPost, nowMs)} /> : null}
            </View>

            <View style={styles.detailActions}>
              {selectedPost.applicationEmail ? <MobileButton label="Email" icon={Mail} variant="secondary" onPress={() => void Linking.openURL(`mailto:${selectedPost.applicationEmail}`)} size="sm" /> : null}
              {selectedPost.applicationLink ? <MobileButton label="Open Link" icon={ExternalLink} variant="secondary" onPress={() => void Linking.openURL(selectedPost.applicationLink || '')} size="sm" /> : null}
              {canManagePosts ? (
                <>
                  <MobileButton label="Edit" icon={Edit3} variant="secondary" onPress={() => openForm(selectedPost)} size="sm" />
                  {selectedPost.status !== 'ACTIVE' ? (
                    <MobileButton label="Publish" icon={Send} onPress={() => setConfirmAction({ kind: 'publish', post: selectedPost })} loading={actionLoading === `publish:${selectedPost.id}`} size="sm" />
                  ) : (
                    <MobileButton label="Notify" icon={BellRing} variant="secondary" onPress={() => setConfirmAction({ kind: 'notify', post: selectedPost })} loading={actionLoading === `notify:${selectedPost.id}`} size="sm" />
                  )}
                  <MobileButton label="Delete" icon={Trash2} variant="danger" onPress={() => setConfirmAction({ kind: 'delete', post: selectedPost })} loading={actionLoading === `delete:${selectedPost.id}`} size="sm" />
                </>
              ) : null}
            </View>

            <MobileCard compact>
              <MobileInfoRow label="Department" value={selectedPost.departmentUnit || 'Not recorded'} icon={BriefcaseBusiness} />
              <MobileInfoRow label="Location" value={selectedPost.locationRegion || 'Not recorded'} icon={MapPin} />
              <MobileInfoRow label="Deadline" value={formatDate(selectedPost.deadlineDate)} icon={CalendarClock} />
              <MobileInfoRow label="Created" value={formatDate(selectedPost.createdAt)} />
              <MobileInfoRow label="Updated" value={formatDate(selectedPost.updatedAt)} />
            </MobileCard>

            {selectedPost.description ? (
              <MobileCard compact>
                <MobileText variant="small" tone="secondary" weight="bold">
                  Description
                </MobileText>
                <MobileText variant="body">{selectedPost.description}</MobileText>
              </MobileCard>
            ) : null}

            {selectedPost.postType === 'JOB' ? <JobDetailCard post={selectedPost} /> : <TenderDetailCard post={selectedPost} />}
          </ScrollView>
        ) : null}
      </MobileSheet>

      <MobileSortSheet visible={sortOpen} value={sortValue} options={sortOptions} onChange={(value) => setSortValue(value as PostSortOption)} onClose={() => setSortOpen(false)} />

      <MobileConfirmSheet
        visible={Boolean(confirmAction)}
        title={confirmTitle(confirmAction)}
        description={confirmDescription(confirmAction)}
        confirmLabel={confirmLabel(confirmAction, actionLoading)}
        destructive={confirmAction?.kind === 'delete'}
        onCancel={() => setConfirmAction(null)}
        onConfirm={runConfirmedAction}
      />
    </MobileScreen>
  );
}

function JobDetailCard({ post }: { post: CommunityPost }) {
  return (
    <MobileCard compact>
      <MobileInfoRow label="Employment Type" value={labelFromEnum(post.employmentType)} icon={BriefcaseBusiness} />
      <MobileInfoRow label="Positions" value={post.positionsCount ? formatNumber(post.positionsCount) : 'Not recorded'} />
      <MobileInfoRow label="Experience" value={post.experienceYears ? `${formatNumber(post.experienceYears)} years` : 'Not recorded'} />
      <MobileInfoRow label="Qualifications" value={post.requiredQualifications || 'Not recorded'} />
      <MobileInfoRow label="Skills" value={post.skillsCompetencies || 'Not recorded'} />
      <MobileInfoRow label="Application" value={post.applicationEmail || post.applicationLink || 'Not recorded'} />
      <MobileInfoRow label="Document" value={post.jobDescriptionPath ? 'Attached' : 'Not attached'} icon={FileText} />
    </MobileCard>
  );
}

function TenderDetailCard({ post }: { post: CommunityPost }) {
  return (
    <MobileCard compact>
      <MobileInfoRow label="Reference" value={post.tenderReferenceNumber || 'Not recorded'} icon={FileText} />
      <MobileInfoRow label="Category" value={post.tenderCategory || 'Not recorded'} />
      <MobileInfoRow label="Opening" value={formatDate(post.openingDateTime)} />
      <MobileInfoRow label="Eligibility" value={post.eligibilityCriteria || 'Not recorded'} />
      <MobileInfoRow label="Instructions" value={post.submissionInstructions || 'Not recorded'} />
      <MobileInfoRow label="Contact" value={post.contactPersonEmail || 'Not recorded'} />
      <MobileInfoRow label="Document" value={post.tenderDocumentPath ? 'Attached' : 'Not attached'} />
    </MobileCard>
  );
}

function postTypeLabel(type?: CommunityPostType | null) {
  const value = String(type || '').toUpperCase();
  if (value === 'JOB') return 'Job';
  if (value === 'TENDER') return 'Tender';
  return 'Post';
}

function postStatusTone(status?: CommunityPostStatus | null): StatusTone {
  const value = String(status || '').toUpperCase();
  if (value === 'ACTIVE') return 'success';
  if (value === 'CLOSED') return 'neutral';
  if (value === 'DRAFT') return 'warning';
  return 'primary';
}

function deadlineTone(post: CommunityPost, nowMs: number): StatusTone {
  if (!post.deadlineDate) return 'neutral';
  const time = new Date(post.deadlineDate).getTime();
  if (!Number.isFinite(time)) return 'neutral';
  if (time < nowMs) return 'danger';
  if (time <= nowMs + 14 * 24 * 60 * 60 * 1000) return 'warning';
  return 'primary';
}

function dateValue(value?: string | null) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function deadlineValue(value?: string | null) {
  const time = value ? new Date(value).getTime() : Number.MAX_SAFE_INTEGER;
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

function labelFromEnum(value?: string | null) {
  if (!value) return 'Not recorded';
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function hasPostManagePermission(user: { permissions?: string[]; roles?: string[]; associationRole?: string } | null) {
  const values = [...(user?.permissions || []), ...(user?.roles || []), user?.associationRole || ''].map((value) => value.toLowerCase());
  return values.some((value) =>
    ['community.manage', 'posts_manage', 'association_admin', 'admin'].includes(value),
  );
}

function confirmTitle(action: ConfirmAction) {
  if (action?.kind === 'delete') return `Delete ${postTypeLabel(action.post.postType).toLowerCase()}`;
  if (action?.kind === 'publish') return `Publish ${postTypeLabel(action.post.postType).toLowerCase()}`;
  if (action?.kind === 'notify') return 'Send notifications';
  return 'Confirm action';
}

function confirmDescription(action: ConfirmAction) {
  if (!action) return '';
  if (action.kind === 'delete') return `Delete "${action.post.title}"? This cannot be undone.`;
  if (action.kind === 'publish') return `Publish "${action.post.title}" and notify eligible members according to notification settings?`;
  return `Send notifications for "${action.post.title}" to eligible members according to notification settings?`;
}

function confirmLabel(action: ConfirmAction, loading: string | null) {
  if (!action) return 'Confirm';
  if (loading === `${action.kind}:${action.post.id}`) return 'Working...';
  if (action.kind === 'delete') return 'Delete';
  if (action.kind === 'publish') return 'Publish';
  return 'Send';
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
    gap: 14,
    paddingBottom: 14,
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
});
