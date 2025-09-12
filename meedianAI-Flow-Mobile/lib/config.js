import Constants from 'expo-constants';

export const API_BASE = (Constants.expoConfig?.extra?.apiBase) || process.env.EXPO_PUBLIC_API_BASE || '';

