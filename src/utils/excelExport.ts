import ExcelJS from 'exceljs';
import { Client, WarehouseProduct } from '../types';
import { formatNumber, formatDate, getAgentDisplayName } from './format';
import {
  WarehouseProductChronologyResult,
  formatPiecesForWarehouseProduct,
} from './warehouseChronology';

export interface ClientBlock2ExportRow {
  client: Client;
  productsSummaryLines: string[]; // e.g., ["Litiy 0.4kg — 2 marta (15 dona, $150)"]
  totalDeliveryEventsCount: number;
  totalQuantity: number;
  paidSumUsd: number;
  creditSumUsd: number;
  totalSumUsd: number;
  priorAdvanceAtCreditUsd?: number;
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
    const priorNote =
      r.creditSumUsd > 0 && r.priorAdvanceAtCreditUsd && r.priorAdvanceAtCreditUsd > 0
        ? `\n(Oldingi haqdorligi bor edi: ${r.priorAdvanceAtCreditUsd} USD)`
        : '';
    const prodText = (r.productsSummaryLines.join('\n') || '-') + priorNote;

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

export interface WarehouseExcelExportOptions {
  products: WarehouseProduct[];
  chronologyMap: Map<string, WarehouseProductChronologyResult>;
  snapshotDate?: string;
  includeCostPrices?: boolean;
  includeMinSellingPrice?: boolean;
  filterSummary?: string;
}

export async function exportWarehouseInventoryToXLSX(
  options: WarehouseExcelExportOptions
): Promise<void> {
  const {
    products,
    chronologyMap,
    snapshotDate = '',
    includeCostPrices = false,
    includeMinSellingPrice = true,
    filterSummary = '',
  } = options;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SavdoNazorat';
  workbook.created = new Date();

  const sheetTitle = snapshotDate
    ? `Ombor qoldig'i (${snapshotDate})`
    : "Ombor mahsulotlari qoldig'i";

  const worksheet = workbook.addWorksheet(sheetTitle.slice(0, 31), {
    views: [{ state: 'frozen', ySplit: 4, showGridLines: true }],
  });

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF1E293B' } },
    left: { style: 'thin', color: { argb: 'FF1E293B' } },
    bottom: { style: 'thin', color: { argb: 'FF1E293B' } },
    right: { style: 'thin', color: { argb: 'FF1E293B' } },
  };

