/**
 * Cas de référence recalculés à la main sur les textes officiels (RECETTE §17.4 point 5) :
 * critères DGT des distintivos (dgt.es, pages 0/ECO/C/B), anexo V du RGV (CVF), artículo 95 TRLHL (cuotas),
 * artículos 80 et 94 de la Ley de Tráfico (multa), ordonnances municipales (src/data/zbe/*.json).
 */
import { describe, it, expect } from 'vitest';
import { etiquetaDe } from '../src/lib/engine/etiqueta';
import { veredicto, ciudad, CIUDADES, aplica, calendario, multa, etiquetasRestringidas, controlaElDia } from '../src/lib/engine/zbe';
import { cvfCombustion, cvfElectrico, cuotaTurismo, prorrateo, tramo, TRAMOS_ESTADO } from '../src/lib/engine/ivtm';

const fuera = { domicilio: 'fuera' as const, residenteZona: false };
const vecino = { domicilio: 'ciudad' as const, residenteZona: false };
const residente = { domicilio: 'ciudad' as const, residenteZona: true };

describe('etiqueta DGT (turismos)', () => {
  it('diésel de septiembre de 2015 = C, de agosto de 2015 = B dudoso (Euro 6 homologado desde 09/2014)', () => {
    expect(etiquetaDe({ categoria: 'turismo', energia: 'diesel', matriculacion: '2015-09' }).etiqueta).toBe('C');
    const r = etiquetaDe({ categoria: 'turismo', energia: 'diesel', matriculacion: '2015-08' });
    expect(r.etiqueta).toBe('B'); expect(r.dudoso).toBe(true); expect(r.alternativa).toBe('C');
    expect(etiquetaDe({ categoria: 'turismo', energia: 'diesel', matriculacion: '2014-08' }).dudoso).toBe(false);
  });
  it('diésel 2006-2014 = B ; antes de 2005 = sin etiqueta', () => {
    expect(etiquetaDe({ categoria: 'turismo', energia: 'diesel', matriculacion: '2006-01' }).etiqueta).toBe('B');
    expect(etiquetaDe({ categoria: 'turismo', energia: 'diesel', matriculacion: '2004-12' }).etiqueta).toBe('A');
    const t = etiquetaDe({ categoria: 'turismo', energia: 'diesel', matriculacion: '2005-06' });
    expect(t.etiqueta).toBe('A'); expect(t.dudoso).toBe(true);
  });
  it('gasolina : C desde enero de 2006, B desde el 1 de enero de 2001', () => {
    expect(etiquetaDe({ categoria: 'turismo', energia: 'gasolina', matriculacion: '2006-01' }).etiqueta).toBe('C');
    expect(etiquetaDe({ categoria: 'turismo', energia: 'gasolina', matriculacion: '2005-12' })).toMatchObject({ etiqueta: 'B', dudoso: true });
    expect(etiquetaDe({ categoria: 'turismo', energia: 'gasolina', matriculacion: '2001-01' }).etiqueta).toBe('B');
    expect(etiquetaDe({ categoria: 'turismo', energia: 'gasolina', matriculacion: '2000-06' })).toMatchObject({ etiqueta: 'A', dudoso: true, alternativa: 'B' });
    expect(etiquetaDe({ categoria: 'turismo', energia: 'gasolina', matriculacion: '1999-12' })).toMatchObject({ etiqueta: 'A', dudoso: false });
  });
  it('la norma Euro manda sobre la fecha', () => {
    expect(etiquetaDe({ categoria: 'turismo', energia: 'diesel', euro: 6, matriculacion: '2015-02' })).toMatchObject({ etiqueta: 'C', base: 'euro' });
    expect(etiquetaDe({ categoria: 'turismo', energia: 'gasolina', euro: 3, matriculacion: '2000-05' }).etiqueta).toBe('B');
    expect(etiquetaDe({ categoria: 'turismo', energia: 'diesel', euro: 3, matriculacion: '2006-03' }).etiqueta).toBe('A');
    expect(etiquetaDe({ categoria: 'turismo', energia: 'gasolina', euro: 2, matriculacion: '2001-03' }).etiqueta).toBe('A');
  });
  it('0 emisiones : BEV y PHEV de 40 km o más ; ECO : PHEV < 40 km, HEV, GLP, GNC que cumplen la C', () => {
    expect(etiquetaDe({ categoria: 'turismo', energia: 'bev', matriculacion: '2012-01' }).etiqueta).toBe('0');
    expect(etiquetaDe({ categoria: 'turismo', energia: 'phev', autonomiaKm: 40, matriculacion: '2020-01' }).etiqueta).toBe('0');
    expect(etiquetaDe({ categoria: 'turismo', energia: 'phev', autonomiaKm: 39, matriculacion: '2020-01' }).etiqueta).toBe('ECO');
    expect(etiquetaDe({ categoria: 'turismo', energia: 'hev', matriculacion: '2010-05' }).etiqueta).toBe('ECO');
    expect(etiquetaDe({ categoria: 'turismo', energia: 'glp', matriculacion: '2018-05' }).etiqueta).toBe('ECO');
    // Coche de 2003 transformado a GLP : no cumple la C, se queda en la B de su motor de gasolina.
    expect(etiquetaDe({ categoria: 'turismo', energia: 'glp', matriculacion: '2003-05' }).etiqueta).toBe('B');
  });
});

