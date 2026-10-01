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

function frameFit(rect) {
  const pad = 32;
  const scale = Math.min(
    (window.innerWidth - pad * 2) / rect.width,
    (window.innerHeight - pad * 2) / rect.height
  );
  const tx = (window.innerWidth - rect.width * scale) / 2 - rect.left;
  const ty = (window.innerHeight - rect.height * scale) / 2 - rect.top;
  return { scale, tx, ty };
}

function frameTransform(rect) {
  const { scale, tx, ty } = frameFit(rect);
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
  const bcjCollage = active.closest(".bcj-collage");
  const bcjBehind = active.classList.contains("bcj-behind-img");
  const multiple = bcjCollage
    ? bcjCollage.querySelectorAll(".float").length > 1
    : bcjBehind
    ? document.querySelectorAll(".bcj-behind-img").length > 1
    : active.closest(".hero-row").querySelectorAll(".stage-img").length > 1;
  addChrome(box, multiple);
  document.body.appendChild(box);
  active.style.visibility = "hidden";
  lightbox = { kind: "image", box, img, active, ratio, closing: false, zoomed: false, zoomRect: null };
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
  lightbox = { kind: "frame", box, clone, active: frame, rect, closing: false, zoomed: false };
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

// Second-level zoom: click the full-page image to magnify it, drag/scroll to pan.
function clampPan(r) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    left: r.width > vw ? Math.min(0, Math.max(vw - r.width, r.left)) : (vw - r.width) / 2,
    top: r.height > vh ? Math.min(0, Math.max(vh - r.height, r.top)) : (vh - r.height) / 2,
    width: r.width,
    height: r.height,
  };
}

function toggleImageZoom(cx, cy) {
  const { img, active, box } = lightbox;
  img.style.transition = "";
  const fit = fitRect(lightbox.ratio);
  if (lightbox.zoomed) {
    lightbox.zoomed = false;
    box.classList.remove("zoomed");
    setRect(img, fit);
    return;
  }
  const scale = Math.min(3, Math.max(2, active.naturalWidth / fit.width));
  const fx = Math.min(1, Math.max(0, (cx - fit.left) / fit.width));
  const fy = Math.min(1, Math.max(0, (cy - fit.top) / fit.height));
  const width = fit.width * scale;
  const height = fit.height * scale;
  lightbox.zoomRect = clampPan({ left: cx - fx * width, top: cy - fy * height, width, height });
  lightbox.zoomed = true;
  box.classList.add("zoomed");
  setRect(img, lightbox.zoomRect);
}

function panImage(dx, dy, base) {
  const zr = lightbox.zoomRect;
  const r = clampPan({ left: base.left + dx, top: base.top + dy, width: zr.width, height: zr.height });
  lightbox.zoomRect = r;
  setRect(lightbox.img, r);
}

// Same second-level zoom, for a zoomed figma-frame: click it again to
// magnify further (around the click point), drag or scroll to pan.
function applyFrameZoom() {
  const { rect, zoomLeft, zoomTop, zoomScale } = lightbox;
  lightbox.clone.style.transform =
    "translate(" + (zoomLeft - rect.left) + "px, " + (zoomTop - rect.top) + "px) scale(" + zoomScale + ")";
}

function toggleFrameZoom(cx, cy) {
  const { clone, rect } = lightbox;
  clone.style.transition = "";
  if (lightbox.zoomed) {
    lightbox.zoomed = false;
    lightbox.box.classList.remove("zoomed");
    clone.style.transform = frameTransform(rect);
    return;
  }
  const fit = frameFit(rect);
  const fitLeft = rect.left + fit.tx;
  const fitTop = rect.top + fit.ty;
  const fitWidth = rect.width * fit.scale;
  const fitHeight = rect.height * fit.scale;
  const fx = Math.min(1, Math.max(0, (cx - fitLeft) / fitWidth));
  const fy = Math.min(1, Math.max(0, (cy - fitTop) / fitHeight));
  const scale = fit.scale * 2.4;
  const width = rect.width * scale;
  const height = rect.height * scale;
  const clamped = clampPan({ left: cx - fx * width, top: cy - fy * height, width, height });
  lightbox.zoomed = true;
  lightbox.zoomScale = scale;
  lightbox.zoomLeft = clamped.left;
  lightbox.zoomTop = clamped.top;
  lightbox.box.classList.add("zoomed");
  applyFrameZoom();
}

function panFrame(dx, dy, base) {
  const { rect, zoomScale } = lightbox;
  const clamped = clampPan({ left: base.left + dx, top: base.top + dy, width: rect.width * zoomScale, height: rect.height * zoomScale });
  lightbox.zoomLeft = clamped.left;
  lightbox.zoomTop = clamped.top;
  applyFrameZoom();
}

function showLightboxImage(next) {
  const { img, active } = lightbox;
  active.style.visibility = "";
  next.style.visibility = "hidden";
  lightbox.active = next;
  lightbox.ratio = next.naturalWidth / next.naturalHeight;
  lightbox.zoomed = false;
  lightbox.box.classList.remove("zoomed");
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
  lightbox.zoomed = false;
  lightbox.box.classList.remove("zoomed");
}

