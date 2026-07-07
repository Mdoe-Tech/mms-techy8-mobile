import { router, useLocalSearchParams } from 'expo-router';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Edit3,
  ExternalLink,
  Link as LinkIcon,
  MapPin,
  Plus,
  RefreshCw,
  Share2,
  Ticket,
  Trash2,
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
  MobileIconButton,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileReportExportButton,
  MobileScreen,
  MobileSearchToolbar,
  MobileSheet,
  MobileSortSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  deleteAssociationEvent,
  getAssociationEvents,
  getEventNonRegistrants,
  getEventRegistrations,
  type AssociationEvent,
  type EventNonRegistrant,
  type EventRegistration,
  type EventStatus,
} from '@/services/event-service';
import { type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate, formatNumber } from '@/utils/format';

type StatusFilter = 'all' | 'DRAFT' | 'PUBLISHED' | 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
type SortOption = 'startAsc' | 'startDesc' | 'nameAsc' | 'registrationsDesc' | 'statusAsc';
type DetailView = 'registered' | 'missing';

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  UPCOMING: 'Upcoming',
  ONGOING: 'Ongoing',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const eventTypeLabels: Record<string, string> = {
  MEETING: 'Meeting',
  TRAINING: 'Training',
  CONFERENCE: 'Conference',
  SEMINAR: 'Seminar',
  WORKSHOP: 'Workshop',
  AGM: 'Annual general meeting',
  OTHER: 'Other',
};

const sortOptions = [
  { value: 'startAsc', label: 'Soonest first', description: 'Upcoming dates at the top.' },
  { value: 'startDesc', label: 'Latest first', description: 'Newest scheduled dates first.' },
  { value: 'nameAsc', label: 'Event name', description: 'Sort alphabetically by event name.' },
  { value: 'registrationsDesc', label: 'Most registrations', description: 'Show the strongest RSVP activity first.' },
  { value: 'statusAsc', label: 'Status', description: 'Group events by workflow status.' },
];

