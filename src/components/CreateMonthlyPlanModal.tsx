import React, { useState, useEffect, useMemo } from 'react';
import {
  WarehouseProduct,
  MonthlyPlanTarget,
  MonthlyPlan,
  MonthlyPlanDecadeTargets,
  MonthlyPlanClientItem,
  Client,
} from '../types';
import { formatMoney, formatDate } from '../utils/format';
import { storageService } from '../services/storage';
import {
  X,
  Calendar,
  Target,
  CheckCircle2,
  AlertCircle,
  Edit3,
  History,
  Lock,
  Sparkles,
  User,
  Clock,
  Users,
  Search,
  CheckSquare,
  Square,
  Scale,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  warehouseProducts: WarehouseProduct[];
  currentUsername: string;
  existingPlan?: MonthlyPlan | null;
  onSavePlan: (
    targets: MonthlyPlanTarget[],
    decadeTargets: MonthlyPlanDecadeTargets,
    clientPlans: MonthlyPlanClientItem[],
    startDate: string,
    endDate: string,
    notes?: string,
    editReason?: string
  ) => void;
}

interface ClientDraftRow {
  selected: boolean;
  targetAmount: number | '';
  decade1: number | '';
  decade2: number | '';
  decade3: number | '';
}

export const CreateMonthlyPlanModal: React.FC<Props> = ({
  isOpen,
  onClose,
  existingPlan,
  onSavePlan,
}) => {
  // Default start date (today) and end date (+30 days / 1 month minimum)
  const defaultDates = useMemo(() => {
    const now = new Date();
    const start = now.toISOString().slice(0, 10);
    const nextMonth = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
    const end = nextMonth.toISOString().slice(0, 10);
    return { start, end };
  }, []);

  // Determine if an active, non-expired 1-month plan already exists
  const isEditingExisting = useMemo(() => {
    if (!existingPlan || existingPlan.status !== 'active') return false;
    const endMs = new Date(`${existingPlan.endDate}T23:59:59`).getTime();
    return endMs >= Date.now();
  }, [existingPlan]);

  // All clients from storage
  const allClients = useMemo<Client[]>(() => {
    if (!isOpen) return [];
    return storageService.getClients();
  }, [isOpen]);

  // Calculate existing clients' current total debt at this moment
  const currentExistingTotalDebt = useMemo(() => {
    const total = allClients.reduce((sum, c) => sum + (c.currentDebt > 0 ? c.currentDebt : 0), 0);
    return Math.round(total * 100) / 100;
  }, [allClients]);

  // Existing progress map per client (so we can show live execution % for each client inside modal too)
  const existingClientProgressMap = useMemo(() => {
    const map = new Map<
      string,
      {
        collectedAmount: number;
        decade1Collected: number;
        decade2Collected: number;
        decade3Collected: number;
      }
    >();
    if (!isOpen || !existingPlan) return map;
    const prog = storageService.calculateMonthlyPlanProgress(existingPlan);
    prog.clientPlanResults.forEach((cp) => {
      map.set(cp.clientId, {
        collectedAmount: cp.collectedAmount,
        decade1Collected: cp.decade1.collected,
        decade2Collected: cp.decade2.collected,
        decade3Collected: cp.decade3.collected,
      });
    });
    return map;
  }, [isOpen, existingPlan]);

  const [targetAmount, setTargetAmount] = useState<number | ''>('');
  const [decade1, setDecade1] = useState<number | ''>('');
  const [decade2, setDecade2] = useState<number | ''>('');
  const [decade3, setDecade3] = useState<number | ''>('');
  const [startDate, setStartDate] = useState<string>(defaultDates.start);
  const [endDate, setEndDate] = useState<string>(defaultDates.end);
  const [notes, setNotes] = useState<string>('');
  const [editReason, setEditReason] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Per-client draft map (clientId -> ClientDraftRow)
  const [clientDrafts, setClientDrafts] = useState<Record<string, ClientDraftRow>>({});
  const [clientSearch, setClientSearch] = useState<string>('');
  const [clientFilter, setClientFilter] = useState<'debtors' | 'selected' | 'all'>('debtors');

  const computeThreeSplit = (total: number) => {
    if (total <= 0) return { d1: 0, d2: 0, d3: 0 };
    const d1 = Math.round((total / 3) * 100) / 100;
    const d2 = Math.round((total / 3) * 100) / 100;
    const d3 = Math.max(0, Math.round((total - d1 - d2) * 100) / 100);
    return { d1, d2, d3 };
  };

  const splitIntoThreeDecades = (total: number) => {
    if (total <= 0) {
      setDecade1('');
      setDecade2('');
      setDecade3('');
      return;
    }
    const { d1, d2, d3 } = computeThreeSplit(total);
    setDecade1(d1);
    setDecade2(d2);
    setDecade3(d3);
  };

  // Sync overall plan amounts from selected clients (caps top plan so it's <= bottom clients sum)
  const syncOverallFromDrafts = (
    drafts: Record<string, ClientDraftRow>,
    forceEqual = false
  ) => {
    const selectedRows = Object.values(drafts).filter((r) => r.selected);
    if (selectedRows.length === 0) return;

    let sumTotal = 0;
    let sumD1 = 0;
    let sumD2 = 0;
    let sumD3 = 0;

    selectedRows.forEach((r) => {
      const d1 = Number(r.decade1) || 0;
      const d2 = Number(r.decade2) || 0;
      const d3 = Number(r.decade3) || 0;
      const rowTot = Number(r.targetAmount) || d1 + d2 + d3;
      sumTotal += rowTot;
      sumD1 += d1;
      sumD2 += d2;
      sumD3 += d3;
    });

    const roundTot = Math.round(sumTotal * 100) / 100;
    const roundD1 = Math.round(sumD1 * 100) / 100;
    const roundD2 = Math.round(sumD2 * 100) / 100;
    const roundD3 = Math.round(sumD3 * 100) / 100;

    if (roundTot > 0) {
      const curTopTot = Number(targetAmount) || 0;
      // Update top amounts if forceEqual or if top amount was empty or greater than bottom sum
      if (forceEqual || curTopTot <= 0 || curTopTot > roundTot) {
        setTargetAmount(roundTot);
        setDecade1(roundD1);
        setDecade2(roundD2);
        setDecade3(roundD3);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setEditReason('');
      setClientSearch('');

      // Initialize client drafts from existingPlan.clientPlans or default from debtor clients
      const initDrafts: Record<string, ClientDraftRow> = {};
      const existingClientPlanMap = new Map<string, MonthlyPlanClientItem>();
      if (existingPlan?.clientPlans && Array.isArray(existingPlan.clientPlans)) {
        existingPlan.clientPlans.forEach((cp) => {
          existingClientPlanMap.set(cp.clientId, cp);
        });
      }

      allClients.forEach((c) => {
        const savedCp = existingClientPlanMap.get(c.id);
        if (savedCp) {
          initDrafts[c.id] = {
            selected: true,
            targetAmount: savedCp.targetAmount,
            decade1: savedCp.decade1,
            decade2: savedCp.decade2,
            decade3: savedCp.decade3,
          };
        } else {
          const debt = c.currentDebt > 0 ? Math.round(c.currentDebt * 100) / 100 : 0;
          const { d1, d2, d3 } = computeThreeSplit(debt);
          // Default select debtor clients if no existing clientPlans were saved yet
          const defaultSelected = existingClientPlanMap.size === 0 && debt > 0;
          initDrafts[c.id] = {
            selected: defaultSelected,
            targetAmount: debt > 0 ? debt : '',
            decade1: d1 > 0 ? d1 : '',
            decade2: d2 > 0 ? d2 : '',
            decade3: d3 > 0 ? d3 : '',
          };
        }
      });
      setClientDrafts(initDrafts);
      setClientFilter('debtors');

      if (existingPlan && existingPlan.targets.length > 0) {
        const total =
          existingPlan.targets[0].targetAmount > 0
            ? existingPlan.targets[0].targetAmount
            : currentExistingTotalDebt || 0;
        setTargetAmount(total > 0 ? total : '');

        if (
          existingPlan.decadeTargets &&
          (existingPlan.decadeTargets.decade1 > 0 ||
            existingPlan.decadeTargets.decade2 > 0 ||
            existingPlan.decadeTargets.decade3 > 0)
        ) {
          setDecade1(existingPlan.decadeTargets.decade1);
          setDecade2(existingPlan.decadeTargets.decade2);
          setDecade3(existingPlan.decadeTargets.decade3);
        } else {
          splitIntoThreeDecades(total);
        }

        const initStart = existingPlan.startDate || defaultDates.start;
        let initEnd = existingPlan.endDate || defaultDates.end;
        const sMs = new Date(`${initStart}T00:00:00`).getTime();
        const eMs = new Date(`${initEnd}T00:00:00`).getTime();
        if (Math.round((eMs - sMs) / (24 * 3600 * 1000)) < 30) {
          initEnd = new Date(sMs + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
        }
        setStartDate(initStart);
        setEndDate(initEnd);
        setNotes(existingPlan.notes || '');
      } else {
        const initTotal = currentExistingTotalDebt > 0 ? currentExistingTotalDebt : 0;
        setTargetAmount(initTotal > 0 ? initTotal : '');
        splitIntoThreeDecades(initTotal);
        setStartDate(defaultDates.start);
        setEndDate(defaultDates.end);
        setNotes('');
      }
    }
  }, [isOpen, existingPlan, defaultDates, currentExistingTotalDebt, allClients]);

  // Calculate minimum allowed endDate (startDate + 30 days)
  const minEndDate = useMemo(() => {
    if (!startDate) return defaultDates.end;
    const sMs = new Date(`${startDate}T00:00:00`).getTime();
    if (isNaN(sMs)) return defaultDates.end;
    return new Date(sMs + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  }, [startDate, defaultDates.end]);

  // Selected duration in days
  const selectedDurationDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const sMs = new Date(`${startDate}T00:00:00`).getTime();
    const eMs = new Date(`${endDate}T00:00:00`).getTime();
    if (isNaN(sMs) || isNaN(eMs)) return 0;
    return Math.round((eMs - sMs) / (24 * 3600 * 1000));
  }, [startDate, endDate]);

  // Compute exact 10-day window date labels
  const decadeDateRanges = useMemo(() => {
    const sMs = startDate ? new Date(`${startDate}T00:00:00`).getTime() : Date.now();
    const d1End = new Date(sMs + 9 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const d2Start = new Date(sMs + 10 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const d2End = new Date(sMs + 19 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const d3Start = new Date(sMs + 20 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    return {
      d1Range: `${startDate || '...'} — ${d1End}`,
      d2Range: `${d2Start} — ${d2End}`,
      d3Range: `${d3Start} — ${endDate || '...'}`,
    };
  }, [startDate, endDate]);

  // Filtered clients for the table
  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    return allClients.filter((c) => {
      const draft = clientDrafts[c.id];
      if (clientFilter === 'debtors' && c.currentDebt <= 0 && !draft?.selected) {
        return false;
      }
      if (clientFilter === 'selected' && !draft?.selected) {
        return false;
      }
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.region && c.region.toLowerCase().includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q))
      );
    });
  }, [allClients, clientDrafts, clientSearch, clientFilter]);

  // Summary of selected clients at the bottom
  const selectedClientsSummary = useMemo(() => {
    let count = 0;
    let totalTarget = 0;
    let totalD1 = 0;
    let totalD2 = 0;
    let totalD3 = 0;

    Object.values(clientDrafts).forEach((d) => {
      if (d.selected) {
        count++;
        totalTarget += Number(d.targetAmount) || 0;
        totalD1 += Number(d.decade1) || 0;
        totalD2 += Number(d.decade2) || 0;
        totalD3 += Number(d.decade3) || 0;
      }
    });

    return {
      count,
      totalTarget: Math.round(totalTarget * 100) / 100,
      totalD1: Math.round(totalD1 * 100) / 100,
      totalD2: Math.round(totalD2 * 100) / 100,
      totalD3: Math.round(totalD3 * 100) / 100,
    };
  }, [clientDrafts]);

  // Live check: Top plan amounts must be <= Bottom selected clients sum
  const topVsBottomValidation = useMemo(() => {
    const topTotal = Math.round((Number(targetAmount) || 0) * 100) / 100;
    const topD1 = Math.round((Number(decade1) || 0) * 100) / 100;
    const topD2 = Math.round((Number(decade2) || 0) * 100) / 100;
    const topD3 = Math.round((Number(decade3) || 0) * 100) / 100;

    const botTotal = selectedClientsSummary.totalTarget;
    const botD1 = selectedClientsSummary.totalD1;
    const botD2 = selectedClientsSummary.totalD2;
    const botD3 = selectedClientsSummary.totalD3;

    const isTotalExceeding = topTotal > botTotal + 0.01;
    const isD1Exceeding = topD1 > botD1 + 0.01;
    const isD2Exceeding = topD2 > botD2 + 0.01;
    const isD3Exceeding = topD3 > botD3 + 0.01;

    const isValid =
      selectedClientsSummary.count > 0 &&
      !isTotalExceeding &&
      !isD1Exceeding &&
      !isD2Exceeding &&
      !isD3Exceeding;

    return {
      topTotal,
      topD1,
      topD2,
      topD3,
      botTotal,
      botD1,
      botD2,
      botD3,
      isTotalExceeding,
      isD1Exceeding,
      isD2Exceeding,
      isD3Exceeding,
      isValid,
    };
  }, [targetAmount, decade1, decade2, decade3, selectedClientsSummary]);

  if (!isOpen) return null;

  const handleStartDateChange = (newStart: string) => {
    setStartDate(newStart);
    if (newStart && endDate) {
      const sMs = new Date(`${newStart}T00:00:00`).getTime();
      const eMs = new Date(`${endDate}T00:00:00`).getTime();
      const diff = Math.round((eMs - sMs) / (24 * 3600 * 1000));
      if (diff < 30) {
        const autoEnd = new Date(sMs + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
        setEndDate(autoEnd);
      }
    }
  };

  const setPresetDuration = (days: number) => {
    const validDays = Math.max(30, days);
    const startObj = startDate ? new Date(`${startDate}T00:00:00`) : new Date();
    const endObj = new Date(startObj.getTime() + validDays * 24 * 3600 * 1000);
    setEndDate(endObj.toISOString().slice(0, 10));
  };

  const handleTotalAmountChange = (valStr: string) => {
    if (valStr === '') {
      setTargetAmount('');
      return;
    }
    const val = Math.max(0, parseFloat(valStr));
    setTargetAmount(val);
    splitIntoThreeDecades(val);
  };

  const handleDecadeChange = (which: 1 | 2 | 3, valStr: string) => {
    const parsed = valStr === '' ? '' : Math.max(0, parseFloat(valStr));
    const n1 = which === 1 ? (parsed === '' ? 0 : parsed) : Number(decade1) || 0;
    const n2 = which === 2 ? (parsed === '' ? 0 : parsed) : Number(decade2) || 0;
    const n3 = which === 3 ? (parsed === '' ? 0 : parsed) : Number(decade3) || 0;

    if (which === 1) setDecade1(parsed);
    if (which === 2) setDecade2(parsed);
    if (which === 3) setDecade3(parsed);

    const newSum = Math.round((n1 + n2 + n3) * 100) / 100;
    setTargetAmount(newSum > 0 ? newSum : '');
  };

  // Per-client row handlers
  const toggleClientSelected = (client: Client) => {
    setClientDrafts((prev) => {
      const existing = prev[client.id];
      const nextSelected = !existing?.selected;
      let tAmt: number | '' = existing?.targetAmount ?? '';
      let d1: number | '' = existing?.decade1 ?? '';
      let d2: number | '' = existing?.decade2 ?? '';
      let d3: number | '' = existing?.decade3 ?? '';

      if (nextSelected && (tAmt === '' || Number(tAmt) <= 0) && client.currentDebt > 0) {
        const debt = Math.round(client.currentDebt * 100) / 100;
        const split = computeThreeSplit(debt);
        tAmt = debt;
        d1 = split.d1;
        d2 = split.d2;
        d3 = split.d3;
      }

      const nextDrafts: Record<string, ClientDraftRow> = {
        ...prev,
        [client.id]: {
          selected: nextSelected,
          targetAmount: tAmt,
          decade1: d1,
          decade2: d2,
          decade3: d3,
        },
      };
      syncOverallFromDrafts(nextDrafts, true);
      return nextDrafts;
    });
  };

  const handleClientTotalChange = (client: Client, valStr: string) => {
    const parsed: number | '' = valStr === '' ? '' : Math.max(0, parseFloat(valStr));
    const num = parsed === '' ? 0 : parsed;
    const split = computeThreeSplit(num);

    setClientDrafts((prev) => {
      const nextDrafts: Record<string, ClientDraftRow> = {
        ...prev,
        [client.id]: {
          selected: num > 0 ? true : prev[client.id]?.selected || false,
          targetAmount: parsed,
          decade1: num > 0 ? split.d1 : '',
          decade2: num > 0 ? split.d2 : '',
          decade3: num > 0 ? split.d3 : '',
        },
      };
      syncOverallFromDrafts(nextDrafts, true);
      return nextDrafts;
    });
  };

  const handleClientDecadeChange = (client: Client, which: 1 | 2 | 3, valStr: string) => {
    const parsed: number | '' = valStr === '' ? '' : Math.max(0, parseFloat(valStr));
    setClientDrafts((prev) => {
      const cur: ClientDraftRow = prev[client.id] || {
        selected: true,
        targetAmount: '',
        decade1: '',
        decade2: '',
        decade3: '',
      };
      const n1 = which === 1 ? (parsed === '' ? 0 : parsed) : Number(cur.decade1) || 0;
      const n2 = which === 2 ? (parsed === '' ? 0 : parsed) : Number(cur.decade2) || 0;
      const n3 = which === 3 ? (parsed === '' ? 0 : parsed) : Number(cur.decade3) || 0;
      const rowSum = Math.round((n1 + n2 + n3) * 100) / 100;

      const nextDrafts: Record<string, ClientDraftRow> = {
        ...prev,
        [client.id]: {
          selected: rowSum > 0 ? true : cur.selected,
          targetAmount: rowSum > 0 ? rowSum : '',
          decade1: which === 1 ? parsed : cur.decade1,
          decade2: which === 2 ? parsed : cur.decade2,
          decade3: which === 3 ? parsed : cur.decade3,
        },
      };
      syncOverallFromDrafts(nextDrafts, true);
      return nextDrafts;
    });
  };

  const handleSelectAllDebtorsOneClick = () => {
    const nextDrafts: Record<string, ClientDraftRow> = { ...clientDrafts };
    allClients.forEach((c) => {
      if (c.currentDebt > 0) {
        const existing = nextDrafts[c.id];
        const existingTot = Number(existing?.targetAmount) || 0;
        const tAmt = existingTot > 0 ? existingTot : Math.round(c.currentDebt * 100) / 100;
        const split = computeThreeSplit(tAmt);
        nextDrafts[c.id] = {
          selected: true,
          targetAmount: tAmt,
          decade1: Number(existing?.decade1) > 0 ? existing.decade1 : split.d1,
          decade2: Number(existing?.decade2) > 0 ? existing.decade2 : split.d2,
          decade3: Number(existing?.decade3) > 0 ? existing.decade3 : split.d3,
        };
      }
    });
    setClientDrafts(nextDrafts);
    syncOverallFromDrafts(nextDrafts, true);
  };

  const handleClearSelectedClients = () => {
    const nextDrafts: Record<string, ClientDraftRow> = {};
    Object.entries(clientDrafts).forEach(([cId, row]) => {
      nextDrafts[cId] = { ...row, selected: false };
    });
    setClientDrafts(nextDrafts);
  };

  const handleEqualizeTopWithBottom = () => {
    if (selectedClientsSummary.count === 0) return;
    setTargetAmount(selectedClientsSummary.totalTarget);
    setDecade1(selectedClientsSummary.totalD1);
    setDecade2(selectedClientsSummary.totalD2);
    setDecade3(selectedClientsSummary.totalD3);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!startDate || !endDate) {
      setErrorMsg('Reja amal qilish muddatini (boshlanish va tugash sanasini) tanlang!');
      return;
    }

    if (selectedDurationDays < 30) {
      setErrorMsg(
        `Reja muddati eng kamida 30 kun bo'lishi shart! Hozir tanlangan muddat: ${selectedDurationDays} kun.`
      );
      return;
    }

    const d1 = typeof decade1 === 'number' ? decade1 : Number(decade1) || 0;
    const d2 = typeof decade2 === 'number' ? decade2 : Number(decade2) || 0;
    const d3 = typeof decade3 === 'number' ? decade3 : Number(decade3) || 0;

    if (d1 <= 0 || d2 <= 0 || d3 <= 0) {
      setErrorMsg(
        "Har bir 10 kunlik (1-chi, 2-chi va 3-chi 10 kunlik) uchun qancha pul tushishi kerakligini 0 dan katta qiymatda belgilang!"
      );
      return;
    }

    const numAmt = typeof targetAmount === 'number' ? targetAmount : Number(targetAmount) || 0;
    const decadesSum = Math.round((d1 + d2 + d3) * 100) / 100;
    const finalTargetAmount = numAmt > 0 ? numAmt : decadesSum;

    if (finalTargetAmount <= 0) {
      setErrorMsg('Iltimos, umumiy 30 kunlik reja summasini (USD) kiriting!');
      return;
    }

    // Build clientPlans list from selected rows
    const clientPlans: MonthlyPlanClientItem[] = [];
    for (const c of allClients) {
      const row = clientDrafts[c.id];
      if (!row || !row.selected) continue;
      const cD1 = Math.round((Number(row.decade1) || 0) * 100) / 100;
      const cD2 = Math.round((Number(row.decade2) || 0) * 100) / 100;
      const cD3 = Math.round((Number(row.decade3) || 0) * 100) / 100;
      const cTot = Math.round((Number(row.targetAmount) || cD1 + cD2 + cD3) * 100) / 100;

      if (cTot <= 0) {
        setErrorMsg(
          `Tanlangan mijoz "${c.name}" uchun unishi mumkin bo'lgan summani kiriting yoki tanlovdan olib tashlang!`
        );
        return;
      }

      clientPlans.push({
        clientId: c.id,
        clientName: c.name,
        clientCode: c.region || '',
        clientPhone: c.phone,
        initialDebt: Math.max(0, c.currentDebt || 0),
        targetAmount: cTot,
        decade1: cD1,
        decade2: cD2,
        decade3: cD3,
      });
    }

    if (clientPlans.length === 0) {
      setErrorMsg(
        "Iltimos, pastdagi jadvaldan kamida bitta mijozni tanlab, uning umumiy va 10 kunlik undiruv rejasini kiriting!"
      );
      return;
    }

    // Enforce: Top plan amounts MUST BE <= Bottom selected clients sum
    const botTotal = selectedClientsSummary.totalTarget;
    const botD1 = selectedClientsSummary.totalD1;
    const botD2 = selectedClientsSummary.totalD2;
    const botD3 = selectedClientsSummary.totalD3;

    if (finalTargetAmount > botTotal + 0.01) {
      setErrorMsg(
        `Xatolik: Eng avvalgi rejaga undirish muddat oralig'idagi umumiy summa (${formatMoney(finalTargetAmount)}) pastda mijozlarda yig'ilgan summadan (${formatMoney(botTotal)}) katta bo'lishi mumkin emas! U mijozlar yig'indisi bilan teng yoki pastroq bo'lishi shart.`
      );
      return;
    }

    if (d1 > botD1 + 0.01 || d2 > botD2 + 0.01 || d3 > botD3 + 0.01) {
      setErrorMsg(
        `Xatolik: Yuqoridagi 10 kunliklar summasi (1-o'n kunlik: ${formatMoney(d1)}, 2-o'n kunlik: ${formatMoney(d2)}, 3-o'n kunlik: ${formatMoney(d3)}) pastda mijozlarda yig'ilgan 10 kunliklar summasidan (${formatMoney(botD1)}, ${formatMoney(botD2)}, ${formatMoney(botD3)}) katta bo'lishi mumkin emas! Teng yoki pastroq bo'lishi kerak.`
      );
      return;
    }

    if (isEditingExisting && !editReason.trim()) {
      setErrorMsg(
        "Mavjud 1 oylik rejani tahrirlayotganda tahrirlash sababi / izohini yozish majburiy!"
      );
      return;
    }

    onSavePlan(
      [{ currency: 'USD', targetAmount: finalTargetAmount }],
      {
        decade1: Math.round(d1 * 100) / 100,
        decade2: Math.round(d2 * 100) / 100,
        decade3: Math.round(d3 * 100) / 100,
      },
      clientPlans,
      startDate,
      endDate,
      notes.trim() || undefined,
      isEditingExisting ? editReason.trim() : undefined
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-6xl bg-white rounded-3xl shadow-2xl border border-rose-200 overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-rose-800 via-rose-700 to-rose-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white border border-white/20">
              {isEditingExisting ? <Edit3 className="w-5 h-5" /> : <Target className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold font-display leading-tight">
                {isEditingExisting
                  ? 'Mavjud 1 oylik rejani tahrirlash'
                  : '1 oylik qarz undirish rejasini tuzish'}
              </h2>
              <p className="text-[11px] text-rose-100/90 mt-0.5">
                {isEditingExisting
                  ? `Faol muddat: ${existingPlan?.startDate} — ${existingPlan?.endDate} (Yangi reja ochish bloklangan, faqat tahrirlash mumkin)`
                  : 'Reja summasi pastda mijozlarda yig‘ilgan summa bilan teng yoki pastroq bo‘lishi shart'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer min-h-[36px] min-w-[36px]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Active Plan Lock Banner */}
          {isEditingExisting && existingPlan && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  Faol reja mavjud ({existingPlan.startDate} dan {existingPlan.endDate} gacha)
                </span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                1 oylik reja tuzilganda shu muddat oralig'ida yana boshqa yangi reja tuzish mumkin
                emas. Siz faqat ushbu mavjud rejani tahrirlashingiz mumkin va har bir tahrir uchun
                izoh yozish majburiy.
              </p>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ========================================================= */}
          {/* 1-QISM (ENG AVVALGI): REJA MUDDATI VA REJAGA UNDIRISH SUMMASI */}
          {/* ========================================================= */}
          <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-rose-700" />
                <h3 className="text-xs sm:text-sm font-bold text-neutral-900 uppercase tracking-wide">
                  1. Reja muddati (Eng kami 30 kun)
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold font-mono ${
                    selectedDurationDays >= 30
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}
                >
                  {selectedDurationDays} kun
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setPresetDuration(30)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer transition ${
                    selectedDurationDays === 30
                      ? 'bg-rose-700 text-white border-rose-700'
                      : 'bg-rose-100 border-rose-300 text-rose-900 hover:bg-rose-200'
                  }`}
                >
                  30 kun (1 oy)
                </button>
                <button
                  type="button"
                  onClick={() => setPresetDuration(45)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer transition ${
                    selectedDurationDays === 45
                      ? 'bg-rose-700 text-white border-rose-700'
                      : 'bg-white border-neutral-200 hover:border-rose-300 text-neutral-700'
                  }`}
                >
                  45 kun
                </button>
                <button
                  type="button"
                  onClick={() => setPresetDuration(60)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer transition ${
                    selectedDurationDays === 60
                      ? 'bg-rose-700 text-white border-rose-700'
                      : 'bg-white border-neutral-200 hover:border-rose-300 text-neutral-700'
                  }`}
                >
                  60 kun (2 oy)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Boshlanish sanasi <span className="text-rose-600">*</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs sm:text-sm font-mono font-semibold text-neutral-900 bg-white focus:outline-rose-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Tugash sanasi (Kamida +30 kun) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="date"
                  value={endDate}
                  min={minEndDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs sm:text-sm font-mono font-semibold text-neutral-900 bg-white focus:outline-rose-600"
                  required
                />
              </div>
            </div>

            {/* 2-QISM (ENG AVVALGI REJAGA UNDIRISH SUMMASI VA 10 KUNLIKLAR) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2 border-t border-neutral-200">
              {/* Umumiy 30 kunlik reja */}
              <div className="lg:col-span-5 p-4 rounded-2xl bg-rose-50/60 border border-rose-200/90 space-y-2.5">
                <div className="flex items-center justify-between text-xs flex-wrap gap-1">
                  <span className="font-semibold text-neutral-700">
                    Pastdagi mijozlar yig'indisi (Max chegara):
                  </span>
                  <span className="font-extrabold font-mono text-emerald-800 text-sm">
                    {formatMoney(selectedClientsSummary.totalTarget)}
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                    <label className="block text-xs font-bold text-neutral-900">
                      2. Rejaga undirish umumiy summasi (USD){' '}
                      <span className="text-rose-600">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleEqualizeTopWithBottom}
                      className="text-[11px] font-bold text-rose-700 hover:text-rose-900 underline cursor-pointer"
                    >
                      Mijozlar yig'indisiga tenglash ({formatMoney(selectedClientsSummary.totalTarget)})
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0.01"
                      max={selectedClientsSummary.totalTarget > 0 ? selectedClientsSummary.totalTarget : undefined}
                      step="any"
                      value={targetAmount}
                      onChange={(e) => handleTotalAmountChange(e.target.value)}
                      placeholder="Masalan: 15000"
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-neutral-900 text-sm sm:text-base font-bold font-mono focus:outline-rose-600 bg-white tabular-nums pr-16 ${
                        topVsBottomValidation.isTotalExceeding
                          ? 'border-rose-500 ring-2 ring-rose-200'
                          : 'border-neutral-300'
                      }`}
                      required
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold font-mono text-rose-800 bg-rose-100 px-2 py-0.5 rounded-md">
                      USD
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-600 mt-1.5 leading-relaxed">
                    * Ushbu summa pastda tanlangan mijozlarda yig'ilgan summaga (
                    <strong>{formatMoney(selectedClientsSummary.totalTarget)}</strong>){' '}
                    <strong>teng yoki pastroq</strong> bo'lishi shart!
                  </p>
                </div>
              </div>

              {/* 1-chi, 2-chi va 3-chi 10 kunliklar */}
              <div className="lg:col-span-7 p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200/90 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-700" />
                    <h3 className="text-xs sm:text-sm font-bold text-neutral-900 uppercase tracking-wide">
                      10 kunliklar bo'yicha reja summasi (Mijozlar yig'indisiga teng yoki pastroq)
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const total =
                        typeof targetAmount === 'number'
                          ? targetAmount
                          : Number(targetAmount) || selectedClientsSummary.totalTarget || 0;
                      if (total > 0) splitIntoThreeDecades(total);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-900 border border-indigo-300 text-[11px] font-bold cursor-pointer transition"
                  >
                    Teng 3 ga taqsimlash
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* 1-chi 10 kunlik */}
                  <div className="p-2.5 rounded-xl bg-white border border-indigo-200/80 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-indigo-950">
                        1-chi 10 kunlik <span className="text-rose-600">*</span>
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-neutral-500">
                      Max (Mijozlar): <strong>{formatMoney(selectedClientsSummary.totalD1)}</strong>
                    </p>
                    <div className="relative">
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={decade1}
                        onChange={(e) => handleDecadeChange(1, e.target.value)}
                        placeholder="5000"
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-neutral-900 text-xs sm:text-sm font-bold font-mono focus:outline-indigo-600 bg-white pr-10 ${
                          topVsBottomValidation.isD1Exceeding
                            ? 'border-rose-500 ring-1 ring-rose-300'
                            : 'border-neutral-300'
                        }`}
                        required
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold font-mono text-indigo-800">
                        USD
                      </span>
                    </div>
                  </div>

                  {/* 2-chi 10 kunlik */}
                  <div className="p-2.5 rounded-xl bg-white border border-indigo-200/80 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-indigo-950">
                        2-chi 10 kunlik <span className="text-rose-600">*</span>
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-neutral-500">
                      Max (Mijozlar): <strong>{formatMoney(selectedClientsSummary.totalD2)}</strong>
                    </p>
                    <div className="relative">
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={decade2}
                        onChange={(e) => handleDecadeChange(2, e.target.value)}
                        placeholder="5000"
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-neutral-900 text-xs sm:text-sm font-bold font-mono focus:outline-indigo-600 bg-white pr-10 ${
                          topVsBottomValidation.isD2Exceeding
                            ? 'border-rose-500 ring-1 ring-rose-300'
                            : 'border-neutral-300'
                        }`}
                        required
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold font-mono text-indigo-800">
                        USD
                      </span>
                    </div>
                  </div>

                  {/* 3-chi 10 kunlik */}
                  <div className="p-2.5 rounded-xl bg-white border border-indigo-200/80 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-indigo-950">
                        3-chi 10 kunlik <span className="text-rose-600">*</span>
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-neutral-500">
                      Max (Mijozlar): <strong>{formatMoney(selectedClientsSummary.totalD3)}</strong>
                    </p>
                    <div className="relative">
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={decade3}
                        onChange={(e) => handleDecadeChange(3, e.target.value)}
                        placeholder="5000"
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-neutral-900 text-xs sm:text-sm font-bold font-mono focus:outline-indigo-600 bg-white pr-10 ${
                          topVsBottomValidation.isD3Exceeding
                            ? 'border-rose-500 ring-1 ring-rose-300'
                            : 'border-neutral-300'
                        }`}
                        required
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold font-mono text-indigo-800">
                        USD
                      </span>
                    </div>
                  </div>
                </div>

                {/* Live Validation Comparison Banner */}
                <div
                  className={`p-2.5 rounded-xl border text-xs flex items-center justify-between flex-wrap gap-2 ${
                    topVsBottomValidation.isValid
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-300 text-rose-900'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Scale className="w-4 h-4 shrink-0" />
                    {topVsBottomValidation.isValid ? (
                      <span>
                        To'g'ri: Reja summasi ({formatMoney(topVsBottomValidation.topTotal)}) pastda
                        mijozlarda yig'ilgan summaga ({formatMoney(topVsBottomValidation.botTotal)})
                        teng yoki pastroq.
                      </span>
                    ) : (
                      <span>
                        Diqqat: Reja summasi ({formatMoney(topVsBottomValidation.topTotal)}) pastda
                        mijozlarda yig'ilgan summadan ({formatMoney(topVsBottomValidation.botTotal)})
                        oshib ketmasligi shart!
                      </span>
                    )}
                  </div>
                  {!topVsBottomValidation.isValid && selectedClientsSummary.count > 0 && (
                    <button
                      type="button"
                      onClick={handleEqualizeTopWithBottom}
                      className="px-2.5 py-1 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-[11px] font-bold cursor-pointer transition"
                    >
                      Mijozlar yig'indisiga tenglashtirish
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 3-QISM (PASTDA): MIJOZLAR KESIMIDA BITTADA TANLAB YOZISH VA HAR BIRI UCHUN 4 TA FOIZ */}
          {/* ========================================================= */}
          <div className="p-4 rounded-2xl bg-emerald-50/40 border border-emerald-200/90 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Users className="w-4 h-4 text-emerald-700" />
                <h3 className="text-xs sm:text-sm font-bold text-neutral-900 uppercase tracking-wide">
                  3. Pastda mijozlar kesimida undiruv rejasi va har bir mijoz uchun 4 ta foiz ko'rsatkichi
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-bold text-[11px] border border-emerald-300 font-mono">
                  Tanlangan: {selectedClientsSummary.count} ta mijoz | Yig'indi:{' '}
                  {formatMoney(selectedClientsSummary.totalTarget)}
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={handleSelectAllDebtorsOneClick}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold cursor-pointer transition shadow-2xs"
                >
                  Qarzdor mijozlarni bittada tanlash
                </button>
                {selectedClientsSummary.count > 0 && (
                  <button
                    type="button"
                    onClick={handleClearSelectedClients}
                    className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-semibold cursor-pointer transition"
                  >
                    Tanlovni tozalash
                  </button>
                )}
              </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Mijoz F.I.Sh., hududi yoki telefoni bo'yicha qidirish..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-neutral-300 text-xs text-neutral-900 bg-white focus:outline-emerald-600"
                />
              </div>

              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-neutral-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setClientFilter('debtors')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition ${
                    clientFilter === 'debtors'
                      ? 'bg-emerald-700 text-white'
                      : 'text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  Qarzdorlar ({allClients.filter((c) => c.currentDebt > 0).length})
                </button>
                <button
                  type="button"
                  onClick={() => setClientFilter('selected')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition ${
                    clientFilter === 'selected'
                      ? 'bg-emerald-700 text-white'
                      : 'text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  Tanlanganlar ({selectedClientsSummary.count})
                </button>
                <button
                  type="button"
                  onClick={() => setClientFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition ${
                    clientFilter === 'all'
                      ? 'bg-emerald-700 text-white'
                      : 'text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  Barchasi ({allClients.length})
                </button>
              </div>
            </div>

            {/* One-Pass Interactive Clients Table with 4 Percentages per Client */}
            <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-2xs">
              <div className="max-h-80 overflow-y-auto overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[880px]">
                  <thead className="bg-neutral-100 text-neutral-700 text-[11px] font-bold uppercase sticky top-0 z-10 border-b border-neutral-200">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">Tanlash</th>
                      <th className="py-2.5 px-3">Mijoz F.I.Sh. / Telefon</th>
                      <th className="py-2.5 px-3 text-right">Hozirgi qarzi</th>
                      <th className="py-2.5 px-3 w-44 bg-rose-50/70">
                        Umumiy reja (USD) va Foizi (%)
                      </th>
                      <th className="py-2.5 px-3 w-44 bg-indigo-50/60">
                        1-chi 10 kunlik (USD) va Foizi (%)
                      </th>
                      <th className="py-2.5 px-3 w-44 bg-indigo-50/60">
                        2-chi 10 kunlik (USD) va Foizi (%)
                      </th>
                      <th className="py-2.5 px-3 w-44 bg-indigo-50/60">
                        3-chi 10 kunlik (USD) va Foizi (%)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-xs">
                    {filteredClients.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-neutral-500 italic">
                          Mijozlar topilmadi.
                        </td>
                      </tr>
                    ) : (
                      filteredClients.map((client) => {
                        const row = clientDrafts[client.id] || {
                          selected: false,
                          targetAmount: '',
                          decade1: '',
                          decade2: '',
                          decade3: '',
                        };

                        const rowTot = Number(row.targetAmount) || 0;
                        const rowD1 = Number(row.decade1) || 0;
                        const rowD2 = Number(row.decade2) || 0;
                        const rowD3 = Number(row.decade3) || 0;

                        const existingProg = existingClientProgressMap.get(client.id) || {
                          collectedAmount: 0,
                          decade1Collected: 0,
                          decade2Collected: 0,
                          decade3Collected: 0,
                        };

                        // Calculate the 4 percentages for this client
                        const overallExecPct =
                          rowTot > 0
                            ? Math.min(
                                100,
                                Math.round(((existingProg.collectedAmount / rowTot) * 100) * 10) /
                                  10
                              )
                            : 0;
                        const d1ExecPct =
                          rowD1 > 0
                            ? Math.min(
                                100,
                                Math.round(((existingProg.decade1Collected / rowD1) * 100) * 10) /
                                  10
                              )
                            : 0;
                        const d2ExecPct =
                          rowD2 > 0
                            ? Math.min(
                                100,
                                Math.round(((existingProg.decade2Collected / rowD2) * 100) * 10) /
                                  10
                              )
                            : 0;
                        const d3ExecPct =
                          rowD3 > 0
                            ? Math.min(
                                100,
                                Math.round(((existingProg.decade3Collected / rowD3) * 100) * 10) /
                                  10
                              )
                            : 0;

                        const debtCoveragePct =
                          client.currentDebt > 0 && rowTot > 0
                            ? Math.min(
                                100,
                                Math.round(((rowTot / client.currentDebt) * 100) * 10) / 10
                              )
                            : 0;

                        return (
                          <tr
                            key={client.id}
                            className={`transition ${
                              row.selected
                                ? 'bg-emerald-50/70 hover:bg-emerald-50'
                                : 'hover:bg-neutral-50'
                            }`}
                          >
                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => toggleClientSelected(client)}
                                className="inline-flex items-center justify-center text-emerald-700 hover:text-emerald-900 cursor-pointer"
                              >
                                {row.selected ? (
                                  <CheckSquare className="w-4 h-4 text-emerald-700" />
                                ) : (
                                  <Square className="w-4 h-4 text-neutral-400" />
                                )}
                              </button>
                            </td>
                            <td
                              onClick={() => toggleClientSelected(client)}
                              className="py-2 px-3 cursor-pointer"
                            >
                              <div className="font-bold text-neutral-900">{client.name}</div>
                              <div className="text-[10px] text-neutral-500 font-mono">
                                {client.region ? `${client.region} • ` : ''}
                                {client.phone}
                              </div>
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-rose-800">
                              {client.currentDebt > 0 ? formatMoney(client.currentDebt) : '0 $'}
                            </td>

                            {/* 1) Umumiy reja va foizi */}
                            <td className="py-2 px-2.5 bg-rose-50/20">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={row.targetAmount}
                                onChange={(e) => handleClientTotalChange(client, e.target.value)}
                                placeholder="Umumiy..."
                                className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold focus:outline-emerald-600 ${
                                  row.selected
                                    ? 'border-emerald-400 bg-white text-neutral-900'
                                    : 'border-neutral-200 bg-neutral-50 text-neutral-700'
                                }`}
                              />
                              {row.selected && (
                                <div className="flex items-center justify-between text-[10px] font-mono mt-1 px-0.5">
                                  <span className="text-rose-800 font-bold">
                                    Foiz: {overallExecPct}%
                                  </span>
                                  <span className="text-neutral-500">
                                    (Qarzdan: {debtCoveragePct}%)
                                  </span>
                                </div>
                              )}
                            </td>

                            {/* 2) 1-chi 10 kunlik va foizi */}
                            <td className="py-2 px-2.5 bg-indigo-50/15">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={row.decade1}
                                onChange={(e) =>
                                  handleClientDecadeChange(client, 1, e.target.value)
                                }
                                placeholder="1-o'n kun..."
                                className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-mono font-semibold focus:outline-indigo-600 ${
                                  row.selected
                                    ? 'border-indigo-300 bg-white text-indigo-950'
                                    : 'border-neutral-200 bg-neutral-50 text-neutral-600'
                                }`}
                              />
                              {row.selected && (
                                <div className="flex items-center justify-between text-[10px] font-mono mt-1 px-0.5">
                                  <span className="text-indigo-800 font-bold">
                                    1-o'n kunlik: {d1ExecPct}%
                                  </span>
                                </div>
                              )}
                            </td>

                            {/* 3) 2-chi 10 kunlik va foizi */}
                            <td className="py-2 px-2.5 bg-indigo-50/15">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={row.decade2}
                                onChange={(e) =>
                                  handleClientDecadeChange(client, 2, e.target.value)
                                }
                                placeholder="2-o'n kun..."
                                className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-mono font-semibold focus:outline-indigo-600 ${
                                  row.selected
                                    ? 'border-indigo-300 bg-white text-indigo-950'
                                    : 'border-neutral-200 bg-neutral-50 text-neutral-600'
                                }`}
                              />
                              {row.selected && (
                                <div className="flex items-center justify-between text-[10px] font-mono mt-1 px-0.5">
                                  <span className="text-indigo-800 font-bold">
                                    2-o'n kunlik: {d2ExecPct}%
                                  </span>
                                </div>
                              )}
                            </td>

                            {/* 4) 3-chi 10 kunlik va foizi */}
                            <td className="py-2 px-2.5 bg-indigo-50/15">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={row.decade3}
                                onChange={(e) =>
                                  handleClientDecadeChange(client, 3, e.target.value)
                                }
                                placeholder="3-o'n kun..."
                                className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-mono font-semibold focus:outline-indigo-600 ${
                                  row.selected
                                    ? 'border-indigo-300 bg-white text-indigo-950'
                                    : 'border-neutral-200 bg-neutral-50 text-neutral-600'
                                }`}
                              />
                              {row.selected && (
                                <div className="flex items-center justify-between text-[10px] font-mono mt-1 px-0.5">
                                  <span className="text-indigo-800 font-bold">
                                    3-o'n kunlik: {d3ExecPct}%
                                  </span>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer Totals */}
              {selectedClientsSummary.count > 0 && (
                <div className="px-3.5 py-2.5 bg-emerald-100/70 border-t border-emerald-200 flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
                  <span className="font-sans font-bold text-emerald-950">
                    Pastda mijozlarda yig'ilgan jami ({selectedClientsSummary.count} ta mijoz):
                  </span>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-neutral-800">
                      Umumiy yig'indi:{' '}
                      <strong className="text-emerald-900">
                        {formatMoney(selectedClientsSummary.totalTarget)}
                      </strong>
                    </span>
                    <span className="text-indigo-900">
                      1-chi 10 kunlik: <strong>{formatMoney(selectedClientsSummary.totalD1)}</strong>
                    </span>
                    <span className="text-indigo-900">
                      2-chi 10 kunlik: <strong>{formatMoney(selectedClientsSummary.totalD2)}</strong>
                    </span>
                    <span className="text-indigo-900">
                      3-chi 10 kunlik: <strong>{formatMoney(selectedClientsSummary.totalD3)}</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 4-QISM: Tahrirlash izohi (Agar mavjud reja tahrirlanayotgan bo'lsa MAJBURIY) */}
          {isEditingExisting && (
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-300 space-y-2">
              <label className="block text-xs font-extrabold text-amber-950">
                Tahrirlash sababi / izohi (Majburiy) <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={2}
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Rejani nima sababdan tahrirlayotganingizni yozing (xronologiyada kim, qachon va nima izoh bilan o'zgartirgani saqlanadi)..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-amber-300 text-xs text-neutral-900 bg-white focus:outline-amber-600 resize-none font-medium"
                required
              />
            </div>
          )}

          {/* Qo'shimcha umumiy izoh */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Reja bo'yicha umumiy eslatma (Ixtiyoriy)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Masalan: Oylik qarz undirish maqsadi..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs text-neutral-900 bg-white focus:outline-rose-600"
            />
          </div>

          {/* Mavjud tahrirlar xronologiyasi (Agar bo'lsa) */}
          {existingPlan?.editHistory && existingPlan.editHistory.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-800">
                <History className="w-4 h-4 text-rose-700" />
                <span>Oldingi tahrirlar xronologiyasi ({existingPlan.editHistory.length} ta)</span>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-2 pr-1">
                {existingPlan.editHistory.map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-xl bg-white border border-neutral-200 text-[11px] space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 font-bold text-rose-800">
                        <User className="w-3 h-3" />@{log.editedBy}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono text-neutral-500">
                        <Clock className="w-3 h-3" />
                        {formatDate(log.editedAt)}
                      </span>
                    </div>
                    <p className="text-neutral-800 font-semibold">Izoh: "{log.reason}"</p>
                    {log.changesSummary && (
                      <p className="text-[10px] font-mono text-neutral-500">{log.changesSummary}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-neutral-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-neutral-300 text-neutral-700 text-xs sm:text-sm font-semibold hover:bg-neutral-100 transition cursor-pointer min-h-[42px]"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 active:bg-rose-900 text-white text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer min-h-[42px] flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isEditingExisting ? 'Tahrirni saqlash' : 'Rejani saqlash'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};



