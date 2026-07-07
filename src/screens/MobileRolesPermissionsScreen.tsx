import { router } from 'expo-router';
import {
  Archive,
  KeyRound,
  LockKeyhole,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileCheckboxRow,
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
  MobileScreen,
  MobileSearchToolbar,
  MobileSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
  MobileTextInput,
  MobileToast,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  archiveAssociationRole,
  createAssociationRole,
  getAssociationRole,
  getEffectivePermissions,
  listAssociationRoles,
  listMemberRoleAssignments,
  listPermissionCatalog,
  listRbacAuditEvents,
  listUserRoleAssignments,
  restoreAssociationRole,
  updateAssociationRole,
  updateAssociationRolePermissions,
  updateMemberRoleAssignments,
  updateUserRoleAssignments,
  type AssociationRole,
  type AssociationRoleDetail,
  type EffectivePermissionsResponse,
  type RbacAuditEvent,
  type RbacMemberAssignment,
  type RbacPermission,
  type RbacPermissionGroup,
  type RbacUserAssignment,
} from '@/services/association-rbac-service';
import { type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatNumber, initialsFromName } from '@/utils/format';

type RolesTab = 'roles' | 'users' | 'members' | 'audit';
type RoleAction = 'archive' | 'restore';
type AssignmentTarget =
  | { type: 'user'; item: RbacUserAssignment }
  | { type: 'member'; item: RbacMemberAssignment };

type MobileRolesPermissionsScreenProps = {
  initialTab?: RolesTab;
  initialMode?: 'create' | 'edit' | 'assign';
};

const pageSize = 10;

