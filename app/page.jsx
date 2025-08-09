"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

/* ================== IndexedDB utils ================== */
const DB_NAME = "lena-db";
const DB_VERSION = 1;
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("properties")) db.createObjectStore("properties", { keyPath: "id" });
      if (!db.objectStoreNames.contains("investors")) db.createObjectStore("investors", { keyPath: "id" });
      if (!db.objectStoreNames.contains("purchases")) db.createObjectStore("purchases", { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function dbPut(store, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => reject(tx.error);
  });
}
async function dbGetAll(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function dbDelete(store, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}
const uid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2));

/* ================== UI Helpers ================== */
const Section = ({ title, children }) => (
  <div className="rounded-3xl p-4 sm:p-5 border shadow-sm bg-amber-50/70 border-amber-200">
    <h2 className="text-[clamp(1.05rem,3.5vw,1.25rem)] font-semibold mb-3 text-purple-900">
      {title}
    </h2>
    {children}
  </div>
);

const Card = ({ children, className = "" }) => (
  <div className={`rounded-2xl bg-white shadow border border-purple-100 p-3 sm:p-4 ${className}`}>
    {children}
  </div>
);

/* Responsive Stat card */
const Stat = ({ label, value, hint }) => (
  <div className="min-w-0 rounded-2xl border border-purple-100 p-3 sm:p-4 bg-white shadow-sm">
    <div className="text-[11px] sm:text-xs uppercase tracking-wide text-purple-500 leading-tight">
      {label}
    </div>
    <div className="mt-1 font-extrabold text-purple-900 leading-tight break-words text-[clamp(1rem,4.5vw,1.5rem)]">
      {value}
    </div>
    {hint && (
      <div className="text-[10px] sm:text-[11px] mt-1 text-purple-600/70 leading-snug">
        {hint}
      </div>
    )}
  </div>
);

const InputLabel = ({ label, children }) => (
  <label className="block rounded-2xl bg-white shadow border border-purple-100 p-3 sm:p-4 focus-within:ring-2 focus-within:ring-purple-400">
    <div className="text-xs font-semibold uppercase tracking-wide text-purple-600">
      {label}
    </div>
    <div className="mt-2">{children}</div>
  </label>
);

/* Numeric input with thousands formatting */
const NumericInput = ({ value, onChange, placeholder }) => {
  const [text, setText] = useState("");
  useEffect(() => {
    setText((Number(value || 0)).toLocaleString("es-VE"));
  }, [value]);

  const mapCaret = (rawBefore, caretBefore, formattedAfter) => {
    const leftDigits = (rawBefore.slice(0, caretBefore).match(/\d/g) || []).length;
    let count = 0;
    for (let i = 0; i < formattedAfter.length; i++) {
      if (/\d/.test(formattedAfter[i])) count++;
      if (count >= leftDigits) return i + 1;
    }
    return formattedAfter.length;
  };
  const handleChange = (e) => {
    const el = e.target;
    const prev = text;
    const caret = el.selectionStart ?? prev.length;
    const digits = el.value.replace(/\D+/g, "");
    const formatted = digits ? Number(digits).toLocaleString("es-VE") : "";
    setText(formatted);
    onChange(Number(digits || 0));
    requestAnimationFrame(() => {
      const pos = mapCaret(prev, caret, formatted);
      try {
        el.setSelectionRange(pos, pos);
      } catch {}
    });
  };
  const handleBlur = () =>
    setText((Number((text || "").replace(/\D+/g, "")) || 0).toLocaleString("es-VE"));
  return (
    <input
      inputMode="numeric"
      type="text"
      className="input"
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
    />
  );
};

