import { router, useLocalSearchParams } from 'expo-router';
import { Banknote, CreditCard, ExternalLink, Phone, ReceiptText, RefreshCw, Send, ShieldCheck, Smartphone, WalletCards } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

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
  MobileSummaryPanel,
  MobileText,
  MobileTextInput,
} from '@/components/mobile';
import { getAllAssociationMembers, getCurrentMemberByUserId, type AssociationMember } from '@/services/member-service';
import {
  initiateGenericPayment,
  initiateZenoCheckout,
  type GenericPaymentResult,
  type PaymentMethod,
  type PaymentPurpose,
} from '@/services/generic-payment-service';
import { useNaneTheme } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatTzs, initialsFromName } from '@/utils/format';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';

const MEMBER_LOAD_COUNT = 8;
type GenericPaymentMode = 'association' | 'member';

const vikobaPurposeOptions = [
  { label: 'Shares', value: 'SHARE_PURCHASE' },
  { label: 'Social contribution', value: 'SOCIAL_CONTRIBUTION' },
  { label: 'Shares + social', value: 'SHARED_SOCIAL' },
  { label: 'Fines', value: 'FINE' },
  { label: 'Penalties', value: 'PENALTY' },
  { label: 'Loan repayment', value: 'LOAN_REPAYMENT' },
  { label: 'Wallet top-up', value: 'WALLET_TOP_UP' },
  { label: 'Registration fee', value: 'REGISTRATION_FEE' },
  { label: 'Subscription', value: 'SUBSCRIPTION' },
];
const methodOptions = [
  { label: 'Mobile money', value: 'mobile_money' },
  { label: 'Card checkout', value: 'card' },
  { label: 'Bank transfer checkout', value: 'bank_transfer' },
  { label: 'USSD checkout', value: 'ussd' },
  { label: 'Account debit', value: 'account' },
  { label: 'Airpay', value: 'airpay' },
  { label: 'Wallet', value: 'wallet' },
];
const currencyOptions = [
  { label: 'TZS', value: 'TZS' },
  { label: 'KES', value: 'KES' },
  { label: 'USD', value: 'USD' },
  { label: 'NGN', value: 'NGN' },
];

type MobileGenericPaymentScreenProps = {
  mode?: GenericPaymentMode;
};