export default function MobileRolesPermissionsScreen({
  initialTab,
  initialMode,
}: MobileRolesPermissionsScreenProps) {
  const { activeView, associationId, user } = useAuth();
  const [tab, setTab] = useState<RolesTab>(initialTab || 'roles');
  const [roles, setRoles] = useState<AssociationRole[]>([]);
  const [permissionGroups, setPermissionGroups] = useState<RbacPermissionGroup[]>([]);
  const [effectivePermissions, setEffectivePermissions] = useState<EffectivePermissionsResponse | null>(null);
  const [userAssignments, setUserAssignments] = useState<RbacUserAssignment[]>([]);
  const [memberAssignments, setMemberAssignments] = useState<RbacMemberAssignment[]>([]);
  const [auditEvents, setAuditEvents] = useState<RbacAuditEvent[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const selectedRoleIdRef = useRef<string | null>(null);
  const [roleDetail, setRoleDetail] = useState<AssociationRoleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [roleEditorOpen, setRoleEditorOpen] = useState(false);
  const [roleEditorMode, setRoleEditorMode] = useState<'create' | 'edit'>('create');
  const [roleAction, setRoleAction] = useState<{ type: RoleAction; role: AssociationRole } | null>(null);
  const [assignmentTarget, setAssignmentTarget] = useState<AssignmentTarget | null>(null);
  const handledInitialModeRef = useRef(false);

  const canManageRoles = useMemo(() => hasPermission(user, 'rbac.roles.manage'), [user]);
  const canManageAssignments = useMemo(() => hasPermission(user, 'rbac.assignments.manage'), [user]);
  const canAudit = useMemo(() => hasPermission(user, 'audit.view'), [user]);
  const activeRoles = useMemo(() => roles.filter((role) => role.active && !role.archived), [roles]);
  const selectedRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) || roles[0] || null,
    [roles, selectedRoleId],
  );
  const selectedPermissionKeys = useMemo(() => roleDetail?.permissionKeys || [], [roleDetail?.permissionKeys]);
  const selectedPermissionKeySet = useMemo(() => new Set(selectedPermissionKeys), [selectedPermissionKeys]);

  useEffect(() => {
    selectedRoleIdRef.current = selectedRoleId;
  }, [selectedRoleId]);

  const loadRoles = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      if (mode === 'refresh') setNotice(null);

      try {
        const [catalog, roleRows, effective, userPage, memberPage, auditPage] = await Promise.all([
          listPermissionCatalog(),
          listAssociationRoles(),
          getEffectivePermissions(associationId),
          canManageAssignments ? listUserRoleAssignments(0, pageSize) : Promise.resolve({ content: [], totalElements: 0, totalPages: 0, number: 0, size: pageSize }),
          canManageAssignments ? listMemberRoleAssignments(0, pageSize) : Promise.resolve({ content: [], totalElements: 0, totalPages: 0, number: 0, size: pageSize }),
          canAudit ? listRbacAuditEvents(0, pageSize) : Promise.resolve({ content: [], totalElements: 0, totalPages: 0, number: 0, size: pageSize }),
        ]);

        setPermissionGroups(catalog || []);
        setRoles(roleRows || []);
        setEffectivePermissions(effective || null);
        setUserAssignments(userPage.content || []);
        setMemberAssignments(memberPage.content || []);
        setAuditEvents(auditPage.content || []);

        const currentSelected = selectedRoleIdRef.current;
        const nextSelected = currentSelected && roleRows.some((role) => role.id === currentSelected)
          ? currentSelected
          : roleRows[0]?.id || null;
        setSelectedRoleId(nextSelected);

        if (nextSelected) {
          setRoleDetail(await getAssociationRole(nextSelected));
        } else {
          setRoleDetail(null);
        }

        if (mode === 'refresh') setNotice('Roles and permissions refreshed.');
      } catch (loadError) {
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId, canAudit, canManageAssignments],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadRoles('initial'));
  }, [loadRoles]);

  useEffect(() => {
    if (initialMode === 'create' && !loading && canManageRoles && !roleEditorOpen && !handledInitialModeRef.current) {
      handledInitialModeRef.current = true;
      void Promise.resolve().then(() => {
        setRoleEditorMode('create');
        setRoleEditorOpen(true);
      });
    }
  }, [canManageRoles, initialMode, loading, roleEditorOpen]);

  const selectRole = async (roleId: string) => {
    setSelectedRoleId(roleId);
    setError(null);
    try {
      setRoleDetail(await getAssociationRole(roleId));
      setTab('roles');
    } catch (roleError) {
      setError(getApiErrorMessage(roleError));
    }
  };

  const saveRole = async (draft: RoleEditorDraft) => {
    if (!canManageRoles) {
      setError('You do not have permission to manage roles.');
      return;
    }
    const permissionKeys = Array.from(draft.permissionKeys);
    if (!draft.name.trim()) {
      setError('Role name is required.');
      return;
    }
    if (permissionKeys.length === 0) {
      setError('Select at least one permission for this role.');
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      let detail: AssociationRoleDetail;
      if (draft.roleId) {
        await updateAssociationRole(draft.roleId, {
          name: draft.name.trim(),
          description: draft.description.trim(),
          reason: draft.reason.trim(),
        });
        detail = await updateAssociationRolePermissions(draft.roleId, permissionKeys, draft.reason.trim());
      } else {
        detail = await createAssociationRole({
          name: draft.name.trim(),
          description: draft.description.trim(),
          permissionKeys,
          reason: draft.reason.trim(),
        });
      }
      setSelectedRoleId(detail.role.id);
      setRoleDetail(detail);
      setRoleEditorOpen(false);
      setNotice(draft.roleId ? 'Role updated.' : 'Role created.');
      await loadRoles('refresh');
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const saveRoleAction = async (reason: string) => {
    if (!roleAction || !canManageRoles) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const detail = roleAction.type === 'archive'
        ? await archiveAssociationRole(roleAction.role.id, reason.trim())
        : await restoreAssociationRole(roleAction.role.id, reason.trim());
      setRoleDetail(detail);
      setSelectedRoleId(detail.role.id);
      setRoleAction(null);
      setNotice(roleAction.type === 'archive' ? 'Role archived.' : 'Role restored.');
      await loadRoles('refresh');
    } catch (actionError) {
      setError(getApiErrorMessage(actionError));
    } finally {
      setSaving(false);
    }
  };

  const saveAssignment = async (roleIds: string[], reason: string) => {
    if (!assignmentTarget || !canManageAssignments) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      if (assignmentTarget.type === 'user') {
        await updateUserRoleAssignments(assignmentTarget.item.userId, roleIds, reason.trim());
      } else {
        await updateMemberRoleAssignments(assignmentTarget.item.memberId, roleIds, reason.trim());
      }
      setAssignmentTarget(null);
      setNotice(assignmentTarget.type === 'user' ? 'User roles updated.' : 'Member roles updated.');
      await loadRoles('refresh');
    } catch (assignmentError) {
      setError(getApiErrorMessage(assignmentError));
    } finally {
      setSaving(false);
    }
  };

  const metrics = useMemo(() => {
    const totalAssignedUsers = roles.reduce((sum, role) => sum + role.assignedUserCount, 0);
    const protectedRoles = roles.filter((role) => role.protectedRole).length;
    const archivedRoles = roles.filter((role) => role.archived).length;
    const catalogCount = permissionGroups.reduce((sum, group) => sum + group.permissions.length, 0);
    return {
      activeRoles: activeRoles.length,
      totalRoles: roles.length,
      protectedRoles,
      archivedRoles,
      totalAssignedUsers,
      catalogCount,
      userAssignments: userAssignments.length,
      memberAssignments: memberAssignments.length,
      auditEvents: auditEvents.length,
    };
  }, [activeRoles.length, auditEvents.length, memberAssignments.length, permissionGroups, roles, userAssignments.length]);

  const tabs = useMemo(
    () => [
      { value: 'roles', label: 'Roles', count: metrics.totalRoles },
      { value: 'users', label: 'Users', count: metrics.userAssignments },
      { value: 'members', label: 'Members', count: metrics.memberAssignments },
      ...(canAudit ? [{ value: 'audit', label: 'Audit', count: metrics.auditEvents }] : []),
    ],
    [canAudit, metrics.auditEvents, metrics.memberAssignments, metrics.totalRoles, metrics.userAssignments],
  );

  const filteredRoles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle || tab !== 'roles') return roles;
    return roles.filter((role) => [role.name, role.description, role.code, role.templateCode].join(' ').toLowerCase().includes(needle));
  }, [query, roles, tab]);

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return userAssignments;
    return userAssignments.filter((assignment) =>
      [assignment.fullName, assignment.email, assignment.associationRole, ...assignment.roles.map((role) => role.name)].join(' ').toLowerCase().includes(needle),
    );
  }, [query, userAssignments]);

  const filteredMembers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return memberAssignments;
    return memberAssignments.filter((assignment) =>
      [assignment.fullName, assignment.email, assignment.membershipNumber, assignment.status, ...assignment.roles.map((role) => role.name)].join(' ').toLowerCase().includes(needle),
    );
  }, [memberAssignments, query]);

  const filteredAudit = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return auditEvents;
    return auditEvents.filter((event) =>
      [event.eventType, event.actorEmail, event.roleName, event.permissionKey, event.reason].join(' ').toLowerCase().includes(needle),
    );
  }, [auditEvents, query]);

  const roleItems = useMemo<MobileDataListItem[]>(
    () =>
      filteredRoles.map((role) => ({
        id: role.id,
        title: role.name,
        subtitle: role.description || 'No description',
        meta: [role.code, role.protectedRole ? 'Protected' : role.systemRole ? 'System' : 'Custom'].filter(Boolean).join(' · '),
        amount: `${formatNumber(role.permissionCount)} perms`,
        status: role.archived ? 'Inactive' : role.active ? 'Active' : 'Draft',
        statusLabel: role.archived ? 'Archived' : role.active ? 'Active' : 'Inactive',
        statusTone: role.archived ? 'neutral' : role.active ? 'success' : 'warning',
        initials: initialsFromName(role.name),
        accent: role.protectedRole ? 'warning' : role.archived ? 'neutral' : 'primary',
      })),
    [filteredRoles],
  );

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Roles & permissions" description="Role management is available for association admin workspaces only." />;
  }

  if (loading) {
    return <MobilePageLoadingState kind="list" message="Loading roles and permissions" />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Settings"
        title="Roles & permissions"
        subtitle="Control association access and audit changes"
        onBack={() => router.back()}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Refresh roles"
            variant="secondary"
            disabled={refreshing || saving}
            onPress={() => void loadRoles('refresh')}
          />
        }
      />

      {error ? <MobileErrorState title="RBAC issue" description={error} retryLabel="Reload" onRetry={() => void loadRoles('refresh')} /> : null}
      {notice ? <MobileToast title={notice} /> : null}
      {!canManageRoles ? (
        <MobileToast title="Read-only access" description="This account can view roles but cannot change role definitions." tone="warning" />
      ) : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Active roles" value={formatNumber(metrics.activeRoles)} description={`${formatNumber(metrics.totalRoles)} total roles`} icon={ShieldCheck} tone="blue" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Assignments" value={formatNumber(metrics.totalAssignedUsers)} description="Users with role grants" icon={Users} tone="green" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Protected" value={formatNumber(metrics.protectedRoles)} description={`${formatNumber(metrics.archivedRoles)} archived roles`} icon={LockKeyhole} tone="orange" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Permissions" value={formatNumber(metrics.catalogCount)} description={`Version ${effectivePermissions?.permissionVersion ?? 0}`} icon={KeyRound} tone="purple" />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileStatusTabs tabs={tabs} value={tab} onChange={(value) => setTab(parseTab(value, canAudit))} />

      <MobileSearchToolbar
        value={query}
        onChange={setQuery}
        placeholder={tab === 'roles' ? 'Search roles...' : tab === 'users' ? 'Search users...' : tab === 'members' ? 'Search members...' : 'Search audit...'}
      />

      {tab === 'roles' ? (
        <View style={styles.stack}>
          <MobileCard compact style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.flex}>
                <MobileText variant="section" weight="bold">
                  Association roles
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  Select a role to inspect permissions and manage lifecycle.
                </MobileText>
              </View>
              <MobileButton
                label="New role"
                icon={Plus}
                size="sm"
                disabled={!canManageRoles || saving}
                onPress={() => {
                  setRoleEditorMode('create');
                  setRoleEditorOpen(true);
                }}
              />
            </View>
            {roleItems.length ? (
              <MobileDataList items={roleItems} onPressItem={(item) => void selectRole(item.id)} />
            ) : (
              <MobileEmptyState title="No roles found" description="Create the first association role or reset the search." />
            )}
          </MobileCard>

          {selectedRole ? (
            <MobileCard compact accent={selectedRole.archived ? 'slate' : selectedRole.protectedRole ? 'orange' : 'blue'} style={styles.sectionCard}>
              <View style={styles.detailHeader}>
                <View style={styles.flex}>
                  <View style={styles.roleTitleRow}>
                    <MobileText variant="section" weight="bold">
                      {selectedRole.name}
                    </MobileText>
                    <MobileStatusBadge
                      status={selectedRole.archived ? 'Inactive' : 'Active'}
                      label={selectedRole.archived ? 'Archived' : selectedRole.protectedRole ? 'Protected' : 'Active'}
                      tone={selectedRole.archived ? 'neutral' : selectedRole.protectedRole ? 'warning' : 'success'}
                    />
                  </View>
                  <MobileText variant="small" tone="secondary">
                    {selectedRole.description || 'No description'}
                  </MobileText>
                </View>
              </View>
              <View style={styles.actions}>
                <MobileButton
                  label="Edit"
                  icon={SlidersHorizontal}
                  variant="secondary"
                  size="sm"
                  disabled={!canManageRoles || selectedRole.archived || saving}
                  onPress={() => {
                    setRoleEditorMode('edit');
                    setRoleEditorOpen(true);
                  }}
                />
                {selectedRole.archived ? (
                  <MobileButton label="Restore" icon={RotateCcw} variant="secondary" size="sm" disabled={!canManageRoles || saving} onPress={() => setRoleAction({ type: 'restore', role: selectedRole })} />
                ) : (
                  <MobileButton
                    label="Archive"
                    icon={Archive}
                    variant="secondary"
                    size="sm"
                    disabled={!canManageRoles || selectedRole.protectedRole || selectedRole.systemRole || saving}
                    onPress={() => setRoleAction({ type: 'archive', role: selectedRole })}
                  />
                )}
              </View>
              <MobileInfoRow label="Permission count" value={formatNumber(roleDetail?.permissionKeys.length ?? selectedRole.permissionCount)} helper="Expanded effective permissions on this role." icon={KeyRound} />
              <MobileInfoRow label="Assigned users" value={formatNumber(selectedRole.assignedUserCount)} helper="Users currently receiving this role." icon={Users} />
              <PermissionGroupSummary groups={permissionGroups} selectedKeys={selectedPermissionKeySet} />
            </MobileCard>
          ) : null}
        </View>
      ) : null}

      {tab === 'users' ? (
        <AssignmentList
          title="Association users"
          description="Assign one or more roles to login users."
          emptyTitle={canManageAssignments ? 'No users found' : 'Assignment access required'}
          emptyDescription={canManageAssignments ? 'No association users match the current search.' : 'This account needs rbac.assignments.manage to view and update user assignments.'}
          items={filteredUsers.map(userAssignmentToListItem)}
          onPressItem={(item) => {
            const assignment = userAssignments.find((userAssignment) => userAssignment.userId === item.id);
            if (assignment) setAssignmentTarget({ type: 'user', item: assignment });
          }}
          disabled={!canManageAssignments}
        />
      ) : null}

      {tab === 'members' ? (
        <AssignmentList
          title="Member assignments"
          description="Assign roles directly to members, including linked accounts."
          emptyTitle={canManageAssignments ? 'No members found' : 'Assignment access required'}
          emptyDescription={canManageAssignments ? 'No association members match the current search.' : 'This account needs rbac.assignments.manage to view and update member assignments.'}
          items={filteredMembers.map(memberAssignmentToListItem)}
          onPressItem={(item) => {
            const assignment = memberAssignments.find((memberAssignment) => memberAssignment.memberId === item.id);
            if (assignment) setAssignmentTarget({ type: 'member', item: assignment });
          }}
          disabled={!canManageAssignments}
        />
      ) : null}

      {tab === 'audit' ? (
        <MobileCard compact style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.flex}>
              <MobileText variant="section" weight="bold">
                RBAC audit
              </MobileText>
              <MobileText variant="small" tone="secondary">
                Role, permission and assignment changes.
              </MobileText>
            </View>
            <MobileStatusBadge status="Published" label={`${formatNumber(filteredAudit.length)} events`} tone="info" />
          </View>
          {filteredAudit.length ? (
            <MobileDataList
              items={filteredAudit.map((event) => ({
                id: event.id,
                title: formatEventType(event.eventType),
                subtitle: event.actorEmail || 'System',
                meta: [event.roleName, event.permissionKey, event.reason || 'No reason'].filter(Boolean).join(' · '),
                amount: formatDateTime(event.createdAt),
                status: event.targetMemberId ? 'Member' : event.targetUserId ? 'User' : 'Published',
                statusLabel: event.targetMemberId ? 'Member' : event.targetUserId ? 'User' : 'Role',
                statusTone: event.targetMemberId ? 'review' : event.targetUserId ? 'primary' : 'info',
                initials: 'AU',
                accent: 'info',
              }))}
              showChevron={false}
            />
          ) : (
            <MobileEmptyState title="No audit events" description={canAudit ? 'Role changes will appear here.' : 'This account needs audit.view to read RBAC audit events.'} />
          )}
        </MobileCard>
      ) : null}

      <RoleEditorSheet
        visible={roleEditorOpen}
        role={selectedRole}
        permissionGroups={permissionGroups}
        selectedPermissionKeys={selectedPermissionKeys}
        saving={saving}
        canManage={canManageRoles}
        onClose={() => setRoleEditorOpen(false)}
        onSave={saveRole}
        createMode={roleEditorMode === 'create'}
      />

      <RoleActionSheet
        action={roleAction}
        saving={saving}
        onClose={() => setRoleAction(null)}
        onSave={saveRoleAction}
      />

      <AssignmentSheet
        target={assignmentTarget}
        activeRoles={activeRoles}
        saving={saving}
        canManage={canManageAssignments}
        onClose={() => setAssignmentTarget(null)}
        onSave={saveAssignment}
      />
    </MobileScreen>
  );
}

