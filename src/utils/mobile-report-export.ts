import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { NativeModules, PermissionsAndroid, Platform, type Permission } from 'react-native';

export type MobileReportAlign = 'left' | 'center' | 'right';

export type MobileReportColumn<T> = {
  key: string;
  label: string;
  align?: MobileReportAlign;
  width?: string;
  value?: (row: T, index: number) => unknown;
};

export type MobileReportMetric = {
  label: string;
  value: unknown;
  helper?: string;
};

export type MobileReportMeta = {
  label: string;
  value: unknown;
};

export type MobileReportExportFormat = 'pdf' | 'csv' | 'excel';
export type MobileReportExportDestination = 'share' | 'save';
export type MobileReportNotificationPermission = 'granted' | 'denied' | 'unavailable' | 'skipped';

export type MobileReportExportResult = {
  uri: string;
  format: MobileReportExportFormat;
  destination: MobileReportExportDestination;
  fileName: string;
  mimeType: string;
  savedUri?: string;
  displayPath?: string;
  notificationShown?: boolean;
  notificationPermission?: MobileReportNotificationPermission;
};

export type MobileReportExportOptions<T> = {
  title: string;
  associationName?: string | null;
  purpose?: string;
  subtitle?: string;
  rows: T[];
  columns: MobileReportColumn<T>[];
  metrics?: MobileReportMetric[];
  filters?: MobileReportMeta[];
  metadata?: MobileReportMeta[];
  fileName?: string;
  emptyMessage?: string;
};

type PreparedMobileReportFile = {
  uri: string;
  fileName: string;
  mimeType: string;
  uti: string;
};

type AndroidReportDownloadsModule = {
  saveReport: (fileUri: string, fileName: string, mimeType: string, title: string) => Promise<{
    uri?: string;
    fileName?: string;
    displayPath?: string;
    notificationShown?: boolean;
  }>;
};

const AndroidReportDownloads = NativeModules.NaneReportDownloads as AndroidReportDownloadsModule | undefined;

export async function exportMobileReport<T>(
  options: MobileReportExportOptions<T>,
  format: MobileReportExportFormat = 'pdf',
  destination: MobileReportExportDestination = 'share',
): Promise<MobileReportExportResult> {
  const reportFile = await createReportFile(options, format);

  if (destination === 'save') {
    return saveReportFile(options, reportFile, format);
  }

  await shareReportFile(options, reportFile);
  return {
    uri: reportFile.uri,
    format,
    destination,
    fileName: reportFile.fileName,
    mimeType: reportFile.mimeType,
  };
}

async function createReportFile<T>(options: MobileReportExportOptions<T>, format: MobileReportExportFormat) {
  if (format === 'csv') return createCsvReport(options);
  if (format === 'excel') return createExcelReport(options);
  return createPdfReport(options);
}

async function createPdfReport<T>(options: MobileReportExportOptions<T>): Promise<PreparedMobileReportFile> {
  const html = buildReportHtml(options);
  const result = await Print.printToFileAsync({
    html,
    width: 1191,
    height: 842,
    base64: false,
    textZoom: 100,
  });
  const directory = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!directory) throw new Error('This device cannot create report files right now.');

  const fileUri = `${directory}${safeFileName(options.fileName || options.title)}-${dateStamp()}.pdf`;
  await FileSystem.copyAsync({ from: result.uri, to: fileUri });

  return {
    uri: fileUri,
    fileName: fileNameFromUri(fileUri),
    mimeType: 'application/pdf',
    uti: 'com.adobe.pdf',
  };
}

async function createCsvReport<T>(options: MobileReportExportOptions<T>): Promise<PreparedMobileReportFile> {
  const directory = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!directory) throw new Error('This device cannot create report files right now.');

  const fileUri = `${directory}${safeFileName(options.fileName || options.title)}-${dateStamp()}.csv`;
  await FileSystem.writeAsStringAsync(fileUri, buildReportCsv(options));

  return {
    uri: fileUri,
    fileName: fileNameFromUri(fileUri),
    mimeType: 'text/csv',
    uti: 'public.comma-separated-values-text',
  };
}

