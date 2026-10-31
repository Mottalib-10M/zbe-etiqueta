/**
 * ¿Puedo entrar en la ZBE? Lee las reglas de cada ordenanza municipal (src/data/zbe/<ciudad>.json) y
 * responde para una etiqueta, un perfil de usuario y una fecha. Ninguna regla está escrita aquí : el
 * motor solo interpreta los datos, cada uno con su fuente y su fecha de comprobación.
 */
import type { Etiqueta, Categoria } from './etiqueta';

export type Acceso = 'permitido' | 'prohibido' | 'solo_aparcamiento' | 'condicionado';
export type Usuario =
  | 'todos' | 'domiciliados' | 'no_domiciliados' | 'empadronados' | 'no_empadronados' | 'municipio'
  | 'residentes' | 'no_residentes' | 'no_registrados' | 'provincia' | 'fuera_provincia';
/** `vehiculos` : la regla solo vale para esas categorías (p. ej. motos exentas) ; sin él, para todas. */
export interface Regla { etiqueta: Etiqueta; usuario: Usuario; acceso: Acceso; desde?: string; hasta?: string; vehiculos?: Categoria[]; nota?: string; nota_en?: string }
export interface Zona { id: string; nombre: string; ambito: string; ambito_en: string; horario: string; horario_en?: string; horario_nota?: string; desde?: string; superficie_km2?: number; superficie_ha?: number; reglas: Regla[]; afecta?: string }
export interface Fuente { url: string; label: string; cita?: string }
export interface Ciudad {
  slug: string; nombre: string; provincia: string; ccaa: string;
  estado: 'sanciona' | 'informativa' | 'aprobada' | 'pendiente' | 'suspendida';
  zonas: Zona[];
  criterio_usuario?: string;
  multa: { importe: number; pronto_pago: number; nota?: string; nota_en?: string };
  pegatina_obligatoria?: boolean;
  excepciones: string[];
  excepciones_en: string[];
  control?: string;
  control_en?: string;
  pendiente?: string;
  pendiente_en?: string;
  ordenanza?: { nombre: string; url: string; publicacion?: string };
  fuentes: Fuente[];
  verificado: string;
  nota_verificacion?: string;
  nota_verificacion_en?: string;
}

/** Perfil del conductor : dónde está domiciliado el vehículo (IVTM / Registro de la DGT) y si reside dentro de la zona. */
export interface Perfil { domicilio: 'ciudad' | 'provincia' | 'fuera'; residenteZona: boolean }

const mods = import.meta.glob<{ default: Ciudad }>('../../data/zbe/*.json', { eager: true });
export const CIUDADES: Ciudad[] = Object.values(mods).map((m) => m.default).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
export const ciudad = (slug: string): Ciudad => {
  const c = CIUDADES.find((x) => x.slug === slug);
  if (!c) throw new Error(`Ciudad sin datos : ${slug}`);
  return c;
};

/** ¿La regla se aplica a este perfil ? */
export function aplica(u: Usuario, p: Perfil): boolean {
  switch (u) {
    case 'todos': return true;
    case 'domiciliados': case 'empadronados': case 'municipio': return p.domicilio === 'ciudad';
    case 'no_domiciliados': case 'no_empadronados': return p.domicilio !== 'ciudad';
    case 'residentes': return p.residenteZona;
    case 'no_residentes': case 'no_registrados': return !p.residenteZona;
    case 'provincia': return p.domicilio === 'provincia';
    case 'fuera_provincia': return p.domicilio === 'fuera';
  }
}
/** Cuanto más estrecho el colectivo, más prioridad : la regla de los residentes gana a la general. */
const PRIORIDAD: Record<Usuario, number> = { residentes: 5, domiciliados: 4, empadronados: 4, municipio: 4, provincia: 3, fuera_provincia: 3, no_residentes: 2, no_registrados: 2, no_domiciliados: 2, no_empadronados: 2, todos: 1 };

const vigente = (r: Regla, fecha: string) => (!r.desde || r.desde <= fecha) && (!r.hasta || fecha <= r.hasta);

