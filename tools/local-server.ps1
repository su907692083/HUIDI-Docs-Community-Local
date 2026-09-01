param(
  [int]$Port = 8765,
  [string]$Root = ""
)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($Root)) {
  $Root = Join-Path (Split-Path -Parent $PSScriptRoot) 'public'
}
$Root = [System.IO.Path]::GetFullPath($Root)
if (-not (Test-Path -LiteralPath $Root -PathType Container)) {
  throw "Public directory not found: $Root"
}

function Get-MimeType([string]$Path) {
  switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    '.html' { 'text/html; charset=utf-8' }
    '.htm'  { 'text/html; charset=utf-8' }
    '.js'   { 'text/javascript; charset=utf-8' }
    '.css'  { 'text/css; charset=utf-8' }
    '.json' { 'application/json; charset=utf-8' }
    '.webmanifest' { 'application/manifest+json; charset=utf-8' }
    '.png'  { 'image/png' }
    '.jpg'  { 'image/jpeg' }
    '.jpeg' { 'image/jpeg' }
    '.webp' { 'image/webp' }
    '.gif'  { 'image/gif' }
    '.svg'  { 'image/svg+xml' }
    '.ico'  { 'image/x-icon' }
    '.pdf'  { 'application/pdf' }
    '.xlsx' { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    '.csv'  { 'text/csv; charset=utf-8' }
    '.txt'  { 'text/plain; charset=utf-8' }
    '.woff' { 'font/woff' }
    '.woff2' { 'font/woff2' }
    default { 'application/octet-stream' }
  }
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()
$url = "http://127.0.0.1:$Port/"
Write-Host ""
Write-Host "HUIDI Docs Community Local" -ForegroundColor Cyan
Write-Host "Local address: $url" -ForegroundColor Green
Write-Host "Data stays in this browser profile. Close this window to stop the local server." -ForegroundColor DarkGray
Write-Host ""

try { Start-Process $url | Out-Null } catch { }

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $client.ReceiveTimeout = 5000
      $stream = $client.GetStream()
      $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 4096, $true)
      $requestLine = $reader.ReadLine()
      if ([string]::IsNullOrWhiteSpace($requestLine)) { $client.Close(); continue }
      while ($true) {
        $line = $reader.ReadLine()
        if ([string]::IsNullOrEmpty($line)) { break }
      }
      $parts = $requestLine.Split(' ')
      $method = if ($parts.Length -gt 0) { $parts[0] } else { 'GET' }
      $target = if ($parts.Length -gt 1) { $parts[1] } else { '/' }
      $uri = [System.Uri]::new("http://127.0.0.1$target")
      $path = [System.Uri]::UnescapeDataString($uri.AbsolutePath).Replace('/', [System.IO.Path]::DirectorySeparatorChar)
      if ($path -eq [System.IO.Path]::DirectorySeparatorChar.ToString()) { $path = [System.IO.Path]::DirectorySeparatorChar + 'index.html' }
      $candidate = [System.IO.Path]::GetFullPath((Join-Path $Root $path.TrimStart([System.IO.Path]::DirectorySeparatorChar)))
      if (-not $candidate.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)) {
        $status = '403 Forbidden'; $body = [System.Text.Encoding]::UTF8.GetBytes('Forbidden'); $mime='text/plain; charset=utf-8'
      } elseif (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
        $status = '404 Not Found'; $body = [System.Text.Encoding]::UTF8.GetBytes('Not Found'); $mime='text/plain; charset=utf-8'
      } else {
        $status = '200 OK'; $body = [System.IO.File]::ReadAllBytes($candidate); $mime=Get-MimeType $candidate
      }
      $head = "HTTP/1.1 $status`r`nContent-Type: $mime`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`nX-Content-Type-Options: nosniff`r`n`r`n"
      $headBytes = [System.Text.Encoding]::ASCII.GetBytes($head)
      $stream.Write($headBytes,0,$headBytes.Length)
      if ($method -ne 'HEAD') { $stream.Write($body,0,$body.Length) }
      $stream.Flush()
    } catch {
      # Ignore malformed local browser requests and keep serving.
    } finally {
      try { $client.Close() } catch { }
    }
  }
} finally {
  $listener.Stop()
}
