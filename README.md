# O Neymar joga hoje? ⚽

Site viral de página única que responde à eterna pergunta: **o Neymar joga hoje?**

A resposta, no melhor estilo zoeira, é um **NÃO** gigante no meio da tela.

## Como funciona

- **Desktop e mobile** — a resposta aparece direto na tela. Anúncios nas laterais (desktop) e numa faixa embaixo (mobile).
- Botão de **compartilhar** nativo e meta tags de Open Graph pro preview em redes sociais.

## Rodando localmente

É só abrir o `index.html` no navegador. Sem build, sem dependências.

Se preferir servir via HTTP local:

```bash
npx serve .
```

## Anúncios (Google AdSense)

O loader do AdSense já está no `<head>` do `index.html` (client `ca-pub-2576699165737130`).

- **Auto Ads** (mais simples): funciona só com o loader — basta ativar Auto Ads no painel do AdSense.
- **Blocos fixos** (`.ad__slot` no HTML): crie as unidades no painel, pegue os `data-ad-slot` reais e então:
  1. descomente as tags `<ins class="adsbygoogle">` dentro de cada `.ad__slot` (trocando `data-ad-client`/`data-ad-slot` pelos valores reais);
  2. descomente a chamada `adsbygoogle.push({})` no final do `script.js`.

## Estrutura

```
index.html   estrutura da página
styles.css   estilos e responsividade
script.js    busca a resposta, compartilhamento e lógica
```

## Backend (votos e comentários)

A votação e os comentários são persistidos por uma API PHP de arquivo único (`api.php`)
sobre PostgreSQL.

**Rodar local:**

```bash
php -S localhost:8000
```

Abra http://localhost:8000. A API lê as credenciais de `.env.local` (não versionado).

**Rotas:** `GET/POST api.php?r=votos` e `GET/POST api.php?r=comentarios`.

**Produção:** o deploy (GitHub Actions) publica `api.php` e gera `config.php` a partir dos
secrets `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`. As tabelas são criadas
automaticamente na primeira chamada.

Feito na zoeira. 🇧🇷
