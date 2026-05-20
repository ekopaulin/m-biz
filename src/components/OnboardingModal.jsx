import React, { useState } from 'react';
import { Sparkles, DollarSign, Users, Package, FileText, ChevronRight, ChevronLeft, X } from 'lucide-react';

const OnboardingModal = ({ isOpen, onClose }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  if (!isOpen) return null;

  const slides = [
    {
      title: "Bienvenue sur M-Biz ! 🎉",
      description: "Remplacez enfin votre vieux cahier de brouillon. M-Biz gère tout depuis votre téléphone.",
      icon: <Sparkles size={48} className="text-[#059669]" />,
      bgColor: "bg-emerald-50 dark:bg-emerald-950/20",
      iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
      bullets: [
        "🌐 Fonctionne 100% hors-ligne (sans internet)",
        "🔒 Vos données sont en sécurité dans votre poche",
        "⚡ Ultra-rapide et très simple à utiliser"
      ]
    },
    {
      title: "Une Caisse ultra-rapide 🛒",
      description: "Encaisser vos clients devient un jeu d'enfant. Ne perdez plus de temps au comptoir.",
      icon: <DollarSign size={48} className="text-blue-600 dark:text-blue-400" />,
      bgColor: "bg-blue-50 dark:bg-blue-950/20",
      iconBg: "bg-blue-100 dark:bg-blue-900/40",
      bullets: [
        "💰 Calculez automatiquement la monnaie à rendre",
        "🧾 Fini les erreurs de calcul en fin de journée",
        "📊 Un bilan clair pour chaque vente"
      ]
    },
    {
      title: "Gérez le Stock sans effort 📦",
      description: "Sachez toujours ce qu'il vous reste en boutique, sans devoir tout recompter.",
      icon: <Package size={48} className="text-amber-600 dark:text-amber-400" />,
      bgColor: "bg-amber-50 dark:bg-amber-950/20",
      iconBg: "bg-amber-100 dark:bg-amber-900/40",
      bullets: [
        "🔍 Suivez la quantité exacte de chaque produit",
        "⚠️ Recevez une alerte avant la rupture de stock",
        "📉 Fini les produits expirés ou perdus"
      ]
    },
    {
      title: "Fini les dettes oubliées 👥",
      description: "Ne perdez plus un seul centime à cause des achats à crédit mal notés.",
      icon: <Users size={48} className="text-purple-600 dark:text-purple-400" />,
      bgColor: "bg-purple-50 dark:bg-purple-950/20",
      iconBg: "bg-purple-100 dark:bg-purple-900/40",
      bullets: [
        "📝 Notez qui vous doit de l'argent en 1 clic",
        "✅ Suivez les remboursements facilement",
        "📲 Envoyez un rappel poli par WhatsApp"
      ]
    },
    {
      title: "Votre réussite en chiffres 🏆",
      description: "À la fin du mois, voyez enfin la vérité sur la santé de votre commerce.",
      icon: <FileText size={48} className="text-indigo-600 dark:text-indigo-400" />,
      bgColor: "bg-indigo-50 dark:bg-indigo-950/20",
      iconBg: "bg-indigo-100 dark:bg-indigo-900/40",
      bullets: [
        "📈 Découvrez votre bénéfice réel et vos dépenses",
        "🏦 Obtenez un rapport PDF pour demander un prêt",
        "🚀 Faites grandir votre activité sereinement"
      ]
    }
  ];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const activeSlide = slides[currentSlide];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 transition-all">
        
        {/* Skip button in header */}
        <div className="flex justify-between items-center px-6 pt-5">
          <span className="text-xs text-text-muted font-bold uppercase tracking-wider">
            Guide de démarrage ({currentSlide + 1}/{slides.length})
          </span>
          <button 
            onClick={onClose}
            className="text-text-muted hover:text-text-main p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            title="Passer le tutoriel"
          >
            <X size={18} />
          </button>
        </div>

        {/* Slide Content */}
        <div className="p-6 flex flex-col items-center text-center">
          {/* Main Visual Frame */}
          <div className={`w-24 h-24 rounded-3xl ${activeSlide.iconBg} flex items-center justify-center mb-5 shadow-sm transform scale-100 hover:scale-105 transition-transform`}>
            {activeSlide.icon}
          </div>

          <h2 className="text-xl font-black text-text-main mb-3 leading-tight">
            {activeSlide.title}
          </h2>
          
          <p className="text-sm text-text-muted mb-5 px-2">
            {activeSlide.description}
          </p>

          {/* Bullet points box */}
          <div className={`w-full text-left rounded-2xl p-3 mb-6 ${activeSlide.bgColor} border border-black/5 dark:border-white/5`}>
            <div className="space-y-2">
              {activeSlide.bullets.map((bullet, idx) => {
                const [icon, ...textArr] = bullet.split(' ');
                const text = textArr.join(' ');
                return (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-sm border border-white/50 dark:border-white/5 shadow-sm">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-white dark:bg-slate-800 shadow-sm text-sm">
                      {icon}
                    </div>
                    <span className="text-[13px] font-bold text-slate-800 dark:text-slate-200 mt-1 leading-tight">
                      {text}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 pb-6 pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
          {/* Dots Indicator */}
          <div className="flex gap-1.5">
            {slides.map((_, idx) => (
              <div 
                key={idx} 
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentSlide ? 'w-5 bg-[#059669]' : 'w-1.5 bg-slate-300 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex gap-2 ml-auto">
            {currentSlide > 0 && (
              <button 
                onClick={handlePrev}
                className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-text-main py-2.5 px-3 rounded-xl flex items-center gap-1 font-bold text-xs transition-colors"
              >
                <ChevronLeft size={16} /> Précédent
              </button>
            )}
            
            <button 
              onClick={handleNext}
              className="bg-[#059669] hover:bg-[#047857] text-white py-2.5 px-4 rounded-xl flex items-center gap-1.5 font-bold text-sm shadow-md transition-all active:scale-95"
            >
              {currentSlide === slides.length - 1 ? (
                "🚀 Ouvrir ma boutique"
              ) : (
                <>
                  Suivant <ChevronRight size={18} strokeWidth={2.5} />
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default OnboardingModal;
