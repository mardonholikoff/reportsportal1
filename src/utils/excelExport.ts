import ExcelJS from 'exceljs';
import { Client } from '../types';
import { formatNumber, formatDate } from './format';

export async function exportClientsToXLSX(clients: Client[]): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SavdoNazorat';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Mijozlar hisobi', {
    views: [{ showGridLines: true }],
  });

  // Black border definition for all cells
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

  // Define column dimensions & keys
  worksheet.columns = [
    { key: 'index', width: 6 },
    { key: 'name', width: 26 },
    { key: 'phone', width: 18 },
    { key: 'address', width: 28 },
    { key: 'products', width: 42 },
    { key: 'productsTotal', width: 20 },
    { key: 'currentDebt', width: 20 },
    { key: 'currentAdvance', width: 20 },
    { key: 'author', width: 22 },
  ];

  // 1. Title Row (Row 1)
  const titleRow = worksheet.addRow(['MIJOZLAR, TOVARLAR VA QARZDORLIK HISOB-KITOB JADVALI']);
  worksheet.mergeCells('A1:I1');
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

  // 2. Subtitle / Export Date (Row 2)
  const todayStr = new Intl.DateTimeFormat('uz-UZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());

  const subRow = worksheet.addRow([`Hujjat yaratilgan sana: ${todayStr} | Jami mijozlar: ${clients.length} ta`]);
  worksheet.mergeCells('A2:I2');
  subRow.height = 20;
  const subCell = worksheet.getCell('A2');
  subCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF333333' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  subCell.border = blackThinBorder;

  // Row 3: Blank separator
  worksheet.addRow([]);
  worksheet.getRow(3).height = 8;

  // 4. Header Row (Row 4)
  const headers = [
    '№',
    'Mijoz F.I.Sh.',
    'Telefon raqami',
    'Manzili',
    'Topshirilgan mahsulotlar',
    'Mahsulotlar summasi (so\'m)',
    'Joriy qarzdorlik (so\'m)',
    'Joriy haqdorlik / Avans (so\'m)',
    'Qo\'shgan login va sana',
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

  // 5. Data Rows
  let grandProductsSum = 0;
  let grandDebtSum = 0;
  let grandAdvanceSum = 0;

  clients.forEach((client, idx) => {
    const totalProdVal = client.products.reduce(
      (sum, p) => sum + (p.totalPrice || p.quantity * p.unitPrice),
      0
    );

    grandProductsSum += totalProdVal;
    grandDebtSum += client.currentDebt || 0;
    grandAdvanceSum += client.currentAdvance || 0;

    // Formatted list of products
    const prodLines = client.products.map(
      (p, pIdx) =>
        `${pIdx + 1}. ${p.name} — ${formatNumber(p.quantity)} ${p.unit} × ${formatNumber(p.unitPrice)} = ${formatNumber(p.totalPrice || p.quantity * p.unitPrice)} so'm`
    );
    const prodText = prodLines.length > 0 ? prodLines.join('\n') : "Mahsulot berilmagan";

    const authorText = `${client.createdBy || 'adminc'}\n${formatDate(client.createdAt)}`;

    const row = worksheet.addRow([
      idx + 1,
      client.name,
      client.phone || '-',
      client.address || '-',
      prodText,
      totalProdVal,
      client.currentDebt || 0,
      client.currentAdvance || 0,
      authorText,
    ]);

    row.height = Math.max(26, Math.max(prodLines.length, 2) * 17);

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
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      } else if (colNumber === 6) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '#,##0';
      } else if (colNumber === 7) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '#,##0';
        if (client.currentDebt > 0) {
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF991B1B' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFF1F2' },
          };
        }
      } else if (colNumber === 8) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '#,##0';
        if (client.currentAdvance > 0) {
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF065F46' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFECFDF5' },
          };
        }
      } else if (colNumber === 9) {
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      }
    });
  });

  // 6. Summary / Total Row
  const totalRow = worksheet.addRow([
    '',
    'JAMI:',
    '',
    '',
    `${clients.length} ta mijoz bo'yicha jami`,
    grandProductsSum,
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
    } else if (colNumber >= 6 && colNumber <= 8) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.numFmt = '#,##0';
    } else {
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    }
  });

  // Write to buffer and trigger browser download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dateSuffix = new Date().toISOString().slice(0, 10);
  a.download = `mijozlar_hisobi_${dateSuffix}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
