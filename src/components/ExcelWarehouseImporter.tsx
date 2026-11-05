import React, { useState, useMemo } from 'react';
import ExcelJS from 'exceljs';
import { WarehouseProduct } from '../types';
import { StickyTableWrapper } from './StickyTableWrapper';
import {
  FileSpreadsheet,
  Upload,
  Check,
  AlertCircle,
  RotateCcw,
  Sparkles,
  Download,
  Table,
  ArrowRight,
  CheckSquare,
  Square,
  Layers,
  Trash2,
  X,
  Edit3,
} from 'lucide-react';

export type ImportedWarehouseProductPayload = Omit<WarehouseProduct, 'id' | 'createdAt'>;

interface Props {
  currentUsername: string;
  onImportProducts: (products: ImportedWarehouseProductPayload[]) => void;
  onCancel: () => void;
}

type WarehouseFieldKey =
  | 'brand'
  | 'name'
  | 'mark1'
  | 'mark2'
  | 'extraMarks'
  | 'baseUnit'
  | 'pieceUnitName'
  | 'volumePerPiece'
  | 'packageUnitName'
  | 'piecesPerPackage'
  | 'price'
  | 'intakeQuantity'
  | 'totalPieces'
  | 'minSellingPrice'
  | 'intakeDate'
  | 'notes';

interface WarehouseFieldDefinition {
  key: WarehouseFieldKey;
  blockLabel: string;
  label: string;
  required?: boolean;
  inputType: 'text' | 'number' | 'date';
  placeholder: string;
  quickSuggestions?: string[];
  description: string;
  keywords: string[];
}

const WAREHOUSE_FIELDS: WarehouseFieldDefinition[] = [
  {
    key: 'brand',
    blockLabel: '1-Blok',
    label: 'Mahsulot brendi',
    required: true,
    inputType: 'text',
    placeholder: "Qo'lda yozish (masalan: Knauf, Castrol)...",
    quickSuggestions: ['Knauf', 'Castrol', 'Artel', 'Umumiy'],
    description: 'Exceldan ustun tanlang yoki barcha qatorlar uchun brendni qo\'lda yozing',
    keywords: ['brend', 'brand', 'firma', 'ishlab chiqaruvchi', 'zavod', 'бренд', 'фирма', 'производитель'],
  },
  {
    key: 'name',
    blockLabel: '1-Blok',
    label: 'Mahsulot nomi',
    required: true,
    inputType: 'text',
    placeholder: "Qo'lda umumiy nom yoki qo'shimcha so'z yozish...",
    description: 'Mahsulotning asosiy nomi (1 yoki bir nechta ustun tanlash yoki qo\'lda yozish mumkin)',
    keywords: ['mahsulot', 'nomi', 'tovar', 'product', 'name', 'naimenovanie', 'наименование', 'товар', 'название'],
  },
  {
    key: 'mark1',
    blockLabel: '1-Blok',
    label: 'Mahsulot markasi 1',
    inputType: 'text',
    placeholder: "Qo'lda yozish (masalan: M500, 5W-40, A-toifa)...",
    description: 'Exceldan ustun tanlang yoki barcha qatorlar uchun 1-markani qo\'lda kiriting',
    keywords: ['marka 1', 'marka', 'mark1', 'model', 'artikul', 'kod', 'марка', 'модель', 'артикул'],
  },
  {
    key: 'mark2',
    blockLabel: '1-Blok',
    label: 'Mahsulot markasi 2',
    inputType: 'text',
    placeholder: "Qo'lda yozish (masalan: Sintetika, Yashil)...",
    description: 'Exceldan ustun tanlang yoki barcha qatorlar uchun 2-markani qo\'lda kiriting',
    keywords: ['marka 2', 'mark2', 'tur', 'toifa', 'kategoriya', 'rang', 'марка 2', 'тип', 'категория'],
  },
  {
    key: 'extraMarks',
    blockLabel: '1-Blok',
    label: "Qo'shimcha markalar (Marka 3, 4...)",
    inputType: 'text',
    placeholder: "Qo'lda yozish (vergul bilan ajrating: 1-sort, Germaniya)...",
    description: 'Bir nechta ustun tanlang yoki barcha qatorlar uchun vergul bilan qo\'lda yozing',
    keywords: ['marka 3', 'marka 4', "qo'shimcha marka", 'xususiyat', 'seriya', 'партия', 'серия'],
  },
  {
    key: 'baseUnit',
    blockLabel: '2-Blok (2.1)',
    label: "O'lchov birligi (litr, kg, metr, dona)",
    required: true,
    inputType: 'text',
    placeholder: 'Masalan: litr, kg, metr, dona',
    quickSuggestions: ['dona', 'litr', 'kg', 'metr', 'm²'],
    description: "Birlamchi o'lchov birligi (Ustundan yoki barcha qatorlar uchun qo'lda)",
    keywords: ["o'lchov birligi", 'birlik', 'birligi', 'unit', 'ed.izm', 'ед.изм', 'единица'],
  },
  {
    key: 'pieceUnitName',
    blockLabel: '2-Blok (2.1)',
    label: 'Dona / idish nomi',
    required: true,
    inputType: 'text',
    placeholder: 'Masalan: 1 dona, 1 idish, 1 shisha',
    quickSuggestions: ['1 dona', '1 idish', '1 shisha', '1 list', '1 rulon'],
    description: 'Birlamchi dona/idish nomi (Ustundan yoki barcha qatorlar uchun qo\'lda)',
    keywords: ['idish', 'dona nomi', 'upakovka', 'tara', 'тара', 'штука'],
  },
  {
    key: 'volumePerPiece',
    blockLabel: '2-Blok (2.1)',
    label: '1 donadagi hajm / vazn',
    required: true,
    inputType: 'number',
    placeholder: 'Masalan: 1 yoki 5',
    quickSuggestions: ['1', '4', '5', '10', '20', '50'],
    description: '1 donadagi hajm (masalan: 1 idish = 5 litr bo\'lsa, 5 yoziladi)',
    keywords: ['donada hajm', 'hajm', 'hajmi', 'vazn', 'ves', 'obyom', 'объем', 'вес'],
  },
  {
    key: 'packageUnitName',
    blockLabel: '2-Blok (2.2)',
    label: "Katta o'lcham / Qadoq nomi (ixtiyoriy)",
    inputType: 'text',
    placeholder: "Bo'sh qoldirish yoki yozish (korobka, qop, blok)...",
    quickSuggestions: ['korobka', 'qop', 'blok', 'yashik'],
    description: "Masalan: korobka, qop, blok (Bo'sh qolsa mahsulotlar donalab hisoblanadi)",
    keywords: ['qadoq', 'korobka', 'qop', 'blok', 'yashik', 'коробка', 'мешок', 'упаковка'],
  },
  {
    key: 'piecesPerPackage',
    blockLabel: '2-Blok (2.2)',
    label: '1 qadoqdagi dona soni (ixtiyoriy)',
    inputType: 'number',
    placeholder: 'Masalan: 4, 6, 10, 20...',
    quickSuggestions: ['4', '6', '8', '10', '12', '20'],
    description: '1 korobka/qop ichida nechta dona borligi (Ustundan yoki barcha qatorlar uchun qo\'lda)',
    keywords: ['qadoqda dona', 'korobkada sona', 'dona soni', 'v korobke', 'в коробке', 'в упаковке'],
  },
  {
    key: 'price',
    blockLabel: '3-Blok',
    label: 'Kirim narxi (USD) (ixtiyoriy)',
    inputType: 'number',
    placeholder: "Narxsiz (0 USD) yoki barcha qatorga narx yozing...",
    description: "Omborga kirim narxi (Ustundan yoki barcha qatorlarga bir xil kirim narxi qo'lda)",
    keywords: ['kirim narx', 'tan narx', 'tannarx', 'optom narx', 'narx', 'price', 'cost', 'цена прихода', 'себестоимость'],
  },
  {
    key: 'intakeQuantity',
    blockLabel: '4-Blok',
    label: 'Kirim soni (Miqdori)',
    required: true,
    inputType: 'number',
    placeholder: 'Masalan: 10, 50, 100...',
    quickSuggestions: ['1', '10', '20', '50', '100'],
    description: 'Qabul qilinayotgan mahsulot soni (Excel ustunidan yoki barcha qatorga bir xil miqdor)',
    keywords: ['kirim soni', 'soni', 'miqdor', 'miqdori', 'kolichestvo', 'kol-vo', 'qty', 'quantity', 'количество', 'приход'],
  },
  {
    key: 'totalPieces',
    blockLabel: '4-Blok',
    label: "Jami dona qoldig'i (ixtiyoriy)",
    inputType: 'number',
    placeholder: 'Avtomatik hisoblanadi yoki qo\'lda yozing...',
    description: "Agar Excelda tayyor jami dona ustuni bo'lsa tanlang yoki barcha qator uchun qo'lda yozing",
    keywords: ['jami dona', 'ombor qoldiq', 'qoldiq', 'ostatok', 'total pieces', 'остаток', 'всего штук'],
  },
  {
    key: 'intakeDate',
    blockLabel: '4-Blok',
    label: 'Kirim sanasi',
    inputType: 'date',
    placeholder: 'YYYY-MM-DD',
    description: 'Exceldan sana ustunini tanlang yoki barcha qatorlar uchun sanani qo\'lda belgilang',
    keywords: ['sana', 'kirim sanasi', 'date', 'дата'],
  },
  {
    key: 'minSellingPrice',
    blockLabel: '5-Blok',
    label: 'Eng kam sotilish narxi (USD)',
    required: true,
    inputType: 'number',
    placeholder: 'Masalan: 15, 30, 50 (USD)...',
    description: "Agentlar mijozga sotayotganda ko'rinadigan eng kam sotilish narxi (Ustundan yoki qo'lda)",
    keywords: [
      'sotilish narx',
      'sotish narx',
      'eng kam narx',
      'minimal narx',
      'sotuv narxi',
      'min price',
      'selling price',
      'цена продажи',
      'мин цена',
      'цена',
    ],
  },
  {
    key: 'notes',
    blockLabel: "Qo'shimcha",
    label: 'Izoh / Eslatma',
    inputType: 'text',
    placeholder: "Barcha qatorlarga umumiy izoh (masalan: 1-partiya)...",
    description: "Exceldan ustun(lar) tanlang yoki barcha qatorlarga tushadigan umumiy izohni qo'lda yozing",
    keywords: ['izoh', 'eslatma', 'komment', 'note', 'notes', 'примечание', 'комментарий'],
  },
];

