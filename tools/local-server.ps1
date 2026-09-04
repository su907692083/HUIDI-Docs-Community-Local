param(
  [int]$Port = 8765,
  [string]$Root = ""
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($Root)) {
  $Root = Join-Path (Split-Path -Parent $PSScriptRoot) 'public'
}
$Root = [System.IO.Path]::GetFullPath($Root)
$ProjectRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$ConfigDir = Join-Path $ProjectRoot 'config'
$FeishuConfigPath = Join-Path $ConfigDir 'feishu.local.json'
$LogDir = Join-Path $ProjectRoot 'logs'
$LogPath = Join-Path $LogDir 'launcher-last.log'

if (-not (Test-Path -LiteralPath $Root -PathType Container)) {
  throw "Public directory not found: $Root"
}
if (-not (Test-Path -LiteralPath $LogDir)) {
  New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch { }

function Write-LauncherLog([string]$Message) {
  try {
    $line = "[$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))] $Message"
    Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
  } catch { }
}

function Clean([object]$Value) {
  if ($null -eq $Value) { return '' }
  return ([string]$Value).Trim()
}

function Get-MimeType([string]$Path) {
  $ext = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
  switch ($ext) {
    '.html' { return 'text/html; charset=utf-8' }
    '.htm' { return 'text/html; charset=utf-8' }
    '.js' { return 'text/javascript; charset=utf-8' }
    '.css' { return 'text/css; charset=utf-8' }
    '.json' { return 'application/json; charset=utf-8' }
    '.webmanifest' { return 'application/manifest+json; charset=utf-8' }
    '.png' { return 'image/png' }
    '.jpg' { return 'image/jpeg' }
    '.jpeg' { return 'image/jpeg' }
    '.webp' { return 'image/webp' }
    '.gif' { return 'image/gif' }
    '.svg' { return 'image/svg+xml' }
    '.ico' { return 'image/x-icon' }
    '.pdf' { return 'application/pdf' }
    '.xlsx' { return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    '.csv' { return 'text/csv; charset=utf-8' }
    '.txt' { return 'text/plain; charset=utf-8' }
    '.woff' { return 'font/woff' }
    '.woff2' { return 'font/woff2' }
    default { return 'application/octet-stream' }
  }
}

function Write-Http([System.IO.Stream]$Stream, [string]$Status, [string]$Mime, [byte[]]$Body, [string]$Method) {
  if ([string]::IsNullOrWhiteSpace($Method)) { $Method = 'GET' }
  $head = "HTTP/1.1 $Status`r`nContent-Type: $Mime`r`nContent-Length: $($Body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`nX-Content-Type-Options: nosniff`r`n`r`n"
  $headBytes = [System.Text.Encoding]::ASCII.GetBytes($head)
  $Stream.Write($headBytes, 0, $headBytes.Length)
  if ($Method -ne 'HEAD') { $Stream.Write($Body, 0, $Body.Length) }
  $Stream.Flush()
}

function Write-Json([System.IO.Stream]$Stream, [string]$Status, [object]$Payload, [string]$Method) {
  $json = $Payload | ConvertTo-Json -Depth 30 -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  Write-Http $Stream $Status 'application/json; charset=utf-8' $bytes $Method
}

function Read-FeishuConfig {
  if (-not (Test-Path -LiteralPath $FeishuConfigPath -PathType Leaf)) {
    return [pscustomobject]@{}
  }
  try {
    return (Get-Content -LiteralPath $FeishuConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json)
  } catch {
    return [pscustomobject]@{}
  }
}

function Save-FeishuConfig([object]$Cfg) {
  if (-not (Test-Path -LiteralPath $ConfigDir)) {
    New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
  }
  $safe = [ordered]@{
    app_id = Clean $Cfg.app_id
    app_secret = Clean $Cfg.app_secret
    tenant_domain = ((Clean $Cfg.tenant_domain) -replace '^https?://','' -replace '/+$','')
    folder_token = Clean $Cfg.folder_token
    document_id = Clean $Cfg.document_id
    last_sync_at = Clean $Cfg.last_sync_at
    last_document_url = Clean $Cfg.last_document_url
  }
  ($safe | ConvertTo-Json -Depth 5) | Set-Content -LiteralPath $FeishuConfigPath -Encoding UTF8
  return [pscustomobject]$safe
}

function Mask-AppId([string]$Value) {
  $s = Clean $Value
  if (-not $s) { return '' }
  if ($s.Length -le 8) { return $s.Substring(0, [Math]::Min(3, $s.Length)) + '***' }
  return $s.Substring(0, 6) + '...' + $s.Substring($s.Length - 4)
}

function Get-DocumentUrl([object]$Cfg) {
  $lastUrl = Clean $Cfg.last_document_url
  if ($lastUrl) { return $lastUrl }
  $domain = Clean $Cfg.tenant_domain
  $docId = Clean $Cfg.document_id
  if ($domain -and $docId) { return "https://$domain/docx/$docId" }
  return ''
}

function Get-PublicStatus([object]$Cfg) {
  $appId = Clean $Cfg.app_id
  $secret = Clean $Cfg.app_secret
  return [ordered]@{
    ok = $true
    configured = [bool]($appId -and $secret)
    app_id = $appId
    app_id_masked = Mask-AppId $appId
    tenant_domain = Clean $Cfg.tenant_domain
    folder_token = Clean $Cfg.folder_token
    document_id = Clean $Cfg.document_id
    document_url = Get-DocumentUrl $Cfg
    last_sync_at = Clean $Cfg.last_sync_at
  }
}

function Invoke-FeishuJson([string]$Method, [string]$Path, [object]$Body, [string]$Token) {
  $headers = @{}
  if ($Token) { $headers['Authorization'] = "Bearer $Token" }
  $params = @{
    Uri = ('https://open.feishu.cn' + $Path)
    Method = $Method
    Headers = $headers
    TimeoutSec = 15
    ErrorAction = 'Stop'
  }
  if ($null -ne $Body) {
    $params['ContentType'] = 'application/json; charset=utf-8'
    $params['Body'] = ($Body | ConvertTo-Json -Depth 30 -Compress)
  }
  try {
    $result = Invoke-RestMethod @params
  } catch {
    throw "连接飞书失败：$($_.Exception.Message)"
  }
  if ($null -ne $result.code -and [int]$result.code -ne 0) {
    throw "$($result.msg) (code $($result.code))"
  }
  return $result
}

function Get-TenantToken([object]$Cfg) {
  $appId = Clean $Cfg.app_id
  $secret = Clean $Cfg.app_secret
  if (-not $appId -or -not $secret) { throw '请先配置飞书 App ID 和 App Secret' }
  $body = [ordered]@{ app_id = $appId; app_secret = $secret }
  $result = Invoke-FeishuJson 'POST' '/open-apis/auth/v3/tenant_access_token/internal' $body ''
  $token = Clean $result.tenant_access_token
  if (-not $token) { throw '飞书未返回 tenant_access_token，请检查应用凭证和发布状态' }
  return $token
}


function Convert-FeishuScalar([object]$Value) {
  if ($null -eq $Value) { return '' }
  if ($Value -is [string] -or $Value -is [ValueType]) { return [string]$Value }
  if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [System.Collections.IDictionary])) {
    $parts = @(); foreach ($x in $Value) { $v = Convert-FeishuScalar $x; if ($v) { $parts += $v } }; return ($parts -join ' / ')
  }
  try { if ($null -ne $Value.text) { return Convert-FeishuScalar $Value.text } } catch { }
  try { if ($null -ne $Value.name) { return Convert-FeishuScalar $Value.name } } catch { }
  try { if ($null -ne $Value.link) { return Convert-FeishuScalar $Value.link } } catch { }
  $parts = @(); try { foreach ($p in $Value.PSObject.Properties) { $v = Convert-FeishuScalar $p.Value; if ($v) { $parts += $v } } } catch { }
  return ($parts -join ' / ')
}
function Get-QueryValue([Uri]$Uri, [string]$Name) {
  $q = $Uri.Query.TrimStart('?'); if (-not $q) { return '' }
  foreach ($pair in ($q -split '&')) { $kv = $pair -split '=',2; if ($kv.Count -gt 0 -and [Uri]::UnescapeDataString($kv[0]) -eq $Name) { if ($kv.Count -gt 1) { return [Uri]::UnescapeDataString($kv[1]) } } }
  return ''
}
function Parse-FeishuSource([object]$Input) {
  $etype = Clean $Input.type; $etoken = Clean $Input.token; $title = Clean $Input.title; $raw = Clean $Input.url
  if ($etype -and $etoken) { return [pscustomobject]@{ kind=$(if ($etype -match 'bitable|base'){'bitable'}else{'sheet'}); token=$etoken; title=$title; url=$raw; sheet_id=(Clean $Input.sheet_id); table_id=(Clean $Input.table_id) } }
  if (-not $raw) { throw '请粘贴飞书电子表格或多维表格链接' }
  try { $u = [Uri]$raw } catch { throw '飞书链接格式无法识别' }
  $seg = @($u.AbsolutePath.Trim('/') -split '/');
  for ($i=0; $i -lt $seg.Count; $i++) {
    if ($seg[$i] -eq 'sheets' -and $i+1 -lt $seg.Count) { return [pscustomobject]@{kind='sheet';token=$seg[$i+1];sheet_id=(Get-QueryValue $u 'sheet');table_id='';title=$title;url=$raw} }
    if (($seg[$i] -eq 'base' -or $seg[$i] -eq 'bitable') -and $i+1 -lt $seg.Count) { $table=Get-QueryValue $u 'table'; return [pscustomobject]@{kind='bitable';token=$seg[$i+1];sheet_id='';table_id=$table;title=$title;url=$raw} }
  }
  if ($seg -contains 'wiki') { throw '当前是知识库 Wiki 链接。请在飞书中打开源电子表格/多维表格后复制原表链接再读取。' }
  throw '当前只支持飞书电子表格 Sheets 和多维表格 Bitable 链接'
}
function Get-FeishuTypeLabel([string]$Type) { switch (Clean $Type) { 'sheet' {'电子表格'} 'bitable' {'多维表格'} 'folder' {'文件夹'} 'docx' {'文档'} 'doc' {'文档'} default { return Clean $Type } } }
function Get-FeishuFiles([object]$Cfg,[string]$Token,[string]$Folder) {
  $escaped=[Uri]::EscapeDataString($Folder); $r=Invoke-FeishuJson 'GET' "/open-apis/drive/v1/files?folder_token=$escaped&page_size=50" $null $Token
  $items=@(); try { $items=@($r.data.files) } catch { }; if ($items.Count -eq 0) { try { $items=@($r.data.items) } catch { } }
  $out=@(); foreach($x in $items){ $type=Clean $x.type; if(-not $type){$type=Clean $x.file_type}; $tok=Clean $x.token; if(-not $tok){$tok=Clean $x.file_token}; $out += [pscustomobject]@{token=$tok;name=$(if(Clean $x.name){Clean $x.name}else{Clean $x.title});type=$type;type_label=(Get-FeishuTypeLabel $type);modified_time=$(if(Clean $x.modified_time){Clean $x.modified_time}else{Clean $x.modified_at});url=(Clean $x.url);reusable=[bool]($type -eq 'sheet' -or $type -eq 'bitable')} }
  return $out
}
function Inspect-FeishuSheet([object]$Src,[string]$Token) {
  $st=[Uri]::EscapeDataString((Clean $Src.token)); $meta=Invoke-FeishuJson 'GET' "/open-apis/sheets/v3/spreadsheets/$st/sheets/query" $null $Token; $sheets=@($meta.data.sheets); if($sheets.Count -eq 0){throw '这张电子表格没有可读取的工作表'}
  $sh=$null; if(Clean $Src.sheet_id){$sh=$sheets|Where-Object{(Clean $_.sheet_id)-eq(Clean $Src.sheet_id)}|Select-Object -First 1}; if($null -eq $sh){$sh=$sheets[0]}; $sheetId=Clean $sh.sheet_id
  $range=[Uri]::EscapeDataString("$sheetId!A1:AZ1000"); $v=Invoke-FeishuJson 'GET' "/open-apis/sheets/v2/spreadsheets/$st/values/$range" $null $Token; $matrix=@(); try{$matrix=@($v.data.valueRange.values)}catch{}; if($matrix.Count -eq 0){try{$matrix=@($v.data.value_range.values)}catch{}}
  $columns=@(); if($matrix.Count -gt 0){$head=@($matrix[0]); for($i=0;$i -lt $head.Count;$i++){ $name=Clean (Convert-FeishuScalar $head[$i]); if(-not $name){$name="列$($i+1)"}; if($columns -contains $name){$name="$name`_$($i+1)"}; $columns += $name }}
  $rows=@(); for($ri=1;$ri -lt $matrix.Count -and $ri -le 980;$ri++){ $r=@($matrix[$ri]); $has=$false; $o=[ordered]@{}; for($ci=0;$ci -lt $columns.Count;$ci++){ $val=''; if($ci -lt $r.Count){$val=Convert-FeishuScalar $r[$ci]}; if(Clean $val){$has=$true}; $o[$columns[$ci]]=$val }; if($has){$rows += [pscustomobject]$o} }
  $title=Clean $Src.title; if(-not $title){$title=Clean $sh.title}; if(-not $title){$title='飞书电子表格'}
  return [pscustomobject]@{source=[pscustomobject]@{kind='sheet';token=(Clean $Src.token);sheet_id=$sheetId;table_id='';title=$title;sheet_title=(Clean $sh.title);url=(Clean $Src.url)};columns=$columns;rows=$rows}
}
function Inspect-FeishuBitable([object]$Src,[string]$Token) {
  $app=[Uri]::EscapeDataString((Clean $Src.token)); $tableId=Clean $Src.table_id; $tables=@(); if(-not $tableId){$tr=Invoke-FeishuJson 'GET' "/open-apis/bitable/v1/apps/$app/tables?page_size=100" $null $Token; $tables=@($tr.data.items); if($tables.Count -gt 0){$tableId=Clean $tables[0].table_id}}
  if(-not $tableId){throw '这张多维表格没有可读取的数据表'}; $tid=[Uri]::EscapeDataString($tableId); $items=@(); $pageToken=''; for($pg=0;$pg -lt 10;$pg++){ $path="/open-apis/bitable/v1/apps/$app/tables/$tid/records?page_size=100"; if($pageToken){$path += '&page_token=' + [Uri]::EscapeDataString($pageToken)}; $rr=Invoke-FeishuJson 'GET' $path $null $Token; $items += @($rr.data.items); if(-not $rr.data.has_more -or -not (Clean $rr.data.page_token)){break}; $pageToken=Clean $rr.data.page_token }
  $columns=New-Object System.Collections.Generic.List[string]; foreach($rec in $items){try{foreach($p in $rec.fields.PSObject.Properties){if(-not $columns.Contains($p.Name)){$columns.Add($p.Name)}}}catch{}}
  $rows=@(); foreach($rec in $items){$o=[ordered]@{}; foreach($c in $columns){$val='';try{$val=Convert-FeishuScalar $rec.fields.$c}catch{};$o[$c]=$val};$o['__record_id']=Clean $rec.record_id;$rows += [pscustomobject]$o}
  $title=Clean $Src.title; if(-not $title -and $tables.Count -gt 0){$tab=$tables|Where-Object{(Clean $_.table_id)-eq$tableId}|Select-Object -First 1;if($tab){$title=Clean $tab.name}}; if(-not $title){$title='飞书多维表格'}
  return [pscustomobject]@{source=[pscustomobject]@{kind='bitable';token=(Clean $Src.token);sheet_id='';table_id=$tableId;title=$title;url=(Clean $Src.url)};columns=@($columns);rows=$rows}
}
function Inspect-FeishuSource([object]$Cfg,[object]$Input){$token=Get-TenantToken $Cfg;$src=Parse-FeishuSource $Input;if($src.kind -eq 'bitable'){return Inspect-FeishuBitable $src $token};return Inspect-FeishuSheet $src $token}

