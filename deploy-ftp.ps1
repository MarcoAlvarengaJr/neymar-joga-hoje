# =============================================================
#  Deploy via FTP/FTPS - "O Neymar joga hoje?"
#  Envia os arquivos do site para o servidor Apache.
#  As credenciais sao pedidas na hora (nao ficam salvas).
#
#  Como usar:
#    1. Abra o PowerShell nesta pasta.
#    2. Rode:  .\deploy-ftp.ps1
#    3. Informe host, usuario, senha e a pasta de destino.
# =============================================================

$ErrorActionPreference = "Stop"

# ---- Arquivos que sobem (ignora git, scripts e temp) ----
$Files = @("index.html", "styles.css", "script.js", "README.md")

# ---- Coleta de credenciais ----
$ftpHost = Read-Host "Host FTP (ex: ftp.seudominio.com.br)"
$useTls  = (Read-Host "Usar FTPS/TLS? (s/N)").Trim().ToLower() -eq "s"
$user    = Read-Host "Usuario FTP"
$secure  = Read-Host "Senha FTP" -AsSecureString
$pass    = [System.Net.NetworkCredential]::new("", $secure).Password

# Pasta de destino no servidor. Em hospedagem com Apache geralmente
# eh "public_html" ou "/public_html" ou "htdocs".
$remoteDir = Read-Host "Pasta de destino (Enter = public_html)"
if ([string]::IsNullOrWhiteSpace($remoteDir)) { $remoteDir = "public_html" }

# Normaliza host -> URI base
$ftpHost = $ftpHost -replace '^ftp://', '' -replace '/+$', ''
$remoteDir = $remoteDir.Trim('/')
$baseUri = "ftp://$ftpHost/$remoteDir/"

Write-Host ""
Write-Host "Enviando para: $baseUri" -ForegroundColor Cyan
Write-Host ""

function Send-File($localPath, $remoteName) {
    $uri = "$baseUri$remoteName"
    $req = [System.Net.FtpWebRequest]::Create($uri)
    $req.Method      = [System.Net.WebRequestMethods+Ftp]::UploadFile
    $req.Credentials = [System.Net.NetworkCredential]::new($user, $pass)
    $req.UseBinary   = $true
    $req.UsePassive  = $true
    $req.KeepAlive   = $false
    $req.EnableSsl   = $useTls

    $bytes = [System.IO.File]::ReadAllBytes($localPath)
    $req.ContentLength = $bytes.Length
    $stream = $req.GetRequestStream()
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Close()

    $resp = $req.GetResponse()
    Write-Host ("  OK  {0,-14} ({1} bytes)" -f $remoteName, $bytes.Length) -ForegroundColor Green
    $resp.Close()
}

$ok = 0; $fail = 0
foreach ($f in $Files) {
    if (-not (Test-Path $f)) { Write-Host "  pulado (nao existe): $f" -ForegroundColor DarkGray; continue }
    try {
        Send-File (Resolve-Path $f).Path $f
        $ok++
    } catch {
        Write-Host ("  ERRO {0}: {1}" -f $f, $_.Exception.Message) -ForegroundColor Red
        $fail++
    }
}

Write-Host ""
Write-Host "Concluido. Enviados: $ok | Falhas: $fail" -ForegroundColor Cyan
if ($fail -eq 0) {
    Write-Host "Acesse seu dominio no navegador para conferir o site." -ForegroundColor Green
} else {
    Write-Host "Verifique host/usuario/senha e a pasta de destino e tente de novo." -ForegroundColor Yellow
}
