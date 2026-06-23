import React, { useState, useRef } from 'react';

export default function InfoModal({ title, content }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors shadow-sm border z-10 relative
          ${isOpen 
            ? 'bg-primary text-textInverse border-primary-dark' 
            : 'bg-primary-light text-primary hover:bg-primary hover:text-textInverse border-primary-light'
          }`}
        title={isOpen ? "Close Info" : "Help & Info"}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          )}
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-3 z-50 w-[400px] bg-panel rounded-lg shadow-2xl border border-borderMain flex flex-col max-h-[70vh] animate-in fade-in slide-in-from-top-2 duration-200">
          
          <div className="absolute -top-2 right-2.5 w-4 h-4 bg-app border-t border-l border-borderMain transform rotate-45 z-0"></div>

          <div className="flex justify-between items-center p-3 border-b border-borderLight bg-app rounded-t-lg relative z-10">
            <h2 className="text-sm font-bold text-textMain">{title}</h2>
            <button 
              onClick={() => setIsOpen(false)} 
              className="text-textMuted hover:text-danger transition-colors"
              title="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="p-4 overflow-y-auto whitespace-pre-wrap text-sm text-textMain leading-relaxed relative z-10 bg-panel rounded-b-lg">
            {content}
          </div>

        </div>
      )}
    </div>
  );
}