import React, { useState } from 'react';
import { PiggyBank, Plus, Trash2, Calendar, DollarSign, X } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import Loader from '../components/Loader';

const toLocalISOString = (d = new Date()) => {
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, -1);
};
const fmt = (n) => Number(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

const Cotisations = () => {
  const { activeCommerceId, devise } = useAppContext();
  
  // États de l'interface
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeHistoryTontineId, setActiveHistoryTontineId] = useState(null);

  // États pour les modals de confirmation
  const [confirmCotiser, setConfirmCotiser] = useState({ open: false, tontine: null });
  const [confirmVersement, setConfirmVersement] = useState({ open: false, id: null, montant: 0 });
  const [confirmDeleteTontine, setConfirmDeleteTontine] = useState({ open: false, id: null, nom: '' });

  // État du formulaire
  const [formData, setFormData] = useState({
    nom: '',
    montant: '',
    periodicite: 'Chaque jour'
  });

  // Charger les tontines du commerce
  const tontines = useLiveQuery(
    () => db.tontines.where('commerceId').equals(activeCommerceId || 0).toArray(),
    [activeCommerceId]
  );

  // Charger tous les versements
  const tousVersements = useLiveQuery(
    () => db.versementsTontine.toArray()
  );

  if (tontines === undefined || tousVersements === undefined) {
    return <Loader message="Chargement des cotisations..." />;
  }

  // Calculer le total cotisé par tontine
  const getStatsTontine = (tontineId) => {
    const list = tousVersements.filter(v => v.tontineId === tontineId);
    const total = list.reduce((sum, v) => sum + (v.montant || 0), 0);
    return {
      total,
      count: list.length,
      list: list.sort((a, b) => new Date(b.date) - new Date(a.date)) // Les plus récents en premier
    };
  };

  // Création d'une nouvelle tontine
  const handleCreateTontine = async (e) => {
    e.preventDefault();
    if (!formData.nom || !formData.montant) {
      toast.error("Veuillez remplir tous les champs !");
      return;
    }

    await db.tontines.add({
      commerceId: activeCommerceId,
      nom: formData.nom,
      montant: parseFloat(formData.montant),
      periodicite: formData.periodicite,
      prochainePaiement: ''
    });

    setIsModalOpen(false);
    setFormData({ nom: '', montant: '', periodicite: 'Chaque jour' });
    toast.success("Nouvelle cotisation créée avec succès !");
  };

  // Confirmer et enregistrer le versement
  const doCotiser = async (alsoAsExpense = false) => {
    const tontine = confirmCotiser.tontine;
    if (!tontine) return;
    await db.versementsTontine.add({
      tontineId: tontine.id,
      date: toLocalISOString(),
      montant: tontine.montant
    });
    if (alsoAsExpense) {
      await db.depenses.add({
        commerceId: activeCommerceId,
        date: toLocalISOString(),
        description: `Cotisation : ${tontine.nom}`,
        montant: tontine.montant,
        categorie: 'Personnel'
      });
      toast.success("Versement enregistré et déduit de la caisse !");
    } else {
      toast.success("Versement enregistré !");
    }
    setConfirmCotiser({ open: false, tontine: null });
  };

  const doAnnulerVersement = async () => {
    await db.versementsTontine.delete(confirmVersement.id);
    setConfirmVersement({ open: false, id: null, montant: 0 });
    toast.success("Versement supprimé !");
  };

  const doDeleteTontine = async () => {
    const { id: tontineId } = confirmDeleteTontine;
    await db.tontines.delete(tontineId);
    const lies = tousVersements.filter(v => v.tontineId === tontineId);
    for (const v of lies) {
      await db.versementsTontine.delete(v.id);
    }
    setConfirmDeleteTontine({ open: false, id: null, nom: '' });
    toast.success("Cotisation supprimée définitivement !");
  };

  return (
    <div className="page-container text-text-main">
      <header className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold mb-1">Cotisations</h1>
          <p className="text-sm text-text-muted">Gérez vos tontines et épargnes</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary text-xs !py-2.5 !px-4 rounded-xl flex items-center gap-1.5 notranslate"
          translate="no"
        >
          <Plus size={16} /> Nouvelle Cotisation
        </button>
      </header>

      {/* Liste des tontines actives */}
      <div className="flex flex-col gap-4">
        {tontines.length === 0 ? (
          <div className="glass-card text-center p-8 text-text-muted">
            <PiggyBank size={48} className="mx-auto mb-3 text-text-muted/50" />
            <p className="font-semibold text-sm">Aucune cotisation enregistrée.</p>
            <p className="text-xs mt-1">Créez votre première tontine pour commencer à suivre votre épargne !</p>
          </div>
        ) : (
          tontines.map((t) => {
            const stats = getStatsTontine(t.id);
            const isHistoryOpen = activeHistoryTontineId === t.id;

            return (
              <div key={t.id} className="glass-card p-4 flex flex-col gap-3 relative overflow-hidden border border-black/5 bg-white/60">
                {/* Supprimer la tontine */}
                <button 
                  onClick={() => setConfirmDeleteTontine({ open: true, id: t.id, nom: t.nom })}
                  className="absolute top-4 right-4 text-red-500 hover:text-red-700 p-1 rounded-lg"
                  title="Supprimer la cotisation"
                >
                  <Trash2 size={16} />
                </button>

                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 rounded-2xl p-3 flex items-center justify-center text-primary">
                    <PiggyBank size={24} />
                  </div>
                  <div className="text-left flex-1 min-w-0 pr-6">
                    <h3 className="font-bold text-base truncate">{t.nom}</h3>
                    <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                      <Calendar size={12} /> {t.periodicite} • <DollarSign size={12} /> {fmt(t.montant)} {devise}
                    </p>
                  </div>
                </div>

                {/* Statut financier de la tontine */}
                <div className="grid grid-cols-2 gap-2 bg-bg-light rounded-xl p-3 text-center my-1">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-text-muted block">Versements</span>
                    <span className="font-bold text-sm text-text-main">{stats.count} fois</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-text-muted block">Total Épargné</span>
                    <span className="font-bold text-sm text-primary">{fmt(stats.total)} {devise}</span>
                  </div>
                </div>

                {/* Actions principales */}
                <div className="flex gap-2">
                  <button 
                    onClick={() => setConfirmCotiser({ open: true, tontine: t })}
                    className="btn btn-primary flex-1 text-xs !py-2.5 rounded-xl font-bold flex items-center justify-center gap-1 shadow-sm"
                  >
                    Noter un versement ({fmt(t.montant)} {devise})
                  </button>
                  <button 
                    onClick={() => setActiveHistoryTontineId(isHistoryOpen ? null : t.id)}
                    className="btn bg-white shadow-sm border border-black/5 text-xs !py-2.5 rounded-xl font-medium text-text-muted"
                  >
                    {isHistoryOpen ? '▲ Masquer' : '▼ Historique'}
                  </button>
                </div>

                {/* Historique des versements pour cette tontine */}
                {isHistoryOpen && (
                  <div className="mt-2 border-t border-black/5 pt-3">
                    <h4 className="font-bold text-xs text-text-muted mb-2 text-left">Historique des dépôts</h4>
                    <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
                      {stats.list.length === 0 ? (
                        <p className="text-center py-2 text-xs text-text-muted">Aucun versement enregistré.</p>
                      ) : (
                        stats.list.map((v) => (
                          <div key={v.id} className="flex justify-between items-center p-2 bg-bg-light rounded-lg text-xs">
                            <div className="text-left">
                              <span className="font-semibold block text-text-main">
                                {new Date(v.date).toLocaleDateString('fr-FR')} à {new Date(v.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-primary">+{fmt(v.montant)} {devise}</span>
                              <button 
                                onClick={() => setConfirmVersement({ open: true, id: v.id, montant: v.montant })}
                                className="text-red-500 p-1 hover:bg-red-50 rounded"
                                title="Supprimer"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal de création de Tontine */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-bg-light rounded-2xl w-full max-w-sm p-6 relative shadow-2xl text-text-main text-left">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-text-muted hover:text-black">
              <X size={24} />
            </button>
            <h2 className="text-xl font-bold mb-4 notranslate" translate="no">Nouvelle Cotisation</h2>
            <form onSubmit={handleCreateTontine}>
              <div className="form-group">
                <label>Nom de la cotisation / tontine</label>
                <input 
                  required 
                  type="text" 
                  placeholder="Ex: Tontine Association, Épargne Grand Marché..." 
                  className="form-control" 
                  value={formData.nom} 
                  onChange={e => setFormData({...formData, nom: e.target.value})} 
                />
              </div>

              <div className="form-group">
                <label>Montant par versement (FCFA)</label>
                <div className="relative">
                  <input 
                    required 
                    type="number" 
                    placeholder="Ex: 500, 2000..." 
                    className="form-control pr-12" 
                    value={formData.montant} 
                    onChange={e => setFormData({...formData, montant: e.target.value})} 
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-xs text-text-muted font-medium">FCFA</div>
                </div>
              </div>

              <div className="form-group">
                <label>Fréquence (Périodicité)</label>
                <select 
                  className="form-control"
                  value={formData.periodicite}
                  onChange={e => setFormData({...formData, periodicite: e.target.value})}
                >
                  <option value="Chaque jour">Chaque jour</option>
                  <option value="Chaque semaine">Chaque semaine</option>
                  <option value="Chaque mois">Chaque mois</option>
                </select>
              </div>

              <button type="submit" className="btn btn-primary w-full mt-4">
                Créer la cotisation
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal spécial pour Cotiser avec option dépense */}
      {confirmCotiser.open && confirmCotiser.tontine && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-5 backdrop-blur-sm">
          <div className="bg-bg-light rounded-2xl w-full max-w-xs p-6 shadow-2xl border border-white/50">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <PiggyBank size={24} className="text-primary" />
            </div>
            <h3 className="text-base font-bold text-text-main text-center mb-1">
              Confirmer le versement
            </h3>
            <p className="text-sm text-text-muted text-center mb-6">
              <strong className="text-primary">{fmt(confirmCotiser.tontine.montant)} {devise}</strong> pour « {confirmCotiser.tontine.nom} »
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => doCotiser(true)}
                className="w-full py-2.5 px-4 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-dark transition-all cursor-pointer"
              >
                Enregistrer + déduire de la caisse
              </button>
              <button
                onClick={() => doCotiser(false)}
                className="w-full py-2.5 px-4 rounded-xl bg-white border border-black/10 text-text-main text-sm font-semibold hover:bg-black/5 transition-all cursor-pointer"
              >
                Enregistrer uniquement
              </button>
              <button
                onClick={() => setConfirmCotiser({ open: false, tontine: null })}
                className="w-full py-2 text-xs text-text-muted hover:text-text-main cursor-pointer"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation suppression versement */}
      <ConfirmModal
        isOpen={confirmVersement.open}
        title="Supprimer ce versement ?"
        message={`Ce versement de ${fmt(confirmVersement.montant)} FCFA sera effacé de l'historique.`}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        danger={true}
        onConfirm={doAnnulerVersement}
        onCancel={() => setConfirmVersement({ open: false, id: null, montant: 0 })}
      />

      {/* Confirmation suppression tontine */}
      <ConfirmModal
        isOpen={confirmDeleteTontine.open}
        title={`Supprimer "${confirmDeleteTontine.nom}" ?`}
        message="Toute la cotisation et son historique de versements seront définitivement effacés."
        confirmLabel="Oui, supprimer"
        cancelLabel="Non, garder"
        danger={true}
        onConfirm={doDeleteTontine}
        onCancel={() => setConfirmDeleteTontine({ open: false, id: null, nom: '' })}
      />
    </div>
  );
};

export default Cotisations;
