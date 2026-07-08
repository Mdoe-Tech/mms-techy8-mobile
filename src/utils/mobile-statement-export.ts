import type {
  ContributionStatementTransaction,
  CumulatedSharesReportRow,
  GroupConfig,
  MembersStatement,
  ShareStatementTransaction,
  SharesStatement,
  StatementPeriodSummary,
} from '@/services/member-service';
import { formatCurrency, formatDate, formatNumber } from '@/utils/format';
import {
  createCustomExcelWorkbookReportFile,
  createCustomPdfReportFile,
  deliverPreparedMobileReportFile,
  type MobileExcelCell,
  type MobileExcelWorksheet,
  type MobileReportExportDestination,
} from '@/utils/mobile-report-export';

export type StatementKind = 'shares' | 'members';
export type StatementFileFormat = 'pdf' | 'excel';

type StatementExportContext = {
  associationName?: string | null;
  groupConfig?: GroupConfig | null;
  periodLabel: string;
  startDate?: string | null;
  endDate?: string | null;
  destination?: MobileReportExportDestination;
};

type ConsolidatedStatementExportOptions = StatementExportContext & {
  kind: StatementKind;
  statements: (SharesStatement | MembersStatement)[];
  format: StatementFileFormat;
};

type IndividualStatementExportOptions = StatementExportContext & {
  kind: StatementKind;
  statement: SharesStatement | MembersStatement;
  memberId?: string | null;
  format: StatementFileFormat;
};

type CumulatedSharesExportOptions = StatementExportContext & {
  rows: CumulatedSharesReportRow[];
};

const emptyDash = '-';

type ConsolidatedTotals = {
  totalShares: number;
  totalShareValue: number;
  currentNetShares: number;
  currentNetShareValue: number;
  social: number;
  finesPaid: number;
  finesUnpaid: number;
  penaltiesPaid: number;
  penaltiesUnpaid: number;
  loanBalance: number;
};

export async function exportConsolidatedStatementReport({
  kind,
  statements,
  format,
  destination = 'save',
  ...context
}: ConsolidatedStatementExportOptions) {
  const sortedStatements = sortStatements(statements);
  if (!sortedStatements.length) throw new Error(`No ${kind} statement data found for the selected period.`);

  const title = kind === 'shares' ? 'Consolidated Share Statements' : 'Consolidated Member Statements';
  const descriptor = {
    title,
    fileName: `consolidated-${kind}-statements-${safeToken(context.periodLabel)}`,
  };

  const file =
    format === 'pdf'
      ? await createCustomPdfReportFile(descriptor, buildConsolidatedStatementHtml(kind, sortedStatements, context), 'landscape')
      : await createCustomExcelWorkbookReportFile(descriptor, [buildConsolidatedStatementWorksheet(kind, sortedStatements, context)]);

  return deliverPreparedMobileReportFile(descriptor, file, format, destination);
}

export async function exportIndividualStatementReport({
  kind,
  statement,
  memberId,
  format,
  destination = 'save',
  ...context
}: IndividualStatementExportOptions) {
  const title = kind === 'shares' ? 'Share Statement' : 'Member Statement';
  const memberToken = statement.membershipNumber || memberId || statement.memberId || 'member';
  const descriptor = {
    title,
    fileName: `${kind}-statement-${safeToken(String(memberToken))}-${safeToken(context.periodLabel)}`,
  };

  const file =
    format === 'pdf'
      ? await createCustomPdfReportFile(descriptor, buildIndividualStatementHtml(kind, statement, context), 'portrait')
      : await createCustomExcelWorkbookReportFile(descriptor, buildIndividualStatementWorksheets(kind, statement, context));

  return deliverPreparedMobileReportFile(descriptor, file, format, destination);
}

export async function exportCumulatedSharesReport({
  rows,
  destination = 'save',
  ...context
}: CumulatedSharesExportOptions) {
  const sortedRows = [...rows].sort((left, right) => String(left.membershipNumber || '').localeCompare(String(right.membershipNumber || ''), undefined, { numeric: true, sensitivity: 'base' }));
  if (!sortedRows.length) throw new Error('No cumulated share data found for the selected period.');

  const descriptor = {
    title: 'Cumulated Shares Report',
    fileName: `cumulated-shares-report-${safeToken(context.periodLabel)}`,
  };
  const file = await createCustomExcelWorkbookReportFile(descriptor, [buildCumulatedSharesWorksheet(sortedRows, context)]);
  return deliverPreparedMobileReportFile(descriptor, file, 'excel', destination);
}

