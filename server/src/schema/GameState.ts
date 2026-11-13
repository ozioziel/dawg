// Estado sincronizado de una partida. El cliente lo recibe automáticamente.
import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";

export class Player extends Schema {
  @type("string") nombre = "";
  /** Alien original elegido en el lobby (alienOriginal). */
  @type("string") kind = "";
  /** Forma actual (alienActivo): la propia o la de un alma prestada. */
  @type("string") forma = "";
  /** Skin elegida en el lobby (0 = original). */
  @type("uint8") skin = 0;
  @type("float32") x = 0;
  @type("float32") y = 0;
  @type("float32") aim = 0;
  @type("int16") hp = 100;
  @type("int16") maxHp = 100;
  @type("boolean") vivo = true;
  @type("boolean") fantasma = false;
  @type("boolean") conectado = true;
  /** ok | congelado | red | aturdido | agarrado */
  @type("string") estado = "ok";
  @type("float32") estadoT = 0;
  @type("float32") confuso = 0;
  /** Velocidad actual para la predicción del cliente. */
  @type("float32") velocidad = 200;
  /** Recurso de la forma actual (disfraz, psique, excavación). */
  @type("float32") energia = 100;
  @type("float32") enfriamiento = 0;
  @type("float32") enfMax = 1;
  /** Carga de la definitiva 0..1 y tiempo activo restante. */
  @type("float32") ulti = 0;
  @type("float32") ultiT = 0;
  @type("float32") ultiMax = 1;
  @type("boolean") disparando = false;
  // Cambiaformas
  @type("boolean") disfrazado = false;
  @type("string") identidad = "";
  @type("float32") sospecha = 0;
  // Curandera
  @type("string") cautivo = "";
  // Escarabajo
  @type("boolean") bajoTierra = false;
  /** 1 = entrada del túnel colocada, esperando la salida. */
  @type("uint8") tunel = 0;
  // Telequinesis
  @type("string") controla = "";
  /** Escudo temporal (psíquico del cuerpo o de la Fusión). */
  @type("float32") escudo = 0;
  // Vesper
  @type("float32") punal = 0;
  // Simbionte
  @type("uint8") colonia = 0;
  /** Canalización en curso 0..1 (escaneo, control mental) y su tipo. */
  @type("float32") canal = 0;
  @type("string") canalTipo = "";
  @type(["string"]) almas = new ArraySchema<string>();
  @type(["string"]) mejoras = new ArraySchema<string>();
  /** Mejoras ofrecidas ahora ("id:rareza,..."), vacío si no hay recompensa pendiente. */
  @type("string") oferta = "";
  @type("uint8") ofertasPendientes = 0;
  /** Último input procesado (para reconciliar la predicción). */
  @type("uint32") seq = 0;
  /** Reto en el que está bloqueado ('' si ninguno). */
  @type("string") ocupado = "";
  /** Progreso de rescate 0..1 mientras un compañero lo libera. */
  @type("float32") rescate = 0;
  @type("uint8") vidasSolo = 0;
  // Estadísticas (para recompensas y pantalla final)
  @type("uint16") bajas = 0;
  @type("uint16") curado = 0;
  @type("uint8") rescates = 0;
  @type("uint16") apoyo = 0;
}

/** Enemigos, aliados (pulpos, krakens, huéspedes, plantas), dispositivos y NPC. */
export class Unit extends Schema {
  @type("string") t = "";
  /** humanos | aliens */
  @type("string") team = "humanos";
  @type("int16") x = 0;
  @type("int16") y = 0;
  @type("float32") ang = 0;
  @type("int16") hp = 1;
  @type("int16") maxHp = 1;
  /** '' | apuntando | aturdido | lanzando | congelado | infectado | agarrando | enfriado | cargando */
  @type("string") st = "";
  @type("float32") stT = 0;
  @type("boolean") blindado = false;
  /** Escudo antidisturbios todavía en la mano. */
  @type("boolean") escudo = false;
  @type("uint8") tanques = 0;
  @type("boolean") moviendo = false;
  /** '' | T (control mental) | S (huésped del Simbionte) */
  @type("string") poseido = "";
  @type("string") dueno = "";
  @type("float32") infeccion = 0;
  @type("float32") frio = 0;
  @type("uint8") fase = 0;
  /** Etiqueta visible (NPC de retos: «Inspector», «Ancla»…). */
  @type("string") etiqueta = "";
}

