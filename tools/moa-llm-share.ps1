# Moa LLM 공유기
# - 내 컴퓨터의 Ollama(EXAONE)를 켜고
# - Moa가 쓰는 기능 두 가지(모델 목록 보기, 소개 글 쓰기)만 통과시키는 "문지기"를 띄우고
# - Cloudflare 임시 주소로 인터넷에 열어서, 다른 사람 컴퓨터에서도 Moa의 한마디가 동작하게 해요.
# 이 창을 닫으면 공유도 같이 꺼져요.

$ErrorActionPreference = 'Stop'
$Port = 8787
$OllamaUrl = 'http://127.0.0.1:11434'
$SiteUrl = 'https://soong9ing.github.io/moa/'
$AllowedOrigins = @('https://soong9ing.github.io', 'http://localhost:5173', 'http://127.0.0.1:5173')
$AllowedModels = @('exaone3.5:2.4b', 'qwen3:4b-instruct')
$MaxBodyBytes = 16384
$MaxMessages = 4
$MaxChars = 6000
$MaxPerMinute = 30

try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
$Host.UI.RawUI.WindowTitle = 'Moa LLM 공유 (이 창을 닫으면 꺼져요)'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Add-Type -AssemblyName System.Net.Http

function Say($msg, $color = 'Gray') { Write-Host $msg -ForegroundColor $color }
function Fail($msg) {
  Say ''
  Say $msg 'Red'
  Say ''
  Read-Host '엔터를 누르면 창이 닫혀요'
  exit 1
}

# ---------- 1. Ollama 켜기 ----------
$ollamaExe = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'
if (-not (Test-Path $ollamaExe)) {
  $cmd = Get-Command ollama.exe -ErrorAction SilentlyContinue
  if ($cmd) { $ollamaExe = $cmd.Source } else { Fail "Ollama 프로그램을 찾을 수 없어요. Ollama가 설치되어 있는지 확인해 주세요." }
}

Say '[1/4] Ollama를 켜는 중이에요...' 'Cyan'
Get-Process -Name 'ollama app', 'ollama' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
# 내 컴퓨터에서 바로 쓸 때(localhost)를 위해 Moa 사이트 접속도 허용해 둬요. Windows 설정은 바꾸지 않아요.
$env:OLLAMA_ORIGINS = 'https://soong9ing.github.io,http://localhost:5173'
$env:OLLAMA_HOST = '127.0.0.1:11434'
Start-Process -FilePath $ollamaExe -ArgumentList 'serve' -WindowStyle Hidden | Out-Null

$http = New-Object System.Net.Http.HttpClient
$http.Timeout = [TimeSpan]::FromMinutes(5)
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  try { $null = $http.GetStringAsync("$OllamaUrl/api/tags").GetAwaiter().GetResult(); $ready = $true; break } catch { Start-Sleep -Seconds 1 }
}
if (-not $ready) { Fail 'Ollama가 켜지지 않았어요. 컴퓨터를 다시 켠 뒤 한 번 더 실행해 주세요.' }

# ---------- 2. 모델 준비 ----------
Say '[2/4] 한국어 모델 EXAONE 3.5 (2.4B)를 확인하는 중이에요...' 'Cyan'
Say '      처음 한 번은 1.6GB를 내려받아서 몇 분 걸릴 수 있어요.'
& $ollamaExe pull 'exaone3.5:2.4b'
if ($LASTEXITCODE -ne 0) { Say 'EXAONE을 받지 못했어요. 대신 qwen3:4b-instruct가 있으면 그걸로 동작해요.' 'Yellow' }

# ---------- 3. Cloudflare 임시 주소 만들기 ----------
Say '[3/4] 다른 사람도 들어올 수 있는 임시 주소를 만드는 중이에요...' 'Cyan'
$moaDir = Join-Path $env:LOCALAPPDATA 'Moa'
New-Item -ItemType Directory -Force -Path $moaDir | Out-Null
$cf = Join-Path $moaDir 'cloudflared.exe'
if (-not (Test-Path $cf)) {
  $cmd = Get-Command cloudflared.exe -ErrorAction SilentlyContinue
  if ($cmd) {
    $cf = $cmd.Source
  } else {
    Say '      Cloudflare 공식 연결 프로그램(cloudflared)을 처음 한 번 내려받아요. (약 60MB)'
    $dl = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe'
    try {
      $ProgressPreference = 'SilentlyContinue'
      Invoke-WebRequest -Uri $dl -OutFile "$cf.part" -UseBasicParsing
      Move-Item -Force "$cf.part" $cf
    } catch {
      Fail "cloudflared를 내려받지 못했어요. 인터넷 연결을 확인해 주세요.`n($($_.Exception.Message))"
    }
  }
}

