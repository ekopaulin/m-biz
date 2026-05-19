import React, { useState, useEffect } from 'react';
import { Lock, User, Store, ArrowRight, KeyRound } from 'lucide-react';
import { db } from '../db';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';

const Auth = () => {
  const { hasCommerce, setHasCommerce, login, activeCommerceId } = useAppContext();
  
  // Registration state
  const [gerant, setGerant] = useState('');
  const [commerceName, setCommerceName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Shared state
  const [password, setPassword] = useState('');
  const [commerceData, setCommerceData] = useState(null);

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotGerant, setForgotGerant] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');

  useEffect(() => {
    if (hasCommerce && activeCommerceId) {
      db.commerces.get(activeCommerceId).then(data => {
        if (data) setCommerceData(data);
      });
    }
  }, [hasCommerce, activeCommerceId]);

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
      const newCommerceId = await db.commerces.add({
        nom: commerceName,
        gerant: gerant,
        password: password,
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

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!password) return;

    if (!commerceData?.password || commerceData.password === password) {
      login(activeCommerceId);
      toast.success('Bon retour !');
      if (!commerceData?.password) {
        await db.commerces.update(activeCommerceId, { password });
      }
    } else {
      toast.error('Mot de passe incorrect');
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!forgotGerant.trim()) {
      toast.error('Veuillez entrer votre nom');
      return;
    }
    if (newPassword.length < 4) {
      toast.error('Le nouveau mot de passe doit faire au moins 4 caractères');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      toast.error('Les deux mots de passe ne correspondent pas !');
      return;
    }

    // Find commerce matching this gerant name
    const commerce = await db.commerces.get(activeCommerceId);
    if (!commerce) {
      toast.error('Boutique introuvable');
      return;
    }

    const gerantMatch = commerce.gerant?.toLowerCase().trim() === forgotGerant.toLowerCase().trim();
    if (!gerantMatch) {
      toast.error('Le nom du gérant ne correspond pas. Vérifiez l\'orthographe.');
      return;
    }

    // Reset password
    await db.commerces.update(activeCommerceId, { password: newPassword });
    toast.success('Mot de passe réinitialisé ! Vous pouvez maintenant vous connecter.');
    setShowForgot(false);
    setForgotGerant('');
    setNewPassword('');
    setNewPasswordConfirm('');
  };

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
          {!hasCommerce ? (
            // Formulaire de Création (Onboarding)
            <form onSubmit={handleRegister} className="flex flex-col gap-4">
              <h2 className="text-xl font-bold mb-2 text-center">Créer votre espace</h2>
              
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                  <User size={18} />
                </div>
                <input 
                  type="text" 
                  placeholder="Votre nom (Gérant)" 
                  className="form-control pl-10"
                  value={gerant}
                  onChange={e => setGerant(e.target.value)}
                  required
                />
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                  <Store size={18} />
                </div>
                <input 
                  type="text" 
                  placeholder="Nom de la boutique" 
                  className="form-control pl-10"
                  value={commerceName}
                  onChange={e => setCommerceName(e.target.value)}
                  required
                />
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                  <Lock size={18} />
                </div>
                <input 
                  type="password" 
                  placeholder="Mot de passe (ou PIN)" 
                  className="form-control pl-10" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={4}
                />
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={18} className={confirmPassword ? (confirmPassword === password ? 'text-green-500' : 'text-red-400') : 'text-text-muted'} />
                </div>
                <input 
                  type="password" 
                  placeholder="Confirmer le mot de passe" 
                  className={`form-control pl-10 pr-8 transition-all ${
                    confirmPassword
                      ? confirmPassword === password
                        ? 'border-green-400 focus:border-green-500'
                        : 'border-red-400 focus:border-red-500'
                      : ''
                  }`}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  minLength={4}
                />
                {confirmPassword && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    {confirmPassword === password
                      ? <span className="text-green-500 text-sm font-bold">✓</span>
                      : <span className="text-red-400 text-sm font-bold">✗</span>}
                  </div>
                )}
              </div>
              {confirmPassword && confirmPassword !== password && (
                <p className="text-xs text-red-400 -mt-2 pl-1">Les mots de passe ne correspondent pas</p>
              )}

              <button type="submit" className="btn btn-primary w-full mt-2 !py-3">
                Commencer <ArrowRight size={18} />
              </button>
            </form>
          ) : showForgot ? (
            // Formulaire de réinitialisation de mot de passe
            <form onSubmit={handleForgotSubmit} className="flex flex-col gap-4">
              <div className="text-center mb-2">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-3">
                  <KeyRound size={24} className="text-primary" />
                </div>
                <h2 className="text-xl font-bold text-text-main">Réinitialiser</h2>
                <p className="text-sm text-text-muted mt-1">Entrez votre nom pour confirmer votre identité</p>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  placeholder="Votre nom (Gérant)"
                  className="form-control pl-10"
                  value={forgotGerant}
                  onChange={e => setForgotGerant(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  placeholder="Nouveau mot de passe"
                  className="form-control pl-10"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={4}
                />
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={18} className={newPasswordConfirm ? (newPasswordConfirm === newPassword ? 'text-green-500' : 'text-red-400') : 'text-text-muted'} />
                </div>
                <input
                  type="password"
                  placeholder="Confirmer le nouveau mot de passe"
                  className={`form-control pl-10 pr-8 transition-all ${
                    newPasswordConfirm
                      ? newPasswordConfirm === newPassword ? 'border-green-400' : 'border-red-400'
                      : ''
                  }`}
                  value={newPasswordConfirm}
                  onChange={e => setNewPasswordConfirm(e.target.value)}
                  required
                  minLength={4}
                />
                {newPasswordConfirm && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    {newPasswordConfirm === newPassword
                      ? <span className="text-green-500 text-sm font-bold">✓</span>
                      : <span className="text-red-400 text-sm font-bold">✗</span>}
                  </div>
                )}
              </div>

              <button type="submit" className="btn btn-primary w-full !py-3">
                Réinitialiser le mot de passe
              </button>
              <button type="button" onClick={() => setShowForgot(false)} className="text-sm text-text-muted text-center hover:text-text-main cursor-pointer">
                ← Retour à la connexion
              </button>
            </form>
          ) : (
            // Formulaire de Connexion (Login)
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="text-center mb-4">
                <h2 className="text-xl font-bold text-text-main">{commerceData?.nom || 'Votre Boutique'}</h2>
                <p className="text-sm text-text-muted">Entrez votre mot de passe pour accéder à la caisse</p>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                  <Lock size={18} />
                </div>
                <input 
                  type="password" 
                  placeholder="Mot de passe" 
                  className="form-control pl-10 text-center tracking-widest text-lg font-bold"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary w-full mt-2 !py-3">
                Déverrouiller
              </button>

              <button
                type="button"
                onClick={() => { setShowForgot(true); setPassword(''); }}
                className="text-xs text-text-muted text-center hover:text-primary cursor-pointer transition-colors"
              >
                J'ai oublié mon mot de passe
              </button>
            </form>
          )}
        </div>
        
        <p className="text-center text-xs text-text-muted mt-8">
          M-Biz fonctionne 100% hors-ligne. Vos données restent sur votre appareil.
        </p>

      </div>
    </div>
  );
};

export default Auth;
