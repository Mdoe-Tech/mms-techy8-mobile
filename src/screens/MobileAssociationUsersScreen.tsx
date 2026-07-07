import { router, useLocalSearchParams } from 'expo-router';
import {
  Mail,
  Phone,
  Plus,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
  UserCog,
  UsersRound,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

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
  MobileToast,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import { listUserRoleAssignments, type RbacUserAssignment } from '@/services/association-rbac-service';
import { getAllAssociationMembers } from '@/services/member-service';
import {
  convertAssociationUserToMember,
  getAssociationUsers,
  searchAssociationUsers,
  type AssociationUser,
} from '@/services/user-service';
import { type KpiTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber, initialsFromName } from '@/utils/format';

type UserFilter = 'all' | 'active' | 'firstLogin' | 'noRbac' | 'admin';
type UserSort = 'name' | 'joined' | 'role';
type UserPreviewMode = 'detail' | 'convert';

const PAGE_SIZE = 200;
const sortOptions = [
  { value: 'name', label: 'Name', description: 'A to Z by full name.' },
  { value: 'joined', label: 'Newest joined', description: 'Most recently created users first.' },
  { value: 'role', label: 'Role', description: 'Group users by access and RBAC role.' },
] satisfies { value: UserSort; label: string; description: string }[];

export default function MobileAssociationUsersScreen() {
  const params = useLocalSearchParams();
  const { activeView, associationId, user } = useAuth();
  const [users, setUsers] = useState<AssociationUser[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState(() => firstParam(params.query) || '');
  const [filter, setFilter] = useState<UserFilter>('all');
  const [sort, setSort] = useState<UserSort>('name');
  const [sortOpen, setSortOpen] = useState(false);
  const [memberUserIds, setMemberUserIds] = useState<Set<string>>(new Set());
  const [rbacAssignments, setRbacAssignments] = useState<RbacUserAssignment[]>([]);
  const [selectedUser, setSelectedUser] = useState<AssociationUser | null>(null);
  const [convertTarget, setConvertTarget] = useState<AssociationUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const initialMode = firstParam(params.mode) as UserPreviewMode | undefined;
  const initialUserId = firstParam(params.userId);
  const initialPreviewConsumed = useRef(false);
  const initialLoadComplete = useRef(false);

  const canInviteUsers = useMemo(() => hasPermission(user, ['users.invite', 'USERS_MANAGE', 'association.admin']), [user]);
  const canManageRbac = useMemo(() => hasPermission(user, ['rbac.assignments.manage', 'USERS_MANAGE', 'users.update', 'association.admin']), [user]);
  const canConvertMembers = useMemo(() => hasPermission(user, ['members.create', 'MEMBERS_MANAGE', 'USERS_MANAGE', 'association.admin']), [user]);
  const canReadMembers = useMemo(() => hasPermission(user, ['members.view', 'MEMBERS_READ', 'MEMBERS_MANAGE', 'association.admin']), [user]);

  const rolesByUserId = useMemo(() => {
    const next: Record<string, string[]> = {};
    rbacAssignments.forEach((assignment) => {
      const names = assignment.roles.filter((role) => role.active && !role.archived).map((role) => role.name);
      if (names.length) next[assignment.userId] = names;
    });
    return next;
  }, [rbacAssignments]);

  const metrics = useMemo(() => {
    const activeUsers = users.filter((row) => row.active).length;
    const firstLogin = users.filter((row) => row.firstLogin).length;
    const adminAccess = users.filter((row) => isAdminAccess(row)).length;
    const assignedRbac = users.filter((row) => (rolesByUserId[row.id] || []).length > 0).length;
    return {
      total: totalUsers || users.length,
      activeUsers,
      firstLogin,
      adminAccess,
      assignedRbac,
      noRbac: users.length - assignedRbac,
    };
  }, [rolesByUserId, totalUsers, users]);

  const visibleUsers = useMemo(() => {
    const filtered = users.filter((row) => {
      if (filter === 'active') return row.active;
      if (filter === 'firstLogin') return row.firstLogin;
      if (filter === 'noRbac') return (rolesByUserId[row.id] || []).length === 0;
      if (filter === 'admin') return isAdminAccess(row);
      return true;
    });

    return [...filtered].sort((left, right) => {
      if (sort === 'joined') return String(right.createdAt || '').localeCompare(String(left.createdAt || ''));
      if (sort === 'role') return roleLabelForUser(left, rolesByUserId).localeCompare(roleLabelForUser(right, rolesByUserId));
      return left.fullName.localeCompare(right.fullName);
    });
  }, [filter, rolesByUserId, sort, users]);

  const listItems = useMemo<MobileDataListItem[]>(
    () =>
      visibleUsers.map((row) => ({
        id: row.id,
        title: row.fullName,
        subtitle: row.email,
        meta: row.phoneNumber ? row.phoneNumber : `Joined ${formatDate(row.createdAt)}`,
        status: row.active ? 'Active' : 'Inactive',
        statusTone: row.active ? 'success' : 'neutral',
        amount: roleSummary(row, rolesByUserId),
        initials: initialsFromName(row.fullName),
        accent: isAdminAccess(row) ? 'primary' : 'neutral',
      })),
    [rolesByUserId, visibleUsers],
  );

  const tabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: users.length },
      { value: 'active', label: 'Active', count: metrics.activeUsers },
      { value: 'firstLogin', label: 'First login', count: metrics.firstLogin },
      { value: 'noRbac', label: 'No RBAC', count: metrics.noRbac },
      { value: 'admin', label: 'Admin', count: metrics.adminAccess },
    ],
    [metrics.activeUsers, metrics.adminAccess, metrics.firstLogin, metrics.noRbac, users.length],
  );

  const userReportOptions = useMemo(
    () => ({
      title: 'Association Users',
      associationName: user?.associationName || 'Association',
      purpose: 'A current-view report of association system users, access levels, RBAC roles, and account status.',
      rows: visibleUsers,
      fileName: 'nane-association-users',
      metrics: [
        { label: 'System users', value: formatNumber(metrics.total), helper: 'Members excluded' },
        { label: 'Active users', value: formatNumber(metrics.activeUsers), helper: 'Can access the system' },
        { label: 'RBAC assigned', value: formatNumber(metrics.assignedRbac), helper: `${formatNumber(metrics.noRbac)} without RBAC` },
        { label: 'Admin access', value: formatNumber(metrics.adminAccess), helper: `${formatNumber(metrics.firstLogin)} first login pending` },
      ],
      filters: [
        { label: 'Search', value: searchTerm || 'All' },
        { label: 'Filter', value: tabs.find((tab) => tab.value === filter)?.label || filter },
        { label: 'Sort', value: sortOptions.find((option) => option.value === sort)?.label || sort },
        { label: 'Loaded users', value: `${formatNumber(users.length)} of ${formatNumber(totalUsers || users.length)}` },
      ],
      columns: [
        { key: 'number', label: '#', align: 'center' as const, width: '5%', value: (_row: AssociationUser, index: number) => index + 1 },
        { key: 'fullName', label: 'Full Name', width: '18%', value: (row: AssociationUser) => row.fullName || '-' },
        { key: 'email', label: 'Email', width: '19%', value: (row: AssociationUser) => row.email || '-' },
        { key: 'phoneNumber', label: 'Phone', width: '12%', value: (row: AssociationUser) => row.phoneNumber || '-' },
        { key: 'roles', label: 'RBAC Roles', width: '18%', value: (row: AssociationUser) => roleLabelForUser(row, rolesByUserId) },
        { key: 'accessLevel', label: 'Access Level', width: '12%', value: (row: AssociationUser) => accessLabelForUser(row) },
        { key: 'systemRole', label: 'System Role', width: '12%', value: (row: AssociationUser) => row.systemRole || '-' },
        { key: 'status', label: 'Status', width: '9%', value: (row: AssociationUser) => (row.active ? 'Active' : 'Inactive') },
        { key: 'joined', label: 'Joined', width: '11%', value: (row: AssociationUser) => formatDate(row.createdAt) },
      ],
    }),
    [filter, metrics, rolesByUserId, searchTerm, sort, tabs, totalUsers, user?.associationName, users.length, visibleUsers],
  );

  const loadUsers = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent' = 'initial', page = currentPage, query = searchTerm) => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before loading users.');
        return;
      }

      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      setError(null);

      try {
        const response = query.trim()
          ? await searchAssociationUsers(associationId, {
              page,
              size: PAGE_SIZE,
              query: query.trim(),
              excludeRole: 'MEMBER',
            })
          : await getAssociationUsers(associationId, {
              page,
              size: PAGE_SIZE,
              excludeRole: 'MEMBER',
            });

        setUsers(response.content);
        setTotalUsers(response.totalElements);
        setTotalPages(response.totalPages);
        setCurrentPage(response.number);
        if (mode === 'refresh') setNotice('Association users refreshed.');
      } catch (loadError) {
        setError(getApiErrorMessage(loadError));
        setUsers([]);
        setTotalUsers(0);
        setTotalPages(0);
      } finally {
        setLoading(false);
        if (mode === 'refresh') setRefreshing(false);
      }
    },
    [associationId, currentPage, searchTerm],
  );

  const loadSupportData = useCallback(async () => {
    if (!associationId) return;
    const [assignmentsResult, membersResult] = await Promise.allSettled([
      canManageRbac ? listUserRoleAssignments(0, 1000) : Promise.resolve({ content: [] }),
      canReadMembers ? getAllAssociationMembers(associationId, { size: 500 }) : Promise.resolve({ content: [] }),
    ]);

    if (assignmentsResult.status === 'fulfilled') {
      setRbacAssignments(assignmentsResult.value.content || []);
    } else {
      setRbacAssignments([]);
    }

    if (membersResult.status === 'fulfilled') {
      setMemberUserIds(new Set((membersResult.value.content || []).map((member) => member.userId).filter(Boolean) as string[]));
    } else {
      setMemberUserIds(new Set());
    }
  }, [associationId, canManageRbac, canReadMembers]);

  useEffect(() => {
    if (activeView !== 'ADMIN') return;
    const delay = searchTerm.trim() ? 350 : 0;
    const timer = setTimeout(() => {
      const mode = initialLoadComplete.current ? 'silent' : 'initial';
      void loadUsers(mode, currentPage, searchTerm).finally(() => {
        initialLoadComplete.current = true;
      });
    }, delay);
    return () => clearTimeout(timer);
  }, [activeView, currentPage, loadUsers, searchTerm]);

  useEffect(() => {
    if (activeView !== 'ADMIN') return;
    void Promise.resolve().then(loadSupportData);
  }, [activeView, loadSupportData]);

  useEffect(() => {
    if (initialPreviewConsumed.current || users.length === 0) return;
    void Promise.resolve().then(() => {
      const target = initialUserId ? users.find((row) => row.id === initialUserId) : users[0];
      if (!target) return;
      initialPreviewConsumed.current = true;
      if (initialMode === 'convert') setConvertTarget(target);
      else if (initialMode === 'detail') setSelectedUser(target);
    });
  }, [initialMode, initialUserId, users]);

  const refreshData = () => {
    setNotice(null);
    void loadUsers('refresh', 0, searchTerm);
    void loadSupportData();
  };

  const convertSelectedUser = async () => {
    if (!associationId || !convertTarget) return;
    setConverting(true);
    setError(null);
    try {
      await convertAssociationUserToMember(associationId, convertTarget.id);
      setNotice(`${convertTarget.fullName} converted to member.`);
      setMemberUserIds((current) => new Set([...current, convertTarget.id]));
      setConvertTarget(null);
      setSelectedUser(null);
      await loadUsers('silent', currentPage, searchTerm);
    } catch (convertError) {
      setError(getApiErrorMessage(convertError));
    } finally {
      setConverting(false);
    }
  };

  const openAddUser = () => {
    const route = getRouteByPath('/associations/users/new');
    if (route) router.push({ pathname: '/work/route-preview', params: { routeId: route.id } } as never);
  };

  const openRbacUsers = () => {
    const route = getRouteByPath('/associations/settings/roles');
    if (route) router.push({ pathname: '/work/route-preview', params: { routeId: route.id, tab: 'users' } } as never);
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Association users" description="User access management is available from association admin workspaces only." />;
  }

  if (loading && users.length === 0) {
    return <MobilePageLoadingState kind="list" message="Loading association users" />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Settings"
        title="Association users"
        subtitle="Manage system access, roles, and exports"
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh users" variant="secondary" disabled={refreshing} onPress={refreshData} />}
      />

      {error ? <MobileErrorState title="User access issue" description={error} retryLabel="Reload" onRetry={refreshData} /> : null}
      {notice ? <MobileToast title={notice} /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="System users" value={formatNumber(metrics.total)} description="Members excluded" icon={UsersRound} tone="blue" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Active users" value={formatNumber(metrics.activeUsers)} description="Can access the system" icon={UserCheck} tone="green" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="RBAC assigned" value={formatNumber(metrics.assignedRbac)} description={`${formatNumber(metrics.noRbac)} without RBAC`} icon={ShieldCheck} tone="purple" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Admin access" value={formatNumber(metrics.adminAccess)} description={`${formatNumber(metrics.firstLogin)} first login pending`} icon={UserCog} tone="orange" />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard compact style={styles.toolbarCard}>
        <View style={styles.actionsRow}>
          <View style={styles.flex}>
            <MobileText variant="body" weight="bold">
              System Users & Access
            </MobileText>
            <MobileText variant="small" tone="secondary">
              {searchTerm.trim() ? `${formatNumber(visibleUsers.length)} matching loaded users` : `${formatNumber(totalUsers || users.length)} total system users`}
            </MobileText>
          </View>
          <MobileButton label="Add" icon={Plus} size="sm" disabled={!canInviteUsers} onPress={openAddUser} />
        </View>
        <MobileSearchToolbar
          value={searchTerm}
          onChange={(value) => {
            setSearchTerm(value);
            setCurrentPage(0);
            setNotice(null);
          }}
          placeholder="Search name, email, or phone..."
          onFilterPress={() => setSortOpen(true)}
          filterLabel="Sort"
        />
        <MobileStatusTabs tabs={tabs} value={filter} onChange={(value) => setFilter(value as UserFilter)} />
        <View style={styles.actionsRow}>
          <MobileReportExportButton options={userReportOptions} size="sm" onSuccess={(_uri, format) => setNotice(`${format.toUpperCase()} user report is ready.`)} onError={(exportError) => setError(getApiErrorMessage(exportError))} />
          <MobileButton label="RBAC" icon={ShieldCheck} variant="secondary" size="sm" disabled={!canManageRbac} onPress={openRbacUsers} />
        </View>
      </MobileCard>

      {visibleUsers.length ? (
        <MobileDataList items={listItems} onPressItem={(item) => setSelectedUser(users.find((row) => row.id === item.id) || null)} />
      ) : (
        <MobileEmptyState
          title="No users found"
          description={searchTerm.trim() ? 'No system users match the current search or filter.' : 'No system users are available for this association.'}
          actionLabel={searchTerm.trim() ? 'Clear search' : canInviteUsers ? 'Add user' : undefined}
          onAction={searchTerm.trim() ? () => setSearchTerm('') : canInviteUsers ? openAddUser : undefined}
        />
      )}

      {totalPages > 1 ? (
        <MobileCard compact style={styles.paginationCard}>
          <MobileText variant="small" tone="secondary">
            Page {currentPage + 1} of {totalPages}
          </MobileText>
          <View style={styles.paginationButtons}>
            <MobileButton label="Previous" variant="secondary" size="sm" disabled={currentPage === 0 || refreshing} onPress={() => setCurrentPage((page) => Math.max(0, page - 1))} />
            <MobileButton label="Next" variant="secondary" size="sm" disabled={currentPage >= totalPages - 1 || refreshing} onPress={() => setCurrentPage((page) => Math.min(totalPages - 1, page + 1))} />
          </View>
        </MobileCard>
      ) : null}

      <MobileSortSheet
        visible={sortOpen}
        value={sort}
        options={sortOptions}
        onChange={(value) => setSort(value as UserSort)}
        onClose={() => setSortOpen(false)}
      />

      <UserDetailSheet
        user={selectedUser}
        roles={selectedUser ? rolesByUserId[selectedUser.id] || [] : []}
        canManageRbac={canManageRbac}
        canConvert={Boolean(selectedUser && canConvertMembers && !memberUserIds.has(selectedUser.id))}
        onClose={() => setSelectedUser(null)}
        onOpenRbac={openRbacUsers}
        onConvert={() => {
          if (selectedUser) setConvertTarget(selectedUser);
        }}
      />

      <MobileConfirmSheet
        visible={Boolean(convertTarget)}
        title="Convert user to member"
        description={
          convertTarget
            ? `Create a member profile for ${convertTarget.fullName}. This changes their association participation workflow.`
            : 'Create a member profile for this user.'
        }
        confirmLabel="Convert"
        loading={converting}
        onCancel={() => setConvertTarget(null)}
        onConfirm={() => void convertSelectedUser()}
      />
    </MobileScreen>
  );
}

