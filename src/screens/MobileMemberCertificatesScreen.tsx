import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import {
  AlertCircle,
  Award,
  CalendarDays,
  CheckCircle2,
  Download,
  ExternalLink,
  FileCheck2,
  Hash,
  Phone,
  RefreshCw,
  Share2,
  ShieldCheck,
  UserRound,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Share, StyleSheet, View } from 'react-native';

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
  MobileSheet,
  MobileStatusBadge,
  MobileSummaryPanel,
  MobileText,
  MobileToast,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import { getAssociationProfile, type AssociationProfile } from '@/services/association-service';
import {
  buildCertificateVerificationUrl,
  buildMembershipCertificateId,
  downloadMembershipCard,
  downloadMembershipCertificate,
  verifyMembershipCertificate,
  type CertificateVerification,
} from '@/services/certificate-service';
import { getCurrentMemberByUserId, type AssociationMember } from '@/services/member-service';
import { labelFromStatus, statusToneFor, useNaneTheme } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatDate } from '@/utils/format';

type DocumentType = 'certificate' | 'card';
type Notice = { title: string; description?: string; tone?: 'success' | 'info' | 'warning' | 'danger' } | null;

export default function MobileMemberCertificatesScreen() {
  const { activeView, associationId, user } = useAuth();
  const theme = useNaneTheme();
  const [member, setMember] = useState<AssociationMember | null>(null);
  const [association, setAssociation] = useState<AssociationProfile | null>(null);
  const [verification, setVerification] = useState<CertificateVerification | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<DocumentType | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState<DocumentType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const userId = user?.userId;

  const certificateId = useMemo(() => {
    const memberAssociationId = member?.associationId || associationId;
    return memberAssociationId && member?.id ? buildMembershipCertificateId(memberAssociationId, member.id) : '';
  }, [associationId, member]);

  const verificationUrl = useMemo(() => (certificateId ? buildCertificateVerificationUrl(certificateId) : ''), [certificateId]);
  const associationType = String(association?.type || user?.associationType || '').toUpperCase();
  const isGenericAssociation = associationType === 'GENERIC';
  const isActiveMember = String(member?.status || '').toUpperCase() === 'ACTIVE';
  const canDownload = Boolean(member?.id && isGenericAssociation && isActiveMember);
  const statusLabel = labelFromStatus(member?.status || 'Unknown');

  const loadCertificates = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!userId || !associationId) {
        setLoading(false);
        setError('Member and association context are required before opening certificates.');
        return;
      }

      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);
      setNotice(null);

      try {
        const currentMember = await getCurrentMemberByUserId(userId);
        const currentAssociationId = currentMember.associationId || associationId;
        const [profile, verified] = await Promise.all([
          getAssociationProfile(currentAssociationId).catch(() => null),
          currentMember.id
            ? verifyMembershipCertificate(buildMembershipCertificateId(currentAssociationId, currentMember.id)).catch(() => null)
            : Promise.resolve(null),
        ]);
        setMember(currentMember);
        setAssociation(profile);
        setVerification(verified);
      } catch (loadError) {
        setMember(null);
        setAssociation(null);
        setVerification(null);
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
      void Promise.resolve().then(() => loadCertificates());
    }
  }, [activeView, loadCertificates]);

  const documentItems = useMemo<MobileDataListItem[]>(
    () => [
      {
        id: 'certificate',
        title: 'Certificate PDF',
        subtitle: 'Official proof of membership',
        meta: canDownload ? 'Ready to generate as PDF' : 'Available after activation',
        status: canDownload ? 'Ready' : 'Locked',
        statusTone: canDownload ? 'success' : 'warning',
        initials: 'MC',
        accent: canDownload ? 'success' : 'neutral',
      },
      {
        id: 'card',
        title: 'Member ID Card',
        subtitle: 'Portable ID with QR verification',
        meta: canDownload ? 'Ready to generate as PDF' : 'Available after activation',
        status: canDownload ? 'Ready' : 'Locked',
        statusTone: canDownload ? 'success' : 'warning',
        initials: 'ID',
        accent: canDownload ? 'primary' : 'neutral',
      },
    ],
    [canDownload],
  );

  const handleDownload = async (type: DocumentType) => {
    if (!member?.id || !canDownload) return;
    setDownloading(type);
    setNotice(null);
    setError(null);
    try {
      const downloaded = type === 'certificate' ? await downloadMembershipCertificate(member.id) : await downloadMembershipCard(member.id);
      const filename = safeFileName(`${type === 'certificate' ? 'membership-certificate' : 'membership-card'}-${member.membershipNumber || member.id}.pdf`);
      const fileUri = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, arrayBufferToBase64(downloaded.data), {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: downloaded.contentType,
          dialogTitle: type === 'certificate' ? 'Share membership certificate' : 'Share membership card',
        });
      }
      setNotice({
        title: type === 'certificate' ? 'Certificate ready' : 'Membership card ready',
        description: downloaded.filename,
        tone: 'success',
      });
    } catch (downloadError) {
      setError(getApiErrorMessage(downloadError));
    } finally {
      setDownloading(null);
    }
  };

  if (activeView !== 'MEMBER') {
    return (
      <AccessDeniedScreen
        title="Member workspace required"
        description="Membership certificates are available from the member portal workspace."
      />
    );
  }

  if (loading) {
    return <MobilePageLoadingState kind="detail" message="Loading certificates" />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Member Documents"
        title="Certificates"
        subtitle={member?.membershipNumber || user?.associationName || 'Member portal'}
        onBack={() => router.back()}
        rightAction={<MobileStatusBadge status={refreshing ? 'Refreshing' : canDownload ? 'Ready' : statusLabel} tone={refreshing ? 'info' : canDownload ? 'success' : statusToneFor(member?.status)} />}
      />

      {notice ? <MobileToast title={notice.title} description={notice.description} tone={notice.tone || 'success'} /> : null}
      {error ? (
        <MobileErrorState
          title="Certificates could not load"
          description={error}
          retryLabel="Retry"
          onRetry={() => void loadCertificates('refresh')}
        />
      ) : null}

      <MobileSummaryPanel
        title="Membership Documents"
        value={canDownload ? 'Ready' : isGenericAssociation ? statusLabel : 'Unavailable'}
        description={
          canDownload
            ? 'Certificate and member ID can be generated as signed PDF documents.'
            : isGenericAssociation
              ? 'Official documents unlock when your member status is Active.'
              : 'Certificates are currently enabled for Generic associations.'
        }
        icon={Award}
        tone={canDownload ? 'green' : isGenericAssociation ? 'orange' : 'slate'}
        footer={
          <View style={styles.summaryActions}>
            <MobileButton
              label="Refresh"
              icon={RefreshCw}
              variant="secondary"
              size="sm"
              loading={refreshing}
              disabled={refreshing}
              onPress={() => void loadCertificates('refresh')}
              style={styles.summaryButton}
            />
            <MobileButton
              label="Verify"
              icon={ExternalLink}
              variant="ghost"
              size="sm"
              disabled={!verificationUrl}
              onPress={() => void Linking.openURL(verificationUrl)}
              style={styles.summaryButton}
            />
          </View>
        }
      />

      {!isGenericAssociation ? (
        <MobileEmptyState
          title="Certificates unavailable"
          description="This association type does not currently expose member certificate generation."
        />
      ) : !isActiveMember ? (
        <MobileCard compact accent="orange">
          <View style={styles.warningHeader}>
            <AlertCircle color={theme.colors.kpi.orange} size={22} strokeWidth={2.5} />
            <View style={styles.flex}>
              <MobileText variant="section" weight="bold">
                Activation required
              </MobileText>
              <MobileText variant="small" tone="secondary">
                Certificates and cards are only generated for active members. Your current status is {statusLabel}.
              </MobileText>
            </View>
          </View>
        </MobileCard>
      ) : null}

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold">
              Official Downloads
            </MobileText>
            <MobileText variant="small" tone="secondary">
              PDF files are generated by the backend and include QR verification.
            </MobileText>
          </View>
          <MobileStatusBadge status={canDownload ? 'Ready' : 'Locked'} tone={canDownload ? 'success' : 'warning'} />
        </View>
        <MobileDataList
          items={documentItems}
          onPressItem={(item) => setSelectedDocument(item.id as DocumentType)}
        />
      </MobileCard>

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Member Status" value={statusLabel} description="Certificate eligibility" icon={CheckCircle2} tone={isActiveMember ? 'green' : 'orange'} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Documents" value={canDownload ? '2' : '0'} description="Certificate and card" icon={FileCheck2} tone="blue" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Verified" value={verification ? 'Yes' : 'Check'} description="Public certificate registry" icon={ShieldCheck} tone={verification ? 'green' : 'slate'} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      {member ? (
        <>
          <CertificatePreview
            member={member}
            associationName={association?.name || member.associationName || user?.associationName || 'Association'}
            certificateId={certificateId}
            verified={Boolean(verification)}
            onShare={() => void shareVerification(member, verificationUrl)}
          />

          <MembershipCardPreview
            member={member}
            associationName={association?.name || member.associationName || user?.associationName || 'Association'}
            verified={Boolean(verification)}
          />
        </>
      ) : null}

      <DocumentDetailSheet
        type={selectedDocument}
        member={member}
        canDownload={canDownload}
        downloading={downloading}
        verificationUrl={verificationUrl}
        onClose={() => setSelectedDocument(null)}
        onDownload={handleDownload}
      />
    </MobileScreen>
  );
}

