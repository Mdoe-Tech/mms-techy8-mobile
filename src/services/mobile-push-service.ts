import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { apiRequest } from '@/api/client';
import { mobileEnv } from '@/config/env';
import type { AuthUser, MobileViewMode } from '@/types/auth';

const PUSH_REGISTRATION_KEY = 'nane.mobile.pushRegistration';
export const NANE_NOTIFICATION_CHANNEL_ID = 'nane-default';

export type PushPermissionState =
  | 'granted'
  | 'provisional'
  | 'denied'
  | 'undetermined'
  | 'unavailable';

export type PushRegistrationStatus =
  | 'ready'
  | 'permission_needed'
  | 'permission_denied'
  | 'device_unsupported'
  | 'project_missing'
  | 'backend_unconfigured'
  | 'backend_failed'
  | 'error';

export type StoredPushRegistration = {
  expoPushToken: string;
  userId?: string | null;
  associationId?: string | null;
  activeView?: MobileViewMode | null;
  platform: typeof Platform.OS;
  deviceLabel?: string | null;
  backendSynced: boolean;
  registeredAt: string;
};

export type PushReadiness = {
  permissionState: PushPermissionState;
  canAskAgain: boolean;
  status: PushRegistrationStatus;
  message: string;
  registration: StoredPushRegistration | null;
  backendConfigured: boolean;
  physicalDevice: boolean;
};

type EnsurePushRegistrationOptions = {
  user?: AuthUser | null;
  activeView?: MobileViewMode | null;
  prompt?: boolean;
};

type RegisterDevicePayload = {
  expoPushToken: string;
  platform: typeof Platform.OS;
  associationId?: string | null;
  activeView?: MobileViewMode | null;
  device: {
    brand?: string | null;
    manufacturer?: string | null;
    modelName?: string | null;
    osName?: string | null;
    osVersion?: string | null;
    appVersion?: string | null;
    buildNumber?: string | null;
  };
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function ensureNotificationChannelAsync() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(NANE_NOTIFICATION_CHANNEL_ID, {
    name: 'Nane alerts',
    description: 'Payments, member records, approvals, reminders, and account updates.',
    importance: Notifications.AndroidImportance.DEFAULT,
    enableLights: true,
    enableVibrate: true,
    lightColor: '#2563EB',
    vibrationPattern: [0, 220, 160, 220],
    showBadge: true,
  });
}

export async function getPushReadinessAsync(): Promise<PushReadiness> {
  await ensureNotificationChannelAsync();

  if (!isPushCapableDevice()) {
    return {
      permissionState: 'unavailable',
      canAskAgain: false,
      status: 'device_unsupported',
      message: 'Push alerts need a physical iPhone or Android device.',
      registration: await getStoredPushRegistrationAsync(),
      backendConfigured: isPushBackendConfigured(),
      physicalDevice: false,
    };
  }

  const permissions = await Notifications.getPermissionsAsync();
  const permissionState = resolvePermissionState(permissions);
  const registration = await getStoredPushRegistrationAsync();

  if (permissionState === 'granted' || permissionState === 'provisional') {
    if (registration?.expoPushToken && registration.backendSynced) {
      return {
        permissionState,
        canAskAgain: permissions.canAskAgain,
        status: 'ready',
        message: 'Push alerts are ready on this device.',
        registration,
        backendConfigured: isPushBackendConfigured(),
        physicalDevice: true,
      };
    }

    if (registration?.expoPushToken) {
      const backendConfigured = isPushBackendConfigured();
      return {
        permissionState,
        canAskAgain: permissions.canAskAgain,
        status: backendConfigured ? 'backend_failed' : 'backend_unconfigured',
        message: backendConfigured
          ? 'Device alerts are allowed. Nane could not confirm server push registration yet.'
          : 'Device alerts are allowed. Server push registration still needs the backend endpoint.',
        registration,
        backendConfigured,
        physicalDevice: true,
      };
    }
  }

  return {
    permissionState,
    canAskAgain: permissions.canAskAgain,
    status: permissionState === 'denied' ? 'permission_denied' : 'permission_needed',
    message:
      permissionState === 'denied'
        ? 'Push alerts are blocked in device settings.'
        : 'Push alerts are not enabled on this device yet.',
    registration,
    backendConfigured: isPushBackendConfigured(),
    physicalDevice: true,
  };
}

