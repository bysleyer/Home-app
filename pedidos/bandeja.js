/*
 * pedidos/bandeja.js — Bandeja del DUEÑO: semáforo, responder pedidos con lo que dice Mi dinero
 * (aprobar, ahora no, hablemos), seguir los ya respondidos y eliminar los cancelados.
 * Todo en línea, sin ventanas emergentes.
 */
const Bandeja = {
  modo: {},    // id -> "aprobar" | "ahora_no"  (formulario abierto en la tarjeta)
  errores: {}, // id -> texto de error

  vista() {
    const pend = Datos.pedidos.filter((p) => p.estado === "enviado");
    const resp = Datos.pedidos.filter((p) => p.estado !== "enviado");
    return h("div", { class: "pila" },
      Semaforo.tarjetaDueno(),
      h("h2", {}, "Por responder (" + pend.length + ")"),
      pend.length ? null : h("p", { class: "texto-suave" }, "No hay pedidos nuevos."),
      pend.map((p) => this.tarjetaDecision(p)),
      h("h2", {}, "Respondidos"),
      resp.length ? null : h("p", { class: "texto-suave" }, "Todavía no has respondido ninguno."),
      resp.map((p) => this.tarjetaRespondido(p)));
  },

  meta(p) {
    return [Pedidos.etq(Pedidos.PARA, p.para), Pedidos.etq(Pedidos.CATEGORIAS, p.categoria),
      Pedidos.etq(Pedidos.URGENCIA, p.urgencia),
      p.para_cuando ? "para el " + fechaCorta(p.para_cuando) : null,
      p.pago === "reembolso" ? "pide reembolso" : null].filter(Boolean).join(" · ");
  },

  /* ---- "Mi dinero dice": la evaluación que el puente escribió para este pedido ---- */
  /* Devuelve null si falta o es más vieja que el último cambio del pedido (se está calculando). */
  evaluacion(p) {
    const e = Datos.evaluaciones && Datos.evaluaciones[p.id];
    if (!e) return null;
    const cal = Date.parse(e.calculado), mod = Date.parse(p.modificado);
    if (!isFinite(cal)) return null;
    // Solo ella cambia monto o fecha, y solo mientras está "enviado". Las respuestas del
    // dueño (hablemos, ahora no…) también cambian "modificado", pero no la cuenta.
    if (p.estado === "enviado" && isFinite(mod) && cal < mod) return null;
    return e;
  },

  recuadroMiDinero(p) {
    const e = this.evaluacion(p);
    if (!e) {
      return h("div", { class: "mdd", "data-mdd": "calculando" },
        h("span", { class: "mdd-titulo" }, "Mi dinero dice"),
        h("span", { class: "texto-suave" }, "Calculando con Mi dinero… puede tardar hasta 15 minutos."));
    }
    const lineas = [];
    if (e.se_puede) {
      const f = e.fecha_posible || p.para_cuando;
      lineas.push(h("span", { class: "mdd-linea" }, f ? "Sí se puede el " + fechaCorta(f) : "Sí se puede"));
    } else {
      lineas.push(h("span", { class: "mdd-linea" }, "Ahora no"));
      if (e.motivo && String(e.motivo).trim()) lineas.push(h("span", { class: "texto-suave" }, String(e.motivo).trim()));
      if (e.fecha_posible) lineas.push(h("span", { class: "mdd-linea" }, "Se puede desde el " + fechaCorta(e.fecha_posible)));
    }
    if (e.rompe_regla && String(e.rompe_regla).trim()) {
      lineas.push(h("span", { class: "mdd-regla" }, "Rompe una regla: " + String(e.rompe_regla).trim()));
    }
    const viejo = Date.now() - Date.parse(e.calculado) > Semaforo.HORAS_VIGENTE * 3600000;
    if (viejo) lineas.push(h("span", { class: "meta" }, "(datos de hace " + Semaforo.hace(e.calculado) + ")"));
    return h("div", { class: "mdd " + (e.se_puede ? "si" : "no"), "data-mdd": e.se_puede ? "si" : "no" },
      h("span", { class: "mdd-titulo" }, "Mi dinero dice"), lineas);
  },

  /* Fecha por defecto al aprobar: la que dice Mi dinero si se puede y la hay; si no, para_cuando u hoy. */
  fechaAprobar(p) {
    const e = this.evaluacion(p);
    return (e && e.se_puede && e.fecha_posible) || p.para_cuando || hoyISO();
  },
  /* Fecha sugerida por defecto en "Ahora no": la fecha posible de Mi dinero, si la hay. */
  fechaSugerida(p) {
    const e = this.evaluacion(p);
    return (e && e.fecha_posible) || "";
  },

  /* Tarjeta con acciones: pedidos nuevos y los marcados "hablemos". */
  tarjetaDecision(p) {
    const modo = this.modo[p.id];
    const err = this.errores[p.id];
    const esHablemos = p.estado === "hablemos";
    const btn = (texto, clase, fn) => h("button", { type: "button", class: "btn " + clase, onclick: fn }, texto);

    let panel = null;
    if (modo === "aprobar") {
      panel = h("div", { class: "panel-linea" },
        h("div", { class: "dos-col" },
          campoTexto("b-fecha-" + p.id, "Fecha", { tipo: "date", valor: this.fechaAprobar(p) }),
          campoTexto("b-monto-" + p.id, "Monto ($)", { tipo: "number", inputmode: "decimal", min: "0", step: "any", valor: String(p.monto_estimado) })),
        err ? h("p", { class: "error", role: "alert" }, err) : null,
        h("div", { class: "botones" },
          btn("Confirmar aprobación", "btn-verde", (e) => this.aprobar(e.currentTarget, p)),
          btn("Volver", "btn-sec", () => this.cerrarPanel(p.id))));
    } else if (modo === "ahora_no") {
      panel = h("div", { class: "panel-linea" },
        campoTexto("b-sug-" + p.id, "Fecha sugerida", { tipo: "date", valor: this.fechaSugerida(p) }),
        err ? h("p", { class: "error", role: "alert" }, err) : null,
        h("div", { class: "botones" },
          btn("Confirmar: ahora no", "btn-primario", (e) => this.ahoraNo(e.currentTarget, p)),
          btn("Volver", "btn-sec", () => this.cerrarPanel(p.id))));
    }

    return h("div", { class: "tarjeta destacada" },
      h("div", { class: "fila-spaced" },
        h("span", { class: "que" }, p.que),
        h("span", { class: "monto" }, dinero(p.monto_estimado))),
      esHablemos ? h("div", {}, Pedidos.chip("hablemos")) : null,
      Fotos.fila(p),
      h("span", { class: "meta" }, this.meta(p)),
      p.nota ? h("span", { class: "texto-suave" }, "Nota de ella: " + p.nota) : null,
      this.recuadroMiDinero(p),
      campoTexto("b-nota-" + p.id, "Nota para ella (opcional)", { valor: p.nota_dueno || "", maxlength: 300, clase: "campo-chico" }),
      modo ? panel : h("div", { class: "tres-col" },
        btn("Aprobar", "btn-verde", () => this.abrirPanel(p.id, "aprobar")),
        btn("Ahora no", "btn-sec", () => this.abrirPanel(p.id, "ahora_no")),
        esHablemos ? null : btn("Hablemos", "btn-sec", (e) => this.hablemos(e.currentTarget, p))));
  },

  tarjetaRespondido(p) {
    if (p.estado === "hablemos") return this.tarjetaDecision(p);
    const partes = [dinero(Pedidos.montoCuenta(p))];
    if (p.estado === "aprobado" && p.fecha_aprobada) partes.push("aprobado para el " + fechaCorta(p.fecha_aprobada));
    if (p.estado === "ahora_no" && p.fecha_sugerida) partes.push("sugerido el " + fechaCorta(p.fecha_sugerida));
    if (p.pago === "reembolso") partes.push("reembolso");
    const acciones = [];
    if (p.estado === "aprobado" && p.pago === "reembolso") {
      acciones.push(h("button", { type: "button", class: "btn btn-sec", onclick: (e) => this.cambiar(e.currentTarget, p.id, "cerrado", "Marcado como devuelto") }, "Ya se lo devolví"));
    }
    if (p.estado === "aprobado" && p.pago === "dueno_paga") {
      acciones.push(h("button", { type: "button", class: "btn btn-sec", onclick: (e) => this.cambiar(e.currentTarget, p.id, "comprado", "Marcado como comprado") }, "Marcar comprado"));
    }
    return h("div", { class: "tarjeta" + (p.estado === "cancelado" ? " atenuada" : "") },
      h("div", { class: "fila-spaced" },
        h("div", { class: "columna" },
          h("span", { class: "que" }, p.que),
          h("span", { class: "meta" }, partes.join(" · "))),
        Pedidos.chip(p.estado)),
      Fotos.fila(p),
      p.nota_dueno ? h("span", { class: "nota-dueno" }, "“" + p.nota_dueno + "”") : null,
      acciones.length ? h("div", { class: "botones" }, acciones) : null,
      p.estado === "cancelado" ? Pedidos.zonaEliminar(p) : null);
  },

  abrirPanel(id, modo) { this.modo[id] = modo; this.errores[id] = ""; App.pintar(); const f = document.getElementById(modo === "aprobar" ? "b-fecha-" + id : "b-sug-" + id); if (f) f.focus(); },
  cerrarPanel(id) { delete this.modo[id]; this.errores[id] = ""; App.pintar(); },

  notaDe(p) { return (borradores["b-nota-" + p.id] !== undefined ? borradores["b-nota-" + p.id] : (p.nota_dueno || "")).trim() || null; },

  async aprobar(btn, p) {
    const fecha = borradores["b-fecha-" + p.id] !== undefined ? borradores["b-fecha-" + p.id] : this.fechaAprobar(p);
    const montoTxt = borradores["b-monto-" + p.id] !== undefined ? borradores["b-monto-" + p.id] : String(p.monto_estimado);
    const monto = Number(montoTxt);
    if (!fecha) { this.errores[p.id] = "Elige una fecha."; return App.pintar(); }
    if (!(monto > 0)) { this.errores[p.id] = "Escribe un monto mayor que cero."; return App.pintar(); }
    await this.guardar(btn, p, { estado: "aprobado", fecha_aprobada: fecha, monto_aprobado: monto, nota_dueno: this.notaDe(p) }, "Pedido aprobado");
  },
  async ahoraNo(btn, p) {
    const f = borradores["b-sug-" + p.id] !== undefined ? borradores["b-sug-" + p.id] : this.fechaSugerida(p);
    if (!f) { this.errores[p.id] = "Elige una fecha sugerida."; return App.pintar(); }
    await this.guardar(btn, p, { estado: "ahora_no", fecha_sugerida: f, nota_dueno: this.notaDe(p) }, "Respuesta enviada: ahora no");
  },
  async hablemos(btn, p) {
    await this.guardar(btn, p, { estado: "hablemos", nota_dueno: this.notaDe(p) }, "Respuesta enviada: hablemos");
  },
  async cambiar(btn, id, estado, ok) {
    btn.disabled = true;
    const { error } = await db.from("pedidos").update({ estado }).eq("id", id).select("id,estado").single();
    if (error) { btn.disabled = false; return App.falloRed("No se pudo guardar el cambio."); }
    aviso(ok);
    await Datos.cargar(["pedidos", "resumen"]);
    App.pintar();
  },

  async guardar(btn, p, cambios, ok) {
    btn.disabled = true;
    const { error } = await db.from("pedidos").update(cambios).eq("id", p.id).select(COLS_PEDIDO).single();
    if (error) { btn.disabled = false; return App.falloRed("No se pudo guardar la respuesta."); }
    delete this.modo[p.id];
    delete this.errores[p.id];
    limpiarBorradores("b-nota-" + p.id); limpiarBorradores("b-fecha-" + p.id);
    limpiarBorradores("b-monto-" + p.id); limpiarBorradores("b-sug-" + p.id);
    aviso(ok);
    await Datos.cargar(["pedidos", "resumen"]);
    App.pintar();
  }
};
