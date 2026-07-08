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

export type PreparedMobileReportFile = {
  uri: string;
  fileName: string;
  mimeType: string;
  uti: string;
};

export type MobilePreparedReportDescriptor = {
  title: string;
  fileName?: string;
};

export type MobileCustomPdfPage = 'landscape' | 'portrait';

export type MobileExcelCell = {
  value: unknown;
  style?: 'Title' | 'Subtitle' | 'Text' | 'MetaLabel' | 'MetaValue' | 'Header' | 'Cell' | 'CellStrong' | 'CellRight';
  mergeAcross?: number;
};

export type MobileExcelWorksheet = {
  name: string;
  columns?: number[];
  rows: (unknown | MobileExcelCell)[][];
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
const A4_LANDSCAPE_WIDTH_PT = 842;
const A4_LANDSCAPE_HEIGHT_PT = 595;

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

export async function createCustomPdfReportFile(
  descriptor: MobilePreparedReportDescriptor,
  html: string,
  page: MobileCustomPdfPage = 'landscape',
): Promise<PreparedMobileReportFile> {
  const result = await Print.printToFileAsync({
    html,
    width: page === 'portrait' ? A4_LANDSCAPE_HEIGHT_PT : A4_LANDSCAPE_WIDTH_PT,
    height: page === 'portrait' ? A4_LANDSCAPE_WIDTH_PT : A4_LANDSCAPE_HEIGHT_PT,
    base64: false,
    textZoom: 100,
  });
  const directory = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!directory) throw new Error('This device cannot create report files right now.');

  const fileUri = `${directory}${safeFileName(descriptor.fileName || descriptor.title)}-${dateStamp()}.pdf`;
  await FileSystem.copyAsync({ from: result.uri, to: fileUri });

  return {
    uri: fileUri,
    fileName: fileNameFromUri(fileUri),
    mimeType: 'application/pdf',
    uti: 'com.adobe.pdf',
  };
}

export async function createCustomExcelWorkbookReportFile(
  descriptor: MobilePreparedReportDescriptor,
  worksheets: MobileExcelWorksheet[],
): Promise<PreparedMobileReportFile> {
  const directory = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!directory) throw new Error('This device cannot create report files right now.');

  const fileUri = `${directory}${safeFileName(descriptor.fileName || descriptor.title)}-${dateStamp()}.xls`;
  await FileSystem.writeAsStringAsync(fileUri, buildExcelWorkbookXml(worksheets));

  return {
    uri: fileUri,
    fileName: fileNameFromUri(fileUri),
    mimeType: 'application/vnd.ms-excel',
    uti: 'com.microsoft.excel.xls',
  };
}

