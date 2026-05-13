# KNOWN ISSUES — Schedio

> Ogni volta che risolvi un bug, aggiungilo qui prima di chiudere la sessione.
> Formato: data, problema, causa, fix, file modificati.

---

## Bug risolti

### SQL — "policy already exists"

**Causa:** Tentativo di CREATE POLICY su una policy già esistente  
**Fix:** Aggiungere `DROP POLICY IF EXISTS [nome] ON [tabella];` prima di ogni `CREATE POLICY`  
**Contesto:** Succede quando si riapplicano le migrations su un DB già parzialmente configurato

---

### SQL — "syntax error at NOT" su ADD CONSTRAINT IF NOT EXISTS

**Causa:** `ADD CONSTRAINT IF NOT EXISTS` non è supportato in PostgreSQL/Supabase  
**Fix:** Sostituire con `CREATE UNIQUE INDEX IF NOT EXISTS [nome] ON [tabella]([colonna]);`

---

### SQL — "column is_active does not exist"

**Causa:** Migration che presuppone colonne già esistenti  
**Fix:** Usare `ALTER TABLE [tabella] ADD COLUMN IF NOT EXISTS [colonna] [tipo];` per ogni colonna nuova

---

### react-muscle-highlighter incompatibile con Vite/ESM

**Causa:** Il package non supporta ESM modules correttamente con Vite  
**Fix:** Sostituito con `react-body-highlighter` — stessa API, compatibile con Vite  
**⚠️ NON tornare mai a react-muscle-highlighter**

---

## Bug aperti (da risolvere)

### Email invito cliente non arriva

**Sintomo:** Il trainer crea il cliente, il token viene generato, ma l'email non arriva  
**Componenti coinvolti:**

- Edge Function `send-client-invite` (Supabase Functions)
- Resend API key (verificare che sia configurata nelle secrets Supabase)
- Pagina `/setup-account?token=xxx`
  **Da verificare:**

1. La Edge Function esiste e fa deploy correttamente?
2. La variabile `RESEND_API_KEY` è nelle Supabase secrets?
3. Il dominio mittente è verificato su Resend?
4. Il token viene salvato correttamente in `clients.invite_token`?

---

### Modulo salone ancora visibile nonostante SHOW_SALON=false

**Sintomo:** Alcune parti dell'UI del modulo salone appaiono anche quando il flag è false  
**Da trovare:** Componenti che non controllano `SHOW_SALON` prima di renderizzare

---

### Migrations da riapplicare sul nuovo progetto Supabase

**Contesto:** L'utente ha cambiato progetto Supabase — tutte le tabelle devono essere ricreate  
**Ordine corretto:**

1. activities
2. employees, employee_services
3. clients
4. exercises
5. sessions, session_exercises, session_feedback
6. workout_plans, workout_completions
7. exercise_progress
8. RLS policies (applicare sempre con DROP IF EXISTS prima)
