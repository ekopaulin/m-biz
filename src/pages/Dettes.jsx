import React, { useState } from 'react';
import { UserPlus, UserMinus, X, Check } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';
import Loader from '../components/Loader';

const toLocalISOString = (d = new Date()) => {
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, -1);
};
const toLocalDateStr = () => toLocalISOString().split('T')[0];
const fmt = (n) => (n || 0).toLocaleString('fr-FR');

const Dettes = () => {
  const { activeCommerceId, devise } = useAppContext();
  const [tab, setTab] = useState('clients');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ 
    nom: '', 
    montant: '',
    date: toLocalDateStr(),
    time: new Date().toTimeString().substring(0, 5)
  });

  // Nouveaux états pour les remboursements partiels
  const [activeHistoryDetteId, setActiveHistoryDetteId] = useState(null);
  const [isRepayModalOpen, setIsRepayModalOpen] = useState(false);
  const [selectedDette, setSelectedDette] = useState(null);
  const [repayAmount, setRepayAmount] = useState('');

  const toutesDettes = useLiveQuery(
    async () => {
      const dettes = await db.dettesClients.where('commerceId').equals(activeCommerceId || 0).toArray();
      const activeDettes = dettes.filter(d => d.statut !== 'soldé');
      return Promise.all(
        activeDettes.map(async (d) => {
          let name = 'Inconnu';
          if (d.type === 'fournisseur') {
            const f = await db.fournisseurs.get(d.clientId);
            name = f ? f.nom : 'Fournisseur';
          } else {
            const c = await db.clients.get(d.clientId);
            name = c ? c.nom : 'Client';
          }
          const paiements = await db.paiementsDettes.where('detteId').equals(d.id).toArray();
          return {
            ...d,
            nomClient: name,
            paiements: paiements.sort((a, b) => new Date(b.date) - new Date(a.date))
          };
        })
      );
    },
    [activeCommerceId]
  );

  if (toutesDettes === undefined) {
    return <Loader message="Chargement des dettes..." />;
  }

  const dettesClients = toutesDettes.filter(d => d.type !== 'fournisseur');
  const dettesFournisseurs = toutesDettes.filter(d => d.type === 'fournisseur');

  const handleAddDette = async (e) => {
    e.preventDefault();
    const initMontant = parseFloat(formData.montant);
    if (tab === 'clients') {
      const clientId = await db.clients.add({
        commerceId: activeCommerceId,
        nom: formData.nom,
        telephone: '',
        createdAt: new Date().toISOString()
      });
      await db.dettesClients.add({
        clientId,
        commerceId: activeCommerceId,
        montantInitial: initMontant,
        montantRestant: initMontant,
        date: new Date(`${formData.date}T${formData.time}`).toISOString(),
        statut: 'en cours',
        description: 'Dette manuelle',
        type: 'client'
      });
      toast.success('Dette enregistrée !');
    } else {
      const fournisseurId = await db.fournisseurs.add({
        commerceId: activeCommerceId,
        nom: formData.nom,
        telephone: '',
        contact: ''
      });
      await db.dettesClients.add({
        clientId: fournisseurId,
        commerceId: activeCommerceId,
        montantInitial: initMontant,
        montantRestant: initMontant,
        date: new Date(`${formData.date}T${formData.time}`).toISOString(),
        statut: 'en cours',
        description: 'Dette fournisseur',
        type: 'fournisseur'
      });
      toast.success('Dette fournisseur enregistrée !');
    }
    setIsModalOpen(false);
    setFormData({ 
      nom: '', 
      montant: '',
      date: toLocalDateStr(),
      time: new Date().toTimeString().substring(0, 5)
    });
  };

  const handleRepaySubmit = async (e) => {
    e.preventDefault();
    if (!selectedDette || !repayAmount) return;

    const amount = parseFloat(repayAmount);
    const resteActuel = parseFloat(selectedDette.montantRestant || 0);

    if (isNaN(amount) || amount <= 0 || amount > resteActuel) {
      toast.error("Montant de remboursement invalide !");
      return;
    }

    await db.transaction('rw', db.dettesClients, db.paiementsDettes, async () => {
      // 1. Ajouter le versement dans paiementsDettes
      await db.paiementsDettes.add({
        detteId: selectedDette.id,
        montant: amount,
        date: new Date().toISOString(),
        note: amount === resteActuel ? 'Remboursement total' : 'Remboursement partiel'
      });

      // 2. Mettre à jour la dette
      const nouveauReste = Math.max(0, resteActuel - amount);
      await db.dettesClients.update(selectedDette.id, {
        montantRestant: nouveauReste,
        statut: nouveauReste === 0 ? 'soldé' : 'en cours'
      });
    });

    setIsRepayModalOpen(false);
    setSelectedDette(null);
    setRepayAmount('');
    toast.success("Remboursement enregistré avec succès !");
  };

  return (
    <div className="page-container">
      <header className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Dettes</h1>
        <p className="text-sm text-text-muted">Suivi des créances et engagements</p>
      </header>

      <div className="flex gap-2 mb-6 bg-white/50 p-1 rounded-xl">
        <button 
          className={`flex-1 py-2 text-sm rounded-lg transition-all notranslate ${tab === 'clients' ? 'bg-primary font-semibold shadow-sm text-white' : 'text-text-muted hover:bg-white/80'}`}
          translate="no"
          onClick={() => setTab('clients')}
        >
          On me doit
        </button>
        <button 
          className={`flex-1 py-2 text-sm rounded-lg transition-all notranslate ${tab === 'fournisseurs' ? 'bg-primary font-semibold shadow-sm text-white' : 'text-text-muted hover:bg-white/80'}`}
          translate="no"
          onClick={() => setTab('fournisseurs')}
        >
          Je dois
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {tab === 'clients' ? (
          dettesClients.length === 0 ? (
            <div className="text-center p-8 text-text-muted">Aucune dette client.</div>
          ) : (
            dettesClients.map(d => (
              <div key={d.id} className="glass-card p-4 flex flex-col gap-3 relative overflow-hidden border border-black/5 bg-white/60">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-base text-text-main mb-0.5">{d.nomClient}</h4>
                    <span className="text-[11px] text-text-muted">
                      Pris le : {new Date(d.date).toLocaleDateString('fr-FR')} à {new Date(d.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm text-[#FF6B6B]">{fmt(d.montantRestant)} {devise} restant</div>
                    <span className="text-[10px] text-text-muted block mt-0.5">Initial : {fmt(d.montantInitial)} {devise}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-1">
                  <button 
                    onClick={() => { setSelectedDette(d); setRepayAmount(String(d.montantRestant)); setIsRepayModalOpen(true); }}
                    className="btn btn-primary flex-1 text-xs !py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Check size={14} /> Rembourser
                  </button>
                  {d.paiements && d.paiements.length > 0 && (
                    <button 
                      onClick={() => setActiveHistoryDetteId(activeHistoryDetteId === d.id ? null : d.id)}
                      className="btn bg-white shadow-sm border border-black/5 text-xs !py-2 rounded-xl font-medium text-text-muted cursor-pointer"
                    >
                      {activeHistoryDetteId === d.id ? '▲ Masquer' : `▼ Acomptes (${d.paiements.length})`}
                    </button>
                  )}
                </div>

                {/* Historique des acomptes reçus */}
                {activeHistoryDetteId === d.id && d.paiements && d.paiements.length > 0 && (
                  <div className="mt-2 border-t border-black/5 pt-2">
                    <h5 className="font-bold text-[10px] text-text-muted uppercase mb-1.5 text-left">Historique des remboursements</h5>
                    <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto">
                      {d.paiements.map((p) => (
                        <div key={p.id} className="flex justify-between items-center p-2 bg-bg-light rounded-lg text-[11px]">
                          <span className="text-text-muted">
                            {new Date(p.date).toLocaleDateString('fr-FR')} à {new Date(p.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="font-bold text-primary">-{fmt(p.montant)} {devise}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )
        ) : (
          dettesFournisseurs.length === 0 ? (
            <div className="text-center p-8 text-text-muted">Aucune dette fournisseur.</div>
          ) : (
            dettesFournisseurs.map(d => (
              <div key={d.id} className="glass-card p-4 flex flex-col gap-3 relative overflow-hidden border border-black/5 bg-white/60">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-base text-text-main mb-0.5">{d.nomClient}</h4>
                    <span className="text-[11px] text-text-muted">
                      Pris le : {new Date(d.date).toLocaleDateString('fr-FR')} à {new Date(d.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm text-[#FF6B6B]">{fmt(d.montantRestant)} {devise} restant</div>
                    <span className="text-[10px] text-text-muted block mt-0.5">Initial : {fmt(d.montantInitial)} {devise}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-1">
                  <button 
                    onClick={() => { setSelectedDette(d); setRepayAmount(String(d.montantRestant)); setIsRepayModalOpen(true); }}
                    className="btn btn-primary flex-1 text-xs !py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Check size={14} /> Rembourser
                  </button>
                  {d.paiements && d.paiements.length > 0 && (
                    <button 
                      onClick={() => setActiveHistoryDetteId(activeHistoryDetteId === d.id ? null : d.id)}
                      className="btn bg-white shadow-sm border border-black/5 text-xs !py-2 rounded-xl font-medium text-text-muted cursor-pointer"
                    >
                      {activeHistoryDetteId === d.id ? '▲ Masquer' : `▼ Acomptes (${d.paiements.length})`}
                    </button>
                  )}
                </div>

                {/* Historique des acomptes reçus */}
                {activeHistoryDetteId === d.id && d.paiements && d.paiements.length > 0 && (
                  <div className="mt-2 border-t border-black/5 pt-2">
                    <h5 className="font-bold text-[10px] text-text-muted uppercase mb-1.5 text-left">Historique des remboursements</h5>
                    <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto">
                      {d.paiements.map((p) => (
                        <div key={p.id} className="flex justify-between items-center p-2 bg-bg-light rounded-lg text-[11px]">
                          <span className="text-text-muted">
                            {new Date(p.date).toLocaleDateString('fr-FR')} à {new Date(p.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="font-bold text-primary">-{fmt(p.montant)} {devise}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )
        )}
      </div>

      <button 
        onClick={() => setIsModalOpen(true)} 
        className="fixed bottom-[90px] right-5 btn btn-primary !p-4 !rounded-full shadow-glass z-40 cursor-pointer"
      >
        {tab === 'clients' ? <UserPlus size={24} /> : <UserMinus size={24} />}
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-bg-light rounded-2xl w-full max-w-sm p-6 relative shadow-2xl">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-text-muted hover:text-black">
              <X size={24} />
            </button>
            <h2 className="text-xl font-bold mb-4">Nouvelle Dette {tab === 'clients' ? 'Client' : 'Fournisseur'}</h2>
            <form onSubmit={handleAddDette}>
              <div className="form-group">
                <label>Nom {tab === 'clients' ? 'du client' : 'du fournisseur'}</label>
                <input required type="text" className="form-control" value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Montant (FCFA)</label>
                <div className="relative">
                  <input required type="number" className="form-control pr-12" value={formData.montant} onChange={e => setFormData({...formData, montant: e.target.value})} />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-xs text-text-muted font-medium">FCFA</div>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="form-group flex-1">
                  <label>Date</label>
                  <input required type="date" className="form-control text-sm px-2" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>
                <div className="form-group flex-1">
                  <label>Heure</label>
                  <input required type="time" className="form-control text-sm px-2" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} />
                </div>
              </div>
              <button type="submit" className="btn btn-primary w-full mt-4 notranslate" translate="no">Enregistrer</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Remboursement de Dette */}
      {isRepayModalOpen && selectedDette && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-bg-light rounded-2xl w-full max-w-sm p-6 relative shadow-2xl text-text-main text-left">
            <button onClick={() => { setIsRepayModalOpen(false); setSelectedDette(null); }} className="absolute top-4 right-4 text-text-muted hover:text-black">
              <X size={24} />
            </button>
            <h2 className="text-xl font-bold mb-1">Enregistrer un Remboursement</h2>
            <p className="text-xs text-text-muted mb-4">Pour {selectedDette.nomClient}</p>
            
            <form onSubmit={handleRepaySubmit}>
              <div className="form-group">
                <label>Montant du remboursement (FCFA)</label>
                <div className="relative">
                  <input 
                    required 
                    type="number" 
                    min="1"
                    max={selectedDette.montantRestant}
                    placeholder="Montant payé" 
                    className="form-control pr-12" 
                    value={repayAmount} 
                    onChange={e => setRepayAmount(e.target.value)} 
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-xs text-text-muted font-medium">FCFA</div>
                </div>
                <span className="text-[10px] text-text-muted mt-1 block">
                  Reste à payer : {fmt(selectedDette.montantRestant)} {devise}
                </span>
              </div>
              <div className="flex gap-2 mt-4">
                <button 
                  type="button" 
                  onClick={() => setRepayAmount(String(selectedDette.montantRestant))} 
                  className="btn bg-white border border-black/10 text-xs font-semibold px-3 rounded-xl hover:bg-black/5 cursor-pointer"
                >
                  Tout payer
                </button>
                <button type="submit" className="btn btn-primary flex-1 cursor-pointer notranslate" translate="no">
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dettes;
