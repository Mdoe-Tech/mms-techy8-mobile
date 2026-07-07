import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import {
  Award,
  BriefcaseBusiness,
  Building2,
  Download,
  FileText,
  Globe,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  SearchCheck,
  UserRound,
  Users,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

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
  MobileSelect,
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
import {
  getCurrentMemberByUserId,
  getMemberDirectory,
  type AssociationMember,
  type MemberDirectoryMember,
} from '@/services/member-service';
import { getApiErrorMessage } from '@/types/api';
import { formatNumber, initialsFromName } from '@/utils/format';

type DirectoryTab = 'all' | 'business' | 'contactable';
type DirectorySort = 'nameAsc' | 'businessAsc' | 'locationAsc' | 'profileDesc';
type Notice = { title: string; description?: string; tone?: 'success' | 'info' | 'warning' | 'danger' } | null;

const ALL = '__all__';

const sortOptions: MobileSortOption[] = [
  { value: 'nameAsc', label: 'Name A-Z', description: 'Sort members alphabetically.' },
  { value: 'businessAsc', label: 'Industry A-Z', description: 'Group similar business fields together.' },
  { value: 'locationAsc', label: 'Location A-Z', description: 'Sort by recorded location.' },
  { value: 'profileDesc', label: 'Business profiles first', description: 'Show richer member profiles first.' },
];

export default function MobileMemberDirectoryScreen() {
  const { activeView, associationId, user } = useAuth();
  const [currentMember, setCurrentMember] = useState<AssociationMember | null>(null);
  const [members, setMembers] = useState<MemberDirectoryMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberDirectoryMember | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [tab, setTab] = useState<DirectoryTab>('all');
  const [industry, setIndustry] = useState(ALL);
  const [location, setLocation] = useState(ALL);
  const [businessType, setBusinessType] = useState(ALL);
  const [sortValue, setSortValue] = useState<DirectorySort>('profileDesc');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const userId = user?.userId;

  const loadDirectory = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!userId || !associationId) {
        setLoading(false);
        setError('Member and association context are required before opening the directory.');
        return;
      }

      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);
      setNotice(null);

      try {
        const member = await getCurrentMemberByUserId(userId);
        const directory = await getMemberDirectory({
          associationId: member.associationId || associationId,
          size: 500,
          sort: 'fullLegalName,asc',
        });
        setCurrentMember(member);
        setMembers(directory.content);
        setSelectedMember((current) => directory.content.find((item) => item.id === current?.id) || null);
      } catch (loadError) {
        setMembers([]);
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
      void Promise.resolve().then(() => loadDirectory());
    }
  }, [activeView, loadDirectory]);

  const summary = useMemo(() => buildSummary(members), [members]);
  const industries = useMemo(() => uniqueOptions(members, (member) => member.businessField), [members]);
  const locations = useMemo(() => uniqueOptions(members, getLocation), [members]);
  const businessTypes = useMemo(
    () => uniqueOptions(members, (member) => member.businessServices || member.occupation || member.employer),
    [members],
  );

  const filteredMembers = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    const filtered = members.filter((member) => {
      if (tab === 'business' && !hasBusinessInfo(member)) return false;
      if (tab === 'contactable' && !hasContact(member)) return false;
      if (industry !== ALL && member.businessField !== industry) return false;
      if (location !== ALL && getLocation(member) !== location) return false;
      const memberBusinessType = member.businessServices || member.occupation || member.employer || '';
      if (businessType !== ALL && memberBusinessType !== businessType) return false;
      if (!needle) return true;
      return [
        member.fullLegalName,
        member.businessName,
        member.businessField,
        member.occupation,
        member.employer,
        member.businessServices,
        member.companyProfile,
        member.keyProjects,
        member.certifications,
        member.website,
        getLocation(member),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });

    return sortDirectory(filtered, sortValue);
  }, [businessType, industry, location, members, searchTerm, sortValue, tab]);

  const tabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: summary.total },
      { value: 'business', label: 'Business', count: summary.businessProfiles },
      { value: 'contactable', label: 'Contact', count: summary.contactable },
    ],
    [summary],
  );

  const listItems = useMemo<MobileDataListItem[]>(
    () =>
      filteredMembers.map((member) => {
        const displayName = getDisplayName(member);
        const industryLabel = member.businessField || member.occupation || 'Member';
        return {
          id: member.id,
          title: displayName,
          subtitle: member.businessName ? `by ${member.fullLegalName || 'Member'}` : industryLabel,
          meta: getLocation(member) || getProfileSummary(member) || 'Business profile not added yet',
          status: 'Active',
          statusTone: 'success',
          initials: initialsFromName(displayName),
          accent: hasBusinessInfo(member) ? 'primary' : 'neutral',
        };
      }),
    [filteredMembers],
  );

  const resetFilters = () => {
    setIndustry(ALL);
    setLocation(ALL);
    setBusinessType(ALL);
    setTab('all');
    setSearchTerm('');
  };

  const downloadProfileDocument = async (member: MemberDirectoryMember) => {
    if (!member.companyProfileDocumentPath) return;
    setDownloadingId(member.id);
    setError(null);
    setNotice(null);
    try {
      const downloaded = await downloadAssociationFile(member.companyProfileDocumentPath);
      const fileName = safeFileName(`directory-profile-${member.businessName || member.fullLegalName || member.id}-${downloaded.filename}`);
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, arrayBufferToBase64(downloaded.data), {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: downloaded.contentType,
          dialogTitle: 'Share company profile',
        });
      }
      setNotice({ title: 'Company profile ready', description: fileName, tone: 'success' });
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
        description="The member directory is available from the member portal workspace."
      />
    );
  }

  if (loading) {
    return <MobilePageLoadingState kind="list" message="Loading member directory" />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Community"
        title="Member Directory"
        subtitle={currentMember?.membershipNumber || user?.associationName || 'Member portal'}
        onBack={() => router.back()}
        rightAction={<MobileStatusBadge status={refreshing ? 'Refreshing' : 'Ready'} tone={refreshing ? 'info' : 'success'} />}
      />

      {notice ? <MobileToast title={notice.title} description={notice.description} tone={notice.tone || 'success'} /> : null}
      {error ? (
        <MobileErrorState
          title="Directory could not load"
          description={error}
          retryLabel="Retry"
          onRetry={() => void loadDirectory('refresh')}
        />
      ) : null}

      <MobileSummaryPanel
        title="Association Network"
        value={formatNumber(summary.total)}
        description="Find fellow members, business profiles, contact links, and shared company documents."
        icon={Users}
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
              onPress={() => void loadDirectory('refresh')}
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

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Members" value={formatNumber(summary.total)} description="Active profiles" icon={Users} tone="blue" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Businesses" value={formatNumber(summary.businessProfiles)} description="With public profile" icon={Building2} tone="green" />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard compact>
        <View style={styles.toolbarHeader}>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold">
              Directory
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Showing {formatNumber(filteredMembers.length)} of {formatNumber(summary.total)} active members.
            </MobileText>
          </View>
          <MobileStatusBadge status={`${formatNumber(summary.contactable)} contactable`} tone="info" />
        </View>

        <MobileSearchToolbar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Find"
          onFilterPress={() => setFilterOpen(true)}
          filterLabel="Filters"
        />

        <View style={styles.tabsWrap}>
          <MobileStatusTabs tabs={tabs} value={tab} onChange={(value) => setTab(value as DirectoryTab)} />
        </View>

        {filteredMembers.length ? (
          <MobileDataList
            items={listItems}
            onPressItem={(item) => setSelectedMember(filteredMembers.find((member) => member.id === item.id) || null)}
          />
        ) : (
          <MobileEmptyState
            title="No profiles found"
            description={members.length ? 'Try changing the search or filters.' : 'No active members are visible in the directory yet.'}
            actionLabel={members.length ? 'Clear filters' : 'Refresh'}
            onAction={members.length ? resetFilters : () => void loadDirectory('refresh')}
          />
        )}
      </MobileCard>

      <DirectoryFilterSheet
        visible={filterOpen}
        industry={industry}
        location={location}
        businessType={businessType}
        industries={industries}
        locations={locations}
        businessTypes={businessTypes}
        onChangeIndustry={setIndustry}
        onChangeLocation={setLocation}
        onChangeBusinessType={setBusinessType}
        onReset={resetFilters}
        onClose={() => setFilterOpen(false)}
      />

      <MobileSortSheet
        visible={sortOpen}
        value={sortValue}
        options={sortOptions}
        onChange={(value) => setSortValue(value as DirectorySort)}
        onClose={() => setSortOpen(false)}
      />

      <DirectoryDetailSheet
        member={selectedMember}
        downloading={downloadingId === selectedMember?.id}
        onClose={() => setSelectedMember(null)}
        onDownload={downloadProfileDocument}
      />
    </MobileScreen>
  );
}

