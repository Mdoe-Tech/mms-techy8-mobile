import type { LucideIcon } from 'lucide-react-native';
import {
  Banknote,
  BellRing,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckSquare,
  CloudOff,
  CreditCard,
  FileBarChart,
  FileText,
  Landmark,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Package,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UsersRound,
  Vote,
  WalletCards,
} from 'lucide-react-native';

import type { KpiTone, StatusTone } from '@/theme/tokens';
import type { MobileViewMode } from '@/types/auth';

export type MobileRole = 'association-admin' | 'member' | 'system-admin';

export type MobileRouteModule =
  | 'admin'
  | 'association'
  | 'attendance'
  | 'billing'
  | 'community'
  | 'crm'
  | 'dashboard'
  | 'finance'
  | 'governance'
  | 'loans'
  | 'members'
  | 'reports'
  | 'settings'
  | 'subscriptions'
  | 'system'
  | 'union'
  | 'wallet';

export type SupportedAssociationType = 'GENERIC' | 'VIKOBA' | 'SACCOS' | 'UNION';

export type MobileRouteItem = {
  id: string;
  title: string;
  path: string;
  role: MobileRole;
  module: MobileRouteModule;
  description: string;
  keywords: string[];
  dynamic: boolean;
  primary: boolean;
  requiredPermissions: string[];
  anyPermissions: string[];
  billingFeatureKey?: string | null;
  allowedAssociationTypes?: SupportedAssociationType[];
  icon: LucideIcon;
  source: 'frontend-app-route';
};

export type MobileModuleSummary = {
  id: MobileRouteModule;
  label: string;
  description: string;
  routeCount: number;
  dynamicCount: number;
  primaryCount: number;
  tone: KpiTone;
  icon: LucideIcon;
};

export const roleLabels: Record<MobileRole, { short: string; label: string; description: string }> = {
  'association-admin': {
    short: 'Association',
    label: 'Association workspace',
    description: 'Manage members, payments, loans, reports, governance, and association settings.',
  },
  member: {
    short: 'Member',
    label: 'Member workspace',
    description: 'View your records, make payments, request services, and stay connected with your association.',
  },
  'system-admin': {
    short: 'System',
    label: 'Platform workspace',
    description: 'Support associations, billing, clients, platform finance, messaging, and system operations.',
  },
};

export const mobileRoles: MobileRole[] = ['association-admin', 'member', 'system-admin'];

export function roleForMobileView(view?: MobileViewMode | null): MobileRole {
  if (view === 'MEMBER') return 'member';
  if (view === 'SYSTEM_ADMIN') return 'system-admin';
  return 'association-admin';
}

export const moduleCatalog: Record<
  MobileRouteModule,
  {
    label: string;
    description: string;
    tone: KpiTone;
    icon: LucideIcon;
    order: number;
  }
> = {
  dashboard: {
    label: 'Dashboards',
    description: 'Executive snapshots, totals, alerts, and activity summaries.',
    tone: 'blue',
    icon: LayoutDashboard,
    order: 10,
  },
  members: {
    label: 'Members',
    description: 'Member records, directories, certificates, identity, and documents.',
    tone: 'green',
    icon: UsersRound,
    order: 20,
  },
  finance: {
    label: 'Finance',
    description: 'Revenue, expenses, statements, contributions, fines, and year-end work.',
    tone: 'orange',
    icon: Banknote,
    order: 30,
  },
  loans: {
    label: 'Loans',
    description: 'Loan requests, approvals, exports, and loan group configuration.',
    tone: 'purple',
    icon: Landmark,
    order: 40,
  },
  wallet: {
    label: 'Wallet & Payments',
    description: 'Wallet balances, withdrawals, disbursements, payments, and reconciliation.',
    tone: 'teal',
    icon: WalletCards,
    order: 50,
  },
  billing: {
    label: 'Billing',
    description: 'Invoices, clients, receipts, packages, and subscription billing.',
    tone: 'blue',
    icon: ReceiptText,
    order: 60,
  },
  attendance: {
    label: 'Attendance',
    description: 'Meeting attendance capture, correction, review, and attendance fines.',
    tone: 'green',
    icon: CheckSquare,
    order: 70,
  },
  community: {
    label: 'Community',
    description: 'Events, posts, jobs, tenders, news, communications, and member voice.',
    tone: 'purple',
    icon: Megaphone,
    order: 80,
  },
  governance: {
    label: 'Governance',
    description: 'Structure, documents, elections, voting, and compliance workflows.',
    tone: 'slate',
    icon: ShieldCheck,
    order: 90,
  },
  reports: {
    label: 'Reports',
    description: 'Operational, SMS, income statement, statistics, and union reports.',
    tone: 'teal',
    icon: FileBarChart,
    order: 100,
  },
  crm: {
    label: 'CRM',
    description: 'Campaigns and relationship management.',
    tone: 'purple',
    icon: MessageSquare,
    order: 110,
  },
  union: {
    label: 'Union',
    description: 'Union deductions, uploads, dashboards, reports, and settings.',
    tone: 'blue',
    icon: Building2,
    order: 120,
  },
  subscriptions: {
    label: 'Subscriptions',
    description: 'Packages, membership plans, member subscriptions, and registration status.',
    tone: 'green',
    icon: Package,
    order: 130,
  },
  association: {
    label: 'Association',
    description: 'Association profile, users, bank accounts, and organization-level setup.',
    tone: 'slate',
    icon: Building2,
    order: 140,
  },
  settings: {
    label: 'Settings',
    description: 'Configuration, roles, integrations, offline support, and system policies.',
    tone: 'slate',
    icon: Settings,
    order: 150,
  },
  admin: {
    label: 'Admin Operations',
    description: 'Platform association, client, billing, invoice, and support operations.',
    tone: 'blue',
    icon: SlidersHorizontal,
    order: 160,
  },
  system: {
    label: 'System',
    description: 'Platform health, audit, messaging, jobs, offline, and security tools.',
    tone: 'red',
    icon: CloudOff,
    order: 170,
  },
};

