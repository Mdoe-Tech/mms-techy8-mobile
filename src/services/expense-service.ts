import { apiEnvelopeRequest, apiRequest } from '@/api/client';

export type ExpenseCategory = {
  id: string;
  name: string;
  description?: string | null;
  associationId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  version?: number | null;
};

export type ExpenseUserSummary = {
  id?: string | null;
  username?: string | null;
  fullName?: string | null;
};

export type Expense = {
  id: string;
  associationId?: string | null;
  expenseCategory?: ExpenseCategory | null;
  supplierName?: string | null;
  transactionDate: string;
  amount: number;
  description?: string | null;
  receiptPath?: string | null;
  supportingDocumentPath?: string | null;
  paymentMethod?: string | null;
  recordedBy?: ExpenseUserSummary | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  version?: number | null;
};

export type ExpensePayload = {
  expenseCategoryId: string;
  supplierName?: string | null;
  transactionDate: string;
  amount: number;
  description?: string | null;
  paymentMethod?: string | null;
  supportingDocumentPath?: string | null;
  recordedById?: string | null;
};

export type ExpensePage = {
  expenses: Expense[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type ExpenseCategoryPage = {
  categories: ExpenseCategory[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type TotalExpenses = {
  associationId?: string | null;
  totalAmount: number;
  startDate: string;
  endDate: string;
};

export type ExpenseListFilters = {
  page?: number;
  size?: number;
  sort?: string;
  startDate?: string;
  endDate?: string;
};

export async function getAssociationExpenses(
  associationId: string,
  filters: ExpenseListFilters = {},
): Promise<ExpensePage> {
  const query = new URLSearchParams();
  query.set('page', String(filters.page ?? 0));
  query.set('size', String(filters.size ?? 100));
  query.set('sort', filters.sort || 'transactionDate,desc');
  if (filters.startDate) query.set('startDate', filters.startDate);
  if (filters.endDate) query.set('endDate', filters.endDate);

  const response = await apiEnvelopeRequest<unknown>(
    `/associations/${encodeURIComponent(associationId)}/expenses?${query.toString()}`,
  );
  return normalizeExpensePage(response, filters.size ?? 100);
}

export async function getAssociationExpense(associationId: string, expenseId: string) {
  const expense = await apiRequest<Expense>(
    `/associations/${encodeURIComponent(associationId)}/expenses/${encodeURIComponent(expenseId)}`,
  );
  return normalizeExpense(expense);
}

export async function createAssociationExpense(associationId: string, payload: ExpensePayload) {
  const expense = await apiRequest<Expense>(`/associations/${encodeURIComponent(associationId)}/expenses`, {
    method: 'POST',
    body: normalizeExpensePayload(payload),
  });
  return normalizeExpense(expense);
}

export async function updateAssociationExpense(associationId: string, expenseId: string, payload: ExpensePayload) {
  const expense = await apiRequest<Expense>(
    `/associations/${encodeURIComponent(associationId)}/expenses/${encodeURIComponent(expenseId)}`,
    {
      method: 'PUT',
      body: normalizeExpensePayload(payload),
    },
  );
  return normalizeExpense(expense);
}

export function deleteAssociationExpense(associationId: string, expenseId: string) {
  return apiRequest<void>(
    `/associations/${encodeURIComponent(associationId)}/expenses/${encodeURIComponent(expenseId)}`,
    { method: 'DELETE' },
  );
}

export async function duplicateAssociationExpense(associationId: string, expenseId: string) {
  const expense = await apiRequest<Expense>(
    `/associations/${encodeURIComponent(associationId)}/expenses/${encodeURIComponent(expenseId)}/duplicate`,
    { method: 'POST' },
  );
  return normalizeExpense(expense);
}

export async function getAssociationExpenseTotal(
  associationId: string,
  startDate: string,
  endDate: string,
): Promise<TotalExpenses> {
  const query = new URLSearchParams({ startDate, endDate });
  const total = await apiRequest<TotalExpenses>(
    `/associations/${encodeURIComponent(associationId)}/expenses/summary/total?${query.toString()}`,
  );
  return {
    ...total,
    totalAmount: toNumber(total?.totalAmount),
    startDate: total?.startDate || startDate,
    endDate: total?.endDate || endDate,
  };
}

export async function getAssociationExpenseCategories(
  associationId: string,
  filters: { page?: number; size?: number; sort?: string } = {},
): Promise<ExpenseCategoryPage> {
  const query = new URLSearchParams();
  query.set('page', String(filters.page ?? 0));
  query.set('size', String(filters.size ?? 100));
  query.set('sort', filters.sort || 'name,asc');

  const response = await apiEnvelopeRequest<unknown>(
    `/associations/${encodeURIComponent(associationId)}/expense-categories?${query.toString()}`,
  );
  return normalizeCategoryPage(response, filters.size ?? 100);
}

export async function createAssociationExpenseCategory(
  associationId: string,
  payload: { name: string; description?: string | null },
) {
  const category = await apiRequest<ExpenseCategory>(
    `/associations/${encodeURIComponent(associationId)}/expense-categories`,
    {
      method: 'POST',
      body: {
        name: payload.name.trim(),
        description: textOrNull(payload.description),
      },
    },
  );
  return normalizeCategory(category);
}

export async function updateAssociationExpenseCategory(
  associationId: string,
  categoryId: string,
  payload: { name: string; description?: string | null },
) {
  const category = await apiRequest<ExpenseCategory>(
    `/associations/${encodeURIComponent(associationId)}/expense-categories/${encodeURIComponent(categoryId)}`,
    {
      method: 'PUT',
      body: {
        name: payload.name.trim(),
        description: textOrNull(payload.description),
      },
    },
  );
  return normalizeCategory(category);
}

export function deleteAssociationExpenseCategory(associationId: string, categoryId: string) {
  return apiRequest<void>(
    `/associations/${encodeURIComponent(associationId)}/expense-categories/${encodeURIComponent(categoryId)}`,
    { method: 'DELETE' },
  );
}

function normalizeExpensePage(
  envelope: {
    data?: unknown;
    page?: number | string | null;
    size?: number | string | null;
    totalElements?: number | string | null;
    totalPages?: number | string | null;
  },
  fallbackSize: number,
): ExpensePage {
  const payload = envelope.data as { content?: Expense[] } | Expense[] | null;
  const expenses = (Array.isArray(payload) ? payload : Array.isArray(payload?.content) ? payload.content : []).map(normalizeExpense);

  return {
    expenses,
    page: Number(envelope.page ?? 0),
    size: Number(envelope.size ?? fallbackSize),
    totalElements: Number(envelope.totalElements ?? expenses.length),
    totalPages: Number(envelope.totalPages ?? 1),
  };
}

function normalizeCategoryPage(
  envelope: {
    data?: unknown;
    page?: number | string | null;
    size?: number | string | null;
    totalElements?: number | string | null;
    totalPages?: number | string | null;
  },
  fallbackSize: number,
): ExpenseCategoryPage {
  const payload = envelope.data as { content?: ExpenseCategory[] } | ExpenseCategory[] | null;
  const categories = (Array.isArray(payload) ? payload : Array.isArray(payload?.content) ? payload.content : []).map(normalizeCategory);

  return {
    categories,
    page: Number(envelope.page ?? 0),
    size: Number(envelope.size ?? fallbackSize),
    totalElements: Number(envelope.totalElements ?? categories.length),
    totalPages: Number(envelope.totalPages ?? 1),
  };
}

function normalizeExpense(expense: Expense): Expense {
  return {
    ...expense,
    amount: toNumber(expense?.amount),
    transactionDate: expense?.transactionDate || '',
    expenseCategory: expense?.expenseCategory ? normalizeCategory(expense.expenseCategory) : null,
  };
}

function normalizeCategory(category: ExpenseCategory): ExpenseCategory {
  return {
    ...category,
    name: category?.name || 'Uncategorized',
  };
}

function normalizeExpensePayload(payload: ExpensePayload) {
  return {
    expenseCategoryId: payload.expenseCategoryId,
    supplierName: textOrNull(payload.supplierName),
    transactionDate: payload.transactionDate,
    amount: toNumber(payload.amount),
    description: textOrNull(payload.description),
    paymentMethod: textOrNull(payload.paymentMethod),
    supportingDocumentPath: textOrNull(payload.supportingDocumentPath),
    recordedById: textOrNull(payload.recordedById),
  };
}

function toNumber(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function textOrNull(value?: string | null) {
  const trimmed = String(value || '').trim();
  return trimmed ? trimmed : null;
}
