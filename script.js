(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine=matchMedia('(pointer:fine)').matches;
  // Storage can be blocked in some privacy modes or embedded previews. Never let it stop the site.
  const safeSession={get(k){try{return sessionStorage.getItem(k)}catch(_){return null}},set(k,v){try{sessionStorage.setItem(k,v)}catch(_){}}};

  // ---------------- Intro cinema ----------------
  const loader=$('#premiumLoader'), loaderLine=$('#loaderProgress'), loaderCount=$('#loaderCount');
  if(loader){
    const seen=safeSession.get('orisV6Intro');
    if(seen||reduced){loader.classList.add('done')}
    else{
      const start=performance.now();
      const run=now=>{
        const t=Math.min(1,(now-start)/1180), eased=1-Math.pow(1-t,3), n=Math.floor(eased*100);
        if(loaderLine)loaderLine.style.width=n+'%'; if(loaderCount)loaderCount.textContent=String(n).padStart(3,'0');
        if(t<1)requestAnimationFrame(run); else setTimeout(()=>{loader.classList.add('done');safeSession.set('orisV6Intro','1')},160);
      };
      requestAnimationFrame(run);
    }
  }

  // ---------------- Header / progress ----------------
  const header=$('#siteHeader'), progress=$('#readProgress');
  const syncScroll=()=>{
    header?.classList.toggle('scrolled',scrollY>14);
    if(progress){const max=document.documentElement.scrollHeight-innerHeight;progress.style.width=`${max>0?Math.min(100,Math.max(0,scrollY/max*100)):0}%`}
  };
  addEventListener('scroll',syncScroll,{passive:true});syncScroll();

  // ---------------- Cinematic fullscreen menu ----------------
  const menu=$('#cinemaMenu'), menuBtn=$('#cinemaMenuButton'), menuClose=$('#cinemaMenuClose');
  if(menu&&menuBtn){
    const links=$$('.cinema-menu__nav a',menu);
    const a=$('#cinemaPreviewA'),b=$('#cinemaPreviewB'),counter=$('#cinemaMenuCounter'),kicker=$('#cinemaMenuKicker'),title=$('#cinemaMenuTitle'),copy=$('#cinemaMenuCopy');
    let useB=false,lastFocus=null;
    const focusables=()=>$$('a,button,[tabindex]:not([tabindex="-1"])',menu).filter(el=>!el.hasAttribute('disabled'));
    const updatePreview=(link,index)=>{
      const src=link.dataset.image||'hero-1.webp';
      const target=useB?a:b;
      if(target){target.src=src;menu.classList.toggle('preview-b',!useB);useB=!useB}
      if(counter)counter.textContent=`${String(index+1).padStart(2,'0')} / ${String(links.length).padStart(2,'0')}`;
      if(kicker)kicker.textContent=link.dataset.kicker||'ORIS BAT PRO';
      if(title)title.textContent=link.querySelector('b')?.textContent||'ORIS BAT PRO';
      if(copy)copy.textContent=link.dataset.copy||'';
    };
    const openMenu=()=>{
      lastFocus=document.activeElement;document.body.classList.add('cinema-menu-open','menu-open');menu.setAttribute('aria-hidden','false');menuBtn.setAttribute('aria-expanded','true');menuBtn.setAttribute('aria-label','Fermer le menu');
      setTimeout(()=>links[0]?.focus({preventScroll:true}),260);
    };
    const closeMenu=()=>{
      document.body.classList.remove('cinema-menu-open','menu-open');menu.setAttribute('aria-hidden','true');menuBtn.setAttribute('aria-expanded','false');menuBtn.setAttribute('aria-label','Ouvrir le menu');
      if(lastFocus&&document.contains(lastFocus))lastFocus.focus({preventScroll:true});
    };
    menuBtn.addEventListener('click',()=>document.body.classList.contains('cinema-menu-open')?closeMenu():openMenu());
    menuClose?.addEventListener('click',closeMenu);
    links.forEach((link,i)=>{
      ['pointerenter','focus'].forEach(evt=>link.addEventListener(evt,()=>updatePreview(link,i)));
      link.addEventListener('click',closeMenu);
    });
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&document.body.classList.contains('cinema-menu-open')){e.preventDefault();closeMenu()}
      if(e.key==='Tab'&&document.body.classList.contains('cinema-menu-open')){
        const fs=focusables();if(!fs.length)return;const first=fs[0],last=fs[fs.length-1];
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
      }
    });
    updatePreview(links[0],0);
  }

  // ---------------- Active nav ----------------
  const current=location.pathname.split('/').pop()||'index.html';
  $$('.v6-quick-nav a,.cinema-menu__nav a').forEach(link=>{
    const href=link.getAttribute('href');
    if(href===current){link.classList.add('active');link.setAttribute('aria-current','page')}
  });

  // ---------------- Reveal observer ----------------
  if('IntersectionObserver'in window){
    const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible','visible');io.unobserve(e.target)}}),{threshold:.1,rootMargin:'0px 0px -32px 0px'});
    $$('.reveal').forEach(el=>io.observe(el));
  }else $$('.reveal').forEach(el=>el.classList.add('is-visible','visible'));

  // ---------------- Cursor ----------------
  const cd=$('#cursorDot'),cr=$('#cursorRing');
  if(fine&&!reduced&&cd&&cr){
    document.body.classList.add('cursor-on');let mx=-100,my=-100,rx=-100,ry=-100;
    addEventListener('pointermove',e=>{mx=e.clientX;my=e.clientY;cd.style.transform=`translate3d(${mx}px,${my}px,0)`},{passive:true});
    const frame=()=>{rx+=(mx-rx)*.14;ry+=(my-ry)*.14;cr.style.transform=`translate3d(${rx}px,${ry}px,0)`;requestAnimationFrame(frame)};frame();
    const bind=()=>$$('a,button,label,.viewer360,.compare input').forEach(el=>{if(el.dataset.cursorBound)return;el.dataset.cursorBound='1';el.addEventListener('pointerenter',()=>document.body.classList.add('cursor-hover'));el.addEventListener('pointerleave',()=>document.body.classList.remove('cursor-hover'))});bind();
  }

  // ---------------- Hero depth camera ----------------
  const heroDepth=$('.hero-depth');
  if(heroDepth&&!reduced){
    let tx=0,ty=0,cx=0,cy=0;
    if(fine)addEventListener('pointermove',e=>{tx=((e.clientX/innerWidth)-.5)*3.5;ty=-((e.clientY/innerHeight)-.5)*2.6},{passive:true});
    const animate=()=>{cx+=(tx-cx)*.055;cy+=(ty-cy)*.055;heroDepth.style.setProperty('--ry',`${cx}deg`);heroDepth.style.setProperty('--rx',`${cy}deg`);requestAnimationFrame(animate)};animate();
    addEventListener('scroll',()=>{const y=Math.min(scrollY,900);$$('.hero-depth .layer').forEach((l,i)=>l.style.marginTop=`${y*(i?.135:.075)}px`)},{passive:true});
  }

  // ---------------- 3D tilt and magnetic UI ----------------
  if(fine&&!reduced){
    $$('[data-tilt]').forEach(card=>{
      card.addEventListener('pointermove',e=>{const r=card.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;card.style.transform=`perspective(1100px) rotateX(${-y*6.5}deg) rotateY(${x*8.5}deg) translateY(-3px)`});
      card.addEventListener('pointerleave',()=>card.style.transform='');
    });
    $$('.magnetic').forEach(el=>{
      el.addEventListener('pointermove',e=>{const r=el.getBoundingClientRect(),x=e.clientX-(r.left+r.width/2),y=e.clientY-(r.top+r.height/2);el.style.transform=`translate(${x*.12}px,${y*.12}px)`});
      el.addEventListener('pointerleave',()=>el.style.transform='');
    });
  }

  // ---------------- Compare ----------------
  const compare=$('.compare'),slider=$('#compareSlider');
  if(compare&&slider){const set=v=>compare.style.setProperty('--split',`${v}%`);set(slider.value);slider.addEventListener('input',()=>set(slider.value))}

  // ---------------- FAQ ----------------
  $$('.faq-list').forEach(list=>$$('details',list).forEach(d=>d.addEventListener('toggle',()=>{if(d.open)$$('details',list).forEach(o=>{if(o!==d)o.open=false})})));

  // ---------------- Existing Project Lab ----------------
  const lab=$('#projectLab');
  if(lab){
    const rt=$('#labResultTitle'),rc=$('#labResultCopy'),tags=$('#labResultTags'),toQuote=$('#labToQuote');
    const read=n=>lab.querySelector(`input[name="${n}"]:checked`)?.value||'';
    const names={terrassement:'Terrassement',maconnerie:'Maçonnerie',facade:'Façades & isolation',exterieur:'Aménagement extérieur',large:'Accès facile',medium:'Accès moyen',tight:'Accès étroit',flat:'Terrain plat',light:'Légère pente',slope:'Terrain en pente',soon:'Projet proche',months:'1 à 3 mois',later:'Projet à préparer'};
    const serviceMap={terrassement:'terrassement',maconnerie:'maconnerie',facade:'facades-isolation',exterieur:'amenagement-exterieur'};
    const update=()=>{const s=read('lab_service'),a=read('lab_access'),p=read('lab_slope'),d=read('lab_timing');if(![s,a,p,d].every(Boolean)){rt.textContent='Complétez les 4 critères';rc.textContent='Votre synthèse apparaîtra ici.';tags.innerHTML='';toQuote.href='devis.html';return}let profile='Profil simple';if(a==='tight'||p==='slope')profile='Préparation à vérifier';if(a==='tight'&&p==='slope')profile='Profil technique à étudier';rt.textContent=profile;rc.textContent=`${names[s]} · ${names[a]} · ${names[p]} · ${names[d]}. Cette synthèse prépare le premier échange, sans donner d’avis technique.`;tags.innerHTML=[names[s],names[a],names[p],names[d]].map(x=>`<span>${x}</span>`).join('');toQuote.href=`devis.html?service=${serviceMap[s]}&access=${a}&slope=${p}&timing=${d}`};
    $$('input',lab).forEach(i=>i.addEventListener('change',update));update();
  }

  // ---------------- Project Passport ----------------
  const passport=$('#passportForm');
  if(passport){
    const prog=$('#passportProgress'),stepLabel=$('#passportStepLabel'),code=$('#passportCode'),ptitle=$('#passportTitle'),pcopy=$('#passportCopy'),roadmap=$('#passportRoadmap'),summary=$('#passportSummary'),toQuote=$('#passportToQuote'),copyBtn=$('#passportCopyButton');
    const fields=['p_service','p_building','p_access','p_slope','p_delay','p_city'];
    const value=n=>{const f=passport.elements[n];return f instanceof RadioNodeList?f.value:(f?.value||'').trim()};
    const mapService={'Terrassement':'terrassement','Maçonnerie':'maconnerie','Façades & isolation':'facades-isolation','Aménagement extérieur':'amenagement-exterieur'};
    const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const buildRoadmap=s=>{
      if(s==='Terrassement')return['Échange','Accès','Niveaux','Terrassement','Évacuation'];
      if(s==='Maçonnerie')return['Échange','Support','Préparation','Maçonnerie','Finition'];
      if(s==='Façades & isolation')return['Échange','Support','Préparation','Façade','Finition'];
      if(s==='Aménagement extérieur')return['Échange','Terrain','Niveaux','Ouvrages','Abords'];
      return['Projet','Étude','Organisation','Travaux'];
    };
    const update=()=>{
      const vals=Object.fromEntries(fields.map(f=>[f,value(f)]));const done=Object.values(vals).filter(Boolean).length;
      prog.style.width=`${done/fields.length*100}%`;stepLabel.textContent=`${done} / ${fields.length} critères renseignés`;
      const ref=`ORIS-${new Date().getFullYear()}-${(vals.p_city||'PROJET').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5)||'PROJET'}-${String((vals.p_service||'X').length*137+done*19).padStart(4,'0').slice(-4)}`;
      code.textContent=done?ref:'PROJET — EN PRÉPARATION';
      ptitle.textContent=done===fields.length?'Passeport prêt à transmettre':done?'Passeport en construction':'Complétez votre projet';
      pcopy.textContent=done===fields.length?`${vals.p_service} pour ${vals.p_building.toLowerCase()} à ${vals.p_city}. Accès : ${vals.p_access.toLowerCase()}. Terrain : ${vals.p_slope.toLowerCase()}. Délai : ${vals.p_delay.toLowerCase()}.`: 'Votre synthèse se construit au fur et à mesure. Aucun prix ou diagnostic technique n’est calculé.';
      roadmap.innerHTML=buildRoadmap(vals.p_service).map(x=>`<span>${esc(x)}</span>`).join('');
      summary.innerHTML=[['Besoin',vals.p_service],['Bien',vals.p_building],['Accès',vals.p_access],['Terrain',vals.p_slope],['Délai',vals.p_delay],['Commune',vals.p_city]].map(([k,v])=>`<div><small>${k}</small><b>${esc(v||'—')}</b></div>`).join('');
      const params=new URLSearchParams();if(vals.p_service)params.set('service',mapService[vals.p_service]||'');if(vals.p_access&&vals.p_access!=='Je ne sais pas'){params.set('access',vals.p_access.includes('Étroit')?'tight':vals.p_access.includes('Moyen')?'medium':'large')}if(vals.p_slope&&vals.p_slope!=='Je ne sais pas'){params.set('slope',vals.p_slope==='En pente'?'slope':vals.p_slope==='Légère pente'?'light':'flat')}if(vals.p_city)params.set('city',vals.p_city);if(vals.p_delay)params.set('passport_delay',vals.p_delay==='À préparer'?'Plus tard':vals.p_delay);toQuote.href=`devis.html?${params.toString()}`;
    };
    $$('input',passport).forEach(i=>i.addEventListener('change',update));$('input[name="p_city"]',passport)?.addEventListener('input',update);update();
    copyBtn?.addEventListener('click',async()=>{const text=`${code.textContent}\n${ptitle.textContent}\n${pcopy.textContent}`;try{await navigator.clipboard.writeText(text);copyBtn.textContent='Résumé copié ✓';setTimeout(()=>copyBtn.textContent='Copier le résumé',1800)}catch(_){copyBtn.textContent='Copie indisponible'}});
  }

  // ---------------- Quote form V18 ----------------
  const form=$('#quoteForm');
  if(form){
    const status=$('#quoteStatus'),send=$('#sendQuote'),files=$('#quoteFiles'),filesInfo=$('#filesInfo');
    let lastSubmit=0;const startedAt=Date.now();
    const params=new URLSearchParams(location.search);
    const serviceMap={'terrassement':'Terrassement','maconnerie':'Maçonnerie','facades-isolation':'Façades & isolation','amenagement-exterieur':'Aménagement extérieur'};
    const req=params.get('service');if(req&&serviceMap[req]){const r=form.querySelector(`input[name="service"][value="${serviceMap[req]}"]`);if(r)r.checked=true}
    if(params.get('city')&&form.elements.commune)form.elements.commune.value=params.get('city');
    const accessMap={large:'Large / facile',medium:'Moyen',tight:'Étroit'},slopeMap={flat:'Non',light:'Légèrement',slope:'Oui'};
    if(accessMap[params.get('access')]&&form.elements.access)form.elements.access.value=accessMap[params.get('access')];
    if(slopeMap[params.get('slope')]&&form.elements.slope)form.elements.slope.value=slopeMap[params.get('slope')];
    try{const saved=JSON.parse(localStorage.getItem('orisV18PreparedProject')||'{}');if(saved.service&&!form.querySelector('input[name="service"]:checked')){const r=form.querySelector(`input[name="service"][value="${saved.service}"]`);if(r)r.checked=true}if(saved.commune&&!form.elements.commune.value)form.elements.commune.value=saved.commune;if(saved.description&&!form.elements.description.value)form.elements.description.value=saved.description;if(saved.access&&form.elements.access&&!form.elements.access.value)form.elements.access.value=saved.access;if(saved.delay&&form.elements.delay&&!form.elements.delay.value)form.elements.delay.value=saved.delay}catch(_){}
    const value=name=>{const f=form.elements[name];if(!f)return'';return f instanceof RadioNodeList?f.value:f.value};
    const show=(type,msg)=>{status.className=`form-status show ${type}`;status.innerHTML=msg},clear=()=>{status.className='form-status';status.innerHTML=''};
    const validate=()=>{for(const field of $$('[required]',form)){const ok=field.type==='radio'?!!form.querySelector(`input[name="${field.name}"]:checked`):field.type==='checkbox'?field.checked:(String(field.value||'').trim()!==''&&field.validity.valid);if(!ok){show('error','Merci de compléter les champs obligatoires marqués d’un astérisque.');field.closest('label,fieldset')?.scrollIntoView({behavior:'smooth',block:'center'});field.focus?.();return false}}clear();return true};
    files?.addEventListener('change',()=>{const list=[...files.files],maxEach=5*1024*1024,total=list.reduce((n,f)=>n+f.size,0),typeOK=list.every(f=>['image/jpeg','image/png','image/webp'].includes(f.type));if(list.length>5||list.some(f=>f.size>maxEach)||total>8*1024*1024||!typeOK){files.value='';filesInfo.textContent='Sélection refusée : 5 images max, 5 Mo chacune, 8 Mo au total.';show('error','Réduisez le nombre ou la taille des photos et utilisez JPG, PNG ou WEBP.');return}filesInfo.textContent=list.length?`${list.length} photo${list.length>1?'s':''} sélectionnée${list.length>1?'s':''}`:'5 images max · 5 Mo chacune · 8 Mo au total';clear()});
    form.addEventListener('submit',async e=>{e.preventDefault();if(!validate())return;if(form.elements._honey?.value)return;if(Date.now()-startedAt<1800){show('error','Vérifiez votre demande puis réessayez.');return}if(Date.now()-lastSubmit<60000){show('error','Une demande vient déjà d’être envoyée. Attendez une minute avant de recommencer.');return}lastSubmit=Date.now();send.disabled=true;show('success','Envoi de votre demande en cours…');const fd=new FormData(form);fd.append('_subject',`Nouvelle demande ORIS BAT PRO — ${value('service')} — ${value('commune')}`);fd.append('_template','table');let ok=false;for(let attempt=0;attempt<2&&!ok;attempt++){try{const res=await fetch('https://formsubmit.co/ajax/Orisbatpro@gmail.com',{method:'POST',body:fd,headers:{Accept:'application/json'}});if(res.ok){const data=await res.json().catch(()=>null);ok=data?data.success!==false:true}}catch(_){}if(!ok&&attempt===0)await new Promise(r=>setTimeout(r,900))}if(ok){show('success','✅ Votre demande a été transmise. Si votre projet est urgent, vous pouvez aussi appeler le <a href="tel:0695238453">06 95 23 84 53</a>.');form.reset();if(filesInfo)filesInfo.textContent='5 images max · 5 Mo chacune · 8 Mo au total';try{localStorage.removeItem('orisV18PreparedProject')}catch(_){}}else show('error','❌ L’envoi n’a pas abouti. Appelez le <a href="tel:0695238453">06 95 23 84 53</a> ou écrivez à <a href="mailto:Orisbatpro@gmail.com">Orisbatpro@gmail.com</a>.');send.disabled=false});
  }

  // ---------------- REALSITE watchdog: graceful photo fallback if WebGL/CDN cannot boot ----------------
  const viewerWatch=[...document.querySelectorAll('[data-viewer360]')];
  if(viewerWatch.length)setTimeout(()=>viewerWatch.forEach(v=>{if(v.classList.contains('v6-viewer-ready'))return;v.classList.add('v6-viewer-fallback-mode');const l=v.querySelector('.viewer-loading');if(l){l.querySelector('b').textContent='Mode photo activé';l.querySelector('span').textContent='La 3D n’est pas disponible sur cet appareil. Le mode photo prend automatiquement le relais.';setTimeout(()=>l.style.display='none',1800)}const s=v.querySelector('.v6-viewer__status span');if(s)s.textContent='REALSITE / MODE PHOTO'}),8000);

  // ---------------- PWA ----------------
  if('serviceWorker'in navigator&&location.protocol==='https:')addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
})();


