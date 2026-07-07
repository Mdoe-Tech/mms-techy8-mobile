import { router } from 'expo-router';
import {
  Bell,
  Building2,
  CalendarDays,
  CreditCard,
  Edit3,
  FileText,
  Globe,
  IdCard,
  Landmark,
  Mail,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileAvatar,
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
  MobileSelect,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileSummaryPanel,
  MobileText,
  MobileToast,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import { getPublicAssociationConfig, type AssociationConfig } from '@/services/association-service';
import {
  getCurrentMemberByUserId,
  getCurrentMemberPackage,
  updateCurrentMemberPreferences,
  type AssociationMember,
  type CurrentMemberPackage,
} from '@/services/member-service';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber, formatPercent, formatTzs } from '@/utils/format';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';

const notificationLanguages = [
  { value: 'en', label: 'English' },
  { value: 'sw', label: 'Swahili (Kiswahili)' },
  { value: 'ar', label: 'Arabic' },
  { value: 'fr', label: 'French' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'es', label: 'Spanish' },
];

type MemberProfileTab = 'overview' | 'contact' | 'preferences';

type MobileMemberProfileScreenProps = {
  initialTab?: MemberProfileTab;
};

export default function MobileMemberProfileScreen({ initialTab = 'overview' }: MobileMemberProfileScreenProps) {
  const { activeView, user } = useAuth();
  const userId = user?.userId;
  const associationType = user?.associationType;
  const [member, setMember] = useState<AssociationMember | null>(null);
  const [associationConfig, setAssociationConfig] = useState<AssociationConfig | null>(null);
  const [currentPackage, setCurrentPackage] = useState<CurrentMemberPackage | null>(null);
  const [smsLanguage, setSmsLanguage] = useState('en');
  const [savedSmsLanguage, setSavedSmsLanguage] = useState('en');
  const [tab, setTab] = useState<MemberProfileTab>(initialTab);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingPreference, setSavingPreference] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sectionWarning, setSectionWarning] = useState<string | null>(null);
  const [toast, setToast] = useState<{ title: string; description?: string; tone?: 'success' | 'danger' | 'warning' | 'info' } | null>(null);

  const editRoute = getRouteByPath('/member/:memberId/edit');
  const securityRoute = getRouteByPath('/member/profile/security');
  const documentsRoute = getRouteByPath('/member/upload-document/:memberId/documents');
  const registrationRoute = getRouteByPath('/member/registration/complete');

  const loadProfile = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!userId) {
        setLoading(false);
        setError('Member session is missing the user identifier.');
        return;
      }

      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      setSectionWarning(null);

      try {
        const memberResponse = await getCurrentMemberByUserId(userId);
        setMember(memberResponse);

        const savedLanguage = normalizeLanguage(memberResponse.customAttributes?.['sms.language']) || 'en';
        setSmsLanguage(savedLanguage);
        setSavedSmsLanguage(savedLanguage);

        const configResult = memberResponse.associationId
          ? await Promise.allSettled([
              getPublicAssociationConfig(memberResponse.associationId),
              shouldLoadPackage(associationType) ? getCurrentMemberPackage(memberResponse.associationId) : Promise.resolve(null),
            ])
          : [];

        if (configResult[0]?.status === 'fulfilled') {
          setAssociationConfig(configResult[0].value);
        } else {
          setAssociationConfig(null);
        }

        if (configResult[1]?.status === 'fulfilled') {
          setCurrentPackage(configResult[1].value);
        } else {
          setCurrentPackage(null);
          if (shouldLoadPackage(associationType)) {
            setSectionWarning('Package information is not available for this member yet.');
          }
        }
      } catch (loadError) {
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationType, userId],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadProfile());
  }, [loadProfile]);

  const languageOptions = useMemo(
    () => extractNotificationLanguages(associationConfig, savedSmsLanguage),
    [associationConfig, savedSmsLanguage],
  );

  const customEntries = useMemo(() => {
    return Object.entries(member?.customAttributes || {})
      .filter(([key, value]) => key !== 'filePaths' && key !== 'sms.language' && value !== null && value !== undefined && String(value).trim() !== '')
      .slice(0, 8);
  }, [member?.customAttributes]);

  const savePreference = async () => {
    setSavingPreference(true);
    setToast(null);
    try {
      const updated = await updateCurrentMemberPreferences({ smsLanguage });
      setSavedSmsLanguage(smsLanguage);
      setMember((current) =>
        current
          ? {
              ...current,
              customAttributes: {
                ...(current.customAttributes || {}),
                ...updated,
                'sms.language': smsLanguage,
              },
            }
          : current,
      );
      setToast({ title: 'Preference saved', description: 'Notification language was updated.', tone: 'success' });
    } catch (saveError) {
      setToast({ title: 'Preference failed', description: getApiErrorMessage(saveError), tone: 'danger' });
    } finally {
      setSavingPreference(false);
    }
  };

  if (activeView !== 'MEMBER') {
    return (
      <AccessDeniedScreen
        title="My profile"
        description="This native profile page is available from the member portal workspace."
      />
    );
  }

  if (loading && !member) {
    return <MobilePageLoadingState kind="detail" message="Loading member profile" />;
  }

  if (error && !member) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Member portal"
          title="My profile"
          subtitle="Profile context unavailable"
          rightAction={<MobileButton label="Retry" icon={RefreshCw} size="sm" variant="secondary" onPress={() => void loadProfile('refresh')} />}
        />
        <MobileErrorState title="Profile could not load" description={error} retryLabel="Retry" onRetry={() => void loadProfile('refresh')} />
      </MobileScreen>
    );
  }

  if (!member) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Member portal" title="My profile" />
        <MobileEmptyState
          title="No member profile"
          description="Complete your registration to create your member profile."
          actionLabel="Start registration"
          onAction={() => {
            if (registrationRoute) router.push({ pathname: '/work/route-preview', params: { routeId: registrationRoute.id } } as never);
          }}
        />
      </MobileScreen>
    );
  }

  const name = member.fullLegalName || user?.fullName || 'Member';
  const status = member.status || 'Unknown';
  const progress = Number(member.registrationProgress || 0);
  const memberType = member.memberType || 'Member';
  const joinedDate = member.firstRegistrationDate || member.createdAt;
  const documentCount = member.documents?.length || 0;
  const shareCount = (member.shares || []).reduce((sum, share) => sum + Number(share.shareCount || 0), 0);
  const shareValue = (member.shares || []).reduce((sum, share) => sum + Number(share.totalShareValue || share.currentShareValue || 0), 0);
  const isUnion = user?.associationType?.toUpperCase() === 'UNION';
  const isPackageSupported = shouldLoadPackage(user?.associationType);

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Member portal"
        title="My profile"
        subtitle={member.associationName || user?.associationName || 'Member profile'}
        rightAction={
          <MobileButton label="Refresh" icon={RefreshCw} size="sm" variant="secondary" loading={refreshing} disabled={refreshing} onPress={() => void loadProfile('refresh')} />
        }
      />

      {toast ? <MobileToast title={toast.title} description={toast.description} tone={toast.tone} /> : null}
      {sectionWarning ? <MobileStatusBadge status="Unavailable" label={sectionWarning} tone="warning" /> : null}

      <MobileCard accent="blue">
        <View style={styles.profileHero}>
          <MobileAvatar name={name} size="lg" tone={statusAccent(status)} />
          <View style={styles.profileText}>
            <MobileText variant="title" weight="bold" numberOfLines={2}>
              {name}
            </MobileText>
            <MobileText variant="body" tone="secondary" numberOfLines={2}>
              {member.membershipNumber || 'Membership number pending'} · {memberType}
            </MobileText>
            <View style={styles.badgeRow}>
              <MobileStatusBadge status={status} />
              <MobileStatusBadge status={user?.associationType || 'Association'} tone={isUnion ? 'info' : 'neutral'} />
            </View>
          </View>
        </View>
        <MobileProgressBar value={progress} label="Registration progress" tone="green" style={styles.progress} />
      </MobileCard>

      <MobileStatusTabs
        value={tab}
        onChange={(next) => setTab(next as MemberProfileTab)}
        tabs={[
          { value: 'overview', label: 'Overview', count: 3 },
          { value: 'contact', label: 'Contact', count: countContactFields(member) },
          { value: 'preferences', label: 'Preferences', count: 1 },
        ]}
      />

      {tab === 'overview' ? (
        <View style={styles.sectionStack}>
          <MobileKpiGrid>
            <MobileKpiGridItem>
              <MobileKpiCard title="Profile" value={formatPercent(progress)} description="Registration complete" tone="green" icon={ShieldCheck} />
            </MobileKpiGridItem>
            <MobileKpiGridItem>
              <MobileKpiCard title="Documents" value={formatNumber(documentCount)} description="Uploaded documents" tone="blue" icon={FileText} />
            </MobileKpiGridItem>
            <MobileKpiGridItem>
              <MobileKpiCard title={isUnion ? 'Member type' : 'Shares'} value={isUnion ? memberType : formatNumber(shareCount)} description={isUnion ? 'Union member profile' : formatTzs(shareValue)} tone="teal" icon={IdCard} />
            </MobileKpiGridItem>
          </MobileKpiGrid>

          <MobileCard>
            <MobileText variant="section" weight="bold">
              Profile actions
            </MobileText>
            <View style={styles.actionGrid}>
              <MobileButton
                label="Edit profile"
                icon={Edit3}
                style={styles.actionButton}
                onPress={() => {
                  if (editRoute) router.push({ pathname: '/work/route-preview', params: { routeId: editRoute.id, memberId: member.id } } as never);
                }}
              />
              <MobileButton
                label="Security"
                icon={ShieldCheck}
                variant="secondary"
                style={styles.actionButton}
                onPress={() => {
                  if (securityRoute) router.push({ pathname: '/work/route-preview', params: { routeId: securityRoute.id } } as never);
                }}
              />
              <MobileButton
                label="Documents"
                icon={FileText}
                variant="secondary"
                style={styles.actionButton}
                onPress={() => {
                  if (documentsRoute) router.push({ pathname: '/work/route-preview', params: { routeId: documentsRoute.id, memberId: member.id } } as never);
                }}
              />
            </View>
          </MobileCard>

          <MobileSummaryPanel
            title="Membership"
            value={member.membershipNumber || 'Pending'}
            description={`${member.associationName || 'Association'} · Joined ${formatDate(joinedDate)}`}
            tone="blue"
            icon={Building2}
          />

          {isPackageSupported ? (
            <MobileCard>
              <View style={styles.sectionHeader}>
                <MobileText variant="section" weight="bold">
                  Package
                </MobileText>
                <MobileStatusBadge status={currentPackage?.status || (currentPackage ? 'Active' : 'Unavailable')} />
              </View>
              <MobileInfoRow icon={Package} label="Package name" value={currentPackage?.name || member.packageName || 'No active package'} helper={currentPackage?.description || 'Package subscription appears here when available.'} />
              <MobileInfoRow icon={CreditCard} label="Price" value={currentPackage?.price ? formatTzs(currentPackage.price) : 'Not provided'} />
            </MobileCard>
          ) : null}

          <MobileCard>
            <View style={styles.sectionHeader}>
              <MobileText variant="section" weight="bold">
                Banking
              </MobileText>
              <Landmark size={18} />
            </View>
            <MobileInfoRow icon={Landmark} label="Bank name" value={member.bankName || 'Not provided'} />
            <MobileInfoRow icon={CreditCard} label="Account number" value={member.bankAccountNumber || 'Not provided'} />
            <MobileInfoRow icon={UserRound} label="Account name" value={member.bankAccountName || 'Not provided'} />
            <MobileInfoRow icon={MapPin} label="Branch" value={member.bankBranch || 'Not provided'} />
          </MobileCard>

          {customEntries.length ? (
            <MobileCard>
              <MobileText variant="section" weight="bold">
                Additional information
              </MobileText>
              {customEntries.map(([key, value]) => (
                <MobileInfoRow key={key} label={formatCustomKey(key)} value={formatCustomValue(value)} />
              ))}
            </MobileCard>
          ) : (
            <MobileEmptyState title="No additional information" description="Any configured custom profile fields will appear here after they are completed." />
          )}
        </View>
      ) : null}

      {tab === 'contact' ? (
        <MobileCard>
          <MobileText variant="section" weight="bold">
            Contact details
          </MobileText>
          <MobileInfoRow icon={Mail} label="Email" value={member.contactInfo?.email || user?.email || 'Not provided'} />
          <MobileInfoRow icon={Phone} label="Phone" value={member.contactInfo?.phoneNumber || 'Not provided'} />
          <MobileInfoRow icon={MapPin} label="Physical address" value={member.contactInfo?.physicalAddress || 'Not provided'} />
          <MobileInfoRow icon={FileText} label="Postal address" value={member.contactInfo?.postalAddress || 'Not provided'} />
          <MobileInfoRow icon={Globe} label="Website" value={member.contactInfo?.website || 'Not provided'} />
          <View style={styles.contactButtons}>
            <MobileButton
              label="Email"
              icon={Mail}
              variant="secondary"
              disabled={!member.contactInfo?.email}
              onPress={() => {
                if (member.contactInfo?.email) void Linking.openURL(`mailto:${member.contactInfo.email}`);
              }}
            />
            <MobileButton
              label="Call"
              icon={Phone}
              variant="secondary"
              disabled={!member.contactInfo?.phoneNumber}
              onPress={() => {
                if (member.contactInfo?.phoneNumber) void Linking.openURL(`tel:${member.contactInfo.phoneNumber}`);
              }}
            />
          </View>
        </MobileCard>
      ) : null}

      {tab === 'preferences' ? (
        <MobileCard>
          <View style={styles.sectionHeader}>
            <MobileText variant="section" weight="bold">
              Notification preferences
            </MobileText>
            <Bell size={18} />
          </View>
          <MobileText variant="small" tone="secondary">
            Choose the language used for reminders and member notifications.
          </MobileText>
          <MobileSelect
            label="Notification language"
            value={smsLanguage}
            options={languageOptions}
            onChange={setSmsLanguage}
            helperText="Configured by your association settings."
          />
          <MobileButton
            label="Save preference"
            icon={ShieldCheck}
            loading={savingPreference}
            disabled={savingPreference || smsLanguage === savedSmsLanguage}
            onPress={() => void savePreference()}
          />
          <MobileInfoRow icon={CalendarDays} label="Last profile update" value={formatDate(member.updatedAt)} />
        </MobileCard>
      ) : null}
    </MobileScreen>
  );
}

