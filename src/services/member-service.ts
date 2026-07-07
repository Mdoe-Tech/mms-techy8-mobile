import { apiRequest } from '@/api/client';

export type PageResponse<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first?: boolean;
  last?: boolean;
};

export type MemberContactInfo = {
  physicalAddress?: string | null;
  postalAddress?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  website?: string | null;
};

export type AssociationMember = {
  id: string;
  memberType?: string | null;
  membershipNumber?: string | null;
  employeeId?: string | null;
  fullLegalName?: string | null;
  contactInfo?: MemberContactInfo | null;
  associationId?: string | null;
  associationName?: string | null;
  packageId?: string | null;
  packageName?: string | null;
  userId?: string | null;
  associationRole?: string | null;
  systemRole?: string | null;
  status?: string | null;
  registrationType?: string | null;
  registrationProgress?: number | null;
  termsAccepted?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  firstRegistrationDate?: string | null;
  dateOfBirth?: string | null;
  customAttributes?: Record<string, unknown> | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  bankBranch?: string | null;
  shares?: MemberShare[];
  documents?: MemberDocument[];
};

export type MemberDirectoryContactInfo = {
  email?: string | null;
  phoneNumber?: string | null;
  physicalAddress?: string | null;
  emailLink?: string | null;
  phoneLink?: string | null;
};

export type MemberDirectoryMember = {
  id: string;
  fullLegalName?: string | null;
  status?: string | null;
  businessName?: string | null;
  businessField?: string | null;
  occupation?: string | null;
  employer?: string | null;
  businessServices?: string | null;
  companyProfile?: string | null;
  keyProjects?: string | null;
  certifications?: string | null;
  companyProfileDocumentPath?: string | null;
  website?: string | null;
  contactInfo?: MemberDirectoryContactInfo | null;
};

export type CurrentMemberPackage = {
  id?: string | null;
  name?: string | null;
  description?: string | null;
  price?: number | null;
  status?: string | null;
};

