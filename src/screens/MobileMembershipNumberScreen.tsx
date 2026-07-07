import { router, useLocalSearchParams } from 'expo-router';
import {
  BadgeCheck,
  Braces,
  CheckCircle2,
  Edit3,
  Hash,
  IdCard,
  ListChecks,
  RefreshCw,
  Save,
  Sparkles,
  UsersRound,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileDataList,
  type MobileDataListItem,
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
  MobileSearchToolbar,
  MobileSelect,
  MobileSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
  MobileTextInput,
  MobileToast,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  getAssociationConfig,
  updateAssociationConfig,
  type AssociationConfig,
} from '@/services/association-service';
import {
  getAssociationMembers,
  getCurrentMembershipSequence,
  updateMemberMembershipNumber,
  type AssociationMember,
} from '@/services/member-service';
import { getApiErrorMessage } from '@/types/api';
import { formatNumber, initialsFromName } from '@/utils/format';
import { useNaneTheme } from '@/theme/tokens';

type MembershipNumberType = 'RANDOM_SIX_DIGITS' | 'PREFIX_YEAR_SEQUENCE' | 'CUSTOM_PATTERN';
type MemberFilter = 'all' | 'assigned' | 'unassigned';

type MembershipSettings = {
  membershipNumberType: MembershipNumberType;
  membershipNumberFormat: string;
  customMembershipFormat: string;
  membershipNumberPrefix: string;
  membershipNumberYear: string;
};

type ConfigForm = MembershipSettings;
type AssignSheetState = { mode: 'detail' | 'assign'; member: AssociationMember } | null;

const pageSize = 25;

const membershipNumberTypeOptions = [
  { label: 'Prefix, year and sequence', value: 'PREFIX_YEAR_SEQUENCE' },
  { label: 'Random six digits', value: 'RANDOM_SIX_DIGITS' },
  { label: 'Custom pattern', value: 'CUSTOM_PATTERN' },
];

