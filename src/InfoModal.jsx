import React, { useState, useRef } from 'react';

export default function InfoModal({ title, content }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  return (
    // 'relative' ensures the popover positions itself relative to this button container
    <div className="relative inline-block" ref={containerRef}>
      
      {/* The Trigger Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors shadow-sm border z-10 relative
          ${isOpen 
            ? 'bg-blue-600 text-white border-blue-600' 
            : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-200'
          }`}
        title={isOpen ? "Close Info" : "Help & Info"}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isOpen ? (
             // X icon when open
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            // Info/Question icon when closed
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          )}
        </svg>
      </button>

      {/* The Floating Pop-over Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-3 z-50 w-[400px] bg-white rounded-lg shadow-2xl border border-gray-300 flex flex-col max-h-[70vh] animate-in fade-in slide-in-from-top-2 duration-200">
          
          {/* Small Arrow/Pointer pointing up to the button */}
          <div className="absolute -top-2 right-2.5 w-4 h-4 bg-gray-50 border-t border-l border-gray-300 transform rotate-45 z-0"></div>

          {/* Popover Header */}
          <div className="flex justify-between items-center p-3 border-b border-gray-200 bg-gray-50 rounded-t-lg relative z-10">
            <h2 className="text-sm font-bold text-gray-800">{title}</h2>
            <button 
              onClick={() => setIsOpen(false)} 
              className="text-gray-400 hover:text-red-500 transition-colors"
              title="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Popover Body (Scrolls if text is too long) */}
          <div className="p-4 overflow-y-auto whitespace-pre-wrap text-sm text-gray-700 leading-relaxed relative z-10 bg-white rounded-b-lg">
            {content}
          </div>

        </div>
      )}
    </div>
  );
}