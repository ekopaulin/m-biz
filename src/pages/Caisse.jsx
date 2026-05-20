import React, { useState } from 'react';
import { ShoppingBag, CheckCircle, Search, X, AlertCircle, FileText } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';
import { genererRecuPdf } from '../components/PdfGenerator';
import Loader from '../components/Loader';

const toLocalISOString = (d = new Date()) => {
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, -1);
};
const fmt = (n) => Number(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

const Caisse = () => {
  const { activeCommerceId, devise } = useAppContext();
  const [tab, setTab] = useState('detail');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantite, setQuantite] = useState(1);
  const [globalQuantities, setGlobalQuantities] = useState({});

  // Recherche rapide de produit
  const [searchQuery, setSearchQuery] = useState('');

  // Champ client pour vente à crédit
  const [nomClient, setNomClient] = useState('');

  // États pour le modal de reçu WhatsApp
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastSaleDetails, setLastSaleDetails] = useState(null);

  const commerce = useLiveQuery(
    () => db.commerces.get(activeCommerceId || 0),
    [activeCommerceId]
  );

  const produits = useLiveQuery(
    () => db.produits
      .where('commerceId').equals(activeCommerceId || 0)
      .filter(p => (p.stock > 0 || p.isFood) && p.actif !== 0)
      .toArray(),
    [activeCommerceId]
  );

  const ventesRecentes = useLiveQuery(
    () => db.ventes.where('commerceId').equals(activeCommerceId || 0).reverse().limit(5).toArray(),
    [activeCommerceId]
  );

  if (commerce === undefined || produits === undefined || ventesRecentes === undefined) {
    return <Loader message="Préparation de la caisse..." />;
  }

  // Filtrage en temps réel par la recherche
  const produitsFiltres = searchQuery.trim()
    ? produits.filter(p => p.nom.toLowerCase().includes(searchQuery.toLowerCase()))
    : produits;

  const handleVenteDetail = async () => {
    if (!selectedProductId || quantite < 1) return;

    const produit = produits.find(p => p.id === parseInt(selectedProductId));
    if (!produit || (!produit.isFood && produit.stock < quantite)) {
      toast.error("Quantité insuffisante en stock !");
      return;
    }

    // Si crédit, le nom du client est obligatoire
    if (paymentMethod === 'Crédit' && !nomClient.trim()) {
      toast.error("Veuillez indiquer le nom du client à crédit !");
      return;
    }

    const totalVente = produit.prixVente * quantite;
    const totalBenefice = (produit.prixVente - produit.prixAchat) * quantite;

    // Transaction incluant clients et dettes si mode Crédit
    await db.transaction('rw', db.produits, db.ventes, db.lignesVente, db.clients, db.dettesClients, async () => {
      // Déduire stock
      if (!produit.isFood) {
        await db.produits.update(produit.id, { stock: produit.stock - quantite });
      }

      // Créer la vente
      const venteId = await db.ventes.add({
        commerceId: activeCommerceId,
        date: toLocalISOString(new Date()),
        totalVente,
        totalBenefice,
        modePaiement: paymentMethod,
        statut: paymentMethod === 'Crédit' ? 'crédit' : 'payé'
      });

      await db.lignesVente.add({
        venteId,
        produitId: produit.id,
        quantite,
        prixUnitaire: produit.prixVente,
        beneficeUnitaire: produit.prixVente - produit.prixAchat
      });

      // Si crédit → créer client + dette automatiquement
      if (paymentMethod === 'Crédit') {
        // Chercher si le client existe déjà
        const clientsExistants = await db.clients
          .where('commerceId').equals(activeCommerceId)
          .filter(c => c.nom.toLowerCase() === nomClient.trim().toLowerCase())
          .toArray();

        let clientId;
        if (clientsExistants.length > 0) {
          clientId = clientsExistants[0].id;
        } else {
          clientId = await db.clients.add({
            commerceId: activeCommerceId,
            nom: nomClient.trim(),
            telephone: '',
            createdAt: new Date().toISOString()
          });
        }

        await db.dettesClients.add({
          commerceId: activeCommerceId,
          clientId,
          montantInitial: totalVente,
          montantRestant: totalVente,
          date: toLocalISOString(),
          statut: 'en cours',
          description: `${quantite}x ${produit.nom} (via Caisse)`
        });
      }
    });

    const savedNomClient = nomClient.trim();

    // Reset formulaire
    setSelectedProductId('');
    setQuantite(1);
    setNomClient('');
    setSearchQuery('');

    if (paymentMethod === 'Crédit') {
      toast.success(`Dette de ${totalVente} FCFA enregistrée pour ${savedNomClient} !`);
    } else {
      toast.success('Vente enregistrée avec succès !');
    }

    setLastSaleDetails({
      type: 'detail',
      date: new Date().toISOString(),
      modePaiement: paymentMethod,
      nomClient: paymentMethod === 'Crédit' ? savedNomClient : '',
      totalVente,
      items: [{
        nom: produit.nom,
        quantite,
        prixUnitaire: produit.prixVente,
        total: totalVente
      }]
    });
  };

  const handleVenteGlobale = async () => {
    const itemsToSell = Object.entries(globalQuantities)
      .map(([id, qty]) => ({ id: parseInt(id), qty: parseInt(qty) }))
      .filter(item => item.qty > 0);

    if (itemsToSell.length === 0) {
      toast.error("Veuillez indiquer au moins une quantité");
      return;
    }

    let hasError = false;
    let totalVenteGlobal = 0;
    let totalBeneficeGlobal = 0;
    const lignesToCreate = [];
    const produitsToUpdate = [];

    for (let item of itemsToSell) {
      const produit = produits.find(p => p.id === item.id);
      if (!produit || (!produit.isFood && produit.stock < item.qty)) {
        toast.error(`Stock insuffisant pour ${produit?.nom || 'un produit'}`);
        hasError = true;
        break;
      }

      totalVenteGlobal += produit.prixVente * item.qty;
      totalBeneficeGlobal += (produit.prixVente - produit.prixAchat) * item.qty;

      lignesToCreate.push({
        produitId: produit.id,
        quantite: item.qty,
        prixUnitaire: produit.prixVente,
        beneficeUnitaire: produit.prixVente - produit.prixAchat
      });

      if (!produit.isFood) {
        produitsToUpdate.push({ id: produit.id, newStock: produit.stock - item.qty });
      }
    }

    if (hasError) return;

    await db.transaction('rw', db.produits, db.ventes, db.lignesVente, async () => {
      for (let p of produitsToUpdate) {
        await db.produits.update(p.id, { stock: p.newStock });
      }

      const venteId = await db.ventes.add({
        commerceId: activeCommerceId,
        date: toLocalISOString(new Date()),
        totalVente: totalVenteGlobal,
        totalBenefice: totalBeneficeGlobal,
        modePaiement: 'Mixte (Bilan du jour)',
        statut: 'payé'
      });

      for (let ligne of lignesToCreate) {
        await db.lignesVente.add({ ...ligne, venteId });
      }
    });

    // Construire la liste des articles pour le reçu
    const receiptItems = itemsToSell.map(item => {
      const prod = produits.find(p => p.id === item.id);
      return {
        nom: prod.nom,
        quantite: item.qty,
        prixUnitaire: prod.prixVente,
        total: prod.prixVente * item.qty
      };
    });

    setGlobalQuantities({});
    toast.success('Bilan du jour enregistré !');

    setLastSaleDetails({
      type: 'global',
      date: new Date().toISOString(),
      modePaiement: 'Mixte (Bilan du jour)',
      nomClient: '',
      totalVente: totalVenteGlobal,
      items: receiptItems
    });
  };

  const getProductName = (vente) => {
    if (vente.modePaiement.includes('Bilan')) return `Bilan du jour #${vente.id}`;
    return `Vente #${vente.id}`;
  };

  const handleShareReceipt = () => {
    if (!lastSaleDetails) return;

    const shopName = commerce?.nom || 'M-Biz Pro';
    const dateStr = new Date(lastSaleDetails.date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).replace(',', ' à');

    let text = `*🧾 REÇU DE VENTE - ${shopName.toUpperCase()}*\n`;
    text += `*Date :* ${dateStr}\n`;
    text += `*Mode de paiement :* ${lastSaleDetails.modePaiement}\n`;
    if (lastSaleDetails.nomClient) {
      text += `*Client :* ${lastSaleDetails.nomClient}\n`;
    }
    text += `------------------------------------------\n`;

    lastSaleDetails.items.forEach(item => {
      text += `• *${item.nom}*\n  ${item.quantite} x ${fmt(item.prixUnitaire)} FCFA = *${fmt(item.total)} FCFA*\n`;
    });

    text += `------------------------------------------\n`;
    text += `*TOTAL : ${fmt(lastSaleDetails.totalVente)} FCFA*\n\n`;

    if (lastSaleDetails.modePaiement === 'Crédit') {
      text += `*⚠️ Reste à payer : ${fmt(lastSaleDetails.totalVente)} FCFA*\n\n`;
    } else {
      text += `*Statut :* Payé - Merci ! ✅\n\n`;
    }

    text += `🙏 _Merci de votre confiance et à bientôt !_\n`;
    text += `_Généré avec M-Biz Progrès_ 🚀`;

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="page-container">
      <header className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Caisse</h1>
        <p className="text-sm text-text-muted">Enregistrez ce que vous vendez</p>
      </header>

      <div className="flex gap-2 mb-6 bg-white/50 p-1 rounded-xl">
        <button
          className={`flex-1 py-3 text-sm rounded-lg transition-all ${tab === 'detail' ? 'bg-primary font-bold shadow-sm text-white' : 'text-text-muted hover:bg-white/80'}`}
          onClick={() => setTab('detail')}
        >
          Une vente
        </button>
        <button
          className={`flex-1 py-3 text-sm rounded-lg transition-all ${tab === 'global' ? 'bg-primary font-bold shadow-sm text-white' : 'text-text-muted hover:bg-white/80'}`}
          onClick={() => setTab('global')}
        >
          Bilan du soir
        </button>
      </div>

      {tab === 'detail' ? (
        <div className="glass-card mb-6 animate-[fadeIn_0.3s_ease-out]">

          {/* 🔍 Recherche rapide */}
          <div className="form-group">
            <label>Qu'est-ce que le client achète ?</label>
            <div className="relative mb-2">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                <Search size={15} />
              </div>
              <input
                type="text"
                placeholder="Rechercher un produit..."
                className="form-control pl-9 pr-9"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setSelectedProductId('');
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setSelectedProductId(''); }}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-muted hover:text-black cursor-pointer"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Liste filtrée des produits */}
            {searchQuery && produitsFiltres.length > 0 && (
              <div className="flex flex-col gap-1 mb-2 max-h-48 overflow-y-auto rounded-xl border border-black/10 bg-white shadow-sm">
                {produitsFiltres.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedProductId(String(p.id));
                      setSearchQuery(p.nom);
                    }}
                    className={`flex justify-between items-center px-4 py-2.5 text-left hover:bg-primary/5 transition-all cursor-pointer ${selectedProductId === String(p.id) ? 'bg-primary/10 font-bold' : ''}`}
                  >
                    <span className="text-sm text-text-main">{p.nom}</span>
                    <span className="text-xs text-primary font-bold">{fmt(p.prixVente)} {devise}</span>
                  </button>
                ))}
              </div>
            )}

            {searchQuery && produitsFiltres.length === 0 && (
              <div className="flex items-center gap-2 text-xs text-text-muted px-2 py-2">
                <AlertCircle size={13} /> Aucun produit trouvé pour « {searchQuery} »
              </div>
            )}

            {/* Sélecteur classique si pas de recherche */}
            {!searchQuery && (
              <select className="form-control" value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)}>
                <option value="">Sélectionnez dans la liste...</option>
                {produits.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nom} — {p.prixVente} FCFA {p.isFood ? '' : `(Reste: ${p.stock})`}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="form-group">
            <label>Combien (Quantité) ?</label>
            <input
              type="number"
              className="form-control"
              value={quantite}
              onChange={e => setQuantite(parseInt(e.target.value) || '')}
              min="1"
            />
          </div>

          <div className="form-group">
            <label>Comment le client a payé ?</label>
            <div className="flex gap-2">
              {['Cash', 'Crédit', 'Mobile'].map(method => (
                <button
                  key={method}
                  className={`flex-1 text-center py-2 px-1 rounded-xl text-sm border transition-all cursor-pointer ${paymentMethod === method ? 'bg-primary border-primary-dark font-bold text-white shadow-sm' : 'bg-white border-black/10 text-text-muted font-normal'}`}
                  onClick={() => setPaymentMethod(method)}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* Champ client si paiement à crédit */}
          {paymentMethod === 'Crédit' && (
            <div className="form-group animate-[fadeIn_0.2s_ease-out]">
              <label className="text-[#FF6B6B] font-semibold">Nom du client (obligatoire)</label>
              <input
                type="text"
                placeholder="Ex: Mama Céline, Oncle Paul..."
                className="form-control border-[#FF6B6B]/40 focus:border-[#FF6B6B]"
                value={nomClient}
                onChange={e => setNomClient(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-[#FF6B6B]/80 mt-1">
                La dette sera automatiquement créée dans l'onglet Dettes.
              </p>
            </div>
          )}

          {/* Récapitulatif si produit sélectionné */}
          {selectedProductId && (() => {
            const p = produits.find(pr => pr.id === parseInt(selectedProductId));
            if (!p) return null;
            const total = p.prixVente * (quantite || 1);
            return (
              <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 mb-3 flex justify-between items-center">
                <span className="text-sm text-text-muted">Total à encaisser</span>
                <span className="text-xl font-bold text-primary">{fmt(total)} {devise}</span>
              </div>
            );
          })()}

          <button
            onClick={handleVenteDetail}
            className="btn btn-primary w-full mt-2 !py-4 cursor-pointer"
            disabled={!selectedProductId}
          >
            <ShoppingBag size={20} />
            {paymentMethod === 'Crédit' ? 'Enregistrer la vente à crédit' : 'Valider la vente'}
          </button>
        </div>
      ) : (
        <div className="mb-6 animate-[fadeIn_0.3s_ease-out]">
          <p className="text-sm text-text-muted mb-4 bg-white/50 p-3 rounded-lg">
            C'est la fin de la journée ? Notez simplement combien vous avez vendu pour chaque produit. L'application calculera tout d'un seul coup !
          </p>

          {/* 🔍 Recherche dans le bilan du soir aussi */}
          <div className="relative mb-4">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
              <Search size={15} />
            </div>
            <input
              type="text"
              placeholder="Filtrer les produits..."
              className="form-control pl-9"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-3 mb-6">
            {produitsFiltres.map(p => {
              const qty = parseInt(globalQuantities[p.id] || 0);
              const total = qty * p.prixVente;
              
              return (
              <div key={p.id} className="glass-card flex flex-col p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold">{p.nom}</div>
                    <div className="text-sm text-text-muted">{p.prixVente} FCFA l'unité</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">Qté vendue:</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      className="form-control !w-20 text-center font-bold !py-2"
                      value={globalQuantities[p.id] || ''}
                      onChange={e => setGlobalQuantities({ ...globalQuantities, [p.id]: e.target.value })}
                    />
                  </div>
                </div>
                {qty > 0 && (
                  <div className="mt-2 pt-2 border-t border-black/5 text-right">
                    <span className="text-xs text-text-muted mr-2">Total pour {p.nom} :</span>
                    <span className="font-bold text-primary">{fmt(total)} {devise}</span>
                  </div>
                )}
              </div>
            )})}
            {produitsFiltres.length === 0 && (
              <div className="text-center p-4 text-text-muted text-sm">
                {produits.length === 0 ? 'Ajoutez d\'abord des produits dans "Stock".' : 'Aucun produit trouvé.'}
              </div>
            )}
          </div>

          {(() => {
            const grandTotalBilan = produits.reduce((sum, p) => {
              const qty = parseInt(globalQuantities[p.id] || 0);
              return sum + (qty * p.prixVente);
            }, 0);

            if (grandTotalBilan > 0) {
              return (
                <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 mb-4 text-center animate-[fadeIn_0.3s_ease-out]">
                  <p className="text-sm text-text-muted mb-1 font-semibold">Recette totale estimée à vérifier dans la caisse :</p>
                  <p className="text-2xl font-black text-primary">{fmt(grandTotalBilan)} {devise}</p>
                </div>
              );
            }
            return null;
          })()}

          <button
            onClick={handleVenteGlobale}
            className="btn btn-primary w-full !py-4 text-lg mt-2 mb-8 hover:bg-primary-dark cursor-pointer shadow-lg"
          >
            <CheckCircle size={24} />
            J'ai fini ma journée !
          </button>
        </div>
      )}

      {tab === 'detail' && (
        <>
          <h3 className="text-base font-bold mb-3">Dernières ventes</h3>
          <div className="flex flex-col gap-3">
            {ventesRecentes.length === 0 ? (
              <div className="text-center text-sm text-text-muted">Aucune vente récente.</div>
            ) : (
              ventesRecentes.map(v => (
                <div key={v.id} className="glass-card flex justify-between items-center p-4">
                  <div>
                    <h4 className="font-semibold text-base mb-1">{getProductName(v)}</h4>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-text-muted">
                        {new Date(v.date).toLocaleTimeString([], { timeStyle: 'short' })}
                      </span>
                      {String(v.modePaiement || '').includes('Bilan') ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600">
                          BILAN DU SOIR
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600">
                          VENTE DIRECTE
                        </span>
                      )}
                      {v.statut === 'crédit' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#FF6B6B]/10 text-[#FF6B6B]">
                          À CRÉDIT
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`font-bold ${v.statut === 'crédit' ? 'text-[#FF6B6B]' : 'text-primary-dark'}`}>
                    {fmt(v.totalVente)} {devise}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

    </div>
  );
};

export default Caisse;