// ================= V10 BLACK LABEL EXPERIENCE =================
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];

  // Cinematic menu search — fully local, instant, keyboard/touch accessible.
  const search=$('#cinemaMenuSearch'), count=$('#cinemaSearchCount'), nav=$('.cinema-menu__nav');
  if(search&&nav){
    const links=$$('a',nav);
    const normalize=s=>(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const apply=()=>{
      const q=normalize(search.value.trim()); let visible=0;
      links.forEach(link=>{const hay=normalize(`${link.textContent} ${link.dataset.kicker||''} ${link.dataset.copy||''}`);const show=!q||hay.includes(q);link.classList.toggle('search-hidden',!show);if(show)visible++;});
      if(count)count.textContent=q?`${visible} résultat${visible>1?'s':''}`:`${links.length} pages`;
    };
    search.addEventListener('input',apply); apply();
    document.addEventListener('keydown',e=>{
      if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)&&document.body.classList.contains('cinema-menu-open')){e.preventDefault();search.focus();}
    });
  }

  // Material Lab
  const preview=$('#materialPreview');
  if(preview){
    const summary=$('#materialSummary'),hud=$('#materialHud'),quote=$('#materialQuoteLink');
    const labels={facade:{mineral:'Minéral',sand:'Sable',light:'Clair',graphite:'Graphite'},ground:{gravel:'Gravier',paver:'Pavé clair',dark:'Graphite'},light:{morning:'Matin',day:'Journée',golden:'Fin de journée'}};
    const state={facade:'mineral',ground:'gravel',light:'day'};
    const render=()=>{preview.dataset.facade=state.facade;preview.dataset.ground=state.ground;preview.dataset.light=state.light;const text=`${labels.facade[state.facade]} · ${labels.ground[state.ground]} · ${labels.light[state.light]}`;if(summary)summary.textContent=text;if(hud)hud.textContent=text.toUpperCase();if(quote){const p=new URLSearchParams({preference_facade:labels.facade[state.facade],preference_sol:labels.ground[state.ground],preference_lumiere:labels.light[state.light]});quote.href=`devis.html?${p}`}};
    $$('[data-material-group]').forEach(group=>$$('button',group).forEach(btn=>btn.addEventListener('click',()=>{const type=group.dataset.materialGroup;state[type]=btn.dataset.material;$$('button',group).forEach(b=>b.classList.toggle('active',b===btn));render()})));
    $$('[data-lightpreset]').forEach(btn=>btn.addEventListener('click',()=>{state.light=btn.dataset.lightpreset;$$('[data-lightpreset]').forEach(b=>b.classList.toggle('active',b===btn));render()}));render();
  }

  // Guide checklist
  const checks=$('#guideChecks');
  if(checks){
    const inputs=$$('input[type="checkbox"]',checks),ring=$('#guideRing'),pct=$('#guidePercent'),title=$('#guideTitle'),readyLabel=$('#guideReadyLabel'),readyTitle=$('#guideReadyTitle'),reset=$('#guideReset');
    const render=()=>{const done=inputs.filter(i=>i.checked).length,total=inputs.length,p=Math.round(done/total*100),circ=314.159;if(ring)ring.style.strokeDashoffset=String(circ*(1-done/total));if(pct)pct.textContent=p+'%';if(title)title.textContent=`${done} / ${total} points préparés`;if(readyLabel)readyLabel.textContent=done===total?'DOSSIER BIEN PRÉPARÉ':done>=5?'BONNE BASE':'PRÉPARATION EN COURS';if(readyTitle)readyTitle.textContent=done===total?'Vous avez les informations principales pour un premier échange.':done>=5?'Vous pouvez déjà préparer votre demande de devis.':'Commencez par les photos et l’accès.';};
    inputs.forEach(i=>i.addEventListener('change',render));reset?.addEventListener('click',()=>{inputs.forEach(i=>i.checked=false);render()});render();
  }

  // Quote: import preferences from Material Lab as visible context without breaking the existing form.
  const form=$('#quoteForm');
  if(form){
    const params=new URLSearchParams(location.search);const prefs=[['Façade',params.get('preference_facade')],['Sol',params.get('preference_sol')],['Lumière',params.get('preference_lumiere')]].filter(([,v])=>v);
    if(prefs.length){const note=document.createElement('div');note.className='info-band v10-quote-preferences';note.innerHTML=`<strong>Préférences Material Lab :</strong> ${prefs.map(([k,v])=>`${k} : ${String(v).replace(/[<>]/g,'')}`).join(' · ')}<br><small>Ces choix sont des préférences visuelles, pas une prescription technique.</small>`;form.querySelector('.quote-head')?.insertAdjacentElement('afterend',note);const desc=form.elements.description;if(desc&&!desc.value)desc.placeholder=`Préférences visuelles : ${prefs.map(([k,v])=>`${k} ${v}`).join(', ')}. Décrivez maintenant votre chantier…`;}
  }
})();
/* V11 REALSITE cinematic photo viewer */
(()=>{const vp=document.querySelector('#v11Viewport');if(!vp)return;const pano=document.querySelector('#v11Panorama'),imgs=[...document.querySelectorAll('[data-v11-image]')],stageBtns=[...document.querySelectorAll('[data-v11-stage]')],label=document.querySelector('#v11StageLabel'),progress=document.querySelector('#v11Progress'),light=document.querySelector('#v11Light'),cinema=document.querySelector('#v11Cinema'),info=document.querySelector('#v11Info');let x=0,y=0,scale=1.08,down=false,sx=0,sy=0,bx=0,by=0,tour=null;const names={before:'AVANT TRAVAUX',works:'TRAVAUX EN COURS',after:'PROJET AMÉNAGÉ'};function render(){pano.style.transform=`translate3d(${x}px,${y}px,0) scale(${scale})`}function stage(s){imgs.forEach(i=>i.classList.toggle('active',i.dataset.v11Image===s));stageBtns.forEach(b=>b.classList.toggle('active',b.dataset.v11Stage===s));label.textContent=names[s]||s;x=0;y=0;scale=1.08;render()}stageBtns.forEach(b=>b.addEventListener('click',()=>stage(b.dataset.v11Stage)));vp.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;down=true;sx=e.clientX;sy=e.clientY;bx=x;by=y;vp.setPointerCapture?.(e.pointerId)});vp.addEventListener('pointermove',e=>{if(!down)return;x=Math.max(-180,Math.min(180,bx+(e.clientX-sx)*.55));y=Math.max(-70,Math.min(70,by+(e.clientY-sy)*.25));render()});['pointerup','pointercancel','pointerleave'].forEach(n=>vp.addEventListener(n,()=>down=false));vp.addEventListener('wheel',e=>{e.preventDefault();scale=Math.max(1.02,Math.min(1.42,scale-e.deltaY*.0006));render()},{passive:false});let pinch=0;vp.addEventListener('touchmove',e=>{if(e.touches.length===2){const a=e.touches[0],b=e.touches[1],d=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);if(pinch)scale=Math.max(1.02,Math.min(1.42,scale+(d-pinch)*.002));pinch=d;render()}},{passive:false});vp.addEventListener('touchend',()=>pinch=0);document.querySelectorAll('.v11-hotspot').forEach(h=>h.addEventListener('click',()=>{info.querySelector('h3').textContent=h.dataset.info;info.classList.add('open')}));info.querySelector('button').addEventListener('click',()=>info.classList.remove('open'));document.querySelector('[data-v11-action="reset"]')?.addEventListener('click',()=>{x=y=0;scale=1.08;render()});document.querySelector('[data-v11-action="fullscreen"]')?.addEventListener('click',()=>vp.requestFullscreen?.());document.querySelector('[data-v11-action="light"]')?.addEventListener('click',()=>{light.value=light.value>50?25:75;light.dispatchEvent(new Event('input'))});light?.addEventListener('input',()=>{const v=+light.value;imgs.forEach(i=>i.style.filter=`brightness(${.62+v/170}) saturate(${.82+v/350})`)});cinema?.addEventListener('click',()=>{if(tour){clearInterval(tour);tour=null;cinema.querySelector('b').textContent='LANCER LA VISITE CINÉMA';return}let n=0;const seq=['before','works','works','after'];cinema.querySelector('b').textContent='ARRÊTER LA VISITE';progress.style.width='0';stage(seq[0]);tour=setInterval(()=>{n++;progress.style.width=`${Math.min(100,n*3.34)}%`;x=Math.sin(n/3)*80;scale=1.08+Math.sin(n/5)*.04;render();if(n===9)stage(seq[1]);if(n===19)stage(seq[2]);if(n===27)stage(seq[3]);if(n>=30){clearInterval(tour);tour=null;progress.style.width='100%';cinema.querySelector('b').textContent='REJOUER LA VISITE CINÉMA'}},1000)});const clock=document.querySelector('#v11Clock');if(clock){const tick=()=>clock.textContent=new Intl.DateTimeFormat('fr-FR',{hour:'2-digit',minute:'2-digit'}).format(new Date());tick();setInterval(tick,30000)}render()})();

