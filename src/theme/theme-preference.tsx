import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, useColorScheme } from 'react-native';

export type NaneThemePreference = 'system' | 'light' | 'dark';
export type NaneResolvedScheme = 'light' | 'dark';

type NaneThemePreferenceContextValue = {
  preference: NaneThemePreference;
  resolvedScheme: NaneResolvedScheme;
  setPreference: (preference: NaneThemePreference) => Promise<void>;
};

const THEME_PREFERENCE_KEY = 'nane.mobile.themePreference';
const NaneThemePreferenceContext = createContext<NaneThemePreferenceContextValue | null>(null);

async function getStoredPreference() {
  const value = Platform.OS === 'web'
    ? readWebPreference()
    : await SecureStore.getItemAsync(THEME_PREFERENCE_KEY);
  return isThemePreference(value) ? value : 'system';
}

async function setStoredPreference(preference: NaneThemePreference) {
  if (Platform.OS === 'web') {
    try {
      window.localStorage.setItem(THEME_PREFERENCE_KEY, preference);
    } catch {}
    return;
  }
  await SecureStore.setItemAsync(THEME_PREFERENCE_KEY, preference);
}

function readWebPreference() {
  try {
    return window.localStorage.getItem(THEME_PREFERENCE_KEY);
  } catch {
    return null;
  }
}

function isThemePreference(value: string | null): value is NaneThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

function resolveScheme(preference: NaneThemePreference, systemScheme?: string | null): NaneResolvedScheme {
  if (preference === 'system') {
    return systemScheme === 'dark' ? 'dark' : 'light';
  }
  return preference;
}

export function NaneThemePreferenceProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<NaneThemePreference>('system');

  useEffect(() => {
    void Promise.resolve().then(async () => {
      setPreferenceState(await getStoredPreference());
    });
  }, []);

  const setPreference = useCallback(async (nextPreference: NaneThemePreference) => {
    setPreferenceState(nextPreference);
    await setStoredPreference(nextPreference);
  }, []);

  const value = useMemo<NaneThemePreferenceContextValue>(
    () => ({
      preference,
      resolvedScheme: resolveScheme(preference, systemScheme),
      setPreference,
    }),
    [preference, setPreference, systemScheme],
  );

  return <NaneThemePreferenceContext.Provider value={value}>{children}</NaneThemePreferenceContext.Provider>;
}

export function useNaneThemePreference() {
  const context = useContext(NaneThemePreferenceContext);
  const systemScheme = useColorScheme();
  const fallback = useMemo<NaneThemePreferenceContextValue>(
    () => ({
      preference: 'system',
      resolvedScheme: resolveScheme('system', systemScheme),
      setPreference: async () => {},
    }),
    [systemScheme],
  );
  return context || fallback;
}
