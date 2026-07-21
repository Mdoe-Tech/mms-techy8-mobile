import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { CheckCircle2, FileSpreadsheet, ReceiptText, UploadCloud, UserCheck, UsersRound, WalletCards } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileEmptyState,
  MobileFileUpload,
  MobileFormSection,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobileLoadingState,
  MobilePageHeader,
  MobileScreen,
  MobileSearchToolbar,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileSummaryPanel,
  MobileText,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import { getAllAssociationMembers, type AssociationMember } from '@/services/member-service';
import {
  importBulkRevenueTransactionsForMember,
  type RevenueImportFile,
  type RevenueTransaction,
} from '@/services/revenue-transaction-service';
import { useNaneTheme } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatNumber } from '@/utils/format';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';

type MemberFilter = 'all' | 'selected' | 'withEmail' | 'missingEmail';

const LOAD_MORE_COUNT = 10;

const templateColumns = [
  'memberEmail',
  'paymentType',
  'paymentValue',
  'loanId',
  'paymentStatus',
  'description',
  'transactionDate',
  'dueDate',
  'referenceId',
  'fineCategory',
];

const acceptedPaymentTypes = ['SHARE_PURCHASE', 'FINE', 'SOCIAL_CONTRIBUTION', 'PENALTY', 'LOAN_REPAYMENT', 'LOAN_APPLICATION_FEE'];

