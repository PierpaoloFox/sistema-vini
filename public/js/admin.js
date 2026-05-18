let authToken = sessionStorage.getItem('vini_token') || null;
let tuttiVini = [];
let idDaEliminare = null;

const CATEGORIA_CONFIG = {
  Vino: {
    labelCantina: 'Cantina',
    labelUve: 'Uve / Vitigni',
    mostraAnnata: true,
    labelAnnata: 'Annata',
    tipoOptions: ['Rosso','Bianco','Bollicine','Rosato','Dolce','Orange','Fortificato'],
    placeholderTesto: 'es. Cascina Gavetta Barolo DOCG 2020',
  },
  Birra: {
    labelCantina: 'Birrificio',
    labelUve: 'Malti e luppoli',
    mostraAnnata: false,
    labelAnnata: '',
    tipoOptions: ['Lager','Weizen','IPA','Pale Ale','Stout','Porter','Ambrata','Sour','Belga','Trappista','Altro'],
    placeholderTesto: 'es. Birrificio Italiano Bibock',
  },
  Distillato: {
    labelCantina: 'Distilleria',
    labelUve: 'Base / Botaniche',
    mostraAnnata: true,
    labelAnnata: 'Invecchiamento / Annata',
    tipoOptions: ['Whisky','Gin','Rum','Grappa','Acquavite','Amaro','Cognac','Armagnac','Calvados','Mezcal','Tequila','Vodka','Altro'],
    placeholderTesto: 'es. Capovilla Ciliegie Duroni',
  }
};

document.addEventListener('DOMContentLoaded', () => {
  if (authToken) mostraApp();
});

// ── Auth ──────────────────────────────────────────────────────────────────────

async function login(e) {
  e.preventDefault();
  const errEl = document.getElementById('errore-login');
  errEl.textContent = '';
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: document.getElementById('password').value })
    });
    const dati = await res.json();
    if (!res.ok) throw new Error(dati.errore || 'Errore login');
    authToken = dati.token;
    sessionStorage.setItem('vini_token', authToken);
    mostraApp();
  } catch (err) {
    errEl.textContent = err.message;
  }
}

async function logout() {
  try { await apiFetch('/api/logout', { method: 'POST' }); } catch {}
  authToken = null;
  sessionStorage.removeItem('vini_token');
  document.getElementById('app').classList.add('nascosto');
  document.getElementById('schermata-login').classList.remove('nascosto');
  document.getElementById('password').value = '';
}

async function mostraApp() {
  document.getElementById('schermata-login').classList.add('nascosto');
  document.getElementById('app').classList.remove('nascosto');
  await caricaVini();
}


// ── Fetch autenticata ─────────────────────────────────────────────────────────

async function apiFetch(url, opzioni = {}) {
  const res = await fetch(url, {
    ...opzioni,
    headers: { 'Content-Type': 'application/json', 'x-auth-token': authToken, ...(opzioni.headers || {}) }
  });
  if (res.status === 401) { authToken = null; sessionStorage.removeItem('vini_token'); location.reload(); }
  return res;
}

// ── Caricamento e render ──────────────────────────────────────────────────────

async function caricaVini() {
  try {
    const res = await apiFetch('/api/admin/vini');
    tuttiVini = await res.json();
    renderTabella(tuttiVini);
    document.getElementById('contatore-vini').textContent = tuttiVini.length;
  } catch {
    document.getElementById('tbody-vini').innerHTML =
      '<tr><td colspan="9" class="cella-loader">Errore nel caricamento.</td></tr>';
  }
}

const COLORI_TIPO = { rosso: '#ffaaaa', bianco: '#ffe8a0', bollicine: '#d4b8ff', orange: '#ffcc99' };

