(Get-Content -Raw backend/src/routes/auth.ts) | Out-String | Set-Content tmp_index_view.txt; Write-Output 'WROTE'
