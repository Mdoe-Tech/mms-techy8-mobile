import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { decodeAuthUser, isExpiredPayload, parseJwtPayload } from '@/auth/jwt';
import type { AuthUser, MobileViewMode } from '@/types/auth';

const ACCESS_TOKEN_KEY = 'nane.mobile.accessToken';
const REFRESH_TOKEN_KEY = 'nane.mobile.refreshToken';
const ASSOCIATION_ID_KEY = 'nane.mobile.associationId';
const ASSOCIATION_MODE_PREFIX = 'nane.mobile.associationMode.';

export type StoredSession = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  associationId?: string;
  associationMode?: MobileViewMode;
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

export async function loadStoredSession(): Promise<StoredSession | null> {
  const accessToken = await getItem(ACCESS_TOKEN_KEY);
  const refreshToken = await getItem(REFRESH_TOKEN_KEY);

  if (!accessToken || !refreshToken) {
    await clearStoredSession();
    return null;
  }

  const payload = parseJwtPayload(accessToken);
  if (!payload) {
    await clearStoredSession();
    return null;
  }

  if (isExpiredPayload(payload)) {
    return null;
  }

  const user = decodeAuthUser(accessToken);
  if (!user) {
    await clearStoredSession();
    return null;
  }

  const associationId = (await getItem(ASSOCIATION_ID_KEY)) || user.associationId;
  const associationMode = associationId ? ((await getItem(`${ASSOCIATION_MODE_PREFIX}${associationId}`)) as MobileViewMode | null) : null;
  return { accessToken, refreshToken, user, associationId, associationMode: associationMode || undefined };
}

export async function getStoredAccessToken() {
  return getItem(ACCESS_TOKEN_KEY);
}

export async function getStoredRefreshToken() {
  return getItem(REFRESH_TOKEN_KEY);
}

export async function getStoredAssociationId() {
  return getItem(ASSOCIATION_ID_KEY);
}

export async function getStoredAssociationMode(associationId?: string | null) {
  if (!associationId) return null;
  return getItem(`${ASSOCIATION_MODE_PREFIX}${associationId}`) as Promise<MobileViewMode | null>;
}

export async function storeSession(accessToken: string, refreshToken: string, mode?: MobileViewMode) {
  const user = decodeAuthUser(accessToken);
  if (!user) throw new Error('Invalid or expired access token');
  await setItem(ACCESS_TOKEN_KEY, accessToken);
  await setItem(REFRESH_TOKEN_KEY, refreshToken);
  if (user.associationId) {
    await setItem(ASSOCIATION_ID_KEY, user.associationId);
    if (mode) {
      await setItem(`${ASSOCIATION_MODE_PREFIX}${user.associationId}`, mode);
    }
  } else {
    await deleteItem(ASSOCIATION_ID_KEY);
  }
  return user;
}

export async function setStoredAssociationMode(associationId: string, mode: MobileViewMode) {
  await setItem(`${ASSOCIATION_MODE_PREFIX}${associationId}`, mode);
}

export async function clearStoredSession() {
  const associationId = await getItem(ASSOCIATION_ID_KEY);
  await deleteItem(ACCESS_TOKEN_KEY);
  await deleteItem(REFRESH_TOKEN_KEY);
  await deleteItem(ASSOCIATION_ID_KEY);
  if (associationId) {
    await deleteItem(`${ASSOCIATION_MODE_PREFIX}${associationId}`);
  }
}
