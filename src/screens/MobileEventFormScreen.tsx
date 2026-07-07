import { router, useLocalSearchParams } from 'expo-router';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Link as LinkIcon,
  MapPin,
  Megaphone,
  RefreshCw,
  Save,
  Send,
  Ticket,
  Users,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileAmountInput,
  MobileButton,
  MobileCard,
  MobileCheckboxRow,
  MobileConfirmSheet,
  MobileErrorState,
  MobileFormSection,
  MobileIconButton,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileSelect,
  MobileStatusBadge,
  MobileText,
  MobileTextInput,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  createAssociationEvent,
  getAssociationEvent,
  getEventPackages,
  updateAssociationEvent,
  type AssociationEvent,
  type AssociationEventPayload,
  type EventPackageOption,
  type EventStatus,
  type EventType,
} from '@/services/event-service';
import { getApiErrorMessage } from '@/types/api';

type FormState = {
  eventName: string;
  eventType: EventType;
  organizerDepartment: string;
  hostUnionBranch: string;
  eventDescription: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  venueLocation: string;
  regionDistrict: string;
  googleMapLink: string;
  meetingLink: string;
  registrationRequired: boolean;
  maxParticipants: string;
  registrationDeadline: string;
  registrationDeadlineTime: string;
  registrationFee: string;
  memberRegistrationFee: string;
  nonMemberRegistrationFee: string;
  packageRegistrationFees: Record<string, string>;
  publicRegistrationEnabled: boolean;
  agendaFilePath: string;
  speakersTrainers: string;
  supportingDocumentsPath: string;
  eventPhotoBannerPath: string;
  postEventReport: string;
  photosMediaPath: string;
  feedbackLink: string;
  budget: string;
  fundingSource: string;
};

type PendingSubmit = 'DRAFT' | 'PUBLISHED' | null;

const eventTypeOptions = [
  { value: 'MEETING', label: 'Meeting' },
  { value: 'AGM', label: 'Annual general meeting' },
  { value: 'WORKSHOP', label: 'Workshop' },
  { value: 'TRAINING', label: 'Training' },
  { value: 'OUTREACH', label: 'Outreach' },
  { value: 'SERVICE', label: 'Service' },
  { value: 'OTHER', label: 'Other' },
];

const emptyForm = (): FormState => ({
  eventName: '',
  eventType: 'MEETING',
  organizerDepartment: '',
  hostUnionBranch: '',
  eventDescription: '',
  startDate: '',
  startTime: '',
  endDate: '',
  endTime: '',
  venueLocation: '',
  regionDistrict: '',
  googleMapLink: '',
  meetingLink: '',
  registrationRequired: false,
  maxParticipants: '',
  registrationDeadline: '',
  registrationDeadlineTime: '',
  registrationFee: '',
  memberRegistrationFee: '',
  nonMemberRegistrationFee: '',
  packageRegistrationFees: {},
  publicRegistrationEnabled: true,
  agendaFilePath: '',
  speakersTrainers: '',
  supportingDocumentsPath: '',
  eventPhotoBannerPath: '',
  postEventReport: '',
  photosMediaPath: '',
  feedbackLink: '',
  budget: '',
  fundingSource: '',
});

