'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { gsap } from 'gsap';
import {
  Bell,
  Clock,
  MoreVertical,
  Phone,
  Search,
  ArrowLeft,
  MessageSquare
} from 'lucide-react';

// Types
import { Chat, Message, Contact } from '@/types';

// Utils / Lib
import { formatDateDivider } from '@/lib/frontend-utils';

// Components
import { MessageArea } from '@/components/chat/MessageArea';
import { ChatInput } from '@/components/chat/ChatInput';
import { ChatListItem } from '@/components/chat/ChatListItem';
import { ContactPicker } from '@/components/chat/ContactPicker';
import { ContextMenu } from '@/components/chat/ContextMenu';

export default function Home() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [syncStatus, setSyncStatus] = useState({ remaining: 0, syncing: false });
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para novas funcionalidades
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, message: Message } | null>(null);

  const selectedChatIdRef = useRef<string | null>(null);
  const chatListRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socketInstance = io();
    setSocket(socketInstance);

    socketInstance.on('new-message', (msg: Message) => {
      const currentId = selectedChatIdRef.current;
      if (currentId && (msg.from === currentId || msg.to === currentId)) {
        setMessages((prev) => [...prev, msg]);
      }
    });

    socketInstance.on('chat-update', (updatedChat: Partial<Chat> & { id: string }) => {
      setChats((prevChats) => {
        const chatsCopy = [...prevChats];
        const chatIndex = chatsCopy.findIndex((chat) => chat.id === updatedChat.id);

        if (chatIndex !== -1) {
          const fullChat = { ...chatsCopy[chatIndex], ...updatedChat };
          chatsCopy.splice(chatIndex, 1);
          return [fullChat, ...chatsCopy];
        } else if (updatedChat.name) {
          return [updatedChat as Chat, ...chatsCopy].slice(0, 100);
        }
        return chatsCopy;
      });
    });

    socketInstance.on('message-update', (updatedMsg: Message) => {
      setMessages((prev) => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
    });

    socketInstance.on('messages', (data: { chatId: string; messages: Message[] }) => {
      if (data.chatId === selectedChatIdRef.current) {
        setMessages(data.messages);
        setTimeout(() => {
          if (messageContainerRef.current) {
            messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
          }
        }, 100);
      }
    });

    socketInstance.on('qr', (url) => {
      setQrCode(url);
      setIsReady(false);
    });

    socketInstance.on('ready', () => {
      setIsReady(true);
      setQrCode(null);
      socketInstance.emit('get-chats');
      socketInstance.emit('get-contacts');
    });

    socketInstance.on('chats', (data: Chat[]) => {
      setChats(data);
    });

    socketInstance.on('contacts', (data: Contact[]) => {
      setContacts(data);
    });

    socketInstance.on('search-results', (data: Contact[]) => {
      setContacts(data);
    });

    socketInstance.on('loading-messages', (isLoading: boolean) => {
      setLoadingMessages(isLoading);
    });

    socketInstance.on('sync-status', (status) => {
      setSyncStatus(status);
    });

    socketInstance.on('error', (err: string) => {
      alert(err);
    });

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowContactPicker(false);
      }
    };
    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, []);

  useEffect(() => {
    const chatItems = chatListRef.current?.querySelectorAll('.chat-item');
    if (isReady && chatItems && chatItems.length > 0) {
      gsap.from(chatItems, {
        x: -16,
        opacity: 0,
        duration: 0.35,
        ease: 'power2.out',
        stagger: 0.03,
      });
    }
  }, [isReady, chats.length]);

  const selectChat = (chat: Chat) => {
    setSelectedChat(chat);
    selectedChatIdRef.current = chat.id;
    setMessages([]);
    if (socket) {
      socket.emit('get-messages', chat.id);
      socket.emit('mark-read', chat.id);
    }
    setChats(prev => prev.map(c => c.id === chat.id ? { ...c, unreadCount: 0 } : c));
  };

  const handleBackToList = () => {
    setSelectedChat(null);
    selectedChatIdRef.current = null;
  };

  const handleContextMenu = (e: React.MouseEvent, message: Message) => {
    e.preventDefault();
    setContextMenu({ x: e.pageX, y: e.pageY, message });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const handleReply = (message: Message) => {
    setReplyingTo(message);
    closeContextMenu();
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    closeContextMenu();
  };

  const scrollToMessage = (msgId: string) => {
    const element = document.getElementById(msgId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('wa-message-row--highlight');
      setTimeout(() => {
        element.classList.remove('wa-message-row--highlight');
      }, 1500);
    }
  };

  const readAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (file: File, asSticker = false) => {
    if (socket && selectedChat) {
      try {
        const base64Data = await readAsBase64(file);
        socket.emit('send-media', {
          to: selectedChat.id,
          data: base64Data,
          mimetype: file.type,
          filename: file.name,
          caption: '',
          asSticker
        });
      } catch (e) {
        console.error('Erro ao ler arquivo:', e);
      }
    }
  };

  const handleShareContact = (contactId: string) => {
    if (socket && selectedChat) {
      socket.emit('send-contact', {
        to: selectedChat.id,
        contactId
      });
      setShowContactPicker(false);
    }
  };

  const handleGetContacts = () => {
    if (socket) {
      socket.emit('get-contacts');
      setShowContactPicker(true);
    }
  };

  const filteredChats = useMemo(() => 
    chats.filter((chat) => chat.name.toLowerCase().includes(searchTerm.toLowerCase())),
  [chats, searchTerm]);

  const filteredContacts = useMemo(() => {
    if (!searchTerm) return [];
    // Contacts are now pre-filtered by the server in search-results
    const chatIds = new Set(filteredChats.map(c => c.id));
    return contacts.filter((c) => !chatIds.has(c.id));
  }, [contacts, searchTerm, filteredChats]);

  const messageItems = useMemo(() => {
    return messages.reduce<Array<
      | { type: 'divider'; key: string; label: string }
      | { type: 'message'; key: string; message: Message }
    >>((items, message, index) => {
      const previous = messages[index - 1];
      const currentLabel = formatDateDivider(message.timestamp);
      const previousLabel = previous ? formatDateDivider(previous.timestamp) : null;

      if (index === 0 || previousLabel !== currentLabel) {
        items.push({
          type: 'divider',
          key: `divider-${currentLabel}-${index}`,
          label: currentLabel,
        });
      }

      items.push({
        type: 'message',
        key: `${message.id}-${index}`,
        message,
      });

      return items;
    }, []);
  }, [messages]);

  return (
    <main className="wa-root">
      {!isReady ? (
        <section ref={qrRef} className="wa-auth-card">
          <div className="wa-auth-badge">OpenWPP</div>
          <h1 className="wa-auth-title">Conecte o WhatsApp para abrir sua central de atendimento</h1>
          <p className="wa-auth-copy">Abra o WhatsApp no seu celular, toque em Configurações &gt; Dispositivos Conectados e aponte a câmera para esta tela.</p>

          <div className="wa-auth-qr">
            {qrCode ? (
              <img src={qrCode} alt="WhatsApp QR Code" className="h-64 w-64 rounded-2xl" />
            ) : (
              <div className="flex h-64 w-64 items-center justify-center rounded-2xl bg-white">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#25d366]/20 border-t-[#128c7e]" />
              </div>
            )}
          </div>

          <div className="wa-auth-status">
            <Clock size={14} />
            <span>Aguardando autenticação</span>
          </div>
        </section>
      ) : (
        <section className="wa-shell">
          <aside className={`wa-sidebar ${selectedChat ? 'wa-sidebar--mobile-hidden' : ''}`}>
            <header className="wa-sidebar-top">
              <div className="wa-user-pill">
                <div className="wa-avatar">OW</div>
                <div className="wa-chat-header-text">
                  <h2 className="wa-user-title">OpenWPP Inbox</h2>
                  <p className="wa-user-subtitle">Painel de conversas e histórico</p>
                </div>
              </div>
              <div className="wa-header-actions">
                <button className="wa-icon-button" type="button" aria-label="Notificações">
                  <Bell size={20} />
                </button>
                <button className="wa-icon-button" type="button" aria-label="Mais opções">
                  <MoreVertical size={20} />
                </button>
              </div>
            </header>

            {syncStatus.syncing && (
              <div className="wa-sync-banner">
                <div className="wa-sync-info">
                  <Bell className="animate-pulse" size={16} />
                  <span>Sincronizando histórico</span>
                </div>
                <strong>{syncStatus.remaining} chats restantes</strong>
              </div>
            )}

            <div className="wa-searchbar">
              <Search className="text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Pesquisar ou iniciar nova conversa"
                value={searchTerm}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchTerm(val);
                  if (socket && val.length > 2) {
                    socket.emit('search-contacts', val);
                  } else if (val.length === 0) {
                    setContacts([]);
                  }
                }}
              />
            </div>

            <div ref={chatListRef} className="wa-chatlist custom-scrollbar">
              {filteredChats.map((chat) => (
                <ChatListItem 
                  key={chat.id} 
                  chat={chat} 
                  selected={selectedChat?.id === chat.id} 
                  onSelect={selectChat} 
                />
              ))}

              {filteredContacts.length > 0 && (
                <>
                  <div className="px-4 py-3 text-xs font-bold text-[#128c7e] bg-gray-50 uppercase tracking-widest border-y border-gray-100">
                    Contatos
                  </div>
                  {filteredContacts.map((contact) => (
                    <ChatListItem 
                      key={contact.id} 
                      chat={{
                        id: contact.id,
                        name: contact.name,
                        unreadCount: 0,
                        timestamp: 0
                      }} 
                      selected={selectedChat?.id === contact.id} 
                      onSelect={selectChat} 
                    />
                  ))}
                </>
              )}
            </div>
          </aside>

          <section className={`wa-conversation ${selectedChat ? 'wa-conversation--mobile-active' : 'wa-conversation--mobile-hidden'}`}>
            {selectedChat ? (
              <>
                <header className="wa-chat-header">
                  <div className="wa-chat-header-main">
                    <button type="button" className="wa-icon-button wa-back-button" onClick={handleBackToList} aria-label="Voltar">
                      <ArrowLeft size={18} />
                    </button>
                    <div className="wa-avatar wa-avatar--photo">{selectedChat.name[0]}</div>
                    <div className="wa-chat-header-text">
                      <h2>{selectedChat.name}</h2>
                      <p>{selectedChat.id}</p>
                    </div>
                  </div>
                  <div className="wa-chat-actions">
                    <button className="wa-icon-button" type="button" aria-label="Ligar"><Phone size={18} /></button>
                    <button className="wa-icon-button" type="button" aria-label="Mais opções"><MoreVertical size={18} /></button>
                  </div>
                </header>

                <MessageArea 
                    containerRef={messageContainerRef}
                    messages={messages}
                    loading={loadingMessages}
                    onContextMenu={handleContextMenu}
                    onScrollToMessage={scrollToMessage}
                    messageItems={messageItems}
                />

                <ChatInput 
                    replyingTo={replyingTo}
                    onSendMessage={(text) => {
                        if (socket && selectedChat) {
                            socket.emit('send-message', {
                                to: selectedChat.id,
                                body: text,
                                quotedMsgId: replyingTo?.id
                            });
                            setReplyingTo(null);
                        }
                    }}
                    onCancelReply={() => setReplyingTo(null)}
                    onAttachFile={handleFileUpload}
                    onShareContactClick={handleGetContacts}
                />
              </>
            ) : (
              <div className="wa-blank-panel wa-blank-panel--desktop-only">
                <div className="wa-blank-card">
                  <MessageSquare size={48} className="text-[#128c7e]" />
                  <h3>OpenWPP Desktop</h3>
                  <p>Envie e receba mensagens sem precisar manter seu celular conectado.</p>
                </div>
              </div>
            )}
          </section>
        </section>
      )}

      {showContactPicker && (
        <ContactPicker 
          contacts={filteredContacts}
          searchTerm={contactSearch}
          onSearchChange={setContactSearch}
          onSelect={handleShareContact}
          onClose={() => setShowContactPicker(false)}
        />
      )}

      {contextMenu && (
        <ContextMenu 
          x={contextMenu.x}
          y={contextMenu.y}
          message={contextMenu.message}
          onClose={closeContextMenu}
          onReply={handleReply}
          onCopy={handleCopy}
        />
      )}
    </main>
  );
}
