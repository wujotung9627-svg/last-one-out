const $ = (selector) => document.querySelector(selector);
const MAX_FIXES = 2;
const state = { idea: '', card: null, gameId: null, fixes: 0, fixing: false };

async function api(path, body) {
  const res = await fetch(
    path,
    body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined,
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function setStatus(text) {
  $('#status').textContent = text;
}

async function refreshStatus() {
  try {
    const s = await api('/api/status');
    $('#mode').hidden = !s.mock;
    $('#budget').textContent = `About $${s.spentUsd.toFixed(2)} of $${s.capUsd} used`;
  } catch {
    $('#budget').textContent = '';
  }
}

async function dealCards() {
  $('#deal').hidden = true;
  setStatus('Dealing cards…');
  try {
    const deal = await api('/api/cards', { idea: state.idea });
    $('#nearest').textContent = `Closest familiar game type: ${deal.nearest}. ${deal.why_familiar}`;
    const box = $('#cards');
    box.replaceChildren(
      ...deal.cards.map((card) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'card';
        const title = document.createElement('strong');
        title.textContent = card.title;
        const rule = document.createElement('span');
        rule.textContent = card.rule;
        const twist = document.createElement('em');
        twist.textContent = card.twist;
        button.append(title, rule, twist);
        button.addEventListener('click', () => forge(card));
        return button;
      }),
    );
    $('#deal').hidden = false;
    setStatus('Pick one card. It becomes the core rule of your game.');
  } catch (err) {
    setStatus(err.message);
  }
  refreshStatus();
}

function showGame(id) {
  state.gameId = id;
  $('#frame').src = `/play/${id}`;
  $('#open').href = `/play/${id}`;
  $('#play').hidden = false;
}

async function forge(card) {
  state.card = card;
  state.fixes = 0;
  $('#play').hidden = true;
  setStatus(`Forging "${card.title}"… this takes about a minute.`);
  try {
    const { id } = await api('/api/game', { idea: state.idea, card });
    showGame(id);
    setStatus(`Playing "${card.title}".`);
  } catch (err) {
    setStatus(err.message);
  }
  refreshStatus();
}

async function repair(error) {
  state.fixing = true;
  state.fixes += 1;
  setStatus(`The game hit an error. Repairing it (try ${state.fixes} of ${MAX_FIXES})…`);
  try {
    const { id } = await api('/api/fix', { id: state.gameId, error });
    showGame(id);
    setStatus(`Repaired. Playing "${state.card.title}".`);
  } catch (err) {
    setStatus(err.message);
  } finally {
    state.fixing = false;
  }
  refreshStatus();
}

window.addEventListener('message', (event) => {
  if (event.source !== $('#frame').contentWindow) return;
  if (event.data?.type !== 'forge-error' || state.fixing) return;
  if (state.fixes >= MAX_FIXES) {
    setStatus('The game still has an error after two repairs. Pick a card again.');
    return;
  }
  repair(String(event.data.message));
});

$('#idea-form').addEventListener('submit', (event) => {
  event.preventDefault();
  state.idea = $('#idea').value.trim();
  if (state.idea) dealCards();
});

$('#again').addEventListener('click', dealCards);

refreshStatus();
