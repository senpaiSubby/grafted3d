import "./style.css";
import {
  ALLOWED_FILE_EXTENSIONS,
  CF_BEACON_TOKEN,
  CONTACT_EMAIL,
  INQUIRY_ENDPOINT,
  MAX_FILE_BYTES,
} from "./config.js";

const MAKERWORLD = "https://makerworld.com/en/@Grafted3D";
const DISCORD = "https://discord.gg/vGRDAPmKx";

/** Every way a visitor can reach the studio, used by the form's notices. */
function contactLinks() {
  const links = [];
  if (CONTACT_EMAIL) links.push({ href: `mailto:${CONTACT_EMAIL}`, text: "email" });
  links.push({ href: MAKERWORLD, text: "MakerWorld" }, { href: DISCORD, text: "Discord" });
  return links;
}

/* ==========================================================================
   Navigation
   ========================================================================== */
function initNav() {
  const burger = document.getElementById("burger");
  const menu = document.getElementById("mobile-menu");
  if (!burger || !menu) return;

  const links = Array.from(menu.querySelectorAll("a"));
  let open = false;

  const setMenu = (next) => {
    open = next;
    menu.classList.toggle("is-open", open);
    menu.setAttribute("aria-hidden", String(!open));
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };

  burger.addEventListener("click", () => setMenu(!open));
  links.forEach((link) => link.addEventListener("click", () => setMenu(false)));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && open) {
      setMenu(false);
      burger.focus();
    }
  });

  window.addEventListener("resize", () => {
    if (open && window.innerWidth > 700) setMenu(false);
  });
}

/* ==========================================================================
   Inquiry form
   ========================================================================== */
