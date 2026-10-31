/**
 * Simulador principal : « ¿Qué etiqueta tiene mi coche y puedo entrar en la ZBE de mi ciudad? » + impuesto de
 * circulación. Etiqueta según los criterios de la DGT (lib/engine/etiqueta), veredicto zona por zona según la
 * ordenanza (lib/engine/zbe), IVTM según la ordenanza fiscal 2026 o el artículo 95 TRLHL (lib/engine/ivtm).
 * Primer render = valores por defecto y __BUILD_DAY__ ; el enlace compartido y la fecha de hoy se aplican
 * después (RECETTE §17.5).
 */
import { useEffect, useMemo, useState } from 'react';
import NumberField from '../ui/NumberField';
import SelectField from '../ui/SelectField';
import Toggle from '../ui/Toggle';
import { etiquetaDe, esHibrido, esPhev, type Categoria, type Energia } from '../../lib/engine/etiqueta';
import { CIUDADES, ciudad as getCiudad, veredicto, multa, controlaElDia, type Perfil } from '../../lib/engine/zbe';
import { cuotaTurismo, municipio as getMunicipio } from '../../lib/engine/ivtm';
import { P } from '../../lib/engine/params';
import { readParams, num, str, updateURL } from '../../lib/url-state';
import { ETIQUETA_NOMBRE, ENERGIA, CATEGORIA, MESES, accesoTitulo, accesoDetalle, horarioTexto, mesAnio } from '../../lib/textos';
import { Filas, Pasos, Acciones, Cabecera, Aviso, Pegatina, caja, marco, rejilla, tx, fm, type L } from './kit';

declare const __BUILD_DAY__: string;
interface Props { lang?: L; methodHref?: string; preset?: { ciudad?: string }; ciudadHrefs?: Record<string, string>; ivtmHrefs?: Record<string, string>; etiquetaHrefs?: Record<string, string> }

const ENERGIAS: Energia[] = ['gasolina', 'diesel', 'hev', 'hev_diesel', 'phev', 'phev_diesel', 'bev', 'glp', 'gnc'];
const CATS: Categoria[] = ['turismo', 'moto', 'ciclomotor', 'pesado'];

