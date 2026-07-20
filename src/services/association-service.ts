import { apiBinaryRequest, apiRequest } from '@/api/client';

export type AssociationProfile = {
  id: string;
  type?: string | null;
  name?: string | null;
  address?: string | null;
  email?: string | null;
  telephone?: string | null;
  registrationNumber?: string | null;
  registrationDate?: string | null;
  tin?: string | null;
  vrn?: string | null;
  businessLicensePath?: string | null;
  certificateOfIncorporationPath?: string | null;
  logoPath?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  schemaName?: string | null;
  settings?: Record<string, unknown> | null;
  version?: number | null;
  accountStatus?: string | null;
  accountStatusReason?: string | null;
  accountStatusUpdatedAt?: string | null;
  accountStatusUpdatedBy?: string | null;
};

export type AssociationProfileUploadFile = {
  uri: string;
  name: string;
  mimeType?: string | null;
};

export type AssociationProfileUpdatePayload = {
  name: string;
  address: string;
  email: string;
  telephoneNumber: string;
  tin: string;
  vrn: string;
  businessLicense?: AssociationProfileUploadFile | null;
  certificateOfIncorporation?: AssociationProfileUploadFile | null;
  logo?: AssociationProfileUploadFile | null;
};

export type AssociationCreateWithAdminPayload = {
  name: string;
  type: 'GENERIC' | 'VIKOBA' | 'SACCOS' | 'UNION';
  address: string;
  email: string;
  telephoneNumber: string;
  dateOfRegistration: string;
  tin?: string;
  vrn?: string;
  registrationNumber?: string;
  adminFullName: string;
  adminEmail: string;
  adminPassword: string;
  adminPhoneNumber: string;
  businessLicense?: AssociationProfileUploadFile | null;
  certificateOfIncorporation?: AssociationProfileUploadFile | null;
  logo?: AssociationProfileUploadFile | null;
};

export type MyAssociation = {
  id: string;
  displayName: string;
  schemaName?: string | null;
  role?: string | null;
  isDefault: boolean;
  status?: string | null;
};

export type AssociationDashboardSummary = {
  activeMembers: number;
  totalRevenue: number;
  totalExpenses: number;
  netBalance: number;
  totalShares: {
    shareCount: number;
    totalShareValue: number;
  };
  overdueSummary: Record<string, number>;
};

export type AssociationDashboardContributions = {
  paidContributions: number;
  pendingContributions: number;
  overdueContributions: number;
  totalContributions: number;
};

export type AssociationDashboardFines = {
  paidFines: number;
  pendingFines: number;
  overdueFines: number;
  totalFines: number;
};

export type AssociationDashboardLoans = {
  activeLoans: number;
  overdueLoans: number;
  totalLoans: number;
  totalRemainingBalance: number;
};

export type AssociationDashboard = {
  associationId: string;
  summaryStats: AssociationDashboardSummary;
  contributions: AssociationDashboardContributions;
  fines: AssociationDashboardFines;
  loans: AssociationDashboardLoans;
};

export type AllAssociationDashboardItem = {
  associationId: string;
  associationName: string;
  schema?: string | null;
  dashboard: AssociationDashboard;
};

export type AssociationConfig = {
  id?: string | null;
  associationId?: string | null;
  settings?: Record<string, unknown> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  version?: number | null;
};

export async function getAssociationProfile(associationId: string) {
  const profile = await apiRequest<AssociationProfile>(`/associations/${encodeURIComponent(associationId)}`);
  return normalizeAssociationProfile(profile);
}

export function getAssociationConfig(associationId: string) {
  return apiRequest<AssociationConfig>(`/associations/${encodeURIComponent(associationId)}/config`);
}

export function getPublicAssociationConfig(associationId: string) {
  return apiRequest<AssociationConfig>(`/associations/${encodeURIComponent(associationId)}/config/public`);
}

