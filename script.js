
(() => {
  const nav = document.querySelector('.site-nav');
  const toggle = document.querySelector('.menu-toggle');
  const progress = document.querySelector('.scroll-progress');

  const onScroll = () => {
    nav?.classList.toggle('scrolled', scrollY > 18);
    if(progress){
      const max = document.documentElement.scrollHeight - innerHeight;
      progress.style.width = (max > 0 ? scrollY / max * 100 : 0) + '%';
    }
  };
  addEventListener('scroll', onScroll, {passive:true}); onScroll();

  if(toggle && nav){
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
      document.body.style.overflow = open ? 'hidden' : '';
    });
    addEventListener('keydown', e => {
      if(e.key === 'Escape' && nav.classList.contains('open')){
        nav.classList.remove('open'); document.body.style.overflow = '';
        toggle.setAttribute('aria-expanded','false'); toggle.focus();
      }
    });
  }

  const current = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    if(a.getAttribute('href') === current){
      a.classList.add('active'); a.setAttribute('aria-current','page');
    }
    a.addEventListener('click', () => {
      nav?.classList.remove('open'); document.body.style.overflow = '';
      toggle?.setAttribute('aria-expanded','false');
    });
  });

  if('IntersectionObserver' in window){
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if(e.isIntersecting){ e.target.classList.add('show'); io.unobserve(e.target); }
      });
    }, {threshold:.12});
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('show'));
  }

  const fleet = document.getElementById('fleetStage');
  if(fleet){
    const fio = new IntersectionObserver(entries => entries.forEach(e => {
      if(e.isIntersecting) fleet.classList.add('visible');
    }), {threshold:.22});
    fio.observe(fleet);
  }

  document.querySelectorAll('.filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter').forEach(b => {
        const active = b === btn;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', String(active));
      });
      const f = btn.dataset.filter;
      document.querySelectorAll('.portfolio-card').forEach(card => {
        card.classList.toggle('hidden', f !== 'all' && card.dataset.category !== f);
      });
    });
  });

  document.querySelectorAll('.faq-section').forEach(section => {
    section.querySelectorAll('details').forEach(d => d.addEventListener('toggle', () => {
      if(!d.open) return;
      section.querySelectorAll('details').forEach(o => { if(o !== d) o.open = false; });
    }));
  });

  const form = document.getElementById('quoteForm');
  if(!form) return;

  const steps = [...form.querySelectorAll('.quote-step')];
  const prev = document.getElementById('prevStep');
  const next = document.getElementById('nextStep');
  const send = document.getElementById('sendQuote');
  const counter = document.getElementById('stepCounter');
  const title = document.getElementById('stepTitle');
  const bar = document.getElementById('progressBar');
  const status = document.getElementById('formStatus');
  const summary = document.getElementById('quoteSummary');
  const files = document.getElementById('quoteFiles');
  const filesInfo = document.getElementById('filesInfo');
  let step = 1;
  let startedAt = Date.now();
  let lastSubmit = 0;
  const titles = ['Quel est votre projet ?','Décrivez le chantier.','Où se trouve le projet ?','Quel est votre délai ?','Comment vous recontacter ?'];

  const map = {
    'terrassement':'Terrassement',
    'maconnerie':'Maçonnerie',
    'facades-isolation':'Façades & isolation',
    'amenagement-exterieur':'Aménagement extérieur'
  };
  const requested = new URLSearchParams(location.search).get('service');
  if(requested && map[requested]){
    const r = form.querySelector(`input[name="service"][value="${map[requested]}"]`);
    if(r) r.checked = true;
  }

  const getVal = name => {
    const el = form.elements[name];
    return el instanceof RadioNodeList ? el.value : (el?.value || '');
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function validateStep(){
    const current = steps[step-1];
    const req = [...current.querySelectorAll('[required]')];
    let firstInvalid = null;
    for(const field of req){
      let valid = true;
      if(field.type === 'radio') valid = !!current.querySelector(`input[name="${field.name}"]:checked`);
      else if(field.type === 'checkbox') valid = field.checked;
      else valid = field.value.trim() !== '' && (field.type !== 'email' || field.validity.valid);
      if(!valid && !firstInvalid) firstInvalid = field;
    }
    if(firstInvalid){
      status.className='form-status error';
      status.textContent='Merci de compléter les champs nécessaires avant de continuer.';
      const target = firstInvalid.type === 'radio' ? firstInvalid.closest('.choice') : firstInvalid;
      target?.focus?.();
      return false;
    }
    status.textContent=''; status.className='form-status';
    return true;
  }

  function renderSummary(){
    const rows = [
      ['SERVICE',getVal('service')],['PROJET',getVal('type_projet')],['BESOIN',getVal('besoin')],
      ['COMMUNE',[getVal('commune'),getVal('code_postal')].filter(Boolean).join(' · ')],
      ['DÉLAI',getVal('delai')],['BUDGET',getVal('budget') || 'Non défini']
    ];
    summary.innerHTML = rows.map(([k,v]) => `<div><span>${k}</span><b>${esc(v || '—')}</b></div>`).join('');
  }

  function update(){
    steps.forEach((s,i) => {
      const active = i === step-1;
      s.classList.toggle('active', active);
      s.setAttribute('aria-hidden', String(!active));
    });
    counter.textContent = `ÉTAPE ${String(step).padStart(2,'0')} / 05`;
    title.textContent = titles[step-1];
    bar.style.width = `${step*20}%`;
    prev.style.visibility = step===1 ? 'hidden' : 'visible';
    next.style.display = step===5 ? 'none' : 'inline-flex';
    send.style.display = step===5 ? 'inline-flex' : 'none';
    if(step===5) renderSummary();
    requestAnimationFrame(() => title.focus({preventScroll:true}));
    const top = form.getBoundingClientRect().top + scrollY - 95;
    scrollTo({top:Math.max(0,top),behavior:'smooth'});
  }

  next.addEventListener('click', () => { if(validateStep() && step<5){step++;update();} });
  prev.addEventListener('click', () => { if(step>1){step--;status.textContent='';update();} });

  files?.addEventListener('change', () => {
    const selected=[...files.files];
    const maxEach=5*1024*1024, maxTotal=8*1024*1024;
    const total=selected.reduce((n,f)=>n+f.size,0);
    if(selected.length>5 || selected.some(f=>f.size>maxEach) || total>maxTotal){
      files.value='';
      filesInfo.textContent='Sélection refusée : 5 images max, 5 Mo chacune, 8 Mo au total.';
      status.className='form-status error';
      status.textContent='Réduisez le nombre ou la taille des photos.';
      return;
    }
    filesInfo.textContent=selected.length ? selected.map(f=>f.name).join(' · ') : 'Aucun fichier sélectionné · 5 Mo max par image';
    status.textContent='';
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if(!validateStep()) return;
    if(form.elements._honey.value) return;
    if(Date.now()-startedAt<2500){ status.className='form-status error'; status.textContent='Veuillez vérifier votre demande puis réessayer.'; return; }
    if(Date.now()-lastSubmit<60000){ status.className='form-status error'; status.textContent='Une demande vient déjà d’être envoyée. Attendez une minute avant un nouvel envoi.'; return; }
    lastSubmit=Date.now();

    const fd=new FormData(form);
    fd.append('_subject',`Demande de devis ORIS BAT PRO — ${getVal('service')} — ${getVal('commune')}`);
    fd.append('_template','table');
    send.disabled=next.disabled=prev.disabled=true;
    status.className='form-status'; status.textContent='Envoi de votre demande...';

    const endpoint='https://formsubmit.co/ajax/Orisbatpro@gmail.com';
    let ok=false;
    for(let attempt=0;attempt<2 && !ok;attempt++){
      try{
        const res=await fetch(endpoint,{method:'POST',body:fd,headers:{Accept:'application/json'}});
        ok=res.ok;
      }catch(_){}
      if(!ok && attempt===0) await new Promise(r=>setTimeout(r,900));
    }

    if(ok){
      status.className='form-status success';
      status.innerHTML='✅ Votre demande a bien été envoyée à ORIS BAT PRO. Vous pouvez rester sur cette page.';
      form.reset(); filesInfo.textContent='Aucun fichier sélectionné · 5 Mo max par image';
      step=1; startedAt=Date.now(); update();
    }else{
      status.className='form-status error';
      status.innerHTML='❌ L’envoi n’a pas abouti. Vos informations restent dans le formulaire. Vous pouvez appeler le <a href="tel:0695238453">06 95 23 84 53</a> ou écrire à <a href="mailto:Orisbatpro@gmail.com">Orisbatpro@gmail.com</a>.';
    }
    send.disabled=next.disabled=prev.disabled=false;
  });

  update();
})();
