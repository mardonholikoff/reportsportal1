import { Client, DailyPlanItem } from '../types';
import { formatDate } from './format';

export interface ClientLastOperationsInfo {
  lastFinancialTimestamp: string | null;
  lastFinancialFormatted: string | null;
  lastFinancialLabel: string | null;
  lastProductTimestamp: string | null;
  lastProductFormatted: string | null;
  lastProductType: 'berilgan' | 'qaytarilgan' | null;
  lastProductLabel: string | null;
  currentDebt: number;
  currentAdvance: number;
}

function toTimeMs(iso?: string | null): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function getClientLastOperations(
  clientId: string,
  clients: Client[],
  allPlans: DailyPlanItem[]
): ClientLastOperationsInfo {
  let latestFinTime = 0;
  let latestFinIso: string | null = null;
  let latestFinLabel: string | null = null;

  let latestProdTime = 0;
  let latestProdIso: string | null = null;
  let latestProdType: 'berilgan' | 'qaytarilgan' | null = null;
  let latestProdLabel: string | null = null;

  const updateFin = (iso: string | undefined | null, label: string) => {
    const ms = toTimeMs(iso);
    if (ms > latestFinTime && iso) {
      latestFinTime = ms;
      latestFinIso = iso;
      latestFinLabel = label;
    }
  };

  const updateProd = (
    iso: string | undefined | null,
    type: 'berilgan' | 'qaytarilgan',
    label: string
  ) => {
    const ms = toTimeMs(iso);
    if (ms > latestProdTime && iso) {
      latestProdTime = ms;
      latestProdIso = iso;
      latestProdType = type;
      latestProdLabel = label;
    }
  };

  // 1. Check all daily plans for this client
  for (const plan of allPlans) {
    if (plan.clientId !== clientId) continue;

    if (Array.isArray(plan.actionsHistory) && plan.actionsHistory.length > 0) {
      for (const act of plan.actionsHistory) {
        const ts = act.timestamp || plan.completedAt || plan.createdAt;
        if (act.financialAction && act.financialAction.amount > 0) {
          updateFin(ts, `To'lov (${act.financialAction.methodLabel || 'kirim'})`);
        }
        if (act.deliveryPayment && act.deliveryPayment.paidAmount > 0) {
          updateFin(ts, `Mahsulot to'lovi (${act.deliveryPayment.paymentLabel || 'kirim'})`);
        } else if (act.deliveryPayment && act.deliveryPayment.debtAmount > 0) {
          updateFin(ts, `Qarzga yozildi`);
        }

        if (Array.isArray(act.productsDelivered) && act.productsDelivered.length > 0) {
          updateProd(ts, 'berilgan', 'Mahsulot berilgan');
        }
        if (Array.isArray(act.productsReturned) && act.productsReturned.length > 0) {
          updateProd(ts, 'qaytarilgan', 'Mahsulot qaytarilgan');
        }
      }
    }

    // Also inspect top-level plan fields
    const topTs = plan.completedAt || plan.createdAt;
    if (plan.financialAction && plan.financialAction.amount > 0) {
      updateFin(topTs, `To'lov (${plan.financialAction.methodLabel || 'kirim'})`);
    }
    if (plan.deliveryPayment && plan.deliveryPayment.paidAmount > 0) {
      updateFin(topTs, `Mahsulot to'lovi (${plan.deliveryPayment.paymentLabel || 'kirim'})`);
    } else if (plan.deliveryPayment && plan.deliveryPayment.debtAmount > 0) {
      updateFin(topTs, `Qarzga yozildi`);
    }

    if (Array.isArray(plan.productsDelivered) && plan.productsDelivered.length > 0) {
      updateProd(topTs, 'berilgan', 'Mahsulot berilgan');
    }
    if (Array.isArray(plan.productsReturned) && plan.productsReturned.length > 0) {
      updateProd(topTs, 'qaytarilgan', 'Mahsulot qaytarilgan');
    }
  }

  // 2. Check Client logs and direct fields
  const client = clients.find((c) => c.id === clientId);
  if (client) {
    if (Array.isArray(client.logs)) {
      for (const log of client.logs) {
        const ts = log.timestamp;
        const titleLower = (log.title || '').toLowerCase();
        const detailsLower = (log.details || '').toLowerCase();

        // Financial logs
        if (
          log.type === 'payment' ||
          titleLower.includes("to'lov") ||
          titleLower.includes('tolov') ||
          titleLower.includes('tushum') ||
          titleLower.includes('qarz') ||
          detailsLower.includes("to'lov qabul")
        ) {
          updateFin(ts, log.title || 'Moliyaviy amaliyot');
        }

        // Product logs
        if (
          titleLower.includes('qaytaril') ||
          detailsLower.includes('qaytaril') ||
          titleLower.includes('qaytish')
        ) {
          updateProd(ts, 'qaytarilgan', 'Mahsulot qaytarilgan');
        } else if (
          log.type === 'product_added' ||
          titleLower.includes('mahsulot') ||
          detailsLower.includes('mahsulot berildi') ||
          detailsLower.includes('topshirildi')
        ) {
          updateProd(ts, 'berilgan', 'Mahsulot berilgan');
        }
      }
    }

    // Fallbacks if client has products or initial debt/advance but no explicit log entry
    if (!latestProdIso && Array.isArray(client.products) && client.products.length > 0) {
      updateProd(client.createdAt, 'berilgan', 'Mahsulot berilgan');
    }
    if (!latestFinIso && (client.currentDebt > 0 || client.currentAdvance > 0)) {
      updateFin(client.updatedAt || client.createdAt, 'Hisob qayd etilgan');
    }
  }

  return {
    lastFinancialTimestamp: latestFinIso,
    lastFinancialFormatted: latestFinIso ? formatDate(latestFinIso) : null,
    lastFinancialLabel: latestFinLabel,
    lastProductTimestamp: latestProdIso,
    lastProductFormatted: latestProdIso ? formatDate(latestProdIso) : null,
    lastProductType: latestProdType,
    lastProductLabel: latestProdLabel,
    currentDebt: client?.currentDebt || 0,
    currentAdvance: client?.currentAdvance || 0,
  };
}

