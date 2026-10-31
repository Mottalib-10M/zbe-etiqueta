import { type ChangeEvent, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { formatNumber, parseLocaleNumber } from '../../lib/format';

interface Props { id: string; label: string; value: number; onChange: (v: number) => void; unit?: string; min?: number; max?: number; help?: string; className?: string; decimals?: number; lang?: string; /** false pour une année : « 2012 », jamais « 2,012 ». */ grouping?: boolean }

export default function NumberField({ id, label, value, onChange, unit = '', min = 0, max = 10_000_000, help, className = '', decimals = 0, lang, grouping = true }: Props) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState('');
  const [over, setOver] = useState(false);
  // Au focus, tout le contenu est sélectionné juste après le rendu (avant toute frappe), et le
  // relâchement du clic ne doit pas annuler cette sélection : sinon « 48 » devient « 8 » ou « 2448 ».
  const input = useRef<HTMLInputElement>(null);
  const selectPending = useRef(false);
  const guardMouseUp = useRef(false);
  useLayoutEffect(() => { if (selectPending.current) { selectPending.current = false; input.current?.select(); } });
  const display = focused ? raw : (value === 0 ? '' : grouping ? formatNumber(value, decimals, lang) : String(value));
  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const filtered = e.target.value.replace(/[^0-9.,\s-]/g, '');
    setRaw(filtered);
    const n = parseLocaleNumber(filtered);
    setOver(n > max);
    onChange(Math.min(n, max));
  }, [onChange, max]);
  const handleFocus = useCallback(() => { setRaw(value === 0 ? '' : String(value)); setFocused(true); selectPending.current = true; guardMouseUp.current = true; }, [value]);
  const handleBlur = useCallback(() => {
    guardMouseUp.current = false; setFocused(false); if (value < min) onChange(min); if (value > max) onChange(max); }, [value, min, max, onChange]);
  return (
    <div className={`grid grid-rows-subgrid row-span-3 content-start gap-y-0 ${className}`}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-navy-700">{label}</label>
      <div className="relative self-start">
        <input ref={input} id={id} onMouseUp={(e) => { if (guardMouseUp.current) { guardMouseUp.current = false; e.preventDefault(); } }} type="text" inputMode="decimal" value={display} onChange={handleChange} onFocus={handleFocus} onBlur={handleBlur} placeholder="0" aria-describedby={help || over ? `${id}-help` : undefined}
          className={`tabular-nums w-full rounded-lg border border-navy-300 bg-white h-12 px-4 ${unit ? 'pr-14' : ''} text-right text-lg text-navy-900 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20`} />
        {unit && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-navy-600" aria-hidden="true">{unit}</span>}
      </div>
      {over
        ? <p id={`${id}-help`} role="status" className="mt-1 text-xs font-medium text-amber-700">≤ {formatNumber(max, Number.isInteger(max) ? 0 : decimals, lang)}{unit ? ` ${unit}` : ''}</p>
        : help && <p id={`${id}-help`} className="mt-1 text-xs text-navy-600">{help}</p>}
    </div>
  );
}
