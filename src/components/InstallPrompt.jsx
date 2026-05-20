import React, { useEffect, useState } from 'react';
import { Download, AlertCircle, X } from 'lucide-react';

const InstallPrompt = () => {
  const [supportsPWA, setSupportsPWA] = useState(false);
  const [promptInstall, setPromptInstall] = useState(null);
  const [isEmbedded, setIsEmbedded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Vérifier si on est déjà installé (standalone)
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      return;
    }

    // Vérifier si navigateur intégré (WhatsApp, Facebook, Instagram)
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    if ((ua.indexOf("FBAN") > -1) || (ua.indexOf("FBAV") > -1) || (ua.indexOf("WhatsApp") > -1) || (ua.indexOf("Instagram") > -1)) {
      setIsEmbedded(true);
      return;
    }

    // Écouter l'événement d'installation
    const handler = (e) => {
      e.preventDefault();
      setSupportsPWA(true);
      setPromptInstall(e);
    };
    
    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const onClickInstall = async () => {
    if (!promptInstall) return;
    promptInstall.prompt();
    const { outcome } = await promptInstall.userChoice;
    if (outcome === 'accepted') {
      setSupportsPWA(false);
    }
  };

  if (isDismissed) return null;

  if (isEmbedded) {
    return (
      <div className="fixed top-4 left-4 right-4 z-50 bg-red-600 text-white p-4 rounded-2xl shadow-xl flex items-start gap-3 border-2 border-white/20">
        <AlertCircle className="flex-shrink-0 mt-0.5" size={24} />
        <div className="flex-1">
          <h3 className="font-bold mb-1">Installation bloquée</h3>
          <p className="text-sm font-medium opacity-90 leading-tight">
            Vous êtes dans le navigateur WhatsApp. Pour installer l'application, touchez les <strong>3 points en haut à droite ↗️</strong> et choisissez <strong>"Ouvrir dans Chrome"</strong>.
          </p>
        </div>
        <button onClick={() => setIsDismissed(true)} className="p-1 bg-white/20 hover:bg-white/30 rounded-full transition-colors">
          <X size={16} />
        </button>
      </div>
    );
  }

  if (supportsPWA) {
    return (
      <div className="fixed bottom-24 left-4 right-4 z-50 flex justify-center pointer-events-none">
        <button
          className="pointer-events-auto bg-primary text-black px-6 py-3.5 rounded-full font-bold shadow-xl shadow-primary/30 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all border border-white/50 animate-bounce"
          onClick={onClickInstall}
        >
          <Download size={20} strokeWidth={2.5} />
          <span className="tracking-wide">Installer l'application</span>
        </button>
      </div>
    );
  }

  return null;
};

export default InstallPrompt;
