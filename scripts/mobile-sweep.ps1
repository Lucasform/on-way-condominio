$files = Get-ChildItem -Path src -Recurse -Include *.tsx,*.ts
$alterados = 0
foreach ($f in $files) {
  $c = Get-Content $f.FullName -Raw
  $novo = $c
  $novo = $novo -replace 'px-8 py-10', 'px-4 py-6 sm:px-8 sm:py-10'
  $novo = $novo -replace 'px-6 py-8', 'px-4 py-6 sm:px-6 sm:py-8'
  $novo = $novo -replace '"grid grid-cols-2 gap-4"', '"grid grid-cols-1 sm:grid-cols-2 gap-4"'
  $novo = $novo -replace '"grid grid-cols-2 gap-3"', '"grid grid-cols-1 sm:grid-cols-2 gap-3"'
  $novo = $novo -replace '"grid grid-cols-3 gap-3"', '"grid grid-cols-1 sm:grid-cols-3 gap-3"'
  if ($novo -ne $c) {
    Set-Content -Path $f.FullName -Value $novo -NoNewline
    $alterados++
  }
}
Write-Output ("Alterados: " + $alterados)
