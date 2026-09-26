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

function selectDesign(row, index) {
  row.querySelectorAll(".hero-thumb").forEach((t, i) => t.classList.toggle("active", i === index));
  row.querySelectorAll(".stage-img").forEach((img, i) => img.classList.toggle("active", i === index));
}

document.addEventListener("click", (e) => {
  const thumb = e.target.closest(".hero-thumb");
  if (!thumb) return;
  selectDesign(thumb.closest(".hero-row"), Number(thumb.dataset.index));
});

let lightbox = null;
let suppressClick = false;

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

function frameTransform(rect) {
  const pad = 32;
  const scale = Math.min(
    (window.innerWidth - pad * 2) / rect.width,
    (window.innerHeight - pad * 2) / rect.height
  );
  const tx = (window.innerWidth - rect.width * scale) / 2 - rect.left;
  const ty = (window.innerHeight - rect.height * scale) / 2 - rect.top;
  return "translate(" + tx + "px, " + ty + "px) scale(" + scale + ")";
}

function makeFrameClone(frame, rect) {
  const clone = frame.cloneNode(true);
  clone.classList.add("zoom-canvas");
  clone.style.transform = "none";
  clone.style.zIndex = "";
  clone.style.left = rect.left + "px";
  clone.style.top = rect.top + "px";
  clone.style.width = rect.width + "px";
  clone.style.height = rect.height + "px";
  return clone;
}

function addChrome(box, arrows = true) {
  const close = document.createElement("button");
  close.type = "button";
  close.className = "lightbox-close";
  close.setAttribute("aria-label", "Close");
  close.textContent = "×";
  box.appendChild(close);
  if (!arrows) return;
  for (const dir of [-1, 1]) {
    const arrow = document.createElement("button");
    arrow.type = "button";
    arrow.className = "lightbox-arrow " + (dir < 0 ? "prev" : "next");
    arrow.dataset.dir = dir;
    arrow.setAttribute("aria-label", dir < 0 ? "Previous" : "Next");
    arrow.textContent = dir < 0 ? "‹" : "›";
    box.appendChild(arrow);
  }
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
  addChrome(box, document.querySelectorAll(".stage-img").length > 1);
  document.body.appendChild(box);
  active.style.visibility = "hidden";
  lightbox = { kind: "image", box, img, active, ratio, closing: false };
  img.getBoundingClientRect();
  box.classList.add("open");
  setRect(img, fitRect(ratio));
}

function openFrameLightbox(frame) {
  if (lightbox) return;
  const rect = frame.getBoundingClientRect();
  const box = document.createElement("div");
  box.className = "lightbox";
  const clone = makeFrameClone(frame, rect);
  box.appendChild(clone);
  addChrome(box);
  document.body.appendChild(box);
  frame.style.visibility = "hidden";
  lightbox = { kind: "frame", box, clone, active: frame, rect, closing: false };
  clone.getBoundingClientRect();
  box.classList.add("open");
  clone.style.transform = frameTransform(rect);
}

function closeLightbox() {
  if (!lightbox || lightbox.closing) return;
  const { box, active } = lightbox;
  lightbox.closing = true;
  box.classList.remove("open");
  if (lightbox.kind === "image") setRect(lightbox.img, active.getBoundingClientRect());
  else lightbox.clone.style.transform = "none";
  setTimeout(() => {
    active.style.visibility = "";
    box.remove();
    lightbox = null;
  }, 380);
}

function showLightboxImage(next) {
  const { img, active } = lightbox;
  active.style.visibility = "";
  next.style.visibility = "hidden";
  lightbox.active = next;
  lightbox.ratio = next.naturalWidth / next.naturalHeight;
  img.style.transition = "none";
  img.src = next.currentSrc || next.src;
  img.alt = next.alt;
  setRect(img, fitRect(lightbox.ratio));
  img.getBoundingClientRect();
  img.style.transition = "";
}

function showLightboxFrame(next) {
  const { clone: old, active } = lightbox;
  active.style.visibility = "";
  const rect = next.getBoundingClientRect();
  const clone = makeFrameClone(next, rect);
  next.style.visibility = "hidden";
  clone.style.transition = "none";
  clone.style.transform = frameTransform(rect);
  old.replaceWith(clone);
  clone.getBoundingClientRect();
  clone.style.transition = "";
  lightbox.clone = clone;
  lightbox.active = next;
  lightbox.rect = rect;
}