export async function ensurePushRegistrationAsync({
  user,
  activeView,
  prompt = false,
}: EnsurePushRegistrationOptions = {}): Promise<PushReadiness> {
  await ensureNotificationChannelAsync();

  if (!isPushCapableDevice()) {
    return getPushReadinessAsync();
  }

  let permissions = await Notifications.getPermissionsAsync();
  let permissionState = resolvePermissionState(permissions);

  if (prompt && permissionState === 'undetermined') {
    permissions = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    permissionState = resolvePermissionState(permissions);
  }

  if (permissionState !== 'granted' && permissionState !== 'provisional') {
    return getPushReadinessAsync();
  }

  const projectId = getExpoProjectId();
  if (!projectId) {
    return {
      permissionState,
      canAskAgain: permissions.canAskAgain,
      status: 'project_missing',
      message: 'Expo project ID is missing, so this build cannot request a push token yet.',
      registration: await getStoredPushRegistrationAsync(),
      backendConfigured: isPushBackendConfigured(),
      physicalDevice: true,
    };
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    const registration: StoredPushRegistration = {
      expoPushToken: token.data,
      userId: user?.userId,
      associationId: user?.associationId,
      activeView,
      platform: Platform.OS,
      deviceLabel: getDeviceLabel(),
      backendSynced: false,
      registeredAt: new Date().toISOString(),
    };

    const backendSynced = await registerPushTokenWithBackendAsync(registration, {
      associationId: user?.associationId,
      activeView,
    });
    const backendConfigured = isPushBackendConfigured();
    const storedRegistration = { ...registration, backendSynced };
    await storePushRegistrationAsync(storedRegistration);

    return {
      permissionState,
      canAskAgain: permissions.canAskAgain,
      status: backendSynced ? 'ready' : backendConfigured ? 'backend_failed' : 'backend_unconfigured',
      message: backendSynced
        ? 'Push alerts are ready on this device.'
        : backendConfigured
          ? 'Device alerts are allowed. Nane could not confirm server push registration yet.'
          : 'Device alerts are allowed. Server push registration still needs the backend endpoint.',
      registration: storedRegistration,
      backendConfigured,
      physicalDevice: true,
    };
  } catch (error) {
    return {
      permissionState,
      canAskAgain: permissions.canAskAgain,
      status: 'error',
      message: error instanceof Error ? error.message : 'Nane could not prepare push alerts on this device.',
      registration: await getStoredPushRegistrationAsync(),
      backendConfigured: isPushBackendConfigured(),
      physicalDevice: true,
    };
  }
}

export async function unregisterPushDeviceAsync() {
  const registration = await getStoredPushRegistrationAsync();

  if (registration?.expoPushToken && mobileEnv.pushDeviceUnregistrationPath) {
    try {
      await apiRequest(mobileEnv.pushDeviceUnregistrationPath, {
        method: 'POST',
        body: {
          expoPushToken: registration.expoPushToken,
          platform: registration.platform,
        },
      });
    } catch {
      // Sign-out must not fail because a push cleanup endpoint is unavailable.
    }
  }

  await clearLocalPushRegistrationAsync();
}

export async function clearLocalPushRegistrationAsync() {
  await deleteItem(PUSH_REGISTRATION_KEY);
}

export async function getStoredPushRegistrationAsync(): Promise<StoredPushRegistration | null> {
  const raw = await getItem(PUSH_REGISTRATION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredPushRegistration;
    if (!parsed?.expoPushToken) return null;
    return parsed;
  } catch {
    await deleteItem(PUSH_REGISTRATION_KEY);
    return null;
  }
}

export function isPushBackendConfigured() {
  return Boolean(mobileEnv.pushDeviceRegistrationPath);
}

function isPushCapableDevice() {
  if (Platform.OS === 'web') return false;
  return Device.isDevice;
}

function resolvePermissionState(permissions: Notifications.NotificationPermissionsStatus): PushPermissionState {
  if (permissions.granted) return 'granted';
  if (permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return 'provisional';
  if (permissions.status === 'denied') return 'denied';
  return 'undetermined';
}

function getExpoProjectId() {
  const constantsWithEas = Constants as unknown as { easConfig?: { projectId?: string } };
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const extraEas = extra?.eas as { projectId?: string } | undefined;
  const directProjectId = extra?.projectId;
  return (
    constantsWithEas.easConfig?.projectId ||
    extraEas?.projectId ||
    (typeof directProjectId === 'string' ? directProjectId : undefined)
  );
}

async function registerPushTokenWithBackendAsync(
  registration: StoredPushRegistration,
  context: Pick<RegisterDevicePayload, 'associationId' | 'activeView'>,
) {
  if (!mobileEnv.pushDeviceRegistrationPath) return false;

  const payload: RegisterDevicePayload = {
    expoPushToken: registration.expoPushToken,
    platform: Platform.OS,
    associationId: context.associationId,
    activeView: context.activeView,
    device: {
      brand: Device.brand,
      manufacturer: Device.manufacturer,
      modelName: Device.modelName,
      osName: Device.osName,
      osVersion: Device.osVersion,
      appVersion: Constants.expoConfig?.version,
      buildNumber: Platform.OS === 'ios' ? Constants.expoConfig?.ios?.buildNumber : Constants.expoConfig?.android?.versionCode?.toString(),
    },
  };

  try {
    await apiRequest(mobileEnv.pushDeviceRegistrationPath, {
      method: 'POST',
      body: payload,
    });
    return true;
  } catch {
    return false;
  }
}

async function storePushRegistrationAsync(registration: StoredPushRegistration) {
  await setItem(PUSH_REGISTRATION_KEY, JSON.stringify(registration));
}

function getDeviceLabel() {
  return [Device.brand, Device.modelName].filter(Boolean).join(' ') || Device.osName || Platform.OS;
}

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
