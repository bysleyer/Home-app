/*
 * casa/semaforo.js — El semáforo de la semana (lo publica la app Mi dinero).
 * Si no hay fila publicada, a ella no se le muestra nada; al dueño se le avisa.
 */
const Semaforo = {
  COLORES: {
    verde:    { color: "#1E7B4F", fondo: "#EAF6EF", frase: "Buen momento para pedir" },
    amarillo: { color: "#A35F00", fondo: "#FFF6E5", frase: "Solo lo necesario" },
    rojo:     { color: "#B42318", fondo: "#FDF0EE", frase: "Mejor esperar" }
  },

  info(r) {
    if (!r || !this.COLORES[r.semaforo]) return null;
    const c = this.COLORES[r.semaforo];
    return {
      color: c.color, fondo: c.fondo,
      frase: (r.frase && String(r.frase).trim()) || c.frase,
      detalle: r.mejor_fecha ? "Compras grandes: desde el " + fechaCorta(r.mejor_fecha) : ""
    };
  },

  /* Tarjeta completa para ella. Devuelve null si no hay semáforo. */
  tarjetaElla() {
    const i = this.info(Datos.resumen);
    if (!i) return null;
    return h("section", { class: "semaforo", style: "background:" + i.fondo, "aria-label": "Cómo vamos esta semana" },
      h("div", { class: "semaforo-fila" },
        h("span", { class: "punto", style: "background:" + i.color, "aria-hidden": "true" }),
        h("span", { class: "semaforo-frase" }, i.frase)),
      i.detalle ? h("span", { class: "semaforo-detalle" }, i.detalle) : null,
      h("span", { class: "semaforo-nota" }, "Lo urgente lo puedes pedir siempre."));
  },

  /* Bloque pequeño para el dueño: lo que ella ve. */
  bloqueDueno() {
    const i = this.info(Datos.resumen);
    if (!i) {
      return h("div", { class: "tarjeta" },
        h("span", { class: "meta" }, "Así ve ella tu semana"),
        h("span", { class: "texto-suave" }, "Tu app todavía no ha publicado el semáforo."));
    }
    return h("div", { class: "tarjeta" },
      h("span", { class: "meta" }, "Así ve ella tu semana"),
      h("div", { class: "semaforo-fila" },
        h("span", { class: "punto", style: "background:" + i.color, "aria-hidden": "true" }),
        h("span", { class: "semaforo-frase pequeno" }, i.frase)),
      i.detalle ? h("span", { class: "meta" }, i.detalle) : null);
  }
};
