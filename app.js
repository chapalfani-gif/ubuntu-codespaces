/* FinKu — perbaikan stabilitas, backup, dan perhitungan keuangan.
   Penyimpanan tetap menggunakan localStorage dengan key versi v2 agar data lama terbaca. */
'use strict';

const K = {
  data:'finku.transactions.v2', wallet:'finku.wallets.v2',
  budget:'finku.budgets.v2', debt:'finku.debts.v2',
  invest:'finku.investments.v2', target:'finku.targets.v2',
  onchain:'finku.onchain.v2'
};
const $ = id => document.getElementById(id);
const errors = [];
let state = {
  tx:[], wallet:[{id:'utama',name:'Utama',balance:0}],
  budget:{}, debt:[], invest:[], target:[]
};
let editId = null;

function escapeHtml(v) {
  const d=document.createElement('div'); d.textContent=String(v??''); return d.innerHTML;
}
function digits(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.max(0,Math.floor(v)) : 0;
  return Number(String(v??'').replace(/[^0-9]/g,''))||0;
}
function rupiah(n) { return 'Rp'+Number(n||0).toLocaleString('id-ID'); }
function uid() { return Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
function today() {
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function toast(message) {
  const el=$('toast'); if(!el) return;
  el.textContent=message; el.classList.remove('hidden');
  clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.add('hidden'),2800);
}
function catatError(error,context='') {
  errors.push({context,message:error?.message||String(error),time:new Date().toLocaleString('id-ID')});
  renderDebug();
}
function renderDebug() {
  if(!$('debugCount')||!$('debugList')) return;
  $('debugCount').textContent=errors.length;
  $('debugList').textContent=errors.length
    ? errors.slice().reverse().map(e=>`[${e.time}] ${e.context}: ${e.message}`).join('\n')
    : 'Belum ada error.';
}
function read(key,fallback) {
  try { const v=localStorage.getItem(key); return v===null?fallback:JSON.parse(v); }
  catch(e) { catatError(e,'Membaca data lokal'); return fallback; }
}

/* Menulis semua bagian sebagai satu transaksi lokal: bila satu gagal, pulihkan nilai sebelumnya. */
function persist() {
  const entries=[
    [K.data,state.tx],[K.wallet,state.wallet],[K.budget,state.budget],
    [K.debt,state.debt],[K.invest,state.invest],[K.target,state.target]
  ];
  let before=[];
  try {
    before=entries.map(([key])=>[key,localStorage.getItem(key)]);
    for(const [key,value] of entries) localStorage.setItem(key,JSON.stringify(value));
    return true;
  } catch(e) {
    for(const [key,value] of before) {
      try { if(value===null)localStorage.removeItem(key); else localStorage.setItem(key,value); }
      catch(_) {}
    }
    catatError(e,'Penyimpanan data (rollback)');
    toast('Penyimpanan gagal. Data sebelumnya dipertahankan.');
    return false;
  }
}
function load() {
  state.tx=read(K.data,[]);
  if(!Array.isArray(state.tx)) state.tx=[];
  state.wallet=read(K.wallet,[{id:'utama',name:'Utama',balance:0}]);
  if(!Array.isArray(state.wallet)||!state.wallet.length)
    state.wallet=[{id:'utama',name:'Utama',balance:0}];
  state.budget=read(K.budget,{});
  if(!state.budget||typeof state.budget!=='object'||Array.isArray(state.budget))state.budget={};
  state.debt=read(K.debt,[]); if(!Array.isArray(state.debt))state.debt=[];
  state.invest=read(K.invest,[]); if(!Array.isArray(state.invest))state.invest=[];
  state.target=read(K.target,[]); if(!Array.isArray(state.target))state.target=[];
  const validWallet=new Set(state.wallet.map(w=>w.id));
  state.tx.forEach(t=>{
    if(!validWallet.has(t.wallet))t.wallet=state.wallet[0].id;
    if(t.type==='transfer'&&(!t.to||!validWallet.has(t.to)))t.to=state.wallet[0].id;
  });
}
function walletName(id) { return state.wallet.find(w=>w.id===id)?.name||'(dompet terhapus)'; }
function walletBalance(id) {
  const w=state.wallet.find(x=>x.id===id); if(!w)return 0;
  let b=digits(w.balance);
  for(const t of state.tx) {
    if(t.type==='masuk'&&t.wallet===id)b+=digits(t.amount);
    if(t.type==='keluar'&&t.wallet===id)b-=digits(t.amount);
    if(t.type==='transfer') {
      if(t.wallet===id)b-=digits(t.amount);
      if(t.to===id)b+=digits(t.amount);
    }
  }
  return b;
}
function resetForm() {
  editId=null;
  $('txTitle').textContent='Tambah Transaksi';
  $('batalEdit').classList.add('hidden');
  $('txForm').reset(); $('tanggal').value=today(); $('jenis').value='keluar';
  toggleTransfer();
}
function toggleTransfer() {
  const isTransfer=$('jenis').value==='transfer';
  $('tujuanWrap').style.display=isTransfer?'':'none';
  $('tujuan').required=isTransfer; $('kategori').required=!isTransfer;
  if(isTransfer)$('kategori').value='Transfer';
}
function renderSummary() {
  const period=today().slice(0,7);
  const month=state.tx.filter(t=>String(t.date||'').startsWith(period));
  const masuk=month.filter(t=>t.type==='masuk').reduce((n,t)=>n+digits(t.amount),0);
  const keluar=month.filter(t=>t.type==='keluar').reduce((n,t)=>n+digits(t.amount),0);
  const nilaiInvest=state.invest.reduce((n,x)=>n+digits(x.value??x.cost),0);
  $('sumMasuk').textContent=rupiah(masuk);
  $('sumKeluar').textContent=rupiah(keluar);
  $('sumInvestasi').textContent=rupiah(nilaiInvest);
  $('sumSaldo').textContent=rupiah(state.wallet.reduce((n,w)=>n+walletBalance(w.id),0));
}
function renderSelects() {
  const opts=state.wallet.map(w=>`<option value="${escapeHtml(w.id)}">${escapeHtml(w.name)}</option>`).join('');
  for(const id of ['dompet','tujuan']) {
    const el=$(id); if(!el)continue;
    const lama=el.value; el.innerHTML=opts;
    if(lama&&Array.from(el.options).some(o=>o.value===lama))el.value=lama;
    else if(el.options.length)el.selectedIndex=0;
  }
}
function renderWallets() {
  $('walletList').innerHTML=state.wallet.map(w=>
    `<div class="item"><div><strong>${escapeHtml(w.name)}</strong><br><small>${rupiah(walletBalance(w.id))}</small></div>${state.wallet.length>1?`<button class="btn red" data-delete-wallet="${escapeHtml(w.id)}" type="button">Hapus</button>`:''}</div>`
  ).join('')||'<div class="empty">Belum ada dompet</div>';
}
function txTag(type) {
  return type==='masuk'?'<span class="tag in">Pemasukan</span>':
    type==='keluar'?'<span class="tag out">Pengeluaran</span>':
    '<span class="tag transfer">Transfer</span>';
}
function renderTx() {
  $('txBody').innerHTML=state.tx.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(t=>
    `<tr><td>${escapeHtml(t.date)}</td><td>${txTag(t.type)}</td><td>${escapeHtml(t.category||'-')}</td><td>${escapeHtml(walletName(t.wallet))}${t.type==='transfer'?' → '+escapeHtml(walletName(t.to)):''}</td><td class="right">${rupiah(t.amount)}</td><td><button class="btn ghost" data-edit="${escapeHtml(t.id)}" type="button">Ubah</button> <button class="btn red" data-delete="${escapeHtml(t.id)}" type="button">Hapus</button></td></tr>`
  ).join('')||'<tr><td colspan="6" class="empty">Belum ada transaksi</td></tr>';
}
function renderRecent() {
  $('recentTx').innerHTML=state.tx.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,5).map(t=>
    `<div class="item"><div><strong>${escapeHtml(t.category||t.type)}</strong><br><small>${escapeHtml(t.date)} • ${escapeHtml(t.catatan||'-')}</small></div><strong>${t.type==='keluar'?'-':''}${rupiah(t.amount)}</strong></div>`
  ).join('')||'<div class="empty">Belum ada transaksi</div>';
}
function renderTargets() {
  $('targetList').innerHTML=state.target.map(t=>{
    const amount=digits(t.amount),saved=digits(t.saved);
    const pct=amount?Math.min(100,Math.round(saved/amount*100)):0;
    return `<div class="item"><div style="flex:1"><strong>${escapeHtml(t.name)}</strong><br><small>${rupiah(saved)} / ${rupiah(amount)} (${pct}%)</small><div class="progress"><i style="width:${pct}%"></i></div></div><button class="btn red" data-delete-target="${escapeHtml(t.id)}" type="button">Hapus</button></div>`;
  }).join('')||'<div class="empty">Belum ada target</div>';
}
function renderDebts() {
  $('debtList').innerHTML=state.debt.map(d=>{
    const remaining=Math.max(0,digits(d.amount)-digits(d.paid));
    return `<div class="item"><div><strong>${escapeHtml(d.name)}</strong> • ${d.type==='piutang'?'Piutang':'Hutang'}<br><small>Sisa ${rupiah(remaining)}</small></div><div><button class="btn ghost" data-pay-debt="${escapeHtml(d.id)}" type="button">Bayar</button> <button class="btn red" data-delete-debt="${escapeHtml(d.id)}" type="button">Hapus</button></div></div>`;
  }).join('')||'<div class="empty">Belum ada hutang/piutang</div>';
}
function renderInvest() {
  $('invList').innerHTML=state.invest.map(x=>{
    const modal=digits(x.cost),nilai=digits(x.value??x.cost);
    const profit=nilai-modal,ret=modal?profit/modal*100:0;
    const color=profit>0?'#047857':profit<0?'#be123c':'var(--muted)';
    return `<div class="item"><div><strong>${escapeHtml(x.name)}</strong><br><small>${escapeHtml(x.category)} • Modal ${rupiah(modal)} • Nilai ${rupiah(nilai)}</small><br><small style="color:${color};font-weight:700">${profit>=0?'+':''}${rupiah(profit)} (${ret>=0?'+':''}${ret.toFixed(2)}%)</small></div><button class="btn red" data-delete-invest="${escapeHtml(x.id)}" type="button">Hapus</button></div>`;
  }).join('')||'<div class="empty">Belum ada investasi</div>';
}
function renderBudget() {
  const month=today().slice(0,7),map=state.budget[month]||{};
  const categories=['Makan','Transportasi','Belanja','Tagihan','Kesehatan','Hiburan','Pendidikan','Lainnya'];
  $('budgetList').innerHTML=categories.map(cat=>{
    const used=state.tx.filter(t=>t.type==='keluar'&&t.category===cat&&String(t.date||'').startsWith(month)).reduce((n,t)=>n+digits(t.amount),0);
    const limit=digits(map[cat]),pct=limit?Math.min(100,Math.round(used/limit*100)):0;
    return `<div><div class="item"><strong>${cat}</strong><input data-budget="${cat}" inputmode="numeric" value="${limit}" aria-label="Anggaran ${cat}"></div><small>Dipakai ${rupiah(used)}${limit?` / ${rupiah(limit)} (${pct}%)`:''}</small></div>`;
  }).join('');
}
function renderCategorySummary() {
  const period=today().slice(0,7),totals={};
  state.tx.filter(t=>t.type==='keluar'&&String(t.date||'').startsWith(period)).forEach(t=>{
    const cat=String(t.category||'Lainnya'); totals[cat]=(totals[cat]||0)+digits(t.amount);
  });
  const entries=Object.entries(totals).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const el=$('categorySummary'); if(!el)return;
  el.innerHTML=entries.map(([name,value])=>`<div class="item"><strong>${escapeHtml(name)}</strong><strong>${rupiah(value)}</strong></div>`).join('')||'<div class="empty">Belum ada pengeluaran bulan ini.</div>';
}
function renderTargetSummary() {
  const el=$('targetSummary'); if(!el)return;
  const t=state.target.slice().sort((a,b)=>(digits(b.saved)/Math.max(1,digits(b.amount)))-(digits(a.saved)/Math.max(1,digits(a.amount))))[0];
  if(!t){el.innerHTML='<div class="empty">Belum ada target tabungan.</div>';return;}
  const amount=digits(t.amount),saved=digits(t.saved),pct=amount?Math.min(100,Math.round(saved/amount*100)):0;
  el.innerHTML=`<div class="item"><div style="flex:1"><strong>${escapeHtml(t.name)}</strong><br><small>${rupiah(saved)} dari ${rupiah(amount)} • ${pct}%</small><div class="progress"><i style="width:${pct}%"></i></div></div></div>`;
}
function renderChart() {
  const canvas=$('chart'),ctx=canvas.getContext('2d'),rect=canvas.getBoundingClientRect();
  const width=Math.max(1,rect.width),dpr=window.devicePixelRatio||1;
  canvas.width=width*dpr; canvas.height=250*dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,width,250);
  const now=new Date(),vals=[];
  for(let i=5;i>=0;i--) {
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const tx=state.tx.filter(t=>String(t.date||'').startsWith(key));
    vals.push({
      label:d.toLocaleDateString('id-ID',{month:'short'}),
      in:tx.filter(t=>t.type==='masuk').reduce((n,t)=>n+digits(t.amount),0),
      out:tx.filter(t=>t.type==='keluar').reduce((n,t)=>n+digits(t.amount),0),
      invest:tx.filter(t=>t.type==='keluar'&&String(t.category||'').toLowerCase()==='investasi').reduce((n,t)=>n+digits(t.amount),0)
    });
  }
  const max=Math.max(1,...vals.flatMap(v=>[v.in,v.out,v.invest]));
  const group=width/6,bar=Math.max(3,Math.min(13,group*.16));
  ctx.font='11px system-ui'; ctx.textBaseline='alphabetic'; ctx.textAlign='center';
  vals.forEach((v,i)=>{
    const base=i*group+group/2-bar*1.8;
    [['in','#10b981'],['out','#ef4444'],['invest','#8b5cf6']].forEach(([key,color],j)=>{
      const h=v[key]/max*175; ctx.fillStyle=color; ctx.fillRect(base+j*bar*1.25,220-h,bar,h);
    });
    ctx.fillStyle='#475569'; ctx.fillText(v.label,i*group+group/2,240);
  });
}
function render() {
  renderSummary();renderWallets();renderTx();renderRecent();renderTargets();
  renderDebts();renderInvest();renderBudget();renderCategorySummary();
  renderTargetSummary();renderChart();renderSelects();
}

