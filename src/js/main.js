/* =========================================================
   VERSO — main.js
   Sin frameworks. Progressive enhancement: el sitio funciona
   sin JS; JS solo añade comportamiento.
   ========================================================= */

(() => {
  "use strict";

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  /* ---------- Barra de aviso: actualizable y descartable ----------
     El contenido vive en el HTML (fácil de cambiar por marketing);
     aquí solo gestionamos el cierre y lo recordamos en la sesión. */
  const promoBar = document.querySelector("[data-promo-bar]");
  const promoClose = document.querySelector("[data-promo-close]");
  const PROMO_KEY = "verso-promo-dismissed";

  if (promoBar && promoClose) {
    if (sessionStorage.getItem(PROMO_KEY) === "1") {
      promoBar.classList.add("is-dismissed");
    }
    promoClose.addEventListener("click", () => {
      promoBar.classList.add("is-dismissed");
      sessionStorage.setItem(PROMO_KEY, "1");
    });
  }

  /* ---------- CTA flotante: aparece tras el hero, se oculta cerca del pie ---------- */
  const floatingCta = document.querySelector("[data-floating-cta]");
  const heroSection = document.querySelector(".hero");
  const footer = document.querySelector(".site-footer");

  if (floatingCta && heroSection && footer && "IntersectionObserver" in window) {
    let pastHero = false;
    let nearFooter = false;

    const updateVisibility = () => {
      floatingCta.classList.toggle("is-visible", pastHero && !nearFooter);
    };

    new IntersectionObserver(
      (entries) => {
        pastHero = !entries[0].isIntersecting;
        updateVisibility();
      },
      { rootMargin: "-70% 0px 0px 0px" }
    ).observe(heroSection);

    new IntersectionObserver(
      (entries) => {
        nearFooter = entries[0].isIntersecting;
        updateVisibility();
      },
      { rootMargin: "0px 0px -10% 0px" }
    ).observe(footer);
  }

  /* ---------- Cabecera: estado al hacer scroll ---------- */
  const header = document.querySelector(".site-header");
  if (header) {
    const setScrolled = () => {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    setScrolled();
    window.addEventListener("scroll", setScrolled, { passive: true });
  }

  /* ---------- Navegación móvil ---------- */
  const navToggle = document.querySelector("[data-nav-toggle]");
  const mobileNav = document.querySelector("[data-mobile-nav]");

  if (navToggle && mobileNav) {
    const closeNav = () => {
      navToggle.setAttribute("aria-expanded", "false");
      mobileNav.classList.remove("is-open");
      document.body.style.overflow = "";
    };

    const openNav = () => {
      navToggle.setAttribute("aria-expanded", "true");
      mobileNav.classList.add("is-open");
      document.body.style.overflow = "hidden";
    };

    navToggle.addEventListener("click", () => {
      const isOpen = navToggle.getAttribute("aria-expanded") === "true";
      isOpen ? closeNav() : openNav();
    });

    mobileNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", closeNav);
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeNav();
    });
  }

  /* ---------- Revelado al hacer scroll ---------- */
  const revealTargets = document.querySelectorAll("[data-reveal]");

  if (revealTargets.length && !prefersReducedMotion && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2, rootMargin: "0px 0px -60px 0px" }
    );

    revealTargets.forEach((el) => observer.observe(el));
  } else {
    revealTargets.forEach((el) => el.classList.add("is-visible"));
  }

  /* ---------- Formulario de newsletter ----------
     Maqueta de front-end: valida y muestra estado.
     La integración real con Brevo se conecta aquí, en el
     bloque marcado, en la Fase 3 (Netlify Function). */
  const newsletterForm = document.querySelector("[data-newsletter-form]");

  if (newsletterForm) {
    const note = newsletterForm.querySelector("[data-newsletter-note]");
    const emailInput = newsletterForm.querySelector("input[type='email']");

    newsletterForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const email = emailInput.value.trim();
      const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

      if (!isValid) {
        note.textContent = "Revisa el correo, no parece válido.";
        note.dataset.state = "error";
        emailInput.focus();
        return;
      }

      // TODO Fase 3: sustituir por llamada real a Netlify Function
      // que registra el contacto en Brevo (lista "Newsletter").
      note.textContent = "Hecho. El próximo poema llega a tu correo.";
      note.dataset.state = "success";
      newsletterForm.reset();
    });
  }

  /* ---------- Año en el pie ---------- */
  const yearEl = document.querySelector("[data-year]");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
})();
