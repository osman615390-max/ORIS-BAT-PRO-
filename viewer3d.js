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
      // +X
      1,-1,-1, 1,1,-1, 1,1,1, 1,-1,1,
      // -X
      -1,-1,1, -1,1,1, -1,1,-1, -1,-1,-1,
      // +Y
      -1,1,-1, -1,1,1, 1,1,1, 1,1,-1,
      // -Y
      -1,-1,1, -1,-1,-1, 1,-1,-1, 1,-1,1,
      // +Z
      -1,-1,1, 1,-1,1, 1,1,1, -1,1,1,
      // -Z
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
    const i=[];for(let f=0;f<6;f++){const b=f*4;i.push(b,b+1,b+2,b,b+2,b+3)}
    return {p,n,i};
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
    return {p,n,i};
  }
  function sphereGeom(lat=10,lon=16){
    const p=[],n=[],i=[];
    for(let y=0;y<=lat;y++){const v=y/lat,th=v*Math.PI;for(let x=0;x<=lon;x++){const u=x/lon,ph=u*Math.PI*2;const sx=Math.sin(th)*Math.cos(ph),sy=Math.cos(th),sz=Math.sin(th)*Math.sin(ph);p.push(sx*.5,sy*.5,sz*.5);n.push(sx,sy,sz)}}
    for(let y=0;y<lat;y++)for(let x=0;x<lon;x++){const a=y*(lon+1)+x,b=a+lon+1;i.push(a,b,a+1,b,b+1,a+1)}
    return {p,n,i};
  }
  function terrainGeom(nx=34,nz=26){
    const p=[],n=[],i=[];
    const sx=42,sz=32;
    const height=(x,z)=>Math.sin(x*.23)*.13+Math.cos(z*.29)*.10+Math.sin((x+z)*.11)*.08;
    for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++){
      const px=(x/nx-.5)*sx,pz=(z/nz-.5)*sz,py=height(px,pz);p.push(px,py,pz);
      const e=.15,dx=height(px+e,pz)-height(px-e,pz),dz=height(px,pz+e)-height(px,pz-e);const nn=V3.norm([-dx,2*e,-dz]);n.push(...nn);
    }
    for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const a=z*(nx+1)+x,b=a+nx+1;i.push(a,b,a+1,b,b+1,a+1)}
    return {p,n,i};
  }

  function compile(gl,type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'Shader error');return s;}
  function program(gl){
    const vs=`
      attribute vec3 aPosition;attribute vec3 aNormal;
      uniform mat4 uMVP;uniform mat4 uModel;uniform mat3 uNormalMat;
      varying vec3 vNormal;varying vec3 vWorld;
      void main(){vec4 w=uModel*vec4(aPosition,1.0);vWorld=w.xyz;vNormal=normalize(uNormalMat*aNormal);gl_Position=uMVP*vec4(aPosition,1.0);}
    `;
    const fs=`
      precision highp float;
      varying vec3 vNormal;varying vec3 vWorld;
      uniform vec3 uColor;uniform vec3 uLightDir;uniform vec3 uLightColor;uniform vec3 uAmbient;uniform vec3 uCamera;uniform vec3 uFog;uniform float uRough;uniform float uAlpha;uniform float uEmissive;uniform float uKind;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
      void main(){
        vec3 N=normalize(vNormal);vec3 L=normalize(uLightDir);vec3 V=normalize(uCamera-vWorld);vec3 H=normalize(L+V);
        float ndl=max(dot(N,L),0.0);float specPow=mix(74.0,8.0,clamp(uRough,0.0,1.0));float spec=pow(max(dot(N,H),0.0),specPow)*(1.0-uRough)*.42;
        float noise=(hash(vWorld.xz*3.7)-.5)*.055;float up=.86+.14*max(N.y,0.0);
        vec3 base=max(vec3(0.0),uColor*(1.0+noise));
        vec3 col=base*(uAmbient+uLightColor*ndl*.78)*up+uLightColor*spec+base*uEmissive;
        float d=distance(uCamera,vWorld);float fog=smoothstep(32.0,74.0,d);col=mix(col,uFog,fog);
        col=pow(col,vec3(1.0/2.2));gl_FragColor=vec4(col,uAlpha);
      }
    `;
    const p=gl.createProgram();gl.attachShader(p,compile(gl,gl.VERTEX_SHADER,vs));gl.attachShader(p,compile(gl,gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p)||'Program link error');return p;
  }

  function uploadGeom(gl,g){
    const o={count:g.i.length};
    o.pb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,o.pb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(g.p),gl.STATIC_DRAW);
    o.nb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,o.nb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(g.n),gl.STATIC_DRAW);
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
      pos:gl.getAttribLocation(prog,'aPosition'),norm:gl.getAttribLocation(prog,'aNormal'),
      mvp:gl.getUniformLocation(prog,'uMVP'),model:gl.getUniformLocation(prog,'uModel'),normal:gl.getUniformLocation(prog,'uNormalMat'),
      color:gl.getUniformLocation(prog,'uColor'),lightDir:gl.getUniformLocation(prog,'uLightDir'),lightColor:gl.getUniformLocation(prog,'uLightColor'),ambient:gl.getUniformLocation(prog,'uAmbient'),camera:gl.getUniformLocation(prog,'uCamera'),fog:gl.getUniformLocation(prog,'uFog'),rough:gl.getUniformLocation(prog,'uRough'),alpha:gl.getUniformLocation(prog,'uAlpha'),emissive:gl.getUniformLocation(prog,'uEmissive'),kind:gl.getUniformLocation(prog,'uKind')
    };
    const geoms={box:uploadGeom(gl,cubeGeom()),cyl:uploadGeom(gl,cylinderGeom(24,false)),cone:uploadGeom(gl,cylinderGeom(24,true)),sphere:uploadGeom(gl,sphereGeom(coarse?7:10,coarse?12:18)),terrain:uploadGeom(gl,terrainGeom(coarse?22:34,coarse?16:26))};

    const objects=[];const groups={raw:[],works:[],finished:[],always:[]};
    const add=(geom,pos,scale,color,opts={})=>{
      const o={geom,pos:[...pos],scale:[...scale],rot:[...(opts.rot||[0,0,0])],color:[...color],rough:opts.rough??.78,emissive:opts.emissive??0,alpha:opts.alpha??1,targetAlpha:opts.alpha??1,group:opts.group||'always',role:opts.role||'',kind:opts.kind??0,basePos:[...pos],baseRot:[...(opts.rot||[0,0,0])]};objects.push(o);groups[o.group].push(o);return o;
    };
    const C={soil:[.38,.25,.17],gravel:[.48,.45,.41],paver:[.64,.60,.55],concrete:[.66,.63,.59],wall:[.76,.73,.69],dark:[.11,.12,.13],orange:[.90,.25,.055],steel:[.58,.61,.62],glass:[.18,.29,.34],green:[.16,.27,.17],wood:[.34,.22,.15],white:[.82,.82,.80],asphalt:[.19,.20,.21],shadow:[.025,.025,.025]};

    // Terrain and subtle pads
    add('terrain',[0,-.18,0],[1,1,1],C.soil,{rough:1,kind:1});
    add('box',[0,.01,1],[16,.12,12],C.soil,{group:'raw',rough:1,kind:1});
    const finishedDrive=add('box',[4,.03,1.5],[9,.10,11],C.gravel,{group:'finished',rough:.98,role:'drive',kind:1});
    add('box',[-5,.035,1.2],[8,.10,10],C.gravel,{group:'finished',rough:.98,role:'drive',kind:1});
    add('box',[3,.02,1.7],[10,.11,12],C.soil,{group:'works',rough:1,kind:1});

    // House (modern residential)
    const walls=[];
    walls.push(add('box',[2,2.15,-5],[12,4.2,7],C.wall,{rough:.78,role:'facade'}));
    add('box',[2,4.42,-5],[12.35,.30,7.35],C.dark,{rough:.52});
    walls.push(add('box',[.1,5.55,-5.6],[6.1,2.35,5.5],C.wall,{rough:.78,role:'facade'}));
    add('box',[.1,6.88,-5.6],[6.4,.28,5.8],C.dark,{rough:.52});
    // garage and entry
    add('box',[4.2,1.55,-1.43],[4.6,2.55,.12],C.dark,{rough:.44});
    for(let y=.55;y<2.55;y+=.32)add('box',[4.2,y,-1.34],[4.32,.025,.03],C.steel,{rough:.28});
    add('box',[.65,1.45,-1.42],[1.1,2.35,.15],C.dark,{rough:.42});
    add('box',[.65,1.45,-1.31],[.82,2.0,.05],C.glass,{rough:.20,emissive:.03});
    [[-3.1,1.7,-1.38],[-1.35,1.7,-1.38]].forEach(p=>{add('box',p,[1.35,1.55,.10],C.dark,{rough:.43});add('box',[p[0],p[1],p[2]+.08],[1.12,1.31,.045],C.glass,{rough:.16,emissive:.08})});
    [[-1.7,5.6,-2.79],[.2,5.6,-2.79]].forEach(p=>{add('box',p,[1.45,1.35,.10],C.dark,{rough:.43});add('box',[p[0],p[1],p[2]+.08],[1.2,1.1,.045],C.glass,{rough:.16,emissive:.08})});

    // House contact shadow
    add('box',[2,.015,-4.4],[13.2,.03,8.2],C.shadow,{alpha:.28,rough:1,kind:2});

    // Finished masonry, steps, walls
    add('box',[-2.8,.48,4.25],[8.2,.86,.72],C.concrete,{group:'finished',rough:.94,kind:2});
    add('box',[-4.5,.48,1.5],[5.4,.86,.72],C.concrete,{group:'finished',rough:.94,kind:2});
    for(let i=0;i<5;i++)add('box',[-1.6,.16+i*.20,1.5+i*.53],[4.5,.30,.70],C.concrete,{group:'finished',rough:.95,kind:2});
    // works masonry partial
    add('box',[-2.8,.28,4.25],[8.0,.42,.70],C.concrete,{group:'works',rough:.95,kind:2});
    add('box',[-4.4,.22,1.5],[5.0,.32,.70],C.concrete,{group:'works',rough:.95,kind:2});

    // Excavator detailed silhouette
    add('box',[-7,.38,2.6],[3.8,.48,.62],C.dark,{rough:.92});
    add('box',[-7,.38,1.25],[3.8,.48,.62],C.dark,{rough:.92});
    add('box',[-7,.75,1.92],[3.0,.22,1.65],C.steel,{rough:.34});
    add('box',[-6.9,1.25,1.92],[2.55,.86,1.55],C.orange,{rough:.48});
    add('box',[-6.55,2.35,1.92],[1.25,1.65,1.42],C.dark,{rough:.35});
    add('box',[-6.55,2.42,2.66],[1.0,1.32,.07],C.glass,{rough:.16,emissive:.04});
    const boom1=add('box',[-4.2,3.05,1.92],[3.55,.34,.42],C.orange,{rough:.45});
    const boom2=add('box',[-1.9,2.3,1.92],[2.65,.29,.38],C.orange,{rough:.45});
    const bucket=add('box',[-.66,1.05,1.92],[1.0,.75,.68],C.dark,{rough:.70,rot:[0,0,-.28]});
    add('box',[-7,.05,1.92],[4.4,.04,2.35],C.shadow,{alpha:.34,rough:1});

    // Truck
    add('box',[8.5,1.15,4.5],[2.35,2.0,2.1],C.white,{rough:.66});
    add('box',[8.5,1.65,3.41],[1.85,.85,.08],C.glass,{rough:.18,emissive:.04});
    add('box',[11.1,1.65,4.5],[3.2,1.65,2.15],C.orange,{rough:.52,rot:[0,0,-.04]});
    [[7.75,.55,3.55],[9.25,.55,3.55],[7.75,.55,5.45],[9.25,.55,5.45],[10.5,.55,3.55],[11.7,.55,3.55],[10.5,.55,5.45],[11.7,.55,5.45]].forEach(p=>add('cyl',p,[.62,.32,.62],C.dark,{rough:.94,rot:[Math.PI/2,0,0]}));
    add('box',[9.7,.05,4.5],[6.3,.04,3.1],C.shadow,{alpha:.30,rough:1});

    // Works equipment / cones / soil piles
    for(const [x,z] of [[-1,6.5],[1.1,7],[3,6.4]]){add('cone',[x,.35,z],[.45,.72,.45],C.orange,{group:'works',rough:.60});add('cyl',[x,.03,z],[.65,.06,.65],C.dark,{group:'works',rough:.9});}
    [[-2,.45,6],[2.3,.42,5.9],[5,.36,5.5]].forEach(p=>add('sphere',p,[2.1,.9,1.35],C.soil,{group:'raw',rough:1,kind:1}));
    [[-2,.35,6],[2.3,.30,5.9]].forEach(p=>add('sphere',p,[1.8,.65,1.15],C.soil,{group:'works',rough:1,kind:1}));

    // Finished landscaping
    function tree(x,z,s=.8){add('cyl',[x,.8*s,z],[.26,1.6*s,.26],C.wood,{group:'finished',rough:1});add('sphere',[x,2.0*s,z],[1.5*s,1.7*s,1.5*s],C.green,{group:'finished',rough:1})}
    tree(-6,-3,.9);tree(-8,5,.7);tree(10,-3,.75);
    [[-3,5.6],[-1.7,5.7],[.6,5.5],[7.5,5.5],[5.8,-.3]].forEach(([x,z])=>add('sphere',[x,.48,z],[1.05,.78,1.05],C.green,{group:'finished',rough:1}));

    // Site sign
    add('box',[8.2,1.45,7],[2.9,1.3,.14],C.dark,{rough:.55,rot:[0,-.28,0]});
    add('box',[7.6,.55,7.16],[.10,1.7,.10],C.steel,{rough:.32});add('box',[8.8,.55,6.82],[.10,1.7,.10],C.steel,{rough:.32});

    // Stage state
    let stage='finished';
    function setStage(name){
      stage=name;
      for(const key of ['raw','works','finished']) for(const o of groups[key]) o.targetAlpha=key===name?1:0;
      stageBtns.forEach(b=>b.classList.toggle('active',b.dataset.stage===name));
      if(title) title.textContent=name==='raw'?'Terrain brut':name==='works'?'Travaux en cours':'Projet aménagé';
      if(copy) copy.textContent=name==='raw'?'Le terrain est volontairement laissé brut pour visualiser les volumes de départ.':name==='works'?'La scène montre les zones en préparation, les matériaux et le chantier en cours.':'La cour, les murets, les marches et la végétation apparaissent dans une version conceptuelle finie.';
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
      global:{yaw:.64,pitch:.38,dist:25,target:[0,2,-1.5],title:'Vue globale',copy:'Glissez pour tourner à 360°. Pincez ou utilisez la molette pour zoomer.'},
      terrassement:{yaw:-.68,pitch:.30,dist:15.5,target:[-5.1,1.0,2.2],title:'Terrassement',copy:'Vue centrée sur la mini-pelle, le terrain, les fouilles et la préparation des niveaux.'},
      maconnerie:{yaw:.12,pitch:.26,dist:15,target:[-1.6,.9,3.2],title:'Maçonnerie',copy:'Vue sur les murets, marches, seuils et ouvrages qui structurent les abords.'},
      facade:{yaw:.02,pitch:.28,dist:18.5,target:[2,3.1,-4.6],title:'Façade',copy:'Vue frontale de la maison pour lire les volumes, la finition et les ouvertures.'},
      acces:{yaw:.42,pitch:.25,dist:14.5,target:[5.0,.55,2.2],title:'Accès',copy:'Vue centrée sur la circulation, le stationnement et la préparation de la cour.'},
      machine:{yaw:-.65,pitch:.26,dist:10,target:[-5.2,1.5,2.0],title:'Mini-pelle',copy:'Vue rapprochée de la machine et de sa zone de travail.'},
      truck:{yaw:1.20,pitch:.25,dist:11.5,target:[9.5,1.1,4.3],title:'Camion',copy:'Vue rapprochée du camion-benne et de la zone logistique.'}
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

    // Tour
    const tourViews=['global','terrassement','maconnerie','facade','acces','machine','truck'];
    tourBtn?.addEventListener('click',()=>{touring=!touring;tourBtn.classList.toggle('active',touring);tourBtn.textContent=touring?'■ Arrêter visite':'▶ Visite cinéma';tourTimer=0;if(touring){tourIndex=0;goView(tourViews[tourIndex])}});

    fullBtn?.addEventListener('click',async()=>{try{if(!document.fullscreenElement)await root.requestFullscreen?.();else await document.exitFullscreen?.();}catch(_){} });
    captureBtn?.addEventListener('click',()=>{try{const a=document.createElement('a');a.download='oris-studio-360.png';a.href=canvas.toDataURL('image/png');a.click();}catch(_){}});

    // Hotspots
    const anchors={excavator:[-5.0,3.3,1.92],wall:[-2.8,.9,4.25],facade:[2,4,-1.35],driveway:[5,.3,2],truck:[9.6,2.4,4.5]};
    hotspots.forEach(b=>b.addEventListener('click',()=>{const map={excavator:'machine',wall:'maconnerie',facade:'facade',driveway:'acces',truck:'truck'};goView(map[b.dataset.hotspot]||'global')}));

    // WebGL buffers render helpers
    const bindGeom=g=>{gl.bindBuffer(gl.ARRAY_BUFFER,g.pb);gl.enableVertexAttribArray(loc.pos);gl.vertexAttribPointer(loc.pos,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,g.nb);gl.enableVertexAttribArray(loc.norm);gl.vertexAttribPointer(loc.norm,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,g.ib)};
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
      const p1=[-5.65,2.2,1.92],p2=[-3.55,3.55+Math.sin(t*.00065)*.10,1.92],p3=[-1.25,1.7+Math.sin(t*.00055)*.08,1.92];
      const setSeg=(o,a,b)=>{const d=V3.sub(b,a),mid=V3.mul(V3.add(a,b),.5);o.pos=mid;o.scale[0]=Math.hypot(d[0],d[1],d[2]);o.rot=[0,0,Math.atan2(d[1],d[0])];};
      setSeg(boom1,p1,p2);setSeg(boom2,p2,p3);bucket.pos=[p3[0]+.35,p3[1]-.42,p3[2]];bucket.rot[2]=-.32+Math.sin(t*.00045)*.05;
    }

    function frame(now){
      if(!running){requestAnimationFrame(frame);return}
      const dt=Math.min(.05,(now-last)/1000);last=now;
      if(touring){tourTimer+=dt;if(tourTimer>3.7){tourTimer=0;tourIndex=(tourIndex+1)%tourViews.length;goView(tourViews[tourIndex])}}
      // Smooth camera
      cam.yaw += (camTarget.yaw-cam.yaw)*Math.min(1,dt*5.5);cam.pitch += (camTarget.pitch-cam.pitch)*Math.min(1,dt*5.5);cam.dist += (camTarget.dist-cam.dist)*Math.min(1,dt*5.5);for(let i=0;i<3;i++)cam.target[i]+=(camTarget.target[i]-cam.target[i])*Math.min(1,dt*5.5);
      // stage fade
      for(const o of objects)o.alpha += (o.targetAlpha-o.alpha)*Math.min(1,dt*6.5);
      animateExcavator(now);
      resize();
      const cp=Math.cos(cam.pitch),sp=Math.sin(cam.pitch),sy=Math.sin(cam.yaw),cy=Math.cos(cam.yaw);eye=[cam.target[0]+cam.dist*cp*sy,cam.target[1]+cam.dist*sp,cam.target[2]+cam.dist*cp*cy];
      const proj=M4.perspective(Math.PI/4.25,width/height,.1,120),view=M4.lookAt(eye,cam.target,[0,1,0]);viewProj=M4.mul(proj,view);
      gl.clearColor(...palette.sky,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.useProgram(prog);gl.uniform3fv(loc.lightDir,new Float32Array(palette.dir));gl.uniform3fv(loc.lightColor,new Float32Array(palette.light));gl.uniform3fv(loc.ambient,new Float32Array(palette.ambient));gl.uniform3fv(loc.camera,new Float32Array(eye));gl.uniform3fv(loc.fog,new Float32Array(palette.fog));
      let currentGeom='';
      for(const o of objects){if(o.alpha<.015)continue;const g=geoms[o.geom];if(currentGeom!==o.geom){bindGeom(g);currentGeom=o.geom}
        const model=M4.trs(o.pos,o.rot,o.scale),mvp=M4.mul(viewProj,model);gl.uniformMatrix4fv(loc.model,false,model);gl.uniformMatrix4fv(loc.mvp,false,mvp);gl.uniformMatrix3fv(loc.normal,false,normalMat(model));gl.uniform3fv(loc.color,new Float32Array(o.color));gl.uniform1f(loc.rough,o.rough);gl.uniform1f(loc.alpha,o.alpha);gl.uniform1f(loc.emissive,o.emissive);gl.uniform1f(loc.kind,o.kind);gl.drawElements(gl.TRIANGLES,g.count,gl.UNSIGNED_SHORT,0)}
      updateHotspots();requestAnimationFrame(frame);
    }

    let pageVisible=!document.hidden,inViewport=true;
    const syncRunning=()=>{running=pageVisible&&inViewport;if(running)last=performance.now()};
    document.addEventListener('visibilitychange',()=>{pageVisible=!document.hidden;syncRunning()});
    if('IntersectionObserver'in window){const visIO=new IntersectionObserver(entries=>{for(const e of entries){if(e.target===root){inViewport=e.isIntersecting;syncRunning()}}},{rootMargin:'150px'});visIO.observe(root);}
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();running=false;fail('Le contexte 3D a été interrompu par le navigateur. Rechargez la page pour relancer la scène.')});
    canvas.addEventListener('webglcontextrestored',()=>location.reload());

    root.classList.add('v6-viewer-ready');if(fallback)fallback.style.pointerEvents='none';if(loading)loading.style.display='none';
    root.dataset.engine='native-webgl1';
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
