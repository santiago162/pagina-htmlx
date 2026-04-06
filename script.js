/* global gsap, ScrollTrigger, THREE */

/**
 * Portfolio main script
 * Modules:
 *  - Shader background (Three.js / WebGL)
 *  - Page loader
 *  - Custom cursor
 *  - Magnetic buttons
 *  - Home GSAP animations
 *  - Hero tilt effect
 *  - Project scroll sync
 *  - Image preloader
 */
(function () {
  "use strict";

  gsap.registerPlugin(ScrollTrigger);

  /* ============================================================
     SHADER SOURCES
     Stored as template literals for readability and easy editing
     ============================================================ */

  const VERT_SHADER = /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `;

  const FRAG_SHADER = /* glsl */ `
    uniform float u_time;
    uniform vec2  u_resolution;
    uniform vec2  u_mouse;
    varying vec2  vUv;

    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i   = floor(v + dot(v, C.yy));
      vec2 x0  = v - i + dot(i, C.xx);
      vec2 i1  = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy  -= i1;
      i = mod289(i);
      vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
      m = m * m;
      m = m * m;
      vec3 x  = 2.0 * fract(p * C.www) - 1.0;
      vec3 h  = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
      vec3 g;
      g.x  = a0.x  * x0.x   + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    void main() {
      vec2 st    = vUv;
      vec2 mouse = u_mouse;

      float noise1     = snoise(st * 3.0 + u_time * 0.10 + mouse * 0.3);
      float noise2     = snoise(st * 2.0 - u_time * 0.15 + mouse * 0.2);
      float noise3     = snoise(st * 4.0 + u_time * 0.08);
      float finalNoise = (noise1 + noise2 * 0.5 + noise3 * 0.3) / 1.8;

      vec3 color1 = vec3(0.02, 0.02, 0.02);
      vec3 color2 = vec3(0.08, 0.10, 0.20);
      vec3 color3 = vec3(0.12, 0.15, 0.28);
      vec3 color4 = vec3(0.15, 0.08, 0.25);

      vec3 color = mix(color1, color2, smoothstep(-0.5, 0.5, finalNoise + st.y * 0.3));
      color = mix(color, color3, smoothstep(0.2, 0.8, noise2 + st.x * 0.2));
      color = mix(color, color4, smoothstep(0.4, 1.0, noise3) * 0.2);

      float vignette = 1.0 - length(st - 0.5) * 0.8;
      color *= vignette;

      float grain = fract(sin(dot(st * u_time * 0.001, vec2(12.9898, 78.233))) * 43758.5453) * 0.02;
      color += grain;

      gl_FragColor = vec4(color, 0.13);
    }
  `;

  /* ============================================================
     IMAGE LIST (used by preloader)
     ============================================================ */
  const PROJECT_IMAGES = [
    "images/orion-1.webp",
    "images/ennea.webp",
    "images/kiaev9.webp",
    "images/casino.webp",
    "images/nftfest.webp",
  ];

  /* ============================================================
     QUOTES (cycled by the skills citation)
     ============================================================ */
  const QUOTES = [
    "Building bridges between frontend magic and backend logic.",
    "Perfection is achieved not when there is nothing left to add, but when there is nothing left to take away.",
    "What makes man is his great adaptability.",
    "From pixel to server, every layer matters.",
    "Creativity without strategy is called art. Creativity with strategy is called engineering.",
    "It's the developer's role to shape how users experience the digital world.",
    "The stack is a symphony. Every instrument must play in harmony.",
    "The best place to hide a dead body is page 2 of Google search results.",
  ];

  /* ============================================================
     MODULE: Shader background
     Returns a dispose function for cleanup.
     ============================================================ */
  function initShaderBackground(canvas) {
    if (!canvas) return noop;
    if (prefersReducedMotion()) return noop;

    // Pause rendering when canvas is out of viewport
    let isVisible = true;
    const observer = new IntersectionObserver(
      (entries) => { isVisible = entries[0].isIntersecting; },
      { threshold: 0 }
    );
    observer.observe(canvas);

    const scene    = new THREE.Scene();
    const camera   = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const dpr      = Math.min(window.devicePixelRatio, 1.5);
    const isMobile = window.innerWidth < 768;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
      stencil: false,
      depth: false,
    });
    renderer.setPixelRatio(dpr);
    resizeRenderer();
    canvas.style.width  = "100%";
    canvas.style.height = "100%";

    const uniforms = {
      u_time:       { value: 0 },
      u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      u_mouse:      { value: new THREE.Vector2(0.5, 0.5) },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader:   VERT_SHADER,
      fragmentShader: FRAG_SHADER,
      transparent: true,
      depthWrite:  false,
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);

    const mouseTarget = { x: 0.5, y: 0.5 };

    function onMouseMove(e) {
      mouseTarget.x = e.clientX / window.innerWidth;
      mouseTarget.y = 1 - e.clientY / window.innerHeight;
    }

    function onResize() {
      uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);
      resizeRenderer();
    }

    function resizeRenderer() {
      const scale = window.innerWidth < 768 ? 0.5 : 0.75;
      renderer.setSize(window.innerWidth * scale, window.innerHeight * scale, false);
    }

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("resize",    onResize,    { passive: true });

    let rafId = 0;
    function loop() {
      rafId = requestAnimationFrame(loop);
      if (!isVisible) return;
      uniforms.u_time.value += 0.01;
      uniforms.u_mouse.value.lerp(
        new THREE.Vector2(mouseTarget.x, mouseTarget.y),
        0.02
      );
      renderer.render(scene, camera);
    }
    loop();

    return function dispose() {
      cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize",    onResize);
      observer.disconnect();
      mesh.geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }

  /* ============================================================
     MODULE: Page loader
     Animates the loading screen then calls onComplete.
     ============================================================ */
  function runLoader(onComplete) {
    const root = document.getElementById("page-loader");

    if (!root) {
      onComplete();
      return;
    }

    // Skip on reduced motion or repeat visits
    if (prefersReducedMotion() || sessionStorage.getItem("hasVisited")) {
      hideLoader(root);
      onComplete();
      return;
    }

    document.body.classList.add("is-loading");

    const pctEl   = root.querySelector(".loader-pct-num");
    const glowEl  = root.querySelector(".loader-glow");
    const columns = root.querySelectorAll(".loader-columns span");
    const counter = { value: 0 };

    const tl = gsap.timeline({
      onComplete() {
        sessionStorage.setItem("hasVisited", "true");
        hideLoader(root);
        onComplete();
      },
    });

    // Count up to 100%
    tl.to(counter, {
      value: 100,
      duration: 2,
      ease: "power2.inOut",
      onUpdate() {
        if (pctEl) pctEl.textContent = String(Math.floor(counter.value));
      },
    });

    // Pulse the glow
    tl.to(glowEl, { scale: 1.2, duration: 1, ease: "power2.inOut", yoyo: true, repeat: 2 }, 0);

    // Collapse columns
    tl.to(
      columns,
      { scaleY: 0, duration: 0.8, ease: "power4.inOut", stagger: 0.1, transformOrigin: "top", delay: 2.2 },
      0
    );

    // Fade out loader
    tl.to(root, { opacity: 0, duration: 0.3 }, "-=0.2");
  }

  function hideLoader(el) {
    el.classList.add("hidden");
    document.body.classList.remove("is-loading");
  }

  /* ============================================================
     MODULE: Custom cursor
     Returns a dispose function.
     ============================================================ */
  function initCustomCursor() {
    if (window.innerWidth < 768)  return noop;
    if (prefersReducedMotion())    return noop;

    document.body.classList.add("custom-cursor-on");

    const cursorMain  = document.querySelector(".cursor-main");
    const cursorDot   = document.querySelector(".cursor-dot");
    const cursorLabel = cursorMain && cursorMain.querySelector(".cursor-label");
    const trails      = Array.from(document.querySelectorAll(".cursor-trail"));

    if (!cursorMain || !cursorDot) return noop;

    function setLabel(text) {
      if (cursorLabel) cursorLabel.textContent = text;
    }

    function onMouseMove(e) {
      gsap.to(cursorMain, { x: e.clientX, y: e.clientY, duration: 0.5, ease: "power3.out" });
      gsap.to(cursorDot,  { x: e.clientX, y: e.clientY, duration: 0.1, ease: "power2.out" });
      trails.forEach((el, i) => {
        gsap.to(el, { x: e.clientX, y: e.clientY, duration: 0.4 + i * 0.1, ease: "power2.out" });
      });
    }

    function onDocEnter() { document.body.classList.add("custom-cursor-on"); }
    function onDocLeave() { document.body.classList.remove("custom-cursor-on"); }

    function bindInteractiveElements() {
      // Project cards — show "VIEW"
      document.querySelectorAll(".project-item").forEach((el) => {
        el.addEventListener("mouseenter", () => {
          setLabel("VIEW");
          cursorMain.classList.add("has-label");
          gsap.to(cursorMain, { scale: 2.5, duration: 0.3, ease: "power2.out" });
        });
        el.addEventListener("mouseleave", () => {
          setLabel("");
          cursorMain.classList.remove("has-label");
          gsap.to(cursorMain, { scale: 1, duration: 0.3, ease: "power2.out" });
        });
      });

      // Magnetic buttons
      document.querySelectorAll(".magnetic-btn, .get-in-touch a").forEach((el) => {
        el.addEventListener("mouseenter", () => {
          cursorMain.classList.add("has-label");
          gsap.to(cursorMain, { scale: 1.5, duration: 0.3, ease: "power2.out", mixBlendMode: "difference" });
        });
        el.addEventListener("mouseleave", () => {
          cursorMain.classList.remove("has-label");
          gsap.to(cursorMain, { scale: 1,   duration: 0.3, ease: "power2.out", mixBlendMode: "normal" });
        });
      });

      // Generic interactive elements
      document.querySelectorAll("a, button, .link-underline").forEach((el) => {
        if (el.classList.contains("magnetic-inner")) return;
        el.addEventListener("mouseenter", () => {
          gsap.to(cursorMain, { scale: 1.3, duration: 0.2, ease: "power2.out" });
          gsap.to(cursorDot,  { scale: 0,   duration: 0.2, ease: "power2.out" });
        });
        el.addEventListener("mouseleave", () => {
          gsap.to(cursorMain, { scale: 1, duration: 0.2, ease: "power2.out" });
          gsap.to(cursorDot,  { scale: 1, duration: 0.2, ease: "power2.out" });
        });
      });
    }

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    document.addEventListener("mouseenter", onDocEnter);
    document.addEventListener("mouseleave", onDocLeave);

    // Bind immediately and re-bind when DOM changes (dynamic content)
    const rebindTimeout = setTimeout(bindInteractiveElements, 500);
    const mutationObserver = new MutationObserver(() => setTimeout(bindInteractiveElements, 100));
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    bindInteractiveElements();

    return function dispose() {
      window.removeEventListener("mousemove",  onMouseMove);
      document.removeEventListener("mouseenter", onDocEnter);
      document.removeEventListener("mouseleave", onDocLeave);
      clearTimeout(rebindTimeout);
      mutationObserver.disconnect();
      document.body.classList.remove("custom-cursor-on");
    };
  }

  /* ============================================================
     MODULE: Magnetic buttons
     Returns a dispose function.
     ============================================================ */
  function initMagnetic() {
    if (window.innerWidth < 768) return noop;
    if (prefersReducedMotion())   return noop;

    const cleanups = [];

    document.querySelectorAll("[data-magnetic]").forEach((wrap) => {
      const strength = parseFloat(wrap.dataset.magnetic || "0.15") || 0.15;
      const inner    = wrap.querySelector(".magnetic-inner");
      if (!inner) return;

      function onMove(e) {
        const rect = wrap.getBoundingClientRect();
        const cx   = rect.left + rect.width  / 2;
        const cy   = rect.top  + rect.height / 2;
        const dx   = e.clientX - cx;
        const dy   = e.clientY - cy;
        if (Math.sqrt(dx * dx + dy * dy) > Math.min(rect.width, rect.height)) return;
        gsap.to(inner, { x: dx * strength, y: dy * strength, duration: 0.4, ease: "power2.out" });
      }

      function onLeave() {
        gsap.to(inner, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1, 0.3)" });
      }

      wrap.addEventListener("mousemove", onMove);
      wrap.addEventListener("mouseleave", onLeave);
      cleanups.push(() => {
        wrap.removeEventListener("mousemove", onMove);
        wrap.removeEventListener("mouseleave", onLeave);
      });
    });

    return function dispose() {
      cleanups.forEach((fn) => fn());
    };
  }

  /* ============================================================
     MODULE: Home GSAP animations
     Returns a dispose function (ctx.revert).
     ============================================================ */
  function initHomeAnimations() {
    if (prefersReducedMotion()) {
      // Ensure content is visible without animation
      document.querySelectorAll(".heading-char").forEach((el) => {
        el.style.opacity   = "1";
        el.style.transform = "none";
      });
      const citation = document.querySelector(".citation");
      if (citation) citation.style.opacity = "1";
      return noop;
    }

    const ctx = gsap.context(() => {
      // Parallax fade on hero scroll-out
      const heroSection = document.querySelector(".hero-section");
      if (heroSection) {
        gsap.to(heroSection, {
          opacity: 0.3,
          scale:   0.95,
          ease:    "none",
          scrollTrigger: {
            trigger: heroSection,
            start:   "top top",
            end:     "bottom top",
            scrub:   1,
          },
        });
      }

      // Rotating scroll ring
      const scrollRing       = document.querySelector(".scroll-ring");
      const scrollRingCenter = document.querySelector(".scroll-ring-center");
      if (scrollRing)       gsap.to(scrollRing,       { rotation: 360,  duration: 10, repeat: -1, ease: "none" });
      if (scrollRingCenter) gsap.to(scrollRingCenter, { rotation: -360, duration: 10, repeat: -1, ease: "none" });

      // Hero heading character stagger
      gsap.fromTo(
        ".heading-char",
        { y: 100, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.02, duration: 2, ease: "power4.out" }
      );

      // Hero bottom elements fade in
      gsap.fromTo(
        ".down",
        { opacity: 0 },
        { opacity: 1, stagger: 0.002, duration: 2, ease: "power4.out", delay: 1 }
      );

      gsap.fromTo(
        ".based-in",
        { y: -10, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.004, duration: 2, ease: "power4.out", delay: 1.5 }
      );

      // Skill citation: update quote as each skill scrolls into view
      const citationEl = document.querySelector(".citation");

      function setCitation(skillIndex) {
        if (!citationEl) return;
        const index = skillIndex <= 0 ? 0 : skillIndex - 1;
        citationEl.textContent = `\u201f ${QUOTES[index] || QUOTES[0]} \u201d`;
      }

      document.querySelectorAll(".about").forEach((el) => {
        const id = parseInt(el.getAttribute("id"), 10) || 0;
        gsap.to(el, {
          backgroundPositionX: 0,
          ease: "none",
          scrollTrigger: {
            trigger: el,
            start:   "center center",
            end:     "center center",
            scrub:   1,
            onEnter() {
              setCitation(id);
              gsap.fromTo(".citation", { y: 20, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.02, duration: 2, ease: "power4.out" });
            },
            onLeaveBack() {
              setCitation(id - 1);
              gsap.fromTo(".citation", { y: 20, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.02, duration: 2, ease: "power4.out" });
            },
          },
        });
      });

      // Hide citation when portfolio section enters
      ScrollTrigger.create({
        trigger: "#portfolio-section",
        start:   "top center",
        end:     "top center",
        scrub:   1,
        onEnter() {
          gsap.to(".citation", { opacity: 0, y: 20, stagger: 0.02, duration: 0.1, overwrite: true });
        },
      });

      // Projects section — entrance animations
      gsap.fromTo(
        ".split-title",
        { x: -100, opacity: 0 },
        { x: 0, opacity: 1, duration: 1, ease: "power3.out", scrollTrigger: { trigger: ".projects-split", start: "top 80%" } }
      );

      gsap.fromTo(
        ".split-project-item",
        { x: -50, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.8, stagger: 0.1, ease: "power2.out", scrollTrigger: { trigger: ".projects-split", start: "top 70%" } }
      );

      gsap.fromTo(
        ".split-preview",
        { scale: 0.9, opacity: 0 },
        { scale: 1, opacity: 1, duration: 1.2, ease: "power3.out", scrollTrigger: { trigger: ".projects-split", start: "top 80%" } }
      );

      // Footer entrance animations
      gsap.fromTo(
        ".get-in-touch",
        { opacity: 0, x: -150 },
        { opacity: 1, x: 0, ease: "power4.out", duration: 2.5, scrollTrigger: { trigger: ".get-in-touch", start: "top bottom", end: "top bottom" } }
      );

      gsap.fromTo(
        ".social-link",
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, stagger: 0.02, ease: "power4.out", duration: 2.5, delay: 1, scrollTrigger: { trigger: ".social-link", start: "top bottom", end: "top bottom" } }
      );
    });

    return function dispose() {
      ctx.revert();
    };
  }

  /* ============================================================
     MODULE: Hero 3D tilt effect
     Returns a dispose function.
     ============================================================ */
  function initHeroTilt() {
    if (window.innerWidth < 768) return noop;
    if (prefersReducedMotion())   return noop;

    const el = document.querySelector(".tilt-wrap");
    if (!el) return noop;

    const DEPTH = 15;

    function onMouseMove(e) {
      const rx = 2 * (e.clientX / window.innerWidth  - 0.5);
      const ry = 2 * (e.clientY / window.innerHeight - 0.5);
      gsap.to(el, {
        rotateY:  rx * DEPTH * 0.5,
        rotateX: -ry * DEPTH * 0.5,
        x:        rx * DEPTH,
        y:        ry * DEPTH,
        duration: 0.5,
        ease:     "power2.out",
      });
    }

    function resetTilt() {
      gsap.to(el, { rotateY: 0, rotateX: 0, x: 0, y: 0, duration: 0.8, ease: "elastic.out(1, 0.5)" });
    }

    window.addEventListener("mousemove",  onMouseMove, { passive: true });
    document.addEventListener("mouseleave", resetTilt);

    return function dispose() {
      window.removeEventListener("mousemove",   onMouseMove);
      document.removeEventListener("mouseleave", resetTilt);
    };
  }

  /* ============================================================
     MODULE: Project scroll sync
     Syncs sidebar list highlighting with visible preview card.
     Returns a dispose function.
     ============================================================ */
  function initProjectScrollSync() {
    const previewItems = Array.from(document.querySelectorAll(".project-preview-item"));
    const listLinks    = Array.from(document.querySelectorAll(".split-project-item"));
    const numberEl     = document.querySelector(".project-number");
    const progressBar  = document.querySelector(".projects-progress-bar");
    const total        = previewItems.length;

    if (!previewItems.length) return noop;

    let activeIndex = 0;

    function setActive(index) {
      activeIndex = index;

      // Update sidebar list
      listLinks.forEach((link, i) => {
        link.classList.toggle("is-active", i === index);
        const dot = link.querySelector(".pulse-dot");
        if (dot) dot.toggleAttribute("hidden", i !== index);
      });

      // Dim non-active preview cards
      previewItems.forEach((card, i) => {
        card.classList.toggle("dimmed", i !== index);
      });

      // Update project counter
      if (numberEl) {
        numberEl.textContent = String(index + 1).padStart(2, "0");
        gsap.fromTo(numberEl, { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(1.7)" });
      }

      // Update progress bar
      if (progressBar) {
        progressBar.style.width = `${((index + 1) / total) * 100}%`;
      }
    }

    // Hover / focus on list links
    listLinks.forEach((link, i) => {
      link.addEventListener("mouseenter", () => setActive(i));
      link.addEventListener("focus",      () => setActive(i));
      link.addEventListener("click",      () => setActive(i));
    });

    // Hover on preview cards
    previewItems.forEach((card, i) => {
      card.addEventListener("mouseenter", () => setActive(i));
    });

    // ScrollTrigger sync on desktop
    const scrollTriggers = [];
    if (window.innerWidth >= 1024) {
      previewItems.forEach((card, i) => {
        scrollTriggers.push(
          ScrollTrigger.create({
            trigger:    card,
            start:      "top center",
            end:        "bottom center",
            onEnter:     () => setActive(i),
            onEnterBack: () => setActive(i),
          })
        );
      });
    }

    setActive(0);

    return function dispose() {
      scrollTriggers.forEach((t) => t.kill());
    };
  }

  /* ============================================================
     UTILITY: Preload an array of image URLs
     Returns a Promise that resolves when all images are loaded.
     ============================================================ */
  function preloadImages(urls) {
    return Promise.all(
      urls.map(
        (src) =>
          new Promise((resolve) => {
            const img    = new Image();
            img.onload   = resolve;
            img.onerror  = resolve; // resolve even on error to avoid blocking
            img.src      = src;
          })
      )
    );
  }

  /* ============================================================
     UTILITY HELPERS
     ============================================================ */
  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function noop() {}

  /* ============================================================
     BOOT
     ============================================================ */

  // Set initial citation text
  const citationEl = document.getElementById("skill-citation");
  if (citationEl) {
    citationEl.textContent = "\u201f Building bridges between frontend magic and backend logic. \u201d";
  }

  // Init shader background immediately (doesn't need loader to finish)
  const canvas         = document.getElementById("shader-canvas");
  const disposeShader  = initShaderBackground(canvas);

  // Preload project images, then hide loading overlay
  const loadingOverlay = document.getElementById("projects-loading");
  preloadImages(PROJECT_IMAGES).then(() => {
    if (loadingOverlay) loadingOverlay.classList.add("hidden");
  });

  // Run loader animation, then boot all interactive modules
  runLoader(() => {
    const disposeAnimations = initHomeAnimations();
    const disposeTilt       = initHeroTilt();
    const disposeProjects   = initProjectScrollSync();
    const disposeCursor     = initCustomCursor();
    const disposeMagnetic   = initMagnetic();

    // Refresh ScrollTrigger after layout is stable
    requestAnimationFrame(() => requestAnimationFrame(() => ScrollTrigger.refresh()));

    // Cleanup everything before navigation
    window.addEventListener(
      "beforeunload",
      () => {
        disposeShader();
        disposeAnimations();
        disposeTilt();
        disposeProjects();
        disposeCursor();
        disposeMagnetic();
        ScrollTrigger.getAll().forEach((t) => t.kill());
      },
      { once: true }
    );
  });
})();