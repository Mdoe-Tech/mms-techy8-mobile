import { router } from 'expo-router';
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  ClipboardCheck,
  FileWarning,
  Package,
  Phone,
  RefreshCw,
  Upload,
  UserRound,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileEmptyState,
  MobileErrorState,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileProgressBar,
  MobileScreen,
  MobileStatusBadge,
  MobileText,
} from '@/components/mobile';
import { getPublicAssociationConfig } from '@/services/association-service';
import {
  getAssociationMember,
  getAssociationMemberDocuments,
  type AssociationMember,
  type MemberDocument,
} from '@/services/member-service';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatPercent } from '@/utils/format';

type MobileMemberRegistrationStatusScreenProps = {
  memberId?: string;
};

type ConfigFile = {
  name?: string | null;
  label?: string | null;
  required?: boolean | string | number | null;
  formTypes?: string | null;
  memberType?: string | null;
  associationType?: string | null;
};

type ConfigPage = {
  files?: ConfigFile[] | null;
};

type MissingItem = {
  id: string;
  category: string;
  label: string;
  action: 'edit' | 'subscribe' | 'upload';
};

export default function MobileMemberRegistrationStatusScreen({ memberId }: MobileMemberRegistrationStatusScreenProps) {
  const { activeView, user } = useAuth();
  const userAssociationType = user?.associationType;
  const [member, setMember] = useState<AssociationMember | null>(null);
  const [documents, setDocuments] = useState<MemberDocument[]>([]);
  const [requiredDocuments, setRequiredDocuments] = useState<ConfigFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadStatus = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!memberId) {
        setLoading(false);
        setLoadError('Member ID is missing for this registration status route.');
        return;
      }

      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setLoadError(null);

      try {
        const loadedMember = await getAssociationMember(memberId);
        setMember(loadedMember);

        const [documentResult, configResult] = await Promise.allSettled([
          getAssociationMemberDocuments(memberId),
          loadedMember.associationId ? getPublicAssociationConfig(loadedMember.associationId) : Promise.resolve(null),
        ]);

        setDocuments(documentResult.status === 'fulfilled' ? documentResult.value : []);
        setRequiredDocuments(
          configResult.status === 'fulfilled'
            ? extractRequiredDocuments(configResult.value, loadedMember.memberType, userAssociationType)
            : [],
        );
      } catch (error) {
        setLoadError(getApiErrorMessage(error));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [memberId, userAssociationType],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadStatus());
  }, [loadStatus]);

  const missingItems = useMemo(
    () => (member ? buildMissingItems(member, requiredDocuments, documents, userAssociationType) : []),
    [documents, member, requiredDocuments, userAssociationType],
  );

  if (activeView !== 'MEMBER') {
    return (
      <AccessDeniedScreen
        title="Registration status"
        description="This native status page is available from the member portal workspace."
      />
    );
  }

  if (loading && !member) {
    return <MobilePageLoadingState kind="detail" message="Loading registration status" />;
  }

  if (loadError && !member) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Member portal"
          title="Registration status"
          subtitle="Profile context unavailable"
          onBack={() => router.back()}
          rightAction={<MobileButton label="Retry" icon={RefreshCw} size="sm" variant="secondary" onPress={() => void loadStatus('refresh')} />}
        />
        <MobileErrorState title="Registration status could not load" description={loadError} retryLabel="Retry" onRetry={() => void loadStatus('refresh')} />
      </MobileScreen>
    );
  }

  if (!member) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Member portal" title="Registration status" onBack={() => router.back()} />
        <MobileEmptyState title="Member not found" description="This registration status link does not match an available member profile." />
      </MobileScreen>
    );
  }

  const progress = Number(member.registrationProgress ?? 0);
  const missingCount = missingItems.length;
  const primaryMissing = missingItems[0];
  const complete = missingCount === 0 && progress >= 100;
  const progressTone = complete ? 'green' : progress >= 70 ? 'orange' : 'red';
  const packageLabel = member.packageName || (usesPackages(userAssociationType) ? 'No package selected' : 'Not required for this association');
  const requiredDocumentCount = requiredDocuments.length;

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Member portal"
        title="Registration status"
        subtitle={member.associationName || user?.associationName || 'Member profile'}
        onBack={() => router.back()}
        rightAction={
          <MobileButton
            label="Refresh"
            icon={RefreshCw}
            size="sm"
            variant="secondary"
            loading={refreshing}
            disabled={refreshing}
            onPress={() => void loadStatus('refresh')}
          />
        }
      />

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Progress" value={formatPercent(progress)} description={complete ? 'Complete' : 'Needs review'} tone={progressTone} icon={ClipboardCheck} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Status" value={member.status || 'Unknown'} description="Registry state" tone={statusTone(member.status)} icon={BadgeCheck} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Missing" value={String(missingCount)} description="Required items" tone={missingCount ? 'red' : 'green'} icon={FileWarning} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Documents" value={String(documents.length)} description={`${requiredDocumentCount} required`} tone={requiredDocumentCount ? 'orange' : 'blue'} icon={Upload} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      {primaryMissing ? (
        <MobileCard accent="red" compact>
          <View style={styles.sectionHeader}>
            <View style={styles.summaryText}>
              <MobileText variant="tiny" tone="secondary" weight="bold" style={styles.category}>
                Next required action
              </MobileText>
              <MobileText variant="body" weight="bold" numberOfLines={2}>
                {primaryMissing.label}
              </MobileText>
            </View>
            <MobileStatusBadge status={primaryMissing.category} tone="danger" />
          </View>
          <MobileButton
            label={missingActionLabel(primaryMissing.action)}
            icon={missingActionIcon(primaryMissing.action)}
            fullWidth
            onPress={() => runMissingAction(primaryMissing.action, member.id)}
          />
        </MobileCard>
      ) : null}

      <MobileCard accent={complete ? 'green' : progressTone}>
        <View style={styles.summaryHeader}>
          <View style={styles.summaryText}>
            <MobileText variant="section" weight="bold" numberOfLines={2}>
              {member.fullLegalName || user?.fullName || 'Member profile'}
            </MobileText>
            <MobileText variant="small" tone="secondary" numberOfLines={2}>
              {member.membershipNumber || 'Membership number is assigned after completion'}
            </MobileText>
          </View>
          <MobileStatusBadge status={complete ? 'Completed' : 'Review required'} tone={complete ? 'success' : 'warning'} />
        </View>
        <MobileProgressBar value={progress} label="Registration progress" tone={progressTone} />
        <MobileInfoRow icon={Building2} label="Association" value={member.associationName || user?.associationName || 'Not provided'} />
        <MobileInfoRow icon={Package} label="Membership package" value={packageLabel} />
        <MobileInfoRow icon={Phone} label="Primary contact" value={member.contactInfo?.phoneNumber || member.contactInfo?.email || 'Not provided'} />
        <MobileInfoRow icon={BadgeCheck} label="Last updated" value={formatDate(member.updatedAt || member.createdAt)} />
      </MobileCard>

      {missingCount ? (
        <MobileCard accent="red">
          <View style={styles.sectionHeader}>
            <MobileText variant="section" weight="bold">
              Missing required information
            </MobileText>
            <MobileStatusBadge status={`${missingCount} item${missingCount === 1 ? '' : 's'}`} tone="danger" />
          </View>
          <MobileText variant="small" tone="secondary">
            Complete these items to keep your member record ready for approval, certificates, payments, and official communication.
          </MobileText>
          <View style={styles.missingList}>
            {missingItems.map((item) => (
              <View key={item.id} style={styles.missingItem}>
                <View style={styles.missingText}>
                  <MobileText variant="tiny" tone="secondary" weight="bold" style={styles.category}>
                    {item.category}
                  </MobileText>
                  <MobileText variant="body" weight="bold" numberOfLines={2}>
                    {item.label}
                  </MobileText>
                </View>
                <MobileStatusBadge status="Missing" tone="danger" />
              </View>
            ))}
          </View>
          <View style={styles.actions}>
            {hasAction(missingItems, 'edit') ? (
              <MobileButton label="Update details" icon={UserRound} fullWidth onPress={() => openEdit(member.id)} />
            ) : null}
            {hasAction(missingItems, 'subscribe') ? (
              <MobileButton label="Choose package" icon={Package} variant="secondary" fullWidth onPress={openSubscription} />
            ) : null}
            {hasAction(missingItems, 'upload') ? (
              <MobileButton label="Upload documents" icon={Upload} variant="secondary" fullWidth onPress={() => openUpload(member.id)} />
            ) : null}
          </View>
        </MobileCard>
      ) : (
        <MobileCard>
          <MobileEmptyState
            title="All required information is submitted"
            description="Your member registration status is complete. You can continue to your profile or dashboard."
            actionLabel="Open profile"
            onAction={() => router.push({ pathname: '/work/route-preview', params: { routeId: 'member-member-profile' } } as never)}
          />
          <MobileButton label="Back to dashboard" icon={ArrowLeft} variant="secondary" fullWidth onPress={() => router.push({ pathname: '/work/route-preview', params: { routeId: 'member-member-dashboard' } } as never)} />
        </MobileCard>
      )}

      {loadError ? <MobileErrorState title="Some status details could not refresh" description={loadError} retryLabel="Retry" onRetry={() => void loadStatus('refresh')} /> : null}
    </MobileScreen>
  );
}

