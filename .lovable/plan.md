# Piano: Refactor SaaS - Solo Salone con Gestione Dipendenti

## Panoramica

Migliorare la parte del Saas Salone in una piattaforma dedicata con gestione dipendenti, servizi assegnabili, calendario multi-dipendente e pagine private con token. Lasciando però la parte coach

## Modifiche al Database

### Nuova tabella: `employees`

```sql
CREATE TABLE employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  name text NOT NULL,
  surname text NOT NULL,
  slug text NOT NULL,
  token text NOT NULL UNIQUE,
  role text DEFAULT 'dipendente',
  color text DEFAULT '#3b82f6',
  is_owner boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

### Nuova tabella: `employee_services` (molti-a-molti)

```sql
CREATE TABLE employee_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  UNIQUE(employee_id, service_id)
);
```

### Modifica tabella `appointments`

- Aggiungere colonna `employee_id uuid REFERENCES employees(id)`

### Modifica tabella `activities`

- Aggiungere colonna `buffer_minutes integer DEFAULT 5`
- Rimuovere dipendenza dal campo `category` (sarà sempre 'salone')

### RLS policies

- `employees`: pubblica in lettura, gestione solo owner
- `employee_services`: pubblica in lettura, gestione solo owner
- `appointments`: aggiornare per includere `employee_id`

## Modifiche ai File

### 1. Tipi (`src/types/index.ts`)

- Rimuovere `ActivityCategory`, `Package`, `ProgressEntry`
- Aggiungere interfacce `Employee`, `EmployeeService`
- Aggiungere `employee_id` e `buffer_minutes` ai tipi esistenti

### 2. Registrazione (`Register.tsx`)

- Rimuovere scelta Salone/Coach (sempre salone)
- Semplificare a: nome salone, titolare, email, password, orari, giorni
- Creare automaticamente un dipendente "owner" dopo la registrazione
- Aggiungere campo buffer_minutes

### 3. Landing Page (`Landing.tsx`)

- Rimuovere riferimenti a Coach/Personal Trainer
- Focalizzare su saloni: servizi, dipendenti, calendario, prenotazioni
- Aggiornare pricing solo per saloni
- Aggiornare features e FAQ

### 4. Dashboard (`Dashboard.tsx`)

- Rimuovere logica Coach
- Aggiungere sezione dipendenti con link alle pagine private
- Mostrare statistiche solo salone

### 5. Impostazioni (`SettingsPage.tsx`)

- Rimuovere condizionale `isSalone`
- Aggiungere sezione gestione dipendenti (CRUD)
- Aggiungere assegnazione servizi ai dipendenti
- Aggiungere gestione buffer_minutes
- Mostrare link privati dipendenti con token

### 6. Calendario (`CalendarPage.tsx`)

- Aggiungere filtro per dipendente
- Mostrare colore dipendente sugli appuntamenti
- Includere `employee_id` nella creazione appuntamento
- Gestire buffer automatico tra appuntamenti

### 7. Pagina Pubblica (`PublicBooking.tsx`)

- Riscrivere completamente come landing professionale
- Flusso: servizio -> dipendente (opzionale/auto) -> data -> orario -> dati -> conferma
- Se "nessuna preferenza dipendente": mostra disponibilità globale e assegna automaticamente
- Se dipendente scelto: mostra solo il suo calendario
- Sezioni: header, hero, servizi, selezione dipendente, calendario, form, conferma, footer

### 8. Nuova Pagina: Pagina Dipendente (`EmployeePage.tsx`)

- Accessibile via `/:slug/:employeeSlug--:token`
- Verifica token nel DB
- Mostra solo calendario personale del dipendente
- Mostra solo i suoi appuntamenti
- Nessun dato di altri dipendenti o clienti completi

### 9. Routing (`App.tsx`)

- Cambiare `/book/:slug` in `/:slug` per la pagina pubblica
- Aggiungere `/:slug/:employeeToken` per la pagina dipendente
- Gestire conflitto con route interne (dashboard, calendar, ecc.)

### 10. AppLayout (`AppLayout.tsx`)

- Aggiungere link "Dipendenti" nella navigazione
- Rimuovere riferimenti a Coach

### 11. Context (`AuthContext.tsx`)

- Rimuovere riferimenti a Coach
- Caricare dipendenti dell'attività se necessario

### 12. Pulizia

- Rimuovere codice Coach da tutte le pagine
- Rimuovere tabelle/tipi `packages`, `progress_entries` dall'UI
- Rimuovere colori/stili Coach dal CSS e Tailwind config

## Struttura URL finale

```text
/                          -> Landing page
/login                     -> Login
/register                  -> Registrazione (solo salone)
/dashboard                 -> Dashboard host
/calendar                  -> Calendario host
/clients                   -> Gestione clienti
/settings                  -> Impostazioni + dipendenti
/:slug                     -> Pagina pubblica prenotazione
/:slug/:name--token        -> Pagina privata dipendente
```

## Note tecniche

- Il token dipendente viene generato con `crypto.randomUUID()` o stringa random lunga 20+ caratteri
- La logica di assegnazione automatica dipendente sceglie chi ha meno appuntamenti nel giorno
- Il buffer viene aggiunto automaticamente dopo ogni appuntamento
- Le route pubbliche (`/:slug`) vanno gestite con attenzione per non conflittuare con `/login`, `/register`, ecc.