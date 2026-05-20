import React, { useState } from 'react';
import { Plus, X, Pencil, Trash2, Search } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import Loader from '../components/Loader';

const fmt = (n) => (n || 0).toLocaleString('fr-FR');
const emptyForm = { nom: '', categorie: '', prixAchat: '', prixVente: '', stock: '', stockMin: '5', isFood: false };

const Stock = () => {
  const { activeCommerceId, devise } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [searchQuery, setSearchQuery] = useState('');

  // Confirmation de suppression
  const [confirmDelete, setConfirmDelete] = useState({ open: false, product: null });

  const produits = useLiveQuery(
    () => db.produits.where('commerceId').equals(activeCommerceId || 0).toArray(),
    [activeCommerceId]
  );

  if (produits === undefined) {
    return <Loader message="Chargement du stock..." />;
  }

  const produitsFiltres = searchQuery.trim()
    ? produits.filter(p => p.actif !== 0 && p.nom.toLowerCase().includes(searchQuery.toLowerCase()))
    : produits.filter(p => p.actif !== 0);

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormData(emptyForm);
    setIsModalOpen(true);
  };

  const openEditModal = (p) => {
    setEditingProduct(p);
    setFormData({
      nom: p.nom,
      categorie: p.categorie || '',
      prixAchat: String(p.prixAchat),
      prixVente: String(p.prixVente),
      stock: p.isFood ? '' : String(p.stock),
      stockMin: String(p.stockMin ?? 5),
      isFood: p.isFood || false
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      nom: formData.nom,
      categorie: formData.categorie,
      prixAchat: parseFloat(formData.prixAchat) || 0,
      prixVente: parseFloat(formData.prixVente) || 0,
      stock: formData.isFood ? 999999 : parseInt(formData.stock, 10) || 0,
      stockMin: formData.isFood ? 0 : parseInt(formData.stockMin, 10) || 5,
      isFood: formData.isFood,
    };

    if (editingProduct) {
      await db.produits.update(editingProduct.id, payload);
      toast.success('Produit modifié avec succès !');
    } else {
      await db.produits.add({ ...payload, commerceId: activeCommerceId, actif: 1 });
      toast.success('Produit ajouté avec succès !');
    }
    setIsModalOpen(false);
    setFormData(emptyForm);
    setEditingProduct(null);
  };

  const handleDeleteConfirmed = async () => {
    if (!confirmDelete.product) return;
    const count = await db.lignesVente.where('produitId').equals(confirmDelete.product.id).count();
    if (count > 0) {
      await db.produits.update(confirmDelete.product.id, { actif: 0, stock: 0 });
      toast.success('Produit désactivé (historique préservé).');
    } else {
      await db.produits.delete(confirmDelete.product.id);
      toast.success('Produit supprimé.');
    }
    setConfirmDelete({ open: false, product: null });
  };

  return (
    <div className="page-container">
      <header className="mb-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold mb-1">Stock</h1>
          <p className="text-sm text-text-muted">Gérez votre inventaire</p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary !p-3">
          <Plus size={20} />
        </button>
      </header>

      {/* Barre de recherche */}
      <div className="relative mb-4">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
          <Search size={16} />
        </div>
        <input
          type="text"
          placeholder="Rechercher un produit..."
          className="form-control pl-9 pr-9"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-muted hover:text-black cursor-pointer"
          >
            <X size={15} />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {produits.filter(p => p.actif !== 0).length === 0 ? (
          <div className="text-center p-8 text-text-muted">Aucun produit en stock. Cliquez sur + pour en ajouter.</div>
        ) : produitsFiltres.length === 0 ? (
          <div className="text-center p-6 text-text-muted text-sm">Aucun produit trouvé pour « {searchQuery} »</div>
        ) : (
          produitsFiltres.map((p) => (
            <div
              key={p.id}
              className={`glass-card p-4 border-l-4 ${!p.isFood && p.stock <= p.stockMin ? 'border-l-[#FF6B6B]' : 'border-l-primary'}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-base mb-0.5 truncate">{p.nom}</h4>
                  <span className="text-xs text-text-muted">{p.categorie || 'Sans catégorie'}</span>
                </div>
                <div className="text-right ml-3 flex-shrink-0">
                  {p.isFood ? (
                    <div className="font-bold text-primary text-sm">Service / Illimité</div>
                  ) : (
                    <>
                      <div className={`font-bold text-sm ${p.stock <= p.stockMin ? 'text-[#FF6B6B]' : 'text-primary'}`}>
                        {p.stock} restants
                      </div>
                      {p.stock <= p.stockMin && (
                        <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FF6B6B]/10 text-[#FF6B6B]">
                          Bientôt fini
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Prix et actions */}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-black/5">
                <div className="flex gap-3 text-xs text-text-muted">
                  <span>Achat : <strong className="text-text-main">{fmt(p.prixAchat)} {devise}</strong></span>
                  <span>Vente : <strong className="text-primary">{fmt(p.prixVente)} {devise}</strong></span>
                  <span>Marge : <strong className="text-green-600">+{fmt(p.prixVente - p.prixAchat)} {devise}</strong></span>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => openEditModal(p)}
                    className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all cursor-pointer"
                    title="Modifier ce produit"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => setConfirmDelete({ open: true, product: p })}
                    className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all cursor-pointer"
                    title="Supprimer ce produit"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Création / Modification */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-bg-light rounded-2xl w-full max-w-sm p-6 relative shadow-2xl max-h-[90vh] overflow-y-auto">
            <button onClick={() => { setIsModalOpen(false); setEditingProduct(null); }} className="absolute top-4 right-4 text-text-muted hover:text-black cursor-pointer">
              <X size={24} />
            </button>
            <h2 className="text-xl font-bold mb-4">
              {editingProduct ? `Modifier "${editingProduct.nom}"` : 'Nouveau Produit'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nom du produit</label>
                <input required type="text" className="form-control" value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value})} />
              </div>
              <div className="flex gap-4">
                <div className="form-group flex-1">
                  <label>Prix d'Achat</label>
                  <div className="relative">
                    <input required type="number" placeholder="Ex: 1000" className="form-control pr-14" value={formData.prixAchat} onChange={e => setFormData({...formData, prixAchat: e.target.value})} />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-xs text-text-muted font-medium">{devise}</div>
                  </div>
                </div>
                <div className="form-group flex-1">
                  <label>Prix de Vente</label>
                  <div className="relative">
                    <input required type="number" placeholder="Ex: 1500" className="form-control pr-14" value={formData.prixVente} onChange={e => setFormData({...formData, prixVente: e.target.value})} />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-xs text-text-muted font-medium">{devise}</div>
                  </div>
                </div>
              </div>
              <div className="form-group bg-black/5 p-3 rounded-xl mb-4 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isFood"
                  className="w-5 h-5 accent-primary"
                  checked={formData.isFood}
                  onChange={e => setFormData({...formData, isFood: e.target.checked})}
                />
                <label htmlFor="isFood" className="!mb-0 text-sm cursor-pointer">
                  C'est un service ou prestation (Pas de stock à suivre)
                </label>
              </div>

              {!formData.isFood && (
                <div className="flex gap-4">
                  <div className="form-group flex-1">
                    <label>Quantité disponible</label>
                    <input required type="number" placeholder="Ex: 50" className="form-control" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} />
                  </div>
                  <div className="form-group flex-1">
                    <label>Alerte stock min.</label>
                    <input type="number" placeholder="Ex: 5" className="form-control" value={formData.stockMin} onChange={e => setFormData({...formData, stockMin: e.target.value})} />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>Catégorie (Famille)</label>
                <input type="text" placeholder="Ex: Boissons" className="form-control" value={formData.categorie} onChange={e => setFormData({...formData, categorie: e.target.value})} />
              </div>

              <button type="submit" className="btn btn-primary w-full mt-4 cursor-pointer">
                {editingProduct ? 'Enregistrer les modifications' : 'Ajouter ce produit'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal de confirmation de suppression */}
      <ConfirmModal
        isOpen={confirmDelete.open}
        title="Supprimer ce produit ?"
        message={`Voulez-vous vraiment supprimer "${confirmDelete.product?.nom}" ? Si ce produit a déjà été vendu, il sera simplement désactivé pour préserver l'historique.`}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        danger={true}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setConfirmDelete({ open: false, product: null })}
      />
    </div>
  );
};

export default Stock;