export default function MobileEventFormScreen() {
  const params = useLocalSearchParams();
  const { activeView, associationId } = useAuth();
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [packages, setPackages] = useState<EventPackageOption[]>([]);
  const [event, setEvent] = useState<AssociationEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<PendingSubmit>(null);
  const [pendingSubmit, setPendingSubmit] = useState<PendingSubmit>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const eventId = Array.isArray(params.eventId) ? params.eventId[0] : params.eventId;
  const isEdit = Boolean(eventId);

  const manageRoute = useMemo(() => getRouteByPath('/associations/events/manage'), []);

  const loadForm = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before opening the event form.');
        return;
      }

      if (mode === 'initial') setLoading(true);
      setError(null);
      setNotice(null);

      try {
        const [loadedEvent, loadedPackages] = await Promise.all([
          eventId ? getAssociationEvent(associationId, eventId) : Promise.resolve(null),
          getEventPackages(associationId).catch(() => []),
        ]);
        setPackages(loadedPackages);
        setEvent(loadedEvent);
        setForm(loadedEvent ? formFromEvent(loadedEvent) : emptyForm());
      } catch (loadError) {
        setEvent(null);
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
      }
    },
    [associationId, eventId],
  );

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadForm();
    });
    return () => {
      active = false;
    };
  }, [loadForm]);

  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setValidationErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const updatePackageFee = (packageId: string, value: string) => {
    setForm((current) => ({
      ...current,
      packageRegistrationFees: {
        ...current.packageRegistrationFees,
        [packageId]: value,
      },
    }));
    setValidationErrors((current) => {
      const key = `packageRegistrationFees.${packageId}`;
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const submit = async (status: 'DRAFT' | 'PUBLISHED') => {
    if (!associationId) return;
    const nextErrors = validateForm(form);
    setValidationErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError('Please correct the highlighted fields before saving this event.');
      return;
    }

    setSaving(status);
    setError(null);
    setNotice(null);

    try {
      const payload = buildPayload(form, status);
      const saved = isEdit && eventId
        ? await updateAssociationEvent(associationId, eventId, payload)
        : await createAssociationEvent(associationId, payload);

      setEvent(saved);
      setForm(formFromEvent(saved));
      setNotice(status === 'PUBLISHED' ? 'Event published successfully.' : 'Event saved as draft.');
      if (manageRoute) {
        router.replace({ pathname: '/work/route-preview', params: { routeId: manageRoute.id, eventId: saved.id } } as never);
      }
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setSaving(null);
      setPendingSubmit(null);
    }
  };

  const goBack = () => {
    if (manageRoute) router.replace({ pathname: '/work/route-preview', params: { routeId: manageRoute.id } } as never);
    else router.back();
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Association admin only" description="Event creation is available from the association admin workspace." />;
  }

  if (loading) {
    return <MobilePageLoadingState kind="form" message={isEdit ? 'Loading event form' : 'Preparing event form'} />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        title={isEdit ? 'Edit Event' : 'Add Event'}
        eyebrow="Community"
        subtitle="Create schedules, registration rules, fees, resources and public links."
        onBack={goBack}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh" onPress={() => void loadForm('refresh')} disabled={Boolean(saving)} />}
      />

      {error ? <MobileErrorState title="Event form issue" description={error} onRetry={() => setError(null)} retryLabel="Dismiss" /> : null}
      {notice ? (
        <MobileCard compact accent="green">
          <View style={styles.noticeRow}>
            <CheckCircle2 size={18} color="#15803D" />
            <MobileText variant="small" weight="bold" style={styles.noticeText}>
              {notice}
            </MobileText>
          </View>
        </MobileCard>
      ) : null}

      <MobileCard compact accent={form.registrationRequired ? 'teal' : 'blue'}>
        <View style={styles.summaryHeader}>
          <View style={styles.summaryCopy}>
            <MobileText variant="section" weight="bold">
              {form.eventName || 'Untitled event'}
            </MobileText>
            <MobileText variant="small" tone="secondary">
              {form.startDate && form.startTime ? `${form.startDate} at ${form.startTime}` : 'Schedule not set'} · {form.venueLocation || 'Venue not set'}
            </MobileText>
          </View>
          <MobileStatusBadge status={event?.status || (isEdit ? 'Draft' : 'New')} tone={event?.status === 'PUBLISHED' ? 'info' : 'review'} />
        </View>
        <View style={styles.summaryMeta}>
          <MobileStatusBadge status={form.eventType} label={eventTypeOptions.find((item) => item.value === form.eventType)?.label || String(form.eventType)} tone="primary" />
          <MobileStatusBadge status={form.registrationRequired ? 'Registration required' : 'No registration'} tone={form.registrationRequired ? 'success' : 'neutral'} />
          {form.publicRegistrationEnabled && form.registrationRequired ? <MobileStatusBadge status="Public link" tone="info" /> : null}
        </View>
      </MobileCard>

      <MobileFormSection title="Basic Details" description="Name, category, ownership and description.">
        <MobileTextInput
          label="Event Name *"
          value={form.eventName}
          onChangeText={(value) => updateField('eventName', value)}
          placeholder="Annual member training"
          error={validationErrors.eventName}
          icon={Ticket}
        />
        <MobileSelect
          label="Event Type"
          value={String(form.eventType)}
          options={eventTypeOptions}
          onChange={(value) => updateField('eventType', value)}
        />
        <MobileTextInput
          label="Organizer / Department"
          value={form.organizerDepartment}
          onChangeText={(value) => updateField('organizerDepartment', value)}
          placeholder="Training committee"
          icon={Users}
        />
        <MobileTextInput
          label="Host Union / Branch"
          value={form.hostUnionBranch}
          onChangeText={(value) => updateField('hostUnionBranch', value)}
          placeholder="Branch or host unit"
          icon={Users}
        />
        <MobileTextInput
          label="Event Description"
          value={form.eventDescription}
          onChangeText={(value) => updateField('eventDescription', value)}
          placeholder="Purpose, audience and agenda summary"
          multiline
          numberOfLines={4}
          icon={FileText}
        />
      </MobileFormSection>

      <MobileFormSection title="Date & Venue" description="Set when and where members should attend.">
        <View style={styles.twoColumn}>
          <MobileTextInput
            label="Start Date *"
            value={form.startDate}
            onChangeText={(value) => updateField('startDate', value)}
            placeholder="YYYY-MM-DD"
            error={validationErrors.startDate}
            icon={CalendarDays}
          />
          <MobileTextInput
            label="Start Time *"
            value={form.startTime}
            onChangeText={(value) => updateField('startTime', value)}
            placeholder="HH:mm"
            error={validationErrors.startTime}
            icon={Clock3}
          />
        </View>
        <View style={styles.twoColumn}>
          <MobileTextInput
            label="End Date *"
            value={form.endDate}
            onChangeText={(value) => updateField('endDate', value)}
            placeholder="YYYY-MM-DD"
            error={validationErrors.endDate}
            icon={CalendarDays}
          />
          <MobileTextInput
            label="End Time *"
            value={form.endTime}
            onChangeText={(value) => updateField('endTime', value)}
            placeholder="HH:mm"
            error={validationErrors.endTime}
            icon={Clock3}
          />
        </View>
        {validationErrors.endDateTime ? (
          <MobileText variant="small" style={styles.errorText}>
            {validationErrors.endDateTime}
          </MobileText>
        ) : null}
        <MobileTextInput
          label="Venue / Location"
          value={form.venueLocation}
          onChangeText={(value) => updateField('venueLocation', value)}
          placeholder="Main hall"
          icon={MapPin}
        />
        <MobileTextInput
          label="Region / District"
          value={form.regionDistrict}
          onChangeText={(value) => updateField('regionDistrict', value)}
          placeholder="Dar es Salaam"
          icon={MapPin}
        />
        <MobileTextInput
          label="Google Map Link"
          value={form.googleMapLink}
          onChangeText={(value) => updateField('googleMapLink', value)}
          placeholder="https://maps.google.com/..."
          autoCapitalize="none"
          icon={LinkIcon}
        />
        <MobileTextInput
          label="Meeting Link"
          value={form.meetingLink}
          onChangeText={(value) => updateField('meetingLink', value)}
          placeholder="https://meet..."
          autoCapitalize="none"
          icon={LinkIcon}
        />
      </MobileFormSection>

      <MobileFormSection title="Registration & Fees" description="Control RSVP rules, public access and payment amounts.">
        <MobileCheckboxRow
          label="Registration required"
          description="Track RSVPs and payment status for this event."
          checked={form.registrationRequired}
          onChange={(checked) => updateField('registrationRequired', checked)}
        />
        {form.registrationRequired ? (
          <>
            <MobileTextInput
              label="Max Participants"
              value={form.maxParticipants}
              onChangeText={(value) => updateField('maxParticipants', value)}
              placeholder="No limit"
              keyboardType="number-pad"
              error={validationErrors.maxParticipants}
              icon={Users}
            />
            <View style={styles.twoColumn}>
              <MobileTextInput
                label="Deadline Date"
                value={form.registrationDeadline}
                onChangeText={(value) => updateField('registrationDeadline', value)}
                placeholder="YYYY-MM-DD"
                error={validationErrors.registrationDeadline}
                icon={CalendarDays}
              />
              <MobileTextInput
                label="Deadline Time"
                value={form.registrationDeadlineTime}
                onChangeText={(value) => updateField('registrationDeadlineTime', value)}
                placeholder="HH:mm"
                error={validationErrors.registrationDeadlineTime}
                icon={Clock3}
              />
            </View>
            <MobileAmountInput
              label="Fallback Registration Fee"
              value={form.registrationFee}
              onChangeText={(value) => updateField('registrationFee', value)}
              helperText="Used when no member/non-member/package fee applies."
              error={validationErrors.registrationFee}
            />
            <View style={styles.twoColumn}>
              <MobileAmountInput
                label="Member Fee"
                value={form.memberRegistrationFee}
                onChangeText={(value) => updateField('memberRegistrationFee', value)}
                error={validationErrors.memberRegistrationFee}
              />
              <MobileAmountInput
                label="Non-member Fee"
                value={form.nonMemberRegistrationFee}
                onChangeText={(value) => updateField('nonMemberRegistrationFee', value)}
                error={validationErrors.nonMemberRegistrationFee}
              />
            </View>
            {packages.length > 0 ? (
              <MobileCard compact>
                <MobileText variant="body" weight="bold">
                  Package-specific fees
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  These override the member fee for members in the selected package.
                </MobileText>
                <View style={styles.packageFees}>
                  {packages.map((pkg) => (
                    <MobileAmountInput
                      key={pkg.id}
                      label={pkg.name || 'Membership package'}
                      value={form.packageRegistrationFees[pkg.id] || ''}
                      onChangeText={(value) => updatePackageFee(pkg.id, value)}
                      error={validationErrors[`packageRegistrationFees.${pkg.id}`]}
                    />
                  ))}
                </View>
              </MobileCard>
            ) : null}
            <MobileCheckboxRow
              label="Enable public registration link"
              description="Allow non-members and website visitors to open the registration form without signing in."
              checked={form.publicRegistrationEnabled}
              onChange={(checked) => updateField('publicRegistrationEnabled', checked)}
            />
          </>
        ) : (
          <MobileText variant="small" tone="secondary">
            Registration fields are hidden because this event does not require RSVP tracking.
          </MobileText>
        )}
      </MobileFormSection>

      <MobileFormSection title="Agenda & Resources" description="Attach paths or links for files already uploaded to the system.">
        <MobileTextInput
          label="Agenda File Path"
          value={form.agendaFilePath}
          onChangeText={(value) => updateField('agendaFilePath', value)}
          placeholder="/uploads/events/agenda.pdf"
          autoCapitalize="none"
          icon={FileText}
        />
        <MobileTextInput
          label="Speakers / Trainers"
          value={form.speakersTrainers}
          onChangeText={(value) => updateField('speakersTrainers', value)}
          placeholder="Names, roles and facilitation notes"
          multiline
          numberOfLines={3}
          icon={Megaphone}
        />
        <MobileTextInput
          label="Supporting Documents Path"
          value={form.supportingDocumentsPath}
          onChangeText={(value) => updateField('supportingDocumentsPath', value)}
          placeholder="/uploads/events/supporting.zip"
          autoCapitalize="none"
          icon={FileText}
        />
        <MobileTextInput
          label="Event Photo / Banner Path"
          value={form.eventPhotoBannerPath}
          onChangeText={(value) => updateField('eventPhotoBannerPath', value)}
          placeholder="/uploads/events/banner.jpg"
          autoCapitalize="none"
          icon={FileText}
        />
      </MobileFormSection>

      <MobileFormSection title="Reporting & Follow-up" description="Record budget, reporting, media and feedback references.">
        <MobileTextInput
          label="Post Event Report / Summary"
          value={form.postEventReport}
          onChangeText={(value) => updateField('postEventReport', value)}
          placeholder="Summary after the event"
          multiline
          numberOfLines={4}
          icon={FileText}
        />
        <MobileTextInput
          label="Photos / Media Path"
          value={form.photosMediaPath}
          onChangeText={(value) => updateField('photosMediaPath', value)}
          placeholder="/uploads/events/media.zip"
          autoCapitalize="none"
          icon={FileText}
        />
        <MobileTextInput
          label="Feedback Link"
          value={form.feedbackLink}
          onChangeText={(value) => updateField('feedbackLink', value)}
          placeholder="https://forms..."
          autoCapitalize="none"
          icon={LinkIcon}
        />
        <View style={styles.twoColumn}>
          <MobileAmountInput
            label="Budget"
            value={form.budget}
            onChangeText={(value) => updateField('budget', value)}
            error={validationErrors.budget}
          />
          <MobileTextInput
            label="Funding Source"
            value={form.fundingSource}
            onChangeText={(value) => updateField('fundingSource', value)}
            placeholder="Association fund"
          />
        </View>
      </MobileFormSection>

      <View style={styles.actions}>
        <MobileButton label="Cancel" variant="secondary" onPress={goBack} disabled={Boolean(saving)} />
        <MobileButton
          label="Save Draft"
          icon={Save}
          variant="secondary"
          onPress={() => void submit('DRAFT')}
          loading={saving === 'DRAFT'}
          disabled={Boolean(saving)}
        />
        <MobileButton
          label="Publish"
          icon={Send}
          onPress={() => setPendingSubmit('PUBLISHED')}
          loading={saving === 'PUBLISHED'}
          disabled={Boolean(saving)}
        />
      </View>

      <MobileConfirmSheet
        visible={pendingSubmit === 'PUBLISHED'}
        title="Publish event"
        description="Publishing can send member notifications and makes the public registration link available when registration is enabled."
        confirmLabel={saving === 'PUBLISHED' ? 'Publishing...' : 'Publish Event'}
        onCancel={() => setPendingSubmit(null)}
        onConfirm={() => void submit('PUBLISHED')}
      />
    </MobileScreen>
  );
}

function formFromEvent(event: AssociationEvent): FormState {
  const start = splitDateTime(event.startDate);
  const end = splitDateTime(event.endDate);
  const deadline = splitDateTime(event.registrationDeadline);
  const packageFees = Object.entries(event.packageRegistrationFees || {}).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[key] = amountToText(value);
    return acc;
  }, {});

  return {
    eventName: event.eventName || '',
    eventType: event.eventType || 'MEETING',
    organizerDepartment: event.organizerDepartment || '',
    hostUnionBranch: event.hostUnionBranch || '',
    eventDescription: event.eventDescription || '',
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
    venueLocation: event.venueLocation || '',
    regionDistrict: event.regionDistrict || '',
    googleMapLink: event.googleMapLink || '',
    meetingLink: event.meetingLink || '',
    registrationRequired: event.registrationRequired === true,
    maxParticipants: event.maxParticipants ? String(event.maxParticipants) : '',
    registrationDeadline: deadline.date,
    registrationDeadlineTime: deadline.time,
    registrationFee: amountToText(event.registrationFee),
    memberRegistrationFee: amountToText(event.memberRegistrationFee),
    nonMemberRegistrationFee: amountToText(event.nonMemberRegistrationFee),
    packageRegistrationFees: packageFees,
    publicRegistrationEnabled: event.publicRegistrationEnabled !== false,
    agendaFilePath: event.agendaFilePath || '',
    speakersTrainers: '',
    supportingDocumentsPath: event.supportingDocumentsPath || '',
    eventPhotoBannerPath: event.eventPhotoBannerPath || '',
    postEventReport: event.postEventReport || '',
    photosMediaPath: event.photosMediaPath || '',
    feedbackLink: event.feedbackLink || '',
    budget: amountToText(event.budget),
    fundingSource: event.fundingSource || '',
  };
}