export default function MobileEventsManageScreen() {
  const params = useLocalSearchParams();
  const { activeView, associationId, user } = useAuth();
  const [events, setEvents] = useState<AssociationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortValue, setSortValue] = useState<SortOption>('startAsc');
  const [sortOpen, setSortOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AssociationEvent | null>(null);
  const [deleteEvent, setDeleteEvent] = useState<AssociationEvent | null>(null);
  const [detailView, setDetailView] = useState<DetailView>('registered');
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [nonRegistrants, setNonRegistrants] = useState<EventNonRegistrant[]>([]);
  const [openedEventId, setOpenedEventId] = useState<string | null>(null);

  const initialEventId = Array.isArray(params.eventId) ? params.eventId[0] : params.eventId;

  const loadEvents = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before loading events.');
        return;
      }

      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);
      setNotice(null);

      try {
        const rows = await getAssociationEvents(associationId);
        setEvents(rows);
      } catch (loadError) {
        setEvents([]);
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId],
  );

  const loadDetailRows = useCallback(
    async (event: AssociationEvent, view: DetailView) => {
      if (!associationId || !event.registrationRequired) return;
      setDetailLoading(true);
      setError(null);

      try {
        if (view === 'registered') {
          const rows = await getEventRegistrations(associationId, event.id);
          setRegistrations(rows);
        } else {
          const rows = await getEventNonRegistrants(associationId, event.id);
          setNonRegistrants(rows);
        }
      } catch (detailError) {
        setError(getApiErrorMessage(detailError));
      } finally {
        setDetailLoading(false);
      }
    },
    [associationId],
  );

  const openEvent = useCallback((event: AssociationEvent) => {
    setSelectedEvent(event);
    setDetailView('registered');
    setRegistrations([]);
    setNonRegistrants([]);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadEvents();
    });
    return () => {
      active = false;
    };
  }, [loadEvents]);

  useEffect(() => {
    if (!initialEventId || openedEventId === initialEventId || events.length === 0) return;
    const event = events.find((row) => row.id === initialEventId);
    if (event) {
      void Promise.resolve().then(() => {
        openEvent(event);
        setOpenedEventId(initialEventId);
      });
    }
  }, [events, initialEventId, openedEventId, openEvent]);

  useEffect(() => {
    if (initialEventId || !openedEventId) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setOpenedEventId(null);
      setSelectedEvent(null);
      setDetailView('registered');
      setRegistrations([]);
      setNonRegistrants([]);
    });
    return () => {
      active = false;
    };
  }, [initialEventId, openedEventId]);

  useEffect(() => {
    if (!selectedEvent || !selectedEvent.registrationRequired) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadDetailRows(selectedEvent, detailView);
    });
    return () => {
      active = false;
    };
  }, [detailView, loadDetailRows, selectedEvent]);

  const summary = useMemo(() => {
    const totalRegistrations = events.reduce((sum, event) => sum + Number(event.registrationCount || 0), 0);
    const publicLinks = events.filter((event) => event.publicRegistrationEnabled && event.publicRegistrationUrl).length;
    const upcoming = events.filter((event) => getEventStatus(event) === 'UPCOMING').length;
    const activeEvents = events.filter((event) => ['UPCOMING', 'ONGOING', 'PUBLISHED'].includes(getEventStatus(event))).length;

    return {
      total: events.length,
      visible: 0,
      upcoming,
      activeEvents,
      publicLinks,
      registrations: totalRegistrations,
    };
  }, [events]);

  const statusTabs = useMemo(() => {
    const counts = events.reduce<Record<string, number>>(
      (acc, event) => {
        const status = getEventStatus(event);
        acc.all += 1;
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      { all: 0 },
    );

    return [
      { value: 'all', label: 'All', count: counts.all || 0 },
      { value: 'UPCOMING', label: 'Upcoming', count: counts.UPCOMING || 0 },
      { value: 'ONGOING', label: 'Ongoing', count: counts.ONGOING || 0 },
      { value: 'DRAFT', label: 'Draft', count: counts.DRAFT || 0 },
      { value: 'COMPLETED', label: 'Done', count: counts.COMPLETED || 0 },
      { value: 'CANCELLED', label: 'Cancelled', count: counts.CANCELLED || 0 },
    ];
  }, [events]);

  const filteredEvents = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const rows = events.filter((event) => {
      const status = getEventStatus(event);
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      const haystack = [
        event.eventName,
        event.eventType,
        eventTypeLabels[String(event.eventType || '')],
        event.organizerDepartment,
        event.venueLocation,
        event.regionDistrict,
        statusLabels[status],
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return matchesStatus && (!query || haystack.includes(query));
    });

    return sortEvents(rows, sortValue);
  }, [events, searchTerm, sortValue, statusFilter]);

  const eventItems = useMemo<MobileDataListItem[]>(
    () =>
      filteredEvents.map((event) => {
        const status = getEventStatus(event);
        return {
          id: event.id,
          title: event.eventName,
          subtitle: `${eventTypeLabels[String(event.eventType || '')] || event.eventType || 'Event'} · ${event.venueLocation || 'Venue not set'}`,
          meta: `${formatEventDateRange(event)} · ${formatNumber(Number(event.registrationCount || 0))} registrations`,
          amount: event.registrationRequired ? feeLabel(event) : 'No RSVP',
          status: statusLabels[status] || status,
          statusTone: eventStatusTone(status),
          accent: eventStatusTone(status),
          initials: 'EV',
        };
      }),
    [filteredEvents],
  );

  const registrationItems = useMemo<MobileDataListItem[]>(
    () =>
      registrations.map((registration) => {
        const name = registration.memberName || registration.guestName || 'Guest';
        const payment = paymentStatusLabel(registration, selectedEvent);
        return {
          id: registration.id,
          title: name,
          subtitle:
            registration.memberEmail ||
            registration.memberPhone ||
            registration.guestEmail ||
            registration.guestPhone ||
            registration.membershipPackageName ||
            'No contact captured',
          meta: `${registration.participantType || (registration.publicRegistration ? 'Public' : 'Member')} · ${formatDate(registration.registrationDate)}`,
          amount: Number(registration.registrationFeeAmount || 0) > 0 ? formatCurrency(Number(registration.registrationFeeAmount || 0)) : 'Free',
          status: payment,
          statusTone: paymentStatusTone(payment),
          accent: registration.publicRegistration ? 'info' : 'primary',
        };
      }),
    [registrations, selectedEvent],
  );

  const nonRegistrantItems = useMemo<MobileDataListItem[]>(
    () =>
      nonRegistrants.map((member) => ({
        id: member.memberId,
        title: member.memberName,
        subtitle: member.membershipNumber || member.membershipPackageName || 'Member',
        meta: member.memberEmail || member.memberPhone || 'No contact captured',
        status: "Not RSVP'd",
        statusTone: 'warning',
        accent: 'warning',
      })),
    [nonRegistrants],
  );

  const refresh = () => {
    void loadEvents('refresh');
  };

  const closeEvent = () => {
    setSelectedEvent(null);
    setDetailView('registered');
    setRegistrations([]);
    setNonRegistrants([]);
  };

  const openAddEvent = (eventId?: string) => {
    const addRoute = getRouteByPath('/associations/events/add');
    if (addRoute) {
      router.push({
        pathname: '/work/route-preview',
        params: eventId ? { routeId: addRoute.id, eventId } : { routeId: addRoute.id },
      } as never);
    }
  };

  const handleDelete = async () => {
    if (!associationId || !deleteEvent) return;
    setDeletingEventId(deleteEvent.id);
    setNotice(null);

    try {
      await deleteAssociationEvent(associationId, deleteEvent.id);
      setNotice('Event deleted.');
      setDeleteEvent(null);
      if (selectedEvent?.id === deleteEvent.id) closeEvent();
      await loadEvents('refresh');
    } catch (deleteError) {
      setError(getApiErrorMessage(deleteError));
    } finally {
      setDeletingEventId(null);
    }
  };

  const shareLink = async (url?: string | null) => {
    if (!url) return;
    try {
      await Share.share({ message: url, url });
    } catch (shareError) {
      setError(getApiErrorMessage(shareError));
    }
  };

  const openLink = async (url?: string | null) => {
    if (!url) return;
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      setError('This link cannot be opened on the simulator.');
    }
  };

  const eventReportOptions = useMemo(
    () => ({
      title: 'Events Report',
      associationName: user?.associationName || 'Association',
      purpose: 'A filtered register of association events, dates, venues, statuses, registrations, and public registration links.',
      rows: filteredEvents,
      fileName: 'nane-events',
      metrics: [
        { label: 'Total events', value: formatNumber(summary.total), helper: 'All schedules' },
        { label: 'Upcoming', value: formatNumber(summary.upcoming), helper: 'Next sessions' },
        { label: 'Registrations', value: formatNumber(summary.registrations), helper: 'RSVP records' },
        { label: 'Public links', value: formatNumber(summary.publicLinks), helper: 'Open registration' },
      ],
      filters: [
        { label: 'Search', value: searchTerm || 'All' },
        { label: 'Status', value: statusFilter === 'all' ? 'All' : statusLabels[statusFilter] || statusFilter },
        { label: 'Sort', value: sortOptions.find((option) => option.value === sortValue)?.label || sortValue },
      ],
      columns: [
        { key: 'number', label: '#', align: 'center' as const, width: '4%', value: (_event: AssociationEvent, index: number) => index + 1 },
        { key: 'eventName', label: 'Event', width: '18%', value: (event: AssociationEvent) => event.eventName || '-' },
        { key: 'type', label: 'Type', width: '11%', value: (event: AssociationEvent) => eventTypeLabels[String(event.eventType || '')] || event.eventType || '-' },
        { key: 'date', label: 'Date', width: '14%', value: (event: AssociationEvent) => formatEventDateRange(event) },
        { key: 'time', label: 'Time', width: '10%', value: (event: AssociationEvent) => formatEventTimeRange(event) },
        { key: 'organizer', label: 'Organizer', width: '13%', value: (event: AssociationEvent) => event.organizerDepartment || '-' },
        { key: 'venue', label: 'Venue', width: '13%', value: (event: AssociationEvent) => event.venueLocation || '-' },
        { key: 'status', label: 'Status', width: '9%', value: (event: AssociationEvent) => statusLabels[getEventStatus(event)] || getEventStatus(event) },
        { key: 'registrations', label: 'RSVPs', align: 'right' as const, width: '8%', value: (event: AssociationEvent) => formatNumber(Number(event.registrationCount || 0)) },
        { key: 'publicRegistrationUrl', label: 'Public Link', width: '20%', value: (event: AssociationEvent) => event.publicRegistrationUrl || '-' },
      ],
    }),
    [filteredEvents, searchTerm, sortValue, statusFilter, summary, user?.associationName],
  );

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Association admin only" description="Event management is available from the association admin workspace." />;
  }

  if (loading) {
    return <MobilePageLoadingState kind="list" message="Loading association events" />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        title="Manage Events"
        eyebrow="Community"
        subtitle="Review schedules, registrations, public links and event actions."
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh" onPress={refresh} disabled={refreshing} />}
      />

      {error ? <MobileErrorState title="Events issue" description={error} onRetry={() => setError(null)} retryLabel="Dismiss" /> : null}
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

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Total Events" value={formatNumber(summary.total)} description="All schedules" icon={CalendarDays} tone="blue" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Upcoming" value={formatNumber(summary.upcoming)} description="Next sessions" icon={Clock3} tone="green" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Registrations" value={formatNumber(summary.registrations)} description="RSVP records" icon={Users} tone="purple" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Public Links" value={formatNumber(summary.publicLinks)} description="Open registration" icon={LinkIcon} tone="teal" />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard compact>
        <View style={styles.toolbarHeader}>
          <View style={styles.toolbarCopy}>
            <MobileText variant="section" weight="bold">
              Event Register
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Showing {formatNumber(filteredEvents.length)} of {formatNumber(summary.total)} events.
            </MobileText>
          </View>
          <MobileStatusBadge status={refreshing ? 'Refreshing' : 'Ready'} tone={refreshing ? 'info' : 'success'} />
        </View>

        <MobileSearchToolbar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search event, venue, organizer"
          onFilterPress={() => setSortOpen(true)}
          filterLabel="Sort"
        />
        <MobileStatusTabs tabs={statusTabs} value={statusFilter} onChange={(value) => setStatusFilter(value as StatusFilter)} />
        <View style={styles.actions}>
          <MobileButton label="Add Event" icon={Plus} onPress={() => openAddEvent()} />
          <MobileReportExportButton options={eventReportOptions} onError={(exportError) => setError(getApiErrorMessage(exportError))} />
        </View>
      </MobileCard>

      {filteredEvents.length > 0 ? (
        <MobileDataList items={eventItems} onPressItem={(item) => {
          const event = filteredEvents.find((row) => row.id === item.id);
          if (event) openEvent(event);
        }} />
      ) : (
        <MobileEmptyState
          title={searchTerm || statusFilter !== 'all' ? 'No matching events' : 'No events found'}
          description={
            searchTerm || statusFilter !== 'all'
              ? 'Adjust the search term or status filter to see more events.'
              : 'Create the first event so members and public guests can register.'
          }
          actionLabel={searchTerm || statusFilter !== 'all' ? 'Clear filters' : 'Add Event'}
          onAction={() => {
            if (searchTerm || statusFilter !== 'all') {
              setSearchTerm('');
              setStatusFilter('all');
            } else {
              openAddEvent();
            }
          }}
        />
      )}

      <MobileSheet
        visible={Boolean(selectedEvent)}
        title={selectedEvent?.eventName || 'Event details'}
        description="Public link, RSVP status, fees and schedule details."
        onClose={closeEvent}
      >
        {selectedEvent ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailContent}>
            <View style={styles.detailHero}>
              <View style={styles.detailTitle}>
                <MobileStatusBadge
                  status={getEventStatus(selectedEvent)}
                  label={statusLabels[getEventStatus(selectedEvent)] || getEventStatus(selectedEvent)}
                  tone={eventStatusTone(getEventStatus(selectedEvent))}
                />
                <MobileText variant="section" weight="bold">
                  {formatEventDateRange(selectedEvent)}
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  {formatEventTimeRange(selectedEvent)} · {selectedEvent.venueLocation || 'Venue not set'}
                </MobileText>
              </View>
            </View>

            {selectedEvent.publicRegistrationEnabled && selectedEvent.publicRegistrationUrl ? (
              <MobileCard compact accent="teal">
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionCopy}>
                    <MobileText variant="section" weight="bold">
                      Public Registration
                    </MobileText>
                    <MobileText variant="small" tone="secondary" numberOfLines={3}>
                      {selectedEvent.publicRegistrationUrl}
                    </MobileText>
                  </View>
                  <MobileStatusBadge status="Published" tone="info" />
                </View>
                <View style={styles.actions}>
                  <MobileButton label="Share Link" icon={Share2} onPress={() => void shareLink(selectedEvent.publicRegistrationUrl)} />
                  <MobileButton label="Open" icon={ExternalLink} variant="secondary" onPress={() => void openLink(selectedEvent.publicRegistrationUrl)} />
                </View>
              </MobileCard>
            ) : (
              <MobileCard compact>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionCopy}>
                    <MobileText variant="section" weight="bold">
                      Public Registration
                    </MobileText>
                    <MobileText variant="small" tone="secondary">
                      This event does not expose a public registration link.
                    </MobileText>
                  </View>
                  <MobileStatusBadge status="Draft" tone="neutral" />
                </View>
              </MobileCard>
            )}

            <MobileCard compact>
              <MobileInfoRow label="Type" value={eventTypeLabels[String(selectedEvent.eventType || '')] || String(selectedEvent.eventType || 'Event')} icon={Ticket} />
              <MobileInfoRow label="Organizer" value={selectedEvent.organizerDepartment || 'Not assigned'} icon={Users} />
              <MobileInfoRow label="Venue" value={selectedEvent.venueLocation || 'Not set'} helper={selectedEvent.regionDistrict || undefined} icon={MapPin} />
              <MobileInfoRow label="Registration" value={selectedEvent.registrationRequired ? 'Required' : 'Not required'} helper={feeLabel(selectedEvent)} icon={LinkIcon} />
              <MobileInfoRow
                label="RSVP"
                value={`${formatNumber(Number(selectedEvent.confirmedRegistrationCount || 0))} confirmed / ${formatNumber(Number(selectedEvent.registrationCount || 0))} total`}
                helper={selectedEvent.maxParticipants ? `${formatNumber(Number(selectedEvent.maxParticipants))} maximum participants` : 'No participant limit captured'}
                icon={Users}
              />
            </MobileCard>

            {selectedEvent.eventDescription ? (
              <MobileCard compact>
                <MobileText variant="section" weight="bold">
                  Description
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  {selectedEvent.eventDescription}
                </MobileText>
              </MobileCard>
            ) : null}

            {selectedEvent.registrationRequired ? (
              <MobileCard compact>
                <View style={styles.sectionHeader}>
                  <MobileText variant="section" weight="bold">
                    Fee Rules
                  </MobileText>
                  <MobileStatusBadge status={Number(selectedEvent.registrationFee || 0) > 0 ? 'Paid' : 'Free'} tone={Number(selectedEvent.registrationFee || 0) > 0 ? 'paid' : 'success'} />
                </View>
                <MobileInfoRow label="Fallback fee" value={moneyOrFree(Number(selectedEvent.registrationFee || 0))} />
                <MobileInfoRow label="Member fee" value={moneyOrFallback(Number(selectedEvent.memberRegistrationFee || 0))} />
                <MobileInfoRow label="Non-member fee" value={moneyOrFallback(Number(selectedEvent.nonMemberRegistrationFee || 0))} />
                <MobileInfoRow label="Registration deadline" value={formatDate(selectedEvent.registrationDeadline)} />
              </MobileCard>
            ) : null}

            {selectedEvent.googleMapLink || selectedEvent.meetingLink || selectedEvent.publicEventListUrl ? (
              <View style={styles.actions}>
                {selectedEvent.googleMapLink ? (
                  <MobileButton label="Map" icon={MapPin} variant="secondary" onPress={() => void openLink(selectedEvent.googleMapLink)} />
                ) : null}
                {selectedEvent.meetingLink ? (
                  <MobileButton label="Meeting" icon={ExternalLink} variant="secondary" onPress={() => void openLink(selectedEvent.meetingLink)} />
                ) : null}
                {selectedEvent.publicEventListUrl ? (
                  <MobileButton label="Public List" icon={ExternalLink} variant="secondary" onPress={() => void openLink(selectedEvent.publicEventListUrl)} />
                ) : null}
              </View>
            ) : null}

            {selectedEvent.registrationRequired ? (
              <MobileCard compact>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionCopy}>
                    <MobileText variant="section" weight="bold">
                      RSVP and Payment
                    </MobileText>
                    <MobileText variant="small" tone="secondary">
                      Registered people and members who have not RSVP&apos;d.
                    </MobileText>
                  </View>
                </View>
                <MobileStatusTabs
                  tabs={[
                    {
                      value: 'registered',
                      label: 'Registered',
                      count: Math.max(registrations.length, Number(selectedEvent.registrationCount || 0)),
                    },
                    { value: 'missing', label: 'Missing', count: nonRegistrants.length },
                  ]}
                  value={detailView}
                  onChange={(value) => setDetailView(value as DetailView)}
                />
                {detailLoading ? (
                  <MobilePageLoadingState kind="list" fullScreen={false} message="Loading RSVP records" />
                ) : detailView === 'registered' ? (
                  registrationItems.length > 0 ? (
                    <MobileDataList items={registrationItems} showChevron={false} />
                  ) : (
                    <MobileEmptyState title="No registrations yet" description="No RSVP or payment records have been captured for this event." />
                  )
                ) : nonRegistrantItems.length > 0 ? (
                  <MobileDataList items={nonRegistrantItems} showChevron={false} />
                ) : (
                  <MobileEmptyState title="All listed members have RSVP'd" description="There are no missing RSVP records for this event." />
                )}
              </MobileCard>
            ) : null}

            <View style={styles.actions}>
              <MobileButton label="Edit" icon={Edit3} variant="secondary" onPress={() => openAddEvent(selectedEvent.id)} />
              <MobileButton
                label="Delete"
                icon={Trash2}
                variant="danger"
                onPress={() => {
                  setDeleteEvent(selectedEvent);
                }}
                disabled={deletingEventId === selectedEvent.id}
              />
            </View>
          </ScrollView>
        ) : null}
      </MobileSheet>

      <MobileSortSheet
        visible={sortOpen}
        value={sortValue}
        options={sortOptions}
        onChange={(value) => setSortValue(value as SortOption)}
        onClose={() => setSortOpen(false)}
      />

      <MobileConfirmSheet
        visible={Boolean(deleteEvent)}
        title="Delete event"
        description={`Delete "${deleteEvent?.eventName || 'this event'}"? This cannot be undone.`}
        confirmLabel={deletingEventId ? 'Deleting...' : 'Delete Event'}
        destructive
        onCancel={() => setDeleteEvent(null)}
        onConfirm={handleDelete}
      />
    </MobileScreen>
  );
}