const associationRoutePaths = [
  '/associations/all-dashboard',
  '/associations/attendance',
  '/associations/attendance/record-attendance',
  '/associations/attendance/schedule-fine',
  '/associations/clients',
  '/associations/configurations/notifications',
  '/associations/configurations/reminders',
  '/associations/crm',
  '/associations/dashboard',
  '/associations/dashboard/union',
  '/associations/disbursements',
  '/associations/events/add',
  '/associations/events/manage',
  '/associations/expenses/:id',
  '/associations/expenses/categories',
  '/associations/expenses/edit/:id',
  '/associations/expenses/manage',
  '/associations/expenses/new',
  '/associations/governance/compliance',
  '/associations/governance/documents',
  '/associations/governance/elections',
  '/associations/governance/structure',
  '/associations/group-config/:id',
  '/associations/group-config/create',
  '/associations/group-config/edit/:id',
  '/associations/group-config',
  '/associations/invoices/:id',
  '/associations/invoices',
  '/associations/jobs/add',
  '/associations/jobs/manage',
  '/associations/loans/batch-upload',
  '/associations/loans/export',
  '/associations/loans',
  '/associations/loans/request',
  '/associations/members-voice',
  '/associations/members/:memberId/documents',
  '/associations/members/:memberId/edit',
  '/associations/members/:memberId/invoices',
  '/associations/members/:memberId',
  '/associations/members/import',
  '/associations/members/new',
  '/associations/members',
  '/associations/members/union/deduction-upload',
  '/associations/my-associations',
  '/associations/packages/new',
  '/associations/packages',
  '/associations/pay/generic',
  '/associations/posts/add',
  '/associations/posts/manage',
  '/associations/profile/edit',
  '/associations/profile',
  '/associations/reports/income-statement',
  '/associations/reports/sms',
  '/associations/reports/statistics',
  '/associations/reports/saccos-savings',
  '/associations/revenue-transactions/:id',
  '/associations/revenue-transactions/batch-create',
  '/associations/revenue-transactions/bulk/import',
  '/associations/revenue-transactions/bulk',
  '/associations/revenue-transactions/calender',
  '/associations/revenue-transactions/create',
  '/associations/revenue-transactions/dividends',
  '/associations/revenue-transactions/export',
  '/associations/revenue-transactions/fine-management',
  '/associations/revenue-transactions/import',
  '/associations/revenue-transactions/magic-link',
  '/associations/revenue-transactions/member-page',
  '/associations/revenue-transactions/over-due',
  '/associations/revenue-transactions',
  '/associations/revenue-transactions/revenue-tracking',
  '/associations/revenue-transactions/share-distribution',
  '/associations/revenue-transactions/share-fines',
  '/associations/revenue-transactions/share-reconciliation',
  '/associations/savings/capture',
  '/associations/revenue/:id/edit',
  '/associations/revenue/:id/view',
  '/associations/revenue/categories',
  '/associations/revenue/manage',
  '/associations/revenue/new',
  '/associations/settings/associations/assoc-conf',
  '/associations/settings/associations/config',
  '/associations/settings/bank-accounts',
  '/associations/settings/billing',
  '/associations/settings/business-types',
  '/associations/settings/document-categories',
  '/associations/settings/membership-number',
  '/associations/settings/offline',
  '/associations/settings/profile-picture',
  '/associations/settings/registration-integration',
  '/associations/settings/roles',
  '/associations/settings/sms-sender-config',
  '/associations/settings/union-settings',
  '/associations/statements/:memberId',
  '/associations/statements',
  '/associations/subscriptions',
  '/associations/subscriptions/subscribe-member',
  '/associations/transactions/reconcile',
  '/associations/union/reports',
  '/associations/users/new',
  '/associations/users',
  '/associations/vefd-receipts',
  '/associations/wallet/approve-withdrawals',
  '/associations/wallet',
  '/associations/year-end-close',
] as const;

const memberRoutePaths = [
  '/member/:memberId/edit',
  '/member/certificates',
  '/member/dashboard',
  '/member/deductions/calendar',
  '/member/deductions',
  '/member/directory',
  '/member/events',
  '/member/invoices/:id',
  '/member/invoices',
  '/member/job-posts',
  '/member/loans/:loanId',
  '/member/loans',
  '/member/loans/request',
  '/member/news',
  '/member/notifications',
  '/member/offline',
  '/member/packages',
  '/member/packages/subscribe/:packageId',
  '/member/pay/generic',
  '/member/profile',
  '/member/profile/security',
  '/member/registration/complete',
  '/member/registration/status/:memberId',
  '/member/revenue-transactions/:id',
  '/member/revenue-transactions/calender',
  '/member/revenue-transactions',
  '/member/subscription-history',
  '/member/subscription',
  '/member/tenders',
  '/member/upload-document/:memberId/documents',
  '/member/voting',
  '/member/wallet',
] as const;

const systemAdminRoutePaths = [
  '/admin/associations/new',
  '/admin/associations',
  '/admin/audit',
  '/admin/billing',
  '/admin/clients',
  '/admin/dashboard',
  '/admin/disbursements',
  '/admin/finance',
  '/admin/finance/withdrawals',
  '/admin/impersonate/handoff',
  '/admin/invoices',
  '/admin/jobs',
  '/admin/messaging',
  '/admin/offline',
  '/admin/password-reset',
  '/admin/profile-picture',
  '/admin/reports/overview',
  '/admin/reports',
  '/admin/system',
] as const;

const primaryRoutes = new Set<string>([
  '/admin/associations',
  '/admin/billing',
  '/admin/dashboard',
  '/admin/finance',
  '/admin/jobs',
  '/admin/messaging',
  '/admin/system',
  '/associations/attendance',
  '/associations/clients',
  '/associations/dashboard',
  '/associations/events/manage',
  '/associations/expenses/manage',
  '/associations/governance/documents',
  '/associations/invoices',
  '/associations/loans',
  '/associations/members',
  '/associations/pay/generic',
  '/associations/reports/statistics',
  '/associations/revenue-transactions',
  '/associations/savings/capture',
  '/associations/revenue/manage',
  '/associations/statements',
  '/associations/wallet',
  '/member/dashboard',
  '/member/directory',
  '/member/events',
  '/member/invoices',
  '/member/loans',
  '/member/pay/generic',
  '/member/profile',
  '/member/revenue-transactions',
  '/member/wallet',
]);

type RoutePermissionRule = {
  prefix: string;
  permission?: string;
  permissions?: string[];
  anyPermissions?: string[];
};

type BillingFeatureRule = {
  prefix: string;
  featureKey: string;
};

type AssociationTypeRouteRestriction = {
  prefix: string;
  allowed: SupportedAssociationType[];
};

