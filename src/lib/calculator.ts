export type PaymentCategory = "food" | "drinks" | "venue" | "treat" | "other";

export const UNPAID_BILL_POT_ID = "__party_pot__";

export interface Person {
  id: string;
  name: string;
  avatarColor: string;
  timeIn: string; // "HH:mm"
  timeOut: string; // "HH:mm"
  isFreePass: boolean; // Special VIP / Exempt username (not counted in bill split)
}

export interface PaymentItem {
  id: string;
  title: string;
  amount: number;
  paidByPersonId: string; // Person.id or UNPAID_BILL_POT_ID
  isFreePayment: boolean; // Special Free Payment treat (not counted in shared split)
  category: PaymentCategory;
}

export interface PersonCalculation {
  person: Person;
  durationMinutes: number;
  durationFormatted: string;
  effectiveWeight: number;
  sharePercentage: number; // 0 to 100
  hourlyRate: number; // Effective cost per hour for this person
  paidShared: number; // Amount paid toward shared pool
  paidFreeTreat: number; // Amount paid as special free treat
  paidTotal: number;
  fairShare: number; // Amount they must pay based on time-in / time-out
  netBalance: number; // paidShared - fairShare (+ means receive back, - means owes)
  status: "receive" | "pay" | "exempt" | "settled";
}

export interface SettlementTransfer {
  id: string;
  fromPerson: Person;
  toPerson: Person;
  amount: number;
  isToPot?: boolean;
}

export interface PartyCalculationResult {
  totalAllInvoices: number;
  totalFreePayments: number;
  subtotalShared: number;
  serviceChargeAmount: number;
  totalSharedPool: number;
  totalPartyMinutes: number; // Sum of paying members' duration minutes
  costPerHourRate: number; // Shared pool cost per person-hour
  payingMembersCount: number;
  freePassMembersCount: number;
  personBreakdowns: PersonCalculation[];
  settlements: SettlementTransfer[];
}

export const AVATAR_GRADIENTS = [
  "from-indigo-500 to-purple-600",
  "from-emerald-500 to-teal-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-600",
  "from-cyan-500 to-blue-600",
  "from-fuchsia-500 to-violet-600",
  "from-lime-500 to-emerald-600",
  "from-sky-500 to-indigo-600",
];

export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(":")) return 0;
  const [hStr, mStr] = timeStr.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

export function getDurationMinutes(timeIn: string, timeOut: string): number {
  const inMins = parseTimeToMinutes(timeIn);
  const outMins = parseTimeToMinutes(timeOut);
  if (outMins === inMins) return 0;
  if (outMins > inMins) {
    return outMins - inMins;
  }
  // Overnight party (e.g. 19:00 to 01:30 next day)
  return 24 * 60 - inMins + outMins;
}

