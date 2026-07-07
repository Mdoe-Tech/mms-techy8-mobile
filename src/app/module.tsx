import { Redirect, useLocalSearchParams } from 'expo-router';

export default function LegacyModuleRedirect() {
  const params = useLocalSearchParams();

  return <Redirect href={{ pathname: '/work/module', params } as never} />;
}
