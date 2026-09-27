# Rasterize Word EMF (vector) images to HD PNG. sharp/Pillow cannot read EMF;
# System.Drawing renders the vector crisply at a chosen resolution.
# Usage: powershell -File scripts/ingest/emf2png.ps1 -SrcDir <media> -OutDir <converted> [-Longest 1000]
param(
  [Parameter(Mandatory=$true)][string]$SrcDir,
  [Parameter(Mandatory=$true)][string]$OutDir,
  [int]$Longest = 1000
)
Add-Type -AssemblyName System.Drawing
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }
$emfs = Get-ChildItem -Path $SrcDir -Filter *.emf
$ok = 0; $fail = 0
foreach ($f in $emfs) {
  $out = Join-Path $OutDir ($f.BaseName + '.png')
  try {
    $mf = New-Object System.Drawing.Imaging.Metafile($f.FullName)
    $w = [double]$mf.Width; $h = [double]$mf.Height
    if ($w -le 0 -or $h -le 0) { throw "bad metafile bounds $w x $h" }
    $scale = $Longest / [Math]::Max($w, $h)
    $nw = [int][Math]::Round($w * $scale); $nh = [int][Math]::Round($h * $scale)
    if ($nw -lt 1) { $nw = 1 }; if ($nh -lt 1) { $nh = 1 }
    $bmp = New-Object System.Drawing.Bitmap($nw, $nh)
    $bmp.SetResolution(300, 300)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::White)
    $g.DrawImage($mf, (New-Object System.Drawing.Rectangle(0, 0, $nw, $nh)))
    $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose(); $mf.Dispose()
    $ok++
  } catch {
    Write-Host ("FAIL {0}: {1}" -f $f.Name, $_.Exception.Message)
    $fail++
  }
}
Write-Host ("EMF->PNG: converted {0}, failed {1}, into {2}" -f $ok, $fail, $OutDir)
