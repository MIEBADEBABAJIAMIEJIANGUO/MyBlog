#!/usr/bin/env bash
# 文件说明：服务器端发布脚本（由本地 build-local.ps1 通过 ssh 调用）。
# 做的事：解压产物 → 安装生产依赖 → 发布静态站 → 拉起 mongo/minio → 重启 API → 健康检查。
#
# 用法：bash /opt/myblog/deploy/deploy.sh /tmp/myblog-artifact.tgz

set -euo pipefail

APP_DIR=/opt/myblog
WEB_DIR=/var/www/myblog
ARTIFACT=${1:-/tmp/myblog-artifact.tgz}

[[ -f "$ARTIFACT" ]] || { echo "找不到产物：$ARTIFACT"; exit 1; }
[[ -f "$APP_DIR/.env" ]] || { echo "缺少 $APP_DIR/.env，请先从 deploy/server.env.example 复制并填写"; exit 1; }

echo "==> 解压产物到 $APP_DIR"
mkdir -p "$APP_DIR" "$WEB_DIR" "$APP_DIR/uploads"
tar -xzf "$ARTIFACT" -C "$APP_DIR"

echo "==> 安装生产依赖（首次约 3-5 分钟，2G 机器请确认已配 swap）"
cd "$APP_DIR"
npm ci --omit=dev --no-audit --no-fund

echo "==> 发布静态站到 $WEB_DIR/dist"
rm -rf "$WEB_DIR/dist"
cp -r "$APP_DIR/dist" "$WEB_DIR/dist"
chmod -R a+rX "$WEB_DIR/dist"

echo "==> 拉起 MongoDB / MinIO"
docker compose --env-file "$APP_DIR/.env" -f "$APP_DIR/deploy/docker-compose.prod.yml" up -d
# 等 MinIO 起来，避免 API 启动时 503
for i in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:9000/minio/health/live >/dev/null 2>&1; then break; fi
  sleep 2
done

echo "==> 重启 API"
systemctl restart myblog-api
sleep 3

echo "==> 健康检查"
if ! curl -fsS http://127.0.0.1:3001/api/health; then
  echo
  echo "健康检查失败，查看日志：journalctl -u myblog-api -n 80 --no-pager"
  exit 1
fi
echo

echo "==> 校验并重载 nginx"
nginx -t
systemctl reload nginx

echo "完成。访问 http://$(curl -fsS https://api.ipify.org 2>/dev/null || echo '<服务器IP>')/"
