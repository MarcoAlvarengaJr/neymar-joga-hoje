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

Os espaços de anúncio já estão no HTML como placeholders comentados. Para ativar:

1. No `<head>` do `index.html`, descomente o script do AdSense e troque `ca-pub-XXXX` pelo seu ID.
2. Descomente as tags `<ins class="adsbygoogle">` dentro de cada `.ad__slot`.
3. Descomente a chamada `adsbygoogle.push({})` no final do `script.js`.

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
