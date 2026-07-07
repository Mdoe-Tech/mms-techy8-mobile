import { MobileErrorPanel } from './MobileErrorPanel';
import type { MobileErrorDetailsInfo } from '@/utils/mobile-error';

type MobileErrorStateProps = {
  title: string;
  description: string;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'review' | 'neutral' | 'paid';
  retryLabel?: string;
  onRetry?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  details?: MobileErrorDetailsInfo;
};

export function MobileErrorState({
  title,
  description,
  tone = 'danger',
  retryLabel = 'Try again',
  onRetry,
  secondaryLabel,
  onSecondary,
  details,
}: MobileErrorStateProps) {
  return (
    <MobileErrorPanel
      title={title}
      description={description}
      tone={tone}
      primaryLabel={onRetry ? retryLabel : undefined}
      onPrimary={onRetry}
      secondaryLabel={secondaryLabel}
      onSecondary={onSecondary}
      details={details}
    />
  );
}
