# 文件说明：本地一键构建并发布到轻量服务器(Windows PowerShell)。
# 用途：2C2G 机器不适合跑 Astro 构建，改在本地构建，只把产物 + 服务端代码传上去。
#
# 首次使用前请在服务器上完成：安装 node/docker/nginx、配 swap、建 /opt/myblog/.env、
# 装 systemd 单元、放 nginx 配置(详见 deploy/README.md)。
#
# 用法(在仓库根目录)：
#   .\deploy\build-local.ps1 -ServerIp 47.100.xx.xx
#   .\deploy\build-local.ps1 -ServerIp 47.100.xx.xx -User root -SshKey C:\Users\me\.ssh\aliyun.pem

param(
	[Parameter(Mandatory = $true)][string]$ServerIp,
	[string]$User = 'root',
	[string]$SshKey = '',
	[switch]$SkipBuild,
	# 只本地构建打包、不上传，用于验证链路
	[switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not $SkipBuild) {
	# 前端构建时注入生产 API 地址(PUBLIC_ 前缀会在打包时被替换，必须在 build 前设置)
	$env:PUBLIC_UPLOAD_API = "http://$ServerIp"
	$env:PUBLIC_FILE_BASE_URL = "http://$ServerIp/files"

	Write-Host "==> npm ci" -ForegroundColor Cyan
	npm ci --no-audit --no-fund

	Write-Host "==> npm run build(PUBLIC_UPLOAD_API=$env:PUBLIC_UPLOAD_API)" -ForegroundColor Cyan
	npm run build
}

$stage = Join-Path $root '.deploy-stage'
$artifact = Join-Path $root 'myblog-artifact.tgz'

Write-Host "==> 打包产物" -ForegroundColor Cyan
if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
if (Test-Path $artifact) { Remove-Item -Force $artifact }
New-Item -ItemType Directory -Path $stage | Out-Null

foreach ($item in @('dist', 'server', 'deploy', 'package.json', 'package-lock.json')) {
	Copy-Item -Path (Join-Path $root $item) -Destination $stage -Recurse
}
tar -czf $artifact -C $stage .

$sizeMb = [math]::Round((Get-Item $artifact).Length / 1MB, 1)
Write-Host "==> 产物 $artifact(${sizeMb} MB)" -ForegroundColor Green

if ($DryRun) {
	Write-Host "==> DryRun：跳过上传与远端发布" -ForegroundColor Yellow
	Remove-Item -Recurse -Force $stage
	return
}

$sshArgs = @()
if ($SshKey) { $sshArgs = @('-i', $SshKey) }
$target = "$User@$ServerIp"

Write-Host "==> 上传到 ${target}:/tmp" -ForegroundColor Cyan
scp @sshArgs $artifact "${target}:/tmp/myblog-artifact.tgz"

Write-Host "==> 远端执行发布" -ForegroundColor Cyan
$remoteCmd = "mkdir -p /opt/myblog && tar -xzf /tmp/myblog-artifact.tgz -C /opt/myblog && bash /opt/myblog/deploy/deploy.sh /tmp/myblog-artifact.tgz"
ssh @sshArgs $target $remoteCmd

Remove-Item -Recurse -Force $stage
Write-Host "==> 完成：http://$ServerIp/" -ForegroundColor Green
