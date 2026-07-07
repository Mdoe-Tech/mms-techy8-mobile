import { router } from 'expo-router';
import {
  ArrowLeft,
  BadgeCheck,
  Banknote,
  Building2,
  CalendarDays,
  Hash,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Save,
  UserRound,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCheckboxRow,
  MobileFormSection,
  MobileInfoRow,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileSelect,
  MobileStatusBadge,
  MobileText,
  MobileTextInput,
  MobileToast,
  MobileCard,
  MobileErrorState,
} from '@/components/mobile';
import {
  getCurrentMemberByUserId,
  updateCurrentMemberProfile,
  type AssociationMember,
  type MemberRegistrationPayload,
} from '@/services/member-service';
import { getApiErrorMessage } from '@/types/api';
import { formatDate } from '@/utils/format';

type MemberSelfEditState = {
  fullLegalName: string;
  memberType: MemberRegistrationPayload['memberType'];
  employeeId: string;
  firstRegistrationDate: string;
  dateOfBirth: string;
  phoneNumber: string;
  email: string;
  physicalAddress: string;
  postalAddress: string;
  website: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  bankBranch: string;
  confirmed: boolean;
};

type MemberSelfEditErrors = Partial<Record<keyof MemberSelfEditState | 'submit', string>>;

type MobileMemberSelfEditScreenProps = {
  memberId?: string;
};

const memberTypeOptions = [
  { value: 'INDIVIDUAL', label: 'Individual' },
  { value: 'COMPANY', label: 'Company' },
  { value: 'FOUNDING_MEMBER', label: 'Founding member' },
];

const initialForm: MemberSelfEditState = {
  fullLegalName: '',
  memberType: 'INDIVIDUAL',
  employeeId: '',
  firstRegistrationDate: '',
  dateOfBirth: '',
  phoneNumber: '',
  email: '',
  physicalAddress: '',
  postalAddress: '',
  website: '',
  bankName: '',
  bankAccountNumber: '',
  bankAccountName: '',
  bankBranch: '',
  confirmed: false,
};

