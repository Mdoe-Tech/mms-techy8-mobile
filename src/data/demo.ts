import { formatTzs } from '@/utils/format';

export const statusTabs = [
  { value: 'all', label: 'All', count: 42 },
  { value: 'paid', label: 'Paid', count: 26 },
  { value: 'pending', label: 'Pending', count: 8 },
  { value: 'overdue', label: 'Overdue', count: 5 },
  { value: 'review', label: 'Review', count: 3 },
];

export const moneyMovements = [
  {
    id: 'txn-1',
    title: 'Upendo Fatukubonye',
    subtitle: 'Weekly shares payment',
    meta: 'Today · MBR-0032',
    amount: formatTzs(20000),
    status: 'Paid',
    accent: 'paid' as const,
  },
  {
    id: 'txn-2',
    title: 'Issa Mdoe',
    subtitle: 'Loan repayment',
    meta: 'Today · Reference 9912',
    amount: formatTzs(50000),
    status: 'Pending',
    accent: 'warning' as const,
  },
  {
    id: 'txn-3',
    title: 'Rehema John',
    subtitle: 'Event registration',
    meta: 'Yesterday · AGM 2026',
    amount: formatTzs(15000),
    status: 'Completed',
    accent: 'success' as const,
  },
];

export const approvalQueue = [
  {
    id: 'approval-1',
    title: 'Withdrawal request',
    subtitle: 'Amina Joseph requested funds',
    meta: 'Needs treasurer approval',
    amount: formatTzs(350000),
    status: 'Review',
    accent: 'review' as const,
  },
  {
    id: 'approval-2',
    title: 'Loan request',
    subtitle: 'Juma Ally requested a new loan',
    meta: '2 guarantors attached',
    amount: formatTzs(1200000),
    status: 'Pending',
    accent: 'warning' as const,
  },
];

export const memberActivities = [
  {
    id: 'member-act-1',
    title: 'Weekly shares due',
    subtitle: 'Pay before Friday to avoid fines',
    meta: 'Due in 3 days',
    amount: formatTzs(20000),
    status: 'Due',
    accent: 'warning' as const,
  },
  {
    id: 'member-act-2',
    title: 'Loan repayment',
    subtitle: 'Monthly installment',
    meta: 'Due 12 July 2026',
    amount: formatTzs(80000),
    status: 'Pending',
    accent: 'warning' as const,
  },
  {
    id: 'member-act-3',
    title: 'AGM registration',
    subtitle: 'Annual General Meeting',
    meta: 'Registered successfully',
    amount: formatTzs(0),
    status: 'Completed',
    accent: 'success' as const,
  },
];

export const recordTabs = [
  { value: 'member', label: 'Member', count: 1 },
  { value: 'transaction', label: 'Transaction', count: 1 },
  { value: 'loan', label: 'Loan', count: 1 },
  { value: 'approval', label: 'Approval', count: 2 },
  { value: 'event', label: 'Event', count: 1 },
  { value: 'invoice', label: 'Invoice', count: 1 },
];

export const recordTimeline = [
  {
    id: 'tl-1',
    title: 'Record created',
    description: 'Captured by association officer from the mobile preview.',
    time: '09:12',
    tone: 'info' as const,
  },
  {
    id: 'tl-2',
    title: 'Payment verified',
    description: 'Mobile money reference matched the member record.',
    time: '09:16',
    tone: 'success' as const,
  },
  {
    id: 'tl-3',
    title: 'Receipt ready',
    description: 'Receipt can be downloaded or shared with the member.',
    time: '09:18',
    tone: 'paid' as const,
  },
];

export const memberDocuments = [
  { title: 'National ID', meta: 'PDF · uploaded 12 Jan 2025', status: 'Verified' },
  { title: 'Membership form', meta: 'Signed copy · 2 pages', status: 'Approved' },
];
