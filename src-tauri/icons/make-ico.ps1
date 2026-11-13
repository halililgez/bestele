# Windows için uyumlu icon.ico üretir: küçük boyutlar BMP (32 bit + alfa), 256 px PNG.
# `npx tauri icon` her boyutu PNG olarak gömüyor; Gezgin bazı görünümlerde bunları gösteremiyor.
# Kullanım (src-tauri/icons içinde): powershell -ExecutionPolicy Bypass -File make-ico.ps1
param([string]$Source = "$PSScriptRoot\icon.png", [string]$Out = "$PSScriptRoot\icon.ico")
Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Image]::FromFile($Source)
function Resize([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.DrawImage($src, 0, 0, $size, $size)
  $g.Dispose()
  return $bmp
}

function BmpEntry([int]$size) {
  $bmp = Resize $size
  $ms = New-Object System.IO.MemoryStream
  $w = New-Object System.IO.BinaryWriter($ms)
  # BITMAPINFOHEADER (yükseklik iki katı: renk + AND maskesi)
  $w.Write([int]40); $w.Write([int]$size); $w.Write([int]($size * 2))
  $w.Write([int16]1); $w.Write([int16]32); $w.Write([int]0)
  $maskStride = [int]([Math]::Ceiling($size / 32.0) * 4)
  $w.Write([int]($size * $size * 4 + $maskStride * $size))
  $w.Write([int]0); $w.Write([int]0); $w.Write([int]0); $w.Write([int]0)
  # Pikseller: aşağıdan yukarı, BGRA
  for ($y = $size - 1; $y -ge 0; $y--) {
    for ($x = 0; $x -lt $size; $x++) {
      $c = $bmp.GetPixel($x, $y)
      $w.Write([byte]$c.B); $w.Write([byte]$c.G); $w.Write([byte]$c.R); $w.Write([byte]$c.A)
    }
  }
  # AND maskesi: tamamen saydam pikseller 1
  for ($y = $size - 1; $y -ge 0; $y--) {
    $row = New-Object byte[] $maskStride
    for ($x = 0; $x -lt $size; $x++) {
      if ($bmp.GetPixel($x, $y).A -eq 0) { $row[[int][Math]::Floor($x / 8)] = $row[[int][Math]::Floor($x / 8)] -bor (0x80 -shr ($x % 8)) }
    }
    $w.Write($row)
  }
  $w.Flush(); $bmp.Dispose()
  return ,$ms.ToArray()
}

function PngEntry([int]$size) {
  $bmp = Resize $size
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  return ,$ms.ToArray()
}

$sizes = 16, 20, 24, 32, 40, 48, 64, 96, 128, 256
$images = foreach ($s in $sizes) { , (@{ size = $s; data = $(if ($s -ge 256) { PngEntry $s } else { BmpEntry $s }) }) }
$src.Dispose()

$fs = [System.IO.File]::Create($Out)
$w = New-Object System.IO.BinaryWriter($fs)
$w.Write([int16]0); $w.Write([int16]1); $w.Write([int16]$images.Count)
$offset = 6 + 16 * $images.Count
foreach ($img in $images) {
  $dim = if ($img.size -ge 256) { 0 } else { $img.size }
  $w.Write([byte]$dim); $w.Write([byte]$dim); $w.Write([byte]0); $w.Write([byte]0)
  $w.Write([int16]1); $w.Write([int16]32)
  $w.Write([int]$img.data.Length); $w.Write([int]$offset)
  $offset += $img.data.Length
}
foreach ($img in $images) { $w.Write([byte[]]$img.data) }
$w.Close()
"icon.ico: $($images.Count) sizes, $((Get-Item $Out).Length) bytes"
