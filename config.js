/*
 * config.js — Ajustes públicos de Home.
 * La llave de abajo es la llave PÚBLICA (publishable/anon) de Supabase: va en el
 * código a propósito, la seguridad real la ponen las reglas por fila (RLS).
 * La llave service_role NUNCA va en este repo.
 */
const CONFIG = {
  SUPABASE_URL: "https://quxbhpkkyduqncjroyxp.supabase.co",
  SUPABASE_KEY: "sb_publishable_TB8X8XG9fINEi1Uog9rbAA_K7hhNxx4", // llave PÚBLICA, va en el código a propósito
  DOMINIO_USUARIOS: "home.invalid",
  MI_DINERO_URL: "https://bysleyer.github.io/mi-dinero/"
};