type RoleEditorDraft = {
  roleId?: string;
  name: string;
  description: string;
  reason: string;
  permissionKeys: Set<string>;
};

function RoleEditorSheet({
  visible,
  role,
  permissionGroups,
  selectedPermissionKeys,
  saving,
  canManage,
  onClose,
  onSave,
  createMode,
}: {
  visible: boolean;
  role: AssociationRole | null;
  permissionGroups: RbacPermissionGroup[];
  selectedPermissionKeys: string[];
  saving: boolean;
  canManage: boolean;
  onClose: () => void;
  onSave: (draft: RoleEditorDraft) => void;
  createMode?: boolean;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [reason, setReason] = useState('');
  const [permissionKeys, setPermissionKeys] = useState<Set<string>>(new Set());
  const [permissionSearch, setPermissionSearch] = useState('');

  useEffect(() => {
    if (!visible) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setName(createMode ? '' : role?.name || '');
      setDescription(createMode ? '' : role?.description || '');
      setReason('');
      setPermissionKeys(createMode ? new Set() : new Set(selectedPermissionKeys));
      setPermissionSearch('');
    });
    return () => {
      active = false;
    };
  }, [createMode, role?.description, role?.name, selectedPermissionKeys, visible]);

  const flattenedPermissions = useMemo(
    () => flattenPermissions(permissionGroups, permissionSearch),
    [permissionGroups, permissionSearch],
  );

  const togglePermission = (permissionKey: string, checked: boolean) => {
    setPermissionKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(permissionKey);
      else next.delete(permissionKey);
      return next;
    });
  };

  return (
    <MobileSheet visible={visible} title={createMode ? 'Create role' : 'Edit role'} description="Select the screens and actions this role should unlock." onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>
        <MobileTextInput label="Role name" value={name} onChangeText={setName} placeholder="Finance officer" disabled={saving || !canManage} />
        <MobileTextInput label="Description" value={description} onChangeText={setDescription} placeholder="What this role is allowed to do" multiline numberOfLines={3} disabled={saving || !canManage} />
        <MobileTextInput label="Audit note" value={reason} onChangeText={setReason} placeholder="Why this role is changing" disabled={saving || !canManage} />
        <MobileSearchToolbar value={permissionSearch} onChange={setPermissionSearch} placeholder="Search permissions..." />
        <View style={styles.selectedSummary}>
          <MobileStatusBadge status="Published" label={`${formatNumber(permissionKeys.size)} selected`} tone="primary" />
          <MobileText variant="small" tone="secondary">
            High-risk and owner permissions should be assigned carefully.
          </MobileText>
        </View>
        {flattenedPermissions.map((permission) => (
          <MobileCheckboxRow
            key={permission.key}
            label={permission.label}
            description={`${permission.groupLabel} · ${permission.key} · ${permission.riskLevel}`}
            checked={permissionKeys.has(permission.key)}
            disabled={saving || !canManage}
            onChange={(checked) => togglePermission(permission.key, checked)}
          />
        ))}
        {flattenedPermissions.length === 0 ? <MobileEmptyState title="No permissions found" description="Try another permission search." /> : null}
      </ScrollView>
      <View style={styles.sheetActions}>
        <MobileButton label="Cancel" variant="secondary" onPress={onClose} disabled={saving} />
        <MobileButton
          label="Save role"
          icon={Save}
          loading={saving}
          disabled={!canManage || !name.trim() || permissionKeys.size === 0}
          fullWidth
          style={styles.sheetPrimary}
          onPress={() => onSave({ roleId: createMode ? undefined : role?.id, name, description, reason, permissionKeys })}
        />
      </View>
    </MobileSheet>
  );
}

