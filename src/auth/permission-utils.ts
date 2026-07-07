const IMPLIED_PERMISSION_KEYS: Record<string, string[]> = {
  'settings.update': ['settings.view'],
  'users.invite': ['users.view'],
  'users.update': ['users.view'],
  'users.deactivate': ['users.view'],
  'settings.view': ['members.lookup'],
  'members.view': ['members.lookup', 'member.self.view'],
  'members.create': ['members.view'],
  'members.update': ['members.view'],
  'members.deactivate': ['members.view'],
  'members.import': ['members.view'],
  'members.export': ['members.view'],
  'member.self.payments': ['member.self.view'],
  'subscriptions.view': ['members.lookup'],
  'subscriptions.manage': ['subscriptions.view'],
  'finance.transactions.view': ['members.lookup'],
  'finance.transactions.create': ['finance.transactions.view'],
  'finance.transactions.update': ['finance.transactions.view'],
  'finance.transactions.reconcile': ['finance.transactions.view'],
  'reports.view': ['members.lookup'],
  'reports.export': ['reports.view'],
  'loans.view': ['members.lookup'],
  'loans.create': ['loans.view'],
  'loans.approve': ['loans.view'],
  'loans.disburse': ['loans.view'],
  'wallets.view': ['members.lookup'],
  'wallets.withdrawals.approve': ['wallets.view'],
  'wallets.disburse': ['wallets.view'],
  'governance.manage': ['governance.view'],
  'community.manage': ['community.view', 'members.lookup'],
  'crm.manage': ['crm.view', 'members.lookup'],
  'union.manage': ['union.view', 'members.lookup'],
  'rbac.assignments.manage': ['users.view', 'members.view'],
  'rbac.roles.manage': ['settings.view'],
};

export const MEMBER_SELF_SERVICE_BASELINE = [
  'member.self.view',
  'member.self.payments',
  'subscriptions.view',
  'governance.view',
  'community.view',
] as const;

export function normalizePermissionKey(permissionKey?: string | null) {
  return String(permissionKey || '').trim().toLowerCase();
}

export function normalizeAccessValue(value?: string | null) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

export function expandPermissionKeys(permissionKeys: Iterable<string>) {
  const expanded = new Set<string>();
  for (const permissionKey of permissionKeys) {
    const normalized = normalizePermissionKey(permissionKey);
    if (normalized) expanded.add(normalized);
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const permissionKey of Array.from(expanded)) {
      for (const impliedPermission of IMPLIED_PERMISSION_KEYS[permissionKey] ?? []) {
        if (!expanded.has(impliedPermission)) {
          expanded.add(impliedPermission);
          changed = true;
        }
      }
    }
  }

  return expanded;
}