function buildMissingItems(
  member: AssociationMember,
  requiredDocuments: ConfigFile[],
  documents: MemberDocument[],
  associationType?: string | null,
): MissingItem[] {
  const items: MissingItem[] = [];
  addMissing(items, 'identity.name', 'Basic information', 'Full legal name', !member.fullLegalName, 'edit');
  addMissing(items, 'identity.type', 'Basic information', 'Member type', !member.memberType, 'edit');
  addMissing(items, 'contact.address', 'Contact information', 'Physical address', !member.contactInfo?.physicalAddress, 'edit');
  addMissing(items, 'contact.phone', 'Contact information', 'Phone number', !member.contactInfo?.phoneNumber, 'edit');
  addMissing(items, 'contact.email', 'Contact information', 'Email address', !member.contactInfo?.email, 'edit');
  addMissing(items, 'terms.accepted', 'Confirmation', 'Registration confirmation', member.termsAccepted !== true, 'edit');

  if (usesPackages(associationType)) {
    addMissing(items, 'package.selected', 'Membership package', 'Membership package selection', !member.packageId, 'subscribe');
  }

  const uploaded = getUploadedDocumentKeys(member, documents);
  requiredDocuments.forEach((doc) => {
    const key = String(doc.name || doc.label || '').trim();
    if (!key) return;
    const label = doc.label || formatFieldLabel(key);
    if (!uploaded.has(key.toLowerCase()) && !uploaded.has(label.toLowerCase())) {
      items.push({
        id: `document.${key}`,
        category: 'Required documents',
        label,
        action: 'upload',
      });
    }
  });

  return items;
}