export default function MobileMembershipNumberScreen() {
  const params = useLocalSearchParams();
  const theme = useNaneTheme();
  const { activeView, associationId, user } = useAuth();
  const [config, setConfig] = useState<AssociationConfig | null>(null);
  const [settings, setSettings] = useState<MembershipSettings>(() => defaultSettings());
  const [members, setMembers] = useState<AssociationMember[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [nextSequence, setNextSequence] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<MemberFilter>('all');
  const [configSheetOpen, setConfigSheetOpen] = useState(false);
  const [configForm, setConfigForm] = useState<ConfigForm>(() => defaultSettings());
  const [configErrors, setConfigErrors] = useState<Partial<Record<keyof ConfigForm, string>>>({});
  const [assignSheet, setAssignSheet] = useState<AssignSheetState>(null);
  const [manualSequence, setManualSequence] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [handledPreviewKey, setHandledPreviewKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const previewMode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const previewMemberId = Array.isArray(params.memberId) ? params.memberId[0] : params.memberId;
  const canUpdateSettings = useMemo(() => hasSettingsUpdatePermission(user), [user]);
  const canUpdateMembers = useMemo(() => hasMembersUpdatePermission(user), [user]);

  const loadSequence = useCallback(
    async (sourceSettings: MembershipSettings) => {
      if (!associationId || sourceSettings.membershipNumberType === 'RANDOM_SIX_DIGITS') {
        setNextSequence(1);
        return;
      }

      try {
        const current = await getCurrentMembershipSequence(
          associationId,
          sourceSettings.membershipNumberPrefix || 'PREFIX',
          sourceSettings.membershipNumberYear || currentYear(),
        );
        setNextSequence(Number(current || 0) + 1);
      } catch {
        setNextSequence(1);
      }
    },
    [associationId],
  );

  const loadPage = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial', nextPage = page) => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before managing membership numbers.');
        return;
      }

      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        const [loadedConfig, memberPage] = await Promise.all([
          getAssociationConfig(associationId),
          getAssociationMembers(associationId, {
            page: nextPage,
            size: pageSize,
            sort: 'membershipNumber,asc',
          }),
        ]);
        const normalizedSettings = normalizeMembershipSettings(loadedConfig);
        setConfig(loadedConfig);
        setSettings(normalizedSettings);
        setConfigForm(normalizedSettings);
        setMembers(memberPage.content || []);
        setPage(Number(memberPage.number || nextPage));
        setTotalPages(Math.max(1, Number(memberPage.totalPages || 1)));
        setTotalElements(Number(memberPage.totalElements || memberPage.content?.length || 0));
        await loadSequence(normalizedSettings);
      } catch (loadError) {
        setMembers([]);
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId, loadSequence, page],
  );

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadPage('initial', 0);
    });
    return () => {
      active = false;
    };
  }, [loadPage]);

  const openConfigSheet = useCallback(() => {
    setConfigForm(settings);
    setConfigErrors({});
    setNotice(null);
    setError(null);
    setConfigSheetOpen(true);
  }, [settings]);

  const openMemberSheet = useCallback((member: AssociationMember, mode: 'detail' | 'assign' = 'detail') => {
    setAssignSheet({ member, mode });
    setManualSequence('');
    setManualError(null);
    setNotice(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (loading) return;
    const previewKey = `${previewMode || 'list'}:${previewMemberId || 'none'}`;
    if (handledPreviewKey === previewKey) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      if (previewMode === 'config') {
        openConfigSheet();
        setHandledPreviewKey(previewKey);
        return;
      }
      if (!previewMemberId) return;
      const member = members.find((candidate) => candidate.id === previewMemberId || candidate.membershipNumber === previewMemberId);
      if (!member) return;
      openMemberSheet(member, previewMode === 'assign' ? 'assign' : 'detail');
      setHandledPreviewKey(previewKey);
    });
    return () => {
      active = false;
    };
  }, [handledPreviewKey, loading, members, openConfigSheet, openMemberSheet, previewMemberId, previewMode]);

  const metrics = useMemo(() => {
    const assigned = members.filter((member) => Boolean(member.membershipNumber?.trim())).length;
    const unassigned = members.length - assigned;
    return {
      shown: members.length,
      total: totalElements || members.length,
      assigned,
      unassigned,
    };
  }, [members, totalElements]);

  const filteredMembers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return members.filter((member) => {
      const assigned = Boolean(member.membershipNumber?.trim());
      if (filter === 'assigned' && !assigned) return false;
      if (filter === 'unassigned' && assigned) return false;
      if (!query) return true;
      return [
        member.fullLegalName,
        member.membershipNumber,
        member.contactInfo?.email,
        member.contactInfo?.phoneNumber,
        member.status,
      ].some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [filter, members, searchTerm]);

  const tabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: metrics.shown },
      { value: 'assigned', label: 'Assigned', count: metrics.assigned },
      { value: 'unassigned', label: 'Missing', count: metrics.unassigned },
    ],
    [metrics.assigned, metrics.shown, metrics.unassigned],
  );

  const listItems = useMemo<MobileDataListItem[]>(
    () =>
      filteredMembers.map((member) => {
        const assigned = Boolean(member.membershipNumber?.trim());
        return {
          id: member.id,
          title: member.fullLegalName || 'Unnamed member',
          subtitle: assigned ? member.membershipNumber || '' : 'Membership number not assigned',
          meta: member.contactInfo?.email || member.contactInfo?.phoneNumber || 'No contact details',
          status: assigned ? 'Assigned' : 'Unassigned',
          statusTone: assigned ? 'success' : 'warning',
          accent: assigned ? 'success' : 'warning',
          initials: initialsFromName(member.fullLegalName || 'Member'),
        };
      }),
    [filteredMembers],
  );

  const previewNumber = useMemo(() => buildPreviewNumber(settings, nextSequence), [nextSequence, settings]);
  const canGoPrevious = page > 0 && !loading && !refreshing;
  const canGoNext = page + 1 < totalPages && !loading && !refreshing;

  const saveConfig = async () => {
    if (!associationId) return;
    if (!canUpdateSettings) {
      setError('Your role cannot update membership number settings.');
      return;
    }

    const errors = validateConfigForm(configForm);
    setConfigErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = buildConfigPayload(configForm);
      await updateAssociationConfig(associationId, payload);
      const mergedConfig: AssociationConfig = {
        ...(config || {}),
        settings: {
          ...(config?.settings || {}),
          ...payload,
        },
      };
      setConfig(mergedConfig);
      setSettings(configForm);
      setConfigSheetOpen(false);
      setNotice('Membership number configuration saved.');
      await loadSequence(configForm);
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const assignMembershipNumber = async (mode: 'manual' | 'auto') => {
    if (!assignSheet?.member || !associationId) return;
    if (!canUpdateMembers) {
      setError('Your role cannot assign membership numbers.');
      return;
    }

    const sequence = mode === 'manual' ? manualSequence.trim() : String(nextSequence).padStart(4, '0');
    if (!sequence) {
      setManualError('Sequence is required.');
      return;
    }
    if (!/^\d+$/.test(sequence)) {
      setManualError('Use digits only. The prefix and year are added by the system.');
      return;
    }

    setSaving(true);
    setManualError(null);
    setError(null);
    setNotice(null);
    try {
      await updateMemberMembershipNumber(assignSheet.member.id, sequence, {
        prefix: settings.membershipNumberPrefix || 'PREFIX',
        year: settings.membershipNumberYear || currentYear(),
      });
      setAssignSheet(null);
      setManualSequence('');
      setNotice(`Membership number assigned to ${assignSheet.member.fullLegalName || 'member'}.`);
      await loadPage('refresh', page);
    } catch (assignError) {
      setError(getApiErrorMessage(assignError));
    } finally {
      setSaving(false);
    }
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Admin workspace required" description="Membership number management is available from the association admin workspace." />;
  }

  if (loading) {
    return <MobilePageLoadingState message="Loading membership format, sequence and members." />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        title="Membership ID Format"
        eyebrow="Association settings"
        subtitle="Configure number rules and assign IDs to members."
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh" disabled={refreshing} onPress={() => loadPage('refresh', page)} />}
      />

      {notice ? <MobileToast title={notice} tone="success" /> : null}
      {error ? <MobileToast title={error} tone="danger" /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Members shown" value={formatNumber(metrics.shown)} description={`${formatNumber(metrics.total)} total records`} icon={UsersRound} tone="blue" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Assigned IDs" value={formatNumber(metrics.assigned)} description="Have membership numbers" icon={BadgeCheck} tone="green" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Missing IDs" value={formatNumber(metrics.unassigned)} description="Need assignment" icon={ListChecks} tone="orange" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Next sequence" value={String(nextSequence).padStart(4, '0')} description={settings.membershipNumberType === 'RANDOM_SIX_DIGITS' ? 'Numeric slot' : 'Based on current prefix/year'} icon={Hash} tone="purple" />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard accent="blue" compact>
        <View style={styles.heroRow}>
          <View style={[styles.heroIcon, { backgroundColor: theme.colors.primary }]}>
            <IdCard color={theme.colors.onPrimary} size={22} strokeWidth={2.5} />
          </View>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold">
              {labelForType(settings.membershipNumberType)}
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Preview: {previewNumber}
            </MobileText>
          </View>
          <MobileStatusBadge status={canUpdateSettings ? 'Editable' : 'Read only'} tone={canUpdateSettings ? 'primary' : 'neutral'} />
        </View>

        <View style={styles.configGrid}>
          <MobileInfoRow
            label="Prefix"
            value={settings.membershipNumberPrefix || 'PREFIX'}
            helper={settings.membershipNumberPrefix ? undefined : 'Fallback used until a prefix is saved'}
            icon={Sparkles}
          />
          <MobileInfoRow label="Year" value={settings.membershipNumberYear || currentYear()} icon={Hash} />
          <MobileInfoRow label="Format" value={activeFormat(settings)} icon={Braces} />
        </View>

        <View style={styles.actions}>
          <MobileButton label="Edit configuration" icon={Edit3} variant="secondary" disabled={!canUpdateSettings} onPress={openConfigSheet} />
        </View>
      </MobileCard>

      <View style={styles.filters}>
        <MobileSearchToolbar value={searchTerm} onChange={setSearchTerm} placeholder="Search name, email or membership ID..." />
        <MobileStatusTabs tabs={tabs} value={filter} onChange={(value) => setFilter(value as MemberFilter)} />
      </View>

      {error && members.length === 0 ? (
        <MobileErrorState title="Could not load membership numbers" description={error} retryLabel="Try again" onRetry={() => loadPage('refresh', page)} />
      ) : listItems.length === 0 ? (
        <MobileEmptyState
          title="No matching members"
          description="Adjust the search or status tab to find members that need ID assignment."
          actionLabel="Clear filters"
          onAction={() => {
            setSearchTerm('');
            setFilter('all');
          }}
        />
      ) : (
        <MobileDataList
          items={listItems}
          onPressItem={(item) => {
            const member = filteredMembers.find((candidate) => candidate.id === item.id);
            if (member) openMemberSheet(member);
          }}
        />
      )}

      <View style={styles.pagination}>
        <MobileButton label="Previous" variant="secondary" size="sm" disabled={!canGoPrevious} onPress={() => loadPage('refresh', page - 1)} />
        <MobileText variant="small" weight="bold" tone="secondary">
          Page {page + 1} of {totalPages}
        </MobileText>
        <MobileButton label="Next" variant="secondary" size="sm" disabled={!canGoNext} onPress={() => loadPage('refresh', page + 1)} />
      </View>

      <ConfigSheet
        visible={configSheetOpen}
        form={configForm}
        errors={configErrors}
        saving={saving}
        canManage={canUpdateSettings}
        preview={buildPreviewNumber(configForm, nextSequence)}
        onClose={() => setConfigSheetOpen(false)}
        onChange={setConfigForm}
        onSave={saveConfig}
      />

      <MemberSheet
        sheet={assignSheet}
        settings={settings}
        nextSequence={nextSequence}
        manualSequence={manualSequence}
        manualError={manualError}
        saving={saving}
        canAssign={canUpdateMembers}
        onClose={() => setAssignSheet(null)}
        onAssignMode={() => {
          if (assignSheet) setAssignSheet({ ...assignSheet, mode: 'assign' });
        }}
        onManualSequenceChange={setManualSequence}
        onManualAssign={() => assignMembershipNumber('manual')}
        onAutoAssign={() => assignMembershipNumber('auto')}
      />
    </MobileScreen>
  );
}

type ConfigSheetProps = {
  visible: boolean;
  form: ConfigForm;
  errors: Partial<Record<keyof ConfigForm, string>>;
  saving: boolean;
  canManage: boolean;
  preview: string;
  onClose: () => void;
  onChange: (form: ConfigForm) => void;
  onSave: () => void;
};

function ConfigSheet({ visible, form, errors, saving, canManage, preview, onClose, onChange, onSave }: ConfigSheetProps) {
  return (
    <MobileSheet visible={visible} title="Configure membership IDs" description="Set the rule used when assigning new member IDs." onClose={onClose}>
      <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetScroll}>
        <MobileFormSection title="Number rule" description="The backend uses this rule when it formats the final membership number.">
          <MobileSelect
            label="Membership number type"
            value={form.membershipNumberType}
            options={membershipNumberTypeOptions}
            disabled={saving || !canManage}
            onChange={(value) => onChange({ ...form, membershipNumberType: value as MembershipNumberType })}
          />
          {form.membershipNumberType === 'PREFIX_YEAR_SEQUENCE' ? (
            <MobileTextInput
              label="Format"
              value={form.membershipNumberFormat}
              onChangeText={(value) => onChange({ ...form, membershipNumberFormat: value })}
              placeholder="{prefix}/{year}/{sequence}"
              helperText="Use {prefix}, {year} and {sequence} placeholders."
              error={errors.membershipNumberFormat}
              disabled={saving || !canManage}
              autoCapitalize="none"
            />
          ) : null}
          {form.membershipNumberType === 'CUSTOM_PATTERN' ? (
            <MobileTextInput
              label="Custom pattern"
              value={form.customMembershipFormat}
              onChangeText={(value) => onChange({ ...form, customMembershipFormat: value })}
              placeholder="{prefix}-{year}-{sequence}"
              helperText="Custom patterns must include {sequence}."
              error={errors.customMembershipFormat}
              disabled={saving || !canManage}
              autoCapitalize="none"
            />
          ) : null}
        </MobileFormSection>

        <MobileFormSection title="Sequence context" description="Prefix and year are combined with the sequence during assignment.">
          <MobileTextInput
            label="Prefix"
            value={form.membershipNumberPrefix}
            onChangeText={(value) => onChange({ ...form, membershipNumberPrefix: value.trim().toUpperCase() })}
            placeholder="e.g. NANE"
            error={errors.membershipNumberPrefix}
            disabled={saving || !canManage}
            autoCapitalize="characters"
          />
          <MobileTextInput
            label="Year"
            value={form.membershipNumberYear}
            onChangeText={(value) => onChange({ ...form, membershipNumberYear: value.replace(/[^\d]/g, '').slice(0, 4) })}
            placeholder={currentYear()}
            error={errors.membershipNumberYear}
            disabled={saving || !canManage}
            keyboardType="number-pad"
          />
        </MobileFormSection>

        <MobileCard compact accent="purple">
          <MobileInfoRow label="Preview" value={preview} icon={Sparkles} />
        </MobileCard>
      </ScrollView>
      <View style={styles.sheetActions}>
        <MobileButton label="Cancel" variant="secondary" disabled={saving} onPress={onClose} />
        <MobileButton label="Save" icon={Save} loading={saving} disabled={!canManage} onPress={onSave} />
      </View>
    </MobileSheet>
  );
}

