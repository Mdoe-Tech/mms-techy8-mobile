import { Image } from 'expo-image';
import { CircleAlert, CircleCheck, Info, ShieldAlert, TriangleAlert, X } from 'lucide-react-native';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type StatusTone, useNaneTheme } from '@/theme/tokens';
import type { MobileErrorDetailsInfo } from '@/utils/mobile-error';
import { MobileButton } from './MobileButton';
import { MobileErrorDetails } from './MobileErrorDetails';
import { MobileSheet } from './MobileSheet';
import { MobileText } from './MobileText';

type MobileFeedbackAction = {
  label: string;
  onPress?: () => void;
};

type MobileFeedbackNotice = {
  id: string;
  kind?: 'session' | 'blocking' | 'toast';
  tone?: StatusTone;
  title: string;
  description: string;
  details?: MobileErrorDetailsInfo;
  primaryAction?: MobileFeedbackAction;
  secondaryAction?: MobileFeedbackAction;
  dismissible?: boolean;
};

export type MobileToastInput = {
  id?: string;
  title: string;
  description?: string;
  tone?: StatusTone;
  durationMs?: number;
};

type MobileToastItem = Required<Pick<MobileToastInput, 'id' | 'title' | 'tone' | 'durationMs'>> & {
  description?: string;
};

export type MobileConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  confirmDisabled?: boolean;
};

type ActiveConfirm = MobileConfirmOptions & {
  id: string;
  resolve: (value: boolean) => void;
};

type MobileToastApi = {
  show: (toast: MobileToastInput) => string;
  success: (toast: Omit<MobileToastInput, 'tone'>) => string;
  error: (toast: Omit<MobileToastInput, 'tone'>) => string;
  warning: (toast: Omit<MobileToastInput, 'tone'>) => string;
  info: (toast: Omit<MobileToastInput, 'tone'>) => string;
  dismiss: (id?: string) => void;
};

type MobileFeedbackContextValue = {
  activeNotice: MobileFeedbackNotice | null;
  toasts: MobileToastItem[];
  activeConfirm: ActiveConfirm | null;
  showFeedback: (notice: MobileFeedbackNotice) => void;
  dismissFeedback: (id?: string) => void;
  toast: MobileToastApi;
  confirm: (options: MobileConfirmOptions) => Promise<boolean>;
  dismissToast: (id?: string) => void;
  resolveConfirm: (confirmed: boolean) => void;
};

const MobileFeedbackContext = createContext<MobileFeedbackContextValue | undefined>(undefined);

