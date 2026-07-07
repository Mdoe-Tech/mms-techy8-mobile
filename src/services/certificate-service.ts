import { apiBinaryRequest, apiRequest } from '@/api/client';

export type CertificateVerification = {
  certificateId: string;
  memberId?: string | null;
  associationId?: string | null;
  memberName?: string | null;
  associationName?: string | null;
  membershipNumber?: string | null;
  memberSince?: string | null;
  status?: string | null;
};

export type CertificateDownload = {
  data: ArrayBuffer;
  filename: string;
  contentType: string;
};

export function buildMembershipCertificateId(associationId: string, memberId: string) {
  return `NANE-CERT-${associationId.replace(/-/g, '')}-${memberId.replace(/-/g, '')}`;
}

export function buildCertificateVerificationUrl(certificateId: string) {
  return `https://app.nane.co.tz/verify/certificate/${encodeURIComponent(certificateId)}`;
}

export function verifyMembershipCertificate(certificateId: string) {
  return apiRequest<CertificateVerification>(`/certificates/verify/${encodeURIComponent(certificateId)}`, {
    auth: false,
  });
}

export async function downloadMembershipCertificate(memberId: string): Promise<CertificateDownload> {
  const response = await apiBinaryRequest(`/members/${encodeURIComponent(memberId)}/certificate`);
  return {
    data: response.data,
    filename: readFilename(response.headers.get('content-disposition')) || `membership-certificate-${memberId}.pdf`,
    contentType: response.headers.get('content-type') || 'application/pdf',
  };
}

export async function downloadMembershipCard(memberId: string): Promise<CertificateDownload> {
  const response = await apiBinaryRequest(`/members/${encodeURIComponent(memberId)}/membership-card`);
  return {
    data: response.data,
    filename: readFilename(response.headers.get('content-disposition')) || `membership-card-${memberId}.pdf`,
    contentType: response.headers.get('content-type') || 'application/pdf',
  };
}

function readFilename(disposition?: string | null) {
  if (!disposition) return '';
  const encodedMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (encodedMatch?.[1]) return decodeURIComponent(encodedMatch[1].trim().replace(/^"|"$/g, ''));
  const match = disposition.match(/filename="?([^";]+)"?/i);
  return match?.[1]?.trim() || '';
}
