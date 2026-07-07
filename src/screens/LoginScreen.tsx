import { Image, type ImageSource } from 'expo-image';
import { useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LifeBuoy,
  LockKeyhole,
  Mail,
  ScanFace,
  ShieldCheck,
  Users,
  WalletCards,
  type LucideIcon,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, View, type TextInput as RNTextInput } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileAlertBanner,
  MobileButton,
  MobileCard,
  MobileScreen,
  MobileSelect,
  MobileSheet,
  MobileStatusBadge,
  MobileText,
  MobileTextInput,
  MobileWorkspaceLogo,
} from '@/components/mobile';
import { mobileEnv } from '@/config/env';
import { useNaneTheme } from '@/theme/tokens';
import type { AuthAssociationOption } from '@/types/auth';

export default function LoginScreen() {
  const theme = useNaneTheme();
  const passwordInputRef = useRef<RNTextInput>(null);
  const {
    error,
    loading,
    pendingAssociationLogin,
    pendingModeSelection,
    sessionExpired,
    biometricUnlockAvailable,
    biometricLabel,
    biometricAccountLabel,
    biometricLoading,
    biometricError,
    signIn,
    selectAssociation,
    selectLoginMode,
    unlockWithBiometrics,
    clearError,
    clearPendingAssociationLogin,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [associationId, setAssociationId] = useState('');
  const [validation, setValidation] = useState<{ email?: string; password?: string }>({});
  const [helpTopic, setHelpTopic] = useState<'forgot' | 'help' | null>(null);

  const associationOptions = useMemo(
    () =>
      pendingAssociationLogin?.associations.map((association) => ({
        label: association.associationName,
        value: association.associationId,
      })) || [],
    [pendingAssociationLogin],
  );

  const selectedAssociationId = associationOptions.some((option) => option.value === associationId)
    ? associationId
    : associationOptions[0]?.value || '';
  const selectedAssociation = useMemo(
    () =>
      pendingAssociationLogin?.associations.find((association) => association.associationId === selectedAssociationId) ||
      pendingAssociationLogin?.associations[0] ||
      null,
    [pendingAssociationLogin, selectedAssociationId],
  );
  const selectedAssociationLogo = useMemo(() => buildLoginAssociationLogoSource(selectedAssociation), [selectedAssociation]);
  const accountLabel = pendingAssociationLogin?.fullName || pendingAssociationLogin?.email;
  const displayError = friendlyLoginError(error, pendingAssociationLogin ? 'association' : 'login');

  function handleEmailChange(value: string) {
    setEmail(value);
    if (validation.email) {
      setValidation((current) => ({ ...current, email: undefined }));
    }
    if (error && !sessionExpired) {
      clearError();
    }
  }

  function handlePasswordChange(value: string) {
    setPassword(value);
    if (validation.password) {
      setValidation((current) => ({ ...current, password: undefined }));
    }
    if (error && !sessionExpired) {
      clearError();
    }
  }

  async function handleSignIn() {
    const nextValidation = {
      email: email.trim() ? undefined : 'Enter your email address.',
      password: password ? undefined : 'Enter your password.',
    };

    setValidation(nextValidation);
    if (nextValidation.email || nextValidation.password) return;

    await signIn({ email: email.trim(), password });
  }

  async function handleAssociationContinue() {
    if (!selectedAssociationId) return;
    await selectAssociation(selectedAssociationId);
  }

  async function handleLoginMode(mode: 'ADMIN' | 'MEMBER') {
    await selectLoginMode(mode);
  }

  return (
    <MobileScreenContent>
      <View style={styles.brandBlock}>
        <LoginBrandMark />
        <View style={styles.brandCopy}>
          <MobileText variant="title" weight="bold" style={styles.centerText}>
            Log in to Nane
          </MobileText>
          <MobileText variant="body" tone="secondary" style={styles.centerText}>
            Open your association, member portal, payments, loans, events, and reports from your phone.
          </MobileText>
        </View>
      </View>

      <View style={styles.promiseRow}>
        <PromisePill icon={Users} label="Members" />
        <PromisePill icon={WalletCards} label="Payments" />
        <PromisePill icon={BarChart3} label="Reports" />
      </View>

      {sessionExpired ? (
        <MobileAlertBanner
          title="Please log in again"
          description="Your previous session ended. Log in to continue where you left off."
          tone="warning"
          compact
        />
      ) : null}

      {pendingAssociationLogin ? (
        <MobileCard style={styles.formCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardCopy}>
              <MobileText variant="section" weight="bold">
                Choose where to continue
              </MobileText>
              <MobileText variant="small" tone="secondary">
                {accountLabel ? `${accountLabel} is linked to more than one association.` : 'Select the association you want to open.'}
              </MobileText>
            </View>
            <MobileStatusBadge status="Found" label={`${associationOptions.length}`} tone="primary" />
          </View>

          <MobileSelect
            label="Association"
            value={selectedAssociationId}
            options={associationOptions}
            onChange={setAssociationId}
            placeholder="Choose association"
          />

          {selectedAssociation ? (
            <View style={[styles.associationPreview, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}>
              <MobileWorkspaceLogo name={selectedAssociation.associationName} source={selectedAssociationLogo} size="md" />
              <View style={styles.associationPreviewCopy}>
                <MobileText variant="small" weight="bold" numberOfLines={1}>
                  {selectedAssociation.associationName}
                </MobileText>
                <MobileText variant="tiny" tone="secondary" numberOfLines={1}>
                  This is the workspace Nane will open.
                </MobileText>
              </View>
              <CheckCircle2 color={theme.colors.status.success} size={18} strokeWidth={2.5} />
            </View>
          ) : null}

          {error && !sessionExpired ? (
            <MobileAlertBanner
              title="We could not open that association"
              description={displayError}
              tone="danger"
              onDismiss={clearError}
              compact
            />
          ) : null}

          <View style={styles.buttonStack}>
            <MobileButton
              label="Continue to association"
              icon={Building2}
              fullWidth
              loading={loading}
              disabled={!selectedAssociationId || loading}
              onPress={handleAssociationContinue}
            />
            <MobileText variant="tiny" tone="secondary" style={styles.helperText}>
              {loading ? 'Opening your association...' : 'You can switch to another account if this is not the right workspace.'}
            </MobileText>
            <MobileButton
              label="Use another account"
              variant="secondary"
              fullWidth
              disabled={loading}
              onPress={clearPendingAssociationLogin}
            />
          </View>
        </MobileCard>
      ) : pendingModeSelection ? (
        <MobileCard style={styles.formCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardCopy}>
              <MobileText variant="section" weight="bold">
                Choose how to continue
              </MobileText>
              <MobileText variant="small" tone="secondary">
                You can use this association as an admin or as a member.
              </MobileText>
            </View>
            <MobileStatusBadge status="Access" label="2 choices" tone="primary" />
          </View>

          <View style={[styles.associationPreview, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}>
            <MobileWorkspaceLogo name={pendingModeSelection.user.associationName || pendingModeSelection.user.fullName} size="md" />
            <View style={styles.associationPreviewCopy}>
              <MobileText variant="small" weight="bold" numberOfLines={1}>
                {pendingModeSelection.user.associationName || 'Association workspace'}
              </MobileText>
              <MobileText variant="tiny" tone="secondary" numberOfLines={1}>
                {pendingModeSelection.user.fullName || pendingModeSelection.user.email}
              </MobileText>
            </View>
            <CheckCircle2 color={theme.colors.status.success} size={18} strokeWidth={2.5} />
          </View>

          {error && !sessionExpired ? (
            <MobileAlertBanner title="We could not open that workspace" description={displayError} tone="danger" onDismiss={clearError} compact />
          ) : null}

          <View style={styles.modeOptions}>
            <LoginModeOption
              icon={ShieldCheck}
              title="Continue as Admin"
              description="Manage members, payments, loans, events, reports, and settings."
              disabled={loading}
              onPress={() => void handleLoginMode('ADMIN')}
            />
            <LoginModeOption
              icon={Users}
              title="Continue as Member"
              description="View your profile, contributions, invoices, loans, events, and statements."
              disabled={loading}
              onPress={() => void handleLoginMode('MEMBER')}
            />
          </View>

          <View style={styles.buttonStack}>
            <MobileText variant="tiny" tone="secondary" style={styles.helperText}>
              {loading ? 'Opening your workspace...' : 'Nane will remember this choice for this association.'}
            </MobileText>
            <MobileButton
              label="Use another account"
              variant="secondary"
              fullWidth
              disabled={loading}
              onPress={clearPendingAssociationLogin}
            />
          </View>
        </MobileCard>
      ) : (
        <MobileCard style={styles.formCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardCopy}>
              <MobileText variant="section" weight="bold">
                Welcome back
              </MobileText>
              <MobileText variant="small" tone="secondary">
                Use the same email and password you use on Nane.
              </MobileText>
            </View>
          </View>

          {biometricUnlockAvailable ? (
            <View style={[styles.biometricPanel, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
              <View style={[styles.biometricIcon, { backgroundColor: theme.colors.primary }]}>
                <ScanFace color={theme.colors.onPrimary} size={19} strokeWidth={2.6} />
              </View>
              <View style={styles.biometricCopy}>
                <MobileText variant="small" weight="bold">
                  Unlock saved workspace
                </MobileText>
                <MobileText variant="tiny" tone="secondary">
                  {biometricAccountLabel ? `${biometricAccountLabel} can continue with ${biometricLabel}.` : `Continue with ${biometricLabel}.`}
                </MobileText>
              </View>
              <MobileButton
                label={biometricLabel}
                icon={ScanFace}
                size="sm"
                loading={biometricLoading}
                disabled={biometricLoading || loading}
                onPress={() => void unlockWithBiometrics()}
                style={styles.biometricButton}
              />
            </View>
          ) : null}

          {biometricError ? (
            <MobileAlertBanner title="Biometric login did not work" description={biometricError} tone="warning" onDismiss={clearError} compact />
          ) : null}

          {biometricUnlockAvailable ? (
            <View style={styles.passwordDivider}>
              <View style={[styles.passwordDividerLine, { backgroundColor: theme.colors.border }]} />
              <MobileText variant="tiny" tone="secondary" weight="bold">
                or use password
              </MobileText>
              <View style={[styles.passwordDividerLine, { backgroundColor: theme.colors.border }]} />
            </View>
          ) : null}

          <View style={styles.formFields}>
            <MobileTextInput
              label="Email address"
              value={email}
              onChangeText={handleEmailChange}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="username"
              icon={Mail}
              error={validation.email}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => passwordInputRef.current?.focus()}
            />
            <MobileTextInput
              ref={passwordInputRef}
              label="Password"
              value={password}
              onChangeText={handlePasswordChange}
              placeholder="Enter your password"
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
              secureTextEntry={!passwordVisible}
              icon={LockKeyhole}
              error={validation.password}
              returnKeyType="go"
              onSubmitEditing={() => void handleSignIn()}
              rightAction={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                  onPress={() => setPasswordVisible((visible) => !visible)}
                  style={({ pressed }) => [styles.passwordToggle, { opacity: pressed ? 0.72 : 1 }]}
                >
                  {passwordVisible ? (
                    <EyeOff color={theme.colors.textMuted} size={18} strokeWidth={2.4} />
                  ) : (
                    <Eye color={theme.colors.textMuted} size={18} strokeWidth={2.4} />
                  )}
                </Pressable>
              }
            />
          </View>

          {error && !sessionExpired ? (
            <MobileAlertBanner title="Login did not work" description={displayError} tone="danger" onDismiss={clearError} compact />
          ) : null}

          <View style={styles.buttonStack}>
            <MobileButton label="Log in" icon={ArrowRight} fullWidth loading={loading} disabled={loading} onPress={handleSignIn} />
            <MobileText variant="tiny" tone="secondary" style={styles.helperText}>
              {loading ? 'Checking your account...' : 'Nane will open the right workspace for your account.'}
            </MobileText>
          </View>

          <View style={styles.formLinks}>
            <Pressable accessibilityRole="button" onPress={() => setHelpTopic('forgot')} hitSlop={8}>
              <MobileText variant="small" weight="bold" style={{ color: theme.colors.primary }}>
                Forgot password?
              </MobileText>
            </Pressable>
            <View style={[styles.linkDivider, { backgroundColor: theme.colors.borderStrong }]} />
            <Pressable accessibilityRole="button" onPress={() => setHelpTopic('help')} hitSlop={8}>
              <MobileText variant="small" weight="bold" style={{ color: theme.colors.primary }}>
                Need help?
              </MobileText>
            </Pressable>
          </View>
        </MobileCard>
      )}

      <View style={styles.trustFooter}>
        <ShieldCheck color={theme.colors.status.success} size={17} strokeWidth={2.5} />
        <MobileText variant="tiny" tone="secondary" style={styles.trustText}>
          Only sign in with an account given by your association or Nane administrator.
        </MobileText>
      </View>

      <LoginHelpSheet topic={helpTopic} email={email} onClose={() => setHelpTopic(null)} />
    </MobileScreenContent>
  );
}

function MobileScreenContent({ children }: { children: ReactNode }) {
  return (
    <MobileScreen style={styles.root}>
      {children}
    </MobileScreen>
  );
}

function LoginBrandMark() {
  const theme = useNaneTheme();

  return (
    <View style={[styles.logoFrame, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, shadowColor: theme.colors.shadow }]}>
      <Image source={require('@/assets/images/nane-logo.png')} style={styles.logoImage} contentFit="cover" />
    </View>
  );
}

function PromisePill({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  const theme = useNaneTheme();

  return (
    <View style={[styles.promisePill, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, shadowColor: theme.colors.shadow }]}>
      <Icon color={theme.colors.primary} size={15} strokeWidth={2.5} />
      <MobileText variant="tiny" weight="bold">
        {label}
      </MobileText>
    </View>
  );
}

function LoginModeOption({
  icon: Icon,
  title,
  description,
  disabled,
  onPress,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useNaneTheme();

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.modeOption,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          opacity: disabled ? 0.62 : pressed ? 0.82 : 1,
        },
      ]}
    >
      <View style={[styles.modeIcon, { backgroundColor: theme.colors.primary }]}>
        <Icon color={theme.colors.onPrimary} size={18} strokeWidth={2.5} />
      </View>
      <View style={styles.modeCopy}>
        <MobileText variant="small" weight="bold">
          {title}
        </MobileText>
        <MobileText variant="tiny" tone="secondary">
          {description}
        </MobileText>
      </View>
      <ArrowRight color={theme.colors.primary} size={18} strokeWidth={2.5} />
    </Pressable>
  );
}

