// Gera Documents/visualizar.html com todos os .md de Documents/ e Testes/,
// renderizando Markdown e diagramas Mermaid no navegador.
// Uso: npm run docs
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sections = [
  { folder: "Documents", title: "Documentação" },
  { folder: "Testes", title: "Testes" },
];

const docs = sections.flatMap(({ folder, title }) =>
  readdirSync(path.join(root, folder))
    .filter((file) => file.endsWith(".md"))
    .sort((a, b) => (a === "README.md" ? -1 : b === "README.md" ? 1 : a.localeCompare(b)))
    .map((file) => {
      const markdown = readFileSync(path.join(root, folder, file), "utf8");
      const heading = markdown.match(/^#\s+(.+)$/m)?.[1] ?? file;
      return { id: `${folder}/${file}`, section: title, title: file === "README.md" ? `Índice — ${title}` : heading, markdown };
    }),
);

// Saídas brutas dos testes, para os links de Testes/ funcionarem no visualizador.
const resultsDir = path.join(root, "Testes", "resultados");
for (const file of readdirSync(resultsDir).filter((f) => f.endsWith(".txt")).sort()) {
  const text = readFileSync(path.join(resultsDir, file), "utf8");
  docs.push({ id: `Testes/resultados/${file}`, section: "Resultados brutos", title: file, markdown: `# ${file}\n\n\`\`\`text\n${text}\n\`\`\`\n` });
}

const json = JSON.stringify(docs).replace(/</g, "\\u003c");

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Nuvio — Documentação</title>
<style>
  :root { --primary:#3157e8; --accent:#1dae75; --bg:#f6f8fc; --ink:#17203b; --muted:#67708a; --line:#e6e9f1; --panel:#fff; --nav:#121c3f; }
  * { box-sizing:border-box; }
  body { margin:0; font:16px/1.65 system-ui,-apple-system,"Segoe UI",sans-serif; color:var(--ink); background:var(--bg); display:grid; grid-template-columns:290px 1fr; min-height:100vh; }
  nav { background:var(--nav); color:#fff; padding:28px 18px; position:sticky; top:0; height:100vh; overflow:auto; }
  nav h1 { font:900 1.5rem system-ui,sans-serif; margin:0 0 4px; color:#fff; }
  nav p { margin:0 0 22px; font-size:.8rem; color:#9ca3af; }
  nav h2 { font-size:.72rem; letter-spacing:.14em; text-transform:uppercase; color:#9ca3af; margin:22px 0 8px; }
  nav button { display:block; width:100%; text-align:left; background:none; border:0; color:#d1d5db; font:inherit; font-size:.88rem; padding:8px 10px; border-radius:6px; cursor:pointer; }
  nav button:hover { background:rgba(255,255,255,.08); }
  nav button.active { background:#3157e8; color:#fff; font-weight:700; }
  main { padding:40px clamp(18px,5vw,64px); max-width:1100px; }
  article { background:var(--panel); border:1px solid var(--line); padding:clamp(20px,4vw,48px); border-radius:16px; }
  h1,h2,h3 { font-family:system-ui,sans-serif; font-weight:800; color:#17203b; line-height:1.2; }
  article h1 { font-size:2.1rem; margin-top:0; }
  article h2 { border-bottom:1px solid var(--line); padding-bottom:6px; margin-top:2.2em; }
  a { color:var(--primary); }
  table { border-collapse:collapse; width:100%; margin:1em 0; font-size:.9rem; display:block; overflow-x:auto; }
  th,td { border:1px solid var(--line); padding:8px 10px; vertical-align:top; text-align:left; }
  th { background:#f1ecfa; }
  code { background:#f3f4f6; padding:1px 5px; border-radius:3px; font-size:.88em; }
  pre:not(.mermaid) { background:#121c3f; color:#f7f5fb; padding:14px; overflow:auto; border-radius:4px; }
  pre:not(.mermaid) code { background:none; color:inherit; }
  pre.mermaid { background:#fff; text-align:center; overflow:auto; }
  blockquote { border-left:3px solid var(--accent); margin:1em 0; padding:4px 16px; color:var(--muted); background:#fdf2f8; }
  @media (max-width:800px) { body { grid-template-columns:1fr; } nav { position:static; height:auto; } }
</style>
</head>
<body>
<nav id="nav"><h1>Nuvio</h1><p>Documentação de engenharia · v1.0</p></nav>
<main><article id="doc">Carregando…</article></main>
<script src="https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"></script>
<script>
  const docs = ${json};
  mermaid.initialize({ startOnLoad: false, theme: "base", themeVariables: { primaryColor: "#eef2ff", primaryBorderColor: "#3157e8", primaryTextColor: "#17203b", lineColor: "#7790ed", fontFamily: "system-ui" } });
  const renderer = new marked.Renderer();
  const baseCode = renderer.code.bind(renderer);
  renderer.code = (code, lang) => lang === "mermaid" ? '<pre class="mermaid">' + code.replace(/</g, "&lt;") + "</pre>" : baseCode(code, lang);
  const nav = document.getElementById("nav"), article = document.getElementById("doc");
  let current;
  const normalize = (fromId, href) => {
    const parts = fromId.split("/").slice(0, -1).concat(href.split("/"));
    const out = [];
    for (const p of parts) { if (p === "..") out.pop(); else if (p && p !== ".") out.push(p); }
    return out.join("/");
  };
  const resolve = (fromId, href) => {
    const id = normalize(fromId, href);
    return docs.some((d) => d.id === id) ? id : docs.some((d) => d.id === id + "/README.md") ? id + "/README.md" : null;
  };
  async function show(id) {
    const doc = docs.find((d) => d.id === id) ?? docs[0];
    current = doc.id;
    article.innerHTML = marked.parse(doc.markdown, { renderer });
    nav.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.id === doc.id));
    await mermaid.run({ nodes: article.querySelectorAll(".mermaid") });
    history.replaceState(null, "", "#" + encodeURIComponent(doc.id));
    window.scrollTo(0, 0);
  }
  let lastSection;
  for (const d of docs) {
    if (d.section !== lastSection) { const h = document.createElement("h2"); h.textContent = d.section; nav.append(h); lastSection = d.section; }
    const b = document.createElement("button"); b.textContent = d.title; b.dataset.id = d.id; b.onclick = () => show(d.id); nav.append(b);
  }
  article.addEventListener("click", (e) => {
    const a = e.target.closest("a"); if (!a) return;
    const href = a.getAttribute("href") || "";
    if (/^https?:/.test(href)) { a.target = "_blank"; return; }
    const target = resolve(current, href.split("#")[0]);
    if (target) { e.preventDefault(); show(target); return; }
    // Outros arquivos do projeto (ex.: resultados/*.txt): caminho relativo a Documents/.
    a.href = "../" + normalize(current, href);
    a.target = "_blank";
  });
  show(decodeURIComponent(location.hash.slice(1)) || docs[0].id);
</script>
</body>
</html>
`;

writeFileSync(path.join(root, "Documents", "visualizar.html"), html);

// Mesma página embutida no site, servida pela rota secreta /documents/<código>.
writeFileSync(
  path.join(root, "src", "modules", "docs", "docs-html.generated.ts"),
  `// Gerado por tools/build-docs.mjs — não edite à mão (rode: npm run docs).\nexport const DOCS_HTML = ${JSON.stringify(html)};\n`,
);
console.log(`Documents/visualizar.html e o módulo do site gerados com ${docs.length} documentos.`);
