import { router, useLocalSearchParams } from 'expo-router';
import {
  AlertTriangle,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

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
  MobileSelect,
  MobileSheet,
  MobileSortSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
  MobileTextInput,
} from '@/components/mobile';
import { type StatusTone } from '@/theme/tokens';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  complianceStatus,
  complianceStatusGroup,
  createGovernanceComplianceTask,
  deleteGovernanceComplianceTask,
  getGovernanceComplianceTasks,
  setGovernanceComplianceCompletion,
  type GovernanceComplianceTask,
} from '@/services/governance-service';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber } from '@/utils/format';

type StatusFilter = 'all' | 'overdue' | 'dueSoon' | 'upcoming' | 'completed';
type SortOption = 'dueAsc' | 'dueDesc' | 'statusPriority' | 'titleAsc' | 'createdDesc';

type TaskForm = {
  title: string;
  description: string;
  frequency: string;
  dueDate: string;
  responsibleRole: string;
  reminderDaysBefore: string;
};

const emptyForm: TaskForm = {
  title: '',
  description: '',
  frequency: 'YEARLY',
  dueDate: '',
  responsibleRole: '',
  reminderDaysBefore: '7',
};

const frequencyOptions = [
  { value: 'YEARLY', label: 'Yearly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'ONCE', label: 'Once' },
];

const sortOptions = [
  { value: 'statusPriority', label: 'Needs action first', description: 'Overdue and due soon tasks rise to the top.' },
  { value: 'dueAsc', label: 'Nearest due date', description: 'Earliest due date first.' },
  { value: 'dueDesc', label: 'Latest due date', description: 'Furthest due date first.' },
  { value: 'titleAsc', label: 'Task title', description: 'Alphabetical task order.' },
  { value: 'createdDesc', label: 'Newest created', description: 'Recently created tasks first.' },
];

export default function MobileGovernanceComplianceScreen() {
  const params = useLocalSearchParams();
  const { activeView, associationId, user } = useAuth();
  const [tasks, setTasks] = useState<GovernanceComplianceTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mutatingTaskId, setMutatingTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortValue, setSortValue] = useState<SortOption>('statusPriority');
  const [sortOpen, setSortOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<TaskForm>(emptyForm);
  const [selectedTask, setSelectedTask] = useState<GovernanceComplianceTask | null>(null);
  const [completionTask, setCompletionTask] = useState<GovernanceComplianceTask | null>(null);
  const [deleteTask, setDeleteTask] = useState<GovernanceComplianceTask | null>(null);
  const [openedTaskId, setOpenedTaskId] = useState<string | null>(null);
  const [openedCreateParam, setOpenedCreateParam] = useState(false);
  const initialTaskId = Array.isArray(params.taskId) ? params.taskId[0] : params.taskId;
  const shouldOpenCreate = normalizeParamFlag(params.createTask);

  const loadTasks = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before loading compliance tasks.');
        return;
      }

      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);
      setNotice(null);

      try {
        const rows = await getGovernanceComplianceTasks(associationId);
        setTasks(rows);
      } catch (loadError) {
        setTasks([]);
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId],
  );

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadTasks();
    });
    return () => {
      active = false;
    };
  }, [loadTasks]);

  useEffect(() => {
    if (!initialTaskId || openedTaskId === initialTaskId || tasks.length === 0) return;
    const task = tasks.find((row) => row.id === initialTaskId);
    if (task) {
      void Promise.resolve().then(() => {
        setSelectedTask(task);
        setOpenedTaskId(initialTaskId);
      });
    }
  }, [initialTaskId, openedTaskId, tasks]);

  useEffect(() => {
    if (!shouldOpenCreate || openedCreateParam) return;
    void Promise.resolve().then(() => {
      setForm(emptyForm);
      setError(null);
      setCreateOpen(true);
      setOpenedCreateParam(true);
    });
  }, [openedCreateParam, shouldOpenCreate]);

  const summary = useMemo(() => {
    const completed = tasks.filter((task) => complianceStatusGroup(task) === 'completed').length;
    const overdue = tasks.filter((task) => complianceStatusGroup(task) === 'overdue').length;
    const dueSoon = tasks.filter((task) => complianceStatusGroup(task) === 'dueSoon').length;
    const upcoming = tasks.filter((task) => complianceStatusGroup(task) === 'upcoming').length;

    return {
      total: tasks.length,
      completed,
      overdue,
      dueSoon,
      upcoming,
      open: overdue + dueSoon + upcoming,
    };
  }, [tasks]);

  const statusTabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: summary.total },
      { value: 'overdue', label: 'Overdue', count: summary.overdue },
      { value: 'dueSoon', label: 'Due soon', count: summary.dueSoon },
      { value: 'upcoming', label: 'Upcoming', count: summary.upcoming },
      { value: 'completed', label: 'Done', count: summary.completed },
    ],
    [summary],
  );

  const filteredTasks = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const rows = tasks.filter((task) => {
      const group = complianceStatusGroup(task);
      const matchesStatus = statusFilter === 'all' || group === statusFilter;
      const haystack = [task.title, task.description, task.frequency, task.responsibleRole, task.status]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return matchesStatus && (!query || haystack.includes(query));
    });

    return sortTasks(rows, sortValue);
  }, [searchTerm, sortValue, statusFilter, tasks]);

  const taskItems = useMemo<MobileDataListItem[]>(
    () =>
      filteredTasks.map((task) => {
        const status = complianceStatus(task);
        return {
          id: task.id,
          title: task.title,
          subtitle: `${formatFrequency(task.frequency)} · ${task.responsibleRole || 'Unassigned'}`,
          meta: `Due ${formatDate(task.dueDate)} · Reminder ${formatNumber(Number(task.reminderDaysBefore || 0))}d before`,
          status: statusLabel(status),
          statusTone: statusTone(status),
          initials: statusInitials(status),
          accent: statusTone(status),
        };
      }),
    [filteredTasks],
  );

  const complianceReportOptions = useMemo(
    () => ({
      title: 'Governance Compliance Tasks',
      associationName: user?.associationName || 'Association',
      purpose: 'A current-view report of compliance obligations, due dates, responsible roles, reminders, and completion status.',
      rows: filteredTasks,
      fileName: 'nane-compliance-tasks',
      metrics: [
        { label: 'Total tasks', value: formatNumber(summary.total), helper: 'Tracked obligations' },
        { label: 'Overdue', value: formatNumber(summary.overdue), helper: summary.overdue > 0 ? 'Past due' : 'None overdue' },
        { label: 'Due soon', value: formatNumber(summary.dueSoon), helper: summary.dueSoon > 0 ? 'Needs review' : 'No urgent tasks' },
        { label: 'Completed', value: formatNumber(summary.completed), helper: 'Closed this cycle' },
      ],
      filters: [
        { label: 'Search', value: searchTerm || 'All' },
        { label: 'Status', value: statusTabs.find((tab) => tab.value === statusFilter)?.label || statusFilter },
        { label: 'Sort', value: sortOptions.find((option) => option.value === sortValue)?.label || sortValue },
      ],
      columns: [
        { key: 'title', label: 'Task', width: '22%', value: (row: GovernanceComplianceTask) => row.title || '-' },
        { key: 'status', label: 'Status', width: '12%', value: (row: GovernanceComplianceTask) => statusLabel(complianceStatus(row)) },
        { key: 'frequency', label: 'Frequency', width: '11%', value: (row: GovernanceComplianceTask) => formatFrequency(row.frequency) },
        { key: 'dueDate', label: 'Due Date', width: '12%', value: (row: GovernanceComplianceTask) => formatDate(row.dueDate) },
        { key: 'responsibleRole', label: 'Responsible Role', width: '16%', value: (row: GovernanceComplianceTask) => row.responsibleRole || '-' },
        { key: 'reminder', label: 'Reminder Days', align: 'right' as const, width: '12%', value: (row: GovernanceComplianceTask) => formatNumber(Number(row.reminderDaysBefore || 0)) },
        { key: 'completedYear', label: 'Completed Year', width: '12%', value: (row: GovernanceComplianceTask) => row.completedYear || '-' },
      ],
    }),
    [filteredTasks, searchTerm, sortValue, statusFilter, statusTabs, summary, user?.associationName],
  );

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Association admin only" description="Governance compliance is available from the association admin workspace." />;
  }

  if (loading) {
    return <MobilePageLoadingState kind="list" message="Loading compliance tasks" />;
  }

  const refresh = () => {
    void loadTasks('refresh');
  };

  const resetForm = () => {
    setForm(emptyForm);
    setError(null);
  };

  const openCreate = () => {
    resetForm();
    setCreateOpen(true);
  };

  const validateForm = () => {
    setError(null);
    if (!form.title.trim()) {
      setError('Task title is required.');
      return false;
    }
    if (!form.dueDate.trim()) {
      setError('Due date is required.');
      return false;
    }
    if (Number.isNaN(Number(form.reminderDaysBefore)) || Number(form.reminderDaysBefore) < 0) {
      setError('Reminder days must be zero or more.');
      return false;
    }
    return true;
  };

  const createTask = async () => {
    if (!associationId || !validateForm()) return;
    setSaving(true);
    setNotice(null);

    try {
      await createGovernanceComplianceTask(associationId, {
        title: form.title.trim(),
        description: form.description.trim(),
        frequency: form.frequency,
        dueDate: form.dueDate.trim(),
        responsibleRole: form.responsibleRole.trim(),
        reminderDaysBefore: Number(form.reminderDaysBefore || 7),
        active: true,
      });
      setCreateOpen(false);
      resetForm();
      setNotice('Compliance task created.');
      await loadTasks('refresh');
    } catch (createError) {
      setError(getApiErrorMessage(createError));
    } finally {
      setSaving(false);
    }
  };

  const toggleCompletion = async () => {
    if (!associationId || !completionTask) return;
    const nextCompleted = !Boolean(completionTask.completed || completionTask.status === 'COMPLETED');
    setMutatingTaskId(completionTask.id);
    setNotice(null);

    try {
      await setGovernanceComplianceCompletion(associationId, completionTask.id, nextCompleted);
      setNotice(nextCompleted ? 'Task marked completed.' : 'Task reopened.');
      setCompletionTask(null);
      setSelectedTask(null);
      await loadTasks('refresh');
    } catch (completionError) {
      setError(getApiErrorMessage(completionError));
    } finally {
      setMutatingTaskId(null);
    }
  };

  const removeTask = async () => {
    if (!associationId || !deleteTask) return;
    setMutatingTaskId(deleteTask.id);
    setNotice(null);

    try {
      await deleteGovernanceComplianceTask(associationId, deleteTask.id);
      setNotice('Compliance task deleted.');
      setDeleteTask(null);
      setSelectedTask(null);
      await loadTasks('refresh');
    } catch (deleteError) {
      setError(getApiErrorMessage(deleteError));
    } finally {
      setMutatingTaskId(null);
    }
  };

  return (
    <MobileScreen>
      <MobilePageHeader
        title="Compliance"
        eyebrow="Governance"
        subtitle="Track obligations, due dates and completion status."
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh" onPress={refresh} disabled={refreshing} />}
      />

      {error ? <MobileErrorState title="Compliance issue" description={error} onRetry={() => setError(null)} retryLabel="Dismiss" /> : null}
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
          <MobileKpiCard title="Total Tasks" value={formatNumber(summary.total)} description="Tracked obligations" icon={ClipboardCheck} tone="blue" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Overdue" value={formatNumber(summary.overdue)} description={summary.overdue > 0 ? 'Past due' : 'None overdue'} icon={AlertTriangle} tone={summary.overdue > 0 ? 'red' : 'green'} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Due Soon" value={formatNumber(summary.dueSoon)} description={summary.dueSoon > 0 ? 'Needs review' : 'No urgent tasks'} icon={CalendarClock} tone={summary.dueSoon > 0 ? 'orange' : 'blue'} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Completed" value={formatNumber(summary.completed)} description="Closed this cycle" icon={CheckCircle2} tone="green" />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard compact>
        <View style={styles.toolbarTop}>
          <View style={styles.toolbarCopy}>
            <MobileText variant="body" weight="bold">
              Compliance Tasks
            </MobileText>
            <MobileText variant="small" tone="secondary">
              {formatNumber(filteredTasks.length)} of {formatNumber(tasks.length)} obligations shown.
            </MobileText>
          </View>
          <MobileStatusBadge
            label={summary.overdue > 0 ? 'Needs action' : summary.dueSoon > 0 ? 'Due soon' : 'On track'}
            tone={summary.overdue > 0 ? 'danger' : summary.dueSoon > 0 ? 'warning' : 'success'}
          />
        </View>
        <View style={styles.actions}>
          <MobileButton label="New Task" icon={Plus} onPress={openCreate} size="sm" />
          <MobileReportExportButton options={complianceReportOptions} size="sm" onSuccess={(_uri, format) => setNotice(`${format.toUpperCase()} compliance report is ready.`)} onError={(exportError) => setError(getApiErrorMessage(exportError))} />
        </View>
      </MobileCard>

      <MobileSearchToolbar value={searchTerm} onChange={setSearchTerm} placeholder="Search task, owner, status..." onFilterPress={() => setSortOpen(true)} filterLabel="Sort" />
      <MobileStatusTabs tabs={statusTabs} value={statusFilter} onChange={(value) => setStatusFilter(value as StatusFilter)} />

      {taskItems.length === 0 ? (
        <MobileEmptyState
          title={tasks.length === 0 ? 'No compliance tasks yet' : 'No matching tasks'}
          description={tasks.length === 0 ? 'Create the first obligation to track deadlines and reminders.' : 'Adjust search, status, or sort to find the task you need.'}
          actionLabel={tasks.length === 0 ? 'New Task' : 'Reset Filters'}
          onAction={tasks.length === 0 ? openCreate : () => {
            setSearchTerm('');
            setStatusFilter('all');
          }}
        />
      ) : (
        <MobileDataList items={taskItems} onPressItem={(item) => setSelectedTask(tasks.find((task) => task.id === item.id) || null)} />
      )}

      <MobileSortSheet
        visible={sortOpen}
        value={sortValue}
        options={sortOptions}
        onChange={(value) => setSortValue(value as SortOption)}
        onClose={() => setSortOpen(false)}
      />

      <MobileSheet
        visible={createOpen}
        title="Add Compliance Task"
        description="Create a recurring obligation with a due date and reminder window."
        onClose={() => {
          if (!saving) setCreateOpen(false);
        }}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScroll}>
          <MobileTextInput label="Task title" value={form.title} onChangeText={(value) => setForm((prev) => ({ ...prev, title: value }))} placeholder="Annual return" disabled={saving} />
          <MobileTextInput label="Responsible role" value={form.responsibleRole} onChangeText={(value) => setForm((prev) => ({ ...prev, responsibleRole: value }))} placeholder="Secretary" disabled={saving} />
          <MobileTextInput label="Description" value={form.description} onChangeText={(value) => setForm((prev) => ({ ...prev, description: value }))} placeholder="Optional notes" disabled={saving} />
          <MobileSelect label="Frequency" value={form.frequency} options={frequencyOptions} onChange={(value) => setForm((prev) => ({ ...prev, frequency: value }))} />
          <MobileTextInput label="Due date" value={form.dueDate} onChangeText={(value) => setForm((prev) => ({ ...prev, dueDate: value }))} placeholder="YYYY-MM-DD" helperText="Use the backend date format, for example 2026-12-31." disabled={saving} />
          <MobileTextInput label="Reminder days before" value={form.reminderDaysBefore} onChangeText={(value) => setForm((prev) => ({ ...prev, reminderDaysBefore: value }))} keyboardType="number-pad" placeholder="7" disabled={saving} />
          <View style={styles.formActions}>
            <MobileButton label="Cancel" variant="secondary" onPress={() => setCreateOpen(false)} disabled={saving} />
            <MobileButton label="Create Task" icon={Plus} loading={saving} onPress={createTask} fullWidth style={styles.formSubmit} />
          </View>
        </ScrollView>
      </MobileSheet>

      <MobileSheet visible={Boolean(selectedTask)} title="Task Details" description="Review ownership, due date and task status." onClose={() => setSelectedTask(null)}>
        {selectedTask ? (
          <View style={styles.detailContent}>
            <MobileCard compact accent={statusAccent(complianceStatus(selectedTask))}>
              <View style={styles.detailTitleRow}>
                <View style={styles.detailTitleCopy}>
                  <MobileText variant="section" weight="bold">
                    {selectedTask.title}
                  </MobileText>
                  {selectedTask.description ? (
                    <MobileText variant="small" tone="secondary">
                      {selectedTask.description}
                    </MobileText>
                  ) : null}
                </View>
                <MobileStatusBadge label={statusLabel(complianceStatus(selectedTask))} tone={statusTone(complianceStatus(selectedTask))} />
              </View>
            </MobileCard>
            <MobileCard compact>
              <MobileInfoRow label="Due date" value={formatDate(selectedTask.dueDate)} helper="Next compliance deadline." icon={CalendarClock} status={statusLabel(complianceStatus(selectedTask))} />
              <MobileInfoRow label="Frequency" value={formatFrequency(selectedTask.frequency)} helper="How often this obligation repeats." icon={ClipboardCheck} />
              <MobileInfoRow label="Responsible" value={selectedTask.responsibleRole || 'Unassigned'} helper="Role expected to close the task." icon={BriefcaseBusiness} />
              <MobileInfoRow label="Reminder" value={`${formatNumber(Number(selectedTask.reminderDaysBefore || 0))} days before`} helper="Reminder window before due date." icon={ShieldCheck} />
            </MobileCard>
            <View style={styles.actions}>
              <MobileButton
                label={selectedTask.completed ? 'Reopen' : 'Mark Done'}
                icon={selectedTask.completed ? RotateCcw : CheckCircle2}
                loading={mutatingTaskId === selectedTask.id}
                onPress={() => setCompletionTask(selectedTask)}
                size="sm"
              />
              <MobileButton label="Delete" variant="danger" icon={Trash2} disabled={mutatingTaskId === selectedTask.id} onPress={() => setDeleteTask(selectedTask)} size="sm" />
            </View>
          </View>
        ) : null}
      </MobileSheet>

      <MobileConfirmSheet
        visible={Boolean(completionTask)}
        title={completionTask?.completed ? 'Reopen compliance task?' : 'Mark task completed?'}
        description={
          completionTask
            ? `${completionTask.completed ? 'Reopen' : 'Complete'} "${completionTask.title}" for the current cycle?`
            : 'Update this compliance task?'
        }
        confirmLabel={completionTask?.completed ? 'Reopen' : 'Mark Done'}
        onCancel={() => setCompletionTask(null)}
        onConfirm={toggleCompletion}
      />

      <MobileConfirmSheet
        visible={Boolean(deleteTask)}
        title="Delete compliance task?"
        description={deleteTask ? `Delete "${deleteTask.title}"? This action cannot be undone.` : 'Delete this compliance task?'}
        confirmLabel="Delete Task"
        destructive
        onCancel={() => setDeleteTask(null)}
        onConfirm={removeTask}
      />
    </MobileScreen>
  );
}

