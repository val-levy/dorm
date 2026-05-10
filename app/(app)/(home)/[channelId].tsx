import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useAuth } from '../../../lib/auth-context';
import { supabase } from '../../../lib/supabase';
import type { Message } from '../../../lib/types';

export default function ChannelScreen() {
  const { channelId, name } = useLocalSearchParams<{ channelId: string; name: string }>();
  const { user } = useAuth();
  const navigation = useNavigation();

  useEffect(() => {
    if (name) navigation.setOptions({ headerTitle: `#${name}` });
  }, [name, navigation]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [dbUserId, setDbUserId] = useState<number | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const channelIdNum = Number(channelId);

  // Resolve auth UUID → db bigint user id, then join + load messages
  useEffect(() => {
    if (!user || !channelIdNum) return;
    let cancelled = false;

    (async () => {
      const { data: dbUser } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single();

      if (cancelled || !dbUser) return;
      setDbUserId(dbUser.id);

      // Auto-join channel so RLS allows message read/write
      await supabase
        .from('users_in_channels')
        .upsert({ user_id: dbUser.id, channel_id: channelIdNum }, { onConflict: 'user_id,channel_id' });

      const { data } = await supabase
        .from('messages')
        .select('*, author:users!messages_author_id_fkey(id, name, avatar_url)')
        .eq('channel_id', channelIdNum)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(50);

      if (!cancelled) {
        setMessages((data as Message[]) ?? []);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user, channelIdNum]);

  // Realtime subscription for new messages
  useEffect(() => {
    if (!channelIdNum) return;

    const sub = supabase
      .channel(`messages:${channelIdNum}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelIdNum}`,
        },
        async (payload) => {
          // Fetch the full row with author so we match the Message shape
          const { data } = await supabase
            .from('messages')
            .select('*, author:users!messages_author_id_fkey(id, name, avatar_url)')
            .eq('id', payload.new.id)
            .single();

          if (data) {
            setMessages((prev) => [...prev, data as Message]);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [channelIdNum]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const sendMessage = useCallback(async () => {
    const content = draft.trim();
    if (!content || !dbUserId || !channelIdNum) return;

    setSending(true);
    setDraft('');

    await supabase.from('messages').insert({
      channel_id: channelIdNum,
      author_id: dbUserId,
      content,
    });

    setSending(false);
  }, [draft, dbUserId, channelIdNum]);

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const prev = index > 0 ? messages[index - 1] : null;
    const isGrouped = prev && prev.author_id === item.author_id &&
      new Date(item.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60 * 1000;

    const authorName = item.author?.name ?? 'Unknown';
    const time = new Date(item.created_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <View style={[styles.messageRow, isGrouped && styles.messageRowGrouped]}>
        {!isGrouped && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {authorName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        {isGrouped && <View style={styles.avatarPlaceholder} />}
        <View style={styles.messageContent}>
          {!isGrouped && (
            <View style={styles.messageMeta}>
              <Text style={styles.authorName}>{authorName}</Text>
              <Text style={styles.timestamp}>{time}</Text>
            </View>
          )}
          <Text style={styles.messageText}>{item.content}</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No messages yet. Say hello!</Text>
          </View>
        }
      />

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder={`Message #${name ?? channelId}`}
          placeholderTextColor="#999"
          multiline
          returnKeyType="send"
          onSubmitEditing={sendMessage}
          blurOnSubmit={false}
          editable={!sending}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!draft.trim() || sending}
        >
          <Text style={styles.sendBtnText}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  messageList: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexGrow: 1,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    color: '#999',
    fontSize: 15,
  },
  messageRow: {
    flexDirection: 'row',
    marginTop: 16,
    alignItems: 'flex-start',
  },
  messageRowGrouped: {
    marginTop: 2,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  avatarPlaceholder: {
    width: 36,
    marginRight: 10,
    flexShrink: 0,
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  messageContent: {
    flex: 1,
  },
  messageMeta: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 2,
  },
  authorName: {
    fontWeight: '600',
    fontSize: 14,
    color: '#000',
    marginRight: 8,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  messageText: {
    fontSize: 15,
    color: '#111',
    lineHeight: 20,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    color: '#000',
    backgroundColor: '#f9f9f9',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendBtnDisabled: {
    backgroundColor: '#ccc',
  },
  sendBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
