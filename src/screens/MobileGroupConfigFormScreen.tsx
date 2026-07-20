import { router } from 'expo-router';
import {
  AlertTriangle,
  CalendarDays,
  FileText,
  Landmark,
  Percent,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Users,
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
  MobileEmptyState,
  MobileErrorState,
  MobileFormSection,
  MobileIconButton,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileSelect,
  MobileStatusBadge,
  MobileText,
  MobileTextInput,
  MobileToast,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  createGroupConfig,
  getGroupConfigById,
  updateGroupConfig,
  type GroupConfig,
  type GroupConfigPayload,
} from '@/services/member-service';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate, formatNumber } from '@/utils/format';

type MobileGroupConfigFormScreenProps = {
  mode?: 'create' | 'edit';
  configId?: string | null;
};

type RepaymentRuleForm = {
  minAmount: string;
  maxAmount: string;
  months: string;
  installments: string;
};

type GroupConfigFormState = {
  name: string;
  shareValue: string;
  sharePurchaseFrequency: string;
  minShares: string;
  financialYearStartDate: string;
  financialYearEndDate: string;
  socialAmount: string;
  socialFrequency: string;
  fineType: string;
  fineAmount: string;
  finePercentage: string;
  attendanceFineType: string;
  attendanceFineAmount: string;
  attendanceFinePercentage: string;
  attendanceFineFrequency: string;
  interestType: string;
  loanMultiplier: string;
  interestRate: string;
  insuranceRate: string;
  penaltyRate: string;
  defaultInstallmentCount: string;
  loanRepaymentGracePeriodDays: string;
  disburseGrossAmount: boolean;
  deductInsuranceOnDisbursement: boolean;
  dividendsWeighting: string;
  dividendsMinMonthsSinceJoin: string;
  shareInactivityEnabled: boolean;
  shareInactivityMissedPeriodsThreshold: string;
  emergencyEnabled: boolean;
  emergencyInterestRate: string;
  emergencyForceSingleTerm: boolean;
  registrationFeeEnabled: boolean;
  registrationFeeAmount: string;
  repaymentRules: RepaymentRuleForm[];
};

const frequencyOptions = [
  { label: 'Weekly', value: 'WEEKLY' },
  { label: 'Monthly', value: 'MONTHLY' },
  { label: 'Quarterly', value: 'QUARTERLY' },
  { label: 'Annually', value: 'ANNUALLY' },
];

const fineTypeOptions = [
  { label: 'Fixed amount', value: 'AMOUNT' },
  { label: 'Percentage', value: 'PERCENTAGE' },
];

const interestTypeOptions = [
  { label: 'Simple interest', value: 'SIMPLE' },
  { label: 'Compound interest', value: 'COMPOUND' },
];

const dividendWeightingOptions = [
  { label: 'By share count', value: 'SHARE_COUNT' },
  { label: 'By share value', value: 'SHARE_VALUE' },
  { label: 'Equally', value: 'EQUAL' },
];

