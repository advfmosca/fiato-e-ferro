# Fiato e Ferro · Ciclo 2

Webapp statica che mostra la scheda di allenamento del giorno. Si apre da Safari su iPhone e si aggiunge alla schermata Home (Condividi → Aggiungi alla schermata Home).

URL: https://advfmosca.github.io/fiato-e-ferro/

## Come si cambia il programma

Tutti i dati stanno in `program.json`: esercizi, serie, ripetizioni, carichi, recuperi, calendario, regole, cibo e integratori.

- Per cambiare un carico basta modificare il campo `load` dell'esercizio. Un carico ancora da confermare ha `"flags": ["proposal"]`: quando arriva il numero vero si aggiorna `load` e si toglie `proposal`.
- Aggiorna anche `version` (data della modifica): compare in fondo all'app.
- `program.json` non richiede di alzare la versione del service worker: l'app lo chiede alla rete e usa la copia in cache solo offline.

## Quando si cambia il codice

Se cambiano `index.html`, `app.js`, `style.css` o le icone, alza `VERSION` in `sw.js`: al primo avvio dopo il deploy l'app scarica i file nuovi e si ricarica da sola.

## Registro

I kg e le ripetizioni registrati restano nel `localStorage` del telefono (chiave `fef.v1`). Non arrivano a Claude da soli: il pulsante «Copia il riepilogo della settimana» nella sezione Registro prepara il testo da incollare in chat.

## Invio a Claude

A fine seduta il tasto «Invia a Claude» apre Mail con la seduta già scritta; nel Registro c'è lo stesso per la settimana. L'indirizzo lo inserisce l'utente nell'app e resta nel telefono, non nel codice.

- Oggetto: `[Fiato e Ferro] Seduta <giorno gg/mm> · Scheda X` oppure `[Fiato e Ferro] Settimana <date>`.
- Corpo: riepilogo leggibile, poi i dati in JSON tra le righe `---DATI---` e `---FINE---`.
- Seduta (`kind: "session"`): data, settimana, blocco, scarico/pausa, scheda, versione, stato (`done`/`skipped`), spalla, nota ed elenco esercizi con previsto (`plan`, `load`), fatto (`kg`, `reps`, `sets` su `of`) e `done`.
- Settimana (`kind: "week"`): le sedute dei giorni con dati, i giorni saltati e le misure del sabato.

Per ricalibrare: cercare in Gmail `subject:"[Fiato e Ferro]"`, leggere i blocchi JSON e aggiornare `program.json`.

## Prova in locale

```bash
python3 -m http.server 8765
```

Poi apri `http://localhost:8765/?data=2026-12-14` per simulare una data qualsiasi.
