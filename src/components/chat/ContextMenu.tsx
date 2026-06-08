'use client';

import React, { useEffect, useRef } from 'react';
import { 
  Reply, Copy, Forward, Pin, Star, ThumbsUp, Heart, 
  Laugh, Frown, Trash2, AlertTriangle, SmilePlus, X 
} from 'lucide-react';
import { Message } from '@/types';

interface ContextMenuProps {
  x: number;
  y: number;
  message: Message;
  onClose: () => void;
  onReply: (m: Message) => void;
  onCopy: (text: string) => void;
}

export const ContextMenu = ({ x, y, message, onClose, onReply, onCopy }: ContextMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  // Ajustar posição se o menu sair da tela
  const adjustedX = Math.min(x, typeof window !== 'undefined' ? window.innerWidth - 240 : x);
  const adjustedY = Math.min(y, typeof window !== 'undefined' ? window.innerHeight - 400 : y);

  return (
    <div 
        ref={menuRef}
        className="wa-context-menu"
        style={{ left: adjustedX, top: adjustedY }}
    >
        <div className="wa-context-header">
            <div className="wa-context-reactions">
                <button title="Gostei">👍</button>
                <button title="Amei">❤️</button>
                <button title="Engraçado">😂</button>
                <button title="Uau">😮</button>
            </div>
            <button onClick={onClose} className="wa-context-close"><X size={14}/></button>
        </div>

        <div className="wa-context-items">
            <button 
                onClick={() => { onReply(message); onClose(); }}
                className="wa-context-btn"
            >
                <Reply size={18} className="text-[#00a884]" />
                <span>Responder</span>
            </button>
            <button 
                onClick={() => { onCopy(message.body); onClose(); }}
                className="wa-context-btn"
            >
                <Copy size={18} className="text-[#00a884]" />
                <span>Copiar</span>
            </button>
            <button className="wa-context-btn disabled">
                <Forward size={18} className="text-[#8696a0]" />
                <span>Encaminhar</span>
            </button>
            <div className="wa-context-divider" />
            <button className="wa-context-btn disabled">
                <Pin size={18} className="text-[#8696a0]" />
                <span>Fixar</span>
            </button>
            <button className="wa-context-btn disabled">
                <Star size={18} className="text-[#8696a0]" />
                <span>Favoritar</span>
            </button>
            <button className="wa-context-btn disabled">
                <AlertTriangle size={18} className="text-[#8696a0]" />
                <span>Denunciar</span>
            </button>
            <button className="wa-context-btn disabled">
                <Trash2 size={18} className="text-[#ea0038]" />
                <span>Apagar</span>
            </button>
        </div>
    </div>
  );
};
