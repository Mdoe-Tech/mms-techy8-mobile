import { router } from 'expo-router';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserRound,
  XCircle,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileConfirmSheet,
  MobileFormSection,
  MobileIconButton,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobileProgressBar,
  MobileScreen,
  MobileStatusBadge,
  MobileSummaryPanel,
  MobileText,
  MobileTextInput,
  MobileToast,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import { resetUserPasswordAsAdmin } from '@/services/system-admin-password-reset-service';
import { type KpiTone, useNaneTheme } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';

type AdminPasswordResetMode = 'confirm' | 'success';

type MobileSystemAdminPasswordResetScreenProps = {
  initialMode?: AdminPasswordResetMode;
};

type PasswordResetForm = {
  email: string;
  password: string;
  confirmPassword: string;
};

type PasswordResetErrors = Partial<Record<keyof PasswordResetForm | 'submit', string>>;

const initialForm: PasswordResetForm = {
  email: '',
  password: '',
  confirmPassword: '',
};

const previewEmail = 'user@example.com';
const previewPassword = 'Nane#Reset2026';

const passwordRules = [
  { id: 'length', label: 'At least 8 characters', test: (value: string) => value.length >= 8 },
  { id: 'upper', label: 'Uppercase letter', test: (value: string) => /[A-Z]/.test(value) },
  { id: 'lower', label: 'Lowercase letter', test: (value: string) => /[a-z]/.test(value) },
  { id: 'number', label: 'Number', test: (value: string) => /\d/.test(value) },
  { id: 'symbol', label: 'Symbol', test: (value: string) => /[^A-Za-z0-9]/.test(value) },
];

