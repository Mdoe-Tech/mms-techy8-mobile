import { apiBinaryRequest, apiRequest } from '@/api/client';

export type ComplianceStatus = 'COMPLETED' | 'OVERDUE' | 'DUE_SOON' | 'UPCOMING' | string;

export type GovernanceComplianceTask = {
  id: string;
  associationId?: string | null;
  title: string;
  description?: string | null;
  frequency?: string | null;
  dueDate?: string | null;
  responsibleRole?: string | null;
  completed?: boolean | null;
  completedYear?: number | null;
  completedAt?: string | null;
  reminderDaysBefore?: number | null;
  lastReminderSentAt?: string | null;
  active?: boolean | null;
  status?: ComplianceStatus | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type GovernanceComplianceTaskPayload = {
  title: string;
  description?: string;
  frequency?: string;
  dueDate: string;
  responsibleRole?: string;
  reminderDaysBefore?: number;
  active?: boolean;
};

export type GovernanceDocument = {
  id: string;
  associationId?: string | null;
  title: string;
  category?: string | null;
  description?: string | null;
  fileName?: string | null;
  contentType?: string | null;
  fileSize?: number | null;
  visibility?: string | null;
  uploadedBy?: string | null;
  documentDate?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  downloadUrl?: string | null;
};

export type GovernanceDocumentCategory = {
  id: string;
  associationId?: string | null;
  name: string;
  description?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type GovernanceDocumentCategoryPayload = {
  name: string;
  description?: string;
};

export type GovernanceDocumentUploadFile = {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
};

export type GovernanceDocumentUploadPayload = {
  title: string;
  category?: string;
  description?: string;
  visibility?: string;
  documentDate?: string;
  file: GovernanceDocumentUploadFile;
};

export type GovernancePollStatus = 'DRAFT' | 'SCHEDULED' | 'OPEN' | 'CLOSED' | string;
export type GovernancePollBallotType = 'YES_NO' | 'SINGLE_CHOICE';
export type GovernancePollAudience = 'ALL_MEMBERS' | 'PACKAGE_MEMBERS';

export type GovernancePoll = {
  id: string;
  associationId?: string | null;
  title: string;
  question: string;
  eligibleVoters?: string | null;
  ballotType?: GovernancePollBallotType | string | null;
  options?: string[] | null;
  targetAudience?: GovernancePollAudience | string | null;
  targetPackageIds?: string[] | null;
  status?: GovernancePollStatus | null;
  startsAt?: string | null;
  endsAt?: string | null;
  publishedAt?: string | null;
  closedAt?: string | null;
  shareableLink?: string | null;
  yesVotes?: number | null;
  noVotes?: number | null;
  totalVotes?: number | null;
  resultCounts?: Record<string, number> | null;
  eligibleCount?: number | null;
  invitedCount?: number | null;
  votedCount?: number | null;
  pendingCount?: number | null;
  sentCount?: number | null;
  failedCount?: number | null;
  openedCount?: number | null;
  participationRate?: number | null;
  myVote?: string | null;
  canVote?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type GovernancePollPayload = {
  title: string;
  question: string;
  eligibleVoters?: string;
  ballotType?: GovernancePollBallotType;
  options?: string[];
  targetAudience?: GovernancePollAudience;
  targetPackageIds?: string[];
  status?: GovernancePollStatus;
  startsAt?: string | null;
  endsAt?: string | null;
  sendNotifications?: boolean;
};

export type GovernancePackageOption = {
  id: string;
  name?: string | null;
  description?: string | null;
  active?: boolean | null;
};

export type GovernanceStructureEntry = {
  id: string;
  associationId?: string | null;
  title: string;
  roleName: string;
  memberName?: string | null;
  memberId?: string | null;
  description?: string | null;
  displayOrder?: number | null;
  active?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type GovernanceStructurePayload = {
  title: string;
  roleName: string;
  memberName?: string | null;
  memberId?: string | null;
  description?: string | null;
  displayOrder?: number;
  active?: boolean;
};

export async function getGovernanceComplianceTasks(associationId: string) {
  const tasks = await apiRequest<GovernanceComplianceTask[]>(`/associations/${associationId}/governance/compliance`);
  return normalizeComplianceTasks(tasks);
}

export async function createGovernanceComplianceTask(
  associationId: string,
  payload: GovernanceComplianceTaskPayload,
) {
  return apiRequest<GovernanceComplianceTask>(`/associations/${associationId}/governance/compliance`, {
    method: 'POST',
    body: payload,
  });
}

export async function updateGovernanceComplianceTask(
  associationId: string,
  taskId: string,
  payload: GovernanceComplianceTaskPayload,
) {
  return apiRequest<GovernanceComplianceTask>(`/associations/${associationId}/governance/compliance/${taskId}`, {
    method: 'PUT',
    body: payload,
  });
}

export async function setGovernanceComplianceCompletion(
  associationId: string,
  taskId: string,
  completed: boolean,
  completedYear = new Date().getFullYear(),
) {
  return apiRequest<GovernanceComplianceTask>(`/associations/${associationId}/governance/compliance/${taskId}/completion`, {
    method: 'PATCH',
    body: { completed, completedYear },
  });
}

export async function deleteGovernanceComplianceTask(associationId: string, taskId: string) {
  return apiRequest<void>(`/associations/${associationId}/governance/compliance/${taskId}`, {
    method: 'DELETE',
  });
}

export async function getGovernanceDocuments(associationId: string) {
  const documents = await apiRequest<GovernanceDocument[]>(`/associations/${associationId}/governance/documents`);
  return normalizeGovernanceDocuments(documents);
}

export async function getGovernanceDocumentCategories(associationId: string) {
  const categories = await apiRequest<GovernanceDocumentCategory[]>(
    `/associations/${associationId}/governance/document-categories`,
  );
  return normalizeGovernanceDocumentCategories(categories);
}

export async function createGovernanceDocumentCategory(associationId: string, payload: GovernanceDocumentCategoryPayload) {
  return apiRequest<GovernanceDocumentCategory>(`/associations/${associationId}/governance/document-categories`, {
    method: 'POST',
    body: payload,
  });
}

export async function updateGovernanceDocumentCategory(associationId: string, categoryId: string, payload: GovernanceDocumentCategoryPayload) {
  return apiRequest<GovernanceDocumentCategory>(
    `/associations/${associationId}/governance/document-categories/${categoryId}`,
    {
      method: 'PUT',
      body: payload,
    },
  );
}

export async function deleteGovernanceDocumentCategory(associationId: string, categoryId: string) {
  return apiRequest<void>(`/associations/${associationId}/governance/document-categories/${categoryId}`, {
    method: 'DELETE',
  });
}

export async function uploadGovernanceDocument(associationId: string, payload: GovernanceDocumentUploadPayload) {
  const formData = new FormData();
  formData.append('title', payload.title);
  formData.append('category', payload.category || 'General');
  formData.append('description', payload.description || '');
  formData.append('visibility', payload.visibility || 'Internal');
  formData.append('documentDate', payload.documentDate || new Date().toISOString().slice(0, 10));
  formData.append('file', {
    uri: payload.file.uri,
    name: payload.file.name,
    type: payload.file.mimeType || 'application/octet-stream',
  } as unknown as Blob);

  return apiRequest<GovernanceDocument>(`/associations/${associationId}/governance/documents`, {
    method: 'POST',
    body: formData,
  });
}

export async function downloadGovernanceDocument(associationId: string, documentId: string) {
  return apiBinaryRequest(`/associations/${associationId}/governance/documents/${documentId}/download`);
}

export async function deleteGovernanceDocument(associationId: string, documentId: string) {
  return apiRequest<void>(`/associations/${associationId}/governance/documents/${documentId}`, {
    method: 'DELETE',
  });
}

export async function getGovernancePolls(associationId: string) {
  const response = await apiRequest<GovernancePoll[] | { content?: GovernancePoll[] }>(
    `/associations/${associationId}/governance/polls`,
  );
  return normalizeGovernancePolls(extractList<GovernancePoll>(response));
}

export async function getMemberGovernancePolls(associationId: string) {
  const response = await apiRequest<GovernancePoll[] | { content?: GovernancePoll[] }>(
    `/associations/${associationId}/governance/polls/member`,
  );
  return normalizeGovernancePolls(extractList<GovernancePoll>(response));
}

export async function submitMemberGovernanceVote(associationId: string, pollId: string, voteValue: string) {
  const poll = await apiRequest<GovernancePoll>(`/associations/${associationId}/governance/polls/${pollId}/vote`, {
    method: 'POST',
    body: { voteValue },
  });
  return normalizeGovernancePolls([poll])[0];
}

export async function getGovernancePollPackages(associationId: string) {
  const response = await apiRequest<GovernancePackageOption[] | { content?: GovernancePackageOption[] }>(
    `/packages/association/${associationId}`,
  );
  return extractList<GovernancePackageOption>(response).map((item) => ({
    ...item,
    name: item.name || 'Membership package',
  }));
}

export async function createGovernancePoll(associationId: string, payload: GovernancePollPayload) {
  return apiRequest<GovernancePoll>(`/associations/${associationId}/governance/polls`, {
    method: 'POST',
    body: payload,
  });
}

export async function updateGovernancePoll(associationId: string, pollId: string, payload: GovernancePollPayload) {
  return apiRequest<GovernancePoll>(`/associations/${associationId}/governance/polls/${pollId}`, {
    method: 'PUT',
    body: payload,
  });
}

export async function publishGovernancePoll(associationId: string, pollId: string) {
  return apiRequest<GovernancePoll>(`/associations/${associationId}/governance/polls/${pollId}/publish`, {
    method: 'POST',
    body: {},
  });
}

export async function closeGovernancePoll(associationId: string, pollId: string) {
  return apiRequest<GovernancePoll>(`/associations/${associationId}/governance/polls/${pollId}/close`, {
    method: 'POST',
    body: {},
  });
}

export async function notifyGovernancePoll(associationId: string, pollId: string) {
  return apiRequest<void>(`/associations/${associationId}/governance/polls/${pollId}/notify`, {
    method: 'POST',
    body: {},
  });
}

export async function deleteGovernancePoll(associationId: string, pollId: string) {
  return apiRequest<void>(`/associations/${associationId}/governance/polls/${pollId}`, {
    method: 'DELETE',
  });
}

export async function getGovernanceStructure(associationId: string) {
  const response = await apiRequest<GovernanceStructureEntry[] | { content?: GovernanceStructureEntry[] }>(
    `/associations/${associationId}/governance/structure`,
  );
  return normalizeGovernanceStructure(extractList<GovernanceStructureEntry>(response));
}

export async function createGovernanceStructureEntry(associationId: string, payload: GovernanceStructurePayload) {
  return apiRequest<GovernanceStructureEntry>(`/associations/${associationId}/governance/structure`, {
    method: 'POST',
    body: payload,
  });
}

export async function updateGovernanceStructureEntry(
  associationId: string,
  entryId: string,
  payload: GovernanceStructurePayload,
) {
  return apiRequest<GovernanceStructureEntry>(`/associations/${associationId}/governance/structure/${entryId}`, {
    method: 'PUT',
    body: payload,
  });
}

export async function deleteGovernanceStructureEntry(associationId: string, entryId: string) {
  return apiRequest<void>(`/associations/${associationId}/governance/structure/${entryId}`, {
    method: 'DELETE',
  });
}

export function complianceStatus(task: GovernanceComplianceTask) {
  if (task.completed || task.status === 'COMPLETED') return 'COMPLETED';
  return task.status || 'UPCOMING';
}

export function complianceStatusGroup(task: GovernanceComplianceTask) {
  const status = complianceStatus(task);
  if (status === 'COMPLETED') return 'completed';
  if (status === 'OVERDUE') return 'overdue';
  if (status === 'DUE_SOON') return 'dueSoon';
  return 'upcoming';
}

function normalizeComplianceTasks(tasks?: GovernanceComplianceTask[] | null) {
  return (tasks || []).map((task) => ({
    ...task,
    title: task.title || 'Untitled task',
    description: task.description || '',
    frequency: task.frequency || 'YEARLY',
    responsibleRole: task.responsibleRole || '',
    reminderDaysBefore: Number(task.reminderDaysBefore ?? 7),
    completed: Boolean(task.completed),
    active: task.active !== false,
    status: task.status || (task.completed ? 'COMPLETED' : 'UPCOMING'),
  }));
}

function normalizeGovernanceDocuments(documents?: GovernanceDocument[] | null) {
  return (documents || []).map((document) => ({
    ...document,
    title: document.title || 'Untitled document',
    category: document.category || 'General',
    description: document.description || '',
    fileName: document.fileName || 'governance-document',
    contentType: document.contentType || 'application/octet-stream',
    fileSize: Number(document.fileSize || 0),
    visibility: document.visibility || 'Internal',
    uploadedBy: document.uploadedBy || '',
  }));
}

function normalizeGovernanceDocumentCategories(categories?: GovernanceDocumentCategory[] | null) {
  return (categories || []).map((category) => ({
    ...category,
    name: category.name || 'General',
    description: category.description || '',
  }));
}

function normalizeGovernancePolls(polls?: GovernancePoll[] | null) {
  return (polls || []).map((poll) => ({
    ...poll,
    title: poll.title || 'Untitled vote',
    question: poll.question || '',
    eligibleVoters: poll.eligibleVoters || 'All active members',
    ballotType: poll.ballotType || 'YES_NO',
    options: poll.options?.length ? poll.options : poll.ballotType === 'SINGLE_CHOICE' ? [] : ['YES', 'NO'],
    targetAudience: poll.targetAudience || 'ALL_MEMBERS',
    targetPackageIds: poll.targetPackageIds || [],
    status: poll.status || 'DRAFT',
    resultCounts: poll.resultCounts || {},
    eligibleCount: Number(poll.eligibleCount || 0),
    invitedCount: Number(poll.invitedCount || 0),
    votedCount: Number(poll.votedCount || 0),
    pendingCount: Number(poll.pendingCount || 0),
    sentCount: Number(poll.sentCount || 0),
    failedCount: Number(poll.failedCount || 0),
    openedCount: Number(poll.openedCount || 0),
    participationRate: Number(poll.participationRate || 0),
    totalVotes: Number(poll.totalVotes || 0),
  }));
}

function normalizeGovernanceStructure(entries?: GovernanceStructureEntry[] | null) {
  return (entries || []).map((entry) => ({
    ...entry,
    title: entry.title || 'Governance body',
    roleName: entry.roleName || 'Role',
    memberName: entry.memberName || '',
    description: entry.description || '',
    displayOrder: Number(entry.displayOrder || 0),
    active: entry.active !== false,
  }));
}

function extractList<T>(payload: T[] | { content?: T[] } | null | undefined): T[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.content)) return payload.content;
  return [];
}
