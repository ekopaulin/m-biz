import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

/**
 * Modal de confirmation réutilisable et élégant.
 * Remplace tous les window.confirm() de l'application.
 *
 * Props:
 *   isOpen       : boolean — affiche ou non le modal
 *   onConfirm    : () => void — action si l'utilisateur confirme
 *   onCancel     : () => void — action si l'utilisateur annule
 *   title        : string — titre du modal (ex: "Confirmer l'annulation")
 *   message      : string — message de description du risque
 *   confirmLabel : string — texte du bouton de confirmation (défaut: "Confirmer")
 *   cancelLabel  : string — texte du bouton d'annulation (défaut: "Annuler")
 *   danger       : boolean — si true, le bouton de confirmation est rouge
 */
const ConfirmModal = ({
  isOpen,
  onConfirm,
  onCancel,
  title = 'Confirmer l\'action',
  message = 'Voulez-vous vraiment continuer ?',
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  danger = true,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-5 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]">
      <div className="bg-bg-light rounded-2xl w-full max-w-xs p-6 relative shadow-2xl border border-white/50 animate-[slideUp_0.2s_ease-out]">
        {/* Icône */}
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 ${danger ? 'bg-red-500/10' : 'bg-primary/10'}`}>
          <AlertTriangle size={24} className={danger ? 'text-red-500' : 'text-primary'} />
        </div>

        {/* Texte */}
        <h3 className="text-base font-bold text-text-main text-center mb-2">{title}</h3>
        <p className="text-sm text-text-muted text-center leading-relaxed mb-6">{message}</p>

        {/* Boutons */}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 rounded-xl border border-black/10 bg-white text-text-muted text-sm font-semibold hover:bg-black/5 transition-all cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              danger
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-primary text-white hover:bg-primary-dark'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