function buildConsolidatedStatementHtml(kind: StatementKind, statements: (SharesStatement | MembersStatement)[], context: StatementExportContext) {
  const totals = consolidatedTotals(kind, statements);
  const summaryHeaders =
    kind === 'shares'
      ? ['Total Members', 'Shares Bought (Period)', 'Value Bought (TZS)', 'Current Net Shares', 'Current Net Value (TZS)']
      : ['Total Members', 'Shares Bought (P)', 'Value Bought (TZS)', 'Social (P)', 'Fines Paid (P)', 'Fines Unpaid (P)', 'Penalties Paid (P)', 'Penalties Unpaid (P)', 'Loan Balance'];
  const summaryRows =
    kind === 'shares'
      ? [[statements.length, numberValue(totals.totalShares), money(totals.totalShareValue), numberValue(totals.currentNetShares), money(totals.currentNetShareValue)]]
      : [[statements.length, numberValue(totals.totalShares), money(totals.totalShareValue), money(totals.social), money(totals.finesPaid), money(totals.finesUnpaid), money(totals.penaltiesPaid), money(totals.penaltiesUnpaid), money(totals.loanBalance)]];
  const detail = consolidatedDetailTable(kind, statements);

  return reportHtml({
    title: kind === 'shares' ? 'CONSOLIDATED SHARE STATEMENTS' : 'CONSOLIDATED MEMBER STATEMENTS',
    associationName: context.associationName || context.groupConfig?.name || 'Association',
    periodLabel: context.periodLabel,
    additionalInfo: `Total Members: ${statements.length}`,
    page: 'landscape',
    body: `
      <section class="summary">${renderTable(summaryHeaders, summaryRows, { compact: kind === 'members' })}</section>
      <h2>Member Details</h2>
      ${renderTable(detail.headers, detail.rows, { compact: kind === 'members', numericFrom: 3 })}
    `,
  });
}

function buildIndividualStatementHtml(kind: StatementKind, statement: SharesStatement | MembersStatement, context: StatementExportContext) {
  const transactions = kind === 'shares' ? shareTransactionRows((statement as SharesStatement).transactions || []) : contributionTransactionRows((statement as MembersStatement).transactions || []);
  const periodRows = periodSummaryRows(statement.periodSummaries || {});

  return reportHtml({
    title: kind === 'shares' ? 'SHARE STATEMENT' : 'MEMBER STATEMENT',
    associationName: context.groupConfig?.name || context.associationName || 'Association',
    periodLabel: context.periodLabel,
    additionalInfo: `${statement.memberName || 'Member'} · ${statement.membershipNumber || 'No membership number'}`,
    page: 'portrait',
    body: `
      <section class="identity">
        <div><span>Member Name</span><strong>${escapeHtml(statement.memberName || 'N/A')}</strong></div>
        <div><span>Membership No</span><strong>${escapeHtml(statement.membershipNumber || 'N/A')}</strong></div>
      </section>
      <h2>Summary for the Period</h2>
      ${renderTable(['Metric', 'Value'], individualSummaryRows(kind, statement), { keyValue: true })}
      <h2>Detailed Transactions</h2>
      ${
        transactions.rows.length
          ? renderTable(transactions.headers, transactions.rows, { compact: true, numericFrom: kind === 'shares' ? 2 : 3 })
          : '<p class="empty">No relevant transactions to display for this period.</p>'
      }
      <h2>Periodic Summaries</h2>
      ${
        periodRows.length
          ? renderTable(['Period Start', 'Shares Bought', 'Value (TZS)', 'Other Contributions'], periodRows, { compact: true, numericFrom: 1 })
          : '<p class="empty">No periodic summaries were returned for this period.</p>'
      }
    `,
  });
}

