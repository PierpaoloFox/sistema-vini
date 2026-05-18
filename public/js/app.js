let tuttiVini = [];
let filtroNazione = 'tutti';
let testoCerca    = '';
let vistaCorrente = 'lista';
let categoriaCorrente = 'Vino';

const ORDINE_VINI = ['Bollicine', 'Bianco', 'Rosso', 'Rosato', 'Dolce', 'Orange', 'Fortificato'];

// ── Avvio ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('btn-lista').classList.add('attivo');
  document.getElementById('btn-griglia').classList.remove('attivo');
  document.getElementById('catalogo').className = 'vista-lista';
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
    if (cfg.nome_ristorante) document.title = cfg.nome_ristorante + ' — Carta';
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
      '<div class="vuoto"><p>Impossibile caricare la carta.</p></div>';
  }
}

// ── Categoria ─────────────────────────────────────────────────────────────────

function setCategoria(cat, el) {
  categoriaCorrente = cat;
  filtroNazione = 'tutti';
  testoCerca = '';
  document.getElementById('ricerca').value = '';
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('attivo'));
  el.classList.add('attivo');
  costruisciFiltriNazioni();
  renderCatalogo();
}

// ── Ordinamento ───────────────────────────────────────────────────────────────

function ordinaVoci(voci) {
  if (categoriaCorrente === 'Vino') {
    return [...voci].sort((a, b) => {
      const iA = ORDINE_VINI.indexOf(a.tipo || '');
      const iB = ORDINE_VINI.indexOf(b.tipo || '');
      const ordA = iA === -1 ? 999 : iA;
      const ordB = iB === -1 ? 999 : iB;
      if (ordA !== ordB) return ordA - ordB;
      return (a.nome || '').localeCompare(b.nome || '', 'it');
    });
  }
  // Birra e Distillato: ordine per tipo poi nome
  return [...voci].sort((a, b) => {
    const tA = a.tipo || 'Altro';
    const tB = b.tipo || 'Altro';
    if (tA !== tB) return tA.localeCompare(tB, 'it');
    return (a.nome || '').localeCompare(b.nome || '', 'it');
  });
}

// ── Filtri ────────────────────────────────────────────────────────────────────

function costruisciFiltriNazioni() {
  const vociCat = tuttiVini.filter(v => (v.categoria || 'Vino') === categoriaCorrente);
  const nazioni = [...new Set(vociCat.map(v => v.nazione).filter(Boolean))].sort();
  document.getElementById('filtri-nazioni').innerHTML = nazioni.map(n =>
    `<button class="filtro-btn" data-filtro-nazione="${n}" onclick="setFiltroNazione('${n}', this)">${n}</button>`
  ).join('');
}