function stepDesign(step) {
  if (lightbox && !lightbox.closing && lightbox.kind === "frame") {
    const frames = [...document.querySelectorAll(".figma-canvas")];
    const current = frames.indexOf(lightbox.active);
    showLightboxFrame(frames[(current + step + frames.length) % frames.length]);
    return;
  }
  const row = document.querySelector(".hero-row");
  if (!row) return;
  const imgs = [...row.querySelectorAll(".stage-img")];
  const current = imgs.findIndex((i) => i.classList.contains("active"));
  const next = (current + step + imgs.length) % imgs.length;
  selectDesign(row, next);
  if (lightbox && !lightbox.closing) showLightboxImage(imgs[next]);
}

document.addEventListener("click", (e) => {
  if (suppressClick) return;
  const arrow = e.target.closest(".lightbox-arrow");
  if (arrow) {
    stepDesign(Number(arrow.dataset.dir));
    return;
  }
  if (e.target.closest(".lightbox")) {
    closeLightbox();
    return;
  }
  const active = e.target.closest(".stage-img.active");
  if (active) {
    openLightbox(active);
    return;
  }
  const frame = e.target.closest(".figma-frame");
  if (frame) openFrameLightbox(frame.closest(".figma-canvas"));
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeLightbox();
    return;
  }
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  if (e.target.closest && e.target.closest("input, textarea, select")) return;
  const open = lightbox && !lightbox.closing;
  if (!open) {
    const row = document.querySelector(".hero-row");
    if (!row) return;
    const stageRect = row.querySelector(".hero-stage").getBoundingClientRect();
    if (stageRect.bottom < 0 || stageRect.top > window.innerHeight) return;
  }
  e.preventDefault();
  stepDesign(e.key === "ArrowRight" ? 1 : -1);
});

window.addEventListener("resize", () => {
  if (!lightbox || lightbox.closing) return;
  if (lightbox.kind === "image") setRect(lightbox.img, fitRect(lightbox.ratio));
  else lightbox.clone.style.transform = frameTransform(lightbox.rect);
});

let drag = null;
let deskZ = 10;

document.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "touch" || e.button !== 0) return;
  if (e.target.closest(".lightbox")) return;
  const canvas = e.target.closest(".figma-canvas");
  if (!canvas) return;
  const pane = canvas.closest(".content-pane");
  const host = canvas.closest(".project-main");
  const rect = canvas.getBoundingClientRect();
  const paneRect = pane.getBoundingClientRect();
  const hostRect = host.getBoundingClientRect();
  const baseX = Number(canvas.dataset.dx || 0);
  const baseY = Number(canvas.dataset.dy || 0);
  drag = {
    canvas,
    startX: e.clientX,
    startY: e.clientY,
    baseX,
    baseY,
    moved: false,
    minX: baseX - (rect.left - paneRect.left),
    maxX: baseX + (paneRect.right - 48 - rect.right),
    minY: baseY - (rect.top - hostRect.top),
    maxY: baseY + (hostRect.bottom - rect.bottom),
  };
  canvas.classList.add("dragging");
  canvas.style.zIndex = ++deskZ;
  e.preventDefault();
});

document.addEventListener("pointermove", (e) => {
  if (!drag) return;
  if (Math.abs(e.clientX - drag.startX) > 4 || Math.abs(e.clientY - drag.startY) > 4) drag.moved = true;
  const dx = Math.min(drag.maxX, Math.max(drag.minX, drag.baseX + e.clientX - drag.startX));
  const dy = Math.min(drag.maxY, Math.max(drag.minY, drag.baseY + e.clientY - drag.startY));
  drag.canvas.dataset.dx = dx;
  drag.canvas.dataset.dy = dy;
  drag.canvas.style.transform = "translate(" + dx + "px, " + dy + "px)";
});

function endDrag() {
  if (!drag) return;
  drag.canvas.classList.remove("dragging");
  if (drag.moved) {
    suppressClick = true;
    setTimeout(() => {
      suppressClick = false;
    }, 60);
  }
  drag = null;
}

document.addEventListener("pointerup", endDrag);
document.addEventListener("pointercancel", endDrag);

document.addEventListener("dragstart", (e) => {
  if (e.target.closest && e.target.closest(".figma-canvas")) e.preventDefault();
});
