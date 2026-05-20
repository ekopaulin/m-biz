import React, { useState, useEffect, useRef } from 'react';
import { Lock, User, Store, ArrowRight, KeyRound, ShieldAlert, ShieldCheck } from 'lucide-react';
import { db } from '../db';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';

// ─── Utilitaires de sécurité ─────────────────────────────────────────────────

/** Chiffre un mot de passe en SHA-256 (irréversible) */
const hashPassword = async (password) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/** Vérifie si une chaîne est déjà un hash SHA-256 (64 caractères hexadécimaux) */
const isHashed = (str) => /^[0-9a-f]{64}$/.test(str || '');

// ─────────────────────────────────────────────────────────────────────────────

const Auth = () => {
  const { hasCommerce, setHasCommerce, login, activeCommerceId, failedAttempts, lockUntil, recordFailedAttempt, MAX_ATTEMPTS } = useAppContext();

  // État inscription
  const [gerant,          setGerant]          = useState('');
  const [commerceName,    setCommerceName]    = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // État connexion
  const [password,     setPassword]     = useState('');
  const [commerceData, setCommerceData] = useState(null);

  // État changement de mot de passe
  const [showForgot,      setShowForgot]      = useState(false);
  const [oldPassword,     setOldPassword]     = useState('');
  const [newPassword,     setNewPassword]     = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');

  // Compte à rebours du blocage
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef(null);

  // Charger les données du commerce existant
  useEffect(() => {
    if (hasCommerce && activeCommerceId) {
      db.commerces.get(activeCommerceId).then(data => {
        if (data) setCommerceData(data);
      });
    }
  }, [hasCommerce, activeCommerceId]);

  // Gérer le compte à rebours du blocage
  useEffect(() => {
    if (!lockUntil) { setCountdown(0); return; }

    const tick = () => {
      const remaining = Math.ceil((lockUntil - Date.now()) / 1000);
      setCountdown(Math.max(0, remaining));
      if (remaining <= 0 && countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };

    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => clearInterval(countdownRef.current);
  }, [lockUntil]);

  const isLocked = lockUntil && Date.now() < lockUntil;

  // ─── Inscription ───────────────────────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!gerant || !commerceName || !password) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    if (password.length < 4) {
      toast.error('Le mot de passe doit faire au moins 4 caractères');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Les deux mots de passe ne correspondent pas !');
      return;
    }

    try {
      const hashedPwd = await hashPassword(password); // 🔐 Chiffrement
      const newCommerceId = await db.commerces.add({
        nom: commerceName,
        gerant: gerant,
        password: hashedPwd,
        type: 'Général',
        devise: 'FCFA',
        createdAt: new Date().toISOString()
      });
      setHasCommerce(true);
      login(newCommerceId);
      toast.success('Bienvenue sur M-Biz !');
    } catch (error) {
      toast.error('Erreur lors de la création du compte');
    }
  };

  // ─── Connexion ─────────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!password || isLocked) return;

    const storedPwd = commerceData?.password;

    // Cas 1 : Aucun mot de passe enregistré → premier démarrage, on le sauvegarde
    if (!storedPwd) {
      const hashedPwd = await hashPassword(password);
      await db.commerces.update(activeCommerceId, { password: hashedPwd });
      login(activeCommerceId);
      toast.success('Bon retour !');
      return;
    }

    // Cas 2 : Mot de passe en clair (ancienne version) → migration transparente
    if (!isHashed(storedPwd)) {
      if (storedPwd === password) {
        // ✅ Correct : on chiffre et on migre
        const hashedPwd = await hashPassword(password);
        await db.commerces.update(activeCommerceId, { password: hashedPwd });
        login(activeCommerceId);
        toast.success('Bon retour ! (Sécurité mise à jour 🔐)');
      } else {
        recordFailedAttempt();
        toast.error('Mot de passe incorrect');
        setPassword('');
      }
      return;
    }

    // Cas 3 : Mot de passe chiffré (version sécurisée)
    const inputHash = await hashPassword(password);
    if (inputHash === storedPwd) {
      login(activeCommerceId);
      toast.success('Bon retour !');
    } else {
      recordFailedAttempt();
      toast.error('Mot de passe incorrect');
      setPassword('');
    }
  };

  // ─── Changement de mot de passe (nécessite l'ancien) ──────────────────────
  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (newPassword.length < 4) {
      toast.error('Le nouveau mot de passe doit faire au moins 4 caractères');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      toast.error('Les deux nouveaux mots de passe ne correspondent pas !');
      return;
    }

    const commerce = await db.commerces.get(activeCommerceId);
    if (!commerce) { toast.error('Boutique introuvable'); return; }

    // Vérifier l'ancien mot de passe (avec gestion migration)
    const storedPwd = commerce.password;
    let oldIsValid = false;

    if (!storedPwd) {
      oldIsValid = true; // Pas de mot de passe défini
    } else if (!isHashed(storedPwd)) {
      oldIsValid = (storedPwd === oldPassword); // Plain text (legacy)
    } else {
      const oldHash = await hashPassword(oldPassword);
      oldIsValid = (oldHash === storedPwd);
    }

    if (!oldIsValid) {
      toast.error('L\'ancien mot de passe est incorrect !');
      return;
    }

    // Enregistrer le nouveau mot de passe chiffré
    const newHash = await hashPassword(newPassword);
    await db.commerces.update(activeCommerceId, { password: newHash });
    toast.success('Mot de passe modifié avec succès ! 🔐');
    setShowForgot(false);
    setOldPassword('');
    setNewPassword('');
    setNewPasswordConfirm('');
  };

  // ─── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gradient-to-br from-bg-light to-primary/10 w-full max-w-[480px] mx-auto shadow-2xl overflow-y-auto animate-[fadeIn_0.5s_ease-out]">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-white shadow-glass mb-4 overflow-hidden border-4 border-white">
            <img src="/logo_mbiz.jpg" alt="M-Biz Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-bold text-text-main tracking-tight">M-Biz</h1>
          <p className="text-text-muted mt-2">Gestion simplifiée pour votre commerce</p>
        </div>

        <div className="glass-card !p-8 shadow-2xl border-white/50">

          {/* ─── FORMULAIRE D'INSCRIPTION ─────────────────────────────────── */}
          {!hasCommerce ? (
            <form onSubmit={handleRegister} className="flex flex-col gap-4">
              <h2 className="text-xl font-bold mb-2 text-center">Créer votre espace</h2>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted"><User size={18} /></div>
                <input type="text" placeholder="Votre nom (Gérant)" className="form-control pl-10" value={gerant} onChange={e => setGerant(e.target.value)} required />
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted"><Store size={18} /></div>
                <input type="text" placeholder="Nom de la boutique" className="form-control pl-10" value={commerceName} onChange={e => setCommerceName(e.target.value)} required />
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted"><Lock size={18} /></div>
                <input type="password" placeholder="Mot de passe (min. 4 caractères)" className="form-control pl-10" value={password} onChange={e => setPassword(e.target.value)} required minLength={4} />
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={18} className={confirmPassword ? (confirmPassword === password ? 'text-green-500' : 'text-red-400') : 'text-text-muted'} />
                </div>
                <input
                  type="password" placeholder="Confirmer le mot de passe"
                  className={`form-control pl-10 pr-8 transition-all ${confirmPassword ? (confirmPassword === password ? 'border-green-400 focus:border-green-500' : 'border-red-400 focus:border-red-500') : ''}`}
                  value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={4}
                />
                {confirmPassword && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    {confirmPassword === password ? <span className="text-green-500 text-sm font-bold">✓</span> : <span className="text-red-400 text-sm font-bold">✗</span>}
                  </div>
                )}
              </div>
              {confirmPassword && confirmPassword !== password && (
                <p className="text-xs text-red-400 -mt-2 pl-1">Les mots de passe ne correspondent pas</p>
              )}

              <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 mt-1">
                <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Votre mot de passe sera chiffré et sécurisé sur votre appareil.</p>
              </div>

              <button type="submit" className="btn btn-primary w-full mt-2 !py-3">
                Commencer <ArrowRight size={18} />
              </button>
            </form>

          /* ─── CHANGEMENT DE MOT DE PASSE ──────────────────────────────── */
          ) : showForgot ? (
            <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
              <div className="text-center mb-2">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-3">
                  <KeyRound size={24} className="text-primary" />
                </div>
                <h2 className="text-xl font-bold text-text-main">Changer le mot de passe</h2>
                <p className="text-sm text-text-muted mt-1">Entrez votre ancien mot de passe pour confirmer</p>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted"><Lock size={18} /></div>
                <input type="password" placeholder="Ancien mot de passe" className="form-control pl-10" value={oldPassword} onChange={e => setOldPassword(e.target.value)} required autoFocus />
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted"><Lock size={18} /></div>
                <input type="password" placeholder="Nouveau mot de passe" className="form-control pl-10" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={4} />
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={18} className={newPasswordConfirm ? (newPasswordConfirm === newPassword ? 'text-green-500' : 'text-red-400') : 'text-text-muted'} />
                </div>
                <input
                  type="password" placeholder="Confirmer le nouveau mot de passe"
                  className={`form-control pl-10 pr-8 transition-all ${newPasswordConfirm ? (newPasswordConfirm === newPassword ? 'border-green-400' : 'border-red-400') : ''}`}
                  value={newPasswordConfirm} onChange={e => setNewPasswordConfirm(e.target.value)} required minLength={4}
                />
                {newPasswordConfirm && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    {newPasswordConfirm === newPassword ? <span className="text-green-500 text-sm font-bold">✓</span> : <span className="text-red-400 text-sm font-bold">✗</span>}
                  </div>
                )}
              </div>

              <button type="submit" className="btn btn-primary w-full !py-3">
                Enregistrer le nouveau mot de passe
              </button>
              <button type="button" onClick={() => setShowForgot(false)} className="text-sm text-text-muted text-center hover:text-text-main cursor-pointer">
                ← Retour à la connexion
              </button>
            </form>

          /* ─── FORMULAIRE DE CONNEXION ──────────────────────────────────── */
          ) : (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="text-center mb-4">
                <h2 className="text-xl font-bold text-text-main">{commerceData?.nom || 'Votre Boutique'}</h2>
                <p className="text-sm text-text-muted">Entrez votre mot de passe pour accéder à la caisse</p>
              </div>

              {/* ── Alerte de blocage ── */}
              {isLocked && (
                <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
                  <ShieldAlert size={20} className="text-red-500 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-red-700 dark:text-red-400">Trop de tentatives incorrectes</p>
                    <p className="text-xs text-red-600 dark:text-red-500">Réessayez dans <strong>{countdown}s</strong></p>
                  </div>
                </div>
              )}

              {/* ── Avertissement tentatives restantes ── */}
              {!isLocked && failedAttempts > 0 && (
                <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                  <ShieldAlert size={16} className="text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                    Mot de passe incorrect. Il vous reste <strong>{MAX_ATTEMPTS - failedAttempts}</strong> tentative(s) avant blocage.
                  </p>
                </div>
              )}

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted"><Lock size={18} /></div>
                <input
                  type="password" placeholder="Mot de passe"
                  className="form-control pl-10 text-center tracking-widest text-lg font-bold"
                  value={password} onChange={e => setPassword(e.target.value)}
                  required disabled={isLocked}
                />
              </div>

              <button type="submit" className={`btn btn-primary w-full mt-2 !py-3 ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={isLocked}>
                {isLocked ? `Bloqué (${countdown}s)` : 'Déverrouiller'}
              </button>

              <button
                type="button"
                onClick={() => { setShowForgot(true); setPassword(''); }}
                className="text-xs text-text-muted text-center hover:text-primary cursor-pointer transition-colors"
              >
                Changer mon mot de passe
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-text-muted mt-8">
          🔐 M-Biz fonctionne 100% hors-ligne. Vos données restent sur votre appareil.
        </p>

      </div>
    </div>
  );
};

export default Auth;
