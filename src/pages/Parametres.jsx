import React, { useState } from 'react';
import { Download, Upload, LogOut, Lock, Share2, MessageSquare, Globe, FileText, Building2, HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../db';
import { useAppContext } from '../context/AppContext';
import ConfirmModal from '../components/ConfirmModal';
import { useLiveQuery } from 'dexie-react-hooks';
import { genererRapportSolvabilite } from '../components/PdfGenerator';
import Loader from '../components/Loader';

const Parametres = () => {
  const { logout, activeCommerceId, devise, setDevise } = useAppContext();
  const [confirmReset, setConfirmReset] = useState(false);

  const commerce = useLiveQuery(
    () => db.commerces.get(activeCommerceId || 0),
    [activeCommerceId]
  );

  const toutesVentes = useLiveQuery(
    () => activeCommerceId ? db.ventes.where('commerceId').equals(activeCommerceId).toArray() : [],
    [activeCommerceId]
  );

  const toutesDepenses = useLiveQuery(
    () => activeCommerceId ? db.depenses.where('commerceId').equals(activeCommerceId).toArray() : [],
    [activeCommerceId]
  );

  const toutesDettes = useLiveQuery(
    () => activeCommerceId ? db.dettesClients.where('commerceId').equals(activeCommerceId).toArray() : [],
    [activeCommerceId]
  );

  const tousProduits = useLiveQuery(
    () => activeCommerceId ? db.produits.where('commerceId').equals(activeCommerceId).toArray() : [],
    [activeCommerceId]
  );

  if (commerce === undefined || toutesVentes === undefined || toutesDepenses === undefined || toutesDettes === undefined || tousProduits === undefined) {
    return <Loader message="Chargement des paramètres..." />;
  }

  const handleSolvabilite = () => {
    if (!commerce) { toast.error('Boutique introuvable'); return; }
    if (toutesVentes.length < 5) {
      toast.error('Pas assez de données. Il faut au moins 5 ventes enregistrées.');
      return;
    }
    genererRapportSolvabilite(commerce, toutesVentes, toutesDepenses, toutesDettes, tousProduits, devise);
    toast.success('Rapport de solvabilité généré !');
  };

  const handleDeviseChange = async (newDevise) => {
    await db.commerces.update(activeCommerceId, { devise: newDevise });
    setDevise(newDevise);
    toast.success(`Devise mise à jour : ${newDevise}`);
  };

  const handleExport = async () => {
    try {
      // Exporter manuellement toutes les tables pour la sauvegarde complète
      const data = {
        commerces: await db.commerces.toArray(),
        produits: await db.produits.toArray(),
        ventes: await db.ventes.toArray(),
        lignesVente: await db.lignesVente.toArray(),
        dettesClients: await db.dettesClients.toArray(),
        clients: await db.clients.toArray(),
        depenses: await db.depenses.toArray(),
        tontines: await db.tontines.toArray(),
        versementsTontine: await db.versementsTontine.toArray(),
        fournisseurs: await db.fournisseurs.toArray(),
        paiementsDettes: await db.paiementsDettes.toArray()
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mbiz-backup-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      toast.success('Boutique sauvegardée avec succès !');
    } catch (e) {
      toast.error("Erreur lors de la sauvegarde");
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        // Validation basique de la sauvegarde
        if (!data.commerces || !data.produits || !data.ventes) {
          toast.error("Fichier de sauvegarde invalide !");
          return;
        }

        const confirmation = window.confirm(
          "Attention ! Cela va remplacer TOUTES vos données actuelles par celles de votre sauvegarde. Voulez-vous continuer ?"
        );
        if (!confirmation) return;

        // Vider toutes les tables de la DB et réinsérer les données importées
        await db.transaction('rw', [
          db.commerces, db.produits, db.ventes, db.lignesVente, 
          db.dettesClients, db.clients, db.depenses, db.tontines, 
          db.versementsTontine, db.fournisseurs, db.paiementsDettes
        ], async () => {
          await db.commerces.clear();
          await db.produits.clear();
          await db.ventes.clear();
          await db.lignesVente.clear();
          await db.dettesClients.clear();
          await db.clients.clear();
          await db.depenses.clear();
          await db.tontines.clear();
          await db.versementsTontine.clear();
          await db.fournisseurs.clear();
          await db.paiementsDettes.clear();

          // Réinsertion
          if (data.commerces && data.commerces.length > 0) await db.commerces.bulkAdd(data.commerces);
          if (data.produits && data.produits.length > 0) await db.produits.bulkAdd(data.produits);
          if (data.ventes && data.ventes.length > 0) await db.ventes.bulkAdd(data.ventes);
          if (data.lignesVente && data.lignesVente.length > 0) await db.lignesVente.bulkAdd(data.lignesVente);
          if (data.dettesClients && data.dettesClients.length > 0) await db.dettesClients.bulkAdd(data.dettesClients);
          if (data.clients && data.clients.length > 0) await db.clients.bulkAdd(data.clients);
          if (data.depenses && data.depenses.length > 0) await db.depenses.bulkAdd(data.depenses);
          if (data.tontines && data.tontines.length > 0) await db.tontines.bulkAdd(data.tontines);
          if (data.versementsTontine && data.versementsTontine.length > 0) await db.versementsTontine.bulkAdd(data.versementsTontine);
          if (data.fournisseurs && data.fournisseurs.length > 0) await db.fournisseurs.bulkAdd(data.fournisseurs);
          if (data.paiementsDettes && data.paiementsDettes.length > 0) await db.paiementsDettes.bulkAdd(data.paiementsDettes);
        });

        toast.success("Boutique récupérée avec succès ! Rechargement...");
        setTimeout(() => {
          window.location.reload();
        }, 1500);

      } catch (err) {
        toast.error("Erreur lors de la lecture du fichier.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="page-container">
      <header className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Paramètres</h1>
        <p className="text-sm text-text-muted">Gérez vos données et préférences</p>
      </header>

      <div className="flex flex-col gap-4">

        {/* Devise */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Globe size={18} className="text-primary" />
            <h3 className="font-semibold text-lg">Devise & Monnaie</h3>
          </div>
          <p className="text-sm text-text-muted mb-4">Choisissez la monnaie affichée dans toute l'application.</p>
          <div className="relative">
            <select
              value={devise}
              onChange={(e) => handleDeviseChange(e.target.value)}
              className="form-control cursor-pointer font-bold text-text-main py-2.5 px-4 rounded-xl border border-black/10 dark:border-white/10"
            >
              {[
                { code: 'FCFA', label: 'FCFA - Franc CFA (UEMOA)' },
                { code: 'XAF', label: 'XAF - Franc CFA (CEMAC)' },
                { code: '$', label: 'USD ($) - Dollar Américain' },
                { code: '€', label: 'EUR (€) - Euro' },
                { code: 'GHS', label: 'GHS (GH₵) - Cédi Ghanéen' },
                { code: 'NGN', label: 'NGN (₦) - Naira Nigérian' },
              ].map(d => (
                <option key={d.code} value={d.code}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="glass-card p-5">
          <h3 className="font-semibold text-lg mb-2">Sauvegarde de Sécurité</h3>
          <p className="text-sm text-text-muted mb-4">
            Téléchargez une copie de votre boutique sur votre téléphone pour ne pas la perdre. Vous pourrez la récupérer facilement en cas de problème ou si vous changez de téléphone.
          </p>
          <div className="flex gap-2">
            <button onClick={handleExport} className="btn bg-primary text-black flex-1 !py-1.5 !px-3 !text-xs cursor-pointer flex items-center justify-center gap-1 font-bold">
              <Download size={14} /> Sauvegarder
            </button>
            <label className="btn bg-white border border-black/10 flex-1 !py-1.5 !px-3 !text-xs text-text-muted hover:bg-black/5 flex items-center justify-center gap-1 cursor-pointer font-bold">
              <Upload size={14} /> Récupérer
              <input 
                type="file" 
                accept=".json" 
                className="hidden" 
                onChange={handleImport} 
              />
            </label>
          </div>
        </div>

        {/* Rapport de Solvabilité */}
        <div className="glass-card p-5 border border-blue-500/20 bg-gradient-to-br from-blue-50/80 to-transparent dark:from-blue-950/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shadow-sm">
              <Building2 size={18} className="text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="font-bold text-base text-text-main">Rapport de Solvabilité</h3>
              <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider">Pour banques & microfinances</p>
            </div>
          </div>
          <p className="text-xs text-text-muted mb-4 leading-relaxed">
            Génère un rapport PDF professionnel à présenter à une banque ou une institution de microfinance pour obtenir un crédit. Il contient votre <strong>score de fiabilité</strong>, vos indicateurs financiers sur 30 et 90 jours, la valeur de votre stock et votre taux de recouvrement des dettes clients.
          </p>
          <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl p-3 mb-4 flex items-start gap-2">
            <span className="text-lg flex-shrink-0">💡</span>
            <p className="text-xs text-slate-700 dark:text-slate-200 font-semibold leading-relaxed">
              Plus vous enregistrez vos ventes régulièrement, plus votre score sera élevé et votre dossier de crédit solide.
            </p>
          </div>
          <button
            onClick={handleSolvabilite}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition-all cursor-pointer shadow-sm"
          >
            <FileText size={14} />
            Générer mon Rapport de Solvabilité
          </button>
        </div>

        <div className="glass-card p-5 border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare size={18} className="text-primary-dark" />
            <h3 className="font-semibold text-lg">Feedback & Suggestions</h3>
          </div>
          <p className="text-sm text-text-muted mb-4">
            Une idée d'amélioration ? Un bug à signaler ? Envoyez une suggestion en direct sur WhatsApp !
          </p>
          <button
            onClick={() => {
              const msg = `Bonjour ! 👋 J'utilise l'application M-Biz et j'ai une suggestion d'amélioration : \n\n[Écrivez votre suggestion ici]`;
              window.open(`https://wa.me/237694442605?text=${encodeURIComponent(msg)}`, '_blank');
            }}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-primary text-black font-bold text-xs hover:opacity-90 transition-all cursor-pointer shadow-sm"
          >
            Suggérer une amélioration
          </button>
        </div>

        <div className="glass-card p-5 border border-[#25D366]/20 bg-gradient-to-br from-[#25D366]/5 to-transparent">
          <div className="flex items-center gap-2 mb-1">
            <Share2 size={18} className="text-text-main" />
            <h3 className="font-semibold text-lg">Partager l'application</h3>
          </div>
          <p className="text-sm text-text-muted mb-4">
            Recommandez M-Biz à vos amis commerçants !
          </p>
          <div className="flex flex-col gap-2">
             {/* WhatsApp */}
             <button
               onClick={() => {
                 const msg = `Bonjour, je vous invite à découvrir M-Biz, une application gratuite conçue pour simplifier la gestion quotidienne de votre commerce (ventes, dépenses et dettes), utilisable même sans connexion internet. Vous pouvez y accéder à l'adresse suivante : https://m-biz.vercel.app/`;
                 window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
               }}
               className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-[#25D366] text-white font-bold text-xs hover:bg-[#1ebe5d] transition-all cursor-pointer shadow-sm"
             >
               {/* WhatsApp SVG icon */}
               <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
                 <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
               </svg>
               Partager sur WhatsApp
             </button>
 
             {/* Facebook */}
             <button
               onClick={() => {
                 const url = encodeURIComponent('https://m-biz.vercel.app/');
                 window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${encodeURIComponent('Bonjour, je vous invite à découvrir M-Biz, une application gratuite conçue pour simplifier la gestion quotidienne de votre commerce (ventes, dépenses et dettes), utilisable même sans connexion internet.')}`, '_blank');
               }}
               className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-[#1877F2] text-white font-bold text-xs hover:bg-[#1465d8] transition-all cursor-pointer shadow-sm"
             >
               {/* Facebook SVG icon */}
               <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
                 <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
               </svg>
               Partager sur Facebook
             </button>
 
             {/* Web Share API (mobile natif) */}
             {'share' in navigator && (
               <button
                 onClick={() => {
                   navigator.share({
                     title: 'M-Biz — Gestion de boutique',
                     text: 'Bonjour, je vous invite à découvrir M-Biz, une application gratuite conçue pour simplifier la gestion quotidienne de votre commerce (ventes, dépenses et dettes), utilisable même sans connexion internet.',
                     url: 'https://m-biz.vercel.app/'
                   }).catch(() => {});
                 }}
                 className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-white border border-black/10 text-text-main font-bold text-xs hover:bg-black/5 transition-all cursor-pointer shadow-sm"
               >
                 <Share2 size={14} />
                 Partager autrement...
               </button>
             )}
          </div>
        </div>

        <div className="glass-card p-5 border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <div className="flex items-center gap-2 mb-1">
            <HelpCircle size={18} className="text-primary-dark" />
            <h3 className="font-semibold text-lg text-text-main">Aide & Tutoriel</h3>
          </div>
          <p className="text-sm text-text-muted mb-4">
            Besoin d'aide ou envie de revoir le guide de démarrage de l'application ?
          </p>
          <button
            onClick={() => {
              localStorage.removeItem('mbiz_onboarding_completed');
              toast.success('Le tutoriel de bienvenue va se relancer sur votre tableau de bord !');
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-primary text-black font-bold text-xs hover:opacity-90 transition-all cursor-pointer shadow-sm"
          >
            Revoir le guide de démarrage
          </button>
        </div>

        <div className="glass-card p-5">
          <h3 className="font-semibold text-lg mb-2 text-text-main">Sécurité</h3>
          <button className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-black/5 text-text-main font-bold text-xs hover:bg-black/10 transition-all cursor-pointer shadow-sm" onClick={() => { logout(); toast('Application verrouillée'); }}>
            <Lock size={14} /> Verrouiller l'application
          </button>
        </div>

        <div className="glass-card p-5">
          <h3 className="font-semibold text-lg mb-2 text-[#FF6B6B]">Zone Dangereuse</h3>
          <button className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-[#FF6B6B]/10 text-[#FF6B6B] font-bold text-xs hover:bg-[#FF6B6B]/20 transition-all cursor-pointer shadow-sm" onClick={() => setConfirmReset(true)}>
            <LogOut size={14} /> Réinitialiser l'application
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmReset}
        title="Réinitialiser l'application ?"
        message="Toutes vos données (ventes, produits, dettes, tontines...) seront définitivement effacées. Cette action est irréversible."
        confirmLabel="Oui, tout effacer"
        cancelLabel="Annuler"
        danger={true}
        onConfirm={async () => { await db.delete(); window.location.reload(); }}
        onCancel={() => setConfirmReset(false)}
      />

      <div className="flex flex-col items-center justify-center gap-1.5 mt-8 mb-4">
        <p className="text-xs text-text-muted font-semibold tracking-wide">
          M-Biz Progrès
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-text-muted font-semibold uppercase tracking-wider opacity-60">by</span>
          <img src="/logo_tlc.png" alt="TLC Logo" className="h-6 w-auto object-contain rounded shadow-sm border border-black/5 dark:border-white/5" />
        </div>
      </div>
    </div>
  );
};

export default Parametres;
