// Jest setup file
import '@testing-library/jest-native/extend-expect';

// Mock Supabase client
jest.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: jest.fn(),
      signInWithOAuth: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
      insert: jest.fn(),
      update: jest.fn(),
    })),
  },
}));