function LoginHelpSheet({ topic, email, onClose }: { topic: 'forgot' | 'help' | null; email: string; onClose: () => void }) {
  const theme = useNaneTheme();
  const isForgot = topic === 'forgot';

  async function contactSupport() {
    const subject = encodeURIComponent(isForgot ? 'Nane password help' : 'Nane login help');
    const body = encodeURIComponent(
      [
        'Hello Nane support,',
        '',
        isForgot ? 'I need help resetting my Nane password.' : 'I need help signing in to Nane.',
        email.trim() ? `Login email: ${email.trim()}` : 'Login email: ',
        '',
        'Thank you.',
      ].join('\n'),
    );

    try {
      await Linking.openURL(`mailto:support@nane.co.tz?subject=${subject}&body=${body}`);
    } catch {
      onClose();
    }
  }

  return (
    <MobileSheet
      visible={Boolean(topic)}
      title={isForgot ? 'Password help' : 'Login help'}
      description={isForgot ? 'Use one of these options to get back into your account.' : 'A few quick checks usually solve login issues.'}
      onClose={onClose}
    >
      {isForgot ? (
        <>
          <HelpStep
            icon={KeyRound}
            title="Ask your admin for a reset"
            description="Your association or Nane administrator can reset your password and ask you to change it after login."
          />
          <HelpStep
            icon={Mail}
            title="Contact Nane support"
            description="Send your login email and association name so support can verify the account safely."
          />
        </>
      ) : (
        <>
          <HelpStep
            icon={Mail}
            title="Check the email address"
            description="Use the same email your association added to Nane. Personal and work emails may be different."
          />
          <HelpStep
            icon={Building2}
            title="Choose the right association"
            description="If your account belongs to several associations, select the workspace you want after login."
          />
          <HelpStep
            icon={LifeBuoy}
            title="Still stuck?"
            description="Contact support with your email, association name, and what you were trying to open."
          />
        </>
      )}

      <View style={styles.sheetActions}>
        <MobileButton label="Contact support" icon={LifeBuoy} fullWidth onPress={() => void contactSupport()} />
        <MobileButton label="Close" variant="secondary" fullWidth onPress={onClose} />
      </View>

      <MobileText variant="tiny" tone="secondary" style={[styles.sheetFinePrint, { color: theme.colors.textMuted }]}>
        For security, Nane support may ask your association administrator to confirm the request.
      </MobileText>
    </MobileSheet>
  );
}