function RoleActionSheet({
  action,
  saving,
  onClose,
  onSave,
}: {
  action: { type: RoleAction; role: AssociationRole } | null;
  saving: boolean;
  onClose: () => void;
  onSave: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!action) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (active) setReason('');
    });
    return () => {
      active = false;
    };
  }, [action]);

  const isArchive = action?.type === 'archive';
  return (
    <MobileSheet
      visible={Boolean(action)}
      title={isArchive ? 'Archive role' : 'Restore role'}
      description={action ? `${isArchive ? 'Archive' : 'Restore'} ${action.role.name}. Permission changes apply immediately.` : undefined}
      onClose={onClose}
    >
      {isArchive ? (
        <MobileToast title="Protected safety" description="Protected and system roles cannot be archived." tone="warning" />
      ) : null}
      <MobileTextInput label="Audit note" value={reason} onChangeText={setReason} placeholder={isArchive ? 'Why this role is being archived' : 'Why this role is being restored'} disabled={saving} />
      <View style={styles.sheetActions}>
        <MobileButton label="Cancel" variant="secondary" onPress={onClose} disabled={saving} />
        <MobileButton
          label={isArchive ? 'Archive role' : 'Restore role'}
          icon={isArchive ? Archive : RotateCcw}
          variant={isArchive ? 'danger' : 'primary'}
          loading={saving}
          fullWidth
          style={styles.sheetPrimary}
          onPress={() => onSave(reason)}
        />
      </View>
    </MobileSheet>
  );
}

