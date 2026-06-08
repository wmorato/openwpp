'use client';

import React, { useState, useRef, useEffect, memo } from 'react';
import { Smile, Paperclip, ImageIcon, User, X, Send } from 'lucide-react';
import { Message } from '@/types';
import { EMOJIS } from '@/lib/frontend-utils';

interface ChatInputProps {
    onSendMessage: (text: string) => void;
    replyingTo: Message | null;
    onCancelReply: () => void;
    onAttachFile: (file: File) => void;
    onShareContactClick: () => void;
}

export const ChatInput = memo(({ 
    onSendMessage, 
    replyingTo, 
    onCancelReply,
    onAttachFile,
    onShareContactClick
}: ChatInputProps) => {
    const [inputText, setInputText] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
    
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const emojiPickerRef = useRef<HTMLDivElement>(null);
    const attachmentMenuRef = useRef<HTMLDivElement>(null);
    const emojiTriggerRef = useRef<HTMLButtonElement>(null);
    const attachmentTriggerRef = useRef<HTMLButtonElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showEmojiPicker && emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node) && 
                emojiTriggerRef.current && !emojiTriggerRef.current.contains(event.target as Node)) {
                setShowEmojiPicker(false);
            }
            if (showAttachmentMenu && attachmentMenuRef.current && !attachmentMenuRef.current.contains(event.target as Node) && 
                attachmentTriggerRef.current && !attachmentTriggerRef.current.contains(event.target as Node)) {
                setShowAttachmentMenu(false);
            }
        };
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setShowEmojiPicker(false);
                setShowAttachmentMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEsc);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEsc);
        };
    }, [showEmojiPicker, showAttachmentMenu]);

    const handleSend = () => {
        if (!inputText.trim()) return;
        onSendMessage(inputText);
        setInputText('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
    };

    const addEmoji = (emoji: string) => {
        setInputText(prev => prev + emoji);
        setShowEmojiPicker(false);
    };

    return (
        <footer className="wa-inputbar relative">
            {replyingTo && (
                <div className="wa-reply-box">
                    <div className="wa-reply-content">
                        <div className="wa-reply-bar" />
                        <div className="wa-reply-text">
                            <h4>{replyingTo.fromMe ? 'Você' : (replyingTo.sender || 'Contato')}</h4>
                            <p>{replyingTo.body}</p>
                        </div>
                        <button onClick={onCancelReply} className="wa-reply-close">
                            <X size={18} />
                        </button>
                    </div>
                </div>
            )}

            {showEmojiPicker && (
                <div ref={emojiPickerRef} className="wa-popup-menu wa-popup-menu--emoji">
                    <div className="wa-popup-header">
                        <span>Emojis</span>
                        <button onClick={() => setShowEmojiPicker(false)} className="wa-reply-close"><X size={16}/></button>
                    </div>
                    <div className="wa-emoji-grid custom-scrollbar">
                        {EMOJIS.map((e, idx) => (
                            <button key={`${e}-${idx}`} onClick={() => addEmoji(e)} className="wa-emoji-btn">{e}</button>
                        ))}
                    </div>
                </div>
            )}

            {showAttachmentMenu && (
                <div ref={attachmentMenuRef} className="wa-popup-menu wa-popup-menu--attach">
                    <button onClick={() => { fileInputRef.current?.click(); setShowAttachmentMenu(false); }} className="wa-attach-btn">
                        <ImageIcon size={18} className="text-[#005c4b]" />
                        <span>Fotos e vídeos</span>
                    </button>
                </div>
            )}

            <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={(e) => { 
                const file = e.target.files?.[0];
                if (file) { onAttachFile(file); e.target.value = ''; }
            }} />

            <button ref={emojiTriggerRef} className={`wa-icon-button ${showEmojiPicker ? 'text-[#128c7e]' : ''}`} type="button" onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowAttachmentMenu(false); }}>
                <Smile size={22} />
            </button>

            <button ref={attachmentTriggerRef} className={`wa-icon-button ${showAttachmentMenu ? 'text-[#128c7e]' : ''}`} type="button" onClick={() => { setShowAttachmentMenu(!showAttachmentMenu); setShowEmojiPicker(false); }}>
                <Paperclip size={22} />
            </button>

            <textarea
                ref={textareaRef}
                rows={1}
                value={inputText}
                onChange={(e) => {
                    setInputText(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 240)}px`;
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                    }
                }}
                placeholder="Digite uma mensagem"
                className="wa-textarea"
            />

            <button type="button" onClick={handleSend} className="wa-send-button" aria-label="Enviar">
                <Send size={18} />
            </button>
        </footer>
    );
});

ChatInput.displayName = 'ChatInput';
