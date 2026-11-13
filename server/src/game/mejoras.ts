// Recompensas roguelike de la partida: tras cada reto o jefe, cada jugador elige una mejora
// de su propio alien. La calidad depende del desempeño de TODO el equipo desde la última
// recompensa (tiempo, daño recibido, caídas, curación, rescates, control y apoyo), no de las bajas.
import { MEJORA_POR_ID, NOMBRE_RAREZA, ofrecerMejoras, parseMejora, puntuarDesempeno, isAlienKind } from "@dawg/shared";
import type { Partida } from "./Partida";

interface Ventana {
  inicio: number;
  dano: number;
  caidas: number;
  curacion: number;
  rescates: number;
  control: number;
  apoyo: number;
  bajas: number;
}

export class Mejoras {
  private v: Ventana = this.nueva(0);
  private snapshots = new Map<number, Map<string, string[]>>();
  private rng = Math.random;

  constructor(private g: Partida) {}

  private nueva(t: number): Ventana {
    return { inicio: t, dano: 0, caidas: 0, curacion: 0, rescates: 0, control: 0, apoyo: 0, bajas: 0 };
  }

  reset(conservarSnapshots: boolean): void {
    this.v = this.nueva(0);
    if (!conservarSnapshots) this.snapshots.clear();
  }

  registrar(tipo: "dano" | "caida" | "curacion" | "rescate" | "control" | "apoyo" | "baja", n: number): void {
    switch (tipo) {
      case "dano":
        this.v.dano += n;
        break;
      case "caida":
        this.v.caidas += n;
        break;
      case "curacion":
        this.v.curacion += n;
        break;
      case "rescate":
        this.v.rescates += n;
        break;
      case "control":
        this.v.control += n;
        break;
      case "apoyo":
        this.v.apoyo += n;
        break;
      case "baja":
        this.v.bajas += n;
        break;
    }
  }

  /** Puntuación actual del equipo (0..1). */
  puntuacion(esperado: number): number {
    let vida = 0;
    this.g.state.jugadores.forEach((p) => (vida += p.maxHp));
    return puntuarDesempeno({
      segundos: this.g.time - this.v.inicio,
      esperado,
      danoRecibido: this.v.dano,
      vidaEquipo: vida,
      caidas: this.v.caidas,
      curacion: this.v.curacion,
      rescates: this.v.rescates,
      control: this.v.control,
      apoyo: this.v.apoyo,
    });
  }

  /** Entrega una recompensa a todo el equipo. */
  otorgar(motivo: string, esperado = 90): void {
    const s = this.puntuacion(esperado);
    this.v = this.nueva(this.g.time);
    const calidad = s >= 0.75 ? "excelente" : s >= 0.5 ? "buena" : s >= 0.3 ? "normal" : "baja";
    this.g.aviso(`🎁 Recompensa por ${motivo}: desempeño del equipo ${Math.round(s * 100)}% (${calidad}). Elige una mejora (teclas 7·8·9 o toca la tarjeta).`, "exito");
    this.g.state.jugadores.forEach((p, id) => {
      if (!p.conectado || !isAlienKind(p.kind)) return;
      const ops = ofrecerMejoras(p.kind, p.mejoras.toArray(), s, this.rng);
      if (!ops.length) return;
      const d = this.g.pdata.get(id);
      d?.ofertas.push(ops);
    });
  }

  update(_dt: number): void {
    this.g.state.jugadores.forEach((p, id) => {
      const d = this.g.pdata.get(id);
      if (!d) return;
      if (!p.oferta && d.ofertas.length) p.oferta = d.ofertas.shift()!.join(",");
      p.ofertasPendientes = d.ofertas.length;
    });
  }

  elegir(id: string, i: number): void {
    const p = this.g.state.jugadores.get(id);
    if (!p || !p.oferta) return;
    const ops = p.oferta.split(",");
    const elegida = ops[Math.max(0, Math.min(ops.length - 1, i))];
    const m = parseMejora(elegida);
    if (!m) return;
    p.mejoras.push(elegida);
    p.oferta = "";
    this.g.recalcular(id, p);
    // La vida extra se nota al momento.
    if (m.def.efectos.vida && p.vivo) p.hp = Math.min(p.maxHp, p.hp + m.def.efectos.vida);
    this.g.fx("mejora", p.x, p.y, { s: `${m.def.nombre} (${NOMBRE_RAREZA[m.rareza]})` });
    this.g.aviso(`${p.nombre} eligió «${MEJORA_POR_ID[m.def.id].nombre}» (${NOMBRE_RAREZA[m.rareza]}).`, "info");
  }

  /** Guarda las mejoras al empezar un sector (para reintentar desde ahí). */
  guardar(sector: number): void {
    const m = new Map<string, string[]>();
    this.g.state.jugadores.forEach((p, id) => m.set(id, p.mejoras.toArray()));
    this.snapshots.set(sector, m);
  }

  snapshot(sector: number): Map<string, string[]> {
    return this.snapshots.get(sector) ?? new Map();
  }
}