/* V13 — Atelier Digital */
(() => {
  const body=document.body;
  const progress=document.createElement('div'); progress.className='v13-progress'; progress.innerHTML='<i></i>'; body.appendChild(progress);
  addEventListener('scroll',()=>{const d=document.documentElement,h=d.scrollHeight-innerHeight;progress.firstElementChild.style.transform=`scaleX(${h>0?scrollY/h:0})`},{passive:true});

  const dock=document.createElement('div');dock.className='v13-dock';dock.innerHTML=`
    <a href="studio-360.html"><b>360°</b><span>Explorer</span></a>
    <a href="passeport-projet.html"><b>▱</b><span>Préparer</span></a>
    <button type="button" data-v13-search><b>⌕</b><span>Rechercher</span></button>
    <a href="devis.html" class="hot"><b>↗</b><span>Devis</span></a>`;body.appendChild(dock);

  const palette=document.createElement('div');palette.className='v13-palette';palette.setAttribute('aria-hidden','true');palette.setAttribute('role','dialog');palette.setAttribute('aria-modal','true');palette.setAttribute('aria-label','Recherche ORIS BAT PRO');palette.innerHTML=`
    <div class="v13-palette-box"><div class="v13-palette-head"><b>ORIS COMMAND CENTER</b><button aria-label="Fermer">×</button></div>
    <input type="search" placeholder="Terrassement, façade, 360°, devis…" aria-label="Rechercher dans le site">
    <div class="v13-results"></div><small>Entrée pour ouvrir · Échap pour fermer</small></div>`;body.appendChild(palette);
  const pages=[
    ['Accueil','index.html','Entreprise, métiers et expérience'],
    ['Studio 360°','studio-360.html','Visite photographique immersive'],
    ['Terrassement','terrassement.html','Fouilles, réseaux, niveaux'],
    ['Maçonnerie','maconnerie.html','Murets, ouvrages et reprises'],
    ['Façades & isolation','facades-isolation.html','Ravalement et isolation'],
    ['Aménagement extérieur','amenagement-exterieur.html','Cours, accès et abords'],
    ['Project Architect','passeport-projet.html','Préparer votre brief chantier'],
    ['Material Lab','materiaux.html','Explorer les matières et ambiances'],
    ['Guide chantier','guide-chantier.html','Checklist avant intervention'],
    ['Chantier Flow','chantier-flow.html','Comprendre l’ordre des étapes'],
    ['Diagnostic Express','diagnostic.html','6 questions pour mieux préparer le projet'],
    ['Project Command','project-command.html','Centraliser diagnostic, brief et prochaines étapes'],
    ['Réalisations','realisations.html','Galerie et concepts'],
    ['Devis','devis.html','Démarrer un projet'],
    ['Contact','contact.html','Téléphone, email et adresse']
  ];
  const input=palette.querySelector('input'),results=palette.querySelector('.v13-results');
  let activeResult=0,lastFocus=null;
  function render(q=''){const s=q.trim().toLowerCase(),r=pages.filter(x=>!s||x.join(' ').toLowerCase().includes(s));results.innerHTML=r.length?r.map((x,i)=>`<a href="${x[1]}" data-result="${i}" class="${i===activeResult?'selected':''}"><b>${x[0]}</b><span>${x[2]}</span><i>↗</i></a>`).join(''):'<div class="v13-empty">Aucun résultat. Essayez « terrassement », « façade » ou « devis ».</div>';activeResult=Math.min(activeResult,Math.max(0,r.length-1))}
  function open(){lastFocus=document.activeElement;activeResult=0;palette.classList.add('open');palette.setAttribute('aria-hidden','false');document.body.classList.add('command-open');render();setTimeout(()=>input.focus(),50)}
  function close(){palette.classList.remove('open');palette.setAttribute('aria-hidden','true');document.body.classList.remove('command-open');if(lastFocus&&lastFocus.focus)lastFocus.focus()}
  function select(delta){const links=[...results.querySelectorAll('a')];if(!links.length)return;activeResult=(activeResult+delta+links.length)%links.length;links.forEach((a,i)=>a.classList.toggle('selected',i===activeResult));links[activeResult].scrollIntoView({block:'nearest'})}
  dock.querySelector('[data-v13-search]').addEventListener('click',open);palette.querySelector('button').addEventListener('click',close);palette.addEventListener('click',e=>{if(e.target===palette)close()});input.addEventListener('input',()=>{activeResult=0;render(input.value)});
  addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();open();return}if(!palette.classList.contains('open'))return;if(e.key==='Escape'){e.preventDefault();close()}else if(e.key==='ArrowDown'){e.preventDefault();select(1)}else if(e.key==='ArrowUp'){e.preventDefault();select(-1)}else if(e.key==='Enter'){const links=[...results.querySelectorAll('a')];if(links[activeResult]){e.preventDefault();location.href=links[activeResult].href}}});

  const root=document.querySelector('[data-project-architect]'); if(!root)return;
  let step=0,state={}; const panels=[...root.querySelectorAll('[data-panel]')],steps=[...root.querySelectorAll('[data-arch-step]')];
  const score=root.querySelector('[data-score]'),meter=root.querySelector('[data-meter]'),ready=root.querySelector('[data-readiness]'),brief=root.querySelector('[data-brief]');
  const txt=root.querySelector('[data-project-copy]');
  function completion(){const fields=['service','access','slope','networks','priority'],done=fields.filter(k=>state[k]).length+(txt.value.trim()?1:0),pct=Math.round(done/6*100);score.textContent=pct+'%';meter.style.width=pct+'%';ready.textContent=pct<35?'Le dossier commence à prendre forme.':pct<80?'Bon niveau de préparation : complétez les contraintes.':'Brief prêt à être transmis à ORIS BAT PRO.'}
  function show(n){step=Math.max(0,Math.min(3,n));panels.forEach((p,i)=>p.classList.toggle('active',i===step));steps.forEach((b,i)=>b.classList.toggle('active',i===step));root.querySelector('[data-prev]').disabled=step===0;root.querySelector('[data-next]').style.display=step===3?'none':'';if(step===3)build()}
  function build(){const lines=[['Projet',state.service],['Accès',state.access],['Terrain',state.slope],['Réseaux',state.networks],['Priorité',state.priority],['Description',txt.value.trim()]].filter(x=>x[1]);brief.innerHTML=lines.map(x=>`<div><span>${x[0]}</span><b>${x[1]}</b></div>`).join('');const plain=lines.map(x=>`${x[0]} : ${x[1]}`).join('\n');try{sessionStorage.setItem('orisProjectBrief',plain)}catch(_){};root.querySelector('[data-send-brief]').href='devis.html?brief=1'}
  root.querySelectorAll('[data-choice]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.choice;state[k]=b.dataset.value;root.querySelectorAll(`[data-choice="${k}"]`).forEach(x=>x.classList.toggle('selected',x===b));completion()}));
  txt.addEventListener('input',completion);root.querySelector('[data-next]').addEventListener('click',()=>show(step+1));root.querySelector('[data-prev]').addEventListener('click',()=>show(step-1));steps.forEach((b,i)=>b.addEventListener('click',()=>show(i)));
  root.querySelector('[data-copy-brief]').addEventListener('click',async e=>{build();try{let _brief='';try{_brief=sessionStorage.getItem('orisProjectBrief')||''}catch(_){};await navigator.clipboard.writeText(_brief);e.currentTarget.textContent='Brief copié ✓'}catch(_){}});
  completion();show(0);
})();
/* V14 IMMERSIVE OS */(()=>{const flow=document.querySelector('[data-flow]');if(flow){const D={cour:[['Diagnostic & accès','Vérifier accès, niveaux, réseaux apparents et zones de stockage.','Avant tout engin'],['Décaissement','Retirer les couches nécessaires et dégager la plateforme.','Terrassement'],['Réseaux & niveaux','Préparer les passages et régler les pentes utiles.','Coordination'],['Petits ouvrages','Seuils, bordures, marches ou murets prévus au projet.','Maçonnerie'],['Préparation finale','Mettre la plateforme en état pour la finition retenue.','Finition']],terrasse:[['Lecture du terrain','Accès, hauteur finie, pente, liaison avec la maison.','Préparation'],['Terrassement','Décaissement et réglage de la zone.','Terrassement'],['Support','Préparer les couches ou ouvrages nécessaires.','Support'],['Liaisons','Traiter seuils, marches et raccords.','Maçonnerie'],['Finition','La finition dépend du système retenu au devis.','Finition']],facade:[['État du support','Observer les zones à reprendre.','Diagnostic'],['Protection & préparation','Protéger les abords puis préparer le support.','Préparation'],['Reprises','Traiter les zones prévues avant finition.','Support'],['Ravalement / isolation','Mettre en œuvre le système défini au devis.','Façade'],['Finitions','Détails, raccords et nettoyage.','Contrôle']],complet:[['Accès & organisation','Définir circulation, stockage et évacuation.','Logistique'],['Terrassement','Créer niveaux, fouilles et plateformes.','Terrain'],['Réseaux','Coordonner les passages avant fermeture.','Coordination'],['Maçonnerie','Créer les petits ouvrages et supports.','Ouvrages'],['Façade & abords','Finaliser sans refaire ce qui est terminé.','Finitions']]};let project='cour',step=0;const story=flow.querySelector('[data-flow-story]'),title=flow.querySelector('[data-flow-title]'),counter=flow.querySelector('[data-flow-counter]'),bar=flow.querySelector('[data-flow-progress]');function render(){const a=D[project],x=a[step];title.textContent=({cour:'COUR & ACCÈS',terrasse:'TERRASSE',facade:'FAÇADE',complet:'PROJET COMPLET'})[project];story.innerHTML=`<small>${x[2]}</small><strong>${String(step+1).padStart(2,'0')}</strong><h3>${x[0]}</h3><p>${x[1]}</p>`;counter.textContent=`${String(step+1).padStart(2,'0')} / 05`;bar.style.width=`${(step+1)*20}%`;flow.style.setProperty('--flow-step',step);flow.querySelector('[data-flow-prev]').disabled=step===0;flow.querySelector('[data-flow-next]').disabled=step===4}flow.querySelectorAll('[data-flow-project]').forEach(b=>b.addEventListener('click',()=>{project=b.dataset.flowProject;step=0;flow.querySelectorAll('[data-flow-project]').forEach(x=>x.classList.toggle('active',x===b));render()}));flow.querySelector('[data-flow-prev]').addEventListener('click',()=>{step=Math.max(0,step-1);render()});flow.querySelector('[data-flow-next]').addEventListener('click',()=>{step=Math.min(4,step+1);render()});render();}const arch=document.querySelector('[data-project-architect]');if(arch){const getBrief=()=>{try{return sessionStorage.getItem('orisProjectBrief')||localStorage.getItem('orisProjectBriefSaved')||''}catch(_){return ''}};const save=()=>{try{const x=getBrief();if(x)localStorage.setItem('orisProjectBriefSaved',x)}catch(_){}};arch.addEventListener('click',()=>setTimeout(save,50));arch.querySelector('[data-share-brief]')?.addEventListener('click',async()=>{const text=getBrief();if(!text)return;try{if(navigator.share)await navigator.share({title:'Projet ORIS BAT PRO',text});else await navigator.clipboard.writeText(text)}catch(_){}});arch.querySelector('[data-print-brief]')?.addEventListener('click',()=>window.print());}let deferred=null;addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;const d=document.querySelector('.v13-dock');if(!d||d.querySelector('[data-install-app]'))return;const b=document.createElement('button');b.type='button';b.dataset.installApp='';b.innerHTML='<b>＋</b><span>Installer</span>';b.addEventListener('click',async()=>{if(!deferred)return;deferred.prompt();try{await deferred.userChoice}catch(_){}deferred=null;b.remove()});d.insertBefore(b,d.lastElementChild)});})();
/* V15 — SIGNATURE INTELLIGENCE */
(()=>{
 const root=document.querySelector('[data-diagnostic]');
 if(root){
  const steps=[...root.querySelectorAll('[data-diag-step]')],result=root.querySelector('[data-diag-result]'),progress=root.querySelector('[data-diag-progress]'),scoreEl=root.querySelector('[data-diag-score]'),ring=root.querySelector('[data-diag-ring]'),status=root.querySelector('[data-diag-status]'),summary=root.querySelector('[data-diag-summary]');
  let step=0,state={};
  const labels={service:'Métier',access:'Accès',slope:'Terrain',networks:'Réseaux',priority:'Priorité',readiness:'Préparation'};
  function pct(){return Math.round(Object.keys(state).length/6*100)}
  function update(){const p=pct();scoreEl.textContent=p+'%';progress.style.width=p+'%';ring.style.setProperty('--score',p);summary.innerHTML=Object.entries(state).map(([k,v])=>`<div><span>${labels[k]}</span><b>${v}</b></div>`).join('');status.textContent=p<34?'Le projet commence à prendre forme.':p<84?'Bon niveau de préparation. Encore quelques points à préciser.':'Dossier suffisamment structuré pour préparer un échange.'}
  function show(n){step=Math.max(0,Math.min(5,n));steps.forEach((s,i)=>s.classList.toggle('active',i===step));result.classList.remove('active');root.querySelector('[data-diag-prev]').disabled=step===0;root.querySelector('[data-diag-next]').style.display='';update()}
  function build(){steps.forEach(s=>s.classList.remove('active'));root.querySelector('.diagnostic-nav').style.display='none';result.classList.add('active');const risk=[];if(state.access==='Contraint')risk.push(['Accès','Prévoir les dimensions utiles du passage et quelques photos.']);if(state.slope==='Pente marquée')risk.push(['Niveaux','Le terrassement et l’évacuation devront être étudiés avec attention.']);if(state.networks==='Non')risk.push(['Réseaux','Identifier les réseaux avant certaines interventions.']);if(state.readiness==='Idée')risk.push(['Préparation','Des photos et dimensions aideront à cadrer la demande.']);if(!risk.length)risk.push(['Préparation','Les informations essentielles sont déjà bien structurées.']);root.querySelector('[data-diag-copy]').textContent=`Projet principal : ${state.service}. Priorité : ${state.priority}. Accès : ${state.access}. Terrain : ${state.slope}.`;root.querySelector('[data-diag-cards]').innerHTML=risk.map(x=>`<article><small>POINT À REGARDER</small><h3>${x[0]}</h3><p>${x[1]}</p></article>`).join('');const plain=Object.entries(state).map(([k,v])=>`${labels[k]} : ${v}`).join('\n');try{sessionStorage.setItem('orisDiagnostic',plain);localStorage.setItem('orisDiagnosticSaved',plain)}catch(_){};update()}
  root.querySelectorAll('[data-diag-choice]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.diagChoice;state[k]=b.dataset.value;root.querySelectorAll(`[data-diag-choice="${k}"]`).forEach(x=>x.classList.toggle('selected',x===b));update();setTimeout(()=>{if(step<5)show(step+1);else build()},180)}));
  root.querySelector('[data-diag-prev]').addEventListener('click',()=>show(step-1));root.querySelector('[data-diag-next]').addEventListener('click',()=>{if(step<5)show(step+1);else build()});root.querySelector('[data-diag-restart]').addEventListener('click',()=>{state={};root.querySelectorAll('[data-diag-choice]').forEach(x=>x.classList.remove('selected'));root.querySelector('.diagnostic-nav').style.display='';show(0)});
  root.querySelector('[data-diag-share]').addEventListener('click',async()=>{const text=Object.entries(state).map(([k,v])=>`${labels[k]} : ${v}`).join('\n');try{if(navigator.share)await navigator.share({title:'Diagnostic ORIS BAT PRO',text});else await navigator.clipboard.writeText(text)}catch(_){}});show(0);
 }

 // Bring diagnostic result into quote form if present.
 if(location.pathname.endsWith('devis.html')&&new URLSearchParams(location.search).get('diagnostic')==='1'){
  let diag='';try{diag=sessionStorage.getItem('orisDiagnostic')||localStorage.getItem('orisDiagnosticSaved')||''}catch(_){};if(diag){const ta=document.querySelector('textarea[name="description"],textarea[name="project"],textarea');if(ta&&!ta.value.trim()){ta.value='Diagnostic ORIS Express :\n\n'+diag;ta.dispatchEvent(new Event('input',{bubbles:true}))}}
 }

 // Lightweight contextual smart CTA: only appears after meaningful engagement.
 const _smartBlocked=/\/(diagnostic|project-command|devis|contact)\.html$/.test(location.pathname)||matchMedia('(max-width:850px)').matches;let smartShown=false;if(!_smartBlocked){const smart=document.createElement('div');smart.className='v15-smart-cta';smart.innerHTML='<button type="button" aria-label="Fermer">×</button><small>VOTRE PROJET PREND FORME</small><b>Prêt à le cadrer ?</b><a href="diagnostic.html">Diagnostic express ↗</a>';document.body.appendChild(smart);smart.querySelector('button').addEventListener('click',()=>smart.remove());addEventListener('scroll',()=>{if(smartShown)return;const d=document.documentElement,p=(scrollY+innerHeight)/Math.max(d.scrollHeight,1);if(p>.58){smartShown=true;smart.classList.add('show')}},{passive:true})}
})();
/* V16 PROJECT COMMAND */(()=>{const root=document.querySelector('[data-project-command]');if(root){const tabs=[...root.querySelectorAll('[data-command-tab]')],panels=[...root.querySelectorAll('[data-command-panel]')],scoreEl=root.querySelector('[data-command-score]'),meter=root.querySelector('[data-command-meter]'),status=root.querySelector('[data-command-status]'),summary=root.querySelector('[data-command-summary]'),risks=root.querySelector('[data-command-risks]'),next=root.querySelector('[data-command-next]'),exportBox=root.querySelector('[data-command-export]');const fields={project:root.querySelector('[data-command-project]'),city:root.querySelector('[data-command-city]'),delay:root.querySelector('[data-command-delay]'),photos:root.querySelector('[data-command-photos]'),notes:root.querySelector('[data-command-notes]')};let diagnostic='',brief='',command={};try{diagnostic=sessionStorage.getItem('orisDiagnostic')||localStorage.getItem('orisDiagnosticSaved')||'';brief=sessionStorage.getItem('orisProjectBrief')||localStorage.getItem('orisProjectBriefSaved')||'';command=JSON.parse(localStorage.getItem('orisProjectCommand')||'{}')}catch(_){command={}}Object.entries(fields).forEach(([k,e])=>{if(e&&command[k]!=null)e.value=command[k]});const parse=t=>String(t||'').split('\n').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf(':');return i>0?[x.slice(0,i).trim(),x.slice(i+1).trim()]:['Info',x]});function readiness(){let p=0;if(diagnostic)p+=30;if(brief)p+=25;if(fields.project.value.trim())p+=10;if(fields.city.value.trim())p+=10;if(fields.delay.value)p+=10;if(fields.photos.value==='Oui')p+=10;if(fields.notes.value.trim())p+=5;return Math.min(100,p)}function buildText(){const r=[];if(fields.project.value.trim())r.push(`Projet : ${fields.project.value.trim()}`);if(fields.city.value.trim())r.push(`Commune : ${fields.city.value.trim()}`);if(fields.delay.value)r.push(`Échéance : ${fields.delay.value}`);r.push(`Photos : ${fields.photos.value}`);if(fields.notes.value.trim())r.push(`Notes : ${fields.notes.value.trim()}`);if(diagnostic)r.push(`\nDiagnostic ORIS:\n${diagnostic}`);if(brief)r.push(`\nBrief ORIS:\n${brief}`);return r.join('\n')}function refresh(){const s=readiness();scoreEl.textContent=s+'%';meter.style.width=s+'%';status.textContent=s<35?'Projet encore peu renseigné.':s<70?'Bonne base : ajoutez quelques éléments.':s<90?'Dossier solide pour préparer un échange.':'Dossier très bien préparé.';root.querySelector('[data-kpi-diagnostic]').textContent=diagnostic?'Présent':'Non renseigné';root.querySelector('[data-kpi-brief]').textContent=brief?'Présent':'Non renseigné';root.querySelector('[data-kpi-photos]').textContent=fields.photos.value==='Oui'?'Disponibles':'À préparer';root.querySelector('[data-kpi-ready]').textContent=s>=70?'Oui':'À compléter';const all=[...parse(diagnostic),...parse(brief)];summary.innerHTML=all.length?all.slice(0,8).map(x=>`<div><span>${x[0]}</span><b>${x[1]}</b></div>`).join(''):'<p>Aucun diagnostic ou brief enregistré.</p>';const r=[];if(!diagnostic)r.push('Faire le Diagnostic Express.');if(!brief)r.push('Construire un brief avec Project Architect.');if(fields.photos.value!=='Oui')r.push('Préparer quelques photos générales et de l’accès.');if(!fields.city.value.trim())r.push('Ajouter la commune.');if(!fields.delay.value)r.push('Préciser une échéance.');risks.innerHTML=(r.length?r:['Les informations principales sont bien renseignées.']).slice(0,5).map(x=>`<p>• ${x}</p>`).join('');const a=[];if(!diagnostic)a.push(['01','Diagnostic Express','Répondre aux 6 questions.','diagnostic.html']);else if(!brief)a.push(['01','Project Architect','Structurer le besoin.','passeport-projet.html']);else a.push(['01','Vérifier les photos','Préparer des vues générales et de l’accès.','#']);a.push(['02','Contrôler les contraintes','Accès, pente, réseaux, voisinage.','guide-chantier.html']);a.push(['03','Passer au devis','Transmettre un dossier plus propre.','devis.html?command=1']);next.innerHTML=a.map(x=>`<article><strong>${x[0]}</strong><div><h3>${x[1]}</h3><p>${x[2]}</p></div>${x[3]!=='#'?`<a href="${x[3]}">Ouvrir ↗</a>`:''}</article>`).join('');exportBox.innerHTML='<pre>'+buildText().replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]))+'</pre>'}function save(){command={project:fields.project.value.trim(),city:fields.city.value.trim(),delay:fields.delay.value,photos:fields.photos.value,notes:fields.notes.value.trim()};try{localStorage.setItem('orisProjectCommand',JSON.stringify(command));sessionStorage.setItem('orisCommandSummary',buildText())}catch(_){}refresh()}tabs.forEach(b=>b.addEventListener('click',()=>{tabs.forEach(x=>x.classList.toggle('active',x===b));panels.forEach(p=>p.classList.toggle('active',p.dataset.commandPanel===b.dataset.commandTab));refresh()}));Object.values(fields).forEach(e=>{e.addEventListener('input',refresh);e.addEventListener('change',refresh)});root.querySelector('[data-command-save]').addEventListener('click',save);addEventListener('pagehide',()=>{try{save()}catch(_){}});root.querySelector('[data-command-reset]').addEventListener('click',()=>{if(!confirm('Effacer le dossier local de ce cockpit ?'))return;try{localStorage.removeItem('orisProjectCommand')}catch(_){}Object.values(fields).forEach(e=>{if(e.tagName==='SELECT')e.selectedIndex=0;else e.value=''});refresh()});root.querySelector('[data-command-copy]').addEventListener('click',async e=>{try{await navigator.clipboard.writeText(buildText());e.currentTarget.textContent='Copié ✓'}catch(_){}});root.querySelector('[data-command-share]').addEventListener('click',async()=>{const text=buildText();try{if(navigator.share)await navigator.share({title:'Projet ORIS BAT PRO',text});else await navigator.clipboard.writeText(text)}catch(_){}});root.querySelector('[data-command-download]').addEventListener('click',()=>{const blob=new Blob([buildText()],{type:'text/plain;charset=utf-8'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='projet-oris-bat-pro.txt';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),500)});root.querySelector('[data-command-print]').addEventListener('click',()=>window.print());
   root.querySelectorAll('a[href*="devis.html?command=1"]').forEach(a=>a.addEventListener('click',()=>{try{sessionStorage.setItem('orisCommandSummary',buildText())}catch(_){}}));
   refresh()}if(location.pathname.endsWith('devis.html')&&new URLSearchParams(location.search).get('command')==='1'){let txt='';try{txt=sessionStorage.getItem('orisCommandSummary')||''}catch(_){}if(txt){const ta=document.querySelector('textarea[name="description"],textarea[name="project"],textarea');if(ta&&!ta.value.trim()){ta.value='Dossier ORIS Project Command :\n\n'+txt;ta.dispatchEvent(new Event('input',{bubbles:true}))}}}})();
