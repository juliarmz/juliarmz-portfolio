const IN_SUBDIR = /\/projects\/[^/]*$/.test(window.location.pathname);
const BASE = IN_SUBDIR ? "../" : "";

const PROJECTS = [
  { title: "A Tale of Two Titties", href: `${BASE}projects/a-tale-of-two-titties.html` },
  { title: "Envy Magazine", href: `${BASE}projects/envy-magazine.html` },
  { title: "Boyfriend Co-op", href: `${BASE}projects/boyfriend-co-op.html` },
  { title: "DJs Against Apartheid", href: `${BASE}projects/djs-against-apartheid.html` },
  { title: "Brinn & CJ Get Married", href: `${BASE}projects/brinn-cj-get-married.html` },
];

const BOTTOM_LINKS = [
  { title: "Info & Contact", href: `${BASE}index.html` },
  { title: "Sketchbook", href: `${BASE}sketchbook.html` },
];

function pageKey(path) {
  const clean = path.split("?")[0].split("#")[0];
  if (clean === "/" || clean === "" || clean.endsWith("/")) return "index.html";
  return clean.includes("/projects/")
    ? "projects/" + clean.split("/projects/")[1]
    : clean.split("/").pop();
}

function navItemHTML(item, currentKey) {
  const isActive = currentKey === pageKey(item.href);
  return `<a class="nav-item${isActive ? " active" : ""}" href="${item.href}">
    <span class="horse-icon" aria-hidden="true"></span>
    <span>${item.title}</span>
  </a>`;
}

function renderNav() {
  const mount = document.getElementById("nav-mount");
  if (!mount) return;
  const currentKey = pageKey(window.location.pathname);

  const topHTML = PROJECTS.map((p) => navItemHTML(p, currentKey)).join("");
  const bottomHTML = BOTTOM_LINKS.map((p) => navItemHTML(p, currentKey)).join("");

  mount.innerHTML = `
    <nav class="projects">
      <div class="nav-top">${topHTML}</div>
      <div class="nav-bottom">${bottomHTML}</div>
    </nav>
  `;
}

document.addEventListener("DOMContentLoaded", renderNav);
