# Piano Esecutivo di Miglioramento UI, Accessibilità, Temi & Player mpv: SyncForge

Questo piano operativo traduce tutti i risultati dell'**Audit Tecnico**, della **Design Critique** e la nuova architettura di anteprima con **mpv** in una sequenza esatta di comandi della suite **Impeccable**. È strutturato per eseguire l'intero ciclo di trasformazione in modo coerente, preservando ed elevando al contempo tutti i Quality of Life (QoL) del software.

---

## 🛠️ Sequenza dei Comandi Impeccable

L'esecuzione è suddivisa nelle seguenti fasi modulari basate sui comandi specializzati di Impeccable:

```
┌────────────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐
│ 1. /impeccable layout  │ ───> │ 2. /impeccable clarify  │ ───> │ 3. /impeccable optimize │
│ Workstation dinamica   │      │ Trasparenza sub-task    │      │ Streaming log & memo    │
└────────────────────────┘      └─────────────────────────┘      └─────────────────────────┘
            │
            ▼
┌────────────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐
│ 4. /impeccable polish  │ ───> │ 5. Dual-Theme Anti-Slop │ ───> │ 6. Anteprima Sync mpv   │
│ A11y, validazione, UI  │      │ Chiaro / Scuro / System │      │ Player CLI & dialog     │
└────────────────────────┘      └─────────────────────────┘      └─────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────┐
│ 7. /impeccable audit & /impeccable critique (Verifica)   │
│ Certificazione punteggi e zero regressioni               │
└──────────────────────────────────────────────────────────┘
```

---

## Fase 1: `/impeccable layout` — Workstation Affiancata (Side-by-Side)

> **Obiettivo**: Riorganizzare la griglia del workspace principale (`web/src/App.jsx`), trasformando la colonna destra da card statica a pannello dinamico per schermi desktop.

### Problema Attuale Risolto:
- La colonna destra (`minmax(300px, 1fr)`) ospita un card statico "Active Profile & Quick Shortcuts" che consuma il 35% dello spazio con chip e promemoria scorciatoie già noti all'utente.
- Il terminale è confinato in un cassetto inferiore che, una volta aperto, compete per lo scorrimento verticale con i campi di input.

### Interventi Specifici:
1. **Docking Terminale a Lato (Side-by-Side Workstation)**:
   - Su schermi larghi (`lg` o superiori), consentire l'aggancio del terminale direttamente nella colonna destra, affiancato ai campi dei percorsi (stile console di regia / studio audio).
2. **Pannello Stream & Telemetria Alternativo**:
   - Quando il terminale è nascosto o ridotto a cassetto, la colonna destra visualizza un vero **Inspector di Flusso Attivo**: canali audio rilevati (lingue, canali 5.1/stereo, codec), tracce sottotitoli con flag `Default`/`Forced` e diagnostica di matching.
3. **Ottimizzazione Fluidità Breakpoint**:
   - Regolazione delle proporzioni della griglia per prevenire la compressione orizzontale quando la sidebar è allargata oltre i 320px su risoluzioni 1080p.

---

## Fase 2: `/impeccable clarify` — Trasparenza Operazioni CLI & Feedback Sub-Task

> **Obiettivo**: Eliminare il "silenzio radio" e l'ansia durante i passaggi a percentuale indeterminata in `web/src/App.jsx`.

### Problema Attuale Risolto:
- Nelle operazioni pesanti come *WaveSync Injection*, durante i primi 15-30 secondi FFmpeg estrae i segmenti PCM per la correlazione FFT. Il progress bar resta a 0% / indeterminato con solo l'etichetta generica "Processing...", facendo temere all'utente che l'app sia bloccata o stia ricodificando il video.

### Interventi Specifici:
1. **Rilevamento e Parsing Sub-Task**:
   - Aggiungere uno stato reattivo `currentSubTask` che intercetta i messaggi salienti di stdout (es. `[ffmpeg] Extracting audio waveform`, `[rustfft] Calculating waveform delay`, `[ffsubsync] Synchronizing subtitles`).
2. **Indicatore di Attività Inline**:
   - Mostrare sotto la barra di avanzamento del file corrente un indicatore compatto con spinner discreto e dicitura esplicita dell'operazione in corso.