export type MemberShare = {
  id?: string;
  shareCount?: number;
  totalShareValue?: number;
  currentShareValue?: number;
  shareValue?: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type MemberDocument = {
  id: string;
  memberId?: string | null;
  documentType?: string | null;
  type?: string | null;
  documentName?: string | null;
  fileName?: string | null;
  originalFileName?: string | null;
  contentType?: string | null;
  fileSize?: number | null;
  status?: string | null;
  uploadedAt?: string | null;
  uploadDate?: string | null;
  createdAt?: string | null;
  lastUpdated?: string | null;
  reviewDate?: string | null;
  rejectionReason?: string | null;
};

export type MemberRevenueSummary = {
  paidCount?: number;
  pendingCount?: number;
  overdueCount?: number;
  paidFinesTotal?: number;
  pendingFinesTotal?: number;
  overdueFinesTotal?: number;
  paidPenaltiesTotal?: number;
  pendingPenaltiesTotal?: number;
  overduePenaltiesTotal?: number;
  totalShares?: number;
  totalShareValue?: number;
};

export type MemberRevenueTransaction = {
  id: string;
  transactionDate?: string | null;
  paymentStatus?: string | null;
  paymentDetails?: Record<string, number> | null;
  description?: string | null;
  dueDate?: string | null;
  totalShareValue?: number | null;
  shareCount?: number | null;
};

export type MemberLoan = {
  id: string;
  status?: string | null;
  purpose?: string | null;
  requestedAmount?: number | null;
  disbursedAmount?: number | null;
  remainingBalance?: number | null;
  totalPaid?: number | null;
  requestDate?: string | null;
  nextPaymentDueDate?: string | null;
  isOverdue?: boolean | null;
};

export type MemberRegistrationPayload = {
  fullLegalName: string;
  memberType: 'INDIVIDUAL' | 'COMPANY' | 'FOUNDING_MEMBER';
  employeeId?: string;
  shareCount?: string;
  firstRegistrationDate?: string;
  dateOfBirth?: string;
  termsAccepted: boolean;
  registrationType: 'ADMIN_REGISTRATION' | 'SELF_REGISTRATION';
  password?: string;
  membershipPackageId?: string;
  billingCycle?: string;
  contactInfo: {
    physicalAddress: string;
    postalAddress: string;
    phoneNumber: string;
    email: string;
    website?: string;
  };
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  bankBranch?: string;
  customData?: Record<string, string | number | boolean | null | undefined>;
};

export type MemberDocumentUploadFile = {
  uri: string;
  name: string;
  mimeType?: string | null;
};

export type MemberImportFile = {
  uri: string;
  name: string;
  mimeType?: string | null;
};

export type AssociationConfigField = {
  name?: string | null;
  label?: string | null;
  type?: string | null;
  required?: boolean | null;
  order?: number | null;
  details?: AssociationConfigField[] | null;
};

export type AssociationConfigFile = {
  name?: string | null;
  label?: string | null;
  required?: boolean | null;
  order?: number | null;
};

export type AssociationConfigPage = {
  pageNumber?: number | null;
  title?: string | null;
  fields?: AssociationConfigField[] | null;
  files?: AssociationConfigFile[] | null;
};

export type AssociationConfig = {
  id?: string | null;
  associationId?: string | null;
  settings?: {
    settings?: {
      associationType?: string | null;
      pages?: AssociationConfigPage[] | null;
    } | null;
    associationType?: string | null;
    pages?: AssociationConfigPage[] | null;
  } | null;
};

export type BatchCredential = {
  memberId?: string | null;
  email?: string | null;
  password?: string | null;
};

export type BatchJobResponse = {
  batchJobId?: string | null;
  associationId?: string | null;
  status?: string | null;
  totalRecords?: number | null;
  successfulRecords?: number | null;
  failedRecords?: number | null;
  errors?: string[] | null;
  successfulRegistrations?: unknown[] | null;
};

export type BatchJobStatus = {
  jobId?: string | null;
  status?: string | null;
  totalRecords?: number | null;
  processedRecords?: number | null;
  successfulRecords?: number | null;
  failedRecords?: number | null;
  skippedRecords?: number | null;
  progressPercentage?: number | null;
  errors?: string[] | null;
  credentials?: BatchCredential[] | null;
};

export type GroupConfig = {
  id?: string | null;
  name?: string | null;
  associationId?: string | null;
  financialYearStartDate?: string | null;
  financialYearEndDate?: string | null;
  lastClosedFinancialYearStartDate?: string | null;
  lastClosedFinancialYearEndDate?: string | null;
  lastFinancialYearClosedAt?: string | null;
  lastFinancialYearReports?: Record<string, unknown> | null;
  sharePurchaseFrequency?: string | null;
  shareValue?: number | string | null;
  minShares?: number | string | null;
  socialAmount?: number | string | null;
  socialFrequency?: string | null;
  loanMultiplier?: number | string | null;
  interestRate?: number | string | null;
  loanInterestRate?: number | string | null;
  insuranceRate?: number | string | null;
  penaltyRate?: number | string | null;
  loanRepaymentGracePeriodDays?: number | string | null;
  defaultInstallmentCount?: number | string | null;
  fineType?: string | null;
  fineAmount?: number | string | null;
  finePercentage?: number | string | null;
  attendanceFineType?: string | null;
  attendanceFineAmount?: number | string | null;
  attendanceFinePercentage?: number | string | null;
  attendanceFineFrequency?: string | null;
  interestType?: string | null;
  disburseGrossAmount?: boolean | null;
  deductInsuranceOnDisbursement?: boolean | null;
  interestCalculationMethod?: string | null;
  repaymentRules?: {
    minAmount?: number | string | null;
    maxAmount?: number | string | null;
    months?: number | string | null;
    installments?: number | string | null;
  }[] | null;
  additionalRules?: Record<string, unknown> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  version?: number | string | null;
};

export type GroupConfigPayload = {
  id?: string;
  name: string;
  associationId: string;
  shareValue: number;
  sharePurchaseFrequency: string;
  minShares: number;
  interestRate: number;
  insuranceRate: number;
  loanMultiplier: number;
  defaultInstallmentCount: number;
  loanRepaymentGracePeriodDays?: number;
  socialAmount: number;
  socialFrequency: string;
  fineType: string;
  fineAmount?: number;
  finePercentage?: number;
  attendanceFineType: string;
  attendanceFineAmount?: number;
  attendanceFinePercentage?: number;
  attendanceFineFrequency: string;
  penaltyRate: number;
  financialYearStartDate?: string;
  financialYearEndDate?: string;
  repaymentRules?: {
    minAmount: number;
    maxAmount: number;
    months: number;
    installments: number;
  }[];
  additionalRules?: Record<string, unknown>;
  interestType: string;
  disburseGrossAmount: boolean;
  deductInsuranceOnDisbursement: boolean;
};

export type StatementPeriodSummary = {
  totalSharesContributed?: number | string | null;
  totalShareAmount?: number | string | null;
  contributions?: Record<string, number | string | null | undefined> | null;
};

export type ShareStatementTransaction = {
  transactionId?: string | null;
  transactionDate?: string | null;
  amount?: number | string | null;
  shareCount?: number | string | null;
  status?: string | null;
  description?: string | null;
  weekNumber?: number | null;
  periodDate?: string | null;
};

export type SharesStatement = {
  memberId?: string | null;
  memberName?: string | null;
  membershipNumber?: string | null;
  totalShares?: number | string | null;
  totalShareValue?: number | string | null;
  currentNetTotalShares?: number | string | null;
  currentNetTotalShareValue?: number | string | null;
  transactions?: ShareStatementTransaction[] | null;
  periodSummaries?: Record<string, StatementPeriodSummary> | null;
};

export type ContributionStatementTransaction = {
  transactionId?: string | null;
  transactionDate?: string | null;
  contributionType?: string | null;
  amount?: number | string | null;
  status?: string | null;
  description?: string | null;
  weekNumber?: number | null;
  periodDate?: string | null;
  shareCount?: number | string | null;
};

export type MembersStatement = {
  memberId?: string | null;
  memberName?: string | null;
  membershipNumber?: string | null;
  totalShares?: number | string | null;
  totalShareValue?: number | string | null;
  currentNetTotalShares?: number | string | null;
  currentNetTotalShareValue?: number | string | null;
  totalOutstandingLoanBalance?: number | string | null;
  contributions?: Record<string, number | string | null | undefined> | null;
  transactions?: ContributionStatementTransaction[] | null;
  periodSummaries?: Record<string, StatementPeriodSummary> | null;
};

type GetMembersOptions = {
  page?: number;
  size?: number;
  sort?: string;
  asOf?: string;
};

type GetMemberDirectoryOptions = {
  associationId?: string;
  page?: number;
  size?: number;
  sort?: string;
};

function buildQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      query.set(key, String(value));
    }
  });
  return query.toString();
}

