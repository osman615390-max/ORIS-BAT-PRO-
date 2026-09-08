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
      lastFocus=document.activeElement;document.body.classList.add('cinema-menu-open','menu-open');menu.setAttribute('aria-hidden','false');menuBtn.setAttribute('aria-expanded','true');menuBtn.setAttribute('aria-label','Fermer le menu cinématique');
      setTimeout(()=>links[0]?.focus({preventScroll:true}),260);
    };
    const closeMenu=()=>{
      document.body.classList.remove('cinema-menu-open','menu-open');menu.setAttribute('aria-hidden','true');menuBtn.setAttribute('aria-expanded','false');menuBtn.setAttribute('aria-label','Ouvrir le menu cinématique');
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

  // ---------------- Quote form ----------------
  const form=$('#quoteForm');
  if(form){
    const steps=$$('.quote-step',form),counter=$('#quoteCounter'),title=$('#quoteTitle'),bar=$('#quoteProgress'),prev=$('#prevQuote'),next=$('#nextQuote'),send=$('#sendQuote'),status=$('#quoteStatus'),summary=$('#quoteSummary'),files=$('#quoteFiles'),filesInfo=$('#filesInfo');
    let step=1,lastSubmit=0;const startedAt=Date.now();
    const titles=['Quel type de travaux ?','Décrivez le projet','Où se trouve le chantier ?','Quel délai ?','Vos coordonnées'];
    const serviceMap={'terrassement':'Terrassement','maconnerie':'Maçonnerie','facades-isolation':'Façades & isolation','amenagement-exterieur':'Aménagement extérieur'};
    const params=new URLSearchParams(location.search),req=params.get('service');
    if(req&&serviceMap[req]){const r=form.querySelector(`input[name="service"][value="${serviceMap[req]}"]`);if(r)r.checked=true}
    const accessMap={large:'Large / facile',medium:'Moyen',tight:'Étroit'},slopeMap={flat:'Non',light:'Légèrement',slope:'Oui'};
    if(accessMap[params.get('access')]&&form.elements.access)form.elements.access.value=accessMap[params.get('access')];
    if(slopeMap[params.get('slope')]&&form.elements.slope)form.elements.slope.value=slopeMap[params.get('slope')];
    if(params.get('city')&&form.elements.commune)form.elements.commune.value=params.get('city');
    if(params.get('passport_delay')&&form.elements.delay){const o=[...form.elements.delay.options].find(o=>o.value===params.get('passport_delay'));if(o)form.elements.delay.value=o.value}
    const value=name=>{const f=form.elements[name];if(!f)return'';return f instanceof RadioNodeList?f.value:f.value};
    const escapeHTML=str=>String(str).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const show=(type,msg)=>{status.className=`form-status show ${type}`;status.innerHTML=msg},clear=()=>{status.className='form-status';status.innerHTML=''};
    const validate=()=>{const panel=steps[step-1];for(const field of $$('[required]',panel)){let ok=field.type==='radio'?!!panel.querySelector(`input[name="${field.name}"]:checked`):field.type==='checkbox'?field.checked:(field.value.trim()!==''&&field.validity.valid);if(!ok){show('error','Merci de compléter les champs nécessaires avant de continuer.');(field.closest('.choice')||field).focus?.();return false}}clear();return true};
    const renderSummary=()=>{const rows=[['Travaux',value('service')],['Projet',value('project_type')],['Commune',[value('commune'),value('postal_code')].filter(Boolean).join(' · ')],['Délai',value('delay')],['Budget',value('budget')||'Non défini'],['Nom',value('fullname')],['Téléphone',value('phone')],['E-mail',value('email')]];summary.innerHTML=rows.map(([k,v])=>`<div><span>${k}</span><b>${escapeHTML(v||'—')}</b></div>`).join('')};
    const render=(scroll=true)=>{steps.forEach((s,i)=>{const active=i===step-1;s.classList.toggle('active',active);s.setAttribute('aria-hidden',String(!active))});counter.textContent=`Étape ${String(step).padStart(2,'0')} / 05`;title.textContent=titles[step-1];bar.style.width=`${step*20}%`;prev.style.visibility=step===1?'hidden':'visible';next.style.display=step===5?'none':'inline-flex';send.style.display=step===5?'inline-flex':'none';if(step===5)renderSummary();if(scroll)scrollTo({top:Math.max(0,form.getBoundingClientRect().top+scrollY-110),behavior:'smooth'})};
    next.addEventListener('click',()=>{if(validate()&&step<5){step++;render()}});prev.addEventListener('click',()=>{if(step>1){step--;clear();render()}});
    files?.addEventListener('change',()=>{const list=[...files.files],maxEach=5*1024*1024,total=list.reduce((n,f)=>n+f.size,0),typeOK=list.every(f=>['image/jpeg','image/png','image/webp'].includes(f.type));if(list.length>5||list.some(f=>f.size>maxEach)||total>8*1024*1024||!typeOK){files.value='';filesInfo.textContent='Sélection refusée : 5 images max, 5 Mo chacune, 8 Mo au total.';show('error','Réduisez le nombre ou la taille des photos et utilisez JPG, PNG ou WEBP.');return}filesInfo.textContent=list.length?list.map(f=>f.name).join(' · '):'5 images max · 5 Mo chacune · 8 Mo au total';clear()});
    form.addEventListener('submit',async e=>{e.preventDefault();if(!validate())return;if(form.elements._honey.value)return;if(Date.now()-startedAt<2200){show('error','Vérifiez votre demande puis réessayez.');return}if(Date.now()-lastSubmit<60000){show('error','Une demande vient déjà d’être envoyée. Attendez une minute avant de recommencer.');return}lastSubmit=Date.now();const fd=new FormData(form);fd.append('_subject',`Nouvelle demande ORIS BAT PRO — ${value('service')} — ${value('commune')}`);fd.append('_template','table');[prev,next,send].forEach(b=>b.disabled=true);show('success','Envoi de votre demande en cours…');let ok=false;for(let attempt=0;attempt<2&&!ok;attempt++){try{const res=await fetch('https://formsubmit.co/ajax/Orisbatpro@gmail.com',{method:'POST',body:fd,headers:{Accept:'application/json'}});ok=res.ok}catch(_){}if(!ok&&attempt===0)await new Promise(r=>setTimeout(r,900))}if(ok){show('success','✅ Votre demande a bien été envoyée à ORIS BAT PRO. Vous pouvez rester sur cette page.');form.reset();if(filesInfo)filesInfo.textContent='5 images max · 5 Mo chacune · 8 Mo au total';step=1;render(false)}else show('error','❌ L’envoi n’a pas abouti. Appelez le <a href="tel:0695238453">06 95 23 84 53</a> ou écrivez à <a href="mailto:Orisbatpro@gmail.com">Orisbatpro@gmail.com</a>.');[prev,next,send].forEach(b=>b.disabled=false)});
    render(false);
  }

  // ---------------- REALSITE watchdog: graceful photo fallback if WebGL/CDN cannot boot ----------------
  const viewerWatch=[...document.querySelectorAll('[data-viewer360]')];
  if(viewerWatch.length)setTimeout(()=>viewerWatch.forEach(v=>{if(v.classList.contains('v6-viewer-ready'))return;v.classList.add('v6-viewer-fallback-mode');const l=v.querySelector('.viewer-loading');if(l){l.querySelector('b').textContent='Mode photo activé';l.querySelector('span').textContent='La 3D n’est pas disponible sur cet appareil. Le mode photo prend automatiquement le relais.';setTimeout(()=>l.style.display='none',1800)}const s=v.querySelector('.v6-viewer__status span');if(s)s.textContent='REALSITE / MODE PHOTO'}),8000);

  // ---------------- PWA ----------------
  if('serviceWorker'in navigator&&location.protocol==='https:')addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
})();


