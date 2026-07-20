import { router } from 'expo-router';
import { Clock3, CreditCard, ExternalLink, Link as LinkIcon, RefreshCw, Send, Share2, ShieldCheck, UserRound } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, Share, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { isSaccosAssociation } from '@/auth/association-type';
import {
  MobileAmountInput,
  MobileButton,
  MobileCard,
  MobileConfirmSheet,
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
  MobileSelect,
  MobileStatusBadge,
  MobileText,
  MobileTextInput,
} from '@/components/mobile';
import { getAllAssociationMembers, type AssociationMember } from '@/services/member-service';
import { sendSmsPaymentLink } from '@/services/payment-link-service';
import { useNaneTheme } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatTzs, initialsFromName } from '@/utils/format';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';

const MEMBER_LOAD_COUNT = 8;
const currencyOptions = [
  { label: 'TZS', value: 'TZS' },
  { label: 'KES', value: 'KES' },
  { label: 'USD', value: 'USD' },
  { label: 'NGN', value: 'NGN' },
];

export default function MobilePaymentMagicLinkScreen() {
  const { activeView, associationId, user } = useAuth();
  const isSaccos = isSaccosAssociation(user?.associationType);
  const theme = useNaneTheme();
  const [members, setMembers] = useState<AssociationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(MEMBER_LOAD_COUNT);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [amount, setAmount] = useState('5000');
  const [currency, setCurrency] = useState<'TZS' | 'KES' | 'USD' | 'NGN'>('TZS');
  const [description, setDescription] = useState(() => isSaccos ? 'SACCOS savings contribution' : 'Member contribution');
  const [ttlMinutes, setTtlMinutes] = useState('30');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [link, setLink] = useState('');
  const [lastShared, setLastShared] = useState(false);

  const loadMembers = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before sending payment links.');
        return;
      }
      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const loadedMembers = await getAllAssociationMembers(associationId, { size: 250, sort: 'membershipNumber,asc' });
        setMembers(loadedMembers.content || []);
      } catch (loadError) {
        setMembers([]);
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
      if (active) void loadMembers();
    });
    return () => {
      active = false;
    };
  }, [loadMembers]);

  const selectedMember = useMemo(
    () => members.find((member) => member.id === selectedMemberId) || null,
    [members, selectedMemberId],
  );
  const amountNumber = Number(amount);
  const ttlNumber = Number(ttlMinutes);
  const hasValidAmount = Number.isFinite(amountNumber) && amountNumber > 0;
  const hasValidTtl = Number.isInteger(ttlNumber) && ttlNumber >= 1 && ttlNumber <= 1440;
  const validationMessage = useMemo(() => {
    if (!associationId) return 'Association context is missing.';
    if (!selectedMemberId) return 'Select a member to receive the SMS link.';
    if (!hasValidAmount) return 'Enter an amount greater than zero.';
    if (!hasValidTtl) return 'Expiry must be between 1 and 1,440 minutes.';
    return null;
  }, [associationId, hasValidAmount, hasValidTtl, selectedMemberId]);

  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    const activeMembers = members.filter((member) => String(member.status || 'ACTIVE').toUpperCase() === 'ACTIVE');
    if (!query) return activeMembers;
    return activeMembers.filter((member) =>
      [member.fullLegalName, member.membershipNumber, member.contactInfo?.email, member.contactInfo?.phoneNumber]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [memberSearch, members]);

  const sendLink = async () => {
    if (!associationId || !selectedMemberId || validationMessage) return;
    setConfirmOpen(false);
    setSending(true);
    setError(null);
    setLink('');
    setLastShared(false);
    try {
      const result = await sendSmsPaymentLink({
        associationId,
        memberId: selectedMemberId,
        amount,
        currency,
        description,
        ttlMinutes,
      });
      setLink(result.link);
      if (!result.link) {
        setError(result.message || 'The server accepted the request but did not return a payment link.');
      }
    } catch (sendError) {
      setError(getApiErrorMessage(sendError));
    } finally {
      setSending(false);
    }
  };

  const shareLink = async () => {
    if (!link) return;
    await Share.share({ message: link, url: link });
    setLastShared(true);
  };

  if (activeView !== 'ADMIN') {
    return (
      <AccessDeniedScreen
        title="Payment magic link"
        description="This native page is available for association admin workspaces only."
      />
    );
  }

  if (loading) {
    return <MobilePageLoadingState kind="form" message="Loading members" />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Payments"
        title="Send payment link"
        subtitle={isSaccos ? 'SMS link for SACCOS savings' : 'SMS link for member contributions'}
        onBack={() => router.back()}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Reload members"
            variant="secondary"
            disabled={refreshing || sending}
            onPress={() => void loadMembers('refresh')}
          />
        }
      />

      {error ? <MobileErrorState title="Payment link issue" description={error} retryLabel="Reload members" onRetry={() => void loadMembers('refresh')} /> : null}
      {lastShared ? <MobileStatusBadge status="Completed" label="Link shared" tone="success" /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Member" value={selectedMember ? 'Ready' : 'Missing'} description={selectedMember?.fullLegalName || 'Select recipient'} tone={selectedMember ? 'blue' : 'orange'} icon={UserRound} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Amount" value={hasValidAmount ? formatTzs(amountNumber) : 'Invalid'} description={currency} tone={hasValidAmount ? 'green' : 'red'} icon={CreditCard} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Expiry" value={hasValidTtl ? `${ttlMinutes} min` : 'Invalid'} description="Payment link time to live" tone={hasValidTtl ? 'purple' : 'red'} icon={Clock3} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Link status" value={link ? 'Ready' : sending ? 'Sending' : 'Draft'} description={link ? 'Public payment link returned' : 'Confirmation required'} tone={link ? 'green' : sending ? 'orange' : 'slate'} icon={LinkIcon} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold">
              Select member
            </MobileText>
            <MobileText variant="small" tone="secondary">
              The SMS is sent to the member phone number on file.
            </MobileText>
          </View>
          <MobileStatusBadge status={selectedMember ? 'Active' : 'Pending'} label={selectedMember ? 'Selected' : 'Required'} tone={selectedMember ? 'success' : 'warning'} />
        </View>
        <MobileSearchToolbar
          value={memberSearch}
          onChange={(value) => {
            setMemberSearch(value);
            setVisibleCount(MEMBER_LOAD_COUNT);
          }}
          placeholder="Search members..."
        />
        <View style={styles.memberList}>
          {filteredMembers.slice(0, visibleCount).map((member) => {
            const selected = member.id === selectedMemberId;
            return (
              <Pressable
                key={member.id}
                onPress={() => setSelectedMemberId(member.id)}
                style={({ pressed }) => [
                  styles.memberRow,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: selected ? theme.colors.primary : theme.colors.border,
                    opacity: pressed ? 0.82 : 1,
                  },
                ]}
              >
                <View style={styles.avatar}>
                  <MobileText variant="small" weight="bold" tone="inverse">
                    {initialsFromName(member.fullLegalName || member.membershipNumber || 'M')}
                  </MobileText>
                </View>
                <View style={styles.flex}>
                  <MobileText variant="small" weight="bold" numberOfLines={1}>
                    {member.fullLegalName || member.membershipNumber || 'Unknown member'}
                  </MobileText>
                  <MobileText variant="small" tone="secondary" numberOfLines={1}>
                    {member.contactInfo?.phoneNumber || member.contactInfo?.email || 'No phone on file'}
                  </MobileText>
                </View>
                <MobileStatusBadge status={selected ? 'Selected' : member.status || 'Active'} label={selected ? 'Selected' : member.status || 'Active'} tone={selected ? 'primary' : undefined} />
              </Pressable>
            );
          })}
        </View>
        {visibleCount < filteredMembers.length ? (
          <MobileButton label="Load more members" variant="secondary" fullWidth onPress={() => setVisibleCount((current) => current + MEMBER_LOAD_COUNT)} />
        ) : null}
      </MobileCard>

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold">
              Payment details
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Set the payment amount, description, currency, and expiry.
            </MobileText>
          </View>
          <MobileStatusBadge status={validationMessage ? 'Draft' : 'Active'} label={validationMessage ? 'Draft' : 'Ready'} tone={validationMessage ? 'warning' : 'success'} />
        </View>
        <View style={styles.formStack}>
          <MobileAmountInput label="Amount" value={amount} onChangeText={setAmount} error={!hasValidAmount ? 'Enter an amount greater than zero.' : undefined} disabled={sending} />
          <MobileSelect label="Currency" value={currency} options={currencyOptions} onChange={(value) => setCurrency(value as typeof currency)} />
          <MobileTextInput label="Description" value={description} onChangeText={setDescription} placeholder="Member contribution" disabled={sending} />
          <MobileTextInput label="Expiry minutes" value={ttlMinutes} onChangeText={setTtlMinutes} placeholder="30" keyboardType="number-pad" error={!hasValidTtl ? 'Use 1 to 1,440 minutes.' : undefined} disabled={sending} />
        </View>
        <MobileInfoRow label="Association" value={associationId || 'Missing'} helper="Sent with the active association context." icon={ShieldCheck} status={associationId ? 'Active' : 'Pending'} />
        {validationMessage ? <MobileStatusBadge status="Draft" label={validationMessage} tone="warning" /> : null}
        <MobileButton
          label={sending ? 'Sending SMS' : 'Send SMS + get link'}
          icon={Send}
          loading={sending}
          fullWidth
          disabled={Boolean(validationMessage)}
          onPress={() => setConfirmOpen(true)}
        />
      </MobileCard>

      {link ? (
        <MobileCard compact accent="green">
          <View style={styles.sectionHeader}>
            <View style={styles.flex}>
              <MobileText variant="section" weight="bold">
                Generated link
              </MobileText>
              <MobileText variant="small" tone="secondary">
                The SMS request succeeded and returned a public payment link.
              </MobileText>
            </View>
            <MobileStatusBadge status="Published" label="Ready" tone="success" />
          </View>
          <MobileText variant="small" numberOfLines={3}>
            {link}
          </MobileText>
          <View style={styles.actions}>
            <MobileButton label="Share" icon={Share2} variant="secondary" onPress={() => void shareLink()} style={styles.actionButton} />
            <MobileButton label="Open" icon={ExternalLink} onPress={() => void Linking.openURL(link)} style={styles.actionButton} />
          </View>
        </MobileCard>
      ) : (
        <MobileEmptyState
          title="No payment link yet"
          description="Select a member and send the SMS request to generate a public payment link."
        />
      )}

      <MobileConfirmSheet
        visible={confirmOpen}
        title="Send SMS payment link?"
        description={`Send a ${currency} payment link for ${hasValidAmount ? formatTzs(amountNumber) : amount} to ${selectedMember?.fullLegalName || 'the selected member'}. This may dispatch an SMS immediately.`}
        confirmLabel="Send link"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void sendLink()}
      />
    </MobileScreen>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  memberList: {
    gap: 8,
    marginTop: 10,
  },
  memberRow: {
    minHeight: 66,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
  },
  formStack: {
    gap: 12,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionButton: {
    flex: 1,
  },
});
