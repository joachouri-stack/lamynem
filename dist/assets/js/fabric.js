/* Lamyne M — effet signature « tissu numérique » du hero.
 *
 * Un tissu patchwork (écho aux robes à pois de l'artiste) recouvre la photo
 * et le nom. Au scroll, il se soulève comme pris dans le vent et révèle
 * l'œuvre ; en desktop, la souris le soulève localement.
 *
 * WebGL pur, sans dépendance : un seul triangle plein écran + shader.
 * Activé partout sauf si le visiteur demande moins d'animations ou le mode
 * économie de données (test dans <head>, qui pose la classe .has-fabric).
 * Les capacités annoncées par le navigateur (cœurs, mémoire) sont peu fiables,
 * surtout sous Safari : on mesure plutôt la fluidité réelle pendant les
 * premières secondes et on baisse la résolution du rendu si besoin ; si
 * l'appareil reste trop lent, ou si WebGL échoue, le tissu est retiré et le
 * hero reste statique.
 *
 * Son (facultatif, coupé par défaut) : un bruissement de tissu synthétisé en
 * direct (Web Audio, aucun fichier), dont le volume et le timbre suivent la
 * vitesse du rideau. Les navigateurs interdisent le son sans geste du
 * visiteur : il s'active par le bouton « Son » du hero, et le choix est retenu.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  if (!root.classList.contains('has-fabric')) return;

  var hero = document.querySelector('[data-hero]');
  var canvas = hero && hero.querySelector('.hero__fabric');
  if (!canvas) return fallback();

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  var gl = canvas.getContext('webgl', { premultipliedAlpha: true, antialias: false, alpha: true, powerPreference: 'low-power' });
  if (!gl) return fallback();

  var VERT = 'attribute vec2 p;varying vec2 vUv;void main(){vUv=p*.5+.5;gl_Position=vec4(p,0.,1.);}';

  var FRAG = [
    'precision highp float;',
    'uniform vec2 uRes;uniform float uTime,uLift,uMouseAmt,uGust;uniform vec2 uMouse;',
    'varying vec2 vUv;',
    'float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
    'float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);',
    ' return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p*=2.03;a*=.5;}return v;}',

    // Relief du tissu : drapé vertical + ondes de vent qui remontent.
    'float height(vec2 p,float t){',
    ' float h=sin(p.x*6.5+fbm(vec2(p.x*1.4,p.y*.7-t*.12))*4.+t*.5)*.5;',
    ' h+=sin(p.x*13.-p.y*2.+t*1.1)*.16;',
    ' h+=sin(p.y*5.5-t*1.9+p.x*2.2)*.28*(.35+uGust);',
    ' h+=(fbm(p*2.6+vec2(t*.18,-t*.32))-.5)*.9;',
    ' return h;}',

    // Ligne de l'ourlet qui se soulève (en coordonnées vUv.y).
    'float hem(float x,float asp,float t){',
    ' float e=uLift*1.38-.14;',
    ' e+=sin(x*3.1+t*1.25)*.035+sin(x*7.3-t*2.)*.016;',
    ' e+=(fbm(vec2(x*1.8,t*.35))-.5)*.14*(.45+uLift);',
    ' float d=x-uMouse.x*asp;',
    ' e+=uMouseAmt*.2*exp(-d*d*5.);',
    ' return e;}',

    // Patchwork bleu roi : pièces irrégulières en camaïeu (nuit, outremer, roi, cobalt),
    // pois et coutures dorés, pour faire ressortir les robes rouges et or de l'artiste.
    'vec3 patchwork(vec2 q){',
    ' vec2 w=q+vec2(fbm(q*1.3),fbm(q*1.3+7.))*.35;',
    ' vec2 cell=floor(w*vec2(3.2,2.5));vec2 f=fract(w*vec2(3.2,2.5));',
    ' float r=hash(cell);',
    ' vec3 c=r<.28?vec3(.10,.20,.58):r<.52?vec3(.07,.14,.42):r<.74?vec3(.05,.08,.27):r<.9?vec3(.16,.30,.72):vec3(.13,.22,.66);',
    ' if(hash(cell+3.1)>.45){',
    '  vec2 g=q*vec2(30.,30.);vec2 gi=floor(g);vec2 gf=fract(g)-.5;',
    '  if(mod(gi.y,2.)>.5)gf.x=fract(g.x+.5)-.5;',
    '  float dot_=smoothstep(.19,.15,length(gf));',
    '  c=mix(c,hash(cell+9.)>.5?vec3(.86,.68,.30):vec3(.93,.88,.80)*.8,dot_*.7);',
    ' }',
    ' float edge=min(min(f.x,1.-f.x)/3.2,min(f.y,1.-f.y)/2.5);',
    ' c*=.7+.3*smoothstep(.0,.008,edge);',
    ' float stitch=smoothstep(.0035,.0015,abs(edge-.014))*step(.45,fract((w.x-w.y)*70.));',
    ' c=mix(c,vec3(.88,.72,.38),stitch*.6);',
    ' c=mix(vec3(dot(c,vec3(.299,.587,.114))),c,.94);',
    ' return c;}',

    'void main(){',
    ' float asp=uRes.x/uRes.y;float t=uTime;',
    ' vec2 p=vec2(vUv.x*asp,vUv.y);',
    ' float e=hem(p.x,asp,t);',
    ' float above=vUv.y-e;',
    // Enroulement : près de l'ourlet, le tissu remonte vers le spectateur.
    ' float curl=smoothstep(.28,0.,above);',
    ' vec2 q=p;q.y+=curl*curl*.09;',
    ' float eps=.004;',
    ' float h=height(q,t),hx=height(q+vec2(eps,0.),t),hy=height(q+vec2(0.,eps),t);',
    ' vec3 n=normalize(vec3(-(hx-h)/eps*.032,-(hy-h)/eps*.032-curl*.6,1.));',
    ' vec3 L=normalize(vec3(-.45,.65,.62));',
    ' float diff=.5+.5*dot(n,L);',
    ' vec3 V=vec3(0.,0.,1.);float spec=pow(max(dot(reflect(-L,n),V),0.),18.);',
    // Écran vertical : pièces plus petites, pour garder un vrai patchwork (≈ 3 pièces de large).
    ' float ps=clamp(.75/asp,1.,1.6);',
    ' vec3 base=patchwork(q*ps+vec2(h*.012,h*.018));',
    ' vec3 col=base*(.18+1.02*diff*diff)*.95+spec*.16*vec3(.85,.9,1.);',
    ' col*=1.+curl*.28;',
    // Doublure de satin doré visible sur l'ourlet retroussé.
    ' float lining=smoothstep(.022,.006,above)*step(0.,above);',
    ' col=mix(col,vec3(.62,.46,.20)*(.6+.6*diff),lining*.85);',
    ' col*=1.-smoothstep(.006,0.,above)*.5;',
    ' col*=.82+.18*smoothstep(1.25,.2,length(vUv-vec2(.5,.55)));',
    ' col+=(hash(gl_FragCoord.xy+fract(t)*97.)-.5)*.045;',
    ' float a=smoothstep(-.003,.003,above);',
    // Ombre portée du tissu sur l'œuvre dévoilée.
    ' float sh=(1.-a)*.62*exp(above*16.)*step(above,0.);',
    ' gl_FragColor=vec4(col*a,a+(1.-a)*sh);',
    '}'
  ].join('\n');

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  var prog, loc = {};
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (err) {
    return fallback();
  }
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var aP = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(aP);
  gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, 0, 0);
  ['uRes', 'uTime', 'uLift', 'uMouse', 'uMouseAmt', 'uGust'].forEach(function (n) { loc[n] = gl.getUniformLocation(prog, n); });

  // --- État -------------------------------------------------------------
  var INTRO_LIFT = 0.2;
  var DONE_LIFT = 1.18;
  var start = performance.now();
  var last = start;
  var lift = 0, intro = 0, scrollP = 0;
  var mouse = { x: 0.5, y: 0.3, tx: 0.5, ty: 0.3, amt: 0, tamt: 0, speed: 0 };
  var gust = 0.3;
  var running = false, visible = true, raf = 0;
  var fine = window.matchMedia('(pointer: fine)').matches;

  // --- Son du rideau --------------------------------------------------------
  var AC = window.AudioContext || window.webkitAudioContext;
  var soundBtn = hero.querySelector('[data-sound]');
  var soundOn = false, audio = null, prevLift = 0;

  function noiseBuffer(ctx) {
    // Bruit rose (plus doux que le blanc), 2 s bouclées.
    var len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    var b0 = 0, b1 = 0, b2 = 0;
    for (var i = 0; i < len; i++) {
      var w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.0990460; b1 = 0.96300 * b1 + w * 0.2965164; b2 = 0.57000 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.11;
    }
    return buf;
  }

  function makeAudio() {
    var ctx = new AC();
    var buf = noiseBuffer(ctx);
    var src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    var band = ctx.createBiquadFilter(); band.type = 'bandpass'; band.frequency.value = 700; band.Q.value = 0.8;
    var low = ctx.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = 3800;
    // Battement rapide du tissu : une oscillation module légèrement le volume.
    var flutter = ctx.createGain(); flutter.gain.value = 0.75;
    var lfo = ctx.createOscillator(); lfo.frequency.value = 9;
    var lfoAmt = ctx.createGain(); lfoAmt.gain.value = 0.25;
    lfo.connect(lfoAmt); lfoAmt.connect(flutter.gain);
    var gain = ctx.createGain(); gain.gain.value = 0;
    src.connect(band); band.connect(low); low.connect(flutter); flutter.connect(gain); gain.connect(ctx.destination);
    src.start(); lfo.start();
    return { ctx: ctx, buf: buf, band: band, lfo: lfo, gain: gain };
  }

  // Petit « froissé » joué à l'activation, pour entendre tout de suite l'effet.
  function swoosh() {
    var ctx = audio.ctx, t0 = ctx.currentTime;
    var src = ctx.createBufferSource(); src.buffer = audio.buf;
    var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.9;
    f.frequency.setValueAtTime(500, t0); f.frequency.exponentialRampToValueAtTime(2200, t0 + 0.35); f.frequency.exponentialRampToValueAtTime(700, t0 + 0.8);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.85);
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    src.start(t0, Math.random()); src.stop(t0 + 0.9);
  }

  function soundLevel(level) {
    if (!audio || !soundOn) return;
    var t = audio.ctx.currentTime;
    audio.gain.gain.setTargetAtTime(0.32 * Math.pow(level, 0.8), t, 0.07);
    audio.band.frequency.setTargetAtTime(450 + 2000 * level, t, 0.1);
    audio.lfo.frequency.setTargetAtTime(7 + 11 * level, t, 0.1);
  }

  function setSound(on, fromClick) {
    soundOn = on;
    try { localStorage.setItem('fabric-sound', on ? 'on' : 'off'); } catch (e) { /* stockage indisponible */ }
    if (soundBtn) {
      soundBtn.setAttribute('aria-pressed', String(on));
      soundBtn.setAttribute('aria-label', soundBtn.getAttribute(on ? 'data-label-off' : 'data-label-on'));
    }
    if (on) {
      if (!audio) audio = makeAudio();
      if (audio.ctx.state !== 'running') audio.ctx.resume();
      if (fromClick) swoosh();
    } else if (audio) {
      audio.gain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.05);
      setTimeout(function () { if (!soundOn && audio) audio.ctx.suspend(); }, 400);
    }
  }

  if (soundBtn && AC) {
    soundBtn.hidden = false;
    soundBtn.addEventListener('click', function () { setSound(!soundOn, true); });
    // Choix retenu d'une visite à l'autre : le son reprend au premier geste
    // (le navigateur n'autorise rien avant).
    var pref = null;
    try { pref = localStorage.getItem('fabric-sound'); } catch (e) { /* stockage indisponible */ }
    if (pref === 'on') {
      soundBtn.setAttribute('aria-pressed', 'true');
      soundBtn.setAttribute('aria-label', soundBtn.getAttribute('data-label-off'));
      var unlock = function (e) {
        if (soundBtn.contains(e.target)) return; // le bouton gère lui-même son clic
        ['pointerdown', 'keydown', 'touchend'].forEach(function (n) { window.removeEventListener(n, unlock, true); });
        if (soundBtn.getAttribute('aria-pressed') === 'true') setSound(true, false);
      };
      soundOn = true;
      ['pointerdown', 'keydown', 'touchend'].forEach(function (n) { window.addEventListener(n, unlock, true); });
    }
  }

  // Qualité adaptative : 1 = pleine résolution, réduite si les images tardent.
  var quality = 1;
  var perf = { frames: 0, time: 0, checks: 0 };

  function resize() {
    var mobile = window.innerWidth < 720;
    // Mobile : écran plus petit, on peut monter la définition (pois et coutures nets) ;
    // la qualité adaptative la redescend si le téléphone peine.
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5) * (mobile ? 0.9 : 0.85) * quality;
    var w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    var h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  function readScroll() {
    var total = hero.offsetHeight - window.innerHeight;
    var y = -hero.getBoundingClientRect().top;
    scrollP = total > 0 ? Math.min(Math.max(y / total, 0), 1) : 0;
  }

  function ease(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

  function frame(now) {
    raf = 0;
    var rawDt = (now - last) / 1000;
    var dt = Math.min(rawDt, 0.05);
    last = now;

    // Mesure de fluidité sur des fenêtres de 40 images (hors onglet caché).
    if (perf.checks < 3 && rawDt > 0 && rawDt < 0.5) {
      perf.frames++; perf.time += rawDt;
      if (perf.frames === 40) {
        var fps = perf.frames / perf.time;
        perf.checks++; perf.frames = 0; perf.time = 0;
        if (fps < 24) {
          if (quality > 0.4) { quality = quality > 0.6 ? 0.6 : 0.4; }
          else { stop(); fallback(); return; }
        } else {
          perf.checks = 3;
        }
      }
    }
    var t = (now - start) / 1000;

    // Intro : le tissu se soulève légèrement après le chargement.
    intro = INTRO_LIFT * ease(Math.min(Math.max((t - 0.5) / 2.2, 0), 1));
    var target = intro + (DONE_LIFT + 0.05 - intro) * ease(Math.min(scrollP / 0.82, 1));
    lift += (target - lift) * Math.min(1, dt * 3.2);

    mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 4);
    mouse.speed *= Math.pow(0.02, dt);
    mouse.tamt = fine ? Math.min(0.45 + mouse.speed * 1.4, 1.1) * (mouse.inside ? 1 : 0) : 0;
    mouse.amt += (mouse.tamt - mouse.amt) * Math.min(1, dt * 2.5);
    gust += (0.3 + Math.min(mouse.speed, 1) * 0.9 + (target - lift) * 3 - gust) * Math.min(1, dt * 2);

    // Son : suit la vitesse du rideau (scroll) et, en desktop, les mouvements de souris.
    var speed = Math.abs(lift - prevLift) / Math.max(dt, 0.001);
    prevLift = lift;
    soundLevel(Math.min(speed * 0.55 + Math.min(mouse.speed, 1) * mouse.amt * 0.35, 1));

    var done = lift > DONE_LIFT && target > DONE_LIFT;
    canvas.style.visibility = done ? 'hidden' : 'visible';

    if (!done) {
      resize();
      gl.uniform2f(loc.uRes, canvas.width, canvas.height);
      gl.uniform1f(loc.uTime, t);
      gl.uniform1f(loc.uLift, lift);
      gl.uniform2f(loc.uMouse, mouse.x, mouse.y);
      gl.uniform1f(loc.uMouseAmt, mouse.amt);
      gl.uniform1f(loc.uGust, gust);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // Tissu totalement levé et immobile : on arrête la boucle jusqu'au prochain scroll.
    if (done && Math.abs(target - lift) < 0.001) { running = false; soundLevel(0); return; }
    if (running && visible) raf = requestAnimationFrame(frame);
  }

  function play() {
    if (!visible) return;
    running = true;
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }

  function stop() {
    running = false;
    soundLevel(0);
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function fallback() {
    root.classList.remove('has-fabric');
    if (typeof soundBtn !== 'undefined' && soundBtn) soundBtn.hidden = true;
    if (typeof audio !== 'undefined' && audio) { soundOn = false; audio.ctx.close(); audio = null; }
    if (canvas) canvas.remove();
  }

  // --- Événements -------------------------------------------------------
  window.addEventListener('scroll', function () { readScroll(); play(); }, { passive: true });
  window.addEventListener('resize', function () { readScroll(); play(); }, { passive: true });

  if (fine) {
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      var nx = e.clientX / r.width;
      mouse.speed += Math.abs(nx - mouse.tx) * 6;
      mouse.tx = nx;
      mouse.ty = 1 - (e.clientY - Math.max(r.top, 0)) / window.innerHeight;
      mouse.inside = true;
      play();
    });
    hero.addEventListener('pointerleave', function () { mouse.inside = false; });
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) play(); else stop();
    }).observe(hero);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else play();
  });

  canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); stop(); fallback(); });

  function onMotionPref() { if (reduce.matches) { stop(); fallback(); } }
  if (reduce.addEventListener) reduce.addEventListener('change', onMotionPref);
  else if (reduce.addListener) reduce.addListener(onMotionPref);

  readScroll();
  lift = scrollP > 0 ? INTRO_LIFT + (DONE_LIFT - INTRO_LIFT) * ease(Math.min(scrollP / 0.82, 1)) : 0;
  play();
})();
