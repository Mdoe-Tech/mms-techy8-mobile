import { router } from 'expo-router';
import {
  BookOpen,
  CheckCircle2,
  Code2,
  ExternalLink,
  Globe2,
  Info,
  KeyRound,
  Link as LinkIcon,
  RefreshCw,
  Share2,
  ShieldCheck,
  Smartphone,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Share, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileEmptyState,
  MobileErrorState,
  MobileFormSection,
  MobileIconButton,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
  MobileToast,
} from '@/components/mobile';
import { mobileEnv } from '@/config/env';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import { getAssociationProfile } from '@/services/association-service';
import { useNaneTheme } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';

type IntegrationEnvironment = 'test' | 'production';
type IntegrationSection = 'overview' | 'api' | 'docs';

type MobileRegistrationIntegrationScreenProps = {
  initialEnvironment?: IntegrationEnvironment;
  initialTab?: IntegrationSection;
};

const API_BASES: Record<IntegrationEnvironment, string> = {
  test: 'https://test-app.nane.co.tz/api/v1',
  production: 'https://app.nane.co.tz/api/v1',
};

const APP_BASES: Record<IntegrationEnvironment, string> = {
  test: 'https://test-app.nane.co.tz',
  production: 'https://app.nane.co.tz',
};

const DOC_URLS: Record<IntegrationEnvironment, string> = {
  test: 'https://test-app.nane.co.tz/docs/public-registration-api',
  production: 'https://app.nane.co.tz/docs/public-registration-api',
};

const sectionTabs = [
  { value: 'overview', label: 'Overview', count: 4 },
  { value: 'api', label: 'API flow', count: 3 },
  { value: 'docs', label: 'Docs', count: 2 },
];

const environmentTabs = [
  { value: 'test', label: 'Test' },
  { value: 'production', label: 'Live' },
];

