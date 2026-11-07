import ExcelJS from 'exceljs';
import { Client } from '../types';
import { formatNumber, formatDate, getAgentDisplayName } from './format';

export interface ClientBlock2ExportRow {
  client: Client;
  productsSummaryLines: string[]; // e.g., ["Litiy 0.4kg — 2 marta (15 dona, $150)"]
  totalDeliveryEventsCount: number;
  totalQuantity: number;
  paidSumUsd: number;
  creditSumUsd: number;
  totalSumUsd: number;
}

export async function exportClientsToXLSX(clients: Client[]): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SavdoNazorat';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('1-Blok Mijozlar ro\'yxati', {
    views: [{ showGridLines: true }],
  });

  const blackThinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };

  const headerBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'medium', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'medium', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };

  const totalBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'medium', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'double', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };

  worksheet.columns = [
    { key: 'index', width: 6 },
    { key: 'name', width: 28 },
    { key: 'phone', width: 18 },
    { key: 'address', width: 32 },
    { key: 'currentDebt', width: 22 },
    { key: 'currentAdvance', width: 22 },
    { key: 'author', width: 24 },
  ];

  const titleRow = worksheet.addRow(['MIJOZLAR VA QARZDORLIK / HAQDORLIK RO\'YXATI (1-BLOK)']);
  worksheet.mergeCells('A1:G1');
  titleRow.height = 30;
  const titleCell = worksheet.getCell('A1');
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF000000' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFE4E6' },
  };
  titleCell.border = blackThinBorder;

  const todayStr = new Intl.DateTimeFormat('uz-UZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());

  const subRow = worksheet.addRow([`Hujjat yaratilgan sana: ${todayStr} | Jami mijozlar: ${clients.length} ta`]);
  worksheet.mergeCells('A2:G2');
  subRow.height = 20;
  const subCell = worksheet.getCell('A2');
  subCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF333333' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  subCell.border = blackThinBorder;

  worksheet.addRow([]);
  worksheet.getRow(3).height = 8;

  const headers = [
    '№',
    'Mijoz F.I.Sh.',
    'Telefon raqami',
    'Manzili',
    'Joriy qarzdorlik (USD)',
    'Joriy haqdorlik / Avans (USD)',
    'Qo\'shgan va sana',
  ];

  const headerRow = worksheet.addRow(headers);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFEE2E2' },
    };
    cell.border = headerBorder;
  });

  let grandDebtSum = 0;
  let grandAdvanceSum = 0;

  clients.forEach((client, idx) => {
    grandDebtSum += client.currentDebt || 0;
    grandAdvanceSum += client.currentAdvance || 0;

    const fullAddress =
      [client.region, client.district].filter(Boolean).join(', ') || client.address || '-';
    const authorText = `${getAgentDisplayName(client.createdBy || 'adminc')}\n${formatDate(client.createdAt)}`;

    const row = worksheet.addRow([
      idx + 1,
      client.name,
      client.phone || '-',
      fullAddress,
      client.currentDebt || 0,
      client.currentAdvance || 0,
      authorText,
    ]);

    row.height = 28;

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF000000' } };
      cell.border = blackThinBorder;

      if (colNumber === 1) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNumber === 2) {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
      } else if (colNumber === 3) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNumber === 4) {
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      } else if (colNumber === 5) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '#,##0.00';
        if (client.currentDebt > 0) {
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF991B1B' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFF1F2' },
          };
        }
      } else if (colNumber === 6) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '#,##0.00';
        if (client.currentAdvance > 0) {
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF065F46' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFECFDF5' },
          };
        }
      } else if (colNumber === 7) {
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      }
    });
  });

  const totalRow = worksheet.addRow([
    '',
    'JAMI:',
    '',
    `${clients.length} ta mijoz bo'yicha jami`,
    grandDebtSum,
    grandAdvanceSum,
    '',
  ]);
  totalRow.height = 30;

  totalRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FF000000' } };
    cell.border = totalBorder;
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFE4E6' },
    };

    if (colNumber === 2) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    } else if (colNumber === 5 || colNumber === 6) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.numFmt = '#,##0.00';
    } else {
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dateSuffix = new Date().toISOString().slice(0, 10);
  a.download = `mijozlar_1_blok_${dateSuffix}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportClientProductAnalyticsToXLSX(
  rows: ClientBlock2ExportRow[],
  periodLabel: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SavdoNazorat';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('2-Blok Mahsulotlar tahlili', {
    views: [{ showGridLines: true }],
  });

  const blackThinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };

  const headerBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'medium', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'medium', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };

  const totalBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'medium', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'double', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };

  worksheet.columns = [
    { key: 'index', width: 6 },
    { key: 'name', width: 26 },
    { key: 'phone', width: 16 },
    { key: 'address', width: 26 },
    { key: 'productsFreq', width: 46 },
    { key: 'totalQty', width: 16 },
    { key: 'paidUsd', width: 20 },
    { key: 'creditUsd', width: 20 },
    { key: 'totalUsd', width: 20 },
  ];

  const titleRow = worksheet.addRow(['MAHSULOTLAR ASOSIDA MIJOZLAR TAHLILI (2-BLOK)']);
  worksheet.mergeCells('A1:I1');
  titleRow.height = 30;
  const titleCell = worksheet.getCell('A1');
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF000000' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E7FF' },
  };
  titleCell.border = blackThinBorder;

  const subRow = worksheet.addRow([`Davr: ${periodLabel} | Mijozlar soni: ${rows.length} ta`]);
  worksheet.mergeCells('A2:I2');
  subRow.height = 20;
  const subCell = worksheet.getCell('A2');
  subCell.font = { name: 'Arial', size: 9.5, italic: true, color: { argb: 'FF333333' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  subCell.border = blackThinBorder;

  worksheet.addRow([]);
  worksheet.getRow(3).height = 8;

  const headers = [
    '№',
    'Mijoz F.I.Sh.',
    'Telefon raqami',
    'Manzili',
    'Mahsulotlar va necha marta berilgani',
    'Jami miqdori',
    'Nasiyasiz sotilgan (USD)',
    'Nasiyaga sotilgan (USD)',
    'Jami mahsulot qiymati (USD)',
  ];

  const headerRow = worksheet.addRow(headers);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEEF2FF' },
    };
    cell.border = headerBorder;
  });

  let sumQty = 0;
  let sumPaid = 0;
  let sumCredit = 0;
  let sumTotal = 0;

  rows.forEach((r, idx) => {
    sumQty += r.totalQuantity;
    sumPaid += r.paidSumUsd;
    sumCredit += r.creditSumUsd;
    sumTotal += r.totalSumUsd;

    const fullAddress =
      [r.client.region, r.client.district].filter(Boolean).join(', ') || r.client.address || '-';
    const prodText = r.productsSummaryLines.join('\n') || '-';

    const row = worksheet.addRow([
      idx + 1,
      r.client.name,
      r.client.phone || '-',
      fullAddress,
      prodText,
      r.totalQuantity,
      r.paidSumUsd,
      r.creditSumUsd,
      r.totalSumUsd,
    ]);

    row.height = Math.max(26, Math.max(r.productsSummaryLines.length, 2) * 17);

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF000000' } };
      cell.border = blackThinBorder;

      if (colNumber === 1) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNumber === 2) {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
      } else if (colNumber === 3) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNumber === 4 || colNumber === 5) {
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      } else if (colNumber === 6) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '#,##0.##';
      } else if (colNumber >= 7 && colNumber <= 9) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '#,##0.00';
      }
    });
  });

  const totalRow = worksheet.addRow([
    '',
    'JAMI:',
    '',
    '',
    `${rows.length} ta mijoz bo'yicha jami`,
    sumQty,
    sumPaid,
    sumCredit,
    sumTotal,
  ]);
  totalRow.height = 30;

  totalRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FF000000' } };
    cell.border = totalBorder;
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E7FF' },
    };

    if (colNumber === 2) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    } else if (colNumber >= 6 && colNumber <= 9) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.numFmt = colNumber === 6 ? '#,##0.##' : '#,##0.00';
    } else {
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dateSuffix = new Date().toISOString().slice(0, 10);
  a.download = `mijozlar_mahsulotlar_2_blok_${dateSuffix}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
