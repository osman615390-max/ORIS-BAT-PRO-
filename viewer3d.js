import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/environments/RoomEnvironment.js';
import { Sky } from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/objects/Sky.js';
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/postprocessing/RenderPass.js';
import { SSAOPass } from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/postprocessing/SSAOPass.js';

const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse=matchMedia('(pointer:coarse)').matches;
const mobile=coarse||innerWidth<820;

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;

function seeded(seed=12345){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}}

function makeTexture(renderer,kind,base='#777',size=256){
  const c=document.createElement('canvas');c.width=c.height=size;const x=c.getContext('2d');const rnd=seeded(kind.split('').reduce((n,ch)=>n+ch.charCodeAt(0),100));
  x.fillStyle=base;x.fillRect(0,0,size,size);
  if(kind==='soil'){
    for(let i=0;i<3300;i++){const v=Math.floor(35+rnd()*70),a=.05+rnd()*.13;x.fillStyle=`rgba(${v+35},${v+14},${v},${a})`;const r=.5+rnd()*3;x.beginPath();x.arc(rnd()*size,rnd()*size,r,0,Math.PI*2);x.fill()}
  }else if(kind==='gravel'||kind==='paver'){
    for(let i=0;i<1500;i++){const v=Math.floor(95+rnd()*95);x.fillStyle=`rgba(${v},${v-4},${v-8},${.10+rnd()*.24})`;const w=1+rnd()*4,h=1+rnd()*3;x.fillRect(rnd()*size,rnd()*size,w,h)}
    if(kind==='paver'){x.strokeStyle='rgba(35,35,35,.14)';x.lineWidth=2;for(let y=0;y<size;y+=32){x.beginPath();x.moveTo(0,y);x.lineTo(size,y);x.stroke()}for(let y=0;y<size;y+=32){const off=(y/32)%2?16:0;for(let xx=-off;xx<size;xx+=64){x.beginPath();x.moveTo(xx,y);x.lineTo(xx,y+32);x.stroke()}}}
  }else if(kind==='concrete'){
    for(let i=0;i<1000;i++){const v=Math.floor(150+rnd()*55);x.fillStyle=`rgba(${v},${v},${v},${.05+rnd()*.08})`;x.fillRect(rnd()*size,rnd()*size,1+rnd()*2,1+rnd()*2)}
  }else if(kind==='facade'){
    for(let i=0;i<900;i++){const v=Math.floor(190+rnd()*45);x.fillStyle=`rgba(${v},${v-2},${v-5},${.025+rnd()*.045})`;x.fillRect(rnd()*size,rnd()*size,1,1)}
  }else if(kind==='asphalt'){
    for(let i=0;i<1800;i++){const v=Math.floor(40+rnd()*45);x.fillStyle=`rgba(${v},${v},${v},${.07+rnd()*.13})`;x.fillRect(rnd()*size,rnd()*size,1+rnd()*2,1+rnd()*2)}
  }
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(kind==='facade'?3:kind==='concrete'?5:8,kind==='facade'?3:kind==='concrete'?5:8);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;
}

function createLabelTexture(renderer,text,bg='#f05b13',fg='#0a0b0c'){
  const c=document.createElement('canvas');c.width=512;c.height=128;const x=c.getContext('2d');x.fillStyle=bg;x.fillRect(0,0,c.width,c.height);x.fillStyle=fg;x.font='900 54px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText(text,c.width/2,c.height/2+2);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;
}

