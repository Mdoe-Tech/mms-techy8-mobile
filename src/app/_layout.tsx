import {
  Quicksand_400Regular,
  Quicksand_500Medium,
  Quicksand_600SemiBold,
  Quicksand_700Bold,
  useFonts,
} from '@expo-google-fonts/quicksand';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { AuthFeedbackBridge } from '@/auth/AuthFeedbackBridge';
import { AuthProvider } from '@/auth/auth-context';
import { WorkspaceIdentityProvider } from '@/auth/workspace-identity';
import { MobileFeedbackHost, MobileFeedbackProvider, MobilePushNotificationProvider } from '@/components/mobile';
import { installSafeBackNavigation } from '@/navigation/safe-back';
import { NaneThemePreferenceProvider, useNaneThemePreference } from '@/theme/theme-preference';
import { useNaneTheme } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Quicksand_400Regular,
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    installSafeBackNavigation();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <NaneThemePreferenceProvider>
      <RootNavigation />
    </NaneThemePreferenceProvider>
  );
}

function RootNavigation() {
  const { resolvedScheme } = useNaneThemePreference();
  const theme = useNaneTheme();

  return (
    <ThemeProvider value={resolvedScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <WorkspaceIdentityProvider>
          <MobileFeedbackProvider>
            <MobilePushNotificationProvider>
              <AuthFeedbackBridge />
              <Stack
                screenOptions={{
                  headerShown: false,
                  animation: 'slide_from_right',
                  animationDuration: 220,
                  contentStyle: { backgroundColor: theme.colors.background },
                }}
              />
              <MobileFeedbackHost />
            </MobilePushNotificationProvider>
          </MobileFeedbackProvider>
        </WorkspaceIdentityProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