interface ParsedSheet {
  name: string;
  grid: string[][];
}

function colIndexToLetter(idx: number): string {
  let letter = '';
  let temp = idx + 1;
  while (temp > 0) {
    const rem = (temp - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    temp = Math.floor((temp - 1) / 26);
  }
  return letter;
}

function extractCellText(val: ExcelJS.CellValue): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  if (typeof val === 'object') {
    if ('result' in val && val.result !== undefined && val.result !== null) {
      if (val.result instanceof Date) return val.result.toISOString().slice(0, 10);
      return String(val.result).trim();
    }
    if ('richText' in val && Array.isArray(val.richText)) {
      return val.richText.map((rt) => rt.text || '').join('').trim();
    }
    if ('text' in val && typeof val.text === 'string') {
      return val.text.trim();
    }
  }
  return String(val).trim();
}

function parseNumericValue(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw
    .replace(/,/g, '.')
    .replace(/[^\d.-]/g, '')
    .trim();
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? Math.max(0, Math.round(num * 100) / 100) : 0;
}

const createEmptyFieldMap = (): Record<WarehouseFieldKey, number[]> => ({
  brand: [],
  name: [],
  mark1: [],
  mark2: [],
  extraMarks: [],
  baseUnit: [],
  pieceUnitName: [],
  volumePerPiece: [],
  packageUnitName: [],
  piecesPerPackage: [],
  price: [],
  intakeQuantity: [],
  totalPieces: [],
  minSellingPrice: [],
  intakeDate: [],
  notes: [],
});

const createInitialManualValues = (todayStr: string): Record<WarehouseFieldKey, string> => ({
  brand: '',
  name: '',
  mark1: '',
  mark2: '',
  extraMarks: '',
  baseUnit: 'dona',
  pieceUnitName: '1 dona',
  volumePerPiece: '1',
  packageUnitName: '',
  piecesPerPackage: '',
  price: '',
  intakeQuantity: '',
  totalPieces: '',
  minSellingPrice: '',
  intakeDate: todayStr,
  notes: '',
});

