let tuttiVini = [];
let filtroAttivo = 'tutti';
let testoCerca = '';

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
    if (cfg.nome_ristorante) {
      document.getElementById('nome-ristorante').textContent = cfg.nome_ristorante;
      document.title = cfg.nome_ristorante + ' — Carta dei Vini';
    }
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
      '<p class="vuoto"><p>Impossibile caricare la carta dei vini.</p></p>';
  }
}

// ── Filtri ────────────────────────────────────────────────────────────────────

function costruisciFiltriNazioni() {
  const nazioni = [...new Set(tuttiVini.map(v => v.nazione).filter(Boolean))].sort();
  const contenitore = document.getElementById('filtri-nazioni');
  contenitore.innerHTML = nazioni.map(n =>
    `<button class="filtro-btn" data-filtro="${n}" onclick="setFiltro('${n}', this)">${n}</button>`
  ).join('');
}

function setFiltro(valore, el) {
  filtroAttivo = valore;
  document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('attivo'));
  el.classList.add('attivo');
  renderCatalogo();
}

document.querySelector('[data-filtro="tutti"]').addEventListener('click', function() {
  setFiltro('tutti', this);
});

// ── Render catalogo ───────────────────────────────────────────────────────────

function renderCatalogo() {
  const contenitore = document.getElementById('catalogo');

  let vini = tuttiVini;

  if (filtroAttivo !== 'tutti') {
    vini = vini.filter(v => v.nazione === filtroAttivo);
  }

  if (testoCerca) {
    vini = vini.filter(v =>
      (v.nome || '').toLowerCase().includes(testoCerca) ||
      (v.cantina || '').toLowerCase().includes(testoCerca) ||
      (v.uve || '').toLowerCase().includes(testoCerca) ||
      (v.regione || '').toLowerCase().includes(testoCerca)
    );
  }

  if (vini.length === 0) {
    contenitore.innerHTML = '<div class="vuoto"><p>Nessun vino trovato.</p></div>';
    return;
  }

  contenitore.innerHTML = vini.map(v => cardVino(v)).join('');
}

function cardVino(v) {
  const prezzoBottiglia = v.prezzo_bottiglia
    ? `€ ${parseFloat(v.prezzo_bottiglia).toFixed(2)}`
    : null;
  const prezzoMescita = v.prezzo_mescita
    ? `€ ${parseFloat(v.prezzo_mescita).toFixed(2)}`
    : null;

  const tags = [
    v.regione ? `<span class="tag">${v.regione}</span>` : '',
    v.annata  ? `<span class="tag annata">${v.annata}</span>` : '',
    v.nazione ? `<span class="tag">${v.nazione}</span>` : '',
  ].filter(Boolean).join('');

  return `
    <article class="card-vino" onclick="apriModale('${v.id}')">
      ${v.cantina ? `<div class="card-cantina">${v.cantina}</div>` : ''}
      <h2 class="card-nome">${v.nome || 'Vino senza nome'}</h2>
      <div class="card-meta">${tags}</div>
      ${v.descrizione ? `<p class="card-descrizione">${v.descrizione}</p>` : ''}
      <div class="card-prezzi">
        ${prezzoBottiglia ? `
          <div class="prezzo-item">
            <span class="prezzo-label">Bottiglia</span>
            <span class="prezzo-valore">${prezzoBottiglia}</span>
          </div>` : ''}
        ${prezzoMescita ? `
          <div class="prezzo-item">
            <span class="prezzo-label">Al calice</span>
            <span class="prezzo-valore">${prezzoMescita}</span>
          </div>` : ''}
        ${!prezzoBottiglia && !prezzoMescita ? `
          <div class="prezzo-item">
            <span class="prezzo-valore non-disponibile">Prezzo su richiesta</span>
          </div>` : ''}
      </div>
    </article>`;
}

// ── Modale dettaglio ──────────────────────────────────────────────────────────

function apriModale(id) {
  const v = tuttiVini.find(x => x.id === id);
  if (!v) return;

  const tags = [
    v.nazione ? `<span class="tag">${v.nazione}</span>` : '',
    v.regione ? `<span class="tag">${v.regione}</span>` : '',
    v.annata  ? `<span class="tag annata">Annata ${v.annata}</span>` : '',
  ].filter(Boolean).join('');

  const prezzoBottiglia = v.prezzo_bottiglia
    ? `<div class="modale-prezzo-item">
         <span class="modale-prezzo-label">Bottiglia</span>
         <span class="modale-prezzo-valore">€ ${parseFloat(v.prezzo_bottiglia).toFixed(2)}</span>
       </div>`
    : '';

  const prezzoMescita = v.prezzo_mescita
    ? `<div class="modale-prezzo-item">
         <span class="modale-prezzo-label">Al calice</span>
         <span class="modale-prezzo-valore">€ ${parseFloat(v.prezzo_mescita).toFixed(2)}</span>
       </div>`
    : '';

  document.getElementById('modale-contenuto').innerHTML = `
    ${v.cantina ? `<div class="modale-cantina">${v.cantina}</div>` : ''}
    <h2 class="modale-nome">${v.nome || 'Vino senza nome'}</h2>
    <div class="modale-tags">${tags}</div>

    ${v.descrizione ? `
    <div class="modale-sezione">
      <div class="modale-sezione-titolo">Note di degustazione</div>
      <p class="modale-descrizione">${v.descrizione}</p>
    </div>` : ''}

    ${v.uve ? `
    <div class="modale-sezione">
      <div class="modale-sezione-titolo">Vitigni</div>
      <p class="modale-uve">${v.uve}</p>
    </div>` : ''}

    ${(prezzoBottiglia || prezzoMescita) ? `
    <div class="modale-prezzi">
      ${prezzoBottiglia}
      ${prezzoMescita}
    </div>` : ''}
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

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') chiudiModale();
});
