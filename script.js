
(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const header = $('#siteHeader');
  const menuButton = $('#menuButton');
  const mobileMenu = $('#mobileMenu');
  const progress = $('#readProgress');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const syncScroll = () => {
    header?.classList.toggle('scrolled', scrollY > 14);
    if (progress) {
      const max = document.documentElement.scrollHeight - innerHeight;
      progress.style.width = `${max > 0 ? Math.max(0, Math.min(100, scrollY / max * 100)) : 0}%`;
    }
  };
  addEventListener('scroll', syncScroll, {passive:true});
  syncScroll();

  if (menuButton && header && mobileMenu) {
    const closeMenu = () => {
      header.classList.remove('menu-open');
      document.body.classList.remove('menu-open');
      menuButton.setAttribute('aria-expanded','false');
      menuButton.setAttribute('aria-label','Ouvrir le menu');
    };
    menuButton.addEventListener('click', () => {
      const open = header.classList.toggle('menu-open');
      document.body.classList.toggle('menu-open', open);
      menuButton.setAttribute('aria-expanded', String(open));
      menuButton.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
    $$('a', mobileMenu).forEach(a => a.addEventListener('click', closeMenu));
  }

  const current = location.pathname.split('/').pop() || 'index.html';
  $$('.desktop-nav a').forEach(a => {
    if (a.getAttribute('href') === current) {
      a.classList.add('active');
      a.setAttribute('aria-current','page');
    }
  });

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold:.12, rootMargin:'0px 0px -40px 0px' });
    $$('.reveal').forEach(el => io.observe(el));
  } else {
    $$('.reveal').forEach(el => el.classList.add('is-visible'));
  }

  // Photo-based depth movement: scroll + pointer, never a flat SVG animation.
  const heroDepth = $('.hero-depth');
  if (heroDepth && !reduced) {
    let targetX = 0, targetY = 0, currentX = 0, currentY = 0;
    const update = () => {
      currentX += (targetX-currentX)*.06;
      currentY += (targetY-currentY)*.06;
      heroDepth.style.setProperty('--ry', `${currentX}deg`);
      heroDepth.style.setProperty('--rx', `${currentY}deg`);
      requestAnimationFrame(update);
    };
    update();

    if (matchMedia('(pointer:fine)').matches) {
      addEventListener('pointermove', e => {
        targetX = ((e.clientX/innerWidth)-.5)*3.2;
        targetY = -((e.clientY/innerHeight)-.5)*2.4;
      }, {passive:true});
    }

    addEventListener('scroll', () => {
      const y = Math.min(scrollY, 800);
      $$('.hero-depth .layer').forEach((layer,i) => {
        const speed = i === 0 ? .08 : .14;
        layer.style.marginTop = `${y*speed}px`;
      });
    }, {passive:true});
  }

  // Real 3D perspective on interactive cards
  if (!reduced && matchMedia('(pointer:fine)').matches) {
    $$('[data-tilt]').forEach(card => {
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX-r.left)/r.width-.5;
        const y = (e.clientY-r.top)/r.height-.5;
        card.style.transform = `perspective(1000px) rotateX(${-y*7}deg) rotateY(${x*9}deg) translateY(-3px)`;
      });
      card.addEventListener('pointerleave', () => card.style.transform = '');
    });
  }

  // Before / after comparator
  const compare = $('.compare');
  const slider = $('#compareSlider');
  if (compare && slider) {
    const setSplit = v => compare.style.setProperty('--split', `${v}%`);
    setSplit(slider.value);
    slider.addEventListener('input', () => setSplit(slider.value));
  }

  // FAQ: one at a time
  $$('.faq-list').forEach(list => {
    $$('details', list).forEach(d => d.addEventListener('toggle', () => {
      if (!d.open) return;
      $$('details', list).forEach(other => { if (other !== d) other.open = false; });
    }));
  });

  // Quote form
  const form = $('#quoteForm');
  if (form) {
    const steps = $$('.quote-step', form);
    const counter = $('#quoteCounter');
    const title = $('#quoteTitle');
    const bar = $('#quoteProgress');
    const prev = $('#prevQuote');
    const next = $('#nextQuote');
    const send = $('#sendQuote');
    const status = $('#quoteStatus');
    const summary = $('#quoteSummary');
    const files = $('#quoteFiles');
    const filesInfo = $('#filesInfo');
    const startedAt = Date.now();
    let step = 1;
    let lastSubmit = 0;

    const titles = [
      'Quel type de travaux ?',
      'Décrivez le projet',
      'Où se trouve le chantier ?',
      'Quel délai ?',
      'Vos coordonnées'
    ];

    const serviceMap = {
      'terrassement':'Terrassement',
      'maconnerie':'Maçonnerie',
      'facades-isolation':'Façades & isolation',
      'amenagement-exterieur':'Aménagement extérieur'
    };
    const requested = new URLSearchParams(location.search).get('service');
    if (requested && serviceMap[requested]) {
      const radio = form.querySelector(`input[name="service"][value="${serviceMap[requested]}"]`);
      if (radio) radio.checked = true;
    }

    const value = name => {
      const field = form.elements[name];
      if (!field) return '';
      return field instanceof RadioNodeList ? field.value : field.value;
    };
    const escapeHTML = str => String(str).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));

    const showStatus = (type, message) => {
      status.className = `form-status show ${type}`;
      status.innerHTML = message;
    };
    const clearStatus = () => {
      status.className = 'form-status';
      status.innerHTML = '';
    };

    const validate = () => {
      const panel = steps[step-1];
      const required = $$('[required]', panel);
      for (const field of required) {
        let ok = true;
        if (field.type === 'radio') {
          ok = !!panel.querySelector(`input[name="${field.name}"]:checked`);
        } else if (field.type === 'checkbox') {
          ok = field.checked;
        } else {
          ok = field.value.trim() !== '' && field.validity.valid;
        }
        if (!ok) {
          showStatus('error','Merci de compléter les champs nécessaires avant de continuer.');
          (field.closest('.choice') || field).focus?.();
          return false;
        }
      }
      clearStatus();
      return true;
    };

    const renderSummary = () => {
      const rows = [
        ['Travaux',value('service')],
        ['Projet',value('project_type')],
        ['Commune',[value('commune'),value('postal_code')].filter(Boolean).join(' · ')],
        ['Délai',value('delay')],
        ['Budget',value('budget') || 'Non défini'],
        ['Nom',value('fullname')],
        ['Téléphone',value('phone')],
        ['E-mail',value('email')]
      ];
      summary.innerHTML = rows.map(([k,v]) => `<div><span>${k}</span><b>${escapeHTML(v || '—')}</b></div>`).join('');
    };

    const render = (scroll=true) => {
      steps.forEach((s,i) => {
        const active = i === step-1;
        s.classList.toggle('active',active);
        s.setAttribute('aria-hidden',String(!active));
      });
      counter.textContent = `Étape ${String(step).padStart(2,'0')} / 05`;
      title.textContent = titles[step-1];
      bar.style.width = `${step*20}%`;
      prev.style.visibility = step === 1 ? 'hidden' : 'visible';
      next.style.display = step === 5 ? 'none' : 'inline-flex';
      send.style.display = step === 5 ? 'inline-flex' : 'none';
      if (step === 5) renderSummary();
      if (scroll) scrollTo({top:Math.max(0,form.getBoundingClientRect().top+scrollY-110),behavior:'smooth'});
    };

    next.addEventListener('click', () => {
      if (!validate()) return;
      if (step < 5) { step++; render(); }
    });
    prev.addEventListener('click', () => {
      if (step > 1) { step--; clearStatus(); render(); }
    });

    if (files) {
      files.addEventListener('change', () => {
        const list = [...files.files];
        const maxEach = 5*1024*1024;
        const maxTotal = 8*1024*1024;
        const total = list.reduce((n,f)=>n+f.size,0);
        const typeOK = list.every(f => ['image/jpeg','image/png','image/webp'].includes(f.type));
        if (list.length > 5 || list.some(f=>f.size>maxEach) || total>maxTotal || !typeOK) {
          files.value = '';
          filesInfo.textContent = 'Sélection refusée : 5 images max, 5 Mo chacune, 8 Mo au total.';
          showStatus('error','Réduisez le nombre ou la taille des photos et utilisez JPG, PNG ou WEBP.');
          return;
        }
        filesInfo.textContent = list.length ? list.map(f=>f.name).join(' · ') : '5 images max · 5 Mo chacune · 8 Mo au total';
        clearStatus();
      });
    }

    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!validate()) return;
      if (form.elements._honey.value) return;
      if (Date.now()-startedAt < 2200) {
        showStatus('error','Vérifiez votre demande puis réessayez.');
        return;
      }
      if (Date.now()-lastSubmit < 60000) {
        showStatus('error','Une demande vient déjà d’être envoyée. Attendez une minute avant de recommencer.');
        return;
      }
      lastSubmit = Date.now();

      const fd = new FormData(form);
      fd.append('_subject',`Nouvelle demande ORIS BAT PRO — ${value('service')} — ${value('commune')}`);
      fd.append('_template','table');

      [prev,next,send].forEach(b=>b.disabled=true);
      showStatus('success','Envoi de votre demande en cours…');

      let ok = false;
      for (let attempt=0; attempt<2 && !ok; attempt++) {
        try {
          const res = await fetch('https://formsubmit.co/ajax/Orisbatpro@gmail.com', {
            method:'POST',
            body:fd,
            headers:{Accept:'application/json'}
          });
          ok = res.ok;
        } catch (_) {}
        if (!ok && attempt === 0) await new Promise(r=>setTimeout(r,900));
      }

      if (ok) {
        showStatus('success','✅ Votre demande a bien été envoyée à ORIS BAT PRO. Vous pouvez rester sur cette page.');
        form.reset();
        if (filesInfo) filesInfo.textContent = '5 images max · 5 Mo chacune · 8 Mo au total';
        step = 1;
        render(false);
      } else {
        showStatus('error','❌ L’envoi n’a pas abouti. Appelez le <a href="tel:0695238453">06 95 23 84 53</a> ou écrivez à <a href="mailto:Orisbatpro@gmail.com">Orisbatpro@gmail.com</a>.');
      }
      [prev,next,send].forEach(b=>b.disabled=false);
    });

    render(false);
  }

  // PWA service worker
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(()=>{}));
  }
})();


