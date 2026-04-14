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
                <div className="absolute bottom-full left-0 right-0 mb-2 px-4 animate-in slide-in-from-bottom-2 duration-200">
                    <div className="bg-white/90 backdrop-blur-md rounded-2xl p-3 shadow-lg border border-gray-100 flex gap-3 items-center group">
                        <div className="w-1 self-stretch bg-[#128c7e] rounded-full" />
                        <div className="flex-1 min-w-0">
                            <p className="text-[#128c7e] text-xs font-bold mb-0.5">
                                {replyingTo.fromMe ? 'Você' : (replyingTo.sender || 'Contato')}
                            </p>
                            <p className="text-gray-500 text-sm truncate">{replyingTo.body}</p>
                        </div>
                        <button onClick={onCancelReply} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                            <X size={18} />
                        </button>
                    </div>
                </div>
            )}

            {showEmojiPicker && (
                <div ref={emojiPickerRef} className="absolute bottom-16 left-4 z-20 w-72 h-80 bg-white shadow-2xl rounded-2xl overflow-hidden flex flex-col border border-gray-200">
                    <div className="p-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                        <span className="font-semibold text-sm">Emojis</span>
                        <button onClick={() => setShowEmojiPicker(false)} className="hover:bg-gray-200 p-1 rounded-lg"><X size={16}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 grid grid-cols-7 gap-1 custom-scrollbar">
                        {EMOJIS.map((e, idx) => (
                            <button key={`${e}-${idx}`} onClick={() => addEmoji(e)} className="text-xl hover:bg-gray-100 p-1 rounded-lg">{e}</button>
                        ))}
                    </div>
                </div>
            )}

            {showAttachmentMenu && (
                <div ref={attachmentMenuRef} className="absolute bottom-16 left-4 z-20 w-48 bg-white shadow-2xl rounded-2xl overflow-hidden py-2 border border-gray-200">
                    <div className="px-4 py-2 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Anexar</span>
                    </div>
                    <button onClick={() => { fileInputRef.current?.click(); setShowAttachmentMenu(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-gray-700 transition-colors">
                        <ImageIcon size={18} className="text-blue-500" />
                        <span className="text-sm font-medium">Fotos e vídeos</span>
                    </button>
                    <button onClick={() => { setShowAttachmentMenu(false); onShareContactClick(); }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-gray-700 transition-colors">
                        <User size={18} className="text-orange-500" />
                        <span className="text-sm font-medium">Contato</span>
                    </button>
                </div>
            )}

            <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => { 
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
