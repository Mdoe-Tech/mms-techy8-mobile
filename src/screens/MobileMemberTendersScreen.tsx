import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import {
  CalendarClock,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  Link as LinkIcon,
  Mail,
  MapPin,
  RefreshCw,
  Scale,
  SearchCheck,
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
  MobileToast,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import { downloadAssociationFile } from '@/services/association-service';
import { getCurrentMemberByUserId, type AssociationMember } from '@/services/member-service';
import { getAssociationPosts, type CommunityPost, type CommunityPostStatus } from '@/services/post-service';
import { type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber } from '@/utils/format';

type TenderFilter = 'all' | 'ACTIVE' | 'CLOSED';
type TenderSort = 'deadlineAsc' | 'createdDesc' | 'titleAsc' | 'openingAsc';
type Notice = { title: string; description?: string; tone?: StatusTone } | null;

const PAGE_SIZE = 100;

const sortOptions: MobileSortOption[] = [
  { value: 'deadlineAsc', label: 'Deadline soonest', description: 'Tenders closing soon appear first.' },
  { value: 'createdDesc', label: 'Newest first', description: 'Recently posted tenders appear first.' },
  { value: 'titleAsc', label: 'Title A-Z', description: 'Sort alphabetically by tender title.' },
  { value: 'openingAsc', label: 'Opening date', description: 'Sort by public opening schedule.' },
];

export default function MobileMemberTendersScreen() {
  const { activeView, associationId, user } = useAuth();
  const [member, setMember] = useState<AssociationMember | null>(null);
  const [tenders, setTenders] = useState<CommunityPost[]>([]);
  const [selectedTender, setSelectedTender] = useState<CommunityPost | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<TenderFilter>('all');
  const [sortValue, setSortValue] = useState<TenderSort>('deadlineAsc');
  const [sortOpen, setSortOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const userId = user?.userId;

  const loadTenders = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!userId || !associationId) {
        setLoading(false);
        setError('Member and association context are required before opening tenders.');
        return;
      }

      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);
      setNotice(null);

      try {
        const currentMember = await getCurrentMemberByUserId(userId);
        const memberAssociationId = currentMember.associationId || associationId;
        const response = await getAssociationPosts(memberAssociationId, {
          size: PAGE_SIZE,
          sort: 'createdAt,desc',
        });
        const memberVisibleTenders = response.posts.filter((post) => post.postType === 'TENDER' && post.status !== 'DRAFT');
        setMember(currentMember);
        setTenders(memberVisibleTenders);
        setSelectedTender((current) => memberVisibleTenders.find((tender) => tender.id === current?.id) || null);
      } catch (loadError) {
        setTenders([]);
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
      void Promise.resolve().then(() => loadTenders());
    }
  }, [activeView, loadTenders]);

  const summary = useMemo(() => buildSummary(tenders), [tenders]);
  const filteredTenders = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    const filtered = tenders.filter((tender) => {
      if (statusFilter !== 'all' && tender.status !== statusFilter) return false;
      if (!needle) return true;
      return [
        tender.title,
        tender.description,
        tender.locationRegion,
        tender.tenderReferenceNumber,
        tender.tenderCategory,
        tender.eligibilityCriteria,
        tender.submissionInstructions,
        tender.contactPersonEmail,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });

    return sortTenders(filtered, sortValue);
  }, [searchTerm, sortValue, statusFilter, tenders]);

  const tabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: summary.total },
      { value: 'ACTIVE', label: 'Active', count: summary.active },
      { value: 'CLOSED', label: 'Closed', count: summary.closed },
    ],
    [summary],
  );

  const listItems = useMemo<MobileDataListItem[]>(
    () =>
      filteredTenders.map((tender) => ({
        id: tender.id,
        title: tender.title,
        subtitle: [tender.tenderCategory || 'Tender', tender.locationRegion || 'Location not recorded'].join(' · '),
        meta: tender.deadlineDate ? `Deadline ${formatDate(tender.deadlineDate)}` : 'No deadline recorded',
        status: tenderStatusLabel(tender.status),
        statusTone: tenderStatusTone(tender.status),
        initials: 'TN',
        accent: tender.status === 'ACTIVE' ? 'success' : 'neutral',
      })),
    [filteredTenders],
  );

  const downloadTenderDocument = async (tender: CommunityPost) => {
    if (!tender.tenderDocumentPath) return;
    setDownloadingId(tender.id);
    setError(null);
    setNotice(null);

    try {
      const downloaded = await downloadAssociationFile(tender.tenderDocumentPath);
      const fileName = safeFileName(`tender-${tender.tenderReferenceNumber || tender.id}-${downloaded.filename}`);
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, arrayBufferToBase64(downloaded.data), {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: downloaded.contentType,
          dialogTitle: 'Share tender document',
        });
      }
      setNotice({ title: 'Tender document ready', description: fileName });
    } catch (downloadError) {
      setError(getApiErrorMessage(downloadError));
    } finally {
      setDownloadingId(null);
    }
  };

  if (activeView !== 'MEMBER') {
    return (
      <AccessDeniedScreen
        title="Member workspace required"
        description="Tender notices are available from the member portal workspace."
      />
    );
  }

  if (loading) {
    return <MobilePageLoadingState kind="list" message="Loading tenders" />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Community"
        title="Tenders"
        subtitle={member?.membershipNumber || user?.associationName || 'Member portal'}
        onBack={() => router.back()}
        rightAction={<MobileStatusBadge status={refreshing ? 'Refreshing' : 'Ready'} tone={refreshing ? 'info' : 'success'} />}
      />

      {notice ? <MobileToast title={notice.title} description={notice.description} tone={notice.tone || 'success'} /> : null}
      {error ? (
        <MobileErrorState
          title="Tenders could not load"
          description={error}
          retryLabel="Retry"
          onRetry={() => void loadTenders('refresh')}
        />
      ) : null}

      <MobileSummaryPanel
        title="Tender Portal"
        value={formatNumber(summary.total)}
        description={summary.active > 0 ? `${formatNumber(summary.active)} active bidding opportunities` : 'Archived bidding opportunities and contract notices'}
        icon={FileText}
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
              onPress={() => void loadTenders('refresh')}
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
              Tender Register
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Showing {formatNumber(filteredTenders.length)} of {formatNumber(summary.total)} member-visible tenders.
            </MobileText>
          </View>
          <MobileStatusBadge status={summary.active > 0 ? 'Active' : 'Archive'} tone={summary.active > 0 ? 'success' : 'neutral'} />
        </View>
        <MobileSearchToolbar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search tenders"
          onFilterPress={() => setSortOpen(true)}
          filterLabel="Sort"
        />
        <MobileStatusTabs tabs={tabs} value={statusFilter} onChange={(value) => setStatusFilter(value as TenderFilter)} />
      </MobileCard>

      {filteredTenders.length > 0 ? (
        <MobileDataList
          items={listItems}
          onPressItem={(item) => {
            const tender = filteredTenders.find((entry) => entry.id === item.id);
            if (tender) setSelectedTender(tender);
          }}
        />
      ) : (
        <MobileEmptyState
          title={searchTerm || statusFilter !== 'all' ? 'No matching tenders' : 'No tender notices'}
          description={
            searchTerm || statusFilter !== 'all'
              ? 'Adjust search or status tabs to see more tender notices.'
              : 'Bidding opportunities and contract notices will appear here when published.'
          }
          actionLabel={searchTerm || statusFilter !== 'all' ? 'Clear filters' : 'Refresh'}
          onAction={() => {
            if (searchTerm || statusFilter !== 'all') {
              setSearchTerm('');
              setStatusFilter('all');
            } else {
              void loadTenders('refresh');
            }
          }}
        />
      )}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Active" value={formatNumber(summary.active)} description="Open for bidding" icon={Scale} tone="green" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Closed" value={formatNumber(summary.closed)} description="Archived tenders" icon={Clock3} tone="slate" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Documents" value={formatNumber(summary.withDocuments)} description="Tender files attached" icon={Download} tone="purple" />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <TenderDetailSheet
        tender={selectedTender}
        downloading={selectedTender ? downloadingId === selectedTender.id : false}
        onClose={() => setSelectedTender(null)}
        onDownload={downloadTenderDocument}
      />

      <MobileSortSheet
        visible={sortOpen}
        value={sortValue}
        options={sortOptions}
        onChange={(value) => setSortValue(value as TenderSort)}
        onClose={() => setSortOpen(false)}
      />
    </MobileScreen>
  );
}

