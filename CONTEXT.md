# CONTEXT — Schedio

> Aggiornato: [DATA] — Aggiorna questa riga ogni volta che cambia lo stato

## Progetto

SaaS per personal trainer e barbieri/parrucchieri.
**Dominio:** schedio.it (libero, non ancora acquistato)
**Deploy:** https://schedio-five.vercel.app

## Stack

- **Frontend:** Vite + React 18 + TypeScript
- **UI:** Tailwind CSS + shadcn/ui + lucide-react + Framer Motion
- **Data:** TanStack Query + Supabase (client JS)
- **Grafici:** Recharts
- **Date:** react-day-picker
- **Muscoli:** react-body-highlighter (NON react-muscle-highlighter — incompatibile con Vite/ESM)
- **Email:** Resend via Supabase Edge Functions
- **Deploy:** Vercel

## Struttura cartelle

```
src/
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── trainer/         # componenti dashboard trainer
│   └── client/          # componenti dashboard cliente
├── pages/
│   ├── trainer/         # pagine trainer
│   └── client/          # pagine cliente
├── lib/
│   └── supabase.ts      # client Supabase
├── hooks/               # custom hooks TanStack Query
└── types/               # TypeScript types
supabase/
└── functions/           # Edge Functions (email, ecc.)
```

## Moduli

- **COACH** (Personal Trainer) → attivo, focus principale, tema blu
- **SALONE** (Barbieri/Parrucchieri) → nascosto con `SHOW_SALON=false`, codice intatto, tema invariato

## Stato attuale

- ✅ Registrazione trainer
- ✅ Database esercizi
- ✅ Creazione cliente (genera token invito)
- ❌ Email invito cliente → **BUG PRINCIPALE** — Edge Function Resend da creare/correggere
- ⏸ Sistema prenotazione sessioni → bloccato da bug email
- ⏸ Dashboard cliente → bloccata da bug email
- ⏸ Allenamento autonomo con timer → non testato
- ⏸ Grafico progressi → non testato
- 🔧 Nuovo progetto Supabase collegato → migrations da riapplicare

## Decisioni architetturali (NON cambiare senza chiedere)

- Cliente si registra SOLO tramite link invito del trainer (`/setup-account?token=xxx`)
- Stessa pagina `/login` per trainer e cliente — redirect diverso per ruolo
- Token univoco salvato in `clients.invite_token`
- Pacchetti sedute: nascosti in modalità legacy, accessibili solo via `/settings/packages`
- Sessione confermata: non cancellabile dalla piattaforma
- Slot salone: da 15 minuti con buffer incluso
- Tema trainer: blu primario | Tema cliente: verde smeraldo `#10b981`
- Pagina pubblica coach: ELIMINATA — il trainer crea il cliente, non il contrario
- Nomi ufficiali moduli: "Personal Trainer" e "Barbiere / Parrucchiere" (non Coach/Salone)

## Database — Tabelle principali

```sql
activities       -- attività del trainer (coach o salone)
clients          -- clienti con invite_token, invite_accepted
exercises        -- esercizi con measure_type e muscles jsonb
sessions         -- prenotazioni con status e proposed_times
session_exercises -- esercizi per sessione con planned/actual value
session_feedback -- feedback cliente dopo sessione
workout_plans    -- schede allenamento con esercizi jsonb
workout_completions -- completamento schede
exercise_progress   -- storico progressi per grafico
employees        -- dipendenti salone
employee_services   -- servizi per dipendente
```

## Variabili ambiente richieste

```
VITE_SUPABASE_PROJECT_ID="ebfxifestsvxntrxglky"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_pdmI-jjyRRewnOFFN-tdlA_5owI-T5K"
VITE_SUPABASE_URL="https://ebfxifestsvxntrxglky.supabase.co"

```

## Prossimo passo

1. Riapplicare migrations SQL sul nuovo progetto Supabase
2. Aggiornare `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
3. Fixare Edge Function `send-client-invite` con Resend
4. Verificare pagina `/setup-account?token=xxx`
5. Test end-to-end: creazione cliente → invito → setup account → dashboard cliente

## Feature pianificate (non ancora implementate)

- Notifiche retention (pacchetti in scadenza, clienti inattivi)
- Calendario multi-mese
- Download .ics dopo prenotazione
- Marketplace trainer per vicinanza (dopo 20-30 trainer)

## Note extra

- Primo utente reale: Claudio, personal trainer, gestisce tutto con agenda fisica
- Il progetto era su Lovable, ora sviluppo locale (Antigravity/Cursor/VS Code)
