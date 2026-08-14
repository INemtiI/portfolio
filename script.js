/* ============================================================
   DE_code — portfolio
   3D crystals field + UI interactions
   ============================================================ */

(function () {
  "use strict";

  /* ---------- Footer year ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Header blur on scroll ---------- */
  var header = document.getElementById("header");
  function onScroll() {
    if (window.scrollY > 24) header.classList.add("scrolled");
    else header.classList.remove("scrolled");
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Reveal on scroll ---------- */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("visible"); });
  }

  /* ---------- 3D crystals field (Three.js) ---------- */
  var canvas = document.getElementById("bg3d");
  if (!canvas || !window.THREE) return;

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  try {
    var renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0b0806, 0.05);

    var camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 14);

    /* Lights — warm amber/orange rig */
    scene.add(new THREE.AmbientLight(0x40301a, 0.9));

    var keyLight = new THREE.PointLight(0xf59e0b, 1.4, 60);
    keyLight.position.set(8, 6, 8);
    scene.add(keyLight);

    var rimLight = new THREE.PointLight(0xea580c, 1.1, 60);
    rimLight.position.set(-9, -4, 5);
    scene.add(rimLight);

    var topLight = new THREE.DirectionalLight(0xfff3dd, 0.25);
    topLight.position.set(0, 10, 4);
    scene.add(topLight);

    /* Crystals — glassy solids + glowing wireframes */
    var geometries = [
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.OctahedronGeometry(1, 0),
      new THREE.TetrahedronGeometry(1, 0),
      new THREE.DodecahedronGeometry(1, 0)
    ];

    var wireColors = [0xfbbf24, 0xf97316, 0xea580c, 0xfcd34d];
    var crystals = [];
    var COUNT = 7;

    for (var i = 0; i < COUNT; i++) {
      var geo = geometries[i % geometries.length];
      var size = 0.9 + Math.random() * 1.7;
      var wireColor = wireColors[i % wireColors.length];

      var solid = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({
          color: 0x2a1a0c,
          metalness: 0.9,
          roughness: 0.22,
          flatShading: true,
          transparent: true,
          opacity: 0.92
        })
      );
      solid.scale.setScalar(size);

      var wire = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({
          color: wireColor,
          wireframe: true,
          transparent: true,
          opacity: 0.32
        })
      );
      wire.scale.setScalar(size * 1.012);

      var crystal = new THREE.Group();
      crystal.add(solid);
      crystal.add(wire);

      // spread around, avoiding the dense center where text sits
      var side = i % 2 === 0 ? 1 : -1;
      var x = side * (3.2 + Math.random() * 6.5);
      var y = (Math.random() - 0.5) * 9;
      var z = -5 + Math.random() * 7;
      if (i === 0) { x = 0.5; y = 2.6; z = -6; } // one far crystal behind hero

      crystal.position.set(x, y, z);

      crystal.userData = {
        baseY: y,
        floatAmp: 0.4 + Math.random() * 0.5,
        floatSpeed: 0.3 + Math.random() * 0.5,
        floatOffset: Math.random() * Math.PI * 2,
        rotX: (Math.random() - 0.5) * 0.004,
        rotY: (Math.random() - 0.5) * 0.006
      };

      scene.add(crystal);
      crystals.push(crystal);
    }

    /* Starfield — two warm dust layers */
    function makeStars(count, size, color, opacity, spread, depth) {
      var positions = new Float32Array(count * 3);
      for (var s = 0; s < count; s++) {
        positions[s * 3] = (Math.random() - 0.5) * spread;
        positions[s * 3 + 1] = (Math.random() - 0.5) * spread * 0.7;
        positions[s * 3 + 2] = -depth + Math.random() * depth;
      }
      var starGeo = new THREE.BufferGeometry();
      starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      return new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({
          color: color,
          size: size,
          transparent: true,
          opacity: opacity,
          sizeAttenuation: true
        })
      );
    }

    var starsFar = makeStars(420, 0.055, 0xfbbf24, 0.55, 46, 26);
    var starsNear = makeStars(160, 0.1, 0xffedd5, 0.75, 34, 16);
    scene.add(starsFar);
    scene.add(starsNear);

    /* Mouse parallax */
    var mouseX = 0;
    var mouseY = 0;
    window.addEventListener("mousemove", function (e) {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });

    /* Resize */
    window.addEventListener("resize", function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    /* Render loop */
    var clock = new THREE.Clock();

    function renderFrame() {
      var t = clock.getElapsedTime();

      for (var c = 0; c < crystals.length; c++) {
        var cr = crystals[c];
        var u = cr.userData;
        cr.rotation.x += u.rotX;
        cr.rotation.y += u.rotY;
        cr.position.y = u.baseY + Math.sin(t * u.floatSpeed + u.floatOffset) * u.floatAmp;
      }

      starsFar.rotation.y = t * 0.012;
      starsNear.rotation.y = -t * 0.02;

      camera.position.x += (mouseX * 1.6 - camera.position.x) * 0.035;
      camera.position.y += (-mouseY * 1.0 - camera.position.y) * 0.035;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    }

    if (reducedMotion) {
      renderFrame(); // one static frame, no loop
    } else {
      (function animate() {
        requestAnimationFrame(animate);
        renderFrame();
      })();
    }
  } catch (err) {
    // WebGL unavailable — CSS background remains, site still works
    canvas.style.display = "none";
  }
})();
