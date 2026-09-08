
(() => {
  'use strict';

  const qs = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => [...r.querySelectorAll(s)];
  const viewers = qsa('[data-photo360]');
  if (!viewers.length) return;

  const VS = `
    attribute vec2 a_position;
    void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
  `;

  const FS = `
    precision mediump float;
    uniform vec2 u_resolution;
    uniform float u_yaw;
    uniform float u_pitch;
    uniform float u_fov;
    uniform float u_mix;
    uniform sampler2D u_texA;
    uniform sampler2D u_texB;
    const float PI = 3.141592653589793;

    vec2 panoUV(vec3 d) {
      float lon = atan(d.x, -d.z);
      float lat = asin(clamp(d.y, -1.0, 1.0));
      return vec2(fract(lon / (2.0 * PI) + 0.5), clamp(0.5 - lat / PI, 0.001, 0.999));
    }

    void main() {
      vec2 p = (gl_FragCoord.xy / u_resolution) * 2.0 - 1.0;
      p.x *= u_resolution.x / u_resolution.y;

      float t = tan(radians(u_fov) * 0.5);
      vec3 d = normalize(vec3(p.x * t, p.y * t, -1.0));

      float cp = cos(u_pitch), sp = sin(u_pitch);
      d = vec3(d.x, d.y * cp - d.z * sp, d.y * sp + d.z * cp);

      float cy = cos(u_yaw), sy = sin(u_yaw);
      d = vec3(d.x * cy + d.z * sy, d.y, -d.x * sy + d.z * cy);

      vec2 uv = panoUV(d);
      vec3 a = texture2D(u_texA, uv).rgb;
      vec3 b = texture2D(u_texB, uv).rgb;
      vec3 c = mix(a, b, u_mix);

      vec2 q = p * vec2(0.72, 1.0);
      float vig = smoothstep(1.42, 0.48, length(q));
      c *= mix(0.89, 1.02, vig);

      gl_FragColor = vec4(c, 1.0);
    }
  `;

  function compileShader(gl, type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s) || 'Shader compilation failed');
    }
    return s;
  }

  function createProgram(gl) {
    const p = gl.createProgram();
    gl.attachShader(p, compileShader(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(p, compileShader(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(p) || 'WebGL program link failed');
    }
    return p;
  }

  function isMobileLike() {
    return matchMedia('(max-width: 760px)').matches || matchMedia('(pointer: coarse)').matches;
  }

  function init(root) {
    if (root.dataset.photo360Ready === '1') return;
    root.dataset.photo360Ready = '1';

    const canvas = qs('canvas', root);
    const loading = qs('.photo360-loading', root);
    const fallback = qs('.photo360-fallback', root);
    const title = qs('[data-360-title]', root);
    const desc = qs('[data-360-desc]', root);
    const status = qs('[data-360-status]', root);
    const stateButtons = qsa('[data-360-state]', root);
    const nodeButtons = qsa('[data-360-node]', root);
    const liveButton = qs('[data-live-tour]', root);
    const resetButton = qs('[data-reset-view]', root);
    const fullscreenButton = qs('[data-fullscreen]', root);
    const motionButton = qs('[data-motion360]', root);

    if (!canvas) return;

    let gl = null;
    try {
      gl = canvas.getContext('webgl', {
        alpha: false,
        antialias: !isMobileLike(),
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance'
      }) || canvas.getContext('experimental-webgl');

      if (!gl) throw new Error('WebGL unavailable');
    } catch (e) {
      enableFallback('WebGL indisponible sur cet appareil.');
      return;
    }

    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048;
    const useLowRes = isMobileLike() || maxTextureSize < 4096;
    const sizeSuffix = useLowRes ? '2048' : '4096';

    const urls = {
      avant: `pano-avant-v132-${sizeSuffix}.webp`,
      encours: `pano-encours-v132-${sizeSuffix}.webp`,
      apres: `pano-apres-v132-${sizeSuffix}.webp`
    };

    const meta = {
      avant: ['Avant travaux', 'Terrain et existant avant transformation.'],
      encours: ['Chantier en cours', 'Terrassement, maçonnerie, réseaux et engins en activité.'],
      apres: ['Projet final', 'Extérieurs aménagés et lecture finale de la maison.']
    };

    const nodes = {
      global: [.05, -.03, 72],
      pelle: [1.18, -.06, 56],
      facade: [-.52, .02, 58],
      terrain: [2.40, -.12, 62],
      acces: [-2.18, -.06, 60],
      materiaux: [.76, -.10, 55]
    };

    let program, uniforms;
    try {
      program = createProgram(gl);
      gl.useProgram(program);

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]),
        gl.STATIC_DRAW
      );

      const pos = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(pos);
      gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

      uniforms = {
        resolution: gl.getUniformLocation(program, 'u_resolution'),
        yaw: gl.getUniformLocation(program, 'u_yaw'),
        pitch: gl.getUniformLocation(program, 'u_pitch'),
        fov: gl.getUniformLocation(program, 'u_fov'),
        mix: gl.getUniformLocation(program, 'u_mix'),
        texA: gl.getUniformLocation(program, 'u_texA'),
        texB: gl.getUniformLocation(program, 'u_texB')
      };
    } catch (e) {
      enableFallback('Initialisation graphique impossible.');
      return;
    }

    let textures = {};
    let loadingPromises = {};
    let state = 'encours';
    let currentTexture = null;
    let nextTexture = null;
    let mix = 0;
    let transitionToken = 0;

    let yaw = .05, pitch = -.04, fov = 72;
    let targetYaw = yaw, targetPitch = pitch, targetFov = fov;

    let pointers = new Map();
    let lastX = 0, lastY = 0;
    let pinchStart = 0, pinchStartFov = 72;

    let live = false;
    let liveStart = 0;
    let liveFlags = { works:false, after:false };

    let frameId = 0;
    let visible = true;
    let destroyed = false;
    let resizeDirty = true;

    function enableFallback(message) {
      root.classList.add('photo360-fallback-mode');
      root.dataset.photo360Ready = 'fallback';
      root.setAttribute('data-fallback-reason', message || 'Mode photo');
      if (loading) {
        loading.innerHTML = `<b>Mode photo activé</b><span>${message || 'La visite immersive reste disponible en image.'}</span>`;
      }
    }

    function createTexture(url) {
      if (loadingPromises[url]) return loadingPromises[url];

      loadingPromises[url] = new Promise((resolve, reject) => {
        const img = new Image();
        img.decoding = 'async';

        img.onload = () => {
          try {
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);

            // Critical for WebGL1 stability.
            // CLAMP_TO_EDGE works with both POT and NPOT, so no incomplete texture state.
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);

            const err = gl.getError();
            if (err !== gl.NO_ERROR) throw new Error(`Texture upload WebGL error ${err}`);

            resolve(tex);
          } catch (e) {
            reject(e);
          }
        };

        img.onerror = () => reject(new Error(`Impossible de charger ${url}`));
        img.src = url;
      });

      return loadingPromises[url];
    }

    async function ensureTexture(key) {
      if (textures[key]) return textures[key];
      const t = await createTexture(urls[key]);
      textures[key] = t;
      return t;
    }

    function setMeta(s) {
      if (title) title.textContent = meta[s][0];
      if (desc) desc.textContent = meta[s][1];
      if (status) status.textContent = s === 'avant' ? 'AVANT' : s === 'encours' ? 'EN COURS' : 'APRÈS';
      stateButtons.forEach(b => b.classList.toggle('active', b.dataset.state === s));
    }

    function resize() {
      if (!resizeDirty || !gl) return;
      resizeDirty = false;

      const rect = root.getBoundingClientRect();
      const dprCap = isMobileLike() ? 1 : 1.5;
      const dpr = Math.min(window.devicePixelRatio || 1, dprCap);

      const w = Math.max(320, Math.round(rect.width * dpr));
      const h = Math.max(420, Math.round(rect.height * dpr));

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        canvas.style.width = '100%';
        canvas.style.height = '100%';
      }

      gl.viewport(0, 0, w, h);
    }

    function bindTexture(location, texture, unit) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(location, unit);
    }

    function normalizeAngle(a) {
      while (a > Math.PI) a -= Math.PI * 2;
      while (a < -Math.PI) a += Math.PI * 2;
      return a;
    }

    function updateHotspots() {
      if (!canvas.width || !canvas.height) return;

      const aspect = canvas.width / canvas.height;
      const tan = Math.tan(fov * Math.PI / 360);

      qsa('[data-hotspot]', root).forEach(el => {
        const hy = Number(el.dataset.yaw || 0);
        const hp = Number(el.dataset.pitch || 0);

        const dy = normalizeAngle(hy - yaw);
        const dp = hp - pitch;
        const z = Math.cos(dp) * Math.cos(dy);

        if (z < .12) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          return;
        }

        const x = Math.cos(dp) * Math.sin(dy) / z;
        const yy = Math.sin(dp) / z;
        const sx = .5 + (x / (tan * aspect)) * .5;
        const sy = .5 - (yy / tan) * .5;

        const onScreen = sx > -.08 && sx < 1.08 && sy > -.08 && sy < 1.08;
        el.style.opacity = onScreen ? '1' : '0';
        el.style.pointerEvents = onScreen ? 'auto' : 'none';
        el.style.left = `${sx * 100}%`;
        el.style.top = `${sy * 100}%`;
      });
    }

    function renderFrame() {
      frameId = 0;
      if (destroyed || !visible || document.hidden || !currentTexture) return;

      resize();

      yaw += (targetYaw - yaw) * .09;
      pitch += (targetPitch - pitch) * .09;
      fov += (targetFov - fov) * .09;

      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.uniform1f(uniforms.yaw, yaw);
      gl.uniform1f(uniforms.pitch, pitch);
      gl.uniform1f(uniforms.fov, fov);
      gl.uniform1f(uniforms.mix, mix);

      bindTexture(uniforms.texA, currentTexture, 0);
      bindTexture(uniforms.texB, nextTexture || currentTexture, 1);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      updateHotspots();

      frameId = requestAnimationFrame(renderFrame);
    }

    function startRenderLoop() {
      if (!frameId && visible && !document.hidden && currentTexture && !destroyed) {
        frameId = requestAnimationFrame(renderFrame);
      }
    }

    async function switchState(nextState, duration=650) {
      if (!meta[nextState]) return;
      if (nextState === state && mix === 0) {
        setMeta(nextState);
        return;
      }

      const token = ++transitionToken;
      setMeta(nextState);

      let tex;
      try {
        tex = await ensureTexture(nextState);
      } catch (e) {
        setMeta(state);
        return;
      }

      if (token !== transitionToken || destroyed) return;

      nextTexture = tex;
      mix = 0;
      const start = performance.now();

      return new Promise(resolve => {
        const animate = now => {
          if (token !== transitionToken || destroyed) {
            resolve(false);
            return;
          }

          const t = Math.min(1, (now - start) / Math.max(120, duration));
          mix = t * t * (3 - 2 * t);

          if (t < 1) {
            requestAnimationFrame(animate);
          } else {
            currentTexture = tex;
            nextTexture = currentTexture;
            mix = 0;
            state = nextState;
            resolve(true);
          }
        };
        requestAnimationFrame(animate);
      });
    }

    function goNode(name) {
      const node = nodes[name];
      if (!node) return;

      targetYaw = node[0];
      targetPitch = node[1];
      targetFov = node[2];

      nodeButtons.forEach(b => b.classList.toggle('active', b.dataset.node === name));
      startRenderLoop();
    }

    function clampCamera() {
      targetPitch = Math.max(-.62, Math.min(.58, targetPitch));
      targetFov = Math.max(36, Math.min(92, targetFov));
    }

    function stopLive() {
      live = false;
      liveFlags = { works:false, after:false };
      liveButton?.classList.remove('active');
    }

    canvas.addEventListener('pointerdown', e => {
      stopLive();
      try { canvas.setPointerCapture?.(e.pointerId); } catch (_) {}

      pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
      lastX = e.clientX;
      lastY = e.clientY;
      pinchStart = 0;
    });

    canvas.addEventListener('pointermove', e => {
      if (!pointers.has(e.pointerId)) return;

      pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
      const pts = [...pointers.values()];

      if (pts.length === 1) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;

        targetYaw -= dx * .0042;
        targetPitch += dy * .0036;

        lastX = e.clientX;
        lastY = e.clientY;
        clampCamera();
      } else if (pts.length >= 2) {
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);

        if (!pinchStart) {
          pinchStart = d;
          pinchStartFov = targetFov;
        }

        if (d > 10) {
          targetFov = pinchStartFov * (pinchStart / d);
          clampCamera();
        }
      }

      startRenderLoop();
    });

    const releasePointer = e => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchStart = 0;
      try { canvas.releasePointerCapture?.(e.pointerId); } catch (_) {}
    };

    canvas.addEventListener('pointerup', releasePointer);
    canvas.addEventListener('pointercancel', releasePointer);

    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      stopLive();
      targetFov += e.deltaY * .035;
      clampCamera();
      startRenderLoop();
    }, {passive:false});

    stateButtons.forEach(b => {
      b.addEventListener('click', () => {
        stopLive();
        switchState(b.dataset.state);
      });
    });

    nodeButtons.forEach(b => {
      b.addEventListener('click', () => {
        stopLive();
        goNode(b.dataset.node);
      });
    });

    resetButton?.addEventListener('click', () => {
      stopLive();
      targetYaw = .05;
      targetPitch = -.04;
      targetFov = 72;
      startRenderLoop();
    });

    let motionEnabled=false,motionBaseAlpha=null,motionBaseBeta=null,motionHandler=null;async function toggleMotion360(){if(!motionButton||!('DeviceOrientationEvent' in window))return;if(motionEnabled){motionEnabled=false;motionButton.classList.remove('active');if(motionHandler)window.removeEventListener('deviceorientation',motionHandler);motionHandler=null;return;}try{if(typeof DeviceOrientationEvent.requestPermission==='function'){const permission=await DeviceOrientationEvent.requestPermission();if(permission!=='granted')return;}stopLive();motionBaseAlpha=null;motionBaseBeta=null;motionHandler=e=>{if(e.alpha==null||e.beta==null)return;if(motionBaseAlpha==null){motionBaseAlpha=e.alpha;motionBaseBeta=e.beta;}let da=e.alpha-motionBaseAlpha;if(da>180)da-=360;if(da<-180)da+=360;const db=e.beta-motionBaseBeta;targetYaw=.05-da*Math.PI/180;targetPitch=Math.max(-.58,Math.min(.58,-.04+db*Math.PI/360));startRenderLoop();};window.addEventListener('deviceorientation',motionHandler,{passive:true});motionEnabled=true;motionButton.classList.add('active');}catch(_){}}if(motionButton){if(!('DeviceOrientationEvent' in window))motionButton.hidden=true;else motionButton.addEventListener('click',toggleMotion360);}
    fullscreenButton?.addEventListener('click', async () => {
      try {
        if (!document.fullscreenElement && root.requestFullscreen) {
          await root.requestFullscreen();
        } else if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        }
      } catch (_) {}
    });

    qsa('[data-hotspot]', root).forEach(el => {
      el.addEventListener('click', () => {
        const panel = qs('.photo360-info', root);
        if (!panel) return;
        qs('b', panel).textContent = el.dataset.title || 'Zone chantier';
        qs('span', panel).textContent = el.dataset.copy || '';
        panel.classList.add('show');
        clearTimeout(panel._hideTimer);
        panel._hideTimer = setTimeout(() => panel.classList.remove('show'), 4500);
      });
    });

    liveButton?.addEventListener('click', async () => {
      if (live) {
        stopLive();
        return;
      }

      live = true;
      liveFlags = { works:false, after:false };
      liveButton.classList.add('active');

      await switchState('avant', 350);
      if (!live) return;
      liveStart = performance.now();

      const tour = now => {
        if (!live || destroyed) return;

        const sec = (now - liveStart) / 1000;

        targetYaw = .08 + sec * .11;
        targetPitch = -.04 + Math.sin(sec * .5) * .025;
        targetFov = 66 + Math.sin(sec * .3) * 3;

        if (sec >= 4 && !liveFlags.works) {
          liveFlags.works = true;
          switchState('encours', 600);
        }

        if (sec >= 12 && !liveFlags.after) {
          liveFlags.after = true;
          switchState('apres', 850);
        }

        if (sec >= 20) {
          stopLive();
          return;
        }

        startRenderLoop();
        requestAnimationFrame(tour);
      };

      requestAnimationFrame(tour);
    });

    canvas.addEventListener('webglcontextlost', e => {
      e.preventDefault();
      destroyed = true;
      stopLive();
      if (frameId) cancelAnimationFrame(frameId);
      enableFallback('Le moteur graphique a été interrompu. Mode photo activé.');
    }, false);

    // Size changes only mark dirty; we don't measure layout every frame anymore.
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(() => {
        resizeDirty = true;
        startRenderLoop();
      });
      ro.observe(root);
    } else {
      addEventListener('resize', () => {
        resizeDirty = true;
        startRenderLoop();
      }, {passive:true});
    }

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          visible = entry.isIntersecting;
          if (visible) startRenderLoop();
          else if (frameId) {
            cancelAnimationFrame(frameId);
            frameId = 0;
          }
        });
      }, {threshold:.01});
      io.observe(root);
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopLive();
        if (frameId) {
          cancelAnimationFrame(frameId);
          frameId = 0;
        }
      } else {
        startRenderLoop();
      }
    });

    // Load only the active panorama first; load the other states later.
    (async () => {
      try {
        currentTexture = await ensureTexture('encours');
        nextTexture = currentTexture;
        state = 'encours';
        setMeta('encours');

        loading?.remove();
        fallback?.classList.add('loaded');

        resizeDirty = true;
        resize();
        goNode('global');
        startRenderLoop();

        // Sequential idle preload = lower memory spike on Safari/iPhone.
        const idle = window.requestIdleCallback || (fn => setTimeout(fn, 350));
        idle(async () => {
          try { await ensureTexture('avant'); } catch (_) {}
          try { await ensureTexture('apres'); } catch (_) {}
        });
      } catch (e) {
        enableFallback('Le panorama n’a pas pu être chargé.');
      }
    })();
  }

  // Initialize safely even if IntersectionObserver behaves oddly.
  viewers.forEach(root => {
    let initialized = false;
    const boot = () => {
      if (initialized) return;
      initialized = true;
      init(root);
    };

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) {
          io.disconnect();
          boot();
        }
      }, {rootMargin:'500px'});
      io.observe(root);

      // Safety boot after 2.5s, prevents a permanent loader.
      setTimeout(boot, 2500);
    } else {
      boot();
    }
  });
})();
