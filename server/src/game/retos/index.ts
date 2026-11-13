// Fábrica: id de reto → clase que lo implementa.
import type { CtorReto } from "./base";
import { XCarro, XEspejos, XFusibles, XGeneradores, XLuces, XPurga, XSaboteador, XTerminal } from "./extras";
import { LCara, LMemoria, LPuente, LRayos, LTransmutacion, LValvulas } from "./legado";
import { T1C, T1D, T1T, T2C, T2D, T2T, T3C, T3D, T3T } from "./tareasCDT";
import { T1E, T1S, T2E, T2S, T3E, T3S } from "./tareasES";
import { T1F, T1H, T1V, T2F, T2H, T2V, T3F, T3H, T3V } from "./tareasHVF";

export const CLASES_RETO: Record<string, CtorReto> = {
  t1C: T1C,
  t2C: T2C,
  t3C: T3C,
  t1D: T1D,
  t2D: T2D,
  t3D: T3D,
  t1T: T1T,
  t2T: T2T,
  t3T: T3T,
  t1H: T1H,
  t2H: T2H,
  t3H: T3H,
  t1V: T1V,
  t2V: T2V,
  t3V: T3V,
  t1F: T1F,
  t2F: T2F,
  t3F: T3F,
  t1E: T1E,
  t2E: T2E,
  t3E: T3E,
  t1S: T1S,
  t2S: T2S,
  t3S: T3S,
  "x-fusibles": XFusibles,
  "x-terminal": XTerminal,
  "x-generadores": XGeneradores,
  "x-espejos": XEspejos,
  "x-carro": XCarro,
  "x-saboteador": XSaboteador,
  "x-purga": XPurga,
  "x-luces": XLuces,
  "l-memoria": LMemoria,
  "l-cara": LCara,
  "l-transmutacion": LTransmutacion,
  "l-rayos": LRayos,
  "l-puente": LPuente,
  "l-valvulas": LValvulas,
};
