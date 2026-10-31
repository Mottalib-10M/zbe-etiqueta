/**
 * Mini-simulateur AUTONOME (RECETTE §9.3) pour les sites qui n'ont pas les champs de la trame
 * (`ui/NumberField`, palette navy/accent). Même contrat que MiniSim : il lit `lib/mini-specs.ts`.
 * Il embarque ses champs (comportement du NumberField de la trame : texte brut pendant la frappe,
 * mise en forme au blur, plafond appliqué au nombre et signalé, sélection au focus) et se colore
 * avec les variables de la charte du site, avec des valeurs de repli lisibles.
 * Réglages : `locale` (séparateurs), `unitColor`/couleurs héritées via --color-text, --color-text-muted,
 * --color-border, --color-surface, --color-primary-dark.
 */
import { type ChangeEvent, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getSpec } from '../../lib/mini-specs';

const C = {
  text: 'var(--color-text, #1f2937)', muted: 'var(--color-text-muted, #4b5563)', border: 'var(--color-border, #d1d5db)',
  surface: 'var(--color-surface, #f8fafc)', link: 'var(--color-primary-dark, var(--color-primary-700, var(--color-primary, #1d4ed8)))', warn: '#92400e',
};

function parse(input: string): number {
  const cleaned = input.replace(/[^\d.,-]/g, '');
  const lastComma = cleaned.lastIndexOf(','), lastDot = cleaned.lastIndexOf('.');
  let s = cleaned;
  if (lastComma > lastDot) s = cleaned.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(cleaned)) s = cleaned.replace(/\./g, '');
  else s = cleaned.replace(/,/g, '');
  const n = parseFloat(s); return isNaN(n) ? 0 : n;
}

function Field({ id, label, value, onChange, unit, max = 1e9, decimals = 0, locale, anio = false }: { id: string; label: string; value: number; onChange: (v: number) => void; unit?: string; max?: number; decimals?: number; locale: string; anio?: boolean }) {
  const [focused, setFocused] = useState(false); const [raw, setRaw] = useState(''); const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null); const selectPending = useRef(false); const guard = useRef(false);
  useLayoutEffect(() => { if (selectPending.current) { selectPending.current = false; input.current?.select(); } });
  const fmt = (n: number) => anio ? String(n) : new Intl.NumberFormat(locale, { maximumFractionDigits: decimals }).format(n);
  const display = focused ? raw : (value === 0 ? '' : fmt(value));
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium" style={{ color: C.text }}>{label}</label>
      <div className="relative">
        <input ref={input} id={id} type="text" inputMode="decimal" value={display} placeholder="0"
          onMouseUp={(e) => { if (guard.current) { guard.current = false; e.preventDefault(); } }}
          onChange={(e: ChangeEvent<HTMLInputElement>) => { const f = e.target.value.replace(/[^0-9.,\s-]/g, ''); setRaw(f); const n = parse(f); setOver(n > max); onChange(Math.min(n, max)); }}
          onFocus={() => { setRaw(value === 0 ? '' : String(value)); setFocused(true); selectPending.current = true; guard.current = true; }}
          onBlur={() => { guard.current = false; setFocused(false); if (value > max) onChange(max); }}
          aria-describedby={over ? `${id}-help` : undefined}
          className="tabular-nums h-12 w-full rounded-lg border bg-white px-4 pr-14 text-right text-lg focus:outline-none focus:ring-2"
          style={{ borderColor: C.border, color: C.text }} />
        {unit && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: C.muted }} aria-hidden="true">{unit}</span>}
      </div>
      {over && <p id={`${id}-help`} role="status" className="mt-1 text-xs font-medium" style={{ color: C.warn }}>≤ {fmt(max)}{unit ? ` ${unit}` : ''}</p>}
    </div>
  );
}

interface Props { kind: string; lang?: string; href?: string; locale?: string }

export default function MiniSimAutonome({ kind, lang = 'en', href, locale = 'en-GB' }: Props) {
  const spec = getSpec(kind, lang);
  const [v, setV] = useState<Record<string, number>>(() => Object.fromEntries(spec.inputs.map((i) => [i.id, i.def])));
  const out = useMemo(() => spec.run(v), [v, spec]);
  const set = (id: string) => (x: number) => setV((o) => ({ ...o, [id]: x }));
  return (
    <div data-chrome data-mini={kind} className="not-prose rechner-mini my-8 rounded-xl border bg-white p-4 shadow-sm sm:p-5" style={{ borderColor: C.border }}>
      <p className="text-base font-semibold" style={{ color: C.text }}>{spec.title}</p>
      <div className="mt-3 grid gap-5 sm:grid-cols-2">
        <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
          {spec.inputs.map((i) => i.options
            ? <div key={i.id}><label htmlFor={`m-${kind}-${i.id}`} className="mb-1 block text-sm font-medium" style={{ color: C.text }}>{i.label}</label>
                <div className="relative"><select id={`m-${kind}-${i.id}`} value={String(v[i.id])} onChange={(e) => set(i.id)(Number(e.target.value))} className="h-12 w-full appearance-none truncate rounded-lg border bg-white pl-3 pr-10" style={{ borderColor: C.border, color: C.text }}>
                  {i.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: C.muted }} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M5 7.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg></div></div>
            : <Field key={i.id} id={`m-${kind}-${i.id}`} label={i.label} value={v[i.id]} onChange={set(i.id)} unit={i.unit} max={i.max} decimals={i.decimals} locale={locale} anio={i.anio} />)}
        </form>
        <div aria-live="polite" className="rounded-lg p-4" style={{ background: C.surface }}>
          <p className="text-sm font-medium" style={{ color: C.muted }}>{out.head[0]}</p>
          <p className="tabular-nums mt-1 text-3xl font-bold" style={{ color: C.text }}>{out.head[1]}</p>
          <table className="mt-3 w-full text-sm"><tbody>
            {out.rows.map(([l, x]) => <tr key={l} style={{ borderTop: `1px solid ${C.border}` }}><td className="py-1.5 pr-3 hyphens-auto [overflow-wrap:anywhere]" style={{ color: C.muted }}>{l}</td><td className="tabular-nums py-1.5 text-right [overflow-wrap:break-word]" style={{ color: C.text }}>{x}</td></tr>)}
          </tbody></table>
          {out.note && <p className="mt-2 text-xs" style={{ color: C.muted }}>{out.note}</p>}
        </div>
      </div>
      {href && <a href={href} className="mt-4 inline-block text-sm font-medium hover:underline" style={{ color: C.link }}>{spec.cta} →</a>}
    </div>
  );
}
