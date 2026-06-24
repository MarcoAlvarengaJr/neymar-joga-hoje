# API de votos/comentários — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persistir votos e comentários do site "O Neymar joga hoje?" num PostgreSQL da Locaweb, via uma API PHP de arquivo único, rodando local com `php -S` e em prod pelo deploy FTP existente.

**Architecture:** Um único `api.php` na raiz: carrega credenciais (`config.php` em prod, `.env.local` em dev), conecta no Postgres via PDO, cria o schema de forma idempotente e responde 4 rotas JSON (`?r=votos|comentarios`, GET/POST). O front (`votacao.js`) troca os 4 métodos do `NeymarAPI` de `localStorage` por `fetch()` relativo (mesma origem → sem CORS). O workflow gera `dist/config.php` a partir de secrets antes do upload.

**Tech Stack:** PHP 8.5 (PDO + pgsql), PostgreSQL (Locaweb DBaaS), JavaScript vanilla, GitHub Actions (FTP deploy).

**Spec:** `docs/superpowers/specs/2026-06-24-api-votos-comentarios-design.md`

---

## File Structure

- **Create** `api.php` — API completa (config loader, conexão PDO, schema, 4 rotas).
- **Modify** `votacao.js` — trocar o miolo dos 4 métodos do `NeymarAPI` por `fetch()`.
- **Modify** `.github/workflows/deploy.yml` — copiar `api.php` e gerar `config.php` dos secrets.
- **Modify** `.gitignore` — ignorar `config.php` e `dist/`.
- **Modify** `README.md` — seção "Backend (votos/comentários)".
- **Usa** `.env.local` (já existe) — credenciais de dev.

**Pré-requisitos manuais (do usuário, fora do código):**
- Criar no GitHub os secrets `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`.
- Confirmar no painel Locaweb: nome do banco (`DB_NAME`), porta, `pdo_pgsql` habilitado, e que o DBaaS aceita conexão externa do IP de dev.

---

### Task 1: `api.php` — config, conexão PDO e rota `?r=ping`

Estabelece a parte mais arriscada primeiro: ler credenciais e conectar no Postgres. A rota `ping` faz `SELECT 1` e serve pra validar conectividade (local e, depois, prod).

**Files:**
- Create: `api.php`

- [ ] **Step 1: Criar `api.php` (versão 1: config + conexão + ping)**

```php
<?php
// api.php — API de votos/comentários (PHP + Postgres)
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

// ---- Carrega credenciais: config.php (prod) tem prioridade; senão .env.local (dev) ----
function carregarConfig(): array {
    $dir = __DIR__;
    if (is_file($dir . '/config.php')) {
        return require $dir . '/config.php';
    }
    $cfg = [];
    $envFile = $dir . '/.env.local';
    if (is_file($envFile)) {
        foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $linha) {
            $linha = trim($linha);
            if ($linha === '' || $linha[0] === '#') continue;
            $pos = strpos($linha, '=');
            if ($pos === false) continue;
            $cfg[trim(substr($linha, 0, $pos))] = trim(substr($linha, $pos + 1));
        }
    }
    return $cfg;
}

function responder($dados, int $status = 200): void {
    http_response_code($status);
    echo json_encode($dados, JSON_UNESCAPED_UNICODE);
    exit;
}

function erro(string $msg, int $status): void {
    responder(['erro' => $msg], $status);
}

function conectar(array $cfg): PDO {
    $dsn = sprintf(
        'pgsql:host=%s;port=%s;dbname=%s',
        $cfg['DB_HOST'] ?? 'localhost',
        $cfg['DB_PORT'] ?? '5432',
        $cfg['DB_NAME'] ?? ''
    );
    return new PDO($dsn, $cfg['DB_USER'] ?? '', $cfg['DB_PASS'] ?? '', [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
}

// ---- Roteamento ----
try {
    $cfg    = carregarConfig();
    $pdo    = conectar($cfg);
    $r      = $_GET['r'] ?? '';
    $metodo = $_SERVER['REQUEST_METHOD'];

    if ($r === 'ping') {
        $pdo->query('SELECT 1');
        responder(['ok' => true]);
    }

    erro('rota nao encontrada', 404);
} catch (Throwable $e) {
    erro('erro interno', 500);
}
```