// ================= V18 PREPARER MON PROJET =================
(()=>{const form=document.querySelector('#v18PrepForm');if(!form)return;const summary=document.querySelector('#v18PrepSummary'),toQuote=document.querySelector('#v18PrepToQuote'),reset=document.querySelector('#v18PrepReset'),savedLabel=document.querySelector('#v18PrepSaved');const get=()=>Object.fromEntries(new FormData(form).entries());const esc=s=>String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));const render=()=>{const v=get(),rows=[['Travaux',v.service],['Commune',v.commune],['Accès',v.access],['Délai',v.delay],['Besoin',v.description]].filter(x=>x[1]);summary.innerHTML=rows.length?rows.map(([k,val])=>`<div><span>${k}</span><b>${esc(val)}</b></div>`).join(''):'<strong>Votre résumé apparaîtra ici.</strong>';const qs=new URLSearchParams(),map={'Terrassement':'terrassement','Maçonnerie':'maconnerie','Façades & isolation':'facades-isolation','Aménagement extérieur':'amenagement-exterieur'};if(v.service)qs.set('service',map[v.service]||'');if(v.commune)qs.set('city',v.commune);toQuote.href='devis.html'+(qs.toString()?'?'+qs.toString():'');try{localStorage.setItem('orisV18PreparedProject',JSON.stringify(v));savedLabel.textContent='Sauvegardé automatiquement sur cet appareil'}catch(_){}};try{const saved=JSON.parse(localStorage.getItem('orisV18PreparedProject')||'{}');Object.entries(saved).forEach(([k,v])=>{if(form.elements[k])form.elements[k].value=v})}catch(_){}form.addEventListener('input',render);form.addEventListener('change',render);reset.addEventListener('click',()=>{form.reset();try{localStorage.removeItem('orisV18PreparedProject')}catch(_){}render();savedLabel.textContent='Dossier effacé'});render()})();