describe('etiqueta DGT (pesados y motos)', () => {
  it('más de 8 plazas y mercancías : C desde 2014 (Euro VI), B desde 2006, sea cual sea el combustible', () => {
    expect(etiquetaDe({ categoria: 'pesado', energia: 'diesel', matriculacion: '2014-01' }).etiqueta).toBe('C');
    expect(etiquetaDe({ categoria: 'pesado', energia: 'diesel', matriculacion: '2013-12' }).etiqueta).toBe('B');
    expect(etiquetaDe({ categoria: 'pesado', energia: 'gasolina', matriculacion: '2005-12' }).etiqueta).toBe('A');
    expect(etiquetaDe({ categoria: 'pesado', energia: 'diesel', euro: 5, matriculacion: '2015-01' }).etiqueta).toBe('B');
  });
  it('motos : Euro 2 = B, Euro 3 o más = C ; la fecha es solo orientativa', () => {
    expect(etiquetaDe({ categoria: 'moto', energia: 'gasolina', euro: 2, matriculacion: '2005-01' }).etiqueta).toBe('B');
    expect(etiquetaDe({ categoria: 'moto', energia: 'gasolina', euro: 4, matriculacion: '2017-01' }).etiqueta).toBe('C');
    // Directiva 2002/51/CE : Euro 3 obligatoria para todas las motos el 1/1/2007 (1/1/2008 para series cortas).
    expect(etiquetaDe({ categoria: 'moto', energia: 'gasolina', matriculacion: '2008-01' })).toMatchObject({ etiqueta: 'C', dudoso: false });
    expect(etiquetaDe({ categoria: 'moto', energia: 'gasolina', matriculacion: '2006-06' })).toMatchObject({ etiqueta: 'B', dudoso: true, alternativa: 'C' });
    expect(etiquetaDe({ categoria: 'moto', energia: 'gasolina', matriculacion: '2004-07' })).toMatchObject({ etiqueta: 'B', dudoso: false });
    expect(etiquetaDe({ categoria: 'moto', energia: 'gasolina', matriculacion: '2003-10' })).toMatchObject({ etiqueta: 'A', dudoso: true, alternativa: 'B' });
    expect(etiquetaDe({ categoria: 'moto', energia: 'gasolina', matriculacion: '2002-12' })).toMatchObject({ etiqueta: 'A', dudoso: false });
    // La Euro 5 no figura en el anexo II.E del RGV : C, dudosa.
    expect(etiquetaDe({ categoria: 'moto', energia: 'gasolina', euro: 5, matriculacion: '2022-01' })).toMatchObject({ etiqueta: 'C', dudoso: true });
    expect(etiquetaDe({ categoria: 'moto', energia: 'hev', matriculacion: '2008-01' }).etiqueta).toBe('ECO');
  });
  it('ciclomotores : sin Euro 3 ; B de julio de 2004 a 2016, C segura desde 2018 (Reglamento UE 168/2013)', () => {
    expect(etiquetaDe({ categoria: 'ciclomotor', energia: 'gasolina', matriculacion: '2010-06' })).toMatchObject({ etiqueta: 'B', dudoso: false });
    expect(etiquetaDe({ categoria: 'ciclomotor', energia: 'gasolina', matriculacion: '2017-06' })).toMatchObject({ etiqueta: 'B', dudoso: true, alternativa: 'C' });
    expect(etiquetaDe({ categoria: 'ciclomotor', energia: 'gasolina', matriculacion: '2018-01' })).toMatchObject({ etiqueta: 'C', dudoso: false });
    expect(etiquetaDe({ categoria: 'ciclomotor', energia: 'gasolina', euro: 2, matriculacion: '2010-06' }).etiqueta).toBe('B');
  });
  it('híbridos diésel : la ECO exige la C del diésel (Euro 6), no la de la gasolina', () => {
    expect(etiquetaDe({ categoria: 'turismo', energia: 'hev_diesel', euro: 5, matriculacion: '2013-01' }).etiqueta).toBe('B');
    expect(etiquetaDe({ categoria: 'turismo', energia: 'hev_diesel', euro: 6, matriculacion: '2013-01' }).etiqueta).toBe('ECO');
    expect(etiquetaDe({ categoria: 'turismo', energia: 'hev_diesel', matriculacion: '2012-03' }).etiqueta).toBe('B');
    expect(etiquetaDe({ categoria: 'turismo', energia: 'hev_diesel', matriculacion: '2015-03' })).toMatchObject({ etiqueta: 'B', dudoso: true, alternativa: 'ECO' });
    expect(etiquetaDe({ categoria: 'turismo', energia: 'hev_diesel', matriculacion: '2016-01' }).etiqueta).toBe('ECO');
    expect(etiquetaDe({ categoria: 'turismo', energia: 'phev_diesel', autonomiaKm: 50, matriculacion: '2012-01' }).etiqueta).toBe('0');
    // El de gasolina de 2010 sí es ECO (gasolina Euro 4/5 cumple la C).
    expect(etiquetaDe({ categoria: 'turismo', energia: 'hev', matriculacion: '2010-05' }).etiqueta).toBe('ECO');
  });
});