function UserDetailSheet({
  user,
  roles,
  canManageRbac,
  canConvert,
  onClose,
  onOpenRbac,
  onConvert,
}: {
  user: AssociationUser | null;
  roles: string[];
  canManageRbac: boolean;
  canConvert: boolean;
  onClose: () => void;
  onOpenRbac: () => void;
  onConvert: () => void;
}) {
  if (!user) return null;
  const accessTone = accessToneForUser(user);

  return (
    <MobileSheet visible={Boolean(user)} title={user.fullName} description={user.email} onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
        <MobileCard compact accent={accessTone}>
          <View style={styles.detailHeader}>
            <View style={styles.avatarLarge}>
              <MobileText variant="section" weight="bold" tone="inverse">
                {initialsFromName(user.fullName)}
              </MobileText>
            </View>
            <View style={styles.flex}>
              <MobileText variant="body" weight="bold">
                {accessLabelForUser(user)}
              </MobileText>
              <MobileText variant="small" tone="secondary">
                {roleLabelForUser(user, { [user.id]: roles })}
              </MobileText>
            </View>
            <MobileStatusBadge status={user.active ? 'Active' : 'Inactive'} tone={user.active ? 'success' : 'neutral'} />
          </View>
        </MobileCard>

        <MobileInfoRow label="Email" value={user.email || 'Not available'} helper="Primary login identity" icon={Mail} />
        <MobileInfoRow label="Phone" value={user.phoneNumber || 'Not available'} helper="Contact number" icon={Phone} />
        <MobileInfoRow label="Association role" value={user.associationRole || 'Not available'} helper={`System role: ${user.systemRole || 'Not available'}`} icon={UserCog} />
        <MobileInfoRow label="RBAC roles" value={roles.length ? roles.join(', ') : 'No RBAC role'} helper={roles.length ? 'Assigned through role management.' : 'Use RBAC to assign explicit access.'} icon={ShieldCheck} />
        <MobileInfoRow label="Joined" value={formatDate(user.createdAt)} helper={user.firstLogin ? 'First login is still pending.' : 'Initial login completed.'} icon={SlidersHorizontal} />

        <View style={styles.sheetActions}>
          {user.email ? (
            <MobileButton label="Email" icon={Mail} variant="secondary" fullWidth onPress={() => Linking.openURL(`mailto:${user.email}`)} />
          ) : null}
          <MobileButton label="Manage RBAC" icon={ShieldCheck} variant="secondary" fullWidth disabled={!canManageRbac} onPress={onOpenRbac} />
          {canConvert ? <MobileButton label="Convert to member" icon={UserCheck} fullWidth onPress={onConvert} /> : null}
        </View>
      </ScrollView>
    </MobileSheet>
  );
}

