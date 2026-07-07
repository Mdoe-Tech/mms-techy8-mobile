import { apiEnvelopeRequest, apiRequest } from '@/api/client';

export type EventType =
  | 'MEETING'
  | 'TRAINING'
  | 'WORKSHOP'
  | 'AGM'
  | 'OUTREACH'
  | 'SERVICE'
  | 'OTHER'
  | string;

export type EventStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'UPCOMING'
  | 'ONGOING'
  | 'COMPLETED'
  | 'CANCELLED'
  | string;

export type AssociationEvent = {
  id: string;
  associationId?: string | null;
  associationName?: string | null;
  eventName: string;
  eventType?: EventType | null;
  organizerDepartment?: string | null;
  hostUnionBranch?: string | null;
  eventDescription?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  venueLocation?: string | null;
  regionDistrict?: string | null;
  googleMapLink?: string | null;
  meetingLink?: string | null;
  registrationRequired?: boolean | null;
  maxParticipants?: number | null;
  registrationDeadline?: string | null;
  attendanceSheetPath?: string | null;
  agendaFilePath?: string | null;
  speakersTrainers?: string | null;
  supportingDocumentsPath?: string | null;
  eventPhotoBannerPath?: string | null;
  postEventReport?: string | null;
  photosMediaPath?: string | null;
  feedbackLink?: string | null;
  status?: EventStatus | null;
  registrationFee?: number | string | null;
  memberRegistrationFee?: number | string | null;
  nonMemberRegistrationFee?: number | string | null;
  packageRegistrationFees?: Record<string, number | string> | null;
  publicRegistrationEnabled?: boolean | null;
  publicRegistrationUrl?: string | null;
  publicEventListUrl?: string | null;
  paymentLink?: string | null;
  budget?: number | string | null;
  fundingSource?: string | null;
  createdByUserName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  registrationCount?: number | null;
  confirmedRegistrationCount?: number | null;
  memberRegistered?: boolean | null;
};