describe('caballos fiscales (anexo V RGV)', () => {
  it('1.598 cc y 4 cilindros, 4 tiempos : 0,08 × 399,5^0,6 × 4 = 11,6428… → 11,64 CVF (por defecto)', () => {
    // 399,5^0,6 = e^(0,6 × ln 399,5) = e^(0,6 × 5,99021) = e^3,59413 = 36,3840 ; × 0,08 × 4 = 11,6429
    expect(cvfCombustion(1598, 4)).toBe(11.64);
  });
  it('999 cc, 3 cilindros = 7,82 CVF (tramo < 8) ; 1.197 cc, 3 cilindros = 8,72 ; 1.968 cc, 4 cilindros = 13,19', () => {
    expect(cvfCombustion(999, 3)).toBe(7.82);
    expect(cvfCombustion(1197, 3)).toBe(8.72);
    expect(cvfCombustion(1968, 4)).toBe(13.19);
  });
  it('eléctrico : potencia efectiva / 5,152 (sin exponente)', () => {
    expect(cvfElectrico(51.52)).toBe(10);
    expect(cvfElectrico(100)).toBe(19.4); // 19,4099… recortado por defecto
  });
});

describe('IVTM (art. 95 TRLHL)', () => {
  it('tramos de turismos : 12,62 / 34,08 / 71,94 / 89,61 / 112,00', () => {
    expect([7.99, 8, 11.99, 12, 16, 19.99, 20, 35].map((c) => tramo(TRAMOS_ESTADO, c).tramo.cuota)).toEqual([12.62, 34.08, 34.08, 71.94, 89.61, 89.61, 112, 112]);
  });
  it('sin municipio : cuota mínima y máxima legal (coeficiente 2)', () => {
    const c = cuotaTurismo({ cvf: 11.64 });
    expect(c.minimaEstatal).toBe(34.08); expect(c.maxima).toBe(68.16); expect(c.cuota).toBe(34.08);
  });
  it('prorrateo por trimestres (art. 96.3) : alta en mayo = 3/4, baja en mayo = 2/4', () => {
    expect(prorrateo(100, 5, 'alta')).toBe(75);
    expect(prorrateo(100, 5, 'baja')).toBe(50);
    expect(prorrateo(100, 12, 'alta')).toBe(25);
  });
});

describe('multa ZBE (arts. 76.z3, 80 y 94 LSV)', () => {
  it('200 € ; 100 € con pronto pago', () => { expect(multa(200, false)).toBe(200); expect(multa(200, true)).toBe(100); });
});

