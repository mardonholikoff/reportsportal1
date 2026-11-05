import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Client, DailyPlanItem } from '../types';
import { formatDateDMY, formatMoney, getAgentDisplayName } from '../utils/format';
import { getClientLastOperations } from '../utils/clientActivityDates';
import {
  computePlanTotals,
  exportPlansDetailedToExcel,
} from '../utils/exportPlansDetailedExcel';
import {
  Printer,
  X,
  Download,
  CheckCircle2,
  Image as ImageIcon,
  Share2,
  FileSpreadsheet,
  Filter,
} from 'lucide-react';

interface RejaPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  plans: DailyPlanItem[];
  clients: Client[];
  allSystemPlans: DailyPlanItem[];
}

type ExportScopeType = 'current' | 'all' | 'open' | 'closed' | 'done';

const formatPlannedActionLabel = (action?: string) => {
  if (action === 'telefon' || action === 'telefon qilindi') return 'Telefon qilish';
  if (action === 'joyiga borildi') return 'Joyiga borish';
  if (action === 'ikkisi ham' || action === 'telefon qilindi + joyiga borildi')
    return 'Telefon + Joyiga borish';
  return action || 'Joyiga borish';
};

const isPlanClosedWithoutAction = (item: DailyPlanItem): boolean => {
  if (item.closedWithoutAction !== undefined) return item.closedWithoutAction;
  const hasAnyAction =
    Boolean(item.actionDone) || Boolean(item.actionsHistory && item.actionsHistory.length > 0);
  return !hasAnyAction;
};

const getPlanStatusLabel = (item: DailyPlanItem): string => {
  const isClosed = Boolean(item.isClosed || item.status === 'yopildi');
  if (isClosed) {
    return isPlanClosedWithoutAction(item) ? 'Bajarilmasdan yopilgan' : 'Bajarib yopilgan';
  }
  if (item.status === 'bajarildi' || item.actionDone) return 'Bajarildi (Ochiq)';
  return 'Rejada (Ochiq)';
};

function sanitizePdfText(input: string | undefined | null): string {
  if (!input) return '';
  return String(input)
    .replace(/[\u2018\u2019\u02BB\u02BC\u0060\u00B4]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2116/g, '#')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ');
}

