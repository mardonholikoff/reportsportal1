import ExcelJS from 'exceljs';
import { formatDate } from './format';

export interface UzsConversionAnalyticsItem {
  id: string;
  timestamp: string;
  dateStr: string; // YYYY-MM-DD
  clientId: string;
  clientName: string;
  clientPhone: string;
  purpose: 'payment' | 'product'; // 'payment' = Shunchaki to'lov, 'product' = Mahsulot uchun
  purposeLabel: string;
  paymentMethod: string;
  paymentMethodLabel: string;
  amountUzs: number;
  exchangeRate: number;
  amountUsd: number;
  author: string;
  note: string;
  productsSummary?: string;
}

export const exportUzsConversionsToExcel = async (
  items: UzsConversionAnalyticsItem[],
  dateRangeLabel: string,
  purposeFilterLabel: string
): Promise<void> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Savdo Boshqaruv Tizimi';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("5-Blok So'mda To'lovlar", {
    views: [{ state: 'frozen', ySplit: 4 }],
  });

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };

  // Title Row
  sheet.mergeCells('A1:J1');
  const titleCell = sheet.getCell('A1');
  titleCell.value =
    "5-BLOK: SO'MDA (KURS BILAN) QABUL QILINGAN TO'LOVLAR VA MAHSULOT TO'LOVLARI TAHLILI";
  titleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF78350F' }, // Amber-900
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  sheet.getRow(1).height = 28;

  // Subtitle Row
  sheet.mergeCells('A2:J2');
  const subCell = sheet.getCell('A2');
  const totalUzs = items.reduce((s, i) => s + i.amountUzs, 0);
  const totalUsd = Math.round(items.reduce((s, i) => s + i.amountUsd, 0) * 100) / 100;
  subCell.value = `Davr: ${dateRangeLabel} | Yo'nalish: ${purposeFilterLabel} | Jami amaliyotlar: ${items.length} ta | Jami So'm: ${new Intl.NumberFormat('uz-UZ').format(totalUzs)} so'm | Jami Dollar: ${totalUsd.toLocaleString('uz-UZ')} USD`;
  subCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1F2937' } };
  subCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFEF3C7' }, // Amber-100
  };
  subCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  sheet.getRow(2).height = 22;

  sheet.getRow(3).height = 8;

  // Headers Row (Row 4)
  const headers = [
    '№',
    'Sana va vaqt',
    'Mijoz F.I.Sh.',
    'Telefon',
    "To'lov maqsadi (To'lov / Mahsulot)",
    "To'lov usuli",
    "So'm (UZS)",
    'Kurs (1$ = so\'m)',
    'Dollar (USD)',
    "Kim qo'shgan va Izoh",
  ];

  const headerRow = sheet.getRow(4);
  headers.forEach((h, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF111827' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFDE68A' }, // Amber-200
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder;
  });
  headerRow.height = 26;

  // Column widths
  sheet.columns = [
    { key: 'idx', width: 6 },
    { key: 'date', width: 18 },
    { key: 'clientName', width: 28 },
    { key: 'clientPhone', width: 16 },
    { key: 'purpose', width: 22 },
    { key: 'method', width: 18 },
    { key: 'uzs', width: 18 },
    { key: 'rate', width: 15 },
    { key: 'usd', width: 16 },
    { key: 'authorNote', width: 38 },
  ];

  items.forEach((item, index) => {
    const row = sheet.addRow([
      index + 1,
      formatDate(item.timestamp),
      item.clientName,
      item.clientPhone || '-',
      item.purpose === 'product' ? 'Mahsulot uchun' : "Shunchaki to'lov",
      item.paymentMethodLabel,
      item.amountUzs,
      item.exchangeRate,
      item.amountUsd,
      `@${item.author}${item.productsSummary ? ` | Mahsulot: ${item.productsSummary}` : ''}${item.note ? ` | Izoh: ${item.note}` : ''}`,
    ]);

    row.height = 22;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = thinBorder;
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF111827' } };
      if (colNumber === 1 || colNumber === 2 || colNumber === 4 || colNumber === 5 || colNumber === 6) {
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      } else if (colNumber === 7 || colNumber === 8) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '#,##0';
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF92400E' } };
      } else if (colNumber === 9) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '#,##0.00';
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF065F46' } };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      }
    });
  });

  // Totals Footer Row
  const totalRow = sheet.addRow([
    '',
    'JAMI:',
    `${items.length} ta amaliyot`,
    '',
    '',
    '',
    totalUzs,
    items.length > 0 ? Math.round(totalUzs / (totalUsd || 1)) : 0,
    totalUsd,
    '',
  ]);
  totalRow.height = 25;
  totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.border = thinBorder;
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFEF3C7' },
    };
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF111827' } };
    if (colNumber === 7 || colNumber === 8) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.numFmt = '#,##0';
    } else if (colNumber === 9) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.numFmt = '#,##0.00';
    } else {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const todayStr = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `5-Blok_Somda_Tolovlar_${todayStr}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