// ORIS BAT PRO V5 premium interactions
(() => {
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches, fine=matchMedia('(pointer:fine)').matches;
  const loader=$('#introLoader');
  if(loader){
    if(sessionStorage.getItem('oris-v5-intro')||reduced) loader.classList.add('done');
    else{
      const line=$('#introLine'),count=$('#introCount'),start=performance.now();
      const tick=now=>{const t=Math.min(1,(now-start)/1050),n=Math.floor(t*100);if(line)line.style.width=n+'%';if(count)count.textContent=String(n).padStart(3,'0');if(t<1)requestAnimationFrame(tick);else{setTimeout(()=>loader.classList.add('done'),180);sessionStorage.setItem('oris-v5-intro','1')}};requestAnimationFrame(tick);
    }
  }
  const dot=$('#cursorDot'),ring=$('#cursorRing');
  if(fine&&!reduced&&dot&&ring){
    document.body.classList.add('cursor-on');let mx=-100,my=-100,rx=-100,ry=-100;
    addEventListener('pointermove',e=>{mx=e.clientX;my=e.clientY;dot.style.transform=`translate3d(${mx}px,${my}px,0)`},{passive:true});
    const loop=()=>{rx+=(mx-rx)*.14;ry+=(my-ry)*.14;ring.style.transform=`translate3d(${rx}px,${ry}px,0)`;requestAnimationFrame(loop)};loop();
    $$('a,button,label,.viewer360,.compare input').forEach(el=>{el.addEventListener('pointerenter',()=>document.body.classList.add('cursor-hover'));el.addEventListener('pointerleave',()=>document.body.classList.remove('cursor-hover'))});
    $$('.magnetic').forEach(el=>{el.addEventListener('pointermove',e=>{const r=el.getBoundingClientRect(),x=e.clientX-(r.left+r.width/2),y=e.clientY-(r.top+r.height/2);el.style.transform=`translate(${x*.12}px,${y*.12}px)`});el.addEventListener('pointerleave',()=>el.style.transform='')});
  }
  const lab=$('#projectLab');
  if(lab){
    const title=$('#labResultTitle'),copy=$('#labResultCopy'),tags=$('#labResultTags'),link=$('#labToQuote');
    const labels={service:{terrassement:'Terrassement',maconnerie:'Maçonnerie',facade:'Façades & isolation',exterieur:'Aménagement extérieur'},access:{large:'Accès facile',medium:'Accès moyen',tight:'Accès étroit'},slope:{flat:'Terrain plat',light:'Légère pente',slope:'Terrain en pente'},timing:{soon:'Projet proche',months:'1 à 3 mois',later:'Projet à préparer'}};
    const q={terrassement:'terrassement',maconnerie:'maconnerie',facade:'facades-isolation',exterieur:'amenagement-exterieur'};
    const read=n=>lab.querySelector(`input[name="${n}"]:checked`)?.value||'';
    const update=()=>{const s=read('lab_service'),a=read('lab_access'),p=read('lab_slope'),t=read('lab_timing');if(![s,a,p,t].every(Boolean)){title.textContent='Complétez les 4 critères';copy.textContent='Votre profil de chantier apparaîtra ici.';tags.innerHTML='';link.href='devis.html';return}let level='Profil simple';if(a==='tight'||p==='slope')level='Accès / terrain à vérifier';if(a==='tight'&&p==='slope')level='Profil technique';title.textContent=level;copy.textContent=`${labels.service[s]} · ${labels.access[a]} · ${labels.slope[p]} · ${labels.timing[t]}. Ce diagnostic prépare le premier échange, ce n’est pas un devis.`;tags.innerHTML=[labels.service[s],labels.access[a],labels.slope[p],labels.timing[t]].map(x=>`<span>${x}</span>`).join('');const params=new URLSearchParams({service:q[s],access:a,slope:p,timing:t});link.href='devis.html?'+params.toString()};
    $$('input',lab).forEach(i=>i.addEventListener('change',update));update();
  }
})();

window.oris3DFallback=()=>{document.querySelectorAll('.viewer360-loading').forEach(el=>{const s=el.querySelector('span');if(s)s.textContent='Mode photo activé — la 3D n’a pas pu charger.';const i=el.querySelector('i');if(i)i.style.display='none'});};