type MemberSheetProps = {
  sheet: AssignSheetState;
  settings: MembershipSettings;
  nextSequence: number;
  manualSequence: string;
  manualError: string | null;
  saving: boolean;
  canAssign: boolean;
  onClose: () => void;
  onAssignMode: () => void;
  onManualSequenceChange: (value: string) => void;
  onManualAssign: () => void;
  onAutoAssign: () => void;
};

function MemberSheet({
  sheet,
  settings,
  nextSequence,
  manualSequence,
  manualError,
  saving,
  canAssign,
  onClose,
  onAssignMode,
  onManualSequenceChange,
  onManualAssign,
  onAutoAssign,
}: MemberSheetProps) {
  const member = sheet?.member;
  const assigning = sheet?.mode === 'assign';
  const assigned = Boolean(member?.membershipNumber?.trim());
  const preview = buildPreviewNumber(settings, nextSequence);

  return (
    <MobileSheet visible={Boolean(sheet)} title={assigning ? 'Assign membership ID' : member?.fullLegalName || 'Member'} description={assigning ? 'Assign by sequence or use the next available number.' : 'Membership number details'} onClose={onClose}>
      {member ? (
        <>
          <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetScroll}>
            <MobileCard compact accent={assigned ? 'green' : 'orange'}>
              <View style={styles.detailHeader}>
                <View style={styles.flex}>
                  <MobileText variant="section" weight="bold">
                    {member.fullLegalName || 'Unnamed member'}
                  </MobileText>
                  <MobileText variant="small" tone="secondary">
                    {member.contactInfo?.email || member.contactInfo?.phoneNumber || 'No contact details'}
                  </MobileText>
                </View>
                <MobileStatusBadge status={assigned ? 'Assigned' : 'Unassigned'} tone={assigned ? 'success' : 'warning'} />
              </View>
            </MobileCard>

            <MobileInfoRow label="Current membership ID" value={member.membershipNumber || 'Not assigned'} icon={IdCard} />
            <MobileInfoRow label="Member status" value={member.status || 'Unknown'} icon={CheckCircle2} status={member.status || 'Unknown'} />
            <MobileInfoRow label="Suggested next ID" value={preview} icon={Sparkles} />
            <MobileInfoRow label="Rule" value={labelForType(settings.membershipNumberType)} helper={activeFormat(settings)} icon={Braces} />

            {assigning ? (
              <MobileFormSection title="Assign by sequence" description="Enter digits only. Prefix, year and pattern are applied by the system.">
                <MobileTextInput
                  label="Sequence"
                  value={manualSequence}
                  onChangeText={(value) => onManualSequenceChange(value.replace(/[^\d]/g, ''))}
                  placeholder={String(nextSequence).padStart(4, '0')}
                  helperText="Example: 0007"
                  error={manualError || undefined}
                  keyboardType="number-pad"
                  disabled={saving || !canAssign}
                />
              </MobileFormSection>
            ) : null}
          </ScrollView>
          {assigning ? (
            <View style={styles.sheetActions}>
              <MobileButton label="Auto assign" icon={RefreshCw} variant="secondary" loading={saving} disabled={!canAssign} onPress={onAutoAssign} />
              <MobileButton label="Assign" icon={Save} loading={saving} disabled={!canAssign} onPress={onManualAssign} />
            </View>
          ) : (
            <View style={styles.sheetActions}>
              <MobileButton label="Assign ID" icon={IdCard} disabled={!canAssign} onPress={onAssignMode} />
              <MobileButton label="Close" variant="secondary" onPress={onClose} />
            </View>
          )}
        </>
      ) : null}
    </MobileSheet>
  );
}