export function getAssociationMembers(associationId: string, options: GetMembersOptions = {}) {
  const query = buildQuery({
    associationId,
    page: options.page ?? 0,
    size: options.size ?? 250,
    sort: options.sort ?? 'membershipNumber,asc',
    asOf: options.asOf,
  });

  return apiRequest<PageResponse<AssociationMember>>(`/members?${query}`);
}

export function getAssociationMember(memberId: string) {
  return apiRequest<AssociationMember>(`/members/${encodeURIComponent(memberId)}`);
}

export function getCurrentMemberByUserId(userId: string) {
  return apiRequest<AssociationMember>(`/members/user/${encodeURIComponent(userId)}`);
}

export async function getMemberDirectory(options: GetMemberDirectoryOptions = {}) {
  const query = buildQuery({
    associationId: options.associationId,
    page: options.page ?? 0,
    size: options.size ?? 500,
    sort: options.sort ?? 'fullLegalName,asc',
  });
  const response = await apiRequest<PageResponse<MemberDirectoryMember> | MemberDirectoryMember[]>(
    `/members/directory${query ? `?${query}` : ''}`,
  );
  if (Array.isArray(response)) {
    return {
      content: response,
      totalElements: response.length,
      totalPages: 1,
      number: 0,
      size: response.length,
      first: true,
      last: true,
    } satisfies PageResponse<MemberDirectoryMember>;
  }
  return {
    ...response,
    content: Array.isArray(response?.content) ? response.content : [],
  } satisfies PageResponse<MemberDirectoryMember>;
}