/* Transaksi */
$('txForm').addEventListener('submit',e=>{
  e.preventDefault();
  const amount=digits($('jumlah').value),type=$('jenis').value;
  if(amount<=0)return toast('Jumlah harus lebih dari 0');
  if(!$('dompet').value)return toast('Pilih dompet terlebih dahulu');
  if(type==='transfer'&&(!$('tujuan').value||$('tujuan').value===$('dompet').value))
    return toast('Dompet tujuan harus berbeda dari dompet asal');
  const t={
    id:editId||uid(),date:$('tanggal').value,type,
    category:type==='transfer'?'Transfer':$('kategori').value.trim()||'Lainnya',
    wallet:$('dompet').value,amount,catatan:$('catatan').value.trim(),
    to:type==='transfer'?$('tujuan').value:''
  };
  const previous=editId;
  if(editId) {
    const i=state.tx.findIndex(x=>x.id===editId);
    if(i>=0)state.tx[i]=t;
  } else state.tx.push(t);
  if(persist()){resetForm();render();toast(previous?'Transaksi diperbarui':'Transaksi ditambahkan');}
});
$('jenis').addEventListener('change',toggleTransfer);
$('txBody').addEventListener('click',e=>{
  const edit=e.target.closest('[data-edit]'),del=e.target.closest('[data-delete]');
  if(edit) {
    const t=state.tx.find(x=>x.id===edit.dataset.edit); if(!t)return;
    editId=t.id;$('txTitle').textContent='Ubah Transaksi';$('batalEdit').classList.remove('hidden');
    $('tanggal').value=t.date;$('jenis').value=t.type;$('dompet').value=t.wallet;
    $('tujuan').value=t.to||'';$('kategori').value=t.category;$('jumlah').value=t.amount;
    $('catatan').value=t.catatan||'';toggleTransfer();
    $('transaksi').scrollIntoView({behavior:'smooth'});
  }
  if(del&&confirm('Hapus transaksi ini?')) {
    const old=state.tx;state.tx=state.tx.filter(t=>t.id!==del.dataset.delete);
    if(persist()){render();toast('Transaksi dihapus');}else state.tx=old;
  }
});
$('batalEdit').addEventListener('click',resetForm);