function normalizeMembershipSettings(config: AssociationConfig | null | undefined): MembershipSettings {
  const raw = config?.settings || {};
  const type = String(raw.membershipNumberType || 'PREFIX_YEAR_SEQUENCE') as MembershipNumberType;
  return {
    membershipNumberType: ['RANDOM_SIX_DIGITS', 'PREFIX_YEAR_SEQUENCE', 'CUSTOM_PATTERN'].includes(type) ? type : 'PREFIX_YEAR_SEQUENCE',
    membershipNumberFormat: String(raw.membershipNumberFormat || '{prefix}/{year}/{sequence}'),
    customMembershipFormat: String(raw.customMembershipFormat || '{sequence}'),
    membershipNumberPrefix: String(raw.membershipNumberPrefix || '').trim(),
    membershipNumberYear: String(raw.membershipNumberYear || currentYear()).trim(),
  };
}

function defaultSettings(): MembershipSettings {
  return {
    membershipNumberType: 'PREFIX_YEAR_SEQUENCE',
    membershipNumberFormat: '{prefix}/{year}/{sequence}',
    customMembershipFormat: '{sequence}',
    membershipNumberPrefix: '',
    membershipNumberYear: currentYear(),
  };
}

function buildConfigPayload(form: ConfigForm) {
  return {
    membershipNumberType: form.membershipNumberType,
    membershipNumberFormat: form.membershipNumberType === 'PREFIX_YEAR_SEQUENCE' ? form.membershipNumberFormat.trim() : undefined,
    customMembershipFormat: form.membershipNumberType === 'CUSTOM_PATTERN' ? form.customMembershipFormat.trim() : undefined,
    membershipNumberPrefix: form.membershipNumberPrefix.trim(),
    membershipNumberYear: form.membershipNumberYear.trim() || currentYear(),
  };
}

