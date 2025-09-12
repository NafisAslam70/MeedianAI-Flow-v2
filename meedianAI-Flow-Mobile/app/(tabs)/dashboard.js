import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { useAuth } from '../../lib/auth';
import { fetchJson } from '../../lib/api';

export default function Dashboard() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      // managersCommon dashboard or member meRightNow snapshot
      const res = await fetchJson('/api/member/meRightNow');
      setData(res);
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Loading…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Text style={{ color: 'red', textAlign: 'center' }}>{error}</Text>
        <Text style={{ marginTop: 8, textAlign: 'center' }}>If unauthorized, sign in from the Account tab.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}> 
      <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 12 }}>Me Right Now</Text>
      {Array.isArray(data?.tasks) && data.tasks.length > 0 ? (
        data.tasks.map((t, idx) => (
          <View key={idx} style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' }}>
            <Text style={{ fontWeight: '600' }}>{t.title || t.name || 'Task'}</Text>
            {t.description ? <Text style={{ color: '#475569', marginTop: 4 }}>{t.description}</Text> : null}
          </View>
        ))
      ) : (
        <Text style={{ color: '#475569' }}>No tasks right now.</Text>
      )}
    </ScrollView>
  );
}