function accessLabelForUser(user: AssociationUser) {
  return isAdminAccess(user) ? 'Admin access' : 'Member access';
}

function roleSummary(user: AssociationUser, rolesByUserId: Record<string, string[]>) {
  const roles = rolesByUserId[user.id] || [];
  if (roles.length) return roles.length > 1 ? `${roles[0]} +${roles.length - 1}` : roles[0];
  return accessLabelForUser(user);
}

function roleLabelForUser(user: AssociationUser, rolesByUserId: Record<string, string[]>) {
  const roles = rolesByUserId[user.id] || [];
  return roles.length ? roles.join(', ') : accessLabelForUser(user);
}

function isAdminAccess(user: AssociationUser) {
  return String(user.associationRole || '').toUpperCase() !== 'MEMBER' && String(user.systemRole || '').toUpperCase() !== 'ASSOCIATION_USER';
}

function accessToneForUser(user: AssociationUser): KpiTone {
  if (!user.active) return 'slate';
  return isAdminAccess(user) ? 'blue' : 'green';
}

function hasPermission(user: ReturnType<typeof useAuth>['user'], values: string[]) {
  if (!user) return false;
  if (user.isTechy8Admin) return true;
  const normalized = [...(user.permissions || []), ...(user.roles || []), user.associationRole || '', user.systemRole || '']
    .filter(Boolean)
    .map((value) => value.toLowerCase().replace(/[\s-]+/g, '_'));
  if (normalized.some((value) => ['admin', 'association_admin', 'system_admin'].includes(value))) return true;
  return values.some((value) => normalized.includes(value.toLowerCase().replace(/[\s-]+/g, '_')));
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const styles = StyleSheet.create({
  toolbarCard: {
    gap: 14,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  paginationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  paginationButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  sheetContent: {
    gap: 12,
    paddingBottom: 8,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarLarge: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
  },
  sheetActions: {
    gap: 10,
  },
});
