import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function PostsScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Posts</Text>
      </View>

      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>📝</Text>
        <Text style={styles.placeholderTitle}>Blog Coming Soon</Text>
        <Text style={styles.placeholderDescription}>
          Long-form pitches will be available in Phase 2
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
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
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 64,
    marginBottom: 16,
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  placeholderDescription: {
    fontSize: 14,
    color: '#666',
  },
});
