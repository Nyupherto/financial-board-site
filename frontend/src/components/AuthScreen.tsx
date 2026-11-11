import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { api } from '../services/api';
import { UserProfile } from '../types';

interface AuthScreenProps {
  onSuccess: (user: UserProfile) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  const [tab, setTab] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regConfirmEmail, setRegConfirmEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

  // Status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password Requirements Validation
  const hasMinLength = regPassword.length >= 8;
  const hasUppercase = /[A-ZÀ-Ý]/.test(regPassword);
  const hasLowercase = /[a-zà-ý]/.test(regPassword);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(regPassword);
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasSpecialChar;
  const isEmailMatched =
    regEmail.trim().length > 0 &&
    regEmail.trim().toLowerCase() === regConfirmEmail.trim().toLowerCase();
  const isPasswordMatched = regPassword.length > 0 && regPassword === regConfirmPassword;

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!loginEmail || !loginPassword) {
      setError('Por favor, preencha seu email e senha.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.login(loginEmail, loginPassword);
      onSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Falha ao efetuar login. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Register
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!regName || !regEmail || !regConfirmEmail || !regPassword || !regConfirmPassword) {
      setError('Todos os campos são obrigatórios.');
      return;
    }

    if (!isEmailMatched) {
      setError('Os emails digitados não coincidem.');
      return;
    }

    if (!isPasswordValid) {
      setError('A senha ainda não atende a todos os requisitos de segurança.');
      return;
    }

    if (!isPasswordMatched) {
      setError('A confirmação de senha não coincide com a senha digitada.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.register({
        name: regName,
        email: regEmail,
        confirmEmail: regConfirmEmail,
        password: regPassword,
        confirmPassword: regConfirmPassword,
      });
      onSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Falha ao criar conta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Ambient lighting */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-gradient-to-tr from-emerald-600/15 via-teal-500/10 to-cyan-500/15 blur-[120px] pointer-events-none rounded-full" />

      <div className="w-full max-w-md relative z-10 bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-black text-xl">
            $
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">FamilyFinance</h1>
            <p className="text-xs text-slate-400">Gestão Financeira e Matemática Patrimonial</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-950 rounded-2xl p-1 border border-slate-800/80 mb-6">
          <button
            type="button"
            onClick={() => {
              setTab('LOGIN');
              setError(null);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              tab === 'LOGIN'
                ? 'bg-slate-800 text-slate-100 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Entrar na Conta
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('REGISTER');
              setError(null);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              tab === 'REGISTER'
                ? 'bg-slate-800 text-slate-100 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Criar Nova Conta
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab: LOGIN */}
        {tab === 'LOGIN' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  placeholder="seu.email@exemplo.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Senha</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5 cursor-pointer"
                  title={showLoginPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] font-bold text-sm text-white shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? 'Entrando...' : 'Entrar no Dashboard'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Tab: REGISTER */}
        {tab === 'REGISTER' && (
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nome Completo</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Seu nome"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Email and Confirm Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Confirmar Email</label>
                <input
                  type="email"
                  placeholder="Repita o email"
                  value={regConfirmEmail}
                  onChange={(e) => setRegConfirmEmail(e.target.value)}
                  required
                  className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none ${
                    regConfirmEmail && !isEmailMatched
                      ? 'border-rose-500/80'
                      : 'border-slate-800 focus:border-emerald-500'
                  }`}
                />
              </div>
            </div>

            {/* Password and Confirm Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Senha</label>
                <div className="relative">
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 pr-9 py-2 text-xs text-slate-100 font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                    title={showRegPassword ? 'Ocultar' : 'Mostrar'}
                  >
                    {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Confirmar Senha</label>
                <div className="relative">
                  <input
                    type={showRegConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    required
                    className={`w-full bg-slate-950 border rounded-xl px-3.5 pr-9 py-2 text-xs text-slate-100 font-mono placeholder-slate-500 focus:outline-none ${
                      regConfirmPassword && !isPasswordMatched
                        ? 'border-rose-500/80'
                        : 'border-slate-800 focus:border-emerald-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                    title={showRegConfirmPassword ? 'Ocultar' : 'Mostrar'}
                  >
                    {showRegConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Live Password Requirements Checklist */}
            <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800/80 space-y-1.5">
              <p className="text-[11px] font-semibold text-slate-400 mb-1">
                Requisitos de segurança da senha:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {hasMinLength ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <Circle className="w-3.5 h-3.5 shrink-0" />}
                  <span>Mínimo de 8 caracteres</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasUppercase ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {hasUppercase ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <Circle className="w-3.5 h-3.5 shrink-0" />}
                  <span>Uma letra maiúscula</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasLowercase ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {hasLowercase ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <Circle className="w-3.5 h-3.5 shrink-0" />}
                  <span>Uma letra minúscula</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasSpecialChar ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {hasSpecialChar ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <Circle className="w-3.5 h-3.5 shrink-0" />}
                  <span>Um caractere especial (@#$!)</span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !isPasswordValid || !isEmailMatched || !isPasswordMatched}
              className="w-full mt-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99] font-bold text-xs text-white shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? 'Registrando...' : 'Criar Conta'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        )}

        <div className="mt-6 pt-4 border-t border-slate-800/80 text-center text-xs text-slate-500">
          Banco de Dados SQLite Relacional • Até 5 Perfis Familiares
        </div>
      </div>
    </div>
  );
};
