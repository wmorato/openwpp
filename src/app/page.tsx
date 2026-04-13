'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { gsap } from 'gsap';
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  Clock,
  MessageSquare,
  MoreVertical,
  Paperclip,
  Phone,
  Search,
  Send,
} from 'lucide-react';
import { layoutMessage } from '@/lib/pretext-utils';

interface Chat {
  id: string;
  name: string;
  unreadCount: number;
  timestamp: number;
}

interface Message {
  id: string;
  from: string;
  to?: string;
  fromMe?: boolean;
  body: string;
  timestamp: number;
  sender: string;
  contentType?: string;
  mediaMimeType?: string | null;
  mediaFilename?: string | null;
  mediaUrl?: string | null;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'WA';
}

function formatChatListTime(timestamp: number) {
  if (!timestamp) return 'agora';

  const date = new Date(timestamp * 1000);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  return sameDay
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
}

function formatMessageDateTime(timestamp: number) {
  if (!timestamp) return 'Sem data';

  return new Date(timestamp * 1000).toLocaleString([], {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateDivider(timestamp: number) {
  if (!timestamp) return 'Sem data';

  return new Date(timestamp * 1000).toLocaleDateString([], {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function renderMessageContent(msg: Message, lines: Array<{ text: string }>) {
  const caption = msg.body?.trim();

  if (msg.contentType === 'image' && msg.mediaUrl) {
    return (
      <div className="space-y-2">
        <img src={msg.mediaUrl} alt={caption || 'Imagem'} className="wa-media wa-media--image" />
        {caption ? <div className="text-sm leading-5 tracking-tight">{caption}</div> : null}
      </div>
    );
  }

  if (msg.contentType === 'video' && msg.mediaUrl) {
    return (
      <div className="space-y-2">
        <video controls className="wa-media wa-media--video">
          <source src={msg.mediaUrl} type={msg.mediaMimeType || 'video/mp4'} />
        </video>
        {caption ? <div className="text-sm leading-5 tracking-tight">{caption}</div> : null}
      </div>
    );
  }

  if (msg.contentType === 'audio' && msg.mediaUrl) {
    return (
      <div className="space-y-2">
        <audio controls className="wa-media wa-media--audio">
          <source src={msg.mediaUrl} type={msg.mediaMimeType || 'audio/ogg'} />
        </audio>
        {caption ? <div className="text-sm leading-5 tracking-tight">{caption}</div> : null}
      </div>
    );
  }

  if ((msg.contentType === 'document' || msg.contentType === 'file' || msg.contentType === 'sticker') && msg.mediaUrl) {
    return (
      <a href={msg.mediaUrl} target="_blank" rel="noreferrer" className="wa-file-card">
        <div>
          <strong>{msg.mediaFilename || 'Abrir arquivo'}</strong>
          <p>{msg.mediaMimeType || 'Arquivo'}</p>
        </div>
      </a>
    );
  }

  return (
    <div className="space-y-0.5">
      {lines.map((line, lineIndex) => (
        <div key={lineIndex} className="text-sm leading-5 tracking-tight">
          {line.text}
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [syncStatus, setSyncStatus] = useState({ remaining: 0, syncing: false });
  const [searchTerm, setSearchTerm] = useState('');

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

      const chatId = msg.fromMe ? msg.to : msg.from;
      setChats((prevChats) => {
        const chatsCopy = [...prevChats];
        const chatIndex = chatsCopy.findIndex((chat) => chat.id === chatId);

        if (chatIndex === -1) return prevChats;

        const updatedChat = {
          ...chatsCopy[chatIndex],
          timestamp: msg.timestamp || chatsCopy[chatIndex].timestamp,
        };

        chatsCopy.splice(chatIndex, 1);
        return [updatedChat, ...chatsCopy];
      });
    });

    socketInstance.on('messages', (data: { chatId: string; messages: Message[] }) => {
      if (data.chatId === selectedChatIdRef.current) {
        console.log('Renderizando histórico para', data.chatId, 'Total:', data.messages.length);
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
    });

    socketInstance.on('chats', (data: Chat[]) => {
      setChats(data);
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

  useEffect(() => {
    if (qrCode && qrRef.current) {
      gsap.from(qrRef.current, {
        scale: 0.92,
        opacity: 0,
        duration: 0.7,
        ease: 'power3.out',
      });
    }
  }, [qrCode]);

  const selectChat = (chat: Chat) => {
    setSelectedChat(chat);
    selectedChatIdRef.current = chat.id;
    setMessages([]);
    if (socket) {
      socket.emit('get-messages', chat.id);
    }
  };

  const handleBackToList = () => {
    setSelectedChat(null);
    selectedChatIdRef.current = null;
  };

  const handleSendMessage = () => {
    if (socket && selectedChat && inputText.trim()) {
      socket.emit('send-message', {
        to: selectedChat.id,
        body: inputText,
      });
      setInputText('');
    }
  };

  const filteredChats = chats.filter((chat) =>
    chat.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const messageItems = messages.reduce<Array<
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

  return (
    <main className="wa-root">
      {!isReady ? (
        <section ref={qrRef} className="wa-auth-card">
          <div className="wa-auth-badge">OpenWPP</div>
          <h1 className="wa-auth-title">Conecte o WhatsApp para abrir sua central de atendimento</h1>
          <p className="wa-auth-copy">
            Uma interface inspirada no WhatsApp Business: lista de conversas, bolhas bem separadas e
            leitura confortável no desktop e no mobile.
          </p>

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
            <div className="wa-sidebar-top">
              <div className="wa-user-pill">
                <div className="wa-avatar wa-avatar--soft">OW</div>
                <div>
                  <p className="wa-user-title">OpenWPP Inbox</p>
                  <p className="wa-user-subtitle">Painel de conversas e histórico</p>
                </div>
              </div>
              <button className="wa-icon-button" type="button" aria-label="Mais opções">
                <MoreVertical size={18} />
              </button>
            </div>

            {syncStatus.syncing && (
              <div className="wa-notice">
                <Bell size={18} className="text-[#128c7e]" />
                <div>
                  <p className="wa-notice-title">Sincronizando histórico</p>
                  <p className="wa-notice-copy">{syncStatus.remaining} chats restantes</p>
                </div>
              </div>
            )}

            <div className="wa-searchbar">
              <Search size={16} className="text-[#667781]" />
              <input
                type="text"
                placeholder="Pesquisar ou iniciar nova conversa"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div ref={chatListRef} className="wa-chatlist custom-scrollbar">
              {filteredChats.map((chat) => {
                const selected = selectedChat?.id === chat.id;

                return (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => selectChat(chat)}
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
              })}
            </div>
          </aside>

          <section
            className={`wa-conversation ${
              selectedChat ? 'wa-conversation--mobile-active' : 'wa-conversation--mobile-hidden'
            }`}
          >
            {selectedChat ? (
              <>
                <header className="wa-chat-header">
                  <div className="wa-chat-header-main">
                    <button
                      type="button"
                      className="wa-icon-button wa-back-button"
                      onClick={handleBackToList}
                      aria-label="Voltar"
                    >
                      <ArrowLeft size={18} />
                    </button>

                    <div className="wa-avatar wa-avatar--photo">{getInitials(selectedChat.name)}</div>

                    <div className="wa-chat-header-text">
                      <h2>{selectedChat.name}</h2>
                      <p>{selectedChat.id}</p>
                    </div>
                  </div>

                  <div className="wa-chat-actions">
                    <button className="wa-icon-button" type="button" aria-label="Ligar">
                      <Phone size={18} />
                    </button>
                    <button className="wa-icon-button" type="button" aria-label="Mais opções">
                      <MoreVertical size={18} />
                    </button>
                  </div>
                </header>

                <div ref={messageContainerRef} className="wa-message-area custom-scrollbar">
                  {loadingMessages ? (
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
                    messageItems.map((item, index) => {
                      if (item.type === 'divider') {
                        return (
                          <div key={item.key} className="wa-date-divider">
                            <span>{item.label}</span>
                          </div>
                        );
                      }

                      const msg = item.message;
                      let lines = [{ text: msg.body }];
                      if (typeof window !== 'undefined') {
                        try {
                          lines = layoutMessage(msg.body, '14px Segoe UI', 420);
                        } catch {}
                      }

                      const isMine =
                        Boolean(msg.fromMe) ||
                        msg.sender === 'me' ||
                        msg.id.startsWith('true_');

                      return (
                        <div
                          key={item.key}
                          className={`wa-message-row ${isMine ? 'wa-message-row--mine' : 'wa-message-row--theirs'}`}
                        >
                          <div className={`wa-message-bubble ${isMine ? 'wa-message-bubble--mine' : 'wa-message-bubble--theirs'}`}>
                            {renderMessageContent(msg, lines)}

                            <div className="wa-message-meta">
                              <span>{formatMessageDateTime(msg.timestamp)}</span>
                              {isMine && <CheckCheck size={13} className="text-[#53bdeb]" />}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <footer className="wa-inputbar">
                  <button className="wa-icon-button" type="button" aria-label="Anexar">
                    <Paperclip size={18} />
                  </button>

                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Digite uma mensagem"
                  />

                  <button
                    type="button"
                    onClick={handleSendMessage}
                    className="wa-send-button"
                    aria-label="Enviar"
                  >
                    <Send size={18} />
                  </button>
                </footer>
              </>
            ) : (
              <div className="wa-blank-panel wa-blank-panel--desktop-only">
                <div className="wa-blank-card">
                  <MessageSquare size={48} className="text-[#128c7e]" />
                  <h3>Escolha uma conversa</h3>
                  <p>
                    A interface agora segue um layout inspirado no WhatsApp Web e no WhatsApp Business,
                    com foco em leitura, separação visual das bolhas e adaptação para mobile.
                  </p>
                </div>
              </div>
            )}
          </section>
        </section>
      )}
    </main>
  );
}
