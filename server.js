const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');

// Carica configurazione (file locale o variabili d'ambiente per il cloud)
let config = {};
try {
  config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
} catch {}

if (process.env.ANTHROPIC_API_KEY) config.anthropic_api_key = process.env.ANTHROPIC_API_KEY;
if (process.env.ADMIN_PASSWORD)    config.password           = process.env.ADMIN_PASSWORD;
if (process.env.NOME_RISTORANTE)   config.nome_ristorante    = process.env.NOME_RISTORANTE;
if (process.env.PORT)              config.porta              = process.env.PORT;

if (!config.anthropic_api_key) {
  console.error('Errore: chiave API Anthropic mancante.');
  process.exit(1);
}
if (!config.password) {
  console.error('Errore: password admin mancante.');
  process.exit(1);
}

const app = express();
const PORT = config.porta || 3000;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data', 'vini.json');

// Assicura che le cartelle necessarie esistano
const dataDir = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');

const anthropic = new Anthropic({ apiKey: config.anthropic_api_key });
const sessioni = new Set();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Utility ────────────────────────────────────────────────────────────────

function caricaVini() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return []; }
}

function salvaVini(vini) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(vini, null, 2), 'utf8');
}

function requireAuth(req, res, next) {
  const token = req.headers['x-auth-token'];
  if (!token || !sessioni.has(token)) {
    return res.status(401).json({ errore: 'Non autorizzato. Effettua il login.' });
  }
  next();
}

// ─── Auth ────────────────────────────────────────────────────────────────────

app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === config.password) {
    const token = crypto.randomBytes(32).toString('hex');
    sessioni.add(token);
    res.json({ token });
  } else {
    res.status(401).json({ errore: 'Password errata.' });
  }
});

app.post('/api/logout', requireAuth, (req, res) => {
  sessioni.delete(req.headers['x-auth-token']);
  res.json({ ok: true });
});

// ─── API pubblica ─────────────────────────────────────────────────────────────

app.get('/api/vini', (req, res) => res.json(caricaVini()));

app.get('/api/config-pubblica', (req, res) => {
  res.json({ nome_ristorante: config.nome_ristorante });
});

// ─── API admin (protette) ─────────────────────────────────────────────────────

app.get('/api/admin/vini', requireAuth, (req, res) => res.json(caricaVini()));

app.post('/api/admin/vini', requireAuth, (req, res) => {
  const vini = caricaVini();
  const vino = {
    id: Date.now().toString(),
    tipo:             req.body.tipo             || '',
    cantina:          req.body.cantina          || '',
    nome:             req.body.nome             || '',
    annata:           req.body.annata           || '',
    uve:              req.body.uve              || '',
    descrizione:      req.body.descrizione      || '',
    nazione:          req.body.nazione          || '',
    regione:          req.body.regione          || '',
    prezzo_bottiglia: req.body.prezzo_bottiglia || null,
    prezzo_mescita:   req.body.prezzo_mescita   || null,
    creato_il: new Date().toISOString()
  };
  vini.push(vino);
  salvaVini(vini);
  res.status(201).json(vino);
});

app.put('/api/admin/vini/:id', requireAuth, (req, res) => {
  const vini = caricaVini();
  const idx = vini.findIndex(v => v.id === req.params.id);
  if (idx === -1) return res.status(404).json({ errore: 'Vino non trovato.' });
  vini[idx] = {
    ...vini[idx],
    tipo:             req.body.tipo             ?? vini[idx].tipo,
    cantina:          req.body.cantina          ?? vini[idx].cantina,
    nome:             req.body.nome             ?? vini[idx].nome,
    annata:           req.body.annata           ?? vini[idx].annata,
    uve:              req.body.uve              ?? vini[idx].uve,
    descrizione:      req.body.descrizione      ?? vini[idx].descrizione,
    nazione:          req.body.nazione          ?? vini[idx].nazione,
    regione:          req.body.regione          ?? vini[idx].regione,
    prezzo_bottiglia: req.body.prezzo_bottiglia ?? vini[idx].prezzo_bottiglia,
    prezzo_mescita:   req.body.prezzo_mescita   ?? vini[idx].prezzo_mescita,
    modificato_il: new Date().toISOString()
  };
  salvaVini(vini);
  res.json(vini[idx]);
});

app.delete('/api/admin/vini/:id', requireAuth, (req, res) => {
  const vini = caricaVini();
  const nuoviVini = vini.filter(v => v.id !== req.params.id);
  if (nuoviVini.length === vini.length)
    return res.status(404).json({ errore: 'Vino non trovato.' });
  salvaVini(nuoviVini);
  res.json({ ok: true });
});

// ─── Backup ───────────────────────────────────────────────────────────────────

app.get('/api/admin/backup', requireAuth, (req, res) => {
  const vini = caricaVini();
  const data = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename="vini-backup-${data}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(vini, null, 2));
});

// ─── AI: genera descrizione + nazione + regione ───────────────────────────────

app.post('/api/admin/genera-descrizione', requireAuth, async (req, res) => {
  const { cantina, nome, annata, uve, tipo } = req.body;
  if (!nome) return res.status(400).json({ errore: 'Il nome del vino è obbligatorio.' });

  try {
    const messaggio = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Sei un sommelier esperto. Analizza questo vino e rispondi SOLO con un oggetto JSON valido, senza testo prima o dopo:

{
  "tipo": "uno tra: Rosso, Bianco, Bollicine, Rosato, Dolce, Orange, Fortificato",
  "uve": "vitigni principali con percentuale se nota, es. Nebbiolo 100%",
  "descrizione": "descrizione sensoriale elegante max 80 parole, evoca profumi sapori e abbinamenti",
  "nazione": "paese di origine dedotto dal nome/cantina",
  "regione": "regione vinicola di origine dedotta dal contesto"
}

Dati del vino (compila i campi mancanti basandoti sulle tue conoscenze):
- Nome: ${nome}
- Cantina: ${cantina || 'N/D'}
- Annata: ${annata || 'N/D'}
- Tipo già indicato: ${tipo || 'da dedurre'}
- Uve già indicate: ${uve || 'da dedurre'}`
      }]
    });

    const testo = messaggio.content[0].text.trim();
    // Estrae il JSON anche se ci fosse qualcosa intorno
    const match = testo.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Risposta AI non valida');
    const dati = JSON.parse(match[0]);
    res.json(dati);
  } catch (e) {
    console.error('Errore Claude API:', e.message);
    res.status(500).json({ errore: 'Errore nella generazione. Controlla la chiave API.' });
  }
});


// ─── Avvio server ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🍷  Sistema Vini avviato`);
  console.log(`   Catalogo clienti → http://localhost:${PORT}`);
  console.log(`   Admin            → http://localhost:${PORT}/admin\n`);
});
