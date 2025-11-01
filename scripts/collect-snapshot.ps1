$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path

function Header([string]$title, [string]$path) {
  Write-Output ''
  Write-Output ('## {0} - {1}' -f $title, $path)
}

function Snips([string]$file, [string[]]$patterns) {
  if (!(Test-Path $file)) { return $false }
  $content = Get-Content -Raw -Path $file
  if ($patterns -eq $null -or $patterns.Count -eq 0) {
    $lines = $content.Split("`n")
    $max = [Math]::Min($lines.Count, 400)
    for ($i=0; $i -lt $max; $i++) {
      Write-Output ('{0,4}: {1}' -f ($i+1), $lines[$i].TrimEnd())
    }
    return $true
  }
  $foundAny = $false
  foreach ($p in $patterns) {
    $matches = Select-String -Path $file -Pattern $p -Context 3,3 -ErrorAction SilentlyContinue
    foreach ($m in $matches) {
      $foundAny = $true
      Write-Output ('--- {0}' -f $p)
      $ln = $m.LineNumber - $m.Context.PreContext.Count
      foreach ($line in ($m.Context.PreContext + @($m.Line) + $m.Context.PostContext)) {
        Write-Output ('{0,4}: {1}' -f $ln, $line.TrimEnd())
        $ln++
      }
    }
  }
  if (-not $foundAny) { Write-Output '(sem correspondencias para padroes fornecidos)' }
  return $true
}

function Block([string]$title, [string]$pathRegex, [string[]]$patterns = @(), [string]$suggest = $null) {
  Header $title $pathRegex
  $all = Get-ChildItem -Recurse -File -Path $root -ErrorAction SilentlyContinue
  $matched = @()
  foreach ($f in $all) {
    $unix = ($f.FullName -replace '\\','/')
    if ($unix -match $pathRegex) { $matched += $f }
  }
  if ($matched.Count -eq 0) {
    Write-Output 'NÃO EXISTE'
    if ($suggest) { Write-Output ('Sugestão: {0}' -f $suggest) }
    return
  }
  foreach ($f in $matched) {
    $rel = ($f.FullName -replace [regex]::Escape($root), '.')
    Write-Output ('[ARQUIVO] {0}' -f $rel)
    Snips $f.FullName $patterns | Out-Null
  }
}

Write-Output '# SNAPSHOT - WAHA + LangChain/OpenAI + Registro de Rotas/Frontend'
Write-Output ('Workspace: {0}' -f $root)

# 1) WAHA - conexao dinamica por inbox
Write-Output ''
Write-Output '---'
Write-Output '## 1) WAHA - conexao dinamica por inbox (DB por sessao)'

Block 'Pool Manager' 'backend/src/lib/waha(pools|pool|db).*\.(ts|js)$' @('getWahaPool','ensureViews','Pool','dsn','dbName') 'backend/src/lib/wahaPools.ts'
Block 'Resolver do inbox -> DB' 'backend/src/services/inboxes\.(ts|js)$' @('waha','waha_db','dsn','getWahaDb','inbox_secrets') 'backend/src/services/inboxes.ts'
Block 'Rotas WAHA DB' 'backend/src/routes/waha(\.db)?\.(ts|js)$' @('/waha/db','inboxId','company','requireAuth','groups','chats','messages','health') 'backend/src/routes/waha.db.ts'
Block 'Registro das rotas (index.ts)' 'backend/src/index\.(ts|js)$' @('registerWaha','waha','app.use','express','cors','json','urlencoded')
Block 'Env WAHA (env.ts)' 'backend/src/(config/)?env\.(ts|js)$' @('WAHA_','DATABASE_URL_WAHA','SSL','PG','process.env')
Block '.env.example' '\.env(\.example)?$' @('WAHA_','OPENAI','LANGCHAIN','DATABASE_URL_WAHA')
Block 'SQL views v_waha_*' '(supabase|db|backend)/.*\.(sql|psql)$' @('v_waha_messages','v_waha_groups','CREATE VIEW','GRANT')

# 2) OpenAI / LangChain - servico, rotas e worker
Write-Output ''
Write-Output '---'
Write-Output '## 2) OpenAI / LangChain - servico, rotas e worker'