function DirectoryFilterSheet({
  visible,
  industry,
  location,
  businessType,
  industries,
  locations,
  businessTypes,
  onChangeIndustry,
  onChangeLocation,
  onChangeBusinessType,
  onReset,
  onClose,
}: {
  visible: boolean;
  industry: string;
  location: string;
  businessType: string;
  industries: string[];
  locations: string[];
  businessTypes: string[];
  onChangeIndustry: (value: string) => void;
  onChangeLocation: (value: string) => void;
  onChangeBusinessType: (value: string) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  return (
    <MobileSheet visible={visible} title="Directory filters" description="Narrow members by business and location." onClose={onClose}>
      <View style={styles.sheetContent}>
        <MobileSelect
          label="Industry"
          value={industry}
          options={[{ label: 'All industries', value: ALL }, ...industries.map((value) => ({ label: value, value }))]}
          onChange={onChangeIndustry}
        />
        <MobileSelect
          label="Location"
          value={location}
          options={[{ label: 'All locations', value: ALL }, ...locations.map((value) => ({ label: value, value }))]}
          onChange={onChangeLocation}
        />
        <MobileSelect
          label="Business type"
          value={businessType}
          options={[{ label: 'All business types', value: ALL }, ...businessTypes.map((value) => ({ label: value, value }))]}
          onChange={onChangeBusinessType}
        />
        <View style={styles.actions}>
          <MobileButton label="Reset filters" variant="secondary" fullWidth onPress={onReset} />
          <MobileButton label="Apply filters" fullWidth onPress={onClose} />
        </View>
      </View>
    </MobileSheet>
  );
}

function DirectoryDetailSheet({
  member,
  downloading,
  onClose,
  onDownload,
}: {
  member: MemberDirectoryMember | null;
  downloading: boolean;
  onClose: () => void;
  onDownload: (member: MemberDirectoryMember) => void;
}) {
  if (!member) return null;
  const displayName = getDisplayName(member);
  const email = getEmailContact(member);
  const phone = getPhoneContact(member);
  const website = normalizeWebsite(member.website);
  const location = getLocation(member);

  return (
    <MobileSheet
      visible={Boolean(member)}
      title={displayName}
      description={member.businessName ? `by ${member.fullLegalName || 'Member'}` : 'Association member profile'}
      onClose={onClose}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailScroll}>
      <MobileCard compact accent={hasBusinessInfo(member) ? 'blue' : 'slate'}>
          <MobileInfoRow label="Member" value={member.fullLegalName || 'Member'} icon={UserRound} />
          <MobileInfoRow label="Industry" value={member.businessField || member.occupation || 'Not recorded'} icon={BriefcaseBusiness} />
          <MobileInfoRow label="Location" value={location || 'Not recorded'} icon={MapPin} />
          <MobileInfoRow label="Status" value="Active" icon={Users} status="Active" />
        </MobileCard>

        <ContactActions member={member} email={email} phone={phone} website={website} />

        <ProfileSection title="Company Overview" icon={Building2} value={member.companyProfile} empty="No company overview provided yet." />
        <ProfileSection title="Services & Products" icon={BriefcaseBusiness} value={member.businessServices || member.employer} />
        <ProfileSection title="Key Projects" icon={FileText} value={member.keyProjects} />
        <ProfileSection title="Certifications & Awards" icon={Award} value={member.certifications} />

        {member.companyProfileDocumentPath ? (
          <MobileCard compact>
            <View style={styles.documentRow}>
              <View style={styles.flex}>
                <MobileText variant="body" weight="bold">
                  Company Profile
                </MobileText>
                <MobileText variant="small" tone="secondary" numberOfLines={1}>
                  {getDocumentName(member.companyProfileDocumentPath)}
                </MobileText>
              </View>
              <MobileButton
                label="Download"
                icon={Download}
                size="sm"
                loading={downloading}
                disabled={downloading}
                onPress={() => onDownload(member)}
              />
            </View>
          </MobileCard>
        ) : null}
      </ScrollView>
    </MobileSheet>
  );
}