/* Dompet dan anggaran */
$('walletForm').addEventListener('submit',e=>{
  e.preventDefault();const name=$('walletName').value.trim();
  if(!name)return toast('Nama dompet wajib diisi');
  state.wallet.push({id:uid(),name,balance:digits($('walletBalance').value)});
  if(persist()){e.target.reset();render();toast('Dompet ditambahkan');}
});
$('walletList').addEventListener('click',e=>{
  const b=e.target.closest('[data-delete-wallet]');if(!b)return;
  if(!confirm('Hapus dompet ini? Transaksi lama akan dipindahkan ke dompet utama.'))return;
  const oldWallet=state.wallet,oldTx=state.tx.map(t=>({...t}));
  const removed=b.dataset.deleteWallet;
  state.wallet=state.wallet.filter(w=>w.id!==removed);
  state.tx.forEach(t=>{
    if(t.wallet===removed)t.wallet=state.wallet[0].id;
    if(t.to===removed)t.to=state.wallet[0].id;
  });
  if(persist()){render();toast('Dompet dihapus');}else{state.wallet=oldWallet;state.tx=oldTx;}
});
$('budgetList').addEventListener('change',e=>{
  const input=e.target.closest('[data-budget]');if(!input)return;
  const month=today().slice(0,7),old=JSON.parse(JSON.stringify(state.budget));
  state.budget[month]||={};state.budget[month][input.dataset.budget]=digits(input.value);
  if(persist()){renderBudget();toast('Anggaran disimpan');}else state.budget=old;
});

