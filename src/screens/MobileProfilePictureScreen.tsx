import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
  Camera,
  CheckCircle2,
  FileImage,
  ImageIcon,
  Info,
  Mail,
  RefreshCw,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileConfirmSheet,
  MobileDataList,
  type MobileDataListItem,
  MobileEmptyState,
  MobileErrorState,
  MobileFileUpload,
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
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  downloadProfilePicture,
  getCurrentProfilePicture,
  uploadProfilePicture,
  type ProfilePictureUploadFile,
} from '@/services/profile-picture-service';
import { useNaneTheme } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';

type ProfilePictureTab = 'overview' | 'upload' | 'usage';

type LocalImageFile = ProfilePictureUploadFile & {
  size?: number | null;
};

type MobileProfilePictureScreenProps = {
  initialTab?: ProfilePictureTab;
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const usageItems: MobileDataListItem[] = [
  {
    id: 'transactional-email',
    title: 'Transactional emails',
    subtitle: 'Appears beside Nane sender identity in system email previews.',
    meta: 'Shared email identity',
    status: 'Active',
    statusTone: 'success',
    accent: 'primary',
  },
  {
    id: 'campaigns',
    title: 'Campaign and member notices',
    subtitle: 'Used as the central visual identity for communications.',
    meta: 'CRM and notifications',
    status: 'Shared',
    statusTone: 'info',
    accent: 'info',
  },
  {
    id: 'system-preview',
    title: 'System preview cards',
    subtitle: 'Keeps sender branding consistent across admin screens.',
    meta: 'Global setting',
    status: 'Global',
    statusTone: 'review',
    accent: 'review',
  },
];

export default function MobileProfilePictureScreen({ initialTab = 'overview' }: MobileProfilePictureScreenProps) {
  const theme = useNaneTheme();
  const { activeView, user } = useAuth();
  const [tab, setTab] = useState<ProfilePictureTab>(initialTab);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [cachedImageUri, setCachedImageUri] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<LocalImageFile | null>(null);
  const [selectedPreviewUri, setSelectedPreviewUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmUploadOpen, setConfirmUploadOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ title: string; description?: string; tone?: 'success' | 'warning' | 'danger' | 'info' } | null>(null);

  const canUpload = useMemo(() => hasPlatformProfilePicturePermission(user), [user]);
  const canOpenRoute = activeView === 'ADMIN' || activeView === 'SYSTEM_ADMIN' || canUpload;
  const previewUri = selectedPreviewUri || cachedImageUri;
  const currentFileName = currentUrl ? fileNameFromUrl(currentUrl) : null;
  const selectedFormat = selectedFile?.mimeType ? selectedFile.mimeType.split('/').pop()?.toUpperCase() : null;

  const tabs = useMemo(
    () => [
      { value: 'overview', label: 'Overview', count: currentUrl ? 1 : 0 },
      { value: 'upload', label: 'Upload', count: selectedFile ? 1 : 0 },
      { value: 'usage', label: 'Usage', count: usageItems.length },
    ],
    [currentUrl, selectedFile],
  );

  const loadCurrentPicture = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    setError(null);
    setPreviewError(null);
    if (mode === 'refresh') setNotice(null);

    try {
      const nextUrl = await getCurrentProfilePicture();
      setCurrentUrl(nextUrl);
      setCachedImageUri(null);
      if (nextUrl) {
        try {
          const image = await downloadProfilePicture(nextUrl);
          const fileUri = await writeImageToCache(image.data, nextUrl, image.contentType);
          setCachedImageUri(fileUri);
        } catch (downloadError) {
          setPreviewError(getApiErrorMessage(downloadError));
        }
      }
      if (mode === 'refresh') {
        setNotice({ title: 'Profile picture refreshed.', tone: 'success' });
      }
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
      if (mode === 'initial') {
        setCurrentUrl(null);
        setCachedImageUri(null);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (active) await loadCurrentPicture();
    });
    return () => {
      active = false;
    };
  }, [loadCurrentPicture]);

  const pickImage = async () => {
    setNotice(null);
    setError(null);
    if (!canUpload) {
      setNotice({
        title: 'Upload is restricted.',
        description: 'Only platform administrators can replace the system email image.',
        tone: 'warning',
      });
      return;
    }

    const picked = await DocumentPicker.getDocumentAsync({
      type: 'image/*',
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (picked.canceled || !picked.assets?.length) return;

    const asset = picked.assets[0];
    const mimeType = asset.mimeType || guessImageMimeType(asset.name);
    if (!mimeType.startsWith('image/')) {
      setNotice({
        title: 'Invalid image type.',
        description: 'Choose a JPEG, PNG, or other image file.',
        tone: 'danger',
      });
      return;
    }
    if (typeof asset.size === 'number' && asset.size > MAX_IMAGE_BYTES) {
      setNotice({
        title: 'Image is too large.',
        description: 'Choose an image smaller than 5 MB.',
        tone: 'danger',
      });
      return;
    }

    setSelectedFile({
      uri: asset.uri,
      name: asset.name || `profile-picture-${Date.now()}.jpg`,
      mimeType,
      size: asset.size ?? null,
    });
    setSelectedPreviewUri(asset.uri);
    setTab('upload');
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setSelectedPreviewUri(null);
    setNotice(null);
  };

  const submitUpload = async () => {
    if (!selectedFile) {
      setNotice({
        title: 'Choose an image first.',
        description: 'Select a square JPEG or PNG before uploading.',
        tone: 'warning',
      });
      return;
    }
    if (!canUpload) {
      setNotice({
        title: 'Upload is restricted.',
        description: 'This account can view the current image but cannot replace it.',
        tone: 'warning',
      });
      return;
    }
    setConfirmUploadOpen(true);
  };

  const confirmUpload = async () => {
    if (!selectedFile) return;
    setConfirmUploadOpen(false);
    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      const uploadedUrl = await uploadProfilePicture(selectedFile);
      setCurrentUrl(uploadedUrl);
      setCachedImageUri(selectedPreviewUri);
      setSelectedFile(null);
      setSelectedPreviewUri(null);
      setNotice({
        title: 'Profile picture uploaded.',
        description: 'Nane email previews will use the new image.',
        tone: 'success',
      });
      await loadCurrentPicture('refresh');
    } catch (uploadError) {
      setNotice({
        title: 'Upload failed.',
        description: getApiErrorMessage(uploadError),
        tone: 'danger',
      });
    } finally {
      setUploading(false);
    }
  };

  if (!canOpenRoute) {
    return (
      <AccessDeniedScreen
        title="Profile picture unavailable"
        description="This settings route is available to association administrators and platform administrators."
      />
    );
  }

  if (loading) {
    return <MobilePageLoadingState message="Loading profile picture" kind="detail" />;
  }

  if (error && !currentUrl) {
    return (
      <MobileScreen>
        <MobilePageHeader
          title="System profile picture"
          eyebrow="Settings"
          subtitle="Email image used by Nane communications"
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry" variant="secondary" onPress={() => loadCurrentPicture('refresh')} />}
        />
        <MobileErrorState title="Could not load profile picture" description={error} onRetry={() => loadCurrentPicture('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        title="System profile picture"
        eyebrow="Settings"
        subtitle="Email image used by Nane communications"
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh" variant="secondary" disabled={refreshing} onPress={() => loadCurrentPicture('refresh')} />}
      />

      {notice ? <MobileToast title={notice.title} description={notice.description} tone={notice.tone} /> : null}
      {previewError ? (
        <MobileToast
          title="Preview could not be cached."
          description="The current URL is still loaded, but the image file could not be rendered locally."
          tone="warning"
        />
      ) : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Profile status"
            value={currentUrl ? 'Active' : 'Not set'}
            description={currentUrl ? 'Current image loaded' : 'No server image'}
            tone={currentUrl ? 'green' : 'slate'}
            icon={currentUrl ? CheckCircle2 : ImageIcon}
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Upload access"
            value={canUpload ? 'Platform' : 'Read only'}
            description={canUpload ? 'Upload enabled' : 'Association view'}
            tone={canUpload ? 'blue' : 'orange'}
            icon={ShieldCheck}
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Selected file"
            value={selectedFile ? formatBytes(selectedFile.size) : 'None'}
            description={selectedFormat || 'Choose image'}
            tone={selectedFile ? 'purple' : 'slate'}
            icon={FileImage}
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Upload limit"
            value="5 MB"
            description="Image files only"
            tone="teal"
            icon={UploadCloud}
          />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileStatusTabs tabs={tabs} value={tab} onChange={(value) => setTab(value as ProfilePictureTab)} />

      {tab === 'overview' ? (
        <>
          <MobileCard style={styles.heroCard}>
            <View style={styles.heroRow}>
              <View style={[styles.previewFrame, { borderColor: currentUrl ? theme.colors.primary : theme.colors.borderStrong }]}>
                {previewUri ? (
                  <Image source={{ uri: previewUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <View style={[styles.previewPlaceholder, { backgroundColor: theme.colors.primary }]}>
                    <Camera color={theme.colors.onPrimary} size={34} strokeWidth={2.4} />
                  </View>
                )}
              </View>
              <View style={styles.heroCopy}>
                <View style={styles.statusRow}>
                  <MobileStatusBadge status={currentUrl ? 'Active' : 'Pending'} tone={currentUrl ? 'success' : 'warning'} />
                  <MobileStatusBadge status={canUpload ? 'Platform admin' : 'Read only'} tone={canUpload ? 'primary' : 'warning'} />
                </View>
                <MobileText variant="section" weight="bold">
                  {currentUrl ? 'Current email image is configured' : 'No email image is configured'}
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  {currentUrl
                    ? 'This image is used as the system identity in email and communication previews.'
                    : 'Nane will continue using the default sender identity until a platform administrator uploads an image.'}
                </MobileText>
              </View>
            </View>
          </MobileCard>

          <MobileFormSection title="Current source" description="Backend-supported image URL and access state.">
            <MobileInfoRow label="File" value={currentFileName || 'No profile picture'} helper={currentUrl || 'No URL returned by the server.'} icon={FileImage} status={currentUrl ? 'Active' : 'Pending'} />
            <MobileInfoRow
              label="Access"
              value={canUpload ? 'Platform administrator' : 'Association administrator'}
              helper={canUpload ? 'This session can replace the global image.' : 'This session can inspect the image but cannot replace it.'}
              icon={ShieldCheck}
              status={canUpload ? 'Approved' : 'Read only'}
            />
          </MobileFormSection>
        </>
      ) : null}

      {tab === 'upload' ? (
        <>
          <MobileFormSection
            title="Upload image"
            description={canUpload ? 'Choose a clear square image that represents Nane communications.' : 'Upload is hidden behind platform-admin authority on the backend.'}
          >
            <MobileFileUpload
              title={selectedFile ? selectedFile.name : canUpload ? 'Choose image' : 'Platform admin required'}
              description={selectedFile ? `${formatBytes(selectedFile.size)} · ${selectedFile.mimeType || 'image file'}` : 'JPEG, PNG, or other image file up to 5 MB.'}
              onPress={canUpload ? pickImage : undefined}
            />

            {selectedFile ? (
              <MobileCard compact style={styles.selectedCard}>
                <MobileInfoRow label="Selected file" value={selectedFile.name} helper={selectedFile.mimeType || 'Image file'} icon={FileImage} status="Selected" />
                <MobileInfoRow label="Size" value={formatBytes(selectedFile.size)} helper="Maximum accepted size is 5 MB." icon={Info} />
              </MobileCard>
            ) : null}

            {!canUpload ? (
              <MobileToast
                title="Read-only in association workspace"
                description="The backend only accepts profile-picture uploads from PLATFORM_ADMIN authority."
                tone="warning"
              />
            ) : null}

            <View style={styles.actions}>
              {selectedFile ? <MobileButton label="Clear" variant="secondary" onPress={clearSelection} /> : null}
              <MobileButton
                label="Upload profile picture"
                icon={UploadCloud}
                loading={uploading}
                disabled={!selectedFile || !canUpload}
                fullWidth
                onPress={submitUpload}
                style={styles.primaryAction}
              />
            </View>
          </MobileFormSection>

          <MobileCard compact>
            <MobileInfoRow label="Recommended shape" value="Square image" helper="Use at least 200 by 200 pixels so it remains sharp in email previews." icon={ImageIcon} />
            <MobileInfoRow label="Supported files" value="Image formats" helper="JPEG and PNG are safest for email rendering." icon={FileImage} />
            <MobileInfoRow label="Replacement behavior" value="Global update" helper="A successful upload replaces the current image used by all system communications." icon={Mail} />
          </MobileCard>
        </>
      ) : null}

      {tab === 'usage' ? (
        <>
          <MobileCard compact style={styles.emailPreview}>
            <View style={styles.emailHeader}>
              <View style={[styles.emailAvatar, { backgroundColor: theme.colors.primary }]}>
                {previewUri ? (
                  <Image source={{ uri: previewUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <Mail color={theme.colors.onPrimary} size={21} strokeWidth={2.5} />
                )}
              </View>
              <View style={styles.emailCopy}>
                <MobileText variant="small" weight="bold">
                  Nane System
                </MobileText>
                <MobileText variant="tiny" tone="secondary" numberOfLines={1}>
                  notifications@nane.co.tz
                </MobileText>
              </View>
              <MobileStatusBadge status={currentUrl ? 'Configured' : 'Default'} tone={currentUrl ? 'success' : 'neutral'} />
            </View>
            <MobileText variant="body" weight="bold">
              Member notification preview
            </MobileText>
            <MobileText variant="small" tone="secondary">
              The profile picture sits beside the sender identity so members can recognize official Nane communication quickly.
            </MobileText>
          </MobileCard>

          {currentUrl ? (
            <MobileDataList items={usageItems} showChevron={false} />
          ) : (
            <MobileEmptyState
              title="Default sender image is still in use"
              description="Upload a platform-approved profile image to activate branded communication previews."
            />
          )}
        </>
      ) : null}

      <MobileConfirmSheet
        visible={confirmUploadOpen}
        title="Replace system profile picture?"
        description="This updates the image used by Nane email and communication previews. Continue only if the selected image is approved for global use."
        confirmLabel="Upload image"
        onCancel={() => setConfirmUploadOpen(false)}
        onConfirm={confirmUpload}
      />
    </MobileScreen>
  );
}

function hasPlatformProfilePicturePermission(user: { permissions?: string[]; roles?: string[]; systemRole?: string; associationRole?: string; isTechy8Admin?: boolean } | null) {
  if (user?.isTechy8Admin) return true;
  const values = [...(user?.permissions || []), ...(user?.roles || []), user?.systemRole || '', user?.associationRole || ''].map((value) =>
    String(value || '')
      .trim()
      .replace(/[.\s-]+/g, '_')
      .toUpperCase(),
  );
  return values.includes('PLATFORM_ADMIN');
}

function fileNameFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.pathname.split('/').filter(Boolean).pop() || 'profile-picture';
  } catch {
    return url.split('/').filter(Boolean).pop() || 'profile-picture';
  }
}

function guessImageMimeType(name?: string | null) {
  const lower = String(name || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

function extensionFor(contentType: string, url: string) {
  const type = contentType.toLowerCase();
  if (type.includes('png')) return 'png';
  if (type.includes('webp')) return 'webp';
  if (type.includes('gif')) return 'gif';
  const filename = fileNameFromUrl(url).toLowerCase();
  const match = filename.match(/\.([a-z0-9]+)$/);
  return match?.[1] || 'jpg';
}

async function writeImageToCache(buffer: ArrayBuffer, sourceUrl: string, contentType: string) {
  const root = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!root) throw new Error('This device cannot cache the profile image.');
  const fileUri = `${root}profile-picture-${Date.now()}.${extensionFor(contentType, sourceUrl)}`;
  await FileSystem.writeAsStringAsync(fileUri, arrayBufferToBase64(buffer), {
    encoding: FileSystem.EncodingType.Base64,
  });
  return fileUri;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  if (typeof globalThis.btoa !== 'function') {
    throw new Error('This device cannot render the downloaded image.');
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return globalThis.btoa(binary);
}

function formatBytes(bytes?: number | null) {
  if (!bytes || bytes <= 0) return 'N/A';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  heroCard: {
    gap: 14,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  previewFrame: {
    width: 92,
    height: 92,
    borderRadius: 32,
    borderWidth: 2,
    overflow: 'hidden',
  },
  previewPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
    gap: 7,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  selectedCard: {
    gap: 0,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  primaryAction: {
    flex: 1,
  },
  emailPreview: {
    gap: 12,
  },
  emailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emailAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});