export function getCurrentMemberPackage(associationId: string) {
  const query = buildQuery({ associationId });
  return apiRequest<CurrentMemberPackage>(`/members/current/package?${query}`);
}

export function updateCurrentMemberPreferences(preferences: { smsLanguage?: string }) {
  return apiRequest<Record<string, unknown>>('/members/me/preferences', {
    method: 'PATCH',
    body: preferences,
  });
}

export function updateCurrentMemberProfile(associationId: string, payload: MemberRegistrationPayload) {
  return apiRequest<AssociationMember>('/members/me', {
    method: 'PUT',
    body: buildMemberRegistrationFormData(associationId, payload, { includeBlankFields: true }),
  });
}

export function registerCurrentMemberProfile(associationId: string, payload: MemberRegistrationPayload) {
  return apiRequest<AssociationMember>('/members/me', {
    method: 'POST',
    body: buildMemberRegistrationFormData(associationId, payload, { includeBlankFields: true }),
  });
}

export function getAssociationMemberDocuments(memberId: string) {
  return apiRequest<MemberDocument[]>(`/members/${encodeURIComponent(memberId)}/documents`);
}

export function getAssociationMemberRevenueSummary(memberId: string) {
  return apiRequest<MemberRevenueSummary>(`/revenue-transactions/members/${encodeURIComponent(memberId)}/summary`);
}

export function getAssociationMemberRevenueTransactions(memberId: string) {
  return apiRequest<MemberRevenueTransaction[]>(`/revenue-transactions/members/${encodeURIComponent(memberId)}`);
}

export function getAssociationMemberLoans(memberId: string) {
  return apiRequest<MemberLoan[]>(`/loans/members/${encodeURIComponent(memberId)}`);
}

export function getCurrentMembershipSequence(associationId: string, prefix: string, year: string) {
  const query = buildQuery({ associationId, prefix, year });
  return apiRequest<number>(`/members/current-sequence?${query}`);
}

export function updateMemberMembershipNumber(
  memberId: string,
  membershipNumber: string,
  options: { prefix?: string; year?: string } = {},
) {
  const query = buildQuery({
    membershipNumber,
    prefix: options.prefix,
    year: options.year,
  });
  return apiRequest<void>(`/members/${encodeURIComponent(memberId)}/membership-number?${query}`, {
    method: 'PUT',
  });
}

export function createAssociationMember(associationId: string, payload: MemberRegistrationPayload) {
  return apiRequest<AssociationMember>(`/members?associationId=${encodeURIComponent(associationId)}`, {
    method: 'POST',
    body: buildMemberRegistrationFormData(associationId, payload),
  });
}

export function updateAssociationMember(memberId: string, associationId: string, payload: MemberRegistrationPayload) {
  return apiRequest<AssociationMember>(`/members/${encodeURIComponent(memberId)}`, {
    method: 'PUT',
    body: buildMemberRegistrationFormData(associationId, payload, { includeBlankFields: true }),
  });
}

