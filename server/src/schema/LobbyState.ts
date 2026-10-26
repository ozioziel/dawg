import { MapSchema, Schema, type } from "@colyseus/schema";

export class LobbyPlayer extends Schema {
  @type("string") nombre = "";
  @type("string") alien = "";
  @type("boolean") listo = false;
  @type("boolean") anfitrion = false;
  @type("uint8") skin = 0;
  @type("float32") x = 0.5;
  @type("float32") y = 0.7;
}

export class LobbyState extends Schema {
  @type("string") codigo = "";
  /** esperando | empezando */
  @type("string") estado = "esperando";
  @type("uint8") cuenta = 0;
  @type("uint8") necesarios = 3;
  @type({ map: LobbyPlayer }) jugadores = new MapSchema<LobbyPlayer>();
}
