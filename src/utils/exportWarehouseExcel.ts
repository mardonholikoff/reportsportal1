import ExcelJS from 'exceljs';
import { WarehouseProduct } from '../types';

export async function exportWarehouseToExcel(
  products: WarehouseProduct[],
  filterTitle = "Barcha mahsulotlar"
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Savdo Boshqaruv Tizimi';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Ombor Mahsulotlari", {
    views: [{ showGridLines: true }],
  });

  // Solid black border definition for clean, crisp borders around all cells
  const blackBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };

  // 1. Header Title Row (Row 1)
  sheet.mergeCells('A1:I1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `OMBOR MAHSULOTLARI SONI BO'YICHA TAHLILIY HISOBOT (${new Date().toLocaleDateString('uz-UZ')})`;
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
  sheet.mergeCells('A2:I2');
  const subCell = sheet.getCell('A2');
  subCell.value = `Filtr: ${filterTitle} | Jami turlar: ${products.length} ta mahsulot`;
  subCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF334155' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  subCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF1F5F9' },
  };
  subCell.border = blackBorder;
  sheet.getRow(2).height = 20;

  // 3. Table Headers (Row 3)
  const headers = [
    { header: '№', width: 6 },
    { header: 'Mahsulot nomi', width: 30 },
    { header: 'Brendi', width: 20 },
    { header: "O'lchov birligi / Qadoq", width: 22 },
    { header: 'Qadoqdagi dona', width: 16 },
    { header: "Ombor qoldig'i (Dona)", width: 22 },
    { header: 'Qadoqlar soni', width: 16 },
    { header: 'Zaxira holati', width: 16 },
    { header: 'Kiritilgan sana', width: 16 },
  ];

  sheet.getRow(3).values = headers.map((h) => h.header);
  sheet.getRow(3).height = 26;

  for (let col = 1; col <= headers.length; col++) {
    const cell = sheet.getRow(3).getCell(col);
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF9F1239' }, // Rose-800
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = blackBorder;
    sheet.getColumn(col).width = headers[col - 1].width;
  }

  // 4. Populate Data Rows
  let grandTotalPieces = 0;
  let grandTotalPackages = 0;

  products.forEach((p, index) => {
    const rowNumber = 4 + index;
    const pieces = p.totalPieces || 0;
    grandTotalPieces += pieces;

    const piecesPerPkg = p.piecesPerPackage || 1;
    const packages = Math.floor(pieces / piecesPerPkg);
    grandTotalPackages += packages;

    let statusText = 'Yetarli zaxira';
    let statusColor = 'FF16A34A'; // green
    if (pieces <= 0) {
      statusText = 'Tugagan';
      statusColor = 'FFDC2626'; // red
    } else if (pieces <= 10) {
      statusText = 'Kam qolgan';
      statusColor = 'FFD97706'; // amber
    }

    const typeDesc = [
      p.baseUnit,
      p.packageUnitName ? `(${p.packageUnitName})` : '',
    ]
      .filter(Boolean)
      .join(' ');

    const row = sheet.getRow(rowNumber);
    row.values = [
      index + 1,
      p.name,
      p.brand,
      typeDesc || 'Dona',
      piecesPerPkg,
      pieces,
      packages,
      statusText,
      p.intakeDate || p.createdAt?.slice(0, 10) || '-',
    ];

    row.height = 22;

    // Apply black borders and alignment to each cell
    for (let col = 1; col <= 9; col++) {
      const cell = row.getCell(col);
      cell.border = blackBorder;
      cell.font = { name: 'Arial', size: 10 };

      // Alternating background for ease of reading
      if (index % 2 === 1) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF9FAFB' },
        };
      }

      // Column-specific alignment
      if (col === 1 || col === 8 || col === 9) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (col === 5 || col === 6 || col === 7) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0';
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }

      // Status text styling
      if (col === 8) {
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: statusColor } };
      }
    }
  });

  // 5. Summary / Total Row
  const totalRowNumber = 4 + products.length;
  const totalRow = sheet.getRow(totalRowNumber);
  totalRow.values = [
    '',
    "JAMI OMBOR QOLDIG'I",
    '',
    '',
    '',
    grandTotalPieces,
    grandTotalPackages,
    '',
    '',
  ];
  totalRow.height = 26;

  sheet.mergeCells(`A${totalRowNumber}:E${totalRowNumber}`);

  for (let col = 1; col <= 9; col++) {
    const cell = totalRow.getCell(col);
    cell.border = blackBorder;
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF000000' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFEE2E2' }, // Rose-100
    };
    if (col === 1) {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    } else if (col === 6 || col === 7) {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.numFmt = '#,##0';
    } else {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  }

  // 6. Generate file buffer and initiate download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `Ombor_Mahsulotlari_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}
