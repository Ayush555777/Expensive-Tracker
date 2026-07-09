/* script.js - merged Expense Tracker + Advanced Bill Splitter (localStorage)
   Features:
   - localStorage auth (seed admin)
   - show/hide password (login/signup/reset)
   - expenses CRUD + delete + Undo
   - Chart.js animated updates (doughnut)
   - CSV export includes profile header
   - PDF export (jsPDF)
   - Advanced Bill Splitter 2.0 (names, custom splits, save each share as expense, history)
   - WhatsApp share for split
   - Dark/light theme in settings
*/

// ---------------- Utilities ----------------
const qs = s => document.querySelector(s);
const qsa = s => Array.from(document.querySelectorAll(s));
const saveUsers = u => localStorage.setItem('users', JSON.stringify(u));
const loadUsers = () => JSON.parse(localStorage.getItem('users') || '[]');
const saveSession = s => localStorage.setItem('session', JSON.stringify(s));
const loadSession = () => JSON.parse(localStorage.getItem('session') || 'null');
const saveExpenses = e => localStorage.setItem('expenses', JSON.stringify(e));
const loadExpenses = () => JSON.parse(localStorage.getItem('expenses') || '[]');
const saveSplits = s => localStorage.setItem('splits', JSON.stringify(s));
const loadSplits = () => JSON.parse(localStorage.getItem('splits') || '[]');

function toast(message, withUndo=false, undoHandler=null){
  const el = document.createElement('div');
  el.className = 'custom-toast';
  el.style.position = 'fixed';
  el.style.right = '18px';
  el.style.bottom = '18px';
  el.style.zIndex = 9999;
  el.style.padding = '10px 14px';
  el.style.background = 'rgba(12,12,20,0.9)';
  el.style.color = '#fff';
  el.style.borderRadius = '8px';
  el.style.display = 'flex';
  el.style.gap = '8px';
  el.style.alignItems = 'center';
  el.innerText = message;
  if(withUndo){
    const btn = document.createElement('button');
    btn.textContent = 'Undo';
    btn.className = 'btn btn-sm btn-light';
    btn.onclick = () => { undoHandler && undoHandler(); el.remove(); };
    el.appendChild(btn);
  }
  document.body.appendChild(el);
  setTimeout(()=>el.remove(),4500);
  return el;
}

// ---------------- Seed an admin ----------------
(function seedAdmin(){
  const users = loadUsers();
  if(!users.find(u=>u.email==='admin@tracker.com')){
    users.push({ email:'admin@tracker.com', password:'admin123', name:'Administrator', role:'admin', img:null, mobile:'', address:'', job:'', incomeSource:'' });
    saveUsers(users);
  }
})();

// ---------------- LOGIN PAGE ----------------
(function loginPage(){
  if(!document.body.classList.contains('page-login')) return;

  qs('#toggleLoginPwd').addEventListener('click', ()=>{
    const p = qs('#loginPassword'); p.type = p.type === 'password' ? 'text' : 'password';
    qs('#toggleLoginPwd i').classList.toggle('fa-eye-slash');
  });

  qs('#openForgot').addEventListener('click', (e)=>{ e.preventDefault(); qs('#forgotModal').classList.remove('d-none'); });
  qs('#cancelForgot').addEventListener('click', ()=>qs('#forgotModal').classList.add('d-none'));

  qs('#toggleResetPwd').addEventListener('click', ()=>{
    const p = qs('#newPassword'); p.type = p.type === 'password' ? 'text' : 'password'; qs('#toggleResetPwd i').classList.toggle('fa-eye-slash');
  });

  qs('#sendCode').addEventListener('click', ()=>{
    const email = qs('#forgotEmail').value.trim();
    if(!email) return toast('Enter email');
    const code = (Math.floor(100000 + Math.random()*900000)).toString();
    localStorage.setItem('reset_'+email, code);
    qs('#forgotStage1').classList.add('d-none'); qs('#forgotStage2').classList.remove('d-none'); qs('#demoCode').textContent = `Demo code: ${code}`;
    toast('Reset code generated (demo)');
  });

  qs('#resetPasswordBtn').addEventListener('click', ()=>{
    const email = qs('#forgotEmail').value.trim(); const code = qs('#resetCode').value.trim(); const np = qs('#newPassword').value;
    if(!email || !code || !np) return toast('Fill all fields');
    if(localStorage.getItem('reset_'+email) !== code) return toast('Invalid code');
    const users = loadUsers(); const u = users.find(x=>x.email === email);
    if(!u) return toast('User not found');
    u.password = np; saveUsers(users); toast('Password reset - you can login now'); qs('#forgotModal').classList.add('d-none');
  });

  qs('#loginForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    const email = qs('#loginEmail').value.trim().toLowerCase();
    const pwd = qs('#loginPassword').value;
    const users = loadUsers();
    const user = users.find(u => (u.email||'').toLowerCase() === email && u.password === pwd);
    if(!user) return toast('Invalid credentials');
    saveSession(user);
    if(qs('#remember').checked) localStorage.setItem('last', email);
    window.location.href = 'dashboard.html';
  });
})();

