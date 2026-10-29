import React from 'react';
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
} from 'lucide-react';

interface Props {
  plans: DailyPlanItem[];
}

export const AdminAgentPlansTable: React.FC<Props> = ({ plans }) => {
  const completedCount = plans.filter((p) => p.status === 'bajarildi').length;
  const totalCollectedMoney = plans.reduce(
    (sum, p) => sum + (p.financialAction?.amount || 0),
    0
  );

  const getRemainingTimeStr = (createdAt: string) => {
    const created = new Date(createdAt).getTime();
    const expires = created + 24 * 60 * 60 * 1000;
    const diffMs = expires - Date.now();
    if (diffMs <= 0) return "24 soat tugagan";
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours} soat ${mins} daqiqa qoldi`;
  };

  return (
    <div className="space-y-4">
      {/* Real-time Summary Stats for Admin */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200">
          <span className="text-xs font-semibold text-neutral-500 block">
            Jami rejalashtirilgan
          </span>
          <span className="text-2xl font-bold font-display text-neutral-900 tabular-nums">
            {plans.length} ta tashrif
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
          <span className="text-xs font-bold text-emerald-900 block">
            Bajarilgan rejalar
          </span>
          <span className="text-2xl font-bold font-display text-neutral-900 tabular-nums">
            {completedCount} ta ({plans.length > 0 ? Math.round((completedCount / plans.length) * 100) : 0}%)
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200">
          <span className="text-xs font-bold text-rose-900 block">
            Agentlar yig'gan to'lovlar
          </span>
          <span className="text-xl sm:text-2xl font-bold font-display text-neutral-900 font-mono tabular-nums">
            {formatMoney(totalCollectedMoney)}
          </span>
        </div>
      </div>

      {/* Table */}
      {plans.length === 0 ? (
        <div className="p-10 text-center rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
          <Activity className="w-8 h-8 text-neutral-400 mx-auto" />
          <h4 className="text-sm font-bold text-neutral-800">
            Hozircha agentlar tomonidan faol kunlik reja tuzilmagan
          </h4>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            Agentlar (masalan, agentp1) o'z hisobidan kirib kunlik reja tuzganda, bu yerda 24 soatlik sinxron ma'lumotlar avtomatik yangilanib turadi.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-rose-100">
          <table className="w-full text-left text-xs">
            <thead className="bg-rose-50/70 border-b border-rose-100 text-neutral-800 font-bold uppercase">
              <tr>
                <th className="py-3 px-3.5">#</th>
                <th className="py-3 px-3.5">Agent logini</th>
                <th className="py-3 px-3.5">Mijoz ismi & Telefon</th>
                <th className="py-3 px-3.5">Manzili</th>
                <th className="py-3 px-3.5">Reja izohi</th>
                <th className="py-3 px-3.5">Holati</th>
                <th className="py-3 px-3.5">Qilingan amal</th>
                <th className="py-3 px-3.5 text-right">To'lov / Moliyaviy amal</th>
                <th className="py-3 px-3.5">Bajarilgan vaqt</th>
                <th className="py-3 px-3.5">Hisobot qaydi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-100/60">
              {plans.map((item, idx) => {
                const isDone = item.status === 'bajarildi';

                return (
                  <tr key={item.id} className="hover:bg-rose-50/30 transition-colors">
                    <td className="py-3 px-3.5 font-mono text-neutral-500">{idx + 1}</td>
                    <td className="py-3 px-3.5">
                      <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-amber-100 text-amber-900 border border-amber-200">
                        {item.agentUsername}
                      </span>
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="font-bold text-neutral-900">{item.clientName}</div>
                      <div className="text-[11px] font-mono text-neutral-500">{item.clientPhone}</div>
                    </td>
                    <td className="py-3 px-3.5 max-w-[170px]">
                      <div className="text-neutral-700">
                        <span className="font-semibold text-neutral-900 block truncate" title={item.clientAddress}>
                          {[item.clientRegion, item.clientDistrict].filter(Boolean).join(', ') || item.clientAddress || "Ko'rsatilmagan"}
                        </span>
                        {item.clientLandmark && (
                          <span className="text-[10px] text-neutral-500 block truncate" title={`Mo'ljal: ${item.clientLandmark}`}>
                            Mo'ljal: {item.clientLandmark}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3.5 max-w-[180px] text-[11px]" title={item.planNote}>
                      {item.planNote ? (
                        <span className="font-medium text-neutral-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 block truncate">
                          {item.planNote}
                        </span>
                      ) : (
                        <span className="text-neutral-400 italic">-</span>
                      )}
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
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Bajarildi</span>
                          </>
                        ) : (
                          <span>Rejalashtirilgan</span>
                        )}
                      </span>
                      <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                        {getRemainingTimeStr(item.createdAt)}
                      </div>
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap">
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
                    <td className="py-3 px-3.5 whitespace-nowrap text-[11px] text-neutral-600">
                      {item.completedAt ? formatDate(item.completedAt) : "Hali bajarilmadi"}
                    </td>
                    <td className="py-3 px-3.5 max-w-[200px] truncate text-[11px] text-neutral-700" title={item.reportNote}>
                      {item.reportNote || "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
