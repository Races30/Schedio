

# Piano: Completamento Modulo Coach

## Stato attuale

Il progetto ha gia una base coach funzionante:
- Registrazione dual-mode (salone/coach) in `Register.tsx`
- Navigazione condizionale in `AppLayout.tsx` (Sessioni, Pacchetti)
- Dashboard con stats coach (sessioni oggi, pacchetti attivi, alert scadenze)
- `PackagesPage.tsx` con CRUD pacchetti
- `ClientsPage.tsx` basico (senza campi coach)
- `CalendarPage.tsx` con condizionale `isSalone`/`isCoach`
- `PublicBooking.tsx` con flusso coach (senza selezione dipendente)
- `SettingsPage.tsx` solo per salone (nessun campo coach)
- DB: tabelle `clients` (con `objective`, `level`, `frequency`), `packages`, `progress_entries` (con misure), `services` (con `description`)

## Cosa manca

1. **SettingsPage coach** — mostra solo campi salone, manca: descrizione, specializzazione, foto, e nascondere "ruolo titolare nel salone"
2. **ClientsPage coach** — manca: campi obiettivo/livello/frequenza nel form, sezione progressi, storico pacchetti, sedute rimanenti
3. **Progressi** — nessuna UI per creare/visualizzare `progress_entries` (grafici peso, misure, timeline)
4. **Dashboard coach** — manca: clienti inattivi, clienti da ricontattare, riepilogo sedute rimanenti totali
5. **Navigazione coach** — manca link "Progressi" nella sidebar (opzionale, potrebbe stare dentro Clienti)
6. **PublicBooking coach** — flusso base c'e, ma mancano sezioni professionali (bio, specializzazione, foto)

## Piano di implementazione

### 1. Migrazione DB
Nessuna nuova tabella necessaria. Tutto esiste gia. Solo verificare che `activities.description` sia usato per bio/specializzazione del coach.

### 2. SettingsPage — Condizionale coach
- Se `isCoach`: titolo "Impostazioni Coach", campi: nome attivita, nome coach, descrizione/bio, specializzazione (select), foto profilo (upload a `activity-assets` bucket), zona/citta
- Nascondere sezione "Ruolo titolare nel salone" e "Gestione salone" (servizi/dipendenti links)
- Mostrare: orari, giorni, durata media sessione, buffer, colore tema, link pubblico
- Salvare `description` su `activities`

### 3. ClientsPage — Estensione coach
- Se `isCoach`: form cliente aggiunge campi `objective` (select), `level` (select), `frequency` (input)
- `ClientDetailDialog` per coach mostra: obiettivo, livello, pacchetto attivo con sedute rimanenti, tab progressi
- Sezione progressi dentro il dettaglio cliente: lista entries con grafichetto peso, form per aggiungere nuova misurazione (peso, misure, note, foto)
- Query `packages` per il cliente e mostrare badge sedute

### 4. Dashboard coach — Miglioramenti
- Aggiungere query per clienti "inattivi" (nessun appuntamento negli ultimi 14 giorni)
- Card "Clienti da ricontattare" con lista
- Contatore totale sedute rimanenti su tutti i pacchetti attivi
- Alert pacchetti in scadenza (gia presente, migliorare con nome cliente)

### 5. PublicBooking coach — Sezioni profilo
- Hero con foto coach (da `logo_url` o `activity-assets`), nome, `description`, badge specializzazione
- Sezione "Chi sono" con bio completa
- Sessioni come card (gia presente)
- Flusso invariato: sessione -> data -> orario -> dati + obiettivo -> conferma

### 6. Navigazione
- Aggiungere icona TrendingUp "Progressi" nella sidebar coach (link a `/clients` con parametro, oppure pagina dedicata)
- Meglio: integrare progressi dentro ClientDetailDialog, senza nuova pagina

## File modificati

| File | Modifica |
|------|----------|
| `SettingsPage.tsx` | Aggiungere condizionale coach: bio, specializzazione, foto, nascondere sezioni salone |
| `ClientsPage.tsx` | Form coach con obiettivo/livello/frequenza, dettaglio con progressi e pacchetti |
| `Dashboard.tsx` | Clienti inattivi, sedute totali rimanenti, alert con nome cliente |
| `PublicBooking.tsx` | Hero coach con foto/bio/specializzazione |
| `AppLayout.tsx` | Nessuna modifica (navigazione gia corretta) |

## Note tecniche
- Upload foto coach: usare bucket `activity-assets` gia esistente (pubblico)
- Progressi: query `progress_entries` nel `ClientDetailDialog`, grafico semplice con div/bar chart inline (no libreria extra)
- Specializzazioni: array statico nel codice (`dimagrimento`, `massa`, `tonificazione`, `postura`, `performance`, `funzionale`, `online`, `recupero`)
- Non creare nuove tabelle DB, non toccare il modulo salone

