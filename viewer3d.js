(() => {
  'use strict';

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer:coarse)').matches;
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const lerp = (a,b,t)=>a+(b-a)*t;
  const lerp3 = (a,b,t)=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];

  // -------------------- math --------------------
  const M4 = {
    identity(){return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);},
    mul(a,b){
      const o=new Float32Array(16);
      for(let c=0;c<4;c++) for(let r=0;r<4;r++)
        o[c*4+r]=a[0*4+r]*b[c*4+0]+a[1*4+r]*b[c*4+1]+a[2*4+r]*b[c*4+2]+a[3*4+r]*b[c*4+3];
      return o;
    },
    perspective(fovy,aspect,near,far){
      const f=1/Math.tan(fovy/2), nf=1/(near-far), o=new Float32Array(16);
      o[0]=f/aspect;o[5]=f;o[10]=(far+near)*nf;o[11]=-1;o[14]=2*far*near*nf;return o;
    },
    lookAt(eye,center,up=[0,1,0]){
      let zx=eye[0]-center[0],zy=eye[1]-center[1],zz=eye[2]-center[2];
      let l=Math.hypot(zx,zy,zz)||1;zx/=l;zy/=l;zz/=l;
      let xx=up[1]*zz-up[2]*zy,xy=up[2]*zx-up[0]*zz,xz=up[0]*zy-up[1]*zx;
      l=Math.hypot(xx,xy,xz)||1;xx/=l;xy/=l;xz/=l;
      const yx=zy*xz-zz*xy, yy=zz*xx-zx*xz, yz=zx*xy-zy*xx;
      const o=M4.identity();
      o[0]=xx;o[1]=yx;o[2]=zx;
      o[4]=xy;o[5]=yy;o[6]=zy;
      o[8]=xz;o[9]=yz;o[10]=zz;
      o[12]=-(xx*eye[0]+xy*eye[1]+xz*eye[2]);
      o[13]=-(yx*eye[0]+yy*eye[1]+yz*eye[2]);
      o[14]=-(zx*eye[0]+zy*eye[1]+zz*eye[2]);
      return o;
    },
    translate(x,y,z){const o=M4.identity();o[12]=x;o[13]=y;o[14]=z;return o;},
    scale(x,y,z){const o=M4.identity();o[0]=x;o[5]=y;o[10]=z;return o;},
    rx(a){const c=Math.cos(a),s=Math.sin(a),o=M4.identity();o[5]=c;o[6]=s;o[9]=-s;o[10]=c;return o;},
    ry(a){const c=Math.cos(a),s=Math.sin(a),o=M4.identity();o[0]=c;o[2]=-s;o[8]=s;o[10]=c;return o;},
    rz(a){const c=Math.cos(a),s=Math.sin(a),o=M4.identity();o[0]=c;o[1]=s;o[4]=-s;o[5]=c;return o;},
    trs(p,r,s){return M4.mul(M4.mul(M4.mul(M4.mul(M4.translate(...p),M4.ry(r[1])),M4.rx(r[0])),M4.rz(r[2])),M4.scale(...s));},
    transformPoint(m,p){
      const x=p[0],y=p[1],z=p[2];
      const X=m[0]*x+m[4]*y+m[8]*z+m[12],Y=m[1]*x+m[5]*y+m[9]*z+m[13],Z=m[2]*x+m[6]*y+m[10]*z+m[14],W=m[3]*x+m[7]*y+m[11]*z+m[15];
      return [X,Y,Z,W];
    }
  };

  const V3={
    sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],
    add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],
    mul:(a,s)=>[a[0]*s,a[1]*s,a[2]*s],
    cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
    norm:(a)=>{const l=Math.hypot(...a)||1;return [a[0]/l,a[1]/l,a[2]/l];}
  };

  // -------------------- geometry --------------------
  function cubeGeom(){
    const p=[
      1,-1,-1, 1,1,-1, 1,1,1, 1,-1,1,
      -1,-1,1, -1,1,1, -1,1,-1, -1,-1,-1,
      -1,1,-1, -1,1,1, 1,1,1, 1,1,-1,
      -1,-1,1, -1,-1,-1, 1,-1,-1, 1,-1,1,
      -1,-1,1, 1,-1,1, 1,1,1, -1,1,1,
      1,-1,-1, -1,-1,-1, -1,1,-1, 1,1,-1
    ].map(v=>v*.5);
    const n=[
      1,0,0,1,0,0,1,0,0,1,0,0,
      -1,0,0,-1,0,0,-1,0,0,-1,0,0,
      0,1,0,0,1,0,0,1,0,0,1,0,
      0,-1,0,0,-1,0,0,-1,0,0,-1,0,
      0,0,1,0,0,1,0,0,1,0,0,1,
      0,0,-1,0,0,-1,0,0,-1,0,0,-1
    ];
    const uv=[];
    for(let f=0;f<6;f++)uv.push(0,0,0,1,1,1,1,0);
    const i=[];for(let f=0;f<6;f++){const b=f*4;i.push(b,b+1,b+2,b,b+2,b+3)}
    return {p,n,uv,i};
  }
  function cylinderGeom(segments=24,cone=false){
    const p=[],n=[],i=[];
    for(let s=0;s<=segments;s++){
      const a=s/segments*Math.PI*2,c=Math.cos(a),z=Math.sin(a);
      const rt=cone?0:0.5;
      p.push(c*.5,-.5,z*.5, c*rt,.5,z*rt);
      const sideN=V3.norm([c,cone?.5:0,z]);n.push(...sideN,...sideN);
    }
    for(let s=0;s<segments;s++){const b=s*2;i.push(b,b+2,b+1,b+2,b+3,b+1)}
    const bottomCenter=p.length/3;p.push(0,-.5,0);n.push(0,-1,0);
    const topCenter=p.length/3;p.push(0,.5,0);n.push(0,1,0);
    const bottomStart=p.length/3;
    for(let s=0;s<=segments;s++){const a=s/segments*Math.PI*2,c=Math.cos(a),z=Math.sin(a);p.push(c*.5,-.5,z*.5);n.push(0,-1,0)}
    const topStart=p.length/3;
    for(let s=0;s<=segments;s++){const a=s/segments*Math.PI*2,c=Math.cos(a),z=Math.sin(a);const rt=cone?0:.5;p.push(c*rt,.5,z*rt);n.push(0,1,0)}
    for(let s=0;s<segments;s++){i.push(bottomCenter,bottomStart+s+1,bottomStart+s);if(!cone)i.push(topCenter,topStart+s,topStart+s+1)}
    const uv=new Array((p.length/3)*2).fill(0);return {p,n,uv,i};
  }
  function sphereGeom(lat=10,lon=16){
    const p=[],n=[],i=[];
    for(let y=0;y<=lat;y++){const v=y/lat,th=v*Math.PI;for(let x=0;x<=lon;x++){const u=x/lon,ph=u*Math.PI*2;const sx=Math.sin(th)*Math.cos(ph),sy=Math.cos(th),sz=Math.sin(th)*Math.sin(ph);p.push(sx*.5,sy*.5,sz*.5);n.push(sx,sy,sz)}}
    for(let y=0;y<lat;y++)for(let x=0;x<lon;x++){const a=y*(lon+1)+x,b=a+lon+1;i.push(a,b,a+1,b,b+1,a+1)}
    const uv=new Array((p.length/3)*2).fill(0);return {p,n,uv,i};
  }
  function terrainGeom(nx=34,nz=26){
    const p=[],n=[],uv=[],i=[];
    const sx=42,sz=32;
    const height=(x,z)=>Math.sin(x*.23)*.11+Math.cos(z*.29)*.08+Math.sin((x+z)*.11)*.06;
    for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++){
      const px=(x/nx-.5)*sx,pz=(z/nz-.5)*sz,py=height(px,pz);p.push(px,py,pz);uv.push(x/nx,z/nz);
      const e=.15,dx=height(px+e,pz)-height(px-e,pz),dz=height(px,pz+e)-height(px,pz-e);const nn=V3.norm([-dx,2*e,-dz]);n.push(...nn);
    }
    for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const a=z*(nx+1)+x,b=a+nx+1;i.push(a,b,a+1,b,b+1,a+1)}
    return {p,n,uv,i};
  }

  function compile(gl,type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'Shader error');return s;}
  function program(gl){
    const vs=`
      attribute vec3 aPosition;attribute vec3 aNormal;attribute vec2 aUV;
      uniform mat4 uMVP;uniform mat4 uModel;uniform mat3 uNormalMat;
      varying vec3 vNormal;varying vec3 vWorld;varying vec2 vUV;
      void main(){vec4 w=uModel*vec4(aPosition,1.0);vWorld=w.xyz;vNormal=normalize(uNormalMat*aNormal);vUV=aUV;gl_Position=uMVP*vec4(aPosition,1.0);}
    `;
    const fs=`
      precision highp float;
      varying vec3 vNormal;varying vec3 vWorld;varying vec2 vUV;
      uniform vec3 uColor;uniform vec3 uLightDir;uniform vec3 uLightColor;uniform vec3 uAmbient;uniform vec3 uCamera;uniform vec3 uFog;
      uniform float uRough;uniform float uAlpha;uniform float uEmissive;uniform float uKind;uniform float uUseTex;
      uniform sampler2D uTex;uniform vec2 uTexScale;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
      void main(){
        vec3 N=normalize(vNormal);vec3 L=normalize(uLightDir);vec3 V=normalize(uCamera-vWorld);vec3 H=normalize(L+V);
        float ndl=max(dot(N,L),0.0);float hemi=.44+.56*max(N.y*.5+.5,0.0);
        float specPow=mix(110.0,5.5,clamp(uRough,0.0,1.0));float ndh=max(dot(N,H),0.0);float fres=pow(1.0-max(dot(N,V),0.0),5.0);float spec=pow(ndh,specPow)*(1.0-uRough)*(.28+.42*fres);
        vec3 texCol=texture2D(uTex,vUV*uTexScale).rgb;
        texCol=pow(max(texCol,vec3(0.001)),vec3(2.2));
        float micro=(hash(vWorld.xz*7.3)-.5)*.035;
        vec3 base=mix(uColor,texCol*uColor*1.28,clamp(uUseTex,0.0,1.0));
        base=max(vec3(0.0),base*(1.0+micro));
        float contact=1.0-clamp(exp(-max(vWorld.y,0.0)*1.4)*.09,0.0,.09);
        vec3 col=base*(uAmbient*(.78+.22*hemi)+uLightColor*ndl*.78)*contact+uLightColor*spec+base*uEmissive;
        float d=distance(uCamera,vWorld);float fog=smoothstep(34.0,78.0,d);col=mix(col,uFog,fog);
        col=col/(col+vec3(0.92));col=pow(max(col,vec3(0.0)),vec3(1.0/2.2));gl_FragColor=vec4(col,uAlpha);
      }
    `;
    const p=gl.createProgram();gl.attachShader(p,compile(gl,gl.VERTEX_SHADER,vs));gl.attachShader(p,compile(gl,gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p)||'Program link error');return p;
  }

  function uploadGeom(gl,g){
    const o={count:g.i.length};
    o.pb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,o.pb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(g.p),gl.STATIC_DRAW);
    o.nb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,o.nb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(g.n),gl.STATIC_DRAW);
    o.ub=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,o.ub);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(g.uv||new Array((g.p.length/3)*2).fill(0)),gl.STATIC_DRAW);
    o.ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,o.ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(g.i),gl.STATIC_DRAW);
    return o;
  }

  function createViewer(root){
    if(root.dataset.nativeReady==='1') return;
    root.dataset.nativeReady='1';
    const loading=root.querySelector('.viewer-loading');
    const fallback=root.querySelector('.viewer-fallback');
    const title=root.querySelector('[data-view-title]');
    const copy=root.querySelector('[data-view-copy]');
    const stageBtns=[...root.querySelectorAll('[data-stage]')];
    const viewBtns=[...root.querySelectorAll('[data-view]')];
    const facadeBtns=[...root.querySelectorAll('[data-facade]')];
    const groundBtns=[...root.querySelectorAll('[data-ground]')];
    const timeInput=root.querySelector('[data-time]');
    const liveBtn=root.querySelector('[data-live]');
    const tourBtn=root.querySelector('[data-tour]');
    const lightBtn=root.querySelector('[data-light]');
    const fullBtn=root.querySelector('[data-fullscreen]');
    const captureBtn=root.querySelector('[data-capture]');
    const hotspots=[...root.querySelectorAll('[data-hotspot]')];
    let mobileSettingsBtn=null;
    if(coarse){
      if(captureBtn)captureBtn.style.display='none';
      if(fullBtn)fullBtn.style.display='none';
      mobileSettingsBtn=document.createElement('button');
      mobileSettingsBtn.type='button';
      mobileSettingsBtn.className='v6-mobile-settings';
      mobileSettingsBtn.setAttribute('aria-expanded','false');
      mobileSettingsBtn.textContent='⚙ Réglages';
      root.appendChild(mobileSettingsBtn);
      mobileSettingsBtn.addEventListener('click',()=>{
        const open=root.classList.toggle('mobile-settings-open');
        mobileSettingsBtn.setAttribute('aria-expanded',String(open));
        mobileSettingsBtn.textContent=open?'× Fermer':'⚙ Réglages';
      });
      const mobileSide=root.querySelector('.v6-viewer__side');
      if(mobileSide && (tourBtn || lightBtn)){
        const extra=document.createElement('div');
        extra.className='v6-mobile-extra-actions';
        if(tourBtn)extra.appendChild(tourBtn);
        if(lightBtn)extra.appendChild(lightBtn);
        mobileSide.appendChild(extra);
      }
    }
    const fail=(msg)=>{
      root.classList.add('v6-viewer-fallback-mode');
      root.classList.remove('v6-viewer-ready');
      if(loading){loading.style.display='grid';const b=loading.querySelector('b'),s=loading.querySelector('span');if(b)b.textContent='Mode photo activé';if(s)s.textContent=msg;setTimeout(()=>loading.style.display='none',2200)}
    };

    const canvas=document.createElement('canvas');
    canvas.className='oris-native-webgl';
    canvas.setAttribute('aria-label','Scène 3D interactive ORIS BAT PRO. Faites glisser pour tourner à 360 degrés.');
    canvas.style.touchAction='none';
    root.appendChild(canvas);

    // V7 photographic camera plate: the real chantier image is used only when
    // the virtual camera is close to the angle actually photographed. As the
    // visitor rotates away, it dissolves into the reconstructed 3D twin.
    const livePlate=document.createElement('div');
    livePlate.className='v7-live-camera-plate';
    livePlate.innerHTML='<img src="live-camera-chantier.webp" alt="Vue réelle du chantier servant de référence au jumeau 3D"><span><i></i> VUE PHOTO RÉELLE · ANGLE DE RÉFÉRENCE</span>';
    root.appendChild(livePlate);

    // Safari/iPhone can reject an aggressive WebGL context under GPU pressure.
    // Try a quality profile first, then a conservative compatibility profile.
    const preferredContext={
      antialias:!coarse,
      alpha:false,
      depth:true,
      stencil:false,
      preserveDrawingBuffer:!coarse,
      powerPreference:'high-performance',
      desynchronized:true
    };
    const safeContext={
      antialias:false,
      alpha:false,
      depth:true,
      stencil:false,
      preserveDrawingBuffer:false
    };
    let gl=null;
    try{gl=canvas.getContext('webgl',preferredContext)}catch(_){gl=null}
    if(!gl){try{gl=canvas.getContext('webgl',safeContext)}catch(_){gl=null}}
    if(!gl){try{gl=canvas.getContext('experimental-webgl',safeContext)}catch(_){gl=null}}
    if(!gl){canvas.remove();fail('WebGL n’est pas disponible sur ce navigateur. Le site reste utilisable en mode photo.');return;}

    let prog;
    try{prog=program(gl);}catch(e){console.error('ORIS native 3D shader:',e);canvas.remove();fail('Le moteur 3D n’a pas pu démarrer.');return;}
    gl.useProgram(prog);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);

    const loc={
      pos:gl.getAttribLocation(prog,'aPosition'),norm:gl.getAttribLocation(prog,'aNormal'),uv:gl.getAttribLocation(prog,'aUV'),
      mvp:gl.getUniformLocation(prog,'uMVP'),model:gl.getUniformLocation(prog,'uModel'),normal:gl.getUniformLocation(prog,'uNormalMat'),
      color:gl.getUniformLocation(prog,'uColor'),lightDir:gl.getUniformLocation(prog,'uLightDir'),lightColor:gl.getUniformLocation(prog,'uLightColor'),ambient:gl.getUniformLocation(prog,'uAmbient'),camera:gl.getUniformLocation(prog,'uCamera'),fog:gl.getUniformLocation(prog,'uFog'),rough:gl.getUniformLocation(prog,'uRough'),alpha:gl.getUniformLocation(prog,'uAlpha'),emissive:gl.getUniformLocation(prog,'uEmissive'),kind:gl.getUniformLocation(prog,'uKind'),
      useTex:gl.getUniformLocation(prog,'uUseTex'),tex:gl.getUniformLocation(prog,'uTex'),texScale:gl.getUniformLocation(prog,'uTexScale')
    };
    const geoms={box:uploadGeom(gl,cubeGeom()),cyl:uploadGeom(gl,cylinderGeom(24,false)),cone:uploadGeom(gl,cylinderGeom(24,true)),sphere:uploadGeom(gl,sphereGeom(coarse?7:10,coarse?12:18)),terrain:uploadGeom(gl,terrainGeom(coarse?22:34,coarse?16:26))};
    gl.uniform1i(loc.tex,0);
    const textures={};
    function loadTexture(name,url){
      const t=gl.createTexture();textures[name]=t;gl.bindTexture(gl.TEXTURE_2D,t);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([150,150,150,255]));
      const img=new Image();img.decoding='async';img.onload=()=>{
        gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,1);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.generateMipmap(gl.TEXTURE_2D);
      };img.src=url;
    }
    loadTexture('block','tex-block.webp');loadTexture('concrete','tex-concrete.webp');loadTexture('soil','tex-soil.webp');loadTexture('glass','tex-glass.webp');loadTexture('roof','tex-roof.webp');loadTexture('render','tex-render.webp');loadTexture('paver','tex-paver.webp');
    // V8: photographic material samples cut directly from the supplied chantier photo.
    loadTexture('blockReal','tex-block-real.webp');loadTexture('concreteReal','tex-concrete-real.webp');loadTexture('soilReal','tex-soil-real.webp');loadTexture('glassReal','tex-glass-real.webp');loadTexture('woodReal','tex-wood-real.webp');loadTexture('roofReal','tex-roof-real.webp');


    const objects=[];const groups={raw:[],works:[],finished:[],always:[]};
    const add=(geom,pos,scale,color,opts={})=>{
      const o={geom,pos:[...pos],scale:[...scale],rot:[...(opts.rot||[0,0,0])],color:[...color],rough:opts.rough??.78,emissive:opts.emissive??0,alpha:opts.alpha??1,targetAlpha:opts.alpha??1,group:opts.group||'always',role:opts.role||'',kind:opts.kind??0,basePos:[...pos],baseRot:[...(opts.rot||[0,0,0])],tex:opts.tex||'',texScale:[...(opts.texScale||[1,1])],phase:Math.random()*Math.PI*2};objects.push(o);groups[o.group].push(o);return o;
    };
    // REALSITE 6.4 — scene rebuilt from the real chantier photo supplied by the user.
    const C={soil:[.62,.50,.40],gravel:[.58,.55,.50],paver:[.70,.67,.63],concrete:[.72,.70,.67],block:[.83,.82,.79],render:[.93,.91,.87],dark:[.09,.10,.11],orange:[.93,.28,.055],steel:[.60,.62,.63],glass:[.27,.38,.42],green:[.17,.30,.18],wood:[.39,.24,.14],white:[.89,.87,.83],roof:[.16,.17,.18],red:[.78,.07,.035],blue:[.02,.26,.56],shadow:[.025,.025,.025]};

    // Existing ground & context
    add('terrain',[0,-.20,0],[1,1,1],C.soil,{rough:1,kind:1,tex:'soilReal',texScale:[10,8]});
    // existing house behind / left
    add('box',[-6.5,2.6,-7.0],[6.2,5.1,6.4],C.white,{rough:.92,tex:'render',texScale:[2.5,2.2]});
    add('box',[-7.8,5.45,-7.0],[4.1,.24,6.7],C.roof,{rough:.9,rot:[0,0,.62],tex:'roof',texScale:[3,3]});
    add('box',[-5.1,5.45,-7.0],[4.1,.24,6.7],C.roof,{rough:.9,rot:[0,0,-.62],tex:'roof',texScale:[3,3]});
    add('box',[-4.55,2.1,-3.75],[1.15,2.45,.11],C.dark,{rough:.45});
    add('box',[-4.55,2.15,-3.68],[.88,2.15,.05],C.glass,{rough:.2,tex:'glass',texScale:[1,1],emissive:.04});

    // Extension based on the provided real construction photo: single-storey flat-roof volume.
    const rawWalls=[],workWalls=[],finishedWalls=[];
    const wallDefs=[
      [[0,2.05,-4.15],[10.8,4.0,.42]],       // front
      [[-5.2,2.05,-.8],[.42,4.0,7.1]],       // left side
      [[5.2,2.05,-.8],[.42,4.0,7.1]],        // right side
      [[0,2.05,2.55],[10.8,4.0,.42]]         // rear
    ];
    for(const [pos,scale] of wallDefs){
      rawWalls.push(add('box',pos,scale,C.block,{group:'raw',rough:.98,tex:'blockReal',texScale:[5.5,2.8],role:'rawwall'}));
      workWalls.push(add('box',pos,scale,C.block,{group:'works',rough:.98,tex:'blockReal',texScale:[5.5,2.8],role:'workwall'}));
      finishedWalls.push(add('box',pos,scale,C.render,{group:'finished',rough:.88,tex:'render',texScale:[2.6,2.2],role:'facade'}));
    }
    const walls=finishedWalls;

    // Flat roof slab, concrete in raw/works, dark finished cap.
    add('box',[0,4.28,-.8],[11.55,.45,7.8],C.concrete,{group:'raw',rough:.98,tex:'concreteReal',texScale:[5.0,3.4]});
    add('box',[0,4.28,-.8],[11.55,.45,7.8],C.concrete,{group:'works',rough:.98,tex:'concreteReal',texScale:[5.0,3.4]});
    add('box',[0,4.30,-.8],[11.65,.32,7.9],C.roof,{group:'finished',rough:.72,tex:'roofReal',texScale:[4.8,3.5]});

    // Large sliding bay + side opening, visually close to the reference.
    add('box',[1.55,2.0,-3.90],[5.55,2.85,.17],C.dark,{rough:.35});
    add('box',[1.55,2.0,-3.79],[5.18,2.55,.07],C.glass,{rough:.12,tex:'glassReal',texScale:[1.7,1.0],emissive:.06,alpha:.96});
    add('box',[-3.35,2.0,-3.90],[1.42,2.25,.16],C.dark,{rough:.38});
    add('box',[-3.35,2.0,-3.79],[1.15,1.98,.06],C.glass,{rough:.13,tex:'glassReal',emissive:.04,alpha:.96});

    // Concrete slab / terrace
    add('box',[-.4,.10,-1.2],[12.0,.20,9.2],C.concrete,{group:'raw',rough:1,tex:'concreteReal',texScale:[6.5,4.8]});
    add('box',[-.4,.10,-1.2],[12.0,.20,9.2],C.concrete,{group:'works',rough:1,tex:'concreteReal',texScale:[6.5,4.8]});
    const finishedDrive=add('box',[-.4,.10,-1.2],[12.0,.18,9.2],C.paver,{group:'finished',rough:.92,tex:'paver',texScale:[7,5],role:'drive'});

    // Pool / retaining edge on the right, like the supplied reference.
    add('box',[7.3,.36,1.8],[4.0,.68,7.2],C.concrete,{group:'raw',rough:1,tex:'concrete',texScale:[3,4]});
    add('box',[7.3,.36,1.8],[4.0,.68,7.2],C.concrete,{group:'works',rough:1,tex:'concrete',texScale:[3,4]});
    add('box',[7.3,.32,1.8],[4.0,.60,7.2],C.render,{group:'finished',rough:.88,tex:'render',texScale:[3,4]});
    add('box',[7.3,.68,1.8],[3.4,.05,6.6],[.13,.31,.39],{group:'finished',rough:.18,emissive:.02,alpha:.92});

    // Raw and works earth piles
    [[6.0,.50,5.4],[3.9,.40,5.8],[-2.6,.42,5.6]].forEach((p,i)=>add('sphere',p,[2.5-i*.2,.95-i*.1,1.7],C.soil,{group:'raw',rough:1,kind:1,role:'pile'}));
    [[5.5,.37,5.4],[2.7,.29,5.9]].forEach((p,i)=>add('sphere',p,[1.9-i*.15,.67,1.35],C.soil,{group:'works',rough:1,kind:1,role:'pile'}));

    // Red / blue temporary pipe runs visible during construction.
    const pipeRed=[],pipeBlue=[];
    for(let i=0;i<6;i++){
      pipeRed.push(add('cyl',[3.1+i*.85,.12,6.1-Math.sin(i*.75)*.35],[.10,.92,.10],C.red,{group:'works',rough:.6,rot:[Math.PI/2,0,Math.PI/2],role:'pipe'}));
    }
    for(let i=0;i<5;i++){
      pipeBlue.push(add('cyl',[5.2+i*.72,.12,4.8+Math.sin(i*.8)*.26],[.085,.78,.085],C.blue,{group:'works',rough:.55,rot:[Math.PI/2,0,Math.PI/2],role:'pipe'}));
    }

    // Partial rendering / scaffold during works.
    add('box',[-4.98,2.3,-.82],[.08,2.25,5.0],C.render,{group:'works',rough:.9,tex:'render',texScale:[1.5,2.2],alpha:.78,role:'plaster'});
    for(const x of [-4.2,-1.4,1.4,4.2]){
      add('cyl',[x,2.0,-4.45],[.055,4.0,.055],C.steel,{group:'works',rough:.36,role:'scaffold'});
      add('box',[x,2.1,-4.45],[2.2,.08,.35],C.wood,{group:'works',rough:.9,role:'scaffold'});
    }

    // V8 ULTRA DETAIL — construction clutter and surrounding context inspired by the supplied real photo.
    // Adjacent timber shed / workshop on the right.
    add('box',[10.2,1.65,-4.4],[6.2,3.2,4.4],C.wood,{rough:.92,tex:'woodReal',texScale:[3.3,2.1],role:'context'});
    add('box',[10.2,3.32,-4.4],[6.5,.22,4.7],C.roof,{rough:.94,tex:'roofReal',texScale:[3,2],role:'context'});
    add('box',[8.45,1.45,-2.18],[2.1,2.4,.08],C.shadow,{rough:.95,role:'context'});
    // Neighbor wall continuation visible at the far left.
    add('box',[-10.4,2.15,-5.9],[2.2,4.4,7.0],C.white,{rough:.94,tex:'render',texScale:[1.3,2.0],role:'context'});
    // Concrete perimeter/low wall of the basin visible on the right.
    add('box',[8.3,.72,1.4],[.34,1.34,7.6],C.concrete,{rough:.98,tex:'concreteReal',texScale:[1.2,4],role:'context'});
    add('box',[6.55,.72,5.02],[3.8,1.34,.34],C.concrete,{rough:.98,tex:'concreteReal',texScale:[2.8,1.2],role:'context'});
    // Timber boards leaning against the block wall like the supplied photo.
    const boards=[];
    [[-2.2,1.05,-3.48,-.12],[-2.02,1.02,-3.45,-.18],[-1.83,1.0,-3.42,-.22],[-1.64,.98,-3.39,-.25]].forEach((p,i)=>boards.push(add('box',[p[0],p[1],p[2]],[.12,2.05,.10],C.wood,{group:'works',rough:.94,tex:'woodReal',texScale:[.4,2.4],rot:[0,0,p[3]],role:'clutter'})));
    // Loose planks and a small site bucket on the slab.
    add('box',[-2.7,.24,.9],[2.0,.10,.16],C.wood,{group:'works',rough:.95,tex:'woodReal',texScale:[2.2,.35],rot:[0,.18,-.07],role:'clutter'});
    add('box',[-1.0,.22,1.85],[1.7,.11,.15],C.wood,{group:'works',rough:.95,tex:'woodReal',texScale:[2,.35],rot:[0,-.36,.05],role:'clutter'});
    add('cyl',[2.25,.34,2.65],[.30,.62,.30],C.white,{group:'works',rough:.8,role:'clutter'});
    add('cyl',[2.25,.66,2.65],[.27,.05,.27],C.dark,{group:'works',rough:.7,role:'clutter'});
    // Insulation / conduit coils at the left side.
    for(let i=0;i<4;i++){
      add('cyl',[-5.72,.55+i*.03,-2.25+i*.16],[.62,.14,.62],C.white,{group:'works',rough:.92,rot:[Math.PI/2,0,0],role:'clutter'});
    }
    // More irregular rubble: many stones, not one smooth sphere pile.
    for(let i=0;i<(coarse?24:54);i++){
      const x=4.5+(i%9)*.48+(Math.sin(i*2.17)*.20), z=4.3+Math.floor(i/9)*.43+(Math.cos(i*1.31)*.18), y=.13+((i*7)%4)*.09;
      const s=.12+((i*13)%7)*.035;
      add('sphere',[x,y,z],[s*1.45,s,s*1.15],i%4===0?C.gravel:C.soil,{group:'works',rough:1,tex:i%4===0?'concreteReal':'soilReal',texScale:[1.5,1.5],role:'rubble'});
    }
    // Muddy wheel / track marks across the foreground.
    for(let i=0;i<11;i++){
      add('box',[-5.2+i*.88,.03,6.7+Math.sin(i*.7)*.28],[.60,.025,.12],C.shadow,{group:'works',alpha:.20,rough:1,rot:[0,.05*Math.sin(i),0],role:'trackmark'});
      add('box',[-5.1+i*.88,.03,7.2+Math.sin(i*.72)*.25],[.60,.025,.12],C.shadow,{group:'works',alpha:.16,rough:1,rot:[0,.04*Math.sin(i),0],role:'trackmark'});
    }
    // Vertical downpipes / service stubs visible during construction.
    add('cyl',[5.62,.72,2.5],[.08,1.35,.08],C.blue,{group:'works',rough:.55,role:'service'});
    add('cyl',[6.15,.58,2.25],[.07,1.0,.07],C.red,{group:'works',rough:.55,role:'service'});

    // Excavator only during works; all parts tracked for motion.
    const excavatorParts=[];
    const exAdd=(geom,pos,scale,color,opts={})=>{const o=add(geom,pos,scale,color,{...opts,group:'works',role:'excavator'});excavatorParts.push(o);return o;};
    const trackA=exAdd('box',[-6.7,.42,2.7],[3.9,.52,.64],C.dark,{rough:.94});
    const trackB=exAdd('box',[-6.7,.42,1.25],[3.9,.52,.64],C.dark,{rough:.94});
    const turntable=exAdd('box',[-6.7,.82,1.98],[3.05,.24,1.72],C.steel,{rough:.42});
    const body=exAdd('box',[-6.55,1.35,1.98],[2.65,.95,1.62],C.orange,{rough:.52});
    const cab=exAdd('box',[-6.25,2.42,1.98],[1.28,1.72,1.48],C.dark,{rough:.35});
    exAdd('box',[-6.25,2.48,2.74],[1.02,1.38,.07],C.glass,{rough:.12,tex:'glass',emissive:.05,alpha:.96});
    const boom1=exAdd('box',[-4.0,3.05,1.98],[3.7,.36,.44],C.orange,{rough:.46});
    const boom2=exAdd('box',[-1.55,2.15,1.98],[2.75,.31,.39],C.orange,{rough:.46});
    const bucket=exAdd('box',[-.35,.95,1.98],[1.12,.78,.70],C.dark,{rough:.72,rot:[0,0,-.28]});
    exAdd('box',[-6.7,.05,1.98],[4.5,.04,2.5],C.shadow,{alpha:.30,rough:1});
    // V8 excavator detail: track rollers, cab roof, engine hood, counterweight, pins and bucket teeth.
    for(const z of [1.25,2.70]) for(let i=0;i<6;i++) exAdd('cyl',[-8.05+i*.55,.42,z],[.34,.20,.34],i===0||i===5?C.steel:C.dark,{rough:.72,rot:[Math.PI/2,0,0]});
    exAdd('box',[-6.25,3.35,1.98],[1.45,.12,1.64],C.orange,{rough:.48});
    exAdd('box',[-7.55,1.55,1.98],[.78,.92,1.68],C.orange,{rough:.5});
    exAdd('sphere',[-5.37,2.22,1.98],[.18,.18,.18],C.steel,{rough:.32});
    exAdd('sphere',[-3.34,3.46,1.98],[.16,.16,.16],C.steel,{rough:.32});
    exAdd('cyl',[-4.65,2.83,2.28],[.08,2.55,.08],C.steel,{rough:.25,rot:[0,0,.93]});
    for(let i=0;i<4;i++) exAdd('box',[.06+i*.20,.53,1.98],[.12,.42,.50],C.dark,{rough:.78,rot:[0,0,-.50]});

    // Truck enters/leaves during works.
    const truckParts=[];
    const trAdd=(geom,pos,scale,color,opts={})=>{const o=add(geom,pos,scale,color,{...opts,group:'works',role:'truck'});truckParts.push(o);return o;};
    trAdd('box',[8.8,1.18,5.4],[2.45,2.0,2.1],C.white,{rough:.72});
    trAdd('box',[8.8,1.68,4.31],[1.9,.84,.08],C.glass,{rough:.13,tex:'glass',emissive:.03,alpha:.96});
    trAdd('box',[11.35,1.68,5.4],[3.1,1.60,2.15],C.orange,{rough:.56,rot:[0,0,-.04]});
    [[8.0,.57,4.42],[9.55,.57,4.42],[8.0,.57,6.36],[9.55,.57,6.36],[10.7,.57,4.42],[12.0,.57,4.42],[10.7,.57,6.36],[12.0,.57,6.36]].forEach(p=>trAdd('cyl',p,[.64,.34,.64],C.dark,{rough:.95,rot:[Math.PI/2,0,0]}));

    // Dust particles during earthwork.
    const dust=[];
    for(let i=0;i<(coarse?12:30);i++)dust.push(add('sphere',[-.3,.55,2.0],[.17,.12,.17],[.58,.48,.39],{group:'works',rough:1,alpha:.12,role:'dust'}));

    // Finished retaining wall / landscaping / clean access.
    add('box',[-1.8,.45,4.3],[8.0,.82,.72],C.concrete,{group:'finished',rough:.96,tex:'concrete',texScale:[4,1.5],role:'wall'});
    for(let i=0;i<4;i++)add('box',[-.6,.16+i*.21,2.1+i*.55],[4.4,.28,.74],C.concrete,{group:'finished',rough:.96,tex:'concrete',texScale:[2.4,1.2],role:'steps'});
    function tree(x,z,s=.8){add('cyl',[x,.8*s,z],[.23,1.6*s,.23],C.wood,{group:'finished',rough:1,role:'plant'});add('sphere',[x,2.0*s,z],[1.3*s,1.55*s,1.3*s],C.green,{group:'finished',rough:1,role:'plant'});}
    tree(-7.8,-2.8,.82);tree(9.3,-3.0,.72);
    [[-3.7,4.9],[-2.3,5.1],[.5,5.0],[4.2,4.8]].forEach(([x,z])=>add('sphere',[x,.47,z],[1.05,.78,1.05],C.green,{group:'finished',rough:1,role:'plant'}));

    // Context shadows
    add('box',[0,.018,-.9],[12.2,.035,8.7],C.shadow,{alpha:.22,rough:1,kind:2});
    // Stage state
    let stage='finished',stageChangedAt=performance.now(),liveSequence=false,liveClock=0;
    function setStage(name,fromLive=false){
      stage=name;stageChangedAt=performance.now();
      for(const key of ['raw','works','finished']) for(const o of groups[key]) o.targetAlpha=key===name?1:0;
      stageBtns.forEach(b=>b.classList.toggle('active',b.dataset.stage===name));
      if(title) title.textContent=name==='raw'?'Avant · gros œuvre visible':name==='works'?'En cours · chantier actif':'Après · projet aménagé';
      if(copy) copy.textContent=name==='raw'?'Bloc brut, dalle, terre et réseaux visibles : la scène reprend l’esprit de la photo de chantier fournie.':name==='works'?'La mini-pelle travaille, le camion évolue, la poussière se déplace et certaines finitions apparaissent progressivement.':'Enduit, terrasse, murets, marches et végétalisation : projection conceptuelle de l’état fini.';
      if(!fromLive){liveSequence=false;if(liveBtn){liveBtn.classList.remove('active');liveBtn.textContent='▶ Chantier live';}}
    }
    setStage('finished');
    stageBtns.forEach(b=>b.addEventListener('click',()=>setStage(b.dataset.stage)));

    // Materials
    const facadeColors={mineral:[.76,.73,.69],warm:[.68,.59,.51],light:[.86,.85,.82]};
    facadeBtns.forEach(b=>b.addEventListener('click',()=>{const c=facadeColors[b.dataset.facade]||facadeColors.mineral;walls.forEach(w=>w.color=[...c]);facadeBtns.forEach(x=>x.classList.toggle('active',x===b));}));
    const groundColors={gravel:[.48,.45,.41],light:[.67,.63,.58],graphite:[.25,.26,.27]};
    groundBtns.forEach(b=>b.addEventListener('click',()=>{finishedDrive.color=[...(groundColors[b.dataset.ground]||groundColors.gravel)];groundBtns.forEach(x=>x.classList.toggle('active',x===b));}));

    // Camera orbit state
    const cam={yaw:.64,pitch:.38,dist:25,target:[0,2,-1.5]}, camTarget={yaw:.64,pitch:.38,dist:25,target:[0,2,-1.5]};
    const presets={
      global:{yaw:.58,pitch:.30,dist:23,target:[0,1.9,-.8],title:'Vue globale',copy:'Glissez pour tourner librement autour du chantier. Pincez ou utilisez la molette pour zoomer.'},
      terrassement:{yaw:-.72,pitch:.25,dist:14.5,target:[-3.6,1.0,2.1],title:'Terrassement',copy:'Vue rapprochée de la mini-pelle, des terres et de la préparation des niveaux.'},
      maconnerie:{yaw:.10,pitch:.22,dist:14,target:[-.8,.8,3.0],title:'Maçonnerie',copy:'Vue sur les ouvrages, marches, murets et zones de reprise.'},
      facade:{yaw:.01,pitch:.24,dist:16.5,target:[0,2.4,-3.8],title:'Façade',copy:'Vue frontale de l’extension inspirée de la photo réelle fournie.'},
      acces:{yaw:.48,pitch:.22,dist:14,target:[3.0,.45,1.5],title:'Accès & terrasse',copy:'Vue sur la dalle, la cour et les circulations autour de la maison.'},
      machine:{yaw:-.82,pitch:.20,dist:9.5,target:[-4.3,1.5,2.0],title:'Mini-pelle en action',copy:'Pendant l’étape Travaux, le bras, le godet, la tourelle et la poussière sont animés en temps réel.'},
      truck:{yaw:1.10,pitch:.22,dist:11,target:[10.0,1.2,5.2],title:'Camion chantier',copy:'Le camion se déplace légèrement pendant la phase de travaux pour donner une scène plus vivante.'}
    };
    function goView(name){const p=presets[name]||presets.global;camTarget.yaw=p.yaw;camTarget.pitch=p.pitch;camTarget.dist=p.dist;camTarget.target=[...p.target];viewBtns.forEach(b=>b.classList.toggle('active',b.dataset.view===name));if(title)title.textContent=p.title;if(copy)copy.textContent=p.copy;}
    viewBtns.forEach(b=>b.addEventListener('click',()=>goView(b.dataset.view)));goView('global');

    // Input orbit + pinch
    const pointers=new Map();let lastPinch=0,touring=false,tourIndex=0,tourTimer=0;
    const pointerPoint=e=>({x:e.clientX,y:e.clientY});
    canvas.addEventListener('pointerdown',e=>{
      // Register first: setPointerCapture may throw for synthetic events and on a few Safari edge cases.
      pointers.set(e.pointerId,pointerPoint(e));
      try{canvas.setPointerCapture?.(e.pointerId)}catch(_){}
      if(pointers.size>=2){const vals=[...pointers.values()];lastPinch=Math.hypot(vals[0].x-vals[1].x,vals[0].y-vals[1].y)}
      touring=false;tourBtn?.classList.remove('active');
      if(e.pointerType==='touch')e.preventDefault();
    },{passive:false});
    canvas.addEventListener('pointermove',e=>{
      const prev=pointers.get(e.pointerId);if(!prev)return;
      pointers.set(e.pointerId,pointerPoint(e));
      const vals=[...pointers.values()];
      if(vals.length===1){
        const dx=e.clientX-prev.x,dy=e.clientY-prev.y;
        camTarget.yaw-=dx*.006;
        camTarget.pitch=clamp(camTarget.pitch+dy*.005,.08,1.15);
        root.dataset.last3dInteraction='orbit';
      } else if(vals.length>=2){
        const d=Math.max(12,Math.hypot(vals[0].x-vals[1].x,vals[0].y-vals[1].y));
        if(lastPinch>0)camTarget.dist=clamp(camTarget.dist*(lastPinch/d),7,36);
        lastPinch=d;
        root.dataset.last3dInteraction='pinch';
      }
      if(e.pointerType==='touch')e.preventDefault();
    },{passive:false});
    const release=e=>{
      pointers.delete(e.pointerId);
      try{if(canvas.hasPointerCapture?.(e.pointerId))canvas.releasePointerCapture?.(e.pointerId)}catch(_){}
      if(pointers.size<2)lastPinch=0;
    };
    canvas.addEventListener('pointerup',release);
    canvas.addEventListener('pointercancel',release);
    // Safety net for browsers that deliver the release outside the canvas.
    window.addEventListener('pointerup',release,{passive:true});
    window.addEventListener('pointercancel',release,{passive:true});
    canvas.addEventListener('wheel',e=>{e.preventDefault();camTarget.dist=clamp(camTarget.dist*Math.exp(e.deltaY*.001),7,36);touring=false;tourBtn?.classList.remove('active');root.dataset.last3dInteraction='wheel'},{passive:false});

    // Lighting/time
    let time=timeInput?parseFloat(timeInput.value):17.5;
    const palette={sky:[.38,.51,.63],fog:[.44,.52,.58],ambient:[.25,.28,.31],light:[1.0,.78,.58],dir:[-.3,.8,.4]};
    function updateLight(){
      const t=clamp((time-8)/12,0,1),day=Math.sin(t*Math.PI),eve=Math.pow(Math.max(0,(t-.58)/.42),1.4);
      const morning=[.55,.62,.70],noon=[.49,.67,.82],dusk=[.20,.24,.34];palette.sky= t<.58?lerp3(morning,noon,t/.58):lerp3(noon,dusk,(t-.58)/.42);
      palette.fog=lerp3(palette.sky,[.24,.22,.21],eve*.42);palette.ambient=lerp3([.29,.31,.34],[.12,.14,.18],eve*.78);palette.light=lerp3([1.0,.90,.76],[1.0,.42,.20],eve*.72);
      const a=lerp(-1.15,1.05,t);palette.dir=V3.norm([Math.cos(a)*.55,.25+day*.9,Math.sin(a)*.65]);
    }
    updateLight();timeInput?.addEventListener('input',()=>{time=parseFloat(timeInput.value);updateLight()});
    lightBtn?.addEventListener('click',()=>{time=time<14?17.5:10.5;if(timeInput)timeInput.value=String(time);updateLight();lightBtn.classList.toggle('active',time<14)});

    // LIVE chantier sequence: before -> works (animated) -> finished.
    liveBtn?.addEventListener('click',()=>{
      liveSequence=!liveSequence;liveClock=0;
      liveBtn.classList.toggle('active',liveSequence);
      liveBtn.textContent=liveSequence?'■ Arrêter le live':'▶ Chantier live';
      if(liveSequence){touring=false;tourBtn?.classList.remove('active');if(tourBtn)tourBtn.textContent='🎥 Visite cinéma';setStage('raw',true);goView('global');}
    });

    // Tour
    const tourViews=['global','terrassement','maconnerie','facade','acces','machine','truck'];
    tourBtn?.addEventListener('click',()=>{touring=!touring;tourBtn.classList.toggle('active',touring);tourBtn.textContent=touring?'■ Arrêter visite':'🎥 Visite cinéma';tourTimer=0;if(touring){tourIndex=0;goView(tourViews[tourIndex])}});

    fullBtn?.addEventListener('click',async()=>{try{if(!document.fullscreenElement)await root.requestFullscreen?.();else await document.exitFullscreen?.();}catch(_){} });
    captureBtn?.addEventListener('click',()=>{try{const a=document.createElement('a');a.download='oris-studio-360.png';a.href=canvas.toDataURL('image/png');a.click();}catch(_){}});

    // Hotspots
    const anchors={excavator:[-3.2,2.7,1.98],wall:[-1.8,.9,4.3],facade:[0,2.6,-3.75],driveway:[1.5,.25,1.8],truck:[10.2,1.8,5.4]};
    hotspots.forEach(b=>b.addEventListener('click',()=>{const map={excavator:'machine',wall:'maconnerie',facade:'facade',driveway:'acces',truck:'truck'};goView(map[b.dataset.hotspot]||'global')}));

    // WebGL buffers render helpers
    const bindGeom=g=>{
      gl.bindBuffer(gl.ARRAY_BUFFER,g.pb);gl.enableVertexAttribArray(loc.pos);gl.vertexAttribPointer(loc.pos,3,gl.FLOAT,false,0,0);
      gl.bindBuffer(gl.ARRAY_BUFFER,g.nb);gl.enableVertexAttribArray(loc.norm);gl.vertexAttribPointer(loc.norm,3,gl.FLOAT,false,0,0);
      gl.bindBuffer(gl.ARRAY_BUFFER,g.ub);gl.enableVertexAttribArray(loc.uv);gl.vertexAttribPointer(loc.uv,2,gl.FLOAT,false,0,0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,g.ib)
    };
    function normalMat(m){return new Float32Array([m[0],m[1],m[2],m[4],m[5],m[6],m[8],m[9],m[10]])}
    let width=1,height=1,dpr=1,viewProj=M4.identity(),eye=[0,0,0],running=true,last=performance.now();
    function resize(){const r=root.getBoundingClientRect();dpr=Math.min(devicePixelRatio||1,coarse?1.25:1.7);width=Math.max(320,Math.floor(r.width*dpr));height=Math.max(520,Math.floor(r.height*dpr));if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;canvas.style.width=r.width+'px';canvas.style.height=r.height+'px';gl.viewport(0,0,width,height)}}
    let ro=null;
    if('ResizeObserver' in window){ro=new ResizeObserver(resize);ro.observe(root)}
    else window.addEventListener('resize',resize,{passive:true});
    resize();

    function updateHotspots(){
      for(const b of hotspots){const a=anchors[b.dataset.hotspot];if(!a)continue;const p=M4.transformPoint(viewProj,a);if(p[3]<=0){b.classList.remove('show');continue}const nx=p[0]/p[3],ny=p[1]/p[3],nz=p[2]/p[3];if(nx<-1||nx>1||ny<-1||ny>1||nz<-1||nz>1){b.classList.remove('show');continue}b.style.left=((nx*.5+.5)*100)+'%';b.style.top=((1-(ny*.5+.5))*100)+'%';b.classList.add('show')}
    }

    function animateExcavator(t){
      if(stage!=='works')return;
      const k=t*.001;
      // 9 second work cycle: reach -> lower -> curl bucket -> lift -> swing -> dump -> return.
      const cycle=(k%9.0)/9.0;
      const smooth=x=>x*x*(3.0-2.0*x);
      const reach=cycle<.24?smooth(cycle/.24):cycle<.54?1.0:cycle<.82?(1.0-smooth((cycle-.54)/.28)):0.0;
      const dig=cycle<.32?smooth(cycle/.32):cycle<.58?1.0:1.0-smooth((cycle-.58)/.42);
      const swing=cycle<.48?0.0:cycle<.72?smooth((cycle-.48)/.24)*.36:cycle<.90?.36*(1.0-smooth((cycle-.72)/.18)):0.0;
      // whole machine breathes/works subtly
      for(const o of excavatorParts){o.pos[2]=o.basePos[2]+swing*.55;}
      body.rot[1]=body.baseRot[1]+swing*.24;cab.rot[1]=cab.baseRot[1]+swing*.22;turntable.rot[1]=turntable.baseRot[1]+swing*.30;
      const p1=[-5.35,2.22,1.98+swing*.75],p2=[-3.45+reach*.38,3.62-dig*.48,1.98+swing*.75],p3=[-1.25+reach*.72,1.92-dig*.72,1.98+swing*.75];
      const setSeg=(o,a,b)=>{const d=V3.sub(b,a),mid=V3.mul(V3.add(a,b),.5);o.pos=mid;o.scale[0]=Math.hypot(d[0],d[1],d[2]);o.rot=[0,0,Math.atan2(d[1],d[0])];};
      setSeg(boom1,p1,p2);setSeg(boom2,p2,p3);bucket.pos=[p3[0]+.35,p3[1]-.46,p3[2]];bucket.rot[2]=-.30-dig*.62;
      // track vibration and slow travel
      const travel=Math.sin(k*.18)*.18;trackA.pos[0]=trackA.basePos[0]+travel;trackB.pos[0]=trackB.basePos[0]+travel;turntable.pos[0]=turntable.basePos[0]+travel;body.pos[0]=body.basePos[0]+travel;cab.pos[0]=cab.basePos[0]+travel;
      // truck rolls slightly in/out of the work zone
      const truckShift=Math.sin(k*.20)*.38;for(const o of truckParts)o.pos[0]=o.basePos[0]+truckShift;
      // animated dust follows bucket and rises/fades
      for(let i=0;i<dust.length;i++){const o=dust[i],ph=o.phase+i*.37,r=.3+(i%5)*.13;o.pos[0]=bucket.pos[0]+Math.cos(k*.9+ph)*r;o.pos[2]=bucket.pos[2]+Math.sin(k*.8+ph)*r;o.pos[1]=.25+((k*.35+ph)%1.0)*1.15;o.alpha=.04+.10*(1-((k*.35+ph)%1.0));}
    }

    function frame(now){
      if(!running){requestAnimationFrame(frame);return}
      const dt=Math.min(.05,(now-last)/1000);last=now;
      if(touring){tourTimer+=dt;if(tourTimer>3.7){tourTimer=0;tourIndex=(tourIndex+1)%tourViews.length;goView(tourViews[tourIndex])}}
      if(liveSequence){
        liveClock+=dt;
        if(stage==='raw'&&liveClock>4.2){liveClock=0;setStage('works',true);goView('terrassement');}
        else if(stage==='works'&&liveClock>14.0){liveClock=0;setStage('finished',true);goView('global');}
        else if(stage==='finished'&&liveClock>6.5){liveClock=0;liveSequence=false;if(liveBtn){liveBtn.classList.remove('active');liveBtn.textContent='▶ Chantier live';}}
      }
      // Smooth camera
      cam.yaw += (camTarget.yaw-cam.yaw)*Math.min(1,dt*5.5);
      // Blend the real camera plate only around its true capture angle.
      // This avoids pretending a single photograph contains unseen 360° data.
      if(livePlate){
        const refYaw=-0.48;
        let da=Math.atan2(Math.sin(cam.yaw-refYaw),Math.cos(cam.yaw-refYaw));
        const angleBlend=Math.max(0,1-Math.abs(da)/0.42);
        const stageBlend=stage==='works'?1:(stage==='raw'?.20:.10);
        livePlate.style.opacity=String(Math.pow(angleBlend,2.15)*stageBlend);
        livePlate.style.transform=`scale(${1.025-angleBlend*.025}) translate3d(${da*18}px,0,0)`;
        livePlate.style.pointerEvents='none';
      }cam.pitch += (camTarget.pitch-cam.pitch)*Math.min(1,dt*5.5);cam.dist += (camTarget.dist-cam.dist)*Math.min(1,dt*5.5);for(let i=0;i<3;i++)cam.target[i]+=(camTarget.target[i]-cam.target[i])*Math.min(1,dt*5.5);
      // stage fade
      for(const o of objects)o.alpha += (o.targetAlpha-o.alpha)*Math.min(1,dt*6.5);
      animateExcavator(now);
      // subtle ambient life in finished stage and progressive plaster during works
      if(stage==='finished'&&!reduced){for(const o of objects){if(o.role==='plant')o.rot[2]=Math.sin(now*.00055+o.phase)*.018;}}
      if(stage==='works'){const elapsed=(now-stageChangedAt)/1000;for(const o of objects){if(o.role==='plaster')o.targetAlpha=.35+.45*(.5+.5*Math.sin(elapsed*.65));}}
      resize();
      const cp=Math.cos(cam.pitch),sp=Math.sin(cam.pitch),sy=Math.sin(cam.yaw),cy=Math.cos(cam.yaw);eye=[cam.target[0]+cam.dist*cp*sy,cam.target[1]+cam.dist*sp,cam.target[2]+cam.dist*cp*cy];
      const proj=M4.perspective(Math.PI/4.25,width/height,.1,120),view=M4.lookAt(eye,cam.target,[0,1,0]);viewProj=M4.mul(proj,view);
      gl.clearColor(...palette.sky,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.useProgram(prog);gl.uniform3fv(loc.lightDir,new Float32Array(palette.dir));gl.uniform3fv(loc.lightColor,new Float32Array(palette.light));gl.uniform3fv(loc.ambient,new Float32Array(palette.ambient));gl.uniform3fv(loc.camera,new Float32Array(eye));gl.uniform3fv(loc.fog,new Float32Array(palette.fog));
      let currentGeom='';
      for(const o of objects){if(o.alpha<.015)continue;const g=geoms[o.geom];if(currentGeom!==o.geom){bindGeom(g);currentGeom=o.geom}
        const model=M4.trs(o.pos,o.rot,o.scale),mvp=M4.mul(viewProj,model);gl.uniformMatrix4fv(loc.model,false,model);gl.uniformMatrix4fv(loc.mvp,false,mvp);gl.uniformMatrix3fv(loc.normal,false,normalMat(model));gl.uniform3fv(loc.color,new Float32Array(o.color));gl.uniform1f(loc.rough,o.rough);gl.uniform1f(loc.alpha,o.alpha);gl.uniform1f(loc.emissive,o.emissive);gl.uniform1f(loc.kind,o.kind);
        const tex=o.tex&&textures[o.tex];gl.uniform1f(loc.useTex,tex?1:0);gl.uniform2fv(loc.texScale,new Float32Array(o.texScale));if(tex){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex);}
        gl.drawElements(gl.TRIANGLES,g.count,gl.UNSIGNED_SHORT,0)}
      updateHotspots();requestAnimationFrame(frame);
    }

    let pageVisible=!document.hidden,inViewport=true;
    const syncRunning=()=>{running=pageVisible&&inViewport;if(running)last=performance.now()};
    document.addEventListener('visibilitychange',()=>{pageVisible=!document.hidden;syncRunning()});
    if('IntersectionObserver'in window){const visIO=new IntersectionObserver(entries=>{for(const e of entries){if(e.target===root){inViewport=e.isIntersecting;syncRunning()}}},{rootMargin:'150px'});visIO.observe(root);}
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();running=false;fail('Le contexte 3D a été interrompu par le navigateur. Rechargez la page pour relancer la scène.')});
    canvas.addEventListener('webglcontextrestored',()=>location.reload());

    root.classList.add('v6-viewer-ready');if(fallback)fallback.style.pointerEvents='none';if(loading)loading.style.display='none';
    root.dataset.engine='v8-ultra-photoreal-native-webgl1';
    requestAnimationFrame(frame);
  }

  function boot(){
    const viewers=[...document.querySelectorAll('[data-viewer360]')];
    if(!viewers.length)return;
    // Initialize deterministically instead of waiting on IntersectionObserver.
    // This removes an iOS/Safari race where the observer could miss a viewer inside
    // a large cinematic section after page restore / BFCache / orientation changes.
    viewers.forEach(v=>{
      try{createViewer(v)}catch(err){
        console.error('ORIS Native3D:',err);
        v.classList.add('v6-viewer-fallback-mode');
        const l=v.querySelector('.viewer-loading');
        if(l){const b=l.querySelector('b'),sp=l.querySelector('span');if(b)b.textContent='Mode photo activé';if(sp)sp.textContent='La 3D n’a pas pu démarrer sur cet appareil.';setTimeout(()=>l.style.display='none',2200)}
      }
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
