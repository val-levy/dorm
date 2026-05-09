import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const isBrowser = () => typeof window !== 'undefined';

// Custom storage adapter for mobile (secure) + web. Expo Router can evaluate this
// module during web server rendering, where browser storage is unavailable.
const storage = {
  getItem: async (key: string) => {
    if (Platform.OS === 'web') {
      if (!isBrowser()) {
        return null;
      }
      return AsyncStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      if (!isBrowser()) {
        return;
      }
      return AsyncStorage.setItem(key, value);
    }
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string) => {
    if (Platform.OS === 'web') {
      if (!isBrowser()) {
        return;
      }
      return AsyncStorage.removeItem(key);
    }
    return SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Helper to check if user is authenticated
export async function isAuthenticated() {
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}

// Export types
export type { User } from '@supabase/supabase-js';
