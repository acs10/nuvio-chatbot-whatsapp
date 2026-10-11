"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatDateTime } from "@/core/lib/format";
import { observer } from "@/core/state/mobx";
import { Icon, type IconName } from "@/core/ui/Icon";
import { DashboardHeader, EmptyState, Field, Modal, TextArea, Toggle } from "@/core/ui/ui";
import { KNOWLEDGE_KIND_LABEL, type KnowledgeItem, type KnowledgeKind } from "@/modules/domain/types";
import { usePlatform } from "@/modules/platform/PlatformProvider";

const KIND_ICON: Record<KnowledgeKind, IconName> = { faq: "help", text: "document", document: "upload", site: "globe" };

type Draft = { id?: string; kind: KnowledgeKind; title: string; content: string; question: string; url: string; fileName: string };
const empty = (kind: KnowledgeKind = "faq"): Draft => ({ kind, title: "", content: "", question: "", url: "", fileName: "" });

export const Knowledge = observer(function Knowledge() {
  const store = usePlatform();
  const ws = store.current!;
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KnowledgeKind | "all">("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const items = store.knowledgeOf(ws.id);
  const limit = store.plan(ws.planId).knowledgeLimit;
  const q = query.trim().toLowerCase();
  const list = items.filter((k) => (kind === "all" || k.kind === kind) && (!q || `${k.title} ${k.question ?? ""} ${k.content}`.toLowerCase().includes(q)));

  // Demonstração: a leitura do site termina sozinha em alguns segundos.
  const processing = items.filter((k) => k.status === "processing").map((k) => k.id).join(",");
  useEffect(() => {
    if (!processing) return;
    const timer = window.setTimeout(() => processing.split(",").forEach((id) => store.finishProcessing(id)), 2500);
    return () => window.clearTimeout(timer);
  }, [processing, store]);

  const edit = (k: KnowledgeItem) => setDraft({ id: k.id, kind: k.kind, title: k.title, content: k.content, question: k.question ?? "", url: k.url ?? "", fileName: k.fileName ?? "" });
  const remove = (k: KnowledgeItem) => {
    if (!window.confirm(`Remover "${k.title}"? A IA deixará de usar este conteúdo.`)) return;
    store.removeKnowledge(k.id);
    toast.success("Conteúdo removido.");
  };

  return (
    <>
      <DashboardHeader title="Base de conhecimento" description="Gerencie as informações usadas para responder seus clientes. A IA só responde com o que estiver aqui." />
      <div className="section-toolbar">
        <label>
          <Icon name="search" size={18} />
          <input placeholder="Buscar em base de conhecimento…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <select className="toolbar-select" value={kind} onChange={(e) => setKind(e.target.value as KnowledgeKind | "all")} aria-label="Tipo">
          <option value="all">Todos os tipos</option>
          {(Object.keys(KNOWLEDGE_KIND_LABEL) as KnowledgeKind[]).map((k) => <option key={k} value={k}>{KNOWLEDGE_KIND_LABEL[k]}</option>)}
        </select>
        <button className="button button--primary button--small" type="button" onClick={() => setDraft(empty())}>
          <Icon name="plus" size={17} /> Adicionar conteúdo
        </button>
      </div>
      <p className="usage-line">
        {items.length} {items.length === 1 ? "conteúdo" : "conteúdos"} · {limit === null ? "ilimitado no seu plano" : `limite do plano: ${limit}`}
      </p>
      {list.length === 0 ? (
        <EmptyState icon="document" title={items.length ? "Nada encontrado" : "Sua base está vazia"} text={items.length ? "Tente outra busca." : "Adicione perguntas frequentes, textos, documentos ou o site da empresa."} action={!items.length && <button className="button button--primary button--small" type="button" onClick={() => setDraft(empty())}><Icon name="plus" size={17} /> Adicionar conteúdo</button>} />
      ) : (
        <div className="resource-grid">
          {list.map((k) => (
            <article className={`panel resource-card ${k.active ? "" : "resource-card--off"}`} key={k.id}>
              <span className="resource-icon">
                <Icon name={KIND_ICON[k.kind]} />
              </span>
              <div>
                <h3>{k.title}</h3>
                <p>
                  {KNOWLEDGE_KIND_LABEL[k.kind]} · {k.kind === "faq" ? k.question : k.kind === "site" ? k.url : k.fileName ?? `${k.content.length} caracteres`} · {formatDateTime(k.updatedAt)}
                </p>
              </div>
              <span className={`resource-state ${k.status === "processing" ? "resource-state--busy" : ""}`}>
                <i />
                {k.status === "processing" ? "Lendo…" : k.active ? "Pronto" : "Desativado"}
              </span>
              <div className="resource-actions">
                <Toggle checked={k.active} onChange={() => store.toggleKnowledge(k.id)} label={`Usar "${k.title}"`} />
                <button type="button" onClick={() => edit(k)} aria-label={`Editar ${k.title}`}>
                  <Icon name="edit" size={16} />
                </button>
                <button type="button" onClick={() => remove(k)} aria-label={`Remover ${k.title}`}>
                  <Icon name="trash" size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {draft && <KnowledgeModal draft={draft} onClose={() => setDraft(null)} />}
    </>
  );
});

const KnowledgeModal = observer(function KnowledgeModal({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const store = usePlatform();
  const ws = store.current!;
  const [d, setD] = useState(draft);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  const readFile = async (file?: File) => {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["txt", "md", "csv"].includes(ext ?? "")) return void toast.error("Na demonstração, envie .txt, .md ou .csv. A leitura de PDF e Word chega com o servidor.");
    if (file.size > 500_000) return void toast.error("Arquivo grande demais para a demonstração (máx. 500 KB).");
    const text = await file.text();
    setD((x) => ({ ...x, fileName: file.name, content: text, title: x.title || file.name.replace(/\.[^.]+$/, "") }));
  };

  const save = () => {
    const err = store.saveKnowledge(ws.id, { id: d.id, kind: d.kind, title: d.title, content: d.content, question: d.kind === "faq" ? d.question : undefined, url: d.kind === "site" ? d.url.trim() : undefined, fileName: d.kind === "document" ? d.fileName || undefined : undefined });
    if (err) return void toast.error(err);
    toast.success(d.kind === "site" && !d.id ? "Site adicionado. Estamos lendo as páginas…" : "Conteúdo salvo. A IA já pode usar.");
    onClose();
  };

  return (
    <Modal
      title={d.id ? "Editar conteúdo" : "Adicionar conteúdo"}
      description="Tudo o que estiver aqui pode ser usado pela IA nas respostas."
      onClose={onClose}
      footer={
        <>
          <button className="button button--ghost button--small" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="button button--primary button--small" type="button" onClick={save}>
            Salvar
          </button>
        </>
      }
    >
      {!d.id && (
        <div className="kind-picker" role="radiogroup" aria-label="Tipo de conteúdo">
          {(Object.keys(KNOWLEDGE_KIND_LABEL) as KnowledgeKind[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={d.kind === k} className={d.kind === k ? "active" : ""} onClick={() => set("kind", k)}>
              <Icon name={KIND_ICON[k]} size={18} /> {KNOWLEDGE_KIND_LABEL[k]}
            </button>
          ))}
        </div>
      )}
      <div className="form-grid">
        <Field full label="Título" value={d.title} onChange={(e) => set("title", e.target.value)} placeholder={d.kind === "faq" ? "Ex.: Valores da avaliação" : "Ex.: Políticas de troca"} />
        {d.kind === "faq" && (
          <>
            <Field full label="Pergunta do cliente" value={d.question} onChange={(e) => set("question", e.target.value)} placeholder="Ex.: Quanto custa a avaliação?" hint="Inclua variações: “Qual o valor? Quanto custa?”" />
            <TextArea full label="Resposta" rows={4} value={d.content} onChange={(e) => set("content", e.target.value)} />
          </>
        )}
        {d.kind === "text" && <TextArea full label="Conteúdo" rows={8} value={d.content} onChange={(e) => set("content", e.target.value)} hint="Separe os assuntos em parágrafos: cada parágrafo pode virar uma resposta." />}
        {d.kind === "document" && (
          <>
            <label className="field field--full">
              <span>Arquivo</span>
              <input type="file" accept=".txt,.md,.csv" onChange={(e) => void readFile(e.target.files?.[0])} />
              <small className="field-hint">{d.fileName ? `Lido: ${d.fileName}` : "Demonstração: .txt, .md ou .csv (PDF e Word na versão com servidor)."}</small>
            </label>
            <TextArea full label="Texto extraído" rows={6} value={d.content} onChange={(e) => set("content", e.target.value)} />
          </>
        )}
        {d.kind === "site" && <Field full label="Endereço do site" type="url" placeholder="https://suaempresa.com.br" value={d.url} onChange={(e) => set("url", e.target.value)} hint="As páginas são lidas e atualizadas automaticamente." />}
      </div>
    </Modal>
  );
});
