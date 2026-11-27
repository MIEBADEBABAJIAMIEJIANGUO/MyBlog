# 文件说明：纯静态发布（当前站点只保留简历页，不需要 Node/Mongo/MinIO）。
# 做的事：本地构建 → 打包 dist → 上传 → 覆盖站点目录 → 重载 nginx，全程一条命令。
#
# 用法：
#   deploy\publish-static.cmd 116.62.103.168 -SshKey C:\Users\Administrator\.ssh\my-blog.pem
#
# 前置：服务器已装 nginx 且 /etc/nginx/sites-enabled/myblog 指向 deploy/nginx-static.conf

param(
	[Parameter(Mandatory = $true)][string]$ServerIp,
	[string]$User = 'root',
	[string]$SshKey = '',
	[string]$WebRoot = '/var/www/myblog',
	[switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not $SkipBuild) {
	Write-Host '==> npm run build' -ForegroundColor Cyan
	npm run build
	if ($LASTEXITCODE -ne 0) { throw "build failed ($LASTEXITCODE)" }
}

$stage = Join-Path $root '.deploy-stage'
$artifact = Join-Path $root 'dist-static.tgz'
if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
if (Test-Path $artifact) { Remove-Item -Force $artifact }
New-Item -ItemType Directory -Path $stage | Out-Null
Copy-Item -Path (Join-Path $root 'dist\*') -Destination $stage -Recurse
tar -czf $artifact -C $stage .
Remove-Item -Recurse -Force $stage
$sizeMb = [math]::Round((Get-Item $artifact).Length / 1MB, 2)
Write-Host "==> package ${sizeMb} MB" -ForegroundColor Green

$sshArgs = @()
if ($SshKey) { $sshArgs = @('-i', $SshKey) }
$sshArgs += @('-o', 'BatchMode=yes')
$target = "${User}@${ServerIp}"

Write-Host "==> upload to ${ServerIp}:/tmp" -ForegroundColor Cyan
scp @sshArgs $artifact "${target}:/tmp/dist-static.tgz"

Write-Host '==> switch site on server' -ForegroundColor Cyan
$remote = "set -e; rm -rf $WebRoot; mkdir -p $WebRoot; tar -xzf /tmp/dist-static.tgz -C $WebRoot; chmod -R a+rX $WebRoot; nginx -t >/dev/null; systemctl reload nginx; curl -fsS -o /dev/null http://127.0.0.1/ && echo DEPLOY_OK"
ssh @sshArgs $target $remote

Remove-Item -Force $artifact
Write-Host "==> done: http://${ServerIp}/" -ForegroundColor Green