function buildExecutedActionSummary(item: DailyPlanItem): string {
  const lines: string[] = [];
  if (item.actionDone) {
    lines.push(`Bajarilgan: ${formatPlannedActionLabel(item.actionDone)}`);
  }

  const historyList =
    item.actionsHistory && item.actionsHistory.length > 0
      ? item.actionsHistory
      : item.actionDone
      ? [
          {
            timestamp: item.completedAt || item.createdAt,
            author: item.lastExecutedBy || item.agentUsername,
            actionDone: item.actionDone,
            financialAction: item.financialAction,
            productsDelivered: item.productsDelivered,
            deliveryPayment: item.deliveryPayment,
            productsReturned: item.productsReturned,
            reportNote: item.reportNote,
          },
        ]
      : [];

  historyList.forEach((act, idx) => {
    const prefix = historyList.length > 1 ? `[#${idx + 1}] ` : '';
    if (act.financialAction && act.financialAction.amount > 0) {
      const fa = act.financialAction;
      let payStr = `${prefix}To'lov (${fa.methodLabel}): ${formatMoney(fa.amount)} USD`;
      if (fa.amountUzs && fa.exchangeRate) {
        payStr += ` (${new Intl.NumberFormat('en-US').format(fa.amountUzs)} so'm @ ${new Intl.NumberFormat('en-US').format(fa.exchangeRate)})`;
      }
      if (fa.splits && fa.splits.length > 0) {
        const sp = fa.splits
          .map((s) => `${s.methodLabel}: ${formatMoney(s.amount)}$`)
          .join(' + ');
        payStr += ` [${sp}]`;
      }
      lines.push(payStr);
    }

    if (act.productsDelivered && act.productsDelivered.length > 0) {
      const pList = act.productsDelivered
        .map(
          (p) =>
            `${p.name} (${p.quantity} ${p.unit} = ${formatMoney(
              p.totalPrice || p.quantity * p.unitPrice
            )})`
        )
        .join(', ');
      let dpText = '';
      if (act.deliveryPayment) {
        const dp = act.deliveryPayment;
        dpText = ` [${dp.paymentLabel}`;
        if (dp.paidAmount && dp.paidAmount > 0) {
          dpText += `: to'landi ${formatMoney(dp.paidAmount)}`;
        }
        if (dp.debtAmount && dp.debtAmount > 0) {
          dpText += `, nasiya +${formatMoney(dp.debtAmount)}`;
        }
        dpText += ']';
      }
      lines.push(`${prefix}Berildi: ${pList}${dpText}`);
    }

    if (act.productsReturned && act.productsReturned.length > 0) {
      const rList = act.productsReturned
        .map((r) => `${r.name} (${r.quantity} ${r.unit})`)
        .join(', ');
      lines.push(`${prefix}Qaytarildi: ${rList}`);
    }
  });

  if (lines.length === 0) {
    return "Hali amal bajarilmagan";
  }
  return lines.join('\n');
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const paragraphs = (text || '').split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let currentLine = words[0];
    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const testLine = `${currentLine} ${word}`;
      if (ctx.measureText(testLine).width <= maxWidth) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
  }
  return lines;
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
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [scope, setScope] = useState<ExportScopeType>('current');

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('reja-print-active');
      setScope('current');
    } else {
      document.body.classList.remove('reja-print-active');
      setStatusMessage(null);
    }
    return () => {
      document.body.classList.remove('reja-print-active');
    };
  }, [isOpen]);

  const effectivePlans = useMemo(() => {
    const basePool = allSystemPlans && allSystemPlans.length > 0 ? allSystemPlans : plans;
    if (scope === 'current') return plans;
    if (scope === 'all') return basePool;
    if (scope === 'open') {
      return basePool.filter((p) => !p.isClosed && p.status !== 'yopildi');
    }
    if (scope === 'closed') {
      return basePool.filter((p) => Boolean(p.isClosed || p.status === 'yopildi'));
    }
    if (scope === 'done') {
      return basePool.filter((p) => Boolean(p.status === 'bajarildi' || p.actionDone));
    }
    return plans;
  }, [scope, plans, allSystemPlans]);

  if (!isOpen) return null;

  const totalPlannedAmount = effectivePlans.reduce((acc, p) => acc + (p.plannedAmount || 0), 0);
  const totalExecutedPayments = effectivePlans.reduce(
    (acc, p) => acc + computePlanTotals(p).totalPaymentAmount,
    0
  );
  const totalExecutedProducts = effectivePlans.reduce(
    (acc, p) => acc + computePlanTotals(p).totalProductsValue,
    0
  );
  const printedAtStr = formatDateDMY(new Date().toISOString());

  const showTempMessage = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const buildRowsData = () => {
    return effectivePlans.map((item, index) => {
      const plannedLabel = formatPlannedActionLabel(item.plannedAction || item.actionDone);
      const lastOps = getClientLastOperations(item.clientId, clients, allSystemPlans);

      const agentName = getAgentDisplayName(item.agentUsername);
      const executor =
        item.lastExecutedBy ||
        (item.actionsHistory && item.actionsHistory.length > 0
          ? item.actionsHistory[0].author
          : undefined);
      const agentCell = executor
        ? `Tuzdi: ${agentName}\nBajardi: ${getAgentDisplayName(executor)}\nSana: ${formatDateDMY(item.planDate || item.createdAt)}`
        : `Tuzdi: ${agentName}\nSana: ${formatDateDMY(item.planDate || item.createdAt)}`;
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
        `Reja: ${plannedLabel || '-'}`,
        item.plannedAmount && item.plannedAmount > 0
          ? `Undirish: ${formatMoney(item.plannedAmount)}`
          : '',
        buildExecutedActionSummary(item),
      ]
        .filter(Boolean)
        .join('\n');

      const statusStr = getPlanStatusLabel(item);
      const noteParts: string[] = [];
      if (item.closeReason) noteParts.push(`Sabab: ${item.closeReason}`);
      if (item.reportNote && item.reportNote !== item.closeReason)
        noteParts.push(`Hisobot: ${item.reportNote}`);
      if (item.planNote) noteParts.push(`Izoh: ${item.planNote}`);
      const statusCell = noteParts.length > 0 ? `${statusStr}\n${noteParts.join('\n')}` : statusStr;

      return [
        String(index + 1),
        agentCell,
        clientCell,
        phoneCell,
        fullAddress,
        debtAdvanceCell,
        opsCell,
        actionAndAmount,
        statusCell,
      ];
    });
  };

  const handleDownloadExcel = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsGeneratingExcel(true);
    try {
      await exportPlansDetailedToExcel(
        effectivePlans,
        clients,
        allSystemPlans,
        title,
        subtitle,
        'Reja_va_Amallar_Batafsil'
      );
      showTempMessage('Batafsil Excel (.xlsx) fayl yuklab olindi!');
    } catch (err) {
      console.error('Excel export error:', err);
    } finally {
      setIsGeneratingExcel(false);
    }
  };

  // Generates a super-crisp 3x Retina PNG Canvas of the entire plan table
  const generateHighResImageCanvas = (): HTMLCanvasElement => {
    const scale = 3;
    const logicalWidth = 1520;
    const padX = 24;
    const padY = 24;
    const innerWidth = logicalWidth - padX * 2;

    const colRatios = [0.035, 0.11, 0.12, 0.09, 0.125, 0.105, 0.165, 0.15, 0.1];
    const colWidths = colRatios.map((r) => Math.floor(innerWidth * r));
    const usedWidth = colWidths.slice(0, -1).reduce((a, b) => a + b, 0);
    colWidths[colWidths.length - 1] = innerWidth - usedWidth;

    const headers = [
      '№',
      "Qaysi agent orqali qo'shilgan",
      'Mijoz F.I.Sh',
      'Telefon',
      'Manzil',
      'Joriy qarz / Haqdorlik',
      'Oxirgi marta pul bergan va mahsulot amaliyoti (d/m/y)',
      "Rejadagi va Bajarilgan amallar (To'lov / Mahsulot)",
      'Holati / Sabab / Izoh',
    ];

    const rawRows = buildRowsData();

    const measureCanvas = document.createElement('canvas');
    const mCtx = measureCanvas.getContext('2d')!;
    const fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

    const cellPadX = 8;
    const cellPadY = 8;
    const lineHeight = 16;

    mCtx.font = `800 12px ${fontFamily}`;
    const wrappedHeaders = headers.map((h, cIdx) =>
      wrapCanvasText(mCtx, h, colWidths[cIdx] - cellPadX * 2)
    );
    const maxHeaderLines = Math.max(...wrappedHeaders.map((lines) => lines.length), 1);
    const headerRowHeight = maxHeaderLines * lineHeight + cellPadY * 2;

    mCtx.font = `600 11.5px ${fontFamily}`;
    const wrappedBodyRows = rawRows.map((row) =>
      row.map((cellText, cIdx) =>
        wrapCanvasText(mCtx, cellText, colWidths[cIdx] - cellPadX * 2)
      )
    );
    const rowHeights = wrappedBodyRows.map((rowLines) => {
      const maxLines = Math.max(...rowLines.map((l) => l.length), 1);
      return maxLines * lineHeight + cellPadY * 2;
    });

    const topHeaderBoxHeight = 68;
    const gapBetweenHeaderAndTable = 14;
    const totalTableHeight =
      headerRowHeight + rowHeights.reduce((acc, h) => acc + h, 0);
    const logicalHeight =
      padY * 2 + topHeaderBoxHeight + gapBetweenHeaderAndTable + totalTableHeight + 16;

    const canvas = document.createElement('canvas');
    canvas.width = logicalWidth * scale;
    canvas.height = logicalHeight * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(10, 10, logicalWidth - 20, logicalHeight - 20);

    const headerBottomY = padY + topHeaderBoxHeight;
    ctx.beginPath();
    ctx.moveTo(padX, headerBottomY);
    ctx.lineTo(logicalWidth - padX, headerBottomY);
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#000000';
    ctx.font = `800 20px ${fontFamily}`;
    ctx.textBaseline = 'top';
    ctx.fillText(title.toUpperCase(), padX, padY + 6);

    ctx.font = `600 13px ${fontFamily}`;
    const subText = `Chop etilgan sana: ${printedAtStr} | Jami mijozlar: ${effectivePlans.length} ta${
      subtitle ? ` | ${subtitle}` : ''
    }`;
    ctx.fillText(subText, padX, padY + 36);

    const totalStr = `Reja: ${formatMoney(totalPlannedAmount)} | To'lov: ${formatMoney(totalExecutedPayments)} | Mahsulot: ${formatMoney(totalExecutedProducts)}`;
    ctx.font = `800 12.5px monospace`;
    const totalBoxW = ctx.measureText(totalStr).width + 24;
    const totalBoxH = 34;
    const totalBoxX = logicalWidth - padX - totalBoxW;
    const totalBoxY = padY + 10;
    ctx.lineWidth = 1.8;
    ctx.strokeRect(totalBoxX, totalBoxY, totalBoxW, totalBoxH);
    ctx.fillText(totalStr, totalBoxX + 12, totalBoxY + 9);

    let curY = headerBottomY + gapBetweenHeaderAndTable;
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(padX, curY, innerWidth, headerRowHeight);

    let curX = padX;
    for (let cIdx = 0; cIdx < headers.length; cIdx++) {
      const colW = colWidths[cIdx];
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(curX, curY, colW, headerRowHeight);

      ctx.fillStyle = '#000000';
      ctx.font = `800 12px ${fontFamily}`;
      const lines = wrappedHeaders[cIdx];
      lines.forEach((line, lIdx) => {
        if (cIdx === 0) {
          const tw = ctx.measureText(line).width;
          ctx.fillText(line, curX + (colW - tw) / 2, curY + cellPadY + lIdx * lineHeight);
        } else {
          ctx.fillText(line, curX + cellPadX, curY + cellPadY + lIdx * lineHeight);
        }
      });
      curX += colW;
    }

    curY += headerRowHeight;

    for (let rIdx = 0; rIdx < wrappedBodyRows.length; rIdx++) {
      const rowH = rowHeights[rIdx];
      const rowLines = wrappedBodyRows[rIdx];

      ctx.fillStyle = rIdx % 2 === 1 ? '#fafafa' : '#ffffff';
      ctx.fillRect(padX, curY, innerWidth, rowH);

      let cellX = padX;
      for (let cIdx = 0; cIdx < rowLines.length; cIdx++) {
        const colW = colWidths[cIdx];
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(cellX, curY, colW, rowH);

        ctx.fillStyle = '#000000';
        const isBoldCol = cIdx === 0 || cIdx === 2 || cIdx === 5 || cIdx === 8;
        ctx.font = `${isBoldCol ? '700' : '600'} 11.5px ${fontFamily}`;

        const lines = rowLines[cIdx];
        lines.forEach((line, lIdx) => {
          if (cIdx === 0) {
            const tw = ctx.measureText(line).width;
            ctx.fillText(line, cellX + (colW - tw) / 2, curY + cellPadY + lIdx * lineHeight);
          } else {
            ctx.fillText(line, cellX + cellPadX, curY + cellPadY + lIdx * lineHeight);
          }
        });

        cellX += colW;
      }

      curY += rowH;
    }

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      padX,
      headerBottomY + gapBetweenHeaderAndTable,
      innerWidth,
      totalTableHeight
    );

    return canvas;
  };

  const handleDownloadImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsGeneratingImage(true);
    try {
      const canvas = generateHighResImageCanvas();
      canvas.toBlob(
        (blob) => {
          setIsGeneratingImage(false);
          if (!blob) return;
          const fileDate = new Date().toISOString().slice(0, 10);
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `Rejadagi_mijozlar_${fileDate}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          showTempMessage('Tiniq PNG rasm yuklab olindi!');
        },
        'image/png',
        1.0
      );
    } catch (err) {
      console.error('Image generation error:', err);
      setIsGeneratingImage(false);
    }
  };

  const handleShareImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsGeneratingImage(true);
    try {
      const canvas = generateHighResImageCanvas();
      canvas.toBlob(
        async (blob) => {
          setIsGeneratingImage(false);
          if (!blob) return;
          const fileDate = new Date().toISOString().slice(0, 10);
          const fileName = `Rejadagi_mijozlar_${fileDate}.png`;
          const file = new File([blob], fileName, { type: 'image/png' });

          if (
            typeof navigator !== 'undefined' &&
            navigator.share &&
            (!navigator.canShare || navigator.canShare({ files: [file] }))
          ) {
            try {
              await navigator.share({
                title: `${title} (${fileDate})`,
                text: `${title} — Jami: ${effectivePlans.length} ta mijoz`,
                files: [file],
              });
              showTempMessage('Rasm ulashildi!');
              return;
            } catch (shareErr: any) {
              if (shareErr && shareErr.name === 'AbortError') {
                return;
              }
            }
          }

          let copiedToClipboard = false;
          if (
            typeof navigator !== 'undefined' &&
            navigator.clipboard &&
            typeof ClipboardItem !== 'undefined'
          ) {
            try {
              await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob }),
              ]);
              copiedToClipboard = true;
            } catch {
              // ignore
            }
          }

          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);

          showTempMessage(
            copiedToClipboard
              ? 'Rasm nusxalandi (Ctrl+V orqali Telegramga yuborishingiz mumkin) va yuklab olindi!'
              : 'Tiniq PNG rasm yuklab olindi!'
          );
        },
        'image/png',
        1.0
      );
    } catch (err) {
      console.error('Image share error:', err);
      setIsGeneratingImage(false);
    }
  };

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

      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.rect(marginX, 8, pageWidth - marginX * 2, 18);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(sanitizePdfText(title), marginX + 4, 15);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      const subHeader = `Sana: ${sanitizePdfText(printedAtStr)} | Jami: ${effectivePlans.length} ta${
        subtitle ? ` | ${sanitizePdfText(subtitle)}` : ''
      }`;
      doc.text(subHeader, marginX + 4, 22);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      const totalStr = `Reja: ${sanitizePdfText(formatMoney(totalPlannedAmount))} | To'lov: ${sanitizePdfText(formatMoney(totalExecutedPayments))} | Mahsulot: ${sanitizePdfText(formatMoney(totalExecutedProducts))}`;
      doc.text(totalStr, pageWidth - marginX - 4, 18, { align: 'right' });

      const tableRows = buildRowsData().map((row) =>
        row.map((cell) => sanitizePdfText(cell))
      );

      autoTable(doc, {
        startY: 29,
        margin: { left: marginX, right: marginX, bottom: 10 },
        tableWidth: pageWidth - marginX * 2,
        head: [
          [
            '#',
            "Qaysi agent orqali qo'shilgan",
            'Mijoz F.I.Sh',
            'Telefon',
            'Manzil',
            'Joriy qarz / Haqdorlik',
            "Oxirgi marta pul bergan va mahsulot amaliyoti (d/m/y)",
            "Rejadagi va Bajarilgan amallar (To'lov / Mahsulot)",
            'Holati / Sabab / Izoh',
          ],
        ],
        body: tableRows,
        theme: 'grid',
        styles: {
          font: 'helvetica',
          fontSize: 7.5,
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
          fontSize: 7.5,
          lineColor: [0, 0, 0],
          lineWidth: 0.4,
        },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center', fontStyle: 'bold' },
          1: { cellWidth: 28 },
          2: { cellWidth: 32, fontStyle: 'bold' },
          3: { cellWidth: 24 },
          4: { cellWidth: 34 },
          5: { cellWidth: 29, fontStyle: 'bold' },
          6: { cellWidth: 46 },
          7: { cellWidth: 50 },
          8: { cellWidth: 30 },
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
      doc.save(`Reja_va_Amallar_Batafsil_${fileDate}.pdf`);

      showTempMessage('Batafsil PDF yuklab olindi!');
    } catch (err) {
      console.error('PDF generation error:', err);
      document.body.classList.add('reja-print-active');
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const renderSheetContent = () => (
    <div className="w-full bg-white text-black border-2 border-black p-4 box-border font-sans">
      {/* Header */}
      <div className="border-b-2 border-black pb-2.5 mb-3 flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-lg font-extrabold uppercase m-0 text-black tracking-wide">
            {title}
          </h1>
          <p className="text-xs font-semibold mt-1 mb-0 text-black">
            Chop etilgan sana: {printedAtStr} | Jami qatorlar: {effectivePlans.length} ta
            {subtitle ? ` | ${subtitle}` : ''}
          </p>
        </div>

        <div className="border-2 border-black px-3 py-1.5 text-xs font-extrabold font-mono text-right text-black whitespace-nowrap">
          Reja: {formatMoney(totalPlannedAmount)} | To&apos;lov: {formatMoney(totalExecutedPayments)} | Mahsulot: {formatMoney(totalExecutedProducts)}
        </div>
      </div>

      {/* Full-width Black-Bordered Table */}
      <table className="w-full border-collapse table-fixed border-2 border-black text-[10.5px] text-black">
        <thead>
          <tr className="bg-neutral-100">
            <th className="border border-black px-1 py-1.5 text-center font-extrabold w-[3.5%]">
              №
            </th>
            <th className="border border-black px-1.5 py-1.5 text-left font-extrabold w-[10.5%]">
              Qaysi agent orqali qo&apos;shilgan
            </th>
            <th className="border border-black px-1.5 py-1.5 text-left font-extrabold w-[11.5%]">
              Mijoz F.I.Sh
            </th>
            <th className="border border-black px-1.5 py-1.5 text-left font-extrabold w-[9%]">
              Telefon
            </th>
            <th className="border border-black px-1.5 py-1.5 text-left font-extrabold w-[12%]">
              Manzil
            </th>
            <th className="border border-black px-1.5 py-1.5 text-left font-extrabold w-[10.5%]">
              Joriy qarz / Haqdorlik
            </th>
            <th className="border border-black px-1.5 py-1.5 text-left font-extrabold w-[16%]">
              Oxirgi marta pul bergan va mahsulot amaliyoti (d/m/y)
            </th>
            <th className="border border-black px-1.5 py-1.5 text-left font-extrabold w-[17%]">
              Rejadagi va Bajarilgan amallar (To&apos;lov / Mahsulot)
            </th>
            <th className="border border-black px-1.5 py-1.5 text-left font-extrabold w-[10%]">
              Holati / Sabab / Izoh
            </th>
          </tr>
        </thead>
        <tbody>
          {effectivePlans.map((item, index) => {
            const plannedLabel = formatPlannedActionLabel(
              item.plannedAction || item.actionDone
            );
            const lastOps = getClientLastOperations(item.clientId, clients, allSystemPlans);
            const payDetail =
              lastOps.lastPaymentDateFormatted && lastOps.lastPaymentAmount && lastOps.lastPaymentAmount > 0
                ? `${lastOps.lastPaymentDateFormatted} — ${formatMoney(lastOps.lastPaymentAmount)} (${lastOps.lastPaymentMethod || "To'lov"})`
                : "To'lov yo'q";
            const executor =
              item.lastExecutedBy ||
              (item.actionsHistory && item.actionsHistory.length > 0
                ? item.actionsHistory[0].author
                : undefined);
            const executedSummary = buildExecutedActionSummary(item);

            return (
              <tr key={item.id} className="break-inside-avoid">
                <td className="border border-black px-1 py-1.5 text-center font-mono font-bold align-top">
                  {index + 1}
                </td>
                <td className="border border-black px-1.5 py-1.5 align-top break-words">
                  <div className="font-extrabold">
                    Tuzdi: {getAgentDisplayName(item.agentUsername)}
                  </div>
                  {executor && (
                    <div className="font-bold text-[9.5px] mt-0.5">
                      Bajardi: {getAgentDisplayName(executor)}
                    </div>
                  )}
                  <div className="text-[9px] mt-0.5 font-mono">
                    {formatDateDMY(item.planDate || item.createdAt)}
                  </div>
                </td>
                <td className="border border-black px-1.5 py-1.5 font-bold align-top break-words">
                  {item.clientName}
                </td>
                <td className="border border-black px-1.5 py-1.5 font-mono align-top break-words">
                  {item.clientPhone}
                </td>
                <td className="border border-black px-1.5 py-1.5 align-top break-words">
                  {[item.clientRegion, item.clientDistrict].filter(Boolean).join(', ') ||
                    item.clientAddress ||
                    '-'}
                  {item.clientLandmark ? ` (${item.clientLandmark})` : ''}
                </td>
                <td className="border border-black px-1.5 py-1.5 align-top font-mono text-[10px] break-words">
                  {lastOps.currentDebt > 0 && (
                    <div className="font-extrabold">
                      Qarzdorlik: {formatMoney(lastOps.currentDebt)}
                    </div>
                  )}
                  {lastOps.currentAdvance > 0 && (
                    <div className={`font-extrabold ${lastOps.currentDebt > 0 ? 'mt-0.5' : ''}`}>
                      Haqdorlik: {formatMoney(lastOps.currentAdvance)}
                    </div>
                  )}
                  {lastOps.currentDebt <= 0 && lastOps.currentAdvance <= 0 && (
                    <span>0 USD</span>
                  )}
                </td>
                <td className="border border-black px-1.5 py-1.5 align-top text-[10px] break-words">
                  <div>
                    <strong>Oxirgi pul bergan: </strong>
                    <span className="font-mono font-bold">{payDetail}</span>
                  </div>
                  <div className="mt-1">
                    <strong>
                      {lastOps.lastProductType === 'qaytarilgan'
                        ? 'Mahsulot qaytarilgan: '
                        : 'Mahsulot berilgan: '}
                    </strong>
                    <span className="font-mono">
                      {lastOps.lastProductFormatted || "Amaliyot yo'q"}
                    </span>
                  </div>
                </td>
                <td className="border border-black px-1.5 py-1.5 align-top break-words">
                  <div className="font-bold">Reja: {plannedLabel || '-'}</div>
                  {item.plannedAmount && item.plannedAmount > 0 ? (
                    <div className="font-mono font-bold text-[9.5px] mt-0.5">
                      Undirish: {formatMoney(item.plannedAmount)}
                    </div>
                  ) : null}
                  <div className="mt-1 pt-1 border-t border-neutral-300 text-[9.5px] whitespace-pre-line">
                    {executedSummary}
                  </div>
                </td>
                <td className="border border-black px-1.5 py-1.5 align-top break-words">
                  <div className="font-bold">{getPlanStatusLabel(item)}</div>
                  {(item.closeReason || item.reportNote || item.planNote) && (
                    <div className="text-[9.5px] mt-0.5 whitespace-pre-line">
                      {item.closeReason
                        ? `Sabab: ${item.closeReason}`
                        : item.reportNote
                        ? `Hisobot: ${item.reportNote}`
                        : `Izoh: ${item.planNote}`}
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
          <div className="px-4 sm:px-5 py-3.5 bg-neutral-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <Printer className="w-5 h-5 text-rose-400 shrink-0" />
              <div>
                <h3 className="text-sm sm:text-base font-bold leading-tight">
                  {title} (Excel / PDF / Tiniq Rasm)
                </h3>
                <p className="text-[11px] text-neutral-300">
                  Yopilgan va yopilmagan barcha amallar jadvali ({effectivePlans.length} ta qator) — Excel (.xlsx), PDF yoki PNG formatda yuklash
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {statusMessage && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600/20 border border-emerald-400/40 text-emerald-300 text-xs font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{statusMessage}</span>
                </span>
              )}
              <button
                type="button"
                disabled={isGeneratingExcel}
                onClick={handleDownloadExcel}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-60 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="To'liq va batafsil Excel (.xlsx) formatda yuklab olish"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{isGeneratingExcel ? 'Yuklanmoqda...' : 'Excel (.xlsx) yuklash'}</span>
              </button>
              <button
                type="button"
                disabled={isGeneratingPdf}
                onClick={handleDownloadAndPrintPdf}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-60 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>{isGeneratingPdf ? 'PDF tayyorlanmoqda...' : 'PDF / Print saqlash'}</span>
              </button>
              <button
                type="button"
                disabled={isGeneratingImage}
                onClick={handleDownloadImage}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Jadvalni yuqori aniqlikdagi tiniq PNG rasm formatida yuklab olish"
              >
                <ImageIcon className="w-4 h-4" />
                <span>{isGeneratingImage ? 'Tayyorlanmoqda...' : 'Rasm (PNG)'}</span>
              </button>
              <button
                type="button"
                disabled={isGeneratingImage}
                onClick={handleShareImage}
                className="px-3 py-2 rounded-xl bg-neutral-700 hover:bg-neutral-600 disabled:opacity-60 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Rasmni Telegram, WhatsApp yoki boshqa ilovalarga ulashish (Share)"
              >
                <Share2 className="w-4 h-4" />
                <span>Share</span>
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

          {/* Scope Filter Bar */}
          <div className="px-4 sm:px-5 py-2.5 bg-neutral-50 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-700">
              <Filter className="w-3.5 h-3.5 text-neutral-500" />
              <span>Yuklab olish qamrovi:</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'current', label: `Ko'rsatilayotgan ro'yxat (${plans.length})` },
                  {
                    id: 'all',
                    label: `Barchasi: Yopilgan va Yopilmagan (${
                      allSystemPlans && allSystemPlans.length > 0 ? allSystemPlans.length : plans.length
                    })`,
                  },
                  {
                    id: 'open',
                    label: `Faqat yopilmaganlar (${
                      (allSystemPlans && allSystemPlans.length > 0 ? allSystemPlans : plans).filter(
                        (p) => !p.isClosed && p.status !== 'yopildi'
                      ).length
                    })`,
                  },
                  {
                    id: 'closed',
                    label: `Faqat yopilganlar (${
                      (allSystemPlans && allSystemPlans.length > 0 ? allSystemPlans : plans).filter(
                        (p) => Boolean(p.isClosed || p.status === 'yopildi')
                      ).length
                    })`,
                  },
                  {
                    id: 'done',
                    label: `Amal bajarilganlar (${
                      (allSystemPlans && allSystemPlans.length > 0 ? allSystemPlans : plans).filter(
                        (p) => Boolean(p.status === 'bajarildi' || p.actionDone)
                      ).length
                    })`,
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setScope(tab.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    scope === tab.id
                      ? 'bg-neutral-900 text-white shadow-xs'
                      : 'bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Screen Preview Body */}
          <div className="p-3 sm:p-6 overflow-y-auto bg-neutral-100 flex-1">
            {renderSheetContent()}
          </div>

          {/* Bottom Controls */}
          <div className="px-5 py-3 bg-white border-t border-neutral-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <span className="text-xs text-neutral-600">
              * Yopilgan va yopilmagan har qanday amallarni to&apos;liq va batafsil holatda <strong>Excel (.xlsx)</strong>, <strong>PDF</strong> yoki <strong>PNG rasm</strong> formatida yuklab olishingiz mumkin.
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                disabled={isGeneratingExcel}
                onClick={handleDownloadExcel}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel (.xlsx) yuklash</span>
              </button>
              <button
                type="button"
                disabled={isGeneratingPdf}
                onClick={handleDownloadAndPrintPdf}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isGeneratingPdf ? 'Tayyorlanmoqda...' : 'PDF / Print saqlash'}</span>
              </button>
              <button
                type="button"
                disabled={isGeneratingImage}
                onClick={handleDownloadImage}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Rasm (PNG) yuklash</span>
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
