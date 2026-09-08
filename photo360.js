
(() => {
 const qs=(s,r=document)=>r.querySelector(s), qsa=(s,r=document)=>[...r.querySelectorAll(s)];
 const viewers=qsa('[data-photo360]'); if(!viewers.length)return;
 const VS=`attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`;
 const FS=`precision mediump float;uniform vec2 r;uniform float yaw,pitch,fov,mixv;uniform sampler2D ta,tb;const float PI=3.14159265359;
 vec2 uv(vec3 d){float lon=atan(d.x,-d.z),lat=asin(clamp(d.y,-1.,1.));return vec2(fract(lon/(2.*PI)+.5),clamp(.5-lat/PI,.001,.999));}
 void main(){vec2 p=gl_FragCoord.xy/r*2.-1.;p.x*=r.x/r.y;float t=tan(radians(fov)*.5);vec3 d=normalize(vec3(p.x*t,p.y*t,-1.));
 float cp=cos(pitch),sp=sin(pitch);d=vec3(d.x,d.y*cp-d.z*sp,d.y*sp+d.z*cp);float cy=cos(yaw),sy=sin(yaw);d=vec3(d.x*cy+d.z*sy,d.y,-d.x*sy+d.z*cy);
 vec3 c=mix(texture2D(ta,uv(d)).rgb,texture2D(tb,uv(d)).rgb,mixv);vec2 q=p*vec2(.72,1.);float vig=smoothstep(1.42,.48,length(q));c*=mix(.88,1.025,vig);gl_FragColor=vec4(c,1.);}`;
 function sh(gl,t,s){const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(o));return o}
 function prog(gl){const p=gl.createProgram();gl.attachShader(p,sh(gl,gl.VERTEX_SHADER,VS));gl.attachShader(p,sh(gl,gl.FRAGMENT_SHADER,FS));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p}
 function tex(gl,url){return new Promise((res,rej)=>{const im=new Image();im.onload=()=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,im);res(t)};im.onerror=rej;im.src=url})}
 function init(root){
  const c=qs('canvas',root),loading=qs('.photo360-loading',root),fallback=qs('.photo360-fallback',root);
  const title=qs('[data-360-title]',root),desc=qs('[data-360-desc]',root),status=qs('[data-360-status]',root);
  let gl;try{gl=c.getContext('webgl',{alpha:false,antialias:true,powerPreference:'high-performance'});if(!gl)throw Error()}catch(_){root.classList.add('photo360-fallback-mode');return}
  const p=prog(gl);gl.useProgram(p);const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const al=gl.getAttribLocation(p,'a');gl.enableVertexAttribArray(al);gl.vertexAttribPointer(al,2,gl.FLOAT,false,0,0);
  const U={r:gl.getUniformLocation(p,'r'),yaw:gl.getUniformLocation(p,'yaw'),pitch:gl.getUniformLocation(p,'pitch'),fov:gl.getUniformLocation(p,'fov'),mix:gl.getUniformLocation(p,'mixv'),ta:gl.getUniformLocation(p,'ta'),tb:gl.getUniformLocation(p,'tb')};
  const urls={avant:'pano-avant.webp',encours:'pano-encours.webp',apres:'pano-apres.webp'};
  const meta={avant:['Avant travaux','Terrain et existant avant transformation.'],encours:['Chantier en cours','Terrassement, maçonnerie, réseaux et engins en activité.'],apres:['Projet final','Extérieurs aménagés et lecture finale de la maison.']};
  const nodes={global:[.05,-.03,72],pelle:[1.18,-.06,56],facade:[-.52,.02,58],terrain:[2.40,-.12,62],acces:[-2.18,-.06,60],materiaux:[.76,-.10,55]};
  let ts={},state='encours',cur,nxt,m=0,y=.05,pi=-.04,fo=72,ty=y,tp=pi,tf=fo,pts=new Map(),last=[0,0],pinch=0,pinchF=72,live=false,liveStart=0;
  const sBtns=qsa('[data-360-state]',root),nBtns=qsa('[data-360-node]',root),liveBtn=qs('[data-live-tour]',root);
  function resize(){const R=root.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,innerWidth<700?1.2:1.6),w=Math.max(320,R.width*d|0),h=Math.max(420,R.height*d|0);if(c.width!==w||c.height!==h){c.width=w;c.height=h}gl.viewport(0,0,w,h)}
  function bind(loc,t,u){gl.activeTexture(gl.TEXTURE0+u);gl.bindTexture(gl.TEXTURE_2D,t);gl.uniform1i(loc,u)}
  function norm(a){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a}
  function hotspots(){const asp=c.width/c.height,tan=Math.tan(fo*Math.PI/360);qsa('[data-hotspot]',root).forEach(el=>{const hy=+el.dataset.yaw,hp=+el.dataset.pitch,dy=norm(hy-y),dp=hp-pi,z=Math.cos(dp)*Math.cos(dy);if(z<.12){el.style.opacity=0;el.style.pointerEvents='none';return}const x=Math.cos(dp)*Math.sin(dy)/z,yy=Math.sin(dp)/z,sx=.5+(x/(tan*asp))*.5,sy=.5-(yy/tan)*.5,v=sx>-.08&&sx<1.08&&sy>-.08&&sy<1.08;el.style.opacity=v?1:0;el.style.pointerEvents=v?'auto':'none';el.style.left=sx*100+'%';el.style.top=sy*100+'%'})}
  function frame(){resize();y+=(ty-y)*.09;pi+=(tp-pi)*.09;fo+=(tf-fo)*.09;gl.uniform2f(U.r,c.width,c.height);gl.uniform1f(U.yaw,y);gl.uniform1f(U.pitch,pi);gl.uniform1f(U.fov,fo);gl.uniform1f(U.mix,m);bind(U.ta,cur,0);bind(U.tb,nxt||cur,1);gl.drawArrays(gl.TRIANGLES,0,6);hotspots();requestAnimationFrame(frame)}
  function setmeta(s){if(title)title.textContent=meta[s][0];if(desc)desc.textContent=meta[s][1];if(status)status.textContent=s==='avant'?'AVANT':s==='encours'?'EN COURS':'APRÈS';sBtns.forEach(b=>b.classList.toggle('active',b.dataset.state===s))}
  function switchS(s,d=650){if(!ts[s]||s===state)return;nxt=ts[s];m=0;const st=performance.now();setmeta(s);(function q(n){let t=Math.min(1,(n-st)/d);m=t*t*(3-2*t);if(t<1)requestAnimationFrame(q);else{cur=nxt;nxt=cur;m=0;state=s}})(st)}
  function go(n){if(!nodes[n])return;[ty,tp,tf]=nodes[n];nBtns.forEach(b=>b.classList.toggle('active',b.dataset.node===n))}
  function clamp(){tp=Math.max(-.62,Math.min(.58,tp));tf=Math.max(36,Math.min(92,tf))}
  c.addEventListener('pointerdown',e=>{live=false;liveBtn?.classList.remove('active');c.setPointerCapture?.(e.pointerId);pts.set(e.pointerId,[e.clientX,e.clientY]);last=[e.clientX,e.clientY]});
  c.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId))return;pts.set(e.pointerId,[e.clientX,e.clientY]);const a=[...pts.values()];if(a.length===1){const dx=e.clientX-last[0],dy=e.clientY-last[1];ty-=dx*.0042;tp+=dy*.0036;last=[e.clientX,e.clientY];clamp()}else if(a.length===2){const d=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);if(!pinch){pinch=d;pinchF=tf}tf=pinchF*(pinch/d);clamp()}});
  const up=e=>{pts.delete(e.pointerId);if(pts.size<2)pinch=0};c.addEventListener('pointerup',up);c.addEventListener('pointercancel',up);c.addEventListener('wheel',e=>{e.preventDefault();tf+=e.deltaY*.035;clamp()},{passive:false});
  sBtns.forEach(b=>b.addEventListener('click',()=>switchS(b.dataset.state)));nBtns.forEach(b=>b.addEventListener('click',()=>go(b.dataset.node)));
  qs('[data-reset-view]',root)?.addEventListener('click',()=>{ty=.05;tp=-.04;tf=72});
  qs('[data-fullscreen]',root)?.addEventListener('click',async()=>{try{document.fullscreenElement?await document.exitFullscreen():await root.requestFullscreen()}catch(_){}});
  qsa('[data-hotspot]',root).forEach(el=>el.addEventListener('click',()=>{const P=qs('.photo360-info',root);if(!P)return;qs('b',P).textContent=el.dataset.title||'Zone';qs('span',P).textContent=el.dataset.copy||'';P.classList.add('show');setTimeout(()=>P.classList.remove('show'),4500)}));
  liveBtn?.addEventListener('click',()=>{live=!live;liveBtn.classList.toggle('active',live);liveStart=performance.now();if(!live)return;switchS('avant',400);(function tour(now){if(!live)return;const s=(now-liveStart)/1000;ty=.08+s*.11;tp=-.04+Math.sin(s*.5)*.025;tf=66+Math.sin(s*.3)*3;if(s>4&&s<4.15)switchS('encours',600);if(s>12&&s<12.15)switchS('apres',850);if(s>20){live=false;liveBtn.classList.remove('active');return}requestAnimationFrame(tour)})(liveStart)});
  Promise.all(Object.entries(urls).map(async([k,u])=>[k,await tex(gl,u)])).then(E=>{ts=Object.fromEntries(E);cur=ts.encours;nxt=cur;loading?.remove();fallback?.classList.add('loaded');setmeta('encours');go('global');frame()}).catch(()=>root.classList.add('photo360-fallback-mode'));
 }
 if('IntersectionObserver'in window){const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){init(e.target);io.unobserve(e.target)}}),{rootMargin:'500px'});viewers.forEach(v=>io.observe(v))}else viewers.forEach(init);
})();
