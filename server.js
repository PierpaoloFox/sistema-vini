const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');

// ─── Configurazione ───────────────────────────────────────────────────────────

let config = {};
try { config = JSON.parse(fs.readFileSync('config.json', 'utf8')); } catch {}

if (process.env.ANTHROPIC_API_KEY) config.anthropic_api_key = process.env.ANTHROPIC_API_KEY;
if (process.env.ADMIN_PASSWORD)    config.password           = process.env.ADMIN_PASSWORD;
if (process.env.NOME_RISTORANTE)   config.nome_ristorante    = process.env.NOME_RISTORANTE;
if (process.env.PORT)              config.porta              = process.env.PORT;

if (!config.anthropic_api_key) { console.error('Errore: ANTHROPIC_API_KEY mancante.'); process.exit(1); }
if (!config.password)          { console.error('Errore: ADMIN_PASSWORD mancante.');    process.exit(1); }

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO  = process.env.GITHUB_REPO;   // es. 'PierpaoloFox/sistema-vini'
const GITHUB_FILE  = 'data/vini.json';
const DATA_FILE    = process.env.DATA_FILE || path.join(__dirname, 'data', 'vini.json');

// Assicura cartella locale (usata in sviluppo o come fallback)
const dataDir = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');

const app = express();
const PORT = config.porta || 3000;
const anthropic = new Anthropic({ apiKey: config.anthropic_api_key });
const sessioni = new Set();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Storage: GitHub API (produzione) o file locale (sviluppo) ───────────────

let cacheVini = null;
let cacheSha  = null;
let cacheTime = 0;
const CACHE_TTL = 10000; // 10 secondi

async function caricaVini() {
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return []; }
  }
  if (cacheVini && Date.now() - cacheTime < CACHE_TTL) return cacheVini;
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}`, {
      headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github+json' }
    });
    if (!res.ok) return cacheVini || [];
    const data = await res.json();
    const testo = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf8');
    cacheVini = JSON.parse(testo);
    cacheSha  = data.sha;
    cacheTime = Date.now();
    return cacheVini;
  } catch (e) {
    console.error('Errore lettura GitHub:', e.message);
    return cacheVini || [];
  }
}

async function salvaVini(vini) {
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(vini, null, 2), 'utf8');
    return;
  }
  // Recupera SHA aggiornato se necessario
  if (!cacheSha) {
    const r = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}`, {
      headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github+json' }
    });
    if (r.ok) { const d = await r.json(); cacheSha = d.sha; }
  }
  const contenuto = Buffer.from(JSON.stringify(vini, null, 2), 'utf8').toString('base64');
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github+json'
    },
    body: JSON.stringify({
      message: `Vini aggiornati ${new Date().toISOString().slice(0,16).replace('T',' ')}`,
      content: contenuto,
      ...(cacheSha && { sha: cacheSha })
    })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Errore salvataggio GitHub: ${err.message}`);
  }
  const data = await res.json();
  cacheSha  = data.content.sha;
  cacheVini = vini;
  cacheTime = Date.now();
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  const token = req.headers['x-auth-token'];
  if (!token || !sessioni.has(token)) return res.status(401).json({ errore: 'Non autorizzato.' });
  next();
}

app.post('/api/login', (req, res) => {
  if (req.body.password === config.password) {
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

app.get('/api/vini', async (req, res) => {
  res.json(await caricaVini());
});

app.get('/api/config-pubblica', (req, res) => {
  res.json({ nome_ristorante: config.nome_ristorante });
});

// ─── API admin ────────────────────────────────────────────────────────────────

app.get('/api/admin/vini', requireAuth, async (req, res) => {
  res.json(await caricaVini());
});

app.post('/api/admin/vini', requireAuth, async (req, res) => {
  const vini = await caricaVini();
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
  await salvaVini(vini);
  res.status(201).json(vino);
});

app.put('/api/admin/vini/:id', requireAuth, async (req, res) => {
  const vini = await caricaVini();
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
  await salvaVini(vini);
  res.json(vini[idx]);
});

app.delete('/api/admin/vini/:id', requireAuth, async (req, res) => {
  const vini = await caricaVini();
  const nuovi = vini.filter(v => v.id !== req.params.id);
  if (nuovi.length === vini.length) return res.status(404).json({ errore: 'Vino non trovato.' });
  await salvaVini(nuovi);
  res.json({ ok: true });
});

// ─── Backup ───────────────────────────────────────────────────────────────────

app.get('/api/admin/backup', requireAuth, async (req, res) => {
  const vini = await caricaVini();
  const data = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename="vini-backup-${data}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(vini, null, 2));
});

app.post('/api/admin/ripristina', requireAuth, async (req, res) => {
  const { vini } = req.body;
  if (!Array.isArray(vini)) return res.status(400).json({ errore: 'File non valido.' });
  await salvaVini(vini);
  res.json({ ok: true, importati: vini.length });
});

// ─── AI ───────────────────────────────────────────────────────────────────────

app.post('/api/admin/genera-descrizione', requireAuth, async (req, res) => {
  const { testo } = req.body;
  if (!testo?.trim()) return res.status(400).json({ errore: 'Inserisci almeno il nome del vino.' });
  try {
    const messaggio = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Sei un sommelier esperto. Analizza il testo seguente che descrive un vino e rispondi SOLO con un oggetto JSON valido, senza testo prima o dopo:

{
  "nome": "nome del vino senza il nome della cantina (es. Barolo DOCG, Brunello di Montalcino Riserva)",
  "cantina": "nome della cantina o produttore (es. Cascina Gavetta)",
  "annata": "anno come stringa (es. 2020), oppure stringa vuota se non indicato",
  "tipo": "uno tra: Rosso, Bianco, Bollicine, Rosato, Dolce, Orange, Fortificato",
  "uve": "vitigni principali con percentuale se nota, es. Nebbiolo 100%",
  "descrizione": "descrizione sensoriale elegante max 80 parole, evoca profumi sapori e abbinamenti",
  "nazione": "paese di origine",
  "regione": "regione vinicola di origine"
}

Testo: "${testo.trim()}"`
      }]
    });
    const match = messaggio.content[0].text.trim().match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Risposta AI non valida');
    res.json(JSON.parse(match[0]));
  } catch (e) {
    console.error('Errore Claude:', e.message);
    res.status(500).json({ errore: 'Errore AI. Controlla la chiave API.' });
  }
});

// ─── Avvio ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  const storage = (GITHUB_TOKEN && GITHUB_REPO) ? `GitHub (${GITHUB_REPO})` : 'file locale';
  console.log(`\n🍷  Sistema Vini avviato — storage: ${storage}`);
  console.log(`   Catalogo → http://localhost:${PORT}`);
  console.log(`   Admin    → http://localhost:${PORT}/admin\n`);
});