function ContactActions({
  member,
  email,
  phone,
  website,
}: {
  member: MemberDirectoryMember;
  email?: string;
  phone?: string;
  website?: string;
}) {
  if (!email && !phone && !website) {
    return (
      <MobileCard compact>
        <MobileText variant="body" weight="bold">
          Contact
        </MobileText>
        <MobileText variant="small" tone="secondary">
          This member has not shared public contact links.
        </MobileText>
      </MobileCard>
    );
  }

  return (
    <View style={styles.actions}>
      {email ? (
        <MobileButton
          label="Email"
          icon={Mail}
          variant="secondary"
          fullWidth
          onPress={() => void Linking.openURL(member.contactInfo?.emailLink || `mailto:${email}`)}
        />
      ) : null}
      {phone ? (
        <MobileButton
          label="Call"
          icon={Phone}
          variant="secondary"
          fullWidth
          onPress={() => void Linking.openURL(member.contactInfo?.phoneLink || `tel:${phone}`)}
        />
      ) : null}
      {website ? (
        <MobileButton
          label="Website"
          icon={Globe}
          variant="secondary"
          fullWidth
          onPress={() => void Linking.openURL(website)}
        />
      ) : null}
    </View>
  );
}

function ProfileSection({
  title,
  icon: Icon,
  value,
  empty,
}: {
  title: string;
  icon: typeof Building2;
  value?: string | null;
  empty?: string;
}) {
  if (!value && !empty) return null;

  return (
    <MobileCard compact>
      <View style={styles.sectionTitle}>
        <Icon size={17} color="#2563EB" strokeWidth={2.5} />
        <MobileText variant="body" weight="bold">
          {title}
        </MobileText>
      </View>
      <MobileText variant="small" tone={value ? 'secondary' : 'muted'} style={styles.paragraph}>
        {value || empty}
      </MobileText>
    </MobileCard>
  );
}