export default function MobileSystemAdminPasswordResetScreen({
  initialMode,
}: MobileSystemAdminPasswordResetScreenProps = {}) {
  const theme = useNaneTheme();
  const { activeView, user } = useAuth();
  const [form, setForm] = useState<PasswordResetForm>(
    initialMode ? { email: previewEmail, password: previewPassword, confirmPassword: previewPassword } : initialForm,
  );
  const [errors, setErrors] = useState<PasswordResetErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(initialMode === 'confirm');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ title: string; description?: string; tone?: 'success' | 'danger' | 'warning' | 'info' } | null>(null);
  const [completedReset, setCompletedReset] = useState<{ email: string; password: string; preview?: boolean } | null>(
    initialMode === 'success' ? { email: previewEmail, password: previewPassword, preview: true } : null,
  );

  const ruleState = useMemo(() => passwordRules.map((rule) => ({ ...rule, met: rule.test(form.password) })), [form.password]);
  const strength = useMemo(() => Math.round((ruleState.filter((rule) => rule.met).length / passwordRules.length) * 100), [ruleState]);
  const strengthTone: KpiTone = strength >= 80 ? 'green' : strength >= 60 ? 'orange' : 'red';
  const validEmail = isValidEmail(form.email);
  const passwordMatches = form.password.length > 0 && form.password === form.confirmPassword;
  const ready = validEmail && strength >= 80 && passwordMatches;

  if (activeView !== 'SYSTEM_ADMIN') {
    return (
      <AccessDeniedScreen
        title="Password reset"
        description="Direct account password resets are available only to system administrators."
      />
    );
  }

  const setField = <Key extends keyof PasswordResetForm>(field: Key, value: PasswordResetForm[Key]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field] && !current.submit) return current;
      const next = { ...current };
      delete next[field];
      delete next.submit;
      return next;
    });
    setToast(null);
  };

  const generatePassword = () => {
    const password = generateSecurePassword(16);
    setForm((current) => ({ ...current, password, confirmPassword: password }));
    setErrors((current) => {
      const next = { ...current };
      delete next.password;
      delete next.confirmPassword;
      delete next.submit;
      return next;
    });
    setCompletedReset(null);
    setToast({ title: 'Password generated', description: 'Review the target email, confirm the reset, then share the password securely.', tone: 'info' });
  };

  const resetForm = () => {
    setForm(initialForm);
    setErrors({});
    setCompletedReset(null);
    setConfirmVisible(false);
    setToast(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const requestConfirmation = () => {
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    setToast(null);
    if (Object.keys(nextErrors).length) return;
    setConfirmVisible(true);
  };

  const submitReset = async () => {
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setConfirmVisible(false);
      return;
    }

    setSaving(true);
    setToast(null);
    try {
      await resetUserPasswordAsAdmin({
        email: form.email.trim(),
        newPassword: form.password,
      });
      setCompletedReset({ email: form.email.trim(), password: form.password });
      setErrors({});
      setConfirmVisible(false);
      setToast({ title: 'Password reset', description: 'The user must change this password on first login.', tone: 'success' });
      setForm(initialForm);
      setShowPassword(false);
      setShowConfirmPassword(false);
    } catch (error) {
      const message = getApiErrorMessage(error);
      setErrors({ submit: message });
      setConfirmVisible(false);
      setToast({ title: 'Password reset failed', description: message, tone: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  const sharePassword = async () => {
    if (!completedReset) return;
    await Share.share({
      title: 'Temporary Nane password',
      message: `Temporary password for ${completedReset.email}: ${completedReset.password}`,
    });
    setToast({ title: 'Password ready to share', description: 'Use an approved secure channel for this credential.', tone: 'warning' });
  };

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Platform security"
        title="Password reset"
        subtitle={user?.fullName ? `${user.fullName} · direct credential reset` : 'Direct credential reset'}
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Clear form" variant="secondary" onPress={resetForm} />}
      />

      {toast ? <MobileToast title={toast.title} description={toast.description} tone={toast.tone} /> : null}
      {errors.submit ? <MobileToast title="Password reset failed" description={errors.submit} tone="danger" /> : null}

      {completedReset ? (
        <MobileCard accent={completedReset.preview ? 'blue' : 'green'}>
          <View style={styles.successHeader}>
            <View style={[styles.successIcon, { backgroundColor: completedReset.preview ? theme.colors.kpi.blue : theme.colors.status.success }]}>
              <CheckCircle2 color={theme.colors.onPrimary} size={22} strokeWidth={2.5} />
            </View>
            <View style={styles.successText}>
              <MobileText variant="section" weight="bold">
                {completedReset.preview ? 'Success preview' : 'Password reset successful'}
              </MobileText>
              <MobileText variant="small" tone="secondary">
                {completedReset.preview
                  ? 'This state is shown only for simulator review.'
                  : 'Share the temporary password through an approved secure channel.'}
              </MobileText>
            </View>
          </View>
          <MobileInfoRow icon={Mail} label="User email" value={completedReset.email} />
          <MobileInfoRow icon={KeyRound} label="Temporary password" value={completedReset.password} helper="Ask the user to change it immediately after login." />
          <View style={styles.actionRow}>
            <MobileButton label="Share password" icon={Sparkles} variant="secondary" onPress={sharePassword} style={styles.actionButton} />
            <MobileButton label="Reset another" icon={RefreshCw} onPress={resetForm} style={styles.actionButton} />
          </View>
        </MobileCard>
      ) : null}

      <MobileSummaryPanel
        title="Security control"
        value="Admin reset"
        description="Resets any user found in active tenant schemas and flags first login."
        tone="red"
        icon={ShieldAlert}
        footer={<MobileProgressBar value={strength} tone={strengthTone} label="New password strength" />}
      />

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Authorization" value="System admin" description="Manage users permission" tone="blue" icon={ShieldCheck} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Password" value={`${strength}%`} description="Strength score" tone={strengthTone} icon={KeyRound} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="First login" value="Required" description="Backend flags first login" tone="orange" icon={LockKeyhole} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileFormSection
        title="Reset user password"
        description="Enter the target account email and a temporary password. The backend searches active tenant schemas and emails the user a security notice."
      >
        <MobileTextInput
          label="User email"
          value={form.email}
          onChangeText={(value) => setField('email', value)}
          placeholder="user@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          icon={UserRound}
          error={errors.email}
          helperText="Use the exact login email for the account that needs help."
        />

        <MobileTextInput
          label="Temporary password"
          value={form.password}
          onChangeText={(value) => setField('password', value)}
          placeholder="Generate or enter a strong password"
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          secureTextEntry={!showPassword}
          icon={KeyRound}
          error={errors.password}
          helperText="Use a unique password that the user must replace on first login."
          rightAction={
            <MobileIconButton
              icon={showPassword ? EyeOff : Eye}
              label={showPassword ? 'Hide password' : 'Show password'}
              variant="ghost"
              onPress={() => setShowPassword((current) => !current)}
              style={styles.eyeButton}
            />
          }
        />

        <MobileTextInput
          label="Confirm password"
          value={form.confirmPassword}
          onChangeText={(value) => setField('confirmPassword', value)}
          placeholder="Confirm temporary password"
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          secureTextEntry={!showConfirmPassword}
          icon={LockKeyhole}
          error={errors.confirmPassword}
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
            label="Review reset"
            icon={ShieldCheck}
            disabled={!ready || saving}
            loading={saving}
            onPress={requestConfirmation}
            style={styles.actionButton}
          />
        </View>
      </MobileFormSection>

      <MobileCard>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitle}>
            <MobileText variant="section" weight="bold">
              Reset checklist
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Strong passwords reduce support risk and accidental lockouts.
            </MobileText>
          </View>
          <MobileStatusBadge status={ready ? 'Ready' : 'Draft'} tone={ready ? 'success' : 'neutral'} />
        </View>
        <ChecklistRow met={validEmail} label="Valid target email" />
        {ruleState.map((rule) => (
          <ChecklistRow key={rule.id} met={rule.met} label={rule.label} />
        ))}
        <ChecklistRow met={passwordMatches} label="Password confirmation matches" />
      </MobileCard>

      <MobileCard accent="orange">
        <MobileText variant="section" weight="bold">
          Operational notes
        </MobileText>
        <MobileInfoRow icon={AlertTriangle} label="User impact" value="Immediate credential rotation" helper="The user will be required to use the temporary password." />
        <MobileInfoRow icon={Mail} label="Notification" value="Security email" helper="Backend sends the user an admin reset notification." />
        <MobileInfoRow icon={ShieldCheck} label="Audit" value="Logged platform action" helper="Use the platform audit trail to review reset activity." />
      </MobileCard>

      <MobileConfirmSheet
        visible={confirmVisible}
        title="Reset this password?"
        description={`This will immediately reset the password for ${form.email || 'the selected user'} and force first-login password rotation. Confirm only after verifying the request.`}
        confirmLabel="Reset password"
        destructive
        loading={saving}
        confirmDisabled={!ready}
        onCancel={() => {
          if (!saving) setConfirmVisible(false);
        }}
        onConfirm={submitReset}
      />
    </MobileScreen>
  );
}

function ChecklistRow({ met, label }: { met: boolean; label: string }) {
  return (
    <View style={styles.checkRow}>
      {met ? <CheckCircle2 size={18} color="#16A34A" /> : <XCircle size={18} color="#EF4444" />}
      <MobileText variant="small" tone={met ? 'primary' : 'secondary'} weight={met ? 'bold' : 'medium'}>
        {label}
      </MobileText>
    </View>
  );
}

function validateForm(form: PasswordResetForm) {
  const errors: PasswordResetErrors = {};
  const email = form.email.trim();

  if (!email) errors.email = 'Email is required.';
  else if (!isValidEmail(email)) errors.email = 'Enter a valid email address.';

  if (!form.password) {
    errors.password = 'Temporary password is required.';
  } else if (form.password.length < 8) {
    errors.password = 'Password must be at least 8 characters.';
  } else if (passwordRules.filter((rule) => rule.test(form.password)).length < 4) {
    errors.password = 'Use a stronger password with mixed character types.';
  }

  if (!form.confirmPassword) {
    errors.confirmPassword = 'Confirm the temporary password.';
  } else if (form.password !== form.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
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
  successHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  successIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
  },
  eyeButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
