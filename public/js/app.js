let tuttiVini = [];
let filtroTipo    = 'tutti';
let filtroNazione = 'tutti';
let testoCerca    = '';
let vistaCorrente = 'griglia';

// ── Avvio ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  await caricaConfigPubblica();
  await caricaVini();
  document.getElementById('ricerca').addEventListener('input', e => {
    testoCerca = e.target.value.toLowerCase();
    renderCatalogo();
  });
});

async function caricaConfigPubblica() {
  try {
    const res = await fetch('/api/config-pubblica');
    const cfg = await res.json();
    if (cfg.nome_ristorante) document.title = cfg.nome_ristorante + ' — Carta dei Vini';
  } catch {}
}

async function caricaVini() {
  try {
    const res = await fetch('/api/vini');
    tuttiVini = await res.json();
    costruisciFiltriNazioni();
    renderCatalogo();
  } catch {
    document.getElementById('catalogo').innerHTML =
      '<div class="vuoto"><p>Impossibile caricare la carta dei vini.</p></div>';
  }
}

// ── Filtri ────────────────────────────────────────────────────────────────────

function costruisciFiltriNazioni() {
  const nazioni = [...new Set(tuttiVini.map(v => v.nazione).filter(Boolean))].sort();
  const c = document.getElementById('filtri-nazioni');
  c.innerHTML = nazioni.map(n =>
    `<button class="filtro-btn" data-filtro-nazione="${n}" onclick="setFiltroNazione('${n}', this)">${n}</button>`
  ).join('');
}

function setFiltroTipo(valore, el) {
  filtroTipo = valore;
  document.querySelectorAll('[data-filtro-tipo]').forEach(b => b.classList.remove('attivo'));
  el.classList.add('attivo');
  renderCatalogo();
}

function setFiltroNazione(valore, el) {
  if (filtroNazione === valore) {
    filtroNazione = 'tutti';
    el.classList.remove('attivo');
  } else {
    filtroNazione = valore;
    document.querySelectorAll('[data-filtro-nazione]').forEach(b => b.classList.remove('attivo'));
    el.classList.add('attivo');
  }
  renderCatalogo();
}

// ── Vista griglia / lista ─────────────────────────────────────────────────────

