import { router } from 'expo-router';
import {
  ArrowLeft,
  BadgeCheck,
  Banknote,
  Building2,
  CalendarDays,
  CheckCircle2,
  FileText,
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
  MobileCard,
  MobileCheckboxRow,
  MobileEmptyState,
  MobileErrorState,
  MobileFormSection,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileProgressBar,
  MobileScreen,
  MobileSelect,
  MobileStickyActionBar,
  MobileStatusBadge,
  MobileText,
  MobileTextInput,
  MobileToast,
} from '@/components/mobile';
import { getPublicAssociationConfig } from '@/services/association-service';
import { getMemberDashboard, type MemberDashboardData } from '@/services/dashboard-service';
import {
  getCurrentMemberByUserId,
  registerCurrentMemberProfile,
  type AssociationMember,
  type MemberRegistrationPayload,
} from '@/services/member-service';
import { getApiErrorMessage } from '@/types/api';
import type { AuthUser } from '@/types/auth';
import { formatDate, formatPercent } from '@/utils/format';

type CompletionFormState = {
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
  termsAccepted: boolean;
  customData: Record<string, string>;
};

type CompletionErrors = Partial<Record<keyof Omit<CompletionFormState, 'customData'> | `custom.${string}` | 'submit', string>>;

type ConfigField = {
  name?: string | null;
  label?: string | null;
  type?: string | null;
  required?: boolean | string | number | null;
  formTypes?: string | null;
  details?: ConfigField[] | null;
};

type ConfigPage = {
  title?: string | null;
  fields?: ConfigField[] | null;
};

const memberTypeOptions = [
  { value: 'INDIVIDUAL', label: 'Individual' },
  { value: 'COMPANY', label: 'Company' },
  { value: 'FOUNDING_MEMBER', label: 'Founding member' },
];

const initialForm: CompletionFormState = {
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
  termsAccepted: false,
  customData: {},
};

