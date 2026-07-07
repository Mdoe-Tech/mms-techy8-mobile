import { apiRequest } from '@/api/client';

export type NotificationChannelPolicy = {
  key: 'sms' | 'email' | string;
  enabled: boolean;
  defaultEnabled: boolean;
  editable: boolean;
  settingKey: string;
};

export type NotificationCategoryPolicy = {
  key: string;
  label: string;
  group: string;
  description: string;
  associationManaged: boolean;
  sms: NotificationChannelPolicy;
  email: NotificationChannelPolicy;
  push: NotificationChannelPolicy;
};

export type NotificationPolicy = {
  associationId: string;
  sms: NotificationChannelPolicy;
  email: NotificationChannelPolicy;
  push: NotificationChannelPolicy;
  categories: NotificationCategoryPolicy[];
};

export type NotificationPolicyUpdatePayload = {
  smsEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  categories: Record<string, { smsEnabled: boolean; emailEnabled: boolean; pushEnabled: boolean }>;
};

export function getCurrentNotificationPolicy() {
  return apiRequest<NotificationPolicy>('/associations/current/notification-policy');
}

export function updateCurrentNotificationPolicy(payload: NotificationPolicyUpdatePayload) {
  return apiRequest<NotificationPolicy>('/associations/current/notification-policy', {
    method: 'PUT',
    body: payload,
  });
}