# 예전에 남아 있던 연결은 정리해요
Get-Process -Name 'cloudflared' -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $cf } | Stop-Process -Force -ErrorAction SilentlyContinue
$script:tunnelRun = 0

function Start-Tunnel {
  $script:tunnelRun++
  $script:log = Join-Path $moaDir ("tunnel-{0}.log" -f $script:tunnelRun)
  $out = Join-Path $moaDir ("tunnel-{0}.out.log" -f $script:tunnelRun)
  Remove-Item $script:log, $out -ErrorAction SilentlyContinue
  # http2(TCP)로 연결해요. 학교·공용 와이파이처럼 UDP(QUIC)를 막는 곳에서도 잘 돼요.
  $p = Start-Process -FilePath $cf -PassThru -NoNewWindow `
    -ArgumentList @('tunnel', '--no-autoupdate', '--protocol', 'http2', '--url', "http://127.0.0.1:$Port", '--http-host-header', "localhost:$Port") `
    -RedirectStandardError $script:log -RedirectStandardOutput $out
  $url = $null
  for ($i = 0; $i -lt 40 -and -not $url; $i++) {
    Start-Sleep -Seconds 1
    if ($p.HasExited) { break }
    foreach ($f in @($script:log, $out)) {
      if (Test-Path $f) {
        $text = Get-Content -Raw -ErrorAction SilentlyContinue $f
        if ($text -match 'https://[a-z0-9-]+\.trycloudflare\.com') { $url = $Matches[0] }
      }
    }
  }
  if (-not $url -and -not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
  return @{ Process = $p; Url = $url }
}

function Show-Link($link, [switch]$Changed) {
  Say ''
  Say '=================================================================' 'Green'
  if ($Changed) {
    Say ' 연결이 끊겨서 새 링크를 만들었어요! 아래 새 링크를 다시 보내 주세요.' 'Magenta'
  } else {
    Say ' 아래 링크를 다른 사람에게 보내 주세요. (클립보드에도 복사해 뒀어요)' 'Green'
  }
  Say ''
  Say " $link" 'Yellow'
  Say ''
  Say ' 발표용 시연 링크 (로그인 없이 바로 추천 화면):' 'Cyan'
  Say (" $link" -replace '\?llm=', '?demo=1&llm=') 'Cyan'
  Say ''
  Say ' - 이 창을 켜 둔 동안에만 Moa의 한마디가 동작해요.' 'Green'
  Say ' - 이 창이 켜져 있는 동안은 컴퓨터가 절전 모드로 들어가지 않아요. (노트북 덮개는 열어 두세요)' 'Green'
  Say ' - 인터넷이 오래 끊기면 링크가 바뀌어요. 그러면 이 창에 새 링크가 나와요.' 'Green'
  Say ' - 들어온 요청은 소개 글 쓰기만 통과시키고, 모델 삭제/설치 같은 건 막아요.' 'Green'
  Say '=================================================================' 'Green'
  Say ''
  try { Set-Clipboard -Value $link } catch {}
}

$t = Start-Tunnel
$tunnel = $t.Process
$publicUrl = $t.Url
if (-not $publicUrl) {
  Fail "임시 주소를 만들지 못했어요. 잠시 뒤 다시 실행해 주세요. (기록: $script:log)"
}
$shareLink = $SiteUrl + '?llm=' + [Uri]::EscapeDataString($publicUrl)

# ---------- 4. 문지기 켜기 ----------
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try { $listener.Start() } catch {
  Stop-Process -Id $tunnel.Id -Force -ErrorAction SilentlyContinue
  Fail "$Port 번 포트를 쓸 수 없어요. 이미 Moa LLM 창이 켜져 있다면 그 창을 닫고 다시 실행해 주세요."
}

Say ''
Say '[4/4] 준비됐어요!' 'Green'
Show-Link $shareLink

# 이 창이 켜져 있는 동안 컴퓨터가 잠들지 않게 해요 (창을 닫으면 원래대로 돌아가요)
try {
  Add-Type -Namespace Moa -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);'
  [void][Moa.Power]::SetThreadExecutionState([uint32]'0x80000001')  # ES_CONTINUOUS | ES_SYSTEM_REQUIRED
} catch {}

