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
            className="mb-2 p-2 bg-black/5 rounded-lg border-l-4 border-[#128c7e] text-xs cursor-pointer hover:bg-black/10 transition-colors"
          >
            <p className="font-bold text-[#128c7e] mb-0.5 truncate">
              {msg.quotedMsgSender === 'me' ? 'Você' : (msg.quotedMsgSender || 'Contato')}
            </p>
            <p className="text-gray-500 truncate">{msg.quotedMsgBody}</p>
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
