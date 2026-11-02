import React, { useState, useMemo } from 'react';
import { Client } from '../types';
import { formatMoney, formatDate, formatNumber } from '../utils/format';
import { storageService } from '../services/storage';
import {
  X,
  Phone,
  MapPin,
  Calendar,
  CreditCard,
  Edit,
  Trash2,
  Printer,
  Package,
  History,
  FileText,
  UserCheck,
  Lock,
  Warehouse,
} from 'lucide-react';
import { NakladnoyModal, NakladnoyData } from './NakladnoyModal';

interface Props {
  client: Client | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (client: Client) => void;
  onDelete: (clientId: string) => void;
  onQuickPayment: (client: Client) => void;
  onOpenWarehouseDebtModal?: (client: Client) => void;
  userRole?: 'admin' | 'agent';
  currentUsername?: string;
}

export const ClientDetailModal: React.FC<Props> = ({
  client,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onQuickPayment,
  onOpenWarehouseDebtModal,
  userRole = 'admin',
  currentUsername,
}) => {
  const isAgent = userRole === 'agent';
  const canDelete = currentUsername === 'adminc' || currentUsername === 'adminc1';
  const canAddWarehouseDebt = currentUsername === 'adminc' || currentUsername === 'adminc1';
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [nakladnoyData, setNakladnoyData] = useState<NakladnoyData | null>(null);

  // Compute the latest note by agentp1 regarding this client
  const latestAgentNote = useMemo(() => {
    if (!client) return null;
    const candidates: { text: string; author: string; date: string }[] = [];

    // 1. From all daily plans for this client
    try {
      const allPlans = storageService.getDailyPlans().filter((p) => p.clientId === client.id);
      allPlans.forEach((p) => {
        // Check actionsHistory first (most specific and chronological)
        if (p.actionsHistory && p.actionsHistory.length > 0) {
          p.actionsHistory.forEach((act) => {
            if (act.reportNote && act.reportNote.trim()) {
              candidates.push({
                text: act.reportNote.trim(),
                author: act.author || p.agentUsername || 'agentp1',
                date: act.timestamp || p.completedAt || p.createdAt,
              });
            }
          });
        }

        // Check plan-level reportNote
        if (p.reportNote && p.reportNote.trim()) {
          candidates.push({
            text: p.reportNote.trim(),
            author: p.agentUsername || 'agentp1',
            date: p.completedAt || p.createdAt,
          });
        }

        // Check planNote
        if (p.planNote && p.planNote.trim()) {
          candidates.push({
            text: p.planNote.trim(),
            author: p.agentUsername || 'agentp1',
            date: p.createdAt,
          });
        }
      });
    } catch {
      // storage read fallback
    }

    // 2. From client audit logs
    if (client.logs && client.logs.length > 0) {
      client.logs.forEach((log) => {
        if (log.details && log.details.trim()) {
          if (log.author?.toLowerCase().includes('agent') || log.type === 'visit_action') {
            candidates.push({
              text: log.details.trim(),
              author: log.author || 'agentp1',
              date: log.timestamp,
            });
          }
        }
      });
    }

    // 3. From client.notes
    if (client.notes && client.notes.trim()) {
      candidates.push({
        text: client.notes.trim(),
        author: client.createdBy || 'agentp1',
        date: client.updatedAt || client.createdAt,
      });
    }

    if (candidates.length === 0) return null;

    // Sort by date descending (most recent first)
    candidates.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Prefer candidate specifically by agentp1 if viewing as agent
    const agentCandidate = candidates.find((c) =>
      c.author.toLowerCase().includes('agent')
    );
    return agentCandidate || candidates[0];
  }, [client]);

  if (!isOpen || !client) return null;

  const totalProductsValue = client.products.reduce(
    (sum, p) => sum + (p.totalPrice || p.quantity * p.unitPrice),
    0
  );

  const handlePrint = () => {
    setNakladnoyData({
      docNumber: `NK-${client.id.slice(-6).toUpperCase()}`,
      date: client.updatedAt || client.createdAt,
      operationTitle: 'Mijozga biriktirilgan mahsulotlar va hisob-kitob',
      clientName: client.name,
      clientPhones:
        client.phones && client.phones.length > 0
          ? client.phones
          : client.phone
          ? [client.phone]
          : [],
      clientAddress:
        [client.region, client.district, client.landmark].filter(Boolean).join(', ') ||
        client.address,
      authorUsername: currentUsername || client.createdBy || 'agentp1',
      productsDelivered: client.products,
      paymentInfo: {
        paymentLabel: client.currentDebt > 0 ? 'Nasiya (Qarzga)' : "Naqd / To'langan",
        paidAmount:
          client.currentAdvance > 0
            ? client.currentAdvance
            : Math.max(0, totalProductsValue - client.currentDebt),
        debtAmount: client.currentDebt,
        totalClientDebt: client.currentDebt,
      },
      note: client.notes,
    });
  };

  const logs = client.logs || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-rose-100 my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Top Bar */}
        <div className="no-print px-5 sm:px-6 py-4 bg-gradient-to-r from-rose-50/90 via-white to-rose-50/50 border-b border-rose-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-700 text-white font-bold font-display flex items-center justify-center text-base shadow-xs">
              {client.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold font-display text-neutral-900 leading-tight">
                  {client.name}
                </h2>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    client.createdBy === 'agentp1'
                      ? 'bg-amber-100 text-amber-900 border border-amber-200'
                      : 'bg-rose-100 text-rose-900 border border-rose-200'
                  }`}
                >
                  Qo'shgan: {client.createdBy || 'adminc'}
                </span>
              </div>
              <div className="text-xs text-neutral-500 flex items-center gap-2 mt-0.5 font-mono">
                <span>ID: {client.id.slice(0, 10)}</span>
                <span aria-hidden="true">·</span>
                <span>{formatDate(client.createdAt)}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white hover:bg-rose-50 text-neutral-600 hover:text-neutral-900 border border-neutral-200 flex items-center justify-center transition-colors min-h-[44px] min-w-[44px]"
            aria-label="Yopish"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable & Scrollable Content */}
        <div className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Printable Invoice Header (visible when printing) */}
          <div className="hidden print-only mb-6 pb-4 border-b border-neutral-300">
            <div className="text-xl font-bold">SAVDONAZORAT - MIJOZ HISOB-KITOB VARAQASI</div>
            <div className="text-xs text-neutral-600">Sana: {formatDate(new Date().toISOString())}</div>
          </div>

          {/* Contact & Location Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-rose-50/40 border border-rose-100">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-800 shrink-0 mt-0.5">
                <Phone className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-neutral-500 uppercase">
                  Telefon {client.phones && client.phones.length > 1 ? `(${client.phones.length} ta)` : ''}
                </div>
                {client.phones && client.phones.length > 0 ? (
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    {client.phones.map((ph, idx) => (
                      <a
                        key={idx}
                        href={`tel:${ph}`}
                        className="text-sm font-semibold text-neutral-900 hover:text-rose-700 underline font-mono tabular-nums"
                      >
                        {ph}
                      </a>
                    ))}
                  </div>
                ) : (
                  <a
                    href={`tel:${client.phone}`}
                    className="text-sm font-semibold text-neutral-900 hover:text-rose-700 underline font-mono tabular-nums"
                  >
                    {client.phone || "Kiritilmagan"}
                  </a>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-800 shrink-0 mt-0.5">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold text-neutral-500 uppercase">
                  Joylashuv (Manzil)
                </div>
                <div className="text-sm font-bold text-neutral-900 mt-0.5">
                  {[client.region, client.district].filter(Boolean).join(', ') || client.address || "Manzil ko'rsatilmagan"}
                </div>
                {client.landmark && (
                  <div className="text-xs text-neutral-600 mt-0.5">
                    <span className="font-semibold text-neutral-700">Mo'ljal:</span> {client.landmark}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Debt & Advance Balances (Only for Admin, or visible as general summary) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Joriy qarzdorlik */}
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200">
              <div className="text-xs font-bold text-rose-900 uppercase tracking-wide">
                Joriy qarzdorlik
              </div>
              <div className="text-2xl font-bold font-display text-neutral-900 font-mono tabular-nums mt-1">
                {formatMoney(client.currentDebt)}
              </div>
              <div className="text-[11px] text-rose-700 mt-1">
                {client.currentDebt > 0
                  ? "Mijozdan to'lanishi kutilayotgan qarz miqdori"
                  : "Qarzdorlik yo'q (hisob yopilgan)"}
              </div>
            </div>

            {/* Joriy haqdorlik */}
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
              <div className="text-xs font-bold text-emerald-900 uppercase tracking-wide">
                Joriy haqdorlik (Avans)
              </div>
              <div className="text-2xl font-bold font-display text-neutral-900 font-mono tabular-nums mt-1">
                {formatMoney(client.currentAdvance)}
              </div>
              <div className="text-[11px] text-emerald-700 mt-1">
                {client.currentAdvance > 0
                  ? "Mijoz tomonidan ortiqcha to'langan summa"
                  : "Avans to'lovi mavjud emas"}
              </div>
            </div>
          </div>

          {/* Oxirgi reja yakunlanishi va yopilish sababi */}
          {client.lastPlanCloseReason && (
            <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-200 text-xs space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-2 font-bold text-rose-950">
                <Lock className="w-4 h-4 text-rose-700 shrink-0" />
                <span className="text-xs uppercase tracking-wide">Oxirgi kunlik reja yopilish sababi</span>
              </div>
              <div className="text-neutral-900 font-semibold pl-6 text-sm">
                "{client.lastPlanCloseReason}"
              </div>
              <div className="text-[11px] text-neutral-500 font-mono pl-6 flex items-center gap-3">
                {client.lastPlanClosedBy && (
                  <span className="font-semibold text-rose-900">Mas'ul: @{client.lastPlanClosedBy}</span>
                )}
                {client.lastPlanClosedAt && (
                  <span>Sana: {formatDate(client.lastPlanClosedAt)}</span>
                )}
              </div>
            </div>
          )}

          {/* Products Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-rose-700" />
                <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
                  Topshirilgan mahsulotlar ({client.products.length})
                </h3>
              </div>
              <span className="text-xs font-bold font-mono text-neutral-800">
                Jami: {formatMoney(totalProductsValue)}
              </span>
            </div>

            {client.products.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-neutral-50 border border-neutral-200 text-xs text-neutral-500">
                Ushbu mijozga biriktirilgan mahsulotlar mavjud emas.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-rose-100">
                <table className="w-full text-left text-xs">
                  <thead className="bg-rose-50/70 text-neutral-700 border-b border-rose-100">
                    <tr>
                      <th className="py-2.5 px-3 font-bold">#</th>
                      <th className="py-2.5 px-3 font-bold">Mahsulot nomi</th>
                      <th className="py-2.5 px-3 font-bold">O'lchov</th>
                      <th className="py-2.5 px-3 font-bold text-right">Miqdori</th>
                      <th className="py-2.5 px-3 font-bold text-right">Birlik narxi</th>
                      <th className="py-2.5 px-3 font-bold text-right">Jami summa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {client.products.map((p, idx) => (
                      <tr key={p.id || idx} className="hover:bg-rose-50/30">
                        <td className="py-2.5 px-3 text-neutral-500 font-mono">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-semibold text-neutral-900">{p.name}</td>
                        <td className="py-2.5 px-3 text-neutral-700">{p.unit}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium text-neutral-900 tabular-nums">
                          {formatNumber(p.quantity)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-neutral-700 tabular-nums">
                          {formatMoney(p.unitPrice)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-neutral-900 tabular-nums">
                          {formatMoney(p.totalPrice || p.quantity * p.unitPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-rose-50/80 font-bold border-t border-rose-200">
                    <tr>
                      <td colSpan={5} className="py-2.5 px-3 text-neutral-800">
                        Topshirilgan mahsulotlar umumiy qiymati:
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-rose-900 tabular-nums text-sm">
                        {formatMoney(totalProductsValue)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* AUDIT LOGS & O'ZGARISHLAR TARIXI */}
          <div className="space-y-3 pt-3 border-t border-rose-100">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-rose-700" />
              <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
                O'zgarishlar tarixi va Loglar ({logs.length})
              </h3>
            </div>

            {logs.length === 0 ? (
              <div className="p-4 text-center rounded-xl bg-neutral-50 text-xs text-neutral-500">
                Loglar mavjud emas.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                            log.author === 'agentp1'
                              ? 'bg-amber-100 text-amber-900 border border-amber-200'
                              : 'bg-rose-100 text-rose-900 border border-rose-200'
                          }`}
                        >
                          {log.author}
                        </span>
                        <span className="font-bold text-neutral-900">{log.title}</span>
                      </div>
                      <span className="text-[10px] text-neutral-500 font-mono">
                        {formatDate(log.timestamp)}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-700 leading-relaxed pl-1">
                      {log.details}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* OXIRGI IZOH: Agent ko'rganda nomi "Oxirgi izoh" bo'ladi, sana va kim kiritgani ko'rinadi */}
          {/* ========================================================= */}
          {isAgent ? (
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/90 text-xs text-neutral-800 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/60 pb-2">
                <span className="font-bold text-amber-950 text-xs uppercase tracking-wide flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-700" />
                  Oxirgi izoh
                </span>
                {latestAgentNote && (
                  <div className="text-[11px] font-mono text-neutral-600 flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                      Kiritdi: {latestAgentNote.author}
                    </span>
                    <span>Sana: {formatDate(latestAgentNote.date)}</span>
                  </div>
                )}
              </div>

              <p className="whitespace-pre-line leading-relaxed text-neutral-900 text-xs sm:text-sm font-medium">
                {latestAgentNote?.text || client.notes || "Ushbu mijoz bo'yicha hali izoh kiritilmagan."}
              </p>
            </div>
          ) : (
            (latestAgentNote || client.notes) && (
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 text-xs text-neutral-700 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200/80 pb-2">
                  <span className="font-bold text-neutral-900 block">
                    {latestAgentNote ? 'Oxirgi izoh' : "Qo'shimcha izoh / Kelishuv"}
                  </span>
                  {latestAgentNote && (
                    <span className="text-[11px] font-mono text-neutral-500">
                      Kiritdi: {latestAgentNote.author} · {formatDate(latestAgentNote.date)}
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-line leading-relaxed">
                  {latestAgentNote?.text || client.notes}
                </p>
              </div>
            )
          )}

          <div className="text-[11px] text-neutral-500 flex items-center justify-between border-t border-neutral-100 pt-3">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Qo'shilgan: {formatDate(client.createdAt)} ({client.createdBy || 'adminc'})
            </span>
            <span>Yangilangan: {formatDate(client.updatedAt)}</span>
          </div>
        </div>

        {/* ========================================================= */}
        {/* MODAL ACTION FOOTER: Agentda Chop etish / Chek va To'lov / Qarz o'zgartirish YO'Q */}
        {/* ========================================================= */}
        <div className="no-print px-5 sm:px-6 py-4 bg-neutral-50 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* O'chirish: Faqat adminc va adminc1 uchun */}
            {canDelete && !isConfirmingDelete && (
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-700 hover:bg-rose-100/80 transition min-h-[40px] cursor-pointer"
                title="Mijoz va unga oid ma'lumotlarni o'chirish"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>O'chirish</span>
              </button>
            )}

            {canDelete && isConfirmingDelete && (
              <div className="flex items-center gap-1.5 p-1 bg-rose-50 rounded-xl border border-rose-200">
                <span className="text-[11px] font-bold text-rose-900 px-1.5">O'chirilsinmi?</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsConfirmingDelete(false);
                    onDelete(client.id);
                    onClose();
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-700 text-white text-xs font-bold hover:bg-rose-800 transition cursor-pointer shadow-xs"
                >
                  Ha, o'chirish
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(false)}
                  className="px-2 py-1.5 rounded-lg bg-neutral-200 text-neutral-800 text-xs font-semibold hover:bg-neutral-300 transition cursor-pointer"
                >
                  Bekor
                </button>
              </div>
            )}

            {/* Print / Nakladnoy (PDF) qora borderlar bilan */}
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-900 transition min-h-[40px] cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Nakladnoy (PDF)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Ombordagi qarzdorlikni qo'shish: Faqat adminc va adminc1 */}
            {canAddWarehouseDebt && onOpenWarehouseDebtModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenWarehouseDebtModal(client);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 transition min-h-[40px] cursor-pointer"
                title="Ombordagi narxlar valyutasida mijozga qarzdorlik qo'shish"
              >
                <Warehouse className="w-3.5 h-3.5 text-amber-700" />
                <span>Ombor qarzdorligi</span>
              </button>
            )}

            {/* To'lov / Qarz o'zgartirish: Agentda YO'Q BO'LSIN */}
            {!isAgent && (
              <button
                type="button"
                onClick={() => onQuickPayment(client)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-neutral-800 bg-white hover:bg-neutral-100 border border-neutral-300 transition min-h-[40px] cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5 text-neutral-700" />
                <span>To'lov / Qarz o'zgartirish</span>
              </button>
            )}

            {!isAgent && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(client);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 transition min-h-[40px] cursor-pointer"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Tahrirlash</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {nakladnoyData && (
        <NakladnoyModal
          isOpen={!!nakladnoyData}
          onClose={() => setNakladnoyData(null)}
          data={nakladnoyData}
        />
      )}
    </div>
  );
};