function AssignmentSheet({
  target,
  activeRoles,
  saving,
  canManage,
  onClose,
  onSave,
}: {
  target: AssignmentTarget | null;
  activeRoles: AssociationRole[];
  saving: boolean;
  canManage: boolean;
  onClose: () => void;
  onSave: (roleIds: string[], reason: string) => void;
}) {
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!target) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setSelectedRoleIds(new Set(target.item.roles.map((role) => role.id)));
      setReason('');
    });
    return () => {
      active = false;
    };
  }, [target]);

  const toggleRole = (roleId: string, checked: boolean) => {
    setSelectedRoleIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(roleId);
      else next.delete(roleId);
      return next;
    });
  };

  return (
    <MobileSheet
      visible={Boolean(target)}
      title="Assign roles"
      description={target ? `${target.item.fullName}${target.type === 'user' && 'email' in target.item ? ` · ${target.item.email}` : ''}` : undefined}
      onClose={onClose}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>
        {activeRoles.map((role) => (
          <MobileCheckboxRow
            key={role.id}
            label={role.name}
            description={`${role.description || 'No description'} · ${formatNumber(role.permissionCount)} permissions`}
            checked={selectedRoleIds.has(role.id)}
            disabled={saving || !canManage}
            onChange={(checked) => toggleRole(role.id, checked)}
          />
        ))}
        {activeRoles.length === 0 ? <MobileEmptyState title="No active roles" description="Create or restore a role before assigning access." /> : null}
        {selectedRoleIds.size === 0 ? <MobileToast title="No active roles selected" description="This subject will not receive custom association access." tone="warning" /> : null}
        <MobileTextInput label="Audit note" value={reason} onChangeText={setReason} placeholder="Why these assignments are changing" disabled={saving || !canManage} />
      </ScrollView>
      <View style={styles.sheetActions}>
        <MobileButton label="Cancel" variant="secondary" onPress={onClose} disabled={saving} />
        <MobileButton
          label="Save assignments"
          icon={Save}
          loading={saving}
          disabled={!canManage}
          fullWidth
          style={styles.sheetPrimary}
          onPress={() => onSave(Array.from(selectedRoleIds), reason)}
        />
      </View>
    </MobileSheet>
  );
}

