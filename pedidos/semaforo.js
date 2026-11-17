/*
 * pedidos/semaforo.js — El semáforo de pedidos.
 * Lo calcula la base (recalcular_resumen): el color manual del dueño (tabla ajustes_dueno)
 * manda; si no hay, vale el estado que el puente de solo lectura copia de Mi dinero
 * (mi_dinero_estado) mientras tenga menos de 6 horas. Si no hay fila en `resumen`,
 * a ella no se le muestra nada y el dueño ve "Sin semáforo".
 * El "motivo" de Mi dinero solo lo ve el dueño (nunca va a `resumen`).
 */
const Semaforo = {
  COLORES: {
    verde:    { color: "#1E7B4F", fondo: "#EAF6EF", frase: "Buen momento para pedir" },
    amarillo: { color: "#A35F00", fondo: "#FFF6E5", frase: "Solo lo necesario" },
    rojo:     { color: "#B42318", fondo: "#FDF0EE", frase: "Mejor esperar" }
  },
  COLOR_OPCIONES: [["auto", "Automático"], ["verde", "Verde"], ["amarillo", "Amarillo"], ["rojo", "Rojo"]],

  abierto: false,   // panel "Cambiar" desplegado (dueño)
  error: "",
  guardando: false,

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
    return h("section", { class: "semaforo", style: "background:" + i.fondo, "aria-label": "Cómo vamos este mes" },
      h("div", { class: "semaforo-fila" },
        h("span", { class: "punto", style: "background:" + i.color, "aria-hidden": "true" }),
        h("span", { class: "semaforo-frase" }, i.frase)),
      i.detalle ? h("span", { class: "semaforo-detalle" }, i.detalle) : null,
      h("span", { class: "semaforo-nota" }, "Lo urgente lo puedes pedir siempre."));
  },

  /* ---- Tiempo ---- */
  HORAS_VIGENTE: 6,

  /* "12 min", "3 h", "2 d" a partir de una fecha ISO; null si no hay fecha válida. */
  hace(iso) {
    const t = Date.parse(iso);
    if (!isFinite(t)) return null;
    const min = Math.max(0, Math.floor((Date.now() - t) / 60000));
    if (min < 1) return "un momento";
    if (min < 60) return min + " min";
    const hr = Math.floor(min / 60);
    return hr < 48 ? hr + " h" : Math.floor(hr / 24) + " d";
  },

  manualActivo() {
    const a = Datos.ajustes;
    return !!(a && a.semaforo_manual && (!a.manual_hasta || String(a.manual_hasta).slice(0, 10) >= hoyISO()));
  },

  /* Un estado de Mi dinero ¿es reciente? (menos de 6 horas desde que el puente lo calculó). */
  miDineroVigente() {
    const m = Datos.miDinero;
    const t = m ? Date.parse(m.calculado) : NaN;
    return isFinite(t) && Date.now() - t < this.HORAS_VIGENTE * 3600000;
  },

  /* De dónde sale el semáforo que ve ella (una línea para el dueño). */
  origen() {
    const a = Datos.ajustes;
    if (this.manualActivo()) {
      return { tipo: "manual", texto: a.manual_hasta ? "Puesto a mano hasta el " + fechaCorta(a.manual_hasta) : "Puesto a mano" };
    }
    const m = Datos.miDinero;
    if (!m) return { tipo: "sin", texto: "Mi dinero todavía no ha enviado datos" };
    const cuanto = this.hace(m.calculado);
    if (this.miDineroVigente()) return { tipo: "mi_dinero", texto: "Calculado por Mi dinero hace " + cuanto };
    return { tipo: "viejo", texto: "Sin datos de Mi dinero desde hace " + (cuanto || "mucho tiempo") };
  },

  /* ---- Dueño: tarjeta "Semáforo" ---- */
  tarjetaDueno() {
    const i = this.info(Datos.resumen);
    const o = this.origen();
    const m = Datos.miDinero;

    return h("section", { class: "tarjeta", "aria-labelledby": "s-titulo" },
      h("div", { class: "fila-spaced" },
        h("h2", { id: "s-titulo" }, "Semáforo"),
        h("button", {
          type: "button", class: "btn btn-sec btn-chico", id: "s-cambiar", "aria-expanded": this.abierto ? "true" : "false", "aria-controls": "s-panel",
          onclick: () => this.alternar()
        }, this.abierto ? "Cerrar" : "Cambiar")),
      h("span", { class: "meta" }, "Así lo ve ella"),
      i ? h("div", { class: "pila-chica" },
        h("div", { class: "semaforo-fila" },
          h("span", { class: "punto", style: "background:" + i.color, "aria-hidden": "true" }),
          h("span", { class: "semaforo-frase pequeno" }, i.frase)),
        i.detalle ? h("span", { class: "meta" }, i.detalle) : null)
        : h("span", { class: "texto-suave" }, "Sin semáforo"),
      h("span", { class: "meta", id: "s-origen" }, o.texto),
      o.tipo === "mi_dinero" && m && m.motivo && String(m.motivo).trim()
        ? h("span", { class: "nota-dueno", id: "s-motivo" }, "Motivo: " + String(m.motivo).trim()) : null,
      this.abierto ? this.panel() : null);
  },

  panel() {
    const color = borradores["s-color"] !== undefined ? borradores["s-color"] : "auto";
    return h("div", { class: "panel-linea", id: "s-panel" },
      pastillas("s-color", "Color", this.COLOR_OPCIONES, "auto", () => App.pintar()),
      color !== "auto" ? h("div", { class: "pila-chica" },
        campoTexto("s-hasta", "Hasta (opcional)", { tipo: "date", describe: "s-hasta-ayuda" }),
        h("span", { class: "meta", id: "s-hasta-ayuda" }, "Vacío = hasta que lo cambies")) : null,
      color === "auto" ? h("span", { class: "meta" }, "Automático: el color lo calcula Mi dinero.") : null,
      this.error ? h("p", { class: "error", role: "alert" }, this.error) : null,
      h("div", { class: "botones" },
        h("button", { type: "button", class: "btn btn-primario", id: "s-guardar", disabled: this.guardando, onclick: () => this.guardar() }, this.guardando ? "Guardando…" : "Guardar"),
        h("button", { type: "button", class: "btn btn-sec", onclick: () => this.alternar() }, "Cancelar")));
  },

  alternar() {
    this.abierto = !this.abierto;
    this.error = "";
    if (this.abierto) {
      const a = Datos.ajustes || {};
      borradores["s-color"] = a.semaforo_manual || "auto";
      borradores["s-hasta"] = a.manual_hasta || "";
    } else {
      limpiarBorradores("s-");
    }
    App.pintar();
    const f = document.getElementById(this.abierto ? "s-color-auto" : "s-cambiar");
    if (f) f.focus();
  },

  async guardar() {
    if (this.guardando) return;
    const color = borradores["s-color"] || "auto";
    const hasta = color === "auto" ? "" : (borradores["s-hasta"] || "");
    if (hasta && hasta < hoyISO()) { this.error = "La fecha «Hasta» no puede ser anterior a hoy."; return App.pintar(); }
    const fila = { semaforo_manual: color === "auto" ? null : color, manual_hasta: hasta || null };
    this.guardando = true; this.error = "";
    App.pintar();
    let fallo = false;
    try {
      const ex = await db.from("ajustes_dueno").select("id").maybeSingle();
      if (ex.error) throw ex.error;
      const res = ex.data
        ? await db.from("ajustes_dueno").update(fila).eq("id", 1)
        : await db.from("ajustes_dueno").insert(Object.assign({ id: 1 }, fila));
      if (res.error) throw res.error;
    } catch (e) { fallo = true; }
    this.guardando = false;
    if (fallo) {
      this.error = navigator.onLine ? "No se pudo guardar. Inténtalo otra vez." : "Sin conexión. Inténtalo cuando vuelva internet.";
      return App.pintar();
    }
    this.abierto = false;
    limpiarBorradores("s-");
    await Datos.cargar(["ajustes", "resumen"]);   // el trigger de la base ya recalculó el semáforo
    aviso("Guardado");
    App.pintar();
    const b = document.getElementById("s-cambiar"); if (b) b.focus();
  }
};