- [ ] **Step 2: Subir o servidor e testar `ping` (espera-se sucesso ao conectar)**

Run:
```bash
php -S localhost:8000 >/tmp/njh-php.log 2>&1 &
SERVER_PID=$!; sleep 1
curl -s 'http://localhost:8000/api.php?r=ping'; echo
kill $SERVER_PID
```
Expected: `{"ok":true}`

> Se vier `{"erro":"erro interno"}`, a conexão falhou. Cheque `/tmp/njh-php.log`, as credenciais no `.env.local`, se o `pdo_pgsql` está instalado (`php -m | grep pdo_pgsql`) e se o DBaaS aceita seu IP. **Resolver isso antes de seguir** — todo o resto depende da conexão.

- [ ] **Step 3: Testar rota inexistente (404)**

Run:
```bash
php -S localhost:8000 >/tmp/njh-php.log 2>&1 &
SERVER_PID=$!; sleep 1
curl -s -o /dev/null -w "%{http_code}\n" 'http://localhost:8000/api.php?r=nada'
kill $SERVER_PID
```
Expected: `404`

- [ ] **Step 4: Commit**

```bash
git add api.php
git commit -m "$(printf 'feat: api.php com conexao Postgres e rota ping\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 2: `api.php` — schema + rotas de votos e comentários

Completa a API: cria as tabelas (idempotente) e implementa as 4 rotas do contrato.

**Files:**
- Modify: `api.php`

- [ ] **Step 1: Substituir o conteúdo de `api.php` pela versão final**

```php
<?php
// api.php — API de votos/comentários (PHP + Postgres)
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

// ---- Carrega credenciais: config.php (prod) tem prioridade; senão .env.local (dev) ----
function carregarConfig(): array {
    $dir = __DIR__;
    if (is_file($dir . '/config.php')) {
        return require $dir . '/config.php';
    }
    $cfg = [];
    $envFile = $dir . '/.env.local';
    if (is_file($envFile)) {
        foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $linha) {
            $linha = trim($linha);
            if ($linha === '' || $linha[0] === '#') continue;
            $pos = strpos($linha, '=');
            if ($pos === false) continue;
            $cfg[trim(substr($linha, 0, $pos))] = trim(substr($linha, $pos + 1));
        }
    }
    return $cfg;
}

function responder($dados, int $status = 200): void {
    http_response_code($status);
    echo json_encode($dados, JSON_UNESCAPED_UNICODE);
    exit;
}

function erro(string $msg, int $status): void {
    responder(['erro' => $msg], $status);
}

function conectar(array $cfg): PDO {
    $dsn = sprintf(
        'pgsql:host=%s;port=%s;dbname=%s',
        $cfg['DB_HOST'] ?? 'localhost',
        $cfg['DB_PORT'] ?? '5432',
        $cfg['DB_NAME'] ?? ''
    );
    return new PDO($dsn, $cfg['DB_USER'] ?? '', $cfg['DB_PASS'] ?? '', [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
}

function garantirSchema(PDO $pdo): void {
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS votos (
            escolha TEXT PRIMARY KEY,
            total   INTEGER NOT NULL DEFAULT 0
        )'
    );
    $pdo->exec(
        "INSERT INTO votos (escolha, total) VALUES ('sim', 0), ('nao', 0)
         ON CONFLICT (escolha) DO NOTHING"
    );
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS comentarios (
            id        BIGSERIAL PRIMARY KEY,
            nome      TEXT NOT NULL,
            texto     TEXT NOT NULL,
            criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
        )'
    );
}

function corpoJson(): array {
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) return [];
    $d = json_decode($raw, true);
    return is_array($d) ? $d : [];
}

function lerVotos(PDO $pdo): array {
    $out = ['sim' => 0, 'nao' => 0];
    foreach ($pdo->query('SELECT escolha, total FROM votos')->fetchAll() as $l) {
        $out[$l['escolha']] = (int) $l['total'];
    }
    return $out;
}

