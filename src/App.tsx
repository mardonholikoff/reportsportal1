/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './hooks/useAuth';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import {
  storageService,
  getDeletedClientIds,
  markClientAsDeleted,
  getDeletedWarehouseIds,
  markWarehouseProductAsDeleted,
} from './services/storage';
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
  SystemLogMonthlyArchiveRecord,
  SystemLogPeriodArchive,
  MonthlyPlan,
  MonthlyPlanTarget,
  MonthlyPlanDecadeTargets,
  MonthlyPlanClientItem,
  MonthlyProductPlanClientItem,
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
import { MonthlyPlanProgressCard } from './components/MonthlyPlanProgressCard';
import { CreateMonthlyPlanModal } from './components/CreateMonthlyPlanModal';
import { MonthlyProductPlanProgressCard } from './components/MonthlyProductPlanProgressCard';
import { CreateMonthlyProductPlanModal } from './components/CreateMonthlyProductPlanModal';
import { AddWarehouseDebtModal } from './components/AddWarehouseDebtModal';
import {
  addSystemLog,
  getLocalSystemLogs,
  deleteLocalSystemLogs,
  deleteSystemLogsFromFirestore,
  saveArchiveRecord,
  savePeriodArchive,
  subscribeToFirestoreData,
  bootstrapFirestoreData,
  syncClientToFirestore,
  syncClientsBulkToFirestore,
  deleteClientFromFirestore,
  syncPlanToFirestore,
  syncPlansBulkToFirestore,
  deletePlanFromFirestore,
  syncWarehouseProductToFirestore,
  syncWarehouseProductsBulkToFirestore,
  deleteWarehouseProductFromFirestore,
  syncMonthlyPlanToFirestore,
} from './services/firebase';
import { formatDateDMY } from './utils/format';
import { ImportedClientPayload } from './components/ExcelClientImporter';
import { ImportedWarehouseProductPayload } from './components/ExcelWarehouseImporter';
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
  FileSpreadsheet,
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
  const [isAdminPlansOpen, setIsAdminPlansOpen] = useState(true);
  const [isAdminLogsOpen, setIsAdminLogsOpen] = useState(true);

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [clientFormInitialMode, setClientFormInitialMode] = useState<'single' | 'excel'>('single');
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
  const [editingWarehouseProduct, setEditingWarehouseProduct] = useState<WarehouseProduct | null>(
    null
  );
  const [isWarehouseInventoryModalOpen, setIsWarehouseInventoryModalOpen] = useState(false);

  // Monthly Plans state (1 oylik qarz undirish va 1 oylik mahsulot berish rejalari)
  const [monthlyPlans, setMonthlyPlans] = useState<MonthlyPlan[]>(() =>
    storageService.getMonthlyPlans()
  );
  const [isCreateMonthlyPlanOpen, setIsCreateMonthlyPlanOpen] = useState(false);
  const [isCreateMonthlyProductPlanOpen, setIsCreateMonthlyProductPlanOpen] = useState(false);

  // Add warehouse debt modal state
  const [isAddWarehouseDebtOpen, setIsAddWarehouseDebtOpen] = useState(false);
  const [warehouseDebtClient, setWarehouseDebtClient] = useState<Client | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  const isAdmin = user?.role === 'admin';
  const isAgent = user?.role === 'agent';

  // Active monthly debt collection plan for tracker
  const activeMonthlyPlan = useMemo(() => {
    const plan = storageService.getActiveMonthlyPlan(isAgent ? user?.username : undefined);
    return plan ? { ...plan } : null;
  }, [monthlyPlans, clients, isAgent, user]);

  // Active monthly product delivery plan for tracker (1 oylik qarz undiruv ostidagi yangi turdagi reja)
  const activeMonthlyProductPlan = useMemo(() => {
    const plan = storageService.getActiveMonthlyProductPlan(isAgent ? user?.username : undefined);
    return plan ? { ...plan } : null;
  }, [monthlyPlans, clients, dailyPlans, isAgent, user]);

  // Handle Save Warehouse Debt for client (adminc and adminc1)
  const handleSaveWarehouseDebt = (
    clientId: string,
    amount: number,
    currency: string,
    note?: string
  ) => {
    const currentUsername = user?.username || 'adminc';
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;

    const oldDebt = client.currentDebt;
    const newDebt = oldDebt + amount;
    const nowStr = new Date().toISOString();
    const clientLogs = client.logs || [];

    const logDetail = `${currentUsername} tomonidan ombordagi mahsulotlar hisobidan qarzdorlik qo'shildi: ${new Intl.NumberFormat('uz-UZ').format(amount)} ${currency}.${note ? ' Izoh: ' + note : ''}`;

    clientLogs.unshift({
      id: `log_${Date.now()}_whdebt`,
      clientId: client.id,
      author: currentUsername,
      timestamp: nowStr,
      type: 'product_added',
      title: `Ombordagi qarzdorlik qo'shildi (${currency})`,
      details: logDetail,
      amountChanged: amount,
    });

    const updatedClient = storageService.updateClient(client.id, {
      currentDebt: newDebt,
      logs: clientLogs,
      updatedAt: nowStr,
    });

    if (updatedClient) {
      setClients(storageService.getClients());
      syncClientToFirestore(updatedClient);
      addSystemLog({
        userId: currentUsername,
        userRole: 'admin',
        actionType: 'ombor_kirimi',
        actionTitle: `Ombordagi qarzdorlik qo'shildi: ${client.name}`,
        details: `${new Intl.NumberFormat('uz-UZ').format(amount)} ${currency} qarz kiritildi. Mijoz: ${client.name}`,
        metadata: {
          clientId: client.id,
          amount,
          currency,
          previousDebt: oldDebt,
          newDebt,
        },
      });
      showToast(`Mijozga ${new Intl.NumberFormat('uz-UZ').format(amount)} ${currency} ombor qarzdorligi qo'shildi!`);
    }
  };

  // Handle Save or Edit 1-Month Debt Collection Plan
  const handleSaveMonthlyPlan = (
    targets: MonthlyPlanTarget[],
    decadeTargets: MonthlyPlanDecadeTargets,
    clientPlans: MonthlyPlanClientItem[],
    startDate: string,
    endDate: string,
    notes?: string,
    editReason?: string
  ) => {
    const currentUsername = user?.username || 'agentp1';
    const isEditingActive =
      activeMonthlyPlan &&
      activeMonthlyPlan.status === 'active' &&
      new Date(`${activeMonthlyPlan.endDate}T23:59:59`).getTime() >= Date.now();

    if (isEditingActive && activeMonthlyPlan) {
      const updatedPlan = storageService.updateMonthlyPlan(activeMonthlyPlan.id, {
        targets,
        decadeTargets,
        clientPlans,
        startDate,
        endDate,
        notes,
        editedBy: currentUsername,
        editReason: editReason || "Reja ma'lumotlari tahrirlandi",
      });

      if (updatedPlan) {
        setMonthlyPlans(storageService.getMonthlyPlans());
        syncMonthlyPlanToFirestore(updatedPlan);
        addSystemLog({
          userId: currentUsername,
          userRole: user?.role || 'agent',
          actionType: 'reja_tuzish',
          actionTitle: `1 oylik qarz undirish rejasi tahrirlandi (@${currentUsername})`,
          details: `Sabab/Izoh: "${editReason}". Muddat: ${startDate} dan ${endDate} gacha. Mijozlar soni: ${clientPlans.length} ta. Umumiy: ${targets.map((t) => `${new Intl.NumberFormat('uz-UZ').format(t.targetAmount)} ${t.currency}`).join(', ')}. 10 kunliklar: 1-chi=${new Intl.NumberFormat('uz-UZ').format(decadeTargets.decade1)} USD, 2-chi=${new Intl.NumberFormat('uz-UZ').format(decadeTargets.decade2)} USD, 3-chi=${new Intl.NumberFormat('uz-UZ').format(decadeTargets.decade3)} USD.`,
          metadata: {
            planId: updatedPlan.id,
            targets,
            decadeTargets,
            clientsCount: clientPlans.length,
            startDate,
            endDate,
            editReason,
          },
        });
        showToast("Mavjud 1 oylik reja muvaffaqiyatli tahrirlandi va xronologiyaga yozildi!");
      }
      return;
    }

    const newPlan = storageService.addMonthlyPlan({
      agentUsername: currentUsername,
      targets,
      decadeTargets,
      clientPlans,
      startDate,
      endDate,
      createdBy: currentUsername,
      notes,
      status: 'active',
    });
    setMonthlyPlans(storageService.getMonthlyPlans());
    syncMonthlyPlanToFirestore(newPlan);
    addSystemLog({
      userId: currentUsername,
      userRole: user?.role || 'agent',
      actionType: 'reja_tuzish',
      actionTitle: `1 oylik qarz undirish rejasi tuzildi (@${currentUsername})`,
      details: `Muddat: ${startDate} dan ${endDate} gacha. Mijozlar soni: ${clientPlans.length} ta. Umumiy maqsad: ${targets.map((t) => `${new Intl.NumberFormat('uz-UZ').format(t.targetAmount)} ${t.currency}`).join(', ')}. 10 kunliklar: 1-chi=${new Intl.NumberFormat('uz-UZ').format(decadeTargets.decade1)} USD, 2-chi=${new Intl.NumberFormat('uz-UZ').format(decadeTargets.decade2)} USD, 3-chi=${new Intl.NumberFormat('uz-UZ').format(decadeTargets.decade3)} USD.`,
      metadata: {
        planId: newPlan.id,
        targets,
        decadeTargets,
        clientsCount: clientPlans.length,
        startDate,
        endDate,
      },
    });
    showToast("1 oylik qarz undirish rejasi muvaffaqiyatli saqlandi!");
  };

  // Handle Save or Edit 1-Month Product Delivery Plan (1 oylik mahsulot berish rejasi)
  const handleSaveMonthlyProductPlan = (
    targets: MonthlyPlanTarget[],
    decadeTargets: MonthlyPlanDecadeTargets,
    productClientPlans: MonthlyProductPlanClientItem[],
    startDate: string,
    endDate: string,
    notes?: string,
    editReason?: string
  ) => {
    const currentUsername = user?.username || 'agentp1';
    const isEditingActive =
      activeMonthlyProductPlan &&
      activeMonthlyProductPlan.status === 'active' &&
      new Date(`${activeMonthlyProductPlan.endDate}T23:59:59`).getTime() >= Date.now();

    if (isEditingActive && activeMonthlyProductPlan) {
      const updatedPlan = storageService.updateMonthlyProductPlan(activeMonthlyProductPlan.id, {
        targets,
        decadeTargets,
        productClientPlans,
        startDate,
        endDate,
        notes,
        editedBy: currentUsername,
        editReason: editReason || "Mahsulot rejasi tahrirlandi",
      });

      if (updatedPlan) {
        setMonthlyPlans(storageService.getMonthlyPlans());
        syncMonthlyPlanToFirestore(updatedPlan);
        addSystemLog({
          userId: currentUsername,
          userRole: user?.role || 'agent',
          actionType: 'reja_tuzish',
          actionTitle: `1 oylik mahsulot berish rejasi tahrirlandi (@${currentUsername})`,
          details: `Sabab/Izoh: "${editReason}". Muddat: ${startDate} — ${endDate}. Mijozlar soni: ${productClientPlans.length} ta. Umumiy reja: ${new Intl.NumberFormat('uz-UZ').format(targets[0]?.targetAmount || 0)}.`,
          metadata: {
            planId: updatedPlan.id,
            planType: 'product_delivery',
            targets,
            decadeTargets,
            clientsCount: productClientPlans.length,
            startDate,
            endDate,
            editReason,
          },
        });
        showToast("Mavjud 1 oylik mahsulot berish rejasi tahrirlandi va xronologiyaga yozildi!");
      }
      return;
    }

    const newPlan = storageService.addMonthlyProductPlan({
      agentUsername: currentUsername,
      targets,
      decadeTargets,
      productClientPlans,
      startDate,
      endDate,
      createdBy: currentUsername,
      notes,
    });
    setMonthlyPlans(storageService.getMonthlyPlans());
    syncMonthlyPlanToFirestore(newPlan);
    addSystemLog({
      userId: currentUsername,
      userRole: user?.role || 'agent',
      actionType: 'reja_tuzish',
      actionTitle: `1 oylik mahsulot berish rejasi tuzildi (@${currentUsername})`,
      details: `Muddat: ${startDate} — ${endDate}. Mijozlar soni: ${productClientPlans.length} ta. Umumiy maqsad: ${new Intl.NumberFormat('uz-UZ').format(targets[0]?.targetAmount || 0)}.`,
      metadata: {
        planId: newPlan.id,
        planType: 'product_delivery',
        targets,
        decadeTargets,
        clientsCount: productClientPlans.length,
        startDate,
        endDate,
      },
    });
    showToast("1 oylik mahsulot berish rejasi muvaffaqiyatli saqlandi!");
  };

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
      details: `${saved.intakeQuantity} ${saved.intakeUnitType === 'package' ? saved.packageUnitName : saved.pieceUnitName} (${saved.totalSum?.toLocaleString('uz-UZ') || 0} USD). Marka: ${saved.mark1 || ''}`,
    });
    showToast(
      `"${saved.brand} - ${saved.name}" omborga muvaffaqiyatli kiritildi! (${saved.intakeQuantity} ${saved.intakeUnitType === 'package' ? saved.packageUnitName : saved.pieceUnitName})`
    );
  };

  // Bulk Import Warehouse Products from Excel (.xlsx)
  const handleBulkImportWarehouseProducts = (
    productsData: ImportedWarehouseProductPayload[]
  ) => {
    const currentUsername = user?.username || 'adminc';
    if (user?.role !== 'admin' && currentUsername !== 'adminc' && currentUsername !== 'adminc1') {
      showToast("Faqat adminlar omborga Excel (.xlsx) orqali mahsulot yuklash huquqiga ega!");
      return;
    }
    if (!productsData || productsData.length === 0) return;

    const createdProducts = storageService.addWarehouseProductsBulk(productsData);
    setWarehouseProducts(storageService.getWarehouseProducts());
    syncWarehouseProductsBulkToFirestore(createdProducts);

    const totalPiecesImported = createdProducts.reduce((sum, p) => sum + (p.totalPieces || 0), 0);
    const totalSumImported = createdProducts.reduce((sum, p) => sum + (p.totalSum || 0), 0);

    addSystemLog({
      userId: currentUsername,
      userRole: 'admin',
      actionType: 'ombor_kirimi',
      actionTitle: `Excel (.xlsx) fayldan omborga ${createdProducts.length} xil mahsulot yuklandi`,
      details: `Jami yuklangan: ${createdProducts.length} xil mahsulot (${totalPiecesImported.toLocaleString('uz-UZ')} dona, ${totalSumImported.toLocaleString('uz-UZ')} USD). Mahsulotlar: ${createdProducts
        .slice(0, 8)
        .map((p) => `${p.brand} - ${p.name}`)
        .join(', ')}${createdProducts.length > 8 ? '...' : ''}`,
    });

    showToast(
      `Excel (.xlsx) fayldan ${createdProducts.length} xil mahsulot (${totalPiecesImported.toLocaleString('uz-UZ')} dona) omborga muvaffaqiyatli yuklandi!`
    );
  };

  // Update Existing Warehouse Product (Faqat adminlar uchun)
  const handleUpdateWarehouseProduct = (
    id: string,
    data: Omit<WarehouseProduct, 'id' | 'createdAt'>
  ) => {
    const currentUsername = user?.username || 'adminc';
    if (user?.role !== 'admin' && currentUsername !== 'adminc' && currentUsername !== 'adminc1') {
      showToast("Faqat adminlar ombordagi mahsulotlarni tahrirlash huquqiga ega!");
      return;
    }

    const updated = storageService.updateWarehouseProduct(id, data);
    if (!updated) return;

    setWarehouseProducts(storageService.getWarehouseProducts());
    syncWarehouseProductToFirestore(updated);

    addSystemLog({
      userId: currentUsername,
      userRole: 'admin',
      actionType: 'ombor_kirimi',
      actionTitle: `Ombor mahsuloti tahrirlandi: ${updated.brand} - ${updated.name}`,
      details: `Qoldiq: ${updated.totalPieces} dona (${updated.totalVolume} ${updated.baseUnit}). Eng kam sotilish narxi: ${updated.minSellingPrice || updated.price || 0} USD. Marka: ${updated.mark1 || ''}`,
      metadata: {
        productId: updated.id,
      },
    });

    showToast(
      `"${updated.brand} - ${updated.name}" ma'lumotlari ombor zaxirasida muvaffaqiyatli yangilandi!`
    );
    setEditingWarehouseProduct(null);
  };

  // Delete Warehouse Product
  const handleDeleteWarehouseProduct = async (id: string) => {
    const currentUsername = user?.username || 'adminc';
    const target = warehouseProducts.find((w) => w.id === id);

    // 1. Immediately blacklist warehouse product ID & remove from local storage
    markWarehouseProductAsDeleted(id);
    storageService.deleteWarehouseProduct(id);

    // 2. Update React state immediately across all views
    setWarehouseProducts(storageService.getWarehouseProducts());

    // 3. Delete document from Firestore warehouseProducts collection
    await deleteWarehouseProductFromFirestore(id);

    // 4. Record audit log with deletedWarehouseId metadata so all sessions also purge immediately
    addSystemLog({
      userId: currentUsername,
      userRole: user?.role || 'admin',
      actionType: 'ombor_ochirish',
      actionTitle: `Ombor mahsuloti butun bazadan o'chirildi: ${target ? `${target.brand} - ${target.name}` : id}`,
      details: target ? `${target.brand} - ${target.name} (ID: ${id})` : `ID: ${id}`,
      metadata: {
        productId: id,
        deletedWarehouseId: id,
      },
    });
    showToast(
      target
        ? `"${target.brand} - ${target.name}" ombor zaxirasidan va butun bazadan to'liq o'chirildi.`
        : "Mahsulot ombor zaxirasidan va butun bazadan to'liq o'chirildi."
    );
  };

  // Purge system audit logs after Excel transition (15 kunlik yoki oylik)
  const handlePurgeLogs = async (
    logIds: string[],
    archiveRecord: SystemLogPeriodArchive | SystemLogMonthlyArchiveRecord
  ) => {
    try {
      // 1. Delete from Firestore systemLogs collection
      await deleteSystemLogsFromFirestore(logIds);
      // 2. Delete from local storage
      deleteLocalSystemLogs(logIds);
      // 3. Update active React state
      setSystemLogs((prev) => prev.filter((l) => !logIds.includes(l.id)));
      // 4. Save archive record into archive history
      if ('logs' in archiveRecord) {
        savePeriodArchive(archiveRecord as SystemLogPeriodArchive);
      } else {
        saveArchiveRecord(archiveRecord as SystemLogMonthlyArchiveRecord);
      }
      // 5. Toast feedback
      const label =
        'periodLabel' in archiveRecord
          ? (archiveRecord as SystemLogPeriodArchive).periodLabel
          : (archiveRecord as SystemLogMonthlyArchiveRecord).monthLabel;
      showToast(
        `«${label}» bo'yicha ${archiveRecord.logsCount} ta audit logi Excelga o'tdi va bazadan tozalandi.`
      );
    } catch (err) {
      console.error('Failed to purge system logs:', err);
      showToast("Audit loglarini tozalashda xatolik yuz berdi.");
    }
  };

  // Subscribe to storage changes & Firebase Firestore real-time sync
  useEffect(() => {
    // 1. Initial bootstrap to Firestore if remote is empty
    bootstrapFirestoreData(
      storageService.getClients(),
      storageService.getDailyPlans(),
      storageService.getWarehouseProducts()
    );

    // 2. Realtime listener to Firestore (automatic offline-persistence sync + local merge)
    const unsubFirestore = subscribeToFirestoreData({
      onClientsChange: (remoteClients) => {
        if (remoteClients) {
          const deletedIds = getDeletedClientIds();
          const cleanRemote = remoteClients.filter((c) => !deletedIds.has(c.id));

          // Pending offline creates (hali Firestore'ga chiqmagan oflayn yaratilganlar)
          const pendingSyncQueue = storageService.getSyncQueue();
          const pendingLocalCreates = pendingSyncQueue
            .filter((q) => q.action === 'create' && q.client)
            .map((q) => q.client as Client);

          const clientsMap = new Map<string, Client>();
          // 1. Bulutdagi Firestore bazasi yagona va aktual haqiqat manbai
          cleanRemote.forEach((rc) => clientsMap.set(rc.id, rc));
          // 2. Faqat haqiqiy oflayn yangi qo'shilganlar saqlab qolinadi
          pendingLocalCreates.forEach((lc) => {
            if (!clientsMap.has(lc.id)) clientsMap.set(lc.id, lc);
          });

          const mergedList = Array.from(clientsMap.values()).filter(
            (c) => !deletedIds.has(c.id)
          );
          storageService.saveClients(mergedList);
          setClients(mergedList);
          // Re-evaluate dailyPlans so any plans belonging to removed clients disappear immediately
          setDailyPlans(
            storageService.getActive24hPlans(user?.role === 'agent' ? user.username : undefined)
          );
        }
      },
      onPlansChange: (remotePlans) => {
        if (remotePlans) {
          const deletedIds = getDeletedClientIds();
          const activeClientIds = new Set(storageService.getClients().map((c) => c.id));

          // Purge any remote plans that belong to deleted or non-existent clients
          remotePlans.forEach((rp) => {
            if (deletedIds.has(rp.clientId) || !activeClientIds.has(rp.clientId)) {
              deletePlanFromFirestore(rp.id);
            }
          });

          const cleanRemote = remotePlans.filter(
            (p) => !deletedIds.has(p.clientId) && activeClientIds.has(p.clientId)
          );

          // Deduplicate by clientId so each client appears only once, and remove duplicate docs from Firestore
          const { uniquePlans, duplicateIds } =
            storageService.deduplicatePlansByClient(cleanRemote);
          if (duplicateIds.length > 0) {
            duplicateIds.forEach((dupId) => {
              deletePlanFromFirestore(dupId);
            });
          }

          storageService.saveDailyPlans(uniquePlans);
          setDailyPlans(
            storageService.getActive24hPlans(user?.role === 'agent' ? user.username : undefined)
          );
        }
      },
      onWarehouseChange: (remoteProducts) => {
        if (remoteProducts) {
          const deletedWhIds = getDeletedWarehouseIds();
          const cleanRemote = remoteProducts.filter((w) => !deletedWhIds.has(w.id));
          storageService.saveWarehouseProducts(cleanRemote);
          setWarehouseProducts(cleanRemote);
        }
      },
      onLogsChange: (remoteLogs) => {
        if (remoteLogs && remoteLogs.length > 0) {
          // Only purge clients/warehouse items that are still present in active local storage
          const activeClientIds = new Set(storageService.getClients().map((c) => c.id));
          const activeWhIds = new Set(storageService.getWarehouseProducts().map((w) => w.id));
          let anyDeletedFound = false;
          let anyWarehouseDeletedFound = false;
          remoteLogs.forEach((logItem) => {
            if (logItem.actionType === 'mijoz_ochirish') {
              const delId =
                logItem.metadata?.deletedClientId || logItem.metadata?.clientId;
              if (delId && typeof delId === 'string' && activeClientIds.has(delId)) {
                storageService.deleteClient(delId);
                activeClientIds.delete(delId);
                anyDeletedFound = true;
              }
            }
            if (logItem.actionType === 'ombor_ochirish') {
              const delWhId =
                logItem.metadata?.deletedWarehouseId || logItem.metadata?.productId;
              if (delWhId && typeof delWhId === 'string' && activeWhIds.has(delWhId)) {
                storageService.deleteWarehouseProduct(delWhId);
                activeWhIds.delete(delWhId);
                anyWarehouseDeletedFound = true;
              }
            }
          });
          if (anyDeletedFound) {
            setClients(storageService.getClients());
            setDailyPlans(
              storageService.getActive24hPlans(user?.role === 'agent' ? user.username : undefined)
            );
            setMonthlyPlans(storageService.getMonthlyPlans());
          }
          if (anyWarehouseDeletedFound) {
            setWarehouseProducts(storageService.getWarehouseProducts());
          }
          setSystemLogs(remoteLogs);
        }
      },
      onMonthlyPlansChange: (remoteMonthlyPlans) => {
        if (remoteMonthlyPlans && remoteMonthlyPlans.length > 0) {
          const localPlans = storageService.getMonthlyPlans();
          const localMap = new Map<string, MonthlyPlan>();
          localPlans.forEach((lp) => localMap.set(lp.id, lp));

          const mergedMap = new Map<string, MonthlyPlan>();
          localPlans.forEach((lp) => mergedMap.set(lp.id, lp));

          remoteMonthlyPlans.forEach((rp) => {
            const existing = localMap.get(rp.id);
            if (!existing) {
              mergedMap.set(rp.id, rp);
            } else {
              const rTime = new Date(rp.updatedAt || rp.createdAt || 0).getTime();
              const lTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
              const rHistLen = rp.editHistory?.length || 0;
              const lHistLen = existing.editHistory?.length || 0;
              if (rHistLen > lHistLen || (rHistLen === lHistLen && rTime >= lTime)) {
                mergedMap.set(rp.id, rp);
              } else {
                mergedMap.set(rp.id, existing);
                syncMonthlyPlanToFirestore(existing);
              }
            }
          });

          const mergedList = Array.from(mergedMap.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          storageService.saveMonthlyPlans(mergedList);
          setMonthlyPlans(storageService.getMonthlyPlans());
        }
      },
    });

    const updateFromStorage = () => {
      setClients(storageService.getClients());
      setDailyPlans(
        storageService.getActive24hPlans(user?.role === 'agent' ? user.username : undefined)
      );
      setMonthlyPlans(storageService.getMonthlyPlans());
      setWarehouseProducts(storageService.getWarehouseProducts());
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
        details: `Telefon: ${data.phone}, Manzil: ${data.address || ''}, Qarz: ${data.currentDebt || 0} USD`,
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
        details: `Telefon: ${data.phone}, Manzil: ${data.address || ''}, Boshlang'ich qarz: ${data.currentDebt || 0} USD`,
      });
      showToast(`Yangi mijoz "${data.name}" muvaffaqiyatli saqlandi! (${currentUsername})`);
    }
    setEditingClient(null);
    setClientFormInitialMode('single');
    setIsFormModalOpen(false);
  };

  // Handle Bulk Import Clients from Excel (.xlsx) — Faqat Adminlar (adminc va adminc1) uchun
  const handleBulkImportClients = (clientsData: ImportedClientPayload[]) => {
    const currentUsername = user?.username || 'adminc';
    if (user?.role !== 'admin' && currentUsername !== 'adminc' && currentUsername !== 'adminc1') {
      showToast("Faqat adminlar Excel (.xlsx) fayldan mijozlarni yuklash huquqiga ega!");
      return;
    }

    if (!clientsData || clientsData.length === 0) return;

    const createdClients = storageService.addClientsBulk(clientsData, currentUsername);
    setClients(storageService.getClients());

    // Sync imported clients to Firestore using batched writeBatch (O(N/400) network commits)
    syncClientsBulkToFirestore(createdClients);

    const totalDebtImported = createdClients.reduce((sum, c) => sum + (c.currentDebt || 0), 0);

    addSystemLog({
      userId: currentUsername,
      userRole: 'admin',
      actionType: 'mijoz_yaratish',
      actionTitle: `Excel (.xlsx) fayldan ${createdClients.length} ta yangi mijoz yuklandi`,
      details: `Jami yuklangan mijozlar: ${createdClients.length} ta. Umumiy boshlang'ich qarz: ${totalDebtImported.toLocaleString('uz-UZ')} USD. Ismlar: ${createdClients
        .slice(0, 8)
        .map((c) => c.name)
        .join(', ')}${createdClients.length > 8 ? '...' : ''}`,
    });

    showToast(
      `Excel (.xlsx) fayldan ${createdClients.length} ta yangi mijoz bazaga muvaffaqiyatli yuklandi!`
    );
    setEditingClient(null);
    setClientFormInitialMode('single');
    setIsFormModalOpen(false);
  };

  // Handle Delete Client (Faqat adminc va adminc1 huquqiga ega)
  const handleDeleteClient = async (clientId: string) => {
    if (user?.username !== 'adminc' && user?.username !== 'adminc1') {
      showToast("Faqat adminc yoki adminc1 mijozni o'chirish huquqiga ega!");
      return;
    }

    const currentUsername = user?.username || 'adminc';
    const client = clients.find((c) => c.id === clientId);

    // Collect any plan IDs associated with this client BEFORE deleting locally
    const planIdsToDelete = Array.from(
      new Set([
        ...dailyPlans.filter((p) => p.clientId === clientId).map((p) => p.id),
        ...storageService
          .getDailyPlans()
          .filter((p) => p.clientId === clientId)
          .map((p) => p.id),
      ])
    );

    // 1. Immediately blacklist client ID & delete client + cascade plans + monthly plan debts in local storage
    markClientAsDeleted(clientId);
    storageService.deleteClient(clientId);

    // 2. Update React states immediately for instant UI feedback across all sections
    setClients(storageService.getClients());
    setDailyPlans(
      storageService.getActive24hPlans(user?.role === 'agent' ? user.username : undefined)
    );
    setMonthlyPlans(storageService.getMonthlyPlans());

    // 3. Close any open modal if this client or its plan was selected
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
    if (warehouseDebtClient?.id === clientId) {
      setWarehouseDebtClient(null);
      setIsAddWarehouseDebtOpen(false);
    }
    if (executingPlanItem?.clientId === clientId) {
      setExecutingPlanItem(null);
    }

    // 4. Delete client document, cascade plans, and update monthlyPlans in Firestore
    await deleteClientFromFirestore(clientId, planIdsToDelete);

    // 5. Record audit log with deletedClientId metadata so all agent sessions also purge immediately
    addSystemLog({
      userId: currentUsername,
      userRole: user?.role || 'admin',
      actionType: 'mijoz_ochirish',
      actionTitle: `Mijoz va unga oid barcha ma'lumotlar to'liq o'chirildi: ${client?.name || clientId}`,
      details: client
        ? `Nomi: ${client.name}, Telefon: ${client.phone}, Manzil: ${client.address || ''}, Qarz: ${client.currentDebt || 0} USD`
        : `ID: ${clientId}`,
      metadata: {
        clientId,
        deletedClientId: clientId,
        deletedPlanIds: planIdsToDelete,
      },
    });

    showToast(
      client
        ? `"${client.name}" va unga oid barcha rejalar hamda ma'lumotlar butun bazadan to'liq o'chirildi.`
        : "Mijoz va unga oid barcha ma'lumotlar butun bazadan to'liq o'chirildi."
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
        details: `Yangi qarz: ${newDebt.toLocaleString('uz-UZ')} USD, Yangi haqdorlik: ${newAdvance.toLocaleString('uz-UZ')} USD. Izoh: ${noteAddition}`,
      });
      showToast(`Hisob-kitob yangilandi (${currentUsername}): ${noteAddition}`);
      if (selectedClient && selectedClient.id === clientId) {
        setSelectedClient(updated);
      }
    }
    setIsPaymentModalOpen(false);
  };

  // Handle Create Daily Plan (Agent selects clients with notes and optional custom date - works offline & online)
  const handleConfirmPlan = (selections: PlanSelectionItem[], planDate?: string) => {
    const currentUsername = user?.username || 'agentp1';
    const newItems = storageService.createDailyPlan(currentUsername, selections, planDate);
    setDailyPlans(storageService.getActive24hPlans(isAgent ? user?.username : undefined));
    newItems.forEach((item) => syncPlanToFirestore(item));
    const dateLabel = planDate ? formatDateDMY(planDate) : 'Bugungi';
    addSystemLog({
      userId: currentUsername,
      userRole: 'agent',
      actionType: 'reja_tuzish',
      actionTitle: `${dateLabel} kunlik reja tuzildi (${newItems.length} ta mijoz)`,
      details: `Sana: ${dateLabel}. Rejaga kiritilgan mijozlar: ${newItems.map((n) => n.clientName).join(', ')}`,
    });
    showToast(`${dateLabel} uchun ${newItems.length} ta mijoz rejalashtirildi.`);
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
        detailsText += ` Tushum: ${report.financialAction.amount.toLocaleString('uz-UZ')} USD (${report.financialAction.methodLabel}).`;
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

  // Handle Close Plan Item (Permanent lock for agent with reason)
  const handleClosePlanItem = (planItemId: string, closeReason?: string) => {
    const currentUsername = user?.username || 'agentp1';
    const reason = closeReason?.trim() || "Amallar yakunlandi";
    const success = storageService.closeDailyPlanItem(planItemId, currentUsername, reason);
    if (success) {
      const updatedPlan = storageService.getDailyPlans().find((p) => p.id === planItemId);
      if (updatedPlan) syncPlanToFirestore(updatedPlan);

      const targetClientId = updatedPlan?.clientId;
      if (targetClientId) {
        const updatedClient = storageService.getClientById(targetClientId);
        if (updatedClient) syncClientToFirestore(updatedClient);
      }

      addSystemLog({
        userId: currentUsername,
        userRole: 'agent',
        actionType: 'reja_yopish',
        actionTitle: `Mijoz rejasi yopildi`,
        details: `Reja ID: ${planItemId}. Mijoz: ${updatedPlan?.clientName || ''}. Agent @${currentUsername} tomonidan amallar yakunlandi. Yopilish sababi: ${reason}`,
      });
      showToast(`Mijoz bo'yicha reja yopildi. Sabab: ${reason}`);
      setDailyPlans(storageService.getActive24hPlans(isAgent ? user?.username : undefined));
      setClients(storageService.getClients());
    }
  };

  // Reopen closed plan item(s) with mandatory reason (reason visible only to Admin)
  const handleReopenPlanItems = async (planItemIds: string[], reopenReason: string) => {
    const currentUsername = user?.username || 'agentc1';
    const reopenedItems = storageService.reopenDailyPlanItems(
      planItemIds,
      currentUsername,
      reopenReason
    );
    if (reopenedItems.length > 0) {
      // 1. Darhol lokal React holatini va localStorage'ni faol rejalarga yangilaymiz
      setDailyPlans(storageService.getActive24hPlans(isAgent ? user?.username : undefined));
      setClients(storageService.getClients());

      // 2. Firestore'ga barcha ochilgan rejalarni bitta atomic writeBatch bilan yozamiz
      await syncPlansBulkToFirestore(reopenedItems);

      // 3. Mijozlar audit loglarini ham bitta atomic writeBatch bilan Firestore'ga yozamiz
      const updatedClients = reopenedItems
        .map((p) => storageService.getClientById(p.clientId))
        .filter((c): c is Client => Boolean(c));
      if (updatedClients.length > 0) {
        await syncClientsBulkToFirestore(updatedClients);
      }

      const clientNames = reopenedItems.map((p) => p.clientName).join(', ');
      addSystemLog({
        userId: currentUsername,
        userRole: user?.role || 'agent',
        actionType: 'reja_tuzish',
        actionTitle: `Yopilgan mijoz reja(lari) qayta ochildi (${reopenedItems.length} ta)`,
        details: `Mijozlar: ${clientNames}. Qayta ochish izohi: ${reopenReason}`,
      });
      showToast(
        reopenedItems.length === 1
          ? `"${reopenedItems[0].clientName}" rejasi qayta ochildi!`
          : `${reopenedItems.length} ta mijoz rejasi qayta ochildi!`
      );
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
        onOpenWarehouseModal={() => {
          setEditingWarehouseProduct(null);
          setIsWarehouseModalOpen(true);
        }}
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

            {/* Tab 1: Bugungi kunlik reja + Yuqorida 1 oylik qarz undiruv va 1 oylik mahsulot berish rejalari */}
            {agentActiveTab === 'reja' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <MonthlyPlanProgressCard
                  plan={activeMonthlyPlan}
                  userRole={user.role}
                  currentUsername={user.username}
                  onOpenCreatePlan={() => setIsCreateMonthlyPlanOpen(true)}
                />

                <MonthlyProductPlanProgressCard
                  plan={activeMonthlyProductPlan}
                  userRole={user.role}
                  currentUsername={user.username}
                  onOpenCreatePlan={() => setIsCreateMonthlyProductPlanOpen(true)}
                />

                <AgentDailyPlanTable
                  plans={dailyPlans}
                  clients={clients}
                  onOpenCreatePlan={() => setIsCreatePlanOpen(true)}
                  onOpenMonthlyPlan={() => setIsCreateMonthlyPlanOpen(true)}
                  onOpenExecuteModal={(item) => setExecutingPlanItem(item)}
                  onMarkPlannedActionDone={(item) =>
                    handleSavePlanReport(item.id, {
                      actionDone: item.plannedAction || 'joyiga borildi',
                    })
                  }
                  onUpdatePlanNote={handleUpdatePlanNote}
                  onClosePlanItem={handleClosePlanItem}
                  onReopenPlanItems={handleReopenPlanItems}
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
        {/* ADMIN VIEW: BIRINCHI BO'LIB 1 OYLIK QARZ UNDIRISH VA MAHSULOT BERISH FOIZI */}
        {/* ========================================================= */}
        {isAdmin && (
          <div className="space-y-4">
            <MonthlyPlanProgressCard
              plan={activeMonthlyPlan}
              userRole={user.role}
              currentUsername={user.username}
              onOpenCreatePlan={() => setIsCreateMonthlyPlanOpen(true)}
            />

            <MonthlyProductPlanProgressCard
              plan={activeMonthlyProductPlan}
              userRole={user.role}
              currentUsername={user.username}
              onOpenCreatePlan={() => setIsCreateMonthlyProductPlanOpen(true)}
            />
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
                      {(user.username === 'adminc' || user.username === 'adminc1') && (
                        <button
                          onClick={() => {
                            setWarehouseDebtClient(null);
                            setIsAddWarehouseDebtOpen(true);
                          }}
                          className="self-start sm:self-auto flex items-center gap-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all min-h-[44px] cursor-pointer"
                          title="Ombordagi mahsulotlar valyutasida mijozga qarzdorlik qo'shish"
                        >
                          <Warehouse className="w-4 h-4 stroke-[2.2]" />
                          <span>Ombordagi qarzdorlikni qo'shish</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setEditingWarehouseProduct(null);
                          setIsWarehouseModalOpen(true);
                        }}
                        className="self-start sm:self-auto flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 active:bg-black text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all min-h-[44px] cursor-pointer"
                        title="Omborga mahsulotlar kiritish"
                      >
                        <PackagePlus className="w-4 h-4 stroke-[2.2] text-rose-400" />
                        <span>Omborga mahsulotlar kiritish</span>
                      </button>

                      {(user.username === 'adminc' || user.username === 'adminc1') && (
                        <button
                          onClick={() => {
                            setEditingClient(null);
                            setClientFormInitialMode('excel');
                            setIsFormModalOpen(true);
                          }}
                          className="self-start sm:self-auto flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all min-h-[44px] cursor-pointer"
                          title="Excel (.xlsx) fayldan qator va ustunlarni tanlab mijozlarni ommaviy yuklash"
                        >
                          <FileSpreadsheet className="w-4 h-4 stroke-[2.2]" />
                          <span>Excel (.xlsx) dan yuklash</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setEditingClient(null);
                          setClientFormInitialMode('single');
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
                    onEditClient={(client) => {
                      setEditingClient(client);
                      setIsFormModalOpen(true);
                    }}
                    onDeleteClient={handleDeleteClient}
                    onQuickPayment={(client) => {
                      setPaymentClient(client);
                      setIsPaymentModalOpen(true);
                    }}
                    onOpenWarehouseDebtModal={(client) => {
                      setWarehouseDebtClient(client || null);
                      setIsAddWarehouseDebtOpen(true);
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
                    onEditWarehouseProduct={(prod) => {
                      setEditingWarehouseProduct(prod);
                      setIsWarehouseModalOpen(true);
                    }}
                    onDeleteWarehouseProduct={handleDeleteWarehouseProduct}
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-bold font-display text-neutral-900 tracking-tight">
                      3. Agentlar rejasi va hisobotlari
                    </h2>
                    <span className="text-[11px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                      {dailyPlans.filter((p) => !p.isClosed && p.status !== 'yopildi').length} ta ochiq reja
                    </span>
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
                  <AdminAgentPlansTable plans={dailyPlans} clients={clients} />
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
                    onPurgeLogs={handlePurgeLogs}
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
          setClientFormInitialMode('single');
        }}
        onSave={handleSaveClient}
        onBulkImport={handleBulkImportClients}
        editingClient={editingClient}
        currentUserUsername={user.username}
        userRole={user.role}
        initialMode={clientFormInitialMode}
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
        onOpenWarehouseDebtModal={(client) => {
          setWarehouseDebtClient(client);
          setIsAddWarehouseDebtOpen(true);
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

      {/* Admin (adminc / adminc1): Add Warehouse Debt to Client Modal */}
      <AddWarehouseDebtModal
        isOpen={isAddWarehouseDebtOpen}
        onClose={() => {
          setIsAddWarehouseDebtOpen(false);
          setWarehouseDebtClient(null);
        }}
        clients={clients}
        initialClient={warehouseDebtClient}
        warehouseProducts={warehouseProducts}
        currentUsername={user.username}
        onSaveWarehouseDebt={handleSaveWarehouseDebt}
      />

      {/* Agent & Admin: Create 1-Month Debt Recovery Plan Modal */}
      <CreateMonthlyPlanModal
        isOpen={isCreateMonthlyPlanOpen}
        onClose={() => setIsCreateMonthlyPlanOpen(false)}
        warehouseProducts={warehouseProducts}
        currentUsername={user.username}
        existingPlan={activeMonthlyPlan}
        onSavePlan={handleSaveMonthlyPlan}
      />

      {/* Agent & Admin: Create 1-Month Product Delivery Plan Modal */}
      <CreateMonthlyProductPlanModal
        isOpen={isCreateMonthlyProductPlanOpen}
        onClose={() => setIsCreateMonthlyProductPlanOpen(false)}
        warehouseProducts={warehouseProducts}
        currentUsername={user.username}
        existingPlan={activeMonthlyProductPlan}
        onSavePlan={handleSaveMonthlyProductPlan}
      />

      {/* Agent: Create Daily Plan Modal */}
      <CreateDailyPlanModal
        isOpen={isCreatePlanOpen}
        onClose={() => setIsCreatePlanOpen(false)}
        clients={clients}
        existingPlans={dailyPlans}
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

      {/* Admin: Warehouse Intake / Edit Modal (Omborga mahsulotlar kiritish va tahrirlash) */}
      <WarehouseIntakeModal
        isOpen={isWarehouseModalOpen}
        onClose={() => {
          setIsWarehouseModalOpen(false);
          setEditingWarehouseProduct(null);
        }}
        onSave={handleSaveWarehouseProduct}
        onBulkImport={handleBulkImportWarehouseProducts}
        onUpdate={handleUpdateWarehouseProduct}
        editingProduct={editingWarehouseProduct}
        currentUsername={user.username}
      />

      {/* Admin: Warehouse Inventory Modal (Ombordagi zaxiralar) */}
      <WarehouseInventoryModal
        isOpen={isWarehouseInventoryModalOpen}
        onClose={() => setIsWarehouseInventoryModalOpen(false)}
        products={warehouseProducts}
        onEditProduct={(prod) => {
          setIsWarehouseInventoryModalOpen(false);
          setEditingWarehouseProduct(prod);
          setIsWarehouseModalOpen(true);
        }}
        onDeleteProduct={handleDeleteWarehouseProduct}
        onOpenIntakeModal={() => {
          setEditingWarehouseProduct(null);
          setIsWarehouseModalOpen(true);
        }}
      />
    </div>
  );
}