function validateConfigForm(form: ConfigForm) {
  const errors: Partial<Record<keyof ConfigForm, string>> = {};
  if (form.membershipNumberType === 'PREFIX_YEAR_SEQUENCE') {
    if (!form.membershipNumberFormat.trim()) errors.membershipNumberFormat = 'Format is required.';
    if (!form.membershipNumberFormat.includes('{sequence}')) errors.membershipNumberFormat = 'Format must include {sequence}.';
  }
  if (form.membershipNumberType === 'CUSTOM_PATTERN') {
    if (!form.customMembershipFormat.trim()) errors.customMembershipFormat = 'Custom pattern is required.';
    if (!form.customMembershipFormat.includes('{sequence}')) errors.customMembershipFormat = 'Custom pattern must include {sequence}.';
  }
  if (form.membershipNumberYear && !/^\d{4}$/.test(form.membershipNumberYear)) errors.membershipNumberYear = 'Use a four digit year.';
  return errors;
}

function buildPreviewNumber(settings: MembershipSettings, sequence: number) {
  const sequenceText = String(sequence || 1).padStart(4, '0');
  const sixDigitSequence = String(sequence || 1).padStart(6, '0');
  const prefix = settings.membershipNumberPrefix || 'PREFIX';
  const year = settings.membershipNumberYear || currentYear();

  if (settings.membershipNumberType === 'RANDOM_SIX_DIGITS') {
    return sixDigitSequence;
  }
  if (settings.membershipNumberType === 'CUSTOM_PATTERN') {
    return applyPattern(settings.customMembershipFormat || '{sequence}', prefix, year, sequenceText);
  }
  return applyPattern(settings.membershipNumberFormat || '{prefix}/{year}/{sequence}', prefix, year, sequenceText);
}

