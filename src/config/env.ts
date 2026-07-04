import Constants from 'expo-constants';

const DEFAULT_API_BASE_URL = 'https://app.nane.co.tz/api/v1';

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function readExtraValue(key: string): string | undefined {
  const extra = Constants.expoConfig?.extra;
  const value = extra?.[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export const mobileEnv = {
  apiBaseUrl: trimTrailingSlash(
    process.env.EXPO_PUBLIC_NANE_API_BASE_URL ||
      process.env.EXPO_PUBLIC_API_BASE_URL ||
      readExtraValue('naneApiBaseUrl') ||
      DEFAULT_API_BASE_URL,
  ),
};