function TenderDetailSheet({
  tender,
  downloading,
  onClose,
  onDownload,
}: {
  tender: CommunityPost | null;
  downloading: boolean;
  onClose: () => void;
  onDownload: (tender: CommunityPost) => void;
}) {
  if (!tender) return null;

  return (
    <MobileSheet
      visible={Boolean(tender)}
      title={tender.title}
      description={`${tenderStatusLabel(tender.status)} tender · ${tender.locationRegion || 'Location not recorded'}`}
      onClose={onClose}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailContent}>
        <MobileCard compact accent={tender.status === 'ACTIVE' ? 'green' : 'slate'}>
          <View style={styles.detailHeader}>
            <View style={styles.flex}>
              <MobileStatusBadge status={tenderStatusLabel(tender.status)} tone={tenderStatusTone(tender.status)} />
              <MobileText variant="section" weight="bold">
                {tender.deadlineDate ? `Bid deadline ${formatDate(tender.deadlineDate)}` : 'Bid deadline not recorded'}
              </MobileText>
              <MobileText variant="small" tone="secondary">
                {tender.tenderReferenceNumber || 'Reference not recorded'}
              </MobileText>
            </View>
            <MobileStatusBadge status={tender.tenderCategory || 'Tender'} tone="review" />
          </View>
        </MobileCard>

        <MobileCard compact>
          <MobileInfoRow label="Reference" value={tender.tenderReferenceNumber || 'Not recorded'} icon={FileText} />
          <MobileInfoRow label="Category" value={tender.tenderCategory || 'Not recorded'} icon={Scale} />
          <MobileInfoRow label="Location" value={tender.locationRegion || 'Not recorded'} icon={MapPin} />
          <MobileInfoRow label="Deadline" value={formatDate(tender.deadlineDate)} icon={CalendarClock} />
          <MobileInfoRow label="Opening" value={formatDate(tender.openingDateTime)} icon={Clock3} />
          <MobileInfoRow label="Contact" value={tender.contactPersonEmail || 'Not recorded'} icon={Mail} />
        </MobileCard>

        {tender.description ? (
          <MobileCard compact>
            <MobileText variant="section" weight="bold">
              Description
            </MobileText>
            <MobileText variant="small" tone="secondary">
              {tender.description}
            </MobileText>
          </MobileCard>
        ) : null}

        <MobileCard compact>
          <MobileInfoRow label="Eligibility" value={tender.eligibilityCriteria || 'Not recorded'} />
          <MobileInfoRow label="Submission" value={tender.submissionInstructions || 'Not recorded'} />
          <MobileInfoRow label="Tender Document" value={tender.tenderDocumentPath ? 'Attached' : 'Not attached'} icon={Download} />
          <MobileInfoRow label="Collection Portal" value={tender.documentCollectionLink ? 'Available' : 'Not recorded'} icon={LinkIcon} />
        </MobileCard>

        <View style={styles.actions}>
          {tender.tenderDocumentPath ? <MobileButton label="Download" icon={Download} loading={downloading} onPress={() => onDownload(tender)} /> : null}
          {tender.documentCollectionLink ? <MobileButton label="Portal" icon={ExternalLink} variant="secondary" onPress={() => void openLink(tender.documentCollectionLink)} /> : null}
          {tender.contactPersonEmail ? <MobileButton label="Contact" icon={Mail} variant="secondary" onPress={() => void Linking.openURL(`mailto:${tender.contactPersonEmail}`)} /> : null}
        </View>

        <MobileButton
          label="Share Tender"
          icon={Share2}
          variant="secondary"
          fullWidth
          onPress={() => void shareTender(tender)}
        />
      </ScrollView>
    </MobileSheet>
  );
}