export function uploadAssociationMemberDocument(
  member: AssociationMember,
  associationId: string,
  documentType: string,
  file: MemberDocumentUploadFile,
) {
  const formData = buildMemberRegistrationFormData(
    associationId,
    buildMemberRegistrationPayloadFromMember(member),
    { includeBlankFields: true },
  );
  formData.append(`fileUploads[${documentType}]`, {
    uri: file.uri,
    name: file.name,
    type: file.mimeType || 'application/octet-stream',
  } as unknown as Blob);

  return apiRequest<AssociationMember>(`/members/${encodeURIComponent(member.id)}`, {
    method: 'PUT',
    body: formData,
  });
}

export function uploadCurrentMemberDocument(documentType: string, file: MemberDocumentUploadFile) {
  const formData = new FormData();
  formData.append('documentType', documentType);
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType || 'application/octet-stream',
  } as unknown as Blob);

  return apiRequest<MemberDocument>('/members/me/documents', {
    method: 'POST',
    body: formData,
  });
}

export function getAssociationConfig(associationId: string) {
  return apiRequest<AssociationConfig>(`/associations/${encodeURIComponent(associationId)}/config`);
}

export function importAssociationMembersFromFile(associationId: string, file: MemberImportFile) {
  const formData = new FormData();
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  } as unknown as Blob);

  return apiRequest<BatchJobResponse>(`/members/batch/import?associationId=${encodeURIComponent(associationId)}`, {
    method: 'POST',
    body: formData,
  });
}

export function getBatchMemberJobStatus(jobId: string) {
  return apiRequest<BatchJobStatus>(`/batch-members/batch-job/${encodeURIComponent(jobId)}/status`);
}

export function getBatchMemberCredentials(jobId: string) {
  return apiRequest<BatchCredential[]>(`/batch-members/batch-credentials/${encodeURIComponent(jobId)}`);
}

export function getAssociationGroupConfigs(associationId: string) {
  return apiRequest<GroupConfig[]>(`/group-configs/associations/${encodeURIComponent(associationId)}`);
}

export function getGroupConfigById(id: string) {
  return apiRequest<GroupConfig>(`/group-configs/${encodeURIComponent(id)}`);
}

export function createGroupConfig(payload: GroupConfigPayload) {
  return apiRequest<GroupConfig>('/group-configs', {
    method: 'POST',
    body: payload,
  });
}