export default function MobileGroupConfigFormScreen({ mode = 'create', configId }: MobileGroupConfigFormScreenProps) {
  const { activeView, associationId, user } = useAuth();
  const [form, setForm] = useState<GroupConfigFormState>(() => defaultForm());
  const [fetching, setFetching] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [sourceConfig, setSourceConfig] = useState<GroupConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const listRoute = getRouteByPath('/associations/group-config');
  const detailRoute = getRouteByPath('/associations/group-config/:id');
  const isEdit = mode === 'edit';
  const isSaccos = isSaccosAssociation(user?.associationType);
  const canSubmit = useMemo(() => hasLoanConfigManagePermission(user), [user]);

  const loadConfig = useCallback(async () => {
    if (!isEdit || !configId) {
      setFetching(false);
      return;
    }

    setFetching(true);
    setError(null);
    try {
      const loaded = await getGroupConfigById(configId);
      setSourceConfig(loaded);
      setForm(formFromConfig(loaded));
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
      setSourceConfig(null);
    } finally {
      setFetching(false);
    }
  }, [configId, isEdit]);

  useEffect(() => {
    void Promise.resolve().then(() => loadConfig());
  }, [loadConfig]);

  const validation = useMemo(() => validateForm(form, associationId), [associationId, form]);
  const previewShareValue = toNumber(form.shareValue);
  const previewLoanMultiplier = toNumber(form.loanMultiplier);

  const updateField = <K extends keyof GroupConfigFormState>(field: K, value: GroupConfigFormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const goToList = (selectedConfig?: GroupConfig | null) => {
    if (!listRoute) {
      router.back();
      return;
    }
    router.replace({
      pathname: '/work/route-preview',
      params: {
        routeId: listRoute.id,
        configId: selectedConfig?.id,
        id: selectedConfig?.id,
      },
    } as never);
  };

  const goToDetail = (selectedConfig: GroupConfig) => {
    if (!detailRoute || !selectedConfig.id) {
      goToList(selectedConfig);
      return;
    }
    router.replace({
      pathname: '/work/route-preview',
      params: {
        routeId: detailRoute.id,
        configId: selectedConfig.id,
        id: selectedConfig.id,
      },
    } as never);
  };

  const saveConfig = async () => {
    setSubmitted(true);
    setNotice(null);
    setError(null);

    if (!canSubmit) {
      setError('Your role cannot save loan group configuration.');
      return;
    }

    const currentValidation = validateForm(form, associationId);
    if (!currentValidation.valid) {
      setError('Fix the highlighted fields before saving this configuration.');
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload(form, associationId || '', isSaccos);
      const saved = isEdit && configId ? await updateGroupConfig(configId, payload) : await createGroupConfig(payload);
      setNotice(isEdit ? 'Group configuration updated.' : 'Group configuration created.');
      goToDetail(saved);
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const addRepaymentRule = () => {
    setForm((current) => ({
      ...current,
      repaymentRules: [...current.repaymentRules, { minAmount: '0', maxAmount: '0', months: '1', installments: '1' }],
    }));
  };

  const updateRepaymentRule = (index: number, field: keyof RepaymentRuleForm, value: string) => {
    setForm((current) => ({
      ...current,
      repaymentRules: current.repaymentRules.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, [field]: value } : rule)),
    }));
  };

  const removeRepaymentRule = (index: number) => {
    setForm((current) => ({
      ...current,
      repaymentRules: current.repaymentRules.filter((_, ruleIndex) => ruleIndex !== index),
    }));
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Group configuration" description="Configuration forms are available in association admin workspaces only." />;
  }

  if (!isVikobaAssociation(user?.associationType) && !isSaccos) {
    return <AccessDeniedScreen title="Group configuration" description="Loan group configuration is available for VIKOBA and SACCOS associations." />;
  }

  if (isEdit && !configId) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Settings" title="Edit configuration" subtitle="Missing configuration context" onBack={() => router.back()} />
        <MobileEmptyState
          title="No configuration selected"
          description="Open the edit form from a configuration record so the ID is available."
          actionLabel="Back to configurations"
          onAction={() => goToList()}
        />
      </MobileScreen>
    );
  }

  if (fetching) {
    return <MobilePageLoadingState kind="form" message="Loading group configuration" />;
  }

  if (error && isEdit && !sourceConfig) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Settings"
          title="Edit configuration"
          subtitle={shortId(configId)}
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry" variant="secondary" onPress={() => void loadConfig()} />}
        />
        <MobileErrorState title="Configuration could not load" description={error} retryLabel="Retry" onRetry={() => void loadConfig()} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Settings"
        title={isEdit ? 'Edit configuration' : 'Create configuration'}
        subtitle={isSaccos ? 'Equity shares, savings-based loans, fines, and financial-year rules.' : 'Shares, loans, fines, and financial-year rules.'}
        onBack={() => goToList(sourceConfig)}
        rightAction={
          <MobileIconButton
            icon={Save}
            label={isEdit ? 'Update configuration' : 'Create configuration'}
            variant="primary"
            disabled={saving}
            onPress={() => void saveConfig()}
          />
        }
      />

      {error ? <MobileStatusBadge status="Failed" label={error} tone="danger" /> : null}
      {notice ? <MobileToast title="Configuration saved" description={notice} tone="success" /> : null}
      {!canSubmit ? <MobileStatusBadge status="Read only" label="Your role can review this form but cannot save it." tone="info" /> : null}

      <MobileCard compact accent="blue">
        <View style={styles.heroRow}>
          <View style={styles.heroIcon}>
            <SlidersHorizontal color="#FFFFFF" size={22} strokeWidth={2.5} />
          </View>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold" numberOfLines={2}>
              {form.name || `New ${isSaccos ? 'SACCOS' : 'VIKOBA'} ruleset`}
            </MobileText>
            <MobileText variant="small" tone="secondary">
              {formatCurrency(previewShareValue)} per share · {formatNumber(previewLoanMultiplier)}x loan multiplier
            </MobileText>
          </View>
          <MobileStatusBadge status={isEdit ? 'Review' : 'New'} label={isEdit ? 'Editing' : 'New'} tone={isEdit ? 'review' : 'primary'} />
        </View>
      </MobileCard>

      <MobileFormSection title="Basic and equity share settings" description={isSaccos ? 'Define company-like equity shares used for ownership and dividends. Savings are captured separately.' : 'Name this ruleset and define the member share schedule.'}>
        <MobileTextInput
          label="Configuration name *"
          value={form.name}
          onChangeText={(value) => updateField('name', value)}
          placeholder="Standard Rules 2026"
          helperText="Use a unique name for this set of rules."
          error={submitted ? validation.errors.name : undefined}
          icon={FileText}
          disabled={saving}
        />
        <MobileAmountInput
          label="Share value"
          value={form.shareValue}
          onChangeText={(value) => updateField('shareValue', value)}
          helperText="The monetary value of one share."
          error={submitted ? validation.errors.shareValue : undefined}
          disabled={saving}
        />
        {!isSaccos ? (
          <MobileSelect
            label="Share purchase frequency"
            value={form.sharePurchaseFrequency}
            options={frequencyOptions}
            onChange={(value) => updateField('sharePurchaseFrequency', value)}
            disabled={saving}
          />
        ) : null}
        <MobileTextInput
          label="Minimum shares"
          value={form.minShares}
          onChangeText={(value) => updateField('minShares', value)}
          keyboardType="number-pad"
          helperText="Minimum shares a member must hold."
          error={submitted ? validation.errors.minShares : undefined}
          icon={Users}
          disabled={saving}
        />
      </MobileFormSection>

      <MobileFormSection title="Financial year" description="The year should span approximately one year.">
        <MobileTextInput
          label="Start date *"
          value={form.financialYearStartDate}
          onChangeText={(value) => updateField('financialYearStartDate', value)}
          placeholder="YYYY-MM-DD"
          helperText={`Preview: ${formatDate(form.financialYearStartDate)}`}
          error={submitted ? validation.errors.financialYear : undefined}
          icon={CalendarDays}
          disabled={saving}
        />
        <MobileTextInput
          label="End date *"
          value={form.financialYearEndDate}
          onChangeText={(value) => updateField('financialYearEndDate', value)}
          placeholder="YYYY-MM-DD"
          helperText={`Preview: ${formatDate(form.financialYearEndDate)}`}
          error={submitted ? validation.errors.financialYear : undefined}
          icon={CalendarDays}
          disabled={saving}
        />
      </MobileFormSection>

      <MobileFormSection title="Loan and penalty settings" description="These values drive loan eligibility, repayment, and overdue logic.">
        <MobileSelect label="Interest type" value={form.interestType} options={interestTypeOptions} onChange={(value) => updateField('interestType', value)} disabled={saving} />
        <MobileTextInput
          label="Loan multiplier *"
          value={form.loanMultiplier}
          onChangeText={(value) => updateField('loanMultiplier', value)}
          keyboardType="decimal-pad"
          helperText={isSaccos ? 'Max loan amount is paid savings multiplied by this value.' : 'Max loan amount is calculated against member shares.'}
          error={submitted ? validation.errors.loanMultiplier : undefined}
          icon={Landmark}
          disabled={saving}
        />
        <MobileTextInput label="Interest rate (%)" value={form.interestRate} onChangeText={(value) => updateField('interestRate', value)} keyboardType="decimal-pad" icon={Percent} disabled={saving} />
        <MobileTextInput label="Insurance rate (%)" value={form.insuranceRate} onChangeText={(value) => updateField('insuranceRate', value)} keyboardType="decimal-pad" icon={ShieldCheck} disabled={saving} />
        <MobileTextInput label="Penalty rate (%)" value={form.penaltyRate} onChangeText={(value) => updateField('penaltyRate', value)} keyboardType="decimal-pad" icon={AlertTriangle} disabled={saving} />
        <MobileTextInput label="Default installments" value={form.defaultInstallmentCount} onChangeText={(value) => updateField('defaultInstallmentCount', value)} keyboardType="number-pad" error={submitted ? validation.errors.defaultInstallmentCount : undefined} icon={Landmark} disabled={saving} />
        <MobileTextInput label="Grace period days" value={form.loanRepaymentGracePeriodDays} onChangeText={(value) => updateField('loanRepaymentGracePeriodDays', value)} keyboardType="number-pad" icon={CalendarDays} disabled={saving} />
        <MobileCheckboxRow label="Disburse full loan amount" description="Do not deduct upfront charges from the disbursed amount." checked={form.disburseGrossAmount} onChange={(checked) => updateField('disburseGrossAmount', checked)} disabled={saving} />
        <MobileCheckboxRow label="Deduct insurance on disbursement" description="Deduct only the insurance portion when money is disbursed." checked={form.deductInsuranceOnDisbursement} onChange={(checked) => updateField('deductInsuranceOnDisbursement', checked)} disabled={saving} />
      </MobileFormSection>

      <MobileFormSection title={isSaccos ? 'Fines and attendance' : 'Social contributions and fines'} description={isSaccos ? 'SACCOS savings never create social contributions. Configure only the remaining fine rules.' : 'Configure social contributions, late contribution fines, and attendance fines.'}>
        {!isSaccos ? <MobileAmountInput label="Social contribution amount" value={form.socialAmount} onChangeText={(value) => updateField('socialAmount', value)} disabled={saving} /> : null}
        {!isSaccos ? <MobileSelect label="Social contribution frequency" value={form.socialFrequency} options={frequencyOptions} onChange={(value) => updateField('socialFrequency', value)} disabled={saving} /> : null}
        <MobileSelect label="Late contribution fine type" value={form.fineType} options={fineTypeOptions} onChange={(value) => updateField('fineType', value)} disabled={saving} />
        {form.fineType === 'AMOUNT' ? (
          <MobileAmountInput label="Fine amount *" value={form.fineAmount} onChangeText={(value) => updateField('fineAmount', value)} error={submitted ? validation.errors.fineAmount : undefined} disabled={saving} />
        ) : (
          <MobileTextInput label="Fine percentage *" value={form.finePercentage} onChangeText={(value) => updateField('finePercentage', value)} keyboardType="decimal-pad" error={submitted ? validation.errors.finePercentage : undefined} icon={Percent} disabled={saving} />
        )}
        <MobileSelect label="Attendance fine type" value={form.attendanceFineType} options={fineTypeOptions} onChange={(value) => updateField('attendanceFineType', value)} disabled={saving} />
        {form.attendanceFineType === 'AMOUNT' ? (
          <MobileAmountInput label="Attendance fine amount *" value={form.attendanceFineAmount} onChangeText={(value) => updateField('attendanceFineAmount', value)} error={submitted ? validation.errors.attendanceFineAmount : undefined} disabled={saving} />
        ) : (
          <MobileTextInput label="Attendance fine percentage *" value={form.attendanceFinePercentage} onChangeText={(value) => updateField('attendanceFinePercentage', value)} keyboardType="decimal-pad" error={submitted ? validation.errors.attendanceFinePercentage : undefined} icon={Percent} disabled={saving} />
        )}
        <MobileSelect label="Attendance fine frequency" value={form.attendanceFineFrequency} options={frequencyOptions} onChange={(value) => updateField('attendanceFineFrequency', value)} disabled={saving} />
      </MobileFormSection>

      <MobileFormSection title="Dividends and policy rules" description="Additional rules used by year-end, dividends, emergency loans, and registration fee workflows.">
        <MobileSelect label="Dividend weighting" value={form.dividendsWeighting} options={dividendWeightingOptions} onChange={(value) => updateField('dividendsWeighting', value)} disabled={saving} />
        <MobileTextInput label="Dividend minimum months" value={form.dividendsMinMonthsSinceJoin} onChangeText={(value) => updateField('dividendsMinMonthsSinceJoin', value)} keyboardType="number-pad" icon={CalendarDays} disabled={saving} />
        {!isSaccos ? <MobileCheckboxRow label="Enable share inactivity rule" description="Flag members who miss too many share purchase periods." checked={form.shareInactivityEnabled} onChange={(checked) => updateField('shareInactivityEnabled', checked)} disabled={saving} /> : null}
        {!isSaccos ? <MobileTextInput label="Missed periods threshold" value={form.shareInactivityMissedPeriodsThreshold} onChangeText={(value) => updateField('shareInactivityMissedPeriodsThreshold', value)} keyboardType="number-pad" icon={CalendarDays} disabled={saving} /> : null}
        <MobileCheckboxRow label="Enable emergency loans" description="Allow emergency loan behavior for this configuration." checked={form.emergencyEnabled} onChange={(checked) => updateField('emergencyEnabled', checked)} disabled={saving} />
        <MobileTextInput label="Emergency interest rate (%)" value={form.emergencyInterestRate} onChangeText={(value) => updateField('emergencyInterestRate', value)} keyboardType="decimal-pad" icon={Percent} disabled={saving} />
        <MobileCheckboxRow label="Repay emergency loan in one term" checked={form.emergencyForceSingleTerm} onChange={(checked) => updateField('emergencyForceSingleTerm', checked)} disabled={saving} />
        <MobileCheckboxRow label="Enable registration fee" checked={form.registrationFeeEnabled} onChange={(checked) => updateField('registrationFeeEnabled', checked)} disabled={saving} />
        <MobileAmountInput label="Registration fee amount" value={form.registrationFeeAmount} onChangeText={(value) => updateField('registrationFeeAmount', value)} disabled={saving} />
      </MobileFormSection>

      <MobileFormSection title="Repayment rules" description="Optional amount ranges that override the default installment count.">
        {form.repaymentRules.length ? (
          <View style={styles.ruleList}>
            {form.repaymentRules.map((rule, index) => (
              <MobileCard key={`rule-${index}`} compact>
                <View style={styles.ruleHeader}>
                  <MobileText variant="body" weight="bold">
                    Rule {index + 1}
                  </MobileText>
                  <MobileButton label="Remove" icon={Trash2} variant="danger" size="sm" onPress={() => removeRepaymentRule(index)} disabled={saving} />
                </View>
                <MobileAmountInput label="Minimum amount" value={rule.minAmount} onChangeText={(value) => updateRepaymentRule(index, 'minAmount', value)} disabled={saving} />
                <MobileAmountInput label="Maximum amount" value={rule.maxAmount} onChangeText={(value) => updateRepaymentRule(index, 'maxAmount', value)} disabled={saving} />
                <MobileTextInput label="Months" value={rule.months} onChangeText={(value) => updateRepaymentRule(index, 'months', value)} keyboardType="number-pad" icon={CalendarDays} disabled={saving} />
                <MobileTextInput label="Installments" value={rule.installments} onChangeText={(value) => updateRepaymentRule(index, 'installments', value)} keyboardType="number-pad" icon={Landmark} disabled={saving} />
              </MobileCard>
            ))}
          </View>
        ) : (
          <MobileText variant="body" tone="secondary">
            No custom repayment rules. The default installment count applies.
          </MobileText>
        )}
        <MobileButton label="Add repayment rule" icon={Plus} variant="secondary" onPress={addRepaymentRule} disabled={saving} />
      </MobileFormSection>

      <MobileCard compact>
        <View style={styles.saveFooter}>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold">
              Ready to save?
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Validate every section before saving because these rules drive loans, fines, dividends, and year-end workflows.
            </MobileText>
          </View>
          <MobileStatusBadge status={validation.valid ? 'Ready' : 'Draft'} tone={validation.valid ? 'success' : 'review'} />
        </View>
        <MobileButton
          label={isEdit ? 'Update configuration' : 'Create configuration'}
          icon={Save}
          onPress={() => void saveConfig()}
          loading={saving}
          disabled={saving || !canSubmit}
          fullWidth
        />
      </MobileCard>
    </MobileScreen>
  );
}