// ---- Roteamento ----
try {
    $cfg    = carregarConfig();
    $pdo    = conectar($cfg);
    $r      = $_GET['r'] ?? '';
    $metodo = $_SERVER['REQUEST_METHOD'];

    if ($r === 'ping') {
        $pdo->query('SELECT 1');
        responder(['ok' => true]);
    }

    garantirSchema($pdo);

    if ($r === 'votos' && $metodo === 'GET') {
        responder(lerVotos($pdo));
    }

    if ($r === 'votos' && $metodo === 'POST') {
        $escolha = corpoJson()['escolha'] ?? '';
        if ($escolha !== 'sim' && $escolha !== 'nao') {
            erro('escolha invalida', 400);
        }
        $st = $pdo->prepare('UPDATE votos SET total = total + 1 WHERE escolha = :e');
        $st->execute([':e' => $escolha]);
        responder(lerVotos($pdo));
    }

    if ($r === 'comentarios' && $metodo === 'GET') {
        $linhas = $pdo->query(
            'SELECT nome, texto, criado_em FROM comentarios ORDER BY criado_em DESC LIMIT 200'
        )->fetchAll();
        responder(array_map(function ($l) {
            return [
                'nome'      => $l['nome'],
                'texto'     => $l['texto'],
                'criado_em' => date('c', strtotime($l['criado_em'])),
            ];
        }, $linhas));
    }

    if ($r === 'comentarios' && $metodo === 'POST') {
        $b     = corpoJson();
        $nome  = trim((string) ($b['nome'] ?? ''));
        $texto = trim((string) ($b['texto'] ?? ''));
        if ($nome === '' || $texto === '') {
            erro('nome e texto obrigatorios', 400);
        }
        if (mb_strlen($nome) > 60 || mb_strlen($texto) > 500) {
            erro('tamanho excedido', 400);
        }
        $st = $pdo->prepare(
            'INSERT INTO comentarios (nome, texto) VALUES (:n, :t) RETURNING criado_em'
        );
        $st->execute([':n' => $nome, ':t' => $texto]);
        $criado = $st->fetchColumn();
        responder([
            'nome'      => $nome,
            'texto'     => $texto,
            'criado_em' => date('c', strtotime($criado)),
        ]);
    }

    erro('rota nao encontrada', 404);
} catch (Throwable $e) {
    erro('erro interno', 500);
}
```

- [ ] **Step 2: Testar GET /votos (tabela recém-criada → zeros)**

Run:
```bash
php -S localhost:8000 >/tmp/njh-php.log 2>&1 &
SERVER_PID=$!; sleep 1
curl -s 'http://localhost:8000/api.php?r=votos'; echo
kill $SERVER_PID
```
Expected: `{"sim":0,"nao":0}`

- [ ] **Step 3: Testar POST /votos válido e inválido**

Run:
```bash
php -S localhost:8000 >/tmp/njh-php.log 2>&1 &
SERVER_PID=$!; sleep 1
curl -s -X POST 'http://localhost:8000/api.php?r=votos' \
  -H 'Content-Type: application/json' -d '{"escolha":"sim"}'; echo
curl -s -o /dev/null -w "%{http_code}\n" -X POST 'http://localhost:8000/api.php?r=votos' \
  -H 'Content-Type: application/json' -d '{"escolha":"talvez"}'
kill $SERVER_PID
```
Expected: primeira linha `{"sim":1,"nao":0}`; segunda linha `400`

- [ ] **Step 4: Testar POST /comentarios e GET /comentarios**

Run:
```bash
php -S localhost:8000 >/tmp/njh-php.log 2>&1 &
SERVER_PID=$!; sleep 1
curl -s -X POST 'http://localhost:8000/api.php?r=comentarios' \
  -H 'Content-Type: application/json' -d '{"nome":"Teste","texto":"primeiro!"}'; echo
curl -s 'http://localhost:8000/api.php?r=comentarios'; echo
curl -s -o /dev/null -w "%{http_code}\n" -X POST 'http://localhost:8000/api.php?r=comentarios' \
  -H 'Content-Type: application/json' -d '{"nome":"","texto":""}'
