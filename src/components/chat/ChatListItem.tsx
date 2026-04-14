'use client';

import React from 'react';
import { Chat } from '@/types';
import { getInitials, formatChatListTime } from '@/lib/frontend-utils';

interface ChatListItemProps {
  chat: Chat;
  selected: boolean;
  onSelect: (chat: Chat) => void;
}

export const ChatListItem = ({ chat, selected, onSelect }: ChatListItemProps) => {
  return (
    <button
      type="button"
      onClick={() => onSelect(chat)}
      className={`chat-item wa-chatlist-item ${selected ? 'wa-chatlist-item--active' : ''}`}
    >
      <div className="wa-avatar">{getInitials(chat.name)}</div>
      <div className="wa-chat-meta">
        <div className="wa-chat-meta-row">
          <h3>{chat.name}</h3>
          <span>{formatChatListTime(chat.timestamp)}</span>
        </div>
        <div className="wa-chat-meta-row">
          <p>{chat.unreadCount > 0 ? `${chat.unreadCount} novas mensagens` : 'Toque para abrir a conversa'}</p>
          {chat.unreadCount > 0 && <strong>{chat.unreadCount}</strong>}
        </div>
      </div>
    </button>
  );
};
