'use client';

import React, { memo } from 'react';
import { MessageSquare } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { Message } from '@/types';

interface MessageAreaProps {
  messages: Message[];
  loading: boolean;
  onContextMenu: (e: React.MouseEvent, m: Message) => void;
  onScrollToMessage: (id: string) => void;
  messageItems: any[];
  containerRef: React.RefObject<HTMLDivElement>;
}

export const MessageArea = memo(({ 
    messages, 
    loading, 
    onContextMenu, 
    onScrollToMessage, 
    messageItems,
    containerRef 
}: MessageAreaProps) => {
    return (
        <div ref={containerRef} className="wa-message-area custom-scrollbar">
            {loading ? (
                <div className="wa-empty-state">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#25d366]/20 border-t-[#128c7e]" />
                    <p>Sincronizando histórico da conversa...</p>
                </div>
            ) : messages.length === 0 ? (
                <div className="wa-empty-state">
                    <MessageSquare size={52} className="text-[#8696a0]" />
                    <p>Nenhuma mensagem disponível nesta sessão</p>
                </div>
            ) : (
                messageItems.map((item: any) => {
                    if (item.type === 'divider') {
                        return (
                            <div key={item.key} className="wa-date-divider">
                                <span>{item.label}</span>
                            </div>
                        );
                    }
                    return (
                        <MessageBubble 
                            key={item.key}
                            msg={item.message}
                            onContextMenu={onContextMenu}
                            onScrollToMessage={onScrollToMessage}
                        />
                    );
                })
            )}
        </div>
    );
});

MessageArea.displayName = 'MessageArea';