3. **Call-to-Action Contestuale**:
   - Inserire un link rapido *"View live console"* sul card di avanzamento per aprire istantaneamente il terminale live senza doverlo cercare nel footer.

---

## Fase 3: `/impeccable optimize` — Prestazioni & Streaming Log Reattivo

> **Obiettivo**: Eliminare il sovraccarico di re-render dell'albero React durante lo streaming ad alta frequenza dei processi CLI.

### Problema Attuale Risolto:
- La funzione `append_terminal` esegue `setTerminal((prev) => ...)` ad ogni singola riga di log ricevuta dal backend. Questo causa il re-render continuo dell'intero file `App.jsx` (2.055 righe) e di tutti i suoi componenti figli.
- La chiamata `setProgress` si trova annidata dentro il callback di `setTerminal` (riga 577), generando un side-effect asincrono vietato dai pattern di concorrenza di React.

### Interventi Specifici:
1. **Buffer e Batching dei Log**:
   - Implementare un buffer per lo streaming dei log in un `useRef`, con flush cadenzato tramite `requestAnimationFrame` o throttle a 100ms.
2. **Disaccoppiamento della Percentuale**:
   - Spostare il parsing della percentuale di avanzamento (`Progress: XX%`) al di fuori della funzione di aggiornamento dello stato di `setTerminal`.