/* Target, hutang/piutang, investasi */
$('targetForm').addEventListener('submit',e=>{
  e.preventDefault();const amount=digits($('targetAmount').value),name=$('targetName').value.trim();
  if(!name||!amount)return toast('Nama dan nominal target wajib diisi');
  state.target.push({id:uid(),name,amount,saved:digits($('targetSaved').value)});
  if(persist()){e.target.reset();render();toast('Target ditambahkan');}
});
$('targetList').addEventListener('click',e=>{
  const b=e.target.closest('[data-delete-target]');if(!b||!confirm('Hapus target ini?'))return;
  const old=state.target;state.target=state.target.filter(t=>t.id!==b.dataset.deleteTarget);
  if(persist())render();else state.target=old;
});
$('debtForm').addEventListener('submit',e=>{
  e.preventDefault();const amount=digits($('debtAmount').value),name=$('debtName').value.trim();
  if(!name||!amount)return toast('Nama dan jumlah wajib diisi');
  state.debt.push({id:uid(),type:$('debtType').value,name,amount,paid:0});
  if(persist()){e.target.reset();render();toast('Data hutang/piutang ditambahkan');}
});
$('debtList').addEventListener('click',e=>{
  const pay=e.target.closest('[data-pay-debt]'),del=e.target.closest('[data-delete-debt]');
  if(pay) {
    const d=state.debt.find(x=>x.id===pay.dataset.payDebt);if(!d)return;
    const answer=prompt('Jumlah pembayaran',String(Math.max(0,digits(d.amount)-digits(d.paid))));
    if(answer===null)return;
    const n=digits(answer);if(n<=0)return toast('Jumlah pembayaran tidak valid');
    const old=d.paid;d.paid=Math.min(digits(d.amount),digits(d.paid)+n);
    if(persist()){render();toast('Pembayaran dicatat');}else d.paid=old;
  }
  if(del&&confirm('Hapus data ini?')) {
    const old=state.debt;state.debt=state.debt.filter(d=>d.id!==del.dataset.deleteDebt);
    if(persist())render();else state.debt=old;
  }
});
$('investForm').addEventListener('submit',e=>{
  e.preventDefault();const cost=digits($('invCost').value),name=$('invName').value.trim();
  if(!name||cost<=0)return toast('Nama aset dan modal wajib diisi');
  const raw=$('invValue').value.trim();
  state.invest.push({id:uid(),name,category:$('invCategory').value,cost,value:raw===''?cost:digits(raw)});
  if(persist()){e.target.reset();render();toast('Investasi ditambahkan');}
});
$('invList').addEventListener('click',e=>{
  const b=e.target.closest('[data-delete-invest]');if(!b||!confirm('Hapus investasi ini?'))return;
  const old=state.invest;state.invest=state.invest.filter(x=>x.id!==b.dataset.deleteInvest);
  if(persist())render();else state.invest=old;
});