function defaultForm(): GroupConfigFormState {
  const currentYear = new Date().getFullYear();
  return {
    name: '',
    shareValue: '1000',
    sharePurchaseFrequency: 'MONTHLY',
    minShares: '1',
    financialYearStartDate: `${currentYear}-07-01`,
    financialYearEndDate: `${currentYear + 1}-06-30`,
    socialAmount: '0',
    socialFrequency: 'MONTHLY',
    fineType: 'AMOUNT',
    fineAmount: '1000',
    finePercentage: '0',
    attendanceFineType: 'AMOUNT',
    attendanceFineAmount: '1000',
    attendanceFinePercentage: '0',
    attendanceFineFrequency: 'MONTHLY',
    interestType: 'SIMPLE',
    loanMultiplier: '3',
    interestRate: '10',
    insuranceRate: '0',
    penaltyRate: '10',
    defaultInstallmentCount: '1',
    loanRepaymentGracePeriodDays: '30',
    disburseGrossAmount: false,
    deductInsuranceOnDisbursement: false,
    dividendsWeighting: 'SHARE_COUNT',
    dividendsMinMonthsSinceJoin: '0',
    shareInactivityEnabled: true,
    shareInactivityMissedPeriodsThreshold: '3',
    emergencyEnabled: false,
    emergencyInterestRate: '3',
    emergencyForceSingleTerm: true,
    registrationFeeEnabled: false,
    registrationFeeAmount: '0',
    repaymentRules: [],
  };
}