function stepDesign(step) {
  if (lightbox && !lightbox.closing && lightbox.kind === "frame") {
    const frames = [...document.querySelectorAll(".figma-canvas")];
    const current = frames.indexOf(lightbox.active);
    showLightboxFrame(frames[(current + step + frames.length) % frames.length]);
    return;
  }
  const bcjCollage = lightbox && !lightbox.closing ? lightbox.active.closest(".bcj-collage") : null;
  if (bcjCollage) {
    const imgs = [...bcjCollage.querySelectorAll(".float")].filter((el) => el.tagName === "IMG");
    const current = imgs.indexOf(lightbox.active);
    showLightboxImage(imgs[(current + step + imgs.length) % imgs.length]);
    return;
  }
  const bcjBehind = lightbox && !lightbox.closing && lightbox.active.classList.contains("bcj-behind-img");
  if (bcjBehind) {
    const imgs = [...document.querySelectorAll(".bcj-behind-img")];
    const current = imgs.indexOf(lightbox.active);
    showLightboxImage(imgs[(current + step + imgs.length) % imgs.length]);
    return;
  }
  const row = lightbox && !lightbox.closing ? lightbox.active.closest(".hero-row") : visibleCarousel();
  if (!row) return;
  const imgs = [...row.querySelectorAll(".stage-img")];
  // In a "pair"/"trio" row every image stays marked active (they're all
  // shown at once), so the open lightbox's own image is the only reliable
  // way to know which one is "current"; a toggled carousel has exactly
  // one active image, which doubles as its shown design.
  const multiView = row.classList.contains("pair") || row.classList.contains("trio");
  const current = multiView && lightbox && !lightbox.closing
    ? imgs.indexOf(lightbox.active)
    : imgs.findIndex((i) => i.classList.contains("active"));
  const next = (current + step + imgs.length) % imgs.length;
  if (!multiView) selectDesign(row, next);
  if (lightbox && !lightbox.closing) showLightboxImage(imgs[next]);
}

// The hero row (with more than one design) whose stage is most on screen.
function visibleCarousel() {
  let best = null;
  let bestVisible = 0;
  for (const row of document.querySelectorAll(".hero-row")) {
    if (row.classList.contains("pair") || row.classList.contains("trio")) continue;
    if (row.querySelectorAll(".stage-img").length < 2) continue;
    const r = row.querySelector(".hero-stage").getBoundingClientRect();
    const visible = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
    if (visible > bestVisible) {
      best = row;
      bestVisible = visible;
    }
  }
  return best;
}

document.addEventListener("click", (e) => {
  if (suppressClick) return;
  const arrow = e.target.closest(".lightbox-arrow");
  if (arrow) {
    stepDesign(Number(arrow.dataset.dir));
    return;
  }
  if (lightbox && !lightbox.closing && lightbox.kind === "image" && e.target === lightbox.img) {
    toggleImageZoom(e.clientX, e.clientY);
    return;
  }
  if (lightbox && !lightbox.closing && lightbox.kind === "frame" && lightbox.clone.contains(e.target)) {
    toggleFrameZoom(e.clientX, e.clientY);
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
  const bcjFloat = e.target.closest(".bcj-collage .float");
  if (bcjFloat && bcjFloat.tagName === "IMG") {
    openLightbox(bcjFloat);
    return;
  }
  const bcjBehind = e.target.closest(".bcj-behind-img");
  if (bcjBehind) {
    openLightbox(bcjBehind);
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
  if (!open && !visibleCarousel()) return;
  e.preventDefault();
  stepDesign(e.key === "ArrowRight" ? 1 : -1);
});

window.addEventListener("resize", () => {
  if (!lightbox || lightbox.closing) return;
  lightbox.zoomed = false;
  lightbox.box.classList.remove("zoomed");
  if (lightbox.kind === "image") setRect(lightbox.img, fitRect(lightbox.ratio));
  else lightbox.clone.style.transform = frameTransform(lightbox.rect);
});

let drag = null;
let deskZ = 10;

// Resize a .figma-canvas by dragging one of its corner handles: the
// opposite corner stays anchored on screen while the dragged corner
// tracks the pointer, scaling the whole frame (and its contents) in place.
let resize = null;

document.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "touch" || e.button !== 0) return;
  if (e.target.closest(".lightbox")) return;
  const handle = e.target.closest(".handle");
  if (!handle) return;
  const canvas = handle.closest(".figma-canvas");
  if (!canvas) return;
  const host = canvas.closest(".project-main");
  const rect = canvas.getBoundingClientRect();
  const hostRect = host.getBoundingClientRect();
  const corner = handle.classList.contains("tl")
    ? "tl"
    : handle.classList.contains("tr")
    ? "tr"
    : handle.classList.contains("bl")
    ? "bl"
    : "br";
  const anchor = {
    tl: { x: rect.right, y: rect.bottom },
    tr: { x: rect.left, y: rect.bottom },
    bl: { x: rect.right, y: rect.top },
    br: { x: rect.left, y: rect.top },
  }[corner];
  resize = {
    canvas,
    corner,
    anchor,
    startDist: Math.hypot(e.clientX - anchor.x, e.clientY - anchor.y) || 1,
    startWidth: rect.width,
    baseDx: Number(canvas.dataset.dx || 0),
    baseDy: Number(canvas.dataset.dy || 0),
    minWidth: 160,
    maxWidth: Math.max(160, hostRect.width - 24),
    moved: false,
  };
  canvas.classList.add("dragging");
  canvas.style.zIndex = ++deskZ;
  e.preventDefault();
});