describe('perfil', () => {
  it('residente implica colectivos de residentes ; domiciliado fuera no', () => {
    expect(aplica('residentes', residente)).toBe(true);
    expect(aplica('no_domiciliados', vecino)).toBe(false);
    expect(aplica('fuera_provincia', fuera)).toBe(true);
  });
});

describe('ZBE por ciudad (ordenanzas)', () => {
  it('hay datos y fuentes para cada ciudad', () => {
    expect(CIUDADES.length).toBeGreaterThanOrEqual(38);
    for (const c of CIUDADES) { expect(c.fuentes.length).toBeGreaterThan(0); expect(['2026-10-15', '2026-10-16']).toContain(c.verificado); expect(c.multa.importe).toBe(200); }
  });
  it('Madrid : turismo A de fuera prohibido en todo el municipio ; B de fuera solo a aparcamiento en Distrito Centro', () => {
    const a = veredicto('madrid', 'A', fuera, '2026-10-15');
    expect(a.find((v) => v.zona.id === 'municipal')!.acceso).toBe('prohibido');
    const b = veredicto('madrid', 'B', fuera, '2026-10-15');
    expect(b.find((v) => v.zona.id === 'centro')!.acceso).toBe('solo_aparcamiento');
    expect(b.find((v) => v.zona.id === 'municipal')!.acceso).toBe('permitido');
    expect(veredicto('madrid', 'B', residente, '2026-10-15').find((v) => v.zona.id === 'centro')!.acceso).toBe('permitido');
    expect(veredicto('madrid', 'A', vecino, '2026-10-15').find((v) => v.zona.id === 'municipal')!.acceso).toBe('condicionado');
    expect(veredicto('madrid', 'ECO', fuera, '2026-10-15').every((v) => v.acceso === 'permitido')).toBe(true);
  });
  it('Barcelona : A prohibida de lunes a viernes de 7 a 20 h, B permitida', () => {
    const [v] = veredicto('barcelona', 'A', vecino, '2026-10-15');
    expect(v.acceso).toBe('prohibido'); expect(v.franja).toEqual({ dias: 'LV', desde: '07:00', hasta: '20:00', festivos: false });
    expect(veredicto('barcelona', 'B', fuera, '2026-10-15')[0].acceso).toBe('permitido');
  });
  it('València : A de fuera de la provincia prohibida ; de la provincia, hasta el 31/12/2026 ; de la ciudad, hasta el 31/12/2027', () => {
    expect(veredicto('valencia', 'A', fuera, '2026-10-15')[0].acceso).toBe('prohibido');
    const prov = veredicto('valencia', 'A', { domicilio: 'provincia', residenteZona: false }, '2026-10-15')[0];
    expect(prov.acceso).toBe('permitido'); expect(prov.proximo?.fecha).toBe('2027-01-01');
    expect(veredicto('valencia', 'A', { domicilio: 'provincia', residenteZona: false }, '2027-01-01')[0].acceso).toBe('prohibido');
    expect(veredicto('valencia', 'A', vecino, '2027-12-31')[0].acceso).toBe('permitido');
    expect(veredicto('valencia', 'A', vecino, '2028-01-01')[0].acceso).toBe('prohibido');
  });
  it('Málaga : B no domiciliada permitida hasta el 29/11/2026, prohibida desde el 30/11/2026', () => {
    const hoy = veredicto('malaga', 'B', fuera, '2026-10-15')[0];
    expect(hoy.acceso).toBe('permitido'); expect(hoy.proximo?.fecha).toBe('2026-11-30');
    expect(veredicto('malaga', 'B', fuera, '2026-11-30')[0].acceso).toBe('prohibido');
    expect(veredicto('malaga', 'B', vecino, '2026-12-15')[0].acceso).toBe('permitido');
  });
  it('Palma : B prohibida desde 2027, C desde 2030', () => {
    expect(veredicto('palma', 'B', vecino, '2026-12-31')[0].acceso).toBe('permitido');
    expect(veredicto('palma', 'B', vecino, '2027-01-01')[0].acceso).toBe('prohibido');
    expect(veredicto('palma', 'C', vecino, '2030-01-01')[0].acceso).toBe('prohibido');
    expect(calendario(ciudad('palma'), '2026-10-15').map((x) => x.fecha)).toEqual(['2027-01-01', '2030-01-01']);
  });
  it('Getafe : B de fuera solo para ir a un aparcamiento adherido ; domiciliada, libre', () => {
    expect(veredicto('getafe', 'B', fuera, '2026-10-15')[0].acceso).toBe('solo_aparcamiento');
    expect(veredicto('getafe', 'B', vecino, '2026-10-15')[0].acceso).toBe('permitido');
  });
  it('Valladolid : B de no residentes prohibida desde el 31/12/2027 ; C desde 2030', () => {
    expect(veredicto('valladolid', 'B', vecino, '2027-12-30')[0].acceso).toBe('permitido');
    expect(veredicto('valladolid', 'B', vecino, '2027-12-31')[0].acceso).toBe('prohibido');
    expect(veredicto('valladolid', 'B', residente, '2028-06-01')[0].acceso).toBe('permitido');
  });
  it('Madrid : moto sin etiqueta de fuera condicionada desde el 7/4/2026 (DT 7.ª) ; turismo, prohibido', () => {
    const fuera = { domicilio: 'fuera' as const, residenteZona: false };
    expect(veredicto('madrid', 'A', fuera, '2026-10-16', 'moto')[0].acceso).toBe('condicionado');
    expect(veredicto('madrid', 'A', fuera, '2026-10-16', 'turismo')[0].acceso).toBe('prohibido');
    expect(veredicto('madrid', 'A', fuera, '2026-03-01', 'moto')[0].acceso).toBe('prohibido');
  });
  it('Bilbao : ciclomotor sin etiqueta exento ; moto, no', () => {
    const fuera = { domicilio: 'fuera' as const, residenteZona: false };
    expect(veredicto('bilbao', 'A', fuera, '2026-10-16', 'ciclomotor')[0].acceso).toBe('permitido');
    expect(veredicto('bilbao', 'A', fuera, '2026-10-16', 'moto')[0].acceso).toBe('prohibido');
  });
  it('Lleida : restricciones suspendidas desde el 22/01/2026', () => {
    const fuera = { domicilio: 'fuera' as const, residenteZona: false };
    expect(veredicto('lleida', 'A', fuera, '2025-10-01')[0].acceso).toBe('prohibido');
    expect(veredicto('lleida', 'A', fuera, '2026-10-16')[0].acceso).toBe('condicionado');
  });
  it('Burgos : sin etiqueta de fuera sin multa hasta el 5/8/2027, prohibido desde el 6/8/2027', () => {
    const fuera = { domicilio: 'fuera' as const, residenteZona: false };
    expect(veredicto('burgos', 'A', fuera, '2027-08-05')[0].acceso).toBe('condicionado');
    expect(veredicto('burgos', 'A', fuera, '2027-08-06')[0].acceso).toBe('prohibido');
  });
  it("L'Hospitalet : B prohibida desde el 1/1/2028", () => {
    const fuera = { domicilio: 'fuera' as const, residenteZona: false };
    expect(veredicto('hospitalet', 'B', fuera, '2027-12-31')[0].acceso).toBe('permitido');
    expect(veredicto('hospitalet', 'B', fuera, '2028-01-01')[0].acceso).toBe('prohibido');
  });
  it('etiquetas restringidas hoy para un visitante', () => {
    expect(etiquetasRestringidas(ciudad('barcelona'), '2026-10-15')).toEqual(['A']);
    expect(etiquetasRestringidas(ciudad('madrid'), '2026-10-15')).toEqual(['C', 'B', 'A']);
    expect(etiquetasRestringidas(ciudad('bilbao'), '2026-10-15')).toEqual(['B', 'A']);
  });
});