export function updateAssociationConfig(associationId: string, settings: Record<string, unknown>) {
  return apiRequest<Record<string, unknown>>(`/associations/${encodeURIComponent(associationId)}/config`, {
    method: 'PUT',
    body: settings,
  });
}

export async function getMyAssociations() {
  const rows = await apiRequest<Record<string, unknown>[]>('/me/associations');
  return rows.map(normalizeMyAssociation).filter((association) => Boolean(association.id));
}

export async function getAllAssociationsDashboard() {
  const rows = await apiRequest<Record<string, unknown>[]>('/me/dashboard', {
    headers: { 'x-bypass-cache': '1' },
  });
  return rows.map(normalizeAllAssociationDashboardItem).filter((item) => Boolean(item.associationId));
}

export async function updateAssociationProfile(payload: AssociationProfileUpdatePayload) {
  const formData = new FormData();
  if (payload.name.trim()) formData.append('name', payload.name.trim());
  if (payload.address.trim()) formData.append('address', payload.address.trim());
  if (payload.email.trim()) formData.append('email', payload.email.trim());
  if (payload.telephoneNumber.trim()) formData.append('telephoneNumber', payload.telephoneNumber.trim());
  formData.append('tin', payload.tin.trim());
  formData.append('vrn', payload.vrn.trim());
  appendUploadFile(formData, 'businessLicense', payload.businessLicense);
  appendUploadFile(formData, 'certificateOfIncorporation', payload.certificateOfIncorporation);
  appendUploadFile(formData, 'logo', payload.logo);

  const profile = await apiRequest<AssociationProfile>('/associations/profile', {
    method: 'PUT',
    body: formData,
  });
  return normalizeAssociationProfile(profile);
}

export async function createAssociationWithAdmin(payload: AssociationCreateWithAdminPayload) {
  const formData = new FormData();
  formData.append('name', payload.name.trim());
  formData.append('type', payload.type);
  formData.append('address', payload.address.trim());
  formData.append('email', payload.email.trim().toLowerCase());
  formData.append('telephoneNumber', payload.telephoneNumber.trim());
  formData.append('dateOfRegistration', payload.dateOfRegistration.trim());
  if (payload.tin?.trim()) formData.append('tin', payload.tin.trim());
  if (payload.vrn?.trim()) formData.append('vrn', payload.vrn.trim());
  if (payload.registrationNumber?.trim()) formData.append('registrationNumber', payload.registrationNumber.trim());
  formData.append('adminFullName', payload.adminFullName.trim());
  formData.append('adminEmail', payload.adminEmail.trim().toLowerCase());
  formData.append('adminPassword', payload.adminPassword);
  formData.append('adminPhoneNumber', payload.adminPhoneNumber.trim());
  formData.append('associationRole', 'ADMIN');
  formData.append('systemRole', 'ASSOCIATION_ADMIN');
  appendUploadFile(formData, 'businessLicense', payload.businessLicense);
  appendUploadFile(formData, 'certificateOfIncorporation', payload.certificateOfIncorporation);
  appendUploadFile(formData, 'logo', payload.logo);

  const profile = await apiRequest<AssociationProfile>('/associations', {
    method: 'POST',
    body: formData,
  });
  return normalizeAssociationProfile(profile);
}

export async function downloadAssociationFile(filePath: string, disposition: 'inline' | 'attachment' = 'attachment') {
  const query = new URLSearchParams({ filePath, disposition });
  const response = await apiBinaryRequest(`/files/download?${query.toString()}`);
  return {
    data: response.data,
    filename: filePath.split('/').pop() || 'association-file',
    contentType: response.headers.get('content-type') || 'application/octet-stream',
  };
}

function normalizeMyAssociation(row: Record<string, unknown>): MyAssociation {
  return {
    id: String(row.id || ''),
    displayName: String(row.display_name || row.displayName || 'Unnamed association'),
    schemaName: typeof row.schema_name === 'string' ? row.schema_name : typeof row.schemaName === 'string' ? row.schemaName : null,
    role: typeof row.role === 'string' ? row.role : null,
    isDefault: Boolean(row.is_default ?? row.isDefault),
    status: typeof row.status === 'string' ? row.status : null,
  };
}

