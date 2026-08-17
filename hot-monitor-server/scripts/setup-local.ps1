[CmdletBinding()]
param(
  [switch]$InstallPostgres,
  [switch]$SkipMigrate
)

$ErrorActionPreference = "Stop"
$serverDir = Split-Path -Parent $PSScriptRoot
Set-Location $serverDir

function Write-Step([string]$Message) {
  Write-Host "[hot-monitor] $Message" -ForegroundColor Cyan
}

if (-not (Test-Path ".env")) {
  if (-not (Test-Path ".env.example")) {
    throw "缺少 .env.example。请从 hot-monitor-server 目录运行此脚本。"
  }

  Copy-Item ".env.example" ".env"
  $secret = node --input-type=module -e "import crypto from 'node:crypto'; console.log(crypto.randomBytes(32).toString('hex'))"
  $content = Get-Content ".env" -Raw
  $content = $content -replace "(?m)^SESSION_SECRET=.*$", "SESSION_SECRET=$($secret.Trim())"
  Set-Content ".env" $content -NoNewline
  Write-Step "已创建 .env，并生成 SESSION_SECRET。"
} else {
  Write-Step "保留现有的 .env。"
}

$portOpen = Test-NetConnection -ComputerName "localhost" -Port 5432 -InformationLevel Quiet -WarningAction SilentlyContinue
if (-not $portOpen -and $InstallPostgres) {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw "找不到 winget。请手动安装 PostgreSQL 17，然后重新运行此脚本。"
  }
  Write-Step "正在使用 winget 安装 PostgreSQL 17（安装程序可能会请求管理员权限）。"
  winget install --id PostgreSQL.PostgreSQL.17 --exact --accept-source-agreements --accept-package-agreements
  Write-Step "PostgreSQL 安装命令已完成。如果 PATH 已更新，请打开新终端。"
  $portOpen = Test-NetConnection -ComputerName "localhost" -Port 5432 -InformationLevel Quiet -WarningAction SilentlyContinue
}

if (-not $portOpen) {
  throw "无法连接 localhost:5432 上的 PostgreSQL。请安装或启动 PostgreSQL，创建数据库 hot_monitor，然后重新运行此脚本。"
}

Write-Step "已连接到 localhost:5432 上的 PostgreSQL。"
npm run prisma:generate

if (-not $SkipMigrate) {
  npm run prisma:deploy
}

Write-Step "本地后端运行前置条件已准备就绪。请运行以下命令启动：npm run dev"