function AssignmentList({
  title,
  description,
  emptyTitle,
  emptyDescription,
  items,
  onPressItem,
  disabled,
}: {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  items: MobileDataListItem[];
  onPressItem: (item: MobileDataListItem) => void;
  disabled: boolean;
}) {
  return (
    <MobileCard compact style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.flex}>
          <MobileText variant="section" weight="bold">
            {title}
          </MobileText>
          <MobileText variant="small" tone="secondary">
            {description}
          </MobileText>
        </View>
      </View>
      {items.length ? (
        <MobileDataList items={items} onPressItem={disabled ? undefined : onPressItem} />
      ) : (
        <MobileEmptyState title={emptyTitle} description={emptyDescription} />
      )}
    </MobileCard>
  );
}

function PermissionGroupSummary({ groups, selectedKeys }: { groups: RbacPermissionGroup[]; selectedKeys: Set<string> }) {
  return (
    <View style={styles.permissionGroups}>
      {groups.map((group) => {
        const selected = group.permissions.filter((permission) => selectedKeys.has(permission.key)).length;
        if (selected === 0) return null;
        return (
          <View key={group.groupKey} style={styles.permissionGroup}>
            <View style={styles.sectionHeader}>
              <View style={styles.flex}>
                <MobileText variant="body" weight="bold">
                  {group.groupLabel}
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  {selected} of {group.permissions.length} permissions selected
                </MobileText>
              </View>
              <MobileStatusBadge status="Published" label={`${selected}/${group.permissions.length}`} tone="primary" showDot={false} />
            </View>
            {group.permissions
              .filter((permission) => selectedKeys.has(permission.key))
              .slice(0, 4)
              .map((permission) => (
                <PermissionPill key={permission.key} permission={permission} />
              ))}
          </View>
        );
      })}
    </View>
  );
}

