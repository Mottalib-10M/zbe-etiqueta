/**
 * Mini-simulateur de page (RECETTE §9.3) : un ou deux champs, le chiffre du sujet de la page mis en
 * avant, deux à quatre lignes de détail et un lien vers le calculateur complet. Le calcul vient du
 * moteur du site, décrit dans `lib/mini-specs.ts` (une entrée par sujet). Premier rendu = valeurs
 * par défaut du build (§17.5) ; `data-chrome` : le texte du widget ne compte ni dans les mots ni
 * dans la comparaison entre pages.
 */
import { useMemo, useState } from 'react';
import NumberField from '../ui/NumberField';
import SelectField from '../ui/SelectField';
import { getSpec } from '../../lib/mini-specs';

interface Props { kind: string; lang?: string; href?: string; defaults?: Record<string, number>; lead?: boolean }

export default function MiniSim({ kind, lang = 'es', href, defaults = {}, lead = false }: Props) {
  const spec = getSpec(kind, lang);
  const [v, setV] = useState<Record<string, number>>(() => Object.fromEntries(spec.inputs.map((i) => [i.id, defaults[i.id] ?? i.def])));
  const out = useMemo(() => spec.run(v), [v, spec]);
  const set = (id: string) => (x: number) => setV((o) => ({ ...o, [id]: x }));
  return (
    <div data-chrome data-mini={kind} className={`not-prose rechner-mini ${lead ? 'mb-8 mt-0' : 'my-8'} rounded-xl border border-navy-200 border-l-4 border-l-accent-600 bg-white p-4 sm:p-5`}>
      <p className="text-base font-semibold text-navy-900">{spec.title}</p>
      <div className="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-2 [&>*]:min-w-0">
        <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
          {spec.inputs.map((i) => i.options
            ? <SelectField key={i.id} id={`m-${kind}-${i.id}`} label={i.label} value={String(v[i.id])} onChange={(x) => set(i.id)(Number(x))} options={i.options} />
            : <NumberField key={i.id} id={`m-${kind}-${i.id}`} label={i.label} value={v[i.id]} onChange={set(i.id)} unit={i.unit} max={i.max} decimals={i.decimals} lang={lang} grouping={!i.anio} />)}
        </form>
        <div aria-live="polite" data-resultat className="rounded-lg bg-accent-50/60 p-4">
          <p className="text-sm font-medium text-navy-600">{out.head[0]}</p>
          <p className="tabular-nums mt-1 text-3xl font-bold text-navy-900">{out.head[1]}</p>
          <table className="mt-3 w-full text-sm"><tbody className="divide-y divide-navy-200">
            {out.rows.map(([l, x]) => <tr key={l}><td className="py-1.5 pr-3 text-navy-600 hyphens-auto [overflow-wrap:anywhere]">{l}</td><td className="tabular-nums py-1.5 text-right text-navy-900 [overflow-wrap:break-word]">{x}</td></tr>)}
          </tbody></table>
          {out.note && <p className="mt-2 text-xs text-navy-600">{out.note}</p>}
        </div>
      </div>
      {href && spec.cta && <a href={href} className="mt-4 inline-block text-sm font-medium text-accent-700 hover:underline">{spec.cta} →</a>}
    </div>
  );
}