function createViewer(root){
  const loading=root.querySelector('.viewer-loading');
  const title=root.querySelector('[data-view-title]'),copy=root.querySelector('[data-view-copy]');
  const stageButtons=[...root.querySelectorAll('[data-stage]')],viewButtons=[...root.querySelectorAll('[data-view]')];
  const facadeButtons=[...root.querySelectorAll('[data-facade]')],groundButtons=[...root.querySelectorAll('[data-ground]')];
  const timeInput=root.querySelector('[data-time]'),tourBtn=root.querySelector('[data-tour]'),lightBtn=root.querySelector('[data-light]'),fullBtn=root.querySelector('[data-fullscreen]'),captureBtn=root.querySelector('[data-capture]');
  const hotspotButtons=Object.fromEntries([...root.querySelectorAll('[data-hotspot]')].map(b=>[b.dataset.hotspot,b]));

  const scene=new THREE.Scene();scene.background=new THREE.Color(0x9fb4c2);scene.fog=new THREE.FogExp2(0xb7c4cb,.0095);
  const camera=new THREE.PerspectiveCamera(41,1,.1,220);camera.position.set(16,10,18);
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.25:1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;renderer.domElement.style.touchAction='none';root.appendChild(renderer.domElement);

  const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;pmrem.dispose();
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.055;controls.enablePan=false;controls.minDistance=7;controls.maxDistance=35;controls.maxPolarAngle=Math.PI*.49;controls.target.set(0,2,0);

  // Sky + sun
  const sky=new Sky();sky.scale.setScalar(450000);scene.add(sky);const skyU=sky.material.uniforms;skyU.turbidity.value=7;skyU.rayleigh.value=2.2;skyU.mieCoefficient.value=.004;skyU.mieDirectionalG.value=.8;
  const hemi=new THREE.HemisphereLight(0xe6f0ff,0x46372d,1.65);scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xffd0a0,4.4);sun.castShadow=true;sun.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);sun.shadow.camera.left=-32;sun.shadow.camera.right=32;sun.shadow.camera.top=30;sun.shadow.camera.bottom=-28;sun.shadow.camera.near=.5;sun.shadow.camera.far=90;sun.shadow.bias=-.00018;scene.add(sun);
  const fill=new THREE.DirectionalLight(0xaecbff,1.0);fill.position.set(12,10,-16);scene.add(fill);

  // Textures + materials
  const tex={soil:makeTexture(renderer,'soil','#624632'),gravel:makeTexture(renderer,'gravel','#8a8178'),paver:makeTexture(renderer,'paver','#a49b91'),concrete:makeTexture(renderer,'concrete','#bcb5ad'),facade:makeTexture(renderer,'facade','#ded7ce'),asphalt:makeTexture(renderer,'asphalt','#434548')};
  const wallMat=new THREE.MeshStandardMaterial({color:0xded6cb,map:tex.facade,roughness:.74,metalness:0});
  const wallAccent=new THREE.MeshStandardMaterial({color:0x343638,roughness:.63,metalness:.04});
  const concreteMat=new THREE.MeshStandardMaterial({color:0xbab2a8,map:tex.concrete,roughness:.88});
  const soilMat=new THREE.MeshStandardMaterial({color:0x76513a,map:tex.soil,roughness:1});
  const gravelMat=new THREE.MeshStandardMaterial({color:0x91877c,map:tex.gravel,roughness:.97});
  const paverMat=new THREE.MeshStandardMaterial({color:0xb3aaa0,map:tex.paver,roughness:.93});
  const driveMat=paverMat.clone();
  const metalOrange=new THREE.MeshStandardMaterial({color:0xe86119,roughness:.48,metalness:.24});
  const metalDark=new THREE.MeshStandardMaterial({color:0x282c2f,roughness:.46,metalness:.38});
  const tireMat=new THREE.MeshStandardMaterial({color:0x151617,roughness:.94,metalness:.02});
  const steelMat=new THREE.MeshStandardMaterial({color:0xaeb4b5,roughness:.30,metalness:.72});
  const glassMat=new THREE.MeshPhysicalMaterial({color:0x516b77,roughness:.12,metalness:.04,transmission:.18,transparent:true,opacity:.82,clearcoat:.45});
  const interiorMat=new THREE.MeshStandardMaterial({color:0xffc483,emissive:0xff8a3c,emissiveIntensity:.55,roughness:.8});
  const greenMat=new THREE.MeshStandardMaterial({color:0x3e5542,roughness:.95});
  const barkMat=new THREE.MeshStandardMaterial({color:0x70503d,roughness:1});
  const whiteMat=new THREE.MeshStandardMaterial({color:0xe8e6e1,roughness:.65});
  const labelTex=createLabelTexture(renderer,'ORIS BAT PRO');
  const labelMat=new THREE.MeshBasicMaterial({map:labelTex,toneMapped:false});

  const raw=new THREE.Group(),works=new THREE.Group(),finished=new THREE.Group(),always=new THREE.Group();scene.add(raw,works,finished,always);
  const anchors={};
  function mesh(g,m,p=[0,0,0],r=[0,0,0],parent=always,shadow=true){const o=new THREE.Mesh(g,m);o.position.set(...p);o.rotation.set(...r);o.castShadow=shadow;o.receiveShadow=true;parent.add(o);return o}
  const box=(w,h,d,m,p,r=[0,0,0],par=always)=>mesh(new THREE.BoxGeometry(w,h,d),m,p,r,par);
  const cyl=(r,h,m,p,rot=[0,0,0],par=always,segments=24)=>mesh(new THREE.CylinderGeometry(r,r,h,segments),m,p,rot,par);
  function anchor(name,pos,parent=always){const o=new THREE.Object3D();o.position.set(...pos);parent.add(o);anchors[name]=o;return o}
  function cylinderBetween(a,b,r,mat,parent){const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),mid=A.clone().add(B).multiplyScalar(.5),len=A.distanceTo(B);const g=new THREE.CylinderGeometry(r,r,len,16);const o=new THREE.Mesh(g,mat);o.position.copy(mid);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),B.clone().sub(A).normalize());o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}

  // Terrain with actual relief
  const groundGeo=new THREE.PlaneGeometry(68,52,mobile?42:80,mobile?32:60);const gp=groundGeo.attributes.position;const rnd=seeded(7042);
  for(let i=0;i<gp.count;i++){const x=gp.getX(i),y=gp.getY(i);const edge=Math.max(Math.abs(x)/34,Math.abs(y)/26);const z=(Math.sin(x*.31)+Math.cos(y*.38))*0.055+(rnd()-.5)*.10+Math.max(0,edge-.72)*.35;gp.setZ(i,z)}gp.needsUpdate=true;groundGeo.computeVertexNormals();const ground=mesh(groundGeo,soilMat,[0,-.18,0],[-Math.PI/2,0,0],always,false);

  // House foundation / architecture
  const house=new THREE.Group();house.position.set(2,0,-5.2);always.add(house);
  box(13,.35,8.8,concreteMat,[0,.12,0],[0,0,0],house);
  box(13,4.25,8.2,wallMat,[0,2.35,0],[0,0,0],house);
  box(5.4,2.45,.20,wallAccent,[3.4,1.55,4.12],[0,0,0],house); // garage front
  // garage slats
  for(let y=.48;y<2.55;y+=.34)box(5.1,.035,.035,steelMat,[3.4,y,4.24],[0,0,0],house);
  // entry and windows
  box(1.2,2.55,.18,wallAccent,[.1,1.46,4.15],[0,0,0],house);box(.9,2.22,.07,glassMat,[.1,1.45,4.26],[0,0,0],house);
  const lowerWindows=[[-4.3,1.72,4.18],[-2.3,1.72,4.18]];lowerWindows.forEach(p=>{box(1.55,1.75,.10,wallAccent,p,[0,0,0],house);box(1.30,1.50,.07,glassMat,[p[0],p[1],p[2]+.09],[0,0,0],house);box(1.16,1.34,.05,interiorMat,[p[0],p[1],p[2]-.08],[0,0,0],house)});
  box(13,.34,8.55,wallAccent,[0,4.58,0],[0,0,0],house);
  // upper volume
  box(6.5,2.65,6.3,wallMat,[-1.25,5.88,-.8],[0,0,0],house);box(6.8,.30,6.58,wallAccent,[-1.25,7.33,-.8],[0,0,0],house);
  [[-3.1,5.95,2.37],[-.95,5.95,2.37]].forEach(p=>{box(1.75,1.55,.11,wallAccent,p,[0,0,0],house);box(1.48,1.30,.07,glassMat,[p[0],p[1],p[2]+.09],[0,0,0],house);box(1.30,1.14,.05,interiorMat,[p[0],p[1],p[2]-.08],[0,0,0],house)});
  // side window and terrace canopy
  box(2.8,2.0,.11,wallAccent,[-6.52,2.0,-.8],[0,Math.PI/2,0],house);box(2.5,1.72,.07,glassMat,[-6.60,2.0,-.8],[0,Math.PI/2,0],house);
  box(4.3,.18,2.3,wallAccent,[-4.2,4.15,3.2],[0,0,0],house);box(.12,3.75,.12,steelMat,[-6.1,2.1,4.0],[0,0,0],house);
  // downpipes / small details
  cyl(.055,4.1,steelMat,[6.25,2.2,4.18],[0,0,0],house,12);cyl(.055,4.1,steelMat,[-6.25,2.2,4.18],[0,0,0],house,12);
  anchor('facade',[0,4.0,4.6],house);

  const interiorLights=[];for(const p of [[-4.3,1.7,-.5],[-2.3,1.7,-.5],[-3.1,5.9,-1],[-.95,5.9,-1]]){const l=new THREE.PointLight(0xff9d56,0,6,2);l.position.set(...p);house.add(l);interiorLights.push(l)}

  // RAW stage: dirt heaps, markers, rough driveway
  box(15,.16,12,soilMat,[-5,.03,2.8],[0,.04,0],raw);box(8,.16,13,soilMat,[7,.02,2],[0,-.02,0],raw);
  for(let i=0;i<6;i++){const heap=mesh(new THREE.ConeGeometry(1.2+i*.05,.65+i*.04,16),soilMat,[-10+i*2.8,.35,7+(i%2)*.8],[0,i*.3,0],raw);heap.scale.z=1.35}
  for(const p of [[-8,8],[-2,8],[5,8],[10,6]]){cyl(.045,1.3,barkMat,[p[0],.65,p[1]],[0,0,0],raw,10);box(.55,.12,.02,whiteMat,[p[0],1.12,p[1]],[0,0,0],raw)}

  // WORKS stage: trench, sub-base, half walls, pipe, cones, dust
  box(15,.16,12,gravelMat,[-5,.04,2.8],[0,.04,0],works);box(8,.16,13,gravelMat,[7,.04,2],[0,-.02,0],works);
  const trench=box(1.0,.72,11,soilMat,[3,-.18,2],[0,0,0],works);trench.material=soilMat.clone();trench.material.color.set(0x3c281f);
  cyl(.14,10.6,new THREE.MeshStandardMaterial({color:0xb5b8ba,roughness:.55,metalness:.05}),[3,-.05,2],[Math.PI/2,0,0],works,18);
  for(let i=0;i<5;i++)box(5.2,.48,.72,concreteMat,[-2.0,.23+i*.23,1.4+i*.65],[0,0,0],works);
  function cone(x,z,par=works){mesh(new THREE.ConeGeometry(.23,.70,20),metalOrange,[x,.36,z],[0,0,0],par);cyl(.33,.06,tireMat,[x,.03,z],[0,0,0],par,20)}
  [[-1,8],[1,8.5],[4.4,7.4],[7,8]].forEach(p=>cone(...p));

  // FINISHED stage: driveway, walls, stairs, greenery
  const driveMeshes=[box(15,.18,12,driveMat,[-5,.05,2.8],[0,.04,0],finished),box(8,.18,13,driveMat,[7,.05,2],[0,-.02,0],finished)];
  for(let i=0;i<6;i++)box(5.4,.55,.76,concreteMat,[-2.0,.28+i*.25,1.35+i*.62],[0,0,0],finished);
  box(9,.95,.78,concreteMat,[-2.7,.42,5.0],[0,0,0],finished);box(6.0,.95,.78,concreteMat,[-4.7,.42,1.5],[0,0,0],finished);anchor('wall',[-2.5,1.35,4.9],finished);anchor('driveway',[6,.35,2.5],finished);
  function tree(x,z,s=1){cyl(.14,2.1*s,barkMat,[x,1.05*s,z],[0,0,0],finished,14);const crown=mesh(new THREE.IcosahedronGeometry(1.05*s,2),greenMat,[x,2.4*s,z],[0,0,0],finished);crown.scale.set(1,.9,1)}
  tree(-9,-3,.9);tree(-11,5,.8);tree(11,-4,.78);tree(12,7,.68);
  for(const [x,z,s] of [[-5,6,.7],[-3.2,6.2,.55],[-.7,5.8,.65],[8.5,5.4,.7],[10,4.7,.5]]){const bush=mesh(new THREE.IcosahedronGeometry(s,2),greenMat,[x,s*.65,z],[0,0,0],finished);bush.scale.y=.72}
  // garden lights
  for(const [x,z] of [[-4,5.8],[0,5.8],[8,5.6]]){cyl(.055,.65,wallAccent,[x,.32,z],[0,0,0],finished,12);const l=mesh(new THREE.SphereGeometry(.10,12,8),interiorMat,[x,.69,z],[0,0,0],finished);l.material=l.material.clone()}

  // Excavator in WORKS group, much more detailed
  const excavator=new THREE.Group();excavator.position.set(-8,.35,2.1);excavator.rotation.y=.36;works.add(excavator);
  function track(z){box(4.35,.64,.52,tireMat,[0,.47,z],[0,0,0],excavator);for(let i=-1.45;i<=1.45;i+=.72)cyl(.24,.56,metalDark,[i,.48,z],[Math.PI/2,0,0],excavator,20)}
  track(.78);track(-.78);box(3.35,.28,2.0,metalDark,[0,.90,0],[0,0,0],excavator);cyl(.56,.25,metalDark,[0,1.04,0],[0,0,0],excavator,30);
  box(2.65,.98,1.85,metalOrange,[.05,1.48,0],[0,0,0],excavator);const counter=mesh(new THREE.SphereGeometry(.88,24,16),metalOrange,[-.95,1.63,0],[0,0,0],excavator);counter.scale.set(1.15,.72,1.0);
  box(1.45,1.78,1.58,metalDark,[.52,2.67,.04],[0,0,0],excavator);box(1.12,1.34,.08,glassMat,[.56,2.76,.86],[0,0,0],excavator);box(.08,1.35,1.20,glassMat,[1.25,2.76,.05],[0,Math.PI/2,0],excavator);box(1.55,.12,1.7,metalDark,[.52,3.60,.03],[0,0,0],excavator);
  box(1.30,.32,.05,labelMat,[-.12,1.54,.95],[0,0,0],excavator);
  const boomPivot=new THREE.Group();boomPivot.position.set(1.08,2.10,0);excavator.add(boomPivot);box(3.95,.42,.54,metalOrange,[1.78,.80,0],[0,0,-.43],boomPivot);
  const armPivot=new THREE.Group();armPivot.position.set(3.50,-.04,0);boomPivot.add(armPivot);box(3.05,.35,.48,metalOrange,[1.28,-.74,0],[0,0,.59],armPivot);
  const bucket=new THREE.Group();bucket.position.set(2.72,-1.62,0);armPivot.add(bucket);box(1.08,.78,.78,metalDark,[0,0,0],[0,0,-.15],bucket);for(const z of [-.28,0,.28])box(.45,.12,.12,steelMat,[.68,-.28,z],[0,0,-.15],bucket);
  cylinderBetween([.8,.33,.40],[2.4,1.14,.40],.07,steelMat,boomPivot);cylinderBetween([3.0,.05,.38],[4.55,-.85,.38],.06,steelMat,boomPivot);
  anchor('excavator',[1.0,3.6,0],excavator);

  // Van in finished/all background
  function createVan(){const g=new THREE.Group();g.position.set(9,.25,-8.2);g.rotation.y=-.42;always.add(g);box(4.1,1.65,1.85,whiteMat,[0,1.2,0],[0,0,0],g);box(1.35,1.45,1.86,whiteMat,[2.25,1.18,0],[0,0,0],g);box(1.08,.70,.08,glassMat,[2.52,1.55,.94],[0,0,0],g);box(2.15,.40,.04,labelMat,[.15,1.30,.95],[0,0,0],g);for(const x of [-1.35,1.85]){for(const z of [-.93,.93])cyl(.37,.20,tireMat,[x,.45,z],[Math.PI/2,0,0],g,24)}return g}
  createVan();
  // Tipper truck
  const truck=new THREE.Group();truck.position.set(11,.38,6.4);truck.rotation.y=-1.12;always.add(truck);box(2.0,1.75,2.0,whiteMat,[2.1,1.25,0],[0,0,0],truck);box(.95,.78,.08,glassMat,[2.18,1.55,1.02],[0,0,0],truck);box(3.6,.28,1.8,metalDark,[0,1.04,0],[0,0,0],truck);const tip=box(3.6,1.25,1.75,metalOrange,[-.55,1.85,0],[0,0,.10],truck);for(const x of [-1.6,.25,1.85])for(const z of [-.96,.96])cyl(.42,.22,tireMat,[x,.46,z],[Math.PI/2,0,0],truck,24);anchor('truck',[0,3.0,0],truck);

  // dust particles in works stage
  const dustCount=mobile?55:120,dustPos=new Float32Array(dustCount*3),dr=seeded(90210);for(let i=0;i<dustCount;i++){dustPos[i*3]=-10+dr()*8;dustPos[i*3+1]=.3+dr()*3;dustPos[i*3+2]=-1+dr()*7}const dustGeo=new THREE.BufferGeometry();dustGeo.setAttribute('position',new THREE.BufferAttribute(dustPos,3));const dustMat=new THREE.PointsMaterial({color:0xc79a78,size:mobile?.09:.075,transparent:true,opacity:.28,depthWrite:false});const dust=new THREE.Points(dustGeo,dustMat);works.add(dust);

  // isolate stage materials so fade animation is independent
  for(const group of [raw,works,finished])group.traverse(o=>{if(o.isMesh&&o.material){o.material=o.material.clone();o.material.transparent=true;o.material.userData.baseOpacity=o.material.opacity??1}});
  const stageAlpha={raw:0,works:0,finished:1},stageTarget={raw:0,works:0,finished:1};let stage='finished';
  function setStage(name){stage=name;Object.keys(stageTarget).forEach(k=>stageTarget[k]=k===name?1:0);stageButtons.forEach(b=>b.classList.toggle('active',b.dataset.stage===name));if(name==='raw'){title.textContent='Terrain brut';copy.textContent='Avant intervention : sol, pente, accès et contraintes restent à étudier.'}else if(name==='works'){title.textContent='Chantier en cours';copy.textContent='Mini-pelle, sous-couche, tranchée, ouvrages en construction et logistique sont visibles.'}else{title.textContent='Projet fini';copy.textContent='Cour, murets, marches, végétation et finitions sont présentés comme concept d’inspiration.'}}
  stageButtons.forEach(b=>b.addEventListener('click',()=>setStage(b.dataset.stage)));setStage('finished');

  // materials configurator
  const facadeColors={mineral:0xded6cb,warm:0xcab39f,light:0xf0ede7};facadeButtons.forEach(b=>b.addEventListener('click',()=>{wallMat.color.setHex(facadeColors[b.dataset.facade]||facadeColors.mineral);facadeButtons.forEach(x=>x.classList.toggle('active',x===b))}));
  const groundModes={gravel:{color:0x91877c,map:tex.gravel,rough:.97},light:{color:0xb7aea4,map:tex.paver,rough:.92},graphite:{color:0x4a4c4e,map:tex.paver,rough:.88}};groundButtons.forEach(b=>b.addEventListener('click',()=>{const m=groundModes[b.dataset.ground]||groundModes.gravel;driveMeshes.forEach(dm=>{dm.material.color.setHex(m.color);dm.material.map=m.map;dm.material.roughness=m.rough;dm.material.needsUpdate=true});groundButtons.forEach(x=>x.classList.toggle('active',x===b))}));

  // Time / sun
  let hour=17.5;function updateSun(h){hour=h;const t=(h-8)/12;const az=THREE.MathUtils.degToRad(-120+t*210);const elev=THREE.MathUtils.degToRad(18+Math.sin(t*Math.PI)*42);const dir=new THREE.Vector3(Math.cos(elev)*Math.cos(az),Math.sin(elev),Math.cos(elev)*Math.sin(az));sun.position.copy(dir).multiplyScalar(38);skyU.sunPosition.value.copy(dir);const golden=1-Math.abs(t-.78)/.42;sun.color.set(golden>.35?0xffb06d:0xffe1bd);sun.intensity=2.4+Math.sin(t*Math.PI)*2.4;hemi.intensity=1.15+Math.sin(t*Math.PI)*.75;renderer.toneMappingExposure=.83+Math.sin(t*Math.PI)*.38;const duskFactor=clamp((.28-Math.sin(t*Math.PI))/.28,0,1)+clamp((t-.79)/.21,0,1);interiorMat.emissiveIntensity=.35+duskFactor*2.2;interiorLights.forEach(l=>l.intensity=duskFactor*3.2);scene.fog.color.setHSL(.58,.16,.70-Math.abs(t-.5)*.20);if(timeInput)timeInput.value=String(h)}
  timeInput?.addEventListener('input',()=>updateSun(Number(timeInput.value)));updateSun(hour);
  lightBtn?.addEventListener('click',()=>{const next=hour<18?19:12.5;updateSun(next);lightBtn.classList.toggle('active',next>18);lightBtn.textContent=next>18?'☾ Crépuscule':'☀ Lumière'});

  // Camera presets
  const presets={
    global:{p:[16,10,18],t:[0,2.1,0],n:'Vue globale',c:'Tournez autour de la maison à 360°. Pincez ou utilisez la molette pour zoomer.'},
    terrassement:{p:[-14,6,12],t:[-5,.8,2.4],n:'Terrassement',c:'Vue sur le relief du terrain, la préparation des niveaux et la zone d’intervention de la mini-pelle.'},
    maconnerie:{p:[6,6,14],t:[-2,1.25,3.7],n:'Maçonnerie',c:'Vue centrée sur les marches, murets et ouvrages qui structurent les abords.'},
    facade:{p:[13,8,7],t:[2,3.4,-4.5],n:'Façade',c:'Vue détaillée de la maison, des ouvertures, du soubassement et du rendu de façade.'},
    acces:{p:[15,4.8,13],t:[6,.45,2.7],n:'Accès & cour',c:'Vue sur la circulation véhicule, la cour, les niveaux et le stationnement.'},
    machine:{p:[-12,4.1,6.8],t:[-7.2,1.7,2.0],n:'Mini-pelle',c:'Vue rapprochée de la machine 3D, de son bras articulé, de ses chenilles et de la zone de travail.'},
    truck:{p:[15,4,9],t:[10.5,1.5,5.8],n:'Camion-benne',c:'Vue sur la logistique matériaux et évacuation représentée dans la scène conceptuelle.'}
  };
  let goalPos=new THREE.Vector3(...presets.global.p),goalTarget=new THREE.Vector3(...presets.global.t),cameraAnimating=true;
  function go(name){const p=presets[name]||presets.global;if(name==='machine')setStage('works');goalPos.set(...p.p);goalTarget.set(...p.t);cameraAnimating=true;viewButtons.forEach(b=>b.classList.toggle('active',b.dataset.view===name));title.textContent=p.n;copy.textContent=p.c;stopTour(false)}
  viewButtons.forEach(b=>b.addEventListener('click',()=>go(b.dataset.view)));go('global');

  // Hotspots
  const hotspotToView={excavator:'machine',wall:'maconnerie',facade:'facade',driveway:'acces',truck:'truck'};Object.entries(hotspotButtons).forEach(([name,b])=>b.addEventListener('click',()=>go(hotspotToView[name]||'global')));
  const tmp=new THREE.Vector3();function updateHotspots(){const r=root.getBoundingClientRect();for(const [name,obj] of Object.entries(anchors)){const b=hotspotButtons[name];if(!b)continue;obj.getWorldPosition(tmp);tmp.project(camera);const visible=tmp.z>-1&&tmp.z<1&&Math.abs(tmp.x)<1.03&&Math.abs(tmp.y)<1.03;b.classList.toggle('show',visible);if(visible){b.style.left=`${(tmp.x*.5+.5)*r.width}px`;b.style.top=`${(-tmp.y*.5+.5)*r.height}px`}}}

  // cinematic tour
  const tourSequence=['global','terrassement','machine','maconnerie','facade','acces','truck','global'];let tourActive=false,tourStep=0,tourTime=0,tourStartPos=new THREE.Vector3(),tourStartTarget=new THREE.Vector3();
  function startSegment(){const name=tourSequence[tourStep%tourSequence.length],p=presets[name];tourStartPos.copy(camera.position);tourStartTarget.copy(controls.target);goalPos.set(...p.p);goalTarget.set(...p.t);if(name==='machine')setStage('works');else if(tourStep>3)setStage('finished');title.textContent='VISITE CINÉMA · '+p.n;copy.textContent=p.c;tourTime=0}
  function startTour(){tourActive=true;tourStep=0;controls.enabled=false;tourBtn?.classList.add('active');if(tourBtn)tourBtn.textContent='■ Stop cinéma';startSegment()}
  function stopTour(resetText=true){if(!tourActive)return;tourActive=false;controls.enabled=true;tourBtn?.classList.remove('active');if(tourBtn&&resetText)tourBtn.textContent='▶ Visite cinéma'}
  tourBtn?.addEventListener('click',()=>tourActive?stopTour():startTour());controls.addEventListener('start',()=>stopTour());

  // Fullscreen & capture
  if(fullBtn&&!root.requestFullscreen)fullBtn.style.display='none';
  fullBtn?.addEventListener('click',async()=>{try{if(!document.fullscreenElement){await root.requestFullscreen?.();fullBtn.classList.add('active')}else{await document.exitFullscreen?.();fullBtn.classList.remove('active')}}catch(_){}});
  document.addEventListener('fullscreenchange',()=>fullBtn?.classList.toggle('active',document.fullscreenElement===root));
  captureBtn?.addEventListener('click',()=>{try{const url=renderer.domElement.toDataURL('image/png');const a=document.createElement('a');a.href=url;a.download=`ORIS-Realsite-${Date.now()}.png`;a.click();captureBtn.textContent='✓ Capture créée';setTimeout(()=>captureBtn.textContent='⌁ Capture',1600)}catch(_){captureBtn.textContent='Capture indisponible'}});

  // post-processing desktop only
  let composer=null,ssao=null;if(!mobile){try{composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));ssao=new SSAOPass(scene,camera,1,1);ssao.kernelRadius=9;ssao.minDistance=.002;ssao.maxDistance=.13;composer.addPass(ssao)}catch(e){console.warn('SSAO disabled',e);composer=null}}

  function resize(){const rect=root.getBoundingClientRect(),w=Math.max(320,rect.width),h=Math.max(540,rect.height);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);composer?.setSize(w,h);if(ssao){ssao.width=w;ssao.height=h}}
  new ResizeObserver(resize).observe(root);resize();

  // animation loop + GPU pause when the studio is off-screen / tab hidden
  let viewerInView=true;
  if('IntersectionObserver' in window){const vis=new IntersectionObserver(es=>{viewerInView=es.some(e=>e.isIntersecting)},{rootMargin:'250px'});vis.observe(root)}
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();if(loading){loading.style.display='grid';loading.querySelector('b').textContent='Pause graphique';loading.querySelector('span').textContent='Le navigateur a suspendu le contexte 3D.';}},{passive:false});
  renderer.domElement.addEventListener('webglcontextrestored',()=>{if(loading)loading.style.display='none'});
  const clock=new THREE.Clock();let dustT=0;
  function frame(){requestAnimationFrame(frame);if(!viewerInView||document.hidden){clock.getDelta();return}const dt=Math.min(.04,clock.getDelta());dustT+=dt;
    for(const name of ['raw','works','finished'])stageAlpha[name]+= (stageTarget[name]-stageAlpha[name])*Math.min(1,dt*7.5);
    for(const [name,group] of [['raw',raw],['works',works],['finished',finished]]){const a=stageAlpha[name];group.visible=a>.01;group.position.y=(1-a)*-.16;group.traverse(o=>{if(o.isMesh&&o.material?.transparent){o.material.opacity=(o.material.userData.baseOpacity??1)*a;o.material.depthWrite=a>.72}})}
    if(!reduced){boomPivot.rotation.z=-.035+Math.sin(dustT*.72)*.025;armPivot.rotation.z=Math.sin(dustT*.86)*.035;bucket.rotation.z=Math.sin(dustT*.94)*.025;const p=dust.geometry.attributes.position.array;for(let i=0;i<dustCount;i++){p[i*3+1]+=dt*(.12+(i%7)*.009);p[i*3]+=Math.sin(dustT+i)*dt*.035;if(p[i*3+1]>3.8)p[i*3+1]=.2}dust.geometry.attributes.position.needsUpdate=true}
    if(tourActive){tourTime+=dt;const dur=3.5,hold=.65;if(tourTime<dur){const t=ease(clamp(tourTime/dur,0,1));camera.position.lerpVectors(tourStartPos,goalPos,t);controls.target.lerpVectors(tourStartTarget,goalTarget,t)}else if(tourTime>dur+hold){tourStep++;if(tourStep>=tourSequence.length){stopTour();setStage('finished');go('global')}else startSegment()}}
    else if(cameraAnimating){camera.position.lerp(goalPos,Math.min(1,dt*3.5));controls.target.lerp(goalTarget,Math.min(1,dt*3.5));if(camera.position.distanceTo(goalPos)<.035&&controls.target.distanceTo(goalTarget)<.035)cameraAnimating=false}
    controls.update();updateHotspots();if(composer)composer.render();else renderer.render(scene,camera)
  }
  frame();
  if(loading)loading.style.display='none';root.classList.add('v6-viewer-ready');renderer.domElement.setAttribute('aria-label','Studio ORIS REALSITE 3D : faites glisser pour tourner à 360 degrés, pincer pour zoomer et utiliser les boutons pour changer de vue.');
}

const viewers=[...document.querySelectorAll('[data-viewer360]')];
function boot(el){if(el.dataset.ready)return;el.dataset.ready='1';try{createViewer(el)}catch(err){console.warn('ORIS REALSITE fallback',err);const loading=el.querySelector('.viewer-loading');if(loading){loading.querySelector('b').textContent='Mode photo activé';loading.querySelector('span').textContent='La 3D n’a pas pu démarrer sur cet appareil.';setTimeout(()=>loading.style.display='none',1800)}}}
if('IntersectionObserver'in window){const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){boot(e.target);io.unobserve(e.target)}}),{rootMargin:'600px'});viewers.forEach(v=>io.observe(v))}else viewers.forEach(boot);
