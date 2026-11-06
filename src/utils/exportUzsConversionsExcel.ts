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
  isConverted: boolean;
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

  const sheet = workbook.addWorksheet("5-Blok To'lovlar Tahlili", {
    views: [{ state: 'frozen', ySplit: 4 }],
  });

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };

  // Title Row
  sheet.mergeCells('A1:K1');
  const titleCell = sheet.getCell('A1');
  titleCell.value =
    "5-BLOK: TO'LOVLAR VA KONVERTATSIYA TAHLILI HISOBOTI";
  titleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF78350F' }, // Amber-900
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  sheet.getRow(1).height = 28;

  // Subtitle Row
  sheet.mergeCells('A2:K2');
  const subCell = sheet.getCell('A2');
  const totalUzs = items.reduce((s, i) => s + (i.isConverted ? i.amountUzs : 0), 0);
  const totalUsd = Math.round(items.reduce((s, i) => s + i.amountUsd, 0) * 100) / 100;
  const convertedUsd =
    Math.round(
      items.reduce((s, i) => s + (i.isConverted ? i.amountUsd : 0), 0) * 100
    ) / 100;
  const nonConvertedUsd =
    Math.round(
      items.reduce((s, i) => s + (!i.isConverted ? i.amountUsd : 0), 0) * 100
    ) / 100;
  subCell.value = `Davr: ${dateRangeLabel} | Yo'nalish: ${purposeFilterLabel} | So'm: ${new Intl.NumberFormat('uz-UZ').format(totalUzs)} so'm | Dollar: ${totalUsd.toLocaleString('uz-UZ')} USD (Konvertatsiya bilan: ${convertedUsd.toLocaleString('uz-UZ')} USD | Konvertatsiyasiz: ${nonConvertedUsd.toLocaleString('uz-UZ')} USD)`;
  subCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1F2937' } };
  subCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFEF3C7' }, // Amber-100
  };
  subCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  sheet.getRow(2).height = 24;

  sheet.getRow(3).height = 8;

  // Headers Row (Row 4)
  const headers = [
    '№',
    'Sana va vaqt',
    'Mijoz F.I.Sh.',
    'Telefon',
    "Shunchaki to'lov yoki Mahsulot uchun",
    "To'lov usuli",
    "Konvertatsiya bo'lgan yoki yo'q",
    "Qabul qilingan so'm miqdori",
    'Kurs',
    'Dollar qiymati',
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
  headerRow.height = 28;

  // Column widths
  sheet.columns = [
    { key: 'idx', width: 6 },
    { key: 'date', width: 18 },
    { key: 'clientName', width: 28 },
    { key: 'clientPhone', width: 16 },
    { key: 'purpose', width: 22 },
    { key: 'method', width: 18 },
    { key: 'isConverted', width: 20 },
    { key: 'uzs', width: 22 },
    { key: 'rate', width: 15 },
    { key: 'usd', width: 18 },
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
      item.isConverted ? '+' : '-',
      item.isConverted ? item.amountUzs : '-',
      item.isConverted ? item.exchangeRate : '-',
      item.amountUsd,
      `@${item.author}${item.productsSummary ? ` | Mahsulot: ${item.productsSummary}` : ''}${item.note ? ` | Izoh: ${item.note}` : ''}`,
    ]);

    row.height = 22;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = thinBorder;
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF111827' } };
      if (
        colNumber === 1 ||
        colNumber === 2 ||
        colNumber === 4 ||
        colNumber === 5 ||
        colNumber === 6 ||
        colNumber === 7
      ) {
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        if (colNumber === 7) {
          cell.font = {
            name: 'Calibri',
            size: 11,
            bold: true,
            color: { argb: item.isConverted ? 'FF065F46' : 'FF6B7280' },
          };
        }
      } else if (colNumber === 8 || colNumber === 9) {
        if (item.isConverted) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = '#,##0';
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF92400E' } };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF6B7280' } };
        }
      } else if (colNumber === 10) {
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
    '',
    '',
    '',
    '',
    '',
    totalUzs,
    '-',
    totalUsd,
    `Konvertatsiya bilan: ${convertedUsd} USD | Konvertatsiyasiz: ${nonConvertedUsd} USD`,
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
    if (colNumber === 8) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.numFmt = '#,##0';
    } else if (colNumber === 10) {
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
  link.download = `5-Blok_Tolovlar_${todayStr}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
