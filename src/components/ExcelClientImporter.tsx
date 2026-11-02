import React, { useState, useMemo } from 'react';
import ExcelJS from 'exceljs';
import { Client } from '../types';
import { formatMoney } from '../utils/format';
import { formatAddress, parseLegacyAddress } from '../utils/location';
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
} from 'lucide-react';

export type ImportedClientPayload = Omit<
  Client,
  'id' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'logs'
>;

interface Props {
  currentUserUsername: string;
  onImportClients: (clients: ImportedClientPayload[]) => void;
  onCancel: () => void;
}

type FieldKey =
  | 'name'
  | 'phone'
  | 'extraPhone'
  | 'region'
  | 'district'
  | 'landmark'
  | 'address'
  | 'currentDebt'
  | 'currentAdvance'
  | 'notes';

interface FieldDefinition {
  key: FieldKey;
  label: string;
  required?: boolean;
  description: string;
  keywords: string[];
}

const CLIENT_FIELDS: FieldDefinition[] = [
  {
    key: 'name',
    label: 'Mijoz ismi / Tashkilot nomi',
    required: true,
    description: 'Mijoz F.I.O yoki korxona nomi (Majburiy)',
    keywords: ['mijoz', 'ism', 'fio', 'f.i.o', 'nomi', 'korxona', 'tashkilot', 'name', 'client', 'klient', 'фио', 'имя', 'клиент'],
  },
  {
    key: 'phone',
    label: 'Telefon raqami (Asosiy)',
    description: 'Telefon raqami (vergul bilan bir nechta bo\'lishi mumkin)',
    keywords: ['telefon', 'tel', 'raqam', 'phone', 'mobile', 'kontakt', 'aloqa', 'телефон', 'номер'],
  },
  {
    key: 'extraPhone',
    label: 'Qo\'shimcha telefon raqami',
    description: 'Ikkinchi yoki qo\'shimcha telefon raqami ustuni/qatori',
    keywords: ['telefon 2', 'tel 2', 'qo\'shimcha tel', '2-telefon', 'phone 2', 'extra phone', 'доп тел'],
  },
  {
    key: 'region',
    label: 'Viloyat yoki shahar',
    description: 'Masalan: Toshkent shahri, Samarqand viloyati',
    keywords: ['viloyat', 'hudud', 'region', 'oblast', 'область', 'регион'],
  },
  {
    key: 'district',
    label: 'Tuman / Shahar',
    description: 'Masalan: Chilonzor tumani, Urgut tumani',
    keywords: ['tuman', 'rayon', 'district', 'shahar', 'район', 'город'],
  },
  {
    key: 'landmark',
    label: 'Mo\'ljal / Ko\'cha',
    description: 'Masalan: 19-mavze, Korzinka ro\'parasi',
    keywords: ['mo\'ljal', 'moljal', 'orientir', 'ko\'cha', 'kocha', 'landmark', 'ориентир', 'улица'],
  },
  {
    key: 'address',
    label: 'Umumiy manzil (Agar bitta katakda bo\'lsa)',
    description: 'Viloyat, tuman va mo\'ljal bitta qatorda/ustunda bo\'lsa',
    keywords: ['manzil', 'adres', 'address', 'joylashuv', 'lokatsiya', 'адрес'],
  },
  {
    key: 'currentDebt',
    label: 'Joriy qarzdorlik (USD)',
    description: 'Mijozning joriy qarzi (USD hisobida)',
    keywords: ['qarz', 'qarzdorlik', 'nasiya', 'dolg', 'debt', 'ostatok', 'долг', 'задолженность'],
  },
  {
    key: 'currentAdvance',
    label: 'Joriy haqdorlik / Avans (USD)',
    description: 'Mijozning haqdorligi yoki oldindan to\'lovi (USD)',
    keywords: ['haq', 'haqdorlik', 'avans', 'predoplata', 'advance', 'kredit', 'аванс', 'переплата'],
  },
  {
    key: 'notes',
    label: 'Qo\'shimcha izoh',
    description: 'Eslatma, shartnoma yoki qo\'shimcha ma\'lumotlar',
    keywords: ['izoh', 'eslatma', 'komment', 'note', 'notes', 'primechanie', 'примечание', 'комментарий'],
  },
];

interface ParsedSheet {
  name: string;
  grid: string[][]; // 2D array of stringified cell values [rowIndex][colIndex]
}

