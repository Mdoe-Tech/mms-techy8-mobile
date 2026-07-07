import { router, type Href } from 'expo-router';

type SafeBackRouter = typeof router & {
  __naneSafeBackFallback?: Href;
  __naneSafeBackInstalled?: true;
  __naneSafeBackOriginalBack?: () => void;
};

const DEFAULT_BACK_FALLBACK = '/' as Href;

export function installSafeBackNavigation(fallback: Href = DEFAULT_BACK_FALLBACK) {
  const target = router as SafeBackRouter;
  target.__naneSafeBackFallback = fallback;

  if (target.__naneSafeBackInstalled) return;

  const originalBack = target.back.bind(router);
  target.__naneSafeBackOriginalBack = originalBack;
  target.__naneSafeBackInstalled = true;

  target.back = () => {
    if (target.canGoBack()) {
      originalBack();
      return;
    }

    target.replace(target.__naneSafeBackFallback ?? DEFAULT_BACK_FALLBACK);
  };
}
