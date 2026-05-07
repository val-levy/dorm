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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';

export default function CompleteProfileScreen() {
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [chapter, setChapter] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuth();

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
        setChapter(data.chapters.name);
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

      // Update user profile
      const { error: updateError } = await supabase
        .from('users')
        .update({
          name: name.trim(),
          bio: bio.trim() || null,
        })
        .eq('id', user.id);

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
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
