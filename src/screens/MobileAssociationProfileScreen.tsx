import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import {
  Building2,
  CalendarDays,
  Download,
  FileBadge2,
  FileText,
  Globe2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileAvatar,
  MobileButton,
  MobileCard,
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
  MobileScreen,
  MobileStatusBadge,
  MobileText,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  downloadAssociationFile,
  getAssociationProfile,
  type AssociationProfile,
} from '@/services/association-service';
import { type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatDate } from '@/utils/format';

type DocumentItem = {
  id: string;
  title: string;
  description: string;
  path: string | null;
  type: 'license' | 'certificate' | 'logo';
};

export default function MobileAssociationProfileScreen() {
  const { activeView, associationId, user } = useAuth();
  const [profile, setProfile] = useState<AssociationProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadProfile = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before loading the profile.');
        return;
      }

      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const nextProfile = await getAssociationProfile(associationId);
        setProfile(nextProfile);
      } catch (loadError) {
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadProfile('initial'));
  }, [loadProfile]);

  const documents = useMemo<DocumentItem[]>(
    () => [
      {
        id: 'business-license',
        title: 'Business license',
        description: 'Registration or operating license file.',
        path: profile?.businessLicensePath || null,
        type: 'license',
      },
      {
        id: 'incorporation-certificate',
        title: 'Certificate of incorporation',
        description: 'Legal incorporation certificate file.',
        path: profile?.certificateOfIncorporationPath || null,
        type: 'certificate',
      },
      {
        id: 'association-logo',
        title: 'Association logo',
        description: 'Logo uploaded for public and admin surfaces.',
        path: profile?.logoPath || null,
        type: 'logo',
      },
    ],
    [profile],
  );

  const uploadedDocuments = documents.filter((document) => Boolean(document.path)).length;
  const missingDocuments = documents.length - uploadedDocuments;
  const accountStatus = profile?.accountStatus || 'ACTIVE';
  const statusTone = toneForStatus(accountStatus);
  const editRoute = getRouteByPath('/associations/profile/edit');

  const shareDocument = async (document: DocumentItem) => {
    if (!document.path) return;
    setSharingId(document.id);
    setError(null);
    setNotice(null);
    try {
      const downloaded = await downloadAssociationFile(document.path);
      const fileUri = `${FileSystem.documentDirectory}${downloaded.filename}`;
      await FileSystem.writeAsStringAsync(fileUri, arrayBufferToBase64(downloaded.data), {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: downloaded.contentType,
          dialogTitle: `Share ${document.title}`,
        });
      }
      setNotice(`${document.title} ready to share.`);
    } catch (shareError) {
      setError(getApiErrorMessage(shareError));
    } finally {
      setSharingId(null);
    }
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Association profile" description="Association profile is available for association admin workspaces only." />;
  }

  if (loading && !profile) {
    return <MobilePageLoadingState kind="dashboard" message="Loading association profile" />;
  }

  if (!associationId) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Settings" title="Association profile" subtitle="Association context unavailable" />
        <MobileErrorState title="Association not selected" description="Sign in through an association account before opening the profile." />
      </MobileScreen>
    );
  }

  if (error && !profile) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Settings"
          title="Association profile"
          subtitle={user?.associationName || 'Profile and documents'}
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry" variant="secondary" disabled={refreshing} onPress={() => void loadProfile('refresh')} />}
        />
        <MobileErrorState title="Association profile could not load" description={error} retryLabel="Retry" onRetry={() => void loadProfile('refresh')} />
      </MobileScreen>
    );
  }

  if (!profile) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Settings" title="Association profile" subtitle="Profile and documents" onBack={() => router.back()} />
        <MobileEmptyState title="No association profile found" description="The current session did not return an association profile." />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Settings"
        title="Association profile"
        subtitle="Profile and documents"
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh profile" variant="secondary" disabled={refreshing} onPress={() => void loadProfile('refresh')} />}
      />

      {error ? <MobileStatusBadge status="Failed" label={error} tone="danger" /> : null}
      {notice ? <MobileStatusBadge status="Completed" label={notice} tone="success" /> : null}

      <MobileCard accent="blue">
        <View style={styles.heroRow}>
          <MobileAvatar name={profile.name || user?.associationName || 'Association'} size="lg" tone={statusTone} />
          <View style={styles.heroMain}>
            <MobileText variant="section" weight="bold" numberOfLines={2}>
              {profile.name || 'Unnamed association'}
            </MobileText>
            <MobileText variant="small" tone="secondary" numberOfLines={2}>
              {profile.address || 'No address recorded'}
            </MobileText>
            <View style={styles.badgeRow}>
              <MobileStatusBadge status={accountStatus} tone={statusTone} />
              {profile.type ? <MobileStatusBadge status={profile.type} label={formatAssociationType(profile.type)} tone="info" /> : null}
            </View>
          </View>
        </View>
        <MobileButton
          label="Edit profile"
          icon={Pencil}
          variant="secondary"
          fullWidth
          onPress={() => {
            if (editRoute) {
              router.push({ pathname: '/work/route-preview', params: { routeId: editRoute.id } } as never);
            }
          }}
        />
      </MobileCard>

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Type" value={formatAssociationType(profile.type)} description="Association category" icon={Building2} tone="blue" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Registered" value={formatDate(profile.registrationDate)} description={profile.registrationNumber || 'No registration number'} icon={CalendarDays} tone="green" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Documents" value={`${uploadedDocuments}/${documents.length}`} description={missingDocuments ? `${missingDocuments} missing` : 'All key files uploaded'} icon={FileBadge2} tone={missingDocuments ? 'orange' : 'green'} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Status" value={formatStatus(accountStatus)} description={profile.accountStatusReason || 'Account state'} icon={ShieldCheck} tone={statusTone === 'danger' ? 'red' : statusTone === 'warning' ? 'orange' : 'green'} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard compact>
        <MobileText variant="section" weight="bold">
          Contact
        </MobileText>
        <MobileInfoRow label="Email" value={profile.email || 'Not recorded'} icon={Mail} status={profile.email ? 'Active' : 'Unknown'} />
        <MobileInfoRow label="Telephone" value={profile.telephone || 'Not recorded'} icon={Phone} status={profile.telephone ? 'Active' : 'Unknown'} />
        <MobileInfoRow label="Address" value={profile.address || 'Not recorded'} icon={MapPin} />
      </MobileCard>

      <MobileCard compact>
        <MobileText variant="section" weight="bold">
          Legal and tax
        </MobileText>
        <MobileInfoRow label="Registration number" value={profile.registrationNumber || 'Not recorded'} helper={`Registered ${formatDate(profile.registrationDate)}`} icon={FileText} />
        <MobileInfoRow label="TIN" value={profile.tin || 'Not recorded'} icon={FileBadge2} status={profile.tin ? 'Active' : 'Unknown'} />
        <MobileInfoRow label="VRN" value={profile.vrn || 'Not recorded'} icon={FileBadge2} status={profile.vrn ? 'Active' : 'Unknown'} />
      </MobileCard>

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold">
              Documents
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Share uploaded profile files from the device.
            </MobileText>
          </View>
          <MobileStatusBadge status={missingDocuments ? 'Pending' : 'Completed'} label={`${uploadedDocuments}/${documents.length}`} tone={missingDocuments ? 'warning' : 'success'} />
        </View>
        <MobileDataList
          showChevron={false}
          items={documents.map(documentToListItem)}
          onPressItem={(item) => {
            const document = documents.find((row) => row.id === item.id);
            if (document?.path) void shareDocument(document);
          }}
        />
        {documents.some((document) => document.path) ? (
          <View style={styles.documentActions}>
            {documents
              .filter((document) => document.path)
              .map((document) => (
                <MobileButton
                  key={document.id}
                  label={document.type === 'logo' ? 'Share logo' : document.type === 'license' ? 'Share license' : 'Share certificate'}
                  icon={Download}
                  variant="secondary"
                  size="sm"
                  loading={sharingId === document.id}
                  disabled={Boolean(sharingId)}
                  onPress={() => void shareDocument(document)}
                />
              ))}
          </View>
        ) : null}
      </MobileCard>

      <MobileCard compact>
        <MobileText variant="section" weight="bold">
          System metadata
        </MobileText>
        <MobileInfoRow label="Association ID" value={profile.id || associationId} helper="Used by API and admin audit records." icon={Globe2} />
        <MobileInfoRow label="Schema" value={profile.schemaName || 'Not available'} helper={`Last updated ${formatDate(profile.updatedAt || profile.createdAt)}`} icon={Building2} />
      </MobileCard>
    </MobileScreen>
  );
}

function documentToListItem(document: DocumentItem): MobileDataListItem {
  const uploaded = Boolean(document.path);
  return {
    id: document.id,
    title: document.title,
    subtitle: document.description,
    meta: uploaded ? document.path?.split('/').pop() : 'Upload from edit profile',
    status: uploaded ? 'Completed' : 'Pending',
    statusTone: uploaded ? 'success' : 'warning',
    accent: uploaded ? 'success' : 'warning',
    initials: uploaded ? 'OK' : 'UP',
  };
}

function formatAssociationType(value?: string | null) {
  return String(value || 'Unknown')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatStatus(value?: string | null) {
  return String(value || 'Unknown')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function toneForStatus(value?: string | null): StatusTone {
  const status = String(value || '').toUpperCase();
  if (status.includes('ACTIVE')) return 'success';
  if (status.includes('PENDING') || status.includes('REVIEW')) return 'warning';
  if (status.includes('DISABLED') || status.includes('SUSPENDED') || status.includes('INACTIVE')) return 'danger';
  return 'neutral';
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
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroMain: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  documentActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
