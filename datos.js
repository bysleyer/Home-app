/*
 * datos.js — Lee de Supabase lo que las pantallas necesitan y lo guarda en `Datos`.
 * Siempre se pide la lista de columnas (nunca select("*")). Los borrados lógicos
 * se filtran con .eq("borrado", false).
 */
const COLS_PEDIDO = "id,creado_por,que,para,categoria,monto_estimado,para_cuando,urgencia,pago,nota,estado,fecha_aprobada,monto_aprobado,fecha_sugerida,nota_dueno,fotos,creado";

const Datos = {
  pedidos: [], apuntes: [], lista: [], resumen: null, nombres: {},
  error: false,

  async cargar(que) {
    const tareas = {
      pedidos: async () => {
        const { data, error } = await db.from("pedidos").select(COLS_PEDIDO).order("creado", { ascending: false });
        if (error) throw error;
        this.pedidos = data || [];
      },
      apuntes: async () => {
        const { data, error } = await db.from("apuntes").select("id,autor,texto,fijado,creado")
          .eq("borrado", false).order("creado", { ascending: false });
        if (error) throw error;
        this.apuntes = data || [];
      },
      lista: async () => {
        const { data, error } = await db.from("lista_compras").select("id,autor,texto,comprado,creado")
          .eq("borrado", false).order("creado", { ascending: true });
        if (error) throw error;
        this.lista = data || [];
      },
      resumen: async () => {
        const { data, error } = await db.from("resumen")
          .select("id,semaforo,frase,mejor_fecha,total_mes_ella,mes,publicado").maybeSingle();
        if (error) throw error;
        this.resumen = data || null;
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

  nombreDe(id) { return this.nombres[id] || "Alguien"; }
};
