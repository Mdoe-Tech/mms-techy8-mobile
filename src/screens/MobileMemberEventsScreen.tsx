import { router } from 'expo-router';
import {
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  ExternalLink,
  MapPin,
  RefreshCw,
  Share2,
  ShieldAlert,
  Ticket,
  Users,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, ScrollView, Share, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileConfirmSheet,
  MobileDataList,
  type MobileDataListItem,
  MobileEmptyState,
  MobileErrorState,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileSearchToolbar,
  MobileSheet,
  MobileSortSheet,
  type MobileSortOption,
  MobileScreen,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileSummaryPanel,
  MobileText,
  MobileToast,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import { getMemberEvents, registerMemberForEvent, type AssociationEvent, type EventStatus } from '@/services/event-service';
import { getCurrentMemberByUserId, type AssociationMember } from '@/services/member-service';
import { type KpiTone, type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate, formatNumber } from '@/utils/format';

type StatusFilter = 'all' | 'upcoming' | 'registered' | 'history' | 'free' | 'paid';
type SortOption = 'startAsc' | 'startDesc' | 'nameAsc' | 'feeDesc';
type Notice = { title: string; description?: string; tone?: StatusTone } | null;

const sortOptions: MobileSortOption[] = [
  { value: 'startAsc', label: 'Soonest first', description: 'Upcoming events closest to today.' },
  { value: 'startDesc', label: 'Latest first', description: 'Newest event dates first.' },
  { value: 'nameAsc', label: 'Event name', description: 'A to Z by event title.' },
  { value: 'feeDesc', label: 'Highest fee', description: 'Paid registrations first.' },
];

const eventTypeLabels: Record<string, string> = {
  MEETING: 'Meeting',
  TRAINING: 'Training',
  WORKSHOP: 'Workshop',
  AGM: 'Annual Meeting',
  OUTREACH: 'Outreach',
  SERVICE: 'Service',
  CONFERENCE: 'Conference',
  SOCIAL: 'Social',
  OTHER: 'Other',
};

export default function MobileMemberEventsScreen() {
  const { activeView, associationId, user } = useAuth();
  const [member, setMember] = useState<AssociationMember | null>(null);
  const [events, setEvents] = useState<AssociationEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<AssociationEvent | null>(null);
  const [pendingEvent, setPendingEvent] = useState<AssociationEvent | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortValue, setSortValue] = useState<SortOption>('startAsc');
  const [sortOpen, setSortOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const userId = user?.userId;

  const loadEvents = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!userId || !associationId) {
        setLoading(false);
        setError('Member and association context are required before opening events.');
        return;
      }

      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);
      setNotice(null);

      try {
        const currentMember = await getCurrentMemberByUserId(userId);
        const rows = await getMemberEvents(associationId, currentMember.id);
        setMember(currentMember);
        setEvents(rows);
        setSelectedEvent((current) => rows.find((event) => event.id === current?.id) || null);
      } catch (loadError) {
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId, userId],
  );

  useEffect(() => {
    if (activeView === 'MEMBER') {
      void Promise.resolve().then(() => loadEvents());
    }
  }, [activeView, loadEvents]);

  const summary = useMemo(() => buildSummary(events), [events]);
  const filteredEvents = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    const filtered = events.filter((event) => {
      const status = eventLifecycle(event);
      const fee = eventFee(event);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'upcoming' && ['UPCOMING', 'ONGOING', 'PUBLISHED'].includes(status)) ||
        (statusFilter === 'registered' && event.memberRegistered === true) ||
        (statusFilter === 'history' && ['COMPLETED', 'CANCELLED'].includes(status)) ||
        (statusFilter === 'free' && fee <= 0) ||
        (statusFilter === 'paid' && fee > 0);

      if (!matchesStatus) return false;
      if (!needle) return true;
      return [
        event.eventName,
        event.eventType,
        eventTypeLabel(event.eventType),
        event.venueLocation,
        event.regionDistrict,
        event.eventDescription,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });

    return sortEvents(filtered, sortValue);
  }, [events, searchTerm, sortValue, statusFilter]);

  const statusTabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: summary.total },
      { value: 'upcoming', label: 'Upcoming', count: summary.upcoming },
      { value: 'registered', label: 'Registered', count: summary.registered },
      { value: 'history', label: 'History', count: summary.history },
      { value: 'free', label: 'Free', count: summary.free },
      { value: 'paid', label: 'Paid', count: summary.paid },
    ],
    [summary],
  );

  const eventItems = useMemo<MobileDataListItem[]>(
    () =>
      filteredEvents.map((event) => {
        const lifecycle = eventLifecycle(event);
        const statusLabel = event.memberRegistered ? 'Registered' : statusLabels(lifecycle);
        const tone = event.memberRegistered ? 'success' : eventStatusTone(lifecycle);
        return {
          id: event.id,
          title: event.eventName,
          subtitle: `${eventTypeLabel(event.eventType)} · ${event.venueLocation || 'Venue not set'}`,
          meta: `${formatEventDateRange(event)} · ${formatEventTimeRange(event)}`,
          amount: feeLabel(event),
          status: statusLabel,
          statusLabel,
          statusTone: tone,
          accent: tone,
        };
      }),
    [filteredEvents],
  );

  if (activeView !== 'MEMBER') {
    return (
      <AccessDeniedScreen
        title="Member workspace required"
        description="Events are available from the member portal workspace."
      />
    );
  }

  if (loading) {
    return <MobilePageLoadingState kind="list" message="Loading member events" />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Community"
        title="Events"
        subtitle={member?.membershipNumber || user?.associationName || 'Member portal'}
        onBack={() => router.back()}
        rightAction={<MobileStatusBadge status={refreshing ? 'Refreshing' : 'Ready'} tone={refreshing ? 'info' : 'success'} />}
      />

      {notice ? <MobileToast title={notice.title} description={notice.description} tone={notice.tone || 'success'} /> : null}
      {error ? (
        <MobileErrorState
          title="Events could not load"
          description={error}
          retryLabel="Retry"
          onRetry={() => void loadEvents('refresh')}
        />
      ) : null}

      <MobileSummaryPanel
        title="Upcoming Events"
        value={formatNumber(summary.upcoming)}
        description={summary.nextEvent ? `Next: ${summary.nextEvent.eventName}` : 'Community gatherings and meetings'}
        icon={CalendarDays}
        tone={summary.upcoming > 0 ? 'blue' : 'slate'}
        footer={
          <View style={styles.summaryActions}>
            <MobileButton
              label="Refresh"
              icon={RefreshCw}
              variant="secondary"
              size="sm"
              loading={refreshing}
              disabled={refreshing || registering}
              onPress={() => void loadEvents('refresh')}
              style={styles.summaryButton}
            />
            <MobileButton
              label="Registered"
              icon={CheckCircle2}
              variant="ghost"
              size="sm"
              onPress={() => setStatusFilter('registered')}
              style={styles.summaryButton}
            />
          </View>
        }
      />

      <MobileCard compact>
        <View style={styles.toolbarHeader}>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold">
              Event Portfolio
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Showing {formatNumber(filteredEvents.length)} of {formatNumber(summary.total)} events.
            </MobileText>
          </View>
          <MobileStatusBadge status={summary.registered > 0 ? 'Registered' : 'Open'} tone={summary.registered > 0 ? 'success' : 'info'} />
        </View>

        <MobileSearchToolbar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search event, venue, type"
          onFilterPress={() => setSortOpen(true)}
          filterLabel="Sort"
        />
        <MobileStatusTabs tabs={statusTabs} value={statusFilter} onChange={(value) => setStatusFilter(value as StatusFilter)} />
      </MobileCard>

      {filteredEvents.length > 0 ? (
        <MobileDataList
          items={eventItems}
          onPressItem={(item) => {
            const event = filteredEvents.find((row) => row.id === item.id);
            if (event) setSelectedEvent(event);
          }}
        />
      ) : (
        <MobileEmptyState
          title={searchTerm || statusFilter !== 'all' ? 'No matching events' : 'No events yet'}
          description={
            searchTerm || statusFilter !== 'all'
              ? 'Adjust search or status filters to find more events.'
              : 'Upcoming meetings, workshops, trainings and gatherings will appear here.'
          }
          actionLabel={searchTerm || statusFilter !== 'all' ? 'Clear filters' : 'Refresh'}
          onAction={() => {
            if (searchTerm || statusFilter !== 'all') {
              setSearchTerm('');
              setStatusFilter('all');
            } else {
              void loadEvents('refresh');
            }
          }}
        />
      )}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="All Events" value={formatNumber(summary.total)} description="Published for members" icon={CalendarDays} tone="blue" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Registered" value={formatNumber(summary.registered)} description="Your RSVP records" icon={CheckCircle2} tone="green" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Paid Events" value={formatNumber(summary.paid)} description="Require payment" icon={CreditCard} tone="orange" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="History" value={formatNumber(summary.history)} description="Past or cancelled" icon={CalendarCheck2} tone="slate" />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <EventDetailSheet
        event={selectedEvent}
        member={member}
        registering={registering}
        onClose={() => setSelectedEvent(null)}
        onRegister={(event) => setPendingEvent(event)}
      />

      <MobileSortSheet
        visible={sortOpen}
        value={sortValue}
        options={sortOptions}
        onChange={(value) => setSortValue(value as SortOption)}
        onClose={() => setSortOpen(false)}
      />

      <MobileConfirmSheet
        visible={Boolean(pendingEvent)}
        title="Confirm registration?"
        description={pendingEvent ? registrationConfirmText(pendingEvent) : ''}
        confirmLabel={registering ? 'Registering...' : 'Confirm'}
        loading={registering}
        onCancel={() => {
          if (!registering) setPendingEvent(null);
        }}
        onConfirm={handleRegister}
      />
    </MobileScreen>
  );

  async function handleRegister() {
    if (!pendingEvent || !member || !associationId) return;
    setRegistering(true);
    try {
      const result = await registerMemberForEvent(associationId, {
        eventId: pendingEvent.id,
        memberId: member.id,
        status: 'CONFIRMED',
      });

      if (result.paymentLink) {
        await Linking.openURL(result.paymentLink);
        setNotice({ title: 'Registration started', description: 'Opening payment to secure your seat.', tone: 'info' });
      } else {
        setNotice({ title: 'Registration confirmed', description: 'Your event seat has been reserved.' });
      }

      setPendingEvent(null);
      await loadEvents('refresh');
    } catch (registerError) {
      setNotice({
        title: 'Registration failed',
        description: getApiErrorMessage(registerError),
        tone: 'danger',
      });
    } finally {
      setRegistering(false);
    }
  }
}