function CertificatePreview({
  member,
  associationName,
  certificateId,
  verified,
  onShare,
}: {
  member: AssociationMember;
  associationName: string;
  certificateId: string;
  verified: boolean;
  onShare: () => void;
}) {
  const theme = useNaneTheme();

  return (
    <MobileCard compact style={[styles.certificateFrame, { backgroundColor: theme.colors.primaryDark, borderColor: '#C9A227' }]}>
      <View style={[styles.certificateInner, { backgroundColor: theme.scheme === 'dark' ? '#F8FAFC' : '#FFFFFF' }]}>
        <MobileText variant="tiny" weight="bold" style={styles.certificateAssociation} numberOfLines={1}>
          {associationName.toUpperCase()}
        </MobileText>
        <MobileText variant="section" weight="bold" style={styles.certificateTitle}>
          Certificate of Membership
        </MobileText>
        <View style={styles.goldDivider} />
        <MobileText variant="small" tone="secondary" style={styles.centerText}>
          This certifies that
        </MobileText>
        <MobileText variant="section" weight="bold" style={styles.memberName} numberOfLines={2}>
          {member.fullLegalName || 'Member'}
        </MobileText>
        <MobileText variant="small" tone="secondary" style={styles.centerText}>
          is a valued member of {associationName}
        </MobileText>
        <View style={styles.certificateRows}>
          <MobileInfoRow label="Membership No" value={member.membershipNumber || 'Not assigned'} icon={Hash} />
          <MobileInfoRow label="Member Since" value={formatDate(member.firstRegistrationDate || member.createdAt)} icon={CalendarDays} />
        </View>
        <View style={styles.verificationFooter}>
          <MobileStatusBadge status={verified ? 'Verified' : 'Pending'} tone={verified ? 'success' : 'warning'} />
          <MobileButton label="Share Link" icon={Share2} variant="ghost" size="sm" disabled={!certificateId} onPress={onShare} />
        </View>
      </View>
    </MobileCard>
  );
}

