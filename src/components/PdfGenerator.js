import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Génère un rapport PDF complet incluant les ventes ET les dépenses
 * pour donner le bénéfice net réel sur la période.
 *
 * @param {object} commerce - Les données du commerce (nom, gerant)
 * @param {Array}  ventes   - Les ventes de la période
 * @param {string} periode  - Le libellé de la période (ex: "Ce mois-ci")
 * @param {Array}  depenses - Les dépenses de la période (optionnel)
 */
export const genererRapportMensuel = (commerce, ventes, periode, depenses = []) => {
  const doc = new jsPDF();

  const primaryColor = [100, 200, 160]; // Vert M-Biz
  const darkText = [30, 30, 40];
  const mutedText = [120, 120, 135];

  // --- EN-TÊTE ---
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 28, 'F');

  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(commerce.nom || 'M-Biz', 14, 13);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Gérant : ${commerce.gerant || '-'}  •  Rapport : ${periode}`, 14, 21);

  doc.setFontSize(8);
  doc.setTextColor(...mutedText);
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`, 14, 34);

  // --- RÉSUMÉ FINANCIER (grandes cases) ---
  const totalCA = ventes.reduce((sum, v) => sum + (v.totalVente || 0), 0);
  const totalBrut = ventes.reduce((sum, v) => sum + (v.totalBenefice || 0), 0);
  const totalDepenses = depenses.reduce((sum, d) => sum + (d.montant || 0), 0);
  const beneficeNet = totalBrut - totalDepenses;

  const boxY = 42;
  const boxes = [
    { label: 'Chiffre d\'Affaires', value: `${totalCA.toLocaleString('fr-FR')} FCFA`, color: [240, 248, 255] },
    { label: 'Bénéfice Brut', value: `${totalBrut.toLocaleString('fr-FR')} FCFA`, color: [240, 255, 248] },
    { label: 'Dépenses', value: `${totalDepenses.toLocaleString('fr-FR')} FCFA`, color: [255, 245, 245] },
    { label: 'Bénéfice Net', value: `${beneficeNet.toLocaleString('fr-FR')} FCFA`, color: beneficeNet >= 0 ? [235, 255, 245] : [255, 235, 235] },
  ];

  boxes.forEach((box, i) => {
    const x = 14 + i * 45.5;
    doc.setFillColor(...box.color);
    doc.roundedRect(x, boxY, 43, 20, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setTextColor(...mutedText);
    doc.setFont('helvetica', 'normal');
    doc.text(box.label, x + 4, boxY + 7);
    doc.setFontSize(9);
    doc.setTextColor(...darkText);
    doc.setFont('helvetica', 'bold');
    doc.text(box.value, x + 4, boxY + 15, { maxWidth: 38 });
  });

  // --- TABLEAU DES VENTES ---
  doc.setFontSize(11);
  doc.setTextColor(...darkText);
  doc.setFont('helvetica', 'bold');
  doc.text('Détail des Ventes', 14, boxY + 30);

  autoTable(doc, {
    startY: boxY + 34,
    head: [['Date', 'Mode Paiement', 'CA (FCFA)', 'Bénéfice (FCFA)']],
    body: ventes.length > 0
      ? ventes.map(v => [
          new Date(v.date).toLocaleDateString('fr-FR'),
          v.modePaiement || 'Cash',
          v.totalVente?.toLocaleString('fr-FR') || '0',
          v.totalBenefice?.toLocaleString('fr-FR') || '0',
        ])
      : [['—', '—', '—', '—']],
    foot: [['TOTAL', `${ventes.length} vente(s)`, totalCA.toLocaleString('fr-FR'), totalBrut.toLocaleString('fr-FR')]],
    theme: 'striped',
    headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    footStyles: { fillColor: [245, 245, 250], textColor: darkText, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: darkText },
    alternateRowStyles: { fillColor: [250, 252, 255] },
    margin: { left: 14, right: 14 },
  });

  // --- TABLEAU DES DÉPENSES (si présentes) ---
  if (depenses.length > 0) {
    const lastY = doc.lastAutoTable.finalY + 10;

    doc.setFontSize(11);
    doc.setTextColor(...darkText);
    doc.setFont('helvetica', 'bold');
    doc.text('Détail des Dépenses', 14, lastY);

    autoTable(doc, {
      startY: lastY + 4,
      head: [['Date', 'Description', 'Montant (FCFA)']],
      body: depenses.map(d => [
        new Date(d.date).toLocaleDateString('fr-FR'),
        d.description || '—',
        d.montant?.toLocaleString('fr-FR') || '0',
      ]),
      foot: [['TOTAL', `${depenses.length} dépense(s)`, totalDepenses.toLocaleString('fr-FR')]],
      theme: 'striped',
      headStyles: { fillColor: [220, 80, 80], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      footStyles: { fillColor: [255, 245, 245], textColor: [180, 40, 40], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: darkText },
      alternateRowStyles: { fillColor: [255, 250, 250] },
      margin: { left: 14, right: 14 },
    });
  }

  // --- PIED DE PAGE ---
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...mutedText);
    doc.text(
      `M-Biz Progrès — ${commerce.nom || 'Votre Boutique'} — Page ${i}/${pageCount}`,
      105,
      doc.internal.pageSize.height - 8,
      { align: 'center' }
    );
  }

  doc.save(`rapport-${(commerce.nom || 'M-Biz').replace(/\s+/g, '-')}-${periode.replace(/\s+/g, '-')}.pdf`);
};

