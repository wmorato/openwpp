'use client';

import React, { useMemo, memo } from 'react';
import { CheckCheck } from 'lucide-react';
import { layoutMessage } from '@/lib/pretext-utils';
import { Message } from '@/types';
import { formatMessageDateTime } from '@/lib/frontend-utils';
import { MessageContent } from './MessageContent';

interface MessageBubbleProps {
  msg: Message;
  onContextMenu: (e: React.MouseEvent, m: Message) => void;
  onScrollToMessage: (id: string) => void;
}

export const MessageBubble = memo(({ 
  msg,  
  onContextMenu, 
  onScrollToMessage 
}: MessageBubbleProps) => {
  const isMine = useMemo(() => 
    Boolean(msg.fromMe) || msg.sender === 'me' || msg.id.startsWith('true_'), 
  [msg.fromMe, msg.sender, msg.id]);

  const lines = useMemo(() => {
    if (typeof window === 'undefined') return [{ text: msg.body }];
    try {
      return layoutMessage(msg.body, '14px Segoe UI', 420);
    } catch {
      return [{ text: msg.body }];
    }
  }, [msg.body]);

  return (
    <div 
      id={msg.id}
      onContextMenu={(e) => onContextMenu(e, msg)}
      className={`wa-message-row ${isMine ? 'wa-message-row--mine' : 'wa-message-row--theirs'}`}
    >
      <div className={`wa-message-bubble ${isMine ? 'wa-message-bubble--mine' : 'wa-message-bubble--theirs'}`}>
        {msg.quotedMsgId && (
          <div 
            onClick={() => onScrollToMessage(msg.quotedMsgId!)}
            className="wa-quoted-message"
          >
            <p className="wa-quoted-title">
              {msg.quotedMsgSender === 'me' ? 'Você' : (msg.quotedMsgSender || 'Contato')}
            </p>
            <p className="wa-quoted-text">{msg.quotedMsgBody}</p>
          </div>
        )}
        
        <MessageContent msg={msg} lines={lines} />

        <div className="wa-message-meta">
          <span>{formatMessageDateTime(msg.timestamp)}</span>
          {isMine && <CheckCheck size={13} className="text-[#53bdeb]" />}
        </div>
      </div>
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';