function buildConsolidatedStatementWorksheet(kind: StatementKind, statements: (SharesStatement | MembersStatement)[], context: StatementExportContext): MobileExcelWorksheet {
  const detail = consolidatedDetailTable(kind, statements);
  const span = detail.headers.length - 1;
  return {
    name: kind === 'shares' ? 'Share Statements' : 'Member Statements',
    columns: detail.headers.map((header, index) => (index === 2 ? 170 : index === 0 ? 42 : 110)),
    rows: [
      [titleCell(kind === 'shares' ? 'CONSOLIDATED SHARE STATEMENTS' : 'CONSOLIDATED MEMBER STATEMENTS', span)],
      [subtitleCell(context.associationName || context.groupConfig?.name || 'Association', span)],
      [metaLabelCell('Period'), metaValueCell(context.periodLabel)],
      [metaLabelCell('Total Members'), metaValueCell(statements.length)],
      [],
      detail.headers.map(headerCell),
      ...detail.rows.map((row) => row.map((value, index) => (index >= 3 ? rightCell(value) : value))),
    ],
  };
}

function buildIndividualStatementWorksheets(kind: StatementKind, statement: SharesStatement | MembersStatement, context: StatementExportContext): MobileExcelWorksheet[] {
  const transactions = kind === 'shares' ? shareTransactionRows((statement as SharesStatement).transactions || []) : contributionTransactionRows((statement as MembersStatement).transactions || []);
  const periodRows = periodSummaryRows(statement.periodSummaries || {});
  const summaryRows = individualSummaryRows(kind, statement);

  const worksheets: MobileExcelWorksheet[] = [
    {
      name: 'Summary',
      columns: [190, 150],
      rows: [
        [titleCell(`${context.groupConfig?.name || context.associationName || 'Association'} - ${kind.toUpperCase()} STATEMENT`, 1)],
        [],
        [metaLabelCell('Member Name'), metaValueCell(statement.memberName || 'N/A')],
        [metaLabelCell('Membership No'), metaValueCell(statement.membershipNumber || 'N/A')],
        [metaLabelCell('Report Period'), metaValueCell(context.periodLabel)],
        [metaLabelCell('Generated on'), metaValueCell(generatedAt())],
        [],
        [headerCell('Summary for the Period'), headerCell('Value')],
        ...summaryRows.map(([label, value]) => [strongCell(label), value]),
      ],
    },
  ];

  if (transactions.rows.length) {
    worksheets.push({
      name: 'Transactions',
      columns: transactions.headers.map((header, index) => (index === 2 ? 210 : Math.max(95, header.length * 9))),
      rows: [transactions.headers.map(headerCell), ...transactions.rows.map((row) => row.map((value, index) => (index >= (kind === 'shares' ? 2 : 3) ? rightCell(value) : value)))],
    });
  }

  if (periodRows.length) {
    worksheets.push({
      name: 'Periodic Summaries',
      columns: [115, 110, 120, 260],
      rows: [['Period Start', 'Shares Bought', 'Value (TZS)', 'Other Contributions'].map(headerCell), ...periodRows.map((row) => row.map((value, index) => (index === 1 || index === 2 ? rightCell(value) : value)))],
    });
  }

  return worksheets;
}

function buildCumulatedSharesWorksheet(rows: CumulatedSharesReportRow[], context: StatementExportContext): MobileExcelWorksheet {
  const headers = ['#', 'Membership No', 'Member Name', 'Shares B/F', 'Shares Bought Current FY', 'Shares Used To Pay Loans', 'Shares Net', 'Shares Net Value (TZS)'];
  return {
    name: 'Cumulated Shares',
    columns: [42, 105, 170, 95, 140, 145, 95, 130],
    rows: [
      [titleCell('CUMULATED SHARES REPORT', headers.length - 1)],
      [subtitleCell(context.associationName || context.groupConfig?.name || 'Association', headers.length - 1)],
      [metaLabelCell('Period'), metaValueCell(context.periodLabel)],
      [metaLabelCell('Total Members'), metaValueCell(rows.length)],
      [],
      headers.map(headerCell),
      ...rows.map((row, index) => [
        index + 1,
        row.membershipNumber || 'N/A',
        row.memberName || 'N/A',
        rightCell(toNumber(row.totalSharesBroughtForward)),
        rightCell(toNumber(row.totalSharesBoughtCurrentFinancialYear)),
        rightCell(toNumber(row.totalSharesUsedToPayLoans)),
        rightCell(toNumber(row.sharesNet)),
        rightCell(toNumber(row.sharesNetValue)),
      ]),
    ],
  };
}