export interface Veredicto {
  zona: Zona;
  acceso: Acceso;
  regla?: Regla;
  /** Horario en que se controla ; null = todo el día, todos los días. */
  franja: { dias: 'LV' | 'LS' | 'todos'; desde: string; hasta: string; festivos: boolean } | null;
  /** Próximo cambio para esta etiqueta y este perfil. */
  proximo?: { fecha: string; acceso: Acceso; regla: Regla };
}

export function franja(h: string): Veredicto['franja'] {
  const m = h.match(/(\d\d:\d\d)-(\d\d:\d\d)/);
  if (!m || h === '24h' || (/00:00-24:00/.test(h) && !/L-[VS]/.test(h))) return null;
  return { dias: /L-V/.test(h) ? 'LV' : /L-S/.test(h) ? 'LS' : 'todos', desde: m[1], hasta: m[2], festivos: /festivo|laborable/.test(h) };
}

/** ¿Se controla la zona ese día de la semana? « L-V » : lunes a viernes, « L-S » : lunes a sábado (la hora y los
 *  festivos no se tienen en cuenta : el horario se muestra en el resultado). */
export function controlaElDia(z: Zona, fecha: string): boolean {
  const d = new Date(`${fecha}T12:00:00Z`).getUTCDay();
  if (/L-V/.test(z.horario)) return d >= 1 && d <= 5;
  if (/L-S/.test(z.horario)) return d >= 1 && d <= 6;
  return true;
}

/** Una regla limitada a ciertas categorías gana a la general para esas categorías. */
const especifica = (r: Regla) => (r.vehiculos ? 10 : 0);

export function veredictoZona(z: Zona, etiqueta: Etiqueta, p: Perfil, fecha: string, cat: Categoria = 'turismo'): Veredicto {
  const candidatas = z.reglas.filter((r) => r.etiqueta === etiqueta && aplica(r.usuario, p) && (!r.vehiculos || r.vehiculos.includes(cat)));
  const ahora = candidatas.filter((r) => vigente(r, fecha)).sort((a, b) => especifica(b) + PRIORIDAD[b.usuario] - especifica(a) - PRIORIDAD[a.usuario] || (b.desde ?? '').localeCompare(a.desde ?? ''));
  const regla = ahora[0];
  const acceso: Acceso = regla?.acceso ?? 'permitido';
  const futuras = candidatas.filter((r) => r.desde && r.desde > fecha && r.acceso !== acceso).sort((a, b) => (a.desde ?? '').localeCompare(b.desde ?? ''));
  const f = futuras[0];
  return { zona: z, acceso, regla, franja: franja(z.horario), proximo: f ? { fecha: f.desde!, acceso: f.acceso, regla: f } : undefined };
}

export function veredicto(slug: string, etiqueta: Etiqueta, p: Perfil, fecha: string, cat: Categoria = 'turismo'): Veredicto[] {
  return ciudad(slug).zonas.map((z) => veredictoZona(z, etiqueta, p, fecha, cat));
}

/** Etiquetas que no pueden circular libremente hoy en alguna zona de la ciudad, para un perfil de fuera. */
export function etiquetasRestringidas(c: Ciudad, fecha: string, p: Perfil = { domicilio: 'fuera', residenteZona: false }, cat: Categoria = 'turismo'): Etiqueta[] {
  const todas: Etiqueta[] = ['0', 'ECO', 'C', 'B', 'A'];
  return todas.filter((e) => c.zonas.some((z) => veredictoZona(z, e, p, fecha, cat).acceso !== 'permitido'));
}

/** Fechas futuras de endurecimiento en la ciudad (para el calendario de la página). */
export function calendario(c: Ciudad, desde: string) {
  const out: Array<{ fecha: string; zona: string; regla: Regla }> = [];
  for (const z of c.zonas) for (const r of z.reglas) if (r.desde && r.desde > desde && r.acceso !== 'permitido' && !r.vehiculos) out.push({ fecha: r.desde, zona: z.nombre, regla: r });
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Multa con pronto pago (art. 94 de la Ley de Tráfico : −50 % en 20 días naturales). */
export function multa(importe: number, prontoPago: boolean, reduccion = 0.5): number {
  return prontoPago ? importe * (1 - reduccion) : importe;
}