function MembershipCardPreview({
  member,
  associationName,
  verified,
}: {
  member: AssociationMember;
  associationName: string;
  verified: boolean;
}) {
  const theme = useNaneTheme();
  const initials = initialsFromName(member.fullLegalName);

  return (
    <MobileCard compact style={[styles.memberCard, { borderColor: theme.colors.primaryDark }]}>
      <View style={[styles.cardBand, { backgroundColor: theme.colors.primaryDark }]}>
        <View style={[styles.logoBadge, { backgroundColor: '#F5ECD2' }]}>
          <MobileText variant="small" weight="bold" style={{ color: theme.colors.primaryDark }}>
            N
          </MobileText>
        </View>
        <View style={styles.flex}>
          <MobileText variant="small" weight="bold" tone="inverse" numberOfLines={1}>
            {associationName}
          </MobileText>
          <MobileText variant="tiny" tone="inverse">
            Membership Card
          </MobileText>
        </View>
      </View>
      <View style={styles.cardBody}>
        <View style={[styles.initialsBadge, { backgroundColor: theme.colors.surfaceStrong }]}>
          <MobileText variant="section" weight="bold">
            {initials}
          </MobileText>
        </View>
        <View style={styles.flex}>
          <MobileText variant="section" weight="bold" numberOfLines={1}>
            {member.fullLegalName || 'Member'}
          </MobileText>
          <MobileText variant="small" tone="secondary" numberOfLines={1}>
            {member.membershipNumber || 'Membership number pending'}
          </MobileText>
          <MobileText variant="small" tone="secondary" numberOfLines={1}>
            {member.contactInfo?.phoneNumber || 'Phone not recorded'}
          </MobileText>
        </View>
        <View style={styles.qrPlaceholder}>
          <ShieldCheck color={theme.colors.primary} size={22} strokeWidth={2.6} />
          <MobileText variant="tiny" tone="secondary">
            QR
          </MobileText>
        </View>
      </View>
      <View style={styles.cardFooter}>
        <MobileStatusBadge status={verified ? 'Verified' : 'Registry Check'} tone={verified ? 'success' : 'neutral'} />
        <MobileText variant="tiny" tone="secondary">
          Issued via Nane
        </MobileText>
      </View>
    </MobileCard>
  );
}