function applyPattern(pattern: string, prefix: string, year: string, sequence: string) {
  return pattern
    .replace(/\{prefix\}/g, prefix)
    .replace(/\{year\}/g, year)
    .replace(/\{sequence\}/g, sequence);
}

function activeFormat(settings: MembershipSettings) {
  if (settings.membershipNumberType === 'RANDOM_SIX_DIGITS') return 'Six digit generated number';
  if (settings.membershipNumberType === 'CUSTOM_PATTERN') return settings.customMembershipFormat || '{sequence}';
  return settings.membershipNumberFormat || '{prefix}/{year}/{sequence}';
}

function labelForType(type: MembershipNumberType) {
  if (type === 'RANDOM_SIX_DIGITS') return 'Random six digit IDs';
  if (type === 'CUSTOM_PATTERN') return 'Custom pattern IDs';
  return 'Prefix/year/sequence IDs';
}

function currentYear() {
  return new Date().getFullYear().toString();
}

function hasSettingsUpdatePermission(user: { permissions?: string[]; roles?: string[]; associationRole?: string; systemRole?: string } | null) {
  const values = [...(user?.permissions || []), ...(user?.roles || []), user?.associationRole || '', user?.systemRole || ''].map((value) => value.toLowerCase());
  return values.some((value) => ['settings.update', 'config_write', 'platform_admin', 'association_admin', 'admin'].includes(value));
}

function hasMembersUpdatePermission(user: { permissions?: string[]; roles?: string[]; associationRole?: string; systemRole?: string } | null) {
  const values = [...(user?.permissions || []), ...(user?.roles || []), user?.associationRole || '', user?.systemRole || ''].map((value) => value.toLowerCase());
  return values.some((value) => ['members.update', 'members_manage', 'platform_admin', 'association_admin', 'admin'].includes(value));
}

const styles = StyleSheet.create({
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  configGrid: {
    marginTop: 8,
  },
  actions: {
    marginTop: 12,
    alignItems: 'flex-start',
  },
  filters: {
    gap: 12,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sheetScroll: {
    gap: 14,
    paddingBottom: 16,
  },
  sheetBody: {
    flexShrink: 1,
  },
  sheetActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
});