// Convert 0-based column index to Excel column letter (0 -> A, 25 -> Z, 26 -> AA)
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

// Extract clean string from any ExcelJS cell value
function extractCellText(val: ExcelJS.CellValue): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  if (typeof val === 'object') {
    if ('result' in val && val.result !== undefined && val.result !== null) {
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

// Parse number safely from Excel string (e.g. "$1,250.50", "1 200 USD", "-500")
function parseNumericValue(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw
    .replace(/,/g, '.')
    .replace(/[^\d.-]/g, '')
    .trim();
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? Math.max(0, Math.round(num * 100) / 100) : 0;
}

export const ExcelClientImporter: React.FC<Props> = ({
  currentUserUsername,
  onImportClients,
  onCancel,
}) => {
  const [fileName, setFileName] = useState<string>('');
  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [selectedSheetIdx, setSelectedSheetIdx] = useState<number>(0);

  // Orientation: 'columns' (standard: each row is a client, columns are fields)
  // or 'rows' (transposed: each row is a field, columns are clients)
  const [orientation, setOrientation] = useState<'columns' | 'rows'>('columns');

  // 0-based index of the header row (or header column in 'rows' mode), or -1 if no header
  const [headerIndex, setHeaderIndex] = useState<number>(0);

  // Field mapping: FieldKey -> index of source column/row (or '' if unmapped)
  const [fieldMap, setFieldMap] = useState<Record<FieldKey, number | ''>>({
    name: '',
    phone: '',
    extraPhone: '',
    region: '',
    district: '',
    landmark: '',
    address: '',
    currentDebt: '',
    currentAdvance: '',
    notes: '',
  });

  // Excluded record indices in preview table
  const [excludedRecordIndices, setExcludedRecordIndices] = useState<Set<number>>(new Set());

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentSheet = sheets[selectedSheetIdx] || null;

  // Source options (Columns in standard mode, Rows in transposed mode)
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
            sample ? ` — Namuna: "${sample.slice(0, 28)}"` : ''
          }`,
        };
      });
    } else {
      // Transposed: each row in Excel is a field
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
            sample ? ` — Namuna: "${sample.slice(0, 28)}"` : ''
          }`,
        };
      });
    }
  }, [currentSheet, orientation, headerIndex]);

  // Auto-detect mapping based on source titles
  const autoMatchFields = (
    descriptors: Array<{ index: number; title: string; sample: string }>
  ) => {
    const newMap: Record<FieldKey, number | ''> = {
      name: '',
      phone: '',
      extraPhone: '',
      region: '',
      district: '',
      landmark: '',
      address: '',
      currentDebt: '',
      currentAdvance: '',
      notes: '',
    };

    const usedIndices = new Set<number>();

    CLIENT_FIELDS.forEach((field) => {
      for (const desc of descriptors) {
        if (usedIndices.has(desc.index)) continue;
        const t = desc.title.toLowerCase().trim();
        if (!t) continue;
        const matched = field.keywords.some((kw) => t.includes(kw.toLowerCase()));
        if (matched) {
          newMap[field.key] = desc.index;
          usedIndices.add(desc.index);
          break;
        }
      }
    });

    // If 'name' was still not matched and there is at least 1 descriptor, default name to index 0
    if (newMap.name === '' && descriptors.length > 0 && !usedIndices.has(0)) {
      newMap.name = 0;
    }

    setFieldMap(newMap);
  };

  // Re-run auto-match when sheet, orientation, or headerIndex changes
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

  // Load .xlsx file using ExcelJS
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
          // Skip completely empty rows
          if (rowValues.some((v) => v !== '')) {
            rowsGrid.push(rowValues);
            if (rowValues.length > maxColCount) {
              maxColCount = rowValues.length;
            }
          }
        });

        // Normalize row lengths
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
      console.error('Excel parse error:', err);
      setErrorMsg(
        "Excel faylni o'qishda xatolik yuz berdi. Fayl haqiqiy .xlsx formatda ekanligini tekshiring."
      );
      setSheets([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Download sample .xlsx template
  const handleDownloadSampleExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Mijozlar');

    ws.columns = [
      { header: 'Mijoz ismi', key: 'name', width: 26 },
      { header: 'Telefon raqami', key: 'phone', width: 20 },
      { header: 'Telefon 2', key: 'extraPhone', width: 18 },
      { header: 'Viloyat', key: 'region', width: 20 },
      { header: 'Tuman', key: 'district', width: 20 },
      { header: "Mo'ljal", key: 'landmark', width: 25 },
      { header: 'Qarzdorlik (USD)', key: 'debt', width: 18 },
      { header: 'Haqdorlik (USD)', key: 'advance', width: 18 },
      { header: 'Izoh', key: 'notes', width: 28 },
    ];

    ws.getRow(1).font = { bold: true };
    ws.addRow({
      name: 'Sardor Rustamov (Avto Servis)',
      phone: '+998 90 123 45 67',
      extraPhone: '+998 97 777 88 99',
      region: 'Toshkent shahri',
      district: 'Chilonzor tumani',
      landmark: '19-mavze, Korzinka yonida',
      debt: 450,
      advance: 0,
      notes: 'Doimiy mijoz',
    });
    ws.addRow({
      name: 'Jasur Aliyev (Zapchast do\'koni)',
      phone: '+998 93 555 44 33',
      extraPhone: '',
      region: 'Samarqand viloyati',
      district: 'Urgut tumani',
      landmark: 'Markaziy bozor oldida',
      debt: 1200,
      advance: 0,
      notes: 'Oylik to\'lov asosida',
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Mijozlar_Namuna_Shablon.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Build parsed client records from the current mapping
  const parsedRecords = useMemo(() => {
    if (!currentSheet || currentSheet.grid.length === 0) return [];
    const grid = currentSheet.grid;

    const getVal = (recordVector: string[], field: FieldKey): string => {
      const mappedIdx = fieldMap[field];
      if (mappedIdx === '' || mappedIdx < 0 || mappedIdx >= recordVector.length) return '';
      return (recordVector[mappedIdx] || '').trim();
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
      const rawName = getVal(vec.values, 'name');
      const rawPhone1 = getVal(vec.values, 'phone');
      const rawPhone2 = getVal(vec.values, 'extraPhone');

      const phonesList = [
        ...rawPhone1.split(/[;,/]+/).map((s) => s.trim()),
        ...rawPhone2.split(/[;,/]+/).map((s) => s.trim()),
      ].filter(Boolean);
      const uniquePhones = Array.from(new Set(phonesList));
      const phoneStr = uniquePhones.join(', ');

      let region = getVal(vec.values, 'region');
      let district = getVal(vec.values, 'district');
      let landmark = getVal(vec.values, 'landmark');
      const rawAddress = getVal(vec.values, 'address');

      if ((!region || !district) && rawAddress) {
        const parsedLoc = parseLegacyAddress(rawAddress);
        if (!region && parsedLoc.region) region = parsedLoc.region;
        if (!district && parsedLoc.district) district = parsedLoc.district;
        if (!landmark && parsedLoc.landmark) landmark = parsedLoc.landmark;
      }

      const fullAddress =
        formatAddress(region, district, landmark) || rawAddress || '';

      const currentDebt = parseNumericValue(getVal(vec.values, 'currentDebt'));
      const currentAdvance = parseNumericValue(getVal(vec.values, 'currentAdvance'));
      const notes = getVal(vec.values, 'notes');

      const isValid = rawName.length > 0;

      const payload: ImportedClientPayload = {
        name: rawName,
        phone: phoneStr,
        phones: uniquePhones,
        region,
        district,
        landmark,
        address: fullAddress,
        products: [],
        currentDebt,
        currentAdvance,
        notes,
        createdBy: currentUserUsername,
      };

      return {
        recordIndex: idx,
        excelNumber: vec.excelNumber,
        isValid,
        payload,
      };
    });
  }, [currentSheet, orientation, headerIndex, fieldMap, currentUserUsername]);

  const validRecords = useMemo(
    () => parsedRecords.filter((r) => r.isValid),
    [parsedRecords]
  );

  const selectedValidRecords = useMemo(
    () => validRecords.filter((r) => !excludedRecordIndices.has(r.recordIndex)),
    [validRecords, excludedRecordIndices]
  );

  const summaryTotals = useMemo(() => {
    let debt = 0;
    let advance = 0;
    selectedValidRecords.forEach((r) => {
      debt += r.payload.currentDebt || 0;
      advance += r.payload.currentAdvance || 0;
    });
    return {
      count: selectedValidRecords.length,
      debt,
      advance,
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
    if (fieldMap.name === '') {
      setErrorMsg('Iltimos, "Mijoz ismi / Tashkilot nomi" maydoni uchun qator/ustunni tanlang!');
      return;
    }
    if (selectedValidRecords.length === 0) {
      setErrorMsg('Yuklash uchun kamida 1 ta to\'g\'ri mijoz qatorini tanlang!');
      return;
    }
    onImportClients(selectedValidRecords.map((r) => r.payload));
  };

  return (
    <div className="space-y-5">
      {/* Error Banner */}
      {errorMsg && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
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
              <span>1. Excel (.xlsx) faylni tanlang</span>
            </h3>
            <p className="text-[11px] text-emerald-800 mt-0.5">
              Mijozlar ro'yxati yozilgan .xlsx faylni yuklang va qaysi qator/ustun qaysi maydonga to'g'ri kelishini belgilang
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
            {fileName ? `Yuklangan fayl: ${fileName}` : ".xlsx Excel faylni tanlash uchun bosing"}
          </span>
          <span className="text-[11px] text-neutral-500 mt-0.5">
            Faqat .xlsx formatdagi Excel jadvallari qo'llab-quvvatlanadi
          </span>
          <input
            type="file"
            accept=".xlsx"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      </div>

      {isLoading && (
        <div className="p-6 text-center text-xs font-semibold text-neutral-600 bg-neutral-50 rounded-2xl border border-neutral-200">
          Excel fayl o'qilmoqda, iltimos kuting...
        </div>
      )}

      {/* Step 2: Sheet, Orientation & Header Row Configuration + Field Mapping */}
      {currentSheet && !isLoading && (
        <>
          <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-xs font-bold text-neutral-800 uppercase tracking-wide flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-rose-700" />
                <span>2. Excel varaq va qatorlar sozlamasi</span>
              </h3>
              <span className="text-[11px] font-semibold text-neutral-600 bg-white px-2.5 py-0.5 rounded-lg border border-neutral-200">
                Jami {currentSheet.grid.length} ta qator topildi
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Sheet selector */}
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

              {/* Orientation selector */}
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
                  <option value="columns">Standart (Har bir qator = 1 ta mijoz)</option>
                  <option value="rows">Gorizontal (Har bir qator = 1 ta maydon/field)</option>
                </select>
              </div>

              {/* Header row / column selector */}
              <div>
                <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                  {orientation === 'columns'
                    ? 'Sarlavha qatori (Qaysi qatorda nomlar yozilgan)'
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

          {/* Step 3: Field Mapping */}
          <div className="p-4 rounded-2xl bg-rose-50/40 border border-rose-200/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                  <Table className="w-4 h-4 text-rose-700" />
                  <span>
                    3. Qaysi {orientation === 'columns' ? 'ustun / qator sarlavhasi' : 'qator'} qaysi maydonga (fieldga) to'g'ri kelishini tanlang
                  </span>
                </h3>
                <p className="text-[11px] text-neutral-600">
                  Har bir tizim maydoni uchun Excel fayldagi mos qator/ustunni tanlang
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
                  onClick={() =>
                    setFieldMap({
                      name: '',
                      phone: '',
                      extraPhone: '',
                      region: '',
                      district: '',
                      landmark: '',
                      address: '',
                      currentDebt: '',
                      currentAdvance: '',
                      notes: '',
                    })
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200 text-xs font-semibold transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Tozalash</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {CLIENT_FIELDS.map((field) => {
                const selectedIdx = fieldMap[field.key];
                const selectedDesc =
                  selectedIdx !== ''
                    ? sourceDescriptors.find((d) => d.index === selectedIdx)
                    : undefined;

                return (
                  <div
                    key={field.key}
                    className={`p-3 rounded-xl border transition ${
                      selectedIdx !== ''
                        ? 'bg-white border-emerald-300 shadow-2xs'
                        : field.required
                        ? 'bg-rose-50/70 border-rose-300'
                        : 'bg-white/80 border-neutral-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label className="text-xs font-bold text-neutral-900">
                        {field.label}{' '}
                        {field.required && <span className="text-rose-600">*</span>}
                      </label>
                      {selectedIdx !== '' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                          Biriktirildi ({selectedDesc?.code})
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-neutral-500 mb-2">{field.description}</p>

                    <div className="flex items-center gap-1.5">
                      <select
                        value={selectedIdx === '' ? '' : String(selectedIdx)}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFieldMap((prev) => ({
                            ...prev,
                            [field.key]: val === '' ? '' : Number(val),
                          }));
                        }}
                        className="w-full px-2.5 py-2 rounded-lg border border-neutral-300 bg-white text-xs font-semibold text-neutral-900 outline-none focus:border-rose-500"
                      >
                        <option value="">— Tanlanmagan (Bo'sh qoldirish) —</option>
                        {sourceDescriptors.map((desc) => (
                          <option key={desc.index} value={desc.index}>
                            {desc.label}
                          </option>
                        ))}
                      </select>
                      {selectedIdx !== '' && (
                        <button
                          type="button"
                          onClick={() =>
                            setFieldMap((prev) => ({
                              ...prev,
                              [field.key]: '',
                            }))
                          }
                          className="p-2 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-neutral-200 transition cursor-pointer shrink-0"
                          title="Tanlovni bekor qilish"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {selectedDesc && selectedDesc.sample && (
                      <div className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-800 font-mono truncate">
                        <ArrowRight className="w-3 h-3 shrink-0 text-emerald-600" />
                        <span className="truncate">Namuna qiymat: {selectedDesc.sample}</span>
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
                  4. Yuklanadigan mijozlar qatorlarini tekshirish va tanlash ({summaryTotals.count} ta tanlangan)
                </h3>
                <p className="text-[11px] text-neutral-500">
                  Bazaga yuklanishi kerak bo'lmagan qatorlardan belgini olib tashlashingiz mumkin
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap text-xs font-bold">
                <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 font-mono">
                  Jami qarz: {formatMoney(summaryTotals.debt)}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">
                  Jami haqdorlik: {formatMoney(summaryTotals.advance)}
                </span>
              </div>
            </div>

            {parsedRecords.length === 0 ? (
              <div className="p-6 text-center text-xs text-neutral-500">
                Ushbu varaqda ma'lumot qatorlari topilmadi.
              </div>
            ) : (
              <div className="max-h-64 overflow-auto rounded-xl border border-neutral-200">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-neutral-100 text-neutral-800 font-bold sticky top-0 z-10 border-b border-neutral-200">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">
                        <button
                          type="button"
                          onClick={toggleSelectAllValid}
                          className="inline-flex items-center justify-center text-rose-700 hover:text-rose-900 cursor-pointer"
                          title="Barchasini tanlash yoki bekor qilish"
                        >
                          {selectedValidRecords.length === validRecords.length &&
                          validRecords.length > 0 ? (
                            <CheckSquare className="w-4 h-4" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th className="py-2.5 px-2.5 text-center w-14">Qator</th>
                      <th className="py-2.5 px-3">Mijoz ismi</th>
                      <th className="py-2.5 px-3">Telefon raqamlari</th>
                      <th className="py-2.5 px-3">Manzil (Viloyat / Tuman / Mo'ljal)</th>
                      <th className="py-2.5 px-3 text-right">Qarz (USD)</th>
                      <th className="py-2.5 px-3 text-right">Haqdorlik (USD)</th>
                      <th className="py-2.5 px-3">Izoh</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-150">
                    {parsedRecords.map((rec) => {
                      const isSelected =
                        rec.isValid && !excludedRecordIndices.has(rec.recordIndex);
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
                          <td className="py-2 px-3 font-bold text-neutral-900">
                            {rec.payload.name || (
                              <span className="italic text-rose-500">Ism kiritilmagan</span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono text-neutral-700">
                            {rec.payload.phone || '-'}
                          </td>
                          <td className="py-2 px-3 text-neutral-700 max-w-[220px] truncate">
                            {rec.payload.address || '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-rose-700">
                            {rec.payload.currentDebt > 0
                              ? formatMoney(rec.payload.currentDebt)
                              : '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                            {rec.payload.currentAdvance > 0
                              ? formatMoney(rec.payload.currentAdvance)
                              : '-'}
                          </td>
                          <td className="py-2 px-3 text-neutral-600 max-w-[180px] truncate">
                            {rec.payload.notes || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
          <span>Tanlangan mijozlarni bazaga yuklash ({summaryTotals.count} ta)</span>
        </button>
      </div>
    </div>
  );
};