async function createExcelReport<T>(options: MobileReportExportOptions<T>): Promise<PreparedMobileReportFile> {
  const directory = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!directory) throw new Error('This device cannot create report files right now.');

  const fileUri = `${directory}${safeFileName(options.fileName || options.title)}-${dateStamp()}.xls`;
  await FileSystem.writeAsStringAsync(fileUri, buildExcelXml(options));

  return {
    uri: fileUri,
    fileName: fileNameFromUri(fileUri),
    mimeType: 'application/vnd.ms-excel',
    uti: 'com.microsoft.excel.xls',
  };
}

async function shareReportFile<T>(options: MobileReportExportOptions<T>, reportFile: PreparedMobileReportFile, titlePrefix = 'Share') {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('This device cannot open the share sheet right now.');
  }

  await Sharing.shareAsync(reportFile.uri, {
    mimeType: reportFile.mimeType,
    UTI: reportFile.uti,
    dialogTitle: `${titlePrefix} ${options.title}`,
  });
}

async function saveReportFile<T>(
  options: MobileReportExportOptions<T>,
  reportFile: PreparedMobileReportFile,
  format: MobileReportExportFormat,
): Promise<MobileReportExportResult> {
  if (Platform.OS === 'android' && AndroidReportDownloads?.saveReport) {
    const notificationPermission = await requestAndroidReportNotificationPermission();
    const saved = await AndroidReportDownloads.saveReport(reportFile.uri, reportFile.fileName, reportFile.mimeType, options.title);

    return {
      uri: reportFile.uri,
      format,
      destination: 'save',
      fileName: saved.fileName || reportFile.fileName,
      mimeType: reportFile.mimeType,
      savedUri: saved.uri,
      displayPath: saved.displayPath || 'Downloads/Nane Reports',
      notificationShown: Boolean(saved.notificationShown),
      notificationPermission,
    };
  }

  await shareReportFile(options, reportFile, Platform.OS === 'ios' ? 'Save or share' : 'Save');
  return {
    uri: reportFile.uri,
    format,
    destination: 'save',
    fileName: reportFile.fileName,
    mimeType: reportFile.mimeType,
    displayPath: Platform.OS === 'ios' ? 'Files app' : undefined,
    notificationShown: false,
    notificationPermission: Platform.OS === 'ios' ? 'unavailable' : 'skipped',
  };
}

async function requestAndroidReportNotificationPermission(): Promise<MobileReportNotificationPermission> {
  if (Platform.OS !== 'android') return 'unavailable';
  const androidVersion = typeof Platform.Version === 'number' ? Platform.Version : Number.parseInt(String(Platform.Version), 10);
  if (!Number.isFinite(androidVersion) || androidVersion < 33) return 'granted';

  const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS as Permission;
  const alreadyGranted = await PermissionsAndroid.check(permission);
  if (alreadyGranted) return 'granted';

  const result = await PermissionsAndroid.request(permission, {
    title: 'Allow report notifications?',
    message: 'Nane can notify you when a report has been saved to your Downloads folder.',
    buttonPositive: 'Allow',
    buttonNegative: 'Not now',
  });

  return result === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied';
}

