# O Neymar joga hoje? ⚽

Site viral de página única que responde à eterna pergunta: **o Neymar joga hoje?**

A resposta, no melhor estilo zoeira, é um **NÃO** gigante no meio da tela.

## Como funciona

- **Desktop** — a resposta aparece direto, com espaços de anúncio nas laterais.
- **Mobile** — o site pede pra você **chacoalhar o celular** pra revelar o resultado (usa a API de movimento do aparelho). Anúncio numa faixa na parte de baixo.
- Botão de **compartilhar** nativo e meta tags de Open Graph pro preview em redes sociais.

## Rodando localmente

É só abrir o `index.html` no navegador. Sem build, sem dependências.

Para testar a chacoalhada no celular, sirva os arquivos via HTTP (alguns sensores exigem contexto seguro):

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
script.js    detecção de chacoalhada, compartilhamento e lógica
```

Feito na zoeira. 🇧🇷