function resetFiltroNazione(el) {
  filtroNazione = 'tutti';
  document.querySelectorAll('[data-filtro-nazione]').forEach(b => b.classList.remove('attivo'));
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

// ── Vista ─────────────────────────────────────────────────────────────────────

function setVista(vista) {
  vistaCorrente = vista;
  document.getElementById('catalogo').className = vista === 'griglia' ? 'vista-griglia' : 'vista-lista';
  document.getElementById('btn-griglia').classList.toggle('attivo', vista === 'griglia');
  document.getElementById('btn-lista').classList.toggle('attivo', vista === 'lista');
  renderCatalogo();
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderCatalogo() {
  const contenitore = document.getElementById('catalogo');
  let voci = tuttiVini.filter(v => (v.categoria || 'Vino') === categoriaCorrente);

  if (filtroNazione !== 'tutti') voci = voci.filter(v => v.nazione === filtroNazione);
  if (testoCerca) voci = voci.filter(v =>
    (v.nome || '').toLowerCase().includes(testoCerca) ||
    (v.cantina || '').toLowerCase().includes(testoCerca) ||
    (v.uve || '').toLowerCase().includes(testoCerca) ||
    (v.regione || '').toLowerCase().includes(testoCerca)
  );

  if (voci.length === 0) {
    contenitore.innerHTML = '<div class="vuoto"><p>Nessuna voce trovata.</p></div>';
    return;
  }

  voci = ordinaVoci(voci);

  if (vistaCorrente === 'lista') {
    contenitore.innerHTML = renderLista(voci);
  } else {
    contenitore.innerHTML = voci.map(v => cardVino(v)).join('');
  }
}

function renderLista(voci) {
  const gruppi = {};
  voci.forEach(v => {
    const tipo = v.tipo || 'Altro';
    if (!gruppi[tipo]) gruppi[tipo] = [];
    gruppi[tipo].push(v);
  });

  let tipiPresenti;
  if (categoriaCorrente === 'Vino') {
    tipiPresenti = [
      ...ORDINE_VINI.filter(t => gruppi[t]),
      ...Object.keys(gruppi).filter(t => !ORDINE_VINI.includes(t))
    ];
  } else {
    tipiPresenti = Object.keys(gruppi).sort();
  }

  return tipiPresenti.map(tipo => `
    <div class="sezione-tipo">
      <div class="sezione-tipo-header">
        <span class="sezione-tipo-badge ${tipo.toLowerCase().replace(/\s+/g,'-')}">${tipo}</span>
      </div>
      ${gruppi[tipo].map(v => cardVino(v)).join('')}
    </div>
  `).join('');
}

// ── Card ─────────────────────────────────────────────────────────────────────

function labelCantina(v) {
  const cat = v.categoria || 'Vino';
  if (cat === 'Birra') return 'Birrificio';
  if (cat === 'Distillato') return 'Distilleria';
  return null; // non mostrare label per i vini (è implicito)
}

function labelUve(v) {
  const cat = v.categoria || 'Vino';
  if (cat === 'Birra') return 'Malti e luppoli';
  if (cat === 'Distillato') return 'Base / Botaniche';
  return 'Vitigni';
}

function badgeTipo(tipo, categoria) {
  if (!tipo) return '';
  const cls = tipo.toLowerCase().replace(/\s+/g,'-');
  return `<span class="badge-tipo ${cls}">${tipo}</span>`;
}

function cardVino(v) {
  const prezzoBottiglia = v.prezzo_bottiglia ? `€ ${parseFloat(v.prezzo_bottiglia).toFixed(2)}` : null;
  const prezzoMescita   = v.prezzo_mescita   ? `€ ${parseFloat(v.prezzo_mescita).toFixed(2)}`   : null;
  const cat = v.categoria || 'Vino';

  const tags = [
    v.annata  && cat !== 'Birra' ? `<span class="tag annata">${v.annata}</span>` : '',
    v.regione ? `<span class="tag">${v.regione}</span>` : '',
  ].filter(Boolean).join('');

  const labelBot = cat === 'Vino' ? 'Bottiglia' : 'Bottiglia';
  const labelCal = cat === 'Vino' ? 'Al calice' : 'Al calice';

  return `
    <article class="card-vino" onclick="apriModale('${v.id}')">
      <div class="card-corpo">
        <div class="card-header">
          <div>
            ${v.cantina ? `<div class="card-cantina">${v.cantina}</div>` : ''}
            <h2 class="card-nome">${v.nome || 'Senza nome'}</h2>
          </div>
          ${vistaCorrente === 'griglia' ? badgeTipo(v.tipo, cat) : ''}
        </div>
        <div class="card-meta">${tags}</div>
        ${v.descrizione ? `<p class="card-descrizione">${v.descrizione}</p>` : ''}
        <div class="card-prezzi">
          ${prezzoBottiglia ? `<div class="prezzo-item"><span class="prezzo-label">${labelBot}</span><span class="prezzo-valore">${prezzoBottiglia}</span></div>` : ''}
          ${prezzoMescita   ? `<div class="prezzo-item"><span class="prezzo-label">${labelCal}</span><span class="prezzo-valore">${prezzoMescita}</span></div>`   : ''}
          ${!prezzoBottiglia && !prezzoMescita ? `<div class="prezzo-item"><span class="prezzo-valore non-disponibile">Prezzo su richiesta</span></div>` : ''}
        </div>
      </div>
    </article>`;
}

// ── Modale ────────────────────────────────────────────────────────────────────

function apriModale(id) {
  const v = tuttiVini.find(x => x.id === id);
  if (!v) return;
  const cat = v.categoria || 'Vino';

  const tags = [
    v.annata  && cat !== 'Birra' ? `<span class="tag annata">Annata ${v.annata}</span>` : '',
    v.regione ? `<span class="tag">${v.regione}</span>` : '',
    v.nazione ? `<span class="tag">${v.nazione}</span>` : '',
  ].filter(Boolean).join('');

  const pBottiglia = v.prezzo_bottiglia ? `<div class="modale-prezzo-item"><span class="modale-prezzo-label">Bottiglia</span><span class="modale-prezzo-valore">€ ${parseFloat(v.prezzo_bottiglia).toFixed(2)}</span></div>` : '';
  const pMescita   = v.prezzo_mescita   ? `<div class="modale-prezzo-item"><span class="modale-prezzo-label">Al calice</span><span class="modale-prezzo-valore">€ ${parseFloat(v.prezzo_mescita).toFixed(2)}</span></div>`   : '';

  const uveLbl = labelUve(v);

  document.getElementById('modale-contenuto').innerHTML = `
    ${v.cantina ? `<div class="modale-cantina">${v.cantina}</div>` : ''}
    <h2 class="modale-nome">${v.nome || 'Senza nome'}</h2>
    <div class="modale-tags">${badgeTipo(v.tipo, cat)}${tags}</div>
    ${v.descrizione ? `<div class="modale-sezione"><div class="modale-sezione-titolo">Note di degustazione</div><p class="modale-descrizione">${v.descrizione}</p></div>` : ''}
    ${v.uve ? `<div class="modale-sezione"><div class="modale-sezione-titolo">${uveLbl}</div><p class="modale-uve">${v.uve}</p></div>` : ''}
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
