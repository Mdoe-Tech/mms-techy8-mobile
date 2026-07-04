import { useMemo, useState } from 'react';
import { Building2, LockKeyhole, Mail, ShieldCheck } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobilePageHeader,
  MobileScreen,
  MobileSelect,
  MobileStatusBadge,
  MobileText,
  MobileTextInput,
} from '@/components/mobile';
import { useNaneTheme } from '@/theme/tokens';

export default function LoginScreen() {
  const theme = useNaneTheme();
  const {
    error,
    loading,
    pendingAssociationLogin,
    sessionExpired,
    signIn,
    selectAssociation,
    clearPendingAssociationLogin,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [associationId, setAssociationId] = useState('');
  const [validation, setValidation] = useState<{ email?: string; password?: string }>({});

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

  async function handleSignIn() {
    const nextValidation = {
      email: email.trim() ? undefined : 'Email is required.',
      password: password ? undefined : 'Password is required.',
    };

    setValidation(nextValidation);
    if (nextValidation.email || nextValidation.password) return;

    await signIn({ email: email.trim(), password });
  }

  async function handleAssociationContinue() {
    if (!selectedAssociationId) return;
    await selectAssociation(selectedAssociationId);
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Nane mobile"
        title="Sign in"
        subtitle="Use your existing Nane account to open the native mobile workspace."
        rightAction={<View />}
      />

      <MobileCard style={styles.heroCard}>
        <View style={[styles.heroIcon, { backgroundColor: theme.colors.primary }]}>
          <ShieldCheck color={theme.colors.onPrimary} size={24} strokeWidth={2.6} />
        </View>
        <MobileText variant="title" weight="bold">
          Secure workspace access
        </MobileText>
        <MobileText variant="body" tone="secondary">
          Your role and association are detected from the same permissions used by the web system.
        </MobileText>
        {sessionExpired ? <MobileStatusBadge status="Session expired" tone="warning" /> : null}
      </MobileCard>

      {pendingAssociationLogin ? (
        <MobileCard style={styles.formCard}>
          <View style={styles.cardHeader}>
            <View>
              <MobileText variant="section" weight="bold">
                Choose association
              </MobileText>
              <MobileText variant="small" tone="secondary">
                {pendingAssociationLogin.fullName || pendingAssociationLogin.email}
              </MobileText>
            </View>
            <MobileStatusBadge status={`${associationOptions.length} found`} tone="primary" />
          </View>

          <MobileSelect
            label="Association"
            value={selectedAssociationId}
            options={associationOptions}
            onChange={setAssociationId}
            placeholder="Select association"
          />

          {error ? (
            <MobileText variant="small" style={{ color: theme.colors.status.danger }}>
              {error}
            </MobileText>
          ) : null}

          <View style={styles.buttonStack}>
            <MobileButton
              label="Continue"
              icon={Building2}
              fullWidth
              loading={loading}
              disabled={!selectedAssociationId || loading}
              onPress={handleAssociationContinue}
            />
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
            <View>
              <MobileText variant="section" weight="bold">
                Account details
              </MobileText>
              <MobileText variant="small" tone="secondary">
                Sign in once, then Nane keeps the session securely on this device.
              </MobileText>
            </View>
          </View>

          <View style={styles.formFields}>
            <MobileTextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="name@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="username"
              icon={Mail}
              error={validation.email}
            />
            <MobileTextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
              secureTextEntry
              icon={LockKeyhole}
              error={validation.password}
            />
          </View>

          {error ? (
            <MobileText variant="small" style={{ color: theme.colors.status.danger }}>
              {error}
            </MobileText>
          ) : null}

          <MobileButton label="Sign in" fullWidth loading={loading} disabled={loading} onPress={handleSignIn} />
        </MobileCard>
      )}
    </MobileScreen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    gap: 10,
  },
  heroIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCard: {
    gap: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  formFields: {
    gap: 12,
  },
  buttonStack: {
    gap: 10,
  },
});
