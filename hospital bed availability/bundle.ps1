$html = Get-Content -Path "c:\hospital bed availability\index.html" -Raw
$css  = Get-Content -Path "c:\hospital bed availability\styles.css" -Raw
$js   = Get-Content -Path "c:\hospital bed availability\app.js" -Raw

$combined = $html.Replace('<link rel="stylesheet" href="styles.css">', "<style>`n$css`n</style>")
$combined = $combined.Replace('<script src="app.js"></script>', "<script>`n$js`n</script>")

$destPath = "C:\Users\nishu\.gemini\antigravity\brain\663dfc16-d921-43d6-a181-6bac6b5b9284\hospital_dashboard.html"
[System.IO.File]::WriteAllText($destPath, $combined, [System.Text.Encoding]::UTF8)
Write-Host "Updated artifact bundle at $destPath" -ForegroundColor Green
