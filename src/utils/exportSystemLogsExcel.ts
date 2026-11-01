import ExcelJS from 'exceljs';
import { SystemLog } from '../types';

export async function exportSystemLogsToExcel(
  logs: SystemLog[],
  filterTitle = "Barcha tizim harakatlari",
  customFileName?: string
): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Savdo Boshqaruv Tizimi (adminc1)';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Audit Loglari', {
    views: [{ showGridLines: true }],
  });

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };

  const totalCols = 7;

  // Title Row (Row 1)
  sheet.mergeCells(1, 1, 1, totalCols);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = 'BUTUN TIZIM FOYDALANUVCHILARI HARAKATLARI VA AUDIT LOGLARI ARXIVI';
  titleCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' }, // Slate 900
  };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.border = thinBorder;
  sheet.getRow(1).height = 30;

  // Subtitle (Row 2)
  sheet.mergeCells(2, 1, 2, totalCols);
  const subCell = sheet.getCell(2, 1);
  const nowFormatted = new Date().toLocaleString('uz-UZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  subCell.value = `Davr / Filtr: ${filterTitle} | Arxivlangan sana: ${nowFormatted} | Jami yozuvlar: ${logs.length} ta | Mas'ul: adminc1`;
  subCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF334155' } };
  subCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF1F5F9' },
  };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  subCell.border = thinBorder;
  sheet.getRow(2).height = 24;

  // Column Headers (Row 3)
  const headers = [
    { text: '№', width: 6, col: 1, align: 'center' as const },
    { text: 'Sana va Vaqt', width: 22, col: 2, align: 'center' as const },
    { text: 'Foydalanuvchi', width: 18, col: 3, align: 'center' as const },
    { text: 'Tizimdagi Rol', width: 15, col: 4, align: 'center' as const },
    { text: 'IP Manzil', width: 20, col: 5, align: 'center' as const },
    { text: 'Harakat Sarlavhasi', width: 28, col: 6, align: 'left' as const },
    { text: 'Batafsil Tafsilotlar', width: 52, col: 7, align: 'left' as const },
  ];

  headers.forEach((h) => {
    sheet.getColumn(h.col).width = h.width;
    const c = sheet.getCell(3, h.col);
    c.value = h.text;
    c.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }, // Slate 800
    };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = thinBorder;
  });
  sheet.getRow(3).height = 26;

  // Data rows
  let rowIdx = 4;
  logs.forEach((log, index) => {
    const r = sheet.getRow(rowIdx);
    r.height = 24;

    const formattedDate = new Date(log.timestamp).toLocaleString('uz-UZ', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const values = [
      index + 1,
      formattedDate,
      log.userId,
      log.userRole === 'admin' ? 'Administrator' : 'Savdo Agenti',
      log.ipAddress || 'Aniqlanmadi',
      log.actionTitle || log.actionType,
      log.details,
    ];

    const isEven = index % 2 === 0;

    values.forEach((val, cIdx) => {
      const cell = r.getCell(cIdx + 1);
      cell.value = val;
      cell.font = { name: 'Arial', size: 9 };
      cell.border = thinBorder;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' },
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: headers[cIdx].align,
        wrapText: cIdx === 6 || cIdx === 5,
      };
    });

    rowIdx++;
  });

  // Summary row at bottom
  const summaryRow = sheet.getRow(rowIdx);
  summaryRow.height = 26;
  sheet.mergeCells(rowIdx, 1, rowIdx, 5);
  const sumLabelCell = summaryRow.getCell(1);
  sumLabelCell.value = 'JAMI ARXIVLANGAN AUDIT YOZUVLARI:';
  sumLabelCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
  sumLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };
  sumLabelCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2E8F0' },
  };
  sumLabelCell.border = thinBorder;

  // Apply borders to merged cells
  for (let c = 2; c <= 5; c++) {
    summaryRow.getCell(c).border = thinBorder;
  }

  sheet.mergeCells(rowIdx, 6, rowIdx, 7);
  const sumValCell = summaryRow.getCell(6);
  sumValCell.value = `${logs.length} ta audit log qaydi`;
  sumValCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF047857' } };
  sumValCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sumValCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2E8F0' },
  };
  sumValCell.border = thinBorder;
  summaryRow.getCell(7).border = thinBorder;

  const fileName =
    customFileName ||
    `Tizim_Audit_Loglari_${new Date().toISOString().slice(0, 10)}.xlsx`;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);

  return fileName;
}

