# Lightweight PowerShell Web Server for Hospital Bed Management System
param(
    [int]$Port = 8080
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "🏥 Hospital Bed Availability & Resource Coordination Server" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Serving directory: $scriptDir" -ForegroundColor Gray
Write-Host "Local URL: http://localhost:$Port/" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to terminate server." -ForegroundColor Gray
Write-Host ""

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()

# Attempt to launch default browser
try {
    Start-Process "http://localhost:$Port/"
} catch {
    # Ignore if headless
}

try {
    while ($listener.Server.IsBound) {
        $client = $listener.AcceptTcpClient()
        $stream = $client.GetStream()
        $reader = [System.IO.StreamReader]::new($stream)
        $writer = [System.IO.StreamWriter]::new($stream)

        $requestLine = $reader.ReadLine()
        if (-not $requestLine) {
            $client.Close()
            continue
        }

        # Parse GET /path HTTP/1.1
        $parts = $requestLine.Split(' ')
        $urlPath = if ($parts.Length -gt 1) { $parts[1] } else { "/" }
        if ($urlPath -eq "/" -or $urlPath -eq "") {
            $urlPath = "/index.html"
        }

        # Clean query string
        if ($urlPath.Contains("?")) {
            $urlPath = $urlPath.Substring(0, $urlPath.IndexOf("?"))
        }

        $localFilePath = Join-Path $scriptDir $urlPath.TrimStart('/')
        
        if (Test-Path $localFilePath -PathType Leaf) {
            $extension = [System.IO.Path]::GetExtension($localFilePath).ToLower()
            $contentType = switch ($extension) {
                ".html" { "text/html; charset=utf-8" }
                ".htm"  { "text/html; charset=utf-8" }
                ".css"  { "text/css; charset=utf-8" }
                ".js"   { "application/javascript; charset=utf-8" }
                ".json" { "application/json; charset=utf-8" }
                ".svg"  { "image/svg+xml" }
                ".png"  { "image/png" }
                default { "application/octet-stream" }
            }

            $bytes = [System.IO.File]::ReadAllBytes($localFilePath)
            
            $header = "HTTP/1.1 200 OK`r`n" +
                      "Content-Type: $contentType`r`n" +
                      "Content-Length: $($bytes.Length)`r`n" +
                      "Connection: close`r`n`r`n"
            
            $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
            $stream.Write($headerBytes, 0, $headerBytes.Length)
            $stream.Write($bytes, 0, $bytes.Length)
            $stream.Flush()
        } else {
            $notFound = "HTTP/1.1 404 Not Found`r`nContent-Length: 9`r`nConnection: close`r`n`r`nNot Found"
            $notFoundBytes = [System.Text.Encoding]::ASCII.GetBytes($notFound)
            $stream.Write($notFoundBytes, 0, $notFoundBytes.Length)
            $stream.Flush()
        }

        $client.Close()
    }
} finally {
    $listener.Stop()
    Write-Host "Server stopped." -ForegroundColor Yellow
}