function validateForm(form: FormState) {
  const errors: Record<string, string> = {};
  if (!form.eventName.trim()) errors.eventName = 'Event name is required.';
  if (!isValidDate(form.startDate)) errors.startDate = 'Use YYYY-MM-DD.';
  if (!isValidTime(form.startTime)) errors.startTime = 'Use HH:mm.';
  if (!isValidDate(form.endDate)) errors.endDate = 'Use YYYY-MM-DD.';
  if (!isValidTime(form.endTime)) errors.endTime = 'Use HH:mm.';

  const start = toDateTime(form.startDate, form.startTime);
  const end = toDateTime(form.endDate, form.endTime);
  if (start && end && end.getTime() <= start.getTime()) {
    errors.endDateTime = 'End date and time must be after the start date and time.';
  }

  if (form.registrationDeadline || form.registrationDeadlineTime) {
    if (!isValidDate(form.registrationDeadline)) errors.registrationDeadline = 'Use YYYY-MM-DD.';
    if (!isValidTime(form.registrationDeadlineTime)) errors.registrationDeadlineTime = 'Use HH:mm.';
  }

  if (form.maxParticipants.trim()) {
    const participants = positiveIntegerOrNull(form.maxParticipants);
    if (participants === null) errors.maxParticipants = 'Use a positive whole number.';
  }
  validateAmount(errors, 'registrationFee', form.registrationFee);
  validateAmount(errors, 'memberRegistrationFee', form.memberRegistrationFee);
  validateAmount(errors, 'nonMemberRegistrationFee', form.nonMemberRegistrationFee);
  validateAmount(errors, 'budget', form.budget);
  Object.entries(form.packageRegistrationFees).forEach(([packageId, value]) => {
    validateAmount(errors, `packageRegistrationFees.${packageId}`, value);
  });
  return errors;
}

