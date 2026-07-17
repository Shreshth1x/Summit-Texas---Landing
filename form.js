/* ============================================================
   summit texas — form pages (support / contact)
   Staggered entrance + FormSubmit.co AJAX submission. No backend.
   ============================================================ */

(function () {
  "use strict";

  var ENDPOINT = "https://formsubmit.co/ajax/shreshth.saride@gmail.com";
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- Entrance: content fades up 24px, staggered. ---- */
  function reveal() {
    var items = document.querySelectorAll("[data-fade]");
    if (!items.length) return;

    if (typeof window.gsap !== "undefined" && !reduceMotion) {
      gsap.set(items, { autoAlpha: 0, y: 24 });
      gsap.to(items, {
        autoAlpha: 1,
        y: 0,
        duration: 0.7,
        ease: "power2.out",
        stagger: 0.1
      });
    } else {
      // No GSAP / reduced motion — just show everything at once.
      Array.prototype.forEach.call(items, function (el) {
        el.style.opacity = "1";
      });
    }
  }

  /* ---- Auto-grow single-line textareas (underline hugs the last line). ---- */
  function sizeTextarea(el) {
    el.style.height = "auto";
    var cs = window.getComputedStyle(el);
    var borders =
      parseFloat(cs.borderTopWidth || "0") + parseFloat(cs.borderBottomWidth || "0");
    var max = parseFloat(cs.maxHeight);
    var target = el.scrollHeight + borders;
    if (!isNaN(max) && target > max) {
      // Capped — scroll internally past ~8 lines.
      el.style.height = max + "px";
      el.style.overflowY = "auto";
    } else {
      el.style.height = target + "px";
      el.style.overflowY = "hidden";
    }
  }

  function resetTextarea(el) {
    el.style.height = "";
    el.style.overflowY = "";
  }

  function initAutoGrow() {
    var areas = document.querySelectorAll(".field__textarea");
    Array.prototype.forEach.call(areas, function (el) {
      sizeTextarea(el); // match the inputs' single-line height on load
      el.addEventListener("input", function () { sizeTextarea(el); });
    });
  }

  /* ---- Form submission via FormSubmit AJAX. ---- */
  function initForm() {
    var form = document.querySelector("[data-form]");
    if (!form) return;

    var statusEl = form.querySelector("[data-status]");
    var submitBtn = form.querySelector('button[type="submit"]');
    var honey = form.querySelector('[name="_honey"]');

    function setStatus(msg, kind) {
      if (!statusEl) return;
      statusEl.textContent = msg;
      statusEl.className = "form__status form__status--" + kind;
      statusEl.style.opacity = "1";
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      // Native validation gate (required Name / Email / message).
      if (typeof form.checkValidity === "function" && !form.checkValidity()) {
        if (typeof form.reportValidity === "function") form.reportValidity();
        return;
      }

      // Honeypot — a real user never fills this hidden field.
      if (honey && honey.value) return;

      // Build the JSON payload from the form's named controls.
      var payload = {};
      Array.prototype.forEach.call(
        form.querySelectorAll("input, textarea"),
        function (el) {
          if (el.name) payload[el.name] = el.value;
        }
      );
      payload._subject = form.getAttribute("data-subject") || "Summit Texas · Form";
      payload._template = "table";

      var originalLabel = submitBtn ? submitBtn.textContent : "";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending…";
      }
      if (statusEl) {
        statusEl.textContent = "";
        statusEl.className = "form__status";
      }

      fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json().catch(function () { return {}; });
        })
        .then(function () {
          // Any 2xx is treated as success (first-ever submit may return an
          // activation-required message; FormSubmit still 200s).
          form.reset();
          Array.prototype.forEach.call(
            form.querySelectorAll(".field__textarea"),
            resetTextarea
          );
          form.style.display = "none";
          setStatus("Thank you. We will be in touch.", "ok");
        })
        .catch(function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalLabel;
          }
          setStatus(
            "Something went wrong. Try again or email us directly.",
            "err"
          );
        });
    });
  }

  function boot() {
    reveal();
    initAutoGrow();
    initForm();
  }

  // Wait for fonts so the entrance doesn't animate mid-swap.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(boot);
  } else {
    boot();
  }
})();
