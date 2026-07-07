import { MobileErrorState, MobileScreen } from '@/components/mobile';
import ComponentPreviewScreen from '@/screens/ComponentPreviewScreen';

export default function FeedbackPreviewRoute() {
  if (!__DEV__) {
    return (
      <MobileScreen>
        <MobileErrorState
          title="Preview unavailable"
          description="This design-system preview is only available in local development builds."
        />
      </MobileScreen>
    );
  }

  return <ComponentPreviewScreen />;
}
