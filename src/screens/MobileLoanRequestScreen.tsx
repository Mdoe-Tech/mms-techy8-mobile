import { router } from 'expo-router';
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Landmark,
  Package2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  WalletCards,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { isSaccosAssociation, isVikobaAssociation } from '@/auth/association-type';
import {
  MobileAmountInput,
  MobileButton,
  MobileCard,
  MobileCheckboxRow,
  MobileConfirmSheet,
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
  MobileStatusBadge,
  MobileSummaryPanel,
  MobileText,
  MobileTextInput,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import {
  getAllAssociationMembers,
  getAssociationGroupConfigs,
  getCurrentMemberByUserId,
  type AssociationMember,
  type GroupConfig,
} from '@/services/member-service';
import {
  addLoanGuarantors,
  getMemberLoanEligibility,
  getMemberLoans,
  requestLoan,
  type LoanCollateral,
  type LoanDetail,
  type LoanGuarantorRequest,
  type LoanMemberEligibility,
} from '@/services/loan-service';
import { statusToneFor, useNaneTheme } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate, formatNumber, initialsFromName } from '@/utils/format';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';

type CollateralDraft = LoanCollateral & {
  id: string;
  valueText: string;
};

type GuarantorDraft = {
  id: string;
  memberId: string;
  guaranteedAmount: string;
};

const interestMethodOptions = [
  { label: 'Use group default', value: 'DEFAULT' },
  { label: 'Simple interest', value: 'SIMPLE' },
  { label: 'Compound interest', value: 'COMPOUND' },
];

type MobileLoanRequestScreenProps = {
  initialMemberId?: string;
  mode?: 'admin' | 'member';
};

