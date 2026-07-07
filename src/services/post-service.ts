import { apiEnvelopeRequest, apiRequest } from '@/api/client';

export type CommunityPostType = 'JOB' | 'TENDER' | string;
export type CommunityPostStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED' | string;
export type EmploymentType =
  | 'FULL_TIME'
  | 'PART_TIME'
  | 'CONTRACT'
  | 'TEMPORARY'
  | 'INTERNSHIP'
  | 'VOLUNTEER'
  | 'OTHER'
  | string;

export type CommunityPost = {
  id: string;
  associationId?: string | null;
  associationName?: string | null;
  postType: CommunityPostType;
  status: CommunityPostStatus;
  title: string;
  departmentUnit?: string | null;
  locationRegion?: string | null;
  deadlineDate?: string | null;
  description?: string | null;
  employmentType?: EmploymentType | null;
  positionsCount?: number | null;
  requiredQualifications?: string | null;
  experienceYears?: number | null;
  skillsCompetencies?: string | null;
  applicationEmail?: string | null;
  applicationLink?: string | null;
  jobDescriptionPath?: string | null;
  tenderReferenceNumber?: string | null;
  tenderCategory?: string | null;
  eligibilityCriteria?: string | null;
  documentCollectionLink?: string | null;
  submissionInstructions?: string | null;
  openingDateTime?: string | null;
  contactPersonEmail?: string | null;
  tenderDocumentPath?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type CommunityPostPayload = {
  postType: CommunityPostType;
  title: string;
  departmentUnit?: string | null;
  locationRegion?: string | null;
  deadlineDate?: string | null;
  status?: CommunityPostStatus | null;
  description?: string | null;
  employmentType?: EmploymentType | null;
  positionsCount?: number | null;
  requiredQualifications?: string | null;
  experienceYears?: number | null;
  skillsCompetencies?: string | null;
  applicationEmail?: string | null;
  applicationLink?: string | null;
  jobDescriptionPath?: string | null;
  tenderReferenceNumber?: string | null;
  tenderCategory?: string | null;
  eligibilityCriteria?: string | null;
  documentCollectionLink?: string | null;
  submissionInstructions?: string | null;
  openingDateTime?: string | null;
  contactPersonEmail?: string | null;
  tenderDocumentPath?: string | null;
};

export type CommunityPostPage = {
  posts: CommunityPost[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export async function getAssociationPosts(
  associationId: string,
  filters: { page?: number; size?: number; sort?: string } = {},
): Promise<CommunityPostPage> {
  const query = new URLSearchParams();
  query.set('page', String(filters.page ?? 0));
  query.set('size', String(filters.size ?? 100));
  query.set('sort', filters.sort || 'createdAt,desc');

  const response = await apiEnvelopeRequest<unknown>(
    `/associations/${encodeURIComponent(associationId)}/posts?${query.toString()}`,
  );
  return normalizePostPage(response, filters.size ?? 100);
}

export async function getAssociationPost(associationId: string, postId: string) {
  const post = await apiRequest<CommunityPost>(
    `/associations/${encodeURIComponent(associationId)}/posts/${encodeURIComponent(postId)}`,
  );
  return normalizePost(post);
}

export async function createAssociationPost(associationId: string, payload: CommunityPostPayload) {
  const post = await apiRequest<CommunityPost>(`/associations/${encodeURIComponent(associationId)}/posts`, {
    method: 'POST',
    body: payload,
  });
  return normalizePost(post);
}

export async function updateAssociationPost(associationId: string, postId: string, payload: CommunityPostPayload) {
  const post = await apiRequest<CommunityPost>(
    `/associations/${encodeURIComponent(associationId)}/posts/${encodeURIComponent(postId)}`,
    {
      method: 'PUT',
      body: payload,
    },
  );
  return normalizePost(post);
}

export function deleteAssociationPost(associationId: string, postId: string) {
  return apiRequest<void>(`/associations/${encodeURIComponent(associationId)}/posts/${encodeURIComponent(postId)}`, {
    method: 'DELETE',
  });
}

export async function publishAssociationPost(associationId: string, postId: string) {
  const post = await apiRequest<CommunityPost>(
    `/associations/${encodeURIComponent(associationId)}/posts/${encodeURIComponent(postId)}/publish`,
    { method: 'POST' },
  );
  return normalizePost(post);
}

export function notifyAssociationPost(associationId: string, postId: string) {
  return apiRequest<void>(
    `/associations/${encodeURIComponent(associationId)}/posts/${encodeURIComponent(postId)}/notify`,
    { method: 'POST' },
  );
}

function normalizePostPage(
  envelope: {
    data?: unknown;
    page?: number | string | null;
    size?: number | string | null;
    totalElements?: number | string | null;
    totalPages?: number | string | null;
  },
  fallbackSize: number,
): CommunityPostPage {
  const payload = envelope.data as { content?: CommunityPost[] } | CommunityPost[] | null;
  const posts = (Array.isArray(payload) ? payload : Array.isArray(payload?.content) ? payload.content : []).map(normalizePost);

  return {
    posts,
    page: Number(envelope.page ?? 0),
    size: Number(envelope.size ?? fallbackSize),
    totalElements: Number(envelope.totalElements ?? posts.length),
    totalPages: Number(envelope.totalPages ?? 1),
  };
}

function normalizePost(post: CommunityPost): CommunityPost {
  return {
    ...post,
    title: post.title || 'Untitled post',
    postType: post.postType || 'JOB',
    status: post.status || 'DRAFT',
    positionsCount: toNumberOrNull(post.positionsCount),
    experienceYears: toNumberOrNull(post.experienceYears),
  };
}

function toNumberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}
