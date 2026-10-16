# 🚀 SyncForge — Quality of Life (QoL) Improvements & Roadmap

Questo documento raccoglie le proposte di miglioramento della Quality of Life (QoL) per **SyncForge**, pensate per ottimizzare il flusso di lavoro, velocizzare le operazioni ripetitive e migliorare l'esperienza utente complessiva.

---

## 📋 Indice delle Aree

1. [📂 Selezione Percorsi & Gestione File (Input UX)](#1--selezione-percorsi--gestione-file-input-ux)
2. [🔀 Matcher Batch & Serie TV](#2--matcher-batch--serie-tv)
3. [🎛️ Gestione Tracce & Stream Manager](#3-️-gestione-tracce--stream-manager)
4. [⏱️ Monitoraggio, Progresso & Notifiche](#4-️-monitoraggio-progresso--notifiche)
5. [💾 Persistenza & Preferenze Utente](#5--persistenza--preferenze-utente)
6. [💻 Terminale & Diagnostica](#6--terminale--diagnostica)

---

## 1. 📂 Selezione Percorsi & Gestione File (Input UX)

### - [x] 1.1 Supporto Drag & Drop Nativo
- **Descrizione**: Permettere di trascinare file o cartelle direttamente dalla finestra del sistema operativo (Finder / Explorer) all'interno dell'interfaccia.
- **Dettagli implementativi**:
  - Drag & drop mirato su ciascun componente `PathInput`.
  - Drop globale sull'intera finestra con auto-rilevamento dell'estensione:
    - File `.mkv` / video ➔ Assegnati automaticamente al campo Target Video.
    - File `.srt` / `.ass` / sottotitoli ➔ Assegnati automaticamente al campo Subtitles.
    - Cartelle ➔ Assegnate al campo appropriato in base al focus o al modulo attivo.
  - Può sfruttare gli eventi drag & drop di Tauri v2 (`onDragDropEvent` di `@tauri-apps/api/webviewWindow`) o HTML5 Drag & Drop.
- **File coinvolti**:
  - `web/src/components/PathInput.jsx`
  - `web/src/App.jsx`

### - [x] 1.2 Pulsante "Svuota campo" (Clear "X")
- **Descrizione**: Aggiungere un'icona rapida di cancellazione (adornment con pulsante "X") nei campi di testo di percorso quando contengono testo.
- **Dettagli implementativi**:
  - Inserire un `endAdornment` con `IconButton` (`ClearIcon`) dentro il `TextField` di `PathInput`.
  - Al clic, azzera istantaneamente il valore senza dover selezionare e cancellare a mano percorsi molto lunghi.
- **File coinvolti**:
  - `web/src/components/PathInput.jsx`

### - [x] 1.3 Pulsante "Apri nel Finder / Explorer"
- **Descrizione**: Permettere di aprire rapidamente la cartella di output o la cartella del file corrente nel file manager di sistema con un solo clic.
- **Dettagli implementativi**:
  - Aggiungere un comando Tauri per aprire percorsi nativi (usando `opener` o `open::that` in Rust).
  - Mostrare un pulsante/icona accanto al campo di destinazione e nel dialog di completamento task ("Mostra nella cartella").
- **File coinvolti**:
  - `src-tauri/src/lib.rs` (nuovo comando `show_in_folder`)
  - `web/src/bridge.js`
  - `web/src/components/PathInput.jsx`
  - `web/src/App.jsx`

### - [x] 1.4 Memorizzazione ultima cartella nei dialog nativi (`rfd`)
- **Descrizione**: Quando l'utente preme i pulsanti "File" o "Folder", il selettore di file nativo dovrebbe aprirsi nella cartella del percorso già inserito (o nell'ultima cartella utilizzata), invece che ripartire dalla cartella di default di sistema.
- **Dettagli implementativi**:
  - In `lib.rs` / `backend.rs`, passare un parametro opzionale `default_path` a `rfd::FileDialog::new().set_directory(...)`.
- **File coinvolti**:
  - `src-tauri/src/lib.rs`
  - `src-tauri/src/ui/backend.rs`
  - `web/src/bridge.js`

---

## 2. 🔀 Matcher Batch & Serie TV

### - [x] 2.1 Auto-Pairing intelligente basato su numero episodio/stagione
- **Descrizione**: Nel batch processing di intere stagioni (es. 12-26 episodi), i nomi dei file video e dei sottotitoli spesso provengono da release diverse e non si ordinano correttamente per ordine alfabetico puro.
- **Dettagli implementativi**:
  - Aggiungere un pulsante "Auto-Match Episodi" in `MatcherDialog`.
  - Estrarre il numero di stagione ed episodio da ciascun target e sorgente tramite pattern regex robusti (es. `S(\d+)E(\d+)`, `EP?\.?\s*(\d+)`, `_(\d{2,3})_`, `(\d{1,2})`).
  - Riordinare automaticamente la colonna delle sorgenti allineando gli indici numerici corrispondenti.
- **File coinvolti**:
  - `web/src/components/MatcherDialog.jsx`

### - [x] 2.2 Azioni rapide di ordinamento ed esclusione file nel Matcher
- **Descrizione**: Strumenti per manipolare rapidamente la lista di accoppiamento nel `MatcherDialog`.
- **Dettagli implementativi**:
  - Pulsante **"Inverti ordine sorgenti"**: utilissimo se i file sono numerati in ordine decrescente o invertiti.
  - Pulsante **"Reset ordine"**: ripristina la sequenza originale pre-trascinamento.
  - Possibilità di **escludere/saltare un file specifico**: evitare di dover annullare l'intero batch se manca la corrispondenza per un solo episodio.
- **File coinvolti**:
  - `web/src/components/MatcherDialog.jsx`

---

## 3. 🎛️ Gestione Tracce & Stream Manager

### - [x] 3.1 Barra di ricerca/filtro rapido per le tracce (`InputDialog`)
- **Descrizione**: Nei file MKV ricchi di stream (remux Blu-ray con 8+ tracce audio e 15+ sottotitoli in diverse lingue), scorrere l'elenco per trovare la traccia desiderata può essere dispersivo.
- **Dettagli implementativi**:
  - Aggiungere un campo compatto di ricerca testuale in cima a `InputDialog`.
  - Filtrare la lista in tempo reale per codice lingua (`ita`, `eng`, `jpn`), nome della traccia, codec (`AAC`, `FLAC`, `TrueHD`) o numero canali.
- **File coinvolti**:
  - `web/src/components/InputDialog.jsx`

### - [x] 3.2 Preset rapidi di selezione lingua basati sulla lingua di sistema
- **Descrizione**: Pulsanti / chip rapidi per selezionare o deselezionare blocchi di tracce in base alle preferenze linguistiche.
- **Dettagli implementativi**:
  - **Rilevamento dinamico della lingua di sistema**: usare `navigator.language` / `Intl.Locale` nel frontend (o locale dal backend) per identificare la lingua dell'utente (es. `it-IT` ➔ `ita` / `it`).
  - Creare chip dinamici:
    - `"Seleziona solo [Lingua Sistema, es. Italiano]"`: seleziona tutte le tracce corrispondenti alla lingua del computer dell'utente.
    - `"Seleziona solo lingua originale (JPN / ENG)"`.
    - `"Deseleziona tracce commento / non udenti (SDH)"`.
- **File coinvolti**:
  - `web/src/components/InputDialog.jsx`

---

## 4. ⏱️ Monitoraggio, Progresso & Notifiche

### - [x] 4.1 Stima del tempo rimanente (ETA) e velocità di elaborazione
- **Descrizione**: Durante lunghe operazioni batch (es. conversione audio in Opus o analisi FFT su video 4K), mostrare una stima del tempo mancante.
- **Dettagli implementativi**:
  - Registrare il timestamp di avvio e il tempo medio impiegato per file completato.
  - Mostrare vicino alla barra di progresso complessivo un'etichetta dinamica con il tempo trascorso e l'ETA (es. `Tempo trascorso: 01:45 • ETA: ~03:10`).
- **File coinvolti**:
  - `web/src/App.jsx`

### - [x] 4.2 Avanzamento nativo nella barra delle applicazioni / Dock
- **Descrizione**: Riflettere lo stato di avanzamento delle operazioni direttamente sull'icona dell'applicazione nel Dock (macOS) o nella barra delle applicazioni (Windows).
- **Dettagli implementativi**:
  - Utilizzare l'API nativa della finestra Tauri (`window.set_progress_bar({ state, progress })`).
  - Quando un task è in esecuzione, aggiornare il badge/indicatore visivo di progresso del sistema operativo.
- **File coinvolti**:
  - `src-tauri/src/lib.rs` (o via `@tauri-apps/api/window` nel frontend)
  - `web/src/App.jsx`

### - [x] 4.3 Suono di notifica discreto (opzionale)
- **Descrizione**: Emettere un suono leggero e piacevole (un "chime") al completamento di un task con successo o un tono di avviso in caso di errore.
- **Dettagli implementativi**:
  - Aggiungere un'opzione nelle impostazioni ("Play sound on completion", abilitata di default).
  - Utilizzare la Web Audio API (o un sintetizzatore audio sintetico a onda sinusoidale per non dipendere da file audio esterni pesanti).
- **File coinvolti**:
  - `web/src/components/SettingsPanel.jsx`
  - `web/src/App.jsx`

---

## 5. 💾 Persistenza & Preferenze Utente

### - [x] 5.1 Salvataggio persistente delle impostazioni (`localStorage`)
- **Descrizione**: Attualmente, alla chiusura e riapertura dell'applicazione, tutte le opzioni (`auto_audio`, `auto_subs`, `enable_max_offset`, `max_offset`, `notify_on_finish`) tornano ai valori di default predefiniti.
- **Dettagli implementativi**:
  - Sincronizzare lo stato di `settings` con `localStorage` (o file di configurazione Tauri) all'aggiornamento.
  - Caricare le preferenze all'avvio in `useState(() => loadSavedSettings())`.
- **File coinvolti**:
  - `web/src/App.jsx`
  - `web/src/components/SettingsPanel.jsx`

### - [x] 5.2 Memorizzazione dell'ultimo modulo utilizzato
- **Descrizione**: Riaprire l'applicazione direttamente sull'ultimo modulo utilizzato (es. *WaveSync Injection* o *Custom Track Merge*) anziché doverlo selezionare ogni volta nella sidebar.
- **Dettagli implementativi**:
  - Salvare l'ID dell'ultimo modulo in `localStorage` e usarlo come stato iniziale di `selectedMod`.
- **File coinvolti**:
  - `web/src/App.jsx`

---

## 6. 💻 Terminale & Diagnostica

### - [x] 6.1 Pulsante "Copia Log negli appunti" (Copy to Clipboard)
- **Descrizione**: Spesso l'utente ha solo bisogno di copiare un errore o una parte del log per cercarla o incollarla, senza dover scaricare un file `.txt` sul disco.
- **Dettagli implementativi**:
  - Aggiungere un pulsante "Copy Logs" accanto a "Download Logs".
  - Utilizzare `navigator.clipboard.writeText(terminal)` con feedback visivo temporaneo (es. tooltip o cambio etichetta in "Copied!").
- **File coinvolti**:
  - `web/src/App.jsx`

### - [x] 6.2 Filtro rapido per errori e avvisi nel Terminale
- **Descrizione**: Con task complessi o file video con decine di stream, i log di FFmpeg e MKVToolNix possono diventare molto lunghi e rendere difficile individuare il motivo di un fallimento.
- **Dettagli implementativi**:
  - Aggiungere chip/filtri rapidi nella testata del terminale: `[Tutti]`, `[Solo Errori]`, `[Warning]`.
  - Evidenziare con colori ad alto contrasto le righe di errore o mostrare una vista filtrata.
- **File coinvolti**:
  - `web/src/components/Terminal.jsx`
  - `web/src/App.jsx`
