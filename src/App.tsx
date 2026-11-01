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
  WarehouseProduct,
  DeliveryPaymentInfo,
  SystemLog,
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
import { AdminSystemLogsTable } from './components/AdminSystemLogsTable';
import { WarehouseIntakeModal } from './components/WarehouseIntakeModal';
import { WarehouseInventoryModal } from './components/WarehouseInventoryModal';
import { AgentWarehouseTable } from './components/AgentWarehouseTable';
import {
  addSystemLog,
  getLocalSystemLogs,
  subscribeToFirestoreData,
  bootstrapFirestoreData,
  syncClientToFirestore,
  deleteClientFromFirestore,
  syncPlanToFirestore,
  deletePlanFromFirestore,
  syncWarehouseProductToFirestore,
  deleteWarehouseProductFromFirestore,
} from './services/firebase';
import {
  CheckCircle2,
  Plus,
  ChevronDown,
  ChevronUp,
  BarChart3,
  CalendarCheck,
  PackagePlus,
  Warehouse,
  Users,
  ShieldAlert,
} from 'lucide-react';

export default function App() {
  const { user, isAuthenticated, isLoading, error, login, logout } = useAuth();
  const isOnline = useOnlineStatus();

  // Agent active navigation tab (tahlil agentlar uchun olib tashlangan)
  const [agentActiveTab, setAgentActiveTab] = useState<'reja' | 'mijozlar' | 'ombor'>('reja');

  // System audit logs state (adminc1 va adminlar nazorati)
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>(() => getLocalSystemLogs());

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
  const [isAgentWarehouseOpen, setIsAgentWarehouseOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isAdminPlansOpen, setIsAdminPlansOpen] = useState(false);
  const [isAdminLogsOpen, setIsAdminLogsOpen] = useState(true);

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

  // Warehouse state (Ombor zaxirasi)
  const [warehouseProducts, setWarehouseProducts] = useState<WarehouseProduct[]>(() =>
    storageService.getWarehouseProducts()
  );
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
  const [isWarehouseInventoryModalOpen, setIsWarehouseInventoryModalOpen] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  const isAdmin = user?.role === 'admin';
  const isAgent = user?.role === 'agent';

  // Save Warehouse Intake Product
  // Save Warehouse Intake Product
  const handleSaveWarehouseProduct = (
    data: Omit<WarehouseProduct, 'id' | 'createdAt'>
  ) => {
    const currentUsername = user?.username || 'adminc';
    const saved = storageService.addWarehouseProduct(data);
    setWarehouseProducts(storageService.getWarehouseProducts());
    syncWarehouseProductToFirestore(saved);
    addSystemLog({
      userId: currentUsername,
      userRole: user?.role || 'admin',
      actionType: 'ombor_kirimi',
      actionTitle: `Omborga yangi mahsulot kiritildi: ${saved.brand} - ${saved.name}`,
      details: `${saved.intakeQuantity} ${saved.intakeUnitType === 'package' ? saved.packageUnitName : saved.pieceUnitName} (${saved.totalSum?.toLocaleString('uz-UZ') || 0} so'm). Marka: ${saved.mark1 || ''}`,
    });
    showToast(
      `"${saved.brand} - ${saved.name}" omborga muvaffaqiyatli kiritildi! (${saved.intakeQuantity} ${saved.intakeUnitType === 'package' ? saved.packageUnitName : saved.pieceUnitName})`
    );
  };

  // Delete Warehouse Product
  const handleDeleteWarehouseProduct = (id: string) => {
    const currentUsername = user?.username || 'adminc';
    const target = warehouseProducts.find((w) => w.id === id);
    storageService.deleteWarehouseProduct(id);
    deleteWarehouseProductFromFirestore(id);
    setWarehouseProducts(storageService.getWarehouseProducts());
    addSystemLog({
      userId: currentUsername,
      userRole: user?.role || 'admin',
      actionType: 'ombor_ochirish',
      actionTitle: `Ombor mahsuloti o'chirildi`,
      details: target ? `${target.brand} - ${target.name} (ID: ${id})` : `ID: ${id}`,
    });
    showToast("Mahsulot ombor zaxirasidan o'chirildi.");
  };

  // Subscribe to storage changes & Firebase Firestore real-time sync
  useEffect(() => {
    // 1. Initial bootstrap to Firestore if remote is empty
    bootstrapFirestoreData(
      storageService.getClients(),
      storageService.getDailyPlans(),
      storageService.getWarehouseProducts()
    );

    // 2. Realtime listener to Firestore (automatic offline-persistence sync)
    const unsubFirestore = subscribeToFirestoreData({
      onClientsChange: (remoteClients) => {
        if (remoteClients && remoteClients.length > 0) {
          storageService.saveClients(remoteClients);
          setClients(remoteClients);
        }
      },
      onPlansChange: (remotePlans) => {
        if (remotePlans && remotePlans.length > 0) {
          storageService.saveDailyPlans(remotePlans);
          setDailyPlans(
            storageService.getActive24hPlans(user?.role === 'agent' ? user.username : undefined)
          );
        }
      },
      onWarehouseChange: (remoteProducts) => {
        if (remoteProducts && remoteProducts.length > 0) {
          storageService.saveWarehouseProducts(remoteProducts);
          setWarehouseProducts(remoteProducts);
        }
      },
      onLogsChange: (remoteLogs) => {
        if (remoteLogs && remoteLogs.length > 0) {
          setSystemLogs(remoteLogs);
        }
      },
    });

    const updateFromStorage = () => {
      setClients(storageService.getClients());
      setDailyPlans(
        storageService.getActive24hPlans(user?.role === 'agent' ? user.username : undefined)
      );
      setPendingSyncCount(storageService.getSyncQueue().length);
      setSystemLogs(getLocalSystemLogs());
    };

    updateFromStorage();
    const unsubscribe = storageService.subscribe(updateFromStorage);
    return () => {
      unsubscribe();
      unsubFirestore();
    };
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
      if (user?.role === 'agent' || currentUsername === 'agentp1' || currentUsername === 'agentc1') {
        showToast("Agentlar mijoz ma'lumotlarini tahrirlash huquqiga ega emas!");
        setEditingClient(null);
        setIsFormModalOpen(false);
        return;
      }
      storageService.updateClient(editingClient.id, data);
      const updated = storageService.getClientById(editingClient.id);
      if (updated) syncClientToFirestore(updated);
      addSystemLog({
        userId: currentUsername,
        userRole: user?.role || 'admin',
        actionType: 'mijoz_tahrirlash',
        actionTitle: `Mijoz ma'lumotlari tahrirlandi: ${data.name}`,
        details: `Telefon: ${data.phone}, Manzil: ${data.address || ''}, Qarz: ${data.currentDebt || 0} so'm`,
      });
      showToast(`"${data.name}" ma'lumotlari yangilandi.`);
    } else {
      const saved = storageService.addClient(data, currentUsername);
      syncClientToFirestore(saved);
      addSystemLog({
        userId: currentUsername,
        userRole: user?.role || 'admin',
        actionType: 'mijoz_yaratish',
        actionTitle: `Yangi mijoz qo'shildi: ${data.name}`,
        details: `Telefon: ${data.phone}, Manzil: ${data.address || ''}, Boshlang'ich qarz: ${data.currentDebt || 0} so'm`,
      });
      showToast(`Yangi mijoz "${data.name}" muvaffaqiyatli saqlandi! (${currentUsername})`);
    }
    setEditingClient(null);
    setIsFormModalOpen(false);
  };

  // Handle Delete Client (Faqat adminc va adminc1 huquqiga ega)
  const handleDeleteClient = (clientId: string) => {
    if (user?.username !== 'adminc' && user?.username !== 'adminc1') {
      showToast("Faqat adminc yoki adminc1 mijozni o'chirish huquqiga ega!");
      return;
    }

    const currentUsername = user?.username || 'adminc';
    const client = clients.find((c) => c.id === clientId);

    // 1. Delete client & cascade delete associated daily plans in local storage
    storageService.deleteClient(clientId);

    // 2. Delete client document from Firestore
    deleteClientFromFirestore(clientId);

    // 3. Delete any associated daily plans from Firestore
    const associatedPlans = dailyPlans.filter((p) => p.clientId === clientId);
    associatedPlans.forEach((p) => {
      deletePlanFromFirestore(p.id);
    });

    // 4. Update React states immediately
    setClients(storageService.getClients());
    setDailyPlans(
      storageService.getActive24hPlans(user?.role === 'agent' ? user.username : undefined)
    );

    // 5. Close any open detail or payment modal if this client was selected
    if (selectedClient?.id === clientId) {
      setSelectedClient(null);
      setIsDetailModalOpen(false);
    }
    if (paymentClient?.id === clientId) {
      setPaymentClient(null);
      setIsPaymentModalOpen(false);
    }
    if (editingClient?.id === clientId) {
      setEditingClient(null);
      setIsFormModalOpen(false);
    }

    // 6. Record audit log
    addSystemLog({
      userId: currentUsername,
      userRole: user?.role || 'admin',
      actionType: 'mijoz_ochirish',
      actionTitle: `Mijoz va unga oid barcha ma'lumotlar to'liq o'chirildi: ${client?.name || clientId}`,
      details: client
        ? `Nomi: ${client.name}, Telefon: ${client.phone}, Manzil: ${client.address || ''}, Qarz: ${client.currentDebt || 0} so'm, Bog'liq rejalar: ${associatedPlans.length} ta`
        : `ID: ${clientId}`,
    });

    showToast(
      client
        ? `"${client.name}" va unga oid barcha ma'lumotlar to'liq o'chirildi.`
        : "Mijoz va ma'lumotlari o'chirildi."
    );
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
      syncClientToFirestore(updated);
      addSystemLog({
        userId: currentUsername,
        userRole: user?.role || 'admin',
        actionType: 'tushum_qabul',
        actionTitle: `To'lov / Qarzdorlik o'zgartirildi: ${updated.name}`,
        details: `Yangi qarz: ${newDebt.toLocaleString('uz-UZ')} so'm, Yangi haqdorlik: ${newAdvance.toLocaleString('uz-UZ')} so'm. Izoh: ${noteAddition}`,
      });
      showToast(`Hisob-kitob yangilandi (${currentUsername}): ${noteAddition}`);
      if (selectedClient && selectedClient.id === clientId) {
        setSelectedClient(updated);
      }
    }
    setIsPaymentModalOpen(false);
  };

  // Handle Create Daily Plan (Agent selects clients with notes - works offline & online)
  const handleConfirmPlan = (selections: PlanSelectionItem[]) => {
    const currentUsername = user?.username || 'agentp1';
    const newItems = storageService.createDailyPlan(currentUsername, selections);
    setDailyPlans(storageService.getActive24hPlans(isAgent ? user?.username : undefined));
    newItems.forEach((item) => syncPlanToFirestore(item));
    addSystemLog({
      userId: currentUsername,
      userRole: 'agent',
      actionType: 'reja_tuzish',
      actionTitle: `Bugungi kunlik reja tuzildi (${newItems.length} ta mijoz)`,
      details: `Rejaga kiritilgan mijozlar: ${newItems.map((n) => n.clientName).join(', ')}`,
    });
    showToast(`Bugun uchun ${newItems.length} ta mijoz rejalashtirildi.`);
  };

  // Handle Update Plan Note
  const handleUpdatePlanNote = (planItemId: string, note: string) => {
    storageService.updateDailyPlanNote(planItemId, note);
    const updated = storageService.getDailyPlans().find((p) => p.id === planItemId);
    if (updated) syncPlanToFirestore(updated);
    setDailyPlans(storageService.getActive24hPlans(isAgent ? user?.username : undefined));
    showToast("Reja izohi yangilandi.");
  };

  // Handle Execute Daily Plan (Agent submits report - works offline & online)
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
      deliveryPayment?: DeliveryPaymentInfo;
      productsReturned?: Array<{
        productId: string;
        name: string;
        unit: string;
        quantity: number;
        unitPrice?: number;
        warehouseId?: string;
      }>;
      reportNote?: string;
    }
  ) => {
    const currentUsername = user?.username || 'agentp1';
    const targetPlan = dailyPlans.find((p) => p.id === planItemId);
    const result = storageService.executeDailyPlanItem(planItemId, currentUsername, report);
    if (result.success) {
      const updatedPlan = storageService.getDailyPlans().find((p) => p.id === planItemId);
      if (updatedPlan) syncPlanToFirestore(updatedPlan);

      if (targetPlan) {
        const updatedClient = storageService.getClientById(targetPlan.clientId);
        if (updatedClient) syncClientToFirestore(updatedClient);
      }

      // Add audit log
      let detailsText = `Mijoz: ${targetPlan?.clientName || ''}. Amal: ${report.actionDone}.`;
      if (report.financialAction && report.financialAction.amount > 0) {
        detailsText += ` Tushum: ${report.financialAction.amount.toLocaleString('uz-UZ')} ${report.financialAction.currency || "so'm"} (${report.financialAction.methodLabel}).`;
      }
      if (report.productsDelivered && report.productsDelivered.length > 0) {
        detailsText += ` Berilgan mahsulotlar: ${report.productsDelivered.map((p) => `${p.name} (${p.quantity} ${p.unit})`).join(', ')}.`;
      }
      if (report.productsReturned && report.productsReturned.length > 0) {
        detailsText += ` Qaytarilgan: ${report.productsReturned.map((p) => `${p.name} (${p.quantity} ${p.unit})`).join(', ')}.`;
      }

      addSystemLog({
        userId: currentUsername,
        userRole: 'agent',
        actionType: 'amal_bajarish',
        actionTitle: `Mijoz amali bajarildi: ${report.actionDone}`,
        details: detailsText,
      });

      showToast(`Hisobot saqlandi: ${report.actionDone}. Mijoz balansi yangilandi.`);
      setDailyPlans(storageService.getActive24hPlans(isAgent ? user?.username : undefined));
      setClients(storageService.getClients());
      setWarehouseProducts(storageService.getWarehouseProducts());
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

  // Handle Close Plan Item (Permanent lock for agent)
  const handleClosePlanItem = (planItemId: string) => {
    const currentUsername = user?.username || 'agentp1';
    const success = storageService.closeDailyPlanItem(planItemId, currentUsername);
    if (success) {
      const updatedPlan = storageService.getDailyPlans().find((p) => p.id === planItemId);
      if (updatedPlan) syncPlanToFirestore(updatedPlan);
      addSystemLog({
        userId: currentUsername,
        userRole: 'agent',
        actionType: 'amal_bajarish',
        actionTitle: `Mijoz rejasi yopildi`,
        details: `Reja ID: ${planItemId}. Agent tomonidan amallar yakunlandi.`,
      });
      showToast("Mijoz bo'yicha reja muvaffaqiyatli yopildi. Amallar yakunlandi.");
      setDailyPlans(storageService.getActive24hPlans(isAgent ? user?.username : undefined));
      setClients(storageService.getClients());
    }
  };

  // Login handler with audit log
  const handleLogin = async (u: string, p: string) => {
    const ok = await login(u, p);
    if (ok) {
      addSystemLog({
        userId: u.trim(),
        userRole: u.trim().startsWith('admin') ? 'admin' : 'agent',
        actionType: 'kirish',
        actionTitle: 'Tizimga muvaffaqiyatli kirildi',
        details: `${u.trim()} tizimga kirdi`,
      });
    }
    return ok;
  };

  // Logout handler with audit log
  const handleLogout = () => {
    if (user) {
      addSystemLog({
        userId: user.username,
        userRole: user.role,
        actionType: 'chiqish',
        actionTitle: 'Tizimdan chiqildi',
        details: `${user.username} (${user.name}) tizimdan chiqdi`,
      });
    }
    logout();
  };

  // If not logged in, render the Login screen
  if (!isAuthenticated || !user) {
    return <LoginView onLogin={handleLogin} isLoading={isLoading} error={error} />;
  }

  return (
    <div className="min-h-screen bg-[#FAF7F7] flex flex-col selection:bg-rose-200">
      {/* Top Navbar */}
      <Navbar
        user={user}
        onLogout={handleLogout}
        onOpenAddModal={() => {
          setEditingClient(null);
          setIsFormModalOpen(true);
        }}
        onOpenFirebaseModal={() => setIsFirebaseModalOpen(true)}
        onTriggerSync={handleTriggerSync}
        isSyncing={isSyncing}
        pendingSyncCount={pendingSyncCount}
        onOpenWarehouseModal={() => setIsWarehouseModalOpen(true)}
        onOpenWarehouseInventoryModal={() => setIsWarehouseInventoryModalOpen(true)}
        warehouseCount={warehouseProducts.length}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* ========================================================= */}
        {/* AGENT VIEW: SEGMENTED NAVIGATION & DEDICATED FULL VIEWS   */}
        {/* ========================================================= */}
        {isAgent && (
          <div className="space-y-4">
            {/* Top Segmented Navigation Tabs */}
            <div className="bg-white rounded-2xl p-1.5 border border-rose-100 shadow-xs flex items-center gap-1">
              <button
                type="button"
                onClick={() => setAgentActiveTab('reja')}
                className={`flex-1 py-2.5 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  agentActiveTab === 'reja'
                    ? 'bg-rose-700 text-white shadow-xs'
                    : 'text-neutral-700 hover:bg-rose-50/50'
                }`}
              >
                <CalendarCheck className="w-4 h-4 shrink-0" />
                <span>Reja</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    agentActiveTab === 'reja' ? 'bg-white text-rose-800' : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {dailyPlans.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAgentActiveTab('mijozlar')}
                className={`flex-1 py-2.5 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  agentActiveTab === 'mijozlar'
                    ? 'bg-rose-700 text-white shadow-xs'
                    : 'text-neutral-700 hover:bg-rose-50/50'
                }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>Mijozlar</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    agentActiveTab === 'mijozlar' ? 'bg-white text-rose-800' : 'bg-neutral-100 text-neutral-700'
                  }`}
                >
                  {clients.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAgentActiveTab('ombor')}
                className={`flex-1 py-2.5 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  agentActiveTab === 'ombor'
                    ? 'bg-rose-700 text-white shadow-xs'
                    : 'text-neutral-700 hover:bg-rose-50/50'
                }`}
              >
                <Warehouse className="w-4 h-4 shrink-0" />
                <span>Ombor</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    agentActiveTab === 'ombor' ? 'bg-white text-rose-800' : 'bg-neutral-100 text-neutral-700'
                  }`}
                >
                  {warehouseProducts.length}
                </span>
              </button>
            </div>

            {/* Tab 1: Bugungi kunlik reja */}
            {agentActiveTab === 'reja' && (
              <div className="animate-in fade-in duration-150">
                <AgentDailyPlanTable
                  plans={dailyPlans}
                  onOpenCreatePlan={() => setIsCreatePlanOpen(true)}
                  onOpenExecuteModal={(item) => setExecutingPlanItem(item)}
                  onUpdatePlanNote={handleUpdatePlanNote}
                  onClosePlanItem={handleClosePlanItem}
                />
              </div>
            )}

            {/* Tab 2: Mijozlar va hisob-kitoblar */}
            {agentActiveTab === 'mijozlar' && (
              <div className="bg-white rounded-3xl border border-rose-100 shadow-xs p-4 sm:p-6 space-y-4 animate-in fade-in duration-150">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-rose-100/70">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold font-display text-neutral-900 tracking-tight">
                      Mijozlar va hisob-kitoblar
                    </h2>
                    <p className="text-xs text-neutral-500">
                      Barcha mijozlar bazasi va ularning ma'lumotlari
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingClient(null);
                      setIsFormModalOpen(true);
                    }}
                    className="self-start sm:self-auto flex items-center gap-2 bg-rose-700 hover:bg-rose-800 active:bg-rose-900 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all min-h-[42px] cursor-pointer"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>Yangi mijoz qo'shish</span>
                  </button>
                </div>

                <StatsCards stats={stats} userRole={user.role} />

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
                  userRole={user.role}
                  currentUsername={user.username}
                />
              </div>
            )}

            {/* Tab 3: 2. Ombor jadvali */}
            {agentActiveTab === 'ombor' && (
              <div className="bg-white rounded-3xl border border-rose-100 shadow-xs p-4 sm:p-6 space-y-4 animate-in fade-in duration-150">
                <div className="pb-3 border-b border-rose-100/70 flex items-center justify-between">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold font-display text-neutral-900 tracking-tight">
                      2. Ombor jadvali
                    </h2>
                    <p className="text-xs text-neutral-500">
                      Ombordagi mavjud mahsulotlar qoldig'i (faqat miqdori)
                    </p>
                  </div>
                  <span className="text-xs font-bold text-rose-800 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                    {warehouseProducts.length} xil mahsulot
                  </span>
                </div>

                <AgentWarehouseTable products={warehouseProducts} />
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* ADMIN VIEW: ACCORDION SECTIONS (1. JADVAL, 2. TAHLIL, 3. REJALAR) */}
        {/* ========================================================= */}
        {isAdmin && (
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
                  <StatsCards stats={stats} userRole={user.role} />

                  {/* Section Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div>
                      <h3 className="text-lg font-bold font-display text-neutral-900">
                        Mijozlar va Hisob-kitoblar Jadvali
                      </h3>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                      <button
                        onClick={() => setIsWarehouseModalOpen(true)}
                        className="self-start sm:self-auto flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 active:bg-black text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all min-h-[44px] cursor-pointer"
                        title="Omborga mahsulotlar kiritish"
                      >
                        <PackagePlus className="w-4 h-4 stroke-[2.2] text-rose-400" />
                        <span>Omborga mahsulotlar kiritish</span>
                      </button>

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
                    onEditClient={() => {
                      showToast("Agentlar mijoz ma'lumotlarini tahrirlash huquqiga ega emas!");
                    }}
                    onDeleteClient={handleDeleteClient}
                    onQuickPayment={(client) => {
                      setPaymentClient(client);
                      setIsPaymentModalOpen(true);
                    }}
                    userRole={user.role}
                    currentUsername={user.username}
                  />
                </div>
              </div>
            )}
          </section>
        )}

        {/* ========================================================= */}
        {/* 2. TAHLILIY AMALLAR (Faqat Admin uchun, agentp1 da yo'q) */}
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
                      2. Tahliliy amallar
                    </h2>
                    <span className="text-[11px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                      4 ta tahlil bloki
                    </span>
                  </div>
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

            {/* Expanded Content: 1, 2 va 3-bloklar with black-bordered excel exports */}
            {isDashboardOpen && (
              <div className="p-5 sm:p-6 pt-0 border-t border-rose-100/70 animate-in fade-in duration-150">
                <div className="pt-4">
                  <AdminDashboardAnalytics
                    warehouseProducts={warehouseProducts}
                    clients={clients}
                    dailyPlans={dailyPlans}
                  />
                </div>
              </div>
            )}
          </section>
        )}

        {/* ========================================================= */}
        {/* 3. ADMIN UCHUN: AGENTLAR REJASI VA HISOBOTLARI (3 JADVAL) */}
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
                      3. Agentlar rejasi va hisobotlari
                    </h2>
                    <span className="text-[11px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                      Sinxron
                    </span>
                  </div>
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

        {/* ========================================================= */}
        {/* 4. TIZIM AMALLARI VA AUDIT LOGLARI (FAQAT ADMINC1 ORQALI) */}
        {/* ========================================================= */}
        {user.username === 'adminc1' && (
          <section className="bg-white rounded-3xl border border-rose-100 shadow-xs overflow-hidden transition-all duration-200">
            {/* Header Bar */}
            <div
              onClick={() => setIsAdminLogsOpen(!isAdminLogsOpen)}
              className="p-5 sm:p-6 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/60 transition select-none"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white font-bold font-display flex items-center justify-center text-base shadow-xs shrink-0">
                  4
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-bold font-display text-neutral-900 tracking-tight">
                      4. Tizim amallari va audit loglari
                    </h2>
                    <span className="text-[11px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                      Faqat adminc1 nazorati
                    </span>
                    <span className="text-[11px] font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                      {systemLogs.length} ta amal
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 hidden sm:block mt-0.5">
                    Barcha foydalanuvchilar (agentlar, adminlar) faoliyati va IP manzillari yozuvi
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsAdminLogsOpen(!isAdminLogsOpen);
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition min-h-[40px] cursor-pointer ${
                    isAdminLogsOpen
                      ? 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200'
                      : 'bg-slate-900 text-white hover:bg-slate-800 shadow-xs'
                  }`}
                >
                  {isAdminLogsOpen ? (
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

            {/* Expanded Content: System Audit Logs Table */}
            {isAdminLogsOpen && (
              <div className="p-5 sm:p-6 pt-0 border-t border-rose-100/70 animate-in fade-in duration-150">
                <div className="pt-4">
                  <AdminSystemLogsTable
                    logs={systemLogs}
                    currentUsername={user.username}
                  />
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
          if (user.role === 'agent' || user.username === 'agentp1' || user.username === 'agentc1') {
            showToast("Agentlar mijoz ma'lumotlarini tahrirlash huquqiga ega emas!");
            return;
          }
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
        userRole={user.role}
        currentUsername={user.username}
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
        client={executingPlanItem ? clients.find((c) => c.id === executingPlanItem.clientId) : null}
        warehouseProducts={warehouseProducts}
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

      {/* Admin: Warehouse Intake Modal (Omborga mahsulotlar kiritish) */}
      <WarehouseIntakeModal
        isOpen={isWarehouseModalOpen}
        onClose={() => setIsWarehouseModalOpen(false)}
        onSave={handleSaveWarehouseProduct}
        currentUsername={user.username}
      />

      {/* Admin: Warehouse Inventory Modal (Ombordagi zaxiralar) */}
      <WarehouseInventoryModal
        isOpen={isWarehouseInventoryModalOpen}
        onClose={() => setIsWarehouseInventoryModalOpen(false)}
        products={warehouseProducts}
        onDeleteProduct={handleDeleteWarehouseProduct}
        onOpenIntakeModal={() => setIsWarehouseModalOpen(true)}
      />
    </div>
  );
}
