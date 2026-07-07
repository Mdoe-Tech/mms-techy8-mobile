import { apiBinaryRequest, apiEnvelopeRequest, apiRequest } from '@/api/client';

export type MemberVoiceQuestionType = 'MULTIPLE_CHOICE' | 'OPEN_TEXT' | 'RATING_SCALE' | 'YES_NO';
export type MemberVoiceStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED';
export type MemberVoiceTargetAudience = 'ALL_MEMBERS' | 'SPECIFIC_PACKAGES';

export type MemberVoiceQuestion = {
  id?: string | null;
  questionText: string;
  questionType: MemberVoiceQuestionType;
  required?: boolean | null;
  displayOrder?: number | null;
  options?: string[] | null;
  minRating?: number | null;
  maxRating?: number | null;
};

export type MemberVoiceQuestionnaire = {
  id: string;
  associationId?: string | null;
  associationName?: string | null;
  title: string;
  description?: string | null;
  status?: MemberVoiceStatus | string | null;
  targetAudience?: MemberVoiceTargetAudience | string | null;
  targetPackageIds?: string[] | null;
  shareableLink?: string | null;
  publicToken?: string | null;
  publishedAt?: string | null;
  closedAt?: string | null;
  closesAt?: string | null;
  responseCount?: number | null;
  targetMemberCount?: number | null;
  questions?: MemberVoiceQuestion[] | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type MemberVoiceQuestionnairePayload = {
  title: string;
  description?: string | null;
  status?: MemberVoiceStatus;
  targetAudience?: MemberVoiceTargetAudience;
  targetPackageIds?: string[];
  closesAt?: string | null;
  questions: MemberVoiceQuestionPayload[];
};

export type MemberVoiceQuestionPayload = {
  questionText: string;
  questionType: MemberVoiceQuestionType;
  required?: boolean;
  displayOrder?: number;
  options?: string[];
  minRating?: number;
  maxRating?: number;
};

export type MemberVoiceAnswer = {
  questionId: string;
  questionText: string;
  questionType: MemberVoiceQuestionType | string;
  answerText?: string | null;
  selectedOptions?: string[] | null;
  ratingValue?: number | null;
  yesNoValue?: boolean | null;
};

export type MemberVoiceSubmission = {
  id: string;
  questionnaireId?: string | null;
  memberId?: string | null;
  memberName?: string | null;
  membershipNumber?: string | null;
  respondentName?: string | null;
  respondentEmail?: string | null;
  respondentPhone?: string | null;
  membershipPackageName?: string | null;
  source?: string | null;
  submittedAt?: string | null;
  answers?: MemberVoiceAnswer[] | null;
};

export type MemberVoiceQuestionAnalytics = {
  questionId: string;
  questionText: string;
  questionType: MemberVoiceQuestionType | string;
  responseCount?: number | null;
  averageRating?: number | null;
  optionCounts?: Record<string, number> | null;
  yesNoCounts?: Record<string, number> | null;
  textResponses?: string[] | null;
};

export type MemberVoiceAnalytics = {
  questionnaireId: string;
  title: string;
  responseCount?: number | null;
  targetMemberCount?: number | null;
  responseRate?: number | null;
  questionSummaries?: MemberVoiceQuestionAnalytics[] | null;
  recentResponses?: MemberVoiceSubmission[] | null;
};

export type MemberVoicePackage = {
  id: string;
  name?: string | null;
  description?: string | null;
  active?: boolean | null;
};

export async function getMemberVoiceQuestionnaires(associationId: string) {
  const response = await apiEnvelopeRequest<unknown>(
    `/associations/${associationId}/members-voice?size=100&sort=createdAt,desc`,
  );
  return extractList<MemberVoiceQuestionnaire>(response.data).map(normalizeQuestionnaire);
}

export async function getMemberVoiceQuestionnaire(associationId: string, questionnaireId: string) {
  const response = await apiRequest<MemberVoiceQuestionnaire>(
    `/associations/${associationId}/members-voice/${questionnaireId}`,
  );
  return normalizeQuestionnaire(response);
}

export async function getMemberVoicePackages(associationId: string) {
  const response = await apiEnvelopeRequest<unknown>(`/packages/association/${associationId}`);
  return extractList<MemberVoicePackage>(response.data).map((item) => ({
    ...item,
    name: item.name || 'Membership package',
  }));
}

export async function createMemberVoiceQuestionnaire(
  associationId: string,
  payload: MemberVoiceQuestionnairePayload,
) {
  const response = await apiRequest<MemberVoiceQuestionnaire>(`/associations/${associationId}/members-voice`, {
    method: 'POST',
    body: payload,
  });
  return normalizeQuestionnaire(response);
}

export async function updateMemberVoiceQuestionnaire(
  associationId: string,
  questionnaireId: string,
  payload: MemberVoiceQuestionnairePayload,
) {
  const response = await apiRequest<MemberVoiceQuestionnaire>(
    `/associations/${associationId}/members-voice/${questionnaireId}`,
    {
      method: 'PUT',
      body: payload,
    },
  );
  return normalizeQuestionnaire(response);
}

export async function deleteMemberVoiceQuestionnaire(associationId: string, questionnaireId: string) {
  return apiRequest<void>(`/associations/${associationId}/members-voice/${questionnaireId}`, {
    method: 'DELETE',
  });
}

export async function publishMemberVoiceQuestionnaire(associationId: string, questionnaireId: string) {
  const response = await apiRequest<MemberVoiceQuestionnaire>(
    `/associations/${associationId}/members-voice/${questionnaireId}/publish`,
    {
      method: 'POST',
      body: {},
    },
  );
  return normalizeQuestionnaire(response);
}

export async function closeMemberVoiceQuestionnaire(associationId: string, questionnaireId: string) {
  const response = await apiRequest<MemberVoiceQuestionnaire>(
    `/associations/${associationId}/members-voice/${questionnaireId}/close`,
    {
      method: 'POST',
      body: {},
    },
  );
  return normalizeQuestionnaire(response);
}

export async function notifyMemberVoiceQuestionnaire(associationId: string, questionnaireId: string) {
  return apiRequest<void>(`/associations/${associationId}/members-voice/${questionnaireId}/notify`, {
    method: 'POST',
    body: {},
  });
}

export async function getMemberVoiceAnalytics(associationId: string, questionnaireId: string) {
  return apiRequest<MemberVoiceAnalytics>(`/associations/${associationId}/members-voice/${questionnaireId}/analytics`);
}

export async function getMemberVoiceResponses(associationId: string, questionnaireId: string) {
  const response = await apiEnvelopeRequest<unknown>(
    `/associations/${associationId}/members-voice/${questionnaireId}/responses?size=100&sort=submittedAt,desc`,
  );
  return extractList<MemberVoiceSubmission>(response.data).map((row) => ({
    ...row,
    answers: row.answers || [],
  }));
}

export async function downloadMemberVoiceExport(
  associationId: string,
  questionnaireId: string,
  format: 'xlsx' | 'pdf',
) {
  return apiBinaryRequest(`/associations/${associationId}/members-voice/${questionnaireId}/export.${format}`);
}

function normalizeQuestionnaire(questionnaire: MemberVoiceQuestionnaire): MemberVoiceQuestionnaire {
  return {
    ...questionnaire,
    title: questionnaire.title || 'Members Voice questionnaire',
    description: questionnaire.description || '',
    status: questionnaire.status || 'DRAFT',
    targetAudience: questionnaire.targetAudience || 'ALL_MEMBERS',
    targetPackageIds: questionnaire.targetPackageIds || [],
    questions: uniqueQuestions(questionnaire.questions || []).map((question, index) => ({
      ...question,
      questionText: question.questionText || `Question ${index + 1}`,
      questionType: question.questionType || 'OPEN_TEXT',
      required: question.required !== false,
      displayOrder: Number(question.displayOrder || index + 1),
      options: question.options || [],
      minRating: Number(question.minRating || 1),
      maxRating: Number(question.maxRating || 5),
    })),
    responseCount: Number(questionnaire.responseCount || 0),
    targetMemberCount: Number(questionnaire.targetMemberCount || 0),
  };
}

function uniqueQuestions(questions: MemberVoiceQuestion[]) {
  const seen = new Set<string>();
  return questions.filter((question) => {
    const key = question.id || `${question.displayOrder || ''}:${question.questionText}:${question.questionType}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  const data = payload as {
    content?: T[];
    data?: T[] | { content?: T[] };
    page?: unknown;
  } | null;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.content)) return data.data.content;
  return [];
}
