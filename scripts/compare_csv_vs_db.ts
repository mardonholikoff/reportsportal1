import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

interface CsvRow {
  clientName: string;
  initialDebt: number;
  increase: number;
  decrease: number;
  finalDebt: number;
}

function parseCsv(filePath: string): CsvRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const rows: CsvRow[] = [];

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    // Skip headers or totals
    if (line.includes('Расчеты с Клиентами') || line.startsWith('Клиент') || line.startsWith('Итого')) {
      continue;
    }
    // Skip main category summary headers
    if (
      line.startsWith('Antifrizlar bo\'yicha klientlar') ||
      line.startsWith('Daewoo moylari va zapchastlari bo\'yicha klientlar') ||
      line.startsWith('Andijondagi klientlar') ||
      line.startsWith('Farg\'onadagi klientlar') ||
      line.startsWith('Toshkentdagi klientlar') ||
      line.startsWith('Voxadagi klientlar') ||
      line.startsWith('Filtrlar (Inomarka avtomobillar) bo\'yicha klientlar') ||
      line.startsWith('SEG Motol va EUROL moylari bo\'yicha klientlar') ||
      line.startsWith('Zapchastlar (Spanice kolodka) bo\'yicha klientlar')
    ) {
      continue;
    }

    // Parse CSV line handling quotes
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        parts.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    parts.push(current);

    if (parts.length < 7) continue;

    const rawName = parts[0].trim().replace(/^"+|"+$/g, '');
    if (!rawName) continue;

    const parseNum = (str: string) => {
      if (!str) return 0;
      const cleaned = str.replace(/"/g, '').replace(/,/g, '').trim();
      return parseFloat(cleaned) || 0;
    };

    const initialDebt = parseNum(parts[3]);
    const increase = parseNum(parts[4]);
    const decrease = parseNum(parts[5]);
    const finalDebt = parseNum(parts[6]);

    rows.push({
      clientName: rawName,
      initialDebt,
      increase,
      decrease,
      finalDebt,
    });
  }

  return rows;
}

async function run() {
  const csvPath = path.join(process.cwd(), 'public/assets/aistudio/_______2__8862b0c0.csv');
  const csvRows = parseCsv(csvPath);
  console.log(`Parsed ${csvRows.length} client rows from CSV.`);

  const snap = await getDocs(collection(db, 'clients'));
  const dbClients = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: (data.name || '').trim(),
      region: (data.region || '').trim(),
      currentDebt: Number(data.currentDebt) || 0,
      currentAdvance: Number(data.currentAdvance) || 0,
    };
  });

  console.log(`Fetched ${dbClients.length} clients from Firestore DB.`);

  // Sum CSV clients
  const csvClientTotalsMap = new Map<string, number>();
  csvRows.forEach((r) => {
    // Standardize key by extracting Client Code if present (e.g. K010, K020, T032, etc.) or normalized name
    csvClientTotalsMap.set(r.clientName, (csvClientTotalsMap.get(r.clientName) || 0) + r.finalDebt);
  });

  console.log('\n=============================================================');
  console.log('CLIENT-BY-CLIENT COMPARISON (CSV FINAL DEBT vs DB CURRENT DEBT)');
  console.log('=============================================================');

  const matchedDbIds = new Set<string>();
  const differences: Array<{
    csvName: string;
    dbName: string;
    csvDebt: number;
    dbDebt: number;
    dbAdvance: number;
    diff: number;
  }> = [];

  // Match CSV clients to DB clients
  csvRows.forEach((csvItem) => {
    // Find matching DB client
    let matched = dbClients.find((dbc) => dbc.name.toLowerCase() === csvItem.clientName.toLowerCase());

    // Try code matching (e.g., K010, K020, T032)
    if (!matched) {
      const codeMatch = csvItem.clientName.match(/^([A-Za-z0-9]+)\b/);
      if (codeMatch) {
        const code = codeMatch[1].toLowerCase();
        matched = dbClients.find((dbc) => dbc.name.toLowerCase().startsWith(code + ' '));
      }
    }

    // Try name substring matching
    if (!matched) {
      const cleanCsvName = csvItem.clientName.replace(/\(.*?\)/g, '').trim().toLowerCase();
      matched = dbClients.find((dbc) => {
        const cleanDbName = dbc.name.replace(/\(.*?\)/g, '').trim().toLowerCase();
        return cleanDbName.includes(cleanCsvName) || cleanCsvName.includes(cleanDbName);
      });
    }

    if (matched) {
      matchedDbIds.add(matched.id);
      const csvDebt = csvItem.finalDebt;
      const dbDebt = matched.currentDebt;
      const diff = dbDebt - csvDebt;
      if (Math.abs(diff) > 0.01 || matched.currentAdvance > 0) {
        differences.push({
          csvName: csvItem.clientName,
          dbName: matched.name,
          csvDebt,
          dbDebt,
          dbAdvance: matched.currentAdvance,
          diff,
        });
      }
    } else {
      differences.push({
        csvName: csvItem.clientName,
        dbName: '(Bazada topilmadi)',
        csvDebt: csvItem.finalDebt,
        dbDebt: 0,
        dbAdvance: 0,
        diff: -csvItem.finalDebt,
      });
    }
  });

  // Check DB clients not in CSV
  const unmatchedDb = dbClients.filter((c) => !matchedDbIds.has(c.id) && (c.currentDebt > 0 || c.currentAdvance > 0));

  console.log(`\nFound ${differences.length} client entries with differences/advances:`);
  differences.forEach((d) => {
    console.log(
      `CSV: "${d.csvName}" (${d.csvDebt} USD) | DB: "${d.dbName}" (Qarz: ${d.dbDebt} USD, Avans: ${d.dbAdvance} USD) | Diff: ${d.diff > 0 ? '+' : ''}${d.diff.toFixed(2)} USD`
    );
  });

  if (unmatchedDb.length > 0) {
    console.log(`\nFound ${unmatchedDb.length} DB clients NOT in CSV:`);
    unmatchedDb.forEach((u) => {
      console.log(`DB Only: "${u.name}" (${u.region}) | Debt: ${u.currentDebt} USD | Advance: ${u.currentAdvance} USD [ID: ${u.id}]`);
    });
  }

  process.exit(0);
}

run();
