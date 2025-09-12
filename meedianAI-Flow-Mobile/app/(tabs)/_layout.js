import { Tabs } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function TabsLayout() {
  const { session, checkSession } = useAuth();
  const router = useRouter();
  useEffect(() => {
    (async () => {
      if (!session) {
        await checkSession().catch(() => {});
      }
    })();
  }, [session]);
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="mris" options={{ title: 'My MRIs' }} />
      <Tabs.Screen name="account" options={{ title: 'Account' }} />
    </Tabs>
  );
}