export default function MobileGenericPaymentScreen({ mode = 'association' }: MobileGenericPaymentScreenProps) {
  const { activeView, associationId, user } = useAuth();
  const isSaccos = isSaccosAssociation(user?.associationType);
  const purposeOptions = useMemo(() => isSaccos ? [
    { label: 'Savings', value: 'SAVINGS' },
    { label: 'Equity shares', value: 'SHARE_PURCHASE' },
    { label: 'Fines', value: 'FINE' },
    { label: 'Penalties', value: 'PENALTY' },
    { label: 'Loan repayment', value: 'LOAN_REPAYMENT' },
    { label: 'Wallet top-up', value: 'WALLET_TOP_UP' },
    { label: 'Registration fee', value: 'REGISTRATION_FEE' },
    { label: 'Subscription', value: 'SUBSCRIPTION' },
  ] : vikobaPurposeOptions, [isSaccos]);
  const theme = useNaneTheme();
  const params = useLocalSearchParams();
  const isMemberMode = mode === 'member';
  const userId = user?.userId;
  const initialAmount = firstParam(params.amount);
  const initialPurpose = firstParam(params.purpose);
  const initialMethod = firstParam(params.method);
  const walletTopUp = firstParam(params.walletTopUp) === 'true';
  const [members, setMembers] = useState<AssociationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(MEMBER_LOAD_COUNT);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [amount, setAmount] = useState(() => (initialAmount && Number(initialAmount) > 0 ? initialAmount : ''));
  const [currency, setCurrency] = useState('TZS');
  const [purpose, setPurpose] = useState<PaymentPurpose>(() => parsePurpose(initialPurpose, walletTopUp, isSaccos));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(() => parseMethod(initialMethod));
  const [phoneNumber, setPhoneNumber] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<GenericPaymentResult | null>(null);
  const effectivePurpose: PaymentPurpose = purposeOptions.some((option) => option.value === purpose)
    ? purpose
    : isSaccos ? 'SAVINGS' : 'SHARE_PURCHASE';

  const loadMembers = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (isMemberMode) {
        if (!userId) {
          setLoading(false);
          setError('Member session is missing the user identifier.');
          return;
        }
      } else if (!associationId) {
        setLoading(false);
        setError('Association context is required before initiating a payment.');
        return;
      }
      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        if (isMemberMode) {
          const member = await getCurrentMemberByUserId(userId || '');
          setMembers([member]);
          setSelectedMemberId(member.id);
          const memberPhone = member.contactInfo?.phoneNumber || '';
          if (memberPhone && validatePhone(memberPhone)) {
            setPhoneNumber(memberPhone);
          }
        } else {
          const loadedMembers = await getAllAssociationMembers(associationId || '', { size: 250, sort: 'membershipNumber,asc' });
          setMembers(loadedMembers.content || []);
        }
      } catch (loadError) {
        setMembers([]);
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId, isMemberMode, userId],
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
  const paymentAssociationId = isMemberMode ? selectedMember?.associationId || associationId : associationId;
  const amountNumber = Number(amount);
  const selectedPurposeLabel = purposeOptions.find((option) => option.value === effectivePurpose)?.label || effectivePurpose;
  const selectedMethodLabel = methodOptions.find((option) => option.value === paymentMethod)?.label || paymentMethod;
  const authorizationUrl = getResultUrl(result);

  const filteredMembers = useMemo(() => {
    if (isMemberMode) return selectedMember ? [selectedMember] : members;
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
  }, [isMemberMode, memberSearch, members, selectedMember]);

  const validationMessage = useMemo(() => {
    if (isMemberMode && activeView !== 'MEMBER') return 'Open this page from the member workspace.';
    if (!paymentAssociationId) return 'Association context is missing.';
    if (!selectedMember) return 'Select a member.';
    if (!selectedMember.membershipNumber) return 'Selected member has no membership number.';
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) return 'Enter an amount greater than zero.';
    if (paymentMethod === 'mobile_money' && !validatePhone(phoneNumber)) return 'Enter a valid Tanzanian mobile number.';
    if (effectivePurpose === 'LOAN_REPAYMENT') return 'Loan repayment needs a selected loan and is handled in the loan workflow.';
    if (paymentMethod === 'wallet' && activeView !== 'MEMBER') return 'Wallet payments can only use the member wallet owner account.';
    return null;
  }, [activeView, amountNumber, effectivePurpose, isMemberMode, paymentAssociationId, paymentMethod, phoneNumber, selectedMember]);

  const submitPayment = async () => {
    if (!paymentAssociationId || !selectedMember || validationMessage) return;
    setConfirmOpen(false);
    setProcessing(true);
    setError(null);
    setResult(null);
    try {
      const membershipNumber = selectedMember.membershipNumber || '';
      let response: GenericPaymentResult;
      if (paymentMethod === 'mobile_money' || paymentMethod === 'wallet') {
        response = await initiateGenericPayment({
          associationId: paymentAssociationId,
          membershipNumber,
          amount: amountNumber,
          currency,
          purpose: effectivePurpose,
          paymentMethod,
          useWallet: paymentMethod === 'wallet',
          isMemberView: activeView === 'MEMBER',
          paymentDetails:
            paymentMethod === 'mobile_money'
              ? {
                  countryCode: '255',
                  phoneNumber: normalizePhone(phoneNumber),
                }
              : undefined,
        });
      } else {
        response = await initiateZenoCheckout({
          memberId: selectedMember.id,
          associationId: paymentAssociationId,
          amount: amountNumber,
          buyerPhone: normalizePhone(phoneNumber || selectedMember.contactInfo?.phoneNumber || ''),
          buyerName: selectedMember.fullLegalName || selectedMember.membershipNumber || 'Member',
          buyerEmail: selectedMember.contactInfo?.email || 'noreply@techy8.com',
          description: `Payment: ${effectivePurpose}`,
          entityId: selectedMember.id,
          entityType: effectivePurpose,
        });
      }
      setResult(response);
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setProcessing(false);
    }
  };

  if (isMemberMode && activeView !== 'MEMBER') {
    return (
      <AccessDeniedScreen
        title="Make payment"
        description="This native page is available inside the member workspace."
      />
    );
  }

  if (!isMemberMode && activeView !== 'ADMIN' && activeView !== 'MEMBER') {
    return (
      <AccessDeniedScreen
        title="Quick payment"
        description="This native page is available inside association and member workspaces."
      />
    );
  }

  if (loading) {
    return <MobilePageLoadingState kind="form" message={isMemberMode ? 'Loading payment profile' : 'Loading payment members'} />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Payments"
        title={isMemberMode ? 'Make payment' : 'Quick payment'}
        subtitle={isSaccos ? 'Pay savings or equity shares without social contributions' : isMemberMode ? 'Pay your shares, contributions, fines, and subscriptions' : 'Shares, contributions, fines, and wallet top-ups'}
        onBack={() => router.back()}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label={isMemberMode ? 'Reload profile' : 'Reload members'}
            variant="secondary"
            disabled={refreshing || processing}
            onPress={() => void loadMembers('refresh')}
          />
        }
      />

      {error ? <MobileErrorState title="Payment issue" description={error} retryLabel={isMemberMode ? 'Reload profile' : 'Reload members'} onRetry={() => void loadMembers('refresh')} /> : null}

      {isMemberMode && selectedMember ? (
        <MobileSummaryPanel
          title="Payment profile"
          value={selectedMember.fullLegalName || selectedMember.membershipNumber || 'Member'}
          description={`${selectedMember.membershipNumber || 'No membership number'} - ${selectedMember.associationName || user?.associationName || 'Current association'}`}
          tone="blue"
          icon={WalletCards}
          footer={
            <MobileStatusBadge
              status={selectedMember.status || 'Active'}
              label={selectedMember.status || 'Active member'}
              tone={String(selectedMember.status || 'ACTIVE').toUpperCase() === 'ACTIVE' ? 'success' : 'warning'}
            />
          }
        />
      ) : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Amount" value={amountNumber > 0 ? formatTzs(amountNumber) : 'Not set'} description={currency} tone={amountNumber > 0 ? 'green' : 'orange'} icon={Banknote} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Purpose" value={selectedPurposeLabel} description="Payment category" tone="blue" icon={ReceiptText} />
        </MobileKpiGridItem>
        {!isMemberMode ? (
          <MobileKpiGridItem>
            <MobileKpiCard title="Method" value={selectedMethodLabel} description="Payment channel" tone="purple" icon={paymentMethod === 'mobile_money' ? Smartphone : paymentMethod === 'wallet' ? WalletCards : CreditCard} />
          </MobileKpiGridItem>
        ) : null}
        <MobileKpiGridItem>
          <MobileKpiCard title="Readiness" value={validationMessage ? 'Draft' : processing ? 'Processing' : 'Ready'} description={validationMessage || 'Ready to submit'} tone={validationMessage ? 'orange' : processing ? 'purple' : 'green'} icon={ShieldCheck} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      {!isMemberMode ? (
        <MobileCard compact>
          <View style={styles.sectionHeader}>
            <View style={styles.flex}>
              <MobileText variant="section" weight="bold">
                Member
              </MobileText>
              <MobileText variant="small" tone="secondary">
                Select the member receiving this payment.
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
                  onPress={() => {
                    setSelectedMemberId(member.id);
                    const phone = member.contactInfo?.phoneNumber || '';
                    if (phone && validatePhone(phone)) setPhoneNumber(phone);
                  }}
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
                      {member.membershipNumber || member.contactInfo?.phoneNumber || 'No membership number'}
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
      ) : null}

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold">
              Payment details
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Set amount, purpose, method, and phone number.
            </MobileText>
          </View>
          <MobileStatusBadge status={validationMessage ? 'Draft' : 'Active'} label={validationMessage ? 'Draft' : 'Ready'} tone={validationMessage ? 'warning' : 'success'} />
        </View>
        <View style={styles.formStack}>
          <MobileAmountInput label="Amount" value={amount} onChangeText={setAmount} error={amount && amountNumber <= 0 ? 'Enter an amount greater than zero.' : undefined} disabled={processing} />
          <MobileSelect label="Currency" value={currency} options={currencyOptions} onChange={setCurrency} />
          <MobileSelect label="Purpose" value={effectivePurpose} options={purposeOptions} onChange={(value) => setPurpose(value as PaymentPurpose)} />
          <MobileSelect label="Payment method" value={paymentMethod} options={methodOptions} onChange={(value) => setPaymentMethod(value as PaymentMethod)} />
          <MobileTextInput label="Phone number" value={phoneNumber} onChangeText={setPhoneNumber} placeholder="0712345678" keyboardType="phone-pad" icon={Phone} error={paymentMethod === 'mobile_money' && phoneNumber && !validatePhone(phoneNumber) ? 'Enter a valid Tanzanian mobile number.' : undefined} disabled={processing} />
        </View>
        {validationMessage ? <MobileStatusBadge status="Draft" label={validationMessage} tone="warning" /> : null}
        <MobileButton
          label={processing ? 'Initiating payment' : 'Initiate payment'}
          icon={Send}
          loading={processing}
          fullWidth
          disabled={Boolean(validationMessage)}
          onPress={() => setConfirmOpen(true)}
        />
      </MobileCard>

      {result ? (
        <MobileCard compact accent={result.success ? 'green' : 'red'}>
          <View style={styles.sectionHeader}>
            <View style={styles.flex}>
              <MobileText variant="section" weight="bold">
                {result.success ? 'Payment initiated' : 'Payment response'}
              </MobileText>
              <MobileText variant="small" tone="secondary">
                {result.message || 'Backend response received.'}
              </MobileText>
            </View>
            <MobileStatusBadge status={result.success ? 'Processing' : 'Failed'} label={result.success ? 'Initiated' : 'Failed'} tone={result.success ? 'info' : 'danger'} />
          </View>
          <MobileInfoRow label="Reference" value={result.reference || 'Not returned'} helper="Use this reference to check payment status." icon={ReceiptText} status={result.success ? 'Processing' : 'Unknown'} />
          {authorizationUrl ? (
            <MobileButton label="Open checkout" icon={ExternalLink} fullWidth onPress={() => void Linking.openURL(authorizationUrl)} />
          ) : null}
        </MobileCard>
      ) : (
        <MobileEmptyState title="No payment started" description="Complete the form and confirm to initiate the payment." />
      )}

      <MobileConfirmSheet
        visible={confirmOpen}
        title="Initiate payment?"
        description={`Initiate ${formatTzs(amountNumber || 0)} ${selectedPurposeLabel.toLowerCase()} for ${selectedMember?.fullLegalName || 'the selected member'} via ${selectedMethodLabel}.`}
        confirmLabel="Initiate"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void submitPayment()}
      />
    </MobileScreen>
  );
}

