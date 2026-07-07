import { router } from 'expo-router';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  RefreshCw,
  ScanFace,
  ShieldCheck,
  Sparkles,
  UserRound,
  XCircle,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileCheckboxRow,
  MobileIconButton,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobileProgressBar,
  MobileScreen,
  MobileStatusBadge,
  MobileText,
  MobileTextInput,
  MobileToast,
} from '@/components/mobile';
import { changePassword } from '@/services/auth-service';
import { useNaneTheme } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';

type PasswordFormState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type PasswordFormErrors = Partial<Record<keyof PasswordFormState | 'submit', string>>;

const initialForm: PasswordFormState = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

const passwordRules = [
  { id: 'length', label: 'At least 8 characters', test: (value: string) => value.length >= 8 },
  { id: 'upper', label: 'Uppercase letter', test: (value: string) => /[A-Z]/.test(value) },
  { id: 'lower', label: 'Lowercase letter', test: (value: string) => /[a-z]/.test(value) },
  { id: 'number', label: 'Number', test: (value: string) => /\d/.test(value) },
  { id: 'symbol', label: 'Symbol', test: (value: string) => /[^A-Za-z0-9]/.test(value) },
];

export default function MobileMemberSecurityScreen() {
  const theme = useNaneTheme();
  const {
    activeView,
    user,
    biometricUnlockEnabled,
    biometricLabel,
    biometricLoading,
    biometricError,
    enableBiometricUnlock,
    disableBiometricUnlock,
    refreshBiometricState,
  } = useAuth();
  const [form, setForm] = useState<PasswordFormState>(initialForm);
  const [errors, setErrors] = useState<PasswordFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [toast, setToast] = useState<{ title: string; description?: string; tone?: 'success' | 'danger' | 'warning' | 'info' } | null>(null);

  const ruleState = useMemo(() => passwordRules.map((rule) => ({ ...rule, met: rule.test(form.newPassword) })), [form.newPassword]);
  const strength = useMemo(() => Math.round((ruleState.filter((rule) => rule.met).length / passwordRules.length) * 100), [ruleState]);
  const strengthTone = strength >= 80 ? 'green' : strength >= 60 ? 'orange' : 'red';
  const passwordReady = strength >= 80 && form.newPassword === form.confirmPassword && form.currentPassword.length > 0;

  useEffect(() => {
    void Promise.resolve().then(refreshBiometricState);
  }, [refreshBiometricState]);

  if (activeView !== 'MEMBER') {
    return (
      <AccessDeniedScreen
        title="Security"
        description="This native security page is available from the member portal workspace."
      />
    );
  }

  const setField = <Key extends keyof PasswordFormState>(field: Key, value: PasswordFormState[Key]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setToast(null);
  };

  const generatePassword = () => {
    const password = generateSecurePassword(14);
    setForm((current) => ({ ...current, newPassword: password, confirmPassword: password }));
    setErrors((current) => {
      const next = { ...current };
      delete next.newPassword;
      delete next.confirmPassword;
      return next;
    });
    setToast({ title: 'Password generated', description: 'Review it, save it securely, then enter your current password.', tone: 'info' });
  };

  const submit = async () => {
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    setToast(null);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      await changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setForm(initialForm);
      setErrors({});
      setToast({ title: 'Password changed', description: 'Your account password was updated successfully.', tone: 'success' });
    } catch (error) {
      const message = getApiErrorMessage(error);
      setErrors({ submit: message });
      setToast({ title: 'Password not changed', description: message, tone: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  const toggleBiometricUnlock = async (checked: boolean) => {
    setToast(null);
    if (checked) {
      const enabled = await enableBiometricUnlock();
      setToast(
        enabled
          ? {
              title: 'Biometric login enabled',
              description: `${biometricLabel} can now unlock your saved Nane session on this device.`,
              tone: 'success',
            }
          : {
              title: 'Biometric login not enabled',
              description: biometricError || `Nane could not enable ${biometricLabel} on this device.`,
              tone: 'warning',
            },
      );
      return;
    }

    await disableBiometricUnlock();
    setToast({
      title: 'Biometric login turned off',
      description: 'Use your password the next time this device needs to open Nane.',
      tone: 'info',
    });
  };

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Member portal"
        title="Security"
        subtitle="Manage your account password"
        onBack={() => router.back()}
        rightAction={<MobileStatusBadge status="Protected" tone="success" />}
      />

      {toast ? <MobileToast title={toast.title} description={toast.description} tone={toast.tone} /> : null}
      {errors.submit ? <MobileToast title="Security update failed" description={errors.submit} tone="danger" /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Account" value="Protected" description="Password required" tone="green" icon={ShieldCheck} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Strength" value={`${strength}%`} description="New password score" tone={strengthTone} icon={KeyRound} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard accent="blue">
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitle}>
            <MobileText variant="section" weight="bold">
              Biometric login
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Use secure unlock on this phone before opening your saved Nane workspace.
            </MobileText>
          </View>
          <ScanFace size={19} color={theme.colors.textSecondary} />
        </View>

        <MobileCheckboxRow
          label={`Use ${biometricLabel}`}
          description={
            biometricUnlockEnabled
              ? 'Nane will ask for biometric confirmation before restoring your saved session.'
              : 'Turn this on after confirming it is you on this device.'
          }
          checked={biometricUnlockEnabled}
          disabled={biometricLoading}
          onChange={(checked) => void toggleBiometricUnlock(checked)}
          error={biometricError || undefined}
        />

        <MobileInfoRow
          icon={ShieldCheck}
          label="Password fallback"
          value="Always available"
          helper="If biometrics fail or your saved session expires, Nane will ask for your password."
        />
      </MobileCard>

      <MobileCard accent="blue">
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitle}>
            <MobileText variant="section" weight="bold">
              Change password
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Use a password you do not use on other services.
            </MobileText>
          </View>
          <Lock size={19} color={theme.colors.textSecondary} />
        </View>

        <MobileTextInput
          label="Current password"
          value={form.currentPassword}
          onChangeText={(value) => setField('currentPassword', value)}
          placeholder="Enter current password"
          error={errors.currentPassword}
          icon={Lock}
          secureTextEntry={!showCurrentPassword}
          textContentType="password"
          rightAction={
            <MobileIconButton
              icon={showCurrentPassword ? EyeOff : Eye}
              label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
              variant="ghost"
              onPress={() => setShowCurrentPassword((current) => !current)}
              style={styles.eyeButton}
            />
          }
        />

        <MobileTextInput
          label="New password"
          value={form.newPassword}
          onChangeText={(value) => setField('newPassword', value)}
          placeholder="Enter a strong password"
          error={errors.newPassword}
          icon={KeyRound}
          secureTextEntry={!showNewPassword}
          textContentType="newPassword"
          helperText="Use the generated password button for a stronger option."
          rightAction={
            <MobileIconButton
              icon={showNewPassword ? EyeOff : Eye}
              label={showNewPassword ? 'Hide new password' : 'Show new password'}
              variant="ghost"
              onPress={() => setShowNewPassword((current) => !current)}
              style={styles.eyeButton}
            />
          }
        />

        <MobileTextInput
          label="Confirm password"
          value={form.confirmPassword}
          onChangeText={(value) => setField('confirmPassword', value)}
          placeholder="Confirm new password"
          error={errors.confirmPassword}
          icon={Lock}
          secureTextEntry={!showConfirmPassword}
          textContentType="newPassword"
          rightAction={
            <MobileIconButton
              icon={showConfirmPassword ? EyeOff : Eye}
              label={showConfirmPassword ? 'Hide confirmed password' : 'Show confirmed password'}
              variant="ghost"
              onPress={() => setShowConfirmPassword((current) => !current)}
              style={styles.eyeButton}
            />
          }
        />

        <MobileProgressBar value={strength} label="Password strength" tone={strengthTone} />

        <View style={styles.actionRow}>
          <MobileButton label="Generate" icon={Sparkles} variant="secondary" onPress={generatePassword} style={styles.actionButton} />
          <MobileButton
            label="Change password"
            icon={ShieldCheck}
            loading={saving}
            disabled={saving || !passwordReady}
            onPress={submit}
            style={styles.actionButton}
          />
        </View>
      </MobileCard>

      <MobileCard>
        <MobileText variant="section" weight="bold">
          Password checklist
        </MobileText>
        {ruleState.map((rule) => (
          <View key={rule.id} style={styles.ruleRow}>
            {rule.met ? <CheckCircle2 size={18} color="#16A34A" /> : <XCircle size={18} color="#EF4444" />}
            <MobileText variant="small" tone={rule.met ? 'primary' : 'secondary'} weight={rule.met ? 'bold' : 'medium'}>
              {rule.label}
            </MobileText>
          </View>
        ))}
      </MobileCard>

      <MobileCard>
        <MobileText variant="section" weight="bold">
          Account context
        </MobileText>
        <MobileInfoRow icon={UserRound} label="Account name" value={user?.fullName || 'Member'} />
        <MobileInfoRow icon={Mail} label="Email" value={user?.email || 'Not provided'} />
        <MobileInfoRow icon={RefreshCw} label="First login" value={user?.firstLogin ? 'Password change required' : 'Completed'} />
      </MobileCard>

      <View style={styles.footerActions}>
        <MobileButton label="Back to profile" icon={ArrowLeft} variant="secondary" onPress={() => router.back()} fullWidth />
      </View>
    </MobileScreen>
  );
}

function validateForm(form: PasswordFormState) {
  const errors: PasswordFormErrors = {};

  if (!form.currentPassword) errors.currentPassword = 'Current password is required.';
  if (!form.newPassword) {
    errors.newPassword = 'New password is required.';
  } else if (form.newPassword.length < 8) {
    errors.newPassword = 'Password must be at least 8 characters.';
  } else if (passwordRules.filter((rule) => rule.test(form.newPassword)).length < 4) {
    errors.newPassword = 'Use a stronger password with mixed character types.';
  }
  if (!form.confirmPassword) {
    errors.confirmPassword = 'Confirm the new password.';
  } else if (form.newPassword !== form.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }
  if (form.currentPassword && form.currentPassword === form.newPassword) {
    errors.newPassword = 'New password must be different from the current password.';
  }

  return errors;
}

function generateSecurePassword(length: number) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  const bytes = new Uint32Array(length);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 4294967295);
    }
  }
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  sectionTitle: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  eyeButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  footerActions: {
    marginBottom: 8,
  },
});