export function MobileFeedbackProvider({ children }: { children: ReactNode }) {
  const [activeNotice, setActiveNotice] = useState<MobileFeedbackNotice | null>(null);
  const [toasts, setToasts] = useState<MobileToastItem[]>([]);
  const [activeConfirm, setActiveConfirm] = useState<ActiveConfirm | null>(null);
  const toastTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const showFeedback = useCallback((notice: MobileFeedbackNotice) => {
    setActiveNotice(notice);
  }, []);

  const dismissFeedback = useCallback((id?: string) => {
    setActiveNotice((current) => {
      if (!current) return null;
      if (id && current.id !== id) return current;
      return null;
    });
  }, []);

  const dismissToast = useCallback((id?: string) => {
    if (!id) {
      toastTimersRef.current.forEach((timer) => clearTimeout(timer));
      toastTimersRef.current.clear();
      setToasts([]);
      return;
    }

    const timer = toastTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }

    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: MobileToastInput) => {
      const id = toast.id || createFeedbackId('toast');
      const durationMs = toast.durationMs ?? 4200;
      const nextToast: MobileToastItem = {
        id,
        title: toast.title,
        description: toast.description,
        tone: toast.tone || 'success',
        durationMs,
      };

      setToasts((current) => [nextToast, ...current.filter((item) => item.id !== id)].slice(0, 3));

      const existingTimer = toastTimersRef.current.get(id);
      if (existingTimer) clearTimeout(existingTimer);

      if (durationMs > 0) {
        const timer = setTimeout(() => {
          dismissToast(id);
        }, durationMs);
        toastTimersRef.current.set(id, timer);
      }

      return id;
    },
    [dismissToast],
  );

  const toast = useMemo<MobileToastApi>(
    () => ({
      show: showToast,
      success: (input) => showToast({ ...input, tone: 'success' }),
      error: (input) => showToast({ ...input, tone: 'danger' }),
      warning: (input) => showToast({ ...input, tone: 'warning' }),
      info: (input) => showToast({ ...input, tone: 'info' }),
      dismiss: dismissToast,
    }),
    [dismissToast, showToast],
  );

  const confirm = useCallback((options: MobileConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setActiveConfirm({
        ...options,
        id: createFeedbackId('confirm'),
        resolve,
      });
    });
  }, []);

  const resolveConfirm = useCallback((confirmed: boolean) => {
    setActiveConfirm((current) => {
      current?.resolve(confirmed);
      return null;
    });
  }, []);

  const value = useMemo(
    () => ({
      activeNotice,
      toasts,
      activeConfirm,
      showFeedback,
      dismissFeedback,
      toast,
      confirm,
      dismissToast,
      resolveConfirm,
    }),
    [activeConfirm, activeNotice, confirm, dismissFeedback, dismissToast, resolveConfirm, showFeedback, toast, toasts],
  );

  return <MobileFeedbackContext.Provider value={value}>{children}</MobileFeedbackContext.Provider>;
}

export function useMobileFeedback() {
  const context = useContext(MobileFeedbackContext);
  if (!context) {
    throw new Error('useMobileFeedback must be used inside MobileFeedbackProvider');
  }
  return context;
}

export function MobileFeedbackHost() {
  const { activeConfirm, activeNotice, dismissFeedback, dismissToast, resolveConfirm, toasts } = useMobileFeedback();

  function runAction(action?: MobileFeedbackAction) {
    action?.onPress?.();
    dismissFeedback(activeNotice?.id);
  }

  return (
    <>
      <MobileToastHost toasts={toasts} onDismiss={dismissToast} />
      {activeNotice ? <MobileNoticeModal notice={activeNotice} onDismiss={dismissFeedback} onAction={runAction} /> : null}
      <MobileGlobalConfirmSheet confirm={activeConfirm} onResolve={resolveConfirm} />
    </>
  );
}

