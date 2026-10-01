import React, { useEffect, useRef, useState } from 'react';
import { X, User, Check, Trash2 } from 'lucide-react';

export function ContextModal({
  isOpen,
  onClose,
  contextValue = '',
  onSaveContext
}) {
  const dialogRef = useRef(null);
  const textareaRef = useRef(null);
  const [text, setText] = useState(contextValue || '');
  const [savedNotice, setSavedNotice] = useState(false);

  const textRef = useRef(text);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  useEffect(() => {
    if (isOpen) {
      setText(contextValue || '');
      setSavedNotice(false);
      // Focus textarea shortly after modal mounts
      const timer = setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.selectionStart = textareaRef.current.value.length;
          textareaRef.current.selectionEnd = textareaRef.current.value.length;
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, contextValue]);

  // Focus trap & escape key
  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        onSaveContext(textRef.current.trim());
        setSavedNotice(true);
        setTimeout(() => {
          onClose();
        }, 280);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = overflow;
      previousFocusRef.current?.focus();
    };
  }, [isOpen, onClose, onSaveContext]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveContext(text.trim());
    setSavedNotice(true);
    setTimeout(() => {
      onClose();
    }, 280);
  };

  const handleClear = () => {
    setText('');
    textareaRef.current?.focus();
  };

  const insertTemplate = (snippet) => {
    setText((prev) => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed} ${snippet}` : snippet;
    });
    textareaRef.current?.focus();
  };

  return (
    <div
      className="settings-backdrop fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="context-modal-title"
        tabIndex={-1}
        className="settings-dialog rounded-2xl w-full max-w-lg flex flex-col overflow-hidden text-left shadow-2xl border border-slate-300"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-blue-400" />
            <h2 id="context-modal-title" className="text-lg font-bold text-white m-0">
              Sobre mí (contexto para la IA)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Cerrar (Esc)"
            aria-label="Cerrar ventana de contexto"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="settings-body p-5 sm:p-6 overflow-y-auto space-y-4 text-sm">
          <p className="text-xs text-slate-400 m-0 leading-relaxed">
            Escribe quién eres, tus gustos, datos personales o la situación en la que te encuentras. Las respuestas sugeridas por la IA se adaptarán fielmente a estos datos.
          </p>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="user-context-textarea" className="block text-xs font-semibold text-slate-300">
                Información personal o contexto actual:
              </label>
              {text && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Limpiar
                </button>
              )}
            </div>
            <textarea
              id="user-context-textarea"
              ref={textareaRef}
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ej.: Me llamo Clara. Tengo 24 años. Vivo en Valencia. Estudio informática. Tengo un perro que se llama Toby. Me encanta la pizza pero odio los champiñones."
              className="w-full bg-slate-950 text-white rounded-lg p-3 border border-slate-700 text-xs focus:outline-none focus:border-blue-500 font-medium resize-y placeholder:text-slate-500 leading-relaxed"
            />
          </div>

          {/* Quick Starter Templates */}
          <div>
            <span className="text-[11px] font-semibold text-slate-400 block mb-1.5 uppercase tracking-wide">
              Ideas rápidas:
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => insertTemplate('Me llamo [nombre].')}
                className="text-xs px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
              >
                + Mi nombre
              </button>
              <button
                type="button"
                onClick={() => insertTemplate('Vivo en [ciudad].')}
                className="text-xs px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
              >
                + Dónde vivo
              </button>
              <button
                type="button"
                onClick={() => insertTemplate('Tengo un perro llamado [nombre].')}
                className="text-xs px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
              >
                + Mascota
              </button>
              <button
                type="button"
                onClick={() => insertTemplate('Me gusta... y no me gusta...')}
                className="text-xs px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
              >
                + Gustos
              </button>
              <button
                type="button"
                onClick={() => insertTemplate('Estoy en el médico.')}
                className="text-xs px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
              >
                + En el médico
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-900/60">
          <span className="text-[11px] text-slate-500">Ctrl+Enter para guardar</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer border border-slate-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {savedNotice ? (
                <>
                  <Check className="w-4 h-4" /> Guardado
                </>
              ) : (
                'Guardar contexto'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