function formFromConfig(config: GroupConfig): GroupConfigFormState {
  const defaults = defaultForm();
  return {
    ...defaults,
    name: String(config.name || ''),
    shareValue: stringNumber(config.shareValue, defaults.shareValue),
    sharePurchaseFrequency: String(config.sharePurchaseFrequency || defaults.sharePurchaseFrequency),
    minShares: stringNumber(config.minShares, defaults.minShares),
    financialYearStartDate: String(config.financialYearStartDate || defaults.financialYearStartDate),
    financialYearEndDate: String(config.financialYearEndDate || defaults.financialYearEndDate),
    socialAmount: stringNumber(config.socialAmount, defaults.socialAmount),
    socialFrequency: String(config.socialFrequency || defaults.socialFrequency),
    fineType: String(config.fineType || defaults.fineType),
    fineAmount: stringNumber(config.fineAmount, defaults.fineAmount),
    finePercentage: stringNumber(config.finePercentage, defaults.finePercentage),
    attendanceFineType: String(config.attendanceFineType || defaults.attendanceFineType),
    attendanceFineAmount: stringNumber(config.attendanceFineAmount, defaults.attendanceFineAmount),
    attendanceFinePercentage: stringNumber(config.attendanceFinePercentage, defaults.attendanceFinePercentage),
    attendanceFineFrequency: String(config.attendanceFineFrequency || defaults.attendanceFineFrequency),
    interestType: String(config.interestType || defaults.interestType),
    loanMultiplier: stringNumber(config.loanMultiplier, defaults.loanMultiplier),
    interestRate: stringNumber(config.interestRate ?? config.loanInterestRate, defaults.interestRate),
    insuranceRate: stringNumber(config.insuranceRate, defaults.insuranceRate),
    penaltyRate: stringNumber(config.penaltyRate, defaults.penaltyRate),
    defaultInstallmentCount: stringNumber(config.defaultInstallmentCount, defaults.defaultInstallmentCount),
    loanRepaymentGracePeriodDays: stringNumber(config.loanRepaymentGracePeriodDays, defaults.loanRepaymentGracePeriodDays),
    disburseGrossAmount: Boolean(config.disburseGrossAmount),
    deductInsuranceOnDisbursement: Boolean(config.deductInsuranceOnDisbursement),
    dividendsWeighting: String(config.additionalRules?.['dividends.weighting'] || defaults.dividendsWeighting),
    dividendsMinMonthsSinceJoin: stringNumber(config.additionalRules?.['dividends.minMonthsSinceJoin'], defaults.dividendsMinMonthsSinceJoin),
    shareInactivityEnabled: String(config.additionalRules?.['shares.inactivity.enabled'] ?? defaults.shareInactivityEnabled) === 'true',
    shareInactivityMissedPeriodsThreshold: stringNumber(config.additionalRules?.['shares.inactivity.missedPeriodsThreshold'], defaults.shareInactivityMissedPeriodsThreshold),
    emergencyEnabled: String(config.additionalRules?.['emergency.enabled'] ?? defaults.emergencyEnabled) === 'true',
    emergencyInterestRate: stringNumber(config.additionalRules?.['emergency.interestRate'], defaults.emergencyInterestRate),
    emergencyForceSingleTerm: String(config.additionalRules?.['emergency.forceSingleTerm'] ?? defaults.emergencyForceSingleTerm) === 'true',
    registrationFeeEnabled: String(config.additionalRules?.['registration.fee.enabled'] ?? defaults.registrationFeeEnabled) === 'true',
    registrationFeeAmount: stringNumber(config.additionalRules?.['registration.fee.amount'], defaults.registrationFeeAmount),
    repaymentRules: (config.repaymentRules || []).map((rule) => ({
      minAmount: stringNumber(rule.minAmount, '0'),
      maxAmount: stringNumber(rule.maxAmount, '0'),
      months: stringNumber(rule.months, '1'),
      installments: stringNumber(rule.installments, '1'),
    })),
  };
}