function getEventStatus(event: AssociationEvent): EventStatus {
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
  if (normalized === 'DRAFT') return 'review';
  if (normalized === 'CANCELLED') return 'danger';
  if (normalized === 'COMPLETED') return 'neutral';
  return 'neutral';
}

function paymentStatusLabel(registration: EventRegistration, event?: AssociationEvent | null) {
  if (!event || !event.registrationRequired || Number(registration.registrationFeeAmount || 0) <= 0) return 'Free';
  return registration.paymentStatus || (registration.paymentReference ? 'Paid' : 'Pending');
}

function paymentStatusTone(status?: string | null): StatusTone {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('paid') || normalized.includes('free')) return 'success';
  if (normalized.includes('failed') || normalized.includes('rejected')) return 'danger';
  if (normalized.includes('pending') || normalized.includes('unpaid')) return 'warning';
  return 'neutral';
}

function sortEvents(events: AssociationEvent[], sortValue: SortOption) {
  return [...events].sort((left, right) => {
    if (sortValue === 'nameAsc') return left.eventName.localeCompare(right.eventName);
    if (sortValue === 'registrationsDesc') return Number(right.registrationCount || 0) - Number(left.registrationCount || 0);
    if (sortValue === 'statusAsc') return getEventStatus(left).localeCompare(getEventStatus(right));

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

function feeLabel(event: AssociationEvent) {
  if (!event.registrationRequired) return 'No RSVP required';
  const fee = Number(event.registrationFee || event.memberRegistrationFee || event.nonMemberRegistrationFee || 0);
  return fee > 0 ? formatCurrency(fee) : 'Free registration';
}

function moneyOrFree(value: number) {
  return value > 0 ? formatCurrency(value) : 'Free';
}

function moneyOrFallback(value: number) {
  return value > 0 ? formatCurrency(value) : 'Fallback';
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
  toolbarHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  toolbarCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  detailContent: {
    gap: 14,
    paddingBottom: 8,
  },
  detailHero: {
    gap: 10,
  },
  detailTitle: {
    gap: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
});