function New-FeishuDoc([object]$Cfg, [string]$Token) {
  $body = [ordered]@{ title = 'HUIDI Docs · 业务协作快照' }
  $folder = Clean $Cfg.folder_token
  if ($folder) { $body['folder_token'] = $folder }
  $result = Invoke-FeishuJson 'POST' '/open-apis/docx/v1/documents' $body $Token
  $id = ''
  try { $id = Clean $result.data.document.document_id } catch { }
  if (-not $id) { try { $id = Clean $result.data.document_id } catch { } }
  if (-not $id) { throw '飞书文档创建成功但未返回 document_id' }
  return $id
}

function New-TextBlock([string]$Content) {
  return [ordered]@{ block_type = 2; text = [ordered]@{ elements = @([ordered]@{ text_run = [ordered]@{ content = $Content } }) } }
}
function New-Heading2Block([string]$Content) {
  return [ordered]@{ block_type = 4; heading2 = [ordered]@{ elements = @([ordered]@{ text_run = [ordered]@{ content = $Content } }) } }
}
function Safe-Line([object]$Value) {
  $s = (Clean $Value) -replace '[\r\n]+',' '
  if ($s.Length -gt 420) { return $s.Substring(0, 420) }
  return $s
}
function Get-DocTypeLabel([object]$Value) {
  $v = Clean $Value
  switch ($v) {
    'quotation' { return '报价单' }
    'proforma_invoice' { return '形式发票 PI' }
    'sales_contract' { return '销售合同' }
    'commercial_invoice' { return '商业发票 CI' }
    'packing_list' { return '装箱单 PL' }
    default { if ($v) { return $v } else { return '单据' } }
  }
}
function Join-Parts([object[]]$Values) {
  $parts = New-Object System.Collections.Generic.List[string]
  foreach ($value in $Values) {
    $s = Safe-Line $value
    if ($s) { $parts.Add($s) }
  }
  return ($parts -join ' · ')
}
function Join-List([object[]]$Rows, [scriptblock]$Formatter, [string]$Empty) {
  $list = @($Rows)
  if ($list.Count -eq 0) { return $Empty }
  $out = New-Object System.Collections.Generic.List[string]
  for ($i = 0; $i -lt $list.Count; $i++) {
    $out.Add("$($i + 1). $(& $Formatter $list[$i])")
  }
  $text = $out -join "`n"
  if ($text.Length -gt 9000) { $text = $text.Substring(0, 9000) }
  return $text
}
function Build-Blocks([object]$Snapshot) {
  $counts = $Snapshot.counts
  $stamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  $documents = @($Snapshot.documents)
  $customers = @($Snapshot.customers)
  $products = @($Snapshot.products)
  $deals = @($Snapshot.deals)
  return @(
    (New-Heading2Block "同步快照 · $stamp"),
    (New-TextBlock 'HUIDI Docs Community Local 在线协作副本。完整 JSON 本地备份仍是恢复与换电脑迁移的唯一完整备份；本快照不包含图片、签名、公章、银行账号或应用密钥。'),
    (New-Heading2Block '业务概览'),
    (New-TextBlock "客户 $($counts.customers) · 商品 $($counts.products) · 询盘/订单 $($counts.deals) · 本地单据 $($counts.documents)"),
    (New-Heading2Block '最近单据'),
    (New-TextBlock (Join-List $documents { param($r) Join-Parts @((Get-DocTypeLabel $r.type), $r.no, $r.customer, $r.updated_at) } '暂无记录')),
    (New-Heading2Block '客户摘要'),
    (New-TextBlock (Join-List $customers { param($r) Join-Parts @($r.company, $r.contact, $r.country) } '暂无记录')),
    (New-Heading2Block '商品摘要'),
    (New-TextBlock (Join-List $products { param($r) Join-Parts @($r.sku, $r.name, $r.spec, (Join-Parts @($r.currency, $r.price))) } '暂无记录')),
    (New-Heading2Block '询盘 / 订单摘要'),
    (New-TextBlock (Join-List $deals { param($r) Join-Parts @($r.title, $r.customer, $r.stage, $r.amount, $r.next) } '暂无记录'))
  )
}
function Append-Blocks([string]$DocId, [object[]]$Blocks, [string]$Token) {
  $escaped = [Uri]::EscapeDataString($DocId)
  $apiPath = "/open-apis/docx/v1/documents/$escaped/blocks/$escaped/children?document_revision_id=-1"
  [void](Invoke-FeishuJson 'POST' $apiPath ([ordered]@{ children = $Blocks }) $Token)
  return @($Blocks).Count
}

