

# Piano: Slot 15 min, Calendario Avanzato Salone + Modulo Coach Completo

## Panoramica
Due fasi: (1) miglioramento completo del salone con slot da 15 minuti, blocco buffer, inserimento orario manuale, pause/chiusure; (2) modulo Coach completo con clienti, pacchetti, progressi, sessioni e prenotazione pubblica.

---

## FASE 1 — Salone Avanzato

### 1.1 Slot da 15 minuti (calendario + prenotazione)

**File modificati:** `CalendarPage.tsx`, `PublicBooking.tsx`, `EmployeePage.tsx`, `dateHelpers.ts`

- Cambiare `generateTimeSlots` da intervallo 30 a 15 minuti in tutti i calendari
- Adattare altezza slot nel CSS (da 48px a 36px per slot, o simile)
- Calcolo blocco: `slotsOccupati = Math.ceil((durata + buffer) / 15)` — tutti gli slot vengono marcati come occupati
- La funzione `appointmentOverlapsSlot` e `slotContainingStart` devono usare 15 min come base
- Nel `PublicBooking`, generare slot ogni 15 min e filtrare quelli occupati considerando durata+buffer

### 1.2 Inserimento orario manuale

**File modificato:** `CalendarPage.tsx` (AppointmentDialog)

- Aggiungere un `<Input type="time" step="900">` (step 15 min) per l'orario
- Validazione: arrotonda a multipli di 15 minuti
- L'utente può sia cliccare sullo slot nel calendario sia scrivere l'orario manualmente nel dialog

### 1.3 Blocco completo servizio + buffer

**File modificati:** `CalendarPage.tsx`, `PublicBooking.tsx`

- Nella griglia calendario, gli slot occupati dal buffer devono essere visivamente distinti (colore più chiaro / tratteggiato)
- Il blocco totale = durata servizio + buffer_minutes dell'attività
- Nessun appuntamento può sovrapporsi al range `[start, start + durata + buffer)`

### 1.4 Pause, pausa pranzo e chiusure

**Database:** Migrazione per aggiornare `availability_blocks`:
- Aggiungere tipo `'break' | 'lunch' | 'closure'` oltre ai tipi esistenti
- Aggiungere campi `start_datetime`/`end_datetime` (già presenti nel DB) per chiusure su date specifiche
- Aggiungere `employee_id` opzionale (già presente) per pause per-dipendente

**File modificati:** `SettingsPage.tsx`, `CalendarPage.tsx`

- In Impostazioni: nuova sezione per gestire pause ricorrenti (pranzo, chiusure settimanali) e chiusure straordinarie (date specifiche)
- Regola: chiusure > 1 giorno richiedono almeno 3 settimane di anticipo
- Nel calendario: mostrare blocchi di pausa come slot non cliccabili con sfondo distinto
- Verifica conflitti: se ci sono appuntamenti esistenti in un range che si vuole chiudere, avvisare l'utente

### 1.5 Calendario visivo migliorato

**File modificato:** `CalendarPage.tsx`

- Slot 15 min con righe più compatte
- Indicatore ora corrente (linea rossa orizzontale)
- Appuntamenti con altezza proporzionale alla durata (in slot da 15 min)
- Buffer visualizzato con pattern differente sotto l'appuntamento

---

## FASE 2 — Modulo Coach Completo

### 2.1 Database

**Migrazione SQL:**
- Aggiungere colonna `description` a `activities` (per il coach: bio/specializzazione)
- Aggiungere colonne opzionali a `clients`: `objective`, `level`, `frequency`
- La tabella `packages` esiste già con tutti i campi necessari
- La tabella `progress_entries` esiste già — aggiungere colonne misure: `waist`, `hips`, `chest`, `arms`, `thighs` (tutti numeric nullable)

### 2.2 Registrazione dual-mode

**File modificato:** `Register.tsx`

- Aggiungere step 0: scelta categoria (Salone / Coach)
- Se Salone: flusso attuale (nome salone, titolare, orari, host_works_in_salon)
- Se Coach: nome attività, nome trainer, specializzazione, durata media sessione (default 60 min), giorni/orari
- Non creare employee per il coach (non serve multi-dipendente)

