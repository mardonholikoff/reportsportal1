import ExcelJS from 'exceljs';
import { Client } from '../types';

export interface MonthlyProductDeliveryData {
  month: number; // 1 - 12
  monthName: string;
  onCredit: {
    itemsSummary: string; // e.g. "Sut (10 blok), Suv (5 dona)"
    totalQuantity: number;
    totalSum: number;
  };
  paid: {
    itemsSummary: string; // e.g. "Yog' (4 dona)"
    totalQuantity: number;
    totalSum: number;
  };
}

export interface ClientProductAnnualItem {
  client: Client;
  totalDeliveredCreditSum: number;
  totalDeliveredPaidSum: number;
  totalDeliveredPieces: number;
  months: MonthlyProductDeliveryData[];
}

export async function exportClientProductsAnnualToExcel(
  items: ClientProductAnnualItem[],
  year: number,
  filterTitle = "Barcha mijozlar"
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Savdo Boshqaruv Tizimi';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(`Mahsulotlar Yillik ${year}`, {
    views: [{ showGridLines: true }],
  });

  // Solid black border definition for clean, crisp borders around all cells
  const blackBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };

  const monthNames = [
    'Yanvar',
    'Fevral',
    'Mart',
    'Aprel',
    'May',
    'Iyun',
    'Iyul',
    'Avgust',
    'Sentabr',
    'Oktabr',
    'Noyabr',
    'Dekabr',
  ];

  // 6 base columns + 12 months * 2 sub-columns (Qarzga, Qarzsiz) = 30 total columns (A through AD)
  const totalCols = 6 + 12 * 2;

  // 1. Header Title Row (Row 1)
  sheet.mergeCells(1, 1, 1, totalCols);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = `MIJOZLARGA BERILGAN MAHSULOTLARNING ${year}-YIL HAR BIR OY UCHUN TAHLILI (QARZGA VA QARZSIZ)`;
  titleCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' }, // Dark slate
  };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.border = blackBorder;
  sheet.getRow(1).height = 30;

  // 2. Subtitle / Filter Row (Row 2)
  sheet.mergeCells(2, 1, 2, totalCols);
  const subCell = sheet.getCell(2, 1);
  subCell.value = `Filtr: ${filterTitle} | Jami mijozlar: ${items.length} ta | Sana: ${new Date().toLocaleDateString('uz-UZ')}`;
  subCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF334155' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  subCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF1F5F9' },
  };
  subCell.border = blackBorder;
  sheet.getRow(2).height = 20;

  // 3. Set Column Widths
  sheet.getColumn(1).width = 6; // №
  sheet.getColumn(2).width = 28; // Mijoz nomi
  sheet.getColumn(3).width = 16; // Telefon
  sheet.getColumn(4).width = 22; // Viloyat / Tuman
  sheet.getColumn(5).width = 20; // Jami Qarzga berilgan summa
  sheet.getColumn(6).width = 20; // Jami Qarzsiz berilgan summa

  for (let m = 0; m < 12; m++) {
    const creditCol = 7 + m * 2;
    const paidCol = 8 + m * 2;
    sheet.getColumn(creditCol).width = 22;
    sheet.getColumn(paidCol).width = 22;
  }

  // 4. Two-Level Grouped Table Headers (Rows 3 & 4)
  const baseHeaders = [
    { title: '№', col: 1 },
    { title: 'Mijoz nomi', col: 2 },
    { title: 'Telefon', col: 3 },
    { title: 'Viloyat / Tuman', col: 4 },
    { title: 'Jami Qarzga berilgan (so‘m)', col: 5 },
    { title: 'Jami Qarzsiz berilgan (so‘m)', col: 6 },
  ];

  baseHeaders.forEach((bh) => {
    sheet.mergeCells(3, bh.col, 4, bh.col);
    const cell = sheet.getCell(3, bh.col);
    cell.value = bh.title;
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF9F1239' }, // Rose-800
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = blackBorder;
    sheet.getCell(4, bh.col).border = blackBorder;
  });

  // Months Top Header (Row 3, spanning 2 columns each)
  monthNames.forEach((mName, mIdx) => {
    const startCol = 7 + mIdx * 2;
    const endCol = startCol + 1;

    sheet.mergeCells(3, startCol, 3, endCol);
    const mCell = sheet.getCell(3, startCol);
    mCell.value = `${mName} (${year})`;
    mCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    mCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF881337' }, // Rose-900
    };
    mCell.alignment = { horizontal: 'center', vertical: 'middle' };
    mCell.border = blackBorder;
    sheet.getCell(3, endCol).border = blackBorder;

    // Sub-headers (Row 4: Qarzga & Qarzsiz)
    const creditHeaderCell = sheet.getCell(4, startCol);
    creditHeaderCell.value = 'Qarzga berilgan';
    creditHeaderCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF991B1B' } };
    creditHeaderCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFEE2E2' }, // Light red
    };
    creditHeaderCell.alignment = { horizontal: 'center', vertical: 'middle' };
    creditHeaderCell.border = blackBorder;

    const paidHeaderCell = sheet.getCell(4, endCol);
    paidHeaderCell.value = 'Qarzsiz berilgan';
    paidHeaderCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF166534' } };
    paidHeaderCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDCFCE7' }, // Light green
    };
    paidHeaderCell.alignment = { horizontal: 'center', vertical: 'middle' };
    paidHeaderCell.border = blackBorder;
  });

  sheet.getRow(3).height = 24;
  sheet.getRow(4).height = 20;

  // 5. Data Rows (Row 5+)
  let grandCreditSum = 0;
  let grandPaidSum = 0;
  const grandMonthlyCreditSums = new Array(12).fill(0);
  const grandMonthlyPaidSums = new Array(12).fill(0);

  items.forEach((item, index) => {
    const rowNumber = 5 + index;
    const c = item.client;
    grandCreditSum += item.totalDeliveredCreditSum;
    grandPaidSum += item.totalDeliveredPaidSum;

    const locationStr = [c.region, c.district].filter(Boolean).join(', ') || c.address || '-';

    const monthPairs: string[] = [];
    item.months.forEach((m, mIdx) => {
      grandMonthlyCreditSums[mIdx] += m.onCredit.totalSum;
      grandMonthlyPaidSums[mIdx] += m.paid.totalSum;

      // Format Qarzga cell content: items summary + sum
      let creditText = '-';
      if (m.onCredit.totalSum > 0 || m.onCredit.totalQuantity > 0) {
        creditText = `${m.onCredit.itemsSummary ? m.onCredit.itemsSummary + ' ' : ''}(${m.onCredit.totalSum.toLocaleString()} so‘m)`;
      }

      // Format Qarzsiz cell content: items summary + sum
      let paidText = '-';
      if (m.paid.totalSum > 0 || m.paid.totalQuantity > 0) {
        paidText = `${m.paid.itemsSummary ? m.paid.itemsSummary + ' ' : ''}(${m.paid.totalSum.toLocaleString()} so‘m)`;
      }

      monthPairs.push(creditText);
      monthPairs.push(paidText);
    });

    const row = sheet.getRow(rowNumber);
    row.values = [
      index + 1,
      c.name,
      c.phone,
      locationStr,
      item.totalDeliveredCreditSum,
      item.totalDeliveredPaidSum,
      ...monthPairs,
    ];

    row.height = 24;

    for (let col = 1; col <= totalCols; col++) {
      const cell = row.getCell(col);
      cell.border = blackBorder;
      cell.font = { name: 'Arial', size: 9 };

      // Zebra background
      if (index % 2 === 1) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF9FAFB' },
        };
      }

      if (col === 1 || col === 3) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (col === 5) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0';
        if (item.totalDeliveredCreditSum > 0) {
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFDC2626' } };
        }
      } else if (col === 6) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0';
        if (item.totalDeliveredPaidSum > 0) {
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF16A34A' } };
        }
      } else if (col >= 7) {
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        const isCreditCol = (col - 7) % 2 === 0;
        if (cell.value && cell.value !== '-') {
          cell.font = {
            name: 'Arial',
            size: 9,
            bold: true,
            color: { argb: isCreditCol ? 'FFDC2626' : 'FF16A34A' },
          };
        } else {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.font = { name: 'Arial', size: 9, color: { argb: 'FF94A3B8' } };
        }
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    }
  });

  // 6. Summary / Total Row
  const totalRowNumber = 5 + items.length;
  const totalRow = sheet.getRow(totalRowNumber);

  const monthlyTotals: string[] = [];
  for (let m = 0; m < 12; m++) {
    const cred = grandMonthlyCreditSums[m];
    const paid = grandMonthlyPaidSums[m];
    monthlyTotals.push(cred > 0 ? `${cred.toLocaleString()} so‘m` : '-');
    monthlyTotals.push(paid > 0 ? `${paid.toLocaleString()} so‘m` : '-');
  }

  totalRow.values = [
    '',
    'JAMI BERILGAN MAHSULOTLAR:',
    '',
    '',
    grandCreditSum,
    grandPaidSum,
    ...monthlyTotals,
  ];
  totalRow.height = 26;

  sheet.mergeCells(totalRowNumber, 1, totalRowNumber, 4);

  for (let col = 1; col <= totalCols; col++) {
    const cell = totalRow.getCell(col);
    cell.border = blackBorder;
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFEE2E2' }, // Rose-100
    };

    if (col === 1) {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    } else if (col === 5 || col === 6) {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.numFmt = '#,##0';
      if (col === 5) {
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF991B1B' } };
      } else if (col === 6) {
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF166534' } };
      }
    } else {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  }

  // 7. Write to buffer and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `Mijozlarga_Berilgan_Mahsulotlar_${year}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}