/**
 * Prints an HTML element cleanly across a full A4 page using an isolated hidden iframe,
 * completely avoiding modal scroll container clipping or half-page cutoffs.
 */
export function printFullSheetElement(elementId: string, docTitle: string): void {
  const sourceEl = document.getElementById(elementId);
  if (!sourceEl) {
    window.print();
    return;
  }

  // Remove any previous print iframe
  const existingIframe = document.getElementById('__reja_print_iframe__') as HTMLIFrameElement | null;
  if (existingIframe && existingIframe.parentNode) {
    existingIframe.parentNode.removeChild(existingIframe);
  }

  const iframe = document.createElement('iframe');
  iframe.id = '__reja_print_iframe__';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!iframeDoc || !iframe.contentWindow) {
    window.print();
    return;
  }

  const htmlContent = `<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="UTF-8" />
  <title>${docTitle}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 8mm 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      height: auto !important;
      overflow: visible !important;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      font-size: 11px;
      line-height: 1.35;
    }
    .print-sheet-wrapper {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    .print-header {
      border-bottom: 2px solid #000000;
      padding-bottom: 8px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 12px;
    }
    .print-title {
      font-size: 16px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: -0.02em;
      margin: 0;
      color: #000;
    }
    .print-subtitle {
      font-size: 11px;
      font-weight: 600;
      color: #222;
      margin: 3px 0 0 0;
    }
    .print-meta {
      text-align: right;
      font-size: 11px;
      color: #111;
    }
    table {
      width: 100% !important;
      border-collapse: collapse !important;
      table-layout: fixed !important;
      border: 1.5px solid #000000 !important;
      font-size: 10.5px !important;
    }
    thead {
      display: table-header-group;
    }
    tfoot {
      display: table-footer-group;
    }
    tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    th, td {
      border: 1px solid #000000 !important;
      padding: 5px 6px !important;
      vertical-align: top !important;
      word-wrap: break-word !important;
      overflow-wrap: break-word !important;
      color: #000000 !important;
    }
    th {
      background-color: #f3f4f6 !important;
      font-weight: 800 !important;
      text-transform: uppercase;
      font-size: 9.5px !important;
      letter-spacing: 0.02em;
      text-align: left;
    }
    .text-center { text-align: center !important; }
    .text-right { text-align: right !important; }
    .font-bold { font-weight: 700 !important; }
    .font-extrabold { font-weight: 800 !important; }
    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important; }
    .sub-line {
      font-size: 9.5px;
      color: #222;
      margin-top: 2px;
    }
    .badge-box {
      display: inline-block;
      border: 1px solid #000;
      padding: 1px 4px;
      border-radius: 3px;
      font-weight: 700;
      font-size: 9.5px;
      margin-bottom: 2px;
    }
    .print-signatures {
      margin-top: 16px;
      padding-top: 10px;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 700;
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  <div class="print-sheet-wrapper">
    ${sourceEl.innerHTML}
  </div>
</body>
</html>`;

  iframeDoc.open();
  iframeDoc.write(htmlContent);
  iframeDoc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      window.print();
    }
  }, 200);
}