function addMissing(
  items: MissingItem[],
  id: string,
  category: string,
  label: string,
  missing: boolean,
  action: MissingItem['action'],
) {
  if (!missing) return;
  items.push({ id, category, label, action });
}

function extractRequiredDocuments(config: unknown, memberType?: string | null, associationType?: string | null) {
  const root = toRecord(config);
  const settings = toRecord(root.settings);
  const nestedSettings = toRecord(settings.settings);
  const pages = firstArray(root.pages, settings.pages, nestedSettings.pages) as ConfigPage[];
  return pages
    .flatMap((page) => (Array.isArray(page.files) ? page.files : []))
    .filter((file) => file?.name || file?.label)
    .filter((file) => isFieldRequired(file))
    .filter((file) => appliesToMemberType(file, memberType))
    .filter((file) => appliesToAssociationType(file, associationType));
}

function getUploadedDocumentKeys(member: AssociationMember, documents: MemberDocument[]) {
  const keys = new Set<string>();
  const filePaths = toRecord(member.customAttributes?.filePaths);
  Object.keys(filePaths).forEach((key) => keys.add(key.toLowerCase()));
  documents.forEach((document) => {
    [
      document.documentType,
      document.type,
      document.documentName,
      document.fileName,
      document.originalFileName,
    ].forEach((value) => {
      if (value) keys.add(String(value).toLowerCase());
    });
  });
  return keys;
}

function firstArray(...values: unknown[]) {
  return values.find((value) => Array.isArray(value)) || [];
}

function toRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function isFieldRequired(field: ConfigFile) {
  const value = field.required;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return ['true', 'yes', '1'].includes(value.trim().toLowerCase());
  return false;
}

function appliesToMemberType(file: ConfigFile, memberType?: string | null) {
  const raw = String(file.formTypes || file.memberType || 'BOTH').toUpperCase();
  const current = String(memberType || '').toUpperCase();
  return raw === 'BOTH' || raw === 'ALL' || !current || raw === current;
}

function appliesToAssociationType(file: ConfigFile, associationType?: string | null) {
  const raw = String(file.associationType || 'ALL').toUpperCase();
  const current = String(associationType || '').toUpperCase();
  return raw === 'ALL' || !current || raw === current;
}

function usesPackages(associationType?: string | null) {
  const normalized = String(associationType || '').toUpperCase();
  return normalized === 'GENERIC';
}

function hasAction(items: MissingItem[], action: MissingItem['action']) {
  return items.some((item) => item.action === action);
}

function openEdit(memberId: string) {
  router.push({ pathname: '/work/route-preview', params: { routeId: 'member-member-memberId-edit', memberId } } as never);
}

function openSubscription() {
  router.push({ pathname: '/work/route-preview', params: { routeId: 'member-member-subscription' } } as never);
}

function openUpload(memberId: string) {
  router.push({ pathname: '/work/route-preview', params: { routeId: 'member-member-upload-document-memberId-documents', memberId } } as never);
}

function missingActionLabel(action: MissingItem['action']) {
  if (action === 'subscribe') return 'Choose package';
  if (action === 'upload') return 'Upload documents';
  return 'Update details';
}

function missingActionIcon(action: MissingItem['action']) {
  if (action === 'subscribe') return Package;
  if (action === 'upload') return Upload;
  return UserRound;
}

function runMissingAction(action: MissingItem['action'], memberId: string) {
  if (action === 'subscribe') {
    openSubscription();
    return;
  }
  if (action === 'upload') {
    openUpload(memberId);
    return;
  }
  openEdit(memberId);
}

function statusTone(status?: string | null) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'ACTIVE' || normalized === 'APPROVED' || normalized === 'COMPLETED') return 'green';
  if (normalized === 'PENDING' || normalized === 'PARTIAL' || normalized === 'PROCESSING') return 'orange';
  if (normalized === 'REJECTED' || normalized === 'SUSPENDED' || normalized === 'INACTIVE') return 'red';
  return 'blue';
}

function formatFieldLabel(name: string) {
  return name.replace(/([A-Z])/g, ' $1').replace(/[._-]+/g, ' ').trim() || name;
}

const styles = StyleSheet.create({
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  missingList: {
    gap: 8,
  },
  missingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  missingText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  category: {
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  actions: {
    gap: 10,
  },
});