/* Harga BTC dan saldo alamat on-chain */
async function btcStatus() {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try {
    const r=await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=idr',{cache:'no-store',signal:controller.signal});
    if(!r.ok)throw Error(`HTTP ${r.status}`);
    const j=await r.json();if(!Number.isFinite(j?.bitcoin?.idr))throw Error('Respons harga tidak valid');
    $('btcStatus').textContent=`Harga BTC/IDR: ${rupiah(j.bitcoin.idr)} • CoinGecko`;
  } catch(e) {
    $('btcStatus').textContent='Harga BTC belum tersedia. Nilai investasi manual tetap dapat digunakan.';
    catatError(e,'CoinGecko');
  } finally {clearTimeout(timer);}
}
async function onchainBalance() {
  const address=$('onchainAddress').value.trim();if(!address)return;
  const valid=/^(bc1[ac-hj-np-z02-9]{11,71}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(address);
  if(!valid)return toast('Format alamat Bitcoin tidak valid');
  try {localStorage.setItem(K.onchain,address);}
  catch(e){catatError(e,'Simpan alamat BTC');return toast('Alamat tidak dapat disimpan di browser');}
  $('onchainStatus').textContent='Mengambil data on-chain…';
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try {
    const r=await fetch(`https://blockstream.info/api/address/${encodeURIComponent(address)}`,{signal:controller.signal});
    if(!r.ok)throw Error(`HTTP ${r.status}`);
    const j=await r.json();
    const sats=(j.chain_stats?.funded_txo_sum||0)-(j.chain_stats?.spent_txo_sum||0)
      +(j.mempool_stats?.funded_txo_sum||0)-(j.mempool_stats?.spent_txo_sum||0);
    $('onchainStatus').textContent=`Saldo on-chain: ${(sats/1e8).toFixed(8)} BTC • diperbarui ${new Date().toLocaleTimeString('id-ID')}`;
  } catch(e) {
    $('onchainStatus').textContent='Gagal mengambil saldo on-chain. Periksa koneksi internet atau coba lagi.';
    catatError(e,'Blockstream');
  } finally {clearTimeout(timer);}
}
$('onchainForm').addEventListener('submit',e=>{e.preventDefault();onchainBalance();});
$('onchainRefresh').addEventListener('click',onchainBalance);
$('onchainAddress').value=read(K.onchain,'');

/* Backup kompatibel: properti yang tidak ada pada backup lama tidak menimpa data lokal. */
function downloadBlob(blob,name) {
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('exportData').addEventListener('click',()=>{
  const backup={version:2,exportedAt:new Date().toISOString(),...state};
  downloadBlob(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}),`finku-backup-${today()}.json`);
});
$('importButton').addEventListener('click',()=>$('importFile').click());
$('importFile').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;
  const previous=state;
  try {
    const next=JSON.parse(await file.text());
    if(!next||typeof next!=='object'||Array.isArray(next))throw Error('File backup harus berupa objek JSON');
    const pick=(key,aliases,current,required=false)=>{
      let value=Object.prototype.hasOwnProperty.call(next,key)?next[key]:undefined;
      if(value===undefined)for(const alias of aliases)if(Object.prototype.hasOwnProperty.call(next,alias)){value=next[alias];break;}
      if(value===undefined){if(required)throw Error(`Bagian backup ${key} tidak ditemukan`);return current;}
      return value;
    };
    const candidate={
      tx:pick('tx',['transactions'],state.tx,true),
      wallet:pick('wallet',['wallets'],state.wallet,true),
      budget:pick('budget',['budgets'],state.budget),
      debt:pick('debt',['debts'],state.debt),
      invest:pick('invest',['investments'],state.invest),
      target:pick('target',['targets'],state.target)
    };
    if(!Array.isArray(candidate.tx)||!Array.isArray(candidate.wallet)||!candidate.wallet.length
      ||!Array.isArray(candidate.debt)||!Array.isArray(candidate.invest)||!Array.isArray(candidate.target)
      ||!candidate.budget||typeof candidate.budget!=='object'||Array.isArray(candidate.budget))
      throw Error('Struktur data backup tidak valid');
    if(candidate.wallet.some(w=>!w||typeof w!=='object'||!w.id||!w.name))
      throw Error('Data dompet tidak valid');
    if(candidate.tx.some(t=>!t||typeof t!=='object'||!t.id
      ||!['masuk','keluar','transfer'].includes(t.type)||!Number.isFinite(Number(t.amount))||Number(t.amount)<0))
      throw Error('Data transaksi tidak valid');
    state=candidate;
    if(!persist()) {state=previous;throw Error('Penyimpanan gagal; data sebelumnya dipertahankan');}
    load();render();toast('Backup berhasil dipulihkan.');
  } catch(err) {
    state=previous;catatError(err,'Impor backup');toast('Backup tidak valid: '+err.message);
  } finally {e.target.value='';}
});

