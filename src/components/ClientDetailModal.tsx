import React from 'react';
import { Client } from '../types';
import { formatMoney, formatDate, formatNumber } from '../utils/format';
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
  UserCheck,
} from 'lucide-react';

interface Props {
  client: Client | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (client: Client) => void;
  onDelete: (clientId: string) => void;
  onQuickPayment: (client: Client) => void;
}

export const ClientDetailModal: React.FC<Props> = ({
  client,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onQuickPayment,
}) => {
  if (!isOpen || !client) return null;

  const totalProductsValue = client.products.reduce(
    (sum, p) => sum + (p.totalPrice || p.quantity * p.unitPrice),
    0
  );

  const handlePrint = () => {
    window.print();
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
                  Telefon
                </div>
                <a
                  href={`tel:${client.phone}`}
                  className="text-sm font-semibold text-neutral-900 hover:text-rose-700 underline font-mono tabular-nums"
                >
                  {client.phone || "Kiritilmagan"}
                </a>
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

          {/* Debt & Advance Balances */}
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

          {/* AUDIT LOGS & O'ZGARISHLAR TARIXI (Kim o'zgartirgani va nima qilingani) */}
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

          {/* Notes and Date */}
          {client.notes && (
            <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 text-xs text-neutral-700">
              <span className="font-bold text-neutral-900 block mb-1">Qo'shimcha izoh / Kelishuv:</span>
              <p className="whitespace-pre-line leading-relaxed">{client.notes}</p>
            </div>
          )}

          <div className="text-[11px] text-neutral-500 flex items-center justify-between border-t border-neutral-100 pt-3">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Qo'shilgan: {formatDate(client.createdAt)} ({client.createdBy || 'adminc'})
            </span>
            <span>Yangilangan: {formatDate(client.updatedAt)}</span>
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="no-print px-5 sm:px-6 py-4 bg-neutral-50 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (window.confirm(`${client.name} ni o'chirishni tasdiqlaysizmi?`)) {
                  onDelete(client.id);
                  onClose();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-700 hover:bg-rose-100/80 transition min-h-[40px]"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>O'chirish</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-neutral-700 hover:bg-white border border-neutral-200 transition min-h-[40px]"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Chop etish / Chek</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onQuickPayment(client)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-neutral-800 bg-white hover:bg-neutral-100 border border-neutral-300 transition min-h-[40px]"
            >
              <CreditCard className="w-3.5 h-3.5 text-neutral-700" />
              <span>To'lov / Qarz o'zgartirish</span>
            </button>
            <button
              onClick={() => {
                onClose();
                onEdit(client);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 transition min-h-[40px]"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>Tahrirlash</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