function validatePhone(value: string) {
  return /^(?:\+255|255|0)?[67]\d{8}$/.test(value.replace(/[\s\-()]/g, ''));
}

function normalizePhone(value: string) {
  let digits = value.replace(/\D/g, '');
  if (digits.length >= 9) digits = digits.slice(-9);
  return `0${digits}`;
}

function getResultUrl(result: GenericPaymentResult | null) {
  if (!result?.data) return null;
  const candidates = [
    result.data.authorizationUrl,
    (result.data.initialResponse as { payment_url?: unknown } | undefined)?.payment_url,
    result.data.redirectUrl,
  ];
  return candidates.find((value): value is string => typeof value === 'string' && value.length > 0) || null;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePurpose(value: string | undefined, walletTopUp: boolean, isSaccos: boolean): PaymentPurpose {
  if (walletTopUp) return 'WALLET_TOP_UP';
  const allowed = isSaccos
    ? ['SAVINGS', 'SHARE_PURCHASE', 'FINE', 'PENALTY', 'LOAN_REPAYMENT', 'WALLET_TOP_UP', 'REGISTRATION_FEE', 'SUBSCRIPTION']
    : vikobaPurposeOptions.map((option) => option.value);
  return allowed.includes(value || '') ? (value as PaymentPurpose) : isSaccos ? 'SAVINGS' : 'SHARE_PURCHASE';
}

function parseMethod(value: string | undefined): PaymentMethod {
  return methodOptions.some((option) => option.value === value) ? (value as PaymentMethod) : 'mobile_money';
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
});
