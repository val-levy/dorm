export interface DbUser {
  id: number;
  auth_id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  chapter_id: number | null;
}

export interface Channel {
  id: number;
  chapter_id: number;
  name: string;
  description: string | null;
  is_public: boolean;
  is_announcement_only: boolean;
  created_at: string;
}

export interface Message {
  id: number;
  channel_id: number;
  thread_id: number | null;
  author_id: number;
  content: string;
  attachments: unknown[];
  mentions: unknown[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  author: Pick<DbUser, 'id' | 'name' | 'avatar_url'> | null;
}

export interface MessageReaction {
  id: number;
  message_id: number;
  user_id: number;
  emoji: string;
  created_at: string;
}
