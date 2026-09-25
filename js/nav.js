function pageKey(pathname) {
  const clean = pathname.split("?")[0].split("#")[0];
  if (clean === "/" || clean === "" || clean.endsWith("/")) return "index.html";
  return clean.includes("/projects/")
    ? "projects/" + clean.split("/projects/")[1]
    : clean.split("/").pop();
}

function setActiveNav(pathname) {
  const key = pageKey(pathname);
  document.querySelectorAll(".nav-column .nav-item").forEach((link) => {
    const linkKey = pageKey(new URL(link.getAttribute("href"), location.href).pathname);
    link.classList.toggle("active", linkKey === key);
  });
}

async function loadPage(url, push) {
  const contentPane = document.querySelector(".content-pane");
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("fetch failed: " + res.status);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const newContent = doc.querySelector(".content-pane");
    if (!newContent) throw new Error("no .content-pane in fetched page");

    // Resolve relative asset paths against the fetched page's URL, since
    // they'll be inserted into a document that may sit at a different depth.
    newContent.querySelectorAll("img[src]").forEach((img) => {
      img.setAttribute("src", new URL(img.getAttribute("src"), url).href);
    });

    contentPane.innerHTML = newContent.innerHTML;
    contentPane.scrollTop = 0;
    document.title = doc.title;
    setActiveNav(new URL(url, location.href).pathname);

    if (push) history.pushState({ url }, "", url);
  } catch (err) {
    location.href = url;
  }
}

document.addEventListener("click", (e) => {
  if (e.defaultPrevented || e.button !== 0) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

  const link = e.target.closest("a");
  if (!link || !link.closest(".nav-column")) return;

  const href = link.getAttribute("href");
  if (!href || link.target === "_blank" || link.hasAttribute("download")) return;
  if (/^(https?:)?\/\//.test(href) || href.startsWith("mailto:") || href.startsWith("#")) return;

  const url = new URL(href, location.href).href;
  if (url === location.href) {
    e.preventDefault();
    return;
  }

  e.preventDefault();
  loadPage(url, true);
});

window.addEventListener("popstate", () => {
  loadPage(location.href, false);
});

document.addEventListener("click", (e) => {
  const thumb = e.target.closest(".hero-thumb");
  if (!thumb) return;
  const row = thumb.closest(".hero-row");
  const index = Number(thumb.dataset.index);
  row.querySelectorAll(".hero-thumb").forEach((t) => t.classList.toggle("active", t === thumb));
  row.querySelectorAll(".stage-img").forEach((img, i) => img.classList.toggle("active", i === index));
});

let lightbox = null;

function fitRect(ratio) {
  const pad = 16;
  const maxW = window.innerWidth - pad * 2;
  const maxH = window.innerHeight - pad * 2;
  let width = maxW;
  let height = maxW / ratio;
  if (height > maxH) {
    height = maxH;
    width = maxH * ratio;
  }
  return {
    left: (window.innerWidth - width) / 2,
    top: (window.innerHeight - height) / 2,
    width,
    height,
  };
}

function setRect(el, r) {
  el.style.left = r.left + "px";
  el.style.top = r.top + "px";
  el.style.width = r.width + "px";
  el.style.height = r.height + "px";
}

function openLightbox(active) {
  if (lightbox) return;
  const ratio = active.naturalWidth / active.naturalHeight;
  const box = document.createElement("div");
  box.className = "lightbox";
  const img = document.createElement("img");
  img.src = active.currentSrc || active.src;
  img.alt = active.alt;
  setRect(img, active.getBoundingClientRect());
  box.appendChild(img);
  document.body.appendChild(box);
  active.style.visibility = "hidden";
  lightbox = { box, img, active, ratio, closing: false };
  img.getBoundingClientRect();
  box.classList.add("open");
  setRect(img, fitRect(ratio));
}

function closeLightbox() {
  if (!lightbox || lightbox.closing) return;
  const { box, img, active } = lightbox;
  lightbox.closing = true;
  box.classList.remove("open");
  setRect(img, active.getBoundingClientRect());
  setTimeout(() => {
    active.style.visibility = "";
    box.remove();
    lightbox = null;
  }, 380);
}

document.addEventListener("click", (e) => {
  if (e.target.closest(".lightbox")) {
    closeLightbox();
    return;
  }
  const active = e.target.closest(".stage-img.active");
  if (active) openLightbox(active);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeLightbox();
});

window.addEventListener("resize", () => {
  if (lightbox && !lightbox.closing) setRect(lightbox.img, fitRect(lightbox.ratio));
});
