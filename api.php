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

// Converte um TIMESTAMPTZ do Postgres (com microssegundos) em ISO-8601.
// DateTimeImmutable é robusto onde strtotime() falha com a fração de segundos.
function isoData(string $ts): string {
    return (new DateTimeImmutable($ts))->format('c');
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
                'criado_em' => isoData($l['criado_em']),
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
            'criado_em' => isoData($criado),
        ]);
    }

    erro('rota nao encontrada', 404);
} catch (Throwable $e) {
    erro('erro interno', 500);
}