function Handle-Api([string]$Method, [string]$Path, [string]$BodyText, [System.IO.Stream]$Stream) {
  try {
    if ($Method -eq 'GET' -and $Path -eq '/api/feishu/status') {
      Write-Json $Stream '200 OK' (Get-PublicStatus (Read-FeishuConfig)) $Method
      return
    }
    if ($Method -eq 'POST' -and $Path -eq '/api/feishu/config') {
      $incoming = $BodyText | ConvertFrom-Json
      $current = Read-FeishuConfig
      $incomingAppId = Clean $incoming.app_id
      $incomingSecret = Clean $incoming.app_secret
      $next = [pscustomobject]@{
        app_id = $(if ($incomingAppId) { $incomingAppId } else { Clean $current.app_id })
        app_secret = $(if ($incomingSecret) { $incomingSecret } else { Clean $current.app_secret })
        tenant_domain = Clean $incoming.tenant_domain
        folder_token = Clean $incoming.folder_token
        document_id = Clean $incoming.document_id
        last_sync_at = Clean $current.last_sync_at
        last_document_url = Clean $current.last_document_url
      }
      if (-not (Clean $next.app_id)) { throw 'App ID 不能为空' }
      if (-not (Clean $next.app_secret)) { throw 'App Secret 不能为空' }
      $saved = Save-FeishuConfig $next
      $status = Get-PublicStatus $saved
      $status['message'] = '飞书本地配置已保存'
      Write-Json $Stream '200 OK' $status $Method
      return
    }
    if ($Method -eq 'POST' -and $Path -eq '/api/feishu/test') {
      $cfg = Read-FeishuConfig
      [void](Get-TenantToken $cfg)
      Write-Json $Stream '200 OK' ([ordered]@{ ok = $true; message = '飞书凭证有效，已成功获取 tenant_access_token。' }) $Method
      return
    }
    if ($Method -eq 'POST' -and $Path -eq '/api/feishu/source/list') {
      $incoming = $BodyText | ConvertFrom-Json; $cfg=Read-FeishuConfig; $token=Get-TenantToken $cfg; $folder=Clean $incoming.folder_token; if(-not $folder){$folder=Clean $cfg.folder_token}; if(-not $folder){throw '请填写飞书文件夹 Token，或先在“配置飞书”中保存默认文件夹'}; $items=Get-FeishuFiles $cfg $token $folder; Write-Json $Stream '200 OK' ([ordered]@{ok=$true;folder_token=$folder;items=@($items)}) $Method; return
    }
    if ($Method -eq 'POST' -and $Path -eq '/api/feishu/source/inspect') {
      $incoming = $BodyText | ConvertFrom-Json; $cfg=Read-FeishuConfig; $result=Inspect-FeishuSource $cfg $incoming; Write-Json $Stream '200 OK' ([ordered]@{ok=$true;source=$result.source;columns=@($result.columns);rows=@($result.rows)}) $Method; return
    }
    if ($Method -eq 'POST' -and $Path -eq '/api/feishu/sync') {
      $incoming = $BodyText | ConvertFrom-Json
      $snapshotB64 = Clean $incoming.snapshot_b64
      if (-not $snapshotB64) { throw '同步数据为空' }
      $bytes = [Convert]::FromBase64String($snapshotB64)
      $snapshotText = [Text.Encoding]::UTF8.GetString($bytes)
      $snapshot = $snapshotText | ConvertFrom-Json
      $cfg = Read-FeishuConfig
      $token = Get-TenantToken $cfg
      $docId = Clean $cfg.document_id
      if (-not $docId) { $docId = New-FeishuDoc $cfg $token }
      $blocks = Build-Blocks $snapshot
      $written = Append-Blocks $docId $blocks $token
      $lastUrl = ''
      if (Clean $cfg.tenant_domain) { $lastUrl = "https://$($cfg.tenant_domain)/docx/$docId" }
      $saved = Save-FeishuConfig ([pscustomobject]@{
        app_id = Clean $cfg.app_id
        app_secret = Clean $cfg.app_secret
        tenant_domain = Clean $cfg.tenant_domain
        folder_token = Clean $cfg.folder_token
        document_id = $docId
        last_sync_at = (Get-Date).ToUniversalTime().ToString('o')
        last_document_url = $lastUrl
      })
      Write-Json $Stream '200 OK' ([ordered]@{
        ok = $true
        document_id = $docId
        document_url = Get-DocumentUrl $saved
        synced_at = $saved.last_sync_at
        blocks_written = $written
      }) $Method
      return
    }
    Write-Json $Stream '404 Not Found' ([ordered]@{ ok = $false; message = 'API not found' }) $Method
  } catch {
    Write-LauncherLog ("Feishu API error: " + $_.Exception.Message)
    Write-Json $Stream '500 Internal Server Error' ([ordered]@{ ok = $false; message = $_.Exception.Message }) $Method
  }
}