function EventDetailSheet({
  event,
  member,
  registering,
  onClose,
  onRegister,
}: {
  event: AssociationEvent | null;
  member: AssociationMember | null;
  registering: boolean;
  onClose: () => void;
  onRegister: (event: AssociationEvent) => void;
}) {
  if (!event) {
    return null;
  }

  const lifecycle = eventLifecycle(event);
  const canRegister = canRegisterForEvent(event);
  const registered = event.memberRegistered === true;

  return (
    <MobileSheet
      visible={Boolean(event)}
      title={event.eventName}
      description={`${eventTypeLabel(event.eventType)} · ${formatEventDateRange(event)}`}
      onClose={onClose}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailContent}>
        <MobileCard compact accent={eventKpiTone(lifecycle)}>
          <View style={styles.sectionHeader}>
            <View style={styles.flex}>
              <MobileStatusBadge
                status={registered ? 'Registered' : statusLabels(lifecycle)}
                tone={registered ? 'success' : eventStatusTone(lifecycle)}
              />
              <MobileText variant="section" weight="bold">
                {formatEventTimeRange(event)}
              </MobileText>
              <MobileText variant="small" tone="secondary">
                {event.venueLocation || 'Venue not set'}
              </MobileText>
            </View>
            <MobileStatusBadge status={feeLabel(event)} tone={eventFee(event) > 0 ? 'warning' : 'success'} />
          </View>
        </MobileCard>

        <MobileCard compact>
          <MobileInfoRow label="Type" value={eventTypeLabel(event.eventType)} icon={Ticket} />
          <MobileInfoRow label="Schedule" value={formatEventDateRange(event)} helper={formatEventTimeRange(event)} icon={Clock3} />
          <MobileInfoRow label="Venue" value={event.venueLocation || 'Not set'} helper={event.regionDistrict || undefined} icon={MapPin} />
          <MobileInfoRow
            label="Attendance"
            value={`${formatNumber(Number(event.registrationCount || 0))} registered`}
            helper={event.maxParticipants ? `${formatNumber(Number(event.maxParticipants))} maximum participants` : 'No participant limit captured'}
            icon={Users}
          />
          <MobileInfoRow
            label="Member"
            value={memberName(member)}
            helper={member?.membershipNumber || 'Current member'}
            icon={ShieldAlert}
          />
        </MobileCard>

        {event.eventDescription ? (
          <MobileCard compact>
            <MobileText variant="section" weight="bold">
              Description
            </MobileText>
            <MobileText variant="small" tone="secondary">
              {event.eventDescription}
            </MobileText>
          </MobileCard>
        ) : null}

        <MobileCard compact accent={event.registrationRequired ? 'blue' : 'slate'}>
          <View style={styles.sectionHeader}>
            <View style={styles.flex}>
              <MobileText variant="section" weight="bold">
                Registration
              </MobileText>
              <MobileText variant="small" tone="secondary">
                {registrationHelper(event)}
              </MobileText>
            </View>
            <MobileStatusBadge status={registered ? 'Registered' : event.registrationRequired ? 'Required' : 'Optional'} tone={registered ? 'success' : event.registrationRequired ? 'info' : 'neutral'} />
          </View>
          <MobileInfoRow label="Fee" value={feeLabel(event)} icon={CreditCard} />
          <MobileInfoRow label="Deadline" value={formatDate(event.registrationDeadline)} icon={CalendarDays} />
          {registered ? (
            <MobileToast title="Seat reserved" description="Your registration is already recorded for this event." />
          ) : canRegister ? (
            <MobileButton
              label={eventFee(event) > 0 ? 'Secure seat' : 'Register'}
              icon={CheckCircle2}
              fullWidth
              disabled={registering}
              onPress={() => onRegister(event)}
            />
          ) : (
            <MobileToast title="Registration unavailable" description={registrationClosedReason(event)} tone="warning" />
          )}
        </MobileCard>

        {event.googleMapLink || event.meetingLink || event.publicRegistrationUrl || event.publicEventListUrl ? (
          <View style={styles.actions}>
            {event.googleMapLink ? <MobileButton label="Map" icon={MapPin} variant="secondary" onPress={() => void openLink(event.googleMapLink)} /> : null}
            {event.meetingLink ? <MobileButton label="Meeting" icon={ExternalLink} variant="secondary" onPress={() => void openLink(event.meetingLink)} /> : null}
            {event.publicRegistrationUrl ? <MobileButton label="Public Link" icon={ExternalLink} variant="secondary" onPress={() => void openLink(event.publicRegistrationUrl)} /> : null}
            {event.publicEventListUrl ? <MobileButton label="Event List" icon={ExternalLink} variant="secondary" onPress={() => void openLink(event.publicEventListUrl)} /> : null}
          </View>
        ) : null}

        <MobileButton
          label="Share Event"
          icon={Share2}
          variant="secondary"
          fullWidth
          onPress={() => void shareEvent(event)}
        />
      </ScrollView>
    </MobileSheet>
  );
}

