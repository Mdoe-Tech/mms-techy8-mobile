import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_UNLOCK_ENABLED_KEY = 'nane.mobile.biometricUnlock.enabled';
const BIOMETRIC_UNLOCK_ACCOUNT_KEY = 'nane.mobile.biometricUnlock.accountLabel';

export type BiometricCapability = {
  available: boolean;
  supported: boolean;
  enrolled: boolean;
  label: string;
  reason?: string;
};

export type BiometricAuthenticationResult = {
  success: boolean;
  message?: string;
};

async function getItem(key: string) {
  if (Platform.OS === 'web') {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string) {
  if (Platform.OS === 'web') {
    try {
      window.localStorage.setItem(key, value);
    } catch {}
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string) {
  if (Platform.OS === 'web') {
    try {
      window.localStorage.removeItem(key);
    } catch {}
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

function labelForTypes(types: LocalAuthentication.AuthenticationType[]) {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'Face ID';
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return Platform.OS === 'ios' ? 'Touch ID' : 'fingerprint';
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return 'iris unlock';
  return 'biometrics';
}

export async function getBiometricCapability(): Promise<BiometricCapability> {
  if (Platform.OS === 'web') {
    return {
      available: false,
      supported: false,
      enrolled: false,
      label: 'Biometric login',
      reason: 'Biometric login is available on iOS and Android devices.',
    };
  }

  try {
    const [supported, enrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    const label = labelForTypes(types);

    if (!supported) {
      return {
        available: false,
        supported,
        enrolled,
        label,
        reason: 'This device does not support biometric login.',
      };
    }

    if (!enrolled) {
      return {
        available: false,
        supported,
        enrolled,
        label,
        reason: `Set up ${label} on this device first, then enable biometric login in Nane.`,
      };
    }

    return {
      available: true,
      supported,
      enrolled,
      label,
    };
  } catch {
    return {
      available: false,
      supported: false,
      enrolled: false,
      label: 'Biometric login',
      reason: 'Nane could not check biometric support on this device.',
    };
  }
}

export async function authenticateWithBiometrics(label = 'biometrics'): Promise<BiometricAuthenticationResult> {
  const capability = await getBiometricCapability();
  if (!capability.available) {
    return {
      success: false,
      message: capability.reason || `${capability.label} is not ready on this device.`,
    };
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock Nane',
    promptSubtitle: `Use ${label} to continue`,
    promptDescription: 'Confirm it is you before Nane opens your saved workspace.',
    cancelLabel: 'Use password',
    fallbackLabel: 'Use passcode',
    biometricsSecurityLevel: 'strong',
    requireConfirmation: true,
  });

  if (result.success) {
    return { success: true };
  }

  return {
    success: false,
    message: friendlyBiometricError(result.error, capability.label),
  };
}

export async function isBiometricUnlockEnabled() {
  return (await getItem(BIOMETRIC_UNLOCK_ENABLED_KEY)) === 'true';
}

export async function getBiometricAccountLabel() {
  return getItem(BIOMETRIC_UNLOCK_ACCOUNT_KEY);
}

export async function enableBiometricUnlock(accountLabel?: string | null) {
  await setItem(BIOMETRIC_UNLOCK_ENABLED_KEY, 'true');
  if (accountLabel) {
    await setItem(BIOMETRIC_UNLOCK_ACCOUNT_KEY, accountLabel);
  }
}

export async function disableBiometricUnlock() {
  await deleteItem(BIOMETRIC_UNLOCK_ENABLED_KEY);
  await deleteItem(BIOMETRIC_UNLOCK_ACCOUNT_KEY);
}

function friendlyBiometricError(error: LocalAuthentication.LocalAuthenticationError, label: string) {
  switch (error) {
    case 'user_cancel':
    case 'system_cancel':
    case 'app_cancel':
      return `${label} was cancelled. Use your password to continue.`;
    case 'user_fallback':
      return 'Use your password to continue.';
    case 'not_enrolled':
      return `Set up ${label} on this device first, then try again.`;
    case 'not_available':
    case 'passcode_not_set':
      return `${label} is not available on this device right now.`;
    case 'lockout':
      return `${label} is temporarily locked. Use your device passcode or log in with your password.`;
    case 'timeout':
      return `${label} timed out. Try again or use your password.`;
    case 'authentication_failed':
      return `${label} did not match. Try again or use your password.`;
    default:
      return `Nane could not complete ${label} login. Use your password to continue.`;
  }
}