function buildSummary(tenders: CommunityPost[]) {
  return {
    total: tenders.length,
    active: tenders.filter((tender) => tender.status === 'ACTIVE').length,
    closed: tenders.filter((tender) => tender.status === 'CLOSED').length,
    withDocuments: tenders.filter((tender) => Boolean(tender.tenderDocumentPath)).length,
  };
}

function sortTenders(tenders: CommunityPost[], sortValue: TenderSort) {
  return [...tenders].sort((left, right) => {
    if (sortValue === 'createdDesc') return dateValue(right.createdAt) - dateValue(left.createdAt);
    if (sortValue === 'titleAsc') return left.title.localeCompare(right.title);
    if (sortValue === 'openingAsc') return deadlineValue(left.openingDateTime) - deadlineValue(right.openingDateTime);
    return deadlineValue(left.deadlineDate) - deadlineValue(right.deadlineDate);
  });
}

function tenderStatusLabel(status?: CommunityPostStatus | null) {
  return labelFromEnum(status || 'Unknown');
}

function tenderStatusTone(status?: CommunityPostStatus | null): StatusTone {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'ACTIVE') return 'success';
  if (normalized === 'CLOSED') return 'neutral';
  if (normalized === 'DRAFT') return 'review';
  return 'primary';
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

async function shareTender(tender: CommunityPost) {
  await Share.share({
    title: tender.title,
    message: `${tender.title}\nReference: ${tender.tenderReferenceNumber || 'N/A'}\nDeadline: ${formatDate(tender.deadlineDate)}`,
  });
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'tender-document';
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  if (typeof globalThis.btoa !== 'function') {
    throw new Error('This device cannot encode the downloaded tender document.');
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
