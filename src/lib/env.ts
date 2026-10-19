// Settings come from the environment (Portainer on the NAS, .env.local when working locally).
function need(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export const env = {
  get supabaseUrl() { return need("SUPABASE_URL"); },
  get supabaseKey() { return need("SUPABASE_PUBLISHABLE_KEY"); },
  get databaseUrl() { return need("DATABASE_URL"); },
};
