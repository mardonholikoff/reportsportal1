import React from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ProductItem } from '../types';
import { formatMoney, formatDate, formatNumber } from '../utils/format';
import { X, Printer, FileText, Download } from 'lucide-react';

function sanitizePdfText(input: string | undefined | null): string {
  if (!input) return '';
  return String(input)
    .replace(/[\u2018\u2019\u02BB\u02BC\u0060\u00B4]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2116/g, '#')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ');
}

export interface NakladnoyData {
  docNumber?: string;
  date?: string;
  clientName: string;
  clientPhones: string[];
  clientAddress?: string;
  authorUsername?: string;
  operationTitle?: string; // e.g. "Mahsulot topshirish / Sotuv", "Mahsulot qaytarish"
  productsDelivered?: ProductItem[];
  productsReturned?: Array<{
    productId?: string;
    name: string;
    unit: string;
    quantity: number;
    unitPrice?: number;
  }>;
  paymentInfo?: {
    paymentLabel: string;
    paidAmount: number;
    debtAmount: number;
    previousDebt?: number;
    totalClientDebt?: number;
  };
  financialPayment?: {
    methodLabel: string;
    amount: number;
    note?: string;
  };
  note?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: NakladnoyData | null;
}

export const NakladnoyModal: React.FC<Props> = ({ isOpen, onClose, data }) => {
  if (!isOpen || !data) return null;

  const docNo = data.docNumber || `NK-${Date.now().toString().slice(-6)}`;
  const docDate = data.date ? formatDate(data.date) : formatDate(new Date().toISOString());

  const delivered = (data.productsDelivered || []).filter((p) => p.name && p.name.trim() !== '');
  const returned = (data.productsReturned || []).filter((r) => r.quantity > 0);

  // Totals for delivered products
  const totalBaseDelivered = delivered.reduce((sum, p) => {
    const baseUnit = p.originalUnitPrice ?? p.unitPrice ?? 0;
    return sum + (p.quantity || 0) * baseUnit;
  }, 0);

  const totalFinalDelivered = delivered.reduce((sum, p) => {
    const finalRow =
      p.totalPrice !== undefined ? p.totalPrice : (p.quantity || 0) * (p.unitPrice || 0);
    return sum + finalRow;
  }, 0);

  const totalDiscountAmount = Math.max(0, Math.round((totalBaseDelivered - totalFinalDelivered) * 100) / 100);

  const totalReturnedSum = returned.reduce(
    (sum, r) => sum + (r.quantity || 0) * (r.unitPrice || 0),
    0
  );

  const handlePrintPdf = () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      const pageWidth = doc.internal.pageSize.getWidth();
      const marginX = 12;
      let curY = 14;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(sanitizePdfText(`YUK XATI # ${docNo}`), marginX, curY);

      doc.setFontSize(9.5);
      doc.text(
        sanitizePdfText(`Sana: ${docDate} | Valyuta: USD ($)`),
        pageWidth - marginX,
        curY,
        { align: 'right' }
      );
      curY += 6;

      autoTable(doc, {
        startY: curY,
        margin: { left: marginX, right: marginX },
        body: [
          ['Mijoz (Qabul qiluvchi):', sanitizePdfText(data.clientName || "Noma'lum mijoz")],
          [
            'Telefon raqamlari:',
            sanitizePdfText(
              data.clientPhones && data.clientPhones.length > 0
                ? data.clientPhones.filter(Boolean).join(', ')
                : 'Kiritilmagan'
            ),
          ],
          ['Manzil / Joylashuv:', sanitizePdfText(data.clientAddress || "Manzil ko'rsatilmagan")],
        ],
        theme: 'grid',
        styles: {
          font: 'helvetica',
          fontSize: 9,
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.3,
        },
        columnStyles: {
          0: { cellWidth: 55, fontStyle: 'bold', fillColor: [242, 242, 242] },
        },
      });

      curY = (doc as any).lastAutoTable.finalY + 6;

      if (delivered.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text("1. Topshirilgan mahsulotlar ro'yxati:", marginX, curY);
        curY += 3;

        autoTable(doc, {
          startY: curY,
          margin: { left: marginX, right: marginX },
          head: [['#', 'Mahsulot nomi', "O'lchov", 'Miqdori', 'Narx (USD)', 'Chegirma', 'Jami (USD)']],
          body: delivered.map((p, idx) => {
            const qty = p.quantity || 0;
            const basePrice = p.originalUnitPrice ?? p.unitPrice ?? 0;
            const rowBaseTotal = qty * basePrice;
            const finalRowTotal =
              p.totalPrice !== undefined ? p.totalPrice : qty * (p.unitPrice || 0);
            const rowDiscAmt =
              p.discountAmount !== undefined
                ? p.discountAmount
                : Math.max(0, Math.round((rowBaseTotal - finalRowTotal) * 100) / 100);
            return [
              String(idx + 1),
              sanitizePdfText(p.name),
              sanitizePdfText(p.unit),
              sanitizePdfText(formatNumber(qty)),
              sanitizePdfText(formatMoney(basePrice)),
              sanitizePdfText(rowDiscAmt > 0 ? `-${formatMoney(rowDiscAmt)}` : '0 USD'),
              sanitizePdfText(formatMoney(finalRowTotal)),
            ];
          }),
          foot: [
            [
              '',
              'JAMI:',
              '',
              '',
              sanitizePdfText(formatMoney(totalBaseDelivered)),
              sanitizePdfText(totalDiscountAmount > 0 ? `-${formatMoney(totalDiscountAmount)}` : '0 USD'),
              sanitizePdfText(formatMoney(totalFinalDelivered)),
            ],
          ],
          theme: 'grid',
          styles: {
            font: 'helvetica',
            fontSize: 8.5,
            textColor: [0, 0, 0],
            lineColor: [0, 0, 0],
            lineWidth: 0.3,
          },
          headStyles: {
            fillColor: [235, 235, 235],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
          },
          footStyles: {
            fillColor: [242, 242, 242],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
          },
        });
        curY = (doc as any).lastAutoTable.finalY + 6;
      }

      if (returned.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text("Qaytarib olingan mahsulotlar ro'yxati:", marginX, curY);
        curY += 3;

        autoTable(doc, {
          startY: curY,
          margin: { left: marginX, right: marginX },
          head: [['#', 'Qaytarilgan mahsulot nomi', "O'lchov", 'Miqdori', 'Birlik narxi', 'Jami summa']],
          body: returned.map((r, idx) => [
            String(idx + 1),
            sanitizePdfText(r.name),
            sanitizePdfText(r.unit),
            sanitizePdfText(formatNumber(r.quantity)),
            sanitizePdfText(formatMoney(r.unitPrice || 0)),
            sanitizePdfText(formatMoney((r.quantity || 0) * (r.unitPrice || 0))),
          ]),
          theme: 'grid',
          styles: {
            font: 'helvetica',
            fontSize: 8.5,
            textColor: [0, 0, 0],
            lineColor: [0, 0, 0],
            lineWidth: 0.3,
          },
          headStyles: {
            fillColor: [235, 235, 235],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
          },
        });
        curY = (doc as any).lastAutoTable.finalY + 6;
      }

      doc.save(`Yuk_xati_${docNo}.pdf`);
    } catch {
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto">
      {/* Print-specific CSS so printing / saving as PDF outputs ONLY the black-bordered Nakladnoy */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #nakladnoy-printable-area,
          #nakladnoy-printable-area * {
            visibility: visible !important;
          }
          #nakladnoy-printable-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 12mm !important;
            box-shadow: none !important;
            background: #ffffff !important;
          }
          .no-print-nakladnoy {
            display: none !important;
          }
        }
      `}</style>

      <div className="relative w-full max-w-4xl bg-neutral-100 rounded-3xl shadow-2xl border border-neutral-300 my-auto max-h-[94vh] flex flex-col overflow-hidden">
        {/* Top Action Bar (Hidden when printing) */}
        <div className="no-print-nakladnoy px-5 py-3.5 bg-neutral-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white border border-white/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold font-display">
                Yuk xati № {docNo} (PDF format)
              </h2>
              <p className="text-[11px] text-neutral-300">
                Qora chegarali (borderli) rasmiy yuk xati — ekranda ko'rish va PDF saqlash
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintPdf}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer min-h-[40px]"
            >
              <Printer className="w-4 h-4" />
              <span>PDF saqlash / Chop etish (Print)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              title="Yopish"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Document Viewport */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-neutral-200/80">
          {/* A4 Paper Sheet with Crisp Black Borders */}
          <div
            id="nakladnoy-printable-area"
            className="bg-white text-black mx-auto max-w-3xl p-5 sm:p-8 border-2 border-black shadow-lg space-y-5 font-sans"
          >
            {/* Document Header Box */}
            <div className="border-2 border-black p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-black pb-3">
                <div>
                  <h1 className="text-lg sm:text-xl font-extrabold uppercase tracking-wide text-black">
                    YUK XATI № {docNo}
                  </h1>
                </div>
                <div className="text-xs sm:text-right font-mono font-bold text-black space-y-0.5">
                  <div>Sana: {docDate}</div>
                  <div>Valyuta: USD ($)</div>
                </div>
              </div>

              {/* Client Info Table with Black Borders */}
              <table className="w-full border-collapse border border-black text-xs mt-3">
                <tbody>
                  <tr>
                    <td className="border border-black p-2 font-bold bg-neutral-100 w-1/3">
                      Mijoz (Qabul qiluvchi):
                    </td>
                    <td className="border border-black p-2 font-bold text-sm">
                      {data.clientName || "Noma'lum mijoz"}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-black p-2 font-bold bg-neutral-100">
                      Telefon raqamlari:
                    </td>
                    <td className="border border-black p-2 font-mono font-semibold">
                      {data.clientPhones && data.clientPhones.length > 0
                        ? data.clientPhones.filter(Boolean).join(', ')
                        : 'Kiritilmagan'}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-black p-2 font-bold bg-neutral-100">
                      Manzil / Joylashuv:
                    </td>
                    <td className="border border-black p-2 font-medium">
                      {data.clientAddress || "Manzil ko'rsatilmagan"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 1. Delivered Products Table (with Black Borders) */}
            {delivered.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-extrabold uppercase tracking-wider text-black">
                  1. Topshirilgan mahsulotlar ro'yxati:
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border-2 border-black text-xs text-black">
                    <thead>
                      <tr className="bg-neutral-100 font-extrabold text-black">
                        <th className="border border-black p-2 text-center w-10">№</th>
                        <th className="border border-black p-2 text-left">Mahsulot nomi</th>
                        <th className="border border-black p-2 text-center w-20">O'lchov</th>
                        <th className="border border-black p-2 text-right w-20">Miqdori</th>
                        <th className="border border-black p-2 text-right w-28">
                          Narx (USD)
                        </th>
                        <th className="border border-black p-2 text-right w-28">
                          Chegirma
                        </th>
                        <th className="border border-black p-2 text-right w-32">
                          Jami (USD)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {delivered.map((p, idx) => {
                        const qty = p.quantity || 0;
                        const basePrice = p.originalUnitPrice ?? p.unitPrice ?? 0;
                        const rowBaseTotal = qty * basePrice;
                        const finalRowTotal =
                          p.totalPrice !== undefined ? p.totalPrice : qty * (p.unitPrice || 0);
                        const rowDiscAmt =
                          p.discountAmount !== undefined
                            ? p.discountAmount
                            : Math.max(0, Math.round((rowBaseTotal - finalRowTotal) * 100) / 100);
                        const rowDiscPct =
                          p.discountPercent !== undefined
                            ? p.discountPercent
                            : rowBaseTotal > 0 && rowDiscAmt > 0
                            ? Math.round(((rowDiscAmt / rowBaseTotal) * 100) * 10) / 10
                            : 0;

                        return (
                          <tr key={p.id || idx}>
                            <td className="border border-black p-2 text-center font-mono">
                              {idx + 1}
                            </td>
                            <td className="border border-black p-2 font-bold">{p.name}</td>
                            <td className="border border-black p-2 text-center">{p.unit}</td>
                            <td className="border border-black p-2 text-right font-mono font-bold">
                              {formatNumber(qty)}
                            </td>
                            <td className="border border-black p-2 text-right font-mono">
                              {formatMoney(basePrice)}
                            </td>
                            <td className="border border-black p-2 text-right font-mono">
                              {rowDiscAmt > 0
                                ? `-${formatMoney(rowDiscAmt)} (${rowDiscPct}%)`
                                : '0 USD (0%)'}
                            </td>
                            <td className="border border-black p-2 text-right font-mono font-extrabold">
                              {formatMoney(finalRowTotal)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-neutral-100 font-extrabold">
                        <td colSpan={4} className="border border-black p-2 text-right uppercase">
                          Jami ko'rsatkichlar:
                        </td>
                        <td className="border border-black p-2 text-right font-mono">
                          {formatMoney(totalBaseDelivered)}
                        </td>
                        <td className="border border-black p-2 text-right font-mono">
                          {totalDiscountAmount > 0 ? `-${formatMoney(totalDiscountAmount)}` : '0 USD'}
                        </td>
                        <td className="border border-black p-2 text-right font-mono text-sm">
                          {formatMoney(totalFinalDelivered)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* 2. Returned Products Table (with Black Borders) */}
            {returned.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-extrabold uppercase tracking-wider text-black">
                  {delivered.length > 0 ? '2.' : '1.'} Mijozdan qaytarib olingan mahsulotlar ro'yxati:
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border-2 border-black text-xs text-black">
                    <thead>
                      <tr className="bg-neutral-100 font-extrabold text-black">
                        <th className="border border-black p-2 text-center w-10">№</th>
                        <th className="border border-black p-2 text-left">
                          Qaytarilgan mahsulot nomi
                        </th>
                        <th className="border border-black p-2 text-center w-24">O'lchov</th>
                        <th className="border border-black p-2 text-right w-24">Miqdori</th>
                        <th className="border border-black p-2 text-right w-32">
                          Birlik narxi (USD)
                        </th>
                        <th className="border border-black p-2 text-right w-36">
                          Jami summa (USD)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {returned.map((r, idx) => (
                        <tr key={r.productId || idx}>
                          <td className="border border-black p-2 text-center font-mono">
                            {idx + 1}
                          </td>
                          <td className="border border-black p-2 font-bold">{r.name}</td>
                          <td className="border border-black p-2 text-center">{r.unit}</td>
                          <td className="border border-black p-2 text-right font-mono font-bold">
                            {formatNumber(r.quantity)}
                          </td>
                          <td className="border border-black p-2 text-right font-mono">
                            {formatMoney(r.unitPrice || 0)}
                          </td>
                          <td className="border border-black p-2 text-right font-mono font-extrabold">
                            {formatMoney((r.quantity || 0) * (r.unitPrice || 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-neutral-100 font-extrabold">
                        <td colSpan={5} className="border border-black p-2 text-right uppercase">
                          Qaytarilgan mahsulotlar jami summasi:
                        </td>
                        <td className="border border-black p-2 text-right font-mono text-sm">
                          {formatMoney(totalReturnedSum)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Empty Products Notice if neither delivered nor returned */}
            {delivered.length === 0 && returned.length === 0 && (
              <div className="border-2 border-black p-4 text-center text-xs font-bold">
                Ushbu yuk xatida mahsulot qatorlari kiritilmagan.
              </div>
            )}

            {/* Financial Summary Table (Black Bordered) */}
            {(delivered.length > 0 ||
              (data.paymentInfo && data.paymentInfo.paidAmount > 0) ||
              (data.financialPayment && data.financialPayment.amount > 0)) && (
              <div className="space-y-1.5">
                <div className="text-xs font-extrabold uppercase tracking-wider text-black">
                  Hisob-kitob ma'lumotlari (USD):
                </div>
                <table className="w-full border-collapse border-2 border-black text-xs text-black">
                  <tbody>
                    {delivered.length > 0 && (
                      <tr>
                        <td className="border border-black p-2 font-bold bg-neutral-100 w-1/2">
                          Narx:
                        </td>
                        <td className="border border-black p-2 font-mono font-extrabold text-sm text-right">
                          {formatMoney(totalFinalDelivered)}
                        </td>
                      </tr>
                    )}

                    {data.paymentInfo && data.paymentInfo.paidAmount > 0 && (
                      <tr>
                        <td className="border border-black p-2 font-bold bg-neutral-100">
                          To'lov shakli va to'langan summa:
                        </td>
                        <td className="border border-black p-2 font-mono font-bold text-right">
                          {data.paymentInfo.paymentLabel}: {formatMoney(data.paymentInfo.paidAmount)}
                        </td>
                      </tr>
                    )}

                    {data.financialPayment && data.financialPayment.amount > 0 && (
                      <tr>
                        <td className="border border-black p-2 font-bold bg-neutral-100">
                          Qabul qilingan to'lov ({data.financialPayment.methodLabel}):
                        </td>
                        <td className="border border-black p-2 font-mono font-extrabold text-right">
                          {formatMoney(data.financialPayment.amount)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Note if any */}
            {data.note && (
              <div className="border border-black p-2.5 text-xs">
                <span className="font-bold">Qo'shimcha izoh: </span>
                <span>{data.note}</span>
              </div>
            )}

            {/* Signatures Section */}
            <div className="pt-6 pb-2 grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs text-black">
              <div className="border border-black p-3 space-y-4">
                <div className="font-bold uppercase">Yetkazib beruvchi imzo:</div>
                <div className="flex items-end justify-end gap-2 pt-2">
                  <span className="border-b border-black w-48 inline-block text-center text-[10px] text-neutral-600">
                    (imzo)
                  </span>
                </div>
              </div>

              <div className="border border-black p-3 space-y-4">
                <div className="font-bold uppercase">Qabul qildi (Mijoz):</div>
                <div className="flex items-end justify-between gap-2 pt-2">
                  <span className="font-semibold truncate max-w-[140px]">{data.clientName}</span>
                  <span className="border-b border-black w-40 inline-block text-center text-[10px] text-neutral-600">
                    (imzo)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Footer (Hidden when printing) */}
        <div className="no-print-nakladnoy px-5 py-3 bg-white border-t border-neutral-200 flex items-center justify-between gap-3 shrink-0">
          <span className="text-xs text-neutral-500">
            * "PDF saqlash / Chop etish" tugmasini bosib PDF formatda saqlab olishingiz mumkin.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintPdf}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-900 hover:bg-black text-white text-xs font-bold transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PDF yuklab olish / Print</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 hover:bg-neutral-100 text-xs font-bold transition cursor-pointer"
            >
              Yopish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