function buildSummary(events: AssociationEvent[]) {
  const upcomingEvents = events.filter((event) => ['UPCOMING', 'ONGOING', 'PUBLISHED'].includes(eventLifecycle(event)));
  return {
    total: events.length,
    upcoming: upcomingEvents.length,
    registered: events.filter((event) => event.memberRegistered).length,
    history: events.filter((event) => ['COMPLETED', 'CANCELLED'].includes(eventLifecycle(event))).length,
    paid: events.filter((event) => eventFee(event) > 0).length,
    free: events.filter((event) => eventFee(event) <= 0).length,
    nextEvent: sortEvents(upcomingEvents, 'startAsc')[0] || null,
  };
}

function eventLifecycle(event: AssociationEvent): EventStatus {
  const explicit = String(event.status || '').toUpperCase();
  if (explicit === 'DRAFT' || explicit === 'CANCELLED') return explicit;

  const now = Date.now();
  const start = new Date(event.startDate || '').getTime();
  const end = new Date(event.endDate || '').getTime();
  if (Number.isFinite(start) && now < start) return 'UPCOMING';
  if (Number.isFinite(start) && Number.isFinite(end) && now >= start && now <= end) return 'ONGOING';
  if (Number.isFinite(end) && now > end) return 'COMPLETED';
  return explicit || 'PUBLISHED';
}