function buildPayload(form: GroupConfigFormState, associationId: string, isSaccos: boolean): GroupConfigPayload {
  const fineType = form.fineType || 'AMOUNT';
  const attendanceFineType = form.attendanceFineType || 'AMOUNT';

  return {
    name: form.name.trim(),
    associationId,
    shareValue: toNumber(form.shareValue),
    sharePurchaseFrequency: isSaccos ? undefined : form.sharePurchaseFrequency,
    minShares: toInt(form.minShares),
    interestRate: toNumber(form.interestRate),
    insuranceRate: toNumber(form.insuranceRate),
    loanMultiplier: toNumber(form.loanMultiplier),
    defaultInstallmentCount: Math.max(1, toInt(form.defaultInstallmentCount)),
    loanRepaymentGracePeriodDays: Math.max(0, toInt(form.loanRepaymentGracePeriodDays)),
    socialAmount: isSaccos ? 0 : toNumber(form.socialAmount),
    socialFrequency: isSaccos ? undefined : form.socialFrequency,
    fineType,
    fineAmount: fineType === 'AMOUNT' ? toNumber(form.fineAmount) : undefined,
    finePercentage: fineType === 'PERCENTAGE' ? toNumber(form.finePercentage) : undefined,
    attendanceFineType,
    attendanceFineAmount: attendanceFineType === 'AMOUNT' ? toNumber(form.attendanceFineAmount) : undefined,
    attendanceFinePercentage: attendanceFineType === 'PERCENTAGE' ? toNumber(form.attendanceFinePercentage) : undefined,
    attendanceFineFrequency: form.attendanceFineFrequency,
    penaltyRate: toNumber(form.penaltyRate),
    financialYearStartDate: form.financialYearStartDate || undefined,
    financialYearEndDate: form.financialYearEndDate || undefined,
    repaymentRules: form.repaymentRules
      .map((rule) => ({
        minAmount: toNumber(rule.minAmount),
        maxAmount: toNumber(rule.maxAmount),
        months: Math.max(1, toInt(rule.months)),
        installments: Math.max(1, toInt(rule.installments)),
      }))
      .filter((rule) => rule.months > 0 && rule.installments > 0),
    additionalRules: {
      'dividends.weighting': form.dividendsWeighting || 'SHARE_COUNT',
      'dividends.minMonthsSinceJoin': Math.max(0, toInt(form.dividendsMinMonthsSinceJoin)),
      'emergency.enabled': String(form.emergencyEnabled),
      'emergency.interestRate': Math.max(0, toNumber(form.emergencyInterestRate)),
      'emergency.forceSingleTerm': String(form.emergencyForceSingleTerm),
      'emergency.capRule': 'ONE_TERM_OF_LARGEST_LOAN',
      'registration.fee.enabled': String(form.registrationFeeEnabled),
      'registration.fee.amount': Math.max(0, toNumber(form.registrationFeeAmount)),
      'shares.inactivity.enabled': String(isSaccos ? false : form.shareInactivityEnabled),
      'shares.inactivity.missedPeriodsThreshold': Math.max(1, toInt(form.shareInactivityMissedPeriodsThreshold)),
    },
    interestType: form.interestType || 'SIMPLE',
    disburseGrossAmount: form.disburseGrossAmount,
    deductInsuranceOnDisbursement: form.deductInsuranceOnDisbursement,
  };
}

