const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');
const { Pool } = require('pg');

// ─── Configurazione ───────────────────────────────────────────────────────────

let config = {};
try { config = JSON.parse(fs.readFileSync('config.json', 'utf8')); } catch {}

if (process.env.ANTHROPIC_API_KEY) config.anthropic_api_key = process.env.ANTHROPIC_API_KEY;
if (process.env.ADMIN_PASSWORD)    config.password           = process.env.ADMIN_PASSWORD;
if (process.env.NOME_RISTORANTE)   config.nome_ristorante    = process.env.NOME_RISTORANTE;
if (process.env.PORT)              config.porta              = process.env.PORT;

if (!config.anthropic_api_key) { console.error('Errore: ANTHROPIC_API_KEY mancante.'); process.exit(1); }
if (!config.password)          { console.error('Errore: ADMIN_PASSWORD mancante.');    process.exit(1); }

const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data', 'vini.json');
const USE_DB    = !!process.env.DATABASE_URL;

const app = express();
const PORT = config.porta || 3000;
const anthropic = new Anthropic({ apiKey: config.anthropic_api_key });
const sessioni = new Set();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Storage: PostgreSQL (produzione) o file locale (sviluppo) ───────────────

let pool = null;

if (USE_DB) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
}

async function initDB() {
  if (!USE_DB) {
    // Assicura cartella locale
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');
    return;
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS vini (
      id                TEXT PRIMARY KEY,
      tipo              TEXT DEFAULT '',
      cantina           TEXT DEFAULT '',
      nome              TEXT DEFAULT '',
      annata            TEXT DEFAULT '',
      uve               TEXT DEFAULT '',
      descrizione       TEXT DEFAULT '',
      nazione           TEXT DEFAULT '',
      regione           TEXT DEFAULT '',
      prezzo_bottiglia  NUMERIC,
      prezzo_mescita    NUMERIC,
      creato_il         TEXT,
      modificato_il     TEXT,
      terminato         BOOLEAN DEFAULT FALSE
    )
  `);
  // Migrazione: aggiunge la colonna se la tabella esisteva già senza di essa
  await pool.query(`ALTER TABLE vini ADD COLUMN IF NOT EXISTS terminato BOOLEAN DEFAULT FALSE`);
  console.log('✅ Tabella vini pronta.');
}

async function caricaVini() {
  if (!USE_DB) {
    try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return []; }
  }
  const result = await pool.query('SELECT * FROM vini ORDER BY creato_il ASC');
  return result.rows;
}

async function salvaVini(vini) {
  if (!USE_DB) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(vini, null, 2), 'utf8');
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM vini');
    for (const v of vini) {
      await client.query(
        `INSERT INTO vini
           (id, tipo, cantina, nome, annata, uve, descrizione, nazione, regione,
            prezzo_bottiglia, prezzo_mescita, creato_il, modificato_il, terminato)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [ v.id, v.tipo || '', v.cantina || '', v.nome || '', v.annata || '',
          v.uve || '', v.descrizione || '', v.nazione || '', v.regione || '',
          v.prezzo_bottiglia || null, v.prezzo_mescita || null,
          v.creato_il || null, v.modificato_il || null, v.terminato || false ]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
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

// ─── Diagnostica storage ──────────────────────────────────────────────────────

app.get('/api/admin/storage-info', requireAuth, (req, res) => {
  res.json({
    modalita: USE_DB ? 'postgres' : 'locale',
  });
});

// ─── API pubblica ─────────────────────────────────────────────────────────────

app.get('/api/vini', async (req, res) => {
  const vini = await caricaVini();
  res.json(vini.filter(v => !v.terminato));
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

app.put('/api/admin/vini/:id/termina', requireAuth, async (req, res) => {
  const vini = await caricaVini();
  const idx = vini.findIndex(v => v.id === req.params.id);
  if (idx === -1) return res.status(404).json({ errore: 'Vino non trovato.' });
  vini[idx].terminato = !vini[idx].terminato;
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

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🍷  Sistema Vini avviato — storage: ${USE_DB ? 'PostgreSQL (Railway)' : 'file locale'}`);
    console.log(`   Catalogo → http://localhost:${PORT}`);
    console.log(`   Admin    → http://localhost:${PORT}/admin\n`);
  });
}).catch(err => {
  console.error('Errore inizializzazione database:', err.message);
  process.exit(1);
});
