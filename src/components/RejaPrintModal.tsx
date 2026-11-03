import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Client, DailyPlanItem } from '../types';
import { formatDateDMY, formatMoney, getAgentDisplayName } from '../utils/format';
import { getClientLastOperations } from '../utils/clientActivityDates';
import { Printer, X, Download, CheckCircle2 } from 'lucide-react';

interface RejaPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  plans: DailyPlanItem[];
  clients: Client[];
  allSystemPlans: DailyPlanItem[];
}

const formatPlannedActionLabel = (action?: string) => {
  if (action === 'telefon qilindi') return 'Telefon qilish';
  if (action === 'joyiga borildi') return 'Joyiga borish';
  if (action === 'telefon qilindi + joyiga borildi') return 'Telefon + Joyiga borish';
  return action || '';
};

function sanitizePdfText(input: string | undefined | null): string {
  if (!input) return '';
  return String(input)
    .replace(/[\u2018\u2019\u02BB\u02BC\u0060\u00B4]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2116/g, '#')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ');
}

export const RejaPrintModal: React.FC<RejaPrintModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  plans,
  clients,
  allSystemPlans,
}) => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfSuccessMessage, setPdfSuccessMessage] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('reja-print-active');
    } else {
      document.body.classList.remove('reja-print-active');
      setPdfSuccessMessage(false);
    }
    return () => {
      document.body.classList.remove('reja-print-active');
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const totalPlannedAmount = plans.reduce((acc, p) => acc + (p.plannedAmount || 0), 0);
  const printedAtStr = formatDateDMY(new Date().toISOString());

  const handleDownloadAndPrintPdf = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsGeneratingPdf(true);

    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
      const marginX = 8;

      // Header Box
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.rect(marginX, 8, pageWidth - marginX * 2, 18);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(0, 0, 0);
      doc.text(sanitizePdfText(title), marginX + 4, 15);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const subHeader = `Sana: ${sanitizePdfText(printedAtStr)} | Jami mijozlar: ${plans.length} ta${
        subtitle ? ` | ${sanitizePdfText(subtitle)}` : ''
      }`;
      doc.text(subHeader, marginX + 4, 22);

      // Right summary in header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      const totalStr = `Undirish rejasi jami: ${sanitizePdfText(formatMoney(totalPlannedAmount))}`;
      doc.text(totalStr, pageWidth - marginX - 4, 18, { align: 'right' });

      const tableRows = plans.map((item, index) => {
        const plannedLabel = formatPlannedActionLabel(item.plannedAction || item.actionDone);
        const lastOps = getClientLastOperations(item.clientId, clients, allSystemPlans);

        const agentName = getAgentDisplayName(item.agentUsername);
        const agentCell = `${agentName}\nQo'shdi: ${formatDateDMY(item.createdAt)}`;
        const clientCell = item.clientName || '-';
        const phoneCell = item.clientPhone || '-';
        const addressCell =
          [item.clientRegion, item.clientDistrict].filter(Boolean).join(', ') ||
          item.clientAddress ||
          '-';
        const fullAddress = item.clientLandmark
          ? `${addressCell} (${item.clientLandmark})`
          : addressCell;

        const debtLines: string[] = [];
        if (lastOps.currentDebt > 0) {
          debtLines.push(`Qarzdorlik: ${formatMoney(lastOps.currentDebt)}`);
        }
        if (lastOps.currentAdvance > 0) {
          debtLines.push(`Haqdorlik: ${formatMoney(lastOps.currentAdvance)}`);
        }
        const debtAdvanceCell = debtLines.length > 0 ? debtLines.join('\n') : '0 USD';

        const payDetail =
          lastOps.lastPaymentDateFormatted && lastOps.lastPaymentAmount && lastOps.lastPaymentAmount > 0
            ? `${lastOps.lastPaymentDateFormatted} — ${formatMoney(lastOps.lastPaymentAmount)} (${lastOps.lastPaymentMethod || "To'lov"})`
            : "To'lov yo'q";
        const finLine = `Oxirgi pul bergan: ${payDetail}`;
        const prodPrefix =
          lastOps.lastProductType === 'qaytarilgan'
            ? 'Mahsulot qaytarilgan'
            : 'Mahsulot berilgan';
        const prodLine = `${prodPrefix}: ${lastOps.lastProductFormatted || "Amaliyot yo'q"}`;
        const opsCell = `${finLine}\n${prodLine}`;

        const actionAndAmount = [
          plannedLabel || '-',
          item.plannedAmount && item.plannedAmount > 0
            ? `Undirish: ${formatMoney(item.plannedAmount)}`
            : '',
        ]
          .filter(Boolean)
          .join('\n');

        const statusStr =
          item.status === 'bajarildi'
            ? 'Bajarildi'
            : item.isClosed || item.status === 'yopildi'
            ? 'Yopilgan'
            : 'Rejada';
        const noteStr = item.planNote || item.reportNote || '';
        const statusCell = noteStr ? `${statusStr}\n${noteStr}` : statusStr;

        return [
          String(index + 1),
          sanitizePdfText(agentCell),
          sanitizePdfText(clientCell),
          sanitizePdfText(phoneCell),
          sanitizePdfText(fullAddress),
          sanitizePdfText(debtAdvanceCell),
          sanitizePdfText(opsCell),
          sanitizePdfText(actionAndAmount),
          sanitizePdfText(statusCell),
        ];
      });

      autoTable(doc, {
        startY: 29,
        margin: { left: marginX, right: marginX, bottom: 10 },
        tableWidth: pageWidth - marginX * 2, // Full 281mm width across A4 Landscape
        head: [
          [
            '#',
            "Qaysi agent orqali qo'shilgan",
            'Mijoz F.I.Sh',
            'Telefon',
            'Manzil',
            'Joriy qarz / Haqdorlik',
            "Oxirgi marta pul bergan va mahsulot amaliyoti (d/m/y)",
            'Tanlangan amal va Undirish',
            'Holati / Izoh',
          ],
        ],
        body: tableRows,
        theme: 'grid',
        styles: {
          font: 'helvetica',
          fontSize: 8,
          cellPadding: 2,
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.3,
          valign: 'top',
          overflow: 'linebreak',
        },
        headStyles: {
          fillColor: [235, 235, 235],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 8,
          lineColor: [0, 0, 0],
          lineWidth: 0.4,
        },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center', fontStyle: 'bold' },
          1: { cellWidth: 30 },
          2: { cellWidth: 34, fontStyle: 'bold' },
          3: { cellWidth: 26 },
          4: { cellWidth: 38 },
          5: { cellWidth: 31, fontStyle: 'bold' },
          6: { cellWidth: 54 },
          7: { cellWidth: 33 },
          8: { cellWidth: 27 },
        },
        didDrawPage: (data) => {
          const pageCount = doc.getNumberOfPages();
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(60, 60, 60);
          doc.text(
            `Sahifa ${data.pageNumber} / ${pageCount}`,
            pageWidth - marginX,
            doc.internal.pageSize.getHeight() - 4,
            { align: 'right' }
          );
        },
      });

      const fileDate = new Date().toISOString().slice(0, 10);
      doc.save(`Rejadagi_mijozlar_${fileDate}.pdf`);

      setPdfSuccessMessage(true);
      setTimeout(() => setPdfSuccessMessage(false), 4000);
    } catch (err) {
      console.error('PDF generation error:', err);
      document.body.classList.add('reja-print-active');
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const renderSheetContent = () => (
    <div
      style={{
        width: '100%',
        backgroundColor: '#ffffff',
        color: '#000000',
        border: '2px solid #000000',
        padding: '16px',
        boxSizing: 'border-box',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          borderBottom: '2px solid #000000',
          paddingBottom: '10px',
          marginBottom: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '16px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '18px',
              fontWeight: 800,
              textTransform: 'uppercase',
              margin: 0,
              color: '#000000',
              letterSpacing: '0.02em',
            }}
          >
            {title}
          </h1>
          <p
            style={{
              fontSize: '11.5px',
              fontWeight: 600,
              margin: '4px 0 0 0',
              color: '#000000',
            }}
          >
            Chop etilgan sana: {printedAtStr} | Jami mijozlar: {plans.length} ta
            {subtitle ? ` | ${subtitle}` : ''}
          </p>
        </div>

        <div
          style={{
            border: '1.5px solid #000000',
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: 800,
            fontFamily: 'monospace',
            textAlign: 'right',
            color: '#000000',
            whiteSpace: 'nowrap',
          }}
        >
          Undirish rejasi jami: {formatMoney(totalPlannedAmount)}
        </div>
      </div>

      {/* Full-width Black-Bordered Table */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
          border: '2px solid #000000',
          fontSize: '10.5px',
          color: '#000000',
        }}
      >
        <thead>
          <tr style={{ backgroundColor: '#f3f4f6' }}>
            <th
              style={{
                border: '1px solid #000000',
                padding: '6px 4px',
                textAlign: 'center',
                fontWeight: 800,
                width: '3.5%',
              }}
            >
              №
            </th>
            <th
              style={{
                border: '1px solid #000000',
                padding: '6px 5px',
                textAlign: 'left',
                fontWeight: 800,
                width: '11%',
              }}
            >
              Qaysi agent orqali qo'shilgan
            </th>
            <th
              style={{
                border: '1px solid #000000',
                padding: '6px 5px',
                textAlign: 'left',
                fontWeight: 800,
                width: '12.5%',
              }}
            >
              Mijoz F.I.Sh
            </th>
            <th
              style={{
                border: '1px solid #000000',
                padding: '6px 5px',
                textAlign: 'left',
                fontWeight: 800,
                width: '9.5%',
              }}
            >
              Telefon
            </th>
            <th
              style={{
                border: '1px solid #000000',
                padding: '6px 5px',
                textAlign: 'left',
                fontWeight: 800,
                width: '13.5%',
              }}
            >
              Manzil
            </th>
            <th
              style={{
                border: '1px solid #000000',
                padding: '6px 5px',
                textAlign: 'left',
                fontWeight: 800,
                width: '11.5%',
              }}
            >
              Joriy qarz / Haqdorlik
            </th>
            <th
              style={{
                border: '1px solid #000000',
                padding: '6px 5px',
                textAlign: 'left',
                fontWeight: 800,
                width: '19%',
              }}
            >
              Oxirgi marta pul bergan va mahsulot amaliyoti (d/m/y)
            </th>
            <th
              style={{
                border: '1px solid #000000',
                padding: '6px 5px',
                textAlign: 'left',
                fontWeight: 800,
                width: '11%',
              }}
            >
              Tanlangan amal va Undirish
            </th>
            <th
              style={{
                border: '1px solid #000000',
                padding: '6px 5px',
                textAlign: 'left',
                fontWeight: 800,
                width: '8.5%',
              }}
            >
              Holati / Izoh
            </th>
          </tr>
        </thead>
        <tbody>
          {plans.map((item, index) => {
            const plannedLabel = formatPlannedActionLabel(
              item.plannedAction || item.actionDone
            );
            const lastOps = getClientLastOperations(item.clientId, clients, allSystemPlans);
            const payDetail =
              lastOps.lastPaymentDateFormatted && lastOps.lastPaymentAmount && lastOps.lastPaymentAmount > 0
                ? `${lastOps.lastPaymentDateFormatted} — ${formatMoney(lastOps.lastPaymentAmount)} (${lastOps.lastPaymentMethod || "To'lov"})`
                : "To'lov yo'q";
            return (
              <tr
                key={item.id}
                style={{
                  pageBreakInside: 'avoid',
                  breakInside: 'avoid',
                }}
              >
                <td
                  style={{
                    border: '1px solid #000000',
                    padding: '5px 4px',
                    textAlign: 'center',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    verticalAlign: 'top',
                  }}
                >
                  {index + 1}
                </td>
                <td
                  style={{
                    border: '1px solid #000000',
                    padding: '5px 5px',
                    verticalAlign: 'top',
                    wordBreak: 'break-word',
                  }}
                >
                  <div style={{ fontWeight: 800 }}>
                    {getAgentDisplayName(item.agentUsername)}
                  </div>
                  <div style={{ fontSize: '9px', marginTop: '2px', fontFamily: 'monospace' }}>
                    {formatDateDMY(item.createdAt)}
                  </div>
                </td>
                <td
                  style={{
                    border: '1px solid #000000',
                    padding: '5px 5px',
                    fontWeight: 700,
                    verticalAlign: 'top',
                    wordBreak: 'break-word',
                  }}
                >
                  {item.clientName}
                </td>
                <td
                  style={{
                    border: '1px solid #000000',
                    padding: '5px 5px',
                    fontFamily: 'monospace',
                    verticalAlign: 'top',
                    wordBreak: 'break-word',
                  }}
                >
                  {item.clientPhone}
                </td>
                <td
                  style={{
                    border: '1px solid #000000',
                    padding: '5px 5px',
                    verticalAlign: 'top',
                    wordBreak: 'break-word',
                  }}
                >
                  {[item.clientRegion, item.clientDistrict].filter(Boolean).join(', ') ||
                    item.clientAddress ||
                    '-'}
                  {item.clientLandmark ? ` (${item.clientLandmark})` : ''}
                </td>
                <td
                  style={{
                    border: '1px solid #000000',
                    padding: '5px 5px',
                    verticalAlign: 'top',
                    fontFamily: 'monospace',
                    fontSize: '10px',
                    wordBreak: 'break-word',
                  }}
                >
                  {lastOps.currentDebt > 0 && (
                    <div style={{ fontWeight: 800 }}>
                      Qarzdorlik: {formatMoney(lastOps.currentDebt)}
                    </div>
                  )}
                  {lastOps.currentAdvance > 0 && (
                    <div style={{ fontWeight: 800, marginTop: lastOps.currentDebt > 0 ? '2px' : 0 }}>
                      Haqdorlik: {formatMoney(lastOps.currentAdvance)}
                    </div>
                  )}
                  {lastOps.currentDebt <= 0 && lastOps.currentAdvance <= 0 && (
                    <span>0 USD</span>
                  )}
                </td>
                <td
                  style={{
                    border: '1px solid #000000',
                    padding: '5px 5px',
                    verticalAlign: 'top',
                    fontSize: '10px',
                    wordBreak: 'break-word',
                  }}
                >
                  <div>
                    <strong>Oxirgi pul bergan: </strong>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                      {payDetail}
                    </span>
                  </div>
                  <div style={{ marginTop: '3px' }}>
                    <strong>
                      {lastOps.lastProductType === 'qaytarilgan'
                        ? 'Mahsulot qaytarilgan: '
                        : 'Mahsulot berilgan: '}
                    </strong>
                    <span style={{ fontFamily: 'monospace' }}>
                      {lastOps.lastProductFormatted || "Amaliyot yo'q"}
                    </span>
                  </div>
                </td>
                <td
                  style={{
                    border: '1px solid #000000',
                    padding: '5px 5px',
                    verticalAlign: 'top',
                    wordBreak: 'break-word',
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{plannedLabel || '-'}</div>
                  {item.plannedAmount && item.plannedAmount > 0 ? (
                    <div
                      style={{
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        fontSize: '9.5px',
                        marginTop: '2px',
                      }}
                    >
                      Undirish: {formatMoney(item.plannedAmount)}
                    </div>
                  ) : null}
                </td>
                <td
                  style={{
                    border: '1px solid #000000',
                    padding: '5px 5px',
                    verticalAlign: 'top',
                    wordBreak: 'break-word',
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    {item.status === 'bajarildi'
                      ? 'Bajarildi'
                      : item.isClosed || item.status === 'yopildi'
                      ? 'Yopilgan'
                      : 'Rejada'}
                  </div>
                  {(item.planNote || item.reportNote) && (
                    <div style={{ fontSize: '9.5px', marginTop: '2px' }}>
                      {item.planNote || item.reportNote}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      {/* 1. Screen Modal UI */}
      <div className="no-print fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
        <div className="relative w-full max-w-6xl bg-white rounded-2xl shadow-2xl border border-neutral-300 my-4 overflow-hidden flex flex-col max-h-[92vh]">
          {/* Top Controls */}
          <div className="px-5 py-3.5 bg-neutral-900 text-white flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <Printer className="w-5 h-5 text-rose-400" />
              <div>
                <h3 className="text-sm sm:text-base font-bold leading-tight">
                  {title} (To'liq A4 PDF / Chop etish)
                </h3>
                <p className="text-[11px] text-neutral-300">
                  To'liq A4 list formatida qora borderli jadval ({plans.length} ta mijoz)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {pdfSuccessMessage && (
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600/20 border border-emerald-400/40 text-emerald-300 text-xs font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>PDF yuklab olindi!</span>
                </span>
              )}
              <button
                type="button"
                disabled={isGeneratingPdf}
                onClick={handleDownloadAndPrintPdf}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-60 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>{isGeneratingPdf ? 'PDF tayyorlanmoqda...' : 'Print / PDF saqlash'}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white cursor-pointer"
                aria-label="Yopish"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Screen Preview Body */}
          <div className="p-3 sm:p-6 overflow-y-auto bg-neutral-100 flex-1">
            {renderSheetContent()}
          </div>

          {/* Bottom Controls */}
          <div className="px-5 py-3 bg-white border-t border-neutral-200 flex items-center justify-between gap-3 shrink-0">
            <span className="text-xs text-neutral-600">
              * "Print / PDF saqlash" tugmasini bosganingizda to'liq A4 formatdagi tayyor PDF fayl qurilmangizga yuklanadi.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isGeneratingPdf}
                onClick={handleDownloadAndPrintPdf}
                className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-black disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-rose-400" />
                <span>{isGeneratingPdf ? 'Tayyorlanmoqda...' : 'Print / PDF saqlash'}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 hover:bg-neutral-100 text-xs font-bold cursor-pointer"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Top-level Print Portal directly inside document.body (for Ctrl+P / browser print) */}
      {typeof document !== 'undefined' &&
        createPortal(
          <div id="reja-print-portal-root" aria-hidden="true">
            {renderSheetContent()}
          </div>,
          document.body
        )}
    </>
  );
};