/**
 * Génère un reçu au format PDF (Ticket Thermique 80mm)
 * pour une vente ou un bilan global de fin de journée.
 *
 * @param {object} commerce - Les données du commerce (nom)
 * @param {object} saleDetails - Les détails de la vente
 */
export const genererRecuPdf = (commerce, saleDetails) => {
  const itemCount = saleDetails.items.length;
  const baseHeight = 78; // Hauteur de base en mm (en-tête + totaux + pied)
  const itemHeight = 9; // Hauteur par article en mm
  const pageHeight = Math.max(105, baseHeight + itemCount * itemHeight);
  
  // Format ticket thermique : 80mm de large, hauteur dynamique
  const doc = new jsPDF({
    unit: 'mm',
    format: [80, pageHeight]
  });

  const primaryColor = [40, 180, 120]; // Vert M-Biz Pro
  const darkText = [30, 30, 40];
  const mutedText = [110, 110, 125];

  // --- EN-TÊTE ---
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 80, 18, 'F');

  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(commerce.nom || 'M-Biz Progrès', 40, 8, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(saleDetails.modePaiement === 'Crédit' ? 'TICKET DE DETTE' : 'TICKET DE CAISSE', 40, 13, { align: 'center' });

  // --- INFOS TRANSACTION ---
  let y = 25;
  doc.setFontSize(7.5);
  doc.setTextColor(...darkText);
  doc.setFont('helvetica', 'normal');
  
  const dateStr = new Date(saleDetails.date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).replace(',', ' à');

  doc.text(`Date : ${dateStr}`, 6, y);
  y += 4.5;
  doc.text(`Paiement : ${saleDetails.modePaiement}`, 6, y);
  y += 4.5;

  if (saleDetails.nomClient) {
    doc.text(`Client : ${saleDetails.nomClient}`, 6, y);
    y += 4.5;
  }

  // Ligne de séparation en pointillés
  doc.setLineWidth(0.25);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(5, y, 75, y);
  doc.setLineDashPattern([], 0); // Reset dash
  y += 5;

  // --- ARTICLES ---
  doc.setFont('helvetica', 'bold');
  doc.text('Articles', 6, y);
  doc.text('Total', 74, y, { align: 'right' });
  y += 4.5;

  doc.setFont('helvetica', 'normal');
  saleDetails.items.forEach(item => {
    // Nom article
    doc.setFont('helvetica', 'bold');
    doc.text(item.nom, 6, y);
    doc.setFont('helvetica', 'normal');
    // Quantité & Prix unitaire
    doc.text(`${item.quantite} x ${item.prixUnitaire.toLocaleString('fr-FR')} FCFA`, 6, y + 3.5);
    // Total ligne
    doc.setFont('helvetica', 'bold');
    doc.text(`${item.total.toLocaleString('fr-FR')} FCFA`, 74, y + 2, { align: 'right' });
    y += 8.5;
  });

  // Ligne de séparation
  y -= 2.5;
  doc.setLineWidth(0.25);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(5, y, 75, y);
  doc.setLineDashPattern([], 0); // Reset dash
  y += 5;

  // --- TOTAL ---
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL', 6, y);
  doc.setTextColor(...primaryColor);
  doc.text(`${saleDetails.totalVente.toLocaleString('fr-FR')} FCFA`, 74, y, { align: 'right' });
  doc.setTextColor(...darkText);
  y += 6.5;

  if (saleDetails.modePaiement === 'Crédit') {
    doc.setFontSize(8.5);
    doc.setTextColor(220, 80, 80);
    doc.text('STATUT : À PAYER', 40, y, { align: 'center' });
  } else {
    doc.setFontSize(8.5);
    doc.setTextColor(40, 160, 80);
    doc.text('STATUT : PAYÉ - MERCI !', 40, y, { align: 'center' });
  }
  doc.setTextColor(...darkText);
  y += 6.5;

  // Ligne de séparation
  doc.setLineWidth(0.25);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(5, y, 75, y);
  doc.setLineDashPattern([], 0); // Reset dash
  y += 5;

  // --- PIED DE PAGE ---
  doc.setFontSize(6.5);
  doc.setTextColor(...mutedText);
  doc.setFont('helvetica', 'italic');
  doc.text('Merci de votre confiance et à bientôt !', 40, y, { align: 'center' });
  y += 3.5;
  doc.text('Généré avec M-Biz Progrès 🚀', 40, y, { align: 'center' });

  // Sauvegarde
  const cleanShopName = (commerce.nom || 'M-Biz').replace(/\s+/g, '-');
  const timestamp = new Date(saleDetails.date).getTime();
  doc.save(`Recu-${cleanShopName}-${timestamp}.pdf`);
};

