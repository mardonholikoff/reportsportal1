import ExcelJS from 'exceljs';

export interface ActionExportItem {
  id: string;
  timestamp: string;
  agentUsername: string;
  agents?: string[];
  clientName: string;
  clientPhone: string;
  clientLocation: string;
  actionDone: string;
  receiptNaqd: number;
  receiptKarta: number;
  receiptBank: number;
  receiptQr: number;
  totalReceipt: number;
  deliveredProductsDesc: string;
  deliveredCreditSum: number;
  deliveredPaidSum: number;
  totalDeliveredSum: number;
  returnedProductsDesc: string;
  returnedCount: number;
  note: string;
  actionCount?: number;
}

export async function exportAgentActionsToExcel(
  items: ActionExportItem[],
  dateRangeTitle: string,
  filterTitle = "Barcha amallar",
  isConsolidated = false,
  totalActionsSum?: number
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Savdo Boshqaruv Tizimi';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(isConsolidated ? 'Mijozlar Amallari' : 'Agentlar Amallari', {
    views: [{ showGridLines: true }],
  });

  const blackBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };

  const totalCols = 15;

  // 1. Header Title Row (Row 1)
  sheet.mergeCells(1, 1, 1, totalCols);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = isConsolidated
    ? `MIJOZLAR KESIMIDA JAMLANGAN AMALLAR, TUSHUMLAR VA MAHSULOTLAR HARAKATI HISOBOTI`
    : `AGENTLAR AMALIYOTLARI, TUSHUMLAR VA MAHSULOTLAR HARAKATI HISOBOTI`;
  titleCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' },
  };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.border = blackBorder;
  sheet.getRow(1).height = 30;

  // 2. Subtitle / Filter Row (Row 2)
  sheet.mergeCells(2, 1, 2, totalCols);
  const subCell = sheet.getCell(2, 1);
  const countSummary = isConsolidated
    ? `Jamlangan mijozlar: ${items.length} ta${totalActionsSum ? ` (Jami amallar: ${totalActionsSum} ta)` : ''}`
    : `Jami amallar: ${items.length} ta`;
  subCell.value = `Muddat: ${dateRangeTitle} | Amal filtri: ${filterTitle} | ${countSummary} | Sana: ${new Date().toLocaleDateString('uz-UZ')}`;
  subCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF334155' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  subCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF1F5F9' },
  };
  subCell.border = blackBorder;
  sheet.getRow(2).height = 20;

  // 3. Column Widths
  const headers = [
    { header: '№', width: 6 },
    { header: isConsolidated ? 'So‘nggi amal vaqti' : 'Sana & Vaqt', width: 18 },
    { header: isConsolidated ? 'Agent(lar)' : 'Agent', width: 16 },
    { header: 'Mijoz nomi', width: 24 },
    { header: 'Telefon', width: 15 },
    { header: 'Viloyat / Tuman', width: 20 },
    { header: isConsolidated ? 'Amal turi va soni' : 'Amal turi', width: 26 },
    { header: 'Tushum: Naqd', width: 15 },
    { header: 'Tushum: Karta / Bank / QR', width: 18 },
    { header: 'Jami Tushum', width: 16 },
    { header: 'Berilgan mahsulotlar', width: 26 },
    { header: 'Berildi: Qarzga', width: 16 },
    { header: 'Berildi: To‘langan', width: 16 },
    { header: 'Qaytgan mahsulotlar', width: 22 },
    { header: 'Izoh', width: 22 },
  ];

  sheet.getRow(3).values = headers.map((h) => h.header);
  sheet.getRow(3).height = 26;

  for (let col = 1; col <= totalCols; col++) {
    sheet.getColumn(col).width = headers[col - 1].width;
    const cell = sheet.getRow(3).getCell(col);
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF9F1239' }, // Rose-800
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = blackBorder;
  }

  // 4. Data Rows
  let grandNaqd = 0;
  let grandNonCash = 0;
  let grandTotalReceipt = 0;
  let grandCreditDeliv = 0;
  let grandPaidDeliv = 0;

  items.forEach((item, index) => {
    const rowNumber = 4 + index;
    grandNaqd += item.receiptNaqd;
    const nonCash = item.receiptKarta + item.receiptBank + item.receiptQr;
    grandNonCash += nonCash;
    grandTotalReceipt += item.totalReceipt;
    grandCreditDeliv += item.deliveredCreditSum;
    grandPaidDeliv += item.deliveredPaidSum;

    const actionColValue =
      item.actionCount && item.actionCount > 1 && !item.actionDone.includes('marta')
        ? `${item.actionDone} (${item.actionCount} marta)`
        : item.actionDone;

    const row = sheet.getRow(rowNumber);
    row.values = [
      index + 1,
      item.timestamp ? item.timestamp.replace('T', ' ').slice(0, 16) : '-',
      item.agentUsername,
      item.clientName,
      item.clientPhone,
      item.clientLocation,
      actionColValue,
      item.receiptNaqd > 0 ? item.receiptNaqd : 0,
      nonCash > 0 ? nonCash : 0,
      item.totalReceipt > 0 ? item.totalReceipt : 0,
      item.deliveredProductsDesc || '-',
      item.deliveredCreditSum > 0 ? item.deliveredCreditSum : 0,
      item.deliveredPaidSum > 0 ? item.deliveredPaidSum : 0,
      item.returnedProductsDesc || '-',
      item.note || '-',
    ];

    row.height = 24;

    for (let col = 1; col <= totalCols; col++) {
      const cell = row.getCell(col);
      cell.border = blackBorder;
      cell.font = { name: 'Arial', size: 9 };

      if (index % 2 === 1) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF9FAFB' },
        };
      }

      if (col === 1 || col === 2 || col === 3 || col === 5) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (col === 8 || col === 9 || col === 10 || col === 12 || col === 13) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0';
        if (col === 10 && item.totalReceipt > 0) {
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF16A34A' } };
        } else if (col === 12 && item.deliveredCreditSum > 0) {
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFDC2626' } };
        }
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    }
  });

  // 5. Total Row
  const totalRowNumber = 4 + items.length;
  const totalRow = sheet.getRow(totalRowNumber);
  const totalCountLabel = isConsolidated
    ? `${items.length} ta mijoz${totalActionsSum ? ` (${totalActionsSum} ta amal)` : ''}`
    : `${items.length} ta amal`;

  totalRow.values = [
    '',
    'JAMI:',
    '',
    '',
    '',
    '',
    totalCountLabel,
    grandNaqd,
    grandNonCash,
    grandTotalReceipt,
    '',
    grandCreditDeliv,
    grandPaidDeliv,
    '',
    '',
  ];
  totalRow.height = 26;

  sheet.mergeCells(totalRowNumber, 1, totalRowNumber, 6);

  for (let col = 1; col <= totalCols; col++) {
    const cell = totalRow.getCell(col);
    cell.border = blackBorder;
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFEE2E2' },
    };

    if (col === 1 || col === 7) {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    } else if (col === 8 || col === 9 || col === 10 || col === 12 || col === 13) {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.numFmt = '#,##0';
    } else {
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
    }
  }

  // 6. Write and trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = isConsolidated
    ? `Mijozlar_Amallari_Hisoboti_${new Date().toISOString().slice(0, 10)}.xlsx`
    : `Agentlar_Amallari_Hisoboti_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}
