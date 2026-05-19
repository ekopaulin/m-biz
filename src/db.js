import Dexie from 'dexie';

export const db = new Dexie('BoutikProDB');

db.version(1).stores({
  commerces: '++id, nom, type, devise, createdAt',
  produits: '++id, commerceId, nom, categorie, prixAchat, prixVente, stock, stockMin, actif',
  ventes: '++id, commerceId, date, totalVente, totalBenefice, modePaiement, statut',
  lignesVente: '++id, venteId, produitId, quantite, prixUnitaire, beneficeUnitaire',
  clients: '++id, commerceId, nom, telephone, createdAt',
  dettesClients: '++id, clientId, commerceId, montantInitial, montantRestant, date, statut, description',
  paiementsDettes: '++id, detteId, montant, date, note',
  fournisseurs: '++id, commerceId, nom, telephone, contact',
  approvisionn: '++id, fournisseurId, commerceId, produitId, quantite, prixUnitaire, date, aCredit, montantDu',
  tontines: '++id, commerceId, nom, montant, periodicite, prochainePaiement',
});

// Version 2 : Ajout du suivi des dépenses
db.version(2).stores({
  depenses: '++id, commerceId, date, description, montant'
});

// Version 3 : Ajout du suivi détaillé des versements de tontines
db.version(3).stores({
  versementsTontine: '++id, tontineId, date, montant'
});