function MobileToastHost({ toasts, onDismiss }: { toasts: MobileToastItem[]; onDismiss: (id?: string) => void }) {
  const theme = useNaneTheme();
  if (!toasts.length) return null;

  return (
    <SafeAreaView pointerEvents="box-none" style={styles.toastLayer}>
      <View pointerEvents="box-none" style={styles.toastStack}>
        {toasts.map((toast) => {
          const color = theme.colors.status[toast.tone];
          return (
            <Pressable
              key={toast.id}
              accessibilityRole="alert"
              onPress={() => onDismiss(toast.id)}
              style={[styles.toastCard, { backgroundColor: color, shadowColor: theme.colors.shadow }]}
            >
              <View style={styles.toastIcon}>{renderToastIcon(toast.tone, theme.colors.onPrimary)}</View>
              <View style={styles.toastText}>
                <MobileText variant="small" weight="bold" tone="inverse" numberOfLines={1}>
                  {toast.title}
                </MobileText>
                {toast.description ? (
                  <MobileText variant="tiny" tone="inverse" numberOfLines={2} style={styles.toastDescription}>
                    {toast.description}
                  </MobileText>
                ) : null}
              </View>
              <X color={theme.colors.onPrimary} size={16} strokeWidth={2.5} />
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

function MobileNoticeModal({
  notice,
  onDismiss,
  onAction,
}: {
  notice: MobileFeedbackNotice;
  onDismiss: (id?: string) => void;
  onAction: (action?: MobileFeedbackAction) => void;
}) {
  const theme = useNaneTheme();
  const tone = notice.tone || 'info';
  const color = theme.colors.status[tone];
  const dismissible = notice.dismissible !== false;

  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={() => dismissible && onDismiss(notice.id)}>
      <View style={[styles.overlay, { backgroundColor: theme.colors.overlay }]}>
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, shadowColor: theme.colors.shadow }]}>
          {dismissible ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss message"
              onPress={() => onDismiss(notice.id)}
              style={[styles.closeButton, { borderColor: theme.colors.border }]}
            >
              <X color={theme.colors.textSecondary} size={17} strokeWidth={2.5} />
            </Pressable>
          ) : null}

          <View style={styles.brandRow}>
            <View style={[styles.logoWrap, { borderColor: theme.colors.border }]}>
              <Image source={require('@/assets/images/nane-logo.png')} style={styles.logo} />
            </View>
            <View style={[styles.statusIcon, { backgroundColor: color }]}>
              <ShieldAlert color={theme.colors.onPrimary} size={22} strokeWidth={2.6} />
            </View>
          </View>

          <View style={styles.copy}>
            <MobileText variant="title" weight="bold" style={styles.centerText}>
              {notice.title}
            </MobileText>
            <MobileText variant="body" tone="secondary" style={styles.centerText}>
              {notice.description}
            </MobileText>
          </View>

          {notice.details ? <MobileErrorDetails details={notice.details} /> : null}

          <View style={styles.actions}>
            {notice.primaryAction ? (
              <MobileButton label={notice.primaryAction.label} fullWidth onPress={() => onAction(notice.primaryAction)} />
            ) : null}
            {notice.secondaryAction ? (
              <MobileButton
                label={notice.secondaryAction.label}
                fullWidth
                variant="secondary"
                onPress={() => onAction(notice.secondaryAction)}
              />
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function MobileGlobalConfirmSheet({
  confirm,
  onResolve,
}: {
  confirm: ActiveConfirm | null;
  onResolve: (confirmed: boolean) => void;
}) {
  return (
    <MobileSheet visible={Boolean(confirm)} title={confirm?.title || 'Confirm action'} onClose={() => onResolve(false)}>
      <MobileText variant="body" tone="secondary">
        {confirm?.description || ''}
      </MobileText>
      <View style={styles.confirmActions}>
        <MobileButton label={confirm?.cancelLabel || 'Cancel'} variant="secondary" onPress={() => onResolve(false)} />
        <MobileButton
          label={confirm?.confirmLabel || 'Confirm'}
          variant={confirm?.destructive ? 'danger' : 'primary'}
          fullWidth
          disabled={confirm?.confirmDisabled}
          onPress={() => onResolve(true)}
          style={styles.confirmButton}
        />
      </View>
    </MobileSheet>
  );
}

function renderToastIcon(tone: StatusTone, color: string) {
  if (tone === 'success' || tone === 'paid') return <CircleCheck color={color} size={20} strokeWidth={2.5} />;
  if (tone === 'warning') return <TriangleAlert color={color} size={20} strokeWidth={2.5} />;
  if (tone === 'danger') return <CircleAlert color={color} size={20} strokeWidth={2.5} />;
  return <Info color={color} size={20} strokeWidth={2.5} />;
}

function createFeedbackId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  card: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 20,
    gap: 16,
    shadowOpacity: 0.22,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 16 },
    elevation: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  brandRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
  },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 25,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  logo: {
    width: 60,
    height: 60,
  },
  statusIcon: {
    position: 'absolute',
    right: '34%',
    bottom: -6,
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    gap: 8,
  },
  centerText: {
    textAlign: 'center',
  },
  actions: {
    gap: 10,
  },
  toastLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
  },
  toastStack: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  toastCard: {
    minHeight: 58,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
    elevation: 8,
  },
  toastIcon: {
    width: 24,
    alignItems: 'center',
  },
  toastText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  toastDescription: {
    opacity: 0.92,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmButton: {
    flex: 1,
  },
});