function initForm() {
  const form = document.getElementById("inquiry-form");
  if (!form) return;

  const statusEl = document.getElementById("form-status");
  const submitBtn = form.querySelector('button[type="submit"]');
  const submitLabel = form.querySelector("[data-submit-label]");
  const submitLabelText = submitLabel ? submitLabel.textContent : "";
  const fileInput = form.querySelector("#file");
  const fileWrap = form.querySelector("[data-file-drop]");
  const fileText = form.querySelector("[data-file-text]");

  const fields = {
    name: {
      input: form.querySelector("#name"),
      error: form.querySelector('[data-error-for="name"]'),
      validate(value) {
        const clean = value.trim();
        if (!clean) return "Please add your name.";
        if (clean.length < 2) return "That name looks incomplete.";
        return "";
      },
    },
    email: {
      input: form.querySelector("#email"),
      error: form.querySelector('[data-error-for="email"]'),
      validate(value) {
        const clean = value.trim();
        if (!clean) return "Please add your email.";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean)) return "Please enter a valid email.";
        return "";
      },
    },
    projectType: {
      input: form.querySelector("#projectType"),
      error: form.querySelector('[data-error-for="projectType"]'),
      validate(value) {
        return value ? "" : "Please choose one.";
      },
    },
    description: {
      input: form.querySelector("#description"),
      error: form.querySelector('[data-error-for="description"]'),
      validate(value) {
        const clean = value.trim();
        if (!clean) return "Please add a few details.";
        if (clean.length < 20) return "Please add a little more detail.";
        return "";
      },
    },
  };

  function setFieldError(field, message) {
    if (!field.input || !field.error) return;
    field.error.textContent = message;
    if (message) {
      field.input.setAttribute("aria-invalid", "true");
    } else {
      field.input.removeAttribute("aria-invalid");
    }
  }

  function validateFile() {
    const error = form.querySelector('[data-error-for="file"]');
    const file = fileInput.files?.[0];

    if (!file) {
      error.textContent = "";
      fileWrap.classList.remove("has-file");
      if (fileText) fileText.textContent = "Choose a file";
      return "";
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_FILE_EXTENSIONS.includes(ext)) {
      error.textContent = "That file type isn't supported. Try an image, PDF, STL, OBJ, 3MF, STEP or ZIP.";
      fileInput.value = "";
      fileWrap.classList.remove("has-file");
      if (fileText) fileText.textContent = "Choose a file";
      return "invalid-type";
    }

    if (file.size > MAX_FILE_BYTES) {
      error.textContent = "That file is over 10 MB. Please choose a smaller one.";
      fileInput.value = "";
      fileWrap.classList.remove("has-file");
      if (fileText) fileText.textContent = "Choose a file";
      return "too-large";
    }

    error.textContent = "";
    fileWrap.classList.add("has-file");
    if (fileText) fileText.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
    return "";
  }

  function validateAll() {
    const invalid = [];
    Object.values(fields).forEach((field) => {
      const message = field.validate(field.input.value);
      setFieldError(field, message);
      if (message) invalid.push({ input: field.input });
    });
    if (validateFile()) invalid.push({ input: fileInput });
    return invalid;
  }

  Object.values(fields).forEach((field) => {
    const handler = () => {
      if (field.input.getAttribute("aria-invalid") !== "true") return;
      setFieldError(field, field.validate(field.input.value));
    };
    field.input.addEventListener("input", handler);
    field.input.addEventListener("change", handler);
  });

  fileInput.addEventListener("change", validateFile);

  ["dragenter", "dragover"].forEach((type) => {
    fileWrap.addEventListener(type, (event) => {
      event.preventDefault();
      fileWrap.classList.add("is-drag");
    });
  });

  ["dragleave", "dragend", "drop"].forEach((type) => {
    fileWrap.addEventListener(type, () => fileWrap.classList.remove("is-drag"));
  });

  fileWrap.addEventListener("drop", (event) => {
    event.preventDefault();
    const dropped = event.dataTransfer?.files;
    if (!dropped?.length) return;
    try {
      const transfer = new DataTransfer();
      transfer.items.add(dropped[0]);
      fileInput.files = transfer.files;
      validateFile();
    } catch {
      if (fileText) fileText.textContent = "Choose a file";
    }
  });

  function setStatus(kind, message, links = []) {
    statusEl.className = `form__status is-${kind}`;
    statusEl.replaceChildren();
    if (message) statusEl.append(document.createTextNode(message + " "));
    links.forEach((link, index) => {
      if (index > 0) {
        statusEl.append(document.createTextNode(index === links.length - 1 ? "or " : ", "));
      }
      const anchor = document.createElement("a");
      anchor.href = link.href;
      anchor.textContent = link.text;
      if (!link.href.startsWith("mailto:")) {
        anchor.target = "_blank";
        anchor.rel = "noopener";
      }
      statusEl.append(anchor);
    });
    if (links.length) statusEl.append(document.createTextNode("."));
  }

  function clearStatus() {
    statusEl.className = "form__status";
    statusEl.replaceChildren();
  }

  function resetFileUi() {
    fileWrap.classList.remove("has-file", "is-drag");
    if (fileText) fileText.textContent = "Choose a file";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearStatus();

    const invalid = validateAll();
    if (invalid.length) {
      setStatus("error", "Please check the fields above.");
      invalid[0].input.focus();
      return;
    }

    if (!INQUIRY_ENDPOINT) {
      setStatus(
        "info",
        "This form isn't connected yet, so nothing was sent. Reach me on",
        contactLinks()
      );
      console.info(
        "[Grafted3D] Inquiry form is not connected. Set VITE_INQUIRY_ENDPOINT in .env and rebuild. See README.md."
      );
      return;
    }

    submitBtn.setAttribute("aria-busy", "true");
    submitBtn.disabled = true;
    if (submitLabel) submitLabel.textContent = "Sending…";

    try {
      const payload = new FormData();
      payload.append("name", fields.name.input.value.trim());
      payload.append("email", fields.email.input.value.trim());
      payload.append("projectType", fields.projectType.input.value);
      payload.append("description", fields.description.input.value.trim());
      payload.append("source", "grafted3d.com");
      const file = fileInput.files?.[0];
      if (file) payload.append("file", file, file.name);

      const response = await fetch(INQUIRY_ENDPOINT, {
        method: "POST",
        body: payload,
        headers: { Accept: "application/json" },
      });

      if (!response.ok) throw new Error(`Endpoint responded with ${response.status}`);

      form.reset();
      resetFileUi();
      Object.values(fields).forEach((field) => setFieldError(field, ""));
      setStatus("success", "Thanks — I'll get back to you.");
    } catch (error) {
      console.error("[Grafted3D] Inquiry submission failed:", error);
      setStatus("error", "That didn't send. Please try again, or reach me on", contactLinks());
    } finally {
      submitBtn.removeAttribute("aria-busy");
      submitBtn.disabled = false;
      if (submitLabel) submitLabel.textContent = submitLabelText;
    }
  });
}