export function updateGroupConfig(id: string, payload: GroupConfigPayload) {
  return apiRequest<GroupConfig>(`/group-configs/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: {
      ...payload,
      id,
    },
  });
}

export function deleteGroupConfig(id: string) {
  return apiRequest<void>(`/group-configs/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function getAssociationSharesStatement(associationId: string, startDate: string, endDate: string) {
  const query = buildQuery({ startDate, endDate });
  return apiRequest<SharesStatement[]>(`/members/associations/${encodeURIComponent(associationId)}/shares-statement?${query}`);
}

export function getAssociationMembersStatement(associationId: string, startDate: string, endDate: string) {
  const query = buildQuery({ startDate, endDate });
  return apiRequest<MembersStatement[]>(`/members/associations/${encodeURIComponent(associationId)}/members-statement?${query}`);
}

export async function getAllAssociationMembers(associationId: string, options: Omit<GetMembersOptions, 'page'> = {}) {
  const size = options.size ?? 250;
  const sort = options.sort ?? 'membershipNumber,asc';
  const members: AssociationMember[] = [];
  let page = 0;
  let totalPages = 1;
  let totalElements = 0;

  while (page < totalPages) {
    const response = await getAssociationMembers(associationId, {
      ...options,
      page,
      size,
      sort,
    });

    members.push(...(response.content || []));
    totalPages = Number(response.totalPages || 1);
    totalElements = Number(response.totalElements || members.length);
    page += 1;
  }

  return {
    content: members,
    totalElements: totalElements || members.length,
    totalPages,
    pagesFetched: page,
  };
}

function buildMemberRegistrationFormData(
  associationId: string,
  payload: MemberRegistrationPayload,
  options: { includeBlankFields?: boolean } = {},
) {
  const formData = new FormData();

  appendIfPresent(formData, 'associationId', associationId, options);
  appendIfPresent(formData, 'fullLegalName', payload.fullLegalName, options);
  appendIfPresent(formData, 'memberType', payload.memberType, options);
  appendIfPresent(formData, 'employeeId', payload.employeeId, options);
  appendIfPresent(formData, 'shareCount', payload.shareCount, options);
  appendIfPresent(formData, 'firstRegistrationDate', payload.firstRegistrationDate, options);
  appendIfPresent(formData, 'dateOfBirth', payload.dateOfBirth, options);
  appendIfPresent(formData, 'termsAccepted', String(payload.termsAccepted), options);
  appendIfPresent(formData, 'registrationType', payload.registrationType, options);
  appendIfPresent(formData, 'password', payload.password, options);
  appendIfPresent(formData, 'membershipPackageId', payload.membershipPackageId, options);
  appendIfPresent(formData, 'billingCycle', payload.billingCycle, options);

  appendIfPresent(formData, 'contactInfo.physicalAddress', payload.contactInfo.physicalAddress, options);
  appendIfPresent(formData, 'contactInfo.postalAddress', payload.contactInfo.postalAddress, options);
  appendIfPresent(formData, 'contactInfo.phoneNumber', payload.contactInfo.phoneNumber, options);
  appendIfPresent(formData, 'contactInfo.email', payload.contactInfo.email, options);
  appendIfPresent(formData, 'contactInfo.website', payload.contactInfo.website, options);

  appendIfPresent(formData, 'bankName', payload.bankName, options);
  appendIfPresent(formData, 'bankAccountNumber', payload.bankAccountNumber, options);
  appendIfPresent(formData, 'bankAccountName', payload.bankAccountName, options);
  appendIfPresent(formData, 'bankBranch', payload.bankBranch, options);

  Object.entries(payload.customData || {}).forEach(([key, value]) => {
    appendIfPresent(formData, `customData[${key}]`, value, options);
  });

  return formData;
}

function buildMemberRegistrationPayloadFromMember(member: AssociationMember): MemberRegistrationPayload {
  return {
    fullLegalName: member.fullLegalName || '',
    memberType: normalizeMemberType(member.memberType),
    employeeId: member.employeeId || '',
    firstRegistrationDate: dateOnly(member.firstRegistrationDate),
    dateOfBirth: dateOnly(member.dateOfBirth),
    termsAccepted: true,
    registrationType: 'ADMIN_REGISTRATION',
    contactInfo: {
      physicalAddress: member.contactInfo?.physicalAddress || '',
      postalAddress: member.contactInfo?.postalAddress || '',
      phoneNumber: member.contactInfo?.phoneNumber || '',
      email: member.contactInfo?.email || '',
      website: member.contactInfo?.website || '',
    },
    bankName: member.bankName || '',
    bankAccountNumber: member.bankAccountNumber || '',
    bankAccountName: member.bankAccountName || '',
    bankBranch: member.bankBranch || '',
  };
}

function normalizeMemberType(memberType?: string | null): MemberRegistrationPayload['memberType'] {
  if (memberType === 'COMPANY' || memberType === 'FOUNDING_MEMBER') return memberType;
  return 'INDIVIDUAL';
}

function dateOnly(value?: string | null) {
  return value ? value.slice(0, 10) : '';
}

function appendIfPresent(
  formData: FormData,
  key: string,
  value?: string | number | boolean | null,
  options: { includeBlankFields?: boolean } = {},
) {
  if (value === undefined || value === null) return;
  const stringValue = String(value).trim();
  if (!stringValue && !options.includeBlankFields) return;
  formData.append(key, stringValue);
}
