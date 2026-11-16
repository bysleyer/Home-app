/*
 * casa/lista.js — Lista de compras compartida (ambos roles): casilla "comprado" y "Quitar".
 */
const Lista = {
  vista() {
    return h("div", { class: "pila" },
      h("form", { class: "fila-form", onsubmit: (e) => this.añadir(e) },
        campoTexto("l-texto", "Añadir a la lista", { placeholder: "Leche, pan…", oculta: true, maxlength: 200, clase: "crece" }),
        h("button", { type: "submit", class: "btn btn-primario" }, "Añadir")),
      Datos.lista.length ? null : h("p", { class: "texto-suave" }, "La lista está vacía."),
      h("ul", { class: "lista" }, Datos.lista.map((i) => h("li", { class: "item" },
        h("label", { class: "item-marca" },
          h("input", { type: "checkbox", checked: !!i.comprado, onchange: (e) => this.cambiar(e.currentTarget, i.id, { comprado: e.currentTarget.checked }) }),
          h("span", { class: i.comprado ? "tachado" : "" }, i.texto)),
        h("button", { type: "button", class: "btn btn-texto", "aria-label": "Quitar " + i.texto, onclick: (e) => this.cambiar(e.currentTarget, i.id, { borrado: true }) }, "Quitar")))));
  },

  async añadir(e) {
    e.preventDefault();
    const t = (borradores["l-texto"] || "").trim();
    if (!t) return;
    const { error } = await db.from("lista_compras").insert({ texto: t }).select("id,autor,texto,comprado,creado").single();
    if (error) return App.falloRed("No se pudo añadir.");
    limpiarBorradores("l-texto");
    await Datos.cargar(["lista"]);
    App.pintar();
    const i = document.getElementById("l-texto"); if (i) i.focus();
  },

  async cambiar(el, id, cambios) {
    el.disabled = true;
    const { error } = await db.from("lista_compras").update(cambios).eq("id", id).select("id").single();
    if (error) { el.disabled = false; App.pintar(); return App.falloRed("No se pudo guardar el cambio."); }
    await Datos.cargar(["lista"]);
    App.pintar();
  }
};