  const headerBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'medium', color: { argb: 'FF0F172A' } },
    left: { style: 'thin', color: { argb: 'FF0F172A' } },
    bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
    right: { style: 'thin', color: { argb: 'FF0F172A' } },
  };

  const totalBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'medium', color: { argb: 'FF0F172A' } },
    left: { style: 'thin', color: { argb: 'FF0F172A' } },
    bottom: { style: 'double', color: { argb: 'FF0F172A' } },
    right: { style: 'thin', color: { argb: 'FF0F172A' } },
  };

  interface ColDef {
    key: string;
    header: string;
    width: number;
    align: 'left' | 'center' | 'right';
    numFmt?: string;
  }

  const colDefs: ColDef[] = [
    { key: 'idx', header: '№', width: 6, align: 'center' },
    { key: 'brand', header: 'Brend', width: 16, align: 'left' },
    { key: 'name', header: 'Mahsulot nomi', width: 38, align: 'left' },
    { key: 'mark', header: 'Marka / Kod', width: 18, align: 'left' },
    { key: 'unitInfo', header: "Birlamchi o'lcham", width: 18, align: 'center' },
    {
      key: 'initialPieces',
      header: 'Bosh qoldiq (dona)',
      width: 17,
      align: 'right',
      numFmt: '#,##0.##',
    },
    {
      key: 'restockedPieces',
      header: 'Yangi keldi (dona)',
      width: 17,
      align: 'right',
      numFmt: '#,##0.##',
    },
    {
      key: 'soldPieces',
      header: 'Sotilgan (dona)',
      width: 15,
      align: 'right',
      numFmt: '#,##0.##',
    },
    {
      key: 'returnedPieces',
      header: 'Qaytgan (dona)',
      width: 15,
      align: 'right',
      numFmt: '#,##0.##',
    },
    {
      key: 'currentPieces',
      header: snapshotDate ? `${snapshotDate} qoldiq (dona)` : 'Joriy qoldiq (dona)',
      width: 19,
      align: 'right',
      numFmt: '#,##0.##',
    },
    { key: 'formattedStock', header: "Qadoq / Dona ko'rinishi", width: 24, align: 'left' },
    { key: 'volume', header: 'Jami hajm', width: 16, align: 'right' },
  ];

  if (includeCostPrices) {
    colDefs.push({
      key: 'costPrice',
      header: 'Kirim narxi (USD)',
      width: 17,
      align: 'right',
      numFmt: '#,##0.00',
    });
  }
  if (includeMinSellingPrice) {
    colDefs.push({
      key: 'minPrice',
      header: 'Min. sotish narxi (USD)',
      width: 19,
      align: 'right',
      numFmt: '#,##0.00',
    });
  }
  if (includeCostPrices) {
    colDefs.push({
      key: 'totalValue',
      header: 'Jami qiymat (USD)',
      width: 19,
      align: 'right',
      numFmt: '#,##0.00',
    });
  }
  colDefs.push({
    key: 'intakeDate',
    header: 'Kirim sanasi',
    width: 14,
    align: 'center',
  });

  worksheet.columns = colDefs.map((c) => ({ key: c.key, width: c.width }));

  const lastColLetter = worksheet.getColumn(colDefs.length).letter;

  // Row 1: Title banner
  const titleRow = worksheet.addRow([
    snapshotDate
      ? `OMBORDAGI MAHSULOTLAR QOLDIG'I (${snapshotDate} HOLATIGA KO'RA)`
      : "OMBORDAGI BARCHA MAHSULOTLAR VA QOLDIQLAR RO'YXATI",
  ]);
  worksheet.mergeCells(`A1:${lastColLetter}1`);
  titleRow.height = 32;
  const titleCell = worksheet.getCell('A1');
  titleCell.font = { name: 'Arial', size: 13.5, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' },
  };
  titleCell.border = headerBorder;

  // Row 2: Subtitle
  const nowStr = new Intl.DateTimeFormat('uz-UZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());

  const subText = [
    `Yuklab olingan sana: ${nowStr}`,
    `Jami mahsulot turlari: ${products.length} ta`,
    snapshotDate ? `Tanlangan sana: ${snapshotDate}` : 'Holat: Joriy (real vaqt)',
    filterSummary ? `Filtr: ${filterSummary}` : '',
  ]
    .filter(Boolean)
    .join('   |   ');

  const subRow = worksheet.addRow([subText]);
  worksheet.mergeCells(`A2:${lastColLetter}2`);
  subRow.height = 22;
  const subCell = worksheet.getCell('A2');
  subCell.font = { name: 'Arial', size: 9.5, italic: true, color: { argb: 'FF1E293B' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  subCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF1F5F9' },
  };
  subCell.border = thinBorder;

  // Row 3: Spacer
  const spacerRow = worksheet.addRow([]);
  spacerRow.height = 8;

  // Row 4: Table Headers
  const headerRow = worksheet.addRow(colDefs.map((c) => c.header));
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };
    cell.border = headerBorder;
  });

  let sumInitial = 0;
  let sumRestocked = 0;
  let sumSold = 0;
  let sumReturned = 0;
  let sumCurrent = 0;
  let sumValue = 0;

  products.forEach((p, idx) => {
    const chron = chronologyMap.get(p.id);
    const snap = snapshotDate && chron ? chron.getStockAtDate(snapshotDate) : null;

    const initialPieces = chron
      ? chron.initialPieces
      : p.initialTotalPieces ?? p.totalPieces ?? 0;
    const restockedPieces = chron ? chron.totalRestockedPieces : 0;
    const soldPieces = chron ? chron.totalSoldPieces : 0;
    const returnedPieces = chron ? chron.totalReturnedPieces : 0;
    const currentPieces = snap
      ? snap.pieces
      : chron
      ? chron.currentPieces
      : p.totalPieces || 0;
    const currentVolume = snap
      ? snap.volume
      : Math.round(currentPieces * (p.volumePerPiece || 1) * 100) / 100;

    const formatted = snap
      ? snap.primaryFormatted
      : formatPiecesForWarehouseProduct(p, currentPieces).primary;

    const piecesPerPkg = Math.max(1, Number(p.piecesPerPackage) || 1);
    const costPerPiece =
      p.pricingUnitType === 'package' && piecesPerPkg > 1
        ? (Number(p.price) || 0) / piecesPerPkg
        : Number(p.price) || 0;
    const rowValue = Math.round(currentPieces * costPerPiece * 100) / 100;

    sumInitial += initialPieces;
    sumRestocked += restockedPieces;
    sumSold += soldPieces;
    sumReturned += returnedPieces;
    sumCurrent += currentPieces;
    sumValue += rowValue;

    const markStr = [p.mark1, p.mark2, ...(p.extraMarks || [])]
      .filter((m) => m && m.trim())
      .join(', ');

    const rowData: Record<string, any> = {
      idx: idx + 1,
      brand: p.brand || 'Umumiy',
      name: p.name || '',
      mark: markStr || '—',
      unitInfo: `1 ${p.pieceUnitName || 'dona'} = ${p.volumePerPiece || 1} ${p.baseUnit || 'dona'}`,
      initialPieces: Math.round(initialPieces * 100) / 100,
      restockedPieces: Math.round(restockedPieces * 100) / 100,
      soldPieces: Math.round(soldPieces * 100) / 100,
      returnedPieces: Math.round(returnedPieces * 100) / 100,
      currentPieces: Math.round(currentPieces * 100) / 100,
      formattedStock: formatted,
      volume: `${formatNumber(currentVolume)} ${p.baseUnit || ''}`.trim(),
      intakeDate: p.intakeDate ? formatDate(p.intakeDate) : '—',
    };

    if (includeCostPrices) {
      rowData.costPrice = Math.round((Number(p.price) || 0) * 100) / 100;
      rowData.totalValue = rowValue;
    }
    if (includeMinSellingPrice) {
      rowData.minPrice = Math.round((Number(p.minSellingPrice) || 0) * 100) / 100;
    }

    const excelRow = worksheet.addRow(colDefs.map((c) => rowData[c.key]));
    excelRow.height = 22;

    const isZero = currentPieces <= 0;
    const isLow = currentPieces > 0 && currentPieces <= 10;
    const zebraFill = idx % 2 === 1 ? 'FFF8FAFC' : 'FFFFFFFF';

    excelRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const def = colDefs[colNumber - 1];
      cell.border = thinBorder;
      cell.font = {
        name: 'Arial',
        size: 9.5,
        bold: def.key === 'currentPieces' || def.key === 'name',
        color: {
          argb:
            def.key === 'currentPieces'
              ? isZero
                ? 'FFBE123C'
                : isLow
                ? 'FFB45309'
                : 'FF047857'
              : 'FF0F172A',
        },
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: def.align,
        wrapText: def.key === 'name' || def.key === 'formattedStock' || def.key === 'mark',
      };
      if (def.numFmt) {
        cell.numFmt = def.numFmt;
      }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: {
          argb:
            def.key === 'currentPieces'
              ? isZero
                ? 'FFFFF1F2'
                : isLow
                ? 'FFFFFBEB'
                : 'FFECFDF5'
              : zebraFill,
        },
      };
    });
  });

  // Totals Footer Row
  const totalMap: Record<string, any> = {
    idx: '',
    brand: '',
    name: `JAMI (${products.length} ta mahsulot):`,
    mark: '',
    unitInfo: '',
    initialPieces: Math.round(sumInitial * 100) / 100,
    restockedPieces: Math.round(sumRestocked * 100) / 100,
    soldPieces: Math.round(sumSold * 100) / 100,
    returnedPieces: Math.round(sumReturned * 100) / 100,
    currentPieces: Math.round(sumCurrent * 100) / 100,
    formattedStock: '',
    volume: '',
    costPrice: '',
    minPrice: '',
    totalValue: Math.round(sumValue * 100) / 100,
    intakeDate: '',
  };

  const totalRow = worksheet.addRow(colDefs.map((c) => totalMap[c.key] ?? ''));
  totalRow.height = 28;
  totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const def = colDefs[colNumber - 1];
    cell.border = totalBorder;
    cell.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: def.key === 'name' ? 'right' : def.align,
    };
    if (def.numFmt && typeof cell.value === 'number') {
      cell.numFmt = def.numFmt;
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fileDate = snapshotDate || new Date().toISOString().slice(0, 10);
  a.download = `Ombor_Qoldiq_${fileDate}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

