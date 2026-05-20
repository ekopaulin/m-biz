import React, { useState } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Users, Wallet, ShoppingCart, Settings, X } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useAppContext } from '../context/AppContext';
import { genererRapportMensuel } from '../components/PdfGenerator';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import OnboardingModal from '../components/OnboardingModal';
import Loader from '../components/Loader';

const toLocalISOString = (d = new Date()) => {
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, -1);
};
const fmt = (n) => Number(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

const CustomTooltip = ({ active, payload, label, devise }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const ca = data.ca || 0;
    const depenses = data.depenses || 0;
    const benefice = ca - depenses;
    
    return (
      <div className="glass-card !p-3 border border-[rgba(255,255,255,0.5)] dark:border-[rgba(255,255,255,0.1)] rounded-xl shadow-xl text-xs font-semibold text-slate-800 dark:text-slate-100">
        <p className="text-slate-500 dark:text-slate-400 mb-2">{label}</p>
        <p className="flex justify-between gap-4 mb-1">
          <span>Entrées (Ventes) :</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">{fmt(ca)} {devise}</span>
        </p>
        <p className="flex justify-between gap-4 mb-2">
          <span>Sorties (Dépenses) :</span>
          <span className="font-bold text-red-500 dark:text-red-400">{fmt(depenses)} {devise}</span>
        </p>
        <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between gap-4">
          <span>Bénéfice Réel :</span>
          <span className={`font-bold ${benefice >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
            {fmt(benefice)} {devise}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

const Dashboard = () => {
  const { activeCommerceId, theme, toggleTheme, devise } = useAppContext();
  const [periode, setPeriode] = useState('7jours');
  const [selectedDate, setSelectedDate] = useState(toLocalISOString(new Date()).split('T')[0]);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printOption, setPrintOption] = useState('mois_en_cours');
  const [startDate, setStartDate] = useState(toLocalISOString(new Date()).split('T')[0]);
  const [endDate, setEndDate] = useState(toLocalISOString(new Date()).split('T')[0]);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [formDataExpense, setFormDataExpense] = useState({ description: '', montant: '', categorie: 'Divers' });
  const [isHistorySalesOpen, setIsHistorySalesOpen] = useState(false);
  const [isHistoryExpensesOpen, setIsHistoryExpensesOpen] = useState(false);
  const [confirmVente, setConfirmVente] = useState({ open: false, id: null, montant: 0 });
  const [confirmDepense, setConfirmDepense] = useState({ open: false, id: null, desc: '', montant: 0 });
  const [weeklyReport, setWeeklyReport] = useState(null);

  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('mbiz_onboarding_completed');
  });

  const handleCloseOnboarding = () => {
    localStorage.setItem('mbiz_onboarding_completed', 'true');
    setShowOnboarding(false);
  };

  const today = toLocalISOString(new Date()).split('T')[0];
  
  const commerce = useLiveQuery(
    () => db.commerces.get(activeCommerceId || 0),
    [activeCommerceId]
  );
  
  const toutesVentes = useLiveQuery(
    () => db.ventes.where('commerceId').equals(activeCommerceId || 0).toArray(),
    [activeCommerceId]
  );

  const toutesDepenses = useLiveQuery(
    () => db.depenses.where('commerceId').equals(activeCommerceId || 0).toArray(),
    [activeCommerceId]
  );

  const stockAlerts = useLiveQuery(
    () => db.produits.where('commerceId').equals(activeCommerceId || 0).filter(p => p.actif !== 0 && !p.isFood && p.stock <= (p.stockMin || 5)).count(),
    [activeCommerceId]
  );

  const dettesClients = useLiveQuery(
    () => db.dettesClients.where('commerceId').equals(activeCommerceId || 0).filter(d => d.statut !== 'soldé').toArray(),
    [activeCommerceId]
  );

  const salesWithDetails = useLiveQuery(
    async () => {
      if (!toutesVentes) return undefined;
      const sales = toutesVentes.filter(v => v.date.startsWith(selectedDate));
      return Promise.all(
        sales.map(async (v) => {
          const lines = await db.lignesVente.where('venteId').equals(v.id).toArray();
          const details = await Promise.all(
            lines.map(async (l) => {
              const prod = await db.produits.get(l.produitId);
              return `${l.quantite}x ${prod ? prod.nom : 'Produit'}`;
            })
          );
          return {
            ...v,
            itemsText: details.join(', ') || 'Vente directe'
          };
        })
      );
    },
    [toutesVentes, selectedDate]
  );

  // Rapport hebdomadaire automatique le dimanche
  React.useEffect(() => {
    const today = new Date();
    if (today.getDay() === 0 && toutesVentes && toutesVentes.length > 0) { // 0 = Dimanche
      const todayStr = toLocalISOString().split('T')[0];
      const lastReport = localStorage.getItem('mbiz_lastWeeklyReport');
      if (lastReport !== todayStr) {
        // Calculer les stats de la semaine passée (lundi à dimanche)
        const lastMonday = new Date(today);
        lastMonday.setDate(today.getDate() - 7);
        const lastSunday = new Date(today);
        lastSunday.setDate(today.getDate() - 1);
        const startW = lastMonday.toISOString().split('T')[0];
        const endW = lastSunday.toISOString().split('T')[0] + 'T23:59:59';
        const ventesS = toutesVentes.filter(v => v.date >= startW && v.date <= endW);
        const depensesS = toutesDepenses ? toutesDepenses.filter(d => d.date >= startW && d.date <= endW) : [];
        const caS = ventesS.reduce((s, v) => s + v.totalVente, 0);
        const benS = ventesS.reduce((s, v) => s + v.totalBenefice, 0);
        const depS = depensesS.reduce((s, d) => s + d.montant, 0);
        setWeeklyReport({ startW, endW: lastSunday.toISOString().split('T')[0], ca: caS, benefice: benS, depenses: depS, nbVentes: ventesS.length });
        localStorage.setItem('mbiz_lastWeeklyReport', todayStr);
      }
    }
  }, [toutesVentes, toutesDepenses]);

  // Vérification de l'état de chargement
  if (commerce === undefined || toutesVentes === undefined || toutesDepenses === undefined || stockAlerts === undefined || dettesClients === undefined || salesWithDetails === undefined) {
    return <Loader message="Chargement du tableau de bord..." />;
  }

  const dailySales = toutesVentes.filter(v => v.date.startsWith(selectedDate));
  const isTodaySelected = selectedDate === today;

  const beneficeDuJour = dailySales.reduce((sum, v) => sum + (v.totalBenefice || 0), 0);
  const caDuJour = dailySales.reduce((sum, v) => sum + (v.totalVente || 0), 0);
  const caBilan = dailySales.filter(v => (v.modePaiement || '').includes('Bilan')).reduce((sum, v) => sum + (v.totalVente || 0), 0);
  const caDirect = caDuJour - caBilan;

  const expensesDuJour = toutesDepenses.filter(e => e.date.startsWith(selectedDate));
  const totalExpensesDuJour = expensesDuJour.reduce((sum, e) => sum + (e.montant || 0), 0);

  const beneficeNet = beneficeDuJour - totalExpensesDuJour;

  const totalDettes = dettesClients.reduce((sum, d) => sum + parseFloat(d.montantRestant || 0), 0);
  const clientsEnAttente = new Set(dettesClients.map(d => d.clientId)).size;

  const handleAddExpense = async (e) => {
    e.preventDefault();
    await db.depenses.add({
      commerceId: activeCommerceId,
      date: `${selectedDate}T${new Date().toTimeString().substring(0, 5)}:00.000`,
      description: formDataExpense.description,
      montant: parseFloat(formDataExpense.montant),
      categorie: formDataExpense.categorie || 'Divers'
    });
    setIsExpenseModalOpen(false);
    setFormDataExpense({ description: '', montant: '', categorie: 'Divers' });
    toast.success("Dépense enregistrée !");
  };

  const doAnnulerVente = async () => {
    const { id: venteId } = confirmVente;
    const lines = await db.lignesVente.where('venteId').equals(venteId).toArray();
    for (const l of lines) {
      const p = await db.produits.get(l.produitId);
      if (p && !p.isFood) {
        await db.produits.update(l.produitId, { stock: (p.stock || 0) + l.quantite });
      }
    }
    await db.lignesVente.where('venteId').equals(venteId).delete();
    await db.ventes.delete(venteId);
    setConfirmVente({ open: false, id: null, montant: 0 });
    toast.success("Vente annulée et stock mis à jour !");
  };

  const doAnnulerDepense = async () => {
    await db.depenses.delete(confirmDepense.id);
    setConfirmDepense({ open: false, id: null, desc: '', montant: 0 });
    toast.success("Dépense supprimée !");
  };

  const handleConfirmExportPDF = async () => {
    const commerce = await db.commerces.get(activeCommerceId);
    let filteredVentes = [];
    let filteredDepenses = [];
    let label = '';
    let startStr = '';
    let endStr = '';

    if (printOption === 'mois_en_cours') {
      const start = new Date();
      start.setDate(1);
      startStr = start.toISOString().split('T')[0];
      endStr = today;
      label = `Ce mois-ci (${new Date().toLocaleString('fr-FR', { month: 'long', year: 'numeric' })})`;
    } else if (printOption === 'mois_dernier') {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      startStr = start.toISOString().split('T')[0];
      endStr = end.toISOString().split('T')[0];
      label = `Mois dernier (${start.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })})`;
    } else {
      startStr = startDate;
      endStr = endDate;
      label = `Période du ${new Date(startDate).toLocaleDateString('fr-FR')} au ${new Date(endDate).toLocaleDateString('fr-FR')}`;
    }

    filteredVentes = toutesVentes.filter(v => v.date >= startStr && v.date <= endStr + 'T23:59:59');
    filteredDepenses = toutesDepenses.filter(d => d.date >= startStr && d.date <= endStr + 'T23:59:59');

    genererRapportMensuel(commerce || { nom: 'M-Biz' }, filteredVentes, label, filteredDepenses);
    setIsPrintModalOpen(false);
  };


  const handleWhatsApp = () => {
    const dateLabel = isTodaySelected ? "du jour" : `du ${new Date(selectedDate).toLocaleDateString('fr-FR')}`;
    const text = `Résumé M-Biz ${dateLabel}:\n- Ventes: ${dailySales.length}\n- Total des Ventes: ${fmt(caDuJour)} ${devise}\n- Dépenses: ${fmt(totalExpensesDuJour)} ${devise}\n- Bénéfice Net: ${fmt(beneficeNet)} ${devise}\n\nDettes en attente: ${fmt(totalDettes)} ${devise}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Préparation données Recharts selon la période sélectionnée
  let chartData = [];
  
  if (periode === '7jours') {
    const dataMap = {};
    // Pré-remplir les 7 derniers jours avec 0
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = toLocalISOString(d).split('T')[0];
      dataMap[dateStr] = { ca: 0, depenses: 0 };
    }
    
    // Remplir avec les données réelles
    if (toutesVentes) {
      toutesVentes.forEach(v => {
        const day = v.date.split('T')[0];
        if (dataMap[day] !== undefined) {
          dataMap[day].ca += v.totalVente;
        }
      });
    }
    if (toutesDepenses) {
      toutesDepenses.forEach(d => {
        const day = d.date.split('T')[0];
        if (dataMap[day] !== undefined) {
          dataMap[day].depenses += d.montant;
        }
      });
    }
    
    chartData = Object.keys(dataMap).sort().map(day => ({
      name: day.split('-')[2] + '/' + day.split('-')[1],
      ca: dataMap[day].ca,
      depenses: dataMap[day].depenses
    }));

  } else if (periode === '4semaines') {
    const getWeekLabel = (date) => {
      const d = new Date(date);
      d.setHours(0,0,0,0);
      d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
      const week1 = new Date(d.getFullYear(), 0, 4);
      const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
      return `Sem. ${weekNum}`;
    };

    const weekLabels = [];
    const dataMap = {};
    // Pré-remplir les 4 dernières semaines
    for (let i = 3; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i * 7);
      const label = getWeekLabel(d);
      weekLabels.push(label);
      dataMap[label] = { ca: 0, depenses: 0 };
    }

    if (toutesVentes) {
      toutesVentes.forEach(v => {
        const label = getWeekLabel(v.date);
        if (dataMap[label] !== undefined) {
          dataMap[label].ca += v.totalVente;
        }
      });
    }
    if (toutesDepenses) {
      toutesDepenses.forEach(d => {
        const label = getWeekLabel(d.date);
        if (dataMap[label] !== undefined) {
          dataMap[label].depenses += d.montant;
        }
      });
    }

    chartData = weekLabels.map(label => ({
      name: label,
      ca: dataMap[label].ca,
      depenses: dataMap[label].depenses
    }));

  } else {
    const moisNoms = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const getMonthLabel = (date) => {
      const dateObj = new Date(date);
      return moisNoms[dateObj.getMonth()] + ' ' + String(dateObj.getFullYear()).substring(2);
    };

    const monthLabels = [];
    const dataMap = {};
    // Pré-remplir les 12 derniers mois
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const label = getMonthLabel(d);
      monthLabels.push(label);
      dataMap[label] = { ca: 0, depenses: 0 };
    }

    if (toutesVentes) {
      toutesVentes.forEach(v => {
        const label = getMonthLabel(v.date);
        if (dataMap[label] !== undefined) {
          dataMap[label].ca += v.totalVente;
        }
      });
    }
    if (toutesDepenses) {
      toutesDepenses.forEach(d => {
        const label = getMonthLabel(d.date);
        if (dataMap[label] !== undefined) {
          dataMap[label].depenses += d.montant;
        }
      });
    }

    chartData = monthLabels.map(label => ({
      name: label,
      ca: dataMap[label].ca,
      depenses: dataMap[label].depenses
    }));
  }

  const totalCaPeriode = chartData.reduce((sum, item) => sum + item.ca, 0);
  const totalDepensesPeriode = chartData.reduce((sum, item) => sum + item.depenses, 0);
  
  let phraseSante = "";
  let isPositiveHealth = true;
  if (totalCaPeriode > 0 || totalDepensesPeriode > 0) {
    if (totalCaPeriode > totalDepensesPeriode) {
      phraseSante = periode === '7jours' 
        ? "Ces 7 derniers jours, vos ventes sont supérieures à vos dépenses. C'est parfait ! ✓" 
        : periode === '4semaines' 
          ? "Ces 4 dernières semaines, vos ventes sont supérieures à vos dépenses. C'est parfait ! ✓" 
          : "Ces 12 derniers mois, vos ventes sont supérieures à vos dépenses. C'est parfait ! ✓";
      isPositiveHealth = true;
    } else if (totalCaPeriode < totalDepensesPeriode) {
      phraseSante = periode === '7jours'
        ? "Attention, vos dépenses dépassent vos ventes ces 7 derniers jours. ⚠"
        : periode === '4semaines'
          ? "Attention, vos dépenses dépassent vos ventes ces 4 dernières semaines. ⚠"
          : "Attention, vos dépenses dépassent vos ventes ces 12 derniers mois. ⚠";
      isPositiveHealth = false;
    } else {
      phraseSante = "Vos ventes et vos dépenses sont équilibrées sur cette période.";
      isPositiveHealth = null;
    }
  } else {
    phraseSante = "Pas encore d'activité enregistrée sur cette période.";
    isPositiveHealth = null;
  }

  return (
    <div className="page-container">
      <header className="mb-4 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold mb-1">
            {commerce?.gerant ? `Bonjour, ${commerce.gerant}` : commerce?.nom ? `Boutique ${commerce.nom}` : "Bonjour"}
          </h1>
          <p className="text-sm text-text-muted">
            {isTodaySelected ? "Vos chiffres d'aujourd'hui" : `Vos chiffres du ${new Date(selectedDate).toLocaleDateString('fr-FR')}`}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <button 
            onClick={toggleTheme} 
            className="btn bg-white/50 dark:bg-slate-800/50 shadow-sm border border-black/5 dark:border-white/5 !p-2.5 rounded-full text-text-muted text-lg cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-all"
            title={theme === 'dark' ? 'Mode Clair' : 'Mode Sombre'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <Link to="/parametres" className="btn bg-white/50 dark:bg-slate-800/50 shadow-sm border border-black/5 dark:border-white/5 !p-2.5 rounded-full text-text-muted text-lg cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-all" title="Configuration">
            <Settings size={20} />
          </Link>
        </div>
      </header>

      {/* Sélecteur de date minimaliste */}
      <div className="flex items-center gap-2 mb-4 pl-1">
        <span className="text-sm font-semibold text-text-muted">📅 Date :</span>
        <div className="relative flex items-center">
          <input 
            type="date" 
            className="bg-transparent border-none font-bold text-primary focus:outline-none cursor-pointer text-sm p-0 m-0"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
          />
          {selectedDate !== today && (
            <button 
              onClick={() => setSelectedDate(today)}
              className="ml-3 text-[10px] bg-primary/10 text-primary font-bold px-2 py-1 rounded-md hover:bg-primary/20 transition-all"
            >
              Aujourd'hui
            </button>
          )}
        </div>
      </div>

      {/* Bénéfice Net (Hero) */}
      <div className="glass-card bg-gradient-to-br from-emerald-500 to-emerald-700 dark:from-emerald-600 dark:to-teal-900 border-none shadow-xl text-white relative overflow-hidden rounded-3xl p-6 mb-6">
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-2xl"></div>
        <div className="absolute -left-8 -bottom-8 w-24 h-24 rounded-full bg-black/10 blur-xl"></div>
        
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <h3 className="text-xs font-semibold text-emerald-100 mb-1 opacity-90">
              {isTodaySelected ? "Bénéfice net du jour" : "Bénéfice net"}
            </h3>
            <p className="text-4xl font-black tracking-tight text-white mb-3">{fmt(beneficeNet)} <span className="text-xl font-bold opacity-80">{devise}</span></p>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[rgba(0,0,0,0.15)] backdrop-blur-md text-[11px] font-bold text-white border border-[rgba(255,255,255,0.1)]">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
              {dailySales.length} {isTodaySelected ? "ventes aujourd'hui" : "ventes"}
            </div>
          </div>
          <div className="w-12 h-12 bg-[rgba(255,255,255,0.2)] backdrop-blur-md rounded-2xl flex items-center justify-center border border-[rgba(255,255,255,0.2)] shadow-sm rotate-3">
            <TrendingUp size={24} className="text-white" strokeWidth={2.5} />
          </div>
        </div>
      </div>

      {/* Grille 2x2 compacte épurée */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Carte 1: Ventes */}
        <div className="glass-card !p-4 flex flex-col justify-between h-auto border border-[rgba(255,255,255,0.4)] dark:border-[rgba(255,255,255,0.05)] shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-inner">
              <ShoppingCart size={20} strokeWidth={2.5} />
            </div>
            <div className="text-right">
              <h3 className="text-[11px] font-bold text-text-muted mb-0.5 uppercase tracking-wide">Total Ventes</h3>
              <p className="text-xl font-black text-text-main truncate">
                {fmt(caDuJour)} <span className="text-xs font-bold text-text-muted">{devise}</span>
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-1 pt-3 border-t border-black/5 dark:border-white/5">
            <div className="flex-1 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg p-2 flex flex-col justify-center border border-emerald-500/10">
              <span className="text-[9px] uppercase tracking-wider font-bold text-emerald-600 dark:text-emerald-400 mb-0.5">Directes</span>
              <span className="font-bold text-sm text-text-main">{fmt(caDirect)} <span className="text-[9px] text-text-muted">{devise}</span></span>
            </div>
            <div className="flex-1 bg-blue-50 dark:bg-blue-500/10 rounded-lg p-2 flex flex-col justify-center border border-blue-500/10">
              <span className="text-[9px] uppercase tracking-wider font-bold text-blue-600 dark:text-blue-400 mb-0.5">Bilan soir</span>
              <span className="font-bold text-sm text-text-main">{fmt(caBilan)} <span className="text-[9px] text-text-muted">{devise}</span></span>
            </div>
          </div>
        </div>

        {/* Carte 2: Dépenses */}
        <div className="glass-card !p-4 flex flex-col justify-between h-28 border border-[rgba(255,255,255,0.4)] dark:border-[rgba(255,255,255,0.05)] shadow-sm relative group">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900 flex items-center justify-center text-red-500 dark:text-red-400">
              <TrendingDown size={20} strokeWidth={2} />
            </div>
          </div>
          <div>
            <h3 className="text-[11px] font-bold text-text-muted mb-0.5">Dépenses</h3>
            <p className="text-lg font-black text-text-main truncate">
              {fmt(totalExpensesDuJour)} <span className="text-xs font-bold text-text-muted">{devise}</span>
            </p>
          </div>
          <button 
            onClick={() => setIsExpenseModalOpen(true)}
            className="absolute top-3 right-3 bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-100 px-3 py-1.5 rounded-lg font-bold hover:bg-red-200 transition-all shadow-sm flex items-center justify-center"
            title="Saisir une dépense"
          >
            <span className="text-[10px] uppercase tracking-wide">Saisir</span>
          </button>
        </div>

        {/* Carte 3: Dettes */}
        <div className="glass-card !p-4 flex flex-col justify-between h-28 border border-[rgba(255,255,255,0.4)] dark:border-[rgba(255,255,255,0.05)] shadow-sm">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Users size={20} strokeWidth={2} />
            </div>
            {clientsEnAttente > 0 && (
              <span className="text-[10px] bg-amber-500 text-white font-bold px-2 py-0.5 rounded-md shadow-sm">
                {clientsEnAttente} clt
              </span>
            )}
          </div>
          <div>
            <h3 className="text-[11px] font-bold text-text-muted mb-0.5">Dettes clients</h3>
            <p className="text-lg font-black text-text-main truncate">
              {fmt(totalDettes)} <span className="text-xs font-bold text-text-muted">{devise}</span>
            </p>
          </div>
        </div>

        {/* Carte 4: Stock */}
        <div className="glass-card !p-4 flex flex-col justify-between h-28 border border-[rgba(255,255,255,0.4)] dark:border-[rgba(255,255,255,0.05)] shadow-sm">
          <div className="flex justify-between items-start">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stockAlerts > 0 ? 'bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300'}`}>
              <AlertTriangle size={20} strokeWidth={2} />
            </div>
            {stockAlerts > 0 && (
              <span className="text-[10px] bg-red-500 text-white font-bold px-2 py-0.5 rounded-md shadow-sm animate-pulse">
                Alerte
              </span>
            )}
          </div>
          <div>
            <h3 className="text-[11px] font-bold text-text-muted mb-0.5">Alertes stock</h3>
            <p className="text-lg font-black text-text-main truncate">
              {stockAlerts} <span className="text-xs font-bold text-text-muted">produits</span>
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-base font-bold">Mon Activité</h3>
          <select 
            className="bg-white border border-black/10 rounded-xl px-2 py-1 text-xs font-semibold focus:outline-none focus:border-primary text-text-main"
            value={periode}
            onChange={e => setPeriode(e.target.value)}
          >
            <option value="7jours">7 derniers jours</option>
            <option value="4semaines">4 dernières semaines</option>
            <option value="12mois">12 derniers mois</option>
          </select>
        </div>
        <div className="glass-card p-4 h-52 overflow-hidden">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="#767C8C" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#767C8C" fontSize={10} tickLine={false} axisLine={false} width={60} tickFormatter={(v) => fmt(v)} />
                <Tooltip content={<CustomTooltip devise={devise} />} />
                <Line type="monotone" dataKey="ca" stroke="#059669" strokeWidth={3} dot={{ r: 4, fill: '#059669' }} activeDot={{ r: 6 }} name="ca" />
                <Line type="monotone" dataKey="depenses" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: '#ef4444' }} strokeDasharray="4 2" activeDot={{ r: 5 }} name="depenses" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-text-muted">Pas assez de données</div>
          )}
          <div className="flex gap-4 justify-center mt-1">
            <span className="flex items-center gap-1 text-[10px] text-text-muted"><span className="w-4 h-0.5 bg-[#059669] inline-block rounded"></span>Ventes</span>
            <span className="flex items-center gap-1 text-[10px] text-text-muted"><span className="w-4 h-0.5 bg-red-500 inline-block rounded" style={{borderTop:'2px dashed #ef4444', background:'none'}}></span>Dépenses</span>
          </div>
        </div>

        {phraseSante && (
          <div className={`mt-2.5 p-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all shadow-sm ${
            isPositiveHealth === true
              ? 'bg-green-50 dark:bg-[#059669]/5 border-[#059669]/20 text-[#059669] dark:text-green-400'
              : isPositiveHealth === false
                ? 'bg-red-50 dark:bg-red-500/5 border-red-500/20 text-red-500 dark:text-red-400'
                : 'bg-bg-light border-black/5 text-text-muted'
          }`}>
            <span>{phraseSante}</span>
          </div>
        )}
      </div>

      {/* Historique des Ventes du jour (Déroulant) */}
      <div className="glass-card p-4 mb-4">
        <button 
          onClick={() => setIsHistorySalesOpen(!isHistorySalesOpen)}
          className="flex justify-between items-center w-full font-bold text-base text-text-main text-left"
        >
          <span>Ventes de la journée ({salesWithDetails.length})</span>
          <span>{isHistorySalesOpen ? '▲' : '▼'}</span>
        </button>
        {isHistorySalesOpen && (
          <div className="mt-4 flex flex-col gap-2 max-h-60 overflow-y-auto">
            {salesWithDetails.length === 0 ? (
              <div className="text-center py-4 text-sm text-text-muted">Aucune vente enregistrée pour ce jour.</div>
            ) : (
              salesWithDetails.map(s => (
                <div key={s.id} className="flex justify-between items-center p-2 bg-bg-light rounded-xl text-sm">
                  <div className="text-left flex-1 min-w-0 pr-2">
                    <p className="font-semibold text-text-main truncate">{s.itemsText}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-text-muted">
                        {new Date(s.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {String(s.modePaiement || '').includes('Bilan') ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600">
                          BILAN SOIR
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600">
                          VENTE DIR.
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-primary">{fmt(s.totalVente)} {devise}</span>
                    <button 
                      onClick={() => setConfirmVente({ open: true, id: s.id, montant: s.totalVente })}
                      className="text-red-500 p-1 bg-white border border-red-500/10 hover:bg-red-50 rounded-lg text-xs cursor-pointer"
                      title="Annuler la vente"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Historique des Dépenses du jour (Déroulant) */}
      <div className="glass-card p-4 mb-6">
        <button 
          onClick={() => setIsHistoryExpensesOpen(!isHistoryExpensesOpen)}
          className="flex justify-between items-center w-full font-bold text-base text-text-main text-left"
        >
          <span>Dépenses de la journée ({expensesDuJour.length})</span>
          <span>{isHistoryExpensesOpen ? '▲' : '▼'}</span>
        </button>
        {isHistoryExpensesOpen && (() => {
          // Définir la configuration des catégories
          const categoryConfig = {
            'Approvisionnement': { emoji: '📦', color: '#10b981', bgClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' },
            'Loyer / Factures': { emoji: '🏠', color: '#8b5cf6', bgClass: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20' },
            'Transport': { emoji: '🚗', color: '#3b82f6', bgClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20' },
            'Personnel': { emoji: '👥', color: '#f97316', bgClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20' },
            'Divers': { emoji: '⚙️', color: '#6b7280', bgClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20' }
          };

          // Calcul du récapitulatif par catégorie pour les dépenses du jour
          const recapExpensesParCategorie = Object.keys(categoryConfig).map(catName => {
            const expensesDeCetteCat = expensesDuJour.filter(e => (e.categorie || 'Divers') === catName);
            const totalCat = expensesDeCetteCat.reduce((sum, e) => sum + (e.montant || 0), 0);
            const pourcentage = totalExpensesDuJour > 0 ? Math.round((totalCat / totalExpensesDuJour) * 100) : 0;
            return {
              nom: catName,
              total: totalCat,
              pourcentage,
              config: categoryConfig[catName]
            };
          }).filter(item => item.total > 0)
            .sort((a, b) => b.total - a.total);

          return (
            <div className="mt-4 flex flex-col gap-4">
              {/* Visual breakdown by category */}
              {expensesDuJour.length > 0 && (
                <div className="p-3.5 bg-bg-light/60 rounded-2xl border border-black/5 dark:border-white/5">
                  <p className="text-xs font-bold text-text-muted mb-3 uppercase tracking-wider">Répartition par catégorie</p>
                  <div className="flex flex-col gap-2.5">
                    {recapExpensesParCategorie.map(item => (
                      <div key={item.nom} className="flex flex-col">
                        <div className="flex justify-between items-center text-xs font-semibold mb-1">
                          <span className="flex items-center gap-1.5">
                            <span>{item.config.emoji}</span>
                            <span className="text-text-main">{item.nom}</span>
                          </span>
                          <span className="text-text-muted">{fmt(item.total)} FCFA ({item.pourcentage}%)</span>
                        </div>
                        <div className="w-full bg-black/5 dark:bg-white/10 h-2 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-500" 
                            style={{ 
                              width: `${item.pourcentage}%`, 
                              backgroundColor: item.config.color 
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                {expensesDuJour.length === 0 ? (
                  <div className="text-center py-4 text-sm text-text-muted">Aucune dépense enregistrée pour ce jour.</div>
                ) : (
                  expensesDuJour.map(e => {
                    const cat = e.categorie || 'Divers';
                    const conf = categoryConfig[cat] || categoryConfig['Divers'];
                    return (
                      <div key={e.id} className="flex justify-between items-center p-2.5 bg-bg-light rounded-xl text-sm">
                        <div className="text-left flex-1 min-w-0 pr-2 flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold whitespace-nowrap flex items-center gap-1 ${conf.bgClass}`}>
                            <span>{conf.emoji}</span>
                            <span>{cat}</span>
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-text-main truncate">{e.description}</p>
                            <span className="text-xs text-text-muted">
                              {new Date(e.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-red-500 whitespace-nowrap">-{fmt(e.montant)} {devise}</span>
                          <button 
                            onClick={() => setConfirmDepense({ open: true, id: e.id, desc: e.description, montant: e.montant })}
                            className="text-red-500 p-1 bg-white border border-red-500/10 hover:bg-red-50 rounded-lg text-xs cursor-pointer"
                            title="Supprimer la dépense"
                          >
                            Effacer
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })()}
      </div>

      <div className="flex gap-2 pb-6">
        <button onClick={() => setIsPrintModalOpen(true)} className="btn bg-white shadow-sm border border-black/5 text-sm flex-1 !py-3 rounded-xl font-medium">
          Export PDF
        </button>
        <button onClick={handleWhatsApp} className="btn bg-[#25D366]/10 text-[#25D366] shadow-sm border border-[#25D366]/20 text-sm flex-1 !py-3 rounded-xl font-medium">
          Bilan WhatsApp
        </button>
      </div>

      {/* Modal Rapport Hebdomadaire (Dimanche) */}
      {weeklyReport && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-[fadeIn_0.3s_ease-out]">
          <div className="bg-bg-light rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-white/50">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">📊</div>
              <h2 className="text-xl font-bold text-text-main">Bilan de la semaine</h2>
              <p className="text-xs text-text-muted mt-1">Du {new Date(weeklyReport.startW).toLocaleDateString('fr-FR')} au {new Date(weeklyReport.endW).toLocaleDateString('fr-FR')}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-primary/10 rounded-xl p-3 text-center">
                <p className="text-[10px] uppercase font-bold text-text-muted mb-1">Total Ventes</p>
                <p className="font-bold text-primary text-base">{fmt(weeklyReport.ca)} {devise}</p>
              </div>
              <div className="bg-green-500/10 rounded-xl p-3 text-center">
                <p className="text-[10px] uppercase font-bold text-text-muted mb-1">Bénéfice</p>
                <p className="font-bold text-green-600 text-base">{fmt(weeklyReport.benefice)} {devise}</p>
              </div>
              <div className="bg-red-500/10 rounded-xl p-3 text-center">
                <p className="text-[10px] uppercase font-bold text-text-muted mb-1">Dépenses</p>
                <p className="font-bold text-red-500 text-base">{fmt(weeklyReport.depenses)} {devise}</p>
              </div>
              <div className="bg-black/5 rounded-xl p-3 text-center">
                <p className="text-[10px] uppercase font-bold text-text-muted mb-1">Ventes</p>
                <p className="font-bold text-text-main text-base">{weeklyReport.nbVentes} ventes</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  const text = `📊 *Bilan hebdomadaire M-Biz*\nDu ${new Date(weeklyReport.startW).toLocaleDateString('fr-FR')} au ${new Date(weeklyReport.endW).toLocaleDateString('fr-FR')}\n\n💰 Total Ventes : ${fmt(weeklyReport.ca)} ${devise}\n📈 Bénéfice : ${fmt(weeklyReport.benefice)} ${devise}\n💸 Dépenses : ${fmt(weeklyReport.depenses)} ${devise}\n🧾 Nombre de ventes : ${weeklyReport.nbVentes}\n\n_Généré avec M-Biz Progrès_ 🚀`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                }}
                className="btn w-full bg-[#25D366] text-white font-bold !py-3 rounded-xl flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12.031 2C6.49 2 2 6.48 2 12.01c0 1.84.5 3.56 1.36 5.05L2 22l5.12-1.34c1.44.78 3.08 1.22 4.81 1.22 5.54 0 10.03-4.48 10.03-10.01C21.96 6.48 17.57 2 12.03 2zm6.23 14.18c-.27.75-1.55 1.39-2.14 1.48-.52.08-1.19.14-3.41-.77-2.83-1.17-4.66-4.04-4.8-4.23-.14-.19-1.12-1.49-1.12-2.84 0-1.35.7-2.01.95-2.28.25-.27.55-.34.73-.34.18 0 .36 0 .52.01.17.01.4.01.62.53.22.53.77 1.88.84 2.01.07.13.11.29.02.46-.09.18-.18.29-.36.49-.18.21-.38.48-.54.65-.17.18-.35.38-.15.73.2.35.88 1.45 1.88 2.34 1.29 1.15 2.38 1.5 2.72 1.67.34.17.54.14.74-.08.2-.23.86-1 .99-1.35.13-.35.26-.29.44-.23.18.07 1.15.54 1.35.64.2.1.33.15.38.23.05.09.05.5-.22 1.25z"/></svg>
                Partager sur WhatsApp
              </button>
              <button onClick={() => setWeeklyReport(null)} className="btn w-full bg-black/5 text-text-muted font-semibold !py-2.5 rounded-xl">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'Impression PDF Intelligent */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-bg-light rounded-2xl w-full max-w-sm p-6 relative shadow-2xl text-text-main">
            <button onClick={() => setIsPrintModalOpen(false)} className="absolute top-4 right-4 text-text-muted hover:text-black">
              <X size={24} />
            </button>
            <h2 className="text-xl font-bold mb-4">Exporter le Rapport PDF</h2>
            
            <div className="flex flex-col gap-3 mb-6">
              <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-black/5 cursor-pointer">
                <input 
                  type="radio" 
                  name="printOption" 
                  checked={printOption === 'mois_en_cours'} 
                  onChange={() => setPrintOption('mois_en_cours')} 
                  className="accent-primary"
                />
                <div className="text-left">
                  <p className="font-semibold text-sm">Ce mois-ci</p>
                  <p className="text-xs text-text-muted">Bilan depuis le 1er du mois</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-black/5 cursor-pointer">
                <input 
                  type="radio" 
                  name="printOption" 
                  checked={printOption === 'mois_dernier'} 
                  onChange={() => setPrintOption('mois_dernier')} 
                  className="accent-primary"
                />
                <div className="text-left">
                  <p className="font-semibold text-sm">Le mois dernier</p>
                  <p className="text-xs text-text-muted">Tout le mois précédent</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-black/5 cursor-pointer">
                <input 
                  type="radio" 
                  name="printOption" 
                  checked={printOption === 'perso'} 
                  onChange={() => setPrintOption('perso')} 
                  className="accent-primary"
                />
                <div className="text-left">
                  <p className="font-semibold text-sm">Choisir des dates</p>
                  <p className="text-xs text-text-muted">Indiquer un intervalle personnalisé</p>
                </div>
              </label>
            </div>

            {printOption === 'perso' && (
              <div className="flex gap-2 mb-6">
                <div className="form-group flex-1">
                  <label className="text-xs font-semibold text-text-muted mb-1 block notranslate" translate="no">Date de début</label>
                  <input 
                    type="date" 
                    className="form-control text-xs" 
                    value={startDate} 
                    onChange={e => setStartDate(e.target.value)} 
                  />
                </div>
                <div className="form-group flex-1">
                  <label className="text-xs font-semibold text-text-muted mb-1 block notranslate" translate="no">Date de fin</label>
                  <input 
                    type="date" 
                    className="form-control text-xs" 
                    value={endDate} 
                    onChange={e => setEndDate(e.target.value)} 
                  />
                </div>
              </div>
            )}

            <button onClick={handleConfirmExportPDF} className="btn btn-primary w-full mt-2">
              Télécharger le Rapport
            </button>
          </div>
        </div>
      )}

      {/* Modal d'ajout de Dépense */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-bg-light rounded-2xl w-full max-w-sm p-6 relative shadow-2xl text-text-main text-left">
            <button onClick={() => setIsExpenseModalOpen(false)} className="absolute top-4 right-4 text-text-muted hover:text-black">
              <X size={24} />
            </button>
            <h2 className="text-xl font-bold mb-4">Nouvelle Dépense</h2>
            <form onSubmit={handleAddExpense}>
              <div className="form-group">
                <label>Pour quoi ? (Description)</label>
                <input 
                  required 
                  type="text" 
                  placeholder="Ex: Transport, Charbon, Loyer..." 
                  className="form-control" 
                  value={formDataExpense.description} 
                  onChange={e => setFormDataExpense({...formDataExpense, description: e.target.value})} 
                />
              </div>
              <div className="form-group">
                <label>Catégorie</label>
                <select 
                  className="form-control"
                  value={formDataExpense.categorie}
                  onChange={e => setFormDataExpense({...formDataExpense, categorie: e.target.value})}
                >
                  <option value="Approvisionnement">📦 Approvisionnement (Stock)</option>
                  <option value="Loyer / Factures">🏠 Loyer / Factures</option>
                  <option value="Transport">🚗 Transport</option>
                  <option value="Personnel">👥 Personnel</option>
                  <option value="Divers">⚙️ Divers (Autres)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Montant (FCFA)</label>
                <div className="relative">
                  <input 
                    required 
                    type="number" 
                    placeholder="Montant dépensé" 
                    className="form-control pr-12" 
                    value={formDataExpense.montant} 
                    onChange={e => setFormDataExpense({...formDataExpense, montant: e.target.value})} 
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-xs text-text-muted font-medium">FCFA</div>
                </div>
              </div>
              <button type="submit" className="btn btn-primary w-full mt-4">
                Enregistrer la dépense
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modals de confirmation élégants */}
      <ConfirmModal
        isOpen={confirmVente.open}
        title="Annuler cette vente ?"
        message={`Cette vente de ${fmt(confirmVente.montant)} FCFA sera supprimée et les produits seront remis en stock.`}
        confirmLabel="Oui, annuler"
        cancelLabel="Non, garder"
        danger={true}
        onConfirm={doAnnulerVente}
        onCancel={() => setConfirmVente({ open: false, id: null, montant: 0 })}
      />
      <ConfirmModal
        isOpen={confirmDepense.open}
        title="Supprimer cette dépense ?"
        message={`La dépense "${confirmDepense.desc}" de ${fmt(confirmDepense.montant)} FCFA sera définitivement effacée.`}
        confirmLabel="Oui, effacer"
        cancelLabel="Non, garder"
        danger={true}
        onConfirm={doAnnulerDepense}
      />

      <OnboardingModal 
        isOpen={showOnboarding} 
        onClose={handleCloseOnboarding} 
      />
    </div>
  );
};

export default Dashboard;