export class Projectile extends Schema {
  @type("string") k = "";
  @type("string") team = "";
  @type("int16") x = 0;
  @type("int16") y = 0;
  @type("float32") vx = 0;
  @type("float32") vy = 0;
  /** Para frascos y granadas: destino y tiempo de vuelo. */
  @type("int16") tx = 0;
  @type("int16") ty = 0;
  @type("float32") vuelo = 0;
}

export class Zone extends Schema {
  /** acido | gas | fuego | eco | jardin | singularidad | electrico | aviso | vapor */
  @type("string") k = "";
  @type("int16") x = 0;
  @type("int16") y = 0;
  @type("int16") r = 0;
  @type("float32") vida = 0;
  @type("float32") total = 0;
}

/** Objetos del escenario: barriles, cajas, botiquines, coberturas, muros de hielo, túneles, puentes. */
export class Prop extends Schema {
  @type("string") k = "";
  @type("int16") x = 0;
  @type("int16") y = 0;
  @type("int16") hp = 1;
  @type("string") st = "";
  @type("float32") t = 0;
  @type("string") dueno = "";
}

export class Door extends Schema {
  @type("boolean") abierta = false;
  /** Sala sin reto en esta partida (sellada). */
  @type("boolean") sellada = false;
}

/** Estado de un reto (puzzle) asignado a una sala. */
export class Reto extends Schema {
  @type("string") def = "";
  @type("string") slot = "";
  /** inactivo | libre | activo | bloqueado | resuelto */
  @type("string") estado = "inactivo";
  @type("float32") tiempo = 0;
  @type("float32") total = 0;
  @type("float32") progreso = 0;
  /** sessionIds separados por coma. */
  @type("string") actores = "";
  @type("boolean") solo = false;
  /** Datos propios del minijuego en JSON. */
  @type("string") datos = "";
  /** Instrucción del paso actual. */
  @type("string") texto = "";
}

/** Objeto interactivo de un reto (consolas, celdas, placas, válvulas…). El cliente los dibuja todos igual. */
export class PzObj extends Schema {
  @type("string") k = "";
  @type("int16") x = 0;
  @type("int16") y = 0;
  /** Estado libre: '', on, off, ok, mal, oculto, brilla… */
  @type("string") st = "";
  /** Valor 0..1 (anillo de progreso, calor…). -1 = sin anillo. */
  @type("float32") v = -1;
  @type("string") txt = "";
  @type("uint32") c = 0;
  @type("float32") ang = 0;
  @type("uint8") f = 0;
  @type("string") reto = "";
  @type("int16") r = 0;
}

/** Zona rectangular que bloquea el paso (en casillas): abismos, vallas láser, contenedores… */
export class Bloqueo extends Schema {
  @type("string") k = "";
  @type("int16") x = 0;
  @type("int16") y = 0;
  @type("int16") w = 0;
  @type("int16") h = 0;
  @type("uint8") m = 0;
}

export class Soul extends Schema {
  @type("string") kind = "";
  @type("string") de = "";
  /** sessionId del dueño. */
  @type("string") dueno = "";
  @type("int16") x = 0;
  @type("int16") y = 0;
}

export class GameState extends Schema {
  /** esperando | jugando | victoria | derrota */
  @type("string") fase = "esperando";
  @type("float32") tiempo = 0;
  @type("string") objetivo = "";
  @type("uint8") sector = 1;
  @type("string") jefe = "";
  /** Eclipse activo (segundos restantes). */
  @type("float32") eclipse = 0;
  /** Apagón del sector III (segundos restantes). */
  @type("float32") apagon = 0;
  /** Progreso de apertura de la Gran Compuerta 0..1. */
  @type("float32") compuerta = 0;
  /** Plan de la partida (JSON): reto compuesto por sector, complicación y salas. */
  @type("string") plan = "";
  /** Evento de crisis actual del protocolo de fuga. */
  @type("string") crisis = "";
  @type("uint8") equipo = 1;
  @type({ map: Player }) jugadores = new MapSchema<Player>();
  @type({ map: Unit }) unidades = new MapSchema<Unit>();
  @type({ map: Projectile }) proyectiles = new MapSchema<Projectile>();
  @type({ map: Zone }) zonas = new MapSchema<Zone>();
  @type({ map: Prop }) objetos = new MapSchema<Prop>();
  @type({ map: Door }) puertas = new MapSchema<Door>();
  @type({ map: Reto }) retos = new MapSchema<Reto>();
  @type({ map: PzObj }) pz = new MapSchema<PzObj>();
  @type({ map: Bloqueo }) bloqueos = new MapSchema<Bloqueo>();
  @type({ map: Soul }) almas = new MapSchema<Soul>();
}
