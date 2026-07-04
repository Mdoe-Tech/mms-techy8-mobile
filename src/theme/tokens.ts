import { useColorScheme } from 'react-native';

export type NaneColorScheme = 'light' | 'dark';

export type StatusTone =
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'review'
  | 'neutral'
  | 'paid';

export type KpiTone =
  | 'blue'
  | 'green'
  | 'teal'
  | 'orange'
  | 'red'
  | 'purple'
  | 'slate';

const shared = {
  spacing: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 32,
    8: 40,
  },
  radius: {
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
    full: 999,
  },
  typography: {
    familyRegular: 'Quicksand_500Medium',
    familySemiBold: 'Quicksand_600SemiBold',
    familyBold: 'Quicksand_700Bold',
    title: 25,
    section: 18,
    body: 15,
    small: 13,
    tiny: 12,
    value: 28,
  },
} as const;

export const naneThemes = {
  light: {
    scheme: 'light',
    colors: {
      background: '#FFFFFF',
      surface: '#FFFFFF',
      surfaceMuted: '#F8FAFC',
      surfaceStrong: '#EFF6FF',
      text: '#111827',
      textSecondary: '#475569',
      textMuted: '#64748B',
      border: '#E5E7EB',
      borderStrong: '#CBD5E1',
      primary: '#2563EB',
      primaryDark: '#1E3A8A',
      primaryPressed: '#1D4ED8',
      onPrimary: '#FFFFFF',
      shadow: '#0F172A',
      overlay: 'rgba(15, 23, 42, 0.42)',
      input: '#FFFFFF',
      disabled: '#F3F4F6',
      skeleton: '#E5E7EB',
      status: {
        primary: '#2563EB',
        success: '#15803D',
        warning: '#C2410C',
        danger: '#B91C1C',
        info: '#0E7490',
        review: '#7E22CE',
        neutral: '#475569',
        paid: '#0F766E',
      },
      kpi: {
        blue: '#2563EB',
        green: '#15803D',
        teal: '#0F766E',
        orange: '#C2410C',
        red: '#B91C1C',
        purple: '#7E22CE',
        slate: '#475569',
      },
    },
    ...shared,
  },
  dark: {
    scheme: 'dark',
    colors: {
      background: '#0F172A',
      surface: '#141F33',
      surfaceMuted: '#17233A',
      surfaceStrong: '#1E293B',
      text: '#F8FAFC',
      textSecondary: '#CBD5E1',
      textMuted: '#94A3B8',
      border: '#1E293B',
      borderStrong: '#334155',
      primary: '#60A5FA',
      primaryDark: '#1E40AF',
      primaryPressed: '#3B82F6',
      onPrimary: '#FFFFFF',
      shadow: '#020617',
      overlay: 'rgba(2, 6, 23, 0.72)',
      input: '#111C2F',
      disabled: '#1E293B',
      skeleton: '#263449',
      status: {
        primary: '#3B82F6',
        success: '#16A34A',
        warning: '#EA580C',
        danger: '#DC2626',
        info: '#0891B2',
        review: '#9333EA',
        neutral: '#64748B',
        paid: '#0D9488',
      },
      kpi: {
        blue: '#60A5FA',
        green: '#22C55E',
        teal: '#14B8A6',
        orange: '#F97316',
        red: '#EF4444',
        purple: '#A855F7',
        slate: '#94A3B8',
      },
    },
    ...shared,
  },
} as const;

export type NaneTheme = typeof naneThemes.light | typeof naneThemes.dark;

export function useNaneTheme(): NaneTheme {
  const scheme = useColorScheme();
  return naneThemes[scheme === 'dark' ? 'dark' : 'light'];
}

export function getReadableTextColor(background: string) {
  const hex = background.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? '#111827' : '#FFFFFF';
}

export function statusToneFor(status?: string | null): StatusTone {
  const normalized = String(status || 'unknown').trim().replace(/[_\s]+/g, ' ').toLowerCase();

  if (['paid'].includes(normalized)) return 'paid';
  if (['active', 'approved', 'completed', 'complete', 'delivered', 'read', 'verified', 'present'].includes(normalized)) return 'success';
  if (['pending', 'processing', 'queued', 'unpaid', 'due', 'partial'].includes(normalized)) return 'warning';
  if (['failed', 'rejected', 'overdue', 'defaulted', 'cancelled', 'canceled', 'suspended', 'absent'].includes(normalized)) return 'danger';
  if (['review', 'under review', 'draft'].includes(normalized)) return 'review';
  if (['sent', 'published', 'issued', 'disbursed'].includes(normalized)) return 'info';
  return 'neutral';
}

export function labelFromStatus(status?: string | null) {
  return String(status || 'Unknown')
    .trim()
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}
