import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import {
  Building2,
  FileBadge2,
  FileText,
  Image as ImageIcon,
  Mail,
  Phone,
  RefreshCw,
  Save,
  UploadCloud,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileErrorState,
  MobileFormSection,
  MobileIconButton,
  MobileInfoRow,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileText,
  MobileTextInput,
  MobileToast,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  getAssociationProfile,
  updateAssociationProfile,
  type AssociationProfile,
  type AssociationProfileUploadFile,
} from '@/services/association-service';
import { getApiErrorMessage } from '@/types/api';

type ProfileForm = {
  name: string;
  address: string;
  email: string;
  telephoneNumber: string;
  tin: string;
  vrn: string;
};

type FileField = 'businessLicense' | 'certificateOfIncorporation' | 'logo';

type FileState = Record<FileField, AssociationProfileUploadFile | null>;

const emptyForm: ProfileForm = {
  name: '',
  address: '',
  email: '',
  telephoneNumber: '',
  tin: '',
  vrn: '',
};

const emptyFiles: FileState = {
  businessLicense: null,
  certificateOfIncorporation: null,
  logo: null,
};

export default function MobileAssociationProfileEditScreen() {
  const { activeView, associationId, user } = useAuth();
  const [profile, setProfile] = useState<AssociationProfile | null>(null);
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [files, setFiles] = useState<FileState>(emptyFiles);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Partial<Record<keyof ProfileForm, string>>>({});

  const profileRoute = useMemo(() => getRouteByPath('/associations/profile'), []);

  const goToProfile = useCallback(() => {
    if (profileRoute) {
      router.replace({ pathname: '/work/route-preview', params: { routeId: profileRoute.id } } as never);
    } else {
      router.back();
    }
  }, [profileRoute]);

  const loadProfile = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before editing the profile.');
        return;
      }

      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      setNotice(null);

      try {
        const loaded = await getAssociationProfile(associationId);
        setProfile(loaded);
        setForm(formFromProfile(loaded));
        setFiles(emptyFiles);
        setValidationErrors({});
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
    void Promise.resolve().then(() => loadProfile());
  }, [loadProfile]);

  const updateField = <K extends keyof ProfileForm>(field: K, value: ProfileForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setValidationErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setNotice(null);
  };

  const pickFile = async (field: FileField) => {
    const result = await DocumentPicker.getDocumentAsync({
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

    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    setFiles((current) => ({
      ...current,
      [field]: {
        uri: asset.uri,
        name: asset.name || defaultFileName(field),
        mimeType: asset.mimeType || defaultMimeType(field),
      },
    }));
    setNotice(`${fileFieldLabel(field)} selected.`);
  };

  const clearFile = (field: FileField) => {
    setFiles((current) => ({ ...current, [field]: null }));
    setNotice(null);
  };

  const saveProfile = async () => {
    if (!associationId || saving) return;

    const nextErrors = validateForm(form);
    setValidationErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError('Please correct the highlighted fields before saving.');
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateAssociationProfile({
        ...form,
        businessLicense: files.businessLicense,
        certificateOfIncorporation: files.certificateOfIncorporation,
        logo: files.logo,
      });
      setProfile(updated);
      setForm(formFromProfile(updated));
      setFiles(emptyFiles);
      setNotice('Association profile updated successfully.');
      goToProfile();
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Association profile" description="Profile editing is available for association admin workspaces only." />;
  }

  if (loading && !profile) {
    return <MobilePageLoadingState kind="form" message="Loading association profile form" />;
  }

  if (!associationId) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Settings" title="Edit profile" subtitle="Association context unavailable" onBack={() => router.back()} />
        <MobileErrorState title="Association not selected" description="Sign in through an association account before editing the profile." />
      </MobileScreen>
    );
  }

  if (error && !profile) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Settings"
          title="Edit profile"
          subtitle={user?.associationName || 'Profile information'}
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry" variant="secondary" disabled={refreshing} onPress={() => void loadProfile('refresh')} />}
        />
        <MobileErrorState title="Profile form could not load" description={error} retryLabel="Retry" onRetry={() => void loadProfile('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Settings"
        title="Edit profile"
        subtitle={profile?.name || 'Association information and documents'}
        onBack={goToProfile}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh profile" variant="secondary" disabled={refreshing || saving} onPress={() => void loadProfile('refresh')} />}
      />

      {notice ? <MobileToast title="Profile" description={notice} tone="success" /> : null}
      {error && profile ? <MobileToast title="Profile issue" description={error} tone="danger" /> : null}

      <MobileCard compact accent="blue">
        <MobileText variant="section" weight="bold">
          {form.name || 'Association profile'}
        </MobileText>
        <MobileText variant="small" tone="secondary">
          Changes update the association record used across admin, member, billing, and public surfaces.
        </MobileText>
      </MobileCard>

      <MobileFormSection title="Association details" description="Keep public contact and identity information current.">
        <MobileTextInput
          label="Association name"
          value={form.name}
          onChangeText={(value) => updateField('name', value)}
          placeholder="Enter association name"
          icon={Building2}
          error={validationErrors.name}
        />
        <MobileTextInput
          label="Address"
          value={form.address}
          onChangeText={(value) => updateField('address', value)}
          placeholder="Enter address"
          icon={Building2}
        />
        <MobileTextInput
          label="Email"
          value={form.email}
          onChangeText={(value) => updateField('email', value)}
          placeholder="Enter email"
          icon={Mail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          error={validationErrors.email}
        />
        <MobileTextInput
          label="Telephone"
          value={form.telephoneNumber}
          onChangeText={(value) => updateField('telephoneNumber', value)}
          placeholder="Enter telephone number"
          icon={Phone}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
        />
      </MobileFormSection>

      <MobileFormSection title="Legal and tax details" description="Blank TIN or VRN fields are saved as empty values.">
        <MobileTextInput
          label="TIN number"
          value={form.tin}
          onChangeText={(value) => updateField('tin', value)}
          placeholder="Enter TIN number"
          icon={FileBadge2}
          autoCapitalize="characters"
        />
        <MobileTextInput
          label="VRN number"
          value={form.vrn}
          onChangeText={(value) => updateField('vrn', value)}
          placeholder="Enter VRN number"
          icon={FileBadge2}
          autoCapitalize="characters"
        />
      </MobileFormSection>

      <MobileFormSection title="Profile files" description="Choose a new file only when you want to replace the existing document.">
        <ProfileFileRow
          title="Business license"
          existingPath={profile?.businessLicensePath}
          selectedFile={files.businessLicense}
          icon={FileText}
          onPick={() => void pickFile('businessLicense')}
          onClear={() => clearFile('businessLicense')}
        />
        <ProfileFileRow
          title="Certificate of incorporation"
          existingPath={profile?.certificateOfIncorporationPath}
          selectedFile={files.certificateOfIncorporation}
          icon={FileBadge2}
          onPick={() => void pickFile('certificateOfIncorporation')}
          onClear={() => clearFile('certificateOfIncorporation')}
        />
        <ProfileFileRow
          title="Association logo"
          existingPath={profile?.logoPath}
          selectedFile={files.logo}
          icon={ImageIcon}
          onPick={() => void pickFile('logo')}
          onClear={() => clearFile('logo')}
        />
      </MobileFormSection>

      <View style={styles.actions}>
        <MobileButton label="Cancel" icon={X} variant="secondary" disabled={saving} onPress={goToProfile} style={styles.actionButton} />
        <MobileButton label={saving ? 'Updating...' : 'Update profile'} icon={Save} loading={saving} disabled={saving} onPress={saveProfile} style={styles.actionButton} />
      </View>
    </MobileScreen>
  );
}

type ProfileFileRowProps = {
  title: string;
  existingPath?: string | null;
  selectedFile: AssociationProfileUploadFile | null;
  icon: typeof FileText;
  onPick: () => void;
  onClear: () => void;
};

function ProfileFileRow({ title, existingPath, selectedFile, icon: Icon, onPick, onClear }: ProfileFileRowProps) {
  const fileName = selectedFile?.name || existingPath?.split('/').pop() || 'No file uploaded';
  const status = selectedFile ? 'Draft' : existingPath ? 'Completed' : 'Pending';

  return (
    <MobileCard compact>
      <MobileInfoRow
        label={title}
        value={fileName}
        helper={selectedFile ? 'Selected for upload when you save.' : existingPath ? 'Current uploaded file.' : 'Choose a file to upload.'}
        icon={Icon}
        status={status}
      />
      <View style={styles.fileActions}>
        <MobileButton label={selectedFile || existingPath ? 'Replace file' : 'Choose file'} icon={UploadCloud} variant="secondary" size="sm" onPress={onPick} />
        {selectedFile ? <MobileButton label="Clear" icon={X} variant="ghost" size="sm" onPress={onClear} /> : null}
      </View>
    </MobileCard>
  );
}

function formFromProfile(profile: AssociationProfile): ProfileForm {
  return {
    name: profile.name || '',
    address: profile.address || '',
    email: profile.email || '',
    telephoneNumber: profile.telephone || '',
    tin: profile.tin || '',
    vrn: profile.vrn || '',
  };
}

function validateForm(form: ProfileForm) {
  const errors: Partial<Record<keyof ProfileForm, string>> = {};
  if (!form.name.trim()) errors.name = 'Association name is required.';
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }
  return errors;
}

function fileFieldLabel(field: FileField) {
  if (field === 'businessLicense') return 'Business license';
  if (field === 'certificateOfIncorporation') return 'Certificate of incorporation';
  return 'Association logo';
}

function defaultFileName(field: FileField) {
  if (field === 'logo') return 'association-logo';
  return `${field}.pdf`;
}

function defaultMimeType(field: FileField) {
  if (field === 'logo') return 'image/png';
  return 'application/pdf';
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
  },
  fileActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