function eventStatusTone(status?: string | null): StatusTone {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'UPCOMING' || normalized === 'PUBLISHED') return 'info';
  if (normalized === 'ONGOING') return 'success';
  if (normalized === 'COMPLETED') return 'neutral';
  if (normalized === 'CANCELLED') return 'danger';
  if (normalized === 'DRAFT') return 'review';
  return 'neutral';
}

function eventKpiTone(status?: string | null): KpiTone {
  const tone = eventStatusTone(status);
  if (tone === 'success') return 'green';
  if (tone === 'danger') return 'red';
  if (tone === 'review') return 'purple';
  if (tone === 'neutral') return 'slate';
  return 'blue';
}

function statusLabels(status?: string | null) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'UPCOMING') return 'Upcoming';
  if (normalized === 'ONGOING') return 'Ongoing';
  if (normalized === 'COMPLETED') return 'Completed';
  if (normalized === 'CANCELLED') return 'Cancelled';
  if (normalized === 'DRAFT') return 'Draft';
  return 'Published';
}

function eventTypeLabel(type?: string | null) {
  const normalized = String(type || 'OTHER').toUpperCase();
  return eventTypeLabels[normalized] || normalized.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function eventFee(event: AssociationEvent) {
  return Number(event.registrationFee || event.memberRegistrationFee || 0);
}

function feeLabel(event: AssociationEvent) {
  if (!event.registrationRequired) return 'No RSVP';
  const fee = eventFee(event);
  return fee > 0 ? formatCurrency(fee) : 'Free';
}

function canRegisterForEvent(event: AssociationEvent) {
  if (!event.registrationRequired || event.memberRegistered) return false;
  const lifecycle = eventLifecycle(event);
  if (!['UPCOMING', 'ONGOING', 'PUBLISHED'].includes(lifecycle)) return false;
  if (registrationDeadlinePassed(event)) return false;
  if (event.maxParticipants && Number(event.registrationCount || 0) >= Number(event.maxParticipants)) return false;
  return true;
}

function registrationDeadlinePassed(event: AssociationEvent) {
  if (!event.registrationDeadline) return false;
  const deadline = new Date(event.registrationDeadline).getTime();
  return Number.isFinite(deadline) && Date.now() > deadline;
}

function registrationClosedReason(event: AssociationEvent) {
  if (!event.registrationRequired) return 'This event does not require RSVP tracking.';
  if (event.memberRegistered) return 'Your registration is already recorded.';
  if (registrationDeadlinePassed(event)) return 'The registration deadline has passed.';
  if (event.maxParticipants && Number(event.registrationCount || 0) >= Number(event.maxParticipants)) return 'This event has reached its participant limit.';
  if (!['UPCOMING', 'ONGOING', 'PUBLISHED'].includes(eventLifecycle(event))) return 'This event is not accepting new registrations.';
  return 'Registration is not available for this event.';
}

function registrationHelper(event: AssociationEvent) {
  if (!event.registrationRequired) return 'You can attend without a seat reservation.';
  if (event.memberRegistered) return 'Your registration is already recorded.';
  return eventFee(event) > 0 ? 'Payment may be required after confirmation.' : 'Confirm to reserve your seat.';
}

function registrationConfirmText(event: AssociationEvent) {
  const fee = eventFee(event);
  if (fee > 0) {
    return `${event.eventName} requires ${formatCurrency(fee)}. After confirmation, payment may open to secure your seat.`;
  }
  return `Confirm registration for ${event.eventName}.`;
}

function sortEvents(events: AssociationEvent[], sortValue: SortOption) {
  return [...events].sort((left, right) => {
    if (sortValue === 'nameAsc') return left.eventName.localeCompare(right.eventName);
    if (sortValue === 'feeDesc') return eventFee(right) - eventFee(left);
    const leftTime = new Date(left.startDate || '').getTime() || 0;
    const rightTime = new Date(right.startDate || '').getTime() || 0;
    return sortValue === 'startDesc' ? rightTime - leftTime : leftTime - rightTime;
  });
}

function formatEventDateRange(event: AssociationEvent) {
  const start = formatDate(event.startDate);
  const end = formatDate(event.endDate);
  if (!event.endDate || start === end) return start;
  return `${start} - ${end}`;
}

function formatEventTimeRange(event: AssociationEvent) {
  const start = formatTime(event.startDate);
  const end = formatTime(event.endDate);
  if (start === 'Time not set' && end === 'Time not set') return 'Time not set';
  if (end === 'Time not set' || start === end) return start;
  return `${start} - ${end}`;
}

function formatTime(value?: string | null) {
  if (!value) return 'Time not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time not set';
  return new Intl.DateTimeFormat('en-TZ', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function memberName(member: AssociationMember | null) {
  return member?.fullLegalName || 'Current member';
}

async function openLink(url?: string | null) {
  if (!url) return;
  await Linking.openURL(url);
}

async function shareEvent(event: AssociationEvent) {
  await Share.share({
    message: [event.eventName, formatEventDateRange(event), event.venueLocation, event.publicRegistrationUrl || event.meetingLink]
      .filter(Boolean)
      .join('\n'),
  });
}

const styles = StyleSheet.create({
  summaryActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryButton: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 132,
  },
  toolbarHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  detailContent: {
    gap: 12,
    paddingBottom: 12,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
});