// ---------------- SIGNUP PAGE ----------------
(function signupPage(){
  if(!document.body.classList.contains('page-signup')) return;

  qs('#toggleSignupPwd').addEventListener('click', ()=>{
    const p = qs('#signupPassword'); p.type = p.type === 'password' ? 'text' : 'password';
    qs('#toggleSignupPwd i').classList.toggle('fa-eye-slash');
  });

  qs('#signupForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    const email = qs('#signupEmail').value.trim().toLowerCase(); const pwd = qs('#signupPassword').value; const name = qs('#signupName').value.trim();
    if(!email || !pwd) return toast('Enter email and password');
    const users = loadUsers();
    if(users.find(u => (u.email||'').toLowerCase() === email)) return toast('Email already registered');
    const user = { email, password: pwd, name: name || email.split('@')[0], role:'member', img:null, mobile:'', address:'', job:'', incomeSource:'' };
    users.push(user); saveUsers(users);
    toast('Account created. Redirecting to login...');
    setTimeout(()=>window.location.href='index.html',900);
  });
})();

// ---------------- DASHBOARD + EXPENSES + SPLITTER ----------------
(function dashboardPage(){
  if(!document.body.classList.contains('page-dashboard')) return;

  // guard
  let session = loadSession();
  if(!session){ window.location.href='index.html'; return; }

  // session UI
  const setProfileDisplay = (sess) => {
    qs('#displayName').textContent = sess.name || sess.email;
    qs('#greetName').textContent = sess.name || sess.email.split('@')[0];
    qs('#displayRole').textContent = (sess.role || 'member').toUpperCase();
    qs('#avatar').src = sess.img || qs('#avatar').src;
  };
  setProfileDisplay(session);

  // Nav wiring
  qsa('.sidebar-nav .nav-link').forEach(link=>{
    link.addEventListener('click', (ev)=>{
      ev.preventDefault();
      const target = link.getAttribute('data-section');
      qsa('#dashboardSection, #profileSection, #settingsSection, #billSection').forEach(s=>s.classList.add('d-none'));
      qs(`#${target}`).classList.remove('d-none');
      qsa('.sidebar-nav .nav-link').forEach(n=>n.classList.remove('active')); link.classList.add('active');
    });
  });

  // Theme
  const applyTheme = t => { localStorage.setItem('theme', t); if(t==='dark') document.body.classList.add('dark'); else document.body.classList.remove('dark'); };
  const savedTheme = localStorage.getItem('theme') || 'light'; applyTheme(savedTheme); qs('#themeSelect').value = savedTheme;

  qs('#saveSettings').addEventListener('click', (e)=>{
    e.preventDefault();
    applyTheme(qs('#themeSelect').value);
    localStorage.setItem('salary', Number(qs('#salaryInput').value || 0));
    toast('Settings saved'); updateDisplays();
  });

  // Populate profile form
  qs('#nameInput').value = session.name || '';
  qs('#mobileInput').value = session.mobile || '';
  qs('#emailInput').value = session.email || '';
  qs('#addressInput').value = session.address || '';
  qs('#jobInput').value = session.job || '';
  qs('#incomeInput').value = session.incomeSource || '';
  qs('#salaryInput').value = Number(localStorage.getItem('salary') || 0);

  // Save profile
  qs('#profileForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    const users = loadUsers(); const idx = users.findIndex(u=>u.email===session.email);
    session.name = qs('#nameInput').value.trim(); session.mobile = qs('#mobileInput').value.trim();
    session.email = qs('#emailInput').value.trim(); session.address = qs('#addressInput').value.trim();
    session.job = qs('#jobInput').value; session.incomeSource = qs('#incomeInput').value;
    const file = qs('#photoInput').files[0];
    if(file){
      const reader = new FileReader(); reader.onload = (ev) => {
        session.img = ev.target.result; qs('#avatar').src = session.img;
        if(idx !== -1){ users[idx] = {...users[idx], ...session}; saveUsers(users); }
        saveSession(session); toast('Profile updated');
      }; reader.readAsDataURL(file);
    } else {
      if(idx !== -1){ users[idx] = {...users[idx], ...session}; saveUsers(users); }
      saveSession(session); setProfileDisplay(session); toast('Profile updated');
    }
  });

  // Logout
  qs('#logout').addEventListener('click', ()=>{ localStorage.removeItem('session'); window.location.href='index.html'; });

  // Expenses & Chart
  let expenses = loadExpenses();
  let salary = Number(localStorage.getItem('salary') || 0);

  const ctx = qs('#chart').getContext('2d');
  let chart = new Chart(ctx, {
    type:'doughnut',
    data:{ labels:[], datasets:[{ data:[], backgroundColor: ['#7b5fff','#ff7eb3','#4facfe','#43e97b','#f59e0b','#a78bfa','#f97316','#60a5fa'] }] },
    options:{ responsive:true, animation:{ animateRotate:true, duration:700, easing:'easeOutQuart' }, plugins:{ legend:{ position:'bottom' } } }
  });

  function rebuildChart(){
    const totals = expenses.reduce((m,e)=>{ m[e.category]=(m[e.category]||0)+e.amount; return m; }, {});
    const labels = Object.keys(totals); const data = labels.map(l=>totals[l]);
    chart.data.labels = labels; chart.data.datasets[0].data = data; chart.update();
  }

  function renderExpenses(){
    qs('#expenseTable tbody').innerHTML = expenses.map((e,i)=>`
      <tr>
        <td>${new Date(e.date).toLocaleString()}</td>
        <td>${e.category}</td>
        <td>${e.note||''}</td>
        <td class="text-end">₹${e.amount.toFixed(2)}</td>
        <td class="text-end"><button class="btn btn-sm btn-outline-danger btn-delete" data-i="${i}">Delete</button></td>
      </tr>
    `).join('');
    qsa('.btn-delete').forEach(b=>b.addEventListener('click', onDeleteClick));
  }

  function updateDisplays(){
    const total = expenses.reduce((s,e)=>s+e.amount,0);
    salary = Number(localStorage.getItem('salary') || salary || 0);
    qs('#tableTotal').textContent = '₹' + total.toFixed(2);
    qs('#totalDisplay').textContent = '₹' + total.toFixed(2);
    qs('#salaryDisplay').textContent = '₹' + salary.toFixed(2);
    qs('#leftDisplay').textContent = '₹' + (salary - total).toFixed(2);
  }

  function updateAll(){ renderExpenses(); rebuildChart(); updateDisplays(); animateCards(); }

  function animateCards(){ qsa('.info-card').forEach(c=>{ c.classList.add('pop'); setTimeout(()=>c.classList.remove('pop'),250); }); }

  // Note visible for Others/Borrow
  qs('#expenseCategory').addEventListener('change', ()=>{
    const v = qs('#expenseCategory').value; if(v==='Others' || v==='Borrow') qs('#noteWrapper').style.display='block'; else qs('#noteWrapper').style.display='none';
  });

  // Add expense
  qs('#expenseForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    const cat = qs('#expenseCategory').value; const amt = Number(qs('#expenseAmount').value); const note = qs('#expenseNote').value.trim();
    if(!cat) return toast('Select category'); if(!amt || amt<=0) return toast('Enter valid amount');
    if((cat==='Others' || cat==='Borrow') && !note) return toast('Please add a note for Others/Borrow');
    const newExp = { date: new Date().toISOString(), category:cat, amount:amt, note };
    expenses.unshift(newExp); saveExpenses(expenses); updateAll(); qs('#expenseForm').reset(); qs('#noteWrapper').style.display='none'; toast('Expense added');
  });

  // Delete with undo
  let lastDeleted = null;
  function onDeleteClick(ev){
    const i = Number(ev.currentTarget.getAttribute('data-i'));
    lastDeleted = { item: expenses[i], index: i };
    expenses.splice(i,1); saveExpenses(expenses); updateAll();
    toast('Deleted', true, ()=>{
      if(lastDeleted){ expenses.splice(lastDeleted.index,0,lastDeleted.item); saveExpenses(expenses); updateAll(); lastDeleted=null; }
    });
    setTimeout(()=> lastDeleted = null, 5200);
  }

  // Quick Borrow
  qs('#quickAddBorrow').addEventListener('click', ()=>{ qs('#expenseCategory').value='Borrow'; qs('#noteWrapper').style.display='block'; qs('#expenseAmount').focus(); });

  // Export CSV (includes profile header)
  qs('#exportCsv').addEventListener('click', ()=>{
    const sessionLocal = loadSession() || {};
    const headerLines = [
      ['Profile Name', sessionLocal.name || ''],
      ['Email', sessionLocal.email || ''],
      ['Mobile', sessionLocal.mobile || ''],
      ['Address', sessionLocal.address || ''],
      ['Job', sessionLocal.job || ''],
      ['Source of income', sessionLocal.incomeSource || ''],
      []
    ];
    const rows = expenses.map(e=>[new Date(e.date).toLocaleString(), e.category, e.note || '', e.amount.toFixed(2)]);
    const csvRows = [...headerLines.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')), ['"Date"','"Category"','"Note"','"Amount"'].join(','), ...rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(','))];
    const csv = csvRows.join('\n'); const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='expenses_with_profile.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    toast('CSV exported (profile header included)');
  });

  // Export PDF simple
  qs('#exportPdf').addEventListener('click', ()=>{
    const { jsPDF } = window.jspdf; const doc = new jsPDF(); let y=20;
    const sess = loadSession() || {}; doc.setFontSize(14); doc.text('Expense Report',14,y); y+=8; doc.setFontSize(10);
    doc.text(`Name: ${sess.name||''}`,14,y); y+=6; doc.text(`Email: ${sess.email||''}`,14,y); y+=6; doc.text(`Mobile: ${sess.mobile||''}`,14,y); y+=8; doc.text('---',14,y); y+=8;
    expenses.slice(0,80).forEach(e=>{ doc.text(`${new Date(e.date).toLocaleString()}  ${e.category}  ${e.note?'- '+e.note:''}  ₹${e.amount.toFixed(2)}`,14,y); y+=6; if(y>280){doc.addPage(); y=20;} });
    doc.save('expenses.pdf'); toast('PDF exported');
  });

  // storage event (other tabs)
  window.addEventListener('storage', ev=>{
    if(ev.key === 'expenses'){ expenses = loadExpenses(); updateAll(); }
  });

  // initial render
  updateAll();

  // ---------------- Advanced Bill Splitter ----------------
  // Elements
  const billTotalEl = qs('#billTotal'); const billCountEl = qs('#billCount'); const createGroupBtn = qs('#createGroup');
  const peopleEditor = qs('#peopleEditor'); const peopleListEl = qs('#peopleList'); const equalSplitBtn = qs('#equalSplitBtn');
  const computeSplitBtn = qs('#computeSplitBtn'); const saveSplitAllBtn = qs('#saveSplitAll');
  const splitResultCard = qs('#splitResultCard'); const splitTableEl = qs('#splitTable'); const exportSplitCsvBtn = qs('#exportSplitCsv');
  const exportSplitPdfBtn = qs('#exportSplitPdf'); const shareWhatsBtn = qs('#shareWhatsApp'); const savedSplitsEl = qs('#savedSplits');

  let people = []; // { name, share (number), note }
  function renderPeopleEditor(){
    peopleListEl.innerHTML = people.map((p,i)=>`
      <div class="row g-2 align-items-center mb-2 person-row" data-i="${i}">
        <div class="col-md-5"><input class="form-control person-name" placeholder="Person name" value="${p.name||''}"></div>
        <div class="col-md-3"><input class="form-control person-share" type="number" placeholder="Share (optional)" value="${p.share||''}" step="0.01"></div>
        <div class="col-md-3"><input class="form-control person-note" placeholder="Note (optional)" value="${p.note||''}"></div>
        <div class="col-md-1"><button class="btn btn-sm btn-outline-danger btn-remove-person">X</button></div>
      </div>
    `).join('');
    // attach listeners
    qsa('.btn-remove-person').forEach((b, idx)=> b.addEventListener('click', ()=>{ people.splice(idx,1); renderPeopleEditor(); }));
    qsa('.person-name').forEach((inp, idx)=> inp.addEventListener('input', ()=> people[idx].name = inp.value));
    qsa('.person-share').forEach((inp, idx)=> inp.addEventListener('input', ()=> people[idx].share = inp.value ? Number(inp.value) : ''));
    qsa('.person-note').forEach((inp, idx)=> inp.addEventListener('input', ()=> people[idx].note = inp.value));
  }

  createGroupBtn.addEventListener('click', ()=>{
    const total = Number(billTotalEl.value); const cnt = Number(billCountEl.value);
    if(!total || total <=0) return toast('Enter valid total amount'); if(!cnt || cnt < 1) return toast('Enter number of people');
    people = []; for(let i=0;i<cnt;i++) people.push({ name: `Person ${i+1}`, share:'', note:'' });
    peopleEditor.style.display = 'block'; renderPeopleEditor(); splitResultCard.style.display='none';
    qs('#peopleEditor').scrollIntoView({ behavior:'smooth' });
  });

  equalSplitBtn.addEventListener('click', ()=>{
    const total = Number(billTotalEl.value); if(!total) return toast('Total missing');
    const per = Number((total / people.length).toFixed(2));
    people = people.map(p => ({...p, share: per}));
    renderPeopleEditor();
    toast('Equal split applied (may have rounding differences)');
  });

  computeSplitBtn.addEventListener('click', ()=>{
    const total = Number(billTotalEl.value); if(!total) return toast('Total missing');
    // if any share specified -> custom mode; else equal
    const anyCustom = people.some(p => p.share !== '' && p.share !== null && p.share !== undefined && p.share !== 0);
    if(anyCustom){
      // validate sum equals total (allow ±0.1 due to rounding)
      const sum = people.reduce((s,p)=> s + (Number(p.share) || 0), 0);
      if(Math.abs(sum - total) > 0.5) return toast(`Custom shares sum ₹${sum.toFixed(2)} ≠ total ₹${total.toFixed(2)} (allow ±0.5)`);
    } else {
      // equal
      const per = Number((total / people.length).toFixed(2));
      people = people.map(p=> ({...p, share: per}));
    }
    // render results
    splitResultCard.style.display = 'block';
    splitTableEl.innerHTML = people.map(p=>`<tr><td>${p.name || ''}</td><td class="text-end">₹${(Number(p.share)||0).toFixed(2)}</td><td>${p.note||''}</td></tr>`).join('');
    saveTempSplitToUI();
    toast('Split calculated');
  });

  function saveTempSplitToUI(){
    // show summary & allow exports
    splitResultCard.scrollIntoView({ behavior:'smooth' });
  }

  // Save each person's share as an expense
  saveSplitAllBtn.addEventListener('click', ()=>{
    if(!people.length) return toast('Nothing to save');
    const addIndividually = confirm('Save each person share as a separate expense? (OK = Yes)');
    if(!addIndividually) return;
    const expensesArr = loadExpenses();
    people.forEach(p=>{
      const e = { date: new Date().toISOString(), category: 'Bill Split', amount: Number(p.share)||0, note: `Split: ${p.name}${p.note? ' - '+p.note : ''}` };
      expensesArr.unshift(e);
    });
    saveExpenses(expensesArr); expenses = loadExpenses(); updateAll(); toast('Split saved as separate expenses');
    // save split record to history
    const splits = loadSplits();
    splits.unshift({ id: Date.now(), date: new Date().toISOString(), total: Number(billTotalEl.value)||0, people: JSON.parse(JSON.stringify(people)) });
    saveSplits(splits); renderSavedSplits();
  });

  // Export split CSV (with profile header)
  exportSplitCsvBtn.addEventListener('click', ()=>{
    const sess = loadSession() || {};
    const headers = [
      ['Profile Name', sess.name||''],
      ['Email', sess.email||''],
      ['Mobile', sess.mobile||''],
      ['Address', sess.address||''],
      ['Job', sess.job||''],
      ['Source of income', sess.incomeSource||''],
      []
    ];
    const rows = people.map(p=>[p.name||'', (p.share||0).toFixed(2), p.note||'']);
    const csvRows = [...headers.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')), ['"Name"','"Share"','"Note"'].join(','), ...rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(','))];
    const csv = csvRows.join('\n'); const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='split_with_profile.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    toast('Split CSV exported');
  });

  // Export split PDF
  exportSplitPdfBtn.addEventListener('click', ()=>{
    const { jsPDF } = window.jspdf; const doc = new jsPDF(); let y=20;
    const sess = loadSession() || {};
    doc.setFontSize(14); doc.text('Bill Split',14,y); y+=8; doc.setFontSize(10);
    doc.text(`Name: ${sess.name||''}`,14,y); y+=6; doc.text(`Email: ${sess.email||''}`,14,y); y+=8; doc.text('---',14,y); y+=8;
    people.forEach(p=>{ doc.text(`${p.name} - ₹${(p.share||0).toFixed(2)} ${p.note?'- '+p.note:''}`,14,y); y+=6; if(y>280){doc.addPage(); y=20;} });
    doc.save('split.pdf'); toast('Split PDF exported');
  });

  // Share via WhatsApp
  shareWhatsBtn.addEventListener('click', ()=>{
    const lines = people.map(p=>`${p.name}: ₹${(p.share||0).toFixed(2)} ${p.note?'- '+p.note:''}`).join('\n');
    const text = `Bill Split result:\nTotal: ₹${(Number(billTotalEl.value)||0).toFixed(2)}\n\n${lines}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url,'_blank');
  });

  // Saved splits history
  function renderSavedSplits(){
    const list = loadSplits();
    if(!list.length) { savedSplitsEl.innerHTML = '<div class="muted small">No saved splits</div>'; return; }
    savedSplitsEl.innerHTML = list.map(s=>`
      <div class="card p-2 mb-2">
        <div class="d-flex justify-content-between align-items-center">
          <div><strong>Split - ${new Date(s.date).toLocaleString()}</strong><div class="muted small">Total ₹${s.total.toFixed(2)}</div></div>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-secondary btn-view-split" data-id="${s.id}">View</button>
            <button class="btn btn-sm btn-outline-danger btn-delete-split" data-id="${s.id}">Delete</button>
          </div>
        </div>
      </div>
    `).join('');
    qsa('.btn-view-split').forEach(b => b.addEventListener('click', ()=>{
      const id = Number(b.getAttribute('data-id')); const rec = loadSplits().find(x=>x.id===id);
      if(!rec) return; people = JSON.parse(JSON.stringify(rec.people)); splitResultCard.style.display='block'; splitTableEl.innerHTML = people.map(p=>`<tr><td>${p.name}</td><td class="text-end">₹${(p.share||0).toFixed(2)}</td><td>${p.note||''}</td></tr>`).join('');
      window.scrollTo({ top: document.body.scrollHeight, behavior:'smooth' });
    }));
    qsa('.btn-delete-split').forEach(b => b.addEventListener('click', ()=>{
      const id = Number(b.getAttribute('data-id')); let arr = loadSplits(); arr = arr.filter(x=>x.id !== id); saveSplits(arr); renderSavedSplits(); toast('Split deleted');
    }));
  }
  renderSavedSplits();

  // When expenses change elsewhere (other tabs), update
  window.addEventListener('storage', ev => {
    if(ev.key === 'expenses') { expenses = loadExpenses(); updateAll(); }
  });

})();
