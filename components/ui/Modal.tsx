
import React, { useEffect, useRef } from 'react';

interface ModalButton {
  text: string;
  onClick: () => void;
  className: string;
  autoFocus?: boolean;
}

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  buttons: ModalButton[];
  isOpen: boolean;
}

export const Modal: React.FC<ModalProps> = ({ title, onClose, children, buttons, isOpen }) => {
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            const focusButton = buttons.find(b => b.autoFocus);
            if (focusButton) {
                setTimeout(() => {
                   const buttonElement = modalRef.current?.querySelector(`button[data-text="${focusButton.text}"]`) as HTMLButtonElement;
                   buttonElement?.focus();
                }, 100);
            }
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose, buttons]);


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div ref={modalRef} className="bg-slate-900/95 border border-slate-700/80 rounded-xl shadow-2xl p-8 w-full max-w-md text-center" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h3 id="modal-title" className="text-2xl font-bold mb-4 text-slate-100">{title}</h3>
        <div className="text-slate-300 mb-6">{children}</div>
        <div className="flex justify-center gap-4">
          {buttons.map((btn) => (
            <button key={btn.text} data-text={btn.text} onClick={btn.onClick} className={btn.className}>
              {btn.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};