# ---------- 문지기 ----------
$hits = New-Object 'System.Collections.Generic.Queue[datetime]'

function Set-Cors($ctx) {
  $origin = $ctx.Request.Headers['Origin']
  if ($origin -and ($AllowedOrigins -contains $origin)) {
    $ctx.Response.AddHeader('Access-Control-Allow-Origin', $origin)
    $ctx.Response.AddHeader('Vary', 'Origin')
    return $true
  }
  return $false
}

function Send-Text($ctx, [int]$code, [string]$json) {
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $ctx.Response.StatusCode = $code
  $ctx.Response.ContentType = 'application/json; charset=utf-8'
  $ctx.Response.ContentLength64 = $bytes.Length
  $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $ctx.Response.Close()
}

function Send-Error($ctx, [int]$code, [string]$msg) {
  Send-Text $ctx $code ('{"error":' + (ConvertTo-Json $msg -Compress) + '}')
}

function Get-AllowedInstalled {
  $raw = $http.GetStringAsync("$OllamaUrl/api/tags").GetAwaiter().GetResult()
  $data = ConvertFrom-Json $raw
  $names = @()
  foreach ($m in @($data.models)) {
    if ($m -and ($AllowedModels -contains [string]$m.name)) { $names += [string]$m.name }
  }
  return ,$names
}

function Handle-Tags($ctx) {
  try { $names = Get-AllowedInstalled } catch { Send-Error $ctx 502 'Ollama가 꺼져 있어요.'; return 502 }
  $items = @($names | ForEach-Object { '{"name":' + (ConvertTo-Json $_ -Compress) + '}' })
  Send-Text $ctx 200 ('{"models":[' + ($items -join ',') + ']}')
  return 200
}

function Handle-Chat($ctx) {
  $req = $ctx.Request
  if ($req.ContentLength64 -le 0 -or $req.ContentLength64 -gt $MaxBodyBytes) { Send-Error $ctx 413 '요청이 너무 커요.'; return 413 }
  $reader = New-Object System.IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)
  $body = $reader.ReadToEnd()
  $reader.Close()
  try { $data = ConvertFrom-Json $body } catch { Send-Error $ctx 400 '요청 형식이 맞지 않아요.'; return 400 }

  $model = [string]$data.model
  if (-not ($AllowedModels -contains $model)) { Send-Error $ctx 400 '허용되지 않은 모델이에요.'; return 400 }
  $msgsIn = @($data.messages)
  if ($msgsIn.Count -lt 1 -or $msgsIn.Count -gt $MaxMessages) { Send-Error $ctx 400 '메시지 개수가 맞지 않아요.'; return 400 }
  $msgs = New-Object System.Collections.ArrayList
  $total = 0
  foreach ($m in $msgsIn) {
    $role = [string]$m.role
    $content = [string]$m.content
    if (@('system', 'user') -notcontains $role) { Send-Error $ctx 400 '허용되지 않은 메시지예요.'; return 400 }
    $total += $content.Length
    [void]$msgs.Add([ordered]@{ role = $role; content = $content })
  }
  if ($total -gt $MaxChars) { Send-Error $ctx 413 '요청이 너무 길어요.'; return 413 }

  # 옵션은 문지기가 정해요 (아주 긴 글을 쓰게 해서 컴퓨터를 붙잡아 두지 못하게)
  $payload = [ordered]@{
    model    = $model
    stream   = $true
    messages = $msgs
    options  = [ordered]@{ temperature = 0.5; num_predict = 220; repeat_penalty = 1.15 }
  }
  $json = ConvertTo-Json $payload -Depth 6 -Compress

  $up = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Post, "$OllamaUrl/api/chat")
  $up.Content = New-Object System.Net.Http.StringContent($json, [Text.Encoding]::UTF8, 'application/json')
  try {
    $resp = $http.SendAsync($up, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
  } catch {
    Send-Error $ctx 502 'Ollama가 꺼져 있어요.'
    return 502
  }
  $code = [int]$resp.StatusCode
  $out = $ctx.Response
  $out.StatusCode = $code
  $out.ContentType = 'application/x-ndjson; charset=utf-8'
  $out.AddHeader('Cache-Control', 'no-cache')
  $out.SendChunked = $true
  $src = $resp.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
  $buf = New-Object byte[] 4096
  try {
    while (($n = $src.Read($buf, 0, $buf.Length)) -gt 0) {
      $out.OutputStream.Write($buf, 0, $n)
      $out.OutputStream.Flush()
    }
  } finally {
    $src.Dispose()
    $resp.Dispose()
    try { $out.Close() } catch {}
  }
  return $code
}