/* ==========================================================================
   Theme toggle

   The initial theme is set by an inline script in <head> (before paint); this
   only flips it, remembers the choice, and keeps the button label and the
   browser chrome colour in step.
   ========================================================================== */
function initTheme() {
  const toggle = document.getElementById("theme-toggle");
  if (!toggle) return;

  const THEME_COLOR = { dark: "#06070a", light: "#fbfbf9" };
  const meta = document.querySelector('meta[name="theme-color"]');
  const root = document.documentElement;

  const current = () => (root.dataset.theme === "light" ? "light" : "dark");

  const sync = () => {
    const theme = current();
    toggle.setAttribute(
      "aria-label",
      theme === "light" ? "Switch to dark theme" : "Switch to light theme"
    );
    if (meta) meta.setAttribute("content", THEME_COLOR[theme]);
  };

  toggle.addEventListener("click", () => {
    const next = current() === "light" ? "dark" : "light";
    root.dataset.theme = next;
    try {
      localStorage.setItem("grafted3d-theme", next);
    } catch (error) {
      /* private mode: the theme still changes for this page view */
    }
    sync();
  });

  sync();
}

/* ==========================================================================
   Scroll reveal

   Sections fade in as they come into view. The class is added here, so with
   no JavaScript — or with reduced motion — everything is simply visible.
   ========================================================================== */
function initReveal() {
  if (!("IntersectionObserver" in window)) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (document.hidden) return;

  const sections = Array.from(document.querySelectorAll("main > section"));
  if (!sections.length) return;

  sections.forEach((section) => section.classList.add("reveal"));

  // Never leave the page blank if an observation is dropped: anything already
  // on screen after a moment is shown regardless.
  window.setTimeout(() => {
    sections.forEach((section) => {
      if (section.classList.contains("is-in")) return;
      const rect = section.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) section.classList.add("is-in");
    });
  }, 1200);

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -10% 0px" }
  );

  sections.forEach((section) => observer.observe(section));
}

function initYear() {
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
}

/* ==========================================================================
   3D preview

   three.js is the largest asset on the page, so it is fetched as its own
   chunk once the hero stage is close to the viewport instead of blocking the
   first paint.
   ========================================================================== */
function initStage() {
  const stage = document.querySelector("[data-stage]");
  if (!stage) return;

  const fail = (error) => {
    console.error("[Grafted3D] 3D preview failed to load:", error);
    stage.dataset.state = "error";
    const status = stage.querySelector("[data-stage-status]");
    if (status) status.textContent = "3D preview unavailable.";
  };

  let booted = false;
  let observer = null;

  const boot = () => {
    if (booted) return;
    booted = true;
    if (observer) observer.disconnect();
    import("./viewport.js")
      .then(({ initStage: mount }) => mount())
      .catch(fail);
  };

  if (!("IntersectionObserver" in window)) {
    boot();
    return;
  }

  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) boot();
    },
    { rootMargin: "600px 0px" }
  );
  observer.observe(stage);

  // A page loaded in a background tab never reports an intersection, so also
  // boot on the first moment it is visible, or shortly after load as a net.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) boot();
  });
  window.setTimeout(boot, 2500);
}

/* ==========================================================================
   Optional integrations, driven by build-time env vars
   ========================================================================== */
function initAnalytics() {
  if (!CF_BEACON_TOKEN) return;

  const script = document.createElement("script");
  script.defer = true;
  script.src = "https://static.cloudflareinsights.com/beacon.min.js";
  script.dataset.cfBeacon = JSON.stringify({ token: CF_BEACON_TOKEN });
  document.head.append(script);
}

function initContactEmail() {
  if (!CONTACT_EMAIL) return;
  const href = `mailto:${CONTACT_EMAIL}`;

  const makeLink = (label) => {
    const link = document.createElement("a");
    link.href = href;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "icon");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", "#i-mail");
    svg.append(use);

    link.append(svg, document.createTextNode(label));
    return link;
  };

  const row = document.querySelector("[data-contact-links]");
  if (row) {
    const link = makeLink(CONTACT_EMAIL);
    link.className = "contact__link";
    row.prepend(link);
  }

  const footer = document.querySelector("[data-footer-links]");
  if (footer) footer.append(makeLink("Email"));
}

initNav();
initTheme();
initForm();
initStage();
initReveal();
initAnalytics();
initContactEmail();
initYear();
