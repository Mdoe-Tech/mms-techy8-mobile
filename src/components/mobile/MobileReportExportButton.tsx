import { Download, FileSpreadsheet, FileText, Share2, Table2 } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';

import {
  exportMobileReport,
  type MobileReportExportDestination,
  type MobileReportExportFormat,
  type MobileReportExportOptions,
  type MobileReportExportResult,
} from '@/utils/mobile-report-export';
import { MobileActionSheet, type MobileActionSheetAction } from './MobileActionSheet';
import { MobileButton } from './MobileButton';
import { useMobileFeedback } from './MobileFeedbackProvider';
import { MobileIconButton } from './MobileIconButton';

type MobileReportExportButtonProps<T> = {
  options: MobileReportExportOptions<T>;
  label?: string;
  mode?: 'button' | 'icon';
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  disabled?: boolean;
  prepareOptions?: (format: MobileReportExportFormat, options: MobileReportExportOptions<T>) => Promise<MobileReportExportOptions<T>> | MobileReportExportOptions<T>;
  onError?: (error: unknown) => void;
  onSuccess?: (uri: string, format: MobileReportExportFormat, result: MobileReportExportResult) => void;
};

export function MobileReportExportButton<T>({
  options,
  label = 'Export',
  mode = 'button',
  variant = 'secondary',
  size = 'sm',
  fullWidth,
  disabled,
  prepareOptions,
  onError,
  onSuccess,
}: MobileReportExportButtonProps<T>) {
  const { toast } = useMobileFeedback();
  const [open, setOpen] = useState(false);
  const [destinationOpen, setDestinationOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<MobileReportExportFormat | null>(null);
  const [workingFormat, setWorkingFormat] = useState<MobileReportExportFormat | null>(null);
  const isBusy = Boolean(workingFormat);
  const isDisabled = disabled || isBusy || options.rows.length === 0;

  const runExport = useCallback(async (format: MobileReportExportFormat, destination: MobileReportExportDestination) => {
    if (isBusy || isDisabled) return;
    setWorkingFormat(format);
    try {
      const resolvedOptions = prepareOptions ? await prepareOptions(format, options) : options;
      const result = await exportMobileReport(resolvedOptions, format, destination);
      const savedLabel = result.displayPath ? `${result.fileName} saved to ${result.displayPath}.` : `${result.fileName} is ready.`;
      toast.success({
        title: destination === 'save' ? 'Report saved' : 'Report ready',
        description:
          destination === 'save' && result.notificationPermission === 'denied'
            ? `${savedLabel} Android notifications are off, so it may not appear in the notification panel.`
            : savedLabel,
      });
      onSuccess?.(result.savedUri || result.uri, format, result);
    } catch (error) {
      toast.error({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Nane could not prepare this report right now.',
      });
      onError?.(error);
    } finally {
      setWorkingFormat(null);
    }
  }, [isBusy, isDisabled, onError, onSuccess, options, prepareOptions, toast]);

  const chooseFormat = useCallback((format: MobileReportExportFormat) => {
    setSelectedFormat(format);
    setDestinationOpen(true);
  }, []);

  const actions = useMemo<MobileActionSheetAction[]>(
    () => [
      {
        label: 'PDF report',
        description: 'Best for sharing a polished, printable report.',
        icon: FileText,
        tone: 'primary',
        onPress: () => chooseFormat('pdf'),
      },
      {
        label: 'Excel spreadsheet',
        description: 'Best for calculations, review, and office workflows.',
        icon: FileSpreadsheet,
        tone: 'success',
        onPress: () => chooseFormat('excel'),
      },
      {
        label: 'CSV data',
        description: 'Best for raw data, imports, and external analysis.',
        icon: Table2,
        tone: 'info',
        onPress: () => chooseFormat('csv'),
      },
    ],
    [chooseFormat],
  );

  const destinationActions = useMemo<MobileActionSheetAction[]>(
    () => [
      {
        label: 'Save to device',
        description: 'Android saves to Downloads with a notification. iPhone opens Save to Files.',
        icon: Download,
        tone: 'primary',
        onPress: () => {
          if (selectedFormat) void runExport(selectedFormat, 'save');
        },
      },
      {
        label: 'Share',
        description: 'Open the native share sheet for WhatsApp, email, Files, and other apps.',
        icon: Share2,
        tone: 'info',
        onPress: () => {
          if (selectedFormat) void runExport(selectedFormat, 'share');
        },
      },
    ],
    [runExport, selectedFormat],
  );

  return (
    <>
      {mode === 'icon' ? (
        <MobileIconButton icon={Download} label={label} variant={variant === 'primary' ? 'primary' : 'secondary'} disabled={isDisabled} onPress={() => setOpen(true)} />
      ) : (
        <MobileButton label={label} icon={Download} variant={variant} size={size} fullWidth={fullWidth} loading={isBusy} disabled={isDisabled} onPress={() => setOpen(true)} />
      )}
      <MobileActionSheet
        visible={open}
        title="Export report"
        description={`${options.title} · ${options.rows.length.toLocaleString('en-TZ')} record${options.rows.length === 1 ? '' : 's'}`}
        actions={actions}
        onClose={() => setOpen(false)}
      />
      <MobileActionSheet
        visible={destinationOpen}
        title="Where should Nane put it?"
        description={selectedFormat ? `${selectedFormat.toUpperCase()} report · ${options.title}` : options.title}
        actions={destinationActions}
        onClose={() => setDestinationOpen(false)}
      />
    </>
  );
}