function Handle($ctx) {
  $req = $ctx.Request
  $path = $req.Url.AbsolutePath
  $method = $req.HttpMethod
  $originOk = Set-Cors $ctx

  if ($method -eq 'OPTIONS') {
    if (-not $originOk) { Send-Error $ctx 403 '허용되지 않은 사이트예요.'; return 403 }
    $ctx.Response.AddHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    $ctx.Response.AddHeader('Access-Control-Allow-Headers', 'Content-Type')
    $ctx.Response.AddHeader('Access-Control-Max-Age', '600')
    $ctx.Response.StatusCode = 204
    $ctx.Response.Close()
    return 204
  }
  if ($method -eq 'GET' -and $path -eq '/') { Send-Text $ctx 200 '{"name":"moa-llm","ok":true}'; return 200 }
  if (-not $originOk) { Send-Error $ctx 403 'Moa 사이트에서만 쓸 수 있어요.'; return 403 }

  # 1분에 최대 $MaxPerMinute번
  $now = Get-Date
  while ($hits.Count -gt 0 -and ($now - $hits.Peek()).TotalSeconds -gt 60) { [void]$hits.Dequeue() }
  if ($hits.Count -ge $MaxPerMinute) { Send-Error $ctx 429 '요청이 너무 많아요. 잠시 뒤 다시 해 주세요.'; return 429 }
  $hits.Enqueue($now)

  if ($method -eq 'GET' -and $path -eq '/api/tags') { return (Handle-Tags $ctx) }
  if ($method -eq 'POST' -and $path -eq '/api/chat') { return (Handle-Chat $ctx) }
  Send-Error $ctx 404 '없는 기능이에요.'
  return 404
}

$script:lastCheck = Get-Date
try {
  while ($listener.IsListening) {
    $task = $listener.GetContextAsync()
    while (-not $task.Wait(500)) {
      # 20초마다 임시 주소가 살아 있는지 확인하고, 죽었으면 새로 만들어요
      if (((Get-Date) - $script:lastCheck).TotalSeconds -ge 20) {
        $script:lastCheck = Get-Date
        $dead = $tunnel.HasExited
        if (-not $dead -and (Test-Path $script:log)) {
          $tail = Get-Content -Tail 3 -ErrorAction SilentlyContinue $script:log
          if (($tail -join "`n") -match 'Tunnel not found') { $dead = $true }
        }
        if ($dead) {
          Say ("{0}  임시 주소가 끊겼어요. 새로 만드는 중이에요..." -f (Get-Date -Format 'HH:mm:ss')) 'Magenta'
          if (-not $tunnel.HasExited) { Stop-Process -Id $tunnel.Id -Force -ErrorAction SilentlyContinue }
          $t = Start-Tunnel
          $tunnel = $t.Process
          if ($t.Url) {
            $publicUrl = $t.Url
            $shareLink = $SiteUrl + '?llm=' + [Uri]::EscapeDataString($publicUrl)
            Show-Link $shareLink -Changed
          } else {
            Say '  아직 인터넷이 안 되는 것 같아요. 20초 뒤에 다시 해 볼게요.' 'DarkYellow'
          }
        }
      }
    }
    $ctx = $task.Result
    $label = "$($ctx.Request.HttpMethod) $($ctx.Request.Url.AbsolutePath)"
    try {
      $code = Handle $ctx
      # 내용은 남기지 않고, 언제 어떤 요청이 왔는지만 보여 줘요
      Say ("{0}  {1}  -> {2}" -f (Get-Date -Format 'HH:mm:ss'), $label, $code) 'DarkGray'
    } catch {
      Say ("{0}  {1}  -> 오류: {2}" -f (Get-Date -Format 'HH:mm:ss'), $label, $_.Exception.Message) 'DarkYellow'
      try { $ctx.Response.StatusCode = 500; $ctx.Response.Close() } catch {}
    }
  }
} catch {
  Say "$_" 'Red'
} finally {
  try { $listener.Stop() } catch {}
  if ($tunnel -and -not $tunnel.HasExited) { Stop-Process -Id $tunnel.Id -Force -ErrorAction SilentlyContinue }
  try { [void][Moa.Power]::SetThreadExecutionState([uint32]'0x80000000') } catch {}
  Say '공유를 껐어요.' 'Yellow'
}