### 2.3 Landing Page

**File modificato:** `Landing.tsx`

- Aggiungere sezione che mostra entrambe le modalità (Salone + Coach)
- Features differenziate per tipo
- FAQ aggiornate per entrambi

### 2.4 Dashboard Coach

**File modificato:** `Dashboard.tsx`

- Condizionale `isSalone` / `isCoach` basato su `activity.category`
- Coach: mostra statistiche (sessioni oggi, clienti attivi, pacchetti in scadenza, sedute rimanenti totali)
- Coach: lista prossime sessioni, clienti recenti, pacchetti vicini alla scadenza
- Alert per pacchetti con poche sedute rimanenti

### 2.5 Pagina Clienti Coach

**File modificato:** `ClientsPage.tsx`

- Se Coach: aggiungere campi obiettivo, livello, frequenza nel form cliente
- Mostrare pacchetto attivo del cliente, sedute rimanenti, scadenza
- Tab o sezione progressi con grafico peso nel tempo
- Aggiungere form progressi (peso, misure, foto, note)

### 2.6 Pagina Pacchetti Coach (nuova)

**Nuovo file:** `src/pages/PackagesPage.tsx`

- CRUD pacchetti: nome, sessioni totali, prezzo, data inizio/fine, stato
- Assegnazione a cliente
- Badge "in scadenza" / "esaurito"
- Contatore sedute usate/rimanenti

### 2.7 Calendario Coach

**File modificato:** `CalendarPage.tsx`

- Se Coach: nascondere filtro dipendenti
- Mostrare nome cliente + tipo sessione sugli appuntamenti
- Slot da 15 o 30 min configurabile (il coach usa spesso 60 min)

### 2.8 Pagina Pubblica Coach

**File modificato:** `PublicBooking.tsx`

- Se `activity.category === 'coach'`: layout diverso
- Hero con nome trainer, descrizione, specializzazione
- Sessioni prenotabili (invece di "servizi")
- Nessuna selezione dipendente (il coach è uno solo)
- Flusso: sessione → data → orario → dati cliente (con campo obiettivo opzionale) → conferma
- FAQ specifiche per coach

### 2.9 Routing

**File modificato:** `App.tsx`

- Aggiungere route `/packages` dentro `AppLayout`

### 2.10 AppLayout

**File modificato:** `AppLayout.tsx`

- Condizionale navigazione: Salone mostra "Dipendenti", Coach mostra "Pacchetti"
- Entrambi: Dashboard, Calendario, Clienti, Servizi, Impostazioni

### 2.11 Impostazioni Coach

**File modificato:** `SettingsPage.tsx`

- Se Coach: mostrare campi specifici (specializzazione, descrizione, foto)
- Nascondere sezione "Lavoro nel salone"
- Mantenere orari, durata media, buffer

---

## Riepilogo file

| File | Azione |
|------|--------|
| `dateHelpers.ts` | Aggiornare slot default a 15 min |
| `CalendarPage.tsx` | Slot 15 min, blocco buffer visivo, pause, input manuale orario |
| `PublicBooking.tsx` | Slot 15 min, layout condizionale coach, flusso senza dipendente |
| `EmployeePage.tsx` | Slot 15 min |
| `SettingsPage.tsx` | Sezione pause/chiusure, campi coach |
| `Register.tsx` | Dual-mode salone/coach |
| `Landing.tsx` | Contenuto dual-mode |
| `Dashboard.tsx` | Stats e layout condizionali coach |
| `ClientsPage.tsx` | Campi coach, progressi, pacchetti |
| `PackagesPage.tsx` | **Nuovo** — CRUD pacchetti coach |
| `AppLayout.tsx` | Nav condizionale |
| `App.tsx` | Route `/packages` |
| `types/index.ts` | Tipi aggiornati (misure progress, campi client) |
| **Migrazione DB** | Colonne misure su `progress_entries`, campi client, description su activities |