export default function MobileRegistrationIntegrationScreen({
  initialEnvironment,
  initialTab,
}: MobileRegistrationIntegrationScreenProps) {
  const { activeView, associationId, user } = useAuth();
  const theme = useNaneTheme();
  const authAssociationName = user?.associationName || '';
  const [environment, setEnvironment] = useState<IntegrationEnvironment>(() => initialEnvironment || detectEnvironment());
  const [section, setSection] = useState<IntegrationSection>(() => initialTab || 'overview');
  const [associationName, setAssociationName] = useState(authAssociationName);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadIntegrationContext = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setAssociationName(authAssociationName);
        return;
      }

      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      if (mode === 'refresh') setNotice(null);

      try {
        const profile = await getAssociationProfile(associationId);
        setAssociationName(profile.name || authAssociationName);
        if (mode === 'refresh') setNotice('Registration integration details refreshed.');
      } catch (loadError) {
        setAssociationName(authAssociationName);
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId, authAssociationName],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadIntegrationContext('initial'));
  }, [loadIntegrationContext]);

  const details = useMemo(() => {
    const apiBase = API_BASES[environment];
    const appBase = APP_BASES[environment];
    const encodedName = associationName ? encodeURIComponent(associationName) : '';
    const publicRegistrationUrl = associationId ? `${appBase}/register/association/${associationId}` : '';
    const registerEndpoint = associationName
      ? `${apiBase}/auth/register/self?associationName=${encodedName}&otpVerificationId={verificationId}`
      : `${apiBase}/auth/register/self?associationName=YOUR_ASSOCIATION_NAME&otpVerificationId={verificationId}`;

    return {
      apiBase,
      appBase,
      encodedName,
      publicRegistrationUrl,
      requestOtpEndpoint: `${apiBase}/auth/register/otp/request`,
      verifyOtpEndpoint: `${apiBase}/auth/register/otp/verify`,
      registerEndpoint,
      loginUrl: `${appBase}/login`,
      docsUrl: DOC_URLS[environment],
    };
  }, [associationId, associationName, environment]);

  const shareValue = async (title: string, value: string) => {
    if (!value) return;
    await Share.share({ title, message: value, url: /^https?:\/\//.test(value) ? value : undefined });
    setNotice(`${title} shared.`);
  };

  const openUrl = async (url: string) => {
    if (!url) return;
    setError(null);
    try {
      await Linking.openURL(url);
    } catch {
      setError('Unable to open this link from the simulator.');
    }
  };

  if (activeView !== 'ADMIN') {
    return (
      <AccessDeniedScreen
        title="Registration integration"
        description="Registration integration details are available for association admin workspaces only."
      />
    );
  }

  if (loading) {
    return <MobilePageLoadingState kind="detail" message="Loading integration details" />;
  }

  if (!associationId) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Settings" title="Registration integration" subtitle="Association context required" onBack={() => router.back()} rightAction={<View />} />
        <MobileEmptyState
          title="Association session missing"
          description="Select an association admin workspace before viewing registration integration details."
        />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Settings"
        title="Registration integration"
        subtitle="Public signup link and embedded API guide"
        onBack={() => router.back()}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Refresh integration"
            variant="secondary"
            disabled={refreshing}
            onPress={() => void loadIntegrationContext('refresh')}
          />
        }
      />

      {error ? (
        <MobileErrorState
          title="Integration details issue"
          description={error}
          retryLabel="Reload"
          onRetry={() => void loadIntegrationContext('refresh')}
        />
      ) : null}
      {notice ? <MobileToast title={notice} tone="success" /> : null}

      <MobileCard compact accent={environment === 'production' ? 'green' : 'blue'} style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={[styles.heroIcon, { backgroundColor: theme.colors.primary }]}>
            <Code2 color={theme.colors.onPrimary} size={22} strokeWidth={2.5} />
          </View>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold">
              Member registration handoff
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Share a hosted public form or embed the three-step OTP API flow on an external site.
            </MobileText>
          </View>
          <MobileStatusBadge
            status={environment === 'production' ? 'Published' : 'Draft'}
            label={environment === 'production' ? 'Live' : 'Test'}
            tone={environment === 'production' ? 'success' : 'primary'}
          />
        </View>
        <MobileStatusTabs
          tabs={environmentTabs}
          value={environment}
          onChange={(value) => setEnvironment(value === 'production' ? 'production' : 'test')}
        />
      </MobileCard>

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Environment"
            value={environment === 'production' ? 'Live' : 'Test'}
            description={environment === 'production' ? 'app.nane.co.tz' : 'test-app.nane.co.tz'}
            tone={environment === 'production' ? 'green' : 'blue'}
            icon={Globe2}
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Association key"
            value={associationName ? 'Ready' : 'Missing'}
            description={associationName || 'Contact Nane support'}
            tone={associationName ? 'teal' : 'orange'}
            icon={KeyRound}
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Public form"
            value={details.publicRegistrationUrl ? 'Ready' : 'Pending'}
            description="Hosted applicant link"
            tone={details.publicRegistrationUrl ? 'purple' : 'orange'}
            icon={LinkIcon}
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="API flow"
            value="3 steps"
            description="Request, verify, register"
            tone="slate"
            icon={ShieldCheck}
          />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileStatusTabs
        tabs={sectionTabs}
        value={section}
        onChange={(value) => setSection(parseSection(value))}
      />

      {section === 'overview' ? (
        <View style={styles.stack}>
          <MobileFormSection
            title="Association integration key"
            description="Use the exact association name for embedded API registration. If the name changes, external integrations must be updated."
          >
            {associationName ? (
              <>
                <CodeLine label="Association name" value={associationName} onShare={() => void shareValue('Association name', associationName)} />
                <CodeLine label="URL encoded name" value={details.encodedName} onShare={() => void shareValue('URL encoded association name', details.encodedName)} />
              </>
            ) : (
              <MobileToast
                title="Association name unavailable"
                description="The public link can still use the association ID, but embedded API registration needs the exact association name."
                tone="warning"
              />
            )}
          </MobileFormSection>

          <MobileFormSection
            title="Hosted public registration link"
            description="Use this when you only need a public form link. It sends applicants directly to the association member registration form."
          >
            <CodeLine
              label="Public URL"
              value={details.publicRegistrationUrl}
              onShare={() => void shareValue('Public registration URL', details.publicRegistrationUrl)}
            />
            <View style={styles.actions}>
              <MobileButton label="Open link" icon={ExternalLink} onPress={() => void openUrl(details.publicRegistrationUrl)} />
              <MobileButton
                label="Share"
                icon={Share2}
                variant="secondary"
                onPress={() => void shareValue('Public registration URL', details.publicRegistrationUrl)}
              />
            </View>
          </MobileFormSection>

          <MobileCard compact style={styles.noticeCard}>
            <View style={styles.rowStart}>
              <Info color={theme.colors.primary} size={20} strokeWidth={2.4} />
              <View style={styles.flex}>
                <MobileText variant="body" weight="bold">
                  Hosted link vs embedded API
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  Use the hosted link for a quick website button. Use the API flow when the external site owns the registration form UI.
                </MobileText>
              </View>
            </View>
          </MobileCard>
        </View>
      ) : null}

      {section === 'api' ? (
        <View style={styles.stack}>
          <MobileFormSection
            title="API base URL"
            description="These public endpoints do not require an admin token. They are intended for public registration integrations."
          >
            <CodeLine label="Base URL" value={details.apiBase} onShare={() => void shareValue('API base URL', details.apiBase)} />
          </MobileFormSection>

          <ApiStepCard
            step={1}
            title="Request OTP"
            description="Send a one-time SMS code to the applicant phone number."
            endpoint={details.requestOtpEndpoint}
            body={`{
  "mobileNumber": "+255712345678"
}`}
            response={`{
  "data": {
    "pinId": "...",
    "mobileNumber": "+255712345678"
  }
}`}
            onShareEndpoint={() => void shareValue('Request OTP endpoint', details.requestOtpEndpoint)}
          />

          <ApiStepCard
            step={2}
            title="Verify OTP"
            description="Validate the code the applicant received by SMS and save the returned verificationId."
            endpoint={details.verifyOtpEndpoint}
            body={`{
  "pinId": "<from Step 1>",
  "pin": "123456"
}`}
            response={`{
  "data": {
    "verificationId": "..."
  }
}`}
            onShareEndpoint={() => void shareValue('Verify OTP endpoint', details.verifyOtpEndpoint)}
          />

          <ApiStepCard
            step={3}
            title="Register user"
            description="Create the account. The phone number must match the number verified in steps 1 and 2."
            endpoint={details.registerEndpoint}
            body={`{
  "fullName": "Jane Doe",
  "email": "jane@example.com",
  "phoneNumber": "+255712345678",
  "password": "StrongPassword123!"
}`}
            response={`{
  "success": true,
  "message": "Registration completed"
}`}
            onShareEndpoint={() => void shareValue('Register user endpoint', details.registerEndpoint)}
          />

          <MobileFormSection title="After registration" description="Send approved users to Nane login after the account is created.">
            <CodeLine label="Login URL" value={details.loginUrl} onShare={() => void shareValue('Login URL', details.loginUrl)} />
            <MobileButton label="Open login" icon={Smartphone} variant="secondary" onPress={() => void openUrl(details.loginUrl)} />
          </MobileFormSection>
        </View>
      ) : null}

      {section === 'docs' ? (
        <View style={styles.stack}>
          <MobileFormSection
            title="Full API documentation"
            description="Open the complete public-registration reference for request bodies, responses, CORS notes, and error handling."
          >
            <MobileInfoRow label="Selected docs" value={details.docsUrl} icon={BookOpen} status={environment === 'production' ? 'Published' : 'Draft'} />
            <View style={styles.actions}>
              <MobileButton label="Open docs" icon={ExternalLink} onPress={() => void openUrl(details.docsUrl)} />
              <MobileButton label="Share docs" icon={Share2} variant="secondary" onPress={() => void shareValue('Registration API docs', details.docsUrl)} />
            </View>
          </MobileFormSection>

          <MobileFormSection title="Support checklist" description="Send this context to Nane support when connecting an external website.">
            <MobileInfoRow label="Environment" value={environment === 'production' ? 'Production' : 'Test / Sandbox'} icon={Globe2} />
            <MobileInfoRow label="Association" value={associationName || 'Association name unavailable'} icon={KeyRound} status={associationName ? 'Active' : 'Pending'} />
            <MobileInfoRow label="CORS domains" value="Provide each website domain that will call the public registration API." icon={ShieldCheck} />
            <MobileInfoRow label="Name changes" value="Tell support before changing the association name used by external integrations." icon={Info} />
          </MobileFormSection>

          <MobileCard compact accent="blue">
            <View style={styles.rowStart}>
              <CheckCircle2 color={theme.colors.primary} size={22} strokeWidth={2.5} />
              <View style={styles.flex}>
                <MobileText variant="body" weight="bold">
                  Ready for website teams
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  The mobile guide mirrors the web registration integration page and keeps all URLs environment-aware.
                </MobileText>
              </View>
            </View>
          </MobileCard>
        </View>
      ) : null}
    </MobileScreen>
  );
}

