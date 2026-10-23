// Estado sincronizado de una partida. El cliente lo recibe automáticamente.
import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";

export class Player extends Schema {
  @type("string") nombre = "";
  @type("string") kind = "";
  @type("float32") x = 0;
  @type("float32") y = 0;
  @type("float32") aim = 0;
  @type("int16") hp = 100;
  @type("int16") maxHp = 100;
  @type("boolean") vivo = true;
  @type("boolean") fantasma = false;
  @type("boolean") conectado = true;
  /** ok | congelado | red | aturdido */
  @type("string") estado = "ok";
  @type("float32") estadoT = 0;
  @type("float32") confuso = 0;
  @type("boolean") disfrazado = false;
  @type("float32") energia = 100;
  @type("float32") enfriamiento = 0;
  /** Habilidad activa (la propia o la de un alma que lleva). */
  @type("string") habilidad = "";
  @type(["string"]) almas = new ArraySchema<string>();
  /** Último input procesado (para reconciliar la predicción). */
  @type("uint32") seq = 0;
  /** Puzzle en el que está bloqueado ('' si ninguno). */
  @type("string") ocupado = "";
  /** Progreso de rescate 0..1 mientras un compañero lo libera. */
  @type("float32") rescate = 0;
  @type("uint16") bajas = 0;
}

/** Enemigos, pulpos aliados, torretas y sensores. */
export class Unit extends Schema {
  @type("string") t = "";
  /** humanos | aliens */
  @type("string") team = "humanos";
  @type("int16") x = 0;
  @type("int16") y = 0;
  @type("float32") ang = 0;
  @type("int16") hp = 1;
  @type("int16") maxHp = 1;
  /** '' | apuntando | aturdido | lanzando */
  @type("string") st = "";
  @type("float32") stT = 0;
  @type("boolean") blindado = false;
  /** Escudo antidisturbios todavía en la mano. */
  @type("boolean") escudo = false;
  @type("uint8") tanques = 0;
  @type("boolean") moviendo = false;
}

export class Projectile extends Schema {
  @type("string") k = "";
  @type("string") team = "";
  @type("int16") x = 0;
  @type("int16") y = 0;
  @type("float32") vx = 0;
  @type("float32") vy = 0;
  /** Para frascos: destino y tiempo de vuelo. */
  @type("int16") tx = 0;
  @type("int16") ty = 0;
  @type("float32") vuelo = 0;
}

export class Zone extends Schema {
  /** acido | gas | fuego */
  @type("string") k = "";
  @type("int16") x = 0;
  @type("int16") y = 0;
  @type("int16") r = 0;
  @type("float32") vida = 0;
}

/** Objetos del escenario: barriles, cajas, botiquines, coberturas, bloques, puentes, charcos. */
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
}

export class Puzzle extends Schema {
  /** libre | activo | bloqueado | resuelto */
  @type("string") estado = "libre";
  @type("float32") tiempo = 0;
  @type("float32") total = 0;
  /** sessionIds separados por coma. */
  @type("string") actores = "";
  @type("boolean") solo = false;
  /** Datos propios del minijuego en JSON. */
  @type("string") datos = "";
}

export class Soul extends Schema {
  @type("string") kind = "";
  @type("string") de = "";
  @type("int16") x = 0;
  @type("int16") y = 0;
}

export class GameState extends Schema {
  /** esperando | jugando | victoria | derrota */
  @type("string") fase = "esperando";
  @type("float32") tiempo = 0;
  @type("string") objetivo = "";
  @type("string") jefe = "";
  @type({ map: Player }) jugadores = new MapSchema<Player>();
  @type({ map: Unit }) unidades = new MapSchema<Unit>();
  @type({ map: Projectile }) proyectiles = new MapSchema<Projectile>();
  @type({ map: Zone }) zonas = new MapSchema<Zone>();
  @type({ map: Prop }) objetos = new MapSchema<Prop>();
  @type({ map: Door }) puertas = new MapSchema<Door>();
  @type({ map: Puzzle }) puzzles = new MapSchema<Puzzle>();
  @type({ map: Soul }) almas = new MapSchema<Soul>();
}
