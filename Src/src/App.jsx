import { useState, useEffect, useRef, useCallback } from "react";

const formatCFA = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(n || 0)) + " F";
const MOIS_LABELS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const MOIS_SHORT = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

const getMois = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`; };
const moisDispos = Array.from({length:6},(_,i)=>{ const d=new Date(2026,2-i,1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }).reverse();
function useRipple() {
  const [ripples, setRipples] = useState([]);
  const trigger = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();
    setRipples(r => [...r, { id, x, y }]);
    setTimeout(() => setRipples(r => r.filter(rp => rp.id !== id)), 600);
  }, []);
  return [ripples, trigger];
}

function RippleBtn({ onClick, children, style, className }) {
  const [ripples, trigger] = useRipple();
  return (
    <button
      className={className}
      onClick={e => { trigger(e); onClick && onClick(e); }}
      style={{ position:"relative", overflow:"hidden", cursor:"pointer", border:"none", ...style }}
    >
      {ripples.map(r => (
        <span key={r.id} style={{
          position:"absolute", borderRadius:"50%",
          width:200, height:200,
          left: r.x - 100, top: r.y - 100,
          background:"rgba(255,255,255,0.25)",
          animation:"ripple 0.6s ease-out forwards",
          pointerEvents:"none"
        }} />
      ))}
      {children}
    </button>
  );
}

function PressCard({ onClick, children, style }) {
  const [pressed, setPressed] = useState(false);
  return (
    <div
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => { setPressed(false); onClick && onClick(); }}
      onPointerLeave={() => setPressed(false)}
      style={{
        cursor:"pointer", transition:"transform 0.15s cubic-bezier(.34,1.56,.64,1), box-shadow 0.15s",
        transform: pressed ? "scale(0.96)" : "scale(1)",
        boxShadow: pressed ? "0 2px 8px rgba(0,0,0,0.4)" : "0 0px 0px rgba(0,0,0,0)",
        ...style
      }}
    >
      {children}
    </div>
  );
}

function AnimNumber({ value, prefix="" }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current === value) return;
    const start = prev.current;
    const end = value;
    const dur = 600;
    const t0 = Date.now();
    const tick = () => {
      const elapsed = Date.now() - t0;
      const progress = Math.min(elapsed / dur, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (end - start) * ease));
      if (progress < 1) requestAnimationFrame(tick);
      else prev.current = end;
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <span>{prefix}{new Intl.NumberFormat("fr-FR").format(display)} F</span>;
}

function Toast({ msg, onDone }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => { const t = setTimeout(() => { setVisible(false); setTimeout(onDone,300); }, 2000); return ()=>clearTimeout(t); }, []);
  return (
    <div style={{
      position:"fixed", bottom:120, left:"50%", transform:`translateX(-50%) translateY(${visible?0:20}px)`,
      background:"rgba(196,160,255,0.95)", color:"#08080f", padding:"10px 20px", borderRadius:50,
      fontSize:13, fontWeight:700, zIndex:999, whiteSpace:"nowrap",
      opacity: visible?1:0, transition:"all 0.3s cubic-bezier(.34,1.56,.64,1)",
      boxShadow:"0 8px 32px rgba(196,160,255,0.4)"
    }}>{msg}</div>
  );
}
export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [prevTab, setPrevTab] = useState("dashboard");
  const [transactions, setTransactions] = useState([]);
  const [produits, setProduits] = useState([]);
  const [filtreMois, setFiltreMois] = useState(getMois());
  const [catsEntree, setCatsEntree] = useState(["Vente site web","Amazon/Etsy","Instagram","Autre"]);
  const [catsSortie, setCatsSortie] = useState(["Achat stock","Livraison","Publicité","Packaging","Frais plateforme","Photos/Contenu","Autre"]);
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState("entree");
  const [newCatName, setNewCatName] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type:"entree", montant:"", categorie:"", note:"", date:new Date().toISOString().split("T")[0] });
  const [showProduitForm, setShowProduitForm] = useState(false);
  const [produitForm, setProduitForm] = useState({ nom:"", prixVente:"", prixAchat:"", stock:"" });
  const [toast, setToast] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const showToast = (msg) => setToast({ msg, id: Date.now() });

  const txMois = transactions.filter(t => t.date.startsWith(filtreMois));
  const totalEntrees = txMois.filter(t=>t.type==="entree").reduce((s,t)=>s+t.montant,0);
  const totalSorties = txMois.filter(t=>t.type==="sortie").reduce((s,t)=>s+t.montant,0);
  const benefice = totalEntrees - totalSorties;
  const marge = totalEntrees > 0 ? ((benefice/totalEntrees)*100).toFixed(1) : 0;

  const statsSorties = catsSortie.map(cat=>({
    cat, total: txMois.filter(t=>t.type==="sortie"&&t.categorie===cat).reduce((s,t)=>s+t.montant,0)
  })).filter(s=>s.total>0).sort((a,b)=>b.total-a.total);
  const maxSortie = Math.max(...statsSorties.map(s=>s.total),1);

  const evolution = moisDispos.map(key => {
    const [,m] = key.split("-");
    const e = transactions.filter(t=>t.date.startsWith(key)&&t.type==="entree").reduce((s,t)=>s+t.montant,0);
    const so = transactions.filter(t=>t.date.startsWith(key)&&t.type==="sortie").reduce((s,t)=>s+t.montant,0);
    return { label: MOIS_SHORT[parseInt(m)-1], entrees:e, sorties:so };
  });
  const maxVal = Math.max(...evolution.map(e=>Math.max(e.entrees,e.sorties)),1);

  const addTransaction = () => {
    if (!form.montant || isNaN(form.montant) || !form.categorie) return;
    setTransactions(prev=>[...prev,{...form,id:Date.now(),montant:parseFloat(form.montant)}]);
    setShowForm(false);
    setForm({type:"entree",montant:"",categorie:"",note:"",date:new Date().toISOString().split("T")[0]});
    showToast(form.type==="entree" ? "✓ Entrée enregistrée" : "✓ Sortie enregistrée");
  };

  const deleteTransaction = (id) => {
    setDeletingId(id);
    setTimeout(() => {
      setTransactions(prev=>prev.filter(t=>t.id!==id));
      setDeletingId(null);
      showToast("Transaction supprimée");
    }, 350);
  };

  const addProduit = () => {
    if (!produitForm.nom) return;
    setProduits(prev=>[...prev,{...produitForm,id:Date.now(),prixVente:parseFloat(produitForm.prixVente)||0,prixAchat:parseFloat(produitForm.prixAchat)||0,stock:parseInt(produitForm.stock)||0}]);
    setShowProduitForm(false);
    setProduitForm({nom:"",prixVente:"",prixAchat:"",stock:""});
    showToast("✓ Produit ajouté");
  };

  const deleteProduit = (id) => { setProduits(prev=>prev.filter(p=>p.id!==id)); showToast("Produit supprimé"); };

  const addCat = () => {
    if (!newCatName.trim()) return;
    if (editingCat==="entree") setCatsEntree(prev=>[...prev.filter(c=>c!=="Autre"),newCatName.trim(),"Autre"]);
    else setCatsSortie(prev=>[...prev.filter(c=>c!=="Autre"),newCatName.trim(),"Autre"]);
    setNewCatName("");
    showToast("✓ Rubrique ajoutée");
  };

  const deleteCat = (cat) => {
    if (editingCat==="entree") setCatsEntree(prev=>prev.filter(c=>c!==cat));
    else setCatsSortie(prev=>prev.filter(c=>c!==cat));
  };

  const changeTab = (newTab) => { setPrevTab(tab); setTab(newTab); };

  const tabs = [
    { id:"dashboard", icon:"⌂", label:"Accueil" },
    { id:"transactions", icon:"⇅", label:"Flux" },
    { id:"produits", icon:"✦", label:"Produits" },
    { id:"stats", icon:"◎", label:"Stats" },
  ];

  const inp = {
    width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)",
    borderRadius:12, padding:"12px 14px", color:"#f0eee8", fontSize:14,
    transition:"border-color 0.2s, background 0.2s",
  };
  return (
    <div style={{fontFamily:"'DM Sans','Segoe UI',sans-serif",background:"#07070d",minHeight:"100vh",maxWidth:430,margin:"0 auto",color:"#f0eee8",position:"relative",overflowX:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Cormorant+Garamond:ital,wght@0,700;1,500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{display:none;}
        input,select{outline:none;font-family:inherit;}
        @keyframes ripple{to{transform:scale(2.5);opacity:0;}}
        @keyframes slideUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
        @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
        @keyframes popIn{from{opacity:0;transform:scale(0.92);}to{opacity:1;transform:scale(1);}}
        @keyframes slideOut{from{opacity:1;transform:translateX(0);}to{opacity:0;transform:translateX(-30px);}}
        @keyframes floatBadge{0%,100%{transform:translateY(0);}50%{transform:translateY(-3px);}}
        .slide-up{animation:slideUp 0.4s cubic-bezier(.22,1,.36,1);}
        .pop-in{animation:popIn 0.35s cubic-bezier(.34,1.56,.64,1);}
        .fade-in{animation:fadeIn 0.3s ease;}
        .deleting{animation:slideOut 0.35s ease forwards;}
        input:focus{border-color:rgba(196,160,255,0.5)!important;background:rgba(196,160,255,0.06)!important;}
        select:focus{border-color:rgba(196,160,255,0.5)!important;}
        .float-badge{animation:floatBadge 3s ease-in-out infinite;}
      `}</style>

      <div style={{background:"linear-gradient(160deg,#130b24 0%,#0c1628 60%,#07070d 100%)",padding:"54px 24px 26px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-60,right:-60,width:220,height:220,borderRadius:"50%",background:"radial-gradient(circle,rgba(255,175,200,0.1) 0%,transparent 70%)"}} />
        <div style={{position:"absolute",bottom:-30,left:-40,width:160,height:160,borderRadius:"50%",background:"radial-gradient(circle,rgba(196,160,255,0.08) 0%,transparent 70%)"}} />
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",position:"relative"}}>
          <div>
            <div style={{fontSize:9,letterSpacing:5,color:"rgba(196,160,255,0.7)",textTransform:"uppercase",marginBottom:6,fontWeight:500}}>Gestion · CFA</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:32,color:"#f0eee8",letterSpacing:-1,lineHeight:1}}>
              Ax_<em style={{color:"#ffb6c1",fontStyle:"italic"}}>beauty</em>
            </div>
          </div>
          <RippleBtn onClick={() => setShowCatModal(true)} style={{background:"rgba(196,160,255,0.1)",borderRadius:14,padding:"9px 16px",fontSize:11,color:"#c4a0ff",border:"1px solid rgba(196,160,255,0.2)",letterSpacing:0.5,fontWeight:600,fontFamily:"'DM Sans',sans-serif"}}>✎ Rubriques</RippleBtn>
        </div>
        <div style={{display:"flex",gap:16,marginTop:20,paddingTop:16,borderTop:"1px solid rgba(255,255,255,0.05)"}}>
          {[
            {label:"Entrées",val:totalEntrees,color:"#4ade80"},
            {label:"Sorties",val:totalSorties,color:"#f87171"},
            {label:"Bénéfice",val:benefice,color:benefice>=0?"#c4a0ff":"#fbbf24"},
          ].map(k=>(
            <div key={k.label} style={{flex:1}}>
              <div style={{fontSize:9,letterSpacing:2,color:"rgba(255,255,255,0.25)",textTransform:"uppercase",marginBottom:3}}>{k.label}</div>
              <div style={{fontSize:13,fontWeight:700,color:k.color}}>{formatCFA(k.val)}</div>
            </div>
          ))}
        </div>
      </div>
      {showCatModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={e=>e.target===e.currentTarget&&setShowCatModal(false)}>
          <div className="pop-in" style={{background:"linear-gradient(180deg,#161628 0%,#0f0f1e 100%)",borderRadius:"28px 28px 0 0",padding:26,width:"100%",maxWidth:430,maxHeight:"78vh",overflowY:"auto",border:"1px solid rgba(255,255,255,0.06)"}}>
            <div style={{width:36,height:4,background:"rgba(255,255,255,0.15)",borderRadius:4,margin:"0 auto 20px"}} />
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22}}>Rubriques</div>
              <RippleBtn onClick={()=>setShowCatModal(false)} style={{width:34,height:34,borderRadius:"50%",background:"rgba(255,255,255,0.06)",color:"#888",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</RippleBtn>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:20}}>
              {["entree","sortie"].map(t=>(
                <PressCard key={t} onClick={()=>setEditingCat(t)} style={{padding:"11px",borderRadius:14,textAlign:"center",fontSize:13,fontWeight:600,background:editingCat===t?(t==="entree"?"rgba(74,222,128,0.15)":"rgba(248,113,113,0.15)"):"rgba(255,255,255,0.03)",color:editingCat===t?(t==="entree"?"#4ade80":"#f87171"):"#444",border:`1px solid ${editingCat===t?(t==="entree"?"rgba(74,222,128,0.35)":"rgba(248,113,113,0.35)"):"rgba(255,255,255,0.06)"}`}}>
                  {t==="entree"?"↑ Entrées":"↓ Sorties"}
                </PressCard>
              ))}
            </div>
            <div style={{marginBottom:14}}>
              {(editingCat==="entree"?catsEntree:catsSortie).map((cat,i)=>(
                <div key={cat} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(255,255,255,0.03)",borderRadius:12,padding:"12px 16px",marginBottom:6,border:"1px solid rgba(255,255,255,0.05)"}}>
                  <span style={{fontSize:13,color:"#ccc"}}>{cat}</span>
                  {cat!=="Autre" && (
                    <RippleBtn onClick={()=>deleteCat(cat)} style={{width:28,height:28,borderRadius:8,background:"rgba(248,113,113,0.1)",color:"#f87171",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</RippleBtn>
                  )}
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:8}}>
              <input placeholder="Nouvelle rubrique..." value={newCatName} onChange={e=>setNewCatName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addCat()} style={{...inp,flex:1}}/>
              <RippleBtn onClick={addCat} style={{background:"linear-gradient(135deg,#c4a0ff,#9f70f0)",borderRadius:12,padding:"12px 18px",color:"#0a0514",fontWeight:800,fontSize:18,boxShadow:"0 4px 20px rgba(196,160,255,0.35)"}}>+</RippleBtn>
            </div>
          </div>
        </div>
      )}

      <div style={{padding:"0 0 100px",overflowY:"auto",maxHeight:"calc(100vh - 175px)"}}>
        {tab==="dashboard" && (
          <div className="slide-up" style={{padding:"18px 18px 0"}}>
            <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:6,marginBottom:18}}>
              {moisDispos.map(m=>{
                const [y,mo] = m.split("-");
                const active = filtreMois===m;
                return (
                  <PressCard key={m} onClick={()=>setFiltreMois(m)} style={{padding:"7px 14px",borderRadius:50,fontSize:11,whiteSpace:"nowrap",background:active?"linear-gradient(135deg,#c4a0ff,#9f70f0)":"rgba(255,255,255,0.05)",color:active?"#0a0514":"#666",fontWeight:active?700:400,border:`1px solid ${active?"transparent":"rgba(255,255,255,0.07)"}`,boxShadow:active?"0 4px 16px rgba(196,160,255,0.3)":"none"}}>
                    {MOIS_SHORT[parseInt(mo)-1]} {y}
                  </PressCard>
                );
              })}
            </div>
            <div className="float-badge" style={{background:benefice>=0?"linear-gradient(135deg,rgba(74,222,128,0.1),rgba(34,197,94,0.04))":"linear-gradient(135deg,rgba(248,113,113,0.1),rgba(239,68,68,0.04))",border:`1px solid ${benefice>=0?"rgba(74,222,128,0.2)":"rgba(248,113,113,0.2)"}`,borderRadius:24,padding:24,marginBottom:14,position:"relative",overflow:"hidden"}}>
              <div style={{fontSize:9,letterSpacing:3,color:benefice>=0?"#4ade80":"#f87171",textTransform:"uppercase",marginBottom:10,fontWeight:600}}>Bénéfice net du mois</div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:36,fontWeight:700,color:benefice>=0?"#4ade80":"#f87171",lineHeight:1}}>
                <AnimNumber value={benefice} />
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginTop:10}}>
                <div style={{height:4,flex:1,background:"rgba(255,255,255,0.06)",borderRadius:4,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${Math.min(parseFloat(marge),100)}%`,background:benefice>=0?"#4ade80":"#f87171",borderRadius:4,transition:"width 0.8s cubic-bezier(.22,1,.36,1)"}} />
                </div>
                <div style={{fontSize:12,color:"#c4a0ff",fontWeight:700}}>{marge}%</div>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18}}>
              {[
                {label:"Entrées",icon:"↑",val:totalEntrees,count:txMois.filter(t=>t.type==="entree").length,color:"#4ade80",bg:"rgba(74,222,128,0.08)",border:"rgba(74,222,128,0.15)"},
                {label:"Sorties",icon:"↓",val:totalSorties,count:txMois.filter(t=>t.type==="sortie").length,color:"#f87171",bg:"rgba(248,113,113,0.08)",border:"rgba(248,113,113,0.15)"},
              ].map((card,i)=>(
                <div key={card.label} className="slide-up" style={{background:card.bg,borderRadius:18,padding:16,border:`1px solid ${card.border}`,animationDelay:`${i*0.08}s`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                    <div style={{fontSize:10,letterSpacing:2,color:card.color,textTransform:"uppercase",fontWeight:600}}>{card.label}</div>
                    <div style={{width:28,height:28,borderRadius:8,background:card.bg,border:`1px solid ${card.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:card.color}}>{card.icon}</div>
                  </div>
                  <div style={{fontSize:16,fontWeight:700,color:"#f0eee8"}}>{formatCFA(card.val)}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.2)",marginTop:5}}>{card.count} opération{card.count>1?"s":""}</div>
                </div>
              ))}
            </div>
            {transactions.length===0 ? (
              <div style={{textAlign:"center",padding:"50px 20px"}}>
                <div style={{fontSize:48,opacity:0.08,marginBottom:14}}>✦</div>
                <div style={{fontSize:14,color:"#333"}}>Aucune transaction</div>
              </div>
            ) : (
              <>
                <div style={{fontSize:9,letterSpacing:3,color:"#2a2a2a",textTransform:"uppercase",marginBottom:12,fontWeight:600}}>Récentes</div>
                {transactions.slice(-4).reverse().map((t,i)=>(
                  <div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(255,255,255,0.025)",borderRadius:16,padding:"13px 15px",marginBottom:8,border:"1px solid rgba(255,255,255,0.04)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <div style={{width:38,height:38,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,background:t.type==="entree"?"rgba(74,222,128,0.1)":"rgba(248,113,113,0.1)"}}>{t.type==="entree"?"↑":"↓"}</div>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:"#ddd"}}>{t.categorie}</div>
                        <div style={{fontSize:10,color:"#303030",marginTop:2}}>{t.note||"—"}</div>
                      </div>
                    </div>
                    <div style={{fontSize:14,fontWeight:700,color:t.type==="entree"?"#4ade80":"#f87171"}}>{t.type==="entree"?"+":"-"}{formatCFA(t.montant)}</div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
        {tab==="transactions" && (
          <div className="slide-up" style={{padding:"18px 18px 0"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24}}>Transactions</div>
              <RippleBtn onClick={()=>{setForm(f=>({...f,categorie:catsEntree[0]}));setShowForm(true);}} style={{background:"linear-gradient(135deg,#c4a0ff,#9f70f0)",borderRadius:14,padding:"10px 18px",color:"#0a0514",fontSize:13,fontWeight:800,boxShadow:"0 4px 20px rgba(196,160,255,0.3)",fontFamily:"'DM Sans',sans-serif"}}>+ Ajouter</RippleBtn>
            </div>
            {showForm && (
              <div className="pop-in" style={{background:"linear-gradient(180deg,rgba(196,160,255,0.06),rgba(255,255,255,0.02))",borderRadius:22,padding:22,marginBottom:20,border:"1px solid rgba(196,160,255,0.15)"}}>
                <div style={{fontSize:12,color:"#c4a0ff",fontWeight:700,marginBottom:18,letterSpacing:1}}>NOUVELLE TRANSACTION</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
                  {["entree","sortie"].map(t=>(
                    <PressCard key={t} onClick={()=>setForm(f=>({...f,type:t,categorie:t==="entree"?catsEntree[0]:catsSortie[0]}))} style={{padding:"12px",borderRadius:14,textAlign:"center",fontSize:13,fontWeight:700,background:form.type===t?(t==="entree"?"rgba(74,222,128,0.15)":"rgba(248,113,113,0.15)"):"rgba(255,255,255,0.03)",color:form.type===t?(t==="entree"?"#4ade80":"#f87171"):"#3a3a3a",border:`1.5px solid ${form.type===t?(t==="entree"?"rgba(74,222,128,0.4)":"rgba(248,113,113,0.4)"):"rgba(255,255,255,0.05)"}`}}>
                      {t==="entree"?"↑ Entrée":"↓ Sortie"}
                    </PressCard>
                  ))}
                </div>
                {[
                  {label:"Montant (F CFA)",key:"montant",type:"number",placeholder:"Ex: 25 000"},
                  {label:"Note",key:"note",type:"text",placeholder:"Description..."},
                  {label:"Date",key:"date",type:"date"},
                ].map(f=>(
                  <div key={f.key} style={{marginBottom:12}}>
                    <div style={{fontSize:9,color:"#3a3a3a",marginBottom:5,letterSpacing:2,fontWeight:600}}>{f.label.toUpperCase()}</div>
                    <input type={f.type} placeholder={f.placeholder} value={form[f.key]} onChange={e=>setForm(prev=>({...prev,[f.key]:e.target.value}))} style={inp}/>
                  </div>
                ))}
                <div style={{marginBottom:18}}>
                  <div style={{fontSize:9,color:"#3a3a3a",marginBottom:5,letterSpacing:2,fontWeight:600}}>RUBRIQUE</div>
                  <select value={form.categorie} onChange={e=>setForm(f=>({...f,categorie:e.target.value}))} style={{...inp,background:"#0f0f1e"}}>
                    {(form.type==="entree"?catsEntree:catsSortie).map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <RippleBtn onClick={()=>setShowForm(false)} style={{flex:1,padding:13,borderRadius:14,background:"rgba(255,255,255,0.04)",color:"#555",fontSize:13,fontFamily:"'DM Sans',sans-serif"}}>Annuler</RippleBtn>
                  <RippleBtn onClick={addTransaction} style={{flex:2,padding:13,borderRadius:14,background:"linear-gradient(135deg,#c4a0ff,#9f70f0)",color:"#0a0514",fontWeight:800,fontSize:14,boxShadow:"0 4px 20px rgba(196,160,255,0.35)",fontFamily:"'DM Sans',sans-serif"}}>Enregistrer</RippleBtn>
                </div>
              </div>
            )}
            {transactions.length===0 ? (
              <div style={{textAlign:"center",padding:"60px 20px"}}>
                <div style={{fontSize:48,opacity:0.08,marginBottom:14}}>⇅</div>
                <div style={{fontSize:14,color:"#333"}}>Aucune transaction</div>
              </div>
            ) : transactions.slice().reverse().map((t,i)=>(
              <div key={t.id} className={`slide-up ${deletingId===t.id?"deleting":""}`} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(255,255,255,0.025)",borderRadius:16,padding:"14px 15px",marginBottom:8,border:`1px solid ${t.type==="entree"?"rgba(74,222,128,0.06)":"rgba(248,113,113,0.06)"}`}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:38,height:38,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,background:t.type==="entree"?"rgba(74,222,128,0.1)":"rgba(248,113,113,0.1)"}}>{t.type==="entree"?"↑":"↓"}</div>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:"#ddd"}}>{t.categorie}</div>
                    <div style={{fontSize:10,color:"#2a2a2a",marginTop:2}}>{t.note||"—"} · {t.date}</div>
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{fontSize:13,fontWeight:700,color:t.type==="entree"?"#4ade80":"#f87171"}}>{t.type==="entree"?"+":"-"}{formatCFA(t.montant)}</div>
                  <RippleBtn onClick={()=>deleteTransaction(t.id)} style={{width:28,height:28,borderRadius:8,background:"rgba(255,255,255,0.04)",color:"#2a2a2a",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</RippleBtn>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab==="produits" && (
          <div className="slide-up" style={{padding:"18px 18px 0"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24}}>Produits</div>
              <RippleBtn onClick={()=>setShowProduitForm(true)} style={{background:"linear-gradient(135deg,#c4a0ff,#9f70f0)",borderRadius:14,padding:"10px 18px",color:"#0a0514",fontSize:13,fontWeight:800,boxShadow:"0 4px 20px rgba(196,160,255,0.3)",fontFamily:"'DM Sans',sans-serif"}}>+ Produit</RippleBtn>
            </div>
            {showProduitForm && (
              <div className="pop-in" style={{background:"linear-gradient(180deg,rgba(196,160,255,0.06),rgba(255,255,255,0.02))",borderRadius:22,padding:22,marginBottom:20,border:"1px solid rgba(196,160,255,0.15)"}}>
                <div style={{fontSize:12,color:"#c4a0ff",fontWeight:700,marginBottom:18,letterSpacing:1}}>NOUVEAU PRODUIT</div>
                {[
                  {label:"Nom du produit",key:"nom",type:"text",placeholder:"Ex: Crème hydratante 50ml"},
                  {label:"Prix de vente (F CFA)",key:"prixVente",type:"number",placeholder:"15 000"},
                  {label:"Prix d'achat (F CFA)",key:"prixAchat",type:"number",placeholder:"5 000"},
                  {label:"Stock initial",key:"stock",type:"number",placeholder:"50"},
                ].map(f=>(
                  <div key={f.key} style={{marginBottom:12}}>
                    <div style={{fontSize:9,color:"#3a3a3a",marginBottom:5,letterSpacing:2,fontWeight:600}}>{f.label.toUpperCase()}</div>
                    <input type={f.type} placeholder={f.placeholder} value={produitForm[f.key]} onChange={e=>setProduitForm(prev=>({...prev,[f.key]:e.target.value}))} style={inp}/>
                  </div>
                ))}
                <div style={{display:"flex",gap:8,marginTop:6}}>
                  <RippleBtn onClick={()=>setShowProduitForm(false)} style={{flex:1,padding:13,borderRadius:14,background:"rgba(255,255,255,0.04)",color:"#555",fontSize:13,fontFamily:"'DM Sans',sans-serif"}}>Annuler</RippleBtn>
                  <RippleBtn onClick={addProduit} style={{flex:2,padding:13,borderRadius:14,background:"linear-gradient(135deg,#c4a0ff,#9f70f0)",color:"#0a0514",fontWeight:800,fontSize:14,boxShadow:"0 4px 20px rgba(196,160,255,0.35)",fontFamily:"'DM Sans',sans-serif"}}>Enregistrer</RippleBtn>
                </div>
              </div>
            )}
            {produits.length===0 ? (
              <div style={{textAlign:"center",padding:"60px 20px"}}>
                <div style={{fontSize:48,opacity:0.08,marginBottom:14}}>✦</div>
                <div style={{fontSize:14,color:"#333"}}>Aucun produit</div>
              </div>
            ) : produits.map((p,i)=>{
              const margeP = p.prixVente>0?(((p.prixVente-p.prixAchat)/p.prixVente)*100).toFixed(0):0;
              const stockOk = p.stock>=20;
              return (
                <div key={p.id} className="slide-up" style={{background:"rgba(255,255,255,0.025)",borderRadius:18,padding:18,marginBottom:12,border:`1px solid ${!stockOk?"rgba(251,191,36,0.15)":"rgba(255,255,255,0.04)"}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                    <div style={{fontSize:14,fontWeight:700,color:"#e0ddd6",flex:1,paddingRight:10}}>{p.nom}</div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{background:"rgba(196,160,255,0.12)",borderRadius:8,padding:"4px 10px",fontSize:11,color:"#c4a0ff",fontWeight:700}}>{margeP}%</div>
                      <RippleBtn onClick={()=>deleteProduit(p.id)} style={{width:28,height:28,borderRadius:8,background:"rgba(255,255,255,0.04)",color:"#2a2a2a",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</RippleBtn>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                    {[
                      {label:"VENTE",val:formatCFA(p.prixVente),color:"#4ade80"},
                      {label:"ACHAT",val:formatCFA(p.prixAchat),color:"#f87171"},
                      {label:"STOCK",val:`${p.stock} u.`,color:!stockOk?"#fbbf24":"#888"},
                    ].map(item=>(
                      <div key={item.label} style={{background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"10px 8px",textAlign:"center",border:"1px solid rgba(255,255,255,0.04)"}}>
                        <div style={{fontSize:8,color:"#2a2a2a",marginBottom:5,letterSpacing:2,fontWeight:700}}>{item.label}</div>
                        <div style={{fontSize:11,fontWeight:700,color:item.color}}>{item.val}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{marginTop:12}}>
                    <div style={{height:3,background:"rgba(255,255,255,0.05)",borderRadius:4,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${Math.min(margeP,100)}%`,background:"linear-gradient(90deg,#c4a0ff,#4ade80)",borderRadius:4}} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {tab==="stats" && (
          <div className="slide-up" style={{padding:"18px 18px 0"}}>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,marginBottom:20}}>Statistiques</div>
            <div style={{background:"rgba(255,255,255,0.02)",borderRadius:22,padding:20,marginBottom:14,border:"1px solid rgba(255,255,255,0.04)"}}>
              <div style={{fontSize:9,letterSpacing:3,color:"#2a2a2a",textTransform:"uppercase",marginBottom:18,fontWeight:700}}>Évolution 6 mois</div>
              {transactions.length===0 ? (
                <div style={{textAlign:"center",padding:"30px 0",color:"#222",fontSize:13}}>Pas encore de données</div>
              ):(
                <>
                  <div style={{display:"flex",alignItems:"flex-end",gap:6,height:96,paddingBottom:4}}>
                    {evolution.map((m,i)=>(
                      <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center"}}>
                        <div style={{width:"100%",display:"flex",gap:"8%",alignItems:"flex-end",height:78,justifyContent:"center"}}>
                          <div style={{width:"40%",background:"linear-gradient(180deg,#f87171,rgba(248,113,113,0.4))",borderRadius:"4px 4px 0 0",height:`${(m.sorties/maxVal)*74}px`,minHeight:m.sorties>0?4:0,opacity:0.9}}/>
                          <div style={{width:"40%",background:"linear-gradient(180deg,#4ade80,rgba(74,222,128,0.4))",borderRadius:"4px 4px 0 0",height:`${(m.entrees/maxVal)*74}px`,minHeight:m.entrees>0?4:0,opacity:0.9}}/>
                        </div>
                        <div style={{fontSize:9,color:"#2a2a2a",marginTop:8,fontWeight:600}}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{display:"flex",gap:16,marginTop:12}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,fontSize:10,color:"#444"}}><div style={{width:10,height:10,borderRadius:3,background:"#4ade80"}}/>Entrées</div>
                    <div style={{display:"flex",alignItems:"center",gap:6,fontSize:10,color:"#444"}}><div style={{width:10,height:10,borderRadius:3,background:"#f87171"}}/>Sorties</div>
                  </div>
                </>
              )}
            </div>
            <div style={{background:"rgba(255,255,255,0.02)",borderRadius:22,padding:20,marginBottom:14,border:"1px solid rgba(255,255,255,0.04)"}}>
              <div style={{fontSize:9,letterSpacing:3,color:"#2a2a2a",textTransform:"uppercase",marginBottom:18,fontWeight:700}}>Dépenses — {MOIS_LABELS[parseInt(filtreMois.split("-")[1])-1]}</div>
              {statsSorties.length===0 ? (
                <div style={{textAlign:"center",padding:"20px 0",color:"#222",fontSize:13}}>Aucune dépense ce mois</div>
              ) : statsSorties.map((s,i)=>(
                <div key={s.cat} style={{marginBottom:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
                    <div style={{fontSize:12,color:"#888"}}>{s.cat}</div>
                    <div style={{fontSize:12,color:"#f87171",fontWeight:700}}>{formatCFA(s.total)}</div>
                  </div>
                  <div style={{background:"rgba(255,255,255,0.04)",borderRadius:6,height:5,overflow:"hidden"}}>
                    <div style={{height:"100%",borderRadius:6,background:`linear-gradient(90deg,hsl(${310-i*35},65%,60%),hsl(${280-i*35},70%,65%))`,width:`${(s.total/maxSortie)*100}%`}}/>
                  </div>
                </div>
              ))}
            </div>
            <div style={{background:"rgba(255,255,255,0.02)",borderRadius:22,padding:20,marginBottom:10,border:"1px solid rgba(255,255,255,0.04)"}}>
              <div style={{fontSize:9,letterSpacing:3,color:"#2a2a2a",textTransform:"uppercase",marginBottom:16,fontWeight:700}}>Indicateurs clés</div>
              {[
                {label:"Marge nette",val:`${marge}%`,good:parseFloat(marge)>=40,sub:"Objectif > 40%"},
                {label:"Chiffre d'affaires",val:formatCFA(totalEntrees),good:true,sub:"Ce mois"},
                {label:"Dépenses totales",val:formatCFA(totalSorties),good:totalSorties<=totalEntrees,sub:"Ce mois"},
                {label:"Stock faible",val:`${produits.filter(p=>p.stock<20).length} produit(s)`,good:produits.filter(p=>p.stock<20).length===0,sub:"Objectif : 0"},
              ].map((kpi,i)=>(
                <div key={kpi.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 0",borderBottom:"1px solid rgba(255,255,255,0.035)"}}>
                  <div>
                    <div style={{fontSize:13,color:"#aaa",fontWeight:500}}>{kpi.label}</div>
                    <div style={{fontSize:9,color:"#2a2a2a",marginTop:3,letterSpacing:1}}>{kpi.sub}</div>
                  </div>
                  <div style={{fontSize:15,fontWeight:800,color:kpi.good?"#4ade80":"#fbbf24",background:kpi.good?"rgba(74,222,128,0.08)":"rgba(251,191,36,0.08)",padding:"5px 12px",borderRadius:10,border:`1px solid ${kpi.good?"rgba(74,222,128,0.15)":"rgba(251,191,36,0.15)"}`}}>{kpi.val}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:"rgba(7,7,13,0.96)",backdropFilter:"blur(24px)",borderTop:"1px solid rgba(255,255,255,0.04)",display:"grid",gridTemplateColumns:"repeat(4,1fr)",padding:"12px 0 24px"}}>
        {tabs.map(t=>{
          const active = tab===t.id;
          return (
            <PressCard key={t.id} onClick={()=>changeTab(t.id)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,padding:"6px 4px",borderRadius:0}}>
              <div style={{width:40,height:36,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,background:active?"linear-gradient(135deg,rgba(196,160,255,0.2),rgba(159,112,240,0.1))":"transparent",color:active?"#c4a0ff":"#242424",border:active?"1px solid rgba(196,160,255,0.2)":"1px solid transparent",transition:"all 0.3s cubic-bezier(.34,1.56,.64,1)",transform:active?"scale(1.1)":"scale(1)",boxShadow:active?"0 4px 16px rgba(196,160,255,0.2)":"none"}}>{t.icon}</div>
              <div style={{fontSize:9,letterSpacing:0.5,color:active?"#c4a0ff":"#242424",fontWeight:active?700:400}}>{t.label}</div>
            </PressCard>
          );
        })}
      </div>

      {toast && <Toast key={toast.id} msg={toast.msg} onDone={()=>setToast(null)} />}
    </div>
  );
}