document.addEventListener("pointermove", (e) => {
  if (!resize) return;
  if (Math.abs(e.clientX - resize.anchor.x) > 4 || Math.abs(e.clientY - resize.anchor.y) > 4) resize.moved = true;
  const dist = Math.hypot(e.clientX - resize.anchor.x, e.clientY - resize.anchor.y) || 1;
  const width = Math.min(resize.maxWidth, Math.max(resize.minWidth, resize.startWidth * (dist / resize.startDist)));

  // Measure with the transform pinned to its drag-start value so the
  // correction below is computed fresh each move, not compounded.
  resize.canvas.style.transform = "translate(" + resize.baseDx + "px, " + resize.baseDy + "px)";
  resize.canvas.style.width = width + "px";
  const rect = resize.canvas.getBoundingClientRect();
  const current = {
    tl: { x: rect.right, y: rect.bottom },
    tr: { x: rect.left, y: rect.bottom },
    bl: { x: rect.right, y: rect.top },
    br: { x: rect.left, y: rect.top },
  }[resize.corner];
  const dx = resize.baseDx + (resize.anchor.x - current.x);
  const dy = resize.baseDy + (resize.anchor.y - current.y);
  resize.canvas.dataset.dx = dx;
  resize.canvas.dataset.dy = dy;
  resize.canvas.style.transform = "translate(" + dx + "px, " + dy + "px)";
});

function endResize() {
  if (!resize) return;
  resize.canvas.classList.remove("dragging");
  if (resize.moved) {
    suppressClick = true;
    setTimeout(() => {
      suppressClick = false;
    }, 60);
  }
  resize = null;
}

document.addEventListener("pointerup", endResize);
document.addEventListener("pointercancel", endResize);

document.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "touch" || e.button !== 0) return;
  if (e.target.closest(".lightbox")) return;
  if (e.target.closest(".handle")) return;
  const canvas = e.target.closest(".figma-canvas, .drag");
  if (!canvas) return;
  const pane = canvas.closest(".content-pane");
  const host = canvas.matches(".drag") ? canvas.closest(".drag-stage") : canvas.closest(".project-main");
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
  if (e.target.closest && e.target.closest(".figma-canvas, .drag")) e.preventDefault();
});

let pan = null;

document.addEventListener("pointerdown", (e) => {
  if (e.button !== 0 || !lightbox || lightbox.closing || !lightbox.zoomed) return;
  const el = lightbox.kind === "image" ? lightbox.img : lightbox.clone;
  const onTarget = lightbox.kind === "image" ? e.target === el : el.contains(e.target);
  if (!onTarget) return;
  const left = lightbox.kind === "image" ? lightbox.zoomRect.left : lightbox.zoomLeft;
  const top = lightbox.kind === "image" ? lightbox.zoomRect.top : lightbox.zoomTop;
  pan = { x: e.clientX, y: e.clientY, left, top, moved: false };
  el.style.transition = "none";
  lightbox.box.classList.add("panning");
  e.preventDefault();
});

document.addEventListener("pointermove", (e) => {
  if (!pan) return;
  const dx = e.clientX - pan.x;
  const dy = e.clientY - pan.y;
  if (Math.abs(dx) > 4 || Math.abs(dy) > 4) pan.moved = true;
  if (lightbox.kind === "image") panImage(dx, dy, pan);
  else panFrame(dx, dy, pan);
});

function endPan() {
  if (!pan) return;
  if (lightbox) {
    lightbox.box.classList.remove("panning");
    (lightbox.kind === "image" ? lightbox.img : lightbox.clone).style.transition = "";
  }
  if (pan.moved) {
    suppressClick = true;
    setTimeout(() => {
      suppressClick = false;
    }, 60);
  }
  pan = null;
}

document.addEventListener("pointerup", endPan);
document.addEventListener("pointercancel", endPan);

// trackpad / mouse-wheel panning while magnified
document.addEventListener(
  "wheel",
  (e) => {
    if (!lightbox || lightbox.closing || !lightbox.zoomed) return;
    e.preventDefault();
    if (lightbox.kind === "image") {
      lightbox.img.style.transition = "none";
      panImage(-e.deltaX, -e.deltaY, lightbox.zoomRect);
    } else {
      lightbox.clone.style.transition = "none";
      panFrame(-e.deltaX, -e.deltaY, { left: lightbox.zoomLeft, top: lightbox.zoomTop });
    }
  },
  { passive: false }
);
