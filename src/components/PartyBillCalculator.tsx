"use client";

import React, { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import {
  Users,
  Receipt,
  Clock,
  Sparkles,
  Plus,
  Trash2,
  Volume2,
  VolumeX,
  Gift,
  Crown,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Copy,
  Check,
  Calculator,
  SlidersHorizontal,
  PartyPopper,
  Info,
  Wallet,
} from "lucide-react";
import {
  Person,
  PaymentItem,
  PaymentCategory,
  AVATAR_GRADIENTS,
  calculatePartyBill,
  formatDuration,
  getDurationMinutes,
  parseTimeToMinutes,
} from "@/lib/calculator";
import { sound } from "@/lib/sound";

interface CurrencyOption {
  code: string;
  symbol: string;
  label: string;
  decimals: number;
}

const CURRENCIES: CurrencyOption[] = [
  { code: "USD", symbol: "$", label: "USD ($)", decimals: 2 },
  { code: "KHR", symbol: "៛", label: "KHR (៛)", decimals: 0 },
  { code: "EUR", symbol: "€", label: "EUR (€)", decimals: 2 },
  { code: "THB", symbol: "฿", label: "THB (฿)", decimals: 2 },
];

const QUICK_ITEMS: { label: string; title: string; category: PaymentCategory }[] = [
  { label: "🍖 BBQ & Meat", title: "BBQ & Hotpot Set", category: "food" },
  { label: "🍻 Beer Tower", title: "Craft Beer & Drinks", category: "drinks" },
  { label: "🎤 Karaoke Room", title: "VIP Karaoke Room", category: "venue" },
  { label: "🎂 Birthday Cake", title: "Birthday Cake Treat", category: "treat" },
  { label: "🍢 Snacks & Ice", title: "Mixers, Fruit & Ice", category: "other" },
];

const INITIAL_PEOPLE: Person[] = [
  {
    id: "p-1",
    name: "Sokha",
    avatarColor: AVATAR_GRADIENTS[0],
    timeIn: "18:00",
    timeOut: "23:00",
    isFreePass: false,
  },
  {
    id: "p-2",
    name: "Dara",
    avatarColor: AVATAR_GRADIENTS[1],
    timeIn: "18:00",
    timeOut: "23:00",
    isFreePass: false,
  },
  {
    id: "p-3",
    name: "Bopha",
    avatarColor: AVATAR_GRADIENTS[2],
    timeIn: "19:30",
    timeOut: "23:00",
    isFreePass: false,
  },
  {
    id: "p-4",
    name: "Vannak",
    avatarColor: AVATAR_GRADIENTS[3],
    timeIn: "18:00",
    timeOut: "21:00",
    isFreePass: false,
  },
  {
    id: "p-5",
    name: "Nary (Birthday)",
    avatarColor: AVATAR_GRADIENTS[4],
    timeIn: "18:00",
    timeOut: "23:00",
    isFreePass: true, // Exempt VIP guest
  },
];

const INITIAL_PAYMENTS: PaymentItem[] = [
  {
    id: "pay-1",
    title: "BBQ & Hotpot Platter",
    amount: 85,
    paidByPersonId: "p-1",
    isFreePayment: false,
    category: "food",
  },
  {
    id: "pay-2",
    title: "Beer Towers & Cocktails",
    amount: 55,
    paidByPersonId: "p-2",
    isFreePayment: false,
    category: "drinks",
  },
  {
    id: "pay-3",
    title: "KTV Room Fee (5 Hours)",
    amount: 40,
    paidByPersonId: "p-1",
    isFreePayment: false,
    category: "venue",
  },
  {
    id: "pay-4",
    title: "Birthday Cake & Champagne (Special Treat!)",
    amount: 35,
    paidByPersonId: "p-3",
    isFreePayment: true, // Special free payment by selected username (not counted in split)
    category: "treat",
  },
];

function adjustTimeString(timeStr: string, deltaMinutes: number): string {
  const mins = parseTimeToMinutes(timeStr);
  const next = (((mins + deltaMinutes) % 1440) + 1440) % 1440;
  const h = Math.floor(next / 60);
  const m = next % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function PartyBillCalculator() {
  // Global Party Fixed Parameters
  const [defaultTimeIn, setDefaultTimeIn] = useState<string>("18:00");
  const [defaultTimeOut, setDefaultTimeOut] = useState<string>("23:00");
  const [splitMode, setSplitMode] = useState<"time" | "equal">("time");
  const [serviceChargePercent, setServiceChargePercent] = useState<number>(0);
  const [currency, setCurrency] = useState<CurrencyOption>(CURRENCIES[0]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // People state
  const [people, setPeople] = useState<Person[]>(INITIAL_PEOPLE);
  const [newPersonName, setNewPersonName] = useState<string>("");
  const [newPersonTimeIn, setNewPersonTimeIn] = useState<string>("18:00");
  const [newPersonTimeOut, setNewPersonTimeOut] = useState<string>("23:00");
  const [newPersonIsFreePass, setNewPersonIsFreePass] = useState<boolean>(false);

  // Payment form state
  const [payments, setPayments] = useState<PaymentItem[]>(INITIAL_PAYMENTS);
  const [paymentTitle, setPaymentTitle] = useState<string>("");
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentPaidBy, setPaymentPaidBy] = useState<string>(INITIAL_PEOPLE[0].id);
  const [paymentIsFree, setPaymentIsFree] = useState<boolean>(false);
  const [paymentCategory, setPaymentCategory] = useState<PaymentCategory>("food");

  // Settlement tracking state
  const [settledTransferIds, setSettledTransferIds] = useState<Set<string>>(new Set());
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);

  // Format currency helper
  const formatMoney = useCallback(
    (value: number) => {
      const absVal = Math.abs(value);
      const formatted = absVal.toLocaleString("en-US", {
        minimumFractionDigits: currency.decimals,
        maximumFractionDigits: currency.decimals,
      });
      return `${value < -0.005 ? "-" : ""}${currency.symbol}${formatted}`;
    },
    [currency]
  );

  // Derived calculation
  const calculation = useMemo(
    () =>
      calculatePartyBill(people, payments, {
        splitMode,
        serviceChargePercent,
      }),
    [people, payments, splitMode, serviceChargePercent]
  );

  // Sound toggle handler
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sound.setEnabled(next);
    if (next) {
      sound.playPop();
    }
  };

  // Sync fixed Time In / Time Out to new person inputs or all members
  const handleFixedTimeChange = (field: "in" | "out", value: string) => {
    sound.playTimeTick();
    if (field === "in") {
      setDefaultTimeIn(value);
      setNewPersonTimeIn(value);
    } else {
      setDefaultTimeOut(value);
      setNewPersonTimeOut(value);
    }
  };

  const applyFixedTimeToAll = () => {
    sound.playSwitch();
    setPeople((prev) =>
      prev.map((person) => ({
        ...person,
        timeIn: defaultTimeIn,
        timeOut: defaultTimeOut,
      }))
    );
  };

  // Add Person handler
  const handleAddPerson = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newPersonName.trim();
    if (!trimmed) return;

    const id = `p-${Date.now()}`;
    const nextPerson: Person = {
      id,
      name: trimmed,
      avatarColor: AVATAR_GRADIENTS[people.length % AVATAR_GRADIENTS.length],
      timeIn: newPersonTimeIn || defaultTimeIn,
      timeOut: newPersonTimeOut || defaultTimeOut,
      isFreePass: newPersonIsFreePass,
    };

    if (newPersonIsFreePass) {
      sound.playGiftSparkle();
    } else {
      sound.playPop();
    }

    setPeople((prev) => [...prev, nextPerson]);
    if (!paymentPaidBy) {
      setPaymentPaidBy(id);
    }
    setNewPersonName("");
    setNewPersonTimeIn(defaultTimeIn);
    setNewPersonTimeOut(defaultTimeOut);
    setNewPersonIsFreePass(false);
  };

  const handleUpdatePersonTime = (personId: string, field: "timeIn" | "timeOut", value: string) => {
    sound.playTimeTick();
    setPeople((prev) =>
      prev.map((p) => (p.id === personId ? { ...p, [field]: value } : p))
    );
  };

  const handleNudgePersonTime = (
    personId: string,
    field: "timeIn" | "timeOut",
    deltaMinutes: number
  ) => {
    sound.playTimeTick();
    setPeople((prev) =>
      prev.map((p) =>
        p.id === personId
          ? { ...p, [field]: adjustTimeString(p[field], deltaMinutes) }
          : p
      )
    );
  };

  const handleTogglePersonFreePass = (personId: string) => {
    setPeople((prev) =>
      prev.map((p) => {
        if (p.id !== personId) return p;
        const nextVal = !p.isFreePass;
        if (nextVal) {
          sound.playGiftSparkle();
        } else {
          sound.playSwitch();
        }
        return { ...p, isFreePass: nextVal };
      })
    );
  };

  const handleRemovePerson = (personId: string) => {
    sound.playRemove();
    setPeople((prev) => {
      const filtered = prev.filter((p) => p.id !== personId);
      if (paymentPaidBy === personId && filtered.length > 0) {
        setPaymentPaidBy(filtered[0].id);
      }
      return filtered;
    });
    setPayments((prev) => prev.filter((pay) => pay.paidByPersonId !== personId));
  };

  // Add Payment handler
  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(paymentAmount);
    if (!Number.isFinite(numAmount) || numAmount <= 0 || !paymentPaidBy) return;

    const finalTitle =
      paymentTitle.trim() ||
      (paymentIsFree ? "Special Free Treat 🎁" : `Party Invoice #${payments.length + 1}`);

    const nextPayment: PaymentItem = {
      id: `pay-${Date.now()}`,
      title: finalTitle,
      amount: numAmount,
      paidByPersonId: paymentPaidBy,
      isFreePayment: paymentIsFree,
      category: paymentIsFree ? "treat" : paymentCategory,
    };

    if (paymentIsFree) {
      sound.playGiftSparkle();
    } else {
      sound.playCoin();
    }

    setPayments((prev) => [nextPayment, ...prev]);
    setPaymentTitle("");
    setPaymentAmount("");
    setPaymentIsFree(false);
  };

  const handleTogglePaymentFree = (paymentId: string) => {
    setPayments((prev) =>
      prev.map((item) => {
        if (item.id !== paymentId) return item;
        const nextFree = !item.isFreePayment;
        if (nextFree) {
          sound.playGiftSparkle();
        } else {
          sound.playCoin();
        }
        return { ...item, isFreePayment: nextFree };
      })
    );
  };

  const handleChangePaymentPayer = (paymentId: string, nextPersonId: string) => {
    sound.playSwitch();
    setPayments((prev) =>
      prev.map((item) =>
        item.id === paymentId ? { ...item, paidByPersonId: nextPersonId } : item
      )
    );
  };

  const handleRemovePayment = (paymentId: string) => {
    sound.playRemove();
    setPayments((prev) => prev.filter((item) => item.id !== paymentId));
  };

  // Toggle transfer settled with confetti + fanfare
  const handleToggleSettled = (transferId: string) => {
    setSettledTransferIds((prev) => {
      const next = new Set(prev);
      if (next.has(transferId)) {
        next.delete(transferId);
        sound.playSwitch();
      } else {
        next.add(transferId);
        sound.playSettleSuccess();
        confetti({
          particleCount: 55,
          spread: 65,
          origin: { y: 0.75 },
          colors: ["#6366f1", "#10b981", "#f59e0b", "#ec4899"],
        });
      }
      return next;
    });
  };

  const handleResetDemo = () => {
    sound.playSettleSuccess();
    setDefaultTimeIn("18:00");
    setDefaultTimeOut("23:00");
    setPeople(INITIAL_PEOPLE);
    setPayments(INITIAL_PAYMENTS);
    setSettledTransferIds(new Set());
  };

  const handleClearAll = () => {
    sound.playRemove();
    setPeople([]);
    setPayments([]);
    setSettledTransferIds(new Set());
  };

  const handleCopySummary = () => {
    sound.playSettleSuccess();
    const lines: string[] = [
      `🎉 PARTY BILL CALCULATOR SUMMARY`,
      `⏱️ Party Window: ${defaultTimeIn} → ${defaultTimeOut} (${
        splitMode === "time" ? "Time-Weighted Fair Split" : "Equal Headcount Split"
      })`,
      `💰 Total Shared Bill: ${formatMoney(calculation.totalSharedPool)}`,
    ];

    if (calculation.totalFreePayments > 0) {
      lines.push(
        `🎁 Special Free Treats (Not Counted): ${formatMoney(calculation.totalFreePayments)}`
      );
    }

    lines.push("", "👥 INDIVIDUAL SHARES (By Time In / Time Out):");
    calculation.personBreakdowns.forEach((b) => {
      if (b.person.isFreePass) {
        lines.push(
          `• ${b.person.name} [${b.person.timeIn}-${b.person.timeOut}, ${b.durationFormatted}]: ✨ FREE PASS ($0 share) | Paid: ${formatMoney(b.paidShared)}`
        );
      } else {
        lines.push(
          `• ${b.person.name} [${b.person.timeIn}-${b.person.timeOut}, ${b.durationFormatted} • ${b.sharePercentage.toFixed(1)}%]: Share ${formatMoney(b.fairShare)} | Paid ${formatMoney(b.paidShared)}`
        );
      }
    });

    if (calculation.settlements.length > 0) {
      lines.push("", "💸 WHO PAYS WHOM:");
      calculation.settlements.forEach((s) => {
        lines.push(
          `• ${s.fromPerson.name} ➔ pays ${s.toPerson.name}: ${formatMoney(s.amount)}`
        );
      });
    }

    navigator.clipboard.writeText(lines.join("\n")).catch(() => {});
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2200);
  };

  const partyDefaultDuration = formatDuration(
    getDurationMinutes(defaultTimeIn, defaultTimeOut)
  );

  return (
    <div className="min-h-screen bg-[#080b12] text-slate-100 relative overflow-hidden pb-20">
      {/* Ambient Background Glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-36 -left-36 w-96 h-96 rounded-full bg-indigo-600/20 blur-[120px] animate-pulse-glow" />
        <div className="absolute top-1/3 -right-36 w-[28rem] h-[28rem] rounded-full bg-fuchsia-600/15 blur-[130px] animate-pulse-glow" />
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 rounded-full bg-emerald-500/15 blur-[120px] animate-pulse-glow" />
      </div>

      {/* Top Navigation & Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#080b12]/80 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ rotate: 12, scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => sound.playGiftSparkle()}
              className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 cursor-pointer"
            >
              <PartyPopper className="w-6 h-6 text-white" />
            </motion.div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-indigo-200 to-fuchsia-200 bg-clip-text text-transparent">
                  PartySplit Time-Sync
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  <Sparkles className="w-3 h-3" /> Time In / Out Fair Bill
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Divide party invoices fairly by stay duration, with special Free Treats & VIP Free Passes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Currency Switcher */}
            <div className="flex items-center bg-slate-900/90 border border-white/10 rounded-xl p-1">
              {CURRENCIES.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => {
                    sound.playSwitch();
                    setCurrency(c);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    currency.code === c.code
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {c.code}
                </button>
              ))}
            </div>

            {/* Sound Effects Toggle */}
            <motion.button
              whileTap={{ scale: 0.93 }}
              type="button"
              onClick={toggleSound}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                soundEnabled
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25"
                  : "bg-slate-900 border-white/10 text-slate-400 hover:text-slate-200"
              }`}
              title="Toggle UI Sound Effects"
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                  <span className="hidden sm:inline">Sound ON</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-slate-500" />
                  <span className="hidden sm:inline">Muted</span>
                </>
              )}
            </motion.button>

            {/* Demo Reset */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={handleResetDemo}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Demo Party</span>
            </motion.button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Fixed Party Time Parameters & Split Mode Bar */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-slate-900/75 backdrop-blur-xl border border-white/10 p-4 sm:p-5 shadow-xl"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <SlidersHorizontal className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
                  Fixed Party Parameters (Default Time In & Time Out)
                  <span className="px-2 py-0.5 text-[11px] rounded-md bg-indigo-500/20 text-indigo-300 font-medium">
                    {partyDefaultDuration} window
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Set the base party start & end time. Everyone pays equally per hour based on their individual Time In and Time Out.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Fixed Time In */}
              <div className="flex items-center gap-2 bg-slate-950/90 border border-white/10 rounded-xl px-3 py-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <label htmlFor="fixed-time-in" className="text-xs text-slate-400">
                  Party Time In:
                </label>
                <input
                  id="fixed-time-in"
                  type="time"
                  value={defaultTimeIn}
                  onChange={(e) => handleFixedTimeChange("in", e.target.value)}
                  className="bg-transparent text-xs sm:text-sm font-semibold text-white focus:outline-none cursor-pointer"
                />
              </div>

              {/* Fixed Time Out */}
              <div className="flex items-center gap-2 bg-slate-950/90 border border-white/10 rounded-xl px-3 py-1.5">
                <Clock className="w-3.5 h-3.5 text-fuchsia-400" />
                <label htmlFor="fixed-time-out" className="text-xs text-slate-400">
                  Party Time Out:
                </label>
                <input
                  id="fixed-time-out"
                  type="time"
                  value={defaultTimeOut}
                  onChange={(e) => handleFixedTimeChange("out", e.target.value)}
                  className="bg-transparent text-xs sm:text-sm font-semibold text-white focus:outline-none cursor-pointer"
                />
              </div>

              {/* Apply fixed window to everyone */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={applyFixedTimeToAll}
                className="px-3 py-2 rounded-xl text-xs font-medium bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 transition-all cursor-pointer"
              >
                Sync All People to {defaultTimeIn}–{defaultTimeOut}
              </motion.button>

              {/* Split Mode Toggle */}
              <div className="flex items-center bg-slate-950/90 border border-white/10 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => {
                    sound.playSwitch();
                    setSplitMode("time");
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    splitMode === "time"
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  ⏱️ By Time In/Out
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sound.playSwitch();
                    setSplitMode("equal");
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    splitMode === "equal"
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  ⚖️ Flat Equal
                </button>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Top Live KPI Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            layout
            className="rounded-2xl bg-gradient-to-br from-indigo-950/70 via-slate-900/90 to-slate-900/90 border border-indigo-500/30 p-4 shadow-lg"
          >
            <div className="flex items-center justify-between text-xs text-indigo-300 mb-1">
              <span className="font-medium">Shared Bill to Divide</span>
              <Receipt className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {formatMoney(calculation.totalSharedPool)}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
              <span>Total all bills: {formatMoney(calculation.totalAllInvoices)}</span>
              <span className="text-indigo-300 font-medium">
                {payments.filter((p) => !p.isFreePayment).length} shared items
              </span>
            </div>
          </motion.div>

          <motion.div
            layout
            className="rounded-2xl bg-gradient-to-br from-amber-950/50 via-slate-900/90 to-slate-900/90 border border-amber-500/30 p-4 shadow-lg"
          >
            <div className="flex items-center justify-between text-xs text-amber-300 mb-1">
              <span className="font-medium">Special Free Payments (Treats)</span>
              <Gift className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-300 tracking-tight">
              {formatMoney(calculation.totalFreePayments)}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
              <span>Excluded from party split</span>
              <span className="text-amber-300 font-medium">
                {payments.filter((p) => p.isFreePayment).length} free treats
              </span>
            </div>
          </motion.div>

          <motion.div
            layout
            className="rounded-2xl bg-gradient-to-br from-fuchsia-950/50 via-slate-900/90 to-slate-900/90 border border-fuchsia-500/30 p-4 shadow-lg"
          >
            <div className="flex items-center justify-between text-xs text-fuchsia-300 mb-1">
              <span className="font-medium">Equal Rate per Person-Hour</span>
              <Clock className="w-4 h-4 text-fuchsia-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {formatMoney(calculation.costPerHourRate)}
              <span className="text-sm font-normal text-slate-400"> / hr</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
              <span>Total active party time:</span>
              <span className="text-fuchsia-300 font-medium">
                {formatDuration(calculation.totalPartyMinutes)}
              </span>
            </div>
          </motion.div>

          <motion.div
            layout
            className="rounded-2xl bg-gradient-to-br from-emerald-950/50 via-slate-900/90 to-slate-900/90 border border-emerald-500/30 p-4 shadow-lg"
          >
            <div className="flex items-center justify-between text-xs text-emerald-300 mb-1">
              <span className="font-medium">Party Roster Status</span>
              <Users className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {calculation.payingMembersCount}{" "}
              <span className="text-sm font-normal text-slate-400">paying</span>
              {calculation.freePassMembersCount > 0 ? (
                <span className="ml-2 text-sm font-semibold text-amber-300">
                  + {calculation.freePassMembersCount} Free VIP
                </span>
              ) : null}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
              <span>Total in party: {people.length} people</span>
              {people.length > 0 ? (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-rose-400 hover:text-rose-300 underline cursor-pointer"
                >
                  Clear All
                </button>
              ) : null}
            </div>
          </motion.div>
        </section>

        {/* Main 12-Column Interactive Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT 7 COLUMNS: 1) People & Time In/Out + 2) Payments by Username */}
          <div className="lg:col-span-7 space-y-6">
            {/* SECTION 1: PEOPLE IN THE PARTY & TIME IN / TIME OUT */}
            <section className="rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-white/10 p-5 shadow-xl">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                    <Users className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">
                      1. Party People & Time In / Time Out
                    </h2>
                    <p className="text-xs text-slate-400">
                      Add people, adjust their Time In & Time Out, or mark a VIP username as Free Pass
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-white/10">
                  {people.length} {people.length === 1 ? "Person" : "People"}
                </span>
              </div>

              {/* Add Person Form */}
              <form
                onSubmit={handleAddPerson}
                className="p-3.5 rounded-xl bg-slate-950/80 border border-white/10 space-y-3 mb-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <div className="sm:col-span-5">
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Person / Username
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Meng, Dara, Pich..."
                      value={newPersonName}
                      onChange={(e) => setNewPersonName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Time In
                    </label>
                    <input
                      type="time"
                      value={newPersonTimeIn}
                      onChange={(e) => {
                        sound.playTimeTick();
                        setNewPersonTimeIn(e.target.value);
                      }}
                      className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-white/10 text-sm text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Time Out
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={newPersonTimeOut}
                        onChange={(e) => {
                          sound.playTimeTick();
                          setNewPersonTimeOut(e.target.value);
                        }}
                        className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-white/10 text-sm text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                      />
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.95 }}
                        type="submit"
                        className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold flex items-center gap-1 shrink-0 shadow-md shadow-indigo-600/30 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add</span>
                      </motion.button>
                    </div>
                  </div>
                </div>

                {/* Special Free Pass Option on Add */}
                <div className="flex items-center justify-between pt-1 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => {
                      const next = !newPersonIsFreePass;
                      setNewPersonIsFreePass(next);
                      if (next) sound.playGiftSparkle();
                      else sound.playSwitch();
                    }}
                    className={`flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      newPersonIsFreePass
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : "bg-slate-900 text-slate-400 border border-white/5 hover:text-slate-200"
                    }`}
                  >
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                    <span>
                      {newPersonIsFreePass
                        ? "✨ Special Free Pass Active (Not counted in bill split)"
                        : "Mark this person as Free Pass / Exempt ($0 share)"}
                    </span>
                  </button>

                  <span className="text-[11px] text-slate-400">
                    Duration:{" "}
                    <strong className="text-indigo-300">
                      {formatDuration(getDurationMinutes(newPersonTimeIn, newPersonTimeOut))}
                    </strong>
                  </span>
                </div>
              </form>

              {/* People List */}
              <div className="space-y-2.5">
                <AnimatePresence initial={false}>
                  {calculation.personBreakdowns.map((b) => {
                    const { person, durationFormatted, sharePercentage, fairShare } = b;
                    return (
                      <motion.div
                        key={person.id}
                        layout
                        initial={{ opacity: 0, scale: 0.96, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, x: -20 }}
                        transition={{ duration: 0.2 }}
                        className={`rounded-xl p-3.5 border transition-all ${
                          person.isFreePass
                            ? "bg-gradient-to-r from-amber-950/35 via-slate-900/90 to-slate-900/90 border-amber-500/40"
                            : "bg-slate-950/60 border-white/10 hover:border-indigo-500/30"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {/* Avatar + Name + Badges */}
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-10 h-10 rounded-xl bg-gradient-to-br ${person.avatarColor} flex items-center justify-center font-bold text-white text-sm shrink-0 shadow-md`}
                            >
                              {person.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm text-white truncate">
                                  {person.name}
                                </span>
                                {person.isFreePass ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                    <Crown className="w-3 h-3" /> Free Pass (Not Counted)
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-500/15 text-indigo-300">
                                    {durationFormatted} • {sharePercentage.toFixed(1)}% weight
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                                <span>
                                  Share to pay:{" "}
                                  <strong
                                    className={
                                      person.isFreePass ? "text-amber-300" : "text-white"
                                    }
                                  >
                                    {person.isFreePass ? "FREE ($0)" : formatMoney(fairShare)}
                                  </strong>
                                </span>
                                {b.paidTotal > 0 ? (
                                  <span className="text-emerald-400">
                                    • Fronted {formatMoney(b.paidTotal)}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          {/* Time In & Time Out Controls + Free Pass Toggle */}
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Time In Input + Quick +/- 30m */}
                            <div className="flex items-center bg-slate-900 border border-white/10 rounded-lg px-2 py-1 gap-1">
                              <span className="text-[10px] uppercase tracking-wider text-slate-400">
                                In
                              </span>
                              <button
                                type="button"
                                onClick={() => handleNudgePersonTime(person.id, "timeIn", -30)}
                                className="px-1 text-xs text-slate-400 hover:text-white cursor-pointer"
                                title="Earlier 30m"
                              >
                                -
                              </button>
                              <input
                                type="time"
                                value={person.timeIn}
                                onChange={(e) =>
                                  handleUpdatePersonTime(person.id, "timeIn", e.target.value)
                                }
                                className="bg-transparent text-xs font-semibold text-indigo-200 focus:outline-none cursor-pointer"
                              />
                              <button
                                type="button"
                                onClick={() => handleNudgePersonTime(person.id, "timeIn", 30)}
                                className="px-1 text-xs text-slate-400 hover:text-white cursor-pointer"
                                title="Later 30m"
                              >
                                +
                              </button>
                            </div>

                            <span className="text-slate-500 text-xs">→</span>

                            {/* Time Out Input + Quick +/- 30m */}
                            <div className="flex items-center bg-slate-900 border border-white/10 rounded-lg px-2 py-1 gap-1">
                              <span className="text-[10px] uppercase tracking-wider text-slate-400">
                                Out
                              </span>
                              <button
                                type="button"
                                onClick={() => handleNudgePersonTime(person.id, "timeOut", -30)}
                                className="px-1 text-xs text-slate-400 hover:text-white cursor-pointer"
                                title="Left 30m earlier"
                              >
                                -
                              </button>
                              <input
                                type="time"
                                value={person.timeOut}
                                onChange={(e) =>
                                  handleUpdatePersonTime(person.id, "timeOut", e.target.value)
                                }
                                className="bg-transparent text-xs font-semibold text-fuchsia-200 focus:outline-none cursor-pointer"
                              />
                              <button
                                type="button"
                                onClick={() => handleNudgePersonTime(person.id, "timeOut", 30)}
                                className="px-1 text-xs text-slate-400 hover:text-white cursor-pointer"
                                title="Stayed 30m later"
                              >
                                +
                              </button>
                            </div>

                            {/* Free Pass Toggle Button */}
                            <button
                              type="button"
                              onClick={() => handleTogglePersonFreePass(person.id)}
                              title="Toggle VIP Free Pass (Exempt from bill split)"
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer flex items-center gap-1 ${
                                person.isFreePass
                                  ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                                  : "bg-slate-900 border-white/10 text-slate-400 hover:text-amber-300"
                              }`}
                            >
                              <Crown className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">
                                {person.isFreePass ? "Free Pass" : "Free?"}
                              </span>
                            </button>

                            {/* Remove Person */}
                            <button
                              type="button"
                              onClick={() => handleRemovePerson(person.id)}
                              className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-white/5 transition-colors cursor-pointer"
                              title="Remove person"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Visual Stay Duration Progress Bar */}
                        <div className="mt-2.5 w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{
                              width: person.isFreePass
                                ? "100%"
                                : `${Math.max(4, Math.min(100, sharePercentage))}%`,
                            }}
                            transition={{ type: "spring", stiffness: 120, damping: 20 }}
                            className={`h-full rounded-full ${
                              person.isFreePass
                                ? "bg-gradient-to-r from-amber-400 to-yellow-300"
                                : "bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500"
                            }`}
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {people.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-sm border border-dashed border-white/10 rounded-xl">
                    No people in the party yet. Add someone above to start splitting!
                  </div>
                ) : null}
              </div>
            </section>

            {/* SECTION 2: PAYMENTS BY PEOPLE & SPECIAL FREE PAYMENT */}
            <section className="rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-white/10 p-5 shadow-xl">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">
                      2. List of Payments by People & Special Free Payments
                    </h2>
                    <p className="text-xs text-slate-400">
                      Record each bill paid by a username, or mark it as a Special Free Payment (excluded from split)
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-white/10">
                  {payments.length} {payments.length === 1 ? "Payment" : "Payments"}
                </span>
              </div>

              {/* Quick Preset Chips */}
              <div className="flex items-center gap-1.5 flex-wrap mb-3">
                <span className="text-[11px] text-slate-400 mr-1">Quick fill:</span>
                {QUICK_ITEMS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      sound.playPop();
                      setPaymentTitle(item.title);
                      setPaymentCategory(item.category);
                      if (item.category === "treat") {
                        setPaymentIsFree(true);
                      }
                    }}
                    className="px-2.5 py-1 rounded-full text-xs bg-slate-950/90 hover:bg-indigo-500/20 text-slate-300 hover:text-indigo-200 border border-white/10 transition-colors cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Add Payment Form */}
              <form
                onSubmit={handleAddPayment}
                className={`p-4 rounded-xl border space-y-3 mb-4 transition-all ${
                  paymentIsFree
                    ? "bg-gradient-to-br from-amber-950/40 via-slate-950/90 to-slate-950/90 border-amber-500/40"
                    : "bg-slate-950/80 border-white/10"
                }`}
              >
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-5">
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Payment / Invoice Description
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Beer Tower, BBQ, Cake..."
                      value={paymentTitle}
                      onChange={(e) => setPaymentTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Amount ({currency.symbol})
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Paid By (Select Username)
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={paymentPaidBy}
                        onChange={(e) => {
                          sound.playSwitch();
                          setPaymentPaidBy(e.target.value);
                        }}
                        className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-white/10 text-sm text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        {people.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.95 }}
                        type="submit"
                        disabled={people.length === 0}
                        className={`px-3.5 py-2 rounded-lg text-white text-sm font-semibold flex items-center gap-1 shrink-0 shadow-md cursor-pointer disabled:opacity-40 ${
                          paymentIsFree
                            ? "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/25"
                            : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25"
                        }`}
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add</span>
                      </motion.button>
                    </div>
                  </div>
                </div>

                {/* Special Free Payment Toggle Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => {
                      const next = !paymentIsFree;
                      setPaymentIsFree(next);
                      if (next) sound.playGiftSparkle();
                      else sound.playSwitch();
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      paymentIsFree
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm"
                        : "bg-slate-900 text-slate-400 border border-white/5 hover:text-slate-200"
                    }`}
                  >
                    <Gift className="w-4 h-4 text-amber-400" />
                    <span>
                      {paymentIsFree
                        ? "🎁 Special Free Payment ON — Paid as a treat by selected username (NOT counted in shared bill!)"
                        : "Mark as Special Free Payment (Treat by selected username — not counted in split)"}
                    </span>
                  </button>
                </div>
              </form>

              {/* Payments List */}
              <div className="space-y-2.5">
                <AnimatePresence initial={false}>
                  {payments.map((item) => {
                    const payer = people.find((p) => p.id === item.paidByPersonId);
                    return (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 10, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -20, scale: 0.95 }}
                        className={`rounded-xl p-3.5 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                          item.isFreePayment
                            ? "bg-gradient-to-r from-amber-950/40 via-slate-900/90 to-slate-900/90 border-amber-500/40"
                            : "bg-slate-950/60 border-white/10 hover:border-emerald-500/30"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                              item.isFreePayment
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                            }`}
                          >
                            {item.isFreePayment ? (
                              <Gift className="w-5 h-5" />
                            ) : (
                              <Wallet className="w-5 h-5" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-white truncate">
                                {item.title}
                              </span>
                              {item.isFreePayment ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/25 text-amber-300 border border-amber-500/40">
                                  <Sparkles className="w-3 h-3" /> Special Free Payment (Not Counted)
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-300">
                                  Shared Invoice
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                              <span>Paid by username:</span>
                              <select
                                value={item.paidByPersonId}
                                onChange={(e) =>
                                  handleChangePaymentPayer(item.id, e.target.value)
                                }
                                className="bg-slate-900 border border-white/10 rounded-md px-2 py-0.5 text-xs font-semibold text-indigo-300 focus:outline-none cursor-pointer"
                              >
                                {people.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                              {item.isFreePayment && payer ? (
                                <span className="text-amber-300/90 italic">
                                  ({payer.name}&apos;s generous treat!)
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-2.5">
                          <div className="text-right">
                            <div
                              className={`text-base font-extrabold ${
                                item.isFreePayment
                                  ? "text-amber-300 line-through decoration-amber-500/60"
                                  : "text-white"
                              }`}
                            >
                              {formatMoney(item.amount)}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {item.isFreePayment ? "Excluded from split" : "In shared pool"}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleTogglePaymentFree(item.id)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer flex items-center gap-1 ${
                              item.isFreePayment
                                ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                                : "bg-slate-900 border-white/10 text-slate-400 hover:text-amber-300"
                            }`}
                            title="Toggle Special Free Payment (Not counted in split)"
                          >
                            <Gift className="w-3.5 h-3.5" />
                            <span>{item.isFreePayment ? "Free Treat" : "Make Free"}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemovePayment(item.id)}
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-white/5 transition-colors cursor-pointer"
                            title="Delete payment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {payments.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-sm border border-dashed border-white/10 rounded-xl">
                    No payments added yet. Add a bill above to calculate everyone&apos;s share!
                  </div>
                ) : null}
              </div>
            </section>
          </div>

          {/* RIGHT 5 COLUMNS: LIVE TIME-WEIGHTED BREAKDOWN & SETTLEMENT PLAN */}
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
            {/* Calculation Results & Per-Person Breakdown */}
            <section className="rounded-2xl bg-slate-900/85 backdrop-blur-xl border border-indigo-500/30 p-5 shadow-2xl">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-600 flex items-center justify-center shadow-md">
                    <Calculator className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">
                      3. Fair Calculation by Time In / Out
                    </h2>
                    <p className="text-xs text-slate-400">
                      {splitMode === "time"
                        ? `Weighted equally per hour (${formatMoney(calculation.costPerHourRate)}/hr)`
                        : "Flat equal split across active members"}
                    </p>
                  </div>
                </div>

                <motion.button
                  whileTap={{ scale: 0.94 }}
                  type="button"
                  onClick={handleCopySummary}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 shadow-md shadow-indigo-600/30 cursor-pointer"
                >
                  {copiedSummary ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Receipt</span>
                    </>
                  )}
                </motion.button>
              </div>

              {/* Optional Tax / Service Charge Slider */}
              <div className="mb-4 p-3 rounded-xl bg-slate-950/70 border border-white/10 flex items-center justify-between gap-3">
                <div className="text-xs text-slate-300">
                  <span className="font-medium">Tax / Service Fee: </span>
                  <strong className="text-indigo-300">{serviceChargePercent}%</strong>
                  {calculation.serviceChargeAmount > 0 ? (
                    <span className="text-slate-400 ml-1">
                      (+{formatMoney(calculation.serviceChargeAmount)})
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-1.5">
                  {[0, 5, 10, 15].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => {
                        sound.playSwitch();
                        setServiceChargePercent(pct);
                      }}
                      className={`px-2 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        serviceChargePercent === pct
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-900 text-slate-400 hover:text-white"
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Per-Person Calculation Breakdown */}
              <div className="space-y-2.5 mb-5">
                {calculation.personBreakdowns.map((b) => {
                  const {
                    person,
                    durationFormatted,
                    sharePercentage,
                    paidShared,
                    paidFreeTreat,
                    fairShare,
                    netBalance,
                    status,
                  } = b;

                  return (
                    <motion.div
                      key={person.id}
                      layout
                      className="p-3 rounded-xl bg-slate-950/80 border border-white/10 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-lg bg-gradient-to-br ${person.avatarColor} flex items-center justify-center text-xs font-bold text-white shrink-0`}
                          >
                            {person.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold text-white truncate">
                                {person.name}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                ({person.timeIn}–{person.timeOut} • {durationFormatted})
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          {person.isFreePass ? (
                            <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              VIP Free ($0)
                            </span>
                          ) : (
                            <span className="text-sm font-bold text-white">
                              Share: {formatMoney(fairShare)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1.5 border-t border-white/5 text-slate-400">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>Weight: {sharePercentage.toFixed(1)}%</span>
                          <span>•</span>
                          <span>Paid Shared: {formatMoney(paidShared)}</span>
                          {paidFreeTreat > 0 ? (
                            <span className="text-amber-300 font-medium">
                              • 🎁 Treated: {formatMoney(paidFreeTreat)}
                            </span>
                          ) : null}
                        </div>

                        <div className="font-semibold">
                          {status === "receive" ? (
                            <span className="text-emerald-400">
                              Gets back +{formatMoney(netBalance)}
                            </span>
                          ) : status === "pay" ? (
                            <span className="text-rose-400">
                              Owes {formatMoney(Math.abs(netBalance))}
                            </span>
                          ) : status === "exempt" ? (
                            <span className="text-amber-300">Exempt ✨</span>
                          ) : (
                            <span className="text-slate-400">Settled</span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* WHO PAYS WHOM SETTLEMENT PLAN */}
              <div className="pt-4 border-t border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    Who Pays Whom (Exact Net Transfers)
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Click to mark settled
                  </span>
                </div>

                {calculation.settlements.length > 0 ? (
                  <div className="space-y-2">
                    {calculation.settlements.map((transfer) => {
                      const isDone = settledTransferIds.has(transfer.id);
                      return (
                        <motion.div
                          key={transfer.id}
                          layout
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => handleToggleSettled(transfer.id)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                            isDone
                              ? "bg-emerald-950/40 border-emerald-500/40 opacity-75"
                              : "bg-slate-950/90 border-indigo-500/30 hover:border-indigo-400"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-semibold text-xs sm:text-sm text-rose-300 truncate">
                              {transfer.fromPerson.name}
                            </span>
                            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="font-semibold text-xs sm:text-sm text-emerald-300 truncate">
                              {transfer.toPerson.name}
                            </span>
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0">
                            <span
                              className={`text-sm font-extrabold ${
                                isDone ? "line-through text-emerald-300" : "text-white"
                              }`}
                            >
                              {formatMoney(transfer.amount)}
                            </span>
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                                isDone
                                  ? "bg-emerald-500 text-slate-950"
                                  : "bg-slate-800 text-slate-400"
                              }`}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5 text-center text-xs text-slate-400">
                    All balances are settled or no shared payments need transfers!
                  </div>
                )}
              </div>

              {/* Formula Explainer Note */}
              <div className="mt-4 p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/20 flex items-start gap-2.5 text-[11px] text-indigo-200/80">
                <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <strong>How Time-Weighted Equal Split Works:</strong> Everyone pays the exact same hourly rate (
                  {formatMoney(calculation.costPerHourRate)}/hr) for the time they stayed (
                  <code>Time Out − Time In</code>). Special <strong>Free Payments</strong> and{" "}
                  <strong>Free Pass</strong> usernames are excluded from the split pool.
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