3. **Memoizzazione Componenti Chiave**:
   - Applicare `React.memo` su [`Terminal.jsx`](file:///Users/mbenassi/Developer/projects/SyncForge/web/src/components/Terminal.jsx), [`Sidebar.jsx`](file:///Users/mbenassi/Developer/projects/SyncForge/web/src/components/Sidebar.jsx) e [`PathInput.jsx`](file:///Users/mbenassi/Developer/projects/SyncForge/web/src/components/PathInput.jsx) per schermarli dai re-render durante l'avanzamento dei contatori temporali e dei log.

---

## Fase 4: `/impeccable polish` — Accessibilità, Validazione Inline & Rifinitura UI

> **Obiettivo**: Risolvere tutti i difetti di micro-craft, accessibilità WCAG, usabilità e pulizia visiva individuati nel codice.

### Interventi Specifici:
1. **Accessibilità Sistemica (`prefers-reduced-motion`)**:
   - Inserire in [`web/src/styles.css`](file:///Users/mbenassi/Developer/projects/SyncForge/web/src/styles.css) la media query globale per disabilitare le animazioni per utenti con disturbi vestibolari.
   - Sostituire l'animazione continua `@keyframes dropBounce` in [`PathInput.jsx`](file:///Users/mbenassi/Developer/projects/SyncForge/web/src/components/PathInput.jsx) con uno stato di evidenziazione statico ed elegante.
2. **Anello di Focus Tastiera Esplicito (`&:focus-visible`)**:
   - Configurare in [`web/src/theme.js`](file:///Users/mbenassi/Developer/projects/SyncForge/web/src/theme.js) un anello di focus ad alto contrasto per i pulsanti (`MuiButton`), ripristinando la conformità WCAG 2.1 AA.
3. **Validazione Pre-Flight Client-Side Inline**:
   - Eliminare il modale di errore invasivo quando si preme *Launch Module* senza percorsi.
   - Mostrare un bordo rosso inline con `helperText` sul campo vuoto, azzerandolo non appena l'utente compila il campo.
4. **Consolidamento Strumenti Terminale**:
   - Spostare i pulsanti *Copia*, *Scarica*, *Pulisci log*, *Espandi* e *Chiudi* all'interno della barra superiore di [`Terminal.jsx`](file:///Users/mbenassi/Developer/projects/SyncForge/web/src/components/Terminal.jsx), rimuovendo la riga disordinata nel footer di `App.jsx`.
5. **Correzione Token Drift**:
   - Rimuovere il colore viola non autorizzato (`#C084FC`) sul chip notifiche in `App.jsx` (riga 1653) e allineare tutti i colori inline ai token definiti in [DESIGN.md](file:///Users/mbenassi/Developer/projects/SyncForge/DESIGN.md).

---

## Fase 5: Sistema Tema Chiaro / Scuro / Adattivo (Anti-Slop)

> **Obiettivo**: Introdurre il supporto a **Dark**, **Light** e **System** garantendo un'estetica rigorosa da studio di precisione, eliminando qualsiasi traccia di AI slop.

### Principi Anti-Slop:
- **No ai cliché generici**: niente bianco ottico `#FFFFFF` accecante, niente ombre sfocate pesanti, niente pulsanti a pillola gommosa o gradienti pastello.
- **Light Mode Tecnico (*Anodized Slate & Technical Ink*)**:
  - Sfondo finestra: `#F1F3F7` (Alluminio satinato opaco, confortevole per gli occhi).
  - Superfici card e dialoghi: `#FAFAFC` (Carta tecnica pura, separata da bordi hairline `1px solid rgba(15, 23, 42, 0.10)`).
  - Alloggiamenti incassati e input: `#E8ECF2`.
  - Tipografia: `#0F172A` (Inchiostro profondo Slate 900) ad altissimo contrasto.
  - **Terminale preservato scuro**: Lo sfondo del terminale CLI rimane scuro (`#111622`) anche in Light Mode, come in DaVinci Resolve, Xcode o nelle console macOS, per garantire la leggibilità naturale dei colori ANSI e dei log di processo.
- **Opzione `system`**: Rilevamento automatico della preferenza OS via `window.matchMedia('(prefers-color-scheme: dark)')`.

### File Coinvolti:
- `web/src/theme.js`: Creazione della factory `getAppTheme(mode)` con le due palette complete.
- `web/src/components/SettingsDialog.jsx`: Aggiunta del selettore tri-stato (Dark / Light / System) nella scheda General.
- `web/src/App.jsx`: Gestione dello stato attivo del tema e memorizzazione in `localStorage`.
- `DESIGN.md`: Aggiornamento della specifica dei token per includere la matrice Dark/Light.

---

## Fase 6: Integrazione Player di Anteprima `mpv` (Verifica Sincronizzazione Audio & Sottotitoli)

> **Obiettivo**: Permettere all'utente di ascoltare e visualizzare in tempo reale la sincronizzazione calcolata per **tracce audio**, **sottotitoli esterni (.srt/.ass)** o **entrambi contemporaneamente**, prima di eseguire il muxing definitivo, con possibilità di confermare, ritoccare i delay (*nudge*) o ricalcolare.

---

### 1. Fattibilità Giuridica & Licenza (MIT vs GPLv2+)
- **Quadro Normativo**:
  - `mpv` è distribuito con licenza **GPLv2+** (o LGPLv2.1+ per libmpv compilato senza moduli GPL).
  - SyncForge è distribuito con licenza **MIT License**.
- **Perché è Legale al 100%**:
  - SyncForge già interagisce con MKVToolNix (`mkvmerge`, `mkvextract` — **GPLv2**) e FFmpeg (**LGPL/GPL**) trattandoli come **sub-processi CLI esterni indipendenti** tramite `std::process::Command`.
  - La giurisprudenza della *Free Software Foundation* (FSF GPL FAQ — *"Mere Aggregation / Separate Programs"*) stabilisce in modo inequivocabile che invocare un eseguibile CLI separato tramite riga di comando o socket IPC costituisce una comunicazione "a distanza" (*arms-length*) e **non rende SyncForge un'opera derivata**, consentendole di mantenere intatta la propria licenza **MIT**.
  - **Modalità di distribuzione supportate**:
    1. *System Installation*: `mpv` installato sul sistema (`brew install mpv`, `winget install mpv`, `apt install mpv`) e reperibile nel `PATH`.
    2. *Portable Mode*: l'utente può semplicemente inserire l'eseguibile `mpv` (o `mpv.exe`) nella cartella `tools/` o `bin/` accanto a SyncForge, esattamente come per `mkvmerge` e `ffmpeg`.

---

### 2. Architettura Tecnica & Funzionamento di `mpv` per Audio e Sottotitoli
Il vantaggio straordinario di `mpv` è la sua capacità nativa di combinare al volo file multimediali diversi e applicare offset temporali indipendenti sia per l'audio che per i sottotitoli, **senza richiedere alcun muxing o rendering preventivo**:

```bash
mpv "<target_video.mkv>" \
  --audio-file="<source_video_or_audio.mkv>" \
  --audio-delay=<audio_delay_in_seconds> \
  --sub-file="<synced_subtitles.srt>" \
  --sub-delay=<sub_delay_in_seconds> \
  --start=<timestamp_segmento_analizzato> \
  --title="SyncForge Preview — Audio: [A_OFFSET]ms | Sub: [S_OFFSET]ms" \
  --input-ipc-server=<optional_ipc_socket>
```

#### I Tre Scenari di Anteprima Coperti:

1. **Anteprima Solo Sottotitoli (`sync_subs` e `sync_subs_mkv`)**:
   - Dopo l'elaborazione con `ffsubsync` (o estrazione + allineamento da MKV), `mpv` riproduce il video target con il file sottotitoli allineato:
     `mpv "<target_video.mkv>" --sub-file="<synced_subs.srt>" --start=<dialogue_start>`
   - L'utente legge le battute mentre gli attori parlano, verificando che il testo non compaia in anticipo o in ritardo.
   - Tasti rapidi nativi in `mpv`: `z` (anticipa sub di 100ms) e `Z` / `Shift+z` (posticipa sub di 100ms).
2. **Anteprima Solo Audio (`injection` con traccia audio)**:
   - `mpv` riproduce il video target con la traccia audio esterna ritardata/anticipata dell'offset FFT:
     `mpv "<target_video.mkv>" --audio-file="<source_video.mkv>" --audio-delay=<offset_sec> --start=<dialogue_start>`
   - Zero estrazione preventiva: `mpv` legge l'audio direttamente dal container sorgente.
   - Tasti rapidi nativi in `mpv`: `[` (anticipa audio di 100ms) e `]` (posticipa audio di 100ms).
3. **Anteprima Combinata Audio + Sottotitoli (`injection` completa)**:
   - Riproduzione simultanea del video target con la nuova traccia audio esterna E i sottotitoli sincronizzati.
   - Consente di convalidare in un'unica sessione di ascolto sia il labiale del nuovo doppiaggio che la precisione dei sottotitoli.

- **Salto automatico al punto del dialogo (`--start`)**: L'anteprima si apre esattamente al timestamp del picco di correlazione FFT o della prima riga di parlato rilevata da `ffsubsync`, senza costringere l'utente a cercare a mano dove iniziano le battute.

---

### 3. Interfaccia Grafica: `SyncPreviewDialog.jsx`
Dopo il calcolo della sincronizzazione (in *WaveSync Injection*, *Sync Subtitles* o *Extract & Sync Subs*), prima di procedere al muxing definitivo viene presentata una modale di verifica ad altissima precisione progettata secondo i canoni di [DESIGN.md](file:///Users/mbenassi/Developer/projects/SyncForge/DESIGN.md):

- **Header Tecnico**: Titolo con icona e badge dell'episodio/file in esame.
- **Display Monospace dei Ritardi Rilevati**:
  - **Canale Audio**: `Audio Delay: -128 ms` (in verde smeraldo `#34D399` se ad alta confidenza FFT, o ambra `#F59E0B` se inferiore alla soglia).
  - **Canale Sottotitoli**: `Subtitle Offset: +42 ms` (in blu segnale `#38BDF8`).
  - Metadati del campione analizzato (finestra temporale: `00:03:00` - `00:06:00`).
- **Pulsante di Lancio Anteprima**:
  - `Preview in mpv` (apre la finestra video nativa sincronizzata al millisecondo).
- **Controlli Indipendenti di Micro-Aggiustamento (Nudge)**:
  - **Nudge Audio**: pulsanti rapidi `[-50ms]`, `[-10ms]`, `[+10ms]`, `[+50ms]` con campo numerico diretto.
  - **Nudge Sottotitoli**: pulsanti rapidi `[-100ms]`, `[-25ms]`, `[+25ms]`, `[+100ms]` con campo numerico diretto.
- **Pulsanti di Decisione Finale**:
  - **`Confirm & Mux`** (`Enter`): applica i ritardi (originali o ritoccati manualmente) e avvia il muxing atomico definitivo (`mkvmerge`).
  - **`Recalculate with different window`**: permette di scegliere un intervallo temporale diverso (es. 15 minuti più avanti) se il primo tentativo ha campionato silenzio, rumore o musica.
  - **`Cancel`** (`Esc`): interrompe l'operazione lasciando tutti i file multimediali intatti.

---

### 4. Canoni Impeccable per `SyncPreviewDialog.jsx`
- Nessun emoji o emoticon; icone Material Design (`@mui/icons-material/PlayCircleOutline`, `TuneOutlined`, `SubtitlesOutlined`, `HeadphonesOutlined`, `CheckCircleOutline`, `RestartAlt`).
- Allineamenti millimetrici e tasti di scelta rapida (`Space` per avviare mpv, `Enter` per confermare e muxare, `Esc` per annullare).
- Piena accessibilità e gestione contrasto in Dark e Light mode.

---

## Fase 7: `/impeccable audit` & `/impeccable critique` — Verifica & Certificazione

> **Obiettivo**: Eseguire le suite di analisi di Impeccable per verificare matematicamente il salto di qualità dell'interfaccia.

### Criteri di Successo:
1. **Audit Health Score**: Incremento da **16/20** a **19-20/20** (*Excellent*):
   - Accessibilità: 4/4 (risolto reduced motion e focus visible).
   - Performance: 4/4 (risolto re-render streaming terminale).
   - Theming: 4/4 (token dual-theme completi, zero hard-coded drift).
   - Responsive: 4/4 (layout side-by-side fluido).
   - Implementation Integrity: 4/4 (confermata l'eccellenza, mpv loose coupling verificato).
2. **Critique Health Score**: Incremento da **33/40** a **37-39/40** (*Excellent*).
3. **Build & Test**:
   - `npm run lint` (`oxlint`): 0 errori.
   - `npm run build`: compilazione senza warning.
   - `npm test` (Playwright): tutti i test browser passano.

---

## 📋 Checklist Operativa Esecuzione "Tutto in un Colpo"

Segui questa sequenza ordinata per eseguire le modifiche in un unico passaggio completo:

```markdown
- [x] **1. /impeccable layout**
  - Riorganizzare `App.jsx` per consentire il docking del terminale nella colonna destra su schermi >= `lg`.
  - Convertire la card statica dei profili in un Media Stream Inspector dinamico.
- [x] **2. /impeccable clarify**
  - Aggiungere il parsing del sub-task corrente nei log di `App.jsx`.
  - Renderizzare l'indicatore di progresso sub-task con link "View live console".
- [x] **3. /impeccable optimize**
  - Implementare buffer RAF per lo streaming dei log in `App.jsx`.
  - Disaccoppiare `setProgress` da `setTerminal`.
  - Aggiungere `React.memo` a `Terminal.jsx`, `Sidebar.jsx` e `PathInput.jsx`.
- [x] **4. /impeccable polish**
  - Inserire `@media (prefers-reduced-motion)` in `styles.css`.
  - Configurare `&:focus-visible` per i bottoni in `theme.js`.
  - Implementare la validazione inline dei campi mancanti in `handleRun` (`App.jsx`).
  - Spostare i pulsanti di gestione log nell'header di `Terminal.jsx`.
  - Correggere il colore del chip notifiche su neutral slate.
- [x] **5. Dual-Theme Anti-Slop (Light / Dark / System)**
  - Implementare `getAppTheme('dark' | 'light')` in `theme.js`.
  - Aggiungere il selettore tri-stato in `SettingsDialog.jsx`.
  - Sincronizzare il tema con `matchMedia` e `localStorage` in `App.jsx`.
  - Aggiornare `DESIGN.md` con i token della modalità chiara.
- [x] **6. Integrazione Anteprima Sincronizzazione con mpv (Audio & Sottotitoli)**
  - Backend Rust: Aggiungere il comando Tauri `preview_sync_mpv(target, audio_file, audio_delay_ms, sub_file, sub_delay_ms, start_time)` in `src-tauri/src/core/processes.rs`.
  - Frontend: Creare il componente `SyncPreviewDialog.jsx` con controlli indipendenti per ritardo audio (`--audio-delay`) e ritardo sottotitoli (`--sub-delay`), pulsanti di nudge dedicati (+/-10ms per audio, +/-25ms per sub), pulsante "Preview in mpv" e azioni "Confirm & Mux" / "Recalculate".
  - Opzione Settings: Aggiungere il toggle "Preview sync with mpv before muxing" in `SettingsDialog.jsx`.
- [x] **7. Verifica Finale**
  - Eseguire `npm run lint` (`oxlint`).
  - Eseguire `npm run build` (compilazione Vite).
  - Eseguire `npm test` (suite Playwright).
  - Lanciare `/impeccable audit` e `/impeccable critique` per registrare i nuovi punteggi.
```
