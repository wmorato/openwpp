'use client';

import React from 'react';
import { FileText } from 'lucide-react';
import { Message } from '@/types';

interface MessageContentProps {
  msg: Message;
  lines: Array<{ text: string }>;
}

export const MessageContent = ({ msg, lines }: MessageContentProps) => {
  const caption = msg.body?.trim();

  if (msg.contentType === 'image' && msg.mediaUrl) {
    return (
      <div className="space-y-2">
        <img src={msg.mediaUrl} alt={caption || 'Imagem'} className="wa-media wa-media--image" />
        {caption ? <div className="text-sm leading-5 tracking-tight">{caption}</div> : null}
      </div>
    );
  }

  if (msg.contentType === 'sticker' && msg.mediaUrl) {
      return <img src={msg.mediaUrl} alt="Sticker" className="wa-media wa-media--sticker" style={{maxWidth: '150px'}} />;
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

  if ((msg.contentType === 'document' || msg.contentType === 'file') && msg.mediaUrl) {
    return (
      <a href={msg.mediaUrl} target="_blank" rel="noreferrer" className="wa-file-card">
        <FileText size={20} className="mr-3 text-[#128c7e]" />
        <div>
          <strong>{msg.mediaFilename || 'Abrir arquivo'}</strong>
          <p>{msg.mediaMimeType || 'Arquivo'}</p>
        </div>
      </a>
    );
  }

  return (
    <div className="space-y-0.5">
      {lines.map((line, lid) => (
        <div key={lid} className="text-sm leading-5 tracking-tight whitespace-pre-wrap break-words">{line.text}</div>
      ))}
    </div>
  );
};
