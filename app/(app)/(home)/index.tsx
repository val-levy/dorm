import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../../lib/auth-context';
import { supabase } from '../../../lib/supabase';

interface Channel {
  id: number;
  name: string;
  description?: string;
  is_public: boolean;
}

export default function ChatScreen() {
  const { user } = useAuth();
  const [chapters, setChapters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChapters();
  }, [user]);

  const loadChapters = async () => {
    try {
      setLoading(true);
      if (!user) return;

      // Fetch user's chapter
      const { data: userData } = await supabase
        .from('users')
        .select('chapter_id, chapters(*)')
        .eq('id', user.id)
        .single();

      if (userData?.chapters) {
        setChapters([userData.chapters]);
      }
    } catch (err) {
      console.error('Error loading chapters:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chapters</Text>
      </View>

      {chapters.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No chapters found</Text>
        </View>
      ) : (
        <FlatList
          data={chapters}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.chapterCard}>
              <Text style={styles.chapterName}>{item.name}</Text>
              {item.description && (
                <Text style={styles.chapterDescription}>{item.description}</Text>
              )}
              <Text style={styles.chapterLocation}>{item.location || item.school_name}</Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.list}
        />
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>Chat functionality coming in Phase 1</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  list: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  chapterCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#000',
  },
  chapterName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  chapterDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  chapterLocation: {
    fontSize: 12,
    color: '#999',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});
