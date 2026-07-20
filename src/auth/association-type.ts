import type { SupportedAssociationType } from '@/navigation/route-registry';

export function normalizeAssociationType(value?: string | null): SupportedAssociationType | null {
  const compact = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');

  if (!compact) return null;
  if (compact === 'GENERIC' || compact === 'GENERAL') return 'GENERIC';
  if (compact === 'UNION') return 'UNION';
  if (['VIKOBA', 'VICOBA', 'KIKOBA', 'KICOBA', 'VIKOBAS'].includes(compact)) {
    return 'VIKOBA';
  }
  if (['SACCO', 'SACCOS', 'SACCOOS'].includes(compact)) return 'SACCOS';

  return null;
}

export function isVikobaAssociation(value?: string | null) {
  return normalizeAssociationType(value) === 'VIKOBA';
}

export function isSaccosAssociation(value?: string | null) {
  return normalizeAssociationType(value) === 'SACCOS';
}

export function isGenericAssociation(value?: string | null) {
  return normalizeAssociationType(value) === 'GENERIC';
}

export function isUnionAssociation(value?: string | null) {
  return normalizeAssociationType(value) === 'UNION';
}
