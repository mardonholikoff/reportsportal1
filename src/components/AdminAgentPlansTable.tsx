import React, { useState, useMemo } from 'react';
import { DailyPlanItem } from '../types';
import { formatMoney, formatDate } from '../utils/format';
import {
  Users,
  CheckCircle2,
  Clock,
  Phone,
  MapPin,
  CreditCard,
  Package,
  Activity,
  Search,
  Filter,
  Coins,
  Undo2,
  Lock,
  MinusCircle,
  Eye,
  X,
  FileText,
  TrendingUp,
  Receipt,
  PackageCheck,
  PackageMinus,
  Calendar,
} from 'lucide-react';

interface Props {
  plans: DailyPlanItem[];
}

export const AdminAgentPlansTable: React.FC<Props> = ({ plans }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'jarayonda' | 'bajarildi'>('all');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [inspectedPlan, setInspectedPlan] = useState<DailyPlanItem | null>(null);

  // Remaining 24h helper
  const getRemainingTimeStr = (createdAt: string) => {
    const created = new Date(createdAt).getTime();
    const expires = created + 24 * 60 * 60 * 1000;
    const diffMs = expires - Date.now();
    if (diffMs <= 0) return '24 soat tugagan';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours} soat ${mins} daqiqa qoldi`;
  };

  // Helper to extract all action transactions for a plan item
  const getPlanActions = (p: DailyPlanItem) => {
    if (p.actionsHistory && p.actionsHistory.length > 0) {
      return p.actionsHistory;
    }
    if (
      p.actionDone ||
      p.financialAction ||
      p.productsDelivered ||
      p.deliveryPayment ||
      p.productsReturned
    ) {
      return [
        {
          timestamp: p.completedAt || p.createdAt,
          author: p.agentUsername,
          actionDone: p.actionDone || ('joyiga borildi' as const),
          financialAction: p.financialAction,
          deliveryPayment: p.deliveryPayment,
          productsDelivered: p.productsDelivered,
          productsReturned: p.productsReturned,
          reportNote: p.reportNote,
        },
      ];
    }
    return [];
  };

  // Unique agents list
  const uniqueAgents = useMemo(() => {
    const set = new Set<string>();
    plans.forEach((p) => {
      if (p.agentUsername) set.add(p.agentUsername);
    });
    return Array.from(set).sort();
  }, [plans]);

  // Comprehensive analytics calculation across all plans
  const analytics = useMemo(() => {
    let totalClients = plans.length;
    let completedClients = 0; // Only when isClosed === true or status === 'yopildi'
    let inProgressClients = 0; // Not closed

    let totalReceipts = 0; // Jami tushumlar
    const receiptsByType = {
      naqd: { amount: 0, count: 0, label: 'Naqd pul' },
      bank: { amount: 0, count: 0, label: "Bank o'tkazmasi" },
      karta: { amount: 0, count: 0, label: "Karta o'tkazmasi" },
      qr: { amount: 0, count: 0, label: "QR to'lov" },
    };

    let totalDeliveredSum = 0; // Mahsulot berilishi jami summasi
    let totalDeliveredPieces = 0; // Mahsulot berilishi jami soni
    let totalReturnedSum = 0; // Mahsulot qaytishi jami summasi
    let totalReturnedPieces = 0; // Mahsulot qaytishi jami soni

    plans.forEach((p) => {
      const isClosed = p.isClosed || p.status === 'yopildi';
      if (isClosed) {
        completedClients++;
      } else {
        inProgressClients++;
      }

      const actions = getPlanActions(p);
      actions.forEach((act) => {
        // 1. Direct financial action from Section 2
        if (act.financialAction && act.financialAction.amount > 0) {
          const amt = act.financialAction.amount;
          totalReceipts += amt;
          const methodStr = (act.financialAction.methodLabel || '').toLowerCase();

          if (methodStr.includes('bank')) {
            receiptsByType.bank.amount += amt;
            receiptsByType.bank.count++;
          } else if (methodStr.includes('karta')) {
            receiptsByType.karta.amount += amt;
            receiptsByType.karta.count++;
          } else if (methodStr.includes('qr')) {
            receiptsByType.qr.amount += amt;
            receiptsByType.qr.count++;
          } else {
            receiptsByType.naqd.amount += amt;
            receiptsByType.naqd.count++;
          }
        }

        // 2. Delivery payment from Section 3
        if (act.deliveryPayment && act.deliveryPayment.paidAmount > 0) {
          const amt = act.deliveryPayment.paidAmount;
          totalReceipts += amt;
          const pt = act.deliveryPayment.paymentType;

          if (pt === 'bank') {
            receiptsByType.bank.amount += amt;
            receiptsByType.bank.count++;
          } else if (pt === 'karta') {
            receiptsByType.karta.amount += amt;
            receiptsByType.karta.count++;
          } else if (pt === 'qr') {
            receiptsByType.qr.amount += amt;
            receiptsByType.qr.count++;
          } else {
            receiptsByType.naqd.amount += amt;
            receiptsByType.naqd.count++;
          }
        }

        // 3. Delivered products sum and count
        if (act.productsDelivered && act.productsDelivered.length > 0) {
          act.productsDelivered.forEach((prod) => {
            const lineVal = prod.totalPrice || (prod.quantity || 0) * (prod.unitPrice || 0);
            totalDeliveredSum += lineVal;
            totalDeliveredPieces += prod.quantity || 0;
          });
        }

        // 4. Returned products sum and count
        if (act.productsReturned && act.productsReturned.length > 0) {
          act.productsReturned.forEach((ret) => {
            const lineVal = (ret.quantity || 0) * (ret.unitPrice || 0);
            totalReturnedSum += lineVal;
            totalReturnedPieces += ret.quantity || 0;
          });
        }
      });
    });

    const getPct = (amt: number) => {
      if (totalReceipts <= 0) return 0;
      return Math.round((amt / totalReceipts) * 100);
    };

    return {
      totalClients,
      completedClients,
      inProgressClients,
      totalReceipts,
      receiptsByType: {
        naqd: { ...receiptsByType.naqd, percent: getPct(receiptsByType.naqd.amount) },
        bank: { ...receiptsByType.bank, percent: getPct(receiptsByType.bank.amount) },
        karta: { ...receiptsByType.karta, percent: getPct(receiptsByType.karta.amount) },
        qr: { ...receiptsByType.qr, percent: getPct(receiptsByType.qr.amount) },
      },
      totalDeliveredSum,
      totalDeliveredPieces,
      totalReturnedSum,
      totalReturnedPieces,
    };
  }, [plans]);

  // Filtered plans list
  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      // 1. Search filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchesClient = p.clientName.toLowerCase().includes(q);
        const matchesPhone = p.clientPhone.toLowerCase().includes(q);
        const matchesAddress = (p.clientAddress || '').toLowerCase().includes(q);
        const matchesAgent = p.agentUsername.toLowerCase().includes(q);
        const matchesNote = (p.planNote || '').toLowerCase().includes(q);
        if (!matchesClient && !matchesPhone && !matchesAddress && !matchesAgent && !matchesNote) {
          return false;
        }
      }

      // 2. Status filter: To'liq yopilmaguncha mijoz holati jarayonda deb ko'riladi
      const isClosed = p.isClosed || p.status === 'yopildi';
      if (statusFilter === 'bajarildi' && !isClosed) return false;
      if (statusFilter === 'jarayonda' && isClosed) return false;

      // 3. Agent filter
      if (selectedAgent !== 'all' && p.agentUsername !== selectedAgent) {
        return false;
      }

      return true;
    });
  }, [plans, searchTerm, statusFilter, selectedAgent]);

  return (
    <div className="space-y-5">
      {/* ========================================================= */}
      {/* 4 TA TAHLILIY STATISTIKA KARTALARI (Admin uchun) */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KARTA 1: Jami rejadagi bugungi mijozlar */}
        <div className="p-4 sm:p-5 rounded-3xl bg-neutral-900 text-white shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[140px]">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-neutral-300 uppercase tracking-wide">
                Jami rejadagi mijozlar
              </span>
              <Users className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold font-display tabular-nums">
              {analytics.totalClients} ta mijoz
            </div>
          </div>
          <div className="text-[11px] text-neutral-400 flex items-center gap-2 pt-2 border-t border-neutral-800">
            <span className="text-emerald-400 font-semibold">
              ● {analytics.completedClients} ta bajarildi
            </span>
            <span className="text-neutral-500">·</span>
            <span className="text-amber-300 font-semibold">
              ● {analytics.inProgressClients} ta jarayonda
            </span>
          </div>
        </div>

        {/* KARTA 2: Tushumlar va barcha turdagi to'lovlarning foizlari/summalari */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-rose-100 shadow-xs flex flex-col justify-between min-h-[140px] space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-neutral-700 uppercase tracking-wide">
                Tushumlar
              </span>
              <Receipt className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold font-display font-mono text-emerald-800 tabular-nums">
              {formatMoney(analytics.totalReceipts)} so'm
            </div>
          </div>

          {/* To'lov turlari bo'yicha summa va foizlar */}
          <div className="space-y-1.5 pt-2 border-t border-neutral-100">
            {/* Visual multi-color stacked bar */}
            {analytics.totalReceipts > 0 ? (
              <div className="h-2 w-full rounded-full bg-neutral-100 overflow-hidden flex">
                <div
                  style={{ width: `${analytics.receiptsByType.naqd.percent}%` }}
                  className="bg-emerald-500 h-full"
                  title={`Naqd: ${analytics.receiptsByType.naqd.percent}%`}
                />
                <div
                  style={{ width: `${analytics.receiptsByType.bank.percent}%` }}
                  className="bg-blue-500 h-full"
                  title={`Bank: ${analytics.receiptsByType.bank.percent}%`}
                />
                <div
                  style={{ width: `${analytics.receiptsByType.karta.percent}%` }}
                  className="bg-purple-500 h-full"
                  title={`Karta: ${analytics.receiptsByType.karta.percent}%`}
                />
                <div
                  style={{ width: `${analytics.receiptsByType.qr.percent}%` }}
                  className="bg-amber-500 h-full"
                  title={`QR: ${analytics.receiptsByType.qr.percent}%`}
                />
              </div>
            ) : null}

            {/* List of 4 types with sums & percentages */}
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
              <div className="flex items-center justify-between text-neutral-700">
                <span className="flex items-center gap-1 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  Naqd:
                </span>
                <span className="font-mono font-bold text-neutral-900">
                  {analytics.receiptsByType.naqd.percent}%
                </span>
              </div>

              <div className="flex items-center justify-between text-neutral-700">
                <span className="flex items-center gap-1 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                  Bank:
                </span>
                <span className="font-mono font-bold text-neutral-900">
                  {analytics.receiptsByType.bank.percent}%
                </span>
              </div>

              <div className="flex items-center justify-between text-neutral-700">
                <span className="flex items-center gap-1 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                  Karta:
                </span>
                <span className="font-mono font-bold text-neutral-900">
                  {analytics.receiptsByType.karta.percent}%
                </span>
              </div>

              <div className="flex items-center justify-between text-neutral-700">
                <span className="flex items-center gap-1 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  QR:
                </span>
                <span className="font-mono font-bold text-neutral-900">
                  {analytics.receiptsByType.qr.percent}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* KARTA 3: Mahsulot berilishi (summasi bilan) */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-rose-100 shadow-xs flex flex-col justify-between min-h-[140px]">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-neutral-700 uppercase tracking-wide">
                Mahsulot berilishi
              </span>
              <PackageCheck className="w-4 h-4 text-rose-700" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold font-display font-mono text-rose-900 tabular-nums">
              {formatMoney(analytics.totalDeliveredSum)} so'm
            </div>
          </div>
          <div className="text-[11px] text-neutral-500 pt-2 border-t border-neutral-100 flex items-center justify-between">
            <span>Topshirilgan tovarlar:</span>
            <span className="font-bold font-mono text-neutral-800">
              {analytics.totalDeliveredPieces} dona
            </span>
          </div>
        </div>

        {/* KARTA 4: Mahsulot qaytishi (summasi bilan) */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-rose-100 shadow-xs flex flex-col justify-between min-h-[140px]">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-neutral-700 uppercase tracking-wide">
                Mahsulot qaytishi
              </span>
              <PackageMinus className="w-4 h-4 text-amber-700" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold font-display font-mono text-amber-900 tabular-nums">
              {formatMoney(analytics.totalReturnedSum)} so'm
            </div>
          </div>
          <div className="text-[11px] text-neutral-500 pt-2 border-t border-neutral-100 flex items-center justify-between">
            <span>Omborga qaytgan tovarlar:</span>
            <span className="font-bold font-mono text-neutral-800">
              {analytics.totalReturnedPieces} dona
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* FILTRLAR VA QIDIRUV PANELI */}
      {/* ========================================================= */}
      <div className="p-4 rounded-2xl bg-white border border-rose-100/90 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Matn qidirish */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Mijoz, telefon, manzil yoki izoh bo'yicha qidirish..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-neutral-50 focus:bg-white rounded-xl border border-neutral-200 focus:border-rose-500 outline-none transition"
          />
        </div>

        {/* Agent va holat bo'yicha filtrlar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Agent tanlash */}
          {uniqueAgents.length > 1 && (
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="px-3 py-2 text-xs font-semibold bg-neutral-50 rounded-xl border border-neutral-200 outline-none cursor-pointer"
            >
              <option value="all">Barcha agentlar ({uniqueAgents.length})</option>
              {uniqueAgents.map((ag) => (
                <option key={ag} value={ag}>
                  Agent: {ag}
                </option>
              ))}
            </select>
          )}

          {/* Holat filtri */}
          <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                statusFilter === 'all'
                  ? 'bg-white text-neutral-900 shadow-2xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Barchasi ({plans.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('jarayonda')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                statusFilter === 'jarayonda'
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Jarayonda ({analytics.inProgressClients})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('bajarildi')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                statusFilter === 'bajarildi'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Bajarildi ({analytics.completedClients})
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* JADVAL QISMI */}
      {/* ========================================================= */}
      {filteredPlans.length === 0 ? (
        <div className="p-10 text-center rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
          <Activity className="w-8 h-8 text-neutral-400 mx-auto" />
          <h4 className="text-sm font-bold text-neutral-800">
            {plans.length === 0
              ? 'Hozircha agentlar tomonidan faol kunlik reja tuzilmagan'
              : "Filtr bo'yicha rejalar topilmadi"}
          </h4>
          {plans.length > 0 && (
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              Qidiruv mezonlarini o'zgartirib ko'ring.
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-rose-100 bg-white shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-rose-50/70 border-b border-rose-100 text-neutral-800 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-3.5">#</th>
                <th className="py-3 px-3.5">Agent</th>
                <th className="py-3 px-3.5">Mijoz & Telefon</th>
                <th className="py-3 px-3.5">Manzili</th>
                <th className="py-3 px-3.5">Reja izohi</th>
                <th className="py-3 px-3.5">Holati</th>
                <th className="py-3 px-3.5">Qilingan amallar</th>
                <th className="py-3 px-3.5 text-right">Tushumlar</th>
                <th className="py-3 px-3.5 text-right">Tovar berilishi / qaytishi</th>
                <th className="py-3 px-3.5">Bajarilgan vaqt</th>
                <th className="py-3 px-3.5 text-center">Batafsil</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-100/60">
              {filteredPlans.map((item, idx) => {
                // To'liq yopilmaguncha mijoz holati jarayonda deb va holati ko'rilsin va faqat to'liq yopilganda bajarildi deb oxirgi holati ko'rilsin
                const isClosed = item.isClosed || item.status === 'yopildi';
                const actions = getPlanActions(item);
                const hasActions = actions.length > 0;

                // Sums for this specific plan
                let planReceipts = 0;
                let planReceiptMethods: string[] = [];
                let planDeliveredSum = 0;
                let planDeliveredCount = 0;
                let planReturnedSum = 0;
                let planReturnedCount = 0;
                let visitActionLabels: string[] = [];

                actions.forEach((act) => {
                  if (act.actionDone && !visitActionLabels.includes(act.actionDone)) {
                    visitActionLabels.push(act.actionDone);
                  }

                  if (act.financialAction && act.financialAction.amount > 0) {
                    planReceipts += act.financialAction.amount;
                    const l = act.financialAction.methodLabel || 'To\'lov';
                    if (!planReceiptMethods.includes(l)) planReceiptMethods.push(l);
                  }

                  if (act.deliveryPayment && act.deliveryPayment.paidAmount > 0) {
                    planReceipts += act.deliveryPayment.paidAmount;
                    const l = act.deliveryPayment.paymentLabel || 'Tovar to\'lovi';
                    if (!planReceiptMethods.includes(l)) planReceiptMethods.push(l);
                  }

                  if (act.productsDelivered && act.productsDelivered.length > 0) {
                    act.productsDelivered.forEach((p) => {
                      const v = p.totalPrice || (p.quantity || 0) * (p.unitPrice || 0);
                      planDeliveredSum += v;
                      planDeliveredCount += p.quantity || 0;
                    });
                  }

                  if (act.productsReturned && act.productsReturned.length > 0) {
                    act.productsReturned.forEach((r) => {
                      const v = (r.quantity || 0) * (r.unitPrice || 0);
                      planReturnedSum += v;
                      planReturnedCount += r.quantity || 0;
                    });
                  }
                });

                return (
                  <tr key={item.id} className="hover:bg-rose-50/30 transition-colors">
                    {/* Index */}
                    <td className="py-3 px-3.5 font-mono text-neutral-400">{idx + 1}</td>

                    {/* Agent */}
                    <td className="py-3 px-3.5">
                      <span className="px-2 py-0.5 rounded-md font-mono font-bold text-xs bg-amber-100 text-amber-900 border border-amber-200">
                        {item.agentUsername}
                      </span>
                    </td>

                    {/* Mijoz & Telefon */}
                    <td className="py-3 px-3.5">
                      <div className="font-bold text-neutral-900">{item.clientName}</div>
                      <div className="text-[11px] font-mono text-neutral-500">{item.clientPhone}</div>
                      <div className="text-[10px] font-mono text-neutral-500 mt-0.5 flex items-center gap-1">
                        <Calendar className="w-2.5 h-2.5 text-neutral-400 shrink-0" />
                        <span>Qo'shilgan: {formatDate(item.createdAt)}</span>
                      </div>
                    </td>

                    {/* Manzili */}
                    <td className="py-3 px-3.5 max-w-[160px]">
                      <div className="text-neutral-700">
                        <span
                          className="font-semibold text-neutral-900 block truncate"
                          title={item.clientAddress}
                        >
                          {[item.clientRegion, item.clientDistrict].filter(Boolean).join(', ') ||
                            item.clientAddress ||
                            "Ko'rsatilmagan"}
                        </span>
                        {item.clientLandmark && (
                          <span
                            className="text-[10px] text-neutral-500 block truncate"
                            title={`Mo'ljal: ${item.clientLandmark}`}
                          >
                            Mo'ljal: {item.clientLandmark}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Reja izohi */}
                    <td className="py-3 px-3.5 max-w-[160px] text-[11px]" title={item.planNote}>
                      {item.planNote ? (
                        <span className="font-medium text-neutral-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 block truncate">
                          {item.planNote}
                        </span>
                      ) : (
                        <span className="text-neutral-400 italic">-</span>
                      )}
                    </td>

                    {/* HOLATI: To'liq yopilmaguncha mijoz holati jarayonda deb va holati ko'rilsin va faqat to'liq yopilganda bajarildi deb oxirgi holati ko'rilsin */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      {isClosed ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Bajarildi</span>
                          </span>
                          <span className="text-[10px] text-neutral-500 block font-medium">
                            Oxirgi holat: Yopilgan
                          </span>
                          {item.closeReason && (
                            <span
                              className="text-[10px] text-rose-800 font-bold block max-w-[190px] truncate bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200"
                              title={`Yopilish sababi: ${item.closeReason}`}
                            >
                              Sabab: {item.closeReason}
                            </span>
                          )}
                          {item.closedBy && (
                            <span className="text-[9px] text-neutral-400 block font-mono">
                              @{item.closedBy} tomonidan
                            </span>
                          )}
                        </div>
                      ) : (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                            <Clock className="w-3.5 h-3.5 text-amber-700" />
                            <span>Jarayonda</span>
                          </span>
                          <span className="text-[10px] text-neutral-500 block mt-0.5 font-medium">
                            {hasActions
                              ? `${actions.length} ta amal bajarilgan`
                              : 'Amal kutilmoqda'}
                          </span>
                          <span className="text-[9px] text-neutral-400 font-mono block">
                            {getRemainingTimeStr(item.createdAt)}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* QILINGAN AMALLAR: joyiga borish va boshqalardan tashqari to'lov, mahsulot berish, qaytarib olish hammasi to'liq ko'rinsin, agar amal bo'lmasa 'Amal yo'q' deb chiqsin */}
                    <td className="py-3 px-3.5 max-w-[240px]">
                      {!hasActions ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-neutral-100 text-neutral-500 border border-neutral-200">
                          <MinusCircle className="w-3 h-3 text-neutral-400" />
                          <span>Amal yo'q</span>
                        </span>
                      ) : (
                        <div className="space-y-1">
                          {/* Tashrif turi */}
                          {visitActionLabels.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {visitActionLabels.map((vLabel, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-900 font-bold text-[10px]"
                                >
                                  {vLabel}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* To'lov amali */}
                          {planReceipts > 0 && (
                            <div className="flex items-center gap-1 text-[11px] text-emerald-800 font-semibold">
                              <Receipt className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>To'lov: +{formatMoney(planReceipts)} so'm</span>
                            </div>
                          )}

                          {/* Mahsulot berish */}
                          {planDeliveredSum > 0 && (
                            <div className="flex items-center gap-1 text-[11px] text-rose-800 font-semibold">
                              <PackageCheck className="w-3 h-3 text-rose-600 shrink-0" />
                              <span>
                                Berildi: {formatMoney(planDeliveredSum)} ({planDeliveredCount} dona)
                              </span>
                            </div>
                          )}

                          {/* Mahsulot qaytarish */}
                          {planReturnedSum > 0 && (
                            <div className="flex items-center gap-1 text-[11px] text-amber-800 font-semibold">
                              <PackageMinus className="w-3 h-3 text-amber-600 shrink-0" />
                              <span>
                                Qaytarildi: {formatMoney(planReturnedSum)} ({planReturnedCount} dona)
                              </span>
                            </div>
                          )}

                          {/* Rejadagi amallar soni */}
                          {actions.length > 1 && (
                            <span className="text-[10px] text-neutral-400 block italic">
                              (Jami {actions.length} marta amal bajarildi)
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* TUSHUMLAR */}
                    <td className="py-3 px-3.5 text-right whitespace-nowrap">
                      {planReceipts > 0 ? (
                        <div>
                          <span className="font-mono font-extrabold text-sm text-emerald-800">
                            +{formatMoney(planReceipts)} so'm
                          </span>
                          <div className="text-[10px] text-neutral-500 font-medium truncate max-w-[140px]">
                            {planReceiptMethods.join(', ')}
                          </div>
                        </div>
                      ) : (
                        <span className="text-neutral-400 italic">0 so'm</span>
                      )}
                    </td>

                    {/* TOVAR BERILISHI / QAYTISHI */}
                    <td className="py-3 px-3.5 text-right whitespace-nowrap">
                      {planDeliveredSum > 0 || planReturnedSum > 0 ? (
                        <div className="space-y-0.5">
                          {planDeliveredSum > 0 && (
                            <div className="text-[11px] font-mono font-bold text-rose-800">
                              Berildi: {formatMoney(planDeliveredSum)}
                            </div>
                          )}
                          {planReturnedSum > 0 && (
                            <div className="text-[10px] font-mono font-semibold text-amber-700">
                              Qaytdi: {formatMoney(planReturnedSum)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-neutral-400">-</span>
                      )}
                    </td>

                    {/* Bajarilgan vaqt */}
                    <td className="py-3 px-3.5 whitespace-nowrap text-[11px] text-neutral-600">
                      {item.completedAt ? (
                        formatDate(item.completedAt)
                      ) : (
                        <span className="text-neutral-400 italic">Hali bajarilmadi</span>
                      )}
                    </td>

                    {/* Batafsil ko'rish tugmasi */}
                    <td className="py-3 px-3.5 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setInspectedPlan(item)}
                        className="p-1.5 rounded-xl bg-neutral-100 hover:bg-rose-100 text-neutral-700 hover:text-rose-900 transition cursor-pointer"
                        title="Batafsil ma'lumotlarni ko'rish"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================================= */}
      {/* BATAFSIL MODAL: PLAN ITEM BO'YICHA TO'LIQ AMALLAR TARIXI */}
      {/* ========================================================= */}
      {inspectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-rose-100 my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-rose-50/80 via-white to-rose-50/40 border-b border-rose-100 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-md">
                    Agent rejasi tafsilotlari
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">
                    Agent: {inspectedPlan.agentUsername}
                  </span>
                </div>
                <h3 className="text-lg font-bold font-display text-neutral-900 mt-1">
                  {inspectedPlan.clientName}
                </h3>
                <div className="text-xs text-neutral-500 font-mono">{inspectedPlan.clientPhone}</div>
              </div>

              <button
                type="button"
                onClick={() => setInspectedPlan(null)}
                className="w-9 h-9 rounded-xl bg-white hover:bg-rose-50 text-neutral-600 hover:text-neutral-900 border border-neutral-200 flex items-center justify-center transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Status Banner */}
              <div
                className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                  inspectedPlan.isClosed || inspectedPlan.status === 'yopildi'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-amber-50 border-amber-200 text-amber-950'
                }`}
              >
                <div className="flex items-center gap-2">
                  {inspectedPlan.isClosed || inspectedPlan.status === 'yopildi' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                  ) : (
                    <Clock className="w-5 h-5 text-amber-700 shrink-0" />
                  )}
                  <div>
                    <span className="font-bold text-xs block">
                      Holat: {inspectedPlan.isClosed || inspectedPlan.status === 'yopildi' ? "Bajarildi (To'liq yopilgan)" : 'Jarayonda'}
                    </span>
                    <span className="text-[11px] opacity-80">
                      Tuzilgan sana: {formatDate(inspectedPlan.createdAt)} · {getRemainingTimeStr(inspectedPlan.createdAt)}
                    </span>
                  </div>
                </div>

                {inspectedPlan.closedAt && (
                  <span className="text-[10px] font-mono text-emerald-800 bg-white/70 px-2 py-1 rounded border border-emerald-200">
                    Yopildi: {formatDate(inspectedPlan.closedAt)}
                  </span>
                )}
              </div>

              {/* Yopilish sababi */}
              {inspectedPlan.closeReason && (
                <div className="p-3.5 bg-rose-50/80 rounded-2xl border border-rose-200 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-rose-900">
                    <Lock className="w-4 h-4 text-rose-700 shrink-0" />
                    <span>Reja yopilish sababi:</span>
                  </div>
                  <div className="text-neutral-900 font-semibold pl-5 text-[13px]">
                    "{inspectedPlan.closeReason}"
                  </div>
                  {inspectedPlan.closedBy && (
                    <div className="text-[10px] text-neutral-500 font-mono pl-5 pt-0.5">
                      Yopgan mas'ul: @{inspectedPlan.closedBy} {inspectedPlan.closedAt ? `(${formatDate(inspectedPlan.closedAt)})` : ''}
                    </div>
                  )}
                </div>
              )}

              {/* Plan Note */}
              {inspectedPlan.planNote && (
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs">
                  <span className="font-bold text-neutral-700 block mb-0.5">Rejadagi izoh:</span>
                  <span className="text-neutral-900">{inspectedPlan.planNote}</span>
                </div>
              )}

              {/* Actions History List */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-neutral-800 uppercase tracking-wide block">
                  Bajarilgan amallar xronologiyasi ({getPlanActions(inspectedPlan).length} ta)
                </span>

                {getPlanActions(inspectedPlan).length === 0 ? (
                  <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 text-neutral-500 text-xs text-center">
                    Ushbu mijoz ustida hali hech qanday amal bajarilmagan (Amal yo'q).
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {getPlanActions(inspectedPlan).map((act, actIdx) => (
                      <div
                        key={actIdx}
                        className="p-3.5 bg-white rounded-xl border border-rose-100 shadow-2xs space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs pb-1.5 border-b border-neutral-100">
                          <span className="font-bold text-rose-800">
                            Amal #{actIdx + 1}: {act.actionDone}
                          </span>
                          <span className="text-[10px] text-neutral-500 font-mono">
                            {formatDate(act.timestamp)} ({act.author})
                          </span>
                        </div>

                        {/* Financial operation */}
                        {act.financialAction && act.financialAction.amount > 0 && (
                          <div className="p-2 bg-emerald-50 rounded-lg text-xs text-emerald-900 flex items-center justify-between">
                            <span>To'lov qabul qilindi:</span>
                            <span className="font-mono font-bold">
                              +{formatMoney(act.financialAction.amount)}{' '}
                              {act.financialAction.currency || "so'm"} (
                              {act.financialAction.methodLabel})
                            </span>
                          </div>
                        )}

                        {/* Delivery payment */}
                        {act.deliveryPayment && (
                          <div className="p-2 bg-rose-50 rounded-lg text-xs text-rose-950 flex items-center justify-between">
                            <span>Tovar to'lov shakli:</span>
                            <span className="font-bold">
                              {act.deliveryPayment.paymentLabel} ({formatMoney(act.deliveryPayment.paidAmount)} {act.deliveryPayment.currency || "so'm"})
                            </span>
                          </div>
                        )}

                        {/* Delivered products */}
                        {act.productsDelivered && act.productsDelivered.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[11px] font-semibold text-neutral-600 block">
                              Topshirilgan tovarlar:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {act.productsDelivered.map((p, pIdx) => (
                                <span
                                  key={pIdx}
                                  className="px-2 py-0.5 bg-neutral-100 rounded text-[11px] text-neutral-800"
                                >
                                  <strong>{p.name}</strong>: {p.quantity} {p.unit} ({formatMoney(p.totalPrice || p.quantity * p.unitPrice)} so'm)
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Returned products */}
                        {act.productsReturned && act.productsReturned.length > 0 && (
                          <div className="space-y-1 pt-1 border-t border-neutral-100">
                            <span className="text-[11px] font-semibold text-amber-800 block">
                              Omborga qaytarilgan tovarlar:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {act.productsReturned.map((r, rIdx) => (
                                <span
                                  key={rIdx}
                                  className="px-2 py-0.5 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900"
                                >
                                  <strong>{r.name}</strong>: {r.quantity} {r.unit} ({formatMoney((r.quantity || 0) * (r.unitPrice || 0))} so'm)
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Report note */}
                        {act.reportNote && (
                          <div className="text-[11px] text-neutral-600 italic bg-neutral-50 p-2 rounded">
                            "{act.reportNote}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectedPlan(null)}
                className="px-5 py-2 rounded-xl bg-neutral-900 text-white text-xs font-bold hover:bg-neutral-800 transition"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
