import { router, useLocalSearchParams } from 'expo-router';
import { Clock3, Layers3, Search } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import {
  MobileButton,
  MobileCard,
  MobileEmptyState,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileText,
} from '@/components/mobile';
import { canAccessMobileRoute, isMobileAccessLoading } from '@/navigation/mobile-access';
import {
  getRouteById,
  moduleCatalog,
  roleLabels,
} from '@/navigation/route-registry';
import { useMobileAccess } from '@/navigation/use-mobile-access';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import AssociationMembersScreen from '@/screens/AssociationMembersScreen';
import HomeDashboardScreen from '@/screens/HomeDashboardScreen';
import MemberHomeScreen from '@/screens/MemberHomeScreen';
import MobileMemberProfileScreen from '@/screens/MobileMemberProfileScreen';
import MobileMemberSelfEditScreen from '@/screens/MobileMemberSelfEditScreen';
import MobileMemberSecurityScreen from '@/screens/MobileMemberSecurityScreen';
import MobileMemberRegistrationCompleteScreen from '@/screens/MobileMemberRegistrationCompleteScreen';
import MobileMemberRegistrationStatusScreen from '@/screens/MobileMemberRegistrationStatusScreen';
import MobileMemberDeductionCalendarScreen from '@/screens/MobileMemberDeductionCalendarScreen';
import MobileMemberDeductionsScreen from '@/screens/MobileMemberDeductionsScreen';
import MobileMemberInvoiceDetailScreen from '@/screens/MobileMemberInvoiceDetailScreen';
import MobileMemberPortalInvoicesScreen from '@/screens/MobileMemberPortalInvoicesScreen';
import MobileMemberLoanDetailScreen from '@/screens/MobileMemberLoanDetailScreen';
import MobileMemberLoansScreen from '@/screens/MobileMemberLoansScreen';
import MobileMemberRevenueTransactionDetailScreen from '@/screens/MobileMemberRevenueTransactionDetailScreen';
import MobileMemberRevenueTransactionCalendarScreen from '@/screens/MobileMemberRevenueTransactionCalendarScreen';
import MobileMemberRevenueTransactionsScreen from '@/screens/MobileMemberRevenueTransactionsScreen';
import MobileMemberPackageSubscribeScreen from '@/screens/MobileMemberPackageSubscribeScreen';
import MobileMemberPackagesScreen from '@/screens/MobileMemberPackagesScreen';
import MobileMemberEventsScreen from '@/screens/MobileMemberEventsScreen';
import MobileMemberNewsScreen from '@/screens/MobileMemberNewsScreen';
import MobileMemberJobPostsScreen from '@/screens/MobileMemberJobPostsScreen';
import MobileMemberTendersScreen from '@/screens/MobileMemberTendersScreen';
import MobileMemberCertificatesScreen from '@/screens/MobileMemberCertificatesScreen';
import MobileMemberDirectoryScreen from '@/screens/MobileMemberDirectoryScreen';
import MobileMemberNotificationsScreen from '@/screens/MobileMemberNotificationsScreen';
import MobileMemberSubscriptionHistoryScreen from '@/screens/MobileMemberSubscriptionHistoryScreen';
import MobileMemberSubscriptionScreen from '@/screens/MobileMemberSubscriptionScreen';
import MobileMemberWalletScreen from '@/screens/MobileMemberWalletScreen';
import MobileMemberVotingScreen from '@/screens/MobileMemberVotingScreen';
import MobileAttendanceScreen from '@/screens/MobileAttendanceScreen';
import MobileAllAssociationsDashboardScreen from '@/screens/MobileAllAssociationsDashboardScreen';
import MobileAssociationLoansScreen from '@/screens/MobileAssociationLoansScreen';
import MobileAssociationProfileScreen from '@/screens/MobileAssociationProfileScreen';
import MobileAssociationProfileEditScreen from '@/screens/MobileAssociationProfileEditScreen';
import MobileAssociationInvoiceDetailScreen from '@/screens/MobileAssociationInvoiceDetailScreen';
import MobileAssociationInvoicesScreen from '@/screens/MobileAssociationInvoicesScreen';
import MobileAssociationConfigOverviewScreen from '@/screens/MobileAssociationConfigOverviewScreen';
import MobileAssociationConfigEditScreen from '@/screens/MobileAssociationConfigEditScreen';
import MobileAssociationPackagesScreen from '@/screens/MobileAssociationPackagesScreen';
import MobileAssociationSubscriptionsScreen from '@/screens/MobileAssociationSubscriptionsScreen';
import MobileAssociationWalletScreen from '@/screens/MobileAssociationWalletScreen';
import MobileBankAccountsScreen from '@/screens/MobileBankAccountsScreen';
import MobileBillingEntitlementsScreen from '@/screens/MobileBillingEntitlementsScreen';
import MobileBusinessTypesScreen from '@/screens/MobileBusinessTypesScreen';
import MobileClientsScreen from '@/screens/MobileClientsScreen';
import MobileCrmCampaignsScreen from '@/screens/MobileCrmCampaignsScreen';
import MobileDisbursementsScreen from '@/screens/MobileDisbursementsScreen';
import MobileDocumentCategoriesScreen from '@/screens/MobileDocumentCategoriesScreen';
import MobileEventFormScreen from '@/screens/MobileEventFormScreen';
import MobileEventsManageScreen from '@/screens/MobileEventsManageScreen';
import MobileExpenseCategoriesScreen from '@/screens/MobileExpenseCategoriesScreen';
import MobileExpenseDetailScreen from '@/screens/MobileExpenseDetailScreen';
import MobileExpenseFormScreen from '@/screens/MobileExpenseFormScreen';
import MobileExpensesManageScreen from '@/screens/MobileExpensesManageScreen';
import MobileLoanBatchUploadScreen from '@/screens/MobileLoanBatchUploadScreen';
import MobileLoanExportScreen from '@/screens/MobileLoanExportScreen';
import MobileLoanRequestScreen from '@/screens/MobileLoanRequestScreen';
import MobileWithdrawalApprovalsScreen from '@/screens/MobileWithdrawalApprovalsScreen';
import MobileMemberDocumentsScreen from '@/screens/MobileMemberDocumentsScreen';
import MobileMemberFormScreen from '@/screens/MobileMemberFormScreen';
import MobileMemberDetailScreen from '@/screens/MobileMemberDetailScreen';
import MobileNotificationPolicyScreen from '@/screens/MobileNotificationPolicyScreen';
import MobileMemberInvoicesScreen from '@/screens/MobileMemberInvoicesScreen';
import MobileUnionDeductionUploadScreen from '@/screens/MobileUnionDeductionUploadScreen';
import MobileMembershipNumberScreen from '@/screens/MobileMembershipNumberScreen';
import MobileMembersVoiceScreen from '@/screens/MobileMembersVoiceScreen';
import MobileMemberImportScreen from '@/screens/MobileMemberImportScreen';
import MobileMemberStatementDetailScreen from '@/screens/MobileMemberStatementDetailScreen';
import MobileMemberStatementsScreen from '@/screens/MobileMemberStatementsScreen';
import MobileMyAssociationsScreen from '@/screens/MobileMyAssociationsScreen';
import MobileOfflineSupportScreen from '@/screens/MobileOfflineSupportScreen';
import MobileProfilePictureScreen from '@/screens/MobileProfilePictureScreen';
import MobileRegistrationIntegrationScreen from '@/screens/MobileRegistrationIntegrationScreen';
import MobileReminderConfigScreen from '@/screens/MobileReminderConfigScreen';
import MobileRolesPermissionsScreen from '@/screens/MobileRolesPermissionsScreen';
import MobileSmsSenderConfigScreen from '@/screens/MobileSmsSenderConfigScreen';
import MobileUnionSettingsScreen from '@/screens/MobileUnionSettingsScreen';
import MobileUnionDashboardScreen from '@/screens/MobileUnionDashboardScreen';
import MobileAssociationUsersScreen from '@/screens/MobileAssociationUsersScreen';
import MobileAssociationUserCreateScreen from '@/screens/MobileAssociationUserCreateScreen';
import MobileDividendDistributionScreen from '@/screens/MobileDividendDistributionScreen';
import MobileFineManagementScreen from '@/screens/MobileFineManagementScreen';
import MobileGenericPaymentScreen from '@/screens/MobileGenericPaymentScreen';
import MobileGroupConfigDetailScreen from '@/screens/MobileGroupConfigDetailScreen';
import MobileGroupConfigFormScreen from '@/screens/MobileGroupConfigFormScreen';
import MobileGroupConfigScreen from '@/screens/MobileGroupConfigScreen';
import MobileGovernanceComplianceScreen from '@/screens/MobileGovernanceComplianceScreen';
import MobileGovernanceDocumentsScreen from '@/screens/MobileGovernanceDocumentsScreen';
import MobileGovernanceElectionsScreen from '@/screens/MobileGovernanceElectionsScreen';
import MobileGovernanceStructureScreen from '@/screens/MobileGovernanceStructureScreen';
import MobileAssociationStatisticsReportScreen from '@/screens/MobileAssociationStatisticsReportScreen';
import MobileIncomeStatementReportScreen from '@/screens/MobileIncomeStatementReportScreen';
import MobilePaymentMagicLinkScreen from '@/screens/MobilePaymentMagicLinkScreen';
import MobilePaymentReconciliationScreen from '@/screens/MobilePaymentReconciliationScreen';
import MobilePostFormScreen from '@/screens/MobilePostFormScreen';
import MobilePostsManageScreen from '@/screens/MobilePostsManageScreen';
import MobileRecordAttendanceScreen from '@/screens/MobileRecordAttendanceScreen';
import MobileRevenueTransactionCreateScreen from '@/screens/MobileRevenueTransactionCreateScreen';
import MobileRevenueTransactionDetailScreen from '@/screens/MobileRevenueTransactionDetailScreen';
import MobileRevenueTransactionBulkScreen from '@/screens/MobileRevenueTransactionBulkScreen';
import MobileRevenueTransactionBulkImportScreen from '@/screens/MobileRevenueTransactionBulkImportScreen';
import MobileRevenueTransactionCalendarScreen from '@/screens/MobileRevenueTransactionCalendarScreen';
import MobileRevenueTransactionExportScreen from '@/screens/MobileRevenueTransactionExportScreen';
import MobileRevenueTransactionImportScreen from '@/screens/MobileRevenueTransactionImportScreen';
import MobileRevenueTransactionMemberHistoryScreen from '@/screens/MobileRevenueTransactionMemberHistoryScreen';
import MobileRevenueCategoriesScreen from '@/screens/MobileRevenueCategoriesScreen';
import MobileRevenueDetailScreen from '@/screens/MobileRevenueDetailScreen';
import MobileRevenueFormScreen from '@/screens/MobileRevenueFormScreen';
import MobileRevenueManageScreen from '@/screens/MobileRevenueManageScreen';
import MobileRevenueTrackingScreen from '@/screens/MobileRevenueTrackingScreen';
import MobileRevenueTransactionsScreen from '@/screens/MobileRevenueTransactionsScreen';
import MobileRevenueTransactionsOverdueScreen from '@/screens/MobileRevenueTransactionsOverdueScreen';
import MobileScheduleFineScreen from '@/screens/MobileScheduleFineScreen';
import MobileShareDistributionScreen from '@/screens/MobileShareDistributionScreen';
import MobileShareFinesScreen from '@/screens/MobileShareFinesScreen';
import MobileShareReconciliationScreen from '@/screens/MobileShareReconciliationScreen';
import MobileSmsReportScreen from '@/screens/MobileSmsReportScreen';
import MobileSaccosSavingsCaptureScreen from '@/screens/MobileSaccosSavingsCaptureScreen';
import MobileSaccosSavingsReportScreen from '@/screens/MobileSaccosSavingsReportScreen';
import MobileSubscribeMemberScreen from '@/screens/MobileSubscribeMemberScreen';
import MobileSystemAdminAssociationCreateScreen from '@/screens/MobileSystemAdminAssociationCreateScreen';
import MobileSystemAdminAssociationsScreen from '@/screens/MobileSystemAdminAssociationsScreen';
import MobileSystemAdminAuditScreen from '@/screens/MobileSystemAdminAuditScreen';
import MobileSystemAdminBillingScreen from '@/screens/MobileSystemAdminBillingScreen';
import MobileSystemAdminClientsScreen from '@/screens/MobileSystemAdminClientsScreen';
import MobileSystemAdminDashboardScreen from '@/screens/MobileSystemAdminDashboardScreen';
import MobileSystemAdminDisbursementsScreen from '@/screens/MobileSystemAdminDisbursementsScreen';
import MobileSystemAdminFinanceScreen from '@/screens/MobileSystemAdminFinanceScreen';
import MobileSystemAdminInvoicesScreen from '@/screens/MobileSystemAdminInvoicesScreen';
import MobileSystemAdminJobsScreen from '@/screens/MobileSystemAdminJobsScreen';
import MobileSystemAdminMessagingScreen from '@/screens/MobileSystemAdminMessagingScreen';
import MobileSystemAdminPasswordResetScreen from '@/screens/MobileSystemAdminPasswordResetScreen';
import MobileSystemAdminImpersonationHandoffScreen from '@/screens/MobileSystemAdminImpersonationHandoffScreen';
import MobileSystemAdminSystemScreen from '@/screens/MobileSystemAdminSystemScreen';
import MobileSystemAdminWithdrawalsScreen from '@/screens/MobileSystemAdminWithdrawalsScreen';
import MobileUnionReportsScreen from '@/screens/MobileUnionReportsScreen';
import MobileVefdReceiptsScreen from '@/screens/MobileVefdReceiptsScreen';
import MobileYearEndCloseScreen from '@/screens/MobileYearEndCloseScreen';
import { useNaneTheme } from '@/theme/tokens';

