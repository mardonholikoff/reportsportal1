import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { Client, DailyPlanItem, WarehouseProduct } from '../types';
import { formatMoney, formatNumber } from '../utils/format';
import { buildWarehouseProductChronology } from '../utils/warehouseChronology';
import { storageService } from '../services/storage';
import { StickyTableWrapper } from './StickyTableWrapper';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Search,
  Download,
  SlidersHorizontal,
  RotateCcw,
  Users,
  Warehouse,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react';

interface Props {
  clients: Client[];
  warehouseProducts: WarehouseProduct[];
  dailyPlans?: DailyPlanItem[];
}

type CompareTab = 'clients' | 'warehouse';
type StatusFilter = 'all' | 'diff' | 'match' | 'only_excel' | 'only_db';

interface ParsedSheet {
  name: string;
  grid: string[][];
}

interface ClientColMapping {
  codeCol: number | '';
  nameCol: number | '';
  debtCol: number | '';
  advanceCol: number | '';
}

interface WarehouseColMapping {
  brandCol: number | '';
  nameCol: number | '';
  markCol: number | '';
  qtyCol: number | '';
  sumCol: number | '';
  qtyUnitMode: 'piece' | 'package';
}

interface ClientComparisonRow {
  key: string;
  status: 'match' | 'diff' | 'only_excel' | 'only_db';
  code: string;
  dbName: string;
  excelName: string;
  dbDebt: number;
  excelDebt: number;
  debtDiff: number;
  dbAdvance: number;
  excelAdvance: number;
  advanceDiff: number;
  netDiff: number;
  excelRowCount: number;
}