function PermissionPill({ permission }: { permission: RbacPermission }) {
  return (
    <View style={styles.permissionPill}>
      <View style={styles.flex}>
        <MobileText variant="small" weight="bold">
          {permission.label}
        </MobileText>
        <MobileText variant="tiny" tone="secondary" numberOfLines={1}>
          {permission.key}
        </MobileText>
      </View>
      <MobileStatusBadge status={permission.riskLevel} label={permission.riskLevel} tone={riskTone(permission.riskLevel)} showDot={false} />
    </View>
  );
}

function flattenPermissions(groups: RbacPermissionGroup[], query: string) {
  const needle = query.trim().toLowerCase();
  return groups
    .flatMap((group) => group.permissions.map((permission) => ({ ...permission, groupLabel: group.groupLabel })))
    .filter((permission) => {
      if (!needle) return permission.visibleInBuilder !== false;
      return [permission.label, permission.description, permission.key, permission.groupLabel, permission.riskLevel]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    })
    .sort((a, b) => a.groupLabel.localeCompare(b.groupLabel) || a.sortOrder - b.sortOrder);
}

function userAssignmentToListItem(assignment: RbacUserAssignment): MobileDataListItem {
  return {
    id: assignment.userId,
    title: assignment.fullName,
    subtitle: assignment.email,
    meta: `${formatRoleLabel(assignment.associationRole)} · ${assignment.roles.map((role) => role.name).join(', ') || 'No custom roles'}`,
    amount: `${formatNumber(assignment.roles.length)} roles`,
    status: assignment.active ? 'Active' : 'Inactive',
    statusLabel: assignment.active ? 'Active' : 'Inactive',
    statusTone: assignment.active ? 'success' : 'neutral',
    initials: initialsFromName(assignment.fullName),
    accent: assignment.active ? 'primary' : 'neutral',
  };
}