export default function RoutePreviewScreen() {
  const params = useLocalSearchParams();
  const route = getRouteById(params.routeId);
  const access = useMobileAccess();
  const theme = useNaneTheme();

  if (!route) {
    return (
      <MobileScreen>
        <MobilePageHeader title="Page not found" eyebrow="Nane Mobile" onBack={() => router.back()} />
        <MobileEmptyState
          title="We could not open that page"
          description="The page may have moved or may not be available in this workspace."
          actionLabel="Find another task"
          onAction={() => router.push('/search' as never)}
        />
      </MobileScreen>
    );
  }

  if (isMobileAccessLoading(access)) {
    return <MobilePageLoadingState kind="dashboard" message="Checking access" />;
  }

  const accessDecision = canAccessMobileRoute(route, access);
  if (!accessDecision.allowed) {
    return (
      <AccessDeniedScreen
        title={accessDecision.title || 'Access unavailable'}
        description={accessDecision.description || 'This page is not available for your role or association plan.'}
        actionLabel="Back to Work"
        onAction={() => router.replace('/work' as never)}
      />
    );
  }

  if (route.path === '/associations/members') {
    return <AssociationMembersScreen />;
  }

  if (route.path === '/associations/all-dashboard') {
    const associationId = Array.isArray(params.associationId) ? params.associationId[0] : params.associationId;
    const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    return <MobileAllAssociationsDashboardScreen key={`all-dashboard-${associationId || 'all'}-${mode || 'list'}`} initialAssociationId={associationId} initialMode={mode === 'detail' ? 'detail' : undefined} />;
  }

  if (route.path === '/associations/dashboard') {
    return <HomeDashboardScreen />;
  }

  if (route.path === '/associations/dashboard/union') {
    const tab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
    const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    const deductionId = Array.isArray(params.deductionId) ? params.deductionId[0] : params.deductionId;
    const initialTab = tab === 'overview' || tab === 'deductions' || tab === 'contributors' ? tab : undefined;
    return <MobileUnionDashboardScreen key={`union-dashboard-${initialTab || 'overview'}-${mode || 'view'}-${deductionId || 'auto'}`} initialTab={initialTab} initialMode={mode === 'detail' ? 'detail' : undefined} initialDeductionId={deductionId} />;
  }

  if (route.path === '/member/dashboard') {
    return <MemberHomeScreen />;
  }

  if (route.path === '/member/profile') {
    const tab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
    const initialTab = tab === 'contact' || tab === 'preferences' || tab === 'overview' ? tab : undefined;
    return <MobileMemberProfileScreen key={`member-profile-${initialTab || 'overview'}`} initialTab={initialTab} />;
  }

  if (route.path === '/member/:memberId/edit') {
    const memberId = Array.isArray(params.memberId) ? params.memberId[0] : params.memberId;
    return <MobileMemberSelfEditScreen memberId={memberId} />;
  }

  if (route.path === '/member/profile/security') {
    return <MobileMemberSecurityScreen />;
  }

  if (route.path === '/member/registration/complete') {
    return <MobileMemberRegistrationCompleteScreen />;
  }

  if (route.path === '/member/registration/status/:memberId') {
    const memberId = Array.isArray(params.memberId) ? params.memberId[0] : params.memberId;
    return <MobileMemberRegistrationStatusScreen memberId={memberId} />;
  }

  if (route.path === '/member/revenue-transactions') {
    return <MobileMemberRevenueTransactionsScreen />;
  }

  if (route.path === '/member/revenue-transactions/:id') {
    const transactionId = Array.isArray(params.id) ? params.id[0] : params.id;
    return <MobileMemberRevenueTransactionDetailScreen transactionId={transactionId} />;
  }

  if (route.path === '/member/revenue-transactions/calender') {
    return <MobileMemberRevenueTransactionCalendarScreen />;
  }

  if (route.path === '/member/deductions') {
    return <MobileMemberDeductionsScreen />;
  }

  if (route.path === '/member/deductions/calendar') {
    return <MobileMemberDeductionCalendarScreen />;
  }

  if (route.path === '/member/loans') {
    return <MobileMemberLoansScreen />;
  }

  if (route.path === '/member/loans/:loanId') {
    const loanId = Array.isArray(params.loanId) ? params.loanId[0] : params.loanId;
    return <MobileMemberLoanDetailScreen loanId={loanId} />;
  }

  if (route.path === '/member/loans/request') {
    return <MobileLoanRequestScreen mode="member" />;
  }

  if (route.path === '/member/invoices') {
    return <MobileMemberPortalInvoicesScreen />;
  }

  if (route.path === '/member/invoices/:id') {
    const invoiceId = Array.isArray(params.invoiceId) ? params.invoiceId[0] : params.invoiceId;
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    return <MobileMemberInvoiceDetailScreen invoiceId={invoiceId || id} />;
  }

  if (route.path === '/member/pay/generic') {
    return <MobileGenericPaymentScreen mode="member" />;
  }

  if (route.path === '/member/wallet') {
    return <MobileMemberWalletScreen />;
  }

  if (route.path === '/member/subscription') {
    return <MobileMemberSubscriptionScreen />;
  }

  if (route.path === '/member/subscription-history') {
    return <MobileMemberSubscriptionHistoryScreen />;
  }

  if (route.path === '/member/packages') {
    return <MobileMemberPackagesScreen />;
  }

  if (route.path === '/member/packages/subscribe/:packageId') {
    const packageId = Array.isArray(params.packageId) ? params.packageId[0] : params.packageId;
    return <MobileMemberPackageSubscribeScreen packageId={packageId} />;
  }

  if (route.path === '/member/events') {
    return <MobileMemberEventsScreen />;
  }

  if (route.path === '/member/news') {
    return <MobileMemberNewsScreen />;
  }

  if (route.path === '/member/job-posts') {
    return <MobileMemberJobPostsScreen />;
  }

  if (route.path === '/member/tenders') {
    return <MobileMemberTendersScreen />;
  }

  if (route.path === '/member/certificates') {
    return <MobileMemberCertificatesScreen />;
  }

  if (route.path === '/member/directory') {
    return <MobileMemberDirectoryScreen />;
  }

  if (route.path === '/member/notifications') {
    return <MobileMemberNotificationsScreen />;
  }

  if (route.path === '/member/offline') {
    const tab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
    const capability = Array.isArray(params.capability) ? params.capability[0] : params.capability;
    return <MobileOfflineSupportScreen key={`member-offline-support-${tab || 'overview'}-${capability || 'none'}`} audience="member" />;
  }

  if (route.path === '/member/upload-document/:memberId/documents') {
    const memberId = Array.isArray(params.memberId) ? params.memberId[0] : params.memberId;
    return <MobileMemberDocumentsScreen memberId={memberId} audience="member" />;
  }

  if (route.path === '/member/voting') {
    return <MobileMemberVotingScreen />;
  }

  if (route.path === '/admin/dashboard' || route.path === '/admin/reports' || route.path === '/admin/reports/overview') {
    const associationId = Array.isArray(params.associationId) ? params.associationId[0] : params.associationId;
    const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    return (
      <MobileSystemAdminDashboardScreen
        key={`system-admin-dashboard-${route.path}-${associationId || 'auto'}-${mode || 'list'}`}
        initialAssociationId={associationId}
        initialMode={mode === 'detail' ? 'detail' : undefined}
      />
    );
  }

  if (route.path === '/admin/associations') {
    const associationId = Array.isArray(params.associationId) ? params.associationId[0] : params.associationId;
    const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    return (
      <MobileSystemAdminAssociationsScreen
        key={`system-admin-associations-${associationId || 'auto'}-${mode || 'list'}`}
        initialAssociationId={associationId}
        initialMode={mode === 'detail' || mode === 'disable' ? mode : undefined}
      />
    );
  }

  if (route.path === '/admin/associations/new') {
    const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    const initialMode = mode === 'sample' || mode === 'confirm' ? mode : undefined;
    return <MobileSystemAdminAssociationCreateScreen key={`system-admin-association-create-${initialMode || 'blank'}`} initialMode={initialMode} />;
  }

  if (route.path === '/admin/clients') {
    const associationId = Array.isArray(params.associationId) ? params.associationId[0] : params.associationId;
    const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    const initialMode = mode === 'invoice' || mode === 'detail' ? mode : undefined;
    return (
      <MobileSystemAdminClientsScreen
        key={`system-admin-clients-${associationId || 'auto'}-${initialMode || 'list'}`}
        initialAssociationId={associationId}
        initialMode={initialMode}
      />
    );
  }

  if (route.path === '/admin/billing') {
    const associationId = Array.isArray(params.associationId) ? params.associationId[0] : params.associationId;
    const tab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
    const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    const requestedTab = ['plans', 'features', 'access', 'subscriptions', 'usage', 'invoices', 'lifecycle', 'reports'].includes(String(tab))
      ? (tab as 'plans' | 'features' | 'access' | 'subscriptions' | 'usage' | 'invoices' | 'lifecycle' | 'reports')
      : undefined;
    const initialMode = ['plan', 'feature', 'price', 'subscription', 'override', 'invoice', 'lifecycle', 'backfill'].includes(String(mode))
      ? (mode as 'plan' | 'feature' | 'price' | 'subscription' | 'override' | 'invoice' | 'lifecycle' | 'backfill')
      : undefined;
    const initialTab = requestedTab || (initialMode === 'invoice' ? 'invoices' : initialMode === 'lifecycle' ? 'lifecycle' : initialMode === 'backfill' ? 'reports' : undefined);
    return (
      <MobileSystemAdminBillingScreen
        key={`system-admin-billing-${initialTab || 'plans'}-${initialMode || 'list'}-${associationId || 'all'}`}
        initialTab={initialTab}
        initialMode={initialMode}
        initialAssociationId={associationId}
      />
    );
  }

  if (route.path === '/admin/disbursements') {
    const status = Array.isArray(params.status) ? params.status[0] : params.status;
    const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    const initialStatus = ['PENDING', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED', 'ALL'].includes(String(status))
      ? (status as 'PENDING' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'ALL')
      : undefined;
    const initialMode = ['detail', 'approve', 'reject', 'complete', 'fail'].includes(String(mode))
      ? (mode as 'detail' | 'approve' | 'reject' | 'complete' | 'fail')
      : undefined;
    return (
      <MobileSystemAdminDisbursementsScreen
        key={`system-admin-disbursements-${initialStatus || 'pending'}-${initialMode || 'list'}`}
        initialStatus={initialStatus}
        initialMode={initialMode}
      />
    );
  }

  if (route.path === '/admin/finance') {
    const status = Array.isArray(params.status) ? params.status[0] : params.status;
    const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    const initialStatus = ['ALL', 'PAID', 'PENDING', 'OVERDUE', 'FAILED'].includes(String(status))
      ? (status as 'ALL' | 'PAID' | 'PENDING' | 'OVERDUE' | 'FAILED')
      : undefined;
    const initialMode = mode === 'detail' || mode === 'filters' ? mode : undefined;
    return (
      <MobileSystemAdminFinanceScreen
        key={`system-admin-finance-${initialStatus || 'all'}-${initialMode || 'list'}`}
        initialStatus={initialStatus}
        initialMode={initialMode}
      />
    );
  }

  if (route.path === '/admin/finance/withdrawals') {
    const status = Array.isArray(params.status) ? params.status[0] : params.status;
    const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    const initialStatus = ['ALL', 'PENDING', 'APPROVED', 'COMPLETED', 'REJECTED'].includes(String(status))
      ? (status as 'ALL' | 'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED')
      : undefined;
    const initialMode = ['detail', 'approve', 'reject', 'complete', 'filters'].includes(String(mode))
      ? (mode as 'detail' | 'approve' | 'reject' | 'complete' | 'filters')
      : undefined;
    return (
      <MobileSystemAdminWithdrawalsScreen
        key={`system-admin-withdrawals-${initialStatus || 'all'}-${initialMode || 'list'}`}
        initialStatus={initialStatus}
        initialMode={initialMode}
      />
    );
  }

  if (route.path === '/admin/invoices') {
    const status = Array.isArray(params.status) ? params.status[0] : params.status;
    const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    const associationId = Array.isArray(params.associationId) ? params.associationId[0] : params.associationId;
    const initialStatus = ['ALL', 'ISSUED', 'PAID', 'OVERDUE', 'DRAFT', 'CANCELLED'].includes(String(status))
      ? (status as 'ALL' | 'ISSUED' | 'PAID' | 'OVERDUE' | 'DRAFT' | 'CANCELLED')
      : undefined;
    const initialMode = ['detail', 'filters', 'generate', 'paid', 'unpaid'].includes(String(mode))
      ? (mode as 'detail' | 'filters' | 'generate' | 'paid' | 'unpaid')
      : undefined;
    return (
      <MobileSystemAdminInvoicesScreen
        key={`system-admin-invoices-${initialStatus || 'all'}-${initialMode || 'list'}-${associationId || 'all'}`}
        initialStatus={initialStatus}
        initialMode={initialMode}
        initialAssociationId={associationId}
      />
    );
  }

  if (route.path === '/admin/jobs') {
    const status = Array.isArray(params.status) ? params.status[0] : params.status;
    const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    const initialStatus = ['ALL', 'HEALTHY', 'ISSUES', 'NEVER_RUN', 'SLOW'].includes(String(status))
      ? (status as 'ALL' | 'HEALTHY' | 'ISSUES' | 'NEVER_RUN' | 'SLOW')
      : undefined;
    const initialMode = mode === 'detail' ? 'detail' : undefined;
    return <MobileSystemAdminJobsScreen key={`system-admin-jobs-${initialStatus || 'all'}-${initialMode || 'list'}`} initialStatus={initialStatus} initialMode={initialMode} />;
  }

  if (route.path === '/admin/messaging') {
    const status = Array.isArray(params.status) ? params.status[0] : params.status;
    const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    const initialMode = ['detail', 'broadcast', 'sms'].includes(String(mode)) ? (mode as 'detail' | 'broadcast' | 'sms') : undefined;
    return (
      <MobileSystemAdminMessagingScreen
        key={`system-admin-messaging-${status || 'all'}-${initialMode || 'list'}`}
        initialStatus={typeof status === 'string' && status.trim() ? status : undefined}
        initialMode={initialMode}
      />
    );
  }

  if (route.path === '/admin/audit') {
    const status = Array.isArray(params.status) ? params.status[0] : params.status;
    const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    const initialStatus = ['ALL', 'SUCCESS', 'FAILED'].includes(String(status))
      ? (status as 'ALL' | 'SUCCESS' | 'FAILED')
      : undefined;
    const initialMode = mode === 'detail' ? 'detail' : undefined;
    return (
      <MobileSystemAdminAuditScreen
        key={`system-admin-audit-${initialStatus || 'all'}-${initialMode || 'list'}`}
        initialStatus={initialStatus}
        initialMode={initialMode}
      />
    );
  }

  if (route.path === '/admin/offline') {
    const tab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
    const capability = Array.isArray(params.capability) ? params.capability[0] : params.capability;
    return <MobileOfflineSupportScreen key={`system-admin-offline-${tab || 'overview'}-${capability || 'none'}`} audience="system-admin" />;
  }

  if (route.path === '/admin/password-reset') {
    const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    const initialMode = mode === 'confirm' || mode === 'success' ? mode : undefined;
    return <MobileSystemAdminPasswordResetScreen key={`system-admin-password-reset-${initialMode || 'form'}`} initialMode={initialMode} />;
  }

  if (route.path === '/admin/profile-picture') {
    const tab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
    const initialTab = tab === 'overview' || tab === 'upload' || tab === 'usage' ? tab : undefined;
    return <MobileProfilePictureScreen key={`system-admin-profile-picture-${initialTab || 'overview'}`} initialTab={initialTab} />;
  }

  if (route.path === '/admin/system') {
    const tab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
    const initialTab =
      tab === 'overview' || tab === 'database' || tab === 'websocket'
        ? tab
        : tab === 'diagnostics' || tab === 'raw'
          ? 'diagnostics'
          : undefined;
    return <MobileSystemAdminSystemScreen key={`system-admin-system-${initialTab || 'overview'}`} initialTab={initialTab} />;
  }

  if (route.path === '/admin/impersonate/handoff') {
    const state = Array.isArray(params.state) ? params.state[0] : params.state;
    const target = Array.isArray(params.target) ? params.target[0] : params.target;
    const schemaName = Array.isArray(params.schemaName) ? params.schemaName[0] : params.schemaName;
    const email = Array.isArray(params.email) ? params.email[0] : params.email;
    const initialState = state === 'missing' || state === 'ready' || state === 'confirm' ? state : undefined;
    const initialTarget = target === 'user' ? 'user' : 'admin';
    return (
      <MobileSystemAdminImpersonationHandoffScreen
        key={`system-admin-impersonation-handoff-${initialState || 'default'}-${initialTarget}-${schemaName || 'none'}-${email || 'none'}`}
        initialState={initialState}
        initialTarget={initialTarget}
        initialSchemaName={schemaName}
        initialEmail={email}
      />
    );
  }

  if (route.path === '/associations/members/:memberId') {
    const memberId = Array.isArray(params.memberId) ? params.memberId[0] : params.memberId;
    return <MobileMemberDetailScreen memberId={memberId} />;
  }

  if (route.path === '/associations/members/new') {
    return <MobileMemberFormScreen mode="create" />;
  }

  if (route.path === '/associations/members/:memberId/edit') {
    const memberId = Array.isArray(params.memberId) ? params.memberId[0] : params.memberId;
    return <MobileMemberFormScreen mode="edit" memberId={memberId} />;
  }

  if (route.path === '/associations/members/:memberId/documents') {
    const memberId = Array.isArray(params.memberId) ? params.memberId[0] : params.memberId;
    return <MobileMemberDocumentsScreen memberId={memberId} />;
  }

  if (route.path === '/associations/members/:memberId/invoices') {
    const memberId = Array.isArray(params.memberId) ? params.memberId[0] : params.memberId;
    return <MobileMemberInvoicesScreen memberId={memberId} />;
  }

  if (route.path === '/associations/members/import') {
    return <MobileMemberImportScreen />;
  }

  if (route.path === '/associations/members/union/deduction-upload') {
    return <MobileUnionDeductionUploadScreen />;
  }

  if (route.path === '/associations/statements/:memberId') {
    const memberId = Array.isArray(params.memberId) ? params.memberId[0] : params.memberId;
    return <MobileMemberStatementDetailScreen memberId={memberId} />;
  }

  if (route.path === '/associations/statements') {
    return <MobileMemberStatementsScreen />;
  }

  if (route.path === '/associations/loans') {
    const loanId = Array.isArray(params.loanId) ? params.loanId[0] : params.loanId;
    return <MobileAssociationLoansScreen initialLoanId={loanId} />;
  }

  if (route.path === '/associations/loans/request') {
    const memberId = Array.isArray(params.memberId) ? params.memberId[0] : params.memberId;
    return <MobileLoanRequestScreen mode="admin" initialMemberId={memberId} />;
  }

  if (route.path === '/associations/loans/batch-upload') {
    return <MobileLoanBatchUploadScreen />;
  }

  if (route.path === '/associations/loans/export') {
    return <MobileLoanExportScreen />;
  }

  if (route.path === '/associations/revenue-transactions') {
    return <MobileRevenueTransactionsScreen />;
  }

  if (route.path === '/associations/revenue-transactions/:id') {
    const transactionId = Array.isArray(params.id) ? params.id[0] : params.id;
    return <MobileRevenueTransactionDetailScreen transactionId={transactionId} />;
  }

  if (route.path === '/associations/revenue-transactions/create') {
    return <MobileRevenueTransactionCreateScreen />;
  }

  if (route.path === '/associations/savings/capture') {
    return <MobileSaccosSavingsCaptureScreen />;
  }

  if (route.path === '/associations/revenue-transactions/batch-create') {
    return <MobileRevenueTransactionImportScreen />;
  }

  if (route.path === '/associations/revenue-transactions/import') {
    return <MobileRevenueTransactionImportScreen />;
  }

  if (route.path === '/associations/revenue-transactions/export') {
    return <MobileRevenueTransactionExportScreen />;
  }

  if (route.path === '/associations/revenue-transactions/calender') {
    return <MobileRevenueTransactionCalendarScreen />;
  }

  if (route.path === '/associations/revenue-transactions/member-page') {
    return <MobileRevenueTransactionMemberHistoryScreen />;
  }

  if (route.path === '/associations/revenue-transactions/over-due') {
    return <MobileRevenueTransactionsOverdueScreen />;
  }

  if (route.path === '/associations/revenue-transactions/revenue-tracking') {
    return <MobileRevenueTrackingScreen />;
  }

  if (route.path === '/associations/revenue-transactions/share-distribution') {
    return <MobileShareDistributionScreen />;
  }

  if (route.path === '/associations/revenue-transactions/share-fines') {
    return <MobileShareFinesScreen />;
  }

  if (route.path === '/associations/revenue-transactions/share-reconciliation') {
    return <MobileShareReconciliationScreen />;
  }

  if (route.path === '/associations/revenue-transactions/dividends') {
    return <MobileDividendDistributionScreen />;
  }

  if (route.path === '/associations/revenue-transactions/fine-management') {
    return <MobileFineManagementScreen />;
  }

  if (route.path === '/associations/revenue-transactions/magic-link') {
    return <MobilePaymentMagicLinkScreen />;
  }

  if (route.path === '/associations/revenue/manage') {
    const revenueId = Array.isArray(params.revenueId) ? params.revenueId[0] : params.revenueId;
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    return <MobileRevenueManageScreen key={`general-revenue-${revenueId || id || 'list'}`} />;
  }

  if (route.path === '/associations/revenue/new') {
    return <MobileRevenueFormScreen />;
  }

  if (route.path === '/associations/revenue/:id/view') {
    const revenueId = Array.isArray(params.revenueId) ? params.revenueId[0] : params.revenueId;
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    return <MobileRevenueDetailScreen key={`general-revenue-detail-${revenueId || id || 'missing'}`} revenueId={revenueId || id} />;
  }

  if (route.path === '/associations/revenue/:id/edit') {
    const revenueId = Array.isArray(params.revenueId) ? params.revenueId[0] : params.revenueId;
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    return <MobileRevenueFormScreen key={`general-revenue-edit-${revenueId || id || 'missing'}`} mode="edit" revenueId={revenueId || id} />;
  }

  if (route.path === '/associations/revenue/categories') {
    return <MobileRevenueCategoriesScreen />;
  }

  if (route.path === '/associations/invoices') {
    const invoiceId = Array.isArray(params.invoiceId) ? params.invoiceId[0] : params.invoiceId;
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    return <MobileAssociationInvoicesScreen key={`association-invoices-${invoiceId || id || 'list'}`} />;
  }

  if (route.path === '/associations/invoices/:id') {
    const invoiceId = Array.isArray(params.invoiceId) ? params.invoiceId[0] : params.invoiceId;
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    return <MobileAssociationInvoiceDetailScreen key={`association-invoice-detail-${invoiceId || id || 'missing'}`} invoiceId={invoiceId || id} />;
  }

  if (route.path === '/associations/packages') {
    const packageId = Array.isArray(params.packageId) ? params.packageId[0] : params.packageId;
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    return <MobileAssociationPackagesScreen key={`association-packages-${packageId || id || 'list'}`} />;
  }

  if (route.path === '/associations/packages/new') {
    return <MobileAssociationPackagesScreen key="association-packages-new" initialMode="create" />;
  }

  if (route.path === '/associations/subscriptions') {
    const subscriptionId = Array.isArray(params.subscriptionId) ? params.subscriptionId[0] : params.subscriptionId;
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    return <MobileAssociationSubscriptionsScreen key={`association-subscriptions-${subscriptionId || id || 'list'}`} />;
  }

  if (route.path === '/associations/subscriptions/subscribe-member') {
    const memberId = Array.isArray(params.memberId) ? params.memberId[0] : params.memberId;
    const packageId = Array.isArray(params.packageId) ? params.packageId[0] : params.packageId;
    return <MobileSubscribeMemberScreen key={`association-subscribe-member-${memberId || 'none'}-${packageId || 'none'}`} />;
  }

  if (route.path === '/associations/reports/income-statement') {
    return <MobileIncomeStatementReportScreen />;
  }

  if (route.path === '/associations/reports/sms') {
    return <MobileSmsReportScreen />;
  }

  if (route.path === '/associations/reports/statistics') {
    return <MobileAssociationStatisticsReportScreen />;
  }

  if (route.path === '/associations/reports/saccos-savings') {
    return <MobileSaccosSavingsReportScreen />;
  }

  if (route.path === '/associations/union/reports') {
    return <MobileUnionReportsScreen />;
  }

  if (route.path === '/associations/year-end-close') {
    return <MobileYearEndCloseScreen />;
  }

  if (route.path === '/associations/profile') {
    return <MobileAssociationProfileScreen />;
  }

  if (route.path === '/associations/profile/edit') {
    return <MobileAssociationProfileEditScreen />;
  }

  if (route.path === '/associations/my-associations') {
    return <MobileMyAssociationsScreen />;
  }

  if (route.path === '/associations/group-config') {
    const configId = Array.isArray(params.configId) ? params.configId[0] : params.configId;
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    return <MobileGroupConfigScreen key={`group-config-${configId || id || 'list'}`} initialConfigId={configId || id} />;
  }

  if (route.path === '/associations/group-config/:id') {
    const configId = Array.isArray(params.configId) ? params.configId[0] : params.configId;
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    return <MobileGroupConfigDetailScreen key={`group-config-detail-${configId || id || 'missing'}`} configId={configId || id} />;
  }

  if (route.path === '/associations/group-config/create') {
    return <MobileGroupConfigFormScreen key="group-config-create" mode="create" />;
  }

  if (route.path === '/associations/group-config/edit/:id') {
    const configId = Array.isArray(params.configId) ? params.configId[0] : params.configId;
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    return <MobileGroupConfigFormScreen key={`group-config-edit-${configId || id || 'missing'}`} mode="edit" configId={configId || id} />;
  }

  if (route.path === '/associations/settings/associations/assoc-conf') {
    return <MobileAssociationConfigOverviewScreen />;
  }

  if (route.path === '/associations/settings/associations/config') {
    const tab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
    const initialTab = tab === 'notifications' || tab === 'fees' || tab === 'rules' || tab === 'builder' ? tab : undefined;
    return <MobileAssociationConfigEditScreen key={`association-config-${initialTab || 'builder'}`} initialTab={initialTab} />;
  }

  if (route.path === '/associations/settings/bank-accounts') {
    const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    const accountId = Array.isArray(params.accountId) ? params.accountId[0] : params.accountId;
    return <MobileBankAccountsScreen key={`bank-accounts-${mode || 'list'}-${accountId || 'none'}`} />;
  }

  if (route.path === '/associations/settings/billing') {
    const featureKey = Array.isArray(params.featureKey) ? params.featureKey[0] : params.featureKey;
    return <MobileBillingEntitlementsScreen key={`billing-entitlements-${featureKey || 'list'}`} />;
  }

  if (route.path === '/associations/settings/business-types') {
    const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    const businessTypeId = Array.isArray(params.businessTypeId) ? params.businessTypeId[0] : params.businessTypeId;
    return <MobileBusinessTypesScreen key={`business-types-${mode || 'list'}-${businessTypeId || 'none'}`} />;
  }

  if (route.path === '/associations/settings/document-categories') {
    const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    const categoryId = Array.isArray(params.categoryId) ? params.categoryId[0] : params.categoryId;
    return <MobileDocumentCategoriesScreen key={`document-categories-${mode || 'list'}-${categoryId || 'none'}`} />;
  }

  if (route.path === '/associations/settings/membership-number') {
    const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    const memberId = Array.isArray(params.memberId) ? params.memberId[0] : params.memberId;
    return <MobileMembershipNumberScreen key={`membership-number-${mode || 'list'}-${memberId || 'none'}`} />;
  }

  if (route.path === '/associations/settings/offline') {
    const tab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
    const capability = Array.isArray(params.capability) ? params.capability[0] : params.capability;
    return <MobileOfflineSupportScreen key={`offline-support-${tab || 'overview'}-${capability || 'none'}`} audience="admin" />;
  }

  if (route.path === '/associations/settings/profile-picture') {
    const tab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
    const initialTab = tab === 'upload' || tab === 'usage' || tab === 'overview' ? tab : undefined;
    return <MobileProfilePictureScreen key={`profile-picture-${initialTab || 'overview'}`} initialTab={initialTab} />;
  }

  if (route.path === '/associations/settings/registration-integration') {
    const tab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
    const env = Array.isArray(params.env) ? params.env[0] : params.env;
    const initialTab = tab === 'api' || tab === 'docs' || tab === 'overview' ? tab : undefined;
    const initialEnvironment = env === 'test' || env === 'production' ? env : undefined;
    return (
      <MobileRegistrationIntegrationScreen
        key={`registration-integration-${initialEnvironment || 'auto'}-${initialTab || 'overview'}`}
        initialEnvironment={initialEnvironment}
        initialTab={initialTab}
      />
    );
  }

  if (route.path === '/associations/settings/roles') {
    const tab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
    const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    const initialTab = tab === 'users' || tab === 'members' || tab === 'audit' || tab === 'roles' ? tab : undefined;
    const initialMode = mode === 'create' || mode === 'edit' || mode === 'assign' ? mode : undefined;
    return <MobileRolesPermissionsScreen key={`roles-permissions-${initialTab || 'roles'}-${initialMode || 'view'}`} initialTab={initialTab} initialMode={initialMode} />;
  }

  if (route.path === '/associations/settings/sms-sender-config') {
    const tab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
    const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    const initialTab = tab === 'templates' || tab === 'test' || tab === 'configuration' ? tab : undefined;
    const initialMode = mode === 'delete' || mode === 'test' ? mode : undefined;
    return <MobileSmsSenderConfigScreen key={`sms-sender-config-${initialTab || 'configuration'}-${initialMode || 'view'}`} initialTab={initialTab} initialMode={initialMode} />;
  }

  if (route.path === '/associations/settings/union-settings') {
    const tab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
    const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    const initialTab = tab === 'impact' || tab === 'settings' ? tab : undefined;
    const initialMode = mode === 'confirm' ? mode : undefined;
    return <MobileUnionSettingsScreen key={`union-settings-${initialTab || 'settings'}-${initialMode || 'view'}`} initialTab={initialTab} initialMode={initialMode} />;
  }

  if (route.path === '/associations/configurations/notifications') {
    const group = Array.isArray(params.group) ? params.group[0] : params.group;
    const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    const initialMode = mode === 'detail' || mode === 'confirm' ? mode : undefined;
    return <MobileNotificationPolicyScreen key={`notification-policy-${group || 'all'}-${initialMode || 'overview'}`} initialGroup={group} initialMode={initialMode} />;
  }

  if (route.path === '/associations/configurations/reminders') {
    const tab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
    const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    const initialTab = ['payment', 'share', 'loan', 'subscription', 'channels', 'email'].includes(String(tab)) ? (tab as 'payment' | 'share' | 'loan' | 'subscription' | 'channels' | 'email') : undefined;
    const initialMode = mode === 'confirm' || mode === 'trigger' || mode === 'reset' ? mode : undefined;
    return <MobileReminderConfigScreen key={`reminder-config-${initialTab || 'auto'}-${initialMode || 'view'}`} initialTab={initialTab} initialMode={initialMode} />;
  }

  if (route.path === '/associations/users') {
    const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    const userId = Array.isArray(params.userId) ? params.userId[0] : params.userId;
    const query = Array.isArray(params.query) ? params.query[0] : params.query;
    return <MobileAssociationUsersScreen key={`association-users-${mode || 'list'}-${userId || 'auto'}-${query || 'all'}`} />;
  }

  if (route.path === '/associations/users/new') {
    const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    const initialMode = mode === 'sample' || mode === 'confirm' ? mode : undefined;
    return <MobileAssociationUserCreateScreen key={`association-user-create-${initialMode || 'blank'}`} initialMode={initialMode} />;
  }

  if (route.path === '/associations/pay/generic') {
    return <MobileGenericPaymentScreen mode="association" />;
  }

  if (route.path === '/associations/transactions/reconcile') {
    return <MobilePaymentReconciliationScreen />;
  }

  if (route.path === '/associations/wallet') {
    return <MobileAssociationWalletScreen />;
  }

  if (route.path === '/associations/wallet/approve-withdrawals') {
    return <MobileWithdrawalApprovalsScreen />;
  }

  if (route.path === '/associations/disbursements') {
    return <MobileDisbursementsScreen />;
  }

  if (route.path === '/associations/vefd-receipts') {
    return <MobileVefdReceiptsScreen />;
  }

  if (route.path === '/associations/attendance') {
    return <MobileAttendanceScreen />;
  }

  if (route.path === '/associations/attendance/record-attendance') {
    return <MobileRecordAttendanceScreen />;
  }

  if (route.path === '/associations/attendance/schedule-fine') {
    return <MobileScheduleFineScreen />;
  }

  if (route.path === '/associations/governance/compliance') {
    return <MobileGovernanceComplianceScreen />;
  }

  if (route.path === '/associations/governance/documents') {
    return <MobileGovernanceDocumentsScreen />;
  }

  if (route.path === '/associations/governance/elections') {
    return <MobileGovernanceElectionsScreen />;
  }

  if (route.path === '/associations/governance/structure') {
    return <MobileGovernanceStructureScreen />;
  }

  if (route.path === '/associations/members-voice') {
    return <MobileMembersVoiceScreen />;
  }

  if (route.path === '/associations/events/manage') {
    return <MobileEventsManageScreen />;
  }

  if (route.path === '/associations/events/add') {
    return <MobileEventFormScreen />;
  }

  if (route.path === '/associations/crm') {
    return <MobileCrmCampaignsScreen />;
  }

  if (route.path === '/associations/clients') {
    const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    const clientId = Array.isArray(params.clientId) ? params.clientId[0] : params.clientId;
    return <MobileClientsScreen key={`clients-${mode || 'list'}-${clientId || 'none'}`} />;
  }

  if (route.path === '/associations/expenses/manage') {
    const expenseId = Array.isArray(params.expenseId) ? params.expenseId[0] : params.expenseId;
    return <MobileExpensesManageScreen key={`expenses-${expenseId || 'list'}`} />;
  }

  if (route.path === '/associations/expenses/categories') {
    return <MobileExpenseCategoriesScreen />;
  }

  if (route.path === '/associations/expenses/:id') {
    const expenseId = Array.isArray(params.expenseId) ? params.expenseId[0] : params.expenseId;
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    return <MobileExpenseDetailScreen key={`expense-detail-${expenseId || id || 'missing'}`} expenseId={expenseId || id} />;
  }

  if (route.path === '/associations/expenses/new') {
    const expenseId = Array.isArray(params.expenseId) ? params.expenseId[0] : params.expenseId;
    return <MobileExpenseFormScreen key={`expense-form-${expenseId || 'new'}`} mode={expenseId ? 'edit' : 'create'} expenseId={expenseId} />;
  }

  if (route.path === '/associations/expenses/edit/:id') {
    const expenseId = Array.isArray(params.expenseId) ? params.expenseId[0] : params.expenseId;
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    return <MobileExpenseFormScreen key={`expense-edit-${expenseId || id || 'missing'}`} mode="edit" expenseId={expenseId || id} />;
  }

  if (route.path === '/associations/jobs/manage') {
    const postId = Array.isArray(params.postId) ? params.postId[0] : params.postId;
    return <MobilePostsManageScreen key={`jobs-${postId || 'list'}`} forcedPostType="JOB" />;
  }

  if (route.path === '/associations/jobs/add') {
    const postId = Array.isArray(params.postId) ? params.postId[0] : params.postId;
    return <MobilePostFormScreen key={`job-form-${postId || 'new'}`} forcedPostType="JOB" />;
  }

  if (route.path === '/associations/posts/manage') {
    const postId = Array.isArray(params.postId) ? params.postId[0] : params.postId;
    return <MobilePostsManageScreen key={`posts-${postId || 'list'}`} />;
  }

  if (route.path === '/associations/posts/add') {
    const postId = Array.isArray(params.postId) ? params.postId[0] : params.postId;
    const postType = Array.isArray(params.postType) ? params.postType[0] : params.postType;
    return <MobilePostFormScreen key={`post-form-${postId || 'new'}-${postType || 'JOB'}`} forcedPostType={postType as string | undefined} />;
  }

  if (route.path === '/associations/revenue-transactions/bulk') {
    const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    const initialMode = mode === 'update' ? 'update' : 'create';
    return <MobileRevenueTransactionBulkScreen key={initialMode} initialMode={initialMode} />;
  }

  if (route.path === '/associations/revenue-transactions/bulk/import') {
    return <MobileRevenueTransactionBulkImportScreen />;
  }

  const moduleMeta = moduleCatalog[route.module];
  const RouteIcon = route.icon;

  return (
    <MobileScreen>
      <MobilePageHeader
        title={route.title}
        eyebrow={roleLabels[route.role].short}
        subtitle={moduleMeta.label}
        onBack={() => router.back()}
      />

      <MobileCard compact accent={moduleMeta.tone}>
        <View style={styles.routeHero}>
          <View style={[styles.routeIcon, { backgroundColor: theme.colors.kpi[moduleMeta.tone] }]}>
            <RouteIcon color={theme.colors.onPrimary} size={24} strokeWidth={2.4} />
          </View>
          <View style={styles.routeCopy}>
            <MobileText variant="section" weight="bold">
              {route.title}
            </MobileText>
            <MobileText variant="small" tone="secondary">
              This workspace is not native on mobile yet.
            </MobileText>
          </View>
        </View>
      </MobileCard>

      <MobileCard compact>
        <View style={styles.comingSoon}>
          <View style={[styles.comingSoonIcon, { backgroundColor: theme.colors.kpi[moduleMeta.tone] }]}>
            <Clock3 color={theme.colors.onPrimary} size={22} strokeWidth={2.5} />
          </View>
          <View style={styles.routeCopy}>
            <MobileText variant="section" weight="bold">
              Use the web dashboard for now
            </MobileText>
            <MobileText variant="small" tone="secondary">
              The native mobile screen is in progress. Until then, this work remains available from the Nane web dashboard.
            </MobileText>
          </View>
        </View>
      </MobileCard>

      <View style={styles.actions}>
        <MobileButton
          label="Browse this area"
          icon={Layers3}
          onPress={() => router.push({ pathname: '/work/module', params: { module: route.module, role: route.role } } as never)}
          fullWidth
        />
        <MobileButton label="Find another task" icon={Search} variant="secondary" onPress={() => router.push('/search' as never)} fullWidth />
      </View>
    </MobileScreen>
  );
}

const styles = StyleSheet.create({
  routeHero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  routeIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeCopy: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  comingSoon: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  comingSoonIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  actions: {
    gap: 10,
  },
});
