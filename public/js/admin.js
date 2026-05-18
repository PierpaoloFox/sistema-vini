let authToken = sessionStorage.getItem('vini_token') || null;
let tuttiVini = [];
let idDaEliminare = null;

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
  // Modalità nuovo: mostra il campo testo libero
  document.getElementById('campo-testo-libero').style.display = '';
  document.getElementById('f-testo-libero').value = '';
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
  if (e.key === 'Escape') { chiudiForm(); annullaElimina(); }
});
