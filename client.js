// public/client.js
    const players = [
      { id: 'mendoza', name: 'Fernando Mendoza', pos: 'QB', school: 'California', year: '2026', rating: 92 },
      { id: 'bain', name: 'Rueben Bain', pos: 'EDGE', school: 'Miami', year: '2026', rating: 90 },
      { id: 'moore', name: 'Dante Moore', pos: 'QB', school: 'UCLA', year: '2026', rating: 91 },
      { id: 'sellers', name: 'LaNorris Sellers', pos: 'QB', school: 'South Carolina', year: '2026', rating: 88 },
      { id: 'jordan', name: 'A. Jordan', pos: 'WR', school: 'Oregon', year: '2026', rating: 86 },
      { id: 'tucker', name: 'T. Tucker', pos: 'RB', school: 'Boise State', year: '2026', rating: 84 }
    ];

    const playerListEl = document.getElementById('playerList');
    const chatPanel = document.getElementById('chatPanel');
    const chatHeaderName = document.getElementById('chatName');
    const chatHeaderMeta = document.getElementById('chatMeta');
    const chatAvatar = document.getElementById('chatAvatar');
    const chatBody = document.getElementById('chatBody');
    const chatEmpty = document.getElementById('chatEmpty');
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');

    let activePlayer = null;
    let conversation = {}; // map playerId -> array of {who:'player'|'recruiter', text:...}

    function createPlayerRow(p){
      const row = document.createElement('div');
      row.className = 'player-row';
      row.innerHTML = `
        <div class="player-info" role="group" aria-label="${p.name} info">
          <div style="width:56px;height:56px;border-radius:8px;background:linear-gradient(135deg,#eef8ff,#e8f5ff);display:flex;align-items:center;justify-content:center;font-weight:800;color:#044b88">
            ${p.name.split(' ').map(n=>n[0]).slice(0,2).join('')}
          </div>
          <div class="player-meta">
            <div class="player-name">${p.name} <span style="font-weight:600;color:#0073d1">• ${p.pos}</span></div>
            <div class="player-sub">${p.school} • Class of ${p.year} • Rating ${p.rating}</div>
          </div>
        </div>

        <div class="player-actions">
          <button class="btn ghost" data-player-id="${p.id}" aria-label="View profile">Profile</button>
          <button class="btn primary recruit-btn" data-player-id="${p.id}" aria-label="Recruit ${p.name}">Recruit »</button>
        </div>
      `;
      row.querySelector('.recruit-btn').addEventListener('click', () => openChatForPlayer(p.id));
      return row;
    }

    function renderPlayers(list){
      playerListEl.innerHTML = '';
      if(list.length === 0){
        playerListEl.innerHTML = '<div style="padding:18px;color:var(--muted)">No players match that filter.</div>';
        return;
      }
      list.forEach(p => playerListEl.appendChild(createPlayerRow(p)));
    }

    renderPlayers(players);

    function openChatForPlayer(playerId){
      activePlayer = players.find(x => x.id === playerId);
      if(!activePlayer) return;

      chatHeaderName.textContent = activePlayer.name;
      chatHeaderMeta.textContent = `${activePlayer.pos} • ${activePlayer.school}`;
      chatAvatar.textContent = activePlayer.name.split(' ').map(n=>n[0]).slice(0,2).join('');

      if(!conversation[playerId]){
        conversation[playerId] = [
          { who: 'player', text: `Hey, what's up coach? Thanks for reaching out.` }
        ];
      }

      renderConversation(playerId);
      chatPanel.setAttribute('aria-hidden','false');
      setTimeout(()=> chatInput.focus(), 120);
    }

    function renderConversation(playerId){
      const conv = conversation[playerId] || [];
      chatBody.innerHTML = '';
      conv.forEach(msg => {
        const el = document.createElement('div');
        el.className = 'message ' + (msg.who === 'player' ? 'player' : 'recruiter');
        el.textContent = msg.text;
        chatBody.appendChild(el);
      });
      chatBody.scrollTop = chatBody.scrollHeight;
    }

    // AI-enabled sendMessage
    // ----- robust send flow with sending flag and guaranteed cleanup -----
let sending = false;

function setSendingState(isSending) {
  sending = !!isSending;
  chatInput.disabled = sending;
  sendBtn.disabled = sending;
  // optional: change button text to show activity
  sendBtn.innerText = sending ? 'Sending...' : 'Send';
}

async function sendMessage() {
  if (!activePlayer) return;
  if (sending) return; // avoid duplicate sends
  const text = chatInput.value.trim();
  if (!text) return;

  const pid = activePlayer.id;
  conversation[pid] = conversation[pid] || [];

  // push local recruiter message
  conversation[pid].push({ who: 'recruiter', text });
  renderConversation(pid);

  // prepare for async call
  chatInput.value = '';
  setSendingState(true);

  try {
    const payload = {
      playerId: pid,
      conversation: conversation[pid].slice(-8),
      latestCoachMessage: text
    };

    const resp = await fetch('/api/recruit/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      // try to surface server error body for debugging
      const errText = await resp.text().catch(() => 'No error body');
      console.error('Server returned error:', resp.status, errText);
      // push a short fallback message to keep UX flowing
      conversation[pid].push({ who: 'player', text: "Sorry coach, I had trouble receiving that. Can you repeat?" });
      renderConversation(pid);
      return;
    }

    const json = await resp.json().catch(() => ({ reply: null }));
    const aiReply = json && json.reply ? json.reply : "Thanks coach — I appreciate the message.";

    conversation[pid].push({ who: 'player', text: aiReply });
    renderConversation(pid);

  } catch (err) {
    console.error('Network or unexpected error while sending message:', err);
    conversation[pid].push({ who: 'player', text: "Hey coach, looks like I couldn't get your message — can you try again?" });
    renderConversation(pid);
  } finally {
    // always re-enable input and button no matter what happened
    setSendingState(false);
    // restore focus to input
    setTimeout(() => chatInput.focus(), 50);
  }
}

// wire up events (replace previous wiring)

    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keydown', (e) => {
      if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); sendMessage(); }
    });

    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(t => t.addEventListener('click', () => {
      tabs.forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      applyFilters();
    }));

    document.getElementById('search').addEventListener('input', applyFilters);

    function applyFilters(){
      const pos = document.querySelector('.tab.active').dataset.pos;
      const q = document.getElementById('search').value.trim().toLowerCase();
      let filtered = players.slice();
      if(pos && pos !== 'ALL') filtered = filtered.filter(p => p.pos === pos);
      if(q) filtered = filtered.filter(p => (p.name + ' ' + p.school + ' ' + p.pos).toLowerCase().includes(q));
      renderPlayers(filtered);
    }

    document.addEventListener('click', (e) => {
      const isClickInsideChat = chatPanel.contains(e.target);
      const isClickRecruitBtn = e.target.closest('.recruit-btn');
      if(!isClickInsideChat && !isClickRecruitBtn && window.innerWidth > 980){
        chatPanel.setAttribute('aria-hidden','true');
      }
    });

    document.addEventListener('keydown', (e) => {
      if(e.key === 'r' && !e.metaKey && !e.ctrlKey){ document.getElementById('search').focus(); }
      if(e.key === 'c' && activePlayer){ chatPanel.setAttribute('aria-hidden','true'); activePlayer = null; }
    });

    chatPanel.setAttribute('aria-hidden','true');