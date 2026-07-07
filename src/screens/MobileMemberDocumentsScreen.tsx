import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { FileCheck2, Files, RefreshCw, UploadCloud } from 'lucide-react-native';
import { useCallback, useMemo, useState, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileDetailHeader,
  MobileDocumentCard,
  MobileEmptyState,
  MobileErrorState,
  MobileFileUpload,
  MobileFormSection,
  MobileIconButton,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileSelect,
  MobileStatusBadge,
  MobileText,
  MobileToast,
} from '@/components/mobile';
import {
  getAssociationMember,
  getAssociationMemberDocuments,
  type AssociationMember,
  type MemberDocument,
  type MemberDocumentUploadFile,
  uploadAssociationMemberDocument,
  uploadCurrentMemberDocument,
} from '@/services/member-service';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber } from '@/utils/format';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';

type MobileMemberDocumentsScreenProps = {
  memberId?: string;
  audience?: 'admin' | 'member';
};

const documentTypeOptions = [
  { value: 'BUSINESS_LICENSE', label: 'Business License' },
  { value: 'TAX_COMPLIANCE', label: 'Tax Compliance Certificate' },
  { value: 'INDUSTRY_INSURANCE', label: 'Industry Insurance Coverage' },
  { value: 'PROFESSIONAL_CERTIFICATION', label: 'Professional Certification' },
  { value: 'LOCAL_CONTENT_APPROVAL', label: 'Local Content Approval' },
  { value: 'COMPANY_PROFILE', label: 'Company Profile' },
  { value: 'PAYMENT_PROOF', label: 'Payment Proof' },
  { value: 'TRADE_CERTIFICATION', label: 'Trade Certification' },
];

