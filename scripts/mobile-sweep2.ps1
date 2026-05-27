$files = Get-ChildItem -Path src -Recurse -Include *.tsx,*.ts
$alterados = 0
foreach ($f in $files) {
  $c = Get-Content $f.FullName -Raw
  $novo = $c
  # dl com label fixo precisa virar 1 coluna em mobile pra label nao comer metade da tela
  $novo = $novo -replace 'grid grid-cols-\[140px_1fr\]', 'grid grid-cols-1 sm:grid-cols-[140px_1fr]'
  $novo = $novo -replace 'grid grid-cols-\[120px_1fr\]', 'grid grid-cols-1 sm:grid-cols-[120px_1fr]'
  $novo = $novo -replace 'grid grid-cols-\[100px_1fr\]', 'grid grid-cols-1 sm:grid-cols-[100px_1fr]'
  if ($novo -ne $c) {
    Set-Content -Path $f.FullName -Value $novo -NoNewline
    $alterados++
  }
}
Write-Output ("Alterados: " + $alterados)
