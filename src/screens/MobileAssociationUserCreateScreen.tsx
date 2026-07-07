import { router } from 'expo-router';
import {
  ArrowLeft,
  KeyRound,
  Mail,
  Phone,
  RefreshCw,
  Save,
  ShieldCheck,
  UserPlus,
  UsersRound,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileConfirmSheet,
  MobileEmptyState,
  MobileErrorState,
  MobileFormSection,
  MobileIconButton,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileSelect,
  MobileText,
  MobileTextInput,
  MobileToast,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import { listAssignableAssociationRoles, type AssociationRole } from '@/services/association-rbac-service';
import { createAssociationUserDirect } from '@/services/user-service';
import { getApiErrorMessage } from '@/types/api';
import { formatNumber } from '@/utils/format';

type CreateUserForm = {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  roleId: string;
};

type CreateUserMode = 'sample' | 'confirm';

type MobileAssociationUserCreateScreenProps = {
  initialMode?: CreateUserMode;
};

const emptyForm: CreateUserForm = {
  fullName: '',
  email: '',
  phoneNumber: '',
  password: '',
  roleId: '',
};

const sampleForm: CreateUserForm = {
  fullName: 'Mobile QA User',
  email: 'mobile.qa.user@nane.test',
  phoneNumber: '+255700100999',
  password: 'MobileQA@2026',
  roleId: '',
};

export default function MobileAssociationUserCreateScreen({ initialMode }: MobileAssociationUserCreateScreenProps) {
  const { activeView, associationId, user } = useAuth();
  const [roles, setRoles] = useState<AssociationRole[]>([]);
  const [form, setForm] = useState<CreateUserForm>(() => (initialMode ? sampleForm : emptyForm));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmCreate, setConfirmCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const handledInitialModeRef = useRef(false);

  const canCreateUsers = useMemo(() => hasCreateUserPermission(user), [user]);
  const activeRoles = useMemo(() => roles.filter((role) => role.active && !role.archived && !isMemberRole(role)), [roles]);
  const selectedRole = useMemo(() => activeRoles.find((role) => role.id === form.roleId) || null, [activeRoles, form.roleId]);

  const metrics = useMemo(
    () => ({
      roles: activeRoles.length,
      protectedRoles: activeRoles.filter((role) => role.protectedRole).length,
      selectedPermissions: selectedRole?.permissionCount || 0,
      formReady: validateForm(form, selectedRole).valid ? 1 : 0,
    }),
    [activeRoles, form, selectedRole],
  );

  const loadRoles = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);
      if (mode === 'refresh') setNotice(null);

      try {
        const loadedRoles = await listAssignableAssociationRoles();
        const selectableRoles = loadedRoles.filter((role) => role.active && !role.archived && !isMemberRole(role));
        setRoles(loadedRoles);
        setForm((current) => ({
          ...current,
          roleId: current.roleId || preferredInitialRoleId(selectableRoles),
        }));
        if (mode === 'refresh') setNotice('Assignable roles refreshed.');
      } catch (loadError) {
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadRoles('initial'));
  }, [loadRoles]);

  useEffect(() => {
    if (loading || handledInitialModeRef.current || initialMode !== 'confirm') return;
    handledInitialModeRef.current = true;
    void Promise.resolve().then(() => {
      const validation = validateForm(form, selectedRole);
      setErrors(validation.errors);
      if (validation.valid) setConfirmCreate(true);
    });
  }, [form, initialMode, loading, selectedRole]);

  const updateForm = (patch: Partial<CreateUserForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    setErrors({});
    setNotice(null);
  };

  const requestCreate = () => {
    if (!canCreateUsers) {
      setError('Your role cannot create association users.');
      return;
    }
    const validation = validateForm(form, selectedRole);
    setErrors(validation.errors);
    if (!validation.valid) return;
    setConfirmCreate(true);
  };

  const createUser = async () => {
    if (!associationId || !selectedRole) return;
    const validation = validateForm(form, selectedRole);
    setErrors(validation.errors);
    if (!validation.valid) {
      setConfirmCreate(false);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await createAssociationUserDirect(associationId, {
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        phoneNumber: form.phoneNumber.trim(),
        password: form.password,
        associationRole: legacyAssociationRoleFor(selectedRole),
        techy8Admin: false,
        systemRole: legacyAssociationRoleFor(selectedRole) === 'MEMBER' ? 'ASSOCIATION_USER' : 'ASSOCIATION_ADMIN',
        rbacRoleIds: [selectedRole.id],
      });
      setConfirmCreate(false);
      setNotice('Association user created.');
      openUsersList();
    } catch (createError) {
      setError(getApiErrorMessage(createError));
    } finally {
      setSaving(false);
    }
  };

  const openUsersList = () => {
    const route = getRouteByPath('/associations/users');
    if (route) router.replace({ pathname: '/work/route-preview', params: { routeId: route.id } } as never);
    else router.back();
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Add user" description="User creation is available from association admin workspaces only." />;
  }

  if (loading) {
    return <MobilePageLoadingState kind="form" message="Loading assignable roles" />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="User access"
        title="Add user"
        subtitle="Create an association system user"
        onBack={openUsersList}
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

      {error ? <MobileErrorState title="User creation issue" description={error} retryLabel="Reload roles" onRetry={() => void loadRoles('refresh')} /> : null}
      {notice ? <MobileToast title={notice} /> : null}
      {!canCreateUsers ? <MobileToast title="Read-only access" description="This account needs user invite permission to create users." tone="warning" /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Assignable roles" value={formatNumber(metrics.roles)} description="Member roles excluded" icon={ShieldCheck} tone="blue" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Selected role" value={selectedRole?.name || 'None'} description={`${formatNumber(metrics.selectedPermissions)} permissions`} icon={UserPlus} tone="green" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Protected roles" value={formatNumber(metrics.protectedRoles)} description="System-managed roles" icon={UsersRound} tone="purple" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Ready to create" value={metrics.formReady ? 'Yes' : 'No'} description="Required fields and role" icon={KeyRound} tone={metrics.formReady ? 'green' : 'slate'} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      {activeRoles.length === 0 ? (
        <MobileEmptyState title="No assignable roles" description="Create active non-member roles from Roles & Permissions before adding association users." />
      ) : (
        <View style={styles.stack}>
          <MobileCard compact accent="blue" style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <UserPlus color="#2563EB" size={20} />
              <View style={styles.flex}>
                <MobileText variant="body" weight="bold">
                  New login account
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  This creates a system user who can sign in to the association workspace.
                </MobileText>
              </View>
            </View>
          </MobileCard>

          <MobileFormSection title="User identity" description="Enter the login identity and contact details.">
            <MobileTextInput
              label="Full name"
              value={form.fullName}
              onChangeText={(fullName) => updateForm({ fullName })}
              placeholder="Enter full name"
              icon={UserPlus}
              error={errors.fullName}
              disabled={saving}
            />
            <MobileTextInput
              label="Email"
              value={form.email}
              onChangeText={(email) => updateForm({ email })}
              placeholder="Enter email address"
              icon={Mail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              error={errors.email}
              disabled={saving}
            />
            <MobileTextInput
              label="Phone number"
              value={form.phoneNumber}
              onChangeText={(phoneNumber) => updateForm({ phoneNumber })}
              placeholder="+255..."
              icon={Phone}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              error={errors.phoneNumber}
              disabled={saving}
            />
          </MobileFormSection>

          <MobileFormSection title="Access and security" description="Assign the RBAC role and temporary password.">
            <MobileSelect
              label="Permission role"
              value={form.roleId}
              options={activeRoles.map((role) => ({
                label: `${role.name} (${role.permissionCount} permissions)`,
                value: role.id,
              }))}
              onChange={(roleId) => updateForm({ roleId })}
              disabled={saving}
              error={errors.roleId}
              helperText="Only active non-member roles are available here."
            />
            {selectedRole ? (
              <MobileInfoRow
                label="Selected role"
                value={selectedRole.name}
                helper={selectedRole.description || `${selectedRole.permissionCount} permissions will be assigned.`}
                icon={ShieldCheck}
              />
            ) : null}
            <MobileTextInput
              label="Temporary password"
              value={form.password}
              onChangeText={(password) => updateForm({ password })}
              placeholder="Enter temporary password"
              icon={KeyRound}
              secureTextEntry
              textContentType="newPassword"
              error={errors.password}
              helperText="Ask the user to change this password after first login."
              disabled={saving}
            />
          </MobileFormSection>

          <View style={styles.actions}>
            <MobileButton label="Cancel" icon={ArrowLeft} variant="secondary" fullWidth disabled={saving} onPress={openUsersList} />
            <MobileButton label="Create user" icon={Save} fullWidth loading={saving} disabled={!canCreateUsers || saving || activeRoles.length === 0} onPress={requestCreate} />
          </View>
        </View>
      )}

      <MobileConfirmSheet
        visible={confirmCreate}
        title="Create association user"
        description={`Create ${form.fullName || 'this user'} with ${selectedRole?.name || 'the selected'} role. They will be able to sign in with the temporary password.`}
        confirmLabel="Create user"
        loading={saving}
        onCancel={() => setConfirmCreate(false)}
        onConfirm={() => void createUser()}
      />
    </MobileScreen>
  );
}

function validateForm(form: CreateUserForm, selectedRole: AssociationRole | null) {
  const errors: Record<string, string> = {};
  if (!form.fullName.trim()) errors.fullName = 'Full name is required.';
  if (!form.email.trim()) errors.email = 'Email is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Enter a valid email address.';
  if (!form.phoneNumber.trim()) errors.phoneNumber = 'Phone number is required.';
  if (!form.password) errors.password = 'Temporary password is required.';
  else if (form.password.length < 8) errors.password = 'Use at least 8 characters.';
  if (!selectedRole) errors.roleId = 'Select a permission role.';
  return { valid: Object.keys(errors).length === 0, errors };
}

function preferredInitialRoleId(roles: AssociationRole[]) {
  if (!roles.length) return '';
  const adminRole = roles.find((role) => normalizeRoleCode(role.templateCode || role.code || role.name) === 'ADMIN');
  const ownerRole = roles.find((role) => normalizeRoleCode(role.templateCode || role.code || role.name) === 'OWNER');
  return adminRole?.id || ownerRole?.id || roles[0].id;
}

function legacyAssociationRoleFor(role?: AssociationRole | null) {
  const normalized = normalizeRoleCode(role?.templateCode || role?.code || role?.name || '');
  return normalized === 'MEMBER' ? 'MEMBER' : 'ADMIN';
}

function isMemberRole(role: AssociationRole) {
  return normalizeRoleCode(role.templateCode || role.code || role.name) === 'MEMBER';
}

function normalizeRoleCode(value: string) {
  return value.trim().replace(/[-\s]+/g, '_').toUpperCase().replace(/[^A-Z0-9_]/g, '');
}

function hasCreateUserPermission(user: ReturnType<typeof useAuth>['user']) {
  if (!user) return false;
  if (user.isTechy8Admin) return true;
  const values = [...(user.permissions || []), ...(user.roles || []), user.associationRole || '', user.systemRole || '']
    .filter(Boolean)
    .map((value) => value.toLowerCase().replace(/[\s-]+/g, '_'));
  return values.some((value) => ['users.invite', 'users_manage', 'association.admin', 'association_admin', 'admin', 'system_admin'].includes(value));
}

const styles = StyleSheet.create({
  stack: {
    gap: 14,
  },
  summaryCard: {
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  actions: {
    gap: 10,
  },
});