Block 'Servico LangChain' 'backend/src/services/(langchain|ai|llm)\.(ts|js)$' @('export function','run','chain','model','OpenAI','LangChain','Responses','client')
Block 'Rotas AI/LangChain' 'backend/src/routes/(ai\.langchain|integrations\.openai|ai|openai)\.(ts|js)$' @('router','POST','/ai','/openai','zod','schema','validate','res.json')
Block 'Workers' 'backend/src/(worker|workers|jobs|queue|inbound|outbound).*\.((ts|js))$' @('queue','bull','bullmq','amqp','inbound','outbound','message','WAHA','Meta','runLangChain','OPENAI')
Block 'Meta store/provider enum' 'backend/src/services/meta/.*\.(ts|js)$' @('provider','WAHA','META','enum','normalize')
Block 'Env OpenAI/LangChain' 'backend/src/(config/)?env\.(ts|js)$' @('OPENAI','LANGCHAIN','MODEL','API_KEY')

# 3) Frontend - telas e chamadas
Write-Output ''
Write-Output '---'
Write-Output '## 3) Frontend - telas e chamadas'

Block 'Livechat (WAHA fetch)' 'frontend/src/.*\.(tsx|ts|js|jsx)$' @('/waha/db','inboxId','activeInbox','provider','WAHA','fetch','axios')
Block 'OpenAI UI (Form/Card)' 'frontend/src/components/.*OpenAI.*\.(tsx|ts|jsx|js)$' @('form','model','apiKey','/api/ai','submit','test')
Block 'Helper fetchJson/Campaigns' 'frontend/src/components/.*/(CampaignsPanel|fetch|api)\.(tsx|ts|js)$' @('fetchJson','/api/ai','POST','application/json')

# 4) Schemas Supabase relacionados
Write-Output ''
Write-Output '---'
Write-Output '## 4) Schemas Supabase relacionados'

Block 'DDL inboxes' '(supabase|db|backend)/.*\.(sql)$' @('CREATE TABLE','inboxes','waha_db_name','provider','instance_id','company_id','TRIGGER','FUNCTION')
Block 'DDL inbox_secrets' '(supabase|db|backend)/.*\.(sql)$' @('CREATE TABLE','inbox_secrets','waha','dsn','encrypt','decrypt')
Block 'DDL chat/chats/templates' '(supabase|db|backend)/.*\.(sql)$' @('CREATE TABLE','chat_messages','CREATE TABLE','chats','CREATE TABLE','message_templates','ALTER TABLE','COMMENT','WAHA')

# 5) Middlewares e guards
Write-Output ''
Write-Output '---'
Write-Output '## 5) Middlewares e guards'

Block 'requireAuth' 'backend/src/middlewares/requireAuth\.(ts|js)$' @('company','req','res','next','set','attach','user')
Block 'index.ts (ordem middlewares)' 'backend/src/index\.(ts|js)$' @('cors','json','urlencoded','cookie','auth','app.use','register')

# 6) Build/execucao
Write-Output ''
Write-Output '---'
Write-Output '## 6) Build/execucao'

Block 'ecosystem.config' 'ecosystem\.config\.(cjs|js|ts)$' @('apps','name','script','env','worker','instances')
Block 'docker-compose' 'docker-compose.*\.ya?ml$' @('services','backend','api','worker','environment','OPENAI','WAHA')

# 7) Pendencias/erros conhecidos
Write-Output ''
Write-Output '---'
Write-Output '## 7) Pendencias/erros conhecidos'

$patterns = @(
  'setState\(.*Chat',
  'status.*null',
  '500.*/waha/db',
  'v_waha_',
  'inboxId',
  'permission denied',
  'CONNECT|USAGE|SELECT',
  'TypeError|ReferenceError|UnhandledPromiseRejection'
)
$logs = Get-ChildItem -Recurse -File -Path $root -Include '*.ts','*.tsx','*.log','*.md' -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch 'node_modules' }

Header 'Scan de erros' '(*.ts, *.tsx, *.log)'
foreach ($p in $patterns) {
  Write-Output ('--- padrao: {0}' -f $p)
  $hit = $false
  foreach ($f in $logs) {
    $m = Select-String -Path $f.FullName -Pattern $p -ErrorAction SilentlyContinue
    if ($m) {
      $hit = $true
      $rel = ($f.FullName -replace [regex]::Escape($root), '.')
      foreach ($mm in ($m | Select-Object -First 3)) {
        Write-Output ('{0}:{1}: {2}' -f $rel, $mm.LineNumber, $mm.Line.Trim())
      }
    }
  }
  if (-not $hit) { Write-Output '(sem ocorrencias)' }
}