function detectEnvironment(): IntegrationEnvironment {
  const baseUrl = mobileEnv.apiBaseUrl.toLowerCase();
  if (baseUrl.includes('test-app.nane.co.tz') || baseUrl.includes(':8787') || baseUrl.includes(':18787')) {
    return 'test';
  }
  return 'production';
}

function parseSection(value?: string | null): IntegrationSection {
  return value === 'api' || value === 'docs' || value === 'overview' ? value : 'overview';
}

function CodeLine({ label, value, onShare }: { label: string; value: string; onShare: () => void }) {
  const theme = useNaneTheme();
  return (
    <View style={[styles.codeLine, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
      <View style={styles.flex}>
        <MobileText variant="tiny" tone="secondary" weight="bold" style={styles.codeLabel}>
          {label}
        </MobileText>
        <MobileText variant="small" weight="bold" selectable style={styles.codeText}>
          {value || 'Not available'}
        </MobileText>
      </View>
      <MobileIconButton icon={Share2} label={`Share ${label}`} variant="secondary" disabled={!value} onPress={onShare} />
    </View>
  );
}

function ApiStepCard({
  step,
  title,
  description,
  endpoint,
  body,
  response,
  onShareEndpoint,
}: {
  step: number;
  title: string;
  description: string;
  endpoint: string;
  body: string;
  response: string;
  onShareEndpoint: () => void;
}) {
  const theme = useNaneTheme();
  return (
    <MobileCard compact style={styles.apiCard}>
      <View style={styles.stepHeader}>
        <View style={[styles.stepBadge, { backgroundColor: theme.colors.primary }]}>
          <MobileText variant="small" weight="bold" tone="inverse">
            {String(step)}
          </MobileText>
        </View>
        <View style={styles.flex}>
          <View style={styles.titleRow}>
            <MobileText variant="body" weight="bold">
              {title}
            </MobileText>
            <MobileStatusBadge status="Published" label="POST" tone="primary" showDot={false} />
          </View>
          <MobileText variant="small" tone="secondary">
            {description}
          </MobileText>
        </View>
      </View>
      <CodeLine label="Endpoint" value={endpoint} onShare={onShareEndpoint} />
      <View style={styles.codeGroup}>
        <CodeBlock title="Body" value={body} />
        <CodeBlock title="Response" value={response} />
      </View>
    </MobileCard>
  );
}

function CodeBlock({ title, value }: { title: string; value: string }) {
  const theme = useNaneTheme();
  return (
    <View style={[styles.codeBlock, { backgroundColor: theme.scheme === 'dark' ? theme.colors.surfaceStrong : '#111827' }]}>
      <MobileText variant="tiny" weight="bold" tone="inverse" style={styles.codeBlockTitle}>
        {title}
      </MobileText>
      <MobileText variant="tiny" tone="inverse" selectable style={styles.codeBlockText}>
        {value}
      </MobileText>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    gap: 14,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  stack: {
    gap: 14,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  noticeCard: {
    gap: 10,
  },
  rowStart: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  codeLine: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  codeLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  codeText: {
    flexWrap: 'wrap',
  },
  apiCard: {
    gap: 12,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepBadge: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  codeGroup: {
    gap: 10,
  },
  codeBlock: {
    borderRadius: 16,
    padding: 13,
    gap: 8,
  },
  codeBlockTitle: {
    textTransform: 'uppercase',
    letterSpacing: 0.35,
    opacity: 0.82,
  },
  codeBlockText: {
    fontFamily: 'Courier',
    lineHeight: 17,
    opacity: 0.94,
  },
});