function HelpStep({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  const theme = useNaneTheme();

  return (
    <View style={[styles.helpStep, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
      <View style={[styles.helpStepIcon, { backgroundColor: theme.colors.primary }]}>
        <Icon color={theme.colors.onPrimary} size={17} strokeWidth={2.5} />
      </View>
      <View style={styles.helpStepCopy}>
        <MobileText variant="small" weight="bold">
          {title}
        </MobileText>
        <MobileText variant="small" tone="secondary">
          {description}
        </MobileText>
      </View>
    </View>
  );
}

function buildLoginAssociationLogoSource(association: AuthAssociationOption | null): ImageSource | null {
  const candidate = association?.logoUrl || association?.logoPath || association?.logo;
  if (!candidate) return null;
  if (/^https?:\/\//i.test(candidate)) return { uri: candidate };

  const query = new URLSearchParams({ filePath: candidate, disposition: 'inline' });
  return {
    uri: `${mobileEnv.apiBaseUrl}/files/download?${query.toString()}`,
    cacheKey: `login-association-logo-${association?.associationId || candidate}`,
  };
}

function friendlyLoginError(message: string | null, mode: 'login' | 'association') {
  if (!message) return undefined;
  const normalized = message.toLowerCase();

  if (normalized.includes('bad credentials') || normalized.includes('invalid credentials') || normalized.includes('unauthorized') || normalized.includes('status 401')) {
    return 'That email or password does not look right. Check them and try again.';
  }

  if (normalized.includes('network request failed') || normalized.includes('fetch failed') || normalized.includes('could not connect')) {
    return 'Nane could not reach the server. Check your connection and try again.';
  }

  if (normalized.includes('timeout') || normalized.includes('timed out')) {
    return 'The request took too long. Check your connection and try again.';
  }

  if (normalized.includes('not allowed') || normalized.includes('not permitted') || normalized.includes('access denied') || normalized.includes('forbidden')) {
    return mode === 'association'
      ? 'Your account cannot open this association yet. Contact your association administrator.'
      : 'This account does not have mobile access yet. Contact your association administrator.';
  }

  if (normalized.includes('disabled') || normalized.includes('inactive') || normalized.includes('locked') || normalized.includes('suspended')) {
    return 'This account is not active right now. Contact your association administrator.';
  }

  if (normalized.includes('server did not return') || normalized.includes('usable mobile session')) {
    return 'Nane could not prepare your mobile session. Try again, or contact support if it continues.';
  }

  if (normalized.includes('internal') || normalized.includes('status 500') || normalized.includes('unexpected error')) {
    return 'Nane could not complete login right now. Try again in a moment.';
  }

  return message;
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    gap: 18,
    paddingHorizontal: 18,
    paddingVertical: 26,
  },
  brandBlock: {
    alignItems: 'center',
    gap: 14,
  },
  logoFrame: {
    width: 66,
    height: 66,
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.02,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 0,
  },
  logoImage: {
    width: 148,
    height: 148,
  },
  brandCopy: {
    gap: 8,
    maxWidth: 360,
  },
  centerText: {
    textAlign: 'center',
  },
  promiseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  promisePill: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowOpacity: 0.015,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 0,
  },
  formCard: {
    gap: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  formFields: {
    gap: 12,
  },
  buttonStack: {
    gap: 10,
  },
  modeOptions: {
    gap: 10,
  },
  modeOption: {
    minHeight: 76,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  modeIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  associationPreview: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  associationPreviewCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  biometricPanel: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  biometricIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  biometricButton: {
    minWidth: 96,
  },
  passwordDivider: {
    minHeight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  passwordDividerLine: {
    height: 1,
    flex: 1,
  },
  passwordToggle: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperText: {
    textAlign: 'center',
  },
  formLinks: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  linkDivider: {
    width: 1,
    height: 15,
  },
  trustFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 10,
  },
  trustText: {
    flexShrink: 1,
    textAlign: 'center',
  },
  helpStep: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    gap: 11,
  },
  helpStepIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpStepCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  sheetActions: {
    gap: 10,
  },
  sheetFinePrint: {
    textAlign: 'center',
  },
});
