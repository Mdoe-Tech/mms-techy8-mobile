import { apiBinaryRequest, apiRequest } from '@/api/client';

export type ProfilePictureUploadFile = {
  uri: string;
  name: string;
  mimeType?: string | null;
};

export async function getCurrentProfilePicture() {
  const url = await apiRequest<string | null>('/profile-picture/current');
  return typeof url === 'string' && url.trim() ? url.trim() : null;
}

export async function uploadProfilePicture(file: ProfilePictureUploadFile) {
  const formData = new FormData();
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType || 'application/octet-stream',
  } as unknown as Blob);

  const url = await apiRequest<string>('/profile-picture/upload', {
    method: 'POST',
    body: formData,
  });
  return typeof url === 'string' && url.trim() ? url.trim() : null;
}

export async function downloadProfilePicture(profilePictureUrl: string) {
  const response = await apiBinaryRequest(profilePictureUrl);
  return {
    data: response.data,
    contentType: response.headers.get('content-type') || 'application/octet-stream',
  };
}
