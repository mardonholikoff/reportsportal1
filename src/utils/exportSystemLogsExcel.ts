import ExcelJS from 'exceljs';
import { SystemLog } from '../types';

export async function exportSystemLogsToExcel(
  logs: SystemLog[],
  filterTitle = "Barcha tizim harakatlari"
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Savdo Boshqaruv Tizimi';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Tizim Loglari', {
    views: [{ showGridLines: true }],
  });

  const blackBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };

  const totalCols = 7;

  // Title Row (Row 1)
  sheet.mergeCells(1, 1, 1, totalCols);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = 'BUTUN TIZIM FOYDALANUVCHILARI HARAKATLARI VA AUDIT LOGLARI';
  titleCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' },
  };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.border = blackBorder;
  sheet.getRow(1).height = 28;

  // Subtitle (Row 2)
  sheet.mergeCells(2, 1, 2, totalCols);
  const subCell = sheet.getCell(2, 1);
  subCell.value = `Filtr: ${filterTitle} | Eksport vaqti: ${new Date().toLocaleString('uz-UZ')} | Jami yozuvlar: ${logs.length} ta`;
  subCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF334155' } };
  subCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF1F5F9' },
  };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  subCell.border = blackBorder;
  sheet.getRow(2).height = 22;

  // Column Headers (Row 3)
  const headers = [
    { text: '№', width: 6, col: 1 },
    { text: 'Sana va Vaqt', width: 22, col: 2 },
    { text: 'Foydalanuvchi', width: 18, col: 3 },
    { text: 'Rol', width: 14, col: 4 },
    { text: 'IP Manzil', width: 20, col: 5 },
    { text: 'Harakat Turi', width: 22, col: 6 },
    { text: 'Batafsil ma\'lumotlar', width: 45, col: 7 },
  ];

  headers.forEach((h) => {
    sheet.getColumn(h.col).width = h.width;
    const c = sheet.getCell(3, h.col);
    c.value = h.text;
    c.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF475569' },
    };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = blackBorder;
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

    values.forEach((val, cIdx) => {
      const cell = r.getCell(cIdx + 1);
      cell.value = val;
      cell.font = { name: 'Arial', size: 9 };
      cell.border = blackBorder;
      cell.alignment = {
        vertical: 'middle',
        horizontal: cIdx === 0 || cIdx === 3 || cIdx === 4 ? 'center' : 'left',
        wrapText: cIdx === 6,
      };
    });

    rowIdx++;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `Tizim_Audit_Loglari_${new Date().toISOString().slice(0, 10)}.xlsx`;
  anchor.click();
  window.URL.revokeObjectURL(url);
}