export default function MobileMemberRegistrationCompleteScreen() {
  const { activeView, associationId, user } = useAuth();
  const userId = user?.userId;
  const [member, setMember] = useState<AssociationMember | null>(null);
  const [dashboard, setDashboard] = useState<MemberDashboardData | null>(null);
  const [configFields, setConfigFields] = useState<ConfigField[]>([]);
  const [form, setForm] = useState<CompletionFormState>(initialForm);
  const [errors, setErrors] = useState<CompletionErrors>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ title: string; description?: string; tone?: 'success' | 'danger' | 'warning' | 'info' } | null>(null);

  const associationType = (user?.associationType || dashboard?.associationType || '').toUpperCase();
  const isUnion = associationType === 'UNION';
  const progress = Number(member?.registrationProgress ?? dashboard?.registrationProgress ?? 0);
  const complete = isRegistrationComplete(member, dashboard);
  const requiredCustomFields = useMemo(() => configFields.filter((field) => isFieldRequired(field)), [configFields]);

  const loadContext = useCallback(
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
        const [memberResult, dashboardResult, configResult] = await Promise.allSettled([
          getCurrentMemberByUserId(userId),
          getMemberDashboard(),
          associationId ? getPublicAssociationConfig(associationId) : Promise.resolve(null),
        ]);

        const loadedMember = memberResult.status === 'fulfilled' ? memberResult.value : null;
        const loadedDashboard = dashboardResult.status === 'fulfilled' ? dashboardResult.value : null;
        setMember(loadedMember);
        setDashboard(loadedDashboard);

        const fields = configResult.status === 'fulfilled' ? extractConfigFields(configResult.value) : [];
        setConfigFields(fields);
        setForm(mapContextToForm(loadedMember, user, fields));

        if (!loadedMember && memberResult.status === 'rejected') {
          setToast({ title: 'No member profile yet', description: 'Complete this form to create your member profile.', tone: 'info' });
        }
      } catch (error) {
        setLoadError(getApiErrorMessage(error));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId, user, userId],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadContext());
  }, [loadContext]);

  if (activeView !== 'MEMBER') {
    return (
      <AccessDeniedScreen
        title="Complete registration"
        description="This native registration page is available from the member portal workspace."
      />
    );
  }

  if (loading && !member && !dashboard) {
    return <MobilePageLoadingState kind="form" message="Loading registration form" />;
  }

  if (loadError && !member && !dashboard) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Member portal"
          title="Complete registration"
          subtitle="Profile context unavailable"
          onBack={() => router.back()}
          rightAction={<MobileButton label="Retry" icon={RefreshCw} size="sm" variant="secondary" onPress={() => void loadContext('refresh')} />}
        />
        <MobileErrorState title="Registration form could not load" description={loadError} retryLabel="Retry" onRetry={() => void loadContext('refresh')} />
      </MobileScreen>
    );
  }

  const setField = <Key extends keyof Omit<CompletionFormState, 'customData'>>(field: Key, value: CompletionFormState[Key]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const setCustomField = (name: string, value: string) => {
    setForm((current) => ({ ...current, customData: { ...current.customData, [name]: value } }));
    setErrors((current) => {
      const key = `custom.${name}` as const;
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const submit = async () => {
    const effectiveAssociationId = member?.associationId || associationId;
    if (!effectiveAssociationId) {
      setErrors({ submit: 'Association context is missing. Sign in again from the member portal.' });
      return;
    }

    const nextErrors = validateForm(form, requiredCustomFields);
    setErrors(nextErrors);
    setToast(null);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      const payload: MemberRegistrationPayload = {
        fullLegalName: form.fullLegalName.trim(),
        memberType: form.memberType,
        employeeId: isUnion ? form.employeeId.trim() || undefined : undefined,
        firstRegistrationDate: form.firstRegistrationDate.trim() || undefined,
        dateOfBirth: form.dateOfBirth.trim() || undefined,
        termsAccepted: form.termsAccepted,
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
        customData: compactCustomData(form.customData),
      };
      const response = await registerCurrentMemberProfile(effectiveAssociationId, payload);
      setMember(response);
      setForm(mapContextToForm(response, user, configFields));
      setToast({ title: 'Registration complete', description: 'Your member profile was submitted successfully.', tone: 'success' });
    } catch (error) {
      const message = getApiErrorMessage(error);
      setErrors({ submit: message });
      setToast({ title: 'Could not complete registration', description: message, tone: 'danger' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MobileScreen
      refreshing={refreshing}
      onRefresh={() => void loadContext('refresh')}
      footer={
        !complete ? (
          <MobileStickyActionBar
            secondary={{ label: 'Cancel', icon: ArrowLeft, variant: 'secondary', onPress: () => router.back() }}
            primary={{ label: 'Submit', icon: Save, loading: submitting, disabled: submitting, onPress: submit }}
          />
        ) : undefined
      }
    >
      <MobilePageHeader
        showLogo
        eyebrow="Member portal"
        title="Complete registration"
        subtitle={member?.associationName || dashboard?.associationName || user?.associationName || 'Member profile'}
        onBack={() => router.back()}
        rightAction={
          <MobileButton
            label="Refresh"
            icon={RefreshCw}
            size="sm"
            variant="secondary"
            loading={refreshing}
            disabled={refreshing}
            onPress={() => void loadContext('refresh')}
          />
        }
      />

      {toast ? <MobileToast title={toast.title} description={toast.description} tone={toast.tone} /> : null}
      {errors.submit ? <MobileToast title="Registration not submitted" description={errors.submit} tone="danger" /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Profile" value={formatPercent(progress)} description={complete ? 'Completed' : 'Completion progress'} tone={complete ? 'green' : 'orange'} icon={CheckCircle2} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Status" value={member?.status || dashboard?.status || 'Pending'} description="Member registry state" tone={complete ? 'green' : 'orange'} icon={BadgeCheck} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard accent={complete ? 'green' : 'orange'}>
        <View style={styles.summaryHeader}>
          <View style={styles.summaryText}>
            <MobileText variant="section" weight="bold" numberOfLines={2}>
              {member?.fullLegalName || dashboard?.memberName || user?.fullName || 'Member registration'}
            </MobileText>
            <MobileText variant="small" tone="secondary" numberOfLines={2}>
              {member?.membershipNumber || dashboard?.membershipNumber || 'Membership number is assigned after completion'}
            </MobileText>
          </View>
          <MobileStatusBadge status={complete ? 'Completed' : 'Pending'} tone={complete ? 'success' : 'warning'} />
        </View>
        <MobileProgressBar value={progress} label="Registration progress" tone={complete ? 'green' : 'orange'} />
        <MobileInfoRow icon={Building2} label="Association" value={member?.associationName || dashboard?.associationName || user?.associationName || 'Not provided'} />
        <MobileInfoRow icon={CalendarDays} label="Last updated" value={formatDate(member?.updatedAt || dashboard?.lastUpdated || dashboard?.timestamp)} />
      </MobileCard>

      {complete ? (
        <MobileCard>
          <MobileEmptyState
            title="Registration is complete"
            description="Your member profile is already complete. You can continue to your profile or dashboard."
            actionLabel="Open profile"
            onAction={() => router.push({ pathname: '/work/route-preview', params: { routeId: 'member-member-profile' } } as never)}
          />
          <MobileButton label="Back to dashboard" icon={ArrowLeft} variant="secondary" fullWidth onPress={() => router.push({ pathname: '/work/route-preview', params: { routeId: 'member-member-dashboard' } } as never)} />
        </MobileCard>
      ) : (
        <>
          <MobileFormSection
            title="Identity"
            description="These details become your official member profile and certificate identity."
          >
            <MobileTextInput label="Full legal name" value={form.fullLegalName} onChangeText={(value) => setField('fullLegalName', value)} placeholder="Enter your full name" error={errors.fullLegalName} icon={UserRound} textContentType="name" />
            <MobileSelect label="Member type" value={form.memberType} options={memberTypeOptions} onChange={(value) => setField('memberType', value as MemberRegistrationPayload['memberType'])} />
            {isUnion ? (
              <MobileTextInput label="Employee ID" value={form.employeeId} onChangeText={(value) => setField('employeeId', value)} placeholder="Optional payroll or staff ID" icon={Hash} autoCapitalize="characters" />
            ) : null}
            <MobileTextInput label="First registration date" value={form.firstRegistrationDate} onChangeText={(value) => setField('firstRegistrationDate', value)} placeholder="YYYY-MM-DD" error={errors.firstRegistrationDate} icon={CalendarDays} />
            <MobileTextInput label="Date of birth" value={form.dateOfBirth} onChangeText={(value) => setField('dateOfBirth', value)} placeholder="YYYY-MM-DD" error={errors.dateOfBirth} icon={CalendarDays} />
          </MobileFormSection>

          <MobileFormSection
            title="Contact"
            description="Your association uses these details for notifications, receipts, and official communication."
          >
            <MobileTextInput label="Phone number" value={form.phoneNumber} onChangeText={(value) => setField('phoneNumber', value)} placeholder="+255..." error={errors.phoneNumber} icon={Phone} keyboardType="phone-pad" textContentType="telephoneNumber" />
            <MobileTextInput label="Email" value={form.email} onChangeText={(value) => setField('email', value)} placeholder="member@example.com" error={errors.email} icon={Mail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
            <MobileTextInput label="Physical address" value={form.physicalAddress} onChangeText={(value) => setField('physicalAddress', value)} placeholder="Street, ward, district" error={errors.physicalAddress} icon={MapPin} />
            <MobileTextInput label="Postal address" value={form.postalAddress} onChangeText={(value) => setField('postalAddress', value)} placeholder="P.O. Box or postal details" error={errors.postalAddress} icon={MapPin} />
            <MobileTextInput label="Website" value={form.website} onChangeText={(value) => setField('website', value)} placeholder="Optional" autoCapitalize="none" />
          </MobileFormSection>

          {configFields.length ? (
            <MobileFormSection title="Association fields" description="Additional fields required by your association configuration.">
              {configFields.map((field) => {
                const name = String(field.name || '');
                if (!name) return null;
                return (
                  <MobileTextInput
                    key={name}
                    label={field.label || formatFieldLabel(name)}
                    value={form.customData[name] || ''}
                    onChangeText={(value) => setCustomField(name, value)}
                    placeholder={isFieldRequired(field) ? 'Required' : 'Optional'}
                    error={errors[`custom.${name}`]}
                    icon={FileText}
                    multiline={String(field.type || '').toLowerCase() === 'textarea'}
                    numberOfLines={3}
                  />
                );
              })}
            </MobileFormSection>
          ) : null}

          <MobileFormSection title="Banking" description="Optional details for refunds, withdrawals, or payout workflows.">
            <MobileTextInput label="Bank name" value={form.bankName} onChangeText={(value) => setField('bankName', value)} placeholder="Optional" icon={Building2} />
            <MobileTextInput label="Account number" value={form.bankAccountNumber} onChangeText={(value) => setField('bankAccountNumber', value)} placeholder="Optional" icon={Banknote} keyboardType="number-pad" />
            <MobileTextInput label="Account name" value={form.bankAccountName} onChangeText={(value) => setField('bankAccountName', value)} placeholder="Optional" icon={BadgeCheck} />
            <MobileTextInput label="Branch" value={form.bankBranch} onChangeText={(value) => setField('bankBranch', value)} placeholder="Optional" icon={Building2} />
          </MobileFormSection>

          <MobileFormSection title="Review" description="Confirm the submitted information is accurate and can be used by your association.">
            <MobileCheckboxRow checked={form.termsAccepted} onChange={(checked) => setField('termsAccepted', checked)} label="I confirm these registration details" description="Required before your profile can be completed." error={errors.termsAccepted} />
          </MobileFormSection>

        </>
      )}
    </MobileScreen>
  );
}

function isRegistrationComplete(member: AssociationMember | null, dashboard: MemberDashboardData | null) {
  const progress = Number(member?.registrationProgress ?? dashboard?.registrationProgress ?? 0);
  const status = String(member?.status || dashboard?.status || '').toUpperCase();
  const membershipNumber = member?.membershipNumber || dashboard?.membershipNumber;
  return progress >= 100 && status !== 'PARTIAL' && Boolean(membershipNumber);
}

function mapContextToForm(member: AssociationMember | null, user: AuthUser | null, fields: ConfigField[]): CompletionFormState {
  const customData = Object.fromEntries(
    fields
      .map((field) => String(field.name || ''))
      .filter(Boolean)
      .map((name) => [name, formatCustomValue(member?.customAttributes?.[name])]),
  );
  return {
    ...initialForm,
    fullLegalName: member?.fullLegalName || user?.fullName || '',
    memberType: normalizeMemberType(member?.memberType),
    employeeId: member?.employeeId || '',
    firstRegistrationDate: dateOnly(member?.firstRegistrationDate),
    dateOfBirth: dateOnly(member?.dateOfBirth),
    phoneNumber: member?.contactInfo?.phoneNumber || '',
    email: member?.contactInfo?.email || user?.email || '',
    physicalAddress: member?.contactInfo?.physicalAddress === 'PENDING_SELF_REGISTRATION' ? '' : member?.contactInfo?.physicalAddress || '',
    postalAddress: member?.contactInfo?.postalAddress || '',
    website: member?.contactInfo?.website || '',
    bankName: member?.bankName || '',
    bankAccountNumber: member?.bankAccountNumber || '',
    bankAccountName: member?.bankAccountName || '',
    bankBranch: member?.bankBranch || '',
    termsAccepted: Boolean(member?.termsAccepted),
    customData,
  };
}

function validateForm(form: CompletionFormState, requiredFields: ConfigField[]) {
  const errors: CompletionErrors = {};
  if (!form.fullLegalName.trim()) errors.fullLegalName = 'Full legal name is required.';
  if (!form.phoneNumber.trim()) errors.phoneNumber = 'Phone number is required.';
  if (!form.email.trim()) {
    errors.email = 'Email is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }
  if (!form.physicalAddress.trim()) errors.physicalAddress = 'Physical address is required.';
  if (!form.postalAddress.trim()) errors.postalAddress = 'Postal address is required.';
  if (form.firstRegistrationDate.trim() && !isValidIsoDate(form.firstRegistrationDate.trim())) errors.firstRegistrationDate = 'Use YYYY-MM-DD.';
  if (form.dateOfBirth.trim() && !isValidIsoDate(form.dateOfBirth.trim())) errors.dateOfBirth = 'Use YYYY-MM-DD.';
  if (!form.termsAccepted) errors.termsAccepted = 'Confirm the registration details before submitting.';
  requiredFields.forEach((field) => {
    const name = String(field.name || '');
    if (name && !String(form.customData[name] || '').trim()) {
      errors[`custom.${name}`] = `${field.label || formatFieldLabel(name)} is required.`;
    }
  });
  return errors;
}

function extractConfigFields(config: unknown) {
  const root = toRecord(config);
  const settings = toRecord(root.settings);
  const nestedSettings = toRecord(settings.settings);
  const pages = firstArray(root.pages, settings.pages, nestedSettings.pages) as ConfigPage[];
  return pages
    .flatMap((page) => (Array.isArray(page.fields) ? page.fields : []))
    .filter((field) => field?.name)
    .slice(0, 12);
}

function firstArray(...values: unknown[]) {
  return values.find((value) => Array.isArray(value)) || [];
}

function toRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function compactCustomData(customData: Record<string, string>) {
  return Object.fromEntries(Object.entries(customData).filter(([, value]) => String(value || '').trim() !== ''));
}

function isFieldRequired(field: ConfigField) {
  const value = field.required;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return ['true', 'yes', '1'].includes(value.trim().toLowerCase());
  return false;
}

function normalizeMemberType(memberType?: string | null): MemberRegistrationPayload['memberType'] {
  if (memberType === 'COMPANY' || memberType === 'FOUNDING_MEMBER') return memberType;
  return 'INDIVIDUAL';
}

function dateOnly(value?: string | null) {
  return value ? value.slice(0, 10) : '';
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function formatFieldLabel(name: string) {
  return name.replace(/([A-Z])/g, ' $1').replace(/[._-]+/g, ' ').trim() || name;
}

function formatCustomValue(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
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
});
