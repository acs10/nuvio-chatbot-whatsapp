import Link from "next/link";

export default function NotFound() {
  return (
    <div className="success-page">
      <div className="success-card">
        <span className="eyebrow eyebrow--plain">Erro 404</span>
        <h1>Página não encontrada</h1>
        <p>O endereço pode ter mudado ou não existe mais.</p>
        <Link className="button button--primary button--large" href="/">
          Voltar para o início
        </Link>
      </div>
    </div>
  );
}
