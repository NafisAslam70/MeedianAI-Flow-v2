import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView } from 'react-native';
import { fetchJson } from '../../lib/api';

export default function MRIs() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roles, setRoles] = useState([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetchJson('/api/member/mris/roles');
        setRoles(res?.roles || res?.mriRoles || []);
      } catch (e) {
        setError(e.message || 'Failed to load roles');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /><Text>Loading…</Text></View>;
  if (error) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}><Text style={{ color: 'red', textAlign: 'center' }}>{error}</Text></View>;

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 12 }}>My MRI Roles</Text>
      {roles.length === 0 ? (
        <Text>No active roles.</Text>
      ) : roles.map((r, idx) => (
        <View key={idx} style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' }}>
          <Text style={{ fontWeight: '600' }}>{String(r).replaceAll('_', ' ').toUpperCase()}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