function sortTasks(tasks: GovernanceComplianceTask[], sortValue: SortOption) {
  const rows = [...tasks];
  if (sortValue === 'statusPriority') {
    return rows.sort((left, right) => statusRank(left) - statusRank(right) || dueTime(left) - dueTime(right));
  }
  if (sortValue === 'dueAsc') return rows.sort((left, right) => dueTime(left) - dueTime(right));
  if (sortValue === 'dueDesc') return rows.sort((left, right) => dueTime(right) - dueTime(left));
  if (sortValue === 'titleAsc') return rows.sort((left, right) => left.title.localeCompare(right.title));
  return rows.sort((left, right) => createdTime(right) - createdTime(left));
}

function statusRank(task: GovernanceComplianceTask) {
  const group = complianceStatusGroup(task);
  if (group === 'overdue') return 0;
  if (group === 'dueSoon') return 1;
  if (group === 'upcoming') return 2;
  return 3;
}

function dueTime(task: GovernanceComplianceTask) {
  return new Date(task.dueDate || '').getTime() || 0;
}

function createdTime(task: GovernanceComplianceTask) {
  return new Date(task.createdAt || '').getTime() || 0;
}

function formatFrequency(value?: string | null) {
  return String(value || 'YEARLY')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusLabel(status?: string | null) {
  return String(status || 'UPCOMING')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(status?: string | null): StatusTone {
  if (status === 'COMPLETED') return 'success';
  if (status === 'OVERDUE') return 'danger';
  if (status === 'DUE_SOON') return 'warning';
  return 'info';
}

function statusAccent(status?: string | null) {
  if (status === 'COMPLETED') return 'green';
  if (status === 'OVERDUE') return 'red';
  if (status === 'DUE_SOON') return 'orange';
  return 'blue';
}

function statusInitials(status?: string | null) {
  if (status === 'COMPLETED') return 'OK';
  if (status === 'OVERDUE') return 'OD';
  if (status === 'DUE_SOON') return 'DS';
  return 'UP';
}

function normalizeParamFlag(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'true' || raw === '1' || raw === 'yes';
}

const styles = StyleSheet.create({
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noticeText: {
    flex: 1,
  },
  toolbarTop: {
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
    gap: 8,
  },
  formScroll: {
    gap: 12,
    paddingBottom: 10,
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  formSubmit: {
    flex: 1,
  },
  detailContent: {
    gap: 12,
  },
  detailTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  detailTitleCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
});
