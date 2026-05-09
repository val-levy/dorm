import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';

type AuthRedirectError = {
  code: string | null;
  description: string;
};

const getAuthRedirectError = (): AuthRedirectError | null => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }

  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const queryParams = new URLSearchParams(window.location.search);
  const error = params.get('error') ?? queryParams.get('error');

  if (!error) {
    return null;
  }

  return {
    code: params.get('error_code') ?? queryParams.get('error_code'),
    description:
      params.get('error_description') ??
      queryParams.get('error_description') ??
      'The sign-in link is invalid or has expired.',
  };
};

export default function CompleteProfileScreen() {
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [chapter, setChapter] = useState<string | null>(null);
  const [chapterId, setChapterId] = useState<number | null>(null);
  const [authRedirectError] = useState<AuthRedirectError | null>(() => getAuthRedirectError());
  const router = useRouter();
  const { user, isLoading, signUp } = useAuth();

  useEffect(() => {
    // Auto-detect chapter from email domain
    if (user?.email) {
      const domain = user.email.split('@')[1];
      detectChapter(domain);
    }
  }, [user]);

  const detectChapter = async (domain: string) => {
    try {
      const { data } = await supabase
        .from('chapter_domains')
        .select('chapter_id, chapters(name)')
        .eq('email_domain', domain)
        .single();

      if (data) {
        const chapterData = Array.isArray(data.chapters) ? data.chapters[0] : data.chapters;
        setChapter(chapterData?.name ?? null);
        setChapterId(data.chapter_id);
      }
    } catch (err) {
      console.log('Chapter detection:', err);
    }
  };

  const handleComplete = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    setLoading(true);
    try {
      if (!user) throw new Error('No authenticated user');

      const { error: updateError } = await supabase
        .from('users')
        .upsert({
          auth_id: user.id,
          email: user.email,
          name: name.trim(),
          bio: bio.trim() || null,
          chapter_id: chapterId,
        }, {
          onConflict: 'email',
        });

      if (updateError) throw updateError;

      // Navigate to app
      router.replace('/(app)/(home)');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save profile';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendLink = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    setLoading(true);
    try {
      await signUp(email.trim());
      router.replace('/verify-email');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send magic link';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  if (authRedirectError) {
    const isExpiredOtp = authRedirectError.code === 'otp_expired';

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>{isExpiredOtp ? 'Link Expired' : 'Sign-in Link Failed'}</Text>
          <Text style={styles.subtitle}>
            {isExpiredOtp
              ? 'That magic link is no longer valid. Request a fresh link to continue.'
              : authRedirectError.description}
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="student@harvard.edu"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              editable={!loading}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleResendLink}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Send New Magic Link</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => router.replace('/login')}
            disabled={loading}
          >
            <Text style={styles.secondaryButtonText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#000" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>Complete Your Profile</Text>
        <Text style={styles.subtitle}>Help the community get to know you</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>Full Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="John Smith"
            placeholderTextColor="#999"
            value={name}
            onChangeText={setName}
            editable={!loading}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Tell us about yourself (optional)"
            placeholderTextColor="#999"
            value={bio}
            onChangeText={setBio}
            editable={!loading}
            multiline
            numberOfLines={3}
          />
        </View>

        {chapter && (
          <View style={styles.field}>
            <Text style={styles.label}>Chapter</Text>
            <View style={styles.chapterTag}>
              <Text style={styles.chapterText}>{chapter}</Text>
            </View>
          </View>
        )}

        {user?.email && (
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.emailText}>{user.email}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleComplete}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Complete Profile</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  form: {},
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000',
  },
  textarea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  chapterTag: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  chapterText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  emailText: {
    fontSize: 16,
    color: '#666',
  },
  button: {
    backgroundColor: '#000',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
});
