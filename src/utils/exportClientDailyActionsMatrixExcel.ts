import ExcelJS from 'exceljs';

export interface ClientDailyMatrixRow {
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  /** Map of YYYY-MM-DD -> 't' | 'b' | 't+b' */
  dailyMarks: Record<string, 't' | 'b' | 't+b'>;
  /** Map of YYYY-MM-DD -> agent username(s) */
  dailyAgents?: Record<string, string>;
  totalActiveDays: number;
  countT: number;
  countB: number;
  countTB: number;
}

export async function exportClientDailyActionsMatrixToExcel(
  rows: ClientDailyMatrixRow[],
  dates: string[], // Array of YYYY-MM-DD (max 31 days)
  startDate: string,
  endDate: string,
  agentFilterLabel: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Savdo va Mijozlar Nazorati Tizimi';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('6-Blok Kunlik Amallar', {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 4 }],
  });

  const formatShortDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}`;
    }
    return dateStr;
  };

  const formatFullDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return dateStr;
  };

  const totalCols = 3 + dates.length + 1; // #, Mijoz, Tel + N days + Jami

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };

  // Row 1: Main Title
  sheet.mergeCells(1, 1, 1, totalCols);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = `6-BLOK: MIJOZLAR BO'YICHA KUNLIK BAJARILIB YOPILGAN AMALLAR MATRITSASI (${formatFullDate(
    startDate
  )} — ${formatFullDate(endDate)})`;
  titleCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' },
  };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 28;

  // Row 2: Subtitle / Legend
  sheet.mergeCells(2, 1, 2, totalCols);
  const subCell = sheet.getCell(2, 1);
  subCell.value = `Tanlangan muddat: ${dates.length} kun (Maks. 31 kun) | Agent filtri: ${agentFilterLabel} | Belgilar: "t" = Telefon qilindi, "b" = Joyiga borildi, "t+b" = Telefon + Joyiga borildi`;
  subCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E293B' } };
  subCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF1F5F9' },
  };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(2).height = 22;

  // Row 3: Blank / Spacer or Summary counts
  let totalT = 0;
  let totalB = 0;
  let totalTB = 0;
  rows.forEach((r) => {
    totalT += r.countT;
    totalB += r.countB;
    totalTB += r.countTB;
  });

  sheet.mergeCells(3, 1, 3, totalCols);
  const statsCell = sheet.getCell(3, 1);
  statsCell.value = `Jami mijozlar: ${rows.length} ta | Jami bajarib yopilgan amallar: ${
    totalT + totalB + totalTB
  } ta (Telefon "t": ${totalT} ta | Joyiga borish "b": ${totalB} ta | Ikkalasi "t+b": ${totalTB} ta)`;
  statsCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF065F46' } };
  statsCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFECFDF5' },
  };
  statsCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(3).height = 20;

  // Row 4: Table Headers
  const headerRow = sheet.getRow(4);
  headerRow.height = 28;

  const baseHeaders = [
    { col: 1, text: '№', width: 6 },
    { col: 2, text: "Mijozlar ro'yxati", width: 32 },
    { col: 3, text: 'Telefon', width: 16 },
  ];

  baseHeaders.forEach((h) => {
    sheet.getColumn(h.col).width = h.width;
    const cell = headerRow.getCell(h.col);
    cell.value = h.text;
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBorder;
  });

  dates.forEach((dStr, idx) => {
    const colIdx = 4 + idx;
    sheet.getColumn(colIdx).width = 8;
    const cell = headerRow.getCell(colIdx);
    cell.value = formatShortDate(dStr);
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F766E' }, // Teal 700
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBorder;
  });

  const totalColIdx = 4 + dates.length;
  sheet.getColumn(totalColIdx).width = 14;
  const totalHeaderCell = headerRow.getCell(totalColIdx);
  totalHeaderCell.value = 'Jami (kun)';
  totalHeaderCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
  totalHeaderCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' },
  };
  totalHeaderCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  totalHeaderCell.border = thinBorder;

  // Data Rows
  let currentRowIdx = 5;
  const perDayCounts: Record<string, number> = {};
  dates.forEach((d) => {
    perDayCounts[d] = 0;
  });

  rows.forEach((row, idx) => {
    const r = sheet.getRow(currentRowIdx);
    r.height = 20;
    const isEven = idx % 2 === 0;
    const baseBg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

    // Col 1: #
    const c1 = r.getCell(1);
    c1.value = idx + 1;
    c1.font = { name: 'Arial', size: 9, color: { argb: 'FF475569' } };
    c1.alignment = { horizontal: 'center', vertical: 'middle' };
    c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
    c1.border = thinBorder;

    // Col 2: Client Name
    const c2 = r.getCell(2);
    c2.value = row.clientName;
    c2.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };
    c2.alignment = { horizontal: 'left', vertical: 'middle' };
    c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
    c2.border = thinBorder;

    // Col 3: Phone
    const c3 = r.getCell(3);
    c3.value = row.clientPhone || '-';
    c3.font = { name: 'Arial', size: 8, color: { argb: 'FF475569' } };
    c3.alignment = { horizontal: 'center', vertical: 'middle' };
    c3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
    c3.border = thinBorder;

    // Date columns
    dates.forEach((dStr, dIdx) => {
      const colIdx = 4 + dIdx;
      const cell = r.getCell(colIdx);
      const mark = row.dailyMarks[dStr];
      cell.border = thinBorder;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };

      if (mark === 't+b') {
        perDayCounts[dStr] = (perDayCounts[dStr] || 0) + 1;
        cell.value = 't+b';
        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF065F46' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
      } else if (mark === 'b') {
        perDayCounts[dStr] = (perDayCounts[dStr] || 0) + 1;
        cell.value = 'b';
        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF5B21B6' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE9FE' } };
      } else if (mark === 't') {
        perDayCounts[dStr] = (perDayCounts[dStr] || 0) + 1;
        cell.value = 't';
        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E40AF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
      } else {
        cell.value = '';
        cell.font = { name: 'Arial', size: 8, color: { argb: 'FFCBD5E1' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
      }
    });

    // Last Col: Total active days for this client
    const cTotal = r.getCell(totalColIdx);
    cTotal.value = row.totalActiveDays > 0 ? row.totalActiveDays : 0;
    cTotal.font = {
      name: 'Arial',
      size: 9,
      bold: row.totalActiveDays > 0,
      color: { argb: row.totalActiveDays > 0 ? 'FF065F46' : 'FF94A3B8' },
    };
    cTotal.alignment = { horizontal: 'center', vertical: 'middle' };
    cTotal.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: row.totalActiveDays > 0 ? 'FFECFDF5' : baseBg },
    };
    cTotal.border = thinBorder;

    currentRowIdx++;
  });

  // Footer Summary Row
  const footerRow = sheet.getRow(currentRowIdx);
  footerRow.height = 24;
  sheet.mergeCells(currentRowIdx, 1, currentRowIdx, 3);
  const footLabel = footerRow.getCell(1);
  footLabel.value = 'JAMI (KUNLAR KESIMIDA):';
  footLabel.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };
  footLabel.alignment = { horizontal: 'right', vertical: 'middle' };
  footLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  footLabel.border = thinBorder;
  footerRow.getCell(2).border = thinBorder;
  footerRow.getCell(3).border = thinBorder;

  let grandTotalMarks = 0;
  dates.forEach((dStr, dIdx) => {
    const colIdx = 4 + dIdx;
    const cnt = perDayCounts[dStr] || 0;
    grandTotalMarks += cnt;
    const c = footerRow.getCell(colIdx);
    c.value = cnt;
    c.font = { name: 'Arial', size: 9, bold: true, color: { argb: cnt > 0 ? 'FF0F766E' : 'FF64748B' } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    c.border = thinBorder;
  });

  const grandTotalCell = footerRow.getCell(totalColIdx);
  grandTotalCell.value = grandTotalMarks;
  grandTotalCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF065F46' } };
  grandTotalCell.alignment = { horizontal: 'center', vertical: 'middle' };
  grandTotalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
  grandTotalCell.border = thinBorder;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `6_Blok_Mijozlar_Kunlik_Amallar_${startDate}_${endDate}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