const routePermissionRules: RoutePermissionRule[] = [
  { prefix: '/associations/dashboard', permission: 'dashboard.view' },
  { prefix: '/associations/clients', permission: 'finance.transactions.view' },
  { prefix: '/associations/invoices', permission: 'finance.transactions.view' },
  { prefix: '/associations/vefd-receipts', permission: 'finance.transactions.view' },
  { prefix: '/associations/settings/roles', permission: 'rbac.roles.manage' },
  { prefix: '/associations/settings/billing', permission: 'billing.entitlements.view' },
  { prefix: '/associations/users/new', permissions: ['users.invite', 'rbac.assignments.manage'] },
  { prefix: '/associations/users', permission: 'users.view' },
  { prefix: '/associations/members/import', permission: 'members.import' },
  { prefix: '/associations/members/new', permission: 'members.create' },
  { prefix: '/associations/members/union', permission: 'union.manage' },
  { prefix: '/associations/members/:memberId/invoices', permissions: ['members.view', 'finance.transactions.view'] },
  { prefix: '/associations/members/:memberId/edit', permission: 'members.update' },
  { prefix: '/associations/members', permission: 'members.view' },
  { prefix: '/associations/loans/request', permission: 'loans.create' },
  { prefix: '/associations/loans/batch-upload', permission: 'loans.create' },
  { prefix: '/associations/loans/export', permissions: ['reports.export', 'loans.view'] },
  { prefix: '/associations/loans', permission: 'loans.view' },
  { prefix: '/associations/wallet/approve-withdrawals', permission: 'wallets.withdrawals.approve' },
  { prefix: '/associations/disbursements', permission: 'wallets.disburse' },
  { prefix: '/associations/wallet', permission: 'wallets.view' },
  { prefix: '/associations/transactions/reconcile', permission: 'finance.transactions.reconcile' },
  { prefix: '/associations/pay/generic', permission: 'member.self.payments' },
  { prefix: '/associations/savings/capture', permission: 'finance.transactions.create' },
  { prefix: '/associations/revenue-transactions/export', permission: 'reports.export' },
  { prefix: '/associations/revenue-transactions/bulk/import', permission: 'finance.transactions.create' },
  { prefix: '/associations/revenue-transactions/bulk', permission: 'finance.transactions.create' },
  { prefix: '/associations/revenue-transactions/batch-create', permission: 'finance.transactions.create' },
  { prefix: '/associations/revenue-transactions/import', permission: 'finance.transactions.create' },
  { prefix: '/associations/revenue-transactions/create', permission: 'finance.transactions.create' },
  { prefix: '/associations/revenue-transactions/dividends', permission: 'finance.transactions.reconcile' },
  { prefix: '/associations/revenue-transactions/fine-management', permission: 'finance.transactions.update' },
  { prefix: '/associations/revenue-transactions/share-distribution', permission: 'finance.transactions.update' },
  { prefix: '/associations/revenue-transactions/share-fines', permission: 'finance.transactions.create' },
  { prefix: '/associations/revenue-transactions/share-reconciliation', permission: 'finance.transactions.reconcile' },
  { prefix: '/associations/revenue-transactions', permission: 'finance.transactions.view' },
  { prefix: '/associations/expenses/categories', permission: 'settings.update' },
  { prefix: '/associations/expenses/edit', permission: 'finance.transactions.update' },
  { prefix: '/associations/expenses/new', permission: 'finance.transactions.create' },
  { prefix: '/associations/expenses', permission: 'finance.transactions.view' },
  { prefix: '/associations/revenue/categories', permission: 'settings.update' },
  { prefix: '/associations/revenue/:id/edit', permission: 'finance.transactions.update' },
  { prefix: '/associations/revenue/new', permission: 'finance.transactions.create' },
  { prefix: '/associations/revenue', permission: 'finance.transactions.view' },
  { prefix: '/associations/reports', permission: 'reports.view' },
  { prefix: '/associations/statements', permission: 'reports.view' },
  { prefix: '/associations/governance', permission: 'governance.view' },
  { prefix: '/associations/crm', permission: 'crm.view' },
  { prefix: '/associations/events/add', permission: 'community.manage' },
  { prefix: '/associations/events', permission: 'community.view' },
  { prefix: '/associations/members-voice', permission: 'community.view' },
  { prefix: '/associations/jobs/add', permission: 'community.manage' },
  { prefix: '/associations/jobs/manage', permission: 'community.view' },
  { prefix: '/associations/posts/add', permission: 'community.manage' },
  { prefix: '/associations/posts', permission: 'community.view' },
  { prefix: '/associations/group-config/create', permission: 'settings.update' },
  { prefix: '/associations/group-config/edit', permission: 'settings.update' },
  { prefix: '/associations/group-config', permission: 'settings.view' },
  { prefix: '/associations/profile/edit', permission: 'settings.update' },
  { prefix: '/associations/profile', permission: 'settings.view' },
  { prefix: '/associations/my-associations', permission: 'settings.view' },
  { prefix: '/associations/settings', permission: 'settings.view' },
  { prefix: '/associations/configurations/notifications', permission: 'settings.view' },
  { prefix: '/associations/configurations', permission: 'settings.view' },
  { prefix: '/associations/packages/new', permission: 'subscriptions.manage' },
  { prefix: '/associations/packages', permission: 'subscriptions.view' },
  { prefix: '/associations/subscriptions/subscribe-member', permission: 'subscriptions.manage' },
  { prefix: '/associations/subscriptions', permission: 'subscriptions.view' },
  { prefix: '/associations/dashboard/union', permission: 'union.view' },
  { prefix: '/associations/union', permission: 'union.view' },
  { prefix: '/associations/attendance/record-attendance', permission: 'community.manage' },
  { prefix: '/associations/attendance/schedule-fine', permission: 'finance.transactions.create' },
  { prefix: '/associations/attendance', permission: 'community.view' },
  { prefix: '/associations/year-end-close', permission: 'finance.transactions.reconcile' },
  { prefix: '/member/profile/security', permission: 'member.self.view' },
  { prefix: '/member/profile', permission: 'member.self.view' },
  { prefix: '/member/dashboard', permission: 'member.self.view' },
  { prefix: '/member/offline', permission: 'member.self.view' },
  { prefix: '/member/registration/complete', permission: 'member.self.view' },
  { prefix: '/member/certificates', permission: 'member.self.view' },
  { prefix: '/member/notifications', permission: 'member.self.view' },
  { prefix: '/member/voting', permission: 'member.self.view' },
  { prefix: '/member/directory', anyPermissions: ['member.self.view', 'community.view'] },
  { prefix: '/member/events', permission: 'member.self.view' },
  { prefix: '/member/job-posts', permission: 'member.self.view' },
  { prefix: '/member/tenders', permission: 'member.self.view' },
  { prefix: '/member/news', permission: 'member.self.view' },
  { prefix: '/member/subscription-history', permission: 'member.self.view' },
  { prefix: '/member/subscription', permission: 'member.self.view' },
  { prefix: '/member/packages/subscribe/:packageId', permission: 'member.self.view' },
  { prefix: '/member/packages', permission: 'member.self.view' },
  { prefix: '/member/invoices', permission: 'member.self.view' },
  { prefix: '/member/revenue-transactions', permission: 'member.self.view' },
  { prefix: '/member/deductions', permission: 'member.self.view' },
  { prefix: '/member/loans/request', permission: 'member.self.payments' },
  { prefix: '/member/loans', permission: 'member.self.view' },
  { prefix: '/member/wallet', permission: 'member.self.view' },
  { prefix: '/member/pay/generic', permission: 'member.self.payments' },
  { prefix: '/member/registration/status/:memberId', permission: 'member.self.view' },
  { prefix: '/member/:memberId/edit', permission: 'member.self.payments' },
  { prefix: '/member/upload-document/:memberId/documents', permission: 'member.self.payments' },
];