export type EventRegistration = {
  id: string;
  eventId?: string | null;
  memberId?: string | null;
  memberName?: string | null;
  memberEmail?: string | null;
  memberPhone?: string | null;
  membershipNumber?: string | null;
  membershipPackageName?: string | null;
  guestName?: string | null;
  guestEmail?: string | null;
  guestPhone?: string | null;
  participantType?: string | null;
  status?: string | null;
  registrationDate?: string | null;
  attendanceConfirmed?: boolean | null;
  registrationFeeAmount?: number | string | null;
  paymentStatus?: string | null;
  paymentReference?: string | null;
  publicRegistration?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type EventRegistrationResult = EventRegistration & {
  paymentLink?: string | null;
};

export type EventRegistrationPayload = {
  eventId: string;
  memberId: string;
  status?: string;
};

export type EventNonRegistrant = {
  memberId: string;
  memberName: string;
  membershipNumber?: string | null;
  memberEmail?: string | null;
  memberPhone?: string | null;
  membershipPackageName?: string | null;
};

export type AssociationEventPayload = {
  eventName: string;
  eventType: EventType;
  organizerDepartment?: string | null;
  hostUnionBranch?: string | null;
  eventDescription?: string | null;
  startDate: string;
  endDate: string;
  venueLocation?: string | null;
  regionDistrict?: string | null;
  googleMapLink?: string | null;
  meetingLink?: string | null;
  registrationRequired?: boolean;
  maxParticipants?: number | null;
  registrationDeadline?: string | null;
  status?: EventStatus;
  registrationFee?: number | null;
  memberRegistrationFee?: number | null;
  nonMemberRegistrationFee?: number | null;
  packageRegistrationFees?: Record<string, number>;
  publicRegistrationEnabled?: boolean;
  paymentLink?: string | null;
  attendanceSheetPath?: string | null;
  agendaFilePath?: string | null;
  speakersTrainers?: string | null;
  supportingDocumentsPath?: string | null;
  eventPhotoBannerPath?: string | null;
  postEventReport?: string | null;
  photosMediaPath?: string | null;
  feedbackLink?: string | null;
  budget?: number | null;
  fundingSource?: string | null;
};

export type EventPackageOption = {
  id: string;
  name?: string | null;
  description?: string | null;
  active?: boolean | null;
};

export async function getAssociationEvents(associationId: string) {
  const response = await apiEnvelopeRequest<unknown>(`/associations/${associationId}/events/list`);
  return extractList<AssociationEvent>(response.data).map(normalizeEvent);
}

export async function getAssociationEvent(associationId: string, eventId: string) {
  const event = await apiRequest<AssociationEvent>(`/associations/${associationId}/events/${eventId}`);
  return normalizeEvent(event);
}

export async function createAssociationEvent(associationId: string, payload: AssociationEventPayload) {
  const event = await apiRequest<AssociationEvent>(`/associations/${associationId}/events`, {
    method: 'POST',
    body: payload,
  });
  return normalizeEvent(event);
}

export async function updateAssociationEvent(
  associationId: string,
  eventId: string,
  payload: AssociationEventPayload,
) {
  const event = await apiRequest<AssociationEvent>(`/associations/${associationId}/events/${eventId}`, {
    method: 'PUT',
    body: payload,
  });
  return normalizeEvent(event);
}

export async function getEventPackages(associationId: string) {
  const response = await apiEnvelopeRequest<unknown>(`/packages/association/${associationId}`);
  return extractList<EventPackageOption>(response.data).map((item) => ({
    ...item,
    name: item.name || 'Membership package',
  }));
}

export async function deleteAssociationEvent(associationId: string, eventId: string) {
  return apiRequest<void>(`/associations/${associationId}/events/${eventId}`, {
    method: 'DELETE',
  });
}

export async function getEventRegistrations(associationId: string, eventId: string) {
  const response = await apiEnvelopeRequest<unknown>(
    `/associations/${associationId}/events/${eventId}/registrations?size=100&sort=registrationDate,desc`,
  );
  return extractList<EventRegistration>(response.data).map(normalizeRegistration);
}

export async function getEventNonRegistrants(associationId: string, eventId: string) {
  const response = await apiEnvelopeRequest<unknown>(
    `/associations/${associationId}/events/${eventId}/non-registrants?size=100&sort=fullLegalName,asc`,
  );
  return extractList<EventNonRegistrant>(response.data).map(normalizeNonRegistrant);
}

export async function getMemberEvents(associationId: string, memberId: string) {
  const response = await apiEnvelopeRequest<unknown>(`/associations/${associationId}/events/member/${memberId}`);
  return extractList<AssociationEvent>(response.data).map(normalizeEvent);
}

export async function registerMemberForEvent(associationId: string, payload: EventRegistrationPayload) {
  const response = await apiEnvelopeRequest<EventRegistrationResult>(`/associations/${associationId}/events/registrations`, {
    method: 'POST',
    body: {
      status: 'CONFIRMED',
      ...payload,
    },
  });
  return normalizeRegistration(response.data) as EventRegistrationResult;
}

export async function getPublicEvents(associationId: string) {
  const response = await apiEnvelopeRequest<unknown>(`/public/associations/${associationId}/events`, {
    auth: false,
  });
  return extractList<AssociationEvent>(response.data).map(normalizeEvent);
}

export async function getPublicEvent(associationId: string, eventId: string) {
  const event = await apiRequest<AssociationEvent>(`/public/associations/${associationId}/events/${eventId}`, {
    auth: false,
  });
  return normalizeEvent(event);
}

function normalizeEvent(event: AssociationEvent): AssociationEvent {
  return {
    ...event,
    eventName: event.eventName || 'Untitled event',
    eventType: event.eventType || 'OTHER',
    status: event.status || 'DRAFT',
    registrationRequired: event.registrationRequired === true,
    publicRegistrationEnabled: event.publicRegistrationEnabled === true,
    registrationFee: toNumber(event.registrationFee),
    memberRegistrationFee: toNumber(event.memberRegistrationFee),
    nonMemberRegistrationFee: toNumber(event.nonMemberRegistrationFee),
    budget: toNumber(event.budget),
    registrationCount: Number(event.registrationCount || 0),
    confirmedRegistrationCount: Number(event.confirmedRegistrationCount || 0),
  };
}

function normalizeRegistration(registration: EventRegistration): EventRegistration {
  return {
    ...registration,
    status: registration.status || 'PENDING',
    paymentStatus: registration.paymentStatus || '',
    registrationFeeAmount: toNumber(registration.registrationFeeAmount),
  };
}

function normalizeNonRegistrant(member: EventNonRegistrant): EventNonRegistrant {
  return {
    ...member,
    memberName: member.memberName || 'Unnamed member',
  };
}

function toNumber(value?: number | string | null) {
  if (value === null || value === undefined || value === '') return 0;
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function extractList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  const data = payload as {
    content?: T[];
    data?: T[] | { content?: T[] };
  } | null;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.content)) return data.data.content;
  return [];
}