/**
 * Génère un Rapport de Solvabilité destiné aux banques et microfinances.
 * Ce rapport présente le profil financier du commerçant de manière professionnelle.
 *
 * @param {object} commerce   - Données du commerce
 * @param {Array}  ventes     - Toutes les ventes historiques
 * @param {Array}  depenses   - Toutes les dépenses historiques
 * @param {Array}  dettes     - Toutes les dettes clients
 * @param {Array}  produits   - Liste des produits (pour évaluation du stock)
 * @param {string} devise     - La devise choisie (ex: FCFA)
 */
export const genererRapportSolvabilite = (commerce, ventes, depenses, dettes, produits, devise = 'FCFA') => {
  const doc = new jsPDF();
  const blueColor   = [26, 86, 219];   // Bleu banque
  const darkText    = [20, 20, 35];
  const mutedText   = [110, 110, 130];
  const greenColor  = [22, 163, 74];
  const redColor    = [220, 38, 38];

  const fmt = (n) => (n || 0).toLocaleString('fr-FR');

  // ── 1. EN-TÊTE ────────────────────────────────────────────────────────────
  doc.setFillColor(...blueColor);
  doc.rect(0, 0, 210, 32, 'F');

  doc.setFontSize(7);
  doc.setTextColor(200, 215, 255);
  doc.setFont('helvetica', 'normal');
  doc.text('RAPPORT DE SOLVABILITÉ COMMERCIALE — CONFIDENTIEL', 14, 9);

  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(commerce.nom || 'Mon Commerce', 14, 21);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Gérant : ${commerce.gerant || '—'}`, 14, 28);

  doc.setFontSize(8);
  doc.setTextColor(...mutedText);
  doc.text(
    `Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} — via M-Biz Progrès`,
    14, 40
  );

  // ── 2. INDICATEURS CLÉS ──────────────────────────────────────────────────
  // Calculs globaux toutes périodes
  const totalVentes  = ventes.reduce((s, v) => s + (v.totalVente || 0), 0);
  const totalBrut    = ventes.reduce((s, v) => s + (v.totalBenefice || 0), 0);
  const totalDep     = depenses.reduce((s, d) => s + (d.montant || 0), 0);
  const beneficeNet  = totalBrut - totalDep;

  // Calculs 30 derniers jours
  const il30j = new Date(); il30j.setDate(il30j.getDate() - 30);
  const date30 = il30j.toISOString().split('T')[0];
  const v30 = ventes.filter(v => v.date >= date30);
  const d30 = depenses.filter(d => d.date >= date30);
  const ca30 = v30.reduce((s, v) => s + (v.totalVente || 0), 0);
  const dep30 = d30.reduce((s, d) => s + (d.montant || 0), 0);
  const ben30 = v30.reduce((s, v) => s + (v.totalBenefice || 0), 0) - dep30;

  // Calculs 90 derniers jours
  const il90j = new Date(); il90j.setDate(il90j.getDate() - 90);
  const date90 = il90j.toISOString().split('T')[0];
  const v90 = ventes.filter(v => v.date >= date90);
  const d90 = depenses.filter(d => d.date >= date90);
  const ca90 = v90.reduce((s, v) => s + (v.totalVente || 0), 0);
  const dep90 = d90.reduce((s, d) => s + (d.montant || 0), 0);
  const ben90 = v90.reduce((s, v) => s + (v.totalBenefice || 0), 0) - dep90;

  // Ventes journalières moyennes (30 j)
  const moyJournaliere = v30.length > 0 ? ca30 / 30 : 0;

  // Taux de marge brute
  const tauxMarge = totalVentes > 0 ? ((totalBrut / totalVentes) * 100).toFixed(1) : 0;

  // Valeur du stock
  const valeurStock = produits.reduce((s, p) => s + (p.stock || 0) * (p.prixAchat || 0), 0);

  // Dettes clients non soldées
  const dettesOuvertes = dettes.filter(d => d.statut !== 'payé' && d.statut !== 'soldé');
  const totalDettesOuvertes = dettesOuvertes.reduce((s, d) => s + (d.montant || 0), 0);
  const dettesRecouvrees = dettes.filter(d => d.statut === 'payé' || d.statut === 'soldé');
  const tauxRecouvrement = dettes.length > 0 ? ((dettesRecouvrees.length / dettes.length) * 100).toFixed(0) : 100;

  // Score de solvabilité simplifié (sur 100)
  let score = 50;
  if (ventes.length >= 30) score += 15;
  if (tauxMarge >= 15) score += 10;
  if (ben30 > 0) score += 10;
  if (Number(tauxRecouvrement) >= 70) score += 10;
  if (valeurStock > 0) score += 5;
  score = Math.min(score, 100);

  const scoreMention = score >= 85 ? 'EXCELLENT' : score >= 70 ? 'BON' : score >= 55 ? 'MOYEN' : 'INSUFFISANT';
  const scoreColor = score >= 85 ? greenColor : score >= 70 ? [37, 99, 235] : score >= 55 ? [234, 88, 12] : redColor;

  // ── 3. SCORE & RÉSUMÉ ──────────────────────────────────────────────────
  let y = 48;

  // Cadre score
  doc.setFillColor(245, 247, 255);
  doc.roundedRect(14, y, 182, 28, 3, 3, 'F');
  doc.setFillColor(...scoreColor);
  doc.roundedRect(14, y, 56, 28, 3, 3, 'F');

  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(`${score}/100`, 42, y + 13, { align: 'center' });
  doc.setFontSize(8);
  doc.text(scoreMention, 42, y + 21, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setTextColor(...darkText);
  doc.setFont('helvetica', 'bold');
  doc.text('Score de Fiabilité Commerciale', 76, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...mutedText);
  doc.text(`Basé sur ${ventes.length} transactions enregistrées`, 76, y + 14);
  doc.text(`Taux de marge : ${tauxMarge}%   •   Taux de recouvrement : ${tauxRecouvrement}%`, 76, y + 20);

  y += 36;

  // ── 4. TABLEAU DES INDICATEURS FINANCIERS ─────────────────────────────
  doc.setFontSize(11);
  doc.setTextColor(...darkText);
  doc.setFont('helvetica', 'bold');
  doc.text('Indicateurs Financiers', 14, y);
  y += 5;

  autoTable(doc, {
    startY: y,
    head: [['Indicateur', '30 derniers jours', '90 derniers jours', 'Total général']],
    body: [
      ['Entrées (Ventes)', `${fmt(ca30)} ${devise}`, `${fmt(ca90)} ${devise}`, `${fmt(totalVentes)} ${devise}`],
      ['Sorties (Dépenses)', `${fmt(dep30)} ${devise}`, `${fmt(dep90)} ${devise}`, `${fmt(totalDep)} ${devise}`],
      ['Bénéfice Net', `${fmt(ben30)} ${devise}`, `${fmt(ben90)} ${devise}`, `${fmt(beneficeNet)} ${devise}`],
      ['Nb. de transactions', `${v30.length}`, `${v90.length}`, `${ventes.length}`],
      ['Moyenne journalière', `${fmt(Math.round(moyJournaliere))} ${devise}`, '—', '—'],
    ],
    theme: 'striped',
    headStyles: { fillColor: blueColor, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: darkText },
    alternateRowStyles: { fillColor: [248, 250, 255] },
    margin: { left: 14, right: 14 },
  });

  y = doc.lastAutoTable.finalY + 10;

  // ── 5. GARANTIES & ACTIFS ──────────────────────────────────────────────
  doc.setFontSize(11);
  doc.setTextColor(...darkText);
  doc.setFont('helvetica', 'bold');
  doc.text('Garanties & Actifs', 14, y);
  y += 5;

  autoTable(doc, {
    startY: y,
    head: [['Élément', 'Détails', 'Valeur Estimée']],
    body: [
      ['Stock de Marchandises', `${produits.length} références en stock`, `${fmt(valeurStock)} ${devise}`],
      ['Créances Clients', `${dettesOuvertes.length} dettes en attente`, `${fmt(totalDettesOuvertes)} ${devise}`],
      ['Taux de recouvrement', `${dettesRecouvrees.length} dettes récupérées sur ${dettes.length}`, `${tauxRecouvrement}%`],
    ],
    theme: 'striped',
    headStyles: { fillColor: [30, 100, 60], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: darkText },
    alternateRowStyles: { fillColor: [248, 255, 250] },
    margin: { left: 14, right: 14 },
  });

  y = doc.lastAutoTable.finalY + 10;

  // ── 6. AVIS DE L'ANALYSTE AUTOMATIQUE ────────────────────────────────
  doc.setFillColor(245, 248, 255);
  doc.roundedRect(14, y, 182, 22, 3, 3, 'F');
  doc.setFontSize(9);
  doc.setTextColor(...blueColor);
  doc.setFont('helvetica', 'bold');
  doc.text('Avis Analytique Automatique', 20, y + 7);
  doc.setFontSize(8);
  doc.setTextColor(...darkText);
  doc.setFont('helvetica', 'normal');

  let avis = '';
  if (score >= 85) avis = `${commerce.nom || 'Ce commerce'} présente un profil financier excellent. L'activité est régulière, la marge est saine et la gestion des dettes clients est maîtrisée. Profil adapté à l'obtention d'un crédit.`;
  else if (score >= 70) avis = `${commerce.nom || 'Ce commerce'} présente un profil financier satisfaisant avec une activité régulière. Quelques axes d'amélioration possibles sur la marge ou le recouvrement.`;
  else if (score >= 55) avis = `${commerce.nom || 'Ce commerce'} est en développement. L'activité existe mais reste irrégulière. Une surveillance accrue est recommandée avant tout engagement financier.`;
  else avis = `Le profil financier de ${commerce.nom || 'ce commerce'} nécessite une vigilance particulière. Le volume de transactions est encore faible ou la rentabilité insuffisante.`;

  const lines = doc.splitTextToSize(avis, 170);
  doc.text(lines, 20, y + 14);

  y += 30;

  // ── 7. PIED DE PAGE ────────────────────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(6.5);
    doc.setTextColor(...mutedText);
    doc.text(
      `Document généré automatiquement par M-Biz Progrès — Ne pas modifier — ${commerce.nom || ''} — Page ${i}/${pageCount}`,
      105,
      doc.internal.pageSize.height - 8,
      { align: 'center' }
    );
  }

  doc.save(`rapport-solvabilite-${(commerce.nom || 'M-Biz').replace(/\s+/g, '-')}.pdf`);
};