kill $SERVER_PID
```
Expected: POST retorna `{"nome":"Teste","texto":"primeiro!","criado_em":"...ISO..."}`; GET retorna um array contendo esse comentário; o POST vazio retorna `400`.

- [ ] **Step 5: Commit**

```bash
git add api.php
git commit -m "$(printf 'feat: rotas de votos e comentarios na api.php\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 3: `votacao.js` — trocar `localStorage` por `fetch()`

Substitui só o miolo dos 4 métodos do `NeymarAPI`. O resto do arquivo (render, anti-duplo-voto, filtro de palavrão, contador) não muda. `getMyVote()` continua usando `localStorage` (1 voto por navegador).

**Files:**
- Modify: `votacao.js:36-66`

- [ ] **Step 1: Substituir o objeto `NeymarAPI`**

Trocar o bloco atual (de `var NeymarAPI = {` até o `};` que o fecha — linhas ~36-66) por:

```javascript
  var API = "api.php";

  function pegarJson(resp) { return resp.json(); }

  var NeymarAPI = {
    getVotes: function () {
      return fetch(API + "?r=votos").then(pegarJson);
    },
    vote: function (escolha) {
      return fetch(API + "?r=votos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escolha: escolha })
      }).then(pegarJson).then(function (v) {
        lsSet(LS_VOTED, escolha);   // registra o voto deste navegador
        return v;
      });
    },
    getMyVote: function () {
      return lsGet(LS_VOTED, null);
    },
    getComments: function () {
      return fetch(API + "?r=comentarios").then(pegarJson);
    },
    addComment: function (nome, texto) {
      return fetch(API + "?r=comentarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nome, texto: texto })
      }).then(pegarJson);
    }
  };
```

> `lsGet`/`lsSet` e a constante `LS_VOTED` continuam existindo no arquivo (declarados acima). `LS_VOTES` e `LS_COMMENTS` deixam de ser usados — pode deixá-los ou remover; não afetam o comportamento.

- [ ] **Step 2: Verificar no navegador (servidor servindo site + API juntos)**

Run:
```bash
php -S localhost:8000 >/tmp/njh-php.log 2>&1 &
echo "Abra http://localhost:8000 — votar, comentar, dar F5. PID=$!"
```
Expected (manual):
- Votar atualiza as barras; recarregar mantém o total (vindo do banco) e o botão fica travado (já votou).
- Comentar adiciona à lista no topo; recarregar mantém o comentário.
- Abrir em aba anônima mostra os mesmos votos/comentários (prova que veio do servidor, não do `localStorage`).

Depois: `kill <PID>`.

- [ ] **Step 3: Commit**

```bash
git add votacao.js
git commit -m "$(printf 'feat: votacao.js consome a API real via fetch\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 4: Deploy — publicar `api.php` e gerar `config.php` dos secrets

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Modify: `.gitignore`

- [ ] **Step 1: Adicionar `api.php` à cópia e criar o passo que gera `config.php`**

No `.github/workflows/deploy.yml`, trocar o step "Monta a pasta dist" e inserir o novo step logo depois:

```yaml
      - name: Monta a pasta dist (so os arquivos do site)
        run: |
          mkdir -p dist
          cp index.html styles.css script.js votacao.js robots.txt sitemap.xml api.php dist/

      - name: Gera config.php a partir dos secrets
        run: |
          php -r '$c = [
              "DB_HOST" => getenv("DB_HOST"),
              "DB_PORT" => getenv("DB_PORT"),
              "DB_NAME" => getenv("DB_NAME"),
              "DB_USER" => getenv("DB_USER"),
              "DB_PASS" => getenv("DB_PASS"),
          ]; file_put_contents("dist/config.php", "<?php return " . var_export($c, true) . ";\n");'
        env:
          DB_HOST: ${{ secrets.DB_HOST }}
          DB_PORT: ${{ secrets.DB_PORT }}
          DB_NAME: ${{ secrets.DB_NAME }}
          DB_USER: ${{ secrets.DB_USER }}
          DB_PASS: ${{ secrets.DB_PASS }}
