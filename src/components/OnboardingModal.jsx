import React, { useState } from 'react';
import { Sparkles, DollarSign, Users, Package, FileText, ChevronRight, ChevronLeft, X } from 'lucide-react';

const OnboardingModal = ({ isOpen, onClose }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  if (!isOpen) return null;

  const slides = [
    {
      title: "Bienvenue sur M-Biz ! 🚀",
      description: "Votre assistant de gestion commerciale de poche, conçu spécialement pour vous faciliter la vie au quotidien.",
      icon: <Sparkles size={48} className="text-[#059669]" />,
      bgColor: "bg-emerald-50 dark:bg-emerald-950/20",
      iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
      bullets: [
        "🌐 Fonctionne 100% hors-ligne (sans internet)",
        "🔒 Données sécurisées et stockées uniquement sur votre appareil",
        "⚡ Ultra-rapide et très simple à prendre en main"
      ]
    },
    {
      title: "Enregistrez vos Ventes & Dépenses 💸",
      description: "Suivez vos entrées et sorties de caisse pour connaître votre rentabilité réelle en temps réel.",
      icon: <DollarSign size={48} className="text-blue-600" />,
      bgColor: "bg-blue-50 dark:bg-blue-950/20",
      iconBg: "bg-blue-100 dark:bg-blue-900/40",
      bullets: [
        "📈 Saisissez vos ventes quotidiennes en quelques secondes",
        "📉 Enregistrez vos dépenses par catégories (Stock, Loyer, Transports...)",
        "📊 Visualisez vos bénéfices nets d'un seul coup d'œil"
      ]
    },
    {
      title: "Suivez vos Clients & Dettes 👥",
      description: "Ne perdez plus un seul centime en suivant précisément les achats à crédit.",
      icon: <Users size={48} className="text-purple-600" />,
      bgColor: "bg-purple-50 dark:bg-purple-950/20",
      iconBg: "bg-purple-100 dark:bg-purple-900/40",
      bullets: [
        "📝 Enregistrez les clients et leurs dettes en un clic",
        "✅ Marquez les remboursements partiels ou complets",
        "📲 Envoyez un rappel de paiement directement par WhatsApp"
      ]
    },
    {
      title: "Gérez votre Stock sans stress 📦",
      description: "Évitez les ruptures de stock inattendues et contrôlez vos produits disponibles.",
      icon: <Package size={48} className="text-amber-600" />,
      bgColor: "bg-amber-50 dark:bg-amber-950/20",
      iconBg: "bg-amber-100 dark:bg-amber-900/40",
      bullets: [
        "🔍 Sachez exactement quelle quantité de produit il vous reste",
        "⚠️ Recevez une alerte automatique si un produit est presque épuisé",
        "💰 Visualisez la valeur totale de votre boutique en argent"
      ]
    },
    {
      title: "Rapport de Solvabilité Bancaire 📄",
      description: "Préparez votre avenir et facilitez vos demandes de prêts ou financements.",
      icon: <FileText size={48} className="text-indigo-600" />,
      bgColor: "bg-indigo-50 dark:bg-indigo-950/20",
      iconBg: "bg-indigo-100 dark:bg-indigo-900/40",
      bullets: [
        "🏦 Rapport conçu pour les banques et microfinances",
        "⭐ Calcul automatique de votre score de fiabilité commerciale",
        "📥 Téléchargeable en PDF propre et professionnel dans les Paramètres"
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
          <div className={`w-full text-left rounded-2xl p-4 mb-6 ${activeSlide.bgColor} border border-black/5 dark:border-white/5`}>
            <ul className="space-y-2.5">
              {activeSlide.bullets.map((bullet, idx) => (
                <li key={idx} className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-start gap-2">
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
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
          <div className="flex gap-2">
            {currentSlide > 0 && (
              <button 
                onClick={handlePrev}
                className="btn bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-text-main !py-2 !px-3 rounded-xl flex items-center gap-1 font-bold text-xs"
              >
                <ChevronLeft size={16} /> Précédent
              </button>
            )}
            
            <button 
              onClick={handleNext}
              className="btn bg-[#059669] hover:bg-[#047857] text-white !py-2 !px-4 rounded-xl flex items-center gap-1 font-bold text-xs"
            >
              {currentSlide === slides.length - 1 ? (
                "C'est parti !"
              ) : (
                <>
                  Suivant <ChevronRight size={16} />
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