const billingFeatureRules: BillingFeatureRule[] = [
  { prefix: '/associations/dashboard', featureKey: 'dashboard' },
  { prefix: '/associations/clients', featureKey: 'clients' },
  { prefix: '/associations/invoices', featureKey: 'invoices' },
  { prefix: '/associations/vefd-receipts', featureKey: 'vfd.receipts' },
  { prefix: '/associations/members/new', featureKey: 'add.member' },
  { prefix: '/associations/members/import', featureKey: 'bulk.import.members' },
  { prefix: '/associations/members/union/deduction-upload', featureKey: 'deduction.upload' },
  { prefix: '/associations/members', featureKey: 'manage.members' },
  { prefix: '/associations/profile', featureKey: 'association.profile' },
  { prefix: '/associations/packages/new', featureKey: 'create.package' },
  { prefix: '/associations/packages', featureKey: 'membership.packages' },
  { prefix: '/associations/subscriptions/subscribe-member', featureKey: 'enroll.package' },
  { prefix: '/associations/subscriptions', featureKey: 'member.subscriptions' },
  { prefix: '/associations/crm', featureKey: 'communications' },
  { prefix: '/associations/events/add', featureKey: 'add.event' },
  { prefix: '/associations/events', featureKey: 'manage.events' },
  { prefix: '/associations/members-voice', featureKey: 'members.voice' },
  { prefix: '/associations/posts/add', featureKey: 'add.post' },
  { prefix: '/associations/posts', featureKey: 'manage.posts' },
  { prefix: '/associations/expenses/categories', featureKey: 'expense.categories' },
  { prefix: '/associations/expenses', featureKey: 'manage.expenses' },
  { prefix: '/associations/revenue/categories', featureKey: 'revenue.categories' },
  { prefix: '/associations/revenue', featureKey: 'manage.revenue' },
  { prefix: '/associations/loans', featureKey: 'loan.management' },
  { prefix: '/associations/savings/capture', featureKey: 'savings.contributions' },
  { prefix: '/associations/reports/saccos-savings', featureKey: 'saccos.savings.report' },
  { prefix: '/associations/revenue-transactions/bulk', featureKey: 'share.contributions' },
  { prefix: '/associations/revenue-transactions/create', featureKey: 'record.contribution' },
  { prefix: '/associations/revenue-transactions/batch-create', featureKey: 'import.transactions' },
  { prefix: '/associations/revenue-transactions/import', featureKey: 'import.transactions' },
  { prefix: '/associations/revenue-transactions/calender', featureKey: 'payment.calendar' },
  { prefix: '/associations/revenue-transactions/member-page', featureKey: 'member.transaction.history' },
  { prefix: '/associations/revenue-transactions/over-due', featureKey: 'manage.fines.penalties' },
  { prefix: '/associations/revenue-transactions/export', featureKey: 'export.financial.data' },
  { prefix: '/associations/revenue-transactions/share-fines', featureKey: 'generate.share.fine' },
  { prefix: '/associations/revenue-transactions/fine-management', featureKey: 'fine.management' },
  { prefix: '/associations/revenue-transactions/revenue-tracking', featureKey: 'revenue.tracker' },
  { prefix: '/associations/revenue-transactions/share-distribution', featureKey: 'share.monthly.weekly' },
  { prefix: '/associations/revenue-transactions/dividends', featureKey: 'dividend.distribution' },
  { prefix: '/associations/revenue-transactions/share-reconciliation', featureKey: 'share.reconciliation' },
  { prefix: '/associations/revenue-transactions', featureKey: 'manage.transactions' },
  { prefix: '/associations/statements', featureKey: 'member.statements' },
  { prefix: '/associations/wallet/approve-withdrawals', featureKey: 'withdrawal.approvals' },
  { prefix: '/associations/disbursements', featureKey: 'wallet.disbursements' },
  { prefix: '/associations/wallet', featureKey: 'wallet.balance' },
  { prefix: '/associations/pay/generic', featureKey: 'self.service.payment' },
  { prefix: '/associations/transactions/reconcile', featureKey: 'payment.reconciliation' },
  { prefix: '/associations/governance/structure', featureKey: 'governance.structure' },
  { prefix: '/associations/governance/documents', featureKey: 'governance.documents' },
  { prefix: '/associations/governance/elections', featureKey: 'governance.elections' },
  { prefix: '/associations/governance/compliance', featureKey: 'governance.compliance' },
  { prefix: '/associations/reports/statistics', featureKey: 'association.statistics' },
  { prefix: '/associations/reports/income-statement', featureKey: 'income.statement' },
  { prefix: '/associations/reports/sms', featureKey: 'sms.report' },
  { prefix: '/associations/group-config/create', featureKey: 'setup.new.configuration' },
  { prefix: '/associations/group-config', featureKey: 'kikoba.configuration' },
  { prefix: '/associations/year-end-close', featureKey: 'year.end.close' },
  { prefix: '/associations/configurations/notifications', featureKey: 'notification.policy' },
  { prefix: '/associations/configurations/reminders', featureKey: 'reminder.configuration' },
  { prefix: '/associations/settings/billing', featureKey: 'billing.entitlements' },
  { prefix: '/associations/users', featureKey: 'system.users.access' },
  { prefix: '/associations/settings/roles', featureKey: 'rbac.roles' },
  { prefix: '/associations/settings/associations/config', featureKey: 'system.settings' },
  { prefix: '/associations/settings/membership-number', featureKey: 'membership.id.format' },
  { prefix: '/associations/settings/sms-sender-config', featureKey: 'sms.sender.configuration' },
  { prefix: '/associations/settings/document-categories', featureKey: 'document.categories' },
  { prefix: '/associations/settings/bank-accounts', featureKey: 'bank.account.details' },
  { prefix: '/associations/settings/registration-integration', featureKey: 'registration.integration' },
  { prefix: '/associations/settings/union-settings', featureKey: 'union.settings' },
  { prefix: '/associations/attendance/record-attendance', featureKey: 'record.attendance' },
  { prefix: '/associations/attendance/schedule-fine', featureKey: 'generate.meeting.fine' },
  { prefix: '/associations/attendance', featureKey: 'manage.attendance' },
  { prefix: '/associations/union/reports', featureKey: 'union.reports.exports' },
  { prefix: '/member/dashboard', featureKey: 'member.dashboard' },
  { prefix: '/member/profile/security', featureKey: 'member.security' },
  { prefix: '/member/profile', featureKey: 'member.profile' },
  { prefix: '/member/certificates', featureKey: 'member.certificates' },
  { prefix: '/member/subscription-history', featureKey: 'member.subscription.history' },
  { prefix: '/member/subscription', featureKey: 'member.subscription' },
  { prefix: '/member/packages', featureKey: 'member.subscription' },
  { prefix: '/member/registration/complete', featureKey: 'member.self.registration' },
  { prefix: '/member/voting', featureKey: 'member.voting' },
  { prefix: '/member/directory', featureKey: 'member.directory' },
  { prefix: '/member/events', featureKey: 'member.events' },
  { prefix: '/member/job-posts', featureKey: 'member.job.posts' },
  { prefix: '/member/tenders', featureKey: 'member.tenders' },
  { prefix: '/member/news', featureKey: 'member.news' },
  { prefix: '/member/invoices', featureKey: 'member.invoices' },
  { prefix: '/member/wallet', featureKey: 'member.wallet' },
  { prefix: '/member/pay/generic', featureKey: 'member.make.payment' },
  { prefix: '/member/revenue-transactions/calender', featureKey: 'member.calendar' },
  { prefix: '/member/revenue-transactions', featureKey: 'member.contributions' },
  { prefix: '/member/loans', featureKey: 'member.loans' },
  { prefix: '/member/deductions/calendar', featureKey: 'member.deductions.calendar' },
  { prefix: '/member/deductions', featureKey: 'member.deductions' },
  { prefix: '/member/offline', featureKey: 'member.offline.support' },
];

