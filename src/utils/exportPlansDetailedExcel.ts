import ExcelJS from 'exceljs';
import { Client, DailyPlanItem } from '../types';

export function formatPhoneList(phones?: string[]): string {
  if (!phones || phones.length === 0) return '—';
  return phones.filter(Boolean).join(', ');
}

export function computePlanTotals(plan: DailyPlanItem): {
  totalPaymentAmount: number;
  totalProductsValue: number;
} {
  let totalPaymentAmount = 0;
  let totalProductsValue = 0;

  if (plan.actionsHistory && plan.actionsHistory.length > 0) {
    plan.actionsHistory.forEach((act) => {
      if (act.financialAction?.amount) {
        totalPaymentAmount += act.financialAction.amount;
      }
      if (act.deliveryPayment?.paidAmount) {
        totalPaymentAmount += act.deliveryPayment.paidAmount;
      }
      if (act.productsDelivered && act.productsDelivered.length > 0) {
        act.productsDelivered.forEach((p) => {
          totalProductsValue += p.totalPrice || p.quantity * p.unitPrice;
        });
      }
    });
  } else {
    if (plan.financialAction?.amount) {
      totalPaymentAmount += plan.financialAction.amount;
    }
    if (plan.deliveryPayment?.paidAmount) {
      totalPaymentAmount += plan.deliveryPayment.paidAmount;
    }
    if (plan.productsDelivered && plan.productsDelivered.length > 0) {
      plan.productsDelivered.forEach((p) => {
        totalProductsValue += p.totalPrice || p.quantity * p.unitPrice;
      });
    }
  }

  return {
    totalPaymentAmount: Math.round(totalPaymentAmount * 100) / 100,
    totalProductsValue: Math.round(totalProductsValue * 100) / 100,
  };
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getActionLabel(action?: string): string {
  if (action === 'telefon') return "Telefon qilib bog'lanish";
  if (action === 'joyiga borildi') return 'Joyiga borish';
  if (action === 'ikkisi ham') return 'Telefon + Joyiga borish';
  return "Joyiga borish";
}

function formatDateTimeUz(isoStr?: string): string {
  if (!isoStr) return '—';
  try {
    return new Date(isoStr).toLocaleString('uz-UZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoStr;
  }
}

export async function exportPlansDetailedToExcel(
  plans: DailyPlanItem[],
  clients: Client[],
  allSystemPlans?: DailyPlanItem[],
  title: string = 'Kunlik Rejalar va Amallar Hisoboti (Batafsil)',
  subtitle?: string,
  filePrefix: string = 'Reja_va_Amallar_Batafsil'
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Savdo Boshqaruv Tizimi';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Reja va Amallar', {
    views: [{ state: 'frozen', ySplit: 3 }],
  });

  const clientsMap = new Map<string, Client>();
  clients.forEach((c) => clientsMap.set(c.id, c));

  const getFirstPlanInfo = (clientId: string) => {
    const source = allSystemPlans && allSystemPlans.length > 0 ? allSystemPlans : plans;
    const clientPlans = source.filter((p) => p.clientId === clientId);
    if (clientPlans.length === 0) return null;
    const sorted = [...clientPlans].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    return sorted[0];
  };

  // Title Row 1
  sheet.mergeCells('A1:T1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = title;
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' },
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(1).height = 28;

  // Subtitle Row 2
  sheet.mergeCells('A2:T2');
  const subCell = sheet.getCell('A2');
  const closedCount = plans.filter((p) => p.isClosed || p.status === 'yopildi').length;
  const openCount = plans.length - closedCount;
  const doneCount = plans.filter((p) => p.status === 'bajarildi' || p.actionDone).length;
  subCell.value =
    subtitle ||
    `Jami qatorlar: ${plans.length} ta | Ochiq (Yopilmagan): ${openCount} ta | Yopilgan: ${closedCount} ta | Amal bajarilgan: ${doneCount} ta | Yuklangan vaqt: ${new Date().toLocaleString('uz-UZ')}`;
  subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF334155' } };
  subCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF1F5F9' },
  };
  subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(2).height = 22;

  const headers = [
    '№',
    'Reja sanasi / Vaqti',
    'Mijoz F.I.Sh',
    'Telefon raqami',
    'Manzil (Viloyat / Tuman / Mo\'ljal)',
    'Joriy Qarz ($)',
    'Joriy Haqdorlik ($)',
    'Rejaga kiritgan (Agent)',
    'Rejadagi amal turi',
    'Rejadagi undirish summasi ($)',
    'Reja izohi',
    'Holati (Ochiq / Yopilgan / Bajarilgan)',
    'Bajarilgan amal turi',
    'Oxirgi bajargan / Yopgan agent va vaqt',
    'Qabul qilingan to\'lov ($ USD)',
    'To\'lov tafsilotlari (Usul, So\'m, Kurs, Split)',
    'Berilgan mahsulotlar ($ USD)',
    'Berilgan mahsulotlar ro\'yxati va Nasiya/To\'lov',
    'Qaytarib olingan mahsulotlar',
    'Hisobot / Yopilish sababi va Barcha amallar tarixi',
  ];

  const headerRow = sheet.getRow(3);
  headers.forEach((h, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });
  headerRow.height = 30;

  let totalCurrentDebt = 0;
  let totalCurrentAdvance = 0;
  let totalPlannedAmt = 0;
  let totalPaidUsd = 0;
  let totalDeliveredUsd = 0;

  plans.forEach((plan, index) => {
    const client = clientsMap.get(plan.clientId);
    const phones =
      client?.phones && client.phones.length > 0
        ? client.phones
        : [client?.phone || plan.clientPhone];

    const region = client?.region || plan.clientRegion || '';
    const district = client?.district || plan.clientDistrict || '';
    const landmark = client?.landmark || plan.clientLandmark || '';
    const addressStr =
      region || district || landmark
        ? [region, district, landmark].filter(Boolean).join(', ')
        : client?.address || plan.clientAddress || '—';

    const currentDebt = client?.currentDebt || 0;
    const currentAdvance = client?.currentAdvance || 0;
    const plannedAmt = plan.plannedAmount && plan.plannedAmount > 0 ? plan.plannedAmount : 0;

    totalCurrentDebt += currentDebt;
    totalCurrentAdvance += currentAdvance;
    totalPlannedAmt += plannedAmt;

    const firstPlan = getFirstPlanInfo(plan.clientId) || plan;
    const isClosed = Boolean(plan.isClosed || plan.status === 'yopildi');
    const isDone = Boolean(plan.status === 'bajarildi' || plan.actionDone);
    const isClosedWithoutAction = Boolean(
      isClosed && (plan.closedWithoutAction || (!isDone && !plan.actionDone))
    );

    let statusText = 'Ochiq (Jarayonda)';
    if (isClosedWithoutAction) {
      statusText = 'Yopilgan (Bajarilmasdan)';
    } else if (isClosed && isDone) {
      statusText = 'Yopilgan (Bajarildi)';
    } else if (isClosed) {
      statusText = 'Yopilgan';
    } else if (isDone) {
      statusText = 'Bajarildi (Ochiq)';
    }

    const totals = computePlanTotals(plan);
    totalPaidUsd += totals.totalPaymentAmount;
    totalDeliveredUsd += totals.totalProductsValue;

    // Build detailed payment breakdown string
    const historyList =
      plan.actionsHistory && plan.actionsHistory.length > 0
        ? plan.actionsHistory
        : plan.actionDone
        ? [
            {
              timestamp: plan.completedAt || plan.createdAt,
              author: plan.lastExecutedBy || plan.agentUsername,
              actionDone: plan.actionDone,
              financialAction: plan.financialAction,
              productsDelivered: plan.productsDelivered,
              deliveryPayment: plan.deliveryPayment,
              productsReturned: plan.productsReturned,
              reportNote: plan.reportNote,
            },
          ]
        : [];

    const paymentDetailsParts: string[] = [];
    const productDetailsParts: string[] = [];
    const returnedDetailsParts: string[] = [];
    const historySummaryParts: string[] = [];

    historyList.forEach((act, hIdx) => {
      const prefix = historyList.length > 1 ? `[#${hIdx + 1} ${act.author} ${formatDateTimeUz(act.timestamp)}] ` : '';

      if (act.financialAction && act.financialAction.amount > 0) {
        const fa = act.financialAction;
        let payLine = `${prefix}${fa.methodLabel}: ${formatMoney(fa.amount)} USD`;
        if (fa.amountUzs && fa.exchangeRate) {
          payLine += ` (${formatMoney(fa.amountUzs)} so'm / kurs: ${formatMoney(fa.exchangeRate)})`;
        }
        if (fa.splits && fa.splits.length > 0) {
          const spStr = fa.splits
            .map(
              (s) =>
                `${s.methodLabel}: ${formatMoney(s.amount)} USD${
                  s.amountUzs && s.exchangeRate
                    ? ` (${formatMoney(s.amountUzs)} so'm @ ${formatMoney(s.exchangeRate)})`
                    : ''
                }`
            )
            .join(' + ');
          payLine += ` [${spStr}]`;
        }
        if (fa.note) {
          payLine += ` (Izoh: ${fa.note})`;
        }
        paymentDetailsParts.push(payLine);
      }

      if (act.productsDelivered && act.productsDelivered.length > 0) {
        const pList = act.productsDelivered
          .map(
            (p) =>
              `${p.name}: ${p.quantity} ${p.unit} x ${formatMoney(p.unitPrice)}$ = ${formatMoney(
                p.totalPrice || p.quantity * p.unitPrice
              )}$`
          )
          .join('; ');
        let dpStr = '';
        if (act.deliveryPayment) {
          const dp = act.deliveryPayment;
          dpStr = ` | To'lov holati: ${dp.paymentLabel}`;
          if (dp.paidAmount !== undefined && dp.paidAmount > 0) {
            dpStr += ` (To'landi: ${formatMoney(dp.paidAmount)}$`;
            if (dp.paidAmountUzs && dp.exchangeRate) {
              dpStr += `, ${formatMoney(dp.paidAmountUzs)} so'm @ ${formatMoney(dp.exchangeRate)}`;
            }
            if (dp.debtAmount && dp.debtAmount > 0) {
              dpStr += `, Nasiya qarzga: +${formatMoney(dp.debtAmount)}$`;
            }
            dpStr += `)`;
          } else if (dp.debtAmount && dp.debtAmount > 0) {
            dpStr += ` (Nasiya qarzga: +${formatMoney(dp.debtAmount)}$)`;
          }
        }
        productDetailsParts.push(`${prefix}${pList}${dpStr}`);
      }

      if (act.productsReturned && act.productsReturned.length > 0) {
        const rList = act.productsReturned
          .map((r) => `${r.name} (${r.quantity} ${r.unit})`)
          .join('; ');
        returnedDetailsParts.push(`${prefix}Qaytarildi: ${rList}`);
      }

      const notePart = act.reportNote ? ` — Izoh: ${act.reportNote}` : '';
      historySummaryParts.push(
        `${act.author} (${formatDateTimeUz(act.timestamp)}): ${getActionLabel(act.actionDone)}${notePart}`
      );
    });

    if (plan.closeReason) {
      historySummaryParts.unshift(`Yopilish izohi/sababi: ${plan.closeReason}`);
    } else if (plan.reportNote && historyList.length === 0) {
      historySummaryParts.push(`Izoh: ${plan.reportNote}`);
    }

    const lastActorStr = plan.isClosed
      ? `Yopdi: ${plan.closedBy || plan.lastExecutedBy || plan.agentUsername} (${formatDateTimeUz(
          plan.closedAt || plan.completedAt
        )})`
      : plan.lastExecutedBy
      ? `Bajardi: ${plan.lastExecutedBy} (${formatDateTimeUz(plan.lastExecutedAt || plan.completedAt)})`
      : '—';

    const planDateStr = plan.planDate
      ? `${plan.planDate} (${formatDateTimeUz(plan.createdAt)})`
      : formatDateTimeUz(plan.createdAt);

    const row = sheet.addRow([
      index + 1,
      planDateStr,
      client?.name || plan.clientName,
      formatPhoneList(phones),
      addressStr,
      currentDebt,
      currentAdvance,
      firstPlan.agentUsername,
      getActionLabel(plan.plannedAction),
      plannedAmt,
      plan.planNote || '—',
      statusText,
      plan.actionDone ? getActionLabel(plan.actionDone) : isClosedWithoutAction ? 'Bajarilmasdan yopilgan' : '—',
      lastActorStr,
      totals.totalPaymentAmount,
      paymentDetailsParts.length > 0 ? paymentDetailsParts.join('\n') : '—',
      totals.totalProductsValue,
      productDetailsParts.length > 0 ? productDetailsParts.join('\n') : '—',
      returnedDetailsParts.length > 0 ? returnedDetailsParts.join('\n') : '—',
      historySummaryParts.length > 0 ? historySummaryParts.join('\n') : '—',
    ]);

    const bgArgb = isClosedWithoutAction
      ? 'FFFFF1F2'
      : isDone
      ? 'FFF0FDF4'
      : isClosed
      ? 'FFF8FAFC'
      : 'FFFFFFFF';

    row.eachCell((cell, colNumber) => {
      cell.font = {
        name: 'Calibri',
        size: 10,
        bold: colNumber === 3 || colNumber === 6 || colNumber === 12 || colNumber === 15 || colNumber === 17,
        color: {
          argb:
            colNumber === 6 && currentDebt > 0
              ? 'FFDC2626'
              : colNumber === 7 && currentAdvance > 0
              ? 'FF059669'
              : colNumber === 12 && isClosedWithoutAction
              ? 'FFBE123C'
              : colNumber === 12 && isDone
              ? 'FF047857'
              : 'FF0F172A',
        },
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgArgb },
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal:
          colNumber === 1 || colNumber === 8 || colNumber === 12
            ? 'center'
            : [6, 7, 10, 15, 17].includes(colNumber)
            ? 'right'
            : 'left',
        wrapText: true,
      };
      if ([6, 7, 10, 15, 17].includes(colNumber)) {
        cell.numFmt = '#,##0.00';
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  });

  // Summary / Jami Row
  const totalRow = sheet.addRow([
    '',
    'JAMI KO\'RSATKICHLAR:',
    `${plans.length} ta reja / amal`,
    '',
    '',
    totalCurrentDebt,
    totalCurrentAdvance,
    '',
    '',
    totalPlannedAmt,
    '',
    '',
    '',
    '',
    totalPaidUsd,
    '',
    totalDeliveredUsd,
    '',
    '',
    '',
  ]);
  totalRow.height = 26;
  totalRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };
    if ([6, 7, 10, 15, 17].includes(colNumber)) {
      cell.numFmt = '#,##0.00';
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    } else {
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    }
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF94A3B8' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  const colWidths = [
    6,  // №
    20, // Reja sanasi
    28, // Mijoz F.I.Sh
    20, // Telefon
    28, // Manzil
    15, // Joriy Qarz
    15, // Joriy Haqdorlik
    14, // Rejaga kiritgan
    22, // Rejadagi amal
    16, // Rejadagi summa
    24, // Reja izohi
    22, // Holati
    22, // Bajarilgan amal
    26, // Oxirgi bajargan / Yopgan
    16, // To'lov USD
    38, // To'lov tafsilotlari
    16, // Mahsulot USD
    42, // Mahsulotlar ro'yxati
    26, // Qaytarilgan mahsulotlar
    42, // Hisobot / Yopilish sababi va tarix
  ];
  colWidths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `${filePrefix}_${dateStr}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
