/*
 * datos.js — Lee de Supabase lo que las pantallas necesitan y lo guarda en `Datos`.
 * Siempre se pide la lista de columnas (nunca select("*")).
 * `ajustes` (color manual), `evaluaciones` y `miDinero` (lo que escribe el puente de Mi dinero)
 * solo se piden al dueño: ella no puede leerlos.
 */
const COLS_PEDIDO = "id,creado_por,que,para,categoria,monto_estimado,para_cuando,urgencia,pago,nota,estado,fecha_aprobada,monto_aprobado,fecha_sugerida,nota_dueno,fotos,creado,modificado";
const COLS_EVALUACION = "pedido_id,se_puede,fecha_posible,motivo,rompe_regla,datos_actualizado,calculado";
const COLS_MI_DINERO = "id,semaforo,mejor_fecha,motivo,datos_actualizado,calculado";

const Datos = {
  pedidos: [], resumen: null, ajustes: null, evaluaciones: {}, miDinero: null, nombres: {},
  error: false,

  async cargar(que) {
    const tareas = {
      pedidos: async () => {
        const { data, error } = await db.from("pedidos").select(COLS_PEDIDO).order("creado", { ascending: false });
        if (error) throw error;
        this.pedidos = data || [];
      },
      resumen: async () => {
        const { data, error } = await db.from("resumen")
          .select("id,semaforo,frase,mejor_fecha,total_mes_ella,mes,publicado").maybeSingle();
        if (error) throw error;
        this.resumen = data || null;
      },
      ajustes: async () => {
        const { data, error } = await db.from("ajustes_dueno")
          .select("id,semaforo_manual,manual_hasta").maybeSingle();
        if (error) throw error;
        this.ajustes = data || null;
      },
      evaluaciones: async () => {
        const { data, error } = await db.from("evaluaciones").select(COLS_EVALUACION);
        if (error) throw error;
        const m = {};
        (data || []).forEach((e) => { m[e.pedido_id] = e; });
        this.evaluaciones = m;
      },
      miDinero: async () => {
        const { data, error } = await db.from("mi_dinero_estado").select(COLS_MI_DINERO).maybeSingle();
        if (error) throw error;
        this.miDinero = data || null;
      },
      nombres: async () => {
        const { data, error } = await db.from("perfiles").select("id,nombre,rol");
        if (error) throw error;
        const m = {};
        (data || []).forEach((p) => { m[p.id] = p.nombre; });
        this.nombres = m;
      }
    };
    let fallo = false;
    await Promise.all(que.map(async (k) => {
      try { await tareas[k](); } catch (e) { fallo = true; }
    }));
    this.error = fallo;
    return !fallo;
  },

  /* Qué cargar al entrar según el rol. */
  claves(rol) { return rol === "dueno" ? ["pedidos", "resumen", "ajustes", "evaluaciones", "miDinero", "nombres"] : ["pedidos", "resumen", "nombres"]; },

  nombreDe(id) { return this.nombres[id] || "Alguien"; }
};