const associationTypeRestrictions: AssociationTypeRouteRestriction[] = [
  { prefix: '/associations/loans', allowed: ['VIKOBA', 'SACCOS'] },
  { prefix: '/associations/group-config', allowed: ['VIKOBA', 'SACCOS'] },
  { prefix: '/associations/year-end-close', allowed: ['VIKOBA'] },
  { prefix: '/associations/savings/capture', allowed: ['SACCOS'] },
  { prefix: '/associations/reports/saccos-savings', allowed: ['SACCOS'] },
  { prefix: '/associations/revenue-transactions/create', allowed: ['VIKOBA', 'SACCOS'] },
  { prefix: '/associations/revenue-transactions/calender', allowed: ['VIKOBA'] },
  { prefix: '/associations/revenue-transactions/member-page', allowed: ['VIKOBA', 'SACCOS'] },
  { prefix: '/associations/revenue-transactions/over-due', allowed: ['VIKOBA'] },
  { prefix: '/associations/revenue-transactions/export', allowed: ['VIKOBA', 'SACCOS', 'UNION'] },
  { prefix: '/associations/revenue-transactions/fine-management', allowed: ['VIKOBA'] },
  { prefix: '/associations/revenue-transactions/revenue-tracking', allowed: ['VIKOBA'] },
  { prefix: '/associations/statements', allowed: ['VIKOBA'] },
  { prefix: '/associations/revenue-transactions/share-reconciliation', allowed: ['VIKOBA', 'SACCOS'] },
  { prefix: '/associations/revenue-transactions/share-fines', allowed: ['VIKOBA'] },
  { prefix: '/associations/revenue-transactions/share-distribution', allowed: ['VIKOBA'] },
  { prefix: '/associations/revenue-transactions/dividends', allowed: ['VIKOBA', 'SACCOS'] },
  { prefix: '/associations/revenue-transactions/batch-create', allowed: ['VIKOBA'] },
  { prefix: '/associations/revenue-transactions/bulk/import', allowed: ['VIKOBA'] },
  { prefix: '/associations/revenue-transactions/bulk', allowed: ['VIKOBA'] },
  { prefix: '/associations/attendance/schedule-fine', allowed: ['VIKOBA'] },
  { prefix: '/member/loans', allowed: ['VIKOBA', 'SACCOS'] },
  { prefix: '/associations/packages', allowed: ['GENERIC'] },
  { prefix: '/associations/subscriptions', allowed: ['GENERIC'] },
  { prefix: '/associations/settings/registration-integration', allowed: ['GENERIC'] },
  { prefix: '/member/packages', allowed: ['GENERIC'] },
  { prefix: '/member/subscription', allowed: ['GENERIC'] },
  { prefix: '/member/subscription-history', allowed: ['GENERIC'] },
  { prefix: '/member/certificates', allowed: ['GENERIC'] },
  { prefix: '/associations/members/union', allowed: ['UNION'] },
  { prefix: '/associations/union', allowed: ['UNION'] },
  { prefix: '/associations/settings/union-settings', allowed: ['UNION'] },
  { prefix: '/member/deductions', allowed: ['UNION'] },
];

