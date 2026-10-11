// Abre a documentação (link secreto) e confere se todos os diagramas Mermaid foram desenhados.
// Uso: node tests/e2e/docs-check.mjs <url completa da documentação>
import puppeteer from "puppeteer-core";

const url = process.argv[2];
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const page = await browser.newPage();
await page.goto(url, { waitUntil: "networkidle0" });
const ids = await page.$$eval("nav button", (bs) => bs.map((b) => b.dataset.id));
let diagrams = 0, errors = 0;
for (const id of ids) {
  await page.evaluate((i) => document.querySelector(`nav button[data-id="${i}"]`).click(), id);
  await new Promise((r) => setTimeout(r, 900));
  const r = await page.evaluate(() => ({
    total: document.querySelectorAll("pre.mermaid").length,
    drawn: document.querySelectorAll("pre.mermaid svg").length,
    error: /Syntax error|Parse error/i.test(document.querySelector("article").innerText),
  }));
  diagrams += r.drawn;
  if (r.error || r.drawn < r.total) { errors++; console.log(`❌ ${id}: ${r.drawn}/${r.total} diagramas${r.error ? " (erro de sintaxe)" : ""}`); }
  else if (r.total) console.log(`✅ ${id}: ${r.drawn}/${r.total} diagramas`);
}
await browser.close();
console.log(`\n${ids.length} documentos · ${diagrams} diagramas desenhados · ${errors} com problema`);
process.exit(errors ? 1 : 0);