export const ExcelWarehouseImporter: React.FC<Props> = ({
  currentUsername,
  onImportProducts,
  onCancel,
}) => {
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [fileName, setFileName] = useState<string>('');
  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [selectedSheetIdx, setSelectedSheetIdx] = useState<number>(0);
  const [orientation, setOrientation] = useState<'columns' | 'rows'>('columns');
  const [headerIndex, setHeaderIndex] = useState<number>(0);

  // Multi-column mapping: each field can have 0, 1, or multiple column indices
  const [fieldMap, setFieldMap] = useState<Record<WarehouseFieldKey, number[]>>(createEmptyFieldMap);

  // Manual values per field: when entered by admin, applies across all rows in the table!
  const [manualValues, setManualValues] = useState<Record<WarehouseFieldKey, string>>(() =>
    createInitialManualValues(todayStr)
  );

  // Whether manual value should override even if an Excel column is also selected, or combine/fallback
  // For maximum clarity: if a field has ONLY manual value (no column selected), it applies to 100% of rows.
  // If both column AND manual value are set, manual value overrides all rows if forceManualOverride[key] is true,
  // or fills/combines! Let's make typing a manual value automatically apply to all rows when forceOverride is on (default on when user types in a field).
  const [manualOverrideActive, setManualOverrideActive] = useState<
     Partial<Record<WarehouseFieldKey, boolean>>
  >({});

  const [excludedRecordIndices, setExcludedRecordIndices] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentSheet = sheets[selectedSheetIdx] || null;

  // Source columns / rows descriptors
  const sourceDescriptors = useMemo(() => {
    if (!currentSheet || currentSheet.grid.length === 0) return [];
    const grid = currentSheet.grid;

    if (orientation === 'columns') {
      const maxCols = grid.reduce((max, r) => Math.max(max, r.length), 0);
      const headerRow = headerIndex >= 0 && headerIndex < grid.length ? grid[headerIndex] : [];
      const sampleRowIdx = headerIndex >= 0 ? headerIndex + 1 : 0;
      const sampleRow = sampleRowIdx < grid.length ? grid[sampleRowIdx] : [];

      return Array.from({ length: maxCols }, (_, colIdx) => {
        const letter = colIndexToLetter(colIdx);
        const title = (headerRow[colIdx] || '').trim();
        const sample = (sampleRow[colIdx] || '').trim();
        return {
          index: colIdx,
          code: `Ustun ${letter}`,
          title: title || `${colIdx + 1}-ustun`,
          sample,
          label: `${letter}-ustun: ${title ? `"${title}"` : '(Sarlavhasiz)'}${
            sample ? ` — Namuna: "${sample.slice(0, 26)}"` : ''
          }`,
        };
      });
    } else {
      return grid.map((row, rowIdx) => {
        const title = headerIndex >= 0 ? (row[headerIndex] || '').trim() : '';
        const sampleColIdx = headerIndex >= 0 ? headerIndex + 1 : 0;
        const sample = (row[sampleColIdx] || '').trim();
        return {
          index: rowIdx,
          code: `${rowIdx + 1}-qator`,
          title: title || `${rowIdx + 1}-qator`,
          sample,
          label: `${rowIdx + 1}-qator: ${title ? `"${title}"` : '(Sarlavhasiz)'}${
            sample ? ` — Namuna: "${sample.slice(0, 26)}"` : ''
          }`,
        };
      });
    }
  }, [currentSheet, orientation, headerIndex]);

  // Auto-match columns to warehouse fields based on header titles
  const autoMatchFields = (
    descriptors: Array<{ index: number; title: string; sample: string }>
  ) => {
    const newMap = createEmptyFieldMap();
    const usedIndices = new Set<number>();

    WAREHOUSE_FIELDS.forEach((field) => {
      for (const desc of descriptors) {
        if (usedIndices.has(desc.index)) continue;
        const t = desc.title.toLowerCase().trim();
        if (!t) continue;
        const matched = field.keywords.some((kw) => t.includes(kw.toLowerCase()));
        if (matched) {
          newMap[field.key] = [desc.index];
          usedIndices.add(desc.index);
          break;
        }
      }
    });

    if (newMap.name.length === 0 && descriptors.length > 0) {
      const firstUnused = descriptors.find((d) => !usedIndices.has(d.index));
      if (firstUnused) {
        newMap.name = [firstUnused.index];
        usedIndices.add(firstUnused.index);
      }
    }

    setFieldMap(newMap);
    setManualOverrideActive({});
  };

  const applySheetConfig = (
    targetSheet: ParsedSheet | undefined,
    nextOrientation: 'columns' | 'rows',
    nextHeaderIdx: number
  ) => {
    if (!targetSheet || targetSheet.grid.length === 0) return;
    const grid = targetSheet.grid;

    if (nextOrientation === 'columns') {
      const maxCols = grid.reduce((max, r) => Math.max(max, r.length), 0);
      const headerRow = nextHeaderIdx >= 0 && nextHeaderIdx < grid.length ? grid[nextHeaderIdx] : [];
      const sampleRow =
        nextHeaderIdx + 1 < grid.length ? grid[nextHeaderIdx + 1] : grid[0] || [];
      const descs = Array.from({ length: maxCols }, (_, colIdx) => ({
        index: colIdx,
        title: (headerRow[colIdx] || '').trim(),
        sample: (sampleRow[colIdx] || '').trim(),
      }));
      autoMatchFields(descs);
    } else {
      const descs = grid.map((row, rowIdx) => ({
        index: rowIdx,
        title: nextHeaderIdx >= 0 ? (row[nextHeaderIdx] || '').trim() : '',
        sample: (row[nextHeaderIdx >= 0 ? nextHeaderIdx + 1 : 0] || '').trim(),
      }));
      autoMatchFields(descs);
    }
    setExcludedRecordIndices(new Set());
  };

  // Load .xlsx file
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setErrorMsg(null);
    setFileName(file.name);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);

      const parsedSheets: ParsedSheet[] = [];

      workbook.eachSheet((worksheet) => {
        const rowsGrid: string[][] = [];
        let maxColCount = 0;

        worksheet.eachRow({ includeEmpty: false }, (row) => {
          const rowValues: string[] = [];
          const colCount = Math.max(row.cellCount, row.actualCellCount);
          for (let c = 1; c <= colCount; c++) {
            const cell = row.getCell(c);
            rowValues.push(extractCellText(cell.value));
          }
          if (rowValues.some((v) => v !== '')) {
            rowsGrid.push(rowValues);
            if (rowValues.length > maxColCount) {
              maxColCount = rowValues.length;
            }
          }
        });

        const normalizedGrid = rowsGrid.map((r) => {
          const copy = [...r];
          while (copy.length < maxColCount) copy.push('');
          return copy;
        });

        if (normalizedGrid.length > 0) {
          parsedSheets.push({
            name: worksheet.name || `Varaq ${parsedSheets.length + 1}`,
            grid: normalizedGrid,
          });
        }
      });

      if (parsedSheets.length === 0) {
        setErrorMsg("Tanlangan Excel (.xlsx) faylda ma'lumot topilmadi yoki fayl bo'sh.");
        setSheets([]);
        setIsLoading(false);
        return;
      }

      setSheets(parsedSheets);
      setSelectedSheetIdx(0);
      setOrientation('columns');
      setHeaderIndex(0);
      applySheetConfig(parsedSheets[0], 'columns', 0);
    } catch (err) {
      console.error('Warehouse Excel parse error:', err);
      setErrorMsg(
        "Excel faylni o'qishda xatolik yuz berdi. Fayl haqiqiy .xlsx formatda ekanligini tekshiring."
      );
      setSheets([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Download sample .xlsx template for warehouse products
  const handleDownloadSampleExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Ombor_Mahsulotlari');

    ws.columns = [
      { header: 'Brend', key: 'brand', width: 18 },
      { header: 'Mahsulot nomi', key: 'name', width: 26 },
      { header: 'Marka 1', key: 'mark1', width: 16 },
      { header: 'Marka 2', key: 'mark2', width: 18 },
      { header: "O'lchov birligi", key: 'baseUnit', width: 15 },
      { header: 'Idish / Dona nomi', key: 'pieceUnitName', width: 16 },
      { header: 'Donada hajm', key: 'volumePerPiece', width: 14 },
      { header: 'Katta qadoq nomi', key: 'packageUnitName', width: 16 },
      { header: 'Qadoqda dona soni', key: 'piecesPerPackage', width: 18 },
      { header: 'Kirim narxi (USD)', key: 'price', width: 18 },
      { header: 'Kirim soni', key: 'intakeQuantity', width: 14 },
      { header: 'Eng kam sotilish narxi (USD)', key: 'minSellingPrice', width: 24 },
      { header: 'Izoh', key: 'notes', width: 24 },
    ];

    ws.getRow(1).font = { bold: true };
    ws.addRow({
      brand: 'Castrol',
      name: 'Magnatec Motor Moyi',
      mark1: '5W-40',
      mark2: 'Sintetika',
      baseUnit: 'litr',
      pieceUnitName: '1 idish',
      volumePerPiece: 4,
      packageUnitName: 'korobka',
      piecesPerPackage: 4,
      price: 28,
      intakeQuantity: 25,
      minSellingPrice: 32,
      notes: '1-partiya Germaniya',
    });
    ws.addRow({
      brand: 'Knauf',
      name: 'Gipsokarton List',
      mark1: '9.5mm',
      mark2: 'Namlikka chidamli',
      baseUnit: 'dona',
      pieceUnitName: '1 list',
      volumePerPiece: 1,
      packageUnitName: '',
      piecesPerPackage: '',
      price: 6.5,
      intakeQuantity: 120,
      minSellingPrice: 8,
      notes: 'A-ombor',
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Ombor_Mahsulotlari_Namuna_Shablon.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Helpers to add/remove column index for a field
  const handleAddColumnToField = (field: WarehouseFieldKey, colIdx: number) => {
    setFieldMap((prev) => {
      const current = prev[field] || [];
      if (current.includes(colIdx)) return prev;
      return {
        ...prev,
        [field]: [...current, colIdx],
      };
    });
  };

  const handleRemoveColumnFromField = (field: WarehouseFieldKey, colIdx: number) => {
    setFieldMap((prev) => ({
      ...prev,
      [field]: (prev[field] || []).filter((i) => i !== colIdx),
    }));
  };

  const handleClearFieldColumns = (field: WarehouseFieldKey) => {
    setFieldMap((prev) => ({
      ...prev,
      [field]: [],
    }));
  };

  const handleManualValueChange = (field: WarehouseFieldKey, val: string) => {
    setManualValues((prev) => ({
      ...prev,
      [field]: val,
    }));
    // When admin types a manual value, mark it as active so it applies to all rows in the table
    setManualOverrideActive((prev) => ({
      ...prev,
      [field]: val.trim() !== '',
    }));
  };

  // Build parsed warehouse product records from mapped columns + manual values
  const parsedRecords = useMemo(() => {
    if (!currentSheet || currentSheet.grid.length === 0) return [];
    const grid = currentSheet.grid;

    // Resolve text value for a field on a given row:
    // - If manual value is entered and either (no columns mapped OR manualOverrideActive[field] is true):
    //   - For 'name' or 'notes' when columns are ALSO mapped, if manualOverrideActive is true, we can either use manual value directly (if no columns) or combine/override.
    //   - Specifically, as requested: "bazi fieldlarni qolda toldirish imkoni bersin va bunda shu toldirilgan qiymat barcha qatorlarga yuklangandagi shu jadvaldan tasir qiladi"
    //   So whenever a manual value is non-empty and manualOverrideActive[field] is true (or no column is mapped), that manual value applies to ALL rows!
    const resolveTextField = (
      recordVector: string[],
      field: WarehouseFieldKey,
      sep = ' '
    ): string => {
      const manualVal = (manualValues[field] || '').trim();
      const indices = fieldMap[field] || [];
      const colVal = indices
        .map((idx) =>
          idx >= 0 && idx < recordVector.length ? (recordVector[idx] || '').trim() : ''
        )
        .filter(Boolean)
        .join(sep);

      if (indices.length === 0) {
        return manualVal;
      }
      if (manualVal !== '' && manualOverrideActive[field]) {
        // If 'name' has both columns and manual text, only override if user explicitly typed it; for all fields, manual value applies across all rows
        return manualVal;
      }
      return colVal || manualVal;
    };

    const resolveExtraMarks = (recordVector: string[]): string[] => {
      const manualVal = (manualValues.extraMarks || '').trim();
      const indices = fieldMap.extraMarks || [];
      const fromCols = indices
        .map((idx) =>
          idx >= 0 && idx < recordVector.length ? (recordVector[idx] || '').trim() : ''
        )
        .filter(Boolean);
      const fromManual = manualVal
        ? manualVal
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      if (indices.length === 0) return fromManual;
      if (fromManual.length > 0 && manualOverrideActive.extraMarks) {
        return Array.from(new Set([...fromCols, ...fromManual]));
      }
      return fromCols.length > 0 ? fromCols : fromManual;
    };

    const resolveNumericField = (
      recordVector: string[],
      field: WarehouseFieldKey
    ): number | null => {
      const manualVal = (manualValues[field] || '').trim();
      const indices = fieldMap[field] || [];

      if (manualVal !== '' && (indices.length === 0 || manualOverrideActive[field])) {
        const parsedManual = parseNumericValue(manualVal);
        if (parsedManual > 0 || manualVal === '0') {
          return parsedManual;
        }
      }

      for (const idx of indices) {
        if (idx >= 0 && idx < recordVector.length) {
          const raw = (recordVector[idx] || '').trim();
          if (raw !== '') {
            const parsed = parseNumericValue(raw);
            if (parsed > 0 || raw === '0') return parsed;
          }
        }
      }

      if (manualVal !== '') {
        const parsedManual = parseNumericValue(manualVal);
        if (parsedManual > 0 || manualVal === '0') {
          return parsedManual;
        }
      }

      return null;
    };

    const rawVectors: Array<{ excelNumber: number; values: string[] }> = [];

    if (orientation === 'columns') {
      const startRow = headerIndex >= 0 ? headerIndex + 1 : 0;
      for (let r = startRow; r < grid.length; r++) {
        rawVectors.push({
          excelNumber: r + 1,
          values: grid[r],
        });
      }
    } else {
      const maxCols = grid.reduce((max, r) => Math.max(max, r.length), 0);
      const startCol = headerIndex >= 0 ? headerIndex + 1 : 0;
      for (let c = startCol; c < maxCols; c++) {
        const colVector = grid.map((row) => row[c] || '');
        if (colVector.some((v) => v.trim() !== '')) {
          rawVectors.push({
            excelNumber: c + 1,
            values: colVector,
          });
        }
      }
    }

    return rawVectors.map((vec, idx) => {
      const rawName = resolveTextField(vec.values, 'name', ' ');
      const rawBrand = resolveTextField(vec.values, 'brand', ' ') || 'Umumiy';
      const mark1 = resolveTextField(vec.values, 'mark1', ' ');
      const mark2 = resolveTextField(vec.values, 'mark2', ' ');
      const extraMarks = resolveExtraMarks(vec.values);

      const baseUnit = resolveTextField(vec.values, 'baseUnit', ' ') || 'dona';
      const pieceUnitName = resolveTextField(vec.values, 'pieceUnitName', ' ') || '1 dona';

      const mappedVol = resolveNumericField(vec.values, 'volumePerPiece');
      const volumePerPiece = mappedVol !== null && mappedVol > 0 ? mappedVol : 1;

      const packageUnitName = resolveTextField(vec.values, 'packageUnitName', ' ');
      const mappedPkgPieces = resolveNumericField(vec.values, 'piecesPerPackage');
      const hasPackage =
        packageUnitName.length > 0 && mappedPkgPieces !== null && mappedPkgPieces > 0;
      const piecesPerPackage = hasPackage ? Math.max(1, Math.round(mappedPkgPieces)) : 1;

      const mappedPrice = resolveNumericField(vec.values, 'price');
      const price = mappedPrice !== null && mappedPrice >= 0 ? mappedPrice : 0;

      const mappedIntakeQty = resolveNumericField(vec.values, 'intakeQuantity');
      const mappedTotalPieces = resolveNumericField(vec.values, 'totalPieces');

      const intakeUnitType: 'package' | 'piece' = hasPackage ? 'package' : 'piece';
      let intakeQuantity = 1;
      let totalPieces = 1;

      if (mappedIntakeQty !== null && mappedIntakeQty > 0) {
        intakeQuantity = mappedIntakeQty;
        totalPieces =
          mappedTotalPieces !== null && mappedTotalPieces > 0
            ? mappedTotalPieces
            : hasPackage
            ? intakeQuantity * piecesPerPackage
            : intakeQuantity;
      } else if (mappedTotalPieces !== null && mappedTotalPieces > 0) {
        totalPieces = mappedTotalPieces;
        intakeQuantity = hasPackage
          ? Math.max(1, Math.round((totalPieces / piecesPerPackage) * 100) / 100)
          : totalPieces;
      }

      const totalVolume = Math.round(totalPieces * volumePerPiece * 100) / 100;

      const pricingUnitType: 'piece' | 'package' = 'piece';
      const totalSum = price > 0 ? Math.round(totalPieces * price * 100) / 100 : 0;

      const mappedMinSellingPrice = resolveNumericField(vec.values, 'minSellingPrice');
      const minSellingPrice =
        mappedMinSellingPrice !== null && mappedMinSellingPrice > 0
          ? mappedMinSellingPrice
          : price > 0
          ? price
          : 0;

      const rawDate = resolveTextField(vec.values, 'intakeDate', '');
      const intakeDate = /^\d{4}-\d{2}-\d{2}/.test(rawDate) ? rawDate.slice(0, 10) : todayStr;

      const notes = resolveTextField(vec.values, 'notes', '; ');

      // Check if row in Excel actually has any content (to avoid importing blank rows if name was manually filled)
      const rowHasAnyExcelData = vec.values.some((v) => v.trim() !== '');
      const isValid = rowHasAnyExcelData && rawName.length > 0 && totalPieces > 0;

      const payload: ImportedWarehouseProductPayload = {
        brand: rawBrand,
        name: rawName,
        mark1,
        mark2,
        extraMarks,
        baseUnit,
        pieceUnitName,
        volumePerPiece,
        packageUnitName: hasPackage ? packageUnitName : '',
        piecesPerPackage,
        pricingUnitType,
        currency: 'USD',
        price,
        intakeDate,
        intakeUnitType,
        intakeQuantity,
        totalSum,
        totalPieces,
        totalVolume,
        minSellingPricingUnitType: pricingUnitType,
        minSellingPrice,
        createdBy: currentUsername || 'adminc',
        notes: notes || undefined,
      };

      return {
        recordIndex: idx,
        excelNumber: vec.excelNumber,
        isValid,
        payload,
      };
    });
  }, [
    currentSheet,
    orientation,
    headerIndex,
    fieldMap,
    manualValues,
    manualOverrideActive,
    todayStr,
    currentUsername,
  ]);

  const validRecords = useMemo(() => parsedRecords.filter((r) => r.isValid), [parsedRecords]);

  const selectedValidRecords = useMemo(
    () => validRecords.filter((r) => !excludedRecordIndices.has(r.recordIndex)),
    [validRecords, excludedRecordIndices]
  );

  const summaryTotals = useMemo(() => {
    let pieces = 0;
    let totalSum = 0;
    selectedValidRecords.forEach((r) => {
      pieces += r.payload.totalPieces || 0;
      totalSum += r.payload.totalSum || 0;
    });
    return {
      count: selectedValidRecords.length,
      pieces,
      totalSum: Math.round(totalSum * 100) / 100,
    };
  }, [selectedValidRecords]);

  const toggleRecordSelection = (recordIndex: number) => {
    setExcludedRecordIndices((prev) => {
      const next = new Set(prev);
      if (next.has(recordIndex)) {
        next.delete(recordIndex);
      } else {
        next.add(recordIndex);
      }
      return next;
    });
  };

  const toggleSelectAllValid = () => {
    if (selectedValidRecords.length === validRecords.length) {
      setExcludedRecordIndices(new Set(validRecords.map((r) => r.recordIndex)));
    } else {
      setExcludedRecordIndices(new Set());
    }
  };

  const handleConfirmImport = () => {
    if (fieldMap.name.length === 0 && !manualValues.name.trim()) {
      setErrorMsg(
        'Iltimos, "Mahsulot nomi" maydoni uchun Excel ustunini tanlang yoki qo\'lda nom kiriting!'
      );
      return;
    }
    if (selectedValidRecords.length === 0) {
      setErrorMsg("Omborga yuklash uchun kamida 1 ta to'g'ri mahsulot qatorini tanlang!");
      return;
    }
    onImportProducts(selectedValidRecords.map((r) => r.payload));
  };

  return (
    <div className="space-y-5">
      {errorMsg && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Step 1: Upload .xlsx File */}
      <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/90 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-emerald-950 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>1. Ombor mahsulotlari yozilgan Excel (.xlsx) faylni tanlang</span>
            </h3>
            <p className="text-[11px] text-emerald-800 mt-0.5">
              .xlsx faylni yuklang, ustunlarni tanlang yoki kerakli maydonlarni barcha qatorlar uchun qo'lda to'ldiring
            </p>
          </div>

          <button
            type="button"
            onClick={handleDownloadSampleExcel}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-100/60 text-emerald-900 border border-emerald-300 text-xs font-bold transition cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-emerald-700" />
            <span>Namuna .xlsx shablon</span>
          </button>
        </div>

        <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-2xl bg-white hover:bg-emerald-50/30 transition cursor-pointer">
          <Upload className="w-7 h-7 text-emerald-600 mb-1.5" />
          <span className="text-xs sm:text-sm font-bold text-neutral-900">
            {fileName ? `Yuklangan fayl: ${fileName}` : '.xlsx Excel faylni tanlash uchun bosing'}
          </span>
          <span className="text-[11px] text-neutral-500 mt-0.5">
            Faqat .xlsx formatdagi Excel jadvallari qo'llab-quvvatlanadi
          </span>
          <input type="file" accept=".xlsx" onChange={handleFileChange} className="hidden" />
        </label>
      </div>

      {isLoading && (
        <div className="p-6 text-center text-xs font-semibold text-neutral-600 bg-neutral-50 rounded-2xl border border-neutral-200">
          Excel fayl o'qilmoqda, iltimos kuting...
        </div>
      )}

      {currentSheet && !isLoading && (
        <>
          {/* Step 2: Sheet, Orientation & Header Row Configuration */}
          <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-xs font-bold text-neutral-800 uppercase tracking-wide flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-rose-700" />
                <span>2. Excel varaq va sarlavha qatori sozlamasi</span>
              </h3>
              <span className="text-[11px] font-semibold text-neutral-600 bg-white px-2.5 py-0.5 rounded-lg border border-neutral-200">
                Jami {currentSheet.grid.length} ta qator • {sourceDescriptors.length} ta ustun
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                  Excel varag'i (Sheet)
                </label>
                <select
                  value={selectedSheetIdx}
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    setSelectedSheetIdx(idx);
                    applySheetConfig(sheets[idx], orientation, headerIndex);
                  }}
                  className="w-full px-3 py-2 bg-white rounded-xl border border-neutral-300 text-xs font-semibold text-neutral-900 outline-none focus:border-rose-500"
                >
                  {sheets.map((s, i) => (
                    <option key={i} value={i}>
                      {s.name} ({s.grid.length} qator)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                  Jadval tuzilishi
                </label>
                <select
                  value={orientation}
                  onChange={(e) => {
                    const nextOrientation = e.target.value as 'columns' | 'rows';
                    setOrientation(nextOrientation);
                    applySheetConfig(currentSheet, nextOrientation, headerIndex);
                  }}
                  className="w-full px-3 py-2 bg-white rounded-xl border border-neutral-300 text-xs font-semibold text-neutral-900 outline-none focus:border-rose-500"
                >
                  <option value="columns">Standart (Har bir qator = 1 ta mahsulot)</option>
                  <option value="rows">Gorizontal (Har bir ustun = 1 ta mahsulot)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                  {orientation === 'columns'
                    ? 'Sarlavha qatori (Ustun nomlari qatori)'
                    : 'Sarlavha ustuni (Maydon nomlari ustuni)'}
                </label>
                <select
                  value={headerIndex}
                  onChange={(e) => {
                    const nextH = Number(e.target.value);
                    setHeaderIndex(nextH);
                    applySheetConfig(currentSheet, orientation, nextH);
                  }}
                  className="w-full px-3 py-2 bg-white rounded-xl border border-neutral-300 text-xs font-semibold text-neutral-900 outline-none focus:border-rose-500"
                >
                  <option value={-1}>Sarlavha yo'q (1-qatordan ma'lumot boshlanadi)</option>
                  {Array.from(
                    {
                      length: Math.min(
                        10,
                        orientation === 'columns'
                          ? currentSheet.grid.length
                          : currentSheet.grid[0]?.length || 1
                      ),
                    },
                    (_, idx) => (
                      <option key={idx} value={idx}>
                        {orientation === 'columns'
                          ? `${idx + 1}-qator (Ma'lumotlar ${idx + 2}-qatordan)`
                          : `${colIndexToLetter(idx)}-ustun`}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* Step 3: Column(s) Mapping OR Manual Value Input (Applies to ALL rows) */}
          <div className="p-4 rounded-2xl bg-rose-50/40 border border-rose-200/80 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                  <Table className="w-4 h-4 text-rose-700" />
                  <span>
                    3. Maydonlarga Excel ustun(lar)ini biriktiring yoki qiymatni qo'lda kiriting
                  </span>
                </h3>
                <p className="text-[11px] text-neutral-600">
                  Har bir maydon uchun Exceldan ustun tanlashingiz <strong>yoki «Qo'lda kiritish» qatoriga yozib barcha qatorlarga birdek qo'llashingiz</strong> mumkin
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => autoMatchFields(sourceDescriptors)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-800 border border-rose-200 text-xs font-bold transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-rose-600" />
                  <span>Avto-moslash</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFieldMap(createEmptyFieldMap());
                    setManualValues(createInitialManualValues(todayStr));
                    setManualOverrideActive({});
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200 text-xs font-semibold transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Tozalash</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              {WAREHOUSE_FIELDS.map((field) => {
                const selectedIndices = fieldMap[field.key] || [];
                const selectedDescs = selectedIndices
                  .map((idx) => sourceDescriptors.find((d) => d.index === idx))
                  .filter(Boolean);

                const manualVal = manualValues[field.key] || '';
                const hasManualVal = manualVal.trim() !== '';
                const isManualApplyingToAll =
                  hasManualVal && (selectedIndices.length === 0 || Boolean(manualOverrideActive[field.key]));

                const combinedSample = isManualApplyingToAll
                  ? `${manualVal} (Barcha qatorlarga)`
                  : selectedDescs
                      .map((d) => d?.sample)
                      .filter(Boolean)
                      .join(field.key === 'extraMarks' ? ' | ' : ' ');

                return (
                  <div
                    key={field.key}
                    className={`p-3.5 rounded-xl border transition space-y-2.5 ${
                      selectedIndices.length > 0 || hasManualVal
                        ? 'bg-white border-emerald-300 shadow-2xs'
                        : field.required
                        ? 'bg-rose-50/70 border-rose-300'
                        : 'bg-white/80 border-neutral-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-neutral-200/80 text-neutral-700">
                          {field.blockLabel}
                        </span>
                        <label className="text-xs font-bold text-neutral-900">
                          {field.label}{' '}
                          {field.required && <span className="text-rose-600">*</span>}
                        </label>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {selectedIndices.length > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                            {selectedIndices.length} ta ustun
                          </span>
                        )}
                        {isManualApplyingToAll && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800">
                            Qo'lda (Barchasiga)
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-[10px] text-neutral-500">{field.description}</p>

                    {/* 1) Excel Column(s) Selector */}
                    <div>
                      <div className="text-[10px] font-bold text-neutral-700 mb-1">
                        A) Excel jadvaldan ustun(lar) tanlash:
                      </div>
                      {selectedIndices.length === 0 ? (
                        <select
                          value=""
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val !== '') {
                              handleAddColumnToField(field.key, Number(val));
                              setManualOverrideActive((prev) => ({
                                ...prev,
                                [field.key]: false,
                              }));
                            }
                          }}
                          className="w-full px-2.5 py-2 rounded-lg border border-neutral-300 bg-white text-xs font-semibold text-neutral-900 outline-none focus:border-rose-500"
                        >
                          <option value="">— Exceldan ustun tanlanmagan —</option>
                          {sourceDescriptors.map((desc) => (
                            <option key={desc.index} value={desc.index}>
                              {desc.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap gap-1.5">
                            {selectedDescs.map((desc) => {
                              if (!desc) return null;
                              return (
                                <span
                                  key={desc.index}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs font-bold"
                                >
                                  <span>
                                    {desc.code}: "{desc.title}"
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveColumnFromField(field.key, desc.index)}
                                    className="text-emerald-700 hover:text-rose-600 cursor-pointer"
                                    title="Ushbu ustunni olib tashlash"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </span>
                              );
                            })}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <select
                              value=""
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val !== '') {
                                  handleAddColumnToField(field.key, Number(val));
                                }
                              }}
                              className="flex-1 px-2.5 py-1.5 rounded-lg border border-dashed border-emerald-400 bg-emerald-50/40 hover:bg-emerald-50 text-[11px] font-bold text-emerald-900 outline-none cursor-pointer"
                            >
                              <option value="">+ Yana qo'shimcha ustun biriktirish...</option>
                              {sourceDescriptors
                                .filter((d) => !selectedIndices.includes(d.index))
                                .map((desc) => (
                                  <option key={desc.index} value={desc.index}>
                                    {desc.label}
                                  </option>
                                ))}
                            </select>

                            <button
                              type="button"
                              onClick={() => handleClearFieldColumns(field.key)}
                              className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-neutral-200 transition cursor-pointer shrink-0"
                              title="Tanlangan ustunlarni tozalash"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 2) Manual Value Input (Applies to ALL rows in the table) */}
                    <div className="pt-1.5 border-t border-neutral-100">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-bold text-indigo-900 flex items-center gap-1">
                          <Edit3 className="w-3 h-3 text-indigo-600" />
                          <span>B) Qo'lda to'ldirish (barcha qatorlarga ta'sir qiladi):</span>
                        </span>
                        {selectedIndices.length > 0 && hasManualVal && (
                          <button
                            type="button"
                            onClick={() =>
                              setManualOverrideActive((prev) => ({
                                ...prev,
                                [field.key]: !prev[field.key],
                              }))
                            }
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border cursor-pointer transition ${
                              manualOverrideActive[field.key]
                                ? 'bg-indigo-600 text-white border-indigo-700'
                                : 'bg-neutral-100 text-neutral-700 border-neutral-300'
                            }`}
                          >
                            {manualOverrideActive[field.key]
                              ? '✓ Barcha qatorga majburiy'
                              : "Faqat bo'sh kataklarga"}
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <input
                          type={field.inputType}
                          step={field.inputType === 'number' ? 'any' : undefined}
                          min={field.inputType === 'number' ? '0' : undefined}
                          value={manualVal}
                          onChange={(e) => handleManualValueChange(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className={`w-full px-2.5 py-1.5 rounded-lg border text-xs outline-none transition ${
                            isManualApplyingToAll
                              ? 'border-indigo-400 bg-indigo-50/40 font-bold text-indigo-950 focus:border-indigo-600'
                              : 'border-neutral-300 bg-neutral-50/60 text-neutral-900 focus:bg-white focus:border-indigo-500'
                          }`}
                        />
                        {hasManualVal && (
                          <button
                            type="button"
                            onClick={() => handleManualValueChange(field.key, '')}
                            className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-neutral-200 transition cursor-pointer shrink-0"
                            title="Qo'lda yozilgan qiymatni tozalash"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {field.quickSuggestions && field.quickSuggestions.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 mt-1 text-[10px] text-neutral-500">
                          <span>Tezkor:</span>
                          {field.quickSuggestions.map((sug) => (
                            <button
                              key={sug}
                              type="button"
                              onClick={() => handleManualValueChange(field.key, sug)}
                              className="px-1.5 py-0.2 rounded bg-neutral-100 hover:bg-indigo-100 text-neutral-700 hover:text-indigo-900 font-semibold transition cursor-pointer"
                            >
                              {sug}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {combinedSample && (
                      <div className="pt-1 flex items-center gap-1 text-[11px] text-emerald-800 font-mono truncate">
                        <ArrowRight className="w-3 h-3 shrink-0 text-emerald-600" />
                        <span className="truncate">Natija: {combinedSample}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 4: Preview & Row Selection */}
          <div className="p-4 rounded-2xl bg-white border border-neutral-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-neutral-900">
                  4. Omborga yuklanadigan mahsulotlarni tekshirish ({summaryTotals.count} ta tanlangan)
                </h3>
                <p className="text-[11px] text-neutral-500">
                  Yuqorida qo'lda to'ldirilgan maydonlar quyidagi jadvalning barcha qatorlariga darhol qo'llandi
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap text-xs font-bold">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">
                  Jami qoldiq: {summaryTotals.pieces.toLocaleString()} dona
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200 font-mono">
                  Jami kirim qiymati: {summaryTotals.totalSum.toLocaleString()} USD
                </span>
              </div>
            </div>

            {parsedRecords.length === 0 ? (
              <div className="p-6 text-center text-xs text-neutral-500">
                Ushbu varaqda ma'lumot qatorlari topilmadi.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-neutral-200">
                <StickyTableWrapper maxHeightClassName="max-h-72">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-neutral-100 text-neutral-800 font-bold sticky top-0 z-20 border-b border-neutral-200">
                      <tr>
                      <th className="py-2.5 px-3 w-10 text-center">
                        <button
                          type="button"
                          onClick={toggleSelectAllValid}
                          className="inline-flex items-center justify-center text-rose-700 hover:text-rose-900 cursor-pointer"
                        >
                          {selectedValidRecords.length === validRecords.length &&
                          validRecords.length > 0 ? (
                            <CheckSquare className="w-4 h-4" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th className="py-2.5 px-2.5 text-center w-12">Qator</th>
                      <th className="py-2.5 px-3">Brend</th>
                      <th className="py-2.5 px-3">Mahsulot nomi</th>
                      <th className="py-2.5 px-3">Markalar</th>
                      <th className="py-2.5 px-3">O'lcham</th>
                      <th className="py-2.5 px-3 text-right">Jami qoldiq</th>
                      <th className="py-2.5 px-3 text-right">Kirim narxi</th>
                      <th className="py-2.5 px-3 text-right">Eng kam sotish narxi</th>
                      <th className="py-2.5 px-3">Sana / Izoh</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-150">
                    {parsedRecords.map((rec) => {
                      const isSelected =
                        rec.isValid && !excludedRecordIndices.has(rec.recordIndex);
                      const p = rec.payload;
                      const marksList = [p.mark1, p.mark2, ...(p.extraMarks || [])].filter(Boolean);

                      return (
                        <tr
                          key={rec.recordIndex}
                          onClick={() => {
                            if (rec.isValid) toggleRecordSelection(rec.recordIndex);
                          }}
                          className={`transition ${
                            !rec.isValid
                              ? 'bg-neutral-100/70 text-neutral-400'
                              : isSelected
                              ? 'bg-white hover:bg-rose-50/30 cursor-pointer'
                              : 'bg-neutral-50 text-neutral-400 hover:bg-neutral-100 cursor-pointer'
                          }`}
                        >
                          <td className="py-2 px-3 text-center">
                            {rec.isValid ? (
                              isSelected ? (
                                <CheckSquare className="w-4 h-4 text-rose-700 mx-auto" />
                              ) : (
                                <Square className="w-4 h-4 text-neutral-400 mx-auto" />
                              )
                            ) : (
                              <span className="text-[10px] font-bold text-rose-500">Bo'sh</span>
                            )}
                          </td>
                          <td className="py-2 px-2.5 text-center font-mono text-[11px] text-neutral-500">
                            #{rec.excelNumber}
                          </td>
                          <td className="py-2 px-3 font-bold text-rose-800">{p.brand}</td>
                          <td className="py-2 px-3 font-bold text-neutral-900">
                            {p.name || <span className="italic text-rose-500">Nomi yo'q</span>}
                          </td>
                          <td className="py-2 px-3 text-neutral-600 max-w-[180px] truncate">
                            {marksList.length > 0 ? marksList.join(' • ') : '-'}
                          </td>
                          <td className="py-2 px-3 text-neutral-700">
                            1 {p.pieceUnitName} = {p.volumePerPiece} {p.baseUnit}
                            {p.packageUnitName
                              ? ` (1 ${p.packageUnitName} = ${p.piecesPerPackage} dona)`
                              : ''}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                            {p.totalPieces.toLocaleString()} dona
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-neutral-700">
                            {p.price > 0 ? `${p.price.toLocaleString()} USD` : 'Narxsiz'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-indigo-700">
                            {(p.minSellingPrice || 0).toLocaleString()} USD
                          </td>
                          <td className="py-2 px-3 text-neutral-500 text-[11px] max-w-[160px] truncate">
                            {p.intakeDate}
                            {p.notes ? ` • ${p.notes}` : ''}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  </table>
                </StickyTableWrapper>
              </div>
            )}
          </div>
        </>
      )}

      {/* Footer Actions */}
      <div className="pt-3 border-t border-rose-100 flex items-center justify-end gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl border border-neutral-200 text-xs sm:text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition min-h-[44px] cursor-pointer"
        >
          Bekor qilish
        </button>
        <button
          type="button"
          disabled={!currentSheet || summaryTotals.count === 0}
          onClick={handleConfirmImport}
          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-sm transition min-h-[44px] flex items-center gap-1.5 cursor-pointer"
        >
          <Check className="w-4 h-4 stroke-[2.5]" />
          <span>Tanlangan mahsulotlarni omborga yuklash ({summaryTotals.count} ta)</span>
        </button>
      </div>
    </div>
  );
};