function consolidatedDetailTable(kind: StatementKind, statements: (SharesStatement | MembersStatement)[]) {
  if (kind === 'shares') {
    return {
      headers: ['#', 'Membership No', 'Name', 'Shares Bought (P)', 'Value (TZS)', 'Current Net Shares', 'Current Net Value (TZS)'],
      rows: statements.map((item, index) => {
        const statement = item as SharesStatement;
        return [
          index + 1,
          statement.membershipNumber || 'N/A',
          statement.memberName || 'N/A',
          numberValue(statement.totalShares),
          money(statement.totalShareValue),
          numberValue(statement.currentNetTotalShares),
          money(statement.currentNetTotalShareValue),
        ];
      }),
    };
  }

  return {
    headers: ['#', 'Membership No', 'Name', 'Shares Bought (P)', 'Value (TZS)', 'Social (P)', 'Fines Paid (P)', 'Fines Unpaid (P)', 'Penalties Paid (P)', 'Penalties Unpaid (P)', 'Loan Balance'],
    rows: statements.map((item, index) => {
      const statement = item as MembersStatement;
      return [
        index + 1,
        statement.membershipNumber || 'N/A',
        statement.memberName || 'N/A',
        numberValue(statement.totalShares),
        money(statement.totalShareValue),
        money(statement.contributions?.SOCIAL_CONTRIBUTION),
        money(statement.contributions?.PAID_FINE),
        money(statement.contributions?.UNPAID_FINE),
        money(statement.contributions?.PAID_PENALTY),
        money(statement.contributions?.UNPAID_PENALTY),
        money(statement.totalOutstandingLoanBalance),
      ];
    }),
  };
}

function individualSummaryRows(kind: StatementKind, statement: SharesStatement | MembersStatement) {
  const rows: [string, string][] = [
    ['Shares Bought (Period)', numberValue(statement.totalShares)],
    ['Value of Shares Bought (Period)', money(statement.totalShareValue)],
    ['Current Net Total Shares', numberValue(statement.currentNetTotalShares)],
    ['Current Net Total Share Value', money(statement.currentNetTotalShareValue)],
  ];

  if (kind === 'members') {
    const memberStatement = statement as MembersStatement;
    addNonZeroMoney(rows, 'Social Contributions (Period)', memberStatement.contributions?.SOCIAL_CONTRIBUTION);
    addNonZeroMoney(rows, 'Fines Paid (Period)', memberStatement.contributions?.PAID_FINE);
    addNonZeroMoney(rows, 'Fines Unpaid (Period)', memberStatement.contributions?.UNPAID_FINE);
    addNonZeroMoney(rows, 'Penalties Paid (Period)', memberStatement.contributions?.PAID_PENALTY);
    addNonZeroMoney(rows, 'Penalties Unpaid (Period)', memberStatement.contributions?.UNPAID_PENALTY);
    rows.push(['Current Outstanding Loan Balance', money(memberStatement.totalOutstandingLoanBalance)]);
  }

  return rows;
}

function shareTransactionRows(transactions: ShareStatementTransaction[]) {
  return {
    headers: ['Date', 'Description', 'Shares', 'Amount (TZS)', 'Status'],
    rows: transactions.map((transaction) => [
      formatDate(transaction.transactionDate),
      transaction.description || emptyDash,
      numberValue(transaction.shareCount),
      money(transaction.amount),
      transaction.status || 'N/A',
    ]),
  };
}

function contributionTransactionRows(transactions: ContributionStatementTransaction[]) {
  return {
    headers: ['Date', 'Type', 'Description', 'Shares', 'Amount (TZS)', 'Status'],
    rows: transactions
      .filter((transaction) => transaction.contributionType !== 'LOAN_REPAYMENT')
      .map((transaction) => [
        formatDate(transaction.transactionDate),
        labelFromKey(transaction.contributionType),
        transaction.description || emptyDash,
        transaction.contributionType === 'SHARE_PURCHASE' || transaction.contributionType === 'SHARE_DEDUCTION' ? numberValue(transaction.shareCount) : '',
        money(transaction.amount),
        transaction.status || 'N/A',
      ]),
  };
}

