

# Piano: Pagina pubblica di prenotazione professionale

## Problema attuale
La pagina `PublicBooking.tsx` mostra solo un semplice wizard di prenotazione con header minimale. Manca completamente di: hero section, sezione "chi siamo", card servizi, informazioni pratiche, contatti, badge di fiducia, FAQ e footer.

## Approccio
Riscrivere completamente `PublicBooking.tsx` come una landing page professionale con tutte le sezioni richieste, mantenendo la logica di prenotazione esistente (query Supabase, step wizard, insert). La pagina si adatta automaticamente alla categoria (salone/coach).

## Struttura della nuova pagina

1. **Header fisso** — Logo, nome attività, categoria, pulsante "Prenota ora" che scrolla alla sezione prenotazione
2. **Hero section** — Nome grande, descrizione contestuale (salone vs coach), info rapide (orari, durata, giorni), CTA principale
3. **Sezione "Chi siamo"** — Testo dinamico basato sulla categoria con descrizione del salone o del trainer
4. **Sezione Servizi/Sessioni** — Card grid con nome, durata, prezzo, colore, pulsante "Seleziona" che avvia la prenotazione. Per coach senza servizi: card sessione singola con durata media
5. **Sezione Informazioni utili** — Orari apertura, giorni disponibili, durata media, note pratiche
6. **Sezione Contatti rapidi** — Telefono, email, eventuali link (mostrati solo se disponibili nei dati)
7. **Badge di fiducia** — "Prenotazione semplice", "Conferma immediata", "Gestione professionale"
8. **Sezione Prenotazione** — Il wizard a step esistente (servizio → data → orario → dati → conferma), integrato come sezione della pagina con anchor `#prenota`
9. **FAQ** — Accordion con domande pratiche, contenuto diverso per salone vs coach
10. **Footer** — Nome, categoria, contatti, copyright, branding minimo

## Modifiche tecniche

### File modificati
- **`src/pages/PublicBooking.tsx`** — Riscrittura completa. Stessa logica Supabase e booking, ma UI espansa con tutte le sezioni. Uso di `useRef` + `scrollIntoView` per il pulsante "Prenota ora". Condizionale `isSalone` per testi e layout diversi.

### Nessuna modifica al database
Tutti i dati necessari sono già disponibili nelle tabelle `activities` e `services`.

### Componenti UI utilizzati
Quelli già presenti: `Button`, `Input`, `Label`, `Accordion` (per FAQ), icone Lucide. Nessuna nuova dipendenza.

## Layout responsive
- **Desktop**: sezioni a larghezza contenuta (max-w-4xl), servizi in grid 2-3 colonne, info in grid 2 colonne
- **Mobile**: layout verticale, card full-width, step prenotazione semplificati