function shouldLoadPackage(associationType?: string | null) {
  const normalized = associationType?.toUpperCase();
  return normalized !== 'VIKOBA' && normalized !== 'UNION';
}

function normalizeLanguage(value: unknown) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace('_', '-').toLowerCase();
  return /^[a-z]{2,8}(-[a-z0-9]{2,8})*$/i.test(normalized) ? normalized : null;
}

function extractNotificationLanguages(config: AssociationConfig | null, currentLanguage?: string | null) {
  const settings = config?.settings || {};
  const rawEnabled = settings['notifications.languages.enabled'];
  const rawDefault = settings['notifications.languages.default'] || settings['sms.language'];
  const codes = new Set<string>();
  const defaultLanguage = normalizeLanguage(rawDefault);
  const savedLanguage = normalizeLanguage(currentLanguage || '');

  if (defaultLanguage) codes.add(defaultLanguage);
  if (Array.isArray(rawEnabled)) {
    rawEnabled.forEach((item) => {
      const code = normalizeLanguage(String(item));
      if (code) codes.add(code);
    });
  } else if (typeof rawEnabled === 'string') {
    rawEnabled.split(',').forEach((item) => {
      const code = normalizeLanguage(item);
      if (code) codes.add(code);
    });
  }
  if (savedLanguage) codes.add(savedLanguage);
  if (!codes.size) {
    codes.add('en');
    codes.add('sw');
  }

  return Array.from(codes).map((code) => notificationLanguages.find((language) => language.value === code) || { value: code, label: code.toUpperCase() });
}

function statusAccent(status?: string | null) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'ACTIVE' || normalized === 'APPROVED') return 'success';
  if (normalized === 'PENDING' || normalized === 'PARTIAL') return 'warning';
  if (normalized === 'SUSPENDED' || normalized === 'INACTIVE' || normalized === 'REJECTED') return 'danger';
  return 'primary';
}

function countContactFields(member: AssociationMember) {
  return [
    member.contactInfo?.email,
    member.contactInfo?.phoneNumber,
    member.contactInfo?.physicalAddress,
    member.contactInfo?.postalAddress,
    member.contactInfo?.website,
  ].filter(Boolean).length;
}

function formatCustomKey(key: string) {
  return key.replace(/([A-Z])/g, ' $1').replace(/[._-]+/g, ' ').trim() || key;
}

function formatCustomValue(value: unknown) {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

const styles = StyleSheet.create({
  profileHero: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  profileText: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  progress: {
    marginTop: 16,
  },
  actionGrid: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    flexGrow: 1,
    flexBasis: '47%',
  },
  sectionStack: {
    gap: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  contactButtons: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