export default function MobileLoanRequestScreen({ initialMemberId, mode = 'admin' }: MobileLoanRequestScreenProps) {
  const { activeView, associationId, user } = useAuth();
  const theme = useNaneTheme();
  const isMemberMode = mode === 'member';
  const userId = user?.userId;
  const [members, setMembers] = useState<AssociationMember[]>([]);
  const [configs, setConfigs] = useState<GroupConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [createdLoan, setCreatedLoan] = useState<LoanDetail | null>(null);

  const [memberSearch, setMemberSearch] = useState('');
  const [memberId, setMemberId] = useState(initialMemberId || '');
  const [eligibility, setEligibility] = useState<LoanMemberEligibility | null>(null);
  const [memberLoans, setMemberLoans] = useState<LoanDetail[]>([]);

  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [requestDate, setRequestDate] = useState(defaultDate());
  const [useGroupRules, setUseGroupRules] = useState(true);
  const [repaymentPeriod, setRepaymentPeriod] = useState('');
  const [installmentCount, setInstallmentCount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [interestMethod, setInterestMethod] = useState('DEFAULT');
  const [collaterals, setCollaterals] = useState<CollateralDraft[]>([]);
  const [guarantors, setGuarantors] = useState<GuarantorDraft[]>([]);
  const [guarantorSearch, setGuarantorSearch] = useState('');

  const groupConfig = configs[0] || null;
  const isSaccos = isSaccosAssociation(user?.associationType) || eligibility?.qualificationBasis === 'SAVINGS';

  const loadBaseData = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!isMemberMode && !associationId) {
        setLoading(false);
        setError('Association context is required before requesting loans.');
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
          if (!userId) {
            throw new Error('Member session is missing the user identifier.');
          }
          const loadedMember = await getCurrentMemberByUserId(userId);
          const configAssociationId = associationId || loadedMember.associationId;
          if (!configAssociationId) {
            throw new Error('Association context is required before requesting loans.');
          }
          const loadedConfigs = await getAssociationGroupConfigs(configAssociationId).catch(() => []);
          setMembers([loadedMember]);
          setMemberId(loadedMember.id);
          setConfigs(loadedConfigs || []);
          return;
        }

        const adminAssociationId = associationId;
        if (!adminAssociationId) {
          throw new Error('Association context is required before requesting loans.');
        }
        const [loadedMembers, loadedConfigs] = await Promise.all([
          getAllAssociationMembers(adminAssociationId, { size: 250, sort: 'membershipNumber,asc' }),
          getAssociationGroupConfigs(adminAssociationId).catch(() => []),
        ]);
        setMembers(loadedMembers.content || []);
        setConfigs(loadedConfigs || []);
      } catch (loadError) {
        setMembers([]);
        setConfigs([]);
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId, isMemberMode, userId],
  );

  const loadMemberContext = useCallback(async (nextMemberId: string) => {
    if (!nextMemberId) {
      setEligibility(null);
      setMemberLoans([]);
      return;
    }
    setDetailsLoading(true);
    setSubmitError(null);
    setValidationError(null);
    try {
      const [memberEligibility, loans] = await Promise.all([
        getMemberLoanEligibility(nextMemberId),
        getMemberLoans(nextMemberId),
      ]);
      setEligibility(memberEligibility);
      setMemberLoans(loans || []);
    } catch (contextError) {
      setEligibility(null);
      setMemberLoans([]);
      setSubmitError(getApiErrorMessage(contextError));
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadBaseData();
    });
    return () => {
      active = false;
    };
  }, [loadBaseData]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      await loadMemberContext(memberId);
    });
    return () => {
      active = false;
    };
  }, [loadMemberContext, memberId]);

  const selectedMember = useMemo(() => members.find((member) => member.id === memberId), [memberId, members]);
  const amountValue = toAmount(amount);
  const qualificationBalance = useMemo(
    () => eligibility?.qualificationBalance !== null && eligibility?.qualificationBalance !== undefined
      ? toAmount(eligibility.qualificationBalance)
      : sumShareValue(eligibility),
    [eligibility],
  );
  const loanMultiplier = toAmount(groupConfig?.loanMultiplier);
  const outstandingBalance = useMemo(() => getOutstandingBalance(memberLoans), [memberLoans]);
  const maxLoan = qualificationBalance * loanMultiplier;
  const remainingEligibility = Math.max(0, maxLoan - outstandingBalance);
  const activeLoanCount = memberLoans.filter((loan) => isActiveLoanStatus(loan.status)).length;
  const suggestedPeriod = useMemo(
    () => calculateRepaymentPeriod(amountValue, groupConfig),
    [amountValue, groupConfig],
  );
  const effectiveRepaymentPeriod = useGroupRules && suggestedPeriod ? String(suggestedPeriod) : repaymentPeriod;
  const requestRoute = getRouteByPath(isMemberMode ? '/member/loans/:loanId' : '/associations/loans');
  const loanListRoute = getRouteByPath(isMemberMode ? '/member/loans' : '/associations/loans');

  const memberOptions = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    const source = members
      .filter((member) => {
        if (!query) return !memberId || member.id === memberId;
        return [member.fullLegalName, member.membershipNumber, member.employeeId, member.contactInfo?.email, member.contactInfo?.phoneNumber]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query);
      })
      .slice(0, query ? 40 : 12);

    return source.map((member) => ({
      value: member.id,
      label: member.fullLegalName || member.membershipNumber || 'Unnamed member',
    }));
  }, [memberId, memberSearch, members]);

  const guarantorOptions = useMemo(() => {
    const query = guarantorSearch.trim().toLowerCase();
    return members
      .filter((member) => member.id !== memberId)
      .filter((member) => {
        if (!query) return true;
        return [member.fullLegalName, member.membershipNumber, member.contactInfo?.email]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query);
      })
      .slice(0, query ? 40 : 16)
      .map((member) => ({
        value: member.id,
        label: member.fullLegalName || member.membershipNumber || 'Unnamed member',
      }));
  }, [guarantorSearch, memberId, members]);

  const previousLoanItems = useMemo<MobileDataListItem[]>(
    () =>
      memberLoans.slice(0, 5).map((loan) => ({
        id: loan.id,
        title: loan.purpose || `Loan ${shortId(loan.id)}`,
        subtitle: `${formatDate(loan.requestDate)} - ${loan.status || 'Unknown'}`,
        meta: `Balance ${formatCurrency(toAmount(loan.remainingBalance))}`,
        amount: formatCurrency(toAmount(loan.requestedAmount)),
        status: loan.status || 'Unknown',
        statusTone: statusToneFor(loan.status),
        accent: statusToneFor(loan.status),
      })),
    [memberLoans],
  );

  const selectedMemberItem = useMemo<MobileDataListItem[]>(
    () =>
      selectedMember
        ? [
            {
              id: selectedMember.id,
              title: selectedMember.fullLegalName || eligibility?.fullLegalName || 'Selected member',
              subtitle: selectedMember.membershipNumber || eligibility?.membershipNumber || 'No membership number',
              meta: selectedMember.contactInfo?.phoneNumber || selectedMember.contactInfo?.email || 'No contact on file',
              status: eligibility?.status || selectedMember.status || 'Unknown',
              statusTone: statusToneFor(eligibility?.status || selectedMember.status),
              initials: initialsFromName(selectedMember.fullLegalName || selectedMember.membershipNumber || 'Member'),
              accent: statusToneFor(eligibility?.status || selectedMember.status),
            },
          ]
        : [],
    [eligibility, selectedMember],
  );

  const validationMessage = useMemo(() => {
    if (!memberId) return 'Select a member before submitting the request.';
    if (detailsLoading) return 'Wait for member eligibility to finish loading.';
    if (!eligibility) return 'Member eligibility could not be loaded.';
    if (!groupConfig) return 'Loan group configuration is not available for this association.';
    if (!amountValue || amountValue <= 0) return 'Enter a loan amount greater than zero.';
    if (!isMemberMode && remainingEligibility <= 0) return 'This member has no remaining loan eligibility.';
    if (!isMemberMode && amountValue > remainingEligibility) return `Amount exceeds remaining eligibility of ${formatCurrency(remainingEligibility)}.`;
    if (!Number.isFinite(Number(effectiveRepaymentPeriod)) || Number(effectiveRepaymentPeriod) <= 0) return 'Enter a valid repayment period.';
    if (!purpose.trim()) return 'Enter the loan purpose.';
    if (interestRate.trim()) {
      const parsedInterest = Number(interestRate);
      if (!Number.isFinite(parsedInterest) || parsedInterest < 0 || parsedInterest > 100) {
        return 'Interest rate must be between 0 and 100.';
      }
    }
    if (!useGroupRules && installmentCount.trim()) {
      const parsedInstallments = Number(installmentCount);
      if (!Number.isFinite(parsedInstallments) || parsedInstallments <= 0) {
        return 'Installment count must be greater than zero.';
      }
    }
    const partialCollateral = collaterals.find((collateral) => {
      const hasAny = collateral.type.trim() || collateral.identification.trim() || toAmount(collateral.valueText) > 0;
      const complete = collateral.type.trim() && collateral.identification.trim() && toAmount(collateral.valueText) > 0;
      return hasAny && !complete;
    });
    if (partialCollateral) return 'Complete or remove the partial collateral row.';
    const duplicateGuarantor = findDuplicate(guarantors.map((guarantor) => guarantor.memberId).filter(Boolean));
    if (duplicateGuarantor) return 'Each guarantor can only be selected once.';
    return null;
  }, [
    amountValue,
    collaterals,
    detailsLoading,
    eligibility,
    groupConfig,
    guarantors,
    installmentCount,
    interestRate,
    isMemberMode,
    memberId,
    purpose,
    remainingEligibility,
    effectiveRepaymentPeriod,
    useGroupRules,
  ]);
  const eligibilityWarning = useMemo(() => {
    if (!isMemberMode || !memberId || !amount || !eligibility || !groupConfig) return null;
    if (remainingEligibility <= 0) {
      return 'Your estimated remaining eligibility is fully used. You can still submit the request for committee review.';
    }
    if (amountValue > remainingEligibility) {
      return `Requested amount is above the estimated remaining eligibility of ${formatCurrency(remainingEligibility)}. The loan team will review it.`;
    }
    return null;
  }, [amount, amountValue, eligibility, groupConfig, isMemberMode, memberId, remainingEligibility]);
  const reviewMessage = validationError || validationMessage || eligibilityWarning;
  const shouldShowValidation = Boolean(validationError || (memberId && amount && validationMessage) || eligibilityWarning);

  const runSubmit = async () => {
    if (validationMessage) {
      setValidationError(validationMessage);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    setValidationError(null);

    try {
      const validCollaterals = collaterals
        .filter((collateral) => collateral.type.trim() && collateral.identification.trim() && toAmount(collateral.valueText) > 0)
        .map((collateral) => ({
          type: collateral.type.trim(),
          identification: collateral.identification.trim(),
          value: toAmount(collateral.valueText),
        }));
      const created = await requestLoan({
        memberId,
        requestedAmount: amountValue,
        purpose: purpose.trim(),
        repaymentPeriod: Number(effectiveRepaymentPeriod),
        installmentCount: !useGroupRules && installmentCount.trim() ? Number(installmentCount) : undefined,
        requestDate: requestDate ? `${requestDate}T00:00:00` : undefined,
        interestRate: interestRate.trim() ? Number(interestRate) : undefined,
        respectGroupConfigRules: useGroupRules,
        interestCalculationMethod: interestMethod === 'SIMPLE' || interestMethod === 'COMPOUND' ? interestMethod : undefined,
        collaterals: validCollaterals,
      });

      const validGuarantors: LoanGuarantorRequest[] = guarantors
        .filter((guarantor) => guarantor.memberId)
        .map((guarantor) => ({
          memberId: guarantor.memberId,
          guaranteedAmount: toAmount(guarantor.guaranteedAmount) > 0 ? toAmount(guarantor.guaranteedAmount) : undefined,
        }));

      if (created?.id && validGuarantors.length) {
        await addLoanGuarantors(created.id, validGuarantors);
      }

      setCreatedLoan(created);
      setConfirmOpen(false);
      await loadMemberContext(memberId);
    } catch (submitFailure) {
      setSubmitError(getApiErrorMessage(submitFailure));
    } finally {
      setSubmitting(false);
    }
  };

  if (isMemberMode && activeView !== 'MEMBER') {
    return <AccessDeniedScreen title="Request a loan" description="This loan request page is available from the member portal workspace." />;
  }

  if (!isMemberMode && activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="New loan request" description="This native page is available for association admin workspaces only." />;
  }

  if (isMemberMode && user?.associationType && !isVikobaAssociation(user.associationType) && !isSaccosAssociation(user.associationType)) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Member portal"
          title="Request a loan"
          subtitle={user.associationName || 'Loan self-service'}
          onBack={() => router.back()}
        />
        <MobileEmptyState
          title="Loan requests are not enabled"
          description="Loan requests are available to VIKOBA and SACCOS members."
          actionLabel="Back"
          onAction={() => router.back()}
        />
      </MobileScreen>
    );
  }

  if (loading) {
    return <MobilePageLoadingState kind="form" message={isMemberMode ? 'Loading your loan request' : 'Loading loan request workspace'} />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow={isMemberMode ? 'Member portal' : 'Loans'}
        title={isMemberMode ? 'Request a loan' : 'New loan request'}
        subtitle={
          isMemberMode
            ? `${selectedMember?.associationName || user?.associationName || 'Loan self-service'} · ${selectedMember?.membershipNumber || 'Membership pending'}`
            : 'Check eligibility, set terms, and submit a member loan request'
        }
        onBack={() => router.back()}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label={isMemberMode ? 'Refresh loan request' : 'Refresh loan request data'}
            variant="secondary"
            disabled={refreshing || submitting}
            onPress={() => void loadBaseData('refresh')}
          />
        }
      />

      {error ? <MobileErrorState title="Loan request issue" description={error} retryLabel="Reload" onRetry={() => void loadBaseData('refresh')} /> : null}
      {submitError ? <MobileErrorState title="Submission issue" description={submitError} /> : null}
      {createdLoan ? <SuccessPanel loan={createdLoan} mode={mode} requestRouteId={requestRoute?.id} listRouteId={loanListRoute?.id} /> : null}

      {!isMemberMode ? (
        <MobileKpiGrid>
          <MobileKpiGridItem>
            <MobileKpiCard
              title="Members loaded"
              value={formatNumber(members.length)}
              description="Available for selection"
              tone="blue"
              icon={Users}
            />
          </MobileKpiGridItem>
          <MobileKpiGridItem>
            <MobileKpiCard title={isSaccos ? 'Paid savings' : 'Share value'} value={formatCurrency(qualificationBalance)} description={`${formatNumber(loanMultiplier || 0)}x multiplier`} tone="green" icon={WalletCards} />
          </MobileKpiGridItem>
          <MobileKpiGridItem>
            <MobileKpiCard title="Maximum loan" value={formatCurrency(maxLoan)} description="Based on group rules" tone="purple" icon={Landmark} />
          </MobileKpiGridItem>
          <MobileKpiGridItem>
            <MobileKpiCard title="Remaining" value={formatCurrency(remainingEligibility)} description={`${activeLoanCount} active loan(s)`} tone={remainingEligibility > 0 ? 'orange' : 'red'} icon={ShieldCheck} />
          </MobileKpiGridItem>
        </MobileKpiGrid>
      ) : selectedMember ? (
        <MobileStatusBadge
          status={eligibility?.status || selectedMember.status || 'Active'}
          label={`${selectedMember.fullLegalName || eligibility?.fullLegalName || 'Current member'} · ${selectedMember.membershipNumber || eligibility?.membershipNumber || 'Membership pending'}`}
          tone={statusToneFor(eligibility?.status || selectedMember.status)}
        />
      ) : null}

      {isMemberMode && eligibility ? (
        <MobileSummaryPanel
          title="Estimated remaining eligibility"
          value={formatCurrency(remainingEligibility)}
          description={`Outstanding balance ${formatCurrency(outstandingBalance)} from ${activeLoanCount} active loan(s).`}
          tone={remainingEligibility > 0 ? 'green' : 'red'}
          icon={remainingEligibility > 0 ? CheckCircle2 : AlertTriangle}
          footer={
            <View style={styles.infoGrid}>
              <MobileInfoRow label={isSaccos ? 'Paid savings' : 'Share value'} value={formatCurrency(qualificationBalance)} helper={`${formatNumber(loanMultiplier || 0)}x multiplier gives ${formatCurrency(maxLoan)} max`} icon={WalletCards} />
              <MobileInfoRow label="Group rule" value={groupConfig?.name || 'Not configured'} helper={suggestedPeriod ? `${suggestedPeriod} month suggested period` : 'No matching repayment rule'} icon={ShieldCheck} />
              <MobileInfoRow label="Previous loans" value={String(memberLoans.length)} helper={`${activeLoanCount} active loan(s) considered in the estimate`} icon={Landmark} />
            </View>
          }
        />
      ) : null}

      {!isMemberMode ? (
        <MobileFormSection
          title="Member selection"
          description="Search the association member list, then choose the borrower."
        >
          <>
            <MobileSearchToolbar value={memberSearch} onChange={setMemberSearch} placeholder="Search by name, number, phone, or email" />
            <MobileSelect
              label="Borrower"
              value={memberId}
              options={memberOptions}
              onChange={(value) => {
                setMemberId(value);
                setCreatedLoan(null);
              }}
              placeholder={memberSearch ? 'Select matching member' : 'Search first or choose recent member'}
            />
          </>
          {selectedMemberItem.length ? <MobileDataList items={selectedMemberItem} showChevron={false} /> : null}
          {detailsLoading ? <MobileStatusBadge status="Processing" label="Loading member eligibility" tone="warning" /> : null}
        </MobileFormSection>
      ) : detailsLoading ? (
        <MobileStatusBadge status="Processing" label="Loading member eligibility" tone="warning" />
      ) : null}

      {memberId && !detailsLoading && !eligibility ? (
        <MobileEmptyState
          title="No eligibility data"
          description="The backend did not return eligibility details for this member. Refresh the page or select another member."
          actionLabel="Reload member"
          onAction={() => void loadMemberContext(memberId)}
        />
      ) : null}

      {!isMemberMode && eligibility ? (
        <MobileSummaryPanel
          title="Eligibility summary"
          value={formatCurrency(remainingEligibility)}
          description={`Outstanding balance ${formatCurrency(outstandingBalance)} from ${activeLoanCount} active loan(s).`}
          tone={remainingEligibility > 0 ? 'green' : 'red'}
          icon={remainingEligibility > 0 ? CheckCircle2 : AlertTriangle}
          footer={
            <View style={styles.infoGrid}>
              <MobileInfoRow label="Member status" value={eligibility.status || selectedMember?.status || 'Unknown'} icon={UserRound} status={eligibility.status || selectedMember?.status || 'Unknown'} />
              <MobileInfoRow label="Group rule" value={groupConfig?.name || 'Not configured'} helper={suggestedPeriod ? `${suggestedPeriod} month suggested period` : 'No matching repayment rule'} icon={ShieldCheck} />
              <MobileInfoRow label="Previous loans" value={String(memberLoans.length)} helper={`${activeLoanCount} active loan(s) considered in eligibility`} icon={Landmark} />
            </View>
          }
        />
      ) : null}

      {!isMemberMode && previousLoanItems.length ? (
        <MobileCard compact>
          <View style={styles.sectionHeader}>
            <View style={styles.flex}>
              <MobileText variant="section" weight="bold">
                Previous loans
              </MobileText>
              <MobileText variant="small" tone="secondary">
                Latest member loan records used during review.
              </MobileText>
            </View>
            <MobileStatusBadge status="Active" label={`${memberLoans.length} loan(s)`} tone="primary" />
          </View>
          <MobileDataList items={previousLoanItems} showChevron={false} />
        </MobileCard>
      ) : !isMemberMode && memberId && !detailsLoading ? (
        <MobileEmptyState title="No previous loans" description="This member has no loan history in the loaded records." />
      ) : null}

      <MobileFormSection
        title="Loan terms"
        description={isMemberMode ? 'Enter the amount and purpose. Group rules calculate the normal repayment terms.' : 'Use group rules where possible, then override only when the request requires manual terms.'}
      >
        <MobileAmountInput
          label="Loan amount"
          value={amount}
          onChangeText={(value) => {
            setAmount(value);
            setValidationError(null);
            setCreatedLoan(null);
          }}
          helperText={
            remainingEligibility > 0
              ? `Estimated available: ${formatCurrency(remainingEligibility)}`
              : isMemberMode
                ? 'Estimated eligibility is fully used; request can still be reviewed.'
                : 'Select an eligible member first'
          }
          error={!isMemberMode && amountValue > remainingEligibility && remainingEligibility > 0 ? 'Amount is above remaining eligibility.' : undefined}
          disabled={!memberId || detailsLoading || submitting}
        />
        <MobileCheckboxRow
          label="Use group configuration rules"
          description={
            isMemberMode
              ? 'Group rules are applied to member self-service requests.'
              : useGroupRules
                ? 'Repayment period is calculated from configured loan rules.'
                : 'Repayment period and installments can be entered manually.'
          }
          checked={useGroupRules}
          onChange={(checked) => {
            if (isMemberMode) return;
            setUseGroupRules(checked);
            if (!checked && !repaymentPeriod && suggestedPeriod) {
              setRepaymentPeriod(String(suggestedPeriod));
            }
            setValidationError(null);
          }}
          disabled={!memberId || submitting || isMemberMode}
        />
        <View style={styles.twoColumn}>
          <MobileTextInput
            label="Repayment period"
            value={effectiveRepaymentPeriod}
            onChangeText={setRepaymentPeriod}
            placeholder={useGroupRules ? 'Auto from group rules' : 'Months'}
            helperText={suggestedPeriod ? `Suggested: ${suggestedPeriod} months` : 'Enter months'}
            keyboardType="number-pad"
            icon={CalendarDays}
            disabled={!memberId || submitting || useGroupRules}
          />
          {!useGroupRules ? (
            <MobileTextInput
              label="Installments"
              value={installmentCount}
              onChangeText={setInstallmentCount}
              placeholder="Optional"
              helperText="Number of payments"
              keyboardType="number-pad"
              icon={CreditCard}
              disabled={!memberId || submitting}
            />
          ) : null}
        </View>
        {!isMemberMode ? (
          <View style={styles.twoColumn}>
            <MobileTextInput
              label="Interest rate"
              value={interestRate}
              onChangeText={setInterestRate}
              placeholder="Default"
              helperText="Optional percent override"
              keyboardType="decimal-pad"
              icon={Banknote}
              disabled={!memberId || submitting}
            />
            <MobileSelect
              label="Interest method"
              value={interestMethod}
              options={interestMethodOptions}
              onChange={setInterestMethod}
            />
          </View>
        ) : null}
        <MobileTextInput
          label="Loan purpose"
          value={purpose}
          onChangeText={(value) => {
            setPurpose(value);
            setValidationError(null);
          }}
          placeholder="Business capital, school fees, emergency support"
          icon={Package2}
          disabled={!memberId || submitting}
        />
        <MobileTextInput
          label="Request date"
          value={requestDate}
          onChangeText={setRequestDate}
          placeholder="YYYY-MM-DD"
          helperText="Leave today unless you are correcting a historical request."
          icon={CalendarDays}
          disabled={!memberId || submitting}
        />
      </MobileFormSection>

      <MobileFormSection title="Collaterals" description="Optional assets used to support the request. Complete every field on rows you add.">
        {collaterals.length ? (
          <View style={styles.stack}>
            {collaterals.map((collateral, index) => (
              <MobileCard key={collateral.id} compact accent="slate">
                <View style={styles.rowBetween}>
                  <MobileText variant="body" weight="bold">
                    Collateral {index + 1}
                  </MobileText>
                  <MobileIconButton icon={Trash2} label="Remove collateral" variant="danger" onPress={() => setCollaterals((current) => current.filter((item) => item.id !== collateral.id))} />
                </View>
                <MobileTextInput label="Type" value={collateral.type} onChangeText={(value) => updateCollateral(collateral.id, { type: value })} placeholder="Vehicle, property, equipment" icon={Package2} disabled={submitting} />
                <MobileAmountInput label="Estimated value" value={collateral.valueText} onChangeText={(value) => updateCollateral(collateral.id, { valueText: value, value: toAmount(value) })} disabled={submitting} />
                <MobileTextInput label="Identification" value={collateral.identification} onChangeText={(value) => updateCollateral(collateral.id, { identification: value })} placeholder="Registration or serial number" icon={ShieldCheck} disabled={submitting} />
              </MobileCard>
            ))}
          </View>
        ) : (
          <MobileEmptyState title="No collaterals added" description="You can submit without collaterals unless the loan rules require one." />
        )}
        <MobileButton label="Add collateral" icon={Plus} variant="secondary" onPress={addCollateral} disabled={!memberId || submitting} />
      </MobileFormSection>

      {!isMemberMode ? (
        <MobileFormSection title="Guarantors" description="Optionally attach members who guarantee this loan.">
          <MobileSearchToolbar value={guarantorSearch} onChange={setGuarantorSearch} placeholder="Search guarantors" />
          {guarantors.length ? (
            <View style={styles.stack}>
              {guarantors.map((guarantor, index) => {
                const member = members.find((candidate) => candidate.id === guarantor.memberId);
                return (
                  <MobileCard key={guarantor.id} compact accent="blue">
                    <View style={styles.rowBetween}>
                      <View style={styles.flex}>
                        <MobileText variant="body" weight="bold">
                          Guarantor {index + 1}
                        </MobileText>
                        {member ? (
                          <MobileText variant="small" tone="secondary" numberOfLines={1}>
                            {member.membershipNumber || member.contactInfo?.email || 'Member selected'}
                          </MobileText>
                        ) : null}
                      </View>
                      <MobileIconButton icon={Trash2} label="Remove guarantor" variant="danger" onPress={() => setGuarantors((current) => current.filter((item) => item.id !== guarantor.id))} />
                    </View>
                    <MobileSelect
                      label="Member"
                      value={guarantor.memberId}
                      options={guarantorOptions}
                      onChange={(value) => updateGuarantor(guarantor.id, { memberId: value })}
                      placeholder="Select guarantor"
                    />
                    <MobileAmountInput
                      label="Guaranteed amount"
                      value={guarantor.guaranteedAmount}
                      onChangeText={(value) => updateGuarantor(guarantor.id, { guaranteedAmount: value })}
                      helperText="Optional. Leave blank if not specified."
                      disabled={submitting}
                    />
                  </MobileCard>
                );
              })}
            </View>
          ) : (
            <MobileEmptyState title="No guarantors added" description="Add guarantors only when the group rules or loan committee requires them." />
          )}
          <MobileButton label="Add guarantor" icon={Plus} variant="secondary" onPress={addGuarantor} disabled={!memberId || submitting} />
        </MobileFormSection>
      ) : (
        <MobileFormSection title="Guarantors" description="Guarantor review remains private to the loan committee.">
          <MobileCard compact accent="blue">
            <View style={styles.warningRow}>
              <ShieldCheck color={theme.colors.primary} size={19} strokeWidth={2.4} />
              <View style={styles.flex}>
                <MobileText variant="small" weight="bold">
                  Committee review
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  Submit your request first. The loan team can request or attach guarantor details during review if your group rules require them.
                </MobileText>
              </View>
            </View>
          </MobileCard>
        </MobileFormSection>
      )}

      {shouldShowValidation ? (
        <MobileCard compact accent={validationMessage || eligibilityWarning ? 'orange' : 'red'}>
          <View style={styles.warningRow}>
            <AlertTriangle color={theme.colors.kpi.orange} size={19} strokeWidth={2.4} />
            <View style={styles.flex}>
              <MobileText variant="small" weight="bold">
                {validationMessage ? 'Review required' : 'Eligibility review'}
              </MobileText>
              <MobileText variant="small" tone="secondary">
                {reviewMessage}
              </MobileText>
            </View>
          </View>
        </MobileCard>
      ) : null}

      <View style={styles.actions}>
        <MobileButton label="Back to loans" variant="secondary" onPress={goBackToLoans} disabled={submitting} />
        <MobileButton
          label="Submit request"
          icon={CreditCard}
          fullWidth
          style={styles.flex}
          loading={submitting}
          disabled={Boolean(validationMessage) || submitting}
          onPress={() => {
            if (validationMessage) {
              setValidationError(validationMessage);
              return;
            }
            setConfirmOpen(true);
          }}
        />
      </View>

      <MobileConfirmSheet
        visible={confirmOpen}
        title="Submit loan request?"
        description={`${selectedMember?.fullLegalName || eligibility?.fullLegalName || 'This member'} will submit a ${formatCurrency(amountValue)} loan request for review.`}
        confirmLabel="Submit request"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={runSubmit}
      />
    </MobileScreen>
  );

  function addCollateral() {
    setCollaterals((current) => [
      ...current,
      { id: `${Date.now()}-${current.length}`, type: '', value: 0, valueText: '', identification: '' },
    ]);
  }

  function updateCollateral(id: string, patch: Partial<CollateralDraft>) {
    setCollaterals((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    setValidationError(null);
    setCreatedLoan(null);
  }

  function addGuarantor() {
    setGuarantors((current) => [...current, { id: `${Date.now()}-${current.length}`, memberId: '', guaranteedAmount: '' }]);
  }

  function updateGuarantor(id: string, patch: Partial<GuarantorDraft>) {
    setGuarantors((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    setValidationError(null);
    setCreatedLoan(null);
  }

  function goBackToLoans() {
    if (loanListRoute?.id) {
      router.push({ pathname: '/work/route-preview', params: { routeId: loanListRoute.id } } as never);
      return;
    }
    router.back();
  }
}

function SuccessPanel({
  loan,
  mode,
  requestRouteId,
  listRouteId,
}: {
  loan: LoanDetail;
  mode: 'admin' | 'member';
  requestRouteId?: string;
  listRouteId?: string;
}) {
  return (
    <MobileCard compact accent="green">
      <View style={styles.sectionHeader}>
        <View style={styles.successIcon}>
          <CheckCircle2 color="#FFFFFF" size={20} strokeWidth={2.6} />
        </View>
        <View style={styles.flex}>
          <MobileText variant="section" weight="bold">
            Loan request submitted
          </MobileText>
          <MobileText variant="small" tone="secondary">
            {shortId(loan.id)} is now {loan.status || 'recorded'} for review.
          </MobileText>
        </View>
        <MobileStatusBadge status={loan.status || 'Pending'} />
      </View>
      <View style={styles.actions}>
        <MobileButton
          label={mode === 'member' ? 'View request' : 'Open loan'}
          icon={Landmark}
          onPress={() =>
            router.push({
              pathname: '/work/route-preview',
              params: { routeId: requestRouteId || (mode === 'member' ? 'member-member-loans-loanId' : 'association-admin-associations-loans'), loanId: loan.id },
            } as never)
          }
        />
        {mode === 'member' && listRouteId ? (
          <MobileButton
            label="My loans"
            variant="secondary"
            onPress={() => router.push({ pathname: '/work/route-preview', params: { routeId: listRouteId } } as never)}
          />
        ) : null}
      </View>
    </MobileCard>
  );
}

function toAmount(value: unknown) {
  if (value === null || value === undefined) return 0;
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sumShareValue(eligibility: LoanMemberEligibility | null) {
  return (eligibility?.shares || []).reduce((sum, share) => sum + toAmount(share.totalValue), 0);
}

function getOutstandingBalance(loans: LoanDetail[]) {
  return loans
    .filter((loan) => isActiveLoanStatus(loan.status))
    .reduce((sum, loan) => {
      const remaining = toAmount(loan.remainingBalance);
      if (remaining > 0) return sum + remaining;
      return sum + Math.max(0, toAmount(loan.requestedAmount) - toAmount(loan.totalPaid));
    }, 0);
}

function isActiveLoanStatus(status?: string | null) {
  return ['APPROVED', 'DISBURSED', 'OVERDUE', 'DEFAULTED', 'PARTIAL'].includes(String(status || '').toUpperCase());
}

function calculateRepaymentPeriod(amount: number, config: GroupConfig | null) {
  if (!amount || !config) return toAmount(config?.defaultInstallmentCount) || null;
  const rules = config.repaymentRules || [];
  const matchingRule = rules.find((rule) => {
    const min = toAmount(rule.minAmount);
    const max = toAmount(rule.maxAmount);
    return amount >= min && (!max || amount <= max);
  });
  return toAmount(matchingRule?.months) || toAmount(config.defaultInstallmentCount) || null;
}

function findDuplicate(values: string[]) {
  const seen = new Set<string>();
  return values.find((value) => {
    if (seen.has(value)) return true;
    seen.add(value);
    return false;
  });
}

function shortId(id?: string | null) {
  return id ? id.slice(0, 8).toUpperCase() : 'NEW';
}

function defaultDate() {
  return new Date().toISOString().slice(0, 10);
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minWidth: 0,
  },
  infoGrid: {
    gap: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  twoColumn: {
    gap: 12,
  },
  stack: {
    gap: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  successIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#15803D',
  },
});
