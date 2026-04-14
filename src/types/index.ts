export interface Chat {
  id: string;
  name: string;
  unreadCount: number;
  timestamp: number;
  isGroup?: boolean;
  lastMessage?: {
    body: string;
    timestamp: number;
  } | null;
}

export interface Message {
  id: string;
  from: string;
  to?: string;
  fromMe?: boolean | number;
  body: string;
  timestamp: number;
  sender: string;
  contentType?: string;
  mediaMimeType?: string | null;
  mediaFilename?: string | null;
  mediaUrl?: string | null;
  quotedMsgId?: string | null;
  quotedMsgBody?: string | null;
  quotedMsgSender?: string | null;
}

export interface Contact {
  id: string;
  name: string;
}
