/*
 * pedidos/pedidos.js — Pedidos, lado de ELLA: Inicio de Pedidos (mis pedidos) y formulario "Pedir".
 * También guarda las etiquetas y ayudas que comparte la bandeja del dueño, y el
 * "Eliminar" de pedidos cancelados (fotos y pedido), que usan los dos.
 * Ella nunca ve cálculos ni saldos: solo estado, fecha y la nota del dueño.
 */
const Pedidos = {
  PARA: [["ninos", "Niños"], ["casa", "Casa"], ["ella", "Yo"]],
  CATEGORIAS: [["hijos", "Hijos"], ["comida", "Comida/súper"], ["escuela", "Escuela"],
               ["salud_ninos", "Salud niños"], ["casa", "Casa"], ["otro", "Otro"]],
  URGENCIA: [["ya", "Lo necesito ya"], ["espera", "Puede esperar"]],
  PAGO: [["dueno_paga", "Págalo tú"], ["reembolso", "Lo pagué yo"]],
  CHIPS: {
    enviado: "Enviado", visto: "Visto", aprobado: "Aprobado", ahora_no: "Ahora no",
    hablemos: "Hablemos", comprado: "Comprado", cancelado: "Cancelado", cerrado: "Cerrado"
  },

  etq(lista, valor) { const x = lista.find((e) => e[0] === valor); return x ? x[1] : valor; },
  chip(estado) { return h("span", { class: "chip e-" + estado }, this.CHIPS[estado] || estado); },

  /* Monto que cuenta: el aprobado si existe, si no el estimado. */
  montoCuenta(p) { return p.monto_aprobado !== null && p.monto_aprobado !== undefined ? Number(p.monto_aprobado) : Number(p.monto_estimado); },

  /* "Aprobado este mes": lo publicado por la base si es de este mes; si no, se suma aquí. */
  totalMes() {
    const r = Datos.resumen;
    const mes = mesActual();
    if (r && r.total_mes_ella !== null && r.total_mes_ella !== undefined && r.mes === mes) return Number(r.total_mes_ella);
    return Datos.pedidos
      .filter((p) => ["aprobado", "comprado", "cerrado"].includes(p.estado) && p.fecha_aprobada && String(p.fecha_aprobada).slice(0, 7) === mes)
      .reduce((a, p) => a + this.montoCuenta(p), 0);
  },

  respuestaElla(p) {
    if (p.estado === "aprobado") {
      return "Aprobado para el " + fechaCorta(p.fecha_aprobada) + (p.pago === "reembolso" ? " · te lo devuelve" : "");
    }
    if (p.estado === "ahora_no") return p.fecha_sugerida ? "Ahora no. Mejor el " + fechaCorta(p.fecha_sugerida) + "." : "Ahora no.";
    if (p.estado === "hablemos") return "Quiere hablarlo contigo.";
    if (p.estado === "comprado") return "Comprado.";
    if (p.estado === "cerrado") return "Devuelto.";
    return "";
  },

  metaElla(p) {
    return [this.etq(this.PARA, p.para), this.etq(this.CATEGORIAS, p.categoria), dinero(p.monto_estimado),
      p.para_cuando ? "para el " + fechaCorta(p.para_cuando) : null,
      p.pago === "reembolso" ? "reembolso" : null].filter(Boolean).join(" · ");
  },

  /* ---- Inicio de Pedidos (ella) ---- */
  vistaInicio() {
    const sem = Semaforo.tarjetaElla();
    const orden = (p) => (p.estado === "cancelado" ? 1 : 0);
    const mios = Datos.pedidos.slice().sort((a, b) => orden(a) - orden(b)); // ya vienen del más nuevo al más viejo
    return h("div", { class: "pila" },
      sem,
      h("div", { class: "tarjeta fila-total" },
        h("span", { class: "texto-suave" }, "Aprobado este mes para lo que pediste"),
        h("strong", { class: "total" }, dinero(this.totalMes()))),
      h("div", { class: "fila-titulo" },
        h("h2", {}, "Mis pedidos"),
        h("button", { type: "button", class: "btn btn-primario", onclick: () => AppPedidos.irA("pedir") }, "+ Pedir algo")),
      mios.length ? null : h("p", { class: "texto-suave" }, "Todavía no has pedido nada."),
      mios.map((p) => this.tarjetaElla(p)));
  },

  tarjetaElla(p) {
    const resp = this.respuestaElla(p);
    const nota = p.nota_dueno && p.estado !== "enviado" ? "“" + p.nota_dueno + "”" : "";
    return h("div", { class: "tarjeta" + (p.estado === "cancelado" ? " atenuada" : "") },
      h("div", { class: "fila-spaced" }, h("span", { class: "que" }, p.que), this.chip(p.estado)),
      Fotos.fila(p),
      h("span", { class: "meta" }, this.metaElla(p)),
      resp ? h("span", { class: "respuesta" }, resp) : null,
      nota ? h("span", { class: "nota-dueno" }, nota) : null,
      p.estado === "cancelado" ? this.zonaEliminar(p) : null,
      (["enviado", "ahora_no", "hablemos"].includes(p.estado) || (p.estado === "aprobado" && p.pago === "dueno_paga")) ?
        h("div", { class: "botones" },
          ["enviado", "ahora_no", "hablemos"].includes(p.estado) ? h("button", {
            type: "button", class: "btn btn-sec",
            onclick: (e) => this.cambiarEstado(e.currentTarget, p.id, "cancelado", "Pedido cancelado")
          }, "Cancelar pedido") : null,
          p.estado === "aprobado" && p.pago === "dueno_paga" ? h("button", {
            type: "button", class: "btn btn-verde",
            onclick: (e) => this.cambiarEstado(e.currentTarget, p.id, "comprado", "Marcado como comprado")
          }, "Ya lo compré") : null) : null);
  },

  async cambiarEstado(btn, id, estado, ok) {
    btn.disabled = true;
    const { error } = await db.from("pedidos").update({ estado }).eq("id", id).select("id,estado").single();
    if (error) { btn.disabled = false; return App.falloRed("No se pudo guardar el cambio."); }
    aviso(ok);
    await Datos.cargar(["pedidos"]);
    App.pintar();
  },

  /* ---- Eliminar un pedido CANCELADO (con sus fotos) ---- */
  confirmando: {},   // id -> true mientras se pide confirmación en la tarjeta
  erroresEliminar: {},
  eliminando: {},

  /* Botón "Eliminar" o, ya pulsado, la confirmación en línea (sin ventanas emergentes). */
  zonaEliminar(p) {
    if (!this.confirmando[p.id]) {
      return h("div", { class: "botones" },
        h("button", { type: "button", class: "btn btn-sec btn-eliminar", onclick: () => this.pedirConfirmacion(p.id) }, "Eliminar"));
    }
    const err = this.erroresEliminar[p.id];
    const trabajando = !!this.eliminando[p.id];
    return h("div", { class: "panel-linea", role: "group", "aria-label": "Confirmar eliminar " + p.que },
      h("p", { class: "texto-fuerte", id: "el-txt-" + p.id }, "¿Eliminar para siempre? Se borran también sus fotos."),
      err ? h("p", { class: "error", role: "alert" }, err) : null,
      h("div", { class: "botones" },
        h("button", { type: "button", class: "btn btn-peligro", id: "el-si-" + p.id, disabled: trabajando, "aria-describedby": "el-txt-" + p.id,
          onclick: (e) => this.eliminar(e.currentTarget, p) }, trabajando ? "Eliminando…" : "Sí, eliminar"),
        h("button", { type: "button", class: "btn btn-sec", id: "el-no-" + p.id, disabled: trabajando, onclick: () => this.cancelarConfirmacion(p.id) }, "No")));
  },

  pedirConfirmacion(id) {
    this.confirmando[id] = true; this.erroresEliminar[id] = "";
    App.pintar();
    const b = document.getElementById("el-no-" + id); if (b) b.focus();
  },
  cancelarConfirmacion(id) {
    delete this.confirmando[id]; delete this.erroresEliminar[id];
    App.pintar();
  },

  /* Primero se borran las fotos y después el pedido (así nunca quedan fotos sueltas sin dueño). */
  async eliminar(btn, p) {
    if (this.eliminando[p.id]) return;
    this.eliminando[p.id] = true; this.erroresEliminar[p.id] = "";
    App.pintar();
    const sinRed = () => (navigator.onLine ? "" : " Sin conexión: inténtalo cuando vuelva internet.");
    let texto = "";
    try {
      const rutas = Array.isArray(p.fotos) ? p.fotos.filter(Boolean) : [];
      if (rutas.length) {
        const r = await db.storage.from("facturas").remove(rutas);
        if (r && r.error) texto = "No se pudieron borrar las fotos. El pedido sigue aquí." + sinRed();
        // Storage no da error cuando sus reglas no le dejan borrar: solo devuelve menos objetos.
        else if (r && Array.isArray(r.data) && r.data.length < rutas.length) texto = "No se pudieron borrar todas las fotos. El pedido sigue aquí.";
      }
      if (!texto) {
        const r = await db.from("pedidos").delete().eq("id", p.id);
        if (r && r.error) texto = "Las fotos se borraron, pero no se pudo eliminar el pedido. Inténtalo otra vez." + sinRed();
      }
    } catch (e) {
      texto = "No se pudo eliminar." + sinRed();
    }
    delete this.eliminando[p.id];
    if (texto) { this.erroresEliminar[p.id] = texto; App.pintar(); return; }
    delete this.confirmando[p.id]; delete this.erroresEliminar[p.id];
    if (typeof Fotos !== "undefined") (p.fotos || []).forEach((r) => { delete Fotos._urls[r]; });
    aviso("Pedido eliminado");
    await Datos.cargar(["pedidos", "resumen"]);
    App.pintar();
  },

  /* ---- Formulario Pedir ---- */
  vistaPedir() {
    const err = Pedidos._error;
    return h("form", { class: "pila", novalidate: true, onsubmit: (e) => this.enviar(e) },
      campoTexto("p-que", "¿Qué necesitas?", { placeholder: "Ej. zapatos para la escuela", maxlength: 120 }),
      pastillas("p-para", "¿Para quién?", this.PARA, "ninos"),
      pastillas("p-cat", "Categoría", this.CATEGORIAS, "hijos"),
      h("div", { class: "dos-col" },
        campoTexto("p-monto", "Total con impuestos ($)", { tipo: "number", inputmode: "decimal", min: "0", step: "any", placeholder: "0" }),
        campoTexto("p-fecha", "Para cuándo", { tipo: "date" })),
      pastillas("p-urg", "¿Qué tan urgente?", this.URGENCIA, "espera"),
      pastillas("p-pago", "¿Quién paga?", this.PAGO, "dueno_paga"),
      campoTexto("p-nota", "Nota (opcional)", { placeholder: "Talla, tienda, enlace…", maxlength: 300 }),
      Fotos.campo(Pedidos._errorFotos),
      err ? h("p", { class: "error", role: "alert" }, err) : null,
      h("button", { type: "submit", class: "btn btn-grande btn-primario", id: "p-enviar", disabled: this._enviando }, this._enviando ? "Enviando…" : "Enviar pedido"));
  },

  _uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    const x = Array.from(b, (n) => n.toString(16).padStart(2, "0")).join("");
    return x.slice(0, 8) + "-" + x.slice(8, 12) + "-" + x.slice(12, 16) + "-" + x.slice(16, 20) + "-" + x.slice(20);
  },

  async enviar(e) {
    e.preventDefault();
    if (this._enviando || Fotos.procesando) return;
    const b = borradores;
    const que = (b["p-que"] || "").trim();
    const monto = Number(b["p-monto"]);
    const fotos = Fotos.lista();
    this._error = ""; this._errorFotos = "";
    if (!que) { this._error = "Escribe qué necesitas."; return App.pintar(); }
    if (!(monto > 0)) { this._error = "Escribe cuánto es el total con impuestos."; return App.pintar(); }
    if (!fotos.length) { this._errorFotos = "Añade al menos una captura del carrito o del pago."; App.pintar(); const l = document.getElementById("p-fotos-label"); if (l) l.scrollIntoView({ block: "center" }); return; }
    this._enviando = true;
    const btn = document.getElementById("p-enviar");
    if (btn) { btn.disabled = true; btn.textContent = "Enviando…"; }
    const parar = (texto) => {
      this._enviando = false; this._error = texto;
      App.pintar();
    };
    // 1) Subir las fotos una a una. Si una falla, no se crea el pedido.
    // (Una foto ya subida en un intento anterior no se vuelve a subir.)
    const uid = App.sesion && App.sesion.user ? App.sesion.user.id : null;
    if (!uid) return parar("Tu sesión se cerró. Entra otra vez.");
    for (let i = 0; i < fotos.length; i++) {
      if (fotos[i].ruta) continue;
      const ruta = uid + "/" + this._uuid() + ".jpg";
      let res;
      try { res = await db.storage.from("facturas").upload(ruta, fotos[i].blob, { contentType: "image/jpeg" }); }
      catch (err) { res = { error: err }; }
      if (res.error || !res.data) {
        return parar("No se pudo subir la foto " + (i + 1) + " de " + fotos.length + ". No se envió el pedido. " +
          (navigator.onLine ? "Inténtalo otra vez." : "Sin conexión: inténtalo cuando vuelva internet."));
      }
      fotos[i].ruta = res.data.path || ruta;
    }
    // 2) Crear el pedido con las rutas. NO se envían creado_por ni estado: los pone la base.
    const fila = {
      que, para: b["p-para"] || "ninos", categoria: b["p-cat"] || "hijos",
      monto_estimado: monto, para_cuando: b["p-fecha"] || null,
      urgencia: b["p-urg"] || "espera", pago: b["p-pago"] || "dueno_paga",
      nota: (b["p-nota"] || "").trim() || null,
      fotos: fotos.map((x) => x.ruta)
    };
    let res;
    try { res = await db.from("pedidos").insert(fila).select(COLS_PEDIDO).single(); }
    catch (err) { res = { error: err }; }
    if (res.error) {
      return parar("Las fotos se subieron, pero no se pudo crear el pedido. " +
        (navigator.onLine ? "Inténtalo otra vez." : "Sin conexión: inténtalo cuando vuelva internet."));
    }
    this._enviando = false;
    Fotos.soltarTodas();
    limpiarBorradores("p-");
    aviso("Pedido enviado");
    AppPedidos.tab = "inicio";
    await Datos.cargar(["pedidos"]);
    App.pintar();
  }
};