/* Smooth slider with pointer events (continuous drag) */
const SmoothSlider = ({ value, onCommit, min = 0, max = 100, step = 1 }) => {
  const trackRef = useRef(null);
  const [v, setV] = useState(Number(value || 0));
  const [drag, setDrag] = useState(false);
  useEffect(() => {
    if (!drag) setV(Number(value || 0));
  }, [value, drag]);

  const decimals = useMemo(() => {
    const s = String(step);
    const i = s.indexOf(".");
    return i === -1 ? 0 : s.length - i - 1;
  }, [step]);

  const toStep = (num) => {
    const val = Math.round(num / step) * step;
    return parseFloat(val.toFixed(decimals));
  };

  const posToVal = (clientX) => {
    const rect = trackRef.current.getBoundingClientRect();
    let ratio = (clientX - rect.left) / rect.width;
    ratio = Math.max(0, Math.min(1, ratio));
    let val = min + ratio * (max - min);
    val = toStep(val);
    return Math.max(min, Math.min(max, val));
  };

  const onPointerDown = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag(true);
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    if (clientX != null) setV(posToVal(clientX));
  };

  const onPointerMove = (e) => {
    if (!drag) return;
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    if (clientX != null) setV(posToVal(clientX));
  };

  useEffect(() => {
    if (!drag) return;
    const up = () => {
      setDrag(false);
      onCommit?.(v);
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [drag, v, onCommit]);

  const pct = ((v - min) / (max - min)) * 100;

  return (
    <div className="w-full select-none touch-none">
      <div
        ref={trackRef}
        className="relative h-2 rounded-full bg-slate-200 cursor-pointer"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
      >
        <div
          className="absolute left-0 top-0 h-2 rounded-full bg-purple-400"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-white border border-purple-500 shadow"
          style={{ left: `calc(${pct}% - 8px)` }}
        />
      </div>
    </div>
  );
};

/* ================== Modules ================== */
function PropertiesModule({ onSelectForCalc }) {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({
    id: "",
    name: "",
    address: "",
    price: 80000,
    rent: 700,
    expenses: 1200,
    photos: [],
  });
  const load = async () => {
    setList(await dbGetAll("properties"));
  };
  useEffect(() => {
    load();
  }, []);
  const pickPhotos = async (files) => {
    if (!files) return;
    const readers = await Promise.all(
      Array.from(files).map(
        (f) =>
          new Promise((res, rej) => {
            const fr = new FileReader();
            fr.onload = () => res(fr.result);
            fr.onerror = rej;
            fr.readAsDataURL(f);
          })
      )
    );
    setForm((s) => ({ ...s, photos: [...s.photos, ...readers] }));
  };
  const save = async () => {
    const item = { ...form, id: form.id || uid(), updatedAt: Date.now() };
    await dbPut("properties", item);
    setForm({
      id: "",
      name: "",
      address: "",
      price: 0,
      rent: 0,
      expenses: 0,
      photos: [],
    });
    load();
  };
  const edit = (p) => setForm(p);
  const del = async (id) => {
    await dbDelete("properties", id);
    load();
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Section title="Nueva propiedad / Editar">
        <div className="grid gap-3">
          <InputLabel label="Nombre">
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Apto Chacao 2H/2B"
            />
          </InputLabel>
          <InputLabel label="Dirección">
            <input
              className="input"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Calle..., Caracas"
            />
          </InputLabel>
          <InputLabel label="Precio">
            <NumericInput
              value={form.price}
              onChange={(n) => setForm({ ...form, price: n })}
            />
          </InputLabel>
          <InputLabel label="Renta mensual">
            <NumericInput
              value={form.rent}
              onChange={(n) => setForm({ ...form, rent: n })}
            />
          </InputLabel>
          <InputLabel label="Gastos anuales">
            <NumericInput
              value={form.expenses}
              onChange={(n) => setForm({ ...form, expenses: n })}
            />
          </InputLabel>
          <InputLabel label="Fotos">
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => pickPhotos(e.target.files)}
            />
            {!!form.photos.length && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {form.photos.map((src, i) => (
                  <img key={i} src={src} className="rounded-xl border" />
                ))}
              </div>
            )}
          </InputLabel>
          <div className="flex gap-2">
            <button
              className="px-3 py-2 rounded-xl border border-purple-300 bg-purple-50 hover:bg-purple-100"
              onClick={save}
            >
              Guardar
            </button>
            <button
              className="px-3 py-2 rounded-xl border bg-white hover:bg-slate-50"
              onClick={() =>
                setForm({
                  id: "",
                  name: "",
                  address: "",
                  price: 0,
                  rent: 0,
                  expenses: 0,
                  photos: [],
                })
              }
            >
              Limpiar
            </button>
          </div>
        </div>
      </Section>
      <Section title="Listado">
        <div className="grid gap-3">
          {list.length === 0 && (
            <div className="text-sm text-slate-500">No hay propiedades aún.</div>
          )}
          {list.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-purple-900">{p.name}</div>
                  <div className="text-sm text-slate-600 truncate">{p.address}</div>
                  <div className="text-sm text-slate-600 mt-1">
                    Precio: {(p.price || 0).toLocaleString("es-VE")}
                  </div>
                  <div className="text-sm text-slate-600">
                    Renta: {(p.rent || 0).toLocaleString("es-VE")} / mes
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    className="px-3 py-2 rounded-xl border bg-white hover:bg-slate-50"
                    onClick={() => edit(p)}
                  >
                    Editar
                  </button>
                  <button
                    className="px-3 py-2 rounded-xl border bg-amber-50 hover:bg-amber-100"
                    onClick={() => onSelectForCalc(p)}
                  >
                    Usar en Cálculo
                  </button>
                  <button
                    className="px-3 py-2 rounded-xl border bg-white hover:bg-slate-50"
                    onClick={() => del(p.id)}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
              {p.photos?.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-3">
                  {p.photos.map((src, i) => (
                    <img key={i} src={src} className="rounded-lg border" />
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      </Section>
    </div>
  );
}

function InvestorsModule() {
  const [investors, setInvestors] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [properties, setProperties] = useState([]);
  const [invForm, setInvForm] = useState({ id: "", name: "", email: "" });
  const [buyForm, setBuyForm] = useState({
    id: "",
    investorId: "",
    propertyId: "",
    date: new Date().toISOString().slice(0, 10),
    units: 0,
    amount: 0,
  });
  const load = async () => {
    setInvestors(await dbGetAll("investors"));
    setPurchases(await dbGetAll("purchases"));
    setProperties(await dbGetAll("properties"));
  };
  useEffect(() => {
    load();
  }, []);
  const saveInvestor = async () => {
    const item = { ...invForm, id: invForm.id || uid(), createdAt: Date.now() };
    await dbPut("investors", item);
    setInvForm({ id: "", name: "", email: "" });
    load();
  };
  const savePurchase = async () => {
    const item = { ...buyForm, id: buyForm.id || uid(), createdAt: Date.now() };
    await dbPut("purchases", item);
    setBuyForm({
      id: "",
      investorId: "",
      propertyId: "",
      date: new Date().toISOString().slice(0, 10),
      units: 0,
      amount: 0,
    });
    load();
  };
  const fmtDate = (s) => new Date(s).toLocaleDateString("es-VE");
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Section title="Nuevo inversionista">
        <div className="grid gap-3">
          <InputLabel label="Nombre">
            <input
              className="input"
              value={invForm.name}
              onChange={(e) => setInvForm({ ...invForm, name: e.target.value })}
              placeholder="María Pérez"
            />
          </InputLabel>
          <InputLabel label="Email">
            <input
              className="input"
              value={invForm.email}
              onChange={(e) => setInvForm({ ...invForm, email: e.target.value })}
              placeholder="maria@ejemplo.com"
            />
          </InputLabel>
          <div className="flex gap-2">
            <button
              className="px-3 py-2 rounded-xl border border-purple-300 bg-purple-50 hover:bg-purple-100"
              onClick={saveInvestor}
            >
              Guardar
            </button>
          </div>
        </div>
      </Section>
      <Section title="Registrar compra (tokens/shares)">
        <div className="grid gap-3">
          <InputLabel label="Inversionista">
            <select
              className="input"
              value={buyForm.investorId}
              onChange={(e) =>
                setBuyForm({ ...buyForm, investorId: e.target.value })
              }
            >
              <option value="">Selecciona…</option>
              {investors.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </InputLabel>
          <InputLabel label="Propiedad">
            <select
              className="input"
              value={buyForm.propertyId}
              onChange={(e) =>
                setBuyForm({ ...buyForm, propertyId: e.target.value })
              }
            >
              <option value="">Selecciona…</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </InputLabel>
          <InputLabel label="Fecha">
            <input
              type="date"
              className="input"
              value={buyForm.date}
              onChange={(e) => setBuyForm({ ...buyForm, date: e.target.value })}
            />
          </InputLabel>
          <InputLabel label="Unidades (tokens/shares)">
            <NumericInput
              value={buyForm.units}
              onChange={(n) => setBuyForm({ ...buyForm, units: n })}
            />
          </InputLabel>
          <InputLabel label="Monto (USD/VES)">
            <NumericInput
              value={buyForm.amount}
              onChange={(n) => setBuyForm({ ...buyForm, amount: n })}
            />
          </InputLabel>
          <div className="flex gap-2">
            <button
              className="px-3 py-2 rounded-xl border border-purple-300 bg-purple-50 hover:bg-purple-100"
              onClick={savePurchase}
            >
              Guardar compra
            </button>
          </div>
        </div>
      </Section>
      <Section title="Historial de compras">
        <div className="grid gap-3 max-h-[60vh] overflow-y-auto pr-1">
          {purchases.length === 0 && (
            <div className="text-sm text-slate-500">Sin compras aún.</div>
          )}
          {purchases.map((r) => {
            const inv = investors.find((i) => i.id === r.investorId);
            const prop = properties.find((p) => p.id === r.propertyId);
            return (
              <Card key={r.id}>
                <div className="text-sm">
                  <strong>{inv?.name || "(inversionista)"}</strong> →{" "}
                  {prop?.name || "(propiedad)"}
                </div>
                <div className="text-xs text-slate-600">
                  {fmtDate(r.date)} · Unidades:{" "}
                  {(r.units || 0).toLocaleString("es-VE")} · Monto:{" "}
                  {(r.amount || 0).toLocaleString("es-VE")}
                </div>
              </Card>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function CalculatorModule({ seed }) {
  const [mode, setMode] = useState("tokens");
  const [currency, setCurrency] = useState("USD");
  const [propertyPrice, setPropertyPrice] = useState(seed?.price ?? 75000);
  const [expectedMonthlyRent, setExpectedMonthlyRent] = useState(seed?.rent ?? 650);
  const [occupancyRate, setOccupancyRate] = useState(90);
  const [annualExpenses, setAnnualExpenses] = useState(seed?.expenses ?? 1200);
  const [totalEquity, setTotalEquity] = useState(seed?.price ?? 75000);
  const [unitPrice, setUnitPrice] = useState(50);
  const [myInvestment, setMyInvestment] = useState(500);
  const [platformFeePct, setPlatformFeePct] = useState(2.0);
  const [entryFeePct, setEntryFeePct] = useState(0.5);

  const fmt = (n) =>
    new Intl.NumberFormat("es-VE", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n || 0);
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n || 0));

  const totalUnits = useMemo(
    () => Math.max(1, Math.floor(totalEquity / Math.max(1, unitPrice))),
    [totalEquity, unitPrice]
  );
  const myUnits = useMemo(
    () => Math.min(totalUnits, Math.floor(myInvestment / Math.max(1, unitPrice))),
    [myInvestment, unitPrice, totalUnits]
  );
  const ownershipPct = useMemo(
    () => (myUnits / totalUnits) * 100,
    [myUnits, totalUnits]
  );
  const effectiveMonthlyRent = useMemo(
    () => (expectedMonthlyRent * clamp(occupancyRate, 0, 100)) / 100,
    [expectedMonthlyRent, occupancyRate]
  );
  const grossAnnualRent = useMemo(
    () => effectiveMonthlyRent * 12,
    [effectiveMonthlyRent]
  );
  const noi = useMemo(
    () => Math.max(0, grossAnnualRent - annualExpenses),
    [grossAnnualRent, annualExpenses]
  );
  const platformFee = useMemo(() => (platformFeePct / 100) * noi, [platformFeePct, noi]);
  const netAnnualIncome = useMemo(() => Math.max(0, noi - platformFee), [noi, platformFee]);
  const entryFee = useMemo(() => (entryFeePct / 100) * myInvestment, [entryFeePct, myInvestment]);
  const investorAnnualDistribution = useMemo(
    () => (ownershipPct / 100) * netAnnualIncome,
    [ownershipPct, netAnnualIncome]
  );
  const simpleYieldOnCost = useMemo(
    () => (grossAnnualRent / Math.max(1, propertyPrice)) * 100,
    [grossAnnualRent, propertyPrice]
  );
  const simpleNetYield = useMemo(
    () => (netAnnualIncome / Math.max(1, propertyPrice)) * 100,
    [netAnnualIncome, propertyPrice]
  );
  const cashOnCash = useMemo(
    () => (investorAnnualDistribution / Math.max(1, myInvestment)) * 100,
    [investorAnnualDistribution, myInvestment]
  );
  const breakEvenYears = useMemo(
    () => (myInvestment + entryFee) / Math.max(1, investorAnnualDistribution),
    [myInvestment, entryFee, investorAnnualDistribution]
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Section title="Inmueble">
        <div className="grid gap-3">
          <InputLabel label="Precio del inmueble">
            <NumericInput value={propertyPrice} onChange={setPropertyPrice} />
          </InputLabel>
          <InputLabel label="Renta mensual esperada">
            <NumericInput value={expectedMonthlyRent} onChange={setExpectedMonthlyRent} />
          </InputLabel>
          <InputLabel label="Ocupación (%)">
            <SmoothSlider value={occupancyRate} min={0} max={100} step={1} onCommit={setOccupancyRate} />
            <div className="text-right text-sm mt-1 text-purple-700 font-medium">{occupancyRate}%</div>
          </InputLabel>
          <InputLabel label="Gastos anuales">
            <NumericInput value={annualExpenses} onChange={setAnnualExpenses} />
          </InputLabel>
        </div>
      </Section>

      <Section title={`Estructura de ${mode}`}>
        <div className="grid gap-3">
          <InputLabel label="Capital a tokenizar / emitir">
            <NumericInput value={totalEquity} onChange={setTotalEquity} />
          </InputLabel>
          <InputLabel label={`Precio por ${mode === "tokens" ? "token" : "acción"}`}>
            <NumericInput value={unitPrice} onChange={setUnitPrice} />
          </InputLabel>
          <InputLabel label="Tu inversión">
            <NumericInput value={myInvestment} onChange={setMyInvestment} />
          </InputLabel>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
            <Stat label={`Total ${mode}`} value={totalUnits.toLocaleString("es-VE")} />
            <Stat label="Tus unidades" value={myUnits.toLocaleString("es-VE")} />
            <Stat label="Participación" value={`${ownershipPct.toFixed(2)}%`} />
          </div>
        </div>
      </Section>

      <Section title="Fees de plataforma">
        <div className="grid gap-3">
          <InputLabel label="Fee anual de administración (%)">
            <SmoothSlider value={platformFeePct} min={0} max={10} step={0.1} onCommit={setPlatformFeePct} />
            <div className="text-right text-sm mt-1 text-purple-700 font-medium">
              {platformFeePct.toFixed(1)}%
            </div>
          </InputLabel>
          <InputLabel label="Fee de entrada (%)">
            <SmoothSlider value={entryFeePct} min={0} max={5} step={0.1} onCommit={setEntryFeePct} />
            <div className="text-right text-sm mt-1 text-purple-700 font-medium">
              {entryFeePct.toFixed(1)}%
            </div>
          </InputLabel>
        </div>
      </Section>

      <Section title="Resultados & métricas">
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
          <Stat label="Renta anual bruta" value={fmt(grossAnnualRent)} />
          <Stat label="NOI (antes de fee)" value={fmt(noi)} />
          <Stat label="Fee admin anual" value={fmt(platformFee)} />
          <Stat label="Ingreso anual neto" value={fmt(netAnnualIncome)} />
          <Stat label="Yield bruto" value={`${simpleYieldOnCost.toFixed(2)}%`} />
          <Stat label="Yield neto" value={`${simpleNetYield.toFixed(2)}%`} />
          <Stat label="Distribución anual (tuya)" value={fmt(investorAnnualDistribution)} />
          <Stat label="Cash-on-cash" value={`${cashOnCash.toFixed(2)}%`} />
          <Stat label="Años break-even" value={isFinite(breakEvenYears) ? breakEvenYears.toFixed(1) : "–"} />
        </div>
      </Section>
    </div>
  );
}

/* ================== App root ================== */
export default function Page() {
  const [module, setModule] = useState("propiedades");
  const [seedForCalc, setSeedForCalc] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen w-full p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <button
            className="w-10 h-10 rounded-xl bg-purple-700 text-white flex items-center justify-center shadow"
            onClick={() => setDrawerOpen(true)}
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-700 text-amber-300 font-extrabold flex items-center justify-center">L</div>
            <div>
              <h1 className="text-[clamp(1.4rem,4vw,1.8rem)] font-extrabold tracking-tight text-purple-900">LENA</h1>
              <p className="text-sm text-purple-700/80">Micro-inversión inmobiliaria · VE</p>
            </div>
          </div>
          <div />
        </header>

        {drawerOpen && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/30" onClick={() => setDrawerOpen(false)} />
            <div className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl p-4 space-y-2">
              <div className="text-xs uppercase text-slate-500">Módulos</div>
              <button className={`w-full text-left px-3 py-2 rounded-xl ${module === "propiedades" ? "bg-amber-50" : "hover:bg-slate-50"}`} onClick={() => { setModule("propiedades"); setDrawerOpen(false); }}>
                Propiedades
              </button>
              <button className={`w-full text-left px-3 py-2 rounded-xl ${module === "calculo" ? "bg-amber-50" : "hover:bg-slate-50"}`} onClick={() => { setModule("calculo"); setDrawerOpen(false); }}>
                Cálculo
              </button>
              <button className={`w-full text-left px-3 py-2 rounded-xl ${module === "inversionistas" ? "bg-amber-50" : "hover:bg-slate-50"}`} onClick={() => { setModule("inversionistas"); setDrawerOpen(false); }}>
                Inversionistas
              </button>
            </div>
          </div>
        )}

        {module === "propiedades" && (
          <PropertiesModule
            onSelectForCalc={(p) => {
              setSeedForCalc(p);
              setModule("calculo");
            }}
          />
        )}
        {module === "calculo" && <CalculatorModule seed={seedForCalc} />}
        {module === "inversionistas" && <InvestorsModule />}

        <footer className="text-xs text-purple-700/80 text-center pt-4">
          LENA · MVP modular local-first. (Guardado en tu navegador)
        </footer>
      </div>
    </div>
  );
}
