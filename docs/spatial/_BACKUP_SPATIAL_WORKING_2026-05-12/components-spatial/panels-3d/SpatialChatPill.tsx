"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSpatialSelection } from "@/stores/spatial-selection";

export function SpatialChatPill() {
  const [status, setStatus] = useState<'rest' | 'focus' | 'typing'>('rest');
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const selected = useSpatialSelection((s) => s.selected);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && status === 'rest') {
        e.preventDefault();
        setStatus('focus');
      } else if (e.key === 'Escape' && status !== 'rest') {
        setStatus('rest');
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status]);

  useEffect(() => {
    if (status === 'focus' || status === 'typing') {
      inputRef.current?.focus();
    }
  }, [status]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!message.trim()) return;
    
    console.log("Spatial Chat Message:", message);
    window.dispatchEvent(new CustomEvent('spatial-chat-submit', { detail: { message, target: selected[0] } }));
    
    setMessage('');
    setStatus('rest');
  };

  return (
    <div className="fixed bottom-[20%] left-1/2 -translate-x-1/2 z-[10000] pointer-events-auto">
      <AnimatePresence mode="wait">
        {status === 'rest' ? (
          <motion.div
            key="rest"
            layoutId="pill"
            onClick={() => setStatus('focus')}
            className="w-[320px] h-1 rounded-full bg-white/10 backdrop-blur-md border border-white/5 cursor-pointer hover:bg-white/20 transition-colors"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{
              boxShadow: '0 0 20px rgba(0, 229, 204, 0.15)'
            }}
          />
        ) : (
          <motion.form
            key="focus"
            layoutId="pill"
            onSubmit={handleSubmit}
            className={`
              bg-black/40 backdrop-blur-[24px] saturate-[130%]
              border border-white/10 rounded-[28px] overflow-hidden
              flex flex-col p-2 gap-2
              ${status === 'typing' ? 'w-[640px]' : 'w-[640px]'}
            `}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            <div className="flex items-end gap-2 px-2 py-1">
              <textarea
                ref={inputRef}
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  setStatus(e.target.value.length > 0 ? 'typing' : 'focus');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="Parler à l'agent..."
                className="flex-1 bg-transparent border-none outline-none text-white text-base py-2 resize-none max-h-[240px] min-h-[40px] font-light placeholder:text-white/30"
                rows={1}
              />
              <div className="flex gap-2 pb-1">
                <button 
                  type="button"
                  className="p-2 rounded-full hover:bg-white/10 text-white/60 transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                </button>
                <button 
                  type="submit"
                  disabled={!message.trim()}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-30"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