function setVista(vista) {
  vistaCorrente = vista;
  const catalogo = document.getElementById('catalogo');
  catalogo.className = vista === 'griglia' ? 'vista-griglia' : 'vista-lista';
  document.getElementById('btn-griglia').classList.toggle('attivo', vista === 'griglia');
  document.getElementById('btn-lista').classList.toggle('attivo', vista === 'lista');
  renderCatalogo();
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderCatalogo() {
  const contenitore = document.getElementById('catalogo');
  let vini = tuttiVini;

  if (filtroTipo !== 'tutti')
    vini = vini.filter(v => (v.tipo || '').toLowerCase() === filtroTipo);
  if (filtroNazione !== 'tutti')
    vini = vini.filter(v => v.nazione === filtroNazione);
  if (testoCerca)
    vini = vini.filter(v =>
      (v.nome || '').toLowerCase().includes(testoCerca) ||
      (v.cantina || '').toLowerCase().includes(testoCerca) ||
      (v.uve || '').toLowerCase().includes(testoCerca) ||
      (v.regione || '').toLowerCase().includes(testoCerca)
    );

  if (vini.length === 0) {
    contenitore.innerHTML = '<div class="vuoto"><p>Nessun vino trovato.</p></div>';
    return;
  }

  contenitore.innerHTML = vini.map(v => cardVino(v)).join('');
}

function badgeTipo(tipo) {
  if (!tipo) return '';
  const t = tipo.toLowerCase();
  return `<span class="badge-tipo ${t}">${tipo}</span>`;
}

function cardVino(v) {
  const prezzoBottiglia = v.prezzo_bottiglia ? `€ ${parseFloat(v.prezzo_bottiglia).toFixed(2)}` : null;
  const prezzoMescita   = v.prezzo_mescita   ? `€ ${parseFloat(v.prezzo_mescita).toFixed(2)}`   : null;

  const tags = [
    v.annata ? `<span class="tag annata">${v.annata}</span>` : '',
    v.regione ? `<span class="tag">${v.regione}</span>` : '',
  ].filter(Boolean).join('');

  const fotoHtml = v.foto_url
    ? `<img class="card-foto" src="${v.foto_url}" alt="${v.nome}" loading="lazy" onerror="this.style.display='none'">`
    : '';

  return `
    <article class="card-vino" onclick="apriModale('${v.id}')">
      ${fotoHtml}
      <div class="card-corpo">
        <div class="card-header">
          <div>
            ${v.cantina ? `<div class="card-cantina">${v.cantina}</div>` : ''}
            <h2 class="card-nome">${v.nome || 'Vino senza nome'}</h2>
          </div>
          ${badgeTipo(v.tipo)}
        </div>
        <div class="card-meta">${tags}</div>
        ${v.descrizione ? `<p class="card-descrizione">${v.descrizione}</p>` : ''}
        <div class="card-prezzi">
          ${prezzoBottiglia ? `<div class="prezzo-item"><span class="prezzo-label">Bottiglia</span><span class="prezzo-valore">${prezzoBottiglia}</span></div>` : ''}
          ${prezzoMescita   ? `<div class="prezzo-item"><span class="prezzo-label">Al calice</span><span class="prezzo-valore">${prezzoMescita}</span></div>` : ''}
          ${!prezzoBottiglia && !prezzoMescita ? `<div class="prezzo-item"><span class="prezzo-valore non-disponibile">Prezzo su richiesta</span></div>` : ''}
        </div>
      </div>
    </article>`;
}

// ── Modale dettaglio ──────────────────────────────────────────────────────────

function apriModale(id) {
  const v = tuttiVini.find(x => x.id === id);
  if (!v) return;

  const tags = [
    v.annata  ? `<span class="tag annata">Annata ${v.annata}</span>` : '',
    v.regione ? `<span class="tag">${v.regione}</span>` : '',
    v.nazione ? `<span class="tag">${v.nazione}</span>` : '',
  ].filter(Boolean).join('');

  const pBottiglia = v.prezzo_bottiglia ? `<div class="modale-prezzo-item"><span class="modale-prezzo-label">Bottiglia</span><span class="modale-prezzo-valore">€ ${parseFloat(v.prezzo_bottiglia).toFixed(2)}</span></div>` : '';
  const pMescita   = v.prezzo_mescita   ? `<div class="modale-prezzo-item"><span class="modale-prezzo-label">Al calice</span><span class="modale-prezzo-valore">€ ${parseFloat(v.prezzo_mescita).toFixed(2)}</span></div>` : '';

  document.getElementById('modale-contenuto').innerHTML = `
    ${v.foto_url ? `<img class="modale-foto" src="${v.foto_url}" alt="${v.nome}" onerror="this.style.display='none'">` : ''}
    ${v.cantina ? `<div class="modale-cantina">${v.cantina}</div>` : ''}
    <h2 class="modale-nome">${v.nome || 'Vino senza nome'}</h2>
    <div class="modale-tags">${badgeTipo(v.tipo)}${tags}</div>

    ${v.descrizione ? `<div class="modale-sezione"><div class="modale-sezione-titolo">Note di degustazione</div><p class="modale-descrizione">${v.descrizione}</p></div>` : ''}
    ${v.uve ? `<div class="modale-sezione"><div class="modale-sezione-titolo">Vitigni</div><p class="modale-uve">${v.uve}</p></div>` : ''}
    ${(v.nazione || v.regione) ? `<div class="modale-sezione"><div class="modale-sezione-titolo">Origine</div><p class="modale-origine">${[v.regione, v.nazione].filter(Boolean).join(' · ')}</p></div>` : ''}

    ${(pBottiglia || pMescita) ? `<div class="modale-prezzi">${pBottiglia}${pMescita}</div>` : ''}
  `;

  document.getElementById('overlay').classList.add('aperta');
  document.getElementById('modale').classList.add('aperta');
  document.body.style.overflow = 'hidden';
}

function chiudiModale() {
  document.getElementById('overlay').classList.remove('aperta');
  document.getElementById('modale').classList.remove('aperta');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') chiudiModale(); });