interface WarehouseComparisonRow {
  key: string;
  status: 'match' | 'diff' | 'only_excel' | 'only_db';
  brand: string;
  dbName: string;
  excelName: string;
  mark: string;
  unitLabel: string;
  dbQty: number;
  excelQty: number;
  qtyDiff: number;
  dbValue: number;
  excelValue: number;
  valueDiff: number;
  hasExcelValue: boolean;
  excelRowCount: number;
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
  if (val instanceof Date) return val.toISOString().slice(0, 10);
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

/**
 * Safely parses signed numbers from Uzbek/Russian/English Excel cells:
 * handles spaces/NBSP thousand separators, comma vs dot decimals, currency labels, and parentheses negatives.
 */
function parseSignedExcelNumber(raw: string): number {
  if (!raw) return 0;
  let str = String(raw).trim();
  if (!str) return 0;

  let isNegative = false;
  if (str.startsWith('(') && str.endsWith(')')) {
    isNegative = true;
    str = str.slice(1, -1).trim();
  }

  // Normalize minus characters (en-dash, em-dash, unicode minus)
  str = str.replace(/[\u2212\u2013\u2014]/g, '-');
  // Strip spaces, NBSP, currency symbols/words
  str = str.replace(/[\s\u00A0$€£]/g, '').replace(/(usd|uzs|so'm|som|сум|dona|sht|шт|л|litr|kg|кг)/gi, '');
  str = str.replace(/[^\d.,-]/g, '');

  if (!str || str === '-' || str === '.' || str === ',') return 0;
  if (str.startsWith('-')) {
    isNegative = true;
    str = str.slice(1);
  }

  const hasComma = str.includes(',');
  const hasDot = str.includes('.');

  if (hasComma && hasDot) {
    // Whichever appears last is the decimal separator
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (hasComma) {
    const parts = str.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      str = parts[0] + '.' + parts[1];
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (hasDot) {
    const parts = str.split('.');
    if (parts.length > 2) {
      const dec = parts.pop();
      str = parts.join('') + '.' + dec;
    }
  }

  const parsed = parseFloat(str);
  if (!Number.isFinite(parsed)) return 0;
  const rounded = Math.round(parsed * 100) / 100;
  return isNegative ? -Math.abs(rounded) : rounded;
}

function normalizeText(raw?: string | null): string {
  if (!raw) return '';
  return String(raw)
    .toLowerCase()
    .replace(/[`'’‘ʻʼʼʼ′"«»]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeLooseKey(raw?: string | null): string {
  return normalizeText(raw).replace(/[^a-z0-9а-яёўқғҳ]/gi, '');
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    const chA = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j++) {
      const cost = chA === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

function tokenizeProductForMatch(raw?: string | null): string[] {
  if (!raw) return [];
  let s = normalizeText(raw);
  if (!s) return [];
  // Normalize common oil/unit patterns so "5w-30" == "5w30", "5 kg" == "5kg", "4 l" == "4l"
  s = s
    .replace(/\b(\d{1,2})\s*w\s*[-]?\s*(\d{2})\b/gi, '$1w$2')
    .replace(/\b(\d+(?:[.,]\d+)?)\s*(l|lt|litr|liter|л|литр)\b/gi, (_, num) => `${num.replace(',', '.')}l`)
    .replace(/\b(\d+(?:[.,]\d+)?)\s*(kg|кг)\b/gi, (_, num) => `${num.replace(',', '.')}kg`)
    .replace(/\b(\d+(?:[.,]\d+)?)\s*(ml|мл)\b/gi, (_, num) => `${num.replace(',', '.')}ml`)
    .replace(/\b(\d+(?:[.,]\d+)?)\s*(gr|g|гр|г)\b/gi, (_, num) => `${num.replace(',', '.')}g`)
    .replace(/\b(\d+)\s*(pcs|шт|dona)\b/gi, '$1pcs')
    .replace(/(\d+),(\d+)/g, '$1.$2');

  const rawTokens = s
    .replace(/[^a-z0-9а-яёўқғҳ.]+/gi, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^\.+|\.+$/g, ''))
    .filter(Boolean);

  return rawTokens;
}

function extractCriticalSpecTokens(tokens: string[]): {
  viscosities: Set<string>;
  volumes: Set<string>;
  coolants: Set<string>;
  apiSpecs: Set<string>;
} {
  const viscosities = new Set<string>();
  const volumes = new Set<string>();
  const coolants = new Set<string>();
  const apiSpecs = new Set<string>();
  for (const t of tokens) {
    if (/^\d{1,2}w\d{2}$/i.test(t)) viscosities.add(t);
    else if (/^\d+(?:\.\d+)?(l|kg|ml|g)$/i.test(t)) volumes.add(t);
    else if (/^g(11|12|12\+|13)$/i.test(t)) coolants.add(t);
    else if (/^(sl|sm|sn|sp|cf|ch4|ci4|cj4|ck4|gl4|gl5)$/i.test(t)) apiSpecs.add(t);
  }
  return { viscosities, volumes, coolants, apiSpecs };
}

function hasConflictingCriticalSpecs(tokensA: string[], tokensB: string[]): boolean {
  const a = extractCriticalSpecTokens(tokensA);
  const b = extractCriticalSpecTokens(tokensB);
  const setsConflict = (s1: Set<string>, s2: Set<string>): boolean => {
    if (s1.size === 0 || s2.size === 0) return false;
    for (const v of s1) {
      if (s2.has(v)) return false;
    }
    return true;
  };
  return (
    setsConflict(a.viscosities, b.viscosities) ||
    setsConflict(a.volumes, b.volumes) ||
    setsConflict(a.coolants, b.coolants) ||
    setsConflict(a.apiSpecs, b.apiSpecs)
  );
}

/**
 * Word-order-independent & apostrophe-insensitive similarity score in [0, 1].
 * Returns >= 0.90 when tokens match >= 90% regardless of word order or apostrophes
 * (e.g., "seg motol" vs "motol seg", "ozbek" vs "o'zbek").
 */
function computeProductOrderInsensitiveSimilarity(tokensA: string[], tokensB: string[]): number {
  const a = tokensA.filter((t) => t !== 'umumiy');
  const b = tokensB.filter((t) => t !== 'umumiy');
  if (a.length === 0 || b.length === 0) return 0;

  if (hasConflictingCriticalSpecs(a, b)) return 0;

  // Fast exact multiset match (100% match regardless of word order)
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  const joinedA = sortedA.join(' ');
  const joinedB = sortedB.join(' ');
  if (joinedA === joinedB) return 1;

  // 1. Greedy best 1-to-1 token pairing weighted by token length
  const usedB = new Set<number>();
  let matchedWeight = 0;
  const totalWeightA = a.reduce((s, t) => s + t.length, 0);
  const totalWeightB = b.reduce((s, t) => s + t.length, 0);

  // First pass: exact token matches
  const unmatchedAIdx: number[] = [];
  for (let i = 0; i < a.length; i++) {
    let foundIdx = -1;
    for (let j = 0; j < b.length; j++) {
      if (!usedB.has(j) && a[i] === b[j]) {
        foundIdx = j;
        break;
      }
    }
    if (foundIdx !== -1) {
      usedB.add(foundIdx);
      matchedWeight += a[i].length;
    } else {
      unmatchedAIdx.push(i);
    }
  }

  // Second pass: fuzzy token matches for remaining tokens (handles minor spelling diffs)
  const pairCandidates: Array<{ i: number; j: number; sim: number }> = [];
  for (const i of unmatchedAIdx) {
    const tA = a[i];
    for (let j = 0; j < b.length; j++) {
      if (usedB.has(j)) continue;
      const tB = b[j];
      // Do not fuzzy-match purely numeric tokens with different numbers (e.g. 564 vs 565)
      if (/^\d+(?:\.\d+)?$/.test(tA) && /^\d+(?:\.\d+)?$/.test(tB) && tA !== tB) continue;
      const maxLen = Math.max(tA.length, tB.length);
      if (maxLen === 0) continue;
      const dist = levenshteinDistance(tA, tB);
      const sim = 1 - dist / maxLen;
      if (sim >= 0.75) {
        pairCandidates.push({ i, j, sim });
      }
    }
  }
  pairCandidates.sort((x, y) => y.sim - x.sim);
  const usedA = new Set<number>();
  for (const cand of pairCandidates) {
    if (usedA.has(cand.i) || usedB.has(cand.j)) continue;
    usedA.add(cand.i);
    usedB.add(cand.j);
    const weight = Math.max(a[cand.i].length, b[cand.j].length);
    matchedWeight += cand.sim * weight;
  }

  const maxTotalWeight = Math.max(totalWeightA, totalWeightB);
  const weightedTokenSim = maxTotalWeight > 0 ? matchedWeight / maxTotalWeight : 0;

  // 2. Sorted-token string Levenshtein similarity
  const maxJoinedLen = Math.max(joinedA.length, joinedB.length);
  const sortedLevenshteinSim =
    maxJoinedLen > 0 ? 1 - levenshteinDistance(joinedA, joinedB) / maxJoinedLen : 0;

  // Also check loose-key sorted chars/tokens similarity when word spacing differs (e.g. "motol seg" vs "segmotol")
  const score = Math.max(weightedTokenSim, sortedLevenshteinSim);
  return Math.min(1, Math.max(0, score));
}

function extractLeadingClientCode(name?: string | null, explicitCode?: string | null): string {
  if (explicitCode && explicitCode.trim()) {
    return explicitCode.trim().toUpperCase().replace(/\s+/g, '');
  }
  if (!name) return '';
  const match = name.trim().match(/^([A-Za-zКк]-?\d{1,6})\b/);
  if (match && match[1]) {
    return match[1].toUpperCase().replace(/^К/, 'K').replace(/-/g, '');
  }
  return '';
}

function isSummaryRowText(text: string): boolean {
  const low = normalizeText(text);
  if (!low) return false;
  return (
    low === 'jami' ||
    low.startsWith('jami:') ||
    low.startsWith('jami ') ||
    low === 'umumiy' ||
    low.startsWith('umumiy:') ||
    low === 'itogo' ||
    low.startsWith('itogo:') ||
    low === 'итого' ||
    low.startsWith('итого:') ||
    low.startsWith('итого ') ||
    low === 'всего' ||
    low.startsWith('всего:') ||
    low === 'total' ||
    low.startsWith('total:')
  );
}

const CLIENT_HEADER_KEYWORDS = {
  code: ['kod', 'klient kod', 'client code', 'code', 'код', 'id'],
  name: ['mijoz', 'klient', 'kontragent', 'ism', 'fio', 'f.i.o', 'nomi', 'tashkilot', 'korxona', 'name', 'client', 'клиент', 'контрагент', 'фио', 'имя', 'наименование'],
  debt: ['qarz', 'qarzdor', 'debet', 'dolg', 'debt', 'balans', 'qoldiq', 'ostatok', 'долг', 'задолженность', 'дебет', 'остаток', 'баланс'],
  advance: ['haqdor', 'haq', 'avans', 'kredit', 'predoplata', 'advance', 'аванс', 'кредит', 'переплата'],
};

const WAREHOUSE_HEADER_KEYWORDS = {
  brand: ['brend', 'brand', 'firma', 'ishlab chiqaruvchi', 'бренд', 'фирма', 'производитель'],
  name: ['mahsulot', 'tovar', 'nomenklatura', 'nomi', 'product', 'name', 'товар', 'номенклатура', 'наименование', 'название'],
  mark: ['marka', 'artikul', 'kod', 'sku', 'model', 'марка', 'артикул', 'код', 'модель'],
  qty: ['qoldiq', 'soni', 'miqdor', 'dona', 'ostatok', 'kolichestvo', 'kol-vo', 'qty', 'quantity', 'stock', 'остаток', 'количество', 'кол-во', 'штук', 'всего'],
  sum: ['summa', 'qiymat', 'jami narx', 'narx', 'total', 'amount', 'value', 'price', 'сумма', 'стоимость', 'итого'],
};

function detectHeaderRow(grid: string[][], mode: CompareTab): number {
  const maxScan = Math.min(grid.length, 20);
  const allKeywords =
    mode === 'clients'
      ? [
          ...CLIENT_HEADER_KEYWORDS.code,
          ...CLIENT_HEADER_KEYWORDS.name,
          ...CLIENT_HEADER_KEYWORDS.debt,
          ...CLIENT_HEADER_KEYWORDS.advance,
        ]
      : [
          ...WAREHOUSE_HEADER_KEYWORDS.brand,
          ...WAREHOUSE_HEADER_KEYWORDS.name,
          ...WAREHOUSE_HEADER_KEYWORDS.mark,
          ...WAREHOUSE_HEADER_KEYWORDS.qty,
          ...WAREHOUSE_HEADER_KEYWORDS.sum,
        ];

  let bestRow = 0;
  let bestScore = -1;

  for (let r = 0; r < maxScan; r++) {
    const row = grid[r] || [];
    let score = 0;
    let nonEmpty = 0;
    for (let c = 0; c < row.length; c++) {
      const cell = normalizeText(row[c]);
      if (!cell) continue;
      nonEmpty++;
      if (allKeywords.some((kw) => cell.includes(kw))) {
        score += 3;
      }
    }
    if (nonEmpty >= 2 && score > bestScore) {
      bestScore = score;
      bestRow = r;
    }
  }

  return bestScore > 0 ? bestRow : 0;
}

function autoMapClientCols(grid: string[][], headerRowIdx: number): ClientColMapping {
  const header = grid[headerRowIdx] || [];
  const mapping: ClientColMapping = {
    codeCol: '',
    nameCol: '',
    debtCol: '',
    advanceCol: '',
  };
  const used = new Set<number>();

  const findCol = (keywords: string[], excludeKeywords: string[] = []): number | '' => {
    let bestIdx: number | '' = '';
    let bestScore = 0;
    for (let c = 0; c < header.length; c++) {
      if (used.has(c)) continue;
      const cell = normalizeText(header[c]);
      if (!cell) continue;
      if (excludeKeywords.some((ex) => cell.includes(ex))) continue;
      for (const kw of keywords) {
        if (cell === kw && 10 > bestScore) {
          bestScore = 10;
          bestIdx = c;
        } else if (cell.includes(kw) && 5 > bestScore) {
          bestScore = 5;
          bestIdx = c;
        }
      }
    }
    if (bestIdx !== '') used.add(bestIdx);
    return bestIdx;
  };

  mapping.nameCol = findCol(CLIENT_HEADER_KEYWORDS.name, ['kod', 'code', 'код']);
  mapping.codeCol = findCol(CLIENT_HEADER_KEYWORDS.code);
  mapping.debtCol = findCol(CLIENT_HEADER_KEYWORDS.debt, ['boshlang', 'dastlabki', 'начальн']);
  if (mapping.debtCol === '') {
    mapping.debtCol = findCol(CLIENT_HEADER_KEYWORDS.debt);
  }
  mapping.advanceCol = findCol(CLIENT_HEADER_KEYWORDS.advance);

  // Fallback heuristics if headers were generic/unnamed
  if (mapping.nameCol === '') {
    for (let c = 0; c < header.length; c++) {
      if (!used.has(c)) {
        mapping.nameCol = c;
        used.add(c);
        break;
      }
    }
  }
  if (mapping.debtCol === '') {
    const sampleStart = headerRowIdx + 1;
    const maxCols = grid.reduce((m, r) => Math.max(m, r.length), 0);
    for (let c = 0; c < maxCols; c++) {
      if (used.has(c)) continue;
      let numericCount = 0;
      for (let r = sampleStart; r < Math.min(grid.length, sampleStart + 10); r++) {
        const val = (grid[r] && grid[r][c]) || '';
        if (val && /\d/.test(val) && Math.abs(parseSignedExcelNumber(val)) > 0) {
          numericCount++;
        }
      }
      if (numericCount >= 1) {
        mapping.debtCol = c;
        used.add(c);
        break;
      }
    }
  }

  return mapping;
}

function autoMapWarehouseCols(grid: string[][], headerRowIdx: number): WarehouseColMapping {
  const header = grid[headerRowIdx] || [];
  const mapping: WarehouseColMapping = {
    brandCol: '',
    nameCol: '',
    markCol: '',
    qtyCol: '',
    sumCol: '',
    qtyUnitMode: 'piece',
  };
  const used = new Set<number>();

  const findCol = (keywords: string[], excludeKeywords: string[] = []): number | '' => {
    let bestIdx: number | '' = '';
    let bestScore = 0;
    for (let c = 0; c < header.length; c++) {
      if (used.has(c)) continue;
      const cell = normalizeText(header[c]);
      if (!cell) continue;
      if (excludeKeywords.some((ex) => cell.includes(ex))) continue;
      for (const kw of keywords) {
        if (cell === kw && 10 > bestScore) {
          bestScore = 10;
          bestIdx = c;
        } else if (cell.includes(kw) && 5 > bestScore) {
          bestScore = 5;
          bestIdx = c;
        }
      }
    }
    if (bestIdx !== '') used.add(bestIdx);
    return bestIdx;
  };

  mapping.nameCol = findCol(WAREHOUSE_HEADER_KEYWORDS.name);
  mapping.brandCol = findCol(WAREHOUSE_HEADER_KEYWORDS.brand);
  mapping.markCol = findCol(WAREHOUSE_HEADER_KEYWORDS.mark);
  mapping.qtyCol = findCol(WAREHOUSE_HEADER_KEYWORDS.qty, ['summa', 'narx', 'usd', 'сумма', 'цена']);
  mapping.sumCol = findCol(WAREHOUSE_HEADER_KEYWORDS.sum);

  // Detect if qty header explicitly mentions korobka/qadoq
  if (mapping.qtyCol !== '') {
    const qtyHeader = normalizeText(header[mapping.qtyCol]);
    if (qtyHeader.includes('korobka') || qtyHeader.includes('qadoq') || qtyHeader.includes('коробк')) {
      mapping.qtyUnitMode = 'package';
    }
  }

  if (mapping.nameCol === '') {
    for (let c = 0; c < header.length; c++) {
      if (!used.has(c)) {
        mapping.nameCol = c;
        used.add(c);
        break;
      }
    }
  }
  if (mapping.qtyCol === '') {
    const sampleStart = headerRowIdx + 1;
    const maxCols = grid.reduce((m, r) => Math.max(m, r.length), 0);
    for (let c = 0; c < maxCols; c++) {
      if (used.has(c)) continue;
      let numericCount = 0;
      for (let r = sampleStart; r < Math.min(grid.length, sampleStart + 10); r++) {
        const val = (grid[r] && grid[r][c]) || '';
        if (val && /\d/.test(val)) {
          numericCount++;
        }
      }
      if (numericCount >= 1) {
        mapping.qtyCol = c;
        used.add(c);
        break;
      }
    }
  }

  return mapping;
}

function formatSheetJsCell(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return '';
    return val.toISOString().slice(0, 10);
  }
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return '';
    // Avoid binary floating-point artifacts like 1250.5000000000002
    const cleaned = Math.round(val * 1_000_000) / 1_000_000;
    return String(cleaned);
  }
  if (typeof val === 'boolean') return String(val);
  return String(val).trim();
}

function extractSheetsFromSheetJsWorkbook(wb: XLSX.WorkBook): ParsedSheet[] {
  const parsedSheets: ParsedSheet[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    // Repair missing !ref if a third-party exporter (e.g. 1C / custom generator) omitted <dimension>
    if (!ws['!ref']) {
      let minR = Infinity;
      let maxR = -1;
      let minC = Infinity;
      let maxC = -1;
      for (const key of Object.keys(ws)) {
        if (key.startsWith('!')) continue;
        try {
          const pos = XLSX.utils.decode_cell(key);
          if (pos.r < minR) minR = pos.r;
          if (pos.r > maxR) maxR = pos.r;
          if (pos.c < minC) minC = pos.c;
          if (pos.c > maxC) maxC = pos.c;
        } catch {
          // ignore non-cell keys
        }
      }
      if (maxR >= 0 && maxC >= 0) {
        ws['!ref'] = XLSX.utils.encode_range({
          s: { r: minR, c: minC },
          e: { r: maxR, c: maxC },
        });
      }
    }

    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: '',
      blankrows: false,
      raw: true,
    });

    let maxCols = 0;
    const grid: string[][] = [];
    for (const rawRow of rawRows) {
      if (!Array.isArray(rawRow)) continue;
      const rowArr = rawRow.map((cell) => formatSheetJsCell(cell));
      if (rowArr.some((cell) => cell !== '')) {
        if (rowArr.length > maxCols) maxCols = rowArr.length;
        grid.push(rowArr);
      }
    }

    if (grid.length > 0) {
      const normalizedGrid = grid.map((r) => {
        if (r.length >= maxCols) return r;
        const padded = [...r];
        while (padded.length < maxCols) padded.push('');
        return padded;
      });
      parsedSheets.push({ name: sheetName || `Varaq ${parsedSheets.length + 1}`, grid: normalizedGrid });
    }
  }

  return parsedSheets;
}

const SUPPORTED_EXCEL_EXTENSIONS = ['.xlsx', '.xls', '.xlsm', '.xlsb', '.csv', '.ods'];

function isSupportedSpreadsheetName(fileName: string): boolean {
  const lower = fileName.toLowerCase().trim();
  return SUPPORTED_EXCEL_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function formatParseErrorMessage(err: unknown): string {
  const rawMsg = err instanceof Error ? err.message : String(err || '');
  const lower = rawMsg.toLowerCase();
  if (lower.includes('password') || lower.includes('encrypt') || lower.includes('protected')) {
    return "Yuklangan Excel fayli parol bilan himoyalangan. Excelda parolsiz saqlab qayta yuklang.";
  }
  if (rawMsg && rawMsg.length <= 140) {
    return `Excel faylini o'qishda xatolik yuz berdi (${rawMsg}). Faylni Excelda ochib qayta saqlab yuklab ko'ring.`;
  }
  return "Excel faylini o'qishda xatolik yuz berdi. Faylni Excelda ochib .xlsx formatda qayta saqlab yuklab ko'ring.";
}

async function parseSpreadsheetFile(file: File): Promise<ParsedSheet[]> {
  const buffer = await file.arrayBuffer();
  if (!buffer || buffer.byteLength === 0) {
    throw new Error("Fayl bo'sh (0 bayt)");
  }

  const bytes = new Uint8Array(buffer);
  let lastError: unknown = null;

  // 1. Primary parser: SheetJS (handles standard .xlsx, strict OOXML, 1C exports, shared formulas, drawings, .xls, .xlsm, .xlsb, .ods, HTML/CSV)
  try {
    const wb = XLSX.read(bytes, {
      type: 'array',
      cellDates: true,
      cellFormula: false,
      cellHTML: false,
    });
    const sheets = extractSheetsFromSheetJsWorkbook(wb);
    if (sheets.length > 0) return sheets;
  } catch (err) {
    lastError = err;
    console.warn('SheetJS binary read fallback triggered:', err);
  }

  // 2. Fallback for HTML/XML/CSV text files saved with .xlsx/.xls extension
  try {
    const decodedText = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    if (decodedText && decodedText.trim().length > 0) {
      const wb = XLSX.read(decodedText, {
        type: 'string',
        cellDates: true,
        cellFormula: false,
        cellHTML: false,
      });
      const sheets = extractSheetsFromSheetJsWorkbook(wb);
      if (sheets.length > 0) return sheets;
    }
  } catch (err) {
    if (!lastError) lastError = err;
  }

  // 3. Final fallback: ExcelJS
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const parsedSheets: ParsedSheet[] = [];
    workbook.eachSheet((worksheet) => {
      const grid: string[][] = [];
      let maxCols = Math.max(worksheet.columnCount || 0, 1);
      worksheet.eachRow({ includeEmpty: false }, (row) => {
        const rowColCount = Math.max(maxCols, row.cellCount || 0, row.actualCellCount || 0);
        if (rowColCount > maxCols) maxCols = rowColCount;
        const rowArr: string[] = [];
        let hasAnyText = false;
        for (let c = 1; c <= rowColCount; c++) {
          const txt = extractCellText(row.getCell(c).value);
          if (txt) hasAnyText = true;
          rowArr.push(txt);
        }
        if (hasAnyText) {
          grid.push(rowArr);
        }
      });
      if (grid.length > 0) {
        const normalizedGrid = grid.map((r) => {
          if (r.length >= maxCols) return r;
          const padded = [...r];
          while (padded.length < maxCols) padded.push('');
          return padded;
        });
        parsedSheets.push({ name: worksheet.name || `Varaq ${parsedSheets.length + 1}`, grid: normalizedGrid });
      }
    });
    if (parsedSheets.length > 0) return parsedSheets;
  } catch (err) {
    if (!lastError) lastError = err;
    console.warn('ExcelJS fallback failed:', err);
  }

  if (lastError) {
    throw lastError;
  }
  return [];
}

export const AdminExcelComparisonSection: React.FC<Props> = ({
  clients,
  warehouseProducts,
  dailyPlans,
}) => {
  const [activeTab, setActiveTab] = useState<CompareTab>('clients');

  // Client comparison file state
  const [clientFileName, setClientFileName] = useState('');
  const [clientSheets, setClientSheets] = useState<ParsedSheet[]>([]);
  const [clientSheetIdx, setClientSheetIdx] = useState(0);
  const [clientHeaderRow, setClientHeaderRow] = useState(0);
  const [clientMapping, setClientMapping] = useState<ClientColMapping>({
    codeCol: '',
    nameCol: '',
    debtCol: '',
    advanceCol: '',
  });
  const [clientFilter, setClientFilter] = useState<StatusFilter>('all');
  const [clientSearch, setClientSearch] = useState('');
  const [showClientConfig, setShowClientConfig] = useState(false);
  const [clientLoading, setClientLoading] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  // Warehouse comparison file state
  const [whFileName, setWhFileName] = useState('');
  const [whSheets, setWhSheets] = useState<ParsedSheet[]>([]);
  const [whSheetIdx, setWhSheetIdx] = useState(0);
  const [whHeaderRow, setWhHeaderRow] = useState(0);
  const [whMapping, setWhMapping] = useState<WarehouseColMapping>({
    brandCol: '',
    nameCol: '',
    markCol: '',
    qtyCol: '',
    sumCol: '',
    qtyUnitMode: 'piece',
  });
  const [whFilter, setWhFilter] = useState<StatusFilter>('all');
  const [whSearch, setWhSearch] = useState('');
  const [showWhConfig, setShowWhConfig] = useState(false);
  const [whLoading, setWhLoading] = useState(false);
  const [whError, setWhError] = useState<string | null>(null);

  const clientInputRef = useRef<HTMLInputElement | null>(null);
  const whInputRef = useRef<HTMLInputElement | null>(null);

  const handleClientFileUpload = async (file?: File | null) => {
    if (!file) return;
    if (!isSupportedSpreadsheetName(file.name)) {
      setClientError("Faqat Excel (.xlsx, .xls, .xlsm, .csv) formatdagi faylni yuklash mumkin.");
      return;
    }
    setClientLoading(true);
    setClientError(null);
    try {
      const sheets = await parseSpreadsheetFile(file);
      if (sheets.length === 0) {
        setClientError("Yuklangan Excel faylda ma'lumot topilmadi yoki varaq bo'sh.");
        setClientSheets([]);
        setClientFileName('');
        return;
      }
      const detectedHeader = detectHeaderRow(sheets[0].grid, 'clients');
      const detectedMap = autoMapClientCols(sheets[0].grid, detectedHeader);
      setClientFileName(file.name);
      setClientSheets(sheets);
      setClientSheetIdx(0);
      setClientHeaderRow(detectedHeader);
      setClientMapping(detectedMap);
      setClientFilter('all');
      setClientSearch('');
      setActiveTab('clients');
    } catch (err) {
      console.error('Client Excel parse error:', err);
      setClientError(formatParseErrorMessage(err));
    } finally {
      setClientLoading(false);
      if (clientInputRef.current) clientInputRef.current.value = '';
    }
  };

  const handleWarehouseFileUpload = async (file?: File | null) => {
    if (!file) return;
    if (!isSupportedSpreadsheetName(file.name)) {
      setWhError("Faqat Excel (.xlsx, .xls, .xlsm, .csv) formatdagi faylni yuklash mumkin.");
      return;
    }
    setWhLoading(true);
    setWhError(null);
    try {
      const sheets = await parseSpreadsheetFile(file);
      if (sheets.length === 0) {
        setWhError("Yuklangan Excel faylda ma'lumot topilmadi yoki varaq bo'sh.");
        setWhSheets([]);
        setWhFileName('');
        return;
      }
      const detectedHeader = detectHeaderRow(sheets[0].grid, 'warehouse');
      const detectedMap = autoMapWarehouseCols(sheets[0].grid, detectedHeader);
      setWhFileName(file.name);
      setWhSheets(sheets);
      setWhSheetIdx(0);
      setWhHeaderRow(detectedHeader);
      setWhMapping(detectedMap);
      setWhFilter('all');
      setWhSearch('');
      setActiveTab('warehouse');
    } catch (err) {
      console.error('Warehouse Excel parse error:', err);
      setWhError(formatParseErrorMessage(err));
    } finally {
      setWhLoading(false);
      if (whInputRef.current) whInputRef.current.value = '';
    }
  };

  const activeClientSheet = clientSheets[clientSheetIdx] || null;
  const activeWhSheet = whSheets[whSheetIdx] || null;

  const clientColumnOptions = useMemo(() => {
    if (!activeClientSheet) return [];
    const maxCols = activeClientSheet.grid.reduce((m, r) => Math.max(m, r.length), 0);
    const header = activeClientSheet.grid[clientHeaderRow] || [];
    return Array.from({ length: maxCols }, (_, idx) => ({
      idx,
      label: `${colIndexToLetter(idx)} — ${header[idx] || `Ustun ${idx + 1}`}`,
    }));
  }, [activeClientSheet, clientHeaderRow]);

  const whColumnOptions = useMemo(() => {
    if (!activeWhSheet) return [];
    const maxCols = activeWhSheet.grid.reduce((m, r) => Math.max(m, r.length), 0);
    const header = activeWhSheet.grid[whHeaderRow] || [];
    return Array.from({ length: maxCols }, (_, idx) => ({
      idx,
      label: `${colIndexToLetter(idx)} — ${header[idx] || `Ustun ${idx + 1}`}`,
    }));
  }, [activeWhSheet, whHeaderRow]);

  // =========================================================================
  // CLIENT COMPARISON ENGINE
  // =========================================================================
  const clientComparison = useMemo(() => {
    if (!activeClientSheet || (clientMapping.nameCol === '' && clientMapping.codeCol === '')) {
      return null;
    }

    // Build lookup indexes for DB clients
    const dbByCode = new Map<string, Client>();
    const dbByNormName = new Map<string, Client>();
    const dbByLooseName = new Map<string, Client>();

    clients.forEach((c) => {
      const code = extractLeadingClientCode(c.name, c.clientCode);
      if (code && !dbByCode.has(code)) dbByCode.set(code, c);
      const normName = normalizeText(c.name);
      if (normName && !dbByNormName.has(normName)) dbByNormName.set(normName, c);
      const loose = normalizeLooseKey(c.name);
      if (loose && !dbByLooseName.has(loose)) dbByLooseName.set(loose, c);
    });

    const matchDbClient = (rawCode: string, rawName: string): Client | undefined => {
      const code = extractLeadingClientCode(rawName, rawCode);
      if (code && dbByCode.has(code)) return dbByCode.get(code);

      const normName = normalizeText(rawName);
      if (normName && dbByNormName.has(normName)) return dbByNormName.get(normName);

      const loose = normalizeLooseKey(rawName);
      if (loose && dbByLooseName.has(loose)) return dbByLooseName.get(loose);

      // Unique substring fallback (for Excel names without code prefix or slightly shortened)
      if (normName.length >= 4) {
        const candidates = clients.filter((c) => {
          const cNorm = normalizeText(c.name);
          return cNorm.includes(normName) || (cNorm.length >= 4 && normName.includes(cNorm));
        });
        if (candidates.length === 1) return candidates[0];
      }

      return undefined;
    };

    // Aggregate Excel rows by matched DB client ID or unmatched normalized key
    const excelAggMap = new Map<
      string,
      {
        dbClient?: Client;
        code: string;
        excelName: string;
        excelDebt: number;
        excelAdvance: number;
        rowCount: number;
      }
    >();

    const startRow = clientHeaderRow + 1;
    for (let r = startRow; r < activeClientSheet.grid.length; r++) {
      const row = activeClientSheet.grid[r] || [];
      const rawCode = clientMapping.codeCol !== '' ? (row[clientMapping.codeCol] || '').trim() : '';
      const rawName = clientMapping.nameCol !== '' ? (row[clientMapping.nameCol] || '').trim() : '';

      if (!rawCode && !rawName) continue;
      if (isSummaryRowText(rawName) || isSummaryRowText(rawCode)) continue;

      const rawDebtStr = clientMapping.debtCol !== '' ? row[clientMapping.debtCol] || '' : '';
      const rawAdvStr = clientMapping.advanceCol !== '' ? row[clientMapping.advanceCol] || '' : '';

      const signedDebtVal = parseSignedExcelNumber(rawDebtStr);
      let rowDebt = 0;
      let rowAdvance = 0;

      if (clientMapping.advanceCol !== '') {
        rowDebt = Math.max(0, signedDebtVal);
        rowAdvance = Math.abs(parseSignedExcelNumber(rawAdvStr));
      } else {
        // Single signed column mode: positive = debt, negative = advance
        if (signedDebtVal >= 0) {
          rowDebt = signedDebtVal;
        } else {
          rowAdvance = Math.abs(signedDebtVal);
        }
      }

      const matched = matchDbClient(rawCode, rawName);
      const extractedCode = extractLeadingClientCode(rawName, rawCode);
      const aggKey = matched
        ? `db:${matched.id}`
        : `ex:${extractedCode || normalizeLooseKey(rawName) || `row_${r}`}`;

      const prev = excelAggMap.get(aggKey);
      if (prev) {
        prev.excelDebt = Math.round((prev.excelDebt + rowDebt) * 100) / 100;
        prev.excelAdvance = Math.round((prev.excelAdvance + rowAdvance) * 100) / 100;
        prev.rowCount += 1;
      } else {
        excelAggMap.set(aggKey, {
          dbClient: matched,
          code: extractedCode || (matched ? extractLeadingClientCode(matched.name, matched.clientCode) : ''),
          excelName: rawName || rawCode,
          excelDebt: Math.round(rowDebt * 100) / 100,
          excelAdvance: Math.round(rowAdvance * 100) / 100,
          rowCount: 1,
        });
      }
    }

    const rows: ClientComparisonRow[] = [];
    const matchedDbIds = new Set<string>();

    excelAggMap.forEach((entry, aggKey) => {
      if (entry.dbClient) {
        matchedDbIds.add(entry.dbClient.id);
        const dbDebt = Math.round((Number(entry.dbClient.currentDebt) || 0) * 100) / 100;
        const dbAdvance = Math.round((Number(entry.dbClient.currentAdvance) || 0) * 100) / 100;
        const debtDiff = Math.round((entry.excelDebt - dbDebt) * 100) / 100;
        const advanceDiff = Math.round((entry.excelAdvance - dbAdvance) * 100) / 100;
        const excelNet = Math.round((entry.excelDebt - entry.excelAdvance) * 100) / 100;
        const dbNet = Math.round((dbDebt - dbAdvance) * 100) / 100;
        const netDiff = Math.round((excelNet - dbNet) * 100) / 100;
        const isMatch = Math.abs(debtDiff) <= 0.05 && Math.abs(advanceDiff) <= 0.05;

        rows.push({
          key: aggKey,
          status: isMatch ? 'match' : 'diff',
          code: entry.code,
          dbName: entry.dbClient.name,
          excelName: entry.excelName,
          dbDebt,
          excelDebt: entry.excelDebt,
          debtDiff: Math.abs(debtDiff) <= 0.05 ? 0 : debtDiff,
          dbAdvance,
          excelAdvance: entry.excelAdvance,
          advanceDiff: Math.abs(advanceDiff) <= 0.05 ? 0 : advanceDiff,
          netDiff: Math.abs(netDiff) <= 0.05 ? 0 : netDiff,
          excelRowCount: entry.rowCount,
        });
      } else {
        rows.push({
          key: aggKey,
          status: 'only_excel',
          code: entry.code,
          dbName: '',
          excelName: entry.excelName,
          dbDebt: 0,
          excelDebt: entry.excelDebt,
          debtDiff: entry.excelDebt,
          dbAdvance: 0,
          excelAdvance: entry.excelAdvance,
          advanceDiff: entry.excelAdvance,
          netDiff: Math.round((entry.excelDebt - entry.excelAdvance) * 100) / 100,
          excelRowCount: entry.rowCount,
        });
      }
    });

    // Add DB clients not present in Excel
    clients.forEach((c) => {
      if (matchedDbIds.has(c.id)) return;
      const dbDebt = Math.round((Number(c.currentDebt) || 0) * 100) / 100;
      const dbAdvance = Math.round((Number(c.currentAdvance) || 0) * 100) / 100;
      rows.push({
        key: `only_db:${c.id}`,
        status: 'only_db',
        code: extractLeadingClientCode(c.name, c.clientCode),
        dbName: c.name,
        excelName: '',
        dbDebt,
        excelDebt: 0,
        debtDiff: Math.round(-dbDebt * 100) / 100,
        dbAdvance,
        excelAdvance: 0,
        advanceDiff: Math.round(-dbAdvance * 100) / 100,
        netDiff: Math.round(-(dbDebt - dbAdvance) * 100) / 100,
        excelRowCount: 0,
      });
    });

    // Sort: diffs first (largest absolute difference first), then only_excel, then only_db, then matched
    const statusOrder: Record<ClientComparisonRow['status'], number> = {
      diff: 0,
      only_excel: 1,
      only_db: 2,
      match: 3,
    };
    rows.sort((a, b) => {
      const sCmp = statusOrder[a.status] - statusOrder[b.status];
      if (sCmp !== 0) return sCmp;
      if (a.status === 'diff') {
        const diffA = Math.abs(a.debtDiff) + Math.abs(a.advanceDiff);
        const diffB = Math.abs(b.debtDiff) + Math.abs(b.advanceDiff);
        if (diffB !== diffA) return diffB - diffA;
      }
      return (a.dbName || a.excelName).localeCompare(b.dbName || b.excelName);
    });

    let matchCount = 0;
    let diffCount = 0;
    let onlyExcelCount = 0;
    let onlyDbCount = 0;
    let totalDbDebt = 0;
    let totalExcelDebt = 0;
    let totalDbAdvance = 0;
    let totalExcelAdvance = 0;

    rows.forEach((r) => {
      if (r.status === 'match') matchCount++;
      else if (r.status === 'diff') diffCount++;
      else if (r.status === 'only_excel') onlyExcelCount++;
      else if (r.status === 'only_db') onlyDbCount++;
      totalDbDebt += r.dbDebt;
      totalExcelDebt += r.excelDebt;
      totalDbAdvance += r.dbAdvance;
      totalExcelAdvance += r.excelAdvance;
    });

    const excelMatchedCount = matchCount + diffCount;
    const isPerfectMatch = diffCount === 0 && onlyExcelCount === 0 && onlyDbCount === 0 && matchCount > 0;
    const isMatchedZeroDiff = diffCount === 0 && matchCount > 0;

    return {
      rows,
      matchCount,
      diffCount,
      onlyExcelCount,
      onlyDbCount,
      excelMatchedCount,
      totalDbDebt: Math.round(totalDbDebt * 100) / 100,
      totalExcelDebt: Math.round(totalExcelDebt * 100) / 100,
      totalDbAdvance: Math.round(totalDbAdvance * 100) / 100,
      totalExcelAdvance: Math.round(totalExcelAdvance * 100) / 100,
      isPerfectMatch,
      isMatchedZeroDiff,
    };
  }, [activeClientSheet, clientHeaderRow, clientMapping, clients]);

  const filteredClientRows = useMemo(() => {
    if (!clientComparison) return [];
    const q = normalizeText(clientSearch);
    return clientComparison.rows.filter((r) => {
      if (clientFilter !== 'all' && r.status !== clientFilter) return false;
      if (!q) return true;
      return (
        normalizeText(r.dbName).includes(q) ||
        normalizeText(r.excelName).includes(q) ||
        normalizeText(r.code).includes(q)
      );
    });
  }, [clientComparison, clientFilter, clientSearch]);

  // =========================================================================
  // WAREHOUSE COMPARISON ENGINE
  // =========================================================================
  const warehouseComparison = useMemo(() => {
    if (!activeWhSheet || (whMapping.nameCol === '' && whMapping.markCol === '')) {
      return null;
    }

    const dbByMark = new Map<string, WarehouseProduct[]>();
    const dbByFullNorm = new Map<string, WarehouseProduct>();
    const dbByNameNorm = new Map<string, WarehouseProduct>();
    const dbByLooseFull = new Map<string, WarehouseProduct>();
    const dbByLooseName = new Map<string, WarehouseProduct>();

    const resolvedPlans =
      dailyPlans && dailyPlans.length > 0 ? dailyPlans : storageService.getDailyPlans();
    const dbLivePiecesMap = new Map<string, number>();
    const dbTokenCache: Array<{
      product: WarehouseProduct;
      nameTokens: string[];
      fullTokens: string[];
      fullWithMarkTokens: string[];
    }> = [];

    warehouseProducts.forEach((w) => {
      const chron = buildWarehouseProductChronology(
        w,
        resolvedPlans,
        clients,
        undefined,
        warehouseProducts
      );
      dbLivePiecesMap.set(w.id, Math.round((chron ? chron.currentPieces : Number(w.totalPieces) || 0) * 100) / 100);

      const m1 = normalizeLooseKey(w.mark1);
      if (m1) {
        const arr = dbByMark.get(m1) || [];
        arr.push(w);
        dbByMark.set(m1, arr);
      }
      const fullStr = `${w.brand || ''} ${w.name || ''}`.trim();
      const fullDashStr = `${w.brand || ''} - ${w.name || ''}`.trim();
      const fullWithMarkStr = `${w.brand || ''} ${w.name || ''} ${w.mark1 || ''}`.trim();
      const nFull = normalizeText(fullStr);
      const nDash = normalizeText(fullDashStr);
      const nName = normalizeText(w.name);
      if (nFull && !dbByFullNorm.has(nFull)) dbByFullNorm.set(nFull, w);
      if (nDash && !dbByFullNorm.has(nDash)) dbByFullNorm.set(nDash, w);
      if (nName && !dbByNameNorm.has(nName)) dbByNameNorm.set(nName, w);

      const lFull = normalizeLooseKey(fullStr);
      const lName = normalizeLooseKey(w.name);
      if (lFull && !dbByLooseFull.has(lFull)) dbByLooseFull.set(lFull, w);
      if (lName && !dbByLooseName.has(lName)) dbByLooseName.set(lName, w);

      dbTokenCache.push({
        product: w,
        nameTokens: tokenizeProductForMatch(w.name),
        fullTokens: tokenizeProductForMatch(fullStr),
        fullWithMarkTokens: tokenizeProductForMatch(fullWithMarkStr),
      });
    });

    const getDbLivePieces = (w: WarehouseProduct): number => {
      return dbLivePiecesMap.has(w.id)
        ? dbLivePiecesMap.get(w.id)!
        : Math.round((Number(w.totalPieces) || 0) * 100) / 100;
    };

    const matchDbProduct = (
      rawBrand: string,
      rawName: string,
      rawMark: string
    ): WarehouseProduct | undefined => {
      const mKey = normalizeLooseKey(rawMark);
      if (mKey && dbByMark.has(mKey)) {
        const list = dbByMark.get(mKey)!;
        if (list.length === 1) return list[0];
        const byName = list.find(
          (w) => normalizeLooseKey(w.name) === normalizeLooseKey(rawName)
        );
        if (byName) return byName;
      }

      const combined = rawBrand ? `${rawBrand} ${rawName}`.trim() : rawName;
      const nCombined = normalizeText(combined);
      const nName = normalizeText(rawName);
      if (nCombined && dbByFullNorm.has(nCombined)) return dbByFullNorm.get(nCombined);
      if (nName && dbByFullNorm.has(nName)) return dbByFullNorm.get(nName);
      if (nName && dbByNameNorm.has(nName)) return dbByNameNorm.get(nName);

      // Strip leading "Brand - " or "Brand — " if present in Excel name
      const dashSplit = rawName.split(/\s+[-—–]\s+/);
      const strippedDash = dashSplit.length > 1 ? dashSplit.slice(1).join(' - ').trim() : '';
      if (strippedDash) {
        const nStripped = normalizeText(strippedDash);
        if (dbByNameNorm.has(nStripped)) return dbByNameNorm.get(nStripped);
        const lStripped = normalizeLooseKey(strippedDash);
        if (dbByLooseName.has(lStripped)) return dbByLooseName.get(lStripped);
      }

      const lCombined = normalizeLooseKey(combined);
      const lName = normalizeLooseKey(rawName);
      if (lCombined && dbByLooseFull.has(lCombined)) return dbByLooseFull.get(lCombined);
      if (lName && dbByLooseFull.has(lName)) return dbByLooseFull.get(lName);
      if (lName && dbByLooseName.has(lName)) return dbByLooseName.get(lName);

      // Word-order-independent & apostrophe-insensitive >= 90% token similarity match
      // Handles reversed word order ("seg motol" vs "motol seg") & Uzbek apostrophes ("ozbek" vs "o'zbek")
      const queryTokenSets: string[][] = [];
      const qCombinedTokens = tokenizeProductForMatch(
        rawMark ? `${combined} ${rawMark}` : combined
      );
      if (qCombinedTokens.length > 0) queryTokenSets.push(qCombinedTokens);
      const qNameTokens = tokenizeProductForMatch(rawName);
      if (qNameTokens.length > 0) queryTokenSets.push(qNameTokens);
      if (strippedDash) {
        const qStrippedTokens = tokenizeProductForMatch(strippedDash);
        if (qStrippedTokens.length > 0) queryTokenSets.push(qStrippedTokens);
      }

      if (queryTokenSets.length > 0) {
        let bestProduct: WarehouseProduct | undefined;
        let bestScore = 0;

        for (const item of dbTokenCache) {
          let itemBest = 0;
          for (const qTokens of queryTokenSets) {
            const s1 = computeProductOrderInsensitiveSimilarity(qTokens, item.nameTokens);
            if (s1 > itemBest) itemBest = s1;
            const s2 = computeProductOrderInsensitiveSimilarity(qTokens, item.fullTokens);
            if (s2 > itemBest) itemBest = s2;
            if (item.fullWithMarkTokens.length > item.fullTokens.length) {
              const s3 = computeProductOrderInsensitiveSimilarity(qTokens, item.fullWithMarkTokens);
              if (s3 > itemBest) itemBest = s3;
            }
          }
          if (itemBest >= 0.9 && itemBest > bestScore) {
            bestScore = itemBest;
            bestProduct = item.product;
          }
        }

        if (bestProduct) {
          return bestProduct;
        }
      }

      // Unique substring match when name is descriptive enough (and specs don't conflict)
      if (lName.length >= 6) {
        const candidates = warehouseProducts.filter((w) => {
          const wLoose = normalizeLooseKey(`${w.brand || ''} ${w.name || ''}`);
          const wNameLoose = normalizeLooseKey(w.name);
          if (
            !(
              wLoose.includes(lName) ||
              wNameLoose.includes(lName) ||
              (wNameLoose.length >= 6 && lName.includes(wNameLoose))
            )
          ) {
            return false;
          }
          return !hasConflictingCriticalSpecs(
            qNameTokens,
            tokenizeProductForMatch(`${w.brand || ''} ${w.name || ''}`)
          );
        });
        if (candidates.length === 1) return candidates[0];
      }

      return undefined;
    };

    const getDbProductValue = (w: WarehouseProduct): number => {
      const pieces = getDbLivePieces(w);
      const pkgCount = Math.max(1, Number(w.piecesPerPackage) || 1);
      const basePrice = Number(w.price || w.minSellingPrice || 0);
      const unitPrice =
        w.pricingUnitType === 'package' ? basePrice / pkgCount : basePrice;
      return Math.round(pieces * unitPrice * 100) / 100;
    };

    const hasExcelValueCol = whMapping.sumCol !== '';
    const excelAggMap = new Map<
      string,
      {
        dbProduct?: WarehouseProduct;
        brand: string;
        excelName: string;
        mark: string;
        excelQty: number;
        excelValue: number;
        rowCount: number;
      }
    >();

    const startRow = whHeaderRow + 1;
    for (let r = startRow; r < activeWhSheet.grid.length; r++) {
      const row = activeWhSheet.grid[r] || [];
      const rawBrand = whMapping.brandCol !== '' ? (row[whMapping.brandCol] || '').trim() : '';
      const rawName = whMapping.nameCol !== '' ? (row[whMapping.nameCol] || '').trim() : '';
      const rawMark = whMapping.markCol !== '' ? (row[whMapping.markCol] || '').trim() : '';

      if (!rawName && !rawMark) continue;
      if (isSummaryRowText(rawName) || isSummaryRowText(rawBrand)) continue;

      const rawQtyStr = whMapping.qtyCol !== '' ? row[whMapping.qtyCol] || '' : '';
      const rawSumStr = whMapping.sumCol !== '' ? row[whMapping.sumCol] || '' : '';
      const rowQty = parseSignedExcelNumber(rawQtyStr);
      const rowVal = hasExcelValueCol ? parseSignedExcelNumber(rawSumStr) : 0;

      const matched = matchDbProduct(rawBrand, rawName, rawMark);
      // Convert package quantity to pieces if user selected package mode
      const effectiveQty =
        whMapping.qtyUnitMode === 'package' && matched && matched.piecesPerPackage && matched.piecesPerPackage > 1
          ? Math.round(rowQty * matched.piecesPerPackage * 100) / 100
          : rowQty;

      const aggKey = matched
        ? `db:${matched.id}`
        : `ex:${normalizeLooseKey(`${rawBrand}_${rawName}_${rawMark}`) || `row_${r}`}`;

      const prev = excelAggMap.get(aggKey);
      if (prev) {
        prev.excelQty = Math.round((prev.excelQty + effectiveQty) * 100) / 100;
        prev.excelValue = Math.round((prev.excelValue + rowVal) * 100) / 100;
        prev.rowCount += 1;
      } else {
        excelAggMap.set(aggKey, {
          dbProduct: matched,
          brand: rawBrand || matched?.brand || '',
          excelName: rawName || rawMark,
          mark: rawMark || matched?.mark1 || '',
          excelQty: Math.round(effectiveQty * 100) / 100,
          excelValue: Math.round(rowVal * 100) / 100,
          rowCount: 1,
        });
      }
    }

    const rows: WarehouseComparisonRow[] = [];
    const matchedDbIds = new Set<string>();

    excelAggMap.forEach((entry, aggKey) => {
      if (entry.dbProduct) {
        matchedDbIds.add(entry.dbProduct.id);
        const dbQty = getDbLivePieces(entry.dbProduct);
        const qtyDiff = Math.round((entry.excelQty - dbQty) * 100) / 100;
        const dbValue = getDbProductValue(entry.dbProduct);
        const valueDiff = hasExcelValueCol
          ? Math.round((entry.excelValue - dbValue) * 100) / 100
          : 0;
        const isMatch = Math.abs(qtyDiff) <= 0.01;

        rows.push({
          key: aggKey,
          status: isMatch ? 'match' : 'diff',
          brand: entry.dbProduct.brand || entry.brand,
          dbName: entry.dbProduct.name,
          excelName: entry.excelName,
          mark: entry.dbProduct.mark1 || entry.mark,
          unitLabel: entry.dbProduct.pieceUnitName || 'dona',
          dbQty,
          excelQty: entry.excelQty,
          qtyDiff: Math.abs(qtyDiff) <= 0.01 ? 0 : qtyDiff,
          dbValue,
          excelValue: entry.excelValue,
          valueDiff: Math.abs(valueDiff) <= 0.05 ? 0 : valueDiff,
          hasExcelValue: hasExcelValueCol,
          excelRowCount: entry.rowCount,
        });
      } else {
        rows.push({
          key: aggKey,
          status: 'only_excel',
          brand: entry.brand,
          dbName: '',
          excelName: entry.excelName,
          mark: entry.mark,
          unitLabel: whMapping.qtyUnitMode === 'package' ? 'qadoq' : 'dona',
          dbQty: 0,
          excelQty: entry.excelQty,
          qtyDiff: entry.excelQty,
          dbValue: 0,
          excelValue: entry.excelValue,
          valueDiff: entry.excelValue,
          hasExcelValue: hasExcelValueCol,
          excelRowCount: entry.rowCount,
        });
      }
    });

    warehouseProducts.forEach((w) => {
      if (matchedDbIds.has(w.id)) return;
      const dbQty = getDbLivePieces(w);
      const dbValue = getDbProductValue(w);
      rows.push({
        key: `only_db:${w.id}`,
        status: 'only_db',
        brand: w.brand || '',
        dbName: w.name,
        excelName: '',
        mark: w.mark1 || '',
        unitLabel: w.pieceUnitName || 'dona',
        dbQty,
        excelQty: 0,
        qtyDiff: Math.round(-dbQty * 100) / 100,
        dbValue,
        excelValue: 0,
        valueDiff: hasExcelValueCol ? Math.round(-dbValue * 100) / 100 : 0,
        hasExcelValue: hasExcelValueCol,
        excelRowCount: 0,
      });
    });

    const statusOrder: Record<WarehouseComparisonRow['status'], number> = {
      diff: 0,
      only_excel: 1,
      only_db: 2,
      match: 3,
    };
    rows.sort((a, b) => {
      const sCmp = statusOrder[a.status] - statusOrder[b.status];
      if (sCmp !== 0) return sCmp;
      if (a.status === 'diff') {
        const diffCmp = Math.abs(b.qtyDiff) - Math.abs(a.qtyDiff);
        if (diffCmp !== 0) return diffCmp;
      }
      return (a.dbName || a.excelName).localeCompare(b.dbName || b.excelName);
    });

    let matchCount = 0;
    let diffCount = 0;
    let onlyExcelCount = 0;
    let onlyDbCount = 0;
    let totalDbQty = 0;
    let totalExcelQty = 0;

    rows.forEach((r) => {
      if (r.status === 'match') matchCount++;
      else if (r.status === 'diff') diffCount++;
      else if (r.status === 'only_excel') onlyExcelCount++;
      else if (r.status === 'only_db') onlyDbCount++;
      totalDbQty += r.dbQty;
      totalExcelQty += r.excelQty;
    });

    const isPerfectMatch = diffCount === 0 && onlyExcelCount === 0 && onlyDbCount === 0 && matchCount > 0;
    const isMatchedZeroDiff = diffCount === 0 && matchCount > 0;

    return {
      rows,
      matchCount,
      diffCount,
      onlyExcelCount,
      onlyDbCount,
      totalDbQty: Math.round(totalDbQty * 100) / 100,
      totalExcelQty: Math.round(totalExcelQty * 100) / 100,
      hasExcelValueCol,
      isPerfectMatch,
      isMatchedZeroDiff,
    };
  }, [activeWhSheet, whHeaderRow, whMapping, warehouseProducts, clients, dailyPlans]);

  const filteredWhRows = useMemo(() => {
    if (!warehouseComparison) return [];
    const q = normalizeText(whSearch);
    return warehouseComparison.rows.filter((r) => {
      if (whFilter !== 'all' && r.status !== whFilter) return false;
      if (!q) return true;
      return (
        normalizeText(r.dbName).includes(q) ||
        normalizeText(r.excelName).includes(q) ||
        normalizeText(r.brand).includes(q) ||
        normalizeText(r.mark).includes(q)
      );
    });
  }, [warehouseComparison, whFilter, whSearch]);

  // Export comparison report to .xlsx
  const handleExportReport = async (mode: CompareTab) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(
      mode === 'clients' ? 'Mijozlar taqqoslash' : 'Ombor taqqoslash'
    );

    const statusText = (s: 'match' | 'diff' | 'only_excel' | 'only_db') => {
      if (s === 'match') return "Farqi yo'q";
      if (s === 'diff') return 'Farq bor';
      if (s === 'only_excel') return 'Bazadan topilmadi';
      return "Excelda yo'q";
    };

    if (mode === 'clients' && clientComparison) {
      sheet.columns = [
        { header: '№', key: 'num', width: 6 },
        { header: 'Klient kodi', key: 'code', width: 12 },
        { header: 'Baza mijoz nomi', key: 'dbName', width: 34 },
        { header: 'Excel mijoz nomi', key: 'excelName', width: 34 },
        { header: 'Baza qarzi (USD)', key: 'dbDebt', width: 18 },
        { header: 'Excel qarzi (USD)', key: 'excelDebt', width: 18 },
        { header: 'Qarz farqi (Excel - Baza)', key: 'debtDiff', width: 22 },
        { header: 'Baza haqdorligi (USD)', key: 'dbAdv', width: 20 },
        { header: 'Excel haqdorligi (USD)', key: 'excelAdv', width: 20 },
        { header: 'Haqdorlik farqi (Excel - Baza)', key: 'advDiff', width: 24 },
        { header: 'Holat', key: 'status', width: 20 },
      ];
      filteredClientRows.forEach((r, idx) => {
        sheet.addRow({
          num: idx + 1,
          code: r.code || '—',
          dbName: r.dbName || '—',
          excelName: r.excelName || '—',
          dbDebt: r.dbDebt,
          excelDebt: r.excelDebt,
          debtDiff: r.debtDiff,
          dbAdv: r.dbAdvance,
          excelAdv: r.excelAdvance,
          advDiff: r.advanceDiff,
          status: statusText(r.status),
        });
      });
    } else if (mode === 'warehouse' && warehouseComparison) {
      sheet.columns = [
        { header: '№', key: 'num', width: 6 },
        { header: 'Brend', key: 'brand', width: 16 },
        { header: 'Baza mahsulot nomi', key: 'dbName', width: 36 },
        { header: 'Excel mahsulot nomi', key: 'excelName', width: 36 },
        { header: 'Marka / Kod', key: 'mark', width: 18 },
        { header: 'Birlik', key: 'unit', width: 10 },
        { header: "Baza qoldig'i", key: 'dbQty', width: 16 },
        { header: "Excel qoldig'i", key: 'excelQty', width: 16 },
        { header: 'Qoldiq farqi (Excel - Baza)', key: 'qtyDiff', width: 24 },
        { header: 'Holat', key: 'status', width: 20 },
      ];
      filteredWhRows.forEach((r, idx) => {
        sheet.addRow({
          num: idx + 1,
          brand: r.brand || '—',
          dbName: r.dbName || '—',
          excelName: r.excelName || '—',
          mark: r.mark || '—',
          unit: r.unitLabel,
          dbQty: r.dbQty,
          excelQty: r.excelQty,
          qtyDiff: r.qtyDiff,
          status: statusText(r.status),
        });
      });
    } else {
      return;
    }

    // Apply crisp borders and header styling
    sheet.eachRow((row, rowNum) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF1F2937' } },
          left: { style: 'thin', color: { argb: 'FF1F2937' } },
          bottom: { style: 'thin', color: { argb: 'FF1F2937' } },
          right: { style: 'thin', color: { argb: 'FF1F2937' } },
        };
        if (rowNum === 1) {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } };
        }
      });
    });

    const today = new Date().toISOString().slice(0, 10);
    const fileName =
      mode === 'clients'
        ? `mijozlar_taqqoslash_${today}.xlsx`
        : `ombor_taqqoslash_${today}.xlsx`;

    try {
      const buf = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Fallback to SheetJS export
      const aoa: (string | number)[][] = [];
      if (mode === 'clients' && clientComparison) {
        aoa.push([
          '№',
          'Klient kodi',
          'Baza mijoz nomi',
          'Excel mijoz nomi',
          'Baza qarzi (USD)',
          'Excel qarzi (USD)',
          'Qarz farqi (Excel - Baza)',
          'Baza haqdorligi (USD)',
          'Excel haqdorligi (USD)',
          'Haqdorlik farqi (Excel - Baza)',
          'Holat',
        ]);
        filteredClientRows.forEach((r, idx) => {
          aoa.push([
            idx + 1,
            r.code || '—',
            r.dbName || '—',
            r.excelName || '—',
            r.dbDebt,
            r.excelDebt,
            r.debtDiff,
            r.dbAdvance,
            r.excelAdvance,
            r.advanceDiff,
            statusText(r.status),
          ]);
        });
      } else if (mode === 'warehouse' && warehouseComparison) {
        aoa.push([
          '№',
          'Brend',
          'Baza mahsulot nomi',
          'Excel mahsulot nomi',
          'Marka / Kod',
          'Birlik',
          "Baza qoldig'i",
          "Excel qoldig'i",
          'Qoldiq farqi (Excel - Baza)',
          'Holat',
        ]);
        filteredWhRows.forEach((r, idx) => {
          aoa.push([
            idx + 1,
            r.brand || '—',
            r.dbName || '—',
            r.excelName || '—',
            r.mark || '—',
            r.unitLabel,
            r.dbQty,
            r.excelQty,
            r.qtyDiff,
            statusText(r.status),
          ]);
        });
      }
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        wb,
        ws,
        mode === 'clients' ? 'Mijozlar taqqoslash' : 'Ombor taqqoslash'
      );
      XLSX.writeFile(wb, fileName);
    }
  };

  const renderStatusText = (status: 'match' | 'diff' | 'only_excel' | 'only_db') => {
    if (status === 'match') {
      return (
        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-xs whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>Farqi yo&apos;q</span>
        </span>
      );
    }
    if (status === 'diff') {
      return (
        <span className="inline-flex items-center gap-1 text-rose-700 font-bold text-xs whitespace-nowrap">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>Farq bor</span>
        </span>
      );
    }
    if (status === 'only_excel') {
      return (
        <span className="text-amber-700 font-bold text-xs whitespace-nowrap">
          Bazadan topilmadi
        </span>
      );
    }
    return (
      <span className="text-neutral-600 font-semibold text-xs whitespace-nowrap">
        Excelda yo&apos;q
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* Hidden File Inputs (.xlsx, .xls, .xlsm, .xlsb, .csv, .ods) */}
      <input
        ref={clientInputRef}
        type="file"
        accept=".xlsx,.xls,.xlsm,.xlsb,.csv,.ods,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden"
        onChange={(e) => handleClientFileUpload(e.target.files?.[0])}
      />
      <input
        ref={whInputRef}
        type="file"
        accept=".xlsx,.xls,.xlsm,.xlsb,.csv,.ods,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden"
        onChange={(e) => handleWarehouseFileUpload(e.target.files?.[0])}
      />

      {/* Two Primary Action Buttons requested by user */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => {
            setActiveTab('clients');
            if (!clientFileName) {
              clientInputRef.current?.click();
            }
          }}
          className={`flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl border text-left transition cursor-pointer min-h-[56px] ${
            activeTab === 'clients'
              ? 'bg-rose-700 text-white border-rose-700 shadow-xs'
              : 'bg-white text-neutral-900 border-neutral-200 hover:border-rose-300 hover:bg-rose-50/40'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                activeTab === 'clients'
                  ? 'bg-white/15 text-white'
                  : 'bg-rose-50 text-rose-700'
              }`}
            >
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold leading-snug">
                Mijozlar qarzdorligini tekshirish
              </div>
              <div
                className={`text-xs truncate mt-0.5 ${
                  activeTab === 'clients' ? 'text-rose-100' : 'text-neutral-500'
                }`}
              >
                {clientFileName
                  ? `Yuklangan: ${clientFileName}`
                  : `Bazadagi ${clients.length} ta mijoz bilan .xlsx taqqoslash`}
              </div>
            </div>
          </div>
          <FileSpreadsheet
            className={`w-5 h-5 shrink-0 ${
              activeTab === 'clients' ? 'text-rose-100' : 'text-neutral-400'
            }`}
          />
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('warehouse');
            if (!whFileName) {
              whInputRef.current?.click();
            }
          }}
          className={`flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl border text-left transition cursor-pointer min-h-[56px] ${
            activeTab === 'warehouse'
              ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
              : 'bg-white text-neutral-900 border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                activeTab === 'warehouse'
                  ? 'bg-white/15 text-white'
                  : 'bg-neutral-100 text-neutral-700'
              }`}
            >
              <Warehouse className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold leading-snug">Ombor tekshirish</div>
              <div
                className={`text-xs truncate mt-0.5 ${
                  activeTab === 'warehouse' ? 'text-neutral-300' : 'text-neutral-500'
                }`}
              >
                {whFileName
                  ? `Yuklangan: ${whFileName}`
                  : `Bazadagi ${warehouseProducts.length} xil mahsulot bilan .xlsx taqqoslash`}
              </div>
            </div>
          </div>
          <FileSpreadsheet
            className={`w-5 h-5 shrink-0 ${
              activeTab === 'warehouse' ? 'text-neutral-300' : 'text-neutral-400'
            }`}
          />
        </button>
      </div>

      {/* ================================================================= */}
      {/* TAB 1: MIJOZLAR QARZDORLIGINI TEKSHIRISH                          */}
      {/* ================================================================= */}
      {activeTab === 'clients' && (
        <div className="space-y-4">
          {clientError && (
            <div className="flex items-center gap-2 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{clientError}</span>
            </div>
          )}

          {/* Upload Area / Uploaded File Bar */}
          {!activeClientSheet ? (
            <div className="border border-dashed border-neutral-300 rounded-2xl p-6 sm:p-8 bg-neutral-50/70 text-center space-y-3">
              <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center mx-auto border border-rose-100">
                <Upload className="w-5 h-5" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-sm font-bold text-neutral-900">
                  Mijozlar qarzdorligi Excel (.xlsx) faylini yuklang
                </h3>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  Fayldagi mijozlar ro&apos;yxati, qarzdorlik va haqdorlik qiymatlari bazadagi{' '}
                  <span className="font-mono font-semibold text-neutral-900">{clients.length}</span>{' '}
                  ta mijoz bilan avtomatik taqqoslanadi.
                </p>
              </div>
              <div>
                <button
                  type="button"
                  disabled={clientLoading}
                  onClick={() => clientInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs sm:text-sm font-bold shadow-xs transition min-h-[44px] cursor-pointer disabled:opacity-60"
                >
                  <Upload className="w-4 h-4" />
                  <span>{clientLoading ? "O'qilmoqda..." : 'Excel (.xlsx) fayl tanlash'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* File Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-200">
                <div className="flex items-center gap-2.5 text-xs text-neutral-600 min-w-0">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span className="font-bold text-neutral-900 truncate max-w-[260px]">
                    {clientFileName}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Varaq: {activeClientSheet.name}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowClientConfig((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-semibold text-neutral-800 transition cursor-pointer min-h-[40px]"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Ustunlarni sozlash</span>
                    {showClientConfig ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => clientInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-xs font-bold text-rose-800 transition cursor-pointer min-h-[40px]"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Boshqa fayl yuklash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportReport('clients')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition cursor-pointer min-h-[40px]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Excel hisobot</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setClientSheets([]);
                      setClientFileName('');
                      setClientError(null);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border border-neutral-200 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 text-xs font-semibold transition cursor-pointer min-h-[40px]"
                    title="Tozalash"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Collapsible Column Mapping Config */}
              {showClientConfig && (
                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  {clientSheets.length > 1 && (
                    <div>
                      <label className="block font-semibold text-neutral-700 mb-1">
                        Excel varag&apos;i (Sheet)
                      </label>
                      <select
                        value={clientSheetIdx}
                        onChange={(e) => {
                          const idx = Number(e.target.value);
                          setClientSheetIdx(idx);
                          const hr = detectHeaderRow(clientSheets[idx].grid, 'clients');
                          setClientHeaderRow(hr);
                          setClientMapping(autoMapClientCols(clientSheets[idx].grid, hr));
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-neutral-300 bg-white text-neutral-900 outline-none"
                      >
                        {clientSheets.map((s, idx) => (
                          <option key={s.name} value={idx}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">
                      Sarlavha qatori
                    </label>
                    <select
                      value={clientHeaderRow}
                      onChange={(e) => {
                        const hr = Number(e.target.value);
                        setClientHeaderRow(hr);
                        setClientMapping(autoMapClientCols(activeClientSheet.grid, hr));
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-300 bg-white text-neutral-900 outline-none"
                    >
                      {activeClientSheet.grid.slice(0, 15).map((r, idx) => (
                        <option key={idx} value={idx}>
                          {idx + 1}-qator: {r.filter(Boolean).slice(0, 3).join(' | ').slice(0, 48)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">
                      Mijoz nomi ustuni
                    </label>
                    <select
                      value={clientMapping.nameCol}
                      onChange={(e) =>
                        setClientMapping((prev) => ({
                          ...prev,
                          nameCol: e.target.value === '' ? '' : Number(e.target.value),
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-neutral-300 bg-white text-neutral-900 outline-none"
                    >
                      <option value="">— Tanlanmagan —</option>
                      {clientColumnOptions.map((o) => (
                        <option key={o.idx} value={o.idx}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">
                      Klient kodi ustuni (ixtiyoriy)
                    </label>
                    <select
                      value={clientMapping.codeCol}
                      onChange={(e) =>
                        setClientMapping((prev) => ({
                          ...prev,
                          codeCol: e.target.value === '' ? '' : Number(e.target.value),
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-neutral-300 bg-white text-neutral-900 outline-none"
                    >
                      <option value="">— Avtomatik (ismdan) —</option>
                      {clientColumnOptions.map((o) => (
                        <option key={o.idx} value={o.idx}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">
                      Qarzdorlik (USD) ustuni
                    </label>
                    <select
                      value={clientMapping.debtCol}
                      onChange={(e) =>
                        setClientMapping((prev) => ({
                          ...prev,
                          debtCol: e.target.value === '' ? '' : Number(e.target.value),
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-neutral-300 bg-white text-neutral-900 outline-none"
                    >
                      <option value="">— Tanlanmagan —</option>
                      {clientColumnOptions.map((o) => (
                        <option key={o.idx} value={o.idx}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">
                      Haqdorlik / Avans ustuni (ixtiyoriy)
                    </label>
                    <select
                      value={clientMapping.advanceCol}
                      onChange={(e) =>
                        setClientMapping((prev) => ({
                          ...prev,
                          advanceCol: e.target.value === '' ? '' : Number(e.target.value),
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-neutral-300 bg-white text-neutral-900 outline-none"
                    >
                      <option value="">— Yo&apos;q (manfiy qarz = haqdorlik) —</option>
                      {clientColumnOptions.map((o) => (
                        <option key={o.idx} value={o.idx}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Comparison Result Summary */}
              {clientComparison && (
                <>
                  {clientComparison.isPerfectMatch ? (
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
                      <CheckCircle2 className="w-6 h-6 text-emerald-700 shrink-0" />
                      <div>
                        <div className="text-sm font-bold text-emerald-950">
                          Farqi yo&apos;q — Excel va bazadagi barcha mijozlar to&apos;liq mos keladi
                        </div>
                        <div className="text-xs text-emerald-800 mt-0.5">
                          Jami {clientComparison.matchCount} ta mijoz tekshirildi. Qarzdorlik va
                          haqdorlik bo&apos;yicha hech qanday tafovut aniqlanmadi.
                        </div>
                      </div>
                    </div>
                  ) : clientComparison.isMatchedZeroDiff ? (
                    <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                      <div>
                        <div className="text-sm font-bold text-emerald-950">
                          Mos topilgan {clientComparison.matchCount} ta mijozda farqi yo&apos;q
                        </div>
                        <div className="text-xs text-emerald-800 mt-0.5">
                          {clientComparison.onlyExcelCount > 0 &&
                            `Excelda bor, bazadan topilmagan: ${clientComparison.onlyExcelCount} ta. `}
                          {clientComparison.onlyDbCount > 0 &&
                            `Bazada bor, Excelda yo'q: ${clientComparison.onlyDbCount} ta.`}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0" />
                      <div>
                        <div className="text-sm font-bold text-rose-950">
                          {clientComparison.diffCount} ta mijozda farq aniqlandi
                        </div>
                        <div className="text-xs text-rose-800 mt-0.5">
                          Farqi yo&apos;q: {clientComparison.matchCount} ta · Bazadan topilmadi:{' '}
                          {clientComparison.onlyExcelCount} ta · Excelda yo&apos;q:{' '}
                          {clientComparison.onlyDbCount} ta
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Aggregate Totals Strip */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200">
                      <div className="text-neutral-500 font-medium">Baza jami qarzi</div>
                      <div className="text-base font-bold font-mono tabular-nums text-neutral-900 mt-1">
                        {formatMoney(clientComparison.totalDbDebt)}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200">
                      <div className="text-neutral-500 font-medium">Excel jami qarzi</div>
                      <div className="text-base font-bold font-mono tabular-nums text-neutral-900 mt-1">
                        {formatMoney(clientComparison.totalExcelDebt)}
                      </div>
                      <div
                        className={`text-[11px] font-mono tabular-nums mt-0.5 font-semibold ${
                          Math.abs(clientComparison.totalExcelDebt - clientComparison.totalDbDebt) <=
                          0.05
                            ? 'text-emerald-700'
                            : 'text-rose-700'
                        }`}
                      >
                        Farq:{' '}
                        {Math.abs(clientComparison.totalExcelDebt - clientComparison.totalDbDebt) <=
                        0.05
                          ? "Farqi yo'q"
                          : `${
                              clientComparison.totalExcelDebt - clientComparison.totalDbDebt > 0
                                ? '+'
                                : ''
                            }${formatMoney(
                              clientComparison.totalExcelDebt - clientComparison.totalDbDebt
                            )}`}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200">
                      <div className="text-neutral-500 font-medium">Baza jami haqdorligi</div>
                      <div className="text-base font-bold font-mono tabular-nums text-emerald-800 mt-1">
                        {formatMoney(clientComparison.totalDbAdvance)}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200">
                      <div className="text-neutral-500 font-medium">Excel jami haqdorligi</div>
                      <div className="text-base font-bold font-mono tabular-nums text-emerald-800 mt-1">
                        {formatMoney(clientComparison.totalExcelAdvance)}
                      </div>
                      <div
                        className={`text-[11px] font-mono tabular-nums mt-0.5 font-semibold ${
                          Math.abs(
                            clientComparison.totalExcelAdvance - clientComparison.totalDbAdvance
                          ) <= 0.05
                            ? 'text-emerald-700'
                            : 'text-rose-700'
                        }`}
                      >
                        Farq:{' '}
                        {Math.abs(
                          clientComparison.totalExcelAdvance - clientComparison.totalDbAdvance
                        ) <= 0.05
                          ? "Farqi yo'q"
                          : `${
                              clientComparison.totalExcelAdvance - clientComparison.totalDbAdvance >
                              0
                                ? '+'
                                : ''
                            }${formatMoney(
                              clientComparison.totalExcelAdvance - clientComparison.totalDbAdvance
                            )}`}
                      </div>
                    </div>
                  </div>

                  {/* Filters & Search */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-neutral-100 border border-neutral-200/80">
                      {(
                        [
                          { id: 'all', label: `Barchasi (${clientComparison.rows.length})` },
                          { id: 'diff', label: `Farq bor (${clientComparison.diffCount})` },
                          { id: 'match', label: `Farqi yo'q (${clientComparison.matchCount})` },
                          {
                            id: 'only_excel',
                            label: `Bazadan topilmadi (${clientComparison.onlyExcelCount})`,
                          },
                          {
                            id: 'only_db',
                            label: `Excelda yo'q (${clientComparison.onlyDbCount})`,
                          },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setClientFilter(tab.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                            clientFilter === tab.id
                              ? 'bg-white text-neutral-900 shadow-2xs'
                              : 'text-neutral-600 hover:text-neutral-900'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="relative w-full sm:w-64">
                      <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        placeholder="Mijoz nomi yoki kodi..."
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-neutral-200 focus:border-rose-500 text-xs text-neutral-900 outline-none bg-white"
                      />
                    </div>
                  </div>

                  {/* Results Table */}
                  <div className="rounded-2xl border border-neutral-200 overflow-hidden">
                    <StickyTableWrapper maxHeightClassName="max-h-[520px]">
                      <table className="w-full min-w-[920px] text-left text-xs">
                        <thead className="bg-neutral-900 text-white text-[11px] font-bold sticky top-0 z-10">
                          <tr>
                            <th className="py-3 px-3 w-10 text-center">№</th>
                            <th className="py-3 px-3">Mijoz</th>
                            <th className="py-3 px-3 text-right">Baza qarzi</th>
                            <th className="py-3 px-3 text-right">Excel qarzi</th>
                            <th className="py-3 px-3 text-right">Qarz farqi</th>
                            <th className="py-3 px-3 text-right">Baza haqdorligi</th>
                            <th className="py-3 px-3 text-right">Excel haqdorligi</th>
                            <th className="py-3 px-3 text-right">Haqdorlik farqi</th>
                            <th className="py-3 px-3 text-center">Holat</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200 bg-white">
                          {filteredClientRows.length === 0 ? (
                            <tr>
                              <td
                                colSpan={9}
                                className="py-8 text-center text-neutral-500 text-xs"
                              >
                                Tanlangan filtr bo&apos;yicha yozuv topilmadi.
                              </td>
                            </tr>
                          ) : (
                            filteredClientRows.map((row, idx) => (
                              <tr
                                key={row.key}
                                className={`transition-colors ${
                                  row.status === 'diff'
                                    ? 'bg-rose-50/40 hover:bg-rose-50/70'
                                    : row.status === 'only_excel'
                                    ? 'bg-amber-50/40 hover:bg-amber-50/70'
                                    : 'hover:bg-neutral-50'
                                }`}
                              >
                                <td className="py-2.5 px-3 text-center font-mono text-neutral-500 tabular-nums">
                                  {idx + 1}
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="font-semibold text-neutral-900">
                                    {row.dbName || row.excelName}
                                  </div>
                                  {row.dbName &&
                                    row.excelName &&
                                    normalizeText(row.dbName) !== normalizeText(row.excelName) && (
                                      <div className="text-[11px] text-neutral-500 mt-0.5">
                                        Excel: {row.excelName}
                                      </div>
                                    )}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-neutral-900">
                                  {formatMoney(row.dbDebt)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-neutral-900">
                                  {row.status === 'only_db' ? '—' : formatMoney(row.excelDebt)}
                                </td>
                                <td
                                  className={`py-2.5 px-3 text-right font-mono tabular-nums font-bold ${
                                    row.debtDiff === 0
                                      ? 'text-emerald-700'
                                      : row.debtDiff > 0
                                      ? 'text-rose-700'
                                      : 'text-amber-700'
                                  }`}
                                >
                                  {row.status === 'match' || row.debtDiff === 0
                                    ? "Farqi yo'q"
                                    : `${row.debtDiff > 0 ? '+' : ''}${formatMoney(row.debtDiff)}`}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-800">
                                  {formatMoney(row.dbAdvance)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-800">
                                  {row.status === 'only_db' ? '—' : formatMoney(row.excelAdvance)}
                                </td>
                                <td
                                  className={`py-2.5 px-3 text-right font-mono tabular-nums font-bold ${
                                    row.advanceDiff === 0
                                      ? 'text-emerald-700'
                                      : 'text-rose-700'
                                  }`}
                                >
                                  {row.status === 'match' || row.advanceDiff === 0
                                    ? "Farqi yo'q"
                                    : `${row.advanceDiff > 0 ? '+' : ''}${formatMoney(
                                        row.advanceDiff
                                      )}`}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {renderStatusText(row.status)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </StickyTableWrapper>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 2: OMBOR TEKSHIRISH                                           */}
      {/* ================================================================= */}
      {activeTab === 'warehouse' && (
        <div className="space-y-4">
          {whError && (
            <div className="flex items-center gap-2 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{whError}</span>
            </div>
          )}

          {!activeWhSheet ? (
            <div className="border border-dashed border-neutral-300 rounded-2xl p-6 sm:p-8 bg-neutral-50/70 text-center space-y-3">
              <div className="w-11 h-11 rounded-xl bg-neutral-900 text-white flex items-center justify-center mx-auto">
                <Upload className="w-5 h-5" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-sm font-bold text-neutral-900">
                  Ombor hisobi Excel (.xlsx) faylini yuklang
                </h3>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  Fayldagi mahsulotlar va qoldiq sonlari bazadagi{' '}
                  <span className="font-mono font-semibold text-neutral-900">
                    {warehouseProducts.length}
                  </span>{' '}
                  xil ombor mahsuloti bilan avtomatik taqqoslanadi.
                </p>
              </div>
              <div>
                <button
                  type="button"
                  disabled={whLoading}
                  onClick={() => whInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs sm:text-sm font-bold shadow-xs transition min-h-[44px] cursor-pointer disabled:opacity-60"
                >
                  <Upload className="w-4 h-4" />
                  <span>{whLoading ? "O'qilmoqda..." : 'Excel (.xlsx) fayl tanlash'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* File Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-200">
                <div className="flex items-center gap-2.5 text-xs text-neutral-600 min-w-0">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span className="font-bold text-neutral-900 truncate max-w-[260px]">
                    {whFileName}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Varaq: {activeWhSheet.name}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowWhConfig((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-semibold text-neutral-800 transition cursor-pointer min-h-[40px]"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Ustunlarni sozlash</span>
                    {showWhConfig ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => whInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-300 bg-neutral-100 hover:bg-neutral-200 text-xs font-bold text-neutral-900 transition cursor-pointer min-h-[40px]"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Boshqa fayl yuklash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportReport('warehouse')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition cursor-pointer min-h-[40px]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Excel hisobot</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setWhSheets([]);
                      setWhFileName('');
                      setWhError(null);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border border-neutral-200 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 text-xs font-semibold transition cursor-pointer min-h-[40px]"
                    title="Tozalash"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Collapsible Warehouse Column Config */}
              {showWhConfig && (
                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  {whSheets.length > 1 && (
                    <div>
                      <label className="block font-semibold text-neutral-700 mb-1">
                        Excel varag&apos;i (Sheet)
                      </label>
                      <select
                        value={whSheetIdx}
                        onChange={(e) => {
                          const idx = Number(e.target.value);
                          setWhSheetIdx(idx);
                          const hr = detectHeaderRow(whSheets[idx].grid, 'warehouse');
                          setWhHeaderRow(hr);
                          setWhMapping(autoMapWarehouseCols(whSheets[idx].grid, hr));
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-neutral-300 bg-white text-neutral-900 outline-none"
                      >
                        {whSheets.map((s, idx) => (
                          <option key={s.name} value={idx}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">
                      Sarlavha qatori
                    </label>
                    <select
                      value={whHeaderRow}
                      onChange={(e) => {
                        const hr = Number(e.target.value);
                        setWhHeaderRow(hr);
                        setWhMapping(autoMapWarehouseCols(activeWhSheet.grid, hr));
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-300 bg-white text-neutral-900 outline-none"
                    >
                      {activeWhSheet.grid.slice(0, 15).map((r, idx) => (
                        <option key={idx} value={idx}>
                          {idx + 1}-qator: {r.filter(Boolean).slice(0, 3).join(' | ').slice(0, 48)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">
                      Mahsulot nomi ustuni
                    </label>
                    <select
                      value={whMapping.nameCol}
                      onChange={(e) =>
                        setWhMapping((prev) => ({
                          ...prev,
                          nameCol: e.target.value === '' ? '' : Number(e.target.value),
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-neutral-300 bg-white text-neutral-900 outline-none"
                    >
                      <option value="">— Tanlanmagan —</option>
                      {whColumnOptions.map((o) => (
                        <option key={o.idx} value={o.idx}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">
                      Brend ustuni (ixtiyoriy)
                    </label>
                    <select
                      value={whMapping.brandCol}
                      onChange={(e) =>
                        setWhMapping((prev) => ({
                          ...prev,
                          brandCol: e.target.value === '' ? '' : Number(e.target.value),
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-neutral-300 bg-white text-neutral-900 outline-none"
                    >
                      <option value="">— Tanlanmagan —</option>
                      {whColumnOptions.map((o) => (
                        <option key={o.idx} value={o.idx}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">
                      Marka / Artikul ustuni (ixtiyoriy)
                    </label>
                    <select
                      value={whMapping.markCol}
                      onChange={(e) =>
                        setWhMapping((prev) => ({
                          ...prev,
                          markCol: e.target.value === '' ? '' : Number(e.target.value),
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-neutral-300 bg-white text-neutral-900 outline-none"
                    >
                      <option value="">— Tanlanmagan —</option>
                      {whColumnOptions.map((o) => (
                        <option key={o.idx} value={o.idx}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">
                      Qoldiq (soni) ustuni
                    </label>
                    <select
                      value={whMapping.qtyCol}
                      onChange={(e) =>
                        setWhMapping((prev) => ({
                          ...prev,
                          qtyCol: e.target.value === '' ? '' : Number(e.target.value),
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-neutral-300 bg-white text-neutral-900 outline-none"
                    >
                      <option value="">— Tanlanmagan —</option>
                      {whColumnOptions.map((o) => (
                        <option key={o.idx} value={o.idx}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">
                      Exceldagi qoldiq birligi
                    </label>
                    <select
                      value={whMapping.qtyUnitMode}
                      onChange={(e) =>
                        setWhMapping((prev) => ({
                          ...prev,
                          qtyUnitMode: e.target.value as 'piece' | 'package',
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-neutral-300 bg-white text-neutral-900 outline-none"
                    >
                      <option value="piece">Dona (asosiy birlik)</option>
                      <option value="package">Qadoq / Korobka (donaga ko&apos;paytirish)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">
                      Qiymat / Summa ustuni (ixtiyoriy)
                    </label>
                    <select
                      value={whMapping.sumCol}
                      onChange={(e) =>
                        setWhMapping((prev) => ({
                          ...prev,
                          sumCol: e.target.value === '' ? '' : Number(e.target.value),
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-neutral-300 bg-white text-neutral-900 outline-none"
                    >
                      <option value="">— Faqat soni bo&apos;yicha —</option>
                      {whColumnOptions.map((o) => (
                        <option key={o.idx} value={o.idx}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Warehouse Comparison Result Summary */}
              {warehouseComparison && (
                <>
                  {warehouseComparison.isPerfectMatch ? (
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
                      <CheckCircle2 className="w-6 h-6 text-emerald-700 shrink-0" />
                      <div>
                        <div className="text-sm font-bold text-emerald-950">
                          Farqi yo&apos;q — Excel va bazadagi barcha ombor mahsulotlari to&apos;liq mos keladi
                        </div>
                        <div className="text-xs text-emerald-800 mt-0.5">
                          Jami {warehouseComparison.matchCount} xil mahsulot tekshirildi. Qoldiq
                          bo&apos;yicha hech qanday farq topilmadi.
                        </div>
                      </div>
                    </div>
                  ) : warehouseComparison.isMatchedZeroDiff ? (
                    <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                      <div>
                        <div className="text-sm font-bold text-emerald-950">
                          Mos topilgan {warehouseComparison.matchCount} xil mahsulotda farqi yo&apos;q
                        </div>
                        <div className="text-xs text-emerald-800 mt-0.5">
                          {warehouseComparison.onlyExcelCount > 0 &&
                            `Excelda bor, bazadan topilmagan: ${warehouseComparison.onlyExcelCount} xil. `}
                          {warehouseComparison.onlyDbCount > 0 &&
                            `Bazada bor, Excelda yo'q: ${warehouseComparison.onlyDbCount} xil.`}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0" />
                      <div>
                        <div className="text-sm font-bold text-rose-950">
                          {warehouseComparison.diffCount} xil mahsulotda qoldiq farqi aniqlandi
                        </div>
                        <div className="text-xs text-rose-800 mt-0.5">
                          Farqi yo&apos;q: {warehouseComparison.matchCount} xil · Bazadan topilmadi:{' '}
                          {warehouseComparison.onlyExcelCount} xil · Excelda yo&apos;q:{' '}
                          {warehouseComparison.onlyDbCount} xil
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Warehouse Totals Strip */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200">
                      <div className="text-neutral-500 font-medium">Baza jami qoldig&apos;i</div>
                      <div className="text-base font-bold font-mono tabular-nums text-neutral-900 mt-1">
                        {formatNumber(warehouseComparison.totalDbQty)} dona
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200">
                      <div className="text-neutral-500 font-medium">Excel jami qoldig&apos;i</div>
                      <div className="text-base font-bold font-mono tabular-nums text-neutral-900 mt-1">
                        {formatNumber(warehouseComparison.totalExcelQty)} dona
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200">
                      <div className="text-neutral-500 font-medium">Umumiy farq (Excel − Baza)</div>
                      <div
                        className={`text-base font-bold font-mono tabular-nums mt-1 ${
                          Math.abs(
                            warehouseComparison.totalExcelQty - warehouseComparison.totalDbQty
                          ) <= 0.01
                            ? 'text-emerald-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {Math.abs(
                          warehouseComparison.totalExcelQty - warehouseComparison.totalDbQty
                        ) <= 0.01
                          ? "Farqi yo'q"
                          : `${
                              warehouseComparison.totalExcelQty - warehouseComparison.totalDbQty > 0
                                ? '+'
                                : ''
                            }${formatNumber(
                              Math.round(
                                (warehouseComparison.totalExcelQty -
                                  warehouseComparison.totalDbQty) *
                                  100
                              ) / 100
                            )} dona`}
                      </div>
                    </div>
                  </div>

                  {/* Filters & Search */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-neutral-100 border border-neutral-200/80">
                      {(
                        [
                          { id: 'all', label: `Barchasi (${warehouseComparison.rows.length})` },
                          { id: 'diff', label: `Farq bor (${warehouseComparison.diffCount})` },
                          {
                            id: 'match',
                            label: `Farqi yo'q (${warehouseComparison.matchCount})`,
                          },
                          {
                            id: 'only_excel',
                            label: `Bazadan topilmadi (${warehouseComparison.onlyExcelCount})`,
                          },
                          {
                            id: 'only_db',
                            label: `Excelda yo'q (${warehouseComparison.onlyDbCount})`,
                          },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setWhFilter(tab.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                            whFilter === tab.id
                              ? 'bg-white text-neutral-900 shadow-2xs'
                              : 'text-neutral-600 hover:text-neutral-900'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="relative w-full sm:w-64">
                      <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={whSearch}
                        onChange={(e) => setWhSearch(e.target.value)}
                        placeholder="Mahsulot nomi, brend, marka..."
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-neutral-200 focus:border-neutral-900 text-xs text-neutral-900 outline-none bg-white"
                      />
                    </div>
                  </div>

                  {/* Warehouse Results Table */}
                  <div className="rounded-2xl border border-neutral-200 overflow-hidden">
                    <StickyTableWrapper maxHeightClassName="max-h-[520px]">
                      <table className="w-full min-w-[780px] text-left text-xs">
                        <thead className="bg-neutral-900 text-white text-[11px] font-bold sticky top-0 z-10">
                          <tr>
                            <th className="py-3 px-3 w-10 text-center">№</th>
                            <th className="py-3 px-3">Mahsulot</th>
                            <th className="py-3 px-3 text-right">Baza qoldig&apos;i</th>
                            <th className="py-3 px-3 text-right">Excel qoldig&apos;i</th>
                            <th className="py-3 px-3 text-right">Qoldiq farqi</th>
                            {warehouseComparison.hasExcelValueCol && (
                              <>
                                <th className="py-3 px-3 text-right">Baza qiymati</th>
                                <th className="py-3 px-3 text-right">Excel qiymati</th>
                                <th className="py-3 px-3 text-right">Qiymat farqi</th>
                              </>
                            )}
                            <th className="py-3 px-3 text-center">Holat</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200 bg-white">
                          {filteredWhRows.length === 0 ? (
                            <tr>
                              <td
                                colSpan={warehouseComparison.hasExcelValueCol ? 9 : 6}
                                className="py-8 text-center text-neutral-500 text-xs"
                              >
                                Tanlangan filtr bo&apos;yicha mahsulot topilmadi.
                              </td>
                            </tr>
                          ) : (
                            filteredWhRows.map((row, idx) => (
                              <tr
                                key={row.key}
                                className={`transition-colors ${
                                  row.status === 'diff'
                                    ? 'bg-rose-50/40 hover:bg-rose-50/70'
                                    : row.status === 'only_excel'
                                    ? 'bg-amber-50/40 hover:bg-amber-50/70'
                                    : 'hover:bg-neutral-50'
                                }`}
                              >
                                <td className="py-2.5 px-3 text-center font-mono text-neutral-500 tabular-nums">
                                  {idx + 1}
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="font-semibold text-neutral-900">
                                    {row.brand ? `${row.brand} — ` : ''}
                                    {row.dbName || row.excelName}
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-0.5">
                                    {row.mark && <span>Marka: {row.mark}</span>}
                                    {row.dbName &&
                                      row.excelName &&
                                      normalizeText(row.dbName) !== normalizeText(row.excelName) && (
                                        <span>Excel: {row.excelName}</span>
                                      )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-neutral-900 whitespace-nowrap">
                                  {row.status === 'only_excel'
                                    ? '—'
                                    : `${formatNumber(row.dbQty)} ${row.unitLabel}`}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-neutral-900 whitespace-nowrap">
                                  {row.status === 'only_db'
                                    ? '—'
                                    : `${formatNumber(row.excelQty)} ${row.unitLabel}`}
                                </td>
                                <td
                                  className={`py-2.5 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap ${
                                    row.qtyDiff === 0
                                      ? 'text-emerald-700'
                                      : row.qtyDiff > 0
                                      ? 'text-rose-700'
                                      : 'text-amber-700'
                                  }`}
                                >
                                  {row.status === 'match' || row.qtyDiff === 0
                                    ? "Farqi yo'q"
                                    : `${row.qtyDiff > 0 ? '+' : ''}${formatNumber(row.qtyDiff)} ${
                                        row.unitLabel
                                      }`}
                                </td>
                                {warehouseComparison.hasExcelValueCol && (
                                  <>
                                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-neutral-900 whitespace-nowrap">
                                      {row.status === 'only_excel'
                                        ? '—'
                                        : formatMoney(row.dbValue)}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-neutral-900 whitespace-nowrap">
                                      {row.status === 'only_db'
                                        ? '—'
                                        : formatMoney(row.excelValue)}
                                    </td>
                                    <td
                                      className={`py-2.5 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap ${
                                        row.valueDiff === 0
                                          ? 'text-emerald-700'
                                          : 'text-rose-700'
                                      }`}
                                    >
                                      {row.valueDiff === 0
                                        ? "Farqi yo'q"
                                        : `${row.valueDiff > 0 ? '+' : ''}${formatMoney(
                                            row.valueDiff
                                          )}`}
                                    </td>
                                  </>
                                )}
                                <td className="py-2.5 px-3 text-center">
                                  {renderStatusText(row.status)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </StickyTableWrapper>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