# Bind robustly. If an older HUIDI package still occupies 8765, use the next free port.
$listener = $null
$selectedPort = $null
for ($candidatePort = $Port; $candidatePort -le ($Port + 10); $candidatePort++) {
  $candidateListener = $null
  try {
    $candidateListener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $candidatePort)
    $candidateListener.Start()
    $listener = $candidateListener
    $selectedPort = $candidatePort
    break
  } catch [System.Net.Sockets.SocketException] {
    try { if ($candidateListener) { $candidateListener.Stop() } } catch { }
  }
}
if ($null -eq $listener) {
  throw "No available loopback port found from $Port to $($Port + 10)."
}
$Port = [int]$selectedPort
$url = "http://127.0.0.1:$Port/"
Write-LauncherLog "PowerShell server started at $url"

Write-Host ''
Write-Host 'HUIDI Docs Community Local 1.2.0 RC16.29' -ForegroundColor Cyan
Write-Host "Local address: $url" -ForegroundColor Green
if ($Port -ne 8765) {
  Write-Host "Port 8765 was already in use; switched automatically to $Port." -ForegroundColor Yellow
}
Write-Host '本地业务默认离线；飞书协作仅在你主动点击同步时由本机服务联网。' -ForegroundColor DarkGray
Write-Host '关闭此窗口即可停止本地服务。' -ForegroundColor DarkGray
Write-Host ''