describe('IVTM por municipio (ordenanzas fiscales 2026)', () => {
  it('Madrid : 11,64 CVF = 59 € ; CERO = 59 × 25 % = 14,75 € ; ECO de 3 años = 14,75 €, de 7 años = 59 €', () => {
    expect(cuotaTurismo({ municipio: 'madrid', cvf: 11.64 }).cuota).toBe(59);
    expect(cuotaTurismo({ municipio: 'madrid', cvf: 11.64, etiqueta: '0', tecnologia: 'electrico' }).cuota).toBe(14.75);
    expect(cuotaTurismo({ municipio: 'madrid', cvf: 11.64, etiqueta: 'ECO', tecnologia: 'hibrido', antiguedadAnos: 3 }).cuota).toBe(14.75);
    expect(cuotaTurismo({ municipio: 'madrid', cvf: 11.64, etiqueta: 'ECO', tecnologia: 'hibrido', antiguedadAnos: 7 }).cuota).toBe(59);
  });
  it('Barcelona : coeficiente 2 → 68,16 € ; ECO 50 % → 34,08 €', () => {
    expect(cuotaTurismo({ municipio: 'barcelona', cvf: 11.64 }).cuota).toBe(68.16);
    expect(cuotaTurismo({ municipio: 'barcelona', cvf: 11.64, etiqueta: 'ECO', tecnologia: 'hibrido', antiguedadAnos: 2 }).cuota).toBe(34.08);
  });
  it('Donostia (foral) : 8,5 CVF cae en el tramo « menos de 9 » = 43,53 €', () => {
    expect(cuotaTurismo({ municipio: 'san-sebastian', cvf: 8.5 }).cuota).toBe(43.53);
    expect(cuotaTurismo({ municipio: 'san-sebastian', cvf: 9 }).cuota).toBe(89.25);
  });
  it('Valladolid : híbrido 50 % de 61,34 = 30,67 € ; histórico de 31 años = 0 €', () => {
    expect(cuotaTurismo({ municipio: 'valladolid', cvf: 10, tecnologia: 'hibrido' }).cuota).toBe(30.67);
    expect(cuotaTurismo({ municipio: 'valladolid', cvf: 10, tecnologia: 'combustion', antiguedadAnos: 31 }).cuota).toBe(0);
    expect(cuotaTurismo({ municipio: 'valladolid', cvf: 10, tecnologia: 'combustion', antiguedadAnos: 29 }).cuota).toBe(61.34);
  });
  it('Valladolid : el 50 % de los híbridos excluye a los diésel', () => {
    expect(cuotaTurismo({ municipio: 'valladolid', cvf: 11.64, tecnologia: 'hibrido' }).pct).toBe(0.5);
    expect(cuotaTurismo({ municipio: 'valladolid', cvf: 11.64, tecnologia: 'hibrido', diesel: true }).pct).toBe(0);
  });
  it('bonificaciones leídas el 16/10/2026 : Vitoria CERO 90 % 6 años, Palma ECO 50 %, Málaga eléctrico 75 % 5 años', () => {
    expect(cuotaTurismo({ municipio: 'vitoria-gasteiz', cvf: 11.64, etiqueta: '0', tecnologia: 'electrico', antiguedadAnos: 2 }).pct).toBe(0.9);
    expect(cuotaTurismo({ municipio: 'vitoria-gasteiz', cvf: 11.64, etiqueta: '0', tecnologia: 'electrico', antiguedadAnos: 6 }).pct).toBe(0);
    expect(cuotaTurismo({ municipio: 'palma', cvf: 11.64, etiqueta: 'ECO', tecnologia: 'hibrido' }).cuota).toBe(34.08);
    expect(cuotaTurismo({ municipio: 'malaga', cvf: 11.64, etiqueta: '0', tecnologia: 'electrico', antiguedadAnos: 1 }).cuota).toBe(16.45);
  });
  it('ninguna cuota municipal supera el doble de la mínima estatal en régimen común', async () => {
    const { MUNICIPIOS } = await import('../src/lib/engine/ivtm');
    for (const m of MUNICIPIOS.filter((x) => x.regimen === 'comun')) m.turismos.forEach((t, i) => expect(t.cuota).toBeLessThanOrEqual(TRAMOS_ESTADO[i].cuota * 2 + 0.01));
  });
});

describe('Día del viaje y veredicto mixto (audit del 28/10/2026)', () => {
  // ZBE Rondes de Barcelona y Cartuja de Sevilla : solo de lunes a viernes (horario de la ordenanza, en los datos)
  it('sábado 31/10/2026 sin control en Barcelona y Sevilla, lunes 02/11/2026 con control', () => {
    const bcn = ciudad('barcelona').zonas[0], sev = ciudad('sevilla').zonas[0];
    expect(controlaElDia(bcn, '2026-10-31')).toBe(false); expect(controlaElDia(sev, '2026-10-31')).toBe(false);
    expect(controlaElDia(bcn, '2026-11-02')).toBe(true);
  });
  it('Madrid, sin etiqueta, domiciliado: accesos distintos según la zona', () => {
    const vs = veredicto('madrid', 'A', { domicilio: 'ciudad', residenteZona: false }, '2026-10-28');
    expect(new Set(vs.map((v) => v.acceso)).size).toBeGreaterThan(1);
  });
});