function memberAssignmentToListItem(assignment: RbacMemberAssignment): MobileDataListItem {
  return {
    id: assignment.memberId,
    title: assignment.fullName,
    subtitle: [assignment.email, assignment.membershipNumber].filter(Boolean).join(' · ') || 'No contact details',
    meta: assignment.roles.map((role) => role.name).join(', ') || 'No custom roles',
    amount: `${formatNumber(assignment.roles.length)} roles`,
    status: assignment.status,
    statusLabel: formatRoleLabel(assignment.status),
    statusTone: assignment.status?.toUpperCase() === 'ACTIVE' ? 'success' : 'neutral',
    initials: initialsFromName(assignment.fullName),
    accent: assignment.status?.toUpperCase() === 'ACTIVE' ? 'success' : 'neutral',
  };
}

function parseTab(value: string, canAudit: boolean): RolesTab {
  if (value === 'users' || value === 'members' || value === 'roles') return value;
  if (value === 'audit' && canAudit) return 'audit';
  return 'roles';
}

function hasPermission(user: { permissions?: string[]; roles?: string[]; associationRole?: string; systemRole?: string; isTechy8Admin?: boolean } | null, permission: string) {
  if (!user) return false;
  if (user.isTechy8Admin) return true;
  const values = [...(user.permissions || []), ...(user.roles || []), user.associationRole || '', user.systemRole || ''].map((value) => value.toLowerCase());
  return values.includes(permission.toLowerCase()) || values.includes('admin') || values.includes('association_admin') || values.includes('system_admin');
}

function riskTone(risk?: string | null): StatusTone {
  const normalized = String(risk || '').toUpperCase();
  if (normalized === 'CRITICAL') return 'danger';
  if (normalized === 'HIGH') return 'warning';
  if (normalized === 'MEDIUM') return 'primary';
  return 'neutral';
}

function formatRoleLabel(value?: string | null) {
  return String(value || 'Unknown')
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatEventType(value?: string | null) {
  return formatRoleLabel(value);
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

const styles = StyleSheet.create({
  stack: {
    gap: 14,
  },
  sectionCard: {
    gap: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailHeader: {
    gap: 8,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  roleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  permissionGroups: {
    gap: 10,
  },
  permissionGroup: {
    gap: 8,
  },
  permissionPill: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetScroll: {
    gap: 12,
    paddingBottom: 6,
  },
  selectedSummary: {
    gap: 6,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
  },
  sheetPrimary: {
    flex: 1,
  },
});