try { Start-Process $url | Out-Null } catch { }

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $client.ReceiveTimeout = 10000
      $stream = $client.GetStream()
      $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 4096, $true)
      $requestLine = $reader.ReadLine()
      if ([string]::IsNullOrWhiteSpace($requestLine)) { $client.Close(); continue }

      $headers = @{}
      while ($true) {
        $line = $reader.ReadLine()
        if ([string]::IsNullOrEmpty($line)) { break }
        $i = $line.IndexOf(':')
        if ($i -gt 0) {
          $headers[$line.Substring(0, $i).Trim().ToLowerInvariant()] = $line.Substring($i + 1).Trim()
        }
      }

      $parts = $requestLine.Split(' ')
      $method = if ($parts.Length -gt 0) { $parts[0] } else { 'GET' }
      $target = if ($parts.Length -gt 1) { $parts[1] } else { '/' }
      $uri = [System.Uri]::new("http://127.0.0.1$target")
      $apiPath = $uri.AbsolutePath

      $bodyText = ''
      $contentLength = 0
      if ($headers.ContainsKey('content-length')) {
        [int]::TryParse($headers['content-length'], [ref]$contentLength) | Out-Null
      }
      if ($contentLength -gt 0) {
        if ($contentLength -gt 2097152) { throw '请求内容过大' }
        $chars = New-Object char[] $contentLength
        $read = 0
        while ($read -lt $contentLength) {
          $n = $reader.Read($chars, $read, $contentLength - $read)
          if ($n -le 0) { break }
          $read += $n
        }
        if ($read -gt 0) { $bodyText = -join $chars[0..($read - 1)] }
      }

      if ($apiPath.StartsWith('/api/feishu/')) {
        Handle-Api $method $apiPath $bodyText $stream
        continue
      }

      $requestPath = [System.Uri]::UnescapeDataString($uri.AbsolutePath).Replace('/', [System.IO.Path]::DirectorySeparatorChar)
      if ($requestPath -eq [System.IO.Path]::DirectorySeparatorChar.ToString()) {
        $requestPath = [System.IO.Path]::DirectorySeparatorChar + 'index.html'
      }
      $candidate = [System.IO.Path]::GetFullPath((Join-Path $Root $requestPath.TrimStart([System.IO.Path]::DirectorySeparatorChar)))
      if (-not $candidate.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)) {
        $status = '403 Forbidden'; $body = [System.Text.Encoding]::UTF8.GetBytes('Forbidden'); $mime = 'text/plain; charset=utf-8'
      } elseif (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
        $status = '404 Not Found'; $body = [System.Text.Encoding]::UTF8.GetBytes('Not Found'); $mime = 'text/plain; charset=utf-8'
      } else {
        $status = '200 OK'; $body = [System.IO.File]::ReadAllBytes($candidate); $mime = Get-MimeType $candidate
      }
      Write-Http $stream $status $mime $body $method
    } catch {
      Write-LauncherLog ("Request error: " + $_.Exception.Message)
      try { Write-Json $stream '500 Internal Server Error' ([ordered]@{ ok = $false; message = $_.Exception.Message }) 'GET' } catch { }
    } finally {
      try { $client.Close() } catch { }
    }
  }
} finally {
  try { $listener.Stop() } catch { }
}