function periodSummaryRows(periodSummaries: Record<string, StatementPeriodSummary>) {
  return Object.entries(periodSummaries)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([periodDate, summary]) => [
      formatDate(periodDate),
      numberValue(summary.totalSharesContributed),
      money(summary.totalShareAmount),
      Object.entries(summary.contributions || {})
        .filter(([key, value]) => key !== 'LOAN_REPAYMENT' && toNumber(value) !== 0)
        .map(([key, value]) => `${labelFromKey(key)}: ${money(value)}`)
        .join('; ') || emptyDash,
    ]);
}

function consolidatedTotals(kind: StatementKind, statements: (SharesStatement | MembersStatement)[]) {
  return statements.reduce<ConsolidatedTotals>(
    (totals, statement) => {
      totals.totalShares += toNumber(statement.totalShares);
      totals.totalShareValue += toNumber(statement.totalShareValue);
      totals.currentNetShares += toNumber(statement.currentNetTotalShares);
      totals.currentNetShareValue += toNumber(statement.currentNetTotalShareValue);
      if (kind === 'members') {
        const memberStatement = statement as MembersStatement;
        totals.social += toNumber(memberStatement.contributions?.SOCIAL_CONTRIBUTION);
        totals.finesPaid += toNumber(memberStatement.contributions?.PAID_FINE);
        totals.finesUnpaid += toNumber(memberStatement.contributions?.UNPAID_FINE);
        totals.penaltiesPaid += toNumber(memberStatement.contributions?.PAID_PENALTY);
        totals.penaltiesUnpaid += toNumber(memberStatement.contributions?.UNPAID_PENALTY);
        totals.loanBalance += toNumber(memberStatement.totalOutstandingLoanBalance);
      }
      return totals;
    },
    {
      totalShares: 0,
      totalShareValue: 0,
      currentNetShares: 0,
      currentNetShareValue: 0,
      social: 0,
      finesPaid: 0,
      finesUnpaid: 0,
      penaltiesPaid: 0,
      penaltiesUnpaid: 0,
      loanBalance: 0,
    },
  );
}