export default function MobileRevenueTransactionBulkImportScreen() {
  const { activeView, associationId, user } = useAuth();
  const theme = useNaneTheme();
  const [members, setMembers] = useState<AssociationMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<MemberFilter>('all');
  const [visibleCount, setVisibleCount] = useState(LOAD_MORE_COUNT);
  const [file, setFile] = useState<RevenueImportFile | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RevenueTransaction[] | null>(null);
  const ledgerRoute = getRouteByPath('/associations/revenue-transactions');

  useEffect(() => {
    let active = true;

    async function loadMembers() {
      if (!associationId) {
        if (active) {
          setLoadingMembers(false);
          setError('Association context is required before importing transactions.');
        }
        return;
      }

      try {
        const response = await getAllAssociationMembers(associationId, { size: 250 });
        if (!active) return;
        const loadedMembers = response.content || [];
        setMembers(loadedMembers);
        const firstWithEmail = loadedMembers.find((member) => memberEmail(member));
        setSelectedMemberId(firstWithEmail?.id || loadedMembers[0]?.id || null);
      } catch (loadError) {
        if (active) {
          setError(getApiErrorMessage(loadError));
        }
      } finally {
        if (active) {
          setLoadingMembers(false);
        }
      }
    }

    void loadMembers();
    return () => {
      active = false;
    };
  }, [associationId]);

  const selectedMember = useMemo(
    () => members.find((member) => member.id === selectedMemberId) || null,
    [members, selectedMemberId],
  );
  const selectedEmail = memberEmail(selectedMember);
  const withEmailCount = members.filter((member) => memberEmail(member)).length;
  const selectedFileSize = file && 'size' in file ? `${(Number((file as RevenueImportFile & { size?: number }).size || 0) / 1024).toFixed(1)} KB` : 'Excel workbook';

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return members.filter((member) => {
      const email = memberEmail(member);
      const matchesSearch =
        !query ||
        String(member.fullLegalName || '').toLowerCase().includes(query) ||
        String(member.membershipNumber || '').toLowerCase().includes(query) ||
        email.toLowerCase().includes(query);
      const matchesFilter =
        filter === 'all' ||
        (filter === 'selected' && member.id === selectedMemberId) ||
        (filter === 'withEmail' && Boolean(email)) ||
        (filter === 'missingEmail' && !email);

      return matchesSearch && matchesFilter;
    });
  }, [filter, members, search, selectedMemberId]);

  const visibleMembers = filteredMembers.slice(0, visibleCount);

  const pickFile = async () => {
    setError(null);
    if (!selectedMember) {
      setError('Select a member before choosing a workbook.');
      return;
    }
    if (!selectedEmail) {
      setError('The selected member must have an email address for memberEmail matching.');
      return;
    }

    const picked = await DocumentPicker.getDocumentAsync({
      type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (picked.canceled) return;
    const asset = picked.assets[0];
    if (!asset?.uri) return;
    setFile({
      uri: asset.uri,
      name: asset.name || 'member-bulk-transactions.xlsx',
      mimeType: asset.mimeType,
      ...(asset.size ? { size: asset.size } : {}),
    } as RevenueImportFile);
    setResult(null);
  };

  const handleImport = async () => {
    if (!associationId) {
      setError('Association context is required before importing transactions.');
      return;
    }
    if (!selectedMember || !selectedEmail) {
      setError('Select a member with an email address before importing.');
      return;
    }
    if (!file) {
      setError('Choose an Excel workbook before importing.');
      return;
    }

    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const response = await importBulkRevenueTransactionsForMember(associationId, selectedEmail, file);
      setResult(response || []);
    } catch (importError) {
      setError(getApiErrorMessage(importError));
    } finally {
      setImporting(false);
    }
  };

  if (activeView !== 'ADMIN') {
    return (
      <AccessDeniedScreen
        title="Member bulk import"
        description="This native page is available for association admin workspaces only."
      />
    );
  }

  if (loadingMembers) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Finance" title="Member bulk import" subtitle="Loading member references" onBack={() => router.back()} />
        <MobileLoadingState />
      </MobileScreen>
    );
  }

  if (result) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Finance" title="Import complete" subtitle={`${result.length} transaction(s) imported`} onBack={() => router.back()} />
        <MobileSummaryPanel
          title="Imported transactions"
          value={formatNumber(result.length)}
          description={selectedMember?.fullLegalName || 'Selected member'}
          tone="green"
          icon={CheckCircle2}
        />
        <MobileCard compact>
          <MobileInfoRow label="Member email" value={selectedEmail || 'Missing'} icon={UserCheck} />
          <MobileInfoRow label="File" value={file?.name || 'Imported workbook'} helper={selectedFileSize} icon={FileSpreadsheet} />
        </MobileCard>
        <View style={styles.actions}>
          <MobileButton
            label="Back to ledger"
            icon={ReceiptText}
            fullWidth
            onPress={() => (ledgerRoute ? router.push({ pathname: '/work/route-preview', params: { routeId: ledgerRoute.id } } as never) : router.back())}
          />
          <MobileButton
            label="Import another file"
            icon={UploadCloud}
            variant="secondary"
            fullWidth
            onPress={() => {
              setResult(null);
              setFile(null);
            }}
          />
        </View>
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Finance"
        title="Member bulk import"
        subtitle={`${user?.associationName || 'Association'} single-member import`}
        onBack={() => router.back()}
      />

      {error ? <MobileStatusBadge status="Import issue" label={error} tone="danger" /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Members" value={formatNumber(members.length)} description={`${formatNumber(withEmailCount)} with email`} tone="blue" icon={UsersRound} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Selected member"
            value={selectedMember ? 'Ready' : 'Pending'}
            description={selectedMember?.fullLegalName || 'Member email required'}
            tone={selectedEmail ? 'green' : 'orange'}
            icon={UserCheck}
          />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileFormSection title="Select member" description="All rows in the workbook must match the selected memberEmail.">
        <MobileSearchToolbar
          value={search}
          onChange={(value) => {
            setSearch(value);
            setVisibleCount(LOAD_MORE_COUNT);
          }}
          placeholder="Search member, email, or number..."
        />
        <MobileStatusTabs
          value={filter}
          onChange={(value) => {
            setFilter(value as MemberFilter);
            setVisibleCount(LOAD_MORE_COUNT);
          }}
          tabs={[
            { value: 'all', label: 'All', count: members.length },
            { value: 'selected', label: 'Selected', count: selectedMember ? 1 : 0 },
            { value: 'withEmail', label: 'With email', count: withEmailCount },
            { value: 'missingEmail', label: 'Missing', count: members.length - withEmailCount },
          ]}
        />
        <View style={styles.memberList}>
          {visibleMembers.map((member) => {
            const email = memberEmail(member);
            const selected = member.id === selectedMemberId;
            return (
              <Pressable
                key={member.id}
                disabled={!email}
                onPress={() => {
                  setSelectedMemberId(member.id);
                  setFile(null);
                  setResult(null);
                }}
                style={({ pressed }) => [
                  styles.memberRow,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: selected ? theme.colors.primary : theme.colors.border,
                    opacity: !email ? 0.54 : pressed ? 0.82 : 1,
                  },
                ]}
              >
                <View style={styles.memberCopy}>
                  <MobileText variant="small" weight="bold" numberOfLines={1}>
                    {member.fullLegalName || member.membershipNumber || 'Unknown member'}
                  </MobileText>
                  <MobileText variant="small" tone="secondary" numberOfLines={1}>
                    {email || 'Missing email'}
                  </MobileText>
                </View>
                <MobileStatusBadge status={selected ? 'Selected' : email ? 'Active' : 'Unknown'} label={selected ? 'Selected' : email ? 'Ready' : 'No email'} tone={selected ? 'primary' : email ? 'success' : 'warning'} />
              </Pressable>
            );
          })}
        </View>
        {visibleMembers.length === 0 ? <MobileEmptyState title="No members found" description="Adjust search or member email filters." /> : null}
        {visibleCount < filteredMembers.length ? <MobileButton label="Load more members" variant="secondary" fullWidth onPress={() => setVisibleCount((current) => current + LOAD_MORE_COUNT)} /> : null}
      </MobileFormSection>

      <MobileFormSection title="Workbook upload" description="Use one row per transaction with paymentType and paymentValue.">
        <MobileFileUpload
          title={file ? file.name : 'Choose Excel file'}
          description={file ? selectedFileSize : selectedEmail ? 'Tap to select the selected member workbook.' : 'Select a member with email first.'}
          onPress={pickFile}
        />
        <View style={styles.actions}>
          <MobileButton label="Import for selected member" icon={UploadCloud} loading={importing} disabled={!file || !selectedEmail || importing} fullWidth onPress={handleImport} />
          {file ? <MobileButton label="Choose different file" icon={FileSpreadsheet} variant="secondary" fullWidth onPress={pickFile} disabled={importing} /> : null}
        </View>
      </MobileFormSection>

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <MobileText variant="section" weight="bold">
            Template columns
          </MobileText>
          <MobileStatusBadge status="Published" label={`${templateColumns.length} columns`} tone="info" />
        </View>
        <View style={styles.columnGrid}>
          {templateColumns.map((column) => (
            <View key={column} style={[styles.columnPill, { borderColor: theme.colors.border }]}>
              <MobileText variant="tiny" weight="bold">
                {column}
              </MobileText>
            </View>
          ))}
        </View>
      </MobileCard>

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <MobileText variant="section" weight="bold">
            Accepted payment types
          </MobileText>
          <MobileStatusBadge status="Active" label={`${acceptedPaymentTypes.length} types`} tone="success" />
        </View>
        <View style={styles.columnGrid}>
          {acceptedPaymentTypes.map((paymentType) => (
            <View key={paymentType} style={[styles.columnPill, { borderColor: theme.colors.border }]}>
              <MobileText variant="tiny" weight="bold">
                {paymentType}
              </MobileText>
            </View>
          ))}
        </View>
      </MobileCard>

      <MobileCard compact>
        <MobileInfoRow label="Association context" value={associationId ? 'Available' : 'Missing'} helper={associationId || 'Association ID is required'} icon={WalletCards} status={associationId ? 'Active' : 'Failed'} />
      </MobileCard>
    </MobileScreen>
  );
}

function memberEmail(member?: AssociationMember | null) {
  return String(member?.contactInfo?.email || '').trim();
}

const styles = StyleSheet.create({
  actions: {
    gap: 10,
  },
  memberList: {
    gap: 8,
  },
  memberRow: {
    minHeight: 62,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  memberCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  columnGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  columnPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
});