```

> `php` já vem instalado no runner `ubuntu-latest`. Usar `var_export` garante que valores com caracteres especiais (ex: `!` na senha) virem um literal PHP válido — sem dor de cabeça com aspas. O `config.php` é gerado só dentro de `dist/`, e como é PHP, abrir a URL dele não vaza credencial.

- [ ] **Step 2: Ignorar `config.php` e `dist/` no Git**

Acrescentar ao final do `.gitignore`:

```gitignore

# Backend / build
config.php
dist/
```

- [ ] **Step 3: Validar a sintaxe do YAML**

Run:
```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml')); print('YAML ok')"
```
Expected: `YAML ok`

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml .gitignore
git commit -m "$(printf 'feat: deploy publica api.php e gera config.php dos secrets\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 5: Verificação final, limpeza dos dados de teste e docs

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Rodada de verificação completa (local)**

Run:
```bash
php -S localhost:8000 >/tmp/njh-php.log 2>&1 &
SERVER_PID=$!; sleep 1
echo "ping:";        curl -s 'http://localhost:8000/api.php?r=ping'; echo
echo "votos:";       curl -s 'http://localhost:8000/api.php?r=votos'; echo
echo "comentarios:"; curl -s 'http://localhost:8000/api.php?r=comentarios'; echo
kill $SERVER_PID
```
Expected: `ping` → `{"ok":true}`; `votos` → objeto `{"sim":N,"nao":M}`; `comentarios` → array.

- [ ] **Step 2: Limpar os dados gerados nos testes (banco volta a zero)**

Run (precisa do `psql`; se não tiver, rodar o mesmo SQL pelo phpPgAdmin da Locaweb):
```bash
psql "host=$(grep ^DB_HOST .env.local|cut -d= -f2) \
      port=$(grep ^DB_PORT .env.local|cut -d= -f2) \
      dbname=$(grep ^DB_NAME .env.local|cut -d= -f2) \
      user=$(grep ^DB_USER .env.local|cut -d= -f2) \
      password=$(grep ^DB_PASS .env.local|cut -d= -f2)" \
  -c "UPDATE votos SET total = 0; DELETE FROM comentarios;"
```
Expected: `UPDATE 2` e `DELETE N`. (Pula este passo se quiser manter os dados de teste.)

- [ ] **Step 3: Documentar o backend no `README.md`**

Acrescentar ao final do `README.md`:

```markdown
## Backend (votos e comentários)

A votação e os comentários são persistidos por uma API PHP de arquivo único (`api.php`)
sobre PostgreSQL.

**Rodar local:**

​```bash
php -S localhost:8000
​```

Abra http://localhost:8000. A API lê as credenciais de `.env.local` (não versionado).

**Rotas:** `GET/POST api.php?r=votos` e `GET/POST api.php?r=comentarios`.

**Produção:** o deploy (GitHub Actions) publica `api.php` e gera `config.php` a partir dos
secrets `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`. As tabelas são criadas
automaticamente na primeira chamada.
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "$(printf 'docs: documenta backend de votos/comentarios no README\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

- [ ] **Step 5: (Manual) Antes do deploy de prod**

- [ ] Criar os 5 secrets no GitHub (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`) em
  `Settings → Secrets and variables → Actions`.
- [ ] Confirmar `DB_NAME` e porta reais no painel Locaweb.
- [ ] Após merge na `main` (dispara o deploy), abrir `https://neymarjogahoje.com.br/api.php?r=ping`
  e conferir `{"ok":true}` (valida `pdo_pgsql` + conexão interna em prod).

---

## Notas de escopo (decisões do design, não são lacunas)

- Sem rate limit / trava por IP / moderação (nível "Mínimo" escolhido no brainstorm).
- Sem suíte de testes automatizada (PHPUnit) — a verificação é por `curl` + navegador, para
  manter o projeto simples e sem dependências de build.
- Local e prod usam o **mesmo** Postgres remoto (decisão do brainstorm).
