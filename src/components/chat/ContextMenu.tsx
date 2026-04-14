'use client';

import React, { useEffect, useRef } from 'react';
import { 
  Reply, Copy, Forward, Pin, Star, ThumbsUp, Heart, 
  Laugh, Surprise, Trash2, AlertTriangle, SmilePlus, X 
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
        className="fixed z-[100] w-56 bg-white/95 backdrop-blur-xl border border-gray-200 shadow-2xl rounded-2xl py-2 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        style={{ left: adjustedX, top: adjustedY }}
    >
        <div className="px-3 pb-2 pt-1 border-b border-gray-100 flex justify-between items-center mb-1">
            <div className="flex gap-2">
                <button className="hover:scale-125 transition-transform text-lg" title="Gostei">👍</button>
                <button className="hover:scale-125 transition-transform text-lg" title="Amei">❤️</button>
                <button className="hover:scale-125 transition-transform text-lg" title="Engraçado">😂</button>
                <button className="hover:scale-125 transition-transform text-lg" title="Uau">😮</button>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400"><X size={14}/></button>
        </div>

        <div className="px-1.5 space-y-0.5">
            <button 
                onClick={() => onReply(message)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-100 rounded-xl transition-colors text-gray-700"
            >
                <Reply size={18} className="text-blue-500" />
                <span className="text-sm font-medium">Responder</span>
            </button>
            <button 
                onClick={() => onCopy(message.body)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-100 rounded-xl transition-colors text-gray-700"
            >
                <Copy size={18} className="text-green-500" />
                <span className="text-sm font-medium">Copiar</span>
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-100 rounded-xl transition-colors text-gray-700 opacity-50 cursor-not-allowed">
                <Forward size={18} className="text-orange-500" />
                <span className="text-sm font-medium">Encaminhar</span>
            </button>
            <div className="h-px bg-gray-100 mx-3 my-1" />
            <button className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-100 rounded-xl transition-colors text-gray-700 opacity-50 cursor-not-allowed">
                <Pin size={18} />
                <span className="text-sm font-medium">Fixar</span>
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-100 rounded-xl transition-colors text-gray-700 opacity-50 cursor-not-allowed">
                <Star size={18} />
                <span className="text-sm font-medium">Favoritar</span>
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-100 rounded-xl transition-colors text-gray-700 opacity-50 cursor-not-allowed">
                <AlertTriangle size={18} />
                <span className="text-sm font-medium">Denunciar</span>
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-100 rounded-xl transition-colors text-red-500 opacity-50 cursor-not-allowed">
                <Trash2 size={18} />
                <span className="text-sm font-medium">Apagar</span>
            </button>
        </div>
    </div>
  );
};