export function formatDuration(minutes: number): string {
  if (minutes <= 0) return "0m";
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}m`;
}

export function calculatePartyBill(
  people: Person[],
  payments: PaymentItem[],
  options: {
    splitMode: "time" | "equal";
    serviceChargePercent: number;
  }
): PartyCalculationResult {
  const { splitMode, serviceChargePercent } = options;

  let subtotalShared = 0;
  let totalFreePayments = 0;

  const peopleIds = new Set(people.map((p) => p.id));
  const paidSharedByPerson = new Map<string, number>();
  const paidFreeByPerson = new Map<string, number>();
  let unpaidPotAmount = 0;

  for (const payment of payments) {
    const validAmount =
      Number.isFinite(payment.amount) && payment.amount > 0 ? payment.amount : 0;

    // Resolve payer: if paidByPersonId is not a valid person and not explicitly the pot,
    // fall back to first person if available, or pot.
    const resolvedPayerId = peopleIds.has(payment.paidByPersonId)
      ? payment.paidByPersonId
      : payment.paidByPersonId === UNPAID_BILL_POT_ID
      ? UNPAID_BILL_POT_ID
      : people[0]?.id ?? UNPAID_BILL_POT_ID;

    if (payment.isFreePayment) {
      totalFreePayments += validAmount;
      if (resolvedPayerId !== UNPAID_BILL_POT_ID) {
        paidFreeByPerson.set(
          resolvedPayerId,
          (paidFreeByPerson.get(resolvedPayerId) ?? 0) + validAmount
        );
      }
    } else {
      subtotalShared += validAmount;
      if (resolvedPayerId === UNPAID_BILL_POT_ID) {
        unpaidPotAmount += validAmount;
      } else {
        paidSharedByPerson.set(
          resolvedPayerId,
          (paidSharedByPerson.get(resolvedPayerId) ?? 0) + validAmount
        );
      }
    }
  }

  const serviceChargeAmount =
    serviceChargePercent > 0 ? subtotalShared * (serviceChargePercent / 100) : 0;
  const totalSharedPool = subtotalShared + serviceChargeAmount;
  const totalAllInvoices = totalSharedPool + totalFreePayments;

  // Compute each person's stay duration and effective weight
  const rawBreakdowns = people.map((person) => {
    const durationMinutes = getDurationMinutes(person.timeIn, person.timeOut);
    let effectiveWeight = 0;
    if (!person.isFreePass) {
      effectiveWeight =
        splitMode === "time" ? durationMinutes : durationMinutes > 0 ? 1 : 0;
    }
    return {
      person,
      durationMinutes,
      effectiveWeight,
    };
  });

  const totalWeight = rawBreakdowns.reduce(
    (sum, item) => sum + item.effectiveWeight,
    0
  );
  const totalPartyMinutes = rawBreakdowns.reduce(
    (sum, item) => sum + (item.person.isFreePass ? 0 : item.durationMinutes),
    0
  );

  const costPerHourRate =
    totalPartyMinutes > 0 ? totalSharedPool / (totalPartyMinutes / 60) : 0;

  let payingMembersCount = 0;
  let freePassMembersCount = 0;

  const personBreakdowns: PersonCalculation[] = rawBreakdowns.map(
    ({ person, durationMinutes, effectiveWeight }) => {
      if (person.isFreePass) {
        freePassMembersCount += 1;
      } else if (effectiveWeight > 0) {
        payingMembersCount += 1;
      }

      const shareRatio = totalWeight > 0 ? effectiveWeight / totalWeight : 0;
      const fairShare = totalSharedPool * shareRatio;
      const paidShared = paidSharedByPerson.get(person.id) ?? 0;
      const paidFreeTreat = paidFreeByPerson.get(person.id) ?? 0;
      const paidTotal = paidShared + paidFreeTreat;
      const netBalance = paidShared - fairShare;

      const hours = durationMinutes / 60;
      const hourlyRate = hours > 0 && !person.isFreePass ? fairShare / hours : 0;

      let status: PersonCalculation["status"] = "settled";
      if (person.isFreePass && netBalance <= 0.005) {
        status = "exempt";
      } else if (netBalance > 0.005) {
        status = "receive";
      } else if (netBalance < -0.005) {
        status = "pay";
      }

      return {
        person,
        durationMinutes,
        durationFormatted: formatDuration(durationMinutes),
        effectiveWeight,
        sharePercentage: shareRatio * 100,
        hourlyRate,
        paidShared,
        paidFreeTreat,
        paidTotal,
        fairShare,
        netBalance,
        status,
      };
    }
  );

  // Calculate optimal Who Pays Whom settlements
  const debtors = personBreakdowns
    .filter((b) => b.netBalance < -0.005)
    .map((b) => ({ person: b.person, amount: Math.abs(b.netBalance) }))
    .sort((a, b) => b.amount - a.amount);

  const creditors = personBreakdowns
    .filter((b) => b.netBalance > 0.005)
    .map((b) => ({
      person: b.person,
      amount: b.netBalance,
      isToPot: false,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Any unpaid bill amount or service charge not yet fronted by a person goes to Cashier / Party Bill Pot
  const unpaidPlusService = unpaidPotAmount + serviceChargeAmount;
  if (unpaidPlusService > 0.005) {
    creditors.push({
      person: {
        id: UNPAID_BILL_POT_ID,
        name: "🧾 Cashier / Bill Pot",
        avatarColor: "from-slate-600 to-slate-800",
        timeIn: "00:00",
        timeOut: "00:00",
        isFreePass: false,
      },
      amount: unpaidPlusService,
      isToPot: true,
    });
  }

  const settlements: SettlementTransfer[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const transferAmount = Math.min(debtor.amount, creditor.amount);

    if (transferAmount > 0.005) {
      settlements.push({
        id: `${debtor.person.id}->${creditor.person.id}`,
        fromPerson: debtor.person,
        toPerson: creditor.person,
        amount: transferAmount,
        isToPot: creditor.isToPot,
      });
    }

    debtor.amount -= transferAmount;
    creditor.amount -= transferAmount;

    if (debtor.amount <= 0.005) i += 1;
    if (creditor.amount <= 0.005) j += 1;
  }

  return {
    totalAllInvoices,
    totalFreePayments,
    subtotalShared,
    serviceChargeAmount,
    totalSharedPool,
    totalPartyMinutes,
    costPerHourRate,
    payingMembersCount,
    freePassMembersCount,
    personBreakdowns,
    settlements,
  };
}