export async function deliverPreparedMobileReportFile(
  descriptor: MobilePreparedReportDescriptor,
  reportFile: PreparedMobileReportFile,
  format: MobileReportExportFormat,
  destination: MobileReportExportDestination = 'save',
) {
  const options: MobileReportExportOptions<unknown> = {
    title: descriptor.title,
    fileName: descriptor.fileName,
    rows: [],
    columns: [],
  };

  if (destination === 'save') return saveReportFile(options, reportFile, format);

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
    width: A4_LANDSCAPE_WIDTH_PT,
    height: A4_LANDSCAPE_HEIGHT_PT,
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
  const columnWidths = normalizedColumnWidths(columns);
  const columnCount = Math.max(1, columns.length);
  const compactTable = columnCount > 8;
  const denseTable = columnCount > 10;
  const tableFontSize = denseTable ? 7.8 : compactTable ? 8.4 : 9.2;
  const headerFontSize = denseTable ? 7.2 : compactTable ? 7.8 : 8.4;
  const cellPadding = denseTable ? '4pt 3pt' : compactTable ? '5pt 4pt' : '6pt 5pt';
  const headerPadding = denseTable ? '5pt 3pt' : compactTable ? '6pt 4pt' : '7pt 5pt';
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
    @page { size: 297mm 210mm; margin: 8mm; }
    * { box-sizing: border-box; }
    html {
      width: 100%;
      min-width: 0;
      background: #ffffff;
    }
    body {
      margin: 0;
      color: #111827;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      font-size: 9.8pt;
      line-height: 1.35;
      background: #ffffff;
      width: 100%;
      min-width: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .report-shell {
      width: 100%;
      max-width: none;
      margin: 0;
      padding: 0;
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
      display: inline-flex;
      align-items: center;
      gap: 7pt;
      margin-bottom: 5pt;
      color: #2563eb;
      font-weight: 800;
      letter-spacing: .03em;
      text-transform: uppercase;
    }
    .brand-mark {
      width: 19pt;
      height: 19pt;
      border-radius: 6pt;
      background: #2563eb;
      color: #ffffff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 10pt;
    }
    h1 {
      margin: 0;
      font-size: 18pt;
      line-height: 1.15;
      letter-spacing: 0;
      color: #0f172a;
    }
    .association {
      margin-top: 3pt;
      color: #334155;
      font-size: 9.5pt;
      font-weight: 700;
    }
    .purpose {
      margin-top: 5pt;
      max-width: 520pt;
      color: #475569;
      font-size: 8.6pt;
    }
    .meta-grid {
      width: 190pt;
      flex: 0 0 190pt;
      display: grid;
      gap: 3pt;
      align-content: start;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      gap: 9pt;
      padding: 3pt 0;
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
      gap: 7pt;
      margin-bottom: 9pt;
    }
    .metric {
      border: 1px solid #d1d5db;
      border-radius: 8pt;
      padding: 7pt 8pt;
      background: #ffffff;
    }
    .metric-label {
      color: #64748b;
      font-size: 7pt;
      text-transform: uppercase;
      letter-spacing: .08em;
      font-weight: 800;
    }
    .metric-value {
      margin-top: 3pt;
      color: #111827;
      font-size: 12.5pt;
      font-weight: 850;
    }
    .metric-helper {
      margin-top: 2pt;
      color: #475569;
      font-size: 7.2pt;
    }
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 5pt;
      margin-bottom: 9pt;
    }
    .filter-pill {
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 3.5pt 6pt;
      color: #334155;
      background: #ffffff;
      font-size: 7.4pt;
      font-weight: 700;
    }
    .table-wrap {
      width: 100%;
      margin: 0;
      padding: 0;
      overflow: visible;
      break-inside: auto;
    }
    table {
      width: 100%;
      max-width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      border: 1px solid #94a3b8;
      font-size: ${tableFontSize}pt;
      line-height: 1.28;
      page-break-inside: auto;
    }
    thead { display: table-header-group; }
    tbody { display: table-row-group; }
    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    th {
      background: #0f172a;
      color: #ffffff;
      text-align: left;
      padding: ${headerPadding};
      font-size: ${headerFontSize}pt;
      text-transform: uppercase;
      letter-spacing: .035em;
      font-weight: 800;
      border: 1px solid #0f172a;
      overflow-wrap: anywhere;
      word-break: normal;
    }
    td {
      padding: ${cellPadding};
      vertical-align: top;
      border: 1px solid #dbe3ee;
      color: #1f2937;
      overflow-wrap: anywhere;
      word-break: normal;
    }
    tbody tr:nth-child(even) td { background: #f8fafc; }
    .align-center { text-align: center; }
    .align-right { text-align: right; }
    .empty {
      padding: 18pt;
      border: 1px dashed #cbd5e1;
      border-radius: 8pt;
      color: #475569;
      background: #f8fafc;
      text-align: center;
      font-weight: 700;
    }
    .footer {
      margin-top: 9pt;
      padding-top: 6pt;
      border-top: 1px solid #e5e7eb;
      color: #64748b;
      font-size: 7.4pt;
      display: flex;
      justify-content: space-between;
      gap: 12pt;
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
        ? `<section class="table-wrap"><table>
      <colgroup>${columnWidths.map((width) => `<col style="width:${width}" />`).join('')}</colgroup>
      <thead><tr>${columns.map(renderHeader).join('')}</tr></thead>
      <tbody>${rows.map((row, index) => renderRow(row, index, columns)).join('')}</tbody>
    </table></section>`
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
  return `<th class="${alignClass.trim()}">${escapeHtml(column.label)}</th>`;
}

function renderRow<T>(row: T, index: number, columns: MobileReportColumn<T>[]) {
  return `<tr>${columns
    .map((column) => {
      const alignClass = column.align ? ` align-${column.align}` : '';
      return `<td class="${alignClass.trim()}">${escapeHtml(formatReportValue(reportCellValue(row, index, column)))}</td>`;
    })
    .join('')}</tr>`;
}

function normalizedColumnWidths<T>(columns: MobileReportColumn<T>[]) {
  if (!columns.length) return ['100%'];

  const fallbackWidth = 100 / columns.length;
  const baseWidths = columns.map((column) => parsePercentWidth(column.width) ?? fallbackWidth);
  const total = baseWidths.reduce((sum, width) => sum + width, 0);
  if (!Number.isFinite(total) || total <= 0) {
    return columns.map(() => `${fallbackWidth.toFixed(4)}%`);
  }

  return baseWidths.map((width) => `${((width / total) * 100).toFixed(4)}%`);
}

function parsePercentWidth(width?: string) {
  if (!width) return null;
  const trimmed = width.trim();
  if (!trimmed.endsWith('%')) return null;
  const value = Number.parseFloat(trimmed.slice(0, -1));
  return Number.isFinite(value) && value > 0 ? value : null;
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

function buildExcelWorkbookXml(worksheets: MobileExcelWorksheet[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  ${excelStylesXml()}
  ${worksheets.map(renderExcelWorksheet).join('\n  ')}
</Workbook>`;
}

function renderExcelWorksheet(worksheet: MobileExcelWorksheet) {
  const columnCount = Math.max(1, worksheet.columns?.length || Math.max(...worksheet.rows.map((row) => row.length), 1));
  const columns = Array.from({ length: columnCount }, (_, index) => worksheet.columns?.[index] || 110);
  return `<Worksheet ss:Name="${escapeXml(safeWorksheetName(worksheet.name))}">
    <Table>
      ${columns.map((width) => `<Column ss:AutoFitWidth="0" ss:Width="${width}"/>`).join('\n      ')}
      ${worksheet.rows.map((row) => excelRow(row.map(renderExcelCell))).join('\n      ')}
    </Table>
  </Worksheet>`;
}

function renderExcelCell(cell: unknown | MobileExcelCell) {
  if (cell && typeof cell === 'object' && 'value' in (cell as MobileExcelCell)) {
    const typedCell = cell as MobileExcelCell;
    return excelCell(typedCell.value, typedCell.style || 'Cell', typedCell.mergeAcross);
  }
  return excelCell(cell, 'Cell');
}

function excelStylesXml() {
  return `<Styles>
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
  </Styles>`;
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