export default function ZbeTool({ lang = 'es', methodHref, preset = {}, ciudadHrefs = {}, ivtmHrefs = {}, etiquetaHrefs = {} }: Props) {
  const f = fm(lang);
  const [c, setC] = useState(preset.ciudad ?? 'madrid');
  const [cat, setCat] = useState<Categoria>('turismo');
  const [en, setEn] = useState<Energia>('diesel');
  const [anio, setAnio] = useState(2012);
  const [mes, setMes] = useState('6');
  const [euro, setEuro] = useState('0');
  const [aut, setAut] = useState(50);
  const [dom, setDom] = useState<Perfil['domicilio']>('fuera');
  const [res, setRes] = useState('0');
  const [fecha, setFecha] = useState(__BUILD_DAY__);
  const [cvf, setCvf] = useState(11.5);
  useEffect(() => {
    const u = readParams(window.location.search);
    setFecha(str(u, 'f', new Date().toISOString().slice(0, 10)));
    if (![...u.keys()].length) return;
    if (!preset.ciudad) setC(str(u, 'c', c));
    setCat(str(u, 'v', 'turismo') as Categoria); setEn(str(u, 'm', 'diesel') as Energia); setAnio(num(u, 'a', 2012)); setMes(str(u, 'mm', '6'));
    setEuro(str(u, 'e', '0')); setAut(num(u, 'k', 50)); setDom(str(u, 'd', 'fuera') as Perfil['domicilio']); setRes(str(u, 'r', '0')); setCvf(num(u, 'cv', 11.5));
  }, []);
  useEffect(() => { updateURL({ ...(preset.ciudad ? {} : { c }), v: cat, m: en, a: anio, mm: mes, e: euro, k: esPhev(en) ? aut : undefined, d: dom, r: res, cv: cvf, f: fecha }); }, [c, cat, en, anio, mes, euro, aut, dom, res, cvf, fecha]);

  const anioOk = Math.min(Math.max(Math.round(anio) || 2012, 1950), 2026);
  const matric = `${anioOk}-${String(Number(mes)).padStart(2, '0')}`;
  const et = etiquetaDe({ categoria: cat, energia: en, autonomiaKm: aut, euro: Number(euro), matriculacion: matric });
  const city = getCiudad(c);
  const perfil: Perfil = { domicilio: dom, residenteZona: res === '1' };
  const vs = useMemo(() => veredicto(c, et.etiqueta, perfil, fecha, cat), [c, et.etiqueta, dom, res, fecha, cat]);
  // Acceso efectivo el día del viaje : una zona que solo se controla de lunes a viernes no restringe el sábado.
  const efectivo = (v: (typeof vs)[number]) => (controlaElDia(v.zona, fecha) ? v.acceso : 'permitido');
  const peor = vs.find((v) => efectivo(v) === 'prohibido') ?? vs.find((v) => efectivo(v) === 'solo_aparcamiento') ?? vs.find((v) => efectivo(v) === 'condicionado') ?? vs[0];
  const muni = getMunicipio(c);
  const edad = Math.max(0, Number(fecha.slice(0, 4)) - anioOk);
  const tecnologia = en === 'bev' ? 'electrico' : esHibrido(en) ? 'hibrido' : en === 'glp' || en === 'gnc' ? 'gas' : 'combustion';
  const iv = cuotaTurismo({ municipio: muni?.slug, cvf, etiqueta: et.etiqueta, tecnologia, diesel: en === 'hev_diesel' || en === 'phev_diesel', antiguedadAnos: edad });
  const m = city.multa;
  const nombre = ETIQUETA_NOMBRE[lang][et.etiqueta];

  const steps = [
    et.base === 'tecnologia'
      ? tx(lang, `Motor ${ENERGIA.es[en].toLowerCase()}: la DGT le da la ${nombre.toLowerCase()} por su tecnología${et.regla === 'eco' ? ', porque además cumple los criterios de la etiqueta C' : ''}.`, `${ENERGIA.en[en]} engine: the DGT gives it the ${nombre} because of its technology${et.regla === 'eco' ? ', since it also meets the C criteria' : ''}.`)
      : et.base === 'euro'
        ? tx(lang, `Norma Euro ${euro} indicada: corresponde a la ${nombre.toLowerCase()} según los criterios de la DGT (la fecha no cuenta cuando se conoce la norma).`, `Euro ${euro} entered: under the DGT criteria this means the ${nombre} (the date is ignored when the standard is known).`)
        : tx(lang, `Primera matriculación en ${mesAnio(matric, 'es')}: ${cat === 'moto' || cat === 'ciclomotor' ? 'según las fechas en que cada norma Euro fue obligatoria (Directiva 2002/51/CE y Reglamento UE 168/2013)' : 'según las fechas que publica la DGT'}, ${nombre.toLowerCase()}.`, `First registered in ${mesAnio(matric, 'en')}: ${cat === 'moto' || cat === 'ciclomotor' ? 'under the dates each Euro standard became compulsory (Directive 2002/51/EC and Regulation (EU) 168/2013)' : 'under the dates published by the DGT'}, ${nombre}.`),
    ...(et.regla === 'moto_euro5' ? [tx(lang, 'El Reglamento General de Vehículos solo enumera las motos Euro 3 y Euro 4 para la C; la Euro 5 no figura en el texto. Lo lógico es la C, pero confírmalo en la consulta por matrícula de la DGT.', 'The General Vehicle Regulation only lists Euro 3 and Euro 4 motorbikes for the C; Euro 5 is not named. The C is the logical result, but confirm it with the DGT plate lookup.')] : et.dudoso && et.alternativa ? [tx(lang, `Fecha de transición: un modelo ya homologado con la norma siguiente podría tener la ${ETIQUETA_NOMBRE.es[et.alternativa].toLowerCase()}. Indica la norma Euro (casilla V.9 de la ficha técnica) o consulta la matrícula en la DGT.`, `Changeover date: a model already approved to the next standard could have the ${ETIQUETA_NOMBRE.en[et.alternativa]}. Enter the Euro standard (box V.9 of the technical card) or look up the plate with the DGT.`)] : []),
    ...vs.map((v) => tx(lang,
      `${v.zona.nombre}: ${accesoTitulo(v.acceso, 'es').toLowerCase()}${v.acceso !== 'permitido' ? ` (${horarioTexto(v.zona, 'es')})` : ''}${v.regla?.nota ? `; ${v.regla.nota}` : ''}.`,
      `${v.zona.nombre}: ${accesoTitulo(v.acceso, 'en').toLowerCase()}${v.acceso !== 'permitido' ? ` (${horarioTexto(v.zona, 'en')})` : ''}${v.regla?.nota_en ? `; ${v.regla.nota_en}` : ''}.`)),
    muni
      ? tx(lang, `IVTM ${muni.nombre} 2026: ${f.num(cvf, 2)} caballos fiscales → ${f.eur(iv.base)} al año${iv.bonificacion ? `, menos ${f.pct(iv.pct)} de bonificación (${iv.bonificacion.nota}) = ${f.eur(iv.cuota)}` : ''}.`, `IVTM ${muni.nombre} 2026: ${f.num(cvf, 2)} fiscal hp → ${f.eur(iv.base)} a year${iv.bonificacion ? `, less ${f.pct(iv.pct)} relief (${iv.bonificacion.nota_en}) = ${f.eur(iv.cuota)}` : ''}.`)
      : tx(lang, `IVTM: ordenanza fiscal de ${city.nombre} no incluida; el artículo 95 TRLHL fija para ${f.num(cvf, 2)} caballos fiscales una cuota de ${f.eur(iv.minimaEstatal)} a ${f.eur(iv.maxima)} (coeficiente de 1 a 2).`, `IVTM: ${city.nombre}'s tax byelaw is not included; section 95 of the Local Finance Act sets ${f.eur(iv.minimaEstatal)} to ${f.eur(iv.maxima)} for ${f.num(cvf, 2)} fiscal hp (multiplier 1 to 2).`),
  ];
  const ciudadOpt = CIUDADES.map((x) => ({ value: x.slug, label: x.nombre }));
  const anyNo = vs.some((v) => efectivo(v) !== 'permitido');
  // Zonas con accesos distintos (p. ej. Madrid ZBE con condiciones y Distrito Centro prohibido) : depende de la zona.
  const mixto = anyNo && new Set(vs.map(efectivo)).size > 1;
  const titular = mixto ? tx(lang, 'Depende de la zona', 'Depends on the zone') : anyNo ? accesoTitulo(peor.acceso, lang) : accesoTitulo('permitido', lang);
  const enlaceCiudad = ciudadHrefs[c];
  return (
    <div className={marco} data-chrome>
      <div className="esb h-1.5" aria-hidden="true" />
      <div className={rejilla}>
        <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            {preset.ciudad
              ? <SelectField id="z-v" label={tx(lang, 'Vehículo', 'Vehicle')} value={cat} onChange={(x) => setCat(x as Categoria)} options={CATS.map((k) => ({ value: k, label: CATEGORIA[lang][k] }))} />
              : <SelectField id="z-c" label={tx(lang, 'Ciudad', 'City')} value={c} onChange={setC} options={ciudadOpt} />}
            <SelectField id="z-m" label={tx(lang, 'Motor', 'Engine')} value={en} onChange={(x) => setEn(x as Energia)} options={ENERGIAS.map((k) => ({ value: k, label: ENERGIA[lang][k] }))} />
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <NumberField id="z-a" label={tx(lang, 'Año de 1.ª matriculación', 'Year first registered')} value={anio} onChange={setAnio} min={1950} max={2026} grouping={false} lang={lang} />
            <SelectField id="z-mm" label={tx(lang, 'Mes', 'Month')} value={mes} onChange={setMes} options={MESES[lang].map((x, i) => ({ value: String(i + 1), label: x }))} />
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <SelectField id="z-d" label={tx(lang, 'Vehículo domiciliado en…', 'Vehicle registered in…')} value={dom} onChange={(x) => setDom(x as Perfil['domicilio'])} options={[{ value: 'ciudad', label: city.nombre }, { value: 'provincia', label: tx(lang, 'Otro municipio de la provincia', 'Another town in the province') }, { value: 'fuera', label: tx(lang, 'Fuera de la provincia o extranjero', 'Outside the province or abroad') }]} help={tx(lang, 'Domicilio del permiso de circulación y del IVTM', 'Address on the registration and road-tax record')} />
            <Toggle id="z-r" label={tx(lang, '¿Vives dentro de la zona?', 'Do you live inside the zone?')} value={res} onChange={(x) => { setRes(x); if (x === '1') setDom('ciudad'); }} options={[{ value: '0', label: tx(lang, 'No', 'No') }, { value: '1', label: tx(lang, 'Sí', 'Yes') }]} />
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            {preset.ciudad ? <NumberField id="z-cv" label={tx(lang, 'Caballos fiscales (P.2.1)', 'Fiscal horsepower (P.2.1)')} value={cvf} onChange={setCvf} max={99} decimals={2} lang={lang} help={tx(lang, 'En la ficha técnica; no son los CV de potencia', 'On the technical card; not engine horsepower')} />
              : <SelectField id="z-v" label={tx(lang, 'Vehículo', 'Vehicle')} value={cat} onChange={(x) => setCat(x as Categoria)} options={CATS.map((k) => ({ value: k, label: CATEGORIA[lang][k] }))} />}
            {esPhev(en)
              ? <NumberField id="z-k" label={tx(lang, 'Autonomía eléctrica', 'Electric range')} value={aut} onChange={setAut} unit="km" max={400} lang={lang} help={tx(lang, '40 km o más = etiqueta 0', '40 km or more = zero label')} />
              : <SelectField id="z-e" label={tx(lang, 'Norma Euro (V.9)', 'Euro standard (V.9)')} value={euro} onChange={setEuro} options={[{ value: '0', label: tx(lang, 'No la sé: usar la fecha', 'Not sure: use the date') }, ...[1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: `Euro ${n}` }))]} />}
          </div>
          <details className="rounded-lg border border-navy-200 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-navy-800">{tx(lang, 'Más opciones: fecha del viaje, caballos fiscales', 'More options: date of the trip, fiscal horsepower')}</summary>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4">
              <div className="grid grid-rows-subgrid row-span-3 content-start gap-y-0">
                <label htmlFor="z-f" className="mb-1 block text-sm font-medium text-navy-700">{tx(lang, '¿Qué día entras?', 'Which day are you driving in?')}</label>
                <input id="z-f" type="date" min="2026-01-01" max="2031-12-31" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} className="h-12 w-full self-start rounded-lg border border-navy-300 bg-white px-3 text-navy-900 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20" />
                <p className="mt-1 text-xs text-navy-500">{tx(lang, 'Para ver el calendario de cada ordenanza', 'To see each byelaw’s timetable')}</p>
              </div>
              {preset.ciudad
                ? (esPhev(en) ? <SelectField id="z-e" label={tx(lang, 'Norma Euro (V.9)', 'Euro standard (V.9)')} value={euro} onChange={setEuro} options={[{ value: '0', label: tx(lang, 'No la sé: usar la fecha', 'Not sure: use the date') }, ...[1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: `Euro ${n}` }))]} /> : <span />)
                : <NumberField id="z-cv" label={tx(lang, 'Caballos fiscales (P.2.1)', 'Fiscal horsepower (P.2.1)')} value={cvf} onChange={setCvf} max={99} decimals={2} lang={lang} help={tx(lang, 'En la ficha técnica', 'On the technical card')} />}
            </div>
          </details>
        </form>
        <div aria-live="polite" data-resultat className={caja}>
          <Cabecera label={tx(lang, `ZBE de ${city.nombre}, ${f.date(fecha)}`, `${city.nombre} ZBE, ${f.date(fecha)}`)} valor={titular} icono={<Pegatina e={et.etiqueta} size="lg" />} bajo={`${nombre}${et.dudoso ? tx(lang, ' (fecha de transición: compruébala)', ' (changeover date: check it)') : ''}`} />
          <ul className="mt-4 space-y-2">
            {vs.map((v) => (
              <li key={v.zona.id} className={`rounded-lg border px-3 py-2 text-sm acc-${v.acceso}`}>
                <p className="font-semibold">{v.zona.nombre}: {accesoTitulo(v.acceso, lang).toLowerCase()}</p>
                <p className="mt-0.5">{v.acceso === 'permitido' ? accesoDetalle('permitido', lang) : `${accesoDetalle(v.acceso, lang)} ${tx(lang, 'Control', 'Enforced')}: ${horarioTexto(v.zona, lang)}.`}</p>
                {v.acceso !== 'permitido' && !controlaElDia(v.zona, fecha) && <p className="mt-0.5 text-xs font-semibold">{tx(lang, `El ${f.date(fecha)} no hay control: la zona solo se controla ${horarioTexto(v.zona, 'es')}.`, `No enforcement on ${f.date(fecha)}: the zone is only enforced ${horarioTexto(v.zona, 'en')}.`)}</p>}
                {(lang === 'en' ? v.regla?.nota_en : v.regla?.nota) && <p className="mt-0.5 text-xs">{lang === 'en' ? v.regla?.nota_en : v.regla?.nota}</p>}
                {v.proximo && <p className="mt-1 text-xs font-semibold">{tx(lang, `A partir del ${f.date(v.proximo.fecha)}: ${accesoTitulo(v.proximo.acceso, 'es').toLowerCase()}.`, `From ${f.date(v.proximo.fecha)}: ${accesoTitulo(v.proximo.acceso, 'en').toLowerCase()}.`)}</p>}
              </li>
            ))}
          </ul>
          <Filas rows={[
            { label: tx(lang, 'Multa si entras sin permiso', 'Fine for entering without permission'), value: anyNo ? `${f.eur(m.importe)} · ${f.eur(multa(m.importe, true, P.multa.reduccion_pronto_pago))} ${tx(lang, 'con pronto pago', 'if paid early')}` : tx(lang, 'no aplica', 'not applicable') },
            { label: tx(lang, `Impuesto de circulación ${muni ? muni.nombre : tx(lang, '(art. 95)', '(section 95)')}`, `Road tax ${muni ? muni.nombre : '(section 95)'}`), value: muni ? `${f.eur(iv.cuota)} ${tx(lang, 'al año', 'a year')}` : `${f.eur(iv.minimaEstatal)} – ${f.eur(iv.maxima)}`, strong: true, sep: true },
            ...(muni && iv.bonificacion ? [{ label: tx(lang, 'Bonificación aplicada', 'Relief applied'), value: `−${f.pct(iv.pct)}`, muted: true }] : []),
            ...(muni?.bonificaciones_pendientes ? [{ label: tx(lang, 'Bonificaciones', 'Relief'), value: tx(lang, 'no incluidas: consulta la ordenanza', 'not included: check the byelaw'), muted: true }] : []),
          ]} />
          <p className="mt-3 text-xs text-navy-700">
            {enlaceCiudad && <><a className="font-medium text-accent-700 underline" href={enlaceCiudad}>{tx(lang, `Reglas completas de ${city.nombre}`, `Full ${city.nombre} rules`)}</a>{' · '}</>}
            {etiquetaHrefs[et.etiqueta] && <><a className="underline" href={etiquetaHrefs[et.etiqueta]}>{nombre}</a>{' · '}</>}
            {muni && ivtmHrefs[muni.slug] && <a className="underline" href={ivtmHrefs[muni.slug]}>{tx(lang, `IVTM ${muni.nombre}`, `${muni.nombre} road tax`)}</a>}
          </p>
          <Pasos lang={lang} steps={steps} />
          <Acciones lang={lang} text={() => tx(lang, `${nombre} · ZBE de ${city.nombre} (${f.date(fecha)}): ${titular.toLowerCase()}`, `${nombre} · ${city.nombre} ZBE (${f.date(fecha)}): ${titular.toLowerCase()}`)} />
          <Aviso lang={lang} methodHref={methodHref} />
        </div>
      </div>
    </div>
  );
}