function reportHtml({
  title,
  associationName,
  periodLabel,
  additionalInfo,
  page,
  body,
}: {
  title: string;
  associationName: string;
  periodLabel: string;
  additionalInfo: string;
  page: 'landscape' | 'portrait';
  body: string;
}) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A4 ${page}; margin: ${page === 'portrait' ? '10mm' : '8mm'}; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #111827;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      font-size: ${page === 'portrait' ? '9pt' : '7.8pt'};
      line-height: 1.34;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .topbar {
      display: flex;
      justify-content: space-between;
      gap: 16pt;
      padding-bottom: 9pt;
      border-bottom: 1.5pt solid #111827;
      margin-bottom: 10pt;
    }
    .brand {
      color: #2563eb;
      font-size: 8pt;
      font-weight: 800;
      letter-spacing: .08em;
      text-transform: uppercase;
      margin-bottom: 4pt;
    }
    h1 {
      margin: 0;
      color: #0f172a;
      font-size: ${page === 'portrait' ? '17pt' : '16pt'};
      line-height: 1.1;
    }
    .association {
      margin-top: 4pt;
      color: #334155;
      font-weight: 700;
    }
    .meta {
      min-width: 170pt;
      color: #334155;
      font-size: 8pt;
      text-align: right;
    }
    .meta div { margin-bottom: 3pt; }
    h2 {
      margin: 11pt 0 5pt;
      color: #111827;
      font-size: 10.5pt;
    }
    .identity {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 7pt;
      margin-bottom: 7pt;
    }
    .identity div {
      border: 1px solid #d1d5db;
      border-radius: 7pt;
      padding: 7pt;
    }
    .identity span {
      display: block;
      color: #64748b;
      font-size: 7pt;
      font-weight: 800;
      letter-spacing: .06em;
      text-transform: uppercase;
    }
    .identity strong {
      display: block;
      margin-top: 3pt;
      color: #111827;
      font-size: 10pt;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      border: 1px solid #94a3b8;
      page-break-inside: auto;
    }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; break-inside: avoid; }
    th {
      background: #0f172a;
      color: #ffffff;
      padding: ${page === 'portrait' ? '5pt 4pt' : '4pt 3pt'};
      font-size: ${page === 'portrait' ? '7.5pt' : '6.6pt'};
      text-align: left;
      text-transform: uppercase;
      letter-spacing: .025em;
      border: 1px solid #0f172a;
      overflow-wrap: anywhere;
    }
    td {
      padding: ${page === 'portrait' ? '4.5pt 4pt' : '3.5pt 3pt'};
      border: 1px solid #dbe3ee;
      vertical-align: top;
      overflow-wrap: anywhere;
    }
    tbody tr:nth-child(even) td { background: #f8fafc; }
    .right { text-align: right; }
    .center { text-align: center; }
    .key-value td:first-child {
      width: 55%;
      font-weight: 800;
      color: #334155;
    }
    .empty {
      border: 1px dashed #cbd5e1;
      border-radius: 8pt;
      padding: 11pt;
      color: #475569;
      font-weight: 700;
      text-align: center;
    }
    .footer {
      margin-top: 10pt;
      padding-top: 6pt;
      border-top: 1px solid #e5e7eb;
      color: #64748b;
      font-size: 7pt;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <section class="topbar">
    <div>
      <div class="brand">Nane</div>
      <h1>${escapeHtml(title)}</h1>
      <div class="association">${escapeHtml(associationName)}</div>
    </div>
    <div class="meta">
      <div><strong>Period:</strong> ${escapeHtml(periodLabel)}</div>
      <div><strong>Generated:</strong> ${escapeHtml(generatedAt())}</div>
      <div>${escapeHtml(additionalInfo)}</div>
    </div>
  </section>
  ${body}
  <section class="footer">
    <span>Generated from Nane mobile.</span>
    <span>Statement records reflect the selected period.</span>
  </section>
</body>
</html>`;
}

function renderTable(headers: string[], rows: unknown[][], options: { compact?: boolean; numericFrom?: number; keyValue?: boolean } = {}) {
  const className = options.keyValue ? ' class="key-value"' : '';
  return `<table${className}>
    <thead><tr>${headers.map((header, index) => `<th class="${index >= (options.numericFrom ?? Number.POSITIVE_INFINITY) ? 'right' : ''}">${escapeHtml(header)}</th>`).join('')}</tr></thead>
    <tbody>${rows
      .map((row) => `<tr>${row.map((cell, index) => `<td class="${index >= (options.numericFrom ?? Number.POSITIVE_INFINITY) ? 'right' : ''}">${escapeHtml(String(cell ?? emptyDash))}</td>`).join('')}</tr>`)
      .join('')}</tbody>
  </table>`;
}

function sortStatements<T extends SharesStatement | MembersStatement>(statements: T[]) {
  return [...statements].sort((left, right) => String(left.membershipNumber || '').localeCompare(String(right.membershipNumber || ''), undefined, { numeric: true, sensitivity: 'base' }));
}

function addNonZeroMoney(rows: [string, string][], label: string, value: unknown) {
  if (toNumber(value) !== 0) rows.push([label, money(value)]);
}

function toNumber(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numberValue(value: unknown) {
  return formatNumber(toNumber(value));
}

function money(value: unknown) {
  return formatCurrency(toNumber(value));
}

function labelFromKey(value?: string | null) {
  if (!value) return 'N/A';
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function safeToken(value: string) {
  return value
    .replace(/[ :/]+/g, '_')
    .replace(/[^a-zA-Z0-9_-]+/g, '')
    .replace(/^_+|_+$/g, '') || 'statement';
}

function generatedAt() {
  return new Intl.DateTimeFormat('en-TZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date());
}

function titleCell(value: unknown, mergeAcross = 0): MobileExcelCell {
  return { value, style: 'Title', mergeAcross };
}

function subtitleCell(value: unknown, mergeAcross = 0): MobileExcelCell {
  return { value, style: 'Subtitle', mergeAcross };
}

function metaLabelCell(value: unknown): MobileExcelCell {
  return { value, style: 'MetaLabel' };
}

function metaValueCell(value: unknown): MobileExcelCell {
  return { value, style: 'MetaValue' };
}

function headerCell(value: unknown): MobileExcelCell {
  return { value, style: 'Header' };
}

function strongCell(value: unknown): MobileExcelCell {
  return { value, style: 'CellStrong' };
}

function rightCell(value: unknown): MobileExcelCell {
  return { value, style: 'CellRight' };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