function normalizeAllAssociationDashboardItem(row: Record<string, unknown>): AllAssociationDashboardItem {
  const dashboard = toRecord(row.dashboard);
  const summaryStats = toRecord(dashboard.summaryStats);
  const contributions = toRecord(dashboard.contributions);
  const fines = toRecord(dashboard.fines);
  const loans = toRecord(dashboard.loans);
  const totalShares = toRecord(summaryStats.totalShares);

  return {
    associationId: String(row.associationId || dashboard.associationId || ''),
    associationName: String(row.associationName || 'Unnamed association'),
    schema: typeof row.schema === 'string' ? row.schema : null,
    dashboard: {
      associationId: String(dashboard.associationId || row.associationId || ''),
      summaryStats: {
        activeMembers: toNumber(summaryStats.activeMembers),
        totalRevenue: toNumber(summaryStats.totalRevenue),
        totalExpenses: toNumber(summaryStats.totalExpenses),
        netBalance: toNumber(summaryStats.netBalance),
        totalShares: {
          shareCount: toNumber(totalShares.shareCount),
          totalShareValue: toNumber(totalShares.totalShareValue),
        },
        overdueSummary: normalizeNumberRecord(summaryStats.overdueSummary),
      },
      contributions: {
        paidContributions: toNumber(contributions.paidContributions),
        pendingContributions: toNumber(contributions.pendingContributions),
        overdueContributions: toNumber(contributions.overdueContributions),
        totalContributions: toNumber(contributions.totalContributions),
      },
      fines: {
        paidFines: toNumber(fines.paidFines),
        pendingFines: toNumber(fines.pendingFines),
        overdueFines: toNumber(fines.overdueFines),
        totalFines: toNumber(fines.totalFines),
      },
      loans: {
        activeLoans: toNumber(loans.activeLoans),
        overdueLoans: toNumber(loans.overdueLoans),
        totalLoans: toNumber(loans.totalLoans),
        totalRemainingBalance: toNumber(loans.totalRemainingBalance),
      },
    },
  };
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toNumber(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function normalizeNumberRecord(value: unknown) {
  const record = toRecord(value);
  return Object.fromEntries(Object.entries(record).map(([key, nextValue]) => [key, toNumber(nextValue)]));
}

function appendUploadFile(formData: FormData, fieldName: string, file?: AssociationProfileUploadFile | null) {
  if (!file) return;
  formData.append(fieldName, {
    uri: file.uri,
    name: file.name,
    type: file.mimeType || 'application/octet-stream',
  } as unknown as Blob);
}

function normalizeAssociationProfile(profile: Partial<AssociationProfile> | null | undefined): AssociationProfile {
  return {
    id: String(profile?.id || ''),
    type: profile?.type || null,
    name: profile?.name || null,
    address: profile?.address || null,
    email: profile?.email || null,
    telephone: profile?.telephone || null,
    registrationNumber: profile?.registrationNumber || null,
    registrationDate: profile?.registrationDate || null,
    tin: profile?.tin || null,
    vrn: profile?.vrn || null,
    businessLicensePath: profile?.businessLicensePath || null,
    certificateOfIncorporationPath: profile?.certificateOfIncorporationPath || null,
    logoPath: profile?.logoPath || null,
    createdAt: profile?.createdAt || null,
    updatedAt: profile?.updatedAt || null,
    schemaName: profile?.schemaName || null,
    settings: profile?.settings || null,
    version: profile?.version ?? null,
    accountStatus: profile?.accountStatus || null,
    accountStatusReason: profile?.accountStatusReason || null,
    accountStatusUpdatedAt: profile?.accountStatusUpdatedAt || null,
    accountStatusUpdatedBy: profile?.accountStatusUpdatedBy || null,
  };
}
