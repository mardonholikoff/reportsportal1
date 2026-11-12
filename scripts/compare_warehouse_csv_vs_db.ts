import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

interface CsvWarehouseItem {
  category: string;
  name: string;
  quantity: number;
}

function parseWarehouseCsv(filePath: string): CsvWarehouseItem[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const items: CsvWarehouseItem[] = [];

  let currentCategory = '';

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    if (
      line.includes('Товары. Остатки') ||
      line.includes('Параметры') ||
      line.includes('Номенклатура,Количество')
    ) {
      continue;
    }

    // Parse CSV handling quotes
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) {
        parts.push(current);
        current = '';
      } else current += char;
    }
    parts.push(current);

    if (parts.length < 2) continue;

    const rawName = parts[0].trim().replace(/^"+|"+$/g, '');
    const rawQty = parts[1].trim().replace(/^"+|"+$/g, '').replace(/,/g, '');

    if (!rawName) continue;

    // Check if this row is a main category header like DAEWOO motor moylari, DAEWOO zapchastlari, etc.
    const isMainCategoryHeader =
      rawName === 'DAEWOO motor moylari' ||
      rawName === 'DAEWOO zapchastlari' ||
      rawName === 'EUROL motor moylari' ||
      rawName === 'Filtrlar GM avtomobillari' ||
      rawName === 'Filtrlar inomarka avtomobillar' ||
      rawName === 'SEG Motol motor moylari' ||
      rawName === 'SPANICE kolodkalari' ||
      rawName === 'Антифризлар';

    if (isMainCategoryHeader) {
      currentCategory = rawName;
      continue;
    }

    const qty = parseFloat(rawQty);
    items.push({
      category: currentCategory,
      name: rawName,
      quantity: isNaN(qty) ? 0 : qty,
    });
  }

  return items;
}

async function run() {
  const csvPath = path.join(process.cwd(), 'public/assets/aistudio/Ostatka_2026_11_12_1ac6de03.csv');
  const csvItems = parseWarehouseCsv(csvPath);
  console.log(`Parsed ${csvItems.length} warehouse items from CSV.`);

  const snap = await getDocs(collection(db, 'warehouseProducts'));
  const dbProducts = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      brand: (data.brand || '').trim(),
      name: (data.name || '').trim(),
      mark1: (data.mark1 || '').trim(),
      mark2: (data.mark2 || '').trim(),
      totalPieces: Number(data.totalPieces) || 0,
      totalVolume: Number(data.totalVolume) || 0,
    };
  });

  console.log(`Fetched ${dbProducts.length} warehouse products from Firestore DB.`);

  console.log('\n--- SAMPLE CSV PRODUCTS ---');
  csvItems.slice(0, 10).forEach((i) => console.log(`Category: "${i.category}" | Name: "${i.name}" | Qty: ${i.quantity}`));

  console.log('\n--- SAMPLE DB WAREHOUSE PRODUCTS ---');
  dbProducts.slice(0, 10).forEach((p) => console.log(`ID: ${p.id} | Brand: "${p.brand}" | Name: "${p.name}" | Pieces: ${p.totalPieces}`));

  process.exit(0);
}

run();
