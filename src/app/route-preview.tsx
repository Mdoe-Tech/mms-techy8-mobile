import { Redirect, useLocalSearchParams } from 'expo-router';

export default function LegacyRoutePreviewRedirect() {
  const params = useLocalSearchParams();

  return <Redirect href={{ pathname: '/work/route-preview', params } as never} />;
}