export default function MobileMemberDocumentsScreen({ memberId, audience = 'admin' }: MobileMemberDocumentsScreenProps) {
  const { activeView, associationId } = useAuth();
  const memberMode = audience === 'member';
  const [member, setMember] = useState<AssociationMember | null>(null);
  const [documents, setDocuments] = useState<MemberDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState('BUSINESS_LICENSE');
  const [selectedFile, setSelectedFile] = useState<MemberDocumentUploadFile | null>(null);

  const loadDocuments = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!memberId) {
        setError('Member context is missing.');
        setLoading(false);
        return;
      }

      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const [memberResponse, documentResponse] = await Promise.all([
          getAssociationMember(memberId),
          getAssociationMemberDocuments(memberId),
        ]);
        setMember(memberResponse);
        setDocuments(documentResponse);
      } catch (loadError) {
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [memberId],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadDocuments());
  }, [loadDocuments]);

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    documents.forEach((document) => {
      const key = normalizeStatus(document.status);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [documents]);

  const pendingCount = (statusCounts.get('PENDING_REVIEW') || 0) + (statusCounts.get('PENDING') || 0);
  const approvedCount = (statusCounts.get('APPROVED') || 0) + (statusCounts.get('VERIFIED') || 0);
  const rejectedCount = (statusCounts.get('REJECTED') || 0) + (statusCounts.get('FAILED') || 0);

  if (memberMode && activeView !== 'MEMBER') {
    return (
      <AccessDeniedScreen
        title="Upload documents"
        description="Member document uploads are available from the member portal workspace."
      />
    );
  }

  if (!memberMode && activeView !== 'ADMIN') {
    return (
      <AccessDeniedScreen
        title="Member documents"
        description="This native page is available for association admin workspaces only."
      />
    );
  }

  if (loading && !member) {
    return <MobilePageLoadingState kind="detail" message="Loading member documents" />;
  }

  if (error && !member) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow={memberMode ? 'Member portal' : 'Members'}
          title={memberMode ? 'Upload documents' : 'Member documents'}
          subtitle="Documents could not be loaded"
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry" variant="secondary" onPress={() => void loadDocuments('refresh')} />}
        />
        <MobileErrorState title="Documents could not load" description={error} retryLabel="Retry" onRetry={() => void loadDocuments('refresh')} />
      </MobileScreen>
    );
  }

  const memberName = member?.fullLegalName || member?.contactInfo?.email || 'Member';

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
      ],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    setSelectedFile({
      uri: asset.uri,
      name: asset.name || 'member-document',
      mimeType: asset.mimeType || 'application/octet-stream',
    });
    setNotice(null);
  };

  const uploadDocument = async () => {
    if (!member) {
      setError('Member context is missing.');
      return;
    }
    if (!memberMode && !associationId) {
      setError('Association context is missing.');
      return;
    }
    if (!selectedFile) {
      setNotice('Choose a file before uploading.');
      return;
    }

    setUploading(true);
    setNotice(null);
    setError(null);

    try {
      if (memberMode) {
        await uploadCurrentMemberDocument(documentType, selectedFile);
      } else {
        await uploadAssociationMemberDocument(member, associationId as string, documentType, selectedFile);
      }
      setSelectedFile(null);
      setNotice('Document uploaded successfully and is pending review.');
      await loadDocuments('refresh');
    } catch (uploadError) {
      setError(getApiErrorMessage(uploadError));
    } finally {
      setUploading(false);
    }
  };

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow={memberMode ? 'Member portal' : 'Members'}
        title={memberMode ? 'Upload documents' : 'Member documents'}
        subtitle={memberName}
        onBack={() => router.back()}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Refresh documents"
            variant="secondary"
            disabled={refreshing}
            onPress={() => void loadDocuments('refresh')}
          />
        }
      />

      {notice ? <MobileToast title="Documents" description={notice} tone="info" /> : null}
      {error && member ? <MobileToast title="Document action failed" description={error} tone="danger" /> : null}

      {member ? (
        <MobileDetailHeader
          title={memberName}
          subtitle={member.membershipNumber || member.employeeId || 'No membership number'}
          eyebrow={memberMode ? 'My document record' : 'Document record'}
          status={member.status || 'Unknown'}
          avatarName={memberName}
        />
      ) : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Documents" value={formatNumber(documents.length)} description="Uploaded files" tone="blue" icon={Files} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Pending review" value={formatNumber(pendingCount)} description="Needs verification" tone="orange" icon={FileCheck2} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Approved" value={formatNumber(approvedCount)} description="Verified records" tone="green" icon={FileCheck2} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Rejected" value={formatNumber(rejectedCount)} description="Needs replacement" tone="red" icon={FileCheck2} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileFormSection
        title="Upload document"
        description={memberMode ? 'Choose the document type, pick a file, then submit it for review.' : 'Choose the document type, pick a file, then upload it to this member record.'}
      >
        <MobileSelect
          label="Document type"
          value={documentType}
          options={documentTypeOptions}
          onChange={setDocumentType}
        />
        <MobileFileUpload
          title={selectedFile ? selectedFile.name : 'Choose document file'}
          description={selectedFile ? 'Ready to upload. PDF, Word, JPG, and PNG files are supported.' : 'PDF, DOC, DOCX, JPG, and PNG are supported.'}
          onPress={pickFile}
        />
        <View style={styles.uploadFooter}>
          <View style={styles.fileMeta}>
            <MobileText variant="small" tone="secondary">
              {selectedFile ? selectedFile.mimeType || 'Selected file' : 'No file selected'}
            </MobileText>
          </View>
          <MobileButton
            label="Upload"
            icon={UploadCloud}
            loading={uploading}
            disabled={!selectedFile || uploading}
            onPress={uploadDocument}
          />
        </View>
      </MobileFormSection>

      <View style={styles.sectionHeader}>
        <MobileText variant="section" weight="bold">
          Existing documents
        </MobileText>
        <MobileStatusBadge status="Documents" label={formatNumber(documents.length)} tone={documents.length ? 'primary' : 'neutral'} />
      </View>

      {documents.length ? (
        <View style={styles.stack}>
          {documents.map((document) => (
            <MobileDocumentCard
              key={document.id}
              title={document.documentName || document.fileName || document.originalFileName || humanize(document.documentType || document.type || 'Document')}
              meta={`${humanize(document.documentType || document.type || 'Document')} · ${formatFileSize(document.fileSize)} · ${formatDate(document.uploadDate || document.uploadedAt || document.createdAt)}`}
              status={document.status || 'Uploaded'}
            />
          ))}
        </View>
      ) : (
        <MobileEmptyState
          title="No documents uploaded"
          description={memberMode ? 'Your uploaded documents will appear here with their review status.' : 'Uploaded member documents will appear here with their review status.'}
          actionLabel="Choose file"
          onAction={pickFile}
        />
      )}
    </MobileScreen>
  );
}

function normalizeStatus(status?: string | null) {
  return String(status || 'UNKNOWN').trim().toUpperCase();
}

function humanize(input?: string | null) {
  return String(input || 'Document')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatFileSize(size?: number | null) {
  const value = Number(size || 0);
  if (!value) return 'Size unknown';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  uploadFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  fileMeta: {
    flex: 1,
    minWidth: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  stack: {
    gap: 10,
  },
});
