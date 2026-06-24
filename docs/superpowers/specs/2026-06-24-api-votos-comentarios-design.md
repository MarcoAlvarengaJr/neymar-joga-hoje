# Design — API de votos/comentários (PHP + Postgres)

**Data:** 2026-06-24
**Status:** Aprovado
**Contexto:** Site estático "O Neymar joga hoje?" (deploy FTP → Locaweb). A votação e
os comentários hoje usam `localStorage` (`votacao.js`, camada `NeymarAPI`). Queremos
persistir server-side num Postgres da Locaweb. Requisito do usuário: **rápido, simples,
e que funcione local**.

## Decisões (do brainstorm)

- **Stack:** PHP 8.5 (Locaweb / Rocky Linux 8) + PDO + PostgreSQL. Um único `api.php`.
- **Escopo:** Mínimo. Votos = contadores agregados (sim/não). Comentários = lista
  (nome + texto + data). 1 voto por navegador (já tratado no front via `localStorage`).
  Filtro de palavrão já existe no front. Sem login, sem moderação, sem rate limit.
- **Banco local:** o MESMO Postgres remoto da Locaweb é usado em dev e em prod.

## 1. Arquitetura

Arquivo único `api.php` na raiz do site:
- conecta no Postgres via PDO (prepared statements, `ERRMODE_EXCEPTION`);
- garante o schema na 1ª execução (`CREATE TABLE IF NOT EXISTS` — idempotente, sem
  passo manual de setup);
- responde 4 rotas em JSON.

Roda local com `php -S localhost:8000` na raiz do projeto (serve o site **e** a API na
mesma origem). Em prod sobe pelo mesmo deploy FTP.

## 2. Roteamento (sem .htaccess)

Por query param `r` + método HTTP. Caminho relativo → **mesma origem → sem CORS**.

| Front chama | Servidor | Resposta |
|---|---|---|
| `GET api.php?r=votos` | lê contadores | `{ "sim": number, "nao": number }` |
| `POST api.php?r=votos` body `{"escolha"}` | `escolha ∈ {sim,nao}`, incrementa | `{ "sim": number, "nao": number }` |
| `GET api.php?r=comentarios` | lista, mais novos primeiro, limite 200 | `[ { "nome", "texto", "criado_em" } ]` |
| `POST api.php?r=comentarios` body `{"nome","texto"}` | insere | `{ "nome", "texto", "criado_em" }` |

`criado_em` em ISO-8601 (o `quando()` do front faz `new Date(iso)`).

Rejeitado: rota `/votos` "limpa" (exigiria rewrite no Apache — ponto de falha extra).

## 3. Schema (PostgreSQL)

```sql
CREATE TABLE IF NOT EXISTS votos (
  escolha TEXT PRIMARY KEY,           -- 'sim' | 'nao'
  total   INTEGER NOT NULL DEFAULT 0
);
INSERT INTO votos (escolha,total) VALUES ('sim',0),('nao',0)
  ON CONFLICT (escolha) DO NOTHING;

CREATE TABLE IF NOT EXISTS comentarios (
  id        BIGSERIAL PRIMARY KEY,
  nome      TEXT NOT NULL,
  texto     TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- Voto: `UPDATE votos SET total = total + 1 WHERE escolha = :e`, depois SELECT dos dois.
- `GET /votos`: `SELECT escolha,total FROM votos` → monta `{sim,nao}`.
- `GET /comentarios`: `SELECT nome,texto,criado_em FROM comentarios ORDER BY criado_em DESC LIMIT 200`.

## 4. Configuração de credenciais (sem vazar segredo)

`api.php` carrega credenciais nesta ordem:
1. **`config.php`** (se existir) — produção, gerado pelo GitHub Actions a partir de
   secrets. É PHP (`<?php return [...]`), então abrir a URL não vaza nada.
2. **`.env.local`** (fallback, parser KEY=VALUE) — dev local (já criado).

Chaves: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`.

- `.env.local` **nunca** é publicado (segue no `.gitignore` e fora da lista do deploy).
- Em prod, credenciais vêm de **novos secrets** do GitHub:
  `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`. O workflow gera `dist/config.php`
  a partir deles antes do upload FTP. (Atenção a aspas simples nos valores ao gerar;
  a senha atual `NeyJogaSim123!` não tem.)

## 5. Front (`votacao.js`)

Trocar só o miolo dos 4 métodos do `NeymarAPI` por `fetch("api.php?r=...")` (todos já
retornam Promise). Resto do código (render, anti-duplo-voto via `localStorage`, filtro
de palavrão, contador 0/500) **não muda**. `getMyVote()` continua local.

## 6. Deploy (`.github/workflows/deploy.yml`)

- adicionar `api.php` à cópia para `dist/`;
- novo passo que escreve `dist/config.php` a partir dos secrets de banco.

## 7. Validação / erros / segurança (nível Mínimo)

- `escolha` só `sim`/`nao` (senão 400). `nome` ≤ 60, `texto` ≤ 500, ambos obrigatórios
  (senão 400).
- SQL injection: PDO preparado. XSS: front usa `textContent`.
- Erros sempre JSON (`{"erro":"..."}`) com status HTTP correto; PDO em modo exceção → 500.
- Fora de escopo (conhecido): rate limit / trava por IP / moderação.

## 8. Testes

- Local: `php -S localhost:8000`, votar/comentar, dar F5 → persiste (vindo do Postgres).
- Smoke test `curl` nos 4 endpoints.
- Conferir no banco com `SELECT`.

## 9. A confirmar (Locaweb)

- `DB_NAME` (no `.env.local` está `neymarjogahoje` — confirmar no painel).
- Porta (assumido `5432`).
- DBaaS precisa aceitar conexão externa do IP do dev (em prod conecta interno).
- Extensão `pdo_pgsql` habilitada no PHP 8.5.

## Arquivos

- **Novo:** `api.php`, `docs/superpowers/specs/2026-06-24-api-votos-comentarios-design.md`
- **Editar:** `votacao.js`, `.github/workflows/deploy.yml`
- **Secrets novos:** `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`