export default function MobileMemberSelfEditScreen({ memberId }: MobileMemberSelfEditScreenProps) {
  const { activeView, associationId, user } = useAuth();
  const userId = user?.userId;
  const associationType = user?.associationType?.toUpperCase();
  const [member, setMember] = useState<AssociationMember | null>(null);
  const [form, setForm] = useState<MemberSelfEditState>(initialForm);
  const [errors, setErrors] = useState<MemberSelfEditErrors>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ title: string; description?: string; tone?: 'success' | 'danger' | 'warning' | 'info' } | null>(null);

  const title = useMemo(() => member?.fullLegalName || user?.fullName || 'My profile', [member?.fullLegalName, user?.fullName]);
  const canShowUnionFields = associationType === 'UNION';

  const loadMember = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!userId) {
        setLoading(false);
        setLoadError('Member session is missing the user identifier.');
        return;
      }

      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setLoadError(null);
      setToast(null);

      try {
        const response = await getCurrentMemberByUserId(userId);
        if (memberId && response.id && memberId !== response.id) {
          setMember(null);
          setLoadError('This edit route does not match the signed-in member profile.');
          return;
        }
        setMember(response);
        setForm(mapMemberToForm(response));
      } catch (error) {
        setLoadError(getApiErrorMessage(error));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [memberId, userId],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadMember());
  }, [loadMember]);

  if (activeView !== 'MEMBER') {
    return (
      <AccessDeniedScreen
        title="Edit profile"
        description="This native profile edit page is available from the member portal workspace."
      />
    );
  }

  if (loading && !member) {
    return <MobilePageLoadingState kind="form" message="Loading profile form" />;
  }

  if (loadError && !member) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Member portal"
          title="Edit profile"
          subtitle="Profile context unavailable"
          onBack={() => router.back()}
          rightAction={<MobileButton label="Retry" icon={RefreshCw} size="sm" variant="secondary" onPress={() => void loadMember('refresh')} />}
        />
        <MobileErrorState title="Profile form could not load" description={loadError} retryLabel="Retry" onRetry={() => void loadMember('refresh')} />
      </MobileScreen>
    );
  }

  const setField = <Key extends keyof MemberSelfEditState>(field: Key, value: MemberSelfEditState[Key]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const submit = async () => {
    const effectiveAssociationId = member?.associationId || associationId;
    if (!effectiveAssociationId) {
      setErrors({ submit: 'Association context is missing. Sign in through the member portal again.' });
      return;
    }

    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    setToast(null);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      const payload: MemberRegistrationPayload = {
        fullLegalName: form.fullLegalName.trim(),
        memberType: form.memberType,
        employeeId: canShowUnionFields ? form.employeeId.trim() || undefined : undefined,
        firstRegistrationDate: form.firstRegistrationDate.trim() || undefined,
        dateOfBirth: form.dateOfBirth.trim() || undefined,
        termsAccepted: true,
        registrationType: 'SELF_REGISTRATION',
        contactInfo: {
          physicalAddress: form.physicalAddress.trim(),
          postalAddress: form.postalAddress.trim(),
          phoneNumber: form.phoneNumber.trim(),
          email: form.email.trim().toLowerCase(),
          website: form.website.trim() || undefined,
        },
        bankName: form.bankName.trim() || undefined,
        bankAccountNumber: form.bankAccountNumber.trim() || undefined,
        bankAccountName: form.bankAccountName.trim() || undefined,
        bankBranch: form.bankBranch.trim() || undefined,
      };
      const updated = await updateCurrentMemberProfile(effectiveAssociationId, payload);
      setMember(updated);
      setForm(mapMemberToForm(updated));
      setErrors({});
      setToast({ title: 'Profile updated', description: 'Your profile details were saved.', tone: 'success' });
    } catch (error) {
      setErrors({ submit: getApiErrorMessage(error) });
      setToast({ title: 'Could not update profile', description: getApiErrorMessage(error), tone: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Member portal"
        title="Edit profile"
        subtitle={member?.associationName || user?.associationName || 'Member profile'}
        onBack={() => router.back()}
        rightAction={
          <MobileButton
            label="Refresh"
            icon={RefreshCw}
            size="sm"
            variant="secondary"
            loading={refreshing}
            disabled={refreshing}
            onPress={() => void loadMember('refresh')}
          />
        }
      />

      {toast ? <MobileToast title={toast.title} description={toast.description} tone={toast.tone} /> : null}
      {errors.submit ? <MobileToast title="Profile not saved" description={errors.submit} tone="danger" /> : null}

      <MobileCard accent="blue">
        <View style={styles.summaryHeader}>
          <View style={styles.summaryText}>
            <MobileText variant="section" weight="bold" numberOfLines={2}>
              {title}
            </MobileText>
            <MobileText variant="small" tone="secondary" numberOfLines={2}>
              {member?.membershipNumber || 'Membership number pending'} · {member?.memberType || 'Member'}
            </MobileText>
          </View>
          <MobileStatusBadge status={member?.status || 'Unknown'} />
        </View>
        <MobileInfoRow icon={Building2} label="Association" value={member?.associationName || user?.associationName || 'Not provided'} />
        <MobileInfoRow icon={CalendarDays} label="Last updated" value={formatDate(member?.updatedAt)} />
      </MobileCard>

      <MobileFormSection
        title="Identity"
        description="Keep your official profile details accurate for statements, certificates, and association records."
      >
        <MobileTextInput
          label="Full legal name"
          value={form.fullLegalName}
          onChangeText={(value) => setField('fullLegalName', value)}
          placeholder="Enter your full name"
          error={errors.fullLegalName}
          icon={UserRound}
          textContentType="name"
        />
        <MobileSelect
          label="Member type"
          value={form.memberType}
          options={memberTypeOptions}
          onChange={(value) => setField('memberType', value as MemberRegistrationPayload['memberType'])}
        />
        {canShowUnionFields ? (
          <MobileTextInput
            label="Employee ID"
            value={form.employeeId}
            onChangeText={(value) => setField('employeeId', value)}
            placeholder="Optional"
            icon={Hash}
            autoCapitalize="characters"
          />
        ) : null}
        <MobileTextInput
          label="First registration date"
          value={form.firstRegistrationDate}
          onChangeText={(value) => setField('firstRegistrationDate', value)}
          placeholder="YYYY-MM-DD"
          error={errors.firstRegistrationDate}
          icon={CalendarDays}
        />
        <MobileTextInput
          label="Date of birth"
          value={form.dateOfBirth}
          onChangeText={(value) => setField('dateOfBirth', value)}
          placeholder="YYYY-MM-DD"
          error={errors.dateOfBirth}
          icon={CalendarDays}
        />
      </MobileFormSection>

      <MobileFormSection
        title="Contact"
        description="These details are used by the association for official communication and member notifications."
      >
        <MobileTextInput
          label="Phone number"
          value={form.phoneNumber}
          onChangeText={(value) => setField('phoneNumber', value)}
          placeholder="+255..."
          error={errors.phoneNumber}
          icon={Phone}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
        />
        <MobileTextInput
          label="Email"
          value={form.email}
          onChangeText={(value) => setField('email', value)}
          placeholder="member@example.com"
          error={errors.email}
          icon={Mail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <MobileTextInput
          label="Physical address"
          value={form.physicalAddress}
          onChangeText={(value) => setField('physicalAddress', value)}
          placeholder="Street, ward, district"
          error={errors.physicalAddress}
          icon={MapPin}
        />
        <MobileTextInput
          label="Postal address"
          value={form.postalAddress}
          onChangeText={(value) => setField('postalAddress', value)}
          placeholder="P.O. Box or postal details"
          error={errors.postalAddress}
          icon={MapPin}
        />
        <MobileTextInput
          label="Website"
          value={form.website}
          onChangeText={(value) => setField('website', value)}
          placeholder="Optional"
          autoCapitalize="none"
        />
      </MobileFormSection>

      <MobileFormSection
        title="Banking"
        description="Optional payout and refund details. Your association may review these before using them."
      >
        <MobileTextInput
          label="Bank name"
          value={form.bankName}
          onChangeText={(value) => setField('bankName', value)}
          placeholder="Optional"
          icon={Building2}
        />
        <MobileTextInput
          label="Account number"
          value={form.bankAccountNumber}
          onChangeText={(value) => setField('bankAccountNumber', value)}
          placeholder="Optional"
          icon={Banknote}
          keyboardType="number-pad"
        />
        <MobileTextInput
          label="Account name"
          value={form.bankAccountName}
          onChangeText={(value) => setField('bankAccountName', value)}
          placeholder="Optional"
          icon={BadgeCheck}
        />
        <MobileTextInput
          label="Branch"
          value={form.bankBranch}
          onChangeText={(value) => setField('bankBranch', value)}
          placeholder="Optional"
          icon={Building2}
        />
      </MobileFormSection>

      <MobileFormSection
        title="Review"
        description="Confirm the details are accurate before saving your profile."
      >
        <MobileCheckboxRow
          checked={form.confirmed}
          onChange={(checked) => setField('confirmed', checked)}
          label="Profile details are correct"
          description="Required before your changes can be submitted."
          error={errors.confirmed}
        />
      </MobileFormSection>

      <View style={styles.actions}>
        <MobileButton label="Cancel" icon={ArrowLeft} variant="secondary" onPress={() => router.back()} style={styles.actionButton} />
        <MobileButton
          label="Save profile"
          icon={Save}
          loading={saving}
          disabled={saving}
          onPress={submit}
          style={styles.actionButton}
        />
      </View>
    </MobileScreen>
  );
}

function mapMemberToForm(member: AssociationMember): MemberSelfEditState {
  return {
    fullLegalName: member.fullLegalName || '',
    memberType: normalizeMemberType(member.memberType),
    employeeId: member.employeeId || '',
    firstRegistrationDate: dateOnly(member.firstRegistrationDate),
    dateOfBirth: dateOnly(member.dateOfBirth),
    phoneNumber: member.contactInfo?.phoneNumber || '',
    email: member.contactInfo?.email || '',
    physicalAddress: member.contactInfo?.physicalAddress === 'PENDING_SELF_REGISTRATION' ? '' : member.contactInfo?.physicalAddress || '',
    postalAddress: member.contactInfo?.postalAddress || '',
    website: member.contactInfo?.website || '',
    bankName: member.bankName || '',
    bankAccountNumber: member.bankAccountNumber || '',
    bankAccountName: member.bankAccountName || '',
    bankBranch: member.bankBranch || '',
    confirmed: true,
  };
}

function normalizeMemberType(memberType?: string | null): MemberRegistrationPayload['memberType'] {
  if (memberType === 'COMPANY' || memberType === 'FOUNDING_MEMBER') return memberType;
  return 'INDIVIDUAL';
}

function dateOnly(value?: string | null) {
  return value ? value.slice(0, 10) : '';
}

function validateForm(form: MemberSelfEditState) {
  const errors: MemberSelfEditErrors = {};

  if (!form.fullLegalName.trim()) errors.fullLegalName = 'Full legal name is required.';
  if (!form.phoneNumber.trim()) errors.phoneNumber = 'Phone number is required.';
  if (!form.email.trim()) {
    errors.email = 'Email is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }
  if (!form.physicalAddress.trim()) errors.physicalAddress = 'Physical address is required.';
  if (!form.postalAddress.trim()) errors.postalAddress = 'Postal address is required.';
  if (form.firstRegistrationDate.trim() && !isValidIsoDate(form.firstRegistrationDate.trim())) {
    errors.firstRegistrationDate = 'Use YYYY-MM-DD.';
  }
  if (form.dateOfBirth.trim() && !isValidIsoDate(form.dateOfBirth.trim())) {
    errors.dateOfBirth = 'Use YYYY-MM-DD.';
  }
  if (!form.confirmed) errors.confirmed = 'Confirm the details before saving.';

  return errors;
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
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
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
  },
});