function buildReportHtml<T>({
  title,
  associationName,
  purpose,
  subtitle,
  rows,
  columns,
  metrics = [],
  filters = [],
  metadata = [],
  emptyMessage = 'No records matched the current report filters.',
}: MobileReportExportOptions<T>) {
  const generatedAt = new Intl.DateTimeFormat('en-TZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date());
  const metaItems: MobileReportMeta[] = [
    { label: 'Generated', value: generatedAt },
    { label: 'Records', value: rows.length },
    ...metadata,
  ];

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A4 landscape; margin: 18mm 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #111827;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      font-size: 11px;
      line-height: 1.45;
      background: #ffffff;
    }
    .report-shell { width: 100%; }
    .topbar {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      padding-bottom: 14px;
      border-bottom: 2px solid #111827;
      margin-bottom: 16px;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
      color: #2563eb;
      font-weight: 800;
      letter-spacing: .04em;
      text-transform: uppercase;
    }
    .brand-mark {
      width: 24px;
      height: 24px;
      border-radius: 8px;
      background: #2563eb;
      color: #ffffff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    }
    h1 {
      margin: 0;
      font-size: 25px;
      line-height: 1.15;
      letter-spacing: 0;
      color: #0f172a;
    }
    .association {
      margin-top: 5px;
      color: #334155;
      font-size: 12px;
      font-weight: 700;
    }
    .purpose {
      margin-top: 8px;
      max-width: 620px;
      color: #475569;
      font-size: 11px;
    }
    .meta-grid {
      min-width: 240px;
      display: grid;
      gap: 6px;
      align-content: start;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 5px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .meta-row span:first-child { color: #64748b; }
    .meta-row span:last-child {
      color: #111827;
      font-weight: 700;
      text-align: right;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 14px;
    }
    .metric {
      border: 1px solid #d1d5db;
      border-radius: 12px;
      padding: 10px 12px;
      background: #ffffff;
    }
    .metric-label {
      color: #64748b;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: .08em;
      font-weight: 800;
    }
    .metric-value {
      margin-top: 4px;
      color: #111827;
      font-size: 17px;
      font-weight: 850;
    }
    .metric-helper {
      margin-top: 2px;
      color: #475569;
      font-size: 9px;
    }
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-bottom: 14px;
    }
    .filter-pill {
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 5px 9px;
      color: #334155;
      background: #ffffff;
      font-size: 9px;
      font-weight: 700;
    }
    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      table-layout: fixed;
      border: 1px solid #d1d5db;
      border-radius: 12px;
      overflow: hidden;
    }
    thead { display: table-header-group; }
    th {
      background: #0f172a;
      color: #ffffff;
      text-align: left;
      padding: 8px 7px;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: .05em;
      font-weight: 800;
      border-right: 1px solid rgba(255,255,255,.18);
    }
    th:last-child { border-right: 0; }
    td {
      padding: 7px;
      vertical-align: top;
      border-top: 1px solid #e5e7eb;
      border-right: 1px solid #eef2f7;
      color: #1f2937;
      overflow-wrap: anywhere;
    }
    td:last-child { border-right: 0; }
    tbody tr:nth-child(even) td { background: #f8fafc; }
    .align-center { text-align: center; }
    .align-right { text-align: right; }
    .empty {
      padding: 22px;
      border: 1px dashed #cbd5e1;
      border-radius: 12px;
      color: #475569;
      background: #f8fafc;
      text-align: center;
      font-weight: 700;
    }
    .footer {
      margin-top: 14px;
      padding-top: 8px;
      border-top: 1px solid #e5e7eb;
      color: #64748b;
      font-size: 9px;
      display: flex;
      justify-content: space-between;
      gap: 16px;
    }
  </style>
</head>
<body>
  <main class="report-shell">
    <section class="topbar">
      <div>
        <div class="brand"><span class="brand-mark">N</span><span>Nane</span></div>
        <h1>${escapeHtml(title)}</h1>
        ${associationName ? `<div class="association">${escapeHtml(associationName)}</div>` : ''}
        ${subtitle ? `<div class="purpose">${escapeHtml(subtitle)}</div>` : ''}
        ${purpose ? `<div class="purpose">${escapeHtml(purpose)}</div>` : ''}
      </div>
      <div class="meta-grid">
        ${metaItems.map((item) => `<div class="meta-row"><span>${escapeHtml(item.label)}</span><span>${escapeHtml(formatReportValue(item.value))}</span></div>`).join('')}
      </div>
    </section>
    ${metrics.length ? `<section class="metrics">${metrics.map(renderMetric).join('')}</section>` : ''}
    ${filters.length ? `<section class="filters">${filters.map((item) => `<span class="filter-pill">${escapeHtml(item.label)}: ${escapeHtml(formatReportValue(item.value))}</span>`).join('')}</section>` : ''}
    ${
      rows.length
        ? `<table>
      <thead><tr>${columns.map(renderHeader).join('')}</tr></thead>
      <tbody>${rows.map((row, index) => renderRow(row, index, columns)).join('')}</tbody>
    </table>`
        : `<div class="empty">${escapeHtml(emptyMessage)}</div>`
    }
    <section class="footer">
      <span>Generated from Nane mobile.</span>
      <span>This report reflects the records loaded by the current mobile workspace and filters.</span>
    </section>
  </main>
</body>
</html>`;
}

function renderMetric(metric: MobileReportMetric) {
  return `<div class="metric">
    <div class="metric-label">${escapeHtml(metric.label)}</div>
    <div class="metric-value">${escapeHtml(formatReportValue(metric.value))}</div>
    ${metric.helper ? `<div class="metric-helper">${escapeHtml(metric.helper)}</div>` : ''}
  </div>`;
}

function renderHeader<T>(column: MobileReportColumn<T>) {
  const alignClass = column.align ? ` align-${column.align}` : '';
  const width = column.width ? ` style="width:${escapeHtml(column.width)}"` : '';
  return `<th class="${alignClass.trim()}"${width}>${escapeHtml(column.label)}</th>`;
}

function renderRow<T>(row: T, index: number, columns: MobileReportColumn<T>[]) {
  return `<tr>${columns
    .map((column) => {
      const alignClass = column.align ? ` align-${column.align}` : '';
      return `<td class="${alignClass.trim()}">${escapeHtml(formatReportValue(reportCellValue(row, index, column)))}</td>`;
    })
    .join('')}</tr>`;
}

function buildReportCsv<T>(options: MobileReportExportOptions<T>) {
  const { title, associationName, purpose, subtitle, rows, columns, metrics = [], filters = [], metadata = [] } = options;
  const generatedAt = new Intl.DateTimeFormat('en-TZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date());
  const lines: string[] = [
    [title].map(csvCell).join(','),
    ['Association', associationName || 'Nane'].map(csvCell).join(','),
    ['Generated', generatedAt].map(csvCell).join(','),
    ['Records', rows.length].map(csvCell).join(','),
  ];

  if (subtitle) lines.push(['Subtitle', subtitle].map(csvCell).join(','));
  if (purpose) lines.push(['Purpose', purpose].map(csvCell).join(','));
  metadata.forEach((item) => lines.push([item.label, formatReportValue(item.value)].map(csvCell).join(',')));

  if (metrics.length) {
    lines.push('');
    lines.push(['Metric', 'Value', 'Notes'].map(csvCell).join(','));
    metrics.forEach((metric) => lines.push([metric.label, formatReportValue(metric.value), metric.helper || ''].map(csvCell).join(',')));
  }

  if (filters.length) {
    lines.push('');
    lines.push(['Filter', 'Value'].map(csvCell).join(','));
    filters.forEach((item) => lines.push([item.label, formatReportValue(item.value)].map(csvCell).join(',')));
  }

  lines.push('');
  lines.push(columns.map((column) => csvCell(column.label)).join(','));
  rows.forEach((row, index) => {
    lines.push(columns.map((column) => csvCell(reportCellValue(row, index, column))).join(','));
  });

  return `\ufeff${lines.join('\n')}\n`;
}

function buildExcelXml<T>(options: MobileReportExportOptions<T>) {
  const { title, associationName, purpose, subtitle, rows, columns, metrics = [], filters = [], metadata = [] } = options;
  const generatedAt = new Intl.DateTimeFormat('en-TZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date());
  const span = Math.max(1, columns.length - 1);
  const worksheetName = safeWorksheetName(title);
  const tableRows: string[] = [];

  tableRows.push(excelRow([excelCell(title, 'Title', span)]));
  tableRows.push(excelRow([excelCell(associationName || 'Nane', 'Subtitle', span)]));
  if (subtitle) tableRows.push(excelRow([excelCell(subtitle, 'Text', span)]));
  if (purpose) tableRows.push(excelRow([excelCell(purpose, 'Text', span)]));
  tableRows.push(excelRow([excelCell('Generated', 'MetaLabel'), excelCell(generatedAt, 'MetaValue')]));
  tableRows.push(excelRow([excelCell('Records', 'MetaLabel'), excelCell(rows.length, 'MetaValue')]));
  metadata.forEach((item) => tableRows.push(excelRow([excelCell(item.label, 'MetaLabel'), excelCell(formatReportValue(item.value), 'MetaValue')])));

  if (metrics.length) {
    tableRows.push(excelSpacerRow());
    tableRows.push(excelRow([excelCell('Metric', 'Header'), excelCell('Value', 'Header'), excelCell('Notes', 'Header')]));
    metrics.forEach((metric) => tableRows.push(excelRow([excelCell(metric.label, 'CellStrong'), excelCell(formatReportValue(metric.value), 'Cell'), excelCell(metric.helper || '', 'Cell')])));
  }

  if (filters.length) {
    tableRows.push(excelSpacerRow());
    tableRows.push(excelRow([excelCell('Filter', 'Header'), excelCell('Value', 'Header')]));
    filters.forEach((item) => tableRows.push(excelRow([excelCell(item.label, 'CellStrong'), excelCell(formatReportValue(item.value), 'Cell')])));
  }

  tableRows.push(excelSpacerRow());
  tableRows.push(excelRow(columns.map((column) => excelCell(column.label, 'Header'))));
  rows.forEach((row, index) => {
    tableRows.push(excelRow(columns.map((column) => excelCell(reportCellValue(row, index, column), column.align === 'right' ? 'CellRight' : 'Cell'))));
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:FontName="Quicksand" ss:Size="10" ss:Color="#111827"/>
    </Style>
    <Style ss:ID="Title">
      <Font ss:FontName="Quicksand" ss:Size="20" ss:Bold="1" ss:Color="#0F172A"/>
    </Style>
    <Style ss:ID="Subtitle">
      <Font ss:FontName="Quicksand" ss:Size="12" ss:Bold="1" ss:Color="#334155"/>
    </Style>
    <Style ss:ID="Text">
      <Font ss:FontName="Quicksand" ss:Size="10" ss:Color="#475569"/>
    </Style>
    <Style ss:ID="MetaLabel">
      <Font ss:FontName="Quicksand" ss:Size="10" ss:Bold="1" ss:Color="#64748B"/>
      <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="MetaValue">
      <Font ss:FontName="Quicksand" ss:Size="10" ss:Bold="1" ss:Color="#111827"/>
      <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Header">
      <Alignment ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:FontName="Quicksand" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
      <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F172A"/></Borders>
    </Style>
    <Style ss:ID="Cell">
      <Alignment ss:Vertical="Top" ss:WrapText="1"/>
      <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/></Borders>
    </Style>
    <Style ss:ID="CellStrong">
      <Alignment ss:Vertical="Top" ss:WrapText="1"/>
      <Font ss:FontName="Quicksand" ss:Size="10" ss:Bold="1" ss:Color="#111827"/>
      <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/></Borders>
    </Style>
    <Style ss:ID="CellRight">
      <Alignment ss:Horizontal="Right" ss:Vertical="Top" ss:WrapText="1"/>
      <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/></Borders>
    </Style>
  </Styles>
  <Worksheet ss:Name="${escapeXml(worksheetName)}">
    <Table>
      ${columns.map((column) => `<Column ss:AutoFitWidth="0" ss:Width="${excelColumnWidth(column)}"/>`).join('\n      ')}
      ${tableRows.join('\n      ')}
    </Table>
  </Worksheet>
</Workbook>`;
}

function reportCellValue<T>(row: T, index: number, column: MobileReportColumn<T>) {
  return column.value ? column.value(row, index) : (row as Record<string, unknown>)[column.key];
}

function formatReportValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  if (value instanceof Date) return value.toLocaleDateString('en-TZ');
  if (typeof value === 'number') return new Intl.NumberFormat('en-TZ', { maximumFractionDigits: 2 }).format(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function csvCell(value: unknown) {
  const text = formatReportValue(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function excelCell(value: unknown, style: string, mergeAcross?: number) {
  const merge = mergeAcross ? ` ss:MergeAcross="${mergeAcross}"` : '';
  return `<Cell ss:StyleID="${style}"${merge}><Data ss:Type="String">${escapeXml(formatReportValue(value))}</Data></Cell>`;
}

function excelRow(cells: string[]) {
  return `<Row>${cells.join('')}</Row>`;
}

function excelSpacerRow() {
  return '<Row ss:Height="10"><Cell><Data ss:Type="String"></Data></Cell></Row>';
}

function excelColumnWidth<T>(column: MobileReportColumn<T>) {
  if (!column.width) return 110;
  const percent = Number(column.width.replace('%', ''));
  if (Number.isFinite(percent) && percent > 0) return Math.max(42, Math.min(190, percent * 7));
  return 110;
}

function safeWorksheetName(value: string) {
  return value.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Nane report';
}

function safeFileName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'nane-report';
}

function fileNameFromUri(uri: string) {
  return decodeURIComponent(uri.split('/').pop() || 'nane-report');
}

function dateStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}