function buildPayload(form: FormState, status: EventStatus): AssociationEventPayload {
  const registrationRequired = form.registrationRequired;
  const packageRegistrationFees = Object.entries(form.packageRegistrationFees).reduce<Record<string, number>>(
    (acc, [key, value]) => {
      const amount = positiveAmountOrNull(value);
      if (amount !== null) acc[key] = amount;
      return acc;
    },
    {},
  );

  return {
    eventName: form.eventName.trim(),
    eventType: form.eventType,
    organizerDepartment: textOrNull(form.organizerDepartment),
    hostUnionBranch: textOrNull(form.hostUnionBranch),
    eventDescription: textOrNull(form.eventDescription),
    startDate: `${form.startDate}T${form.startTime}:00`,
    endDate: `${form.endDate}T${form.endTime}:00`,
    venueLocation: textOrNull(form.venueLocation),
    regionDistrict: textOrNull(form.regionDistrict),
    googleMapLink: textOrNull(form.googleMapLink),
    meetingLink: textOrNull(form.meetingLink),
    registrationRequired,
    maxParticipants: registrationRequired && form.maxParticipants ? positiveIntegerOrNull(form.maxParticipants) : null,
    registrationDeadline: registrationRequired && form.registrationDeadline && form.registrationDeadlineTime
      ? `${form.registrationDeadline}T${form.registrationDeadlineTime}:00`
      : null,
    registrationFee: registrationRequired ? positiveAmountOrNull(form.registrationFee) : null,
    memberRegistrationFee: registrationRequired ? positiveAmountOrNull(form.memberRegistrationFee) : null,
    nonMemberRegistrationFee: registrationRequired ? positiveAmountOrNull(form.nonMemberRegistrationFee) : null,
    packageRegistrationFees,
    publicRegistrationEnabled: registrationRequired && form.publicRegistrationEnabled,
    paymentLink: null,
    agendaFilePath: textOrNull(form.agendaFilePath),
    speakersTrainers: textOrNull(form.speakersTrainers),
    supportingDocumentsPath: textOrNull(form.supportingDocumentsPath),
    eventPhotoBannerPath: textOrNull(form.eventPhotoBannerPath),
    postEventReport: textOrNull(form.postEventReport),
    photosMediaPath: textOrNull(form.photosMediaPath),
    feedbackLink: textOrNull(form.feedbackLink),
    budget: positiveAmountOrNull(form.budget),
    fundingSource: textOrNull(form.fundingSource),
    status,
  };
}

