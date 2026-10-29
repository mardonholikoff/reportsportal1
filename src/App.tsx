/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './hooks/useAuth';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { storageService } from './services/storage';
import {
  Client,
  SummaryStats,
  DailyPlanItem,
  PlanActionType,
  FinancialMethodType,
  ProductItem,
} from './types';
import { LoginView } from './components/LoginView';
import { Navbar } from './components/Navbar';
import { StatsCards } from './components/StatsCards';
import { ClientTable } from './components/ClientTable';
import { ClientFormModal } from './components/ClientFormModal';
import { ClientDetailModal } from './components/ClientDetailModal';
import { QuickPaymentModal } from './components/QuickPaymentModal';
import { FirebaseSyncModal } from './components/FirebaseSyncModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { CreateDailyPlanModal, PlanSelectionItem } from './components/CreateDailyPlanModal';
import { ExecutePlanModal } from './components/ExecutePlanModal';
import { AgentDailyPlanTable } from './components/AgentDailyPlanTable';
import { AdminAgentPlansTable } from './components/AdminAgentPlansTable';
import { AdminDashboardAnalytics } from './components/AdminDashboardAnalytics';
import {
  CheckCircle2,
  Plus,
  ChevronDown,
  ChevronUp,
  BarChart3,
  CalendarCheck,
  Activity,
} from 'lucide-react';

