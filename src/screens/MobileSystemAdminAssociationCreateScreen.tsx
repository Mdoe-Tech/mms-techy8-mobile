import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  Calendar,
  CheckCircle2,
  FileBadge2,
  FileCheck2,
  Image as ImageIcon,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  UploadCloud,
  UserPlus,
  X,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileConfirmSheet,
  MobileFileUpload,
  MobileFormSection,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobileScreen,
  MobileSelect,
  MobileStatusBadge,
  MobileText,
  MobileTextInput,
  MobileToast,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  createAssociationWithAdmin,
  type AssociationCreateWithAdminPayload,
  type AssociationProfile,
  type AssociationProfileUploadFile,
} from '@/services/association-service';
import { getApiErrorMessage } from '@/types/api';
import { formatNumber } from '@/utils/format';

type AssociationType = AssociationCreateWithAdminPayload['type'];

type CreateAssociationForm = {
  name: string;
  type: AssociationType;
  address: string;
  email: string;
  telephoneNumber: string;
  dateOfRegistration: string;
  tin: string;
  vrn: string;
  registrationNumber: string;
  adminFullName: string;
  adminEmail: string;
  adminPassword: string;
  adminPhoneNumber: string;
};

type FileField = 'businessLicense' | 'certificateOfIncorporation' | 'logo';

type FileState = Record<FileField, AssociationProfileUploadFile | null>;

type CreateAssociationMode = 'sample' | 'confirm';

type MobileSystemAdminAssociationCreateScreenProps = {
  initialMode?: CreateAssociationMode;
};

const emptyForm: CreateAssociationForm = {
  name: '',
  type: 'GENERIC',
  address: '',
  email: '',
  telephoneNumber: '',
  dateOfRegistration: '',
  tin: '',
  vrn: '',
  registrationNumber: '',
  adminFullName: '',
  adminEmail: '',
  adminPassword: '',
  adminPhoneNumber: '',
};

const sampleForm: CreateAssociationForm = {
  name: 'Mobile Preview Cooperative',
  type: 'VIKOBA',
  address: 'Plot 42, Mikocheni, Dar es Salaam',
  email: 'mobile.preview.association@nane.test',
  telephoneNumber: '+255700100200',
  dateOfRegistration: '2026-07-06',
  tin: 'TIN-2026-MOBILE',
  vrn: '',
  registrationNumber: 'REG-MOBILE-2026',
  adminFullName: 'Mobile Preview Admin',
  adminEmail: 'mobile.preview.admin@nane.test',
  adminPassword: 'MobilePreview@2026',
  adminPhoneNumber: '+255700100201',
};

const emptyFiles: FileState = {
  businessLicense: null,
  certificateOfIncorporation: null,
  logo: null,
};

const associationTypeOptions = [
  { label: 'Generic association', value: 'GENERIC' },
  { label: 'Vikoba group', value: 'VIKOBA' },
  { label: 'SACCOS', value: 'SACCOS' },
  { label: 'Union', value: 'UNION' },
];

