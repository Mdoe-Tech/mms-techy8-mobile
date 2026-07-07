import { apiRequest } from '@/api/client';

export type ReminderFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | string;

export type MessageTemplate = {
  emailSubject?: string | null;
  emailTemplate?: string | null;
  smsTemplate?: string | null;
};

export type ReminderSettings = {
  enabled: boolean;
  daysBefore?: number | null;
  frequency: ReminderFrequency;
  emailSubject: string;
  emailTemplate: string;
  smsTemplate: string;
  reminderSchedule?: number[] | null;
  languageTemplates?: Record<string, MessageTemplate> | null;
};

export type ReminderEmailSettings = {
  fromName: string;
  fromEmail: string;
  replyToEmail?: string | null;
  bccEnabled: boolean;
  bccEmail?: string | null;
};

export type ReminderNotificationSettings = {
  smsEnabled: boolean;
  emailEnabled: boolean;
  smsLanguage?: string | null;
  defaultLanguage?: string | null;
  enabledLanguages?: string[] | null;
};

export type ReminderConfig = {
  associationId: string;
  paymentReminders: ReminderSettings;
  shareReminders: ReminderSettings;
  loanReminders: ReminderSettings;
  subscriptionReminders: ReminderSettings;
  emailSettings: ReminderEmailSettings;
  notificationSettings: ReminderNotificationSettings;
  lastUpdated?: string | null;
  lastUpdatedBy?: string | null;
};

export type ReminderConfigUpdatePayload = Omit<ReminderConfig, 'associationId' | 'lastUpdated' | 'lastUpdatedBy'>;

export type ReminderTriggerType = 'all' | 'payment' | 'share' | 'loan' | 'subscription';

export function getCurrentReminderConfig() {
  return apiRequest<ReminderConfig>('/associations/current/reminder-config');
}

export function updateCurrentReminderConfig(payload: ReminderConfigUpdatePayload) {
  return apiRequest<ReminderConfig>('/associations/current/reminder-config', {
    method: 'PUT',
    body: payload,
  });
}

export function toReminderConfigUpdatePayload(config: ReminderConfig): ReminderConfigUpdatePayload {
  return {
    paymentReminders: config.paymentReminders,
    shareReminders: config.shareReminders,
    loanReminders: config.loanReminders,
    subscriptionReminders: config.subscriptionReminders,
    emailSettings: config.emailSettings,
    notificationSettings: config.notificationSettings,
  };
}

export function resetCurrentReminderConfig() {
  return apiRequest<ReminderConfig>('/associations/current/reminder-config/reset', {
    method: 'POST',
  });
}

export function triggerCurrentReminders(type: ReminderTriggerType) {
  const endpointByType: Record<ReminderTriggerType, string> = {
    all: '/reminders/test-all/current',
    payment: '/reminders/test-payment/current',
    share: '/reminders/test-share/current',
    loan: '/reminders/test-loan/current',
    subscription: '/reminders/test-subscription/current',
  };
  return apiRequest<Record<string, string>>(endpointByType[type], {
    method: 'POST',
  });
}
