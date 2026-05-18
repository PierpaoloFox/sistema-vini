let authToken = sessionStorage.getItem('vini_token') || null;
let tuttiVini = [];
let idDaEliminare = null;

document.addEventListener('DOMContentLoaded', () => {
  if (authToken) mostraApp();

  // Anteprima foto quando si incolla l'URL
  document.getElementById('f-foto-url').addEventListener('input', e => {
    aggiornaAnteprimaFoto(e.target.value);
  });
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

function mostraApp() {
  document.getElementById('schermata-login').classList.add('nascosto');
  document.getElementById('app').classList.remove('nascosto');
  caricaVini();
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
    return `
    <tr>
      <td>${tipoHtml}</td>
      <td class="td-cantina">${v.cantina || '—'}</td>
      <td class="td-nome">${v.nome}</td>
      <td>${v.nazione || '—'}</td>
      <td>${v.regione || '—'}</td>
      <td>${v.annata || '—'}</td>
      <td class="td-prezzo">${v.prezzo_bottiglia ? '€ ' + parseFloat(v.prezzo_bottiglia).toFixed(2) : '—'}</td>
      <td class="td-prezzo">${v.prezzo_mescita   ? '€ ' + parseFloat(v.prezzo_mescita).toFixed(2)   : '—'}</td>
      <td>
        <div class="azioni-cella">
          <button class="btn btn-outline btn-sm" onclick="apriFormModifica('${v.id}')">Modifica</button>
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
  document.getElementById('stato-foto').textContent = '';
  nascondiAnteprimaFoto();
  apriPannello();
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
  document.getElementById('f-foto-url').value        = v.foto_url || '';
  document.getElementById('stato-ia').textContent    = '';
  document.getElementById('stato-foto').textContent  = '';
  aggiornaAnteprimaFoto(v.foto_url || '');
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
    foto_url:         document.getElementById('f-foto-url').value.trim(),
  };

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

// ── Genera con AI (descrizione + nazione + regione) ───────────────────────────

async function generaDescrizione() {
  const nome = document.getElementById('f-nome').value.trim();
  if (!nome) { mostraToast('Inserisci almeno il nome del vino.', 'errore'); return; }

  const btn = document.getElementById('btn-genera');
  const statoEl = document.getElementById('stato-ia');
  btn.disabled = true;
  btn.textContent = '✦ Generazione...';
  statoEl.textContent = 'Claude sta analizzando il vino...';

  try {
    const res = await apiFetch('/api/admin/genera-descrizione', {
      method: 'POST',
      body: JSON.stringify({
        nome,
        cantina: document.getElementById('f-cantina').value.trim(),
        tipo:    document.getElementById('f-tipo').value,
        annata:  document.getElementById('f-annata').value.trim(),
        uve:     document.getElementById('f-uve').value.trim(),
      })
    });
    const dati = await res.json();
    if (!res.ok) throw new Error(dati.errore || 'Errore AI');

    if (dati.descrizione) document.getElementById('f-descrizione').value = dati.descrizione;
    if (dati.nazione)     document.getElementById('f-nazione').value     = dati.nazione;
    if (dati.regione)     document.getElementById('f-regione').value     = dati.regione;

    statoEl.textContent = 'Descrizione, nazione e regione generate da Claude AI.';
  } catch (err) {
    statoEl.textContent = '';
    mostraToast(err.message, 'errore');
  } finally {
    btn.disabled = false;
    btn.textContent = '✦ Genera con AI (descrizione + origine)';
  }
}

// ── Cerca immagine bottiglia ──────────────────────────────────────────────────

async function cercaImmagine() {
  const nome    = document.getElementById('f-nome').value.trim();
  const cantina = document.getElementById('f-cantina').value.trim();
  if (!nome && !cantina) { mostraToast('Inserisci almeno nome o cantina prima di cercare.', 'errore'); return; }

  const btn = document.getElementById('btn-cerca-foto');
  const statoEl = document.getElementById('stato-foto');
  btn.disabled = true;
  btn.textContent = 'Ricerca...';
  statoEl.textContent = 'Ricerca immagine in corso...';

  try {
    const res = await apiFetch('/api/admin/cerca-immagine', {
      method: 'POST',
      body: JSON.stringify({ nome, cantina })
    });
    const dati = await res.json();

    if (dati.foto_url) {
      document.getElementById('f-foto-url').value = dati.foto_url;
      aggiornaAnteprimaFoto(dati.foto_url);
      statoEl.textContent = `Immagine trovata (fonte: ${dati.fonte || 'web'}).`;
    } else {
      statoEl.textContent = 'Nessuna immagine trovata. Puoi incollare un URL manualmente.';
    }
  } catch {
    statoEl.textContent = 'Errore durante la ricerca.';
  } finally {
    btn.disabled = false;
    btn.textContent = '📷 Cerca online';
  }
}

function aggiornaAnteprimaFoto(url) {
  const wrap = document.getElementById('foto-preview-wrap');
  const img  = document.getElementById('foto-preview');
  if (url) {
    img.src = url;
    wrap.classList.remove('nascosto');
  } else {
    nascondiAnteprimaFoto();
  }
}

function nascondiAnteprimaFoto() {
  document.getElementById('foto-preview-wrap').classList.add('nascosto');
  document.getElementById('foto-preview').src = '';
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
  if (e.key === 'Escape') { chiudiForm(); annullaElimina(); }
});
