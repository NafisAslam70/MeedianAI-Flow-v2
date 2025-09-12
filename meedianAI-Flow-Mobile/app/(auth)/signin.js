import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Linking } from 'react-native';
import { useAuth } from '../../lib/auth';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('member');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { checkSession, apiBase } = useAuth();
  const router = useRouter();

  const openWebLogin = async () => {
    setError('');
    const url = `${apiBase}/login?role=${encodeURIComponent(role)}`;
    try {
      const res = await WebBrowser.openAuthSessionAsync(url, null);
      // After web login, try to read session via API cookie
      await checkSession();
      router.replace('/(tabs)/dashboard');
    } catch (e) {
      setError('Could not open login');
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, justifyContent: 'center', backgroundColor: '#f8fafc' }}>
      <Text style={{ fontSize: 24, fontWeight: '700', marginBottom: 12 }}>Sign In</Text>
      {error ? <Text style={{ color: 'red', marginBottom: 8 }}>{error}</Text> : null}
      <Text style={{ marginBottom: 4 }}>Role (admin | team_manager | member)</Text>
      <TextInput value={role} onChangeText={setRole} style={{ borderWidth: 1, borderColor: '#cbd5e1', padding: 10, borderRadius: 8, marginBottom: 12, backgroundColor: '#fff' }} />
      <TouchableOpacity onPress={openWebLogin} style={{ backgroundColor: '#0d9488', padding: 14, borderRadius: 10 }}>
        <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}>Open Web Login</Text>
      </TouchableOpacity>
      <Text style={{ marginTop: 12, color: '#334155' }}>
        After successful login in the browser, return to the app and it will detect your session.
      </Text>
    </View>
  );
}