function validateForm(form: GroupConfigFormState, associationId?: string | null) {
  const errors: Record<string, string> = {};
  if (!associationId) errors.association = 'Association context is required.';
  if (!form.name.trim()) errors.name = 'Configuration name is required.';
  if (toNumber(form.shareValue) < 0) errors.shareValue = 'Share value cannot be negative.';
  if (toInt(form.minShares) < 0) errors.minShares = 'Minimum shares cannot be negative.';
  if (toNumber(form.loanMultiplier) <= 0) errors.loanMultiplier = 'Loan multiplier must be greater than zero.';
  if (toInt(form.defaultInstallmentCount) <= 0) errors.defaultInstallmentCount = 'Default installments must be greater than zero.';

  const dateError = validateFinancialYear(form.financialYearStartDate, form.financialYearEndDate);
  if (dateError) errors.financialYear = dateError;

  if (form.fineType === 'AMOUNT' && toNumber(form.fineAmount) <= 0) errors.fineAmount = 'Fine amount must be greater than zero.';
  if (form.fineType === 'PERCENTAGE' && toNumber(form.finePercentage) <= 0) errors.finePercentage = 'Fine percentage must be greater than zero.';
  if (form.attendanceFineType === 'AMOUNT' && toNumber(form.attendanceFineAmount) <= 0) {
    errors.attendanceFineAmount = 'Attendance fine amount must be greater than zero.';
  }
  if (form.attendanceFineType === 'PERCENTAGE' && toNumber(form.attendanceFinePercentage) <= 0) {
    errors.attendanceFinePercentage = 'Attendance fine percentage must be greater than zero.';
  }

  form.repaymentRules.forEach((rule, index) => {
    if (toNumber(rule.minAmount) > toNumber(rule.maxAmount)) errors[`repayment-${index}`] = 'Minimum amount cannot exceed maximum amount.';
    if (toInt(rule.months) <= 0 || toInt(rule.installments) <= 0) errors[`repayment-${index}`] = 'Months and installments must be greater than zero.';
  });

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

function validateFinancialYear(startValue: string, endValue: string) {
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (!startValue || !endValue || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Use valid YYYY-MM-DD financial-year dates.';
  if (start >= end) return 'Start date must be before end date.';
  const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / 86_400_000);
  if (diffDays < 360 || diffDays > 370) return 'Financial year must span approximately one year.';
  return null;
}

function stringNumber(value: unknown, fallback = '0') {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? String(parsed) : fallback;
}

function toNumber(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[,\s]/g, '').replace(/^TZS/i, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toInt(value: unknown) {
  return Math.trunc(toNumber(value));
}

function shortId(value?: string | null) {
  if (!value) return 'No ID';
  return value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

function hasLoanConfigManagePermission(user: { permissions?: string[]; roles?: string[]; associationRole?: string } | null) {
  const values = [...(user?.permissions || []), ...(user?.roles || []), user?.associationRole || ''].map((value) => value.toLowerCase());
  return values.some((value) =>
    [
      'loans.manage',
      'loans_manage',
      'loans.create',
      'loans.approve',
      'association_admin',
      'admin',
      'chairperson',
      'treasurer',
      'secretary',
    ].includes(value),
  );
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
    backgroundColor: '#2563EB',
  },
  flex: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  ruleList: {
    gap: 12,
  },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  saveFooter: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
});