function DocumentDetailSheet({
  type,
  member,
  canDownload,
  downloading,
  verificationUrl,
  onClose,
  onDownload,
}: {
  type: DocumentType | null;
  member: AssociationMember | null;
  canDownload: boolean;
  downloading: DocumentType | null;
  verificationUrl: string;
  onClose: () => void;
  onDownload: (type: DocumentType) => void;
}) {
  if (!type) return null;
  const isCertificate = type === 'certificate';

  return (
    <MobileSheet
      visible={Boolean(type)}
      title={isCertificate ? 'Membership Certificate' : 'Membership Card'}
      description={isCertificate ? 'Official proof of membership' : 'Portable member identification'}
      onClose={onClose}
    >
      <View style={styles.sheetContent}>
        <MobileCard compact accent={canDownload ? 'green' : 'orange'}>
          <MobileInfoRow label="Member" value={member?.fullLegalName || 'Member'} icon={UserRound} />
          <MobileInfoRow label="Membership No" value={member?.membershipNumber || 'Not assigned'} icon={Hash} />
          <MobileInfoRow label="Status" value={labelFromStatus(member?.status)} icon={CheckCircle2} status={labelFromStatus(member?.status)} />
          <MobileInfoRow label="Phone" value={member?.contactInfo?.phoneNumber || 'Not recorded'} icon={Phone} />
        </MobileCard>

        <View style={styles.actions}>
          <MobileButton
            label={isCertificate ? 'Download Certificate' : 'Download Card'}
            icon={Download}
            loading={downloading === type}
            disabled={!canDownload || Boolean(downloading)}
            onPress={() => onDownload(type)}
            fullWidth
          />
          <MobileButton
            label="Open Verification"
            icon={ExternalLink}
            variant="secondary"
            disabled={!verificationUrl}
            onPress={() => void Linking.openURL(verificationUrl)}
            fullWidth
          />
        </View>
      </View>
    </MobileSheet>
  );
}

async function shareVerification(member: AssociationMember, verificationUrl: string) {
  if (!verificationUrl) return;
  await Share.share({
    title: 'Membership certificate verification',
    message: `${member.fullLegalName || 'Member'}\n${member.membershipNumber || ''}\n${verificationUrl}`,
  });
}

function initialsFromName(value?: string | null) {
  const parts = String(value || 'Member')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return `${parts[0]?.[0] || 'M'}${parts.length > 1 ? parts[parts.length - 1][0] : ''}`.toUpperCase();
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').trim() || 'membership-document.pdf';
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  if (typeof globalThis.btoa !== 'function') {
    throw new Error('This device cannot encode the generated PDF.');
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
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  certificateFrame: {
    padding: 10,
  },
  certificateInner: {
    borderRadius: 14,
    padding: 18,
    gap: 10,
  },
  certificateAssociation: {
    color: '#C9A227',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  certificateTitle: {
    color: '#1A2A5E',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  goldDivider: {
    height: 2,
    width: '78%',
    alignSelf: 'center',
    backgroundColor: '#C9A227',
    borderRadius: 999,
  },
  centerText: {
    textAlign: 'center',
  },
  memberName: {
    color: '#111827',
    textAlign: 'center',
  },
  certificateRows: {
    marginTop: 4,
  },
  verificationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  memberCard: {
    overflow: 'hidden',
    padding: 0,
  },
  cardBand: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  initialsBadge: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrPlaceholder: {
    width: 54,
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sheetContent: {
    gap: 12,
    paddingBottom: 24,
  },
  actions: {
    gap: 10,
  },
});