function buildSummary(members: MemberDirectoryMember[]) {
  const businessProfiles = members.filter(hasBusinessInfo).length;
  const contactable = members.filter(hasContact).length;
  const locationCount = uniqueOptions(members, getLocation).length;
  return {
    total: members.length,
    businessProfiles,
    contactable,
    locationCount,
  };
}

function uniqueOptions(members: MemberDirectoryMember[], selector: (member: MemberDirectoryMember) => string | null | undefined) {
  return Array.from(
    new Set(
      members
        .map(selector)
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

function sortDirectory(members: MemberDirectoryMember[], sortValue: DirectorySort) {
  return [...members].sort((a, b) => {
    if (sortValue === 'businessAsc') {
      return (a.businessField || a.occupation || '').localeCompare(b.businessField || b.occupation || '') || getDisplayName(a).localeCompare(getDisplayName(b));
    }
    if (sortValue === 'locationAsc') {
      return (getLocation(a) || '').localeCompare(getLocation(b) || '') || getDisplayName(a).localeCompare(getDisplayName(b));
    }
    if (sortValue === 'profileDesc') {
      return Number(hasBusinessInfo(b)) - Number(hasBusinessInfo(a)) || getDisplayName(a).localeCompare(getDisplayName(b));
    }
    return getDisplayName(a).localeCompare(getDisplayName(b));
  });
}

function getDisplayName(member: MemberDirectoryMember) {
  return member.businessName || member.fullLegalName || 'Member';
}

function getLocation(member: MemberDirectoryMember) {
  return member.contactInfo?.physicalAddress || null;
}

function getEmailContact(member: MemberDirectoryMember) {
  return member.contactInfo?.emailLink?.replace(/^mailto:/, '') || member.contactInfo?.email || undefined;
}

function getPhoneContact(member: MemberDirectoryMember) {
  return member.contactInfo?.phoneLink?.replace(/^tel:/, '') || member.contactInfo?.phoneNumber || undefined;
}

function getProfileSummary(member: MemberDirectoryMember) {
  return member.companyProfile || member.businessServices || member.keyProjects || member.certifications || member.employer || member.occupation || undefined;
}

function hasBusinessInfo(member: MemberDirectoryMember) {
  return Boolean(
    member.businessName ||
      member.businessField ||
      member.occupation ||
      member.employer ||
      member.businessServices ||
      member.companyProfile ||
      member.keyProjects ||
      member.certifications ||
      member.companyProfileDocumentPath ||
      member.website,
  );
}

function hasContact(member: MemberDirectoryMember) {
  return Boolean(member.contactInfo?.emailLink || member.contactInfo?.phoneLink || member.website);
}

function normalizeWebsite(value?: string | null) {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function getDocumentName(path: string) {
  return path.split('/').filter(Boolean).pop()?.replace(/^[a-f0-9-]+_?/i, '') || 'Document';
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').trim() || 'directory-profile.pdf';
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  if (typeof globalThis.btoa !== 'function') {
    throw new Error('This device cannot encode the downloaded file.');
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
  tabsWrap: {
    marginVertical: 14,
  },
  sheetContent: {
    gap: 14,
  },
  actions: {
    gap: 10,
  },
  detailScroll: {
    gap: 12,
    paddingBottom: 6,
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  paragraph: {
    lineHeight: 21,
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
