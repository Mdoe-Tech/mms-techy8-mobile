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

import { useAuth } from '@/auth/auth-context';
import {
  MobileAmountInput,
  MobileButton,
  MobileCheckboxRow,
  MobileFormSection,
  MobileErrorState,
  MobileIconButton,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileSelect,
  MobileTextInput,
  MobileToast,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import {
  createAssociationMember,
  getAssociationMember,
  type AssociationMember,
  type MemberRegistrationPayload,
  updateAssociationMember,
} from '@/services/member-service';
import { getApiErrorMessage } from '@/types/api';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';

type MemberFormState = {
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
  shareCount: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  bankBranch: string;
  termsAccepted: boolean;
};

type MemberFormErrors = Partial<Record<keyof MemberFormState | 'submit', string>>;

const initialForm: MemberFormState = {
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
  shareCount: '',
  bankName: '',
  bankAccountNumber: '',
  bankAccountName: '',
  bankBranch: '',
  termsAccepted: false,
};

const memberTypeOptions = [
  { value: 'INDIVIDUAL', label: 'Individual' },
  { value: 'COMPANY', label: 'Company' },
  { value: 'FOUNDING_MEMBER', label: 'Founding member' },
];

type MobileMemberFormScreenProps = {
  mode?: 'create' | 'edit';
  memberId?: string;
};

export default function MobileMemberFormScreen({ mode = 'create', memberId }: MobileMemberFormScreenProps) {
  const { activeView, associationId, user } = useAuth();
  const [form, setForm] = useState<MemberFormState>(() => (mode === 'edit' ? { ...initialForm, termsAccepted: true } : initialForm));
  const [errors, setErrors] = useState<MemberFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(mode === 'edit');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadedMember, setLoadedMember] = useState<AssociationMember | null>(null);
  const [createdMember, setCreatedMember] = useState<AssociationMember | null>(null);

  const detailRoute = getRouteByPath('/associations/members/:memberId');
  const isCreate = mode === 'create';

  const subtitle = useMemo(() => {
    return user?.associationName || 'Association workspace';
  }, [user?.associationName]);

  const loadMember = useCallback(async () => {
    if (mode !== 'edit') return;
    if (!memberId) {
      setLoadError('Member context is missing.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      const member = await getAssociationMember(memberId);
      setLoadedMember(member);
      setForm(mapMemberToForm(member));
    } catch (error) {
      setLoadError(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [memberId, mode]);

  useEffect(() => {
    void Promise.resolve().then(loadMember);
  }, [loadMember]);

  if (activeView !== 'ADMIN') {
    return (
      <AccessDeniedScreen
        title="Add member"
        description="This native form is available for association admin workspaces only."
      />
    );
  }

  if (loading) {
    return <MobilePageLoadingState kind="form" message="Loading member form" />;
  }

  if (loadError) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Members"
          title={isCreate ? 'Add member' : 'Edit member'}
          subtitle={subtitle}
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry" variant="secondary" onPress={() => void loadMember()} />}
        />
        <MobileErrorState title="Member form could not load" description={loadError} retryLabel="Retry" onRetry={() => void loadMember()} />
      </MobileScreen>
    );
  }

  const setField = <Key extends keyof MemberFormState>(field: Key, value: MemberFormState[Key]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const resetForm = () => {
    setForm(initialForm);
    setErrors({});
    setCreatedMember(null);
  };

  const submit = async () => {
    if (!associationId) {
      setErrors({ submit: 'Association context is missing. Sign in through an association workspace first.' });
      return;
    }

    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    setCreatedMember(null);

    try {
      const payload: MemberRegistrationPayload = {
        fullLegalName: form.fullLegalName.trim(),
        memberType: form.memberType,
        employeeId: form.employeeId.trim() || undefined,
        firstRegistrationDate: form.firstRegistrationDate.trim() || undefined,
        dateOfBirth: form.dateOfBirth.trim() || undefined,
        shareCount: form.shareCount.trim() || undefined,
        termsAccepted: form.termsAccepted,
        registrationType: 'ADMIN_REGISTRATION',
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
      const member =
        mode === 'edit' && memberId
          ? await updateAssociationMember(memberId, loadedMember?.associationId || associationId, payload)
          : await createAssociationMember(associationId, payload);
      setLoadedMember(member);
      setCreatedMember(member);
      setErrors({});
    } catch (submitError) {
      setErrors({ submit: getApiErrorMessage(submitError) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Members"
        title={isCreate ? 'Add member' : 'Edit member'}
        subtitle={isCreate ? subtitle : loadedMember?.fullLegalName || subtitle}
        onBack={() => router.back()}
      />

      {createdMember ? (
        <MobileToast
          title={isCreate ? 'Member created' : 'Member updated'}
          description={
            isCreate
              ? `${createdMember.fullLegalName || 'Member'} was added to the association registry.`
              : `${createdMember.fullLegalName || 'Member'} details were updated.`
          }
        />
      ) : null}

      {errors.submit ? <MobileToast title="Could not save member" description={errors.submit} tone="danger" /> : null}

      <MobileFormSection
        title="Identity"
        description="Capture the member name and registration identifiers used across statements, loans, and payments."
      >
        <MobileTextInput
          label="Full legal name"
          value={form.fullLegalName}
          onChangeText={(value) => setField('fullLegalName', value)}
          placeholder="Enter member name"
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
        <MobileTextInput
          label="Employee ID"
          value={form.employeeId}
          onChangeText={(value) => setField('employeeId', value)}
          placeholder="Optional"
          helperText="Useful for union associations or payroll-linked members."
          icon={Hash}
          autoCapitalize="characters"
        />
        <MobileTextInput
          label="First registration date"
          value={form.firstRegistrationDate}
          onChangeText={(value) => setField('firstRegistrationDate', value)}
          placeholder="YYYY-MM-DD"
          helperText="Leave blank to let the system use the current registration date."
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
        description="These details create or connect the member user account and are required by the backend."
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
        title="Shares and banking"
        description="Optional financial setup. Payment schedules and packages can still be managed from their dedicated screens."
      >
        <MobileAmountInput
          label="Initial share count"
          value={form.shareCount}
          onChangeText={(value) => setField('shareCount', value)}
          helperText="Enter a number only, for example 10."
          error={errors.shareCount}
        />
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
        description="Confirm the association has permission to register this member and create a member account."
      >
        <MobileCheckboxRow
          checked={form.termsAccepted}
          onChange={(checked) => setField('termsAccepted', checked)}
          label="Registration details are confirmed"
          description="Required before the member can be submitted to Nane."
          error={errors.termsAccepted}
        />
      </MobileFormSection>

      <View style={styles.actions}>
        <MobileButton label="Cancel" icon={ArrowLeft} variant="secondary" onPress={() => router.back()} style={styles.actionButton} />
        <MobileButton
          label={isCreate ? 'Save member' : 'Update member'}
          icon={Save}
          loading={saving}
          onPress={submit}
          style={styles.actionButton}
        />
      </View>

      {createdMember ? (
        <View style={styles.successActions}>
          {isCreate ? <MobileButton label="Add another" variant="secondary" onPress={resetForm} fullWidth /> : null}
          <MobileButton
            label="Open member"
            fullWidth
            onPress={() => {
              if (detailRoute && createdMember.id) {
                router.replace({ pathname: '/work/route-preview', params: { routeId: detailRoute.id, memberId: createdMember.id } } as never);
              }
            }}
          />
        </View>
      ) : null}
    </MobileScreen>
  );
}

function mapMemberToForm(member: AssociationMember): MemberFormState {
  return {
    fullLegalName: member.fullLegalName || '',
    memberType: normalizeMemberType(member.memberType),
    employeeId: member.employeeId || '',
    firstRegistrationDate: dateOnly(member.firstRegistrationDate),
    dateOfBirth: dateOnly(member.dateOfBirth),
    phoneNumber: member.contactInfo?.phoneNumber || '',
    email: member.contactInfo?.email || '',
    physicalAddress: member.contactInfo?.physicalAddress || '',
    postalAddress: member.contactInfo?.postalAddress || '',
    website: member.contactInfo?.website || '',
    shareCount: '',
    bankName: member.bankName || '',
    bankAccountNumber: member.bankAccountNumber || '',
    bankAccountName: member.bankAccountName || '',
    bankBranch: member.bankBranch || '',
    termsAccepted: true,
  };
}

function normalizeMemberType(memberType?: string | null): MemberRegistrationPayload['memberType'] {
  if (memberType === 'COMPANY' || memberType === 'FOUNDING_MEMBER') return memberType;
  return 'INDIVIDUAL';
}

function dateOnly(value?: string | null) {
  return value ? value.slice(0, 10) : '';
}

function validateForm(form: MemberFormState) {
  const errors: MemberFormErrors = {};

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
  if (form.shareCount.trim()) {
    const shares = Number(form.shareCount.trim());
    if (!Number.isFinite(shares) || shares < 0) errors.shareCount = 'Enter a valid non-negative number.';
  }
  if (!form.termsAccepted) errors.termsAccepted = 'Confirm the registration details before saving.';

  return errors;
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
  },
  successActions: {
    gap: 10,
  },
});