export default function App() {
  const { user, isAuthenticated, isLoading, error, login, logout } = useAuth();
  const isOnline = useOnlineStatus();

  // Clients state
  const [clients, setClients] = useState<Client[]>(() => storageService.getClients());
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Daily plans state (24 soatlik rejalar)
  const [dailyPlans, setDailyPlans] = useState<DailyPlanItem[]>(() =>
    storageService.getActive24hPlans(user?.role === 'agent' ? user.username : undefined)
  );

  // Expandable sections state
  const [isTableOpen, setIsTableOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isAdminPlansOpen, setIsAdminPlansOpen] = useState(false);

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentClient, setPaymentClient] = useState<Client | null>(null);

  const [isFirebaseModalOpen, setIsFirebaseModalOpen] = useState(false);

  // Agent Daily Plan Modals
  const [isCreatePlanOpen, setIsCreatePlanOpen] = useState(false);
  const [executingPlanItem, setExecutingPlanItem] = useState<DailyPlanItem | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  const isAdmin = user?.role === 'admin';
  const isAgent = user?.role === 'agent';

  // Subscribe to storage changes
  useEffect(() => {
    const updateFromStorage = () => {
      setClients(storageService.getClients());
      setDailyPlans(
        storageService.getActive24hPlans(user?.role === 'agent' ? user.username : undefined)
      );
      setPendingSyncCount(storageService.getSyncQueue().length);
    };

    updateFromStorage();
    const unsubscribe = storageService.subscribe(updateFromStorage);
    return () => unsubscribe();
  }, [user]);

  // Compute KPI Summary Stats
  const stats: SummaryStats = useMemo(() => {
    let totalDebt = 0;
    let totalAdvance = 0;
    let totalProductsValue = 0;
    let debtorsCount = 0;
    let creditorsCount = 0;

    clients.forEach((c) => {
      totalDebt += c.currentDebt || 0;
      totalAdvance += c.currentAdvance || 0;
      if (c.currentDebt > 0) debtorsCount++;
      if (c.currentAdvance > 0) creditorsCount++;

      const prodSum = c.products.reduce(
        (sum, p) => sum + (p.totalPrice || p.quantity * p.unitPrice),
        0
      );
      totalProductsValue += prodSum;
    });

    return {
      totalClients: clients.length,
      totalDebt,
      totalAdvance,
      totalProductsValue,
      debtorsCount,
      creditorsCount,
    };
  }, [clients]);

  // Handle Save (Add or Edit) Client
  const handleSaveClient = (
    data: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'>
  ) => {
    const currentUsername = user?.username || 'adminc';
    if (editingClient) {
      storageService.updateClient(editingClient.id, data);
      showToast(`"${data.name}" ma'lumotlari yangilandi.`);
    } else {
      storageService.addClient(data, currentUsername);
      showToast(`Yangi mijoz "${data.name}" muvaffaqiyatli saqlandi! (${currentUsername})`);
    }
    setEditingClient(null);
    setIsFormModalOpen(false);
  };

  // Handle Delete Client
  const handleDeleteClient = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    storageService.deleteClient(clientId);
    showToast(client ? `"${client.name}" ro'yxatdan o'chirildi.` : "Mijoz o'chirildi.");
  };

  // Handle Quick Payment / Debt change
  const handleSavePayment = (
    clientId: string,
    newDebt: number,
    newAdvance: number,
    noteAddition: string
  ) => {
    const currentUsername = user?.username || 'adminc';
    const updated = storageService.updateDebtOrAdvance(
      clientId,
      newDebt,
      newAdvance,
      noteAddition,
      currentUsername
    );
    if (updated) {
      showToast(`Hisob-kitob yangilandi (${currentUsername}): ${noteAddition}`);
      if (selectedClient && selectedClient.id === clientId) {
        setSelectedClient(updated);
      }
    }
    setIsPaymentModalOpen(false);
  };

  // Handle Create Daily Plan (Agent selects clients with notes)
  const handleConfirmPlan = (selections: PlanSelectionItem[]) => {
    const currentUsername = user?.username || 'agentp1';
    const newItems = storageService.createDailyPlan(currentUsername, selections);
    setDailyPlans(storageService.getActive24hPlans(isAgent ? user?.username : undefined));
    showToast(`Bugun uchun ${newItems.length} ta mijoz rejaga kiritildi (24 soat amal qiladi).`);
  };

  // Handle Update Plan Note
  const handleUpdatePlanNote = (planItemId: string, note: string) => {
    storageService.updateDailyPlanNote(planItemId, note);
    setDailyPlans(storageService.getActive24hPlans(isAgent ? user?.username : undefined));
    showToast("Reja izohi yangilandi.");
  };

  // Handle Execute Daily Plan (Agent submits report)
  const handleSavePlanReport = (
    planItemId: string,
    report: {
      actionDone: PlanActionType;
      financialAction?: {
        method: FinancialMethodType;
        methodLabel: string;
        amount: number;
        currency?: string;
        note?: string;
      };
      productsDelivered?: ProductItem[];
      reportNote?: string;
    }
  ) => {
    const currentUsername = user?.username || 'agentp1';
    const result = storageService.executeDailyPlanItem(planItemId, currentUsername, report);
    if (result.success) {
      showToast(`Hisobot saqlandi: ${report.actionDone}. Mijoz balansi yangilandi.`);
      setDailyPlans(storageService.getActive24hPlans(isAgent ? user?.username : undefined));
      setClients(storageService.getClients());
    }
  };

  // Trigger Cloud Sync
  const handleTriggerSync = async () => {
    setIsSyncing(true);
    const res = await storageService.syncWithCloud();
    setIsSyncing(false);
    showToast(res.message);
    setPendingSyncCount(storageService.getSyncQueue().length);
  };

  // If not logged in, render the Login screen
  if (!isAuthenticated || !user) {
    return <LoginView onLogin={login} isLoading={isLoading} error={error} />;
  }

  return (
    <div className="min-h-screen bg-[#FAF7F7] flex flex-col selection:bg-rose-200">
      {/* Top Navbar */}
      <Navbar
        user={user}
        onLogout={logout}
        onOpenAddModal={() => {
          setEditingClient(null);
          setIsFormModalOpen(true);
        }}
        onOpenFirebaseModal={() => setIsFirebaseModalOpen(true)}
        onTriggerSync={handleTriggerSync}
        isSyncing={isSyncing}
        pendingSyncCount={pendingSyncCount}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* ========================================================= */}
        {/* 1. TAHLILIY JADVAL PANELI */}
        {/* ========================================================= */}
        <section className="bg-white rounded-3xl border border-rose-100 shadow-xs overflow-hidden transition-all duration-200">
          {/* Header Bar */}
          <div
            onClick={() => setIsTableOpen(!isTableOpen)}
            className="p-5 sm:p-6 flex items-center justify-between gap-4 cursor-pointer hover:bg-rose-50/30 transition select-none"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-rose-700 text-white font-bold font-display flex items-center justify-center text-base shadow-xs shrink-0">
                1
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold font-display text-neutral-900 tracking-tight">
                    1. Tahliliy jadval
                  </h2>
                  <span className="text-[11px] font-semibold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                    {clients.length} ta mijoz
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Mijozlar hisobi, berilgan tovarlar, qarz va haqdorlik monitoringi
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsTableOpen(!isTableOpen);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition min-h-[40px] cursor-pointer ${
                  isTableOpen
                    ? 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200'
                    : 'bg-rose-700 text-white hover:bg-rose-800 shadow-xs'
                }`}
              >
                {isTableOpen ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    <span>Yopish</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    <span>Ochish</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Expanded Content: Stats Cards + Full Table */}
          {isTableOpen && (
            <div className="p-5 sm:p-6 pt-0 border-t border-rose-100/70 space-y-5 animate-in fade-in duration-150">
              <div className="pt-4">
                {/* KPI Summary Cards: for agent debt/advance are hidden */}
                <StatsCards stats={stats} userRole={user.role} />

                {/* Section Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-lg font-bold font-display text-neutral-900">
                      Mijozlar va Hisob-kitoblar Jadvali
                    </h3>
                    <p className="text-xs text-neutral-500">
                      Topshirilgan mahsulotlar ro'yxati, joriy qarzdorlik va oldindan to'lovlar
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setEditingClient(null);
                      setIsFormModalOpen(true);
                    }}
                    className="self-start sm:self-auto flex items-center gap-2 bg-rose-700 hover:bg-rose-800 active:bg-rose-900 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all min-h-[44px] cursor-pointer"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>Yangi mijoz qo'shish</span>
                  </button>
                </div>

                {/* Interactive Client Table */}
                <ClientTable
                  clients={clients}
                  onOpenAddModal={() => {
                    setEditingClient(null);
                    setIsFormModalOpen(true);
                  }}
                  onViewClient={(client) => {
                    setSelectedClient(client);
                    setIsDetailModalOpen(true);
                  }}
                  onEditClient={(client) => {
                    setEditingClient(client);
                    setIsFormModalOpen(true);
                  }}
                  onDeleteClient={handleDeleteClient}
                  onQuickPayment={(client) => {
                    setPaymentClient(client);
                    setIsPaymentModalOpen(true);
                  }}
                />
              </div>
            </div>
          )}
        </section>

        {/* ========================================================= */}
        {/* AGENTP1 UCHUN: TAHLILIY JADVAL OSTIDA 24 SOATLIK KUNLIK REJA */}
        {/* ========================================================= */}
        {isAgent && (
          <AgentDailyPlanTable
            plans={dailyPlans}
            onOpenCreatePlan={() => setIsCreatePlanOpen(true)}
            onOpenExecuteModal={(item) => setExecutingPlanItem(item)}
            onUpdatePlanNote={handleUpdatePlanNote}
          />
        )}

        {/* ========================================================= */}
        {/* 2. TAHLILIY DASHBOARD (Faqat Admin uchun, agentp1 da yo'q) */}
        {/* ========================================================= */}
        {isAdmin && (
          <section className="bg-white rounded-3xl border border-rose-100 shadow-xs overflow-hidden transition-all duration-200">
            {/* Header Bar */}
            <div
              onClick={() => setIsDashboardOpen(!isDashboardOpen)}
              className="p-5 sm:p-6 flex items-center justify-between gap-4 cursor-pointer hover:bg-rose-50/30 transition select-none"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-700 text-white font-bold font-display flex items-center justify-center text-base shadow-xs shrink-0">
                  2
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold font-display text-neutral-900 tracking-tight">
                      2. Tahliliy dashboard
                    </h2>
                    <span className="text-[11px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                      6 ta tahlil moduli
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Mahsulotlar charti, qarzdorlik, haqdorlik, tashriflar, hududlar va mijozlar chuqur tahlili
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDashboardOpen(!isDashboardOpen);
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition min-h-[40px] cursor-pointer ${
                    isDashboardOpen
                      ? 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200'
                      : 'bg-rose-700 text-white hover:bg-rose-800 shadow-xs'
                  }`}
                >
                  {isDashboardOpen ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      <span>Yopish</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      <span>Ochish</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Expanded Content: 6 analytical modules each expandable with internal filters */}
            {isDashboardOpen && (
              <div className="p-5 sm:p-6 pt-0 border-t border-rose-100/70 animate-in fade-in duration-150">
                <div className="pt-4">
                  <AdminDashboardAnalytics clients={clients} dailyPlans={dailyPlans} />
                </div>
              </div>
            )}
          </section>
        )}

        {/* ========================================================= */}
        {/* 3. ADMIN UCHUN: AGENTLARNING KUNLIK REJALARI VA HISOBOTLARI (3 JADVAL) */}
        {/* ========================================================= */}
        {isAdmin && (
          <section className="bg-white rounded-3xl border border-rose-100 shadow-xs overflow-hidden transition-all duration-200">
            {/* Header Bar */}
            <div
              onClick={() => setIsAdminPlansOpen(!isAdminPlansOpen)}
              className="p-5 sm:p-6 flex items-center justify-between gap-4 cursor-pointer hover:bg-rose-50/30 transition select-none"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 font-bold font-display flex items-center justify-center text-base shrink-0">
                  3
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold font-display text-neutral-900 tracking-tight">
                      3. Agentlarning kunlik rejalari va hisobotlari
                    </h2>
                    <span className="text-[11px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                      Sinxron
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Agentlar (agentp1) tomonidan tuzilgan 24 soatlik rejalar, to'lovlar va topshirilgan tovarlar
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsAdminPlansOpen(!isAdminPlansOpen);
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition min-h-[40px] cursor-pointer ${
                    isAdminPlansOpen
                      ? 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200'
                      : 'bg-rose-700 text-white hover:bg-rose-800 shadow-xs'
                  }`}
                >
                  {isAdminPlansOpen ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      <span>Yopish</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      <span>Ochish</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Expanded Content: Real-time agent plans tracking */}
            {isAdminPlansOpen && (
              <div className="p-5 sm:p-6 pt-0 border-t border-rose-100/70 animate-in fade-in duration-150">
                <div className="pt-4">
                  <AdminAgentPlansTable plans={dailyPlans} />
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Floating Offline Notification */}
      <OfflineIndicator pendingCount={pendingSyncCount} />

      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-20 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl bg-neutral-900 text-white text-xs font-semibold shadow-xl border border-rose-500/20 animate-in fade-in slide-in-from-top-4 duration-200"
        >
          <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Add / Edit Client Modal */}
      <ClientFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingClient(null);
        }}
        onSave={handleSaveClient}
        editingClient={editingClient}
        currentUserUsername={user.username}
      />

      {/* Client Detail View & Printable Invoice Modal (With Logs) */}
      <ClientDetailModal
        client={selectedClient}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedClient(null);
        }}
        onEdit={(client) => {
          setIsDetailModalOpen(false);
          setEditingClient(client);
          setIsFormModalOpen(true);
        }}
        onDelete={(clientId) => {
          handleDeleteClient(clientId);
          setIsDetailModalOpen(false);
          setSelectedClient(null);
        }}
        onQuickPayment={(client) => {
          setPaymentClient(client);
          setIsPaymentModalOpen(true);
        }}
      />

      {/* Quick Payment / Debt Update Modal */}
      <QuickPaymentModal
        client={paymentClient}
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setPaymentClient(null);
        }}
        onSavePayment={handleSavePayment}
      />

      {/* Agent: Create Daily Plan Modal */}
      <CreateDailyPlanModal
        isOpen={isCreatePlanOpen}
        onClose={() => setIsCreatePlanOpen(false)}
        clients={clients}
        onConfirmPlan={handleConfirmPlan}
      />

      {/* Agent: Execute Daily Plan Report Modal */}
      <ExecutePlanModal
        planItem={executingPlanItem}
        isOpen={!!executingPlanItem}
        onClose={() => setExecutingPlanItem(null)}
        onSaveReport={handleSavePlanReport}
      />

      {/* Firebase Cloud Sync Configuration Modal */}
      <FirebaseSyncModal
        isOpen={isFirebaseModalOpen}
        onClose={() => setIsFirebaseModalOpen(false)}
        onSyncCompleted={() => {
          setClients(storageService.getClients());
          setDailyPlans(
            storageService.getActive24hPlans(user?.role === 'agent' ? user.username : undefined)
          );
          setPendingSyncCount(storageService.getSyncQueue().length);
        }}
      />
    </div>
  );
}
