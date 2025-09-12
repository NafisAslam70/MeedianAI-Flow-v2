import { View, Text, TouchableOpacity } from 'react-native';
import { useAuth } from '../../lib/auth';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';

export default function Account() {
  const { session, apiBase, checkSession, signOutLocal } = useAuth();
  const router = useRouter();

  const openWebLogin = async () => {
    await WebBrowser.openAuthSessionAsync(`${apiBase}/login`, null);
    await checkSession();
  };

  const openWebProfile = async () => {
    await WebBrowser.openBrowserAsync(`${apiBase}/dashboard/member`);
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 12 }}>Account</Text>
      <Text style={{ marginBottom: 6 }}>API Base: {apiBase}</Text>
      <Text style={{ marginBottom: 12 }}>Signed in: {session ? 'Yes' : 'No'}</Text>
      <TouchableOpacity onPress={openWebLogin} style={{ backgroundColor: '#0ea5e9', padding: 12, borderRadius: 10, marginBottom: 10 }}>
        <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '600' }}>Open Web Login</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={openWebProfile} style={{ backgroundColor: '#10b981', padding: 12, borderRadius: 10, marginBottom: 10 }}>
        <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '600' }}>Open Web Dashboard</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={async () => { await signOutLocal(); router.replace('/(auth)/signin'); }} style={{ backgroundColor: '#ef4444', padding: 12, borderRadius: 10 }}>
        <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '600' }}>Sign Out (Local)</Text>
      </TouchableOpacity>
    </View>
  );
}

