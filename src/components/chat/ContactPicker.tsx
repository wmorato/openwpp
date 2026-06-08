'use client';

import React from 'react';
import { Search, X, User } from 'lucide-react';
import { Contact } from '@/types';
import { getInitials } from '@/lib/frontend-utils';

interface ContactPickerProps {
  contacts: Contact[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  onSelect: (contactId: string) => void;
  onClose: () => void;
}

export const ContactPicker = ({ 
  contacts, 
  searchTerm, 
  onSearchChange, 
  onSelect, 
  onClose 
}: ContactPickerProps) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <header className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h3 className="font-bold text-gray-800">Compartilhar Contato</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </header>

        <div className="p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Pesquisar contatos..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-[#128c7e]/20 transition-all text-sm"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              autoFocus
            />
          </div>

          <div className="max-h-80 overflow-y-auto custom-scrollbar">
            {contacts.length > 0 ? (
              contacts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onSelect(c.id)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-colors group text-left"
                >
                  <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-bold text-xs group-hover:bg-[#128c7e]/10 group-hover:text-[#128c7e] transition-colors">
                    {getInitials(c.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{c.name}</p>
                    <p className="text-xs text-gray-400 truncate">{c.id}</p>
                  </div>
                </button>
              ))
            ) : (
              <div className="py-8 text-center text-gray-400">
                <User size={32} className="mx-auto mb-2 opacity-20" />
                <p className="text-sm">Nenhum contato encontrado</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
