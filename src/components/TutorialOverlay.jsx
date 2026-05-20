import React, { useState, useEffect } from 'react';
import { Hand } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useNavigate, useLocation } from 'react-router-dom';

const TutorialOverlay = () => {
  const { hasSeenTutorial, completeTutorial, isAuthenticated } = useAppContext();
  const [step, setStep] = useState(0);
  const [targetPos, setTargetPos] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Ne montrer le tutoriel que si on est authentifié (c-a-d on a passé le Login/Auth) et qu'on ne l'a pas encore vu
  const showTutorial = isAuthenticated && !hasSeenTutorial;

  const steps = [
    {
      targetId: 'tour-caisse',
      path: '/',
      title: 'Voici la Caisse 🛒',
      description: "Appuyez ici pour enregistrer vos ventes rapidement et calculer la monnaie.",
      position: 'top'
    },
    {
      targetId: 'tour-stock',
      path: '/caisse', // Forcer un peu la nav pour être sûr
      title: 'Gérez votre Stock 📦',
      description: "C'est ici que vous ajoutez vos produits et surveillez les alertes de rupture.",
      position: 'top'
    },
    {
      targetId: 'tour-cotisations',
      path: '/stock',
      title: 'Vos Cotisations 🐷',
      description: "Gérez toutes vos tontines et épargnes quotidiennes depuis cet onglet.",
      position: 'top'
    }
  ];

  useEffect(() => {
    if (!showTutorial) return;

    // S'assurer qu'on est sur la bonne page pour afficher le bouton visé
    // Pour simplifier on reste sur la page où on est, car les boutons du bas (BottomNav) sont toujours visibles.
    
    const updatePosition = () => {
      const currentStep = steps[step];
      if (!currentStep) return;

      const element = document.getElementById(currentStep.targetId);
      if (element) {
        const rect = element.getBoundingClientRect();
        setTargetPos({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          windowWidth: window.innerWidth,
        });
      }
    };

    // Petit délai pour laisser le temps au DOM de se peindre
    const timeout = setTimeout(updatePosition, 300);
    window.addEventListener('resize', updatePosition);
    
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', updatePosition);
    };
  }, [step, showTutorial]);

  if (!showTutorial || !targetPos) return null;

  const currentStep = steps[step];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      completeTutorial();
      navigate('/');
    }
  };

  const handleSkip = () => {
    completeTutorial();
  };

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-auto">
      {/* Masque sombre */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px] transition-all duration-300"
      ></div>

      {/* Trou (Highlight) dans le masque pour l'élément cible */}
      <div 
        className="absolute bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] transition-all duration-500 ease-in-out border-2 border-white rounded-xl pointer-events-none"
        style={{
          top: targetPos.top - 4,
          left: targetPos.left - 4,
          width: targetPos.width + 8,
          height: targetPos.height + 8,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.6), 0 0 15px rgba(255,255,255,0.5) inset'
        }}
      />

      {/* Main clignotante */}
      <div 
        className="absolute transition-all duration-500 ease-in-out pointer-events-none animate-bounce"
        style={{
          top: targetPos.top + targetPos.height / 2,
          left: targetPos.left + targetPos.width / 2 - 12, // centrer l'icone
        }}
      >
        <Hand size={32} className="text-white fill-white drop-shadow-lg" />
      </div>

      {/* Bulle d'explication */}
      <div 
        className="absolute w-[280px] bg-white rounded-2xl p-5 shadow-2xl transition-all duration-500 ease-in-out"
        style={{
          top: targetPos.top - 160,
          left: Math.max(10, Math.min(targetPos.left + targetPos.width/2 - 140, targetPos.windowWidth - 290)),
        }}
      >
        <h3 className="font-bold text-lg text-text-main mb-1">{currentStep.title}</h3>
        <p className="text-sm text-text-muted mb-4">{currentStep.description}</p>
        
        <div className="flex justify-between items-center">
          <button 
            onClick={handleSkip}
            className="text-xs text-text-muted hover:text-text-main font-medium cursor-pointer"
          >
            Passer
          </button>
          <button 
            onClick={handleNext}
            className="bg-primary text-white text-sm font-bold py-2 px-5 rounded-full shadow-md hover:bg-primary-dark transition-all cursor-pointer"
          >
            {step === steps.length - 1 ? "J'ai compris !" : "Suivant"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TutorialOverlay;