function splitDateTime(value?: string | null) {
  if (!value) return { date: '', time: '' };
  const [date, time = ''] = value.split('T');
  return {
    date: date || '',
    time: time.slice(0, 5),
  };
}

function amountToText(value?: number | string | null) {
  const next = Number(value || 0);
  return next > 0 ? String(next) : '';
}

function textOrNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function positiveAmountOrNull(value: string) {
  const next = Number(value.replace(/,/g, '').trim() || 0);
  return Number.isFinite(next) && next > 0 ? next : null;
}

function positiveIntegerOrNull(value: string) {
  const next = Number(value.replace(/,/g, '').trim());
  return Number.isInteger(next) && next > 0 ? next : null;
}

function validateAmount(errors: Record<string, string>, key: string, value: string) {
  if (!value.trim()) return;
  const next = Number(value.replace(/,/g, '').trim());
  if (!Number.isFinite(next) || next < 0) {
    errors[key] = 'Use a valid amount.';
  }
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime());
}

function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function toDateTime(date: string, time: string) {
  if (!isValidDate(date) || !isValidTime(time)) return null;
  return new Date(`${date}T${time}:00`);
}

const styles = StyleSheet.create({
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  noticeText: {
    flex: 1,
    color: '#15803D',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  summaryMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  twoColumn: {
    gap: 12,
  },
  packageFees: {
    gap: 12,
    marginTop: 10,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  errorText: {
    color: '#B91C1C',
  },
});
