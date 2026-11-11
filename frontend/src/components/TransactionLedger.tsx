import React, { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  X,
  Sparkles,
  FolderPlus,
  Minus,
  ArrowRightLeft,
  Check,
  Edit3,
} from 'lucide-react';
import { Transaction, Category, UserProfile } from '../types';
import { api } from '../services/api';
import {
  CurrencyMode,
  ExchangeRates,
  formatMoney,
  getCurrencySymbol,
  convertFromBrl,
  convertToBrl,
} from '../utils/currency';
import { parseFinancialText, ParsedFinancialEntry } from '../utils/smartParser';

interface TransactionLedgerProps {
  transactions: Transaction[];
  categories: Category[];
  users: UserProfile[];
  onRefresh: () => void;
  year: number;
  month: number;
  currency: CurrencyMode;
  rates: ExchangeRates;
}

const STANDARD_GROUPS = [
  'Despesas',
  'Lazer',
  'Mantimento',
  'Despesas com Carro',
  'Ganhos com a Oficina',
  'Renda & Ganhos',
  'Moradia & Contas',
];

export const TransactionLedger: React.FC<TransactionLedgerProps> = ({
  transactions,
  categories,
  users,
  onRefresh,
  year,
  month,
  currency,
  rates,
}) => {
  const [filterGroup, setFilterGroup] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [isSmartModalOpen, setIsSmartModalOpen] = useState<boolean>(false);
  const [isNewGroupModalOpen, setIsNewGroupModalOpen] = useState<boolean>(false);
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);

  // Smart Textarea state
  const [rawText, setRawText] = useState<string>('');
  const [customOverrides, setCustomOverrides] = useState<
    Record<string, { groupName?: string; type?: 'INCOME' | 'EXPENSE'; amount?: number }>
  >({});
  const [submittingBatch, setSubmittingBatch] = useState<boolean>(false);

  // New Custom Group state
  const [newGroupName, setNewGroupName] = useState<string>('');
  const [newGroupType, setNewGroupType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');

  // Inline Value Editing state
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editingAmountValue, setEditingAmountValue] = useState<string>('');

  const symbol = getCurrencySymbol(currency);

  // Combine DB categories and standard groups for dropdowns
  const availableGroups = useMemo(() => {
    const names = new Set<string>(STANDARD_GROUPS);
    categories.forEach((c) => names.add(c.name));
    return Array.from(names);
  }, [categories]);

  // Live parsed entries from the Smart Textarea
  const parsedEntries: ParsedFinancialEntry[] = useMemo(() => {
    const base = parseFinancialText(rawText);
    return base.map((item, idx) => {
      const key = `${idx}-${item.description}`;
      const override = customOverrides[key];
      return {
        ...item,
        id: key,
        groupName: override?.groupName ?? item.groupName,
        type: override?.type ?? item.type,
        amount: override?.amount ?? item.amount,
      };
    });
  }, [rawText, customOverrides]);

  // Save batch from Smart Textarea
  const handleSaveSmartBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedEntries.length === 0) return;

    try {
      setSubmittingBatch(true);
      const dueDate = `${year}-${month.toString().padStart(2, '0')}-15`;
      await api.createTransactionsBatch({
        items: parsedEntries.map((item) => ({
          description: item.description,
          // Convert from active display currency to base BRL if user typed in USD/EUR, or keep BRL
          amount: item.amount,
          type: item.type,
          groupName: item.groupName,
          status: 'PAID',
        })),
        dueDate,
        userId: users[0]?.id,
      });

      setRawText('');
      setCustomOverrides({});
      setIsSmartModalOpen(false);
      onRefresh();
    } catch (err) {
      console.error('Erro ao salvar lote:', err);
    } finally {
      setSubmittingBatch(false);
    }
  };

  // Create new custom group
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    try {
      await api.createCategory({
        name: newGroupName.trim(),
        type: newGroupType,
      });
      setNewGroupName('');
      setIsNewGroupModalOpen(false);
      onRefresh();
    } catch (err) {
      console.error('Failed to create group:', err);
    }
  };

  // Reallocate transaction to another group
  const handleChangeGroup = async (tx: Transaction, newGroupName: string) => {
    try {
      setLoadingActionId(tx.id);
      const targetCat = categories.find((c) => c.name === newGroupName);
      const isIncomeGroup =
        targetCat?.type === 'INCOME' ||
        newGroupName.toLowerCase().includes('ganho') ||
        newGroupName.toLowerCase().includes('renda') ||
        newGroupName.toLowerCase().includes('oficina');

      await api.updateTransaction(tx.id, {
        categoryName: newGroupName,
        type: isIncomeGroup ? 'INCOME' : tx.type,
      });
      onRefresh();
    } catch (err) {
      console.error('Failed to reallocate group:', err);
    } finally {
      setLoadingActionId(null);
    }
  };

  // Toggle Transaction Type (+ Acréscimo <-> - Decréscimo)
  const handleToggleType = async (tx: Transaction) => {
    try {
      setLoadingActionId(tx.id);
      const nextType = tx.type === 'INCOME' ? 'EXPENSE' : 'INCOME';
      await api.updateTransaction(tx.id, { type: nextType });
      onRefresh();
    } catch (err) {
      console.error('Failed to toggle transaction type:', err);
    } finally {
      setLoadingActionId(null);
    }
  };

  // Increase or Decrease Transaction Value by delta or direct edit
  const handleAdjustAmount = async (tx: Transaction, newAmountBrl: number) => {
    const clamped = Math.max(0.01, Number(newAmountBrl.toFixed(2)));
    try {
      setLoadingActionId(tx.id);
      await api.updateTransaction(tx.id, { amountDollars: clamped });
      onRefresh();
    } catch (err) {
      console.error('Failed to update amount:', err);
    } finally {
      setLoadingActionId(null);
    }
  };

  // Save inline edited amount
  const handleSaveInlineAmount = async (tx: Transaction) => {
    const parsed = parseFloat(editingAmountValue.replace(',', '.'));
    if (Number.isFinite(parsed) && parsed > 0) {
      // Convert from currently viewed currency back to base BRL
      const amountInBrl = convertToBrl(parsed, currency, rates);
      await handleAdjustAmount(tx, amountInBrl);
    }
    setEditingTxId(null);
  };

  const handleToggleStatus = async (tx: Transaction) => {
    try {
      setLoadingActionId(tx.id);
      await api.toggleTransactionStatus(tx.id);
      onRefresh();
    } catch (err) {
      console.error('Failed to toggle status:', err);
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setLoadingActionId(id);
      await api.deleteTransaction(id);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete transaction:', err);
    } finally {
      setLoadingActionId(null);
    }
  };

  // Filter transactions
  const filtered = transactions.filter((tx) => {
    if (filterGroup !== 'ALL' && tx.category?.name !== filterGroup) return false;
    if (filterType !== 'ALL' && tx.type !== filterType) return false;
    return true;
  });

  // Group transactions by Category Name for visual group cards
  const groupedTransactions = useMemo(() => {
    const map = new Map<string, { color: string; items: Transaction[]; netBrl: number }>();
    filtered.forEach((tx) => {
      const gName = tx.category?.name || 'Despesas';
      const current = map.get(gName) || {
        color: tx.category?.color || '#64748b',
        items: [],
        netBrl: 0,
      };
      current.items.push(tx);
      current.netBrl += tx.type === 'INCOME' ? tx.amountDollars : -tx.amountDollars;
      map.set(gName, current);
    });
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 shadow-sm space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-100 tracking-tight flex items-center gap-2">
            Gerenciador de Contas & Alocação por Grupos
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Mova itens entre grupos, aumente/diminua valores ou adicione lançamentos por texto livre
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* Group Filter */}
          <div className="flex items-center gap-1 bg-slate-950 rounded-xl px-2.5 py-1.5 border border-slate-800 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
              className="bg-transparent text-slate-300 font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">Todos os Grupos</option>
              {availableGroups.map((g) => (
                <option key={g} value={g} className="bg-slate-900">
                  {g}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1 bg-slate-950 rounded-xl px-2.5 py-1.5 border border-slate-800 text-xs">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-transparent text-slate-300 font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">Acréscimos & Decréscimos</option>
              <option value="INCOME" className="bg-slate-900">Apenas Acréscimos (+)</option>
              <option value="EXPENSE" className="bg-slate-900">Apenas Decréscimos (-)</option>
            </select>
          </div>

          {/* Create New Group Button */}
          <button
            onClick={() => setIsNewGroupModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition-all cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5 text-cyan-400" /> + Criar Grupo
          </button>

          {/* Smart Text Entry Modal Button */}
          <button
            onClick={() => setIsSmartModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Novo Lançamento no Banco
          </button>
        </div>
      </div>

      {/* Grouped Accounts Display */}
      {groupedTransactions.length === 0 ? (
        <div className="py-12 px-4 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/40">
          <Sparkles className="w-8 h-8 text-emerald-500/60 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-300">
            Nenhum lançamento registrado neste período
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Clique em <strong>"Novo Lançamento no Banco"</strong> acima e digite livremente suas contas e ganhos para que o sistema interprete e separe em grupos automaticamente.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedTransactions.map(([groupName, groupData]) => (
            <div
              key={groupName}
              className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden"
            >
              {/* Group Header Bar */}
              <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: groupData.color }}
                  />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Grupo: {groupName}
                  </h4>
                  <span className="text-[11px] text-slate-500 font-mono">
                    ({groupData.items.length} {groupData.items.length === 1 ? 'item' : 'itens'})
                  </span>
                </div>
                <div className="text-xs font-mono font-bold">
                  <span className={groupData.netBrl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    {groupData.netBrl >= 0 ? '+' : ''}
                    {formatMoney(groupData.netBrl, currency, 2, rates)}
                  </span>
                </div>
              </div>

              {/* Items inside Group */}
              <div className="divide-y divide-slate-800/60">
                {groupData.items.map((tx) => {
                  const displayedAmount = convertFromBrl(tx.amountDollars, currency, rates);
                  const isEditingThis = editingTxId === tx.id;

                  return (
                    <div
                      key={tx.id}
                      className="p-3 sm:px-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-900/40 transition-colors"
                    >
                      {/* Left: Type Toggle & Description */}
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleToggleType(tx)}
                          disabled={loadingActionId === tx.id}
                          title="Clique para inverter entre Acréscimo (+) e Decréscimo (-)"
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                            tx.type === 'INCOME'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                          }`}
                        >
                          {tx.type === 'INCOME' ? (
                            <>
                              <ArrowUpRight className="w-3.5 h-3.5" /> + Acréscimo
                            </>
                          ) : (
                            <>
                              <ArrowDownRight className="w-3.5 h-3.5" /> - Decréscimo
                            </>
                          )}
                        </button>

                        <div>
                          <p className="text-sm font-semibold text-slate-100">{tx.description}</p>
                          <span className="text-[10px] text-slate-500">
                            Responsável: {tx.user?.name || 'Família'}
                          </span>
                        </div>
                      </div>

                      {/* Right Controls: Group Reallocation Dropdown, Value Increase/Decrease, Status, Delete */}
                      <div className="flex items-center flex-wrap gap-2.5 justify-end">
                        {/* Group Reallocation Selector */}
                        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-xs">
                          <ArrowRightLeft className="w-3 h-3 text-cyan-400 shrink-0" />
                          <span className="text-[10px] text-slate-400">Grupo:</span>
                          <select
                            value={tx.category?.name || groupName}
                            onChange={(e) => handleChangeGroup(tx, e.target.value)}
                            disabled={loadingActionId === tx.id}
                            className="bg-transparent text-slate-200 font-semibold focus:outline-none cursor-pointer"
                          >
                            {availableGroups.map((g) => (
                              <option key={g} value={g} className="bg-slate-900 text-slate-100">
                                {g}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Status Toggle */}
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(tx)}
                          disabled={loadingActionId === tx.id}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                            tx.status === 'PAID'
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                          }`}
                        >
                          {tx.status === 'PAID' ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" /> Pago
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3" /> Pendente
                            </>
                          )}
                        </button>

                        {/* Value Controls: Decrease (-), Inline Value, Increase (+) */}
                        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5">
                          <button
                            type="button"
                            onClick={() => handleAdjustAmount(tx, Math.max(1, tx.amountDollars - 50))}
                            disabled={loadingActionId === tx.id}
                            title="Diminuir valor (-50 base)"
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>

                          {isEditingThis ? (
                            <div className="flex items-center px-1">
                              <input
                                type="number"
                                step="0.01"
                                value={editingAmountValue}
                                onChange={(e) => setEditingAmountValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveInlineAmount(tx);
                                  if (e.key === 'Escape') setEditingTxId(null);
                                }}
                                autoFocus
                                className="w-20 bg-slate-950 border border-emerald-500 rounded px-1.5 py-0.5 text-xs font-mono font-bold text-slate-100 text-right focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveInlineAmount(tx)}
                                className="p-1 text-emerald-400 hover:text-emerald-300 ml-1"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTxId(tx.id);
                                setEditingAmountValue(displayedAmount.toFixed(2));
                              }}
                              title="Clique para editar o valor exato"
                              className="px-2.5 py-1 font-mono font-bold text-xs flex items-center gap-1 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            >
                              <span
                                className={tx.type === 'INCOME' ? 'text-emerald-400' : 'text-slate-100'}
                              >
                                {tx.type === 'INCOME' ? '+' : '-'}
                                {formatMoney(tx.amountDollars, currency, 2, rates)}
                              </span>
                              <Edit3 className="w-2.5 h-2.5 text-slate-500" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleAdjustAmount(tx, tx.amountDollars + 50)}
                            disabled={loadingActionId === tx.id}
                            title="Aumentar valor (+50 base)"
                            className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => handleDelete(tx.id)}
                          disabled={loadingActionId === tx.id}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Smart Textarea ("Novo Lançamento no Banco") */}
      {isSmartModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
            <button
              onClick={() => setIsSmartModalOpen(false)}
              className="absolute top-5 right-5 p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-1">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">
                  Novo Lançamento Inteligente no Banco
                </h3>
                <p className="text-xs text-slate-400">
                  Escreva livremente um lançamento por linha. O sistema identifica se é ganho ou despesa e separa nos grupos.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveSmartBatch} className="mt-4 flex-1 flex flex-col overflow-hidden space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Caixa de Texto Inteligente (Um item por linha):
                </label>
                <textarea
                  rows={6}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={`Exemplo de como você pode digitar:\nSalário: +2.300\nFeira: 800\nBrinde 200\nBonus 144,75\nCarroceria do carro = 500`}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors resize-none leading-relaxed"
                />
              </div>

              {/* Live Recognition Preview */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                  <span>Itens Reconhecidos Automaticamente ({parsedEntries.length}):</span>
                  <span>Você pode ajustar o grupo ou tipo antes de salvar</span>
                </div>

                {parsedEntries.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-slate-950/50 border border-slate-800/80 text-center text-xs text-slate-500">
                    Digite acima (ex: <code>Feira: 800</code> ou <code>Bonus 144,75</code>) para ver a classificação automática em tempo real.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {parsedEntries.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          {/* Type Switcher Button */}
                          <button
                            type="button"
                            onClick={() =>
                              setCustomOverrides((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...prev[item.id],
                                  type: item.type === 'INCOME' ? 'EXPENSE' : 'INCOME',
                                },
                              }))
                            }
                            className={`px-2 py-1 rounded-lg font-bold text-[11px] cursor-pointer border ${
                              item.type === 'INCOME'
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                            }`}
                          >
                            {item.type === 'INCOME' ? '+ Acréscimo' : '- Decréscimo'}
                          </button>

                          <span className="font-bold text-slate-200">{item.description}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Group Selector */}
                          <select
                            value={item.groupName}
                            onChange={(e) =>
                              setCustomOverrides((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...prev[item.id],
                                  groupName: e.target.value,
                                },
                              }))
                            }
                            className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-cyan-300 font-semibold focus:outline-none cursor-pointer"
                          >
                            {availableGroups.map((g) => (
                              <option key={g} value={g} className="bg-slate-900 text-slate-100">
                                Grupo: {g}
                              </option>
                            ))}
                          </select>

                          {/* Amount Input */}
                          <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg px-2 py-1">
                            <span className="text-slate-400 font-mono mr-1">R$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={item.amount}
                              onChange={(e) =>
                                setCustomOverrides((prev) => ({
                                  ...prev,
                                  [item.id]: {
                                    ...prev[item.id],
                                    amount: Math.max(0, parseFloat(e.target.value) || 0),
                                  },
                                }))
                              }
                              className="w-20 bg-transparent text-right font-mono font-bold text-slate-100 focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSmartModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={parsedEntries.length === 0 || submittingBatch}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white shadow-lg shadow-emerald-600/20 cursor-pointer"
                >
                  {submittingBatch
                    ? 'Salvando...'
                    : `Salvar ${parsedEntries.length} Lançamento(s) no Banco`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Custom Group */}
      {isNewGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setIsNewGroupModalOpen(false)}
              className="absolute top-5 right-5 p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-bold text-slate-100 mb-1">Criar Novo Grupo</h3>
            <p className="text-xs text-slate-400 mb-4">
              Ex: "Ganhos com a Oficina", "Despesas com Carro", "Investimentos"
            </p>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nome do Grupo
                </label>
                <input
                  type="text"
                  placeholder="Ex: Ganhos com a Oficina"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Natureza Padrão do Grupo
                </label>
                <div className="flex bg-slate-950 rounded-xl p-1 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setNewGroupType('EXPENSE')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      newGroupType === 'EXPENSE'
                        ? 'bg-rose-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Decréscimo / Despesa (-)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewGroupType('INCOME')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      newGroupType === 'INCOME'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Acréscimo / Ganho (+)
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewGroupModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                >
                  Criar Grupo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
