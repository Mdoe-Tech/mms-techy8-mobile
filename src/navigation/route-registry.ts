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
    label: 'Association Admin',
    description: 'Back-office routes for officers managing members, money, governance, and settings.',
  },
  member: {
    short: 'Member',
    label: 'Member Portal',
    description: 'Self-service routes for members to view, pay, request, and participate.',
  },
  'system-admin': {
    short: 'System',
    label: 'System Admin',
    description: 'Platform routes for super admins, observability, finance, billing, and support.',
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
  '/associations/attendance/schedule-fine': 'Generate Meeting Fine',
  '/associations/configurations/notifications': 'Notification Policy',
  '/associations/configurations/reminders': 'Reminder Configuration',
  '/associations/dashboard/union': 'Union Dashboard',
  '/associations/group-config': 'Loan Group Configuration',
  '/associations/group-config/create': 'Create Loan Configuration',
  '/associations/group-config/edit/:id': 'Edit Loan Configuration',
  '/associations/members-voice': 'Members Voice',
  '/associations/members/union/deduction-upload': 'Union Deduction Upload',
  '/associations/my-associations': 'My Associations',
  '/associations/pay/generic': 'Self-Service Payment',
  '/associations/reports/income-statement': 'Income Statement',
  '/associations/reports/sms': 'SMS Report',
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
  '/associations/vefd-receipts': 'VEFD Receipts',
  '/associations/wallet/approve-withdrawals': 'Withdrawal Approvals',
  '/associations/year-end-close': 'Year-End Close',
  '/member/:memberId/edit': 'Edit Member Profile',
  '/member/deductions/calendar': 'Deductions Calendar',
  '/member/job-posts': 'Job Posts',
  '/member/offline': 'Offline Support',
  '/member/packages/subscribe/:packageId': 'Subscribe Package',
  '/member/pay/generic': 'Make Payment',
  '/member/profile/security': 'Security',
  '/member/registration/complete': 'Complete Registration',
  '/member/registration/status/:memberId': 'Registration Status',
  '/member/revenue-transactions': 'My Contributions',
  '/member/revenue-transactions/calender': 'Contribution Calendar',
  '/member/subscription-history': 'Subscription History',
  '/member/upload-document/:memberId/documents': 'Upload Documents',
};

function makeRoute(path: string, role: MobileRole): MobileRouteItem {
  const module = inferModule(path);
  const title = titleOverrides[path] || deriveTitle(path);
  const dynamic = path.includes('/:');

  return {
    id: `${role}-${path.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
    title,
    path,
    role,
    module,
    description: `${roleLabels[role].short} route in ${moduleCatalog[module].label}.`,
    keywords: buildKeywords(path, title, module, role),
    dynamic,
    primary: primaryRoutes.has(path),
    icon: inferRouteIcon(path, module),
    source: 'frontend-app-route',
  };
}

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
  if (path.includes('/members') || path.includes('/directory') || path.includes('/profile') || path.includes('/certificates') || path.includes('/notifications')) {
    return 'members';
  }
  if (path.includes('/packages') || path.includes('/subscription') || path.includes('/registration')) return 'subscriptions';
  if (path.includes('/reports')) return 'reports';
  if (path.includes('/union') || path.includes('/deductions')) return 'union';
  if (path.includes('/settings') || path.includes('/users') || path.includes('/my-associations')) return 'settings';
  if (path.includes('/revenue') || path.includes('/expenses') || path.includes('/statements') || path.includes('/year-end-close')) return 'finance';
  return path.startsWith('/member') ? 'members' : 'association';
}

function deriveTitle(path: string) {
  const parts = path.split('/').filter(Boolean);
  const usable = parts.filter((part) => !part.startsWith(':'));
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
  if (route.dynamic) return { label: 'Dynamic', tone: 'review' };
  if (route.primary) return { label: 'Primary', tone: 'primary' };
  return { label: 'Tracked', tone: 'neutral' };
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