const titleOverrides: Record<string, string> = {
  '/admin/associations': 'All Associations',
  '/admin/associations/new': 'Register Association',
  '/admin/finance/withdrawals': 'Withdrawal Finance',
  '/admin/impersonate/handoff': 'Impersonation Handoff',
  '/admin/offline': 'Offline Support',
  '/admin/password-reset': 'Password Reset',
  '/admin/profile-picture': 'Profile Picture',
  '/admin/reports/overview': 'Reports Overview',
  '/associations/all-dashboard': 'All Associations Dashboard',
  '/associations/attendance': 'Meeting Attendance',
  '/associations/attendance/schedule-fine': 'Generate Meeting Fine',
  '/associations/clients': 'Clients',
  '/associations/configurations/notifications': 'Notification Policy',
  '/associations/configurations/reminders': 'Reminder Configuration',
  '/associations/dashboard': 'Dashboard',
  '/associations/dashboard/union': 'Union Dashboard',
  '/associations/disbursements': 'Disbursements',
  '/associations/events/manage': 'Manage Events',
  '/associations/expenses/manage': 'Manage Expenses',
  '/associations/group-config': 'Loan Group Configuration',
  '/associations/group-config/:id': 'Loan Configuration Details',
  '/associations/group-config/create': 'Create Loan Configuration',
  '/associations/group-config/edit/:id': 'Edit Loan Configuration',
  '/associations/invoices': 'Invoices',
  '/associations/loans': 'Manage Loans',
  '/associations/members-voice': 'Members Voice',
  '/associations/members': 'Manage Members',
  '/associations/members/:memberId': 'Member Profile',
  '/associations/members/:memberId/documents': 'Member Documents',
  '/associations/members/:memberId/edit': 'Edit Member',
  '/associations/members/:memberId/invoices': 'Member Invoices',
  '/associations/members/import': 'Import Members',
  '/associations/members/new': 'Add Member',
  '/associations/members/union/deduction-upload': 'Union Deduction Upload',
  '/associations/my-associations': 'My Associations',
  '/associations/packages': 'Packages',
  '/associations/pay/generic': 'Self-Service Payment',
  '/associations/posts/manage': 'Manage Posts',
  '/associations/reports/income-statement': 'Income Statement',
  '/associations/reports/sms': 'SMS Report',
  '/associations/reports/statistics': 'Statistics Report',
  '/associations/reports/saccos-savings': 'Savings & Shares Report',
  '/associations/revenue-transactions': 'Manage Transactions',
  '/associations/revenue-transactions/batch-create': 'Import Transactions',
  '/associations/revenue-transactions/bulk/import': 'Bulk Import Transactions',
  '/associations/revenue-transactions/bulk': 'Batch Update Transactions',
  '/associations/revenue-transactions/calender': 'Payment Calendar',
  '/associations/revenue-transactions/fine-management': 'Fine Management',
  '/associations/revenue-transactions/magic-link': 'Payment Magic Link',
  '/associations/revenue-transactions/member-page': 'Member Transaction History',
  '/associations/revenue-transactions/over-due': 'Overdue Transactions',
  '/associations/revenue-transactions/revenue-tracking': 'Revenue Tracking',
  '/associations/revenue-transactions/share-distribution': 'Share Distribution',
  '/associations/revenue-transactions/share-fines': 'Share Fine Generator',
  '/associations/revenue-transactions/share-reconciliation': 'Share Reconciliation',
  '/associations/savings/capture': 'Capture Savings',
  '/associations/settings/associations/assoc-conf': 'Association Configuration',
  '/associations/settings/associations/config': 'Configuration Editor',
  '/associations/settings/bank-accounts': 'Bank Accounts',
  '/associations/settings/billing': 'Billing Entitlements',
  '/associations/settings/business-types': 'Business Types',
  '/associations/settings/document-categories': 'Document Categories',
  '/associations/settings/membership-number': 'Membership ID Format',
  '/associations/settings/offline': 'Offline Support',
  '/associations/settings/profile-picture': 'Profile Picture',
  '/associations/settings/registration-integration': 'Registration Integration',
  '/associations/settings/roles': 'Roles & Permissions',
  '/associations/settings/sms-sender-config': 'SMS Sender Configuration',
  '/associations/settings/union-settings': 'Union Settings',
  '/associations/statements': 'Member Statements',
  '/associations/statements/:memberId': 'Member Statement Details',
  '/associations/subscriptions/subscribe-member': 'Subscribe Member',
  '/associations/transactions/reconcile': 'Payment Reconciliation',
  '/associations/union/reports': 'Union Reports',
  '/associations/users': 'Users',
  '/associations/users/new': 'Add User',
  '/associations/vefd-receipts': 'VEFD Receipts',
  '/associations/wallet': 'Wallet',
  '/associations/wallet/approve-withdrawals': 'Withdrawal Approvals',
  '/associations/year-end-close': 'Year-End Close',
  '/member/:memberId/edit': 'Edit Member Profile',
  '/member/dashboard': 'Dashboard',
  '/member/deductions/calendar': 'Deductions Calendar',
  '/member/deductions': 'Deductions',
  '/member/directory': 'Member Directory',
  '/member/events': 'Events',
  '/member/invoices': 'Invoices',
  '/member/job-posts': 'Job Posts',
  '/member/loans': 'Loans',
  '/member/offline': 'Offline Support',
  '/member/packages': 'Packages',
  '/member/packages/subscribe/:packageId': 'Subscribe Package',
  '/member/pay/generic': 'Make Payment',
  '/member/profile': 'Profile',
  '/member/profile/security': 'Security',
  '/member/registration/complete': 'Complete Registration',
  '/member/registration/status/:memberId': 'Registration Status',
  '/member/revenue-transactions': 'My Contributions',
  '/member/revenue-transactions/:id': 'Contribution Receipt',
  '/member/revenue-transactions/calender': 'Contribution Calendar',
  '/member/subscription-history': 'Subscription History',
  '/member/upload-document/:memberId/documents': 'Upload Documents',
};