/* Unduh HTML mandiri: gabungkan app.js ke salinan index.html yang sedang dibuka. */
$('downloadApp').addEventListener('click',async()=>{
  try {
    const response=await fetch(location.href);if(!response.ok)throw Error(`HTTP ${response.status}`);
    let html=await response.text();
    const jsResponse=await fetch(new URL('app.js',location.href));
    if(!jsResponse.ok)throw Error('File app.js tidak dapat diambil');
    const source=await jsResponse.text();
    const tag=/<script\s+src=["']app\.js["']\s*><\/script>/i;
    if(!tag.test(html))throw Error('Tag app.js tidak ditemukan pada halaman');
    html=html.replace(tag,`<script>\n${source}\n</script>`);
    downloadBlob(new Blob([html],{type:'text/html'}),'finku.html');
  } catch(e) {catatError(e,'Unduh aplikasi mandiri');toast('Gagal membuat HTML mandiri: '+e.message);}
});
$('resetAll').addEventListener('click',()=>{
  if(!confirm('Hapus SEMUA transaksi, dompet, budget, hutang, investasi, dan target? Tindakan ini tidak dapat dibatalkan.'))return;
  const backup={...state};
  Object.values(K).forEach(key=>localStorage.removeItem(key));
  state={tx:[],wallet:[{id:'utama',name:'Utama',balance:0}],budget:{},debt:[],invest:[],target:[]};
  if(persist()){resetForm();render();$('onchainAddress').value='';$('onchainStatus').textContent='Belum ada alamat yang dipantau.';toast('Semua data aplikasi telah dihapus.');}
  else state=backup;
});

$('debugToggle').addEventListener('click',()=>$('debugPanel').classList.toggle('hidden'));
document.querySelectorAll('.nav').forEach(a=>a.addEventListener('click',()=>{
  document.querySelectorAll('.nav').forEach(x=>x.classList.remove('active'));a.classList.add('active');
}));
window.addEventListener('resize',()=>renderChart());
window.addEventListener('error',e=>catatError(e.error||e.message,e.filename||'Runtime'));
window.addEventListener('unhandledrejection',e=>catatError(e.reason,'Promise'));
$('tanggalHariIni').textContent=new Date().toLocaleDateString('id-ID',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
$('tanggal').value=today();
load();toggleTransfer();resetForm();render();btcStatus();renderDebug();
