import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../lib/auth-context';
import { supabase } from '../../../lib/supabase';
import type { Channel } from '../../../lib/types';

export default function ChannelListScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [chapterName, setChapterName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;

    const { data: dbUser } = await supabase
      .from('users')
      .select('chapter_id, chapters(name)')
      .eq('auth_id', user.id)
      .single();

    if (!dbUser?.chapter_id) {
      setLoading(false);
      return;
    }

    const chapterData = dbUser.chapters as unknown as { name: string } | null;
    if (chapterData) setChapterName(chapterData.name);

    const { data } = await supabase
      .from('channels')
      .select('*')
      .eq('chapter_id', dbUser.chapter_id)
      .is('deleted_at', null)
      .order('name');

    setChannels(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openChannel = (channel: Channel) => {
    router.push(`/(app)/(home)/${channel.id}?name=${encodeURIComponent(channel.name)}`);
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
      {chapterName ? (
        <View style={styles.header}>
          <Text style={styles.chapterName}>{chapterName}</Text>
          <Text style={styles.headerSub}>Channels</Text>
        </View>
      ) : null}

      {channels.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No channels yet</Text>
        </View>
      ) : (
        <FlatList
          data={channels}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => openChannel(item)}>
              <View style={styles.rowLeft}>
                <Text style={styles.channelIcon}>#</Text>
                <View>
                  <Text style={styles.channelName}>{item.name}</Text>
                  {item.description ? (
                    <Text style={styles.channelDesc} numberOfLines={1}>
                      {item.description}
                    </Text>
                  ) : null}
                </View>
              </View>
              {item.is_announcement_only && (
                <Text style={styles.badge}>Announce</Text>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  chapterName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  headerSub: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  channelIcon: {
    fontSize: 18,
    color: '#999',
    marginRight: 10,
    width: 20,
    textAlign: 'center',
  },
  channelName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
  },
  channelDesc: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  badge: {
    fontSize: 11,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});