function makeRoute(path: string, role: MobileRole): MobileRouteItem {
  const module = inferModule(path);
  const title = titleOverrides[path] || deriveTitle(path);
  const dynamic = path.includes('/:');
  const permissionRequirement = getRoutePermissionRequirement(path);

  return {
    id: `${role}-${path.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
    title,
    path,
    role,
    module,
    description: buildRouteDescription(path, title, module),
    keywords: buildKeywords(path, title, module, role),
    dynamic,
    primary: primaryRoutes.has(path),
    requiredPermissions: permissionRequirement.allOf,
    anyPermissions: permissionRequirement.anyOf,
    billingFeatureKey: getBillingFeatureKeyForPath(path),
    allowedAssociationTypes: getAllowedAssociationTypesForPath(path),
    icon: inferRouteIcon(path, module),
    source: 'frontend-app-route',
  };
}

function getRoutePermissionRequirement(path: string) {
  const match = routePermissionRules
    .filter((rule) => matchesRoutePrefix(path, rule.prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0];

  return {
    allOf: match?.permissions ?? (match?.permission ? [match.permission] : []),
    anyOf: match?.anyPermissions ?? [],
  };
}

function getBillingFeatureKeyForPath(path: string) {
  return billingFeatureRules
    .filter((rule) => matchesRoutePrefix(path, rule.prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0]?.featureKey ?? null;
}

function getAllowedAssociationTypesForPath(path: string) {
  return associationTypeRestrictions
    .filter((restriction) => matchesRoutePrefix(path, restriction.prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0]?.allowed;
}

function buildRouteDescription(path: string, title: string, module: MobileRouteModule) {
  const override = routeDescriptionOverrides[path];
  if (override) return override;

  const moduleLabel = moduleCatalog[module].label.toLowerCase();
  return `Open ${title.toLowerCase()} under ${moduleLabel}.`;
}

const routeDescriptionOverrides: Record<string, string> = {
  '/admin/associations': 'Review associations, open account details, and support organization setup.',
  '/admin/billing': 'Manage platform billing, subscriptions, plans, and invoice follow-up.',
  '/admin/dashboard': 'See the platform overview, alerts, and high-level operating numbers.',
  '/admin/finance': 'Review platform finance activity and payment operations.',
  '/admin/messaging': 'Send and monitor platform messages for association administrators.',
  '/admin/system': 'Review system health, settings, and operational controls.',
  '/associations/attendance': 'Review meetings, attendance records, corrections, and attendance fines.',
  '/associations/clients': 'Manage clients, billing contacts, and organization relationships.',
  '/associations/dashboard': 'See the association overview, alerts, recent activity, and key numbers.',
  '/associations/events/manage': 'Create, publish, and manage association events.',
  '/associations/expenses/manage': 'Track expenses, categories, approvals, and supporting details.',
  '/associations/governance/documents': 'Manage governance documents and official association records.',
  '/associations/invoices': 'Review invoices, payment status, and invoice details.',
  '/associations/loans': 'Review loan requests, active loans, repayments, and loan activity.',
  '/associations/members': 'View and update member records.',
  '/associations/members/:memberId': 'Open a member profile.',
  '/associations/members/:memberId/documents': 'Review and upload member documents.',
  '/associations/members/:memberId/edit': 'Update member details.',
  '/associations/members/:memberId/invoices': 'Review invoices for a member.',
  '/associations/members/import': 'Upload member records in bulk.',
  '/associations/members/new': 'Register a new member.',
  '/associations/pay/generic': 'Record or initiate a payment for shares, fines, loans, wallet, or other purposes.',
  '/associations/reports/statistics': 'Review association statistics and operational reports.',
  '/associations/revenue-transactions': 'Review member payments, contributions, balances, and transaction history.',
  '/associations/revenue-transactions/create': 'Record a member payment or contribution.',
  '/associations/revenue-transactions/import': 'Import contribution and payment records from a file.',
  '/associations/revenue/manage': 'Manage revenue sources, income records, and supporting details.',
  '/associations/profile': 'Review association profile and contact details.',
  '/associations/profile/edit': 'Update association profile details.',
  '/associations/settings/membership-number': 'Configure the membership number format.',
  '/associations/settings/roles': 'Manage roles, permissions, and staff access for the association.',
  '/associations/statements': 'Review member statements and financial summaries.',
  '/associations/wallet': 'Review wallet balances, withdrawals, and wallet activity.',
  '/associations/wallet/approve-withdrawals': 'Review pending withdrawal requests and past approval decisions.',
  '/member/dashboard': 'See your member overview, balances, payments, loans, and recent activity.',
  '/member/directory': 'Find association members and view shared contact details.',
  '/member/events': 'View upcoming association events and participation details.',
  '/member/invoices': 'Review invoices, balances, and payment status.',
  '/member/loans': 'Track loan requests, repayments, and loan status.',
  '/member/pay/generic': 'Make a payment for contributions, invoices, loans, wallet, or other purposes.',
  '/member/profile': 'Review and update your profile, contacts, documents, and account details.',
  '/member/revenue-transactions': 'View your contributions, payments, and receipts.',
  '/member/wallet': 'Review your wallet balance, transactions, and withdrawal requests.',
};

function inferModule(path: string): MobileRouteModule {
  if (path.startsWith('/admin')) {
    if (path === '/admin/dashboard') return 'dashboard';
    if (
      path.startsWith('/admin/audit') ||
      path.startsWith('/admin/jobs') ||
      path.startsWith('/admin/messaging') ||
      path.startsWith('/admin/offline') ||
      path.startsWith('/admin/password-reset') ||
      path.startsWith('/admin/profile-picture') ||
      path.startsWith('/admin/system')
    ) {
      return 'system';
    }
    if (path.startsWith('/admin/finance') || path.startsWith('/admin/disbursements')) return 'finance';
    if (path.startsWith('/admin/reports')) return 'reports';
    return 'admin';
  }

  if (path.includes('/dashboard')) return path.includes('/union') ? 'union' : 'dashboard';
  if (path.includes('/attendance')) return 'attendance';
  if (path.includes('/governance') || path.endsWith('/voting')) return 'governance';
  if (path.includes('/crm')) return 'crm';
  if (path.startsWith('/associations/settings') || path.includes('/users') || path.includes('/my-associations')) return 'settings';
  if (path.startsWith('/associations/profile')) return 'association';
  if (path.includes('/loans') || path.includes('/group-config')) return 'loans';
  if (path.includes('/wallet') || path.includes('/pay/') || path.includes('/disbursements') || path.includes('/transactions/reconcile')) {
    return 'wallet';
  }
  if (path.includes('/invoices') || path.includes('/clients') || path.includes('/vefd-receipts')) return 'billing';
  if (
    path.includes('/events') ||
    path.includes('/posts') ||
    path.includes('/jobs') ||
    path.includes('/news') ||
    path.includes('/tenders') ||
    path.includes('/members-voice') ||
    path.includes('/configurations/')
  ) {
    return 'community';
  }
  if (path.includes('/union') || path.includes('/deductions')) return 'union';
  if (
    path.includes('/members') ||
    path.includes('/directory') ||
    path.includes('/certificates') ||
    path.includes('/notifications') ||
    (path.startsWith('/member') && path.includes('/profile'))
  ) {
    return 'members';
  }
  if (path.includes('/packages') || path.includes('/subscription') || path.includes('/registration')) return 'subscriptions';
  if (path.includes('/reports')) return 'reports';
  if (path.includes('/settings')) return 'settings';
  if (path.includes('/revenue') || path.includes('/savings') || path.includes('/expenses') || path.includes('/statements') || path.includes('/year-end-close')) return 'finance';
  return path.startsWith('/member') ? 'members' : 'association';
}

function deriveTitle(path: string) {
  const parts = path.split('/').filter(Boolean);
  const usable = parts.filter((part) => !part.startsWith(':') && !['admin', 'associations', 'association', 'member'].includes(part));
  const tail = usable.slice(-2).join(' ');
  return humanize(tail || usable[usable.length - 1] || path);
}

function humanize(input: string) {
  return input
    .replace(/calender/g, 'calendar')
    .replace(/vefd/g, 'VEFD')
    .replace(/crm/g, 'CRM')
    .replace(/sms/g, 'SMS')
    .replace(/rbac/g, 'RBAC')
    .replace(/id/g, 'ID')
    .replace(/[-_/]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => (word === word.toUpperCase() ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}

function buildKeywords(path: string, title: string, module: MobileRouteModule, role: MobileRole) {
  return [
    title,
    path,
    module,
    moduleCatalog[module].label,
    role,
    roleLabels[role].label,
    ...path.split('/').filter(Boolean),
  ].map((part) => part.toLowerCase());
}

function matchesRoutePrefix(pathname: string, prefix: string) {
  if (!prefix.includes(':')) {
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  }

  const pathnameSegments = pathname.split('/').filter(Boolean);
  const prefixSegments = prefix.split('/').filter(Boolean);
  if (prefixSegments.length > pathnameSegments.length) return false;

  return prefixSegments.every((segment, index) => {
    const pathSegment = pathnameSegments[index];
    return segment.startsWith(':') || pathSegment?.startsWith(':') || segment === pathSegment;
  });
}

export const mobileRouteRegistry: MobileRouteItem[] = [
  ...associationRoutePaths.map((path) => makeRoute(path, 'association-admin')),
  ...memberRoutePaths.map((path) => makeRoute(path, 'member')),
  ...systemAdminRoutePaths.map((path) => makeRoute(path, 'system-admin')),
];

export const mobileRouteInventoryCounts = {
  total: mobileRouteRegistry.length,
  associationAdmin: associationRoutePaths.length,
  member: memberRoutePaths.length,
  systemAdmin: systemAdminRoutePaths.length,
};

export function coerceMobileRole(value: unknown): MobileRole {
  const raw = Array.isArray(value) ? value[0] : value;
  return mobileRoles.includes(raw as MobileRole) ? (raw as MobileRole) : 'association-admin';
}

export function coerceMobileModule(value: unknown, fallback: MobileRouteModule = 'dashboard'): MobileRouteModule {
  const raw = Array.isArray(value) ? value[0] : value;
  return Object.prototype.hasOwnProperty.call(moduleCatalog, String(raw)) ? (raw as MobileRouteModule) : fallback;
}

export function getRoutesForRole(role: MobileRole) {
  return mobileRouteRegistry.filter((route) => route.role === role);
}

export function getRouteById(id: string | string[] | undefined) {
  const routeId = Array.isArray(id) ? id[0] : id;
  return mobileRouteRegistry.find((route) => route.id === routeId);
}

export function getRouteByPath(path: string) {
  return mobileRouteRegistry.find((route) => route.path === path);
}

export function getModuleSummariesForRole(role: MobileRole): MobileModuleSummary[] {
  const routes = getRoutesForRole(role);
  const summaries = Object.entries(moduleCatalog)
    .map(([id, meta]) => {
      const moduleRoutes = routes.filter((route) => route.module === id);
      return {
        id: id as MobileRouteModule,
        label: meta.label,
        description: meta.description,
        routeCount: moduleRoutes.length,
        dynamicCount: moduleRoutes.filter((route) => route.dynamic).length,
        primaryCount: moduleRoutes.filter((route) => route.primary).length,
        tone: meta.tone,
        icon: meta.icon,
        order: meta.order,
      };
    })
    .filter((summary) => summary.routeCount > 0)
    .sort((a, b) => a.order - b.order);

  return summaries.map(({ order: _order, ...summary }) => summary);
}

export function getRoutesForModule(role: MobileRole, module: MobileRouteModule) {
  return getRoutesForRole(role)
    .filter((route) => route.module === module)
    .sort((a, b) => Number(b.primary) - Number(a.primary) || a.title.localeCompare(b.title));
}

export function searchMobileRoutes(query: string, options?: { role?: MobileRole; module?: MobileRouteModule }) {
  const normalized = query.trim().toLowerCase();
  const scoped = mobileRouteRegistry.filter((route) => {
    if (options?.role && route.role !== options.role) return false;
    if (options?.module && route.module !== options.module) return false;
    return true;
  });

  if (!normalized) {
    return scoped.sort((a, b) => Number(b.primary) - Number(a.primary) || a.title.localeCompare(b.title));
  }

  return scoped
    .filter((route) => route.keywords.some((keyword) => keyword.includes(normalized)))
    .sort((a, b) => Number(b.primary) - Number(a.primary) || a.title.localeCompare(b.title));
}

export function getRouteStatus(route: MobileRouteItem): { label: string; tone: StatusTone } {
  if (route.primary) return { label: 'Common', tone: 'primary' };
  return { label: 'Open', tone: 'neutral' };
}

function inferRouteIcon(path: string, module: MobileRouteModule): LucideIcon {
  if (path.includes('/notifications')) return BellRing;
  if (path.includes('/events') || path.includes('/calendar') || path.includes('/calender')) return CalendarDays;
  if (path.includes('/pay') || path.includes('/billing')) return CreditCard;
  if (path.includes('/jobs')) return BriefcaseBusiness;
  if (path.includes('/voting')) return Vote;
  if (path.includes('/search')) return Search;
  if (path.includes('/reports') || path.includes('/statement')) return FileBarChart;
  if (path.includes('/documents') || path.includes('/profile')) return FileText;
  return moduleCatalog[module].icon;
}

export function getRouteIcon(route: MobileRouteItem): LucideIcon {
  return route.icon;
}
