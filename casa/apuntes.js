/*
 * casa/apuntes.js — Notas compartidas (ambos roles). Se pueden fijar arriba y quitar
 * (borrado lógico: borrado = true).
 */
const Apuntes = {
  vista() {
    const lista = Datos.apuntes.slice().sort((a, b) => Number(!!b.fijado) - Number(!!a.fijado)); // fijados primero, luego los más nuevos
    return h("div", { class: "pila" },
      h("form", { class: "fila-form", onsubmit: (e) => this.añadir(e) },
        campoTexto("a-texto", "Nuevo apunte", { placeholder: "Nuevo apunte", oculta: true, maxlength: 500, clase: "crece" }),
        h("button", { type: "submit", class: "btn btn-primario" }, "Añadir")),
      lista.length ? null : h("p", { class: "texto-suave" }, "Todavía no hay apuntes."),
      lista.map((a) => h("div", { class: "tarjeta" + (a.fijado ? " fijada" : "") },
        a.fijado ? h("span", { class: "etiqueta-mini" }, "Fijado arriba") : null,
        h("span", { class: "texto-apunte" }, a.texto),
        h("span", { class: "meta" }, Datos.nombreDe(a.autor) + " · " + fechaCorta(String(a.creado).slice(0, 10))),
        h("div", { class: "botones" },
          h("button", { type: "button", class: "btn btn-sec", onclick: (e) => this.cambiar(e.currentTarget, a.id, { fijado: !a.fijado }) }, a.fijado ? "Soltar" : "Fijar arriba"),
          h("button", { type: "button", class: "btn btn-sec", onclick: (e) => this.cambiar(e.currentTarget, a.id, { borrado: true }) }, "Quitar")))));
  },

  async añadir(e) {
    e.preventDefault();
    const t = (borradores["a-texto"] || "").trim();
    if (!t) return;
    const { error } = await db.from("apuntes").insert({ texto: t }).select("id,autor,texto,fijado,creado").single();
    if (error) return App.falloRed("No se pudo guardar el apunte.");
    limpiarBorradores("a-texto");
    await Datos.cargar(["apuntes"]);
    App.pintar();
    const i = document.getElementById("a-texto"); if (i) i.focus();
  },

  async cambiar(btn, id, cambios) {
    btn.disabled = true;
    const { error } = await db.from("apuntes").update(cambios).eq("id", id).select("id").single();
    if (error) { btn.disabled = false; return App.falloRed("No se pudo guardar el cambio."); }
    await Datos.cargar(["apuntes"]);
    App.pintar();
  }
};