// V10 FLAGSHIP — global cinematic interaction layer
(()=>{
  if(document.documentElement.dataset.v10Init) return;
  document.documentElement.dataset.v10Init='1';
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const progress=document.createElement('div'); progress.className='v10-progress'; document.body.appendChild(progress);
  const updateProgress=()=>{const d=document.documentElement,max=d.scrollHeight-innerHeight;progress.style.width=(max>0?Math.min(100,scrollY/max*100):0)+'%'};
  addEventListener('scroll',updateProgress,{passive:true}); addEventListener('resize',updateProgress,{passive:true}); updateProgress();
  if(!reduce && matchMedia('(hover:hover) and (pointer:fine)').matches){
    const c=document.createElement('div');c.className='v10-cursor';document.body.appendChild(c);
    addEventListener('pointermove',e=>{c.style.left=e.clientX+'px';c.style.top=e.clientY+'px'},{passive:true});
    document.querySelectorAll('a,button,[data-tilt]').forEach(el=>{el.addEventListener('pointerenter',()=>c.classList.add('hot'));el.addEventListener('pointerleave',()=>c.classList.remove('hot'))});
  }
  const hero=document.querySelector('.hero');
  if(hero&&!reduce){hero.addEventListener('pointermove',e=>{const r=hero.getBoundingClientRect();hero.style.setProperty('--mx',((e.clientX-r.left)/r.width*100).toFixed(1)+'%');hero.style.setProperty('--my',((e.clientY-r.top)/r.height*100).toFixed(1)+'%')},{passive:true})}
  // Make all telephone CTAs semantically consistent and improve external target safety.
  document.querySelectorAll('a[target="_blank"]').forEach(a=>a.rel='noopener noreferrer');
})();
