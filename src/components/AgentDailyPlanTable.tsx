import React, { useState } from 'react';
import { DailyPlanItem } from '../types';
import { formatMoney } from '../utils/format';
import {
  CalendarCheck,
  Plus,
  Clock,
  CheckCircle2,
  Phone,
  MapPin,
  Edit3,
  FileText,
  MessageSquare,
  Check,
  X,
} from 'lucide-react';

interface Props {
  plans: DailyPlanItem[];
  onOpenCreatePlan: () => void;
  onOpenExecuteModal: (item: DailyPlanItem) => void;
  onUpdatePlanNote?: (planItemId: string, note: string) => void;
}

export const AgentDailyPlanTable: React.FC<Props> = ({
  plans,
  onOpenCreatePlan,
  onOpenExecuteModal,
  onUpdatePlanNote,
}) => {
  // State for editing plan note inline
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [tempNote, setTempNote] = useState('');

  // Calculate remaining hours for 24h window
  const getRemainingTimeStr = (createdAt: string) => {
    const created = new Date(createdAt).getTime();
    const expires = created + 24 * 60 * 60 * 1000;
    const diffMs = expires - Date.now();
    if (diffMs <= 0) return "Muddati tugagan";
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours} soat ${mins} daqiqa qoldi`;
  };

  const handleStartEditNote = (item: DailyPlanItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNoteId(item.id);
    setTempNote(item.planNote || '');
  };

  const handleSaveNote = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onUpdatePlanNote) {
      onUpdatePlanNote(itemId, tempNote);
    }
    setEditingNoteId(null);
  };

  const handleCancelEditNote = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNoteId(null);
    setTempNote('');
  };

  return (
    <div className="bg-white rounded-3xl border border-rose-100 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-5 sm:p-6 bg-gradient-to-r from-rose-50/70 via-white to-rose-50/40 border-b border-rose-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-700 text-white flex items-center justify-center shadow-xs shrink-0">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold font-display text-neutral-900 tracking-tight">
                Bugungi kunlik reja (24 soat)
              </h2>
              <span className="text-[11px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                {plans.length} ta reja
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              Tanlangan mijozlar ro'yxati, amal bajarilishi, to'lov/tovar va tashrif izohlari
            </p>
          </div>
        </div>

        <button
          onClick={onOpenCreatePlan}
          className="flex items-center gap-1.5 bg-rose-700 hover:bg-rose-800 active:bg-rose-900 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition min-h-[44px] cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Bugungi kunlik reja tuzish</span>
        </button>
      </div>

      {/* Plan List */}
      <div className="p-4 sm:p-6">
        {plans.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-neutral-50 border border-neutral-200 space-y-3">
            <Clock className="w-8 h-8 text-neutral-400 mx-auto" />
            <h3 className="text-sm font-bold text-neutral-800">
              Bugun uchun rejalashtirilgan mijozlar yo'q
            </h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              Kunlik reja tuzish tugmasini bosing va joylashuv, qarz yoki mahsulotlar bo'yicha mijozlarni saralab reja tuzing. Ular 24 soat davomida shu yerda ko'rinadi.
            </p>
            <button
              onClick={onOpenCreatePlan}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Mijozlarni tanlash</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-rose-100">
            <table className="w-full text-left text-xs">
              <thead className="bg-rose-50/70 border-b border-rose-100 text-neutral-800 font-bold uppercase">
                <tr>
                  <th className="py-3 px-3.5">#</th>
                  <th className="py-3 px-3.5">Mijoz ismi & Telefon</th>
                  <th className="py-3 px-3.5">Manzili</th>
                  <th className="py-3 px-3.5">Reja izohi</th>
                  <th className="py-3 px-3.5">Qolgan vaqt</th>
                  <th className="py-3 px-3.5">Holati</th>
                  <th className="py-3 px-3.5">Qilingan amal</th>
                  <th className="py-3 px-3.5 text-right">To'lov / Tovar</th>
                  <th className="py-3 px-3.5 text-center">Hisobot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-100/60">
                {plans.map((item, idx) => {
                  const isDone = item.status === 'bajarildi';
                  const isEditingThisNote = editingNoteId === item.id;

                  return (
                    <tr
                      key={item.id}
                      onClick={() => onOpenExecuteModal(item)}
                      className="hover:bg-rose-50/30 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-3.5 font-mono text-neutral-500">{idx + 1}</td>
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-neutral-900">{item.clientName}</div>
                        <div className="flex items-center gap-1 text-neutral-500 text-[11px] font-mono mt-0.5">
                          <Phone className="w-3 h-3" />
                          <span>{item.clientPhone}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3.5 max-w-[170px]">
                        <div className="text-neutral-700 flex items-start gap-1">
                          <MapPin className="w-3 h-3 text-rose-600 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <span className="font-semibold text-neutral-900 block truncate" title={item.clientAddress}>
                              {[item.clientRegion, item.clientDistrict].filter(Boolean).join(', ') || item.clientAddress || "Manzil yo'q"}
                            </span>
                            {item.clientLandmark && (
                              <span className="text-[10px] text-neutral-500 block truncate" title={`Mo'ljal: ${item.clientLandmark}`}>
                                Mo'ljal: {item.clientLandmark}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Plan Note (Reja izohi) with inline edit */}
                      <td
                        className="py-3 px-3.5 max-w-[200px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isEditingThisNote ? (
                          <div className="flex items-center gap-1 min-w-[160px]">
                            <input
                              type="text"
                              value={tempNote}
                              onChange={(e) => setTempNote(e.target.value)}
                              placeholder="Izoh yozing..."
                              className="px-2 py-1 text-xs border border-rose-300 rounded-lg outline-none bg-white w-full"
                              autoFocus
                            />
                            <button
                              onClick={(e) => handleSaveNote(item.id, e)}
                              className="p-1 rounded bg-rose-700 text-white hover:bg-rose-800"
                              title="Saqlash"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={handleCancelEditNote}
                              className="p-1 rounded bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
                              title="Bekor qilish"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-1.5 group">
                            <span
                              className="text-[11px] text-neutral-700 truncate"
                              title={item.planNote || "Izoh qo'shish"}
                            >
                              {item.planNote ? (
                                <span className="font-medium text-neutral-900">{item.planNote}</span>
                              ) : (
                                <span className="text-neutral-400 italic">Izoh yo'q</span>
                              )}
                            </span>
                            <button
                              onClick={(e) => handleStartEditNote(item, e)}
                              className="opacity-60 hover:opacity-100 p-1 rounded hover:bg-rose-50 text-rose-700 transition"
                              title="Izohni tahrirlash"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-[11px] text-neutral-600 font-mono">
                          <Clock className="w-3 h-3 text-rose-600" />
                          <span>{getRemainingTimeStr(item.createdAt)}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            isDone
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {isDone ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                              <span>Bajarildi</span>
                            </>
                          ) : (
                            <span>Rejalashtirilgan</span>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-3.5">
                        {item.actionDone ? (
                          <span className="font-semibold text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded">
                            {item.actionDone}
                          </span>
                        ) : (
                          <span className="text-neutral-400 italic">Kutilmoqda</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        {item.financialAction ? (
                          <div>
                            <span className="font-mono font-bold text-emerald-800">
                              +{formatMoney(item.financialAction.amount)}
                            </span>
                            <div className="text-[10px] text-neutral-500">
                              {item.financialAction.methodLabel}
                            </div>
                          </div>
                        ) : item.productsDelivered && item.productsDelivered.length > 0 ? (
                          <span className="text-[11px] text-rose-800 font-semibold">
                            {item.productsDelivered.length} ta tovar
                          </span>
                        ) : (
                          <span className="text-neutral-400">-</span>
                        )}
                      </td>
                      <td
                        className="py-3 px-3.5 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => onOpenExecuteModal(item)}
                          className="px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-rose-50 hover:text-rose-800 text-neutral-800 text-xs font-bold transition flex items-center justify-center gap-1 mx-auto min-h-[36px] cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>{isDone ? "Ko'rish / Qayta" : "Hisobot yozish"}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