export default function MobileSystemAdminAssociationCreateScreen({
  initialMode,
}: MobileSystemAdminAssociationCreateScreenProps = {}) {
  const { activeView } = useAuth();
  const [form, setForm] = useState<CreateAssociationForm>(() => (initialMode ? sampleForm : emptyForm));
  const [files, setFiles] = useState<FileState>(emptyFiles);
  const [errors, setErrors] = useState<Partial<Record<keyof CreateAssociationForm, string>>>({});
  const [notice, setNotice] = useState<{ title: string; description?: string; tone?: 'success' | 'warning' | 'danger' } | null>(null);
  const [confirmCreate, setConfirmCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createdAssociation, setCreatedAssociation] = useState<AssociationProfile | null>(null);
  const handledInitialModeRef = useRef(false);

  const listRoute = useMemo(() => getRouteByPath('/admin/associations'), []);
  const validation = useMemo(() => validateForm(form), [form]);
  const requiredFieldCount = 9;
  const completedRequiredCount = useMemo(() => countCompletedRequiredFields(form), [form]);
  const selectedFilesCount = Object.values(files).filter(Boolean).length;

  useEffect(() => {
    if (handledInitialModeRef.current || initialMode !== 'confirm') return;
    handledInitialModeRef.current = true;
    void Promise.resolve().then(() => {
      const nextValidation = validateForm(form);
      setErrors(nextValidation.errors);
      if (nextValidation.valid) setConfirmCreate(true);
    });
  }, [form, initialMode]);

  const updateForm = <K extends keyof CreateAssociationForm>(field: K, value: CreateAssociationForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setNotice(null);
    setCreatedAssociation(null);
  };

  const goToAssociations = () => {
    if (listRoute) {
      router.replace({ pathname: '/work/route-preview', params: { routeId: listRoute.id } } as never);
      return;
    }
    router.back();
  };

  const pickFile = async (field: FileField) => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: field === 'logo'
        ? 'image/*'
        : [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          ],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (picked.canceled || !picked.assets?.length) return;
    const asset = picked.assets[0];
    setFiles((current) => ({
      ...current,
      [field]: {
        uri: asset.uri,
        name: asset.name || defaultFileName(field),
        mimeType: asset.mimeType || defaultMimeType(field),
      },
    }));
    setNotice(null);
  };

  const clearFile = (field: FileField) => {
    setFiles((current) => ({ ...current, [field]: null }));
    setNotice(null);
  };

  const requestCreate = () => {
    const nextValidation = validateForm(form);
    setErrors(nextValidation.errors);
    if (!nextValidation.valid) {
      setNotice({
        title: 'Complete required fields',
        description: 'Fix the highlighted fields before creating the association.',
        tone: 'warning',
      });
      return;
    }
    setConfirmCreate(true);
  };

  const createAssociation = async () => {
    const nextValidation = validateForm(form);
    setErrors(nextValidation.errors);
    if (!nextValidation.valid) {
      setConfirmCreate(false);
      return;
    }

    setSaving(true);
    setNotice(null);
    setCreatedAssociation(null);
    try {
      const created = await createAssociationWithAdmin({
        ...form,
        businessLicense: files.businessLicense,
        certificateOfIncorporation: files.certificateOfIncorporation,
        logo: files.logo,
      });
      setCreatedAssociation(created);
      setConfirmCreate(false);
      setNotice({
        title: 'Association created',
        description: `${created.name || form.name} is ready for administrator login.`,
        tone: 'success',
      });
    } catch (createError) {
      setNotice({
        title: 'Creation failed',
        description: getApiErrorMessage(createError),
        tone: 'danger',
      });
    } finally {
      setSaving(false);
    }
  };

  if (activeView !== 'SYSTEM_ADMIN') {
    return (
      <AccessDeniedScreen
        title="Register association"
        description="Association registration is available from the system admin workspace only."
      />
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="System admin"
        title="Register association"
        subtitle="Create the tenant profile and first administrator"
        onBack={goToAssociations}
      />

      {notice ? <MobileToast title={notice.title} description={notice.description} tone={notice.tone} /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Required fields"
            value={`${formatNumber(completedRequiredCount)}/${formatNumber(requiredFieldCount)}`}
            description={validation.valid ? 'Ready for review' : 'Complete the form'}
            icon={CheckCircle2}
            tone={validation.valid ? 'green' : 'orange'}
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Association type"
            value={labelAssociationType(form.type)}
            description="Controls tenant defaults"
            icon={Building2}
            tone={form.type === 'VIKOBA' || form.type === 'SACCOS' ? 'green' : form.type === 'UNION' ? 'purple' : 'blue'}
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Initial admin"
            value={form.adminEmail.trim() ? 'Defined' : 'Missing'}
            description="Created as ADMIN"
            icon={ShieldCheck}
            tone={form.adminEmail.trim() ? 'blue' : 'slate'}
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Documents"
            value={formatNumber(selectedFilesCount)}
            description="Optional attachments"
            icon={FileCheck2}
            tone={selectedFilesCount ? 'teal' : 'slate'}
          />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard compact accent="blue" style={styles.guardrailCard}>
        <View style={styles.guardrailHeader}>
          <ShieldCheck color="#2563EB" size={20} />
          <View style={styles.flex}>
            <MobileText variant="body" weight="bold">
              Tenant creation
            </MobileText>
            <MobileText variant="small" tone="secondary">
              This creates a new association workspace, schema, and first administrator account.
            </MobileText>
          </View>
          <MobileStatusBadge status="Protected" tone="review" />
        </View>
      </MobileCard>

      <MobileFormSection title="Association identity" description="Capture the public tenant profile and registration date.">
        <MobileTextInput
          label="Association name"
          value={form.name}
          onChangeText={(name) => updateForm('name', name)}
          placeholder="Enter association name"
          icon={Building2}
          error={errors.name}
          disabled={saving}
        />
        <MobileSelect
          label="Association type"
          value={form.type}
          options={associationTypeOptions}
          onChange={(type) => updateForm('type', type as AssociationType)}
          disabled={saving}
          helperText="Use Vikoba for share-buying groups, SACCOS for separate savings and equity shares, or Union for umbrella associations."
        />
        <MobileTextInput
          label="Registration date"
          value={form.dateOfRegistration}
          onChangeText={(dateOfRegistration) => updateForm('dateOfRegistration', dateOfRegistration)}
          placeholder="YYYY-MM-DD"
          icon={Calendar}
          keyboardType="number-pad"
          error={errors.dateOfRegistration}
          helperText="Use ISO format, for example 2026-07-06."
          disabled={saving}
        />
        <MobileTextInput
          label="Registration number"
          value={form.registrationNumber}
          onChangeText={(registrationNumber) => updateForm('registrationNumber', registrationNumber)}
          placeholder="Optional registration number"
          icon={BadgeCheck}
          disabled={saving}
        />
      </MobileFormSection>

      <MobileFormSection title="Contact and legal details" description="These details appear on association records and official communications.">
        <MobileTextInput
          label="Address"
          value={form.address}
          onChangeText={(address) => updateForm('address', address)}
          placeholder="Enter complete address"
          icon={MapPin}
          error={errors.address}
          disabled={saving}
          multiline
          numberOfLines={3}
        />
        <MobileTextInput
          label="Official email"
          value={form.email}
          onChangeText={(email) => updateForm('email', email)}
          placeholder="association@example.com"
          icon={Mail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          error={errors.email}
          disabled={saving}
        />
        <MobileTextInput
          label="Telephone"
          value={form.telephoneNumber}
          onChangeText={(telephoneNumber) => updateForm('telephoneNumber', telephoneNumber)}
          placeholder="+255..."
          icon={Phone}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          error={errors.telephoneNumber}
          disabled={saving}
        />
        <View style={styles.inlineFields}>
          <View style={styles.inlineField}>
            <MobileTextInput
              label="TIN"
              value={form.tin}
              onChangeText={(tin) => updateForm('tin', tin)}
              placeholder="Optional"
              icon={FileBadge2}
              disabled={saving}
            />
          </View>
          <View style={styles.inlineField}>
            <MobileTextInput
              label="VRN"
              value={form.vrn}
              onChangeText={(vrn) => updateForm('vrn', vrn)}
              placeholder="Optional"
              icon={FileBadge2}
              disabled={saving}
            />
          </View>
        </View>
      </MobileFormSection>

      <MobileFormSection title="Initial administrator" description="This account receives association admin access after creation.">
        <MobileTextInput
          label="Admin full name"
          value={form.adminFullName}
          onChangeText={(adminFullName) => updateForm('adminFullName', adminFullName)}
          placeholder="Enter admin full name"
          icon={UserPlus}
          error={errors.adminFullName}
          disabled={saving}
        />
        <MobileTextInput
          label="Admin email"
          value={form.adminEmail}
          onChangeText={(adminEmail) => updateForm('adminEmail', adminEmail)}
          placeholder="admin@example.com"
          icon={Mail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          error={errors.adminEmail}
          disabled={saving}
        />
        <MobileTextInput
          label="Admin phone"
          value={form.adminPhoneNumber}
          onChangeText={(adminPhoneNumber) => updateForm('adminPhoneNumber', adminPhoneNumber)}
          placeholder="+255..."
          icon={Phone}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          error={errors.adminPhoneNumber}
          disabled={saving}
        />
        <MobileTextInput
          label="Temporary password"
          value={form.adminPassword}
          onChangeText={(adminPassword) => updateForm('adminPassword', adminPassword)}
          placeholder="Enter temporary password"
          icon={KeyRound}
          secureTextEntry
          textContentType="newPassword"
          error={errors.adminPassword}
          helperText="Use at least 8 characters. Ask the admin to change it after first login."
          disabled={saving}
        />
      </MobileFormSection>

      <MobileFormSection title="Official documents" description="Attach optional registration files now, or update them later from the profile.">
        <DocumentUploadRow
          field="businessLicense"
          file={files.businessLicense}
          title="Business license"
          description="PDF, DOC, or DOCX"
          icon={UploadCloud}
          disabled={saving}
          onPick={pickFile}
          onClear={clearFile}
        />
        <DocumentUploadRow
          field="certificateOfIncorporation"
          file={files.certificateOfIncorporation}
          title="Certificate of incorporation"
          description="PDF, DOC, or DOCX"
          icon={FileCheck2}
          disabled={saving}
          onPick={pickFile}
          onClear={clearFile}
        />
        <DocumentUploadRow
          field="logo"
          file={files.logo}
          title="Association logo"
          description="PNG, JPG, or GIF"
          icon={ImageIcon}
          disabled={saving}
          onPick={pickFile}
          onClear={clearFile}
        />
      </MobileFormSection>

      {createdAssociation ? (
        <MobileCard compact accent="green" style={styles.successCard}>
          <View style={styles.guardrailHeader}>
            <CheckCircle2 color="#15803D" size={20} />
            <View style={styles.flex}>
              <MobileText variant="body" weight="bold">
                Association registered
              </MobileText>
              <MobileText variant="small" tone="secondary">
                {createdAssociation.name || form.name}
              </MobileText>
            </View>
          </View>
          <MobileInfoRow
            label="Association ID"
            value={createdAssociation.id || 'Created'}
            helper={createdAssociation.schemaName || 'Schema was provisioned by the backend.'}
            icon={Building2}
          />
        </MobileCard>
      ) : null}

      <View style={styles.actions}>
        <MobileButton label="Cancel" icon={ArrowLeft} variant="secondary" fullWidth disabled={saving} onPress={goToAssociations} />
        <MobileButton
          label="Review and create"
          icon={Save}
          fullWidth
          loading={saving}
          disabled={saving}
          onPress={requestCreate}
        />
      </View>

      <MobileConfirmSheet
        visible={confirmCreate}
        title="Create association"
        description={`Create ${form.name || 'this association'} as a ${labelAssociationType(form.type)} tenant and create ${form.adminEmail || 'the initial admin'} as ADMIN.`}
        confirmLabel="Create association"
        loading={saving}
        onCancel={() => setConfirmCreate(false)}
        onConfirm={() => void createAssociation()}
      />
    </MobileScreen>
  );
}

function DocumentUploadRow({
  field,
  file,
  title,
  description,
  icon: Icon,
  disabled,
  onPick,
  onClear,
}: {
  field: FileField;
  file: AssociationProfileUploadFile | null;
  title: string;
  description: string;
  icon: typeof UploadCloud;
  disabled?: boolean;
  onPick: (field: FileField) => Promise<void>;
  onClear: (field: FileField) => void;
}) {
  if (!file) {
    return (
      <MobileFileUpload
        title={title}
        description={description}
        onPress={disabled ? undefined : () => void onPick(field)}
      />
    );
  }

  return (
    <MobileCard compact accent="teal" style={styles.fileCard}>
      <View style={styles.fileRow}>
        <Icon color="#0F766E" size={20} />
        <View style={styles.flex}>
          <MobileText variant="body" weight="bold" numberOfLines={1}>
            {file.name}
          </MobileText>
          <MobileText variant="small" tone="secondary">
            {title}
          </MobileText>
        </View>
        <MobileButton label="Remove" icon={X} size="sm" variant="secondary" disabled={disabled} onPress={() => onClear(field)} />
      </View>
    </MobileCard>
  );
}

function validateForm(form: CreateAssociationForm) {
  const errors: Partial<Record<keyof CreateAssociationForm, string>> = {};
  if (form.name.trim().length < 2) errors.name = 'Association name must be at least 2 characters.';
  if (!form.address.trim()) errors.address = 'Address is required.';
  else if (form.address.trim().length < 5) errors.address = 'Address must be at least 5 characters.';
  if (!form.email.trim()) errors.email = 'Official email is required.';
  else if (!isEmail(form.email)) errors.email = 'Enter a valid official email.';
  if (!form.telephoneNumber.trim()) errors.telephoneNumber = 'Telephone number is required.';
  else if (!isPhone(form.telephoneNumber)) errors.telephoneNumber = 'Use at least 10 digits. Country code is allowed.';
  if (!form.dateOfRegistration.trim()) errors.dateOfRegistration = 'Registration date is required.';
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dateOfRegistration.trim())) errors.dateOfRegistration = 'Use YYYY-MM-DD format.';
  if (form.adminFullName.trim().length < 2) errors.adminFullName = 'Admin name must be at least 2 characters.';
  if (!form.adminEmail.trim()) errors.adminEmail = 'Admin email is required.';
  else if (!isEmail(form.adminEmail)) errors.adminEmail = 'Enter a valid admin email.';
  if (!form.adminPhoneNumber.trim()) errors.adminPhoneNumber = 'Admin phone number is required.';
  else if (!isPhone(form.adminPhoneNumber)) errors.adminPhoneNumber = 'Use at least 10 digits. Country code is allowed.';
  if (!form.adminPassword) errors.adminPassword = 'Temporary password is required.';
  else if (form.adminPassword.length < 8) errors.adminPassword = 'Use at least 8 characters.';
  return { valid: Object.keys(errors).length === 0, errors };
}

function countCompletedRequiredFields(form: CreateAssociationForm) {
  return [
    form.name.trim().length >= 2,
    form.address.trim().length >= 5,
    isEmail(form.email),
    isPhone(form.telephoneNumber),
    /^\d{4}-\d{2}-\d{2}$/.test(form.dateOfRegistration.trim()),
    form.adminFullName.trim().length >= 2,
    isEmail(form.adminEmail),
    isPhone(form.adminPhoneNumber),
    form.adminPassword.length >= 8,
  ].filter(Boolean).length;
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isPhone(value: string) {
  return /^\+?[0-9\s-]{10,}$/.test(value.trim());
}

function labelAssociationType(type: AssociationType) {
  if (type === 'VIKOBA') return 'Vikoba';
  if (type === 'SACCOS') return 'SACCOS';
  if (type === 'UNION') return 'Union';
  return 'Generic';
}

function defaultFileName(field: FileField) {
  if (field === 'logo') return 'association-logo.png';
  if (field === 'certificateOfIncorporation') return 'certificate-of-incorporation.pdf';
  return 'business-license.pdf';
}

function defaultMimeType(field: FileField) {
  if (field === 'logo') return 'image/png';
  return 'application/pdf';
}

const styles = StyleSheet.create({
  guardrailCard: {
    gap: 12,
  },
  guardrailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  inlineFields: {
    flexDirection: 'row',
    gap: 10,
  },
  inlineField: {
    flex: 1,
    minWidth: 0,
  },
  fileCard: {
    gap: 10,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  successCard: {
    gap: 8,
  },
  actions: {
    gap: 10,
  },
});