function renderTabella(vini) {
  const tbody = document.getElementById('tbody-vini');
  if (vini.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="cella-vuota">Nessun vino in lista. Aggiungine uno.</td></tr>';
    return;
  }
  tbody.innerHTML = vini.map(v => {
    const tipoColor = v.tipo ? (COLORI_TIPO[v.tipo.toLowerCase()] || '#ccc') : '';
    const tipoHtml  = v.tipo
      ? `<span style="color:${tipoColor};font-weight:500;font-size:0.8rem">${v.tipo}</span>`
      : '—';
    const terminato = v.terminato;
    return `
    <tr class="${terminato ? 'riga-terminata' : ''}">
      <td>${tipoHtml}</td>
      <td class="td-cantina">${v.cantina || '—'}</td>
      <td class="td-nome">${v.nome}${terminato ? ' <span class="badge-terminato">Terminato</span>' : ''}</td>
      <td>${v.nazione || '—'}</td>
      <td>${v.regione || '—'}</td>
      <td>${v.annata || '—'}</td>
      <td class="td-prezzo">${v.prezzo_bottiglia ? '€ ' + parseFloat(v.prezzo_bottiglia).toFixed(2) : '—'}</td>
      <td class="td-prezzo">${v.prezzo_mescita   ? '€ ' + parseFloat(v.prezzo_mescita).toFixed(2)   : '—'}</td>
      <td>
        <div class="azioni-cella">
          <button class="btn btn-outline btn-sm" onclick="apriFormModifica('${v.id}')">Modifica</button>
          <button class="btn btn-sm ${terminato ? 'btn-disponibile' : 'btn-termina'}" onclick="toggleTerminato('${v.id}')">${terminato ? '↩ Disponibile' : 'Terminato'}</button>
          <button class="btn btn-ghost btn-sm"   onclick="richiestaElimina('${v.id}')">Elimina</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function filtraTabella(testo) {
  const t = testo.toLowerCase();
  renderTabella(tuttiVini.filter(v =>
    (v.nome || '').toLowerCase().includes(t) ||
    (v.cantina || '').toLowerCase().includes(t) ||
    (v.nazione || '').toLowerCase().includes(t) ||
    (v.regione || '').toLowerCase().includes(t)
  ));
}

// ── Form ──────────────────────────────────────────────────────────────────────

function apriFormNuovo() {
  document.getElementById('titolo-form').textContent = 'Nuovo vino';
  document.getElementById('vino-id').value = '';
  document.getElementById('form-vino').reset();
  document.getElementById('stato-ia').textContent = '';
  // Modalità nuovo: mostra il campo testo libero
  document.getElementById('campo-testo-libero').style.display = '';
  document.getElementById('f-testo-libero').value = '';
  document.getElementById('f-categoria').value = 'Vino';
  document.querySelectorAll('.cat-scelta-btn').forEach(b => b.classList.remove('attivo'));
  document.querySelector('.cat-scelta-btn[data-cat="Vino"]').classList.add('attivo');
  aggiornaCampiCategoria('Vino');
  document.getElementById('campo-categoria').style.display = '';
  apriPannello();
  setTimeout(() => document.getElementById('f-testo-libero').focus(), 100);
}

function apriFormModifica(id) {
  const v = tuttiVini.find(x => x.id === id);
  if (!v) return;
  document.getElementById('titolo-form').textContent = 'Modifica vino';
  document.getElementById('vino-id').value           = v.id;
  document.getElementById('f-nome').value            = v.nome || '';
  document.getElementById('f-cantina').value         = v.cantina || '';
  document.getElementById('f-tipo').value            = v.tipo || '';
  document.getElementById('f-annata').value          = v.annata || '';
  document.getElementById('f-uve').value             = v.uve || '';
  document.getElementById('f-descrizione').value     = v.descrizione || '';
  document.getElementById('f-nazione').value         = v.nazione || '';
  document.getElementById('f-regione').value         = v.regione || '';
  document.getElementById('f-prezzo-bottiglia').value = v.prezzo_bottiglia || '';
  document.getElementById('f-prezzo-mescita').value  = v.prezzo_mescita || '';
  document.getElementById('stato-ia').textContent    = '';
  // Categoria
  const cat = v.categoria || 'Vino';
  document.getElementById('f-categoria').value = cat;
  document.querySelectorAll('.cat-scelta-btn').forEach(b => b.classList.remove('attivo'));
  document.querySelector(`.cat-scelta-btn[data-cat="${cat}"]`).classList.add('attivo');
  aggiornaCampiCategoria(cat);
  // Dopo aver aggiornato il tipo, riseleziona il valore corretto
  document.getElementById('f-tipo').value = v.tipo || '';
  document.getElementById('campo-categoria').style.display = 'none'; // non mostrare in modifica
  // Modalità modifica: nasconde il campo testo libero (già tutto compilato)
  document.getElementById('campo-testo-libero').style.display = 'none';
  apriPannello();
}

function apriPannello() {
  document.getElementById('overlay-admin').classList.add('aperta');
  document.getElementById('pannello-form').classList.add('aperto');
  document.getElementById('f-nome').focus();
}

function chiudiForm() {
  document.getElementById('overlay-admin').classList.remove('aperta');
  document.getElementById('pannello-form').classList.remove('aperto');
}

// ── Categoria ─────────────────────────────────────────────────────────────────

function selezionaCategoria(cat, el) {
  document.getElementById('f-categoria').value = cat;
  document.querySelectorAll('.cat-scelta-btn').forEach(b => b.classList.remove('attivo'));
  el.classList.add('attivo');
  aggiornaCampiCategoria(cat);
}

function aggiornaCampiCategoria(cat) {
  const cfg = CATEGORIA_CONFIG[cat] || CATEGORIA_CONFIG.Vino;
  // Labels
  document.getElementById('label-cantina').innerHTML = cfg.labelCantina + ' <span class="label-hint">AI</span>';
  document.getElementById('label-uve').innerHTML = cfg.labelUve + ' <span class="label-hint">AI</span>';
  // Annata
  const campoAnnata = document.getElementById('campo-annata');
  if (campoAnnata) {
    campoAnnata.style.display = cfg.mostraAnnata ? '' : 'none';
    if (cfg.mostraAnnata) document.getElementById('label-annata').innerHTML = cfg.labelAnnata + ' <span class="label-hint">AI</span>';
  }
  // Tipo options
  const sel = document.getElementById('f-tipo');
  sel.innerHTML = '<option value="">— seleziona —</option>' +
    cfg.tipoOptions.map(t => `<option value="${t}">${t}</option>`).join('');
  // Placeholder testo libero
  const testoEl = document.getElementById('f-testo-libero');
  if (testoEl) testoEl.placeholder = cfg.placeholderTesto;
}

// ── Salva ─────────────────────────────────────────────────────────────────────

async function salvaVino(e) {
  e.preventDefault();
  const id = document.getElementById('vino-id').value;
  const btnSalva = document.getElementById('btn-salva');

  const dati = {
    nome:             document.getElementById('f-nome').value.trim(),
    cantina:          document.getElementById('f-cantina').value.trim(),
    tipo:             document.getElementById('f-tipo').value,
    annata:           document.getElementById('f-annata').value.trim(),
    uve:              document.getElementById('f-uve').value.trim(),
    descrizione:      document.getElementById('f-descrizione').value.trim(),
    nazione:          document.getElementById('f-nazione').value.trim(),
    regione:          document.getElementById('f-regione').value.trim(),
    prezzo_bottiglia: document.getElementById('f-prezzo-bottiglia').value || null,
    prezzo_mescita:   document.getElementById('f-prezzo-mescita').value || null,
    categoria:        document.getElementById('f-categoria').value || 'Vino',
  };

  if (!dati.nome) {
    mostraToast('Il nome del vino è obbligatorio. Usa il pulsante AI per generarlo.', 'errore');
    return;
  }

  btnSalva.disabled = true;
  btnSalva.textContent = 'Salvataggio...';

  try {
    const res = await apiFetch(
      id ? `/api/admin/vini/${id}` : '/api/admin/vini',
      { method: id ? 'PUT' : 'POST', body: JSON.stringify(dati) }
    );
    if (!res.ok) { const err = await res.json(); throw new Error(err.errore || 'Errore'); }
    chiudiForm();
    await caricaVini();
    mostraToast(id ? 'Vino aggiornato.' : 'Vino aggiunto.', 'successo');
  } catch (err) {
    mostraToast(err.message, 'errore');
  } finally {
    btnSalva.disabled = false;
    btnSalva.textContent = 'Salva vino';
  }
}

// ── Termina / Disponibile ─────────────────────────────────────────────────────

async function toggleTerminato(id) {
  try {
    const res = await apiFetch(`/api/admin/vini/${id}/termina`, { method: 'PUT' });
    if (!res.ok) throw new Error('Errore');
    const vino = await res.json();
    await caricaVini();
    mostraToast(vino.terminato ? `"${vino.nome}" segnato come terminato.` : `"${vino.nome}" di nuovo disponibile.`, 'successo');
  } catch {
    mostraToast('Errore nell\'aggiornamento.', 'errore');
  }
}

// ── Elimina ───────────────────────────────────────────────────────────────────

function richiestaElimina(id) {
  const v = tuttiVini.find(x => x.id === id);
  if (!v) return;
  idDaEliminare = id;
  document.getElementById('testo-elimina').textContent =
    `Stai per eliminare "${v.nome}"${v.cantina ? ' di ' + v.cantina : ''}. L'operazione non è reversibile.`;
  document.getElementById('overlay-elimina').classList.add('aperta');
  document.getElementById('dialogo-elimina').classList.add('aperto');
}

function annullaElimina() {
  idDaEliminare = null;
  document.getElementById('overlay-elimina').classList.remove('aperta');
  document.getElementById('dialogo-elimina').classList.remove('aperto');
}

async function confermaElimina() {
  if (!idDaEliminare) return;
  try {
    const res = await apiFetch(`/api/admin/vini/${idDaEliminare}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Errore nell\'eliminazione');
    annullaElimina();
    await caricaVini();
    mostraToast('Vino eliminato.', 'successo');
  } catch (err) {
    mostraToast(err.message, 'errore');
  }
}

// ── Genera con AI ─────────────────────────────────────────────────────────────

async function generaDescrizione() {
  // In modifica usa i campi già compilati come testo, in nuovo usa il testo libero
  const id = document.getElementById('vino-id').value;
  let testo;
  if (id) {
    // Modifica: ricostruisce testo dai campi esistenti
    const nome    = document.getElementById('f-nome').value.trim();
    const cantina = document.getElementById('f-cantina').value.trim();
    const annata  = document.getElementById('f-annata').value.trim();
    testo = [cantina, nome, annata].filter(Boolean).join(' ');
  } else {
    testo = document.getElementById('f-testo-libero').value.trim();
  }

  if (!testo) {
    mostraToast('Scrivi almeno il nome del vino prima di generare.', 'errore');
    return;
  }

  const btn = document.getElementById('btn-genera');
  const statoEl = document.getElementById('stato-ia');
  btn.disabled = true;
  btn.textContent = '✦ Analisi in corso...';
  statoEl.textContent = 'Claude sta analizzando il vino...';

  try {
    const res = await apiFetch('/api/admin/genera-descrizione', {
      method: 'POST',
      body: JSON.stringify({ testo })
    });
    const dati = await res.json();
    if (!res.ok) throw new Error(dati.errore || 'Errore AI');

    if (dati.categoria) {
      const catEl = document.querySelector(`.cat-scelta-btn[data-cat="${dati.categoria}"]`);
      if (catEl) selezionaCategoria(dati.categoria, catEl);
    }
    if (dati.nome)        document.getElementById('f-nome').value        = dati.nome;
    if (dati.cantina)     document.getElementById('f-cantina').value     = dati.cantina;
    if (dati.annata)      document.getElementById('f-annata').value      = dati.annata;
    if (dati.tipo)        document.getElementById('f-tipo').value        = dati.tipo;
    if (dati.uve)         document.getElementById('f-uve').value         = dati.uve;
    if (dati.descrizione) document.getElementById('f-descrizione').value = dati.descrizione;
    if (dati.nazione)     document.getElementById('f-nazione').value     = dati.nazione;
    if (dati.regione)     document.getElementById('f-regione').value     = dati.regione;

    statoEl.textContent = 'Tutti i campi generati da Claude AI — modificali se necessario.';
  } catch (err) {
    statoEl.textContent = '';
    mostraToast(err.message, 'errore');
  } finally {
    btn.disabled = false;
    btn.textContent = '✦ Ricerca e genera con AI';
  }
}

// ── Backup / Ripristino ───────────────────────────────────────────────────────

async function importaBackup(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = ''; // reset per permettere di reimportare lo stesso file

  const reader = new FileReader();
  reader.onload = async (e) => {
    let vini;
    try {
      const contenuto = JSON.parse(e.target.result);
      vini = Array.isArray(contenuto) ? contenuto : null;
    } catch {
      mostraToast('File non valido: deve essere un JSON esportato da questo sistema.', 'errore');
      return;
    }

    if (!vini) {
      mostraToast('File non valido: struttura non riconosciuta.', 'errore');
      return;
    }

    if (!confirm(`Stai per importare ${vini.length} vini.\nI vini attuali verranno sostituiti (un backup automatico verrà salvato sul server).\n\nContinuare?`)) return;

    try {
      const res = await apiFetch('/api/admin/ripristina', {
        method: 'POST',
        body: JSON.stringify({ vini })
      });
      const dati = await res.json();
      if (!res.ok) throw new Error(dati.errore);
      await caricaVini();
      mostraToast(`${dati.importati} vini importati con successo.`, 'successo');
    } catch (err) {
      mostraToast('Errore durante l\'importazione: ' + err.message, 'errore');
    }
  };
  reader.readAsText(file);
}

async function scaricaBackup() {
  const a = document.createElement('a');
  a.href = '/api/admin/backup';
  a.setAttribute('x-auth-token', authToken);
  // Usa fetch per passare il token, poi crea un blob scaricabile
  try {
    const res = await apiFetch('/api/admin/backup');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const data = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `vini-backup-${data}.json`;
    link.click();
    URL.revokeObjectURL(url);
  } catch {
    mostraToast('Errore durante il backup.', 'errore');
  }
}

// ── Stampa carta ──────────────────────────────────────────────────────────────

function apriDialogoStampa() {
  if (tuttiVini.length === 0) { mostraToast('Nessuna bevanda da stampare.', 'errore'); return; }
  document.getElementById('overlay-stampa').classList.add('aperta');
  document.getElementById('dialogo-stampa').classList.add('aperto');
}

function chiudiDialogoStampa() {
  document.getElementById('overlay-stampa').classList.remove('aperta');
  document.getElementById('dialogo-stampa').classList.remove('aperto');
}

function toggleViniModo() {
  const chk = document.getElementById('chk-vini');
  document.getElementById('submenu-vini').style.display = chk.checked ? '' : 'none';
}

async function eseguiStampa() {
  const includiVini = document.getElementById('chk-vini').checked;
  const includiBirre = document.getElementById('chk-birre').checked;
  const includiDistillati = document.getElementById('chk-distillati').checked;
  const viniModo = document.querySelector('input[name="vini-modo"]:checked')?.value || 'bottiglie';

  if (!includiVini && !includiBirre && !includiDistillati) {
    mostraToast('Seleziona almeno una categoria.', 'errore');
    return;
  }

  chiudiDialogoStampa();
  await _apriStampa({ includiVini, includiBirre, includiDistillati, viniModo });
}

async function _apriStampa({ includiVini, includiBirre, includiDistillati, viniModo }) {
  const disponibili = tuttiVini.filter(v => !v.terminato);

  let nomeRistorante = 'Carta';
  try {
    const r = await fetch('/api/config-pubblica');
    const cfg = await r.json();
    if (cfg.nome_ristorante) nomeRistorante = cfg.nome_ristorante;
  } catch {}

  const ORDINE_VINI = ['Bollicine', 'Bianco', 'Rosso', 'Rosato', 'Dolce', 'Orange', 'Fortificato'];
  const LABEL_VINI = { Bollicine:'Bollicine & Spumanti', Bianco:'Vini Bianchi', Rosso:'Vini Rossi', Rosato:'Vini Rosati', Dolce:'Vini Dolci', Orange:'Orange Wine', Fortificato:'Vini Fortificati' };

  // CSS comune
  const cssComune = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Montserrat', sans-serif; font-size: 9pt; color: #1a1210; background: #fff; line-height: 1.5; }
.intestazione { text-align: center; padding-bottom: 14px; margin-bottom: 20px; border-bottom: 2px solid #7a1828; }
.int-nome { font-family: 'Cormorant Garamond', serif; font-size: 30pt; font-weight: 300; color: #7a1828; letter-spacing: 4px; line-height: 1.1; }
.int-carta { font-size: 7.5pt; font-weight: 500; letter-spacing: 5px; text-transform: uppercase; color: #9b8f84; margin-top: 4px; }
.int-data { font-size: 7pt; color: #c0b0a5; margin-top: 5px; }
.macro-sezione { margin-bottom: 28px; }
.macro-sezione-titolo { font-family: 'Cormorant Garamond', serif; font-size: 18pt; font-weight: 300; color: #7a1828; letter-spacing: 6px; text-transform: uppercase; text-align: center; margin-bottom: 16px; padding: 10px 0; border-top: 2px solid #7a1828; border-bottom: 1px solid #e8d5a3; break-before: page; }
.macro-sezione:first-child .macro-sezione-titolo { break-before: auto; }
.sezione { margin-bottom: 16px; break-inside: avoid-page; }
.sezione-titolo { font-family: 'Cormorant Garamond', serif; font-size: 13pt; font-weight: 600; color: #7a1828; letter-spacing: 3px; text-transform: uppercase; display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.sezione-titolo span { white-space: nowrap; }
.sezione-titolo::after { content: ''; display: block; flex: 1; height: 1px; background: #e8d5a3; }
.distilleria-titolo { font-size: 9pt; font-weight: 600; color: #5a4535; text-transform: uppercase; letter-spacing: 1px; margin: 8px 0 4px; padding-left: 4px; border-left: 2px solid #e8d5a3; }
.vino { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; padding: 6px 0; border-bottom: 1px dotted #e8d5a3; break-inside: avoid; }
.vino:last-child { border-bottom: none; }
.vino-info { flex: 1; min-width: 0; }
.vino-header { display: flex; align-items: baseline; flex-wrap: wrap; gap: 5px; margin-bottom: 1px; }
.vino-cantina { font-size: 7.5pt; font-weight: 500; color: #7a6a5f; text-transform: uppercase; letter-spacing: 0.5px; }
.sep { color: #c0b0a5; font-size: 7pt; }
.vino-nome { font-family: 'Cormorant Garamond', serif; font-size: 12.5pt; font-weight: 600; color: #1a1210; }
.vino-annata { font-size: 8pt; font-weight: 300; color: #9b8f84; }
.vino-meta { font-size: 7.5pt; color: #9b8f84; font-style: italic; margin-top: 1px; }
.vino-uve { color: #7a6a5f; font-style: normal; }
.vino-descr { font-size: 7.5pt; color: #6b6158; font-style: italic; line-height: 1.55; margin-top: 3px; }
.vino-prezzi { text-align: right; flex-shrink: 0; min-width: 88px; }
.pr-riga { display: flex; justify-content: flex-end; align-items: baseline; gap: 5px; line-height: 1.7; }
.pr-riga span { font-size: 6.5pt; font-weight: 300; color: #b0a59a; text-transform: uppercase; letter-spacing: 0.5px; }
.pr-riga strong { font-size: 9pt; font-weight: 600; color: #1a1210; }
.su-richiesta { font-size: 7pt; color: #c0b0a5; font-style: italic; }
@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none !important; } }
@media screen {
  .barra-stampa { position: sticky; top: 0; z-index: 10; background: #fff; border-bottom: 1px solid #e8d5a3; padding: 10px 20px; display: flex; justify-content: flex-end; }
  .btn-print { background: #7a1828; color: #fff; border: none; padding: 8px 20px; border-radius: 6px; font-family: 'Montserrat', sans-serif; font-size: 0.8rem; font-weight: 500; cursor: pointer; }
  .btn-print:hover { background: #5e1220; }
  body { padding-bottom: 40px; }
  .contenuto { max-width: 780px; margin: 0 auto; padding: 20px; }
}`;

  function voceHTML(v, mostraCantina = true) {
    const pBot = v.prezzo_bottiglia ? `<div class="pr-riga"><span>Bottiglia</span><strong>€ ${parseFloat(v.prezzo_bottiglia).toFixed(2)}</strong></div>` : '';
    const pCal = v.prezzo_mescita   ? `<div class="pr-riga"><span>Calice</span><strong>€ ${parseFloat(v.prezzo_mescita).toFixed(2)}</strong></div>` : '';
    const prezzi = pBot || pCal ? `${pBot}${pCal}` : '<span class="su-richiesta">Su richiesta</span>';
    return `<div class="vino">
  <div class="vino-info">
    <div class="vino-header">
      ${mostraCantina && v.cantina ? `<span class="vino-cantina">${v.cantina}</span><span class="sep">·</span>` : ''}
      <span class="vino-nome">${v.nome || '—'}</span>
      ${v.annata && (v.categoria || 'Vino') !== 'Birra' ? `<span class="vino-annata">${v.annata}</span>` : ''}
    </div>
    ${(v.regione || v.nazione) ? `<div class="vino-meta">${[v.regione, v.nazione].filter(Boolean).join(' · ')}</div>` : ''}
    ${v.uve ? `<div class="vino-meta vino-uve">${v.uve}</div>` : ''}
    ${v.descrizione ? `<div class="vino-descr">${v.descrizione}</div>` : ''}
  </div>
  <div class="vino-prezzi">${prezzi}</div>
</div>`;
  }

  function sezionePerTipoHTML(voci, labelMap, ordine) {
    const gruppi = {};
    voci.forEach(v => { const t = v.tipo || 'Altro'; if (!gruppi[t]) gruppi[t] = []; gruppi[t].push(v); });
    const tipi = ordine ? [...ordine.filter(t => gruppi[t]), ...Object.keys(gruppi).filter(t => !ordine.includes(t))] : Object.keys(gruppi).sort();
    return tipi.map(tipo => `
      <div class="sezione">
        <h2 class="sezione-titolo"><span>${labelMap?.[tipo] || tipo}</span></h2>
        ${gruppi[tipo].map(v => voceHTML(v)).join('')}
      </div>`).join('');
  }

  function distillatiHTML(voci) {
    // Raggruppa per tipo, poi per distilleria
    const perTipo = {};
    voci.forEach(v => { const t = v.tipo || 'Altro'; if (!perTipo[t]) perTipo[t] = {}; const d = v.cantina || 'Altra distilleria'; if (!perTipo[t][d]) perTipo[t][d] = []; perTipo[t][d].push(v); });
    return Object.keys(perTipo).sort().map(tipo => `
      <div class="sezione">
        <h2 class="sezione-titolo"><span>${tipo}</span></h2>
        ${Object.keys(perTipo[tipo]).sort().map(dist => `
          <div class="distilleria-titolo">${dist}</div>
          ${perTipo[tipo][dist].sort((a,b) => (a.nome||'').localeCompare(b.nome||'')).map(v => voceHTML(v, false)).join('')}
        `).join('')}
      </div>`).join('');
  }

  // Costruisci le sezioni
  let sezioniHtml = '';
  const data = new Date().toLocaleDateString('it-IT', { year: 'numeric', month: 'long' });
  let titoloDoc = [];

  if (includiVini) {
    let viniF = disponibili.filter(v => (v.categoria || 'Vino') === 'Vino');
    if (viniModo === 'calice') viniF = viniF.filter(v => v.prezzo_mescita);
    else viniF = viniF.filter(v => v.prezzo_bottiglia || !v.prezzo_mescita);
    if (viniF.length) {
      const titolo = viniModo === 'calice' ? 'Vini al Calice' : 'Carta dei Vini';
      titoloDoc.push(titolo);
      sezioniHtml += `<div class="macro-sezione"><div class="macro-sezione-titolo">${titolo}</div>${sezionePerTipoHTML(viniF, LABEL_VINI, ORDINE_VINI)}</div>`;
    }
  }

  if (includiBirre) {
    const birre = disponibili.filter(v => (v.categoria || 'Vino') === 'Birra');
    if (birre.length) {
      titoloDoc.push('Birre');
      sezioniHtml += `<div class="macro-sezione"><div class="macro-sezione-titolo">Birre</div>${sezionePerTipoHTML(birre, {}, null)}</div>`;
    }
  }

  if (includiDistillati) {
    const dist = disponibili.filter(v => (v.categoria || 'Vino') === 'Distillato');
    if (dist.length) {
      titoloDoc.push('Distillati');
      sezioniHtml += `<div class="macro-sezione"><div class="macro-sezione-titolo">Distillati</div>${distillatiHTML(dist)}</div>`;
    }
  }

  if (!sezioniHtml) { mostraToast('Nessuna bevanda disponibile per le categorie selezionate.', 'errore'); return; }

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<title>${nomeRistorante} — ${titoloDoc.join(' + ')}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Montserrat:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
@page { size: A4; margin: 18mm 20mm 20mm; @bottom-center { content: counter(page) " / " counter(pages); font-family: 'Montserrat', sans-serif; font-size: 7pt; color: #b0a59a; } }
${cssComune}
</style>
</head>
<body>
<div class="barra-stampa no-print">
  <button class="btn-print" onclick="window.print()">&#128424; Stampa / Salva PDF</button>
</div>
<div class="contenuto">
  <header class="intestazione">
    <div class="int-nome">${nomeRistorante}</div>
    <div class="int-carta">${titoloDoc.join(' · ')}</div>
    <div class="int-data">${data}</div>
  </header>
  ${sezioniHtml}
</div>
<script>document.fonts.ready.then(() => { if(new URLSearchParams(location.search).get('auto')==='1') window.print(); });<\/script>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (!w) { mostraToast('Abilita i popup per questa pagina e riprova.', 'errore'); return; }
  w.document.write(html);
  w.document.close();
}

// ── Importa da TXT ────────────────────────────────────────────────────────────

function importaDaTxt(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';

  const reader = new FileReader();
  reader.onload = async (e) => {
    // Divide per righe, rimuove vuote e righe che iniziano con # (commenti)
    const righe = e.target.result
      .split('\n')
      .map(r => r.trim())
      .filter(r => r && !r.startsWith('#'));

    if (righe.length === 0) {
      mostraToast('Il file è vuoto o non contiene vini.', 'errore');
      return;
    }

    // Apri modale di progresso
    const logEl      = document.getElementById('importa-txt-log');
    const barraEl    = document.getElementById('importa-txt-barra');
    const contatoreEl = document.getElementById('importa-txt-contatore');
    const titoloEl   = document.getElementById('importa-txt-titolo');
    const footerEl   = document.getElementById('importa-txt-footer');

    logEl.innerHTML = '';
    barraEl.style.width = '0%';
    contatoreEl.textContent = `0 / ${righe.length}`;
    titoloEl.textContent = 'Importazione in corso...';
    footerEl.style.display = 'none';

    document.getElementById('overlay-importa-txt').classList.add('aperta');
    document.getElementById('dialogo-importa-txt').classList.add('aperto');

    let ok = 0, errori = 0;

    for (let i = 0; i < righe.length; i++) {
      const riga = righe[i];
      const voce = document.createElement('div');
      voce.className = 'importa-riga in-corso';
      voce.innerHTML = `<span class="importa-riga-testo">${riga}</span><span class="importa-riga-stato">&#8987; analisi...</span>`;
      logEl.appendChild(voce);
      logEl.scrollTop = logEl.scrollHeight;

      try {
        // 1. Genera dati con AI
        const resAi = await apiFetch('/api/admin/genera-descrizione', {
          method: 'POST',
          body: JSON.stringify({ testo: riga })
        });
        const dati = await resAi.json();
        if (!resAi.ok) throw new Error(dati.errore || 'Errore AI');
        if (!dati.nome) throw new Error('Nome non rilevato');

        // 2. Salva nel catalogo
        const resVino = await apiFetch('/api/admin/vini', {
          method: 'POST',
          body: JSON.stringify({
            nome:             dati.nome             || '',
            cantina:          dati.cantina          || '',
            tipo:             dati.tipo             || '',
            annata:           dati.annata           || '',
            uve:              dati.uve              || '',
            descrizione:      dati.descrizione      || '',
            nazione:          dati.nazione          || '',
            regione:          dati.regione          || '',
            categoria:        dati.categoria        || 'Vino',
            prezzo_bottiglia: null,
            prezzo_mescita:   null,
          })
        });
        if (!resVino.ok) throw new Error('Errore salvataggio');

        ok++;
        voce.className = 'importa-riga ok';
        voce.querySelector('.importa-riga-stato').innerHTML = '&#10003; ' + (dati.cantina ? dati.cantina + ' — ' : '') + dati.nome;
      } catch (err) {
        errori++;
        voce.className = 'importa-riga ko';
        voce.querySelector('.importa-riga-stato').innerHTML = '&#10007; ' + (err.message || 'errore');
      }

      contatoreEl.textContent = `${i + 1} / ${righe.length}`;
      barraEl.style.width = `${Math.round(((i + 1) / righe.length) * 100)}%`;
    }

    // Fine
    titoloEl.textContent = errori === 0
      ? `Importazione completata — ${ok} vini aggiunti`
      : `Completata con errori — ${ok} aggiunti, ${errori} falliti`;
    footerEl.style.display = '';

    await caricaVini();
  };
  reader.readAsText(file);
}

function chiudiImportaTxt() {
  document.getElementById('overlay-importa-txt').classList.remove('aperta');
  document.getElementById('dialogo-importa-txt').classList.remove('aperto');
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function mostraToast(messaggio, tipo = '') {
  const toast = document.createElement('div');
  toast.className = `toast ${tipo}`;
  toast.textContent = messaggio;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visibile'));
  setTimeout(() => { toast.classList.remove('visibile'); setTimeout(() => toast.remove(), 300); }, 3500);
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { chiudiForm(); annullaElimina(); chiudiDialogoStampa(); }
});
