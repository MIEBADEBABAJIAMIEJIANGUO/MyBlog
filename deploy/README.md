# 部署到阿里云轻量服务器（无域名 · 2C2G）

目标形态：

```
浏览器  ──http://<IP>:80──>  nginx
                              ├── /        /var/www/myblog/dist   （Astro 静态产物）
                              ├── /api/    127.0.0.1:3001          （Express，SSE 关缓冲）
                              └── /files/  127.0.0.1:9000/uploads  （MinIO 公开读）
                            docker: mongo（127.0.0.1:27017）
                            docker: minio（127.0.0.1:9000 / 9001）
                            systemd: myblog-api（node server/index.js）
```

> 只开 22 / 80。3001、27017、9000、9001 全部只绑 127.0.0.1，绝不进安全组。

---

## 一、服务器初始化（只做一次）

### 1. 安全组

阿里云控制台 → 轻量应用服务器 → 防火墙：放行 **22**、**80**。别的都别开。

### 2. 登录并加 swap（2C2G 必做，否则 npm install 会 OOM）

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
# 尽量别用 swap（只作兜底）
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf && sudo sysctl -p
```

### 3. 装依赖

```bash
# Node 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs nginx git curl
node -v && nginx -v

# Docker（Debian/Ubuntu）
curl -fsSL https://get.docker.com | sudo sh
sudo systemctl enable --now docker
docker compose version
```

> Alibaba Cloud Linux / CentOS：把 `apt` 换成 `dnf`，Node 用 `dnf install nodejs`（确认版本 ≥ 22）或 nodesource 的 rpm 源。

### 4. 建目录与环境变量

```bash
sudo mkdir -p /opt/myblog /var/www/myblog
sudo cp /opt/myblog/deploy/server.env.example /opt/myblog/.env   # 首次发布后才有 deploy/ 目录
sudo nano /opt/myblog/.env      # 改 MINIO_ACCESS_KEY / MINIO_SECRET_KEY、填 IP、填 DEEPSEEK_API_KEY
sudo chmod 600 /opt/myblog/.env
```

`.env` 里至少改这三处：

| 变量 | 填什么 |
|---|---|
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | 自己设，≥8 位，别用 minioadmin |
| `PUBLIC_FILE_BASE_URL` | `http://<服务器IP>/files` |
| `DEEPSEEK_API_KEY` | 新生成的 key（不要用泄露过的那把） |
| `CORS_ORIGINS` | `http://<服务器IP>,http://localhost:4321` |

### 5. 装 systemd 服务

```bash
sudo cp /opt/myblog/deploy/myblog-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable myblog-api
```

### 6. 配 nginx

```bash
sudo cp /opt/myblog/deploy/nginx-myblog.conf /etc/nginx/conf.d/myblog.conf
sudo rm -f /etc/nginx/sites-enabled/default    # 避免抢占 80 默认站
sudo nginx -t && sudo systemctl reload nginx
```

---

## 二、日常发布（在本地 Windows 上跑）

```powershell
.\deploy\build-local.ps1 -ServerIp 47.100.xx.xx
```

脚本做四件事：

1. 用 `PUBLIC_UPLOAD_API=http://<IP>` 重新构建前端（这两个变量是**构建时注入**，不设就会指向 localhost:3001）
2. 打包 `dist/ server/ deploy/ package.json package-lock.json`
3. scp 到服务器 `/tmp`
4. ssh 执行 `deploy/deploy.sh`：装依赖 → 发布静态站 → 拉起 mongo/minio → 重启 API → 健康检查 → reload nginx

指定密钥和用户：

```powershell
.\deploy\build-local.ps1 -ServerIp 47.100.xx.xx -User root -SshKey C:\Users\me\.ssh\aliyun.pem
```

---

## 三、上线后验证

```bash
# 1. 依赖健康
curl http://127.0.0.1:3001/api/health
# 期望：{"code":0,"success":true,"data":{"mongo":true,"minio":true}}

# 2. 静态站
curl -I http://127.0.0.1/                    # 200
curl -I http://127.0.0.1/resume              # 200（简历页）

# 3. 外网
curl -I http://47.100.xx.xx/

# 4. 上传一个文件后，确认 /files/ 能取到
```

页面自检：`/upload` 能传、`/files` 能列、首页 Agent 能流式回复。

---

## 四、2C2G 内存预算

| 进程 | 预算 |
|---|---|
| 系统 + nginx | ~350MB |
| mongo（`--wiredTigerCacheSizeGB 0.35`） | ~600MB |
| minio | ~200MB |
| node（`--max-old-space-size=512`） | ~250MB |
| **合计** | **~1.4GB / 2GB + 2GB swap 兜底** |

所以：**不要在服务器上跑 `npm run build`**（Astro + sharp + three 构建峰值轻松超 1.5G）。构建放本地，`npm ci --omit=dev` 只装依赖。

---

## 五、没有域名的两个硬限制

1. **摄像头功能用不了**：`/gesture`、`/ironman` 依赖 `getUserMedia`，浏览器只在 **HTTPS 或 localhost** 下允许。`http://IP` 打开会直接报权限错误。
2. **没有 TLS**：`navigator.clipboard`（复制邮箱/链接）在 http 下也会降级或失败（代码里已做 `execCommand` 兜底）。

想解决又不买域名，两条路：

- **Cloudflare Tunnel**（最快）：服务器上装 `cloudflared`，`cloudflared tunnel --url http://localhost:80` 会给你一个 `https://xxx.trycloudflare.com` 临时地址，摄像头可用（缺点：地址每次变、国内访问不稳）。
- **买个便宜域名**：¥10/年的 `.top` 之类，但**大陆服务器必须 ICP 备案**才能用 80/443 域名访问，备案要 7–20 天。

---

## 六、备份与排障

```bash
# MongoDB 备份（每天一次，加到 crontab）
docker exec myblog-mongo mongodump --db eccentric-event --archive=/tmp/mongo-$(date +%F).gz --gzip
# MinIO 数据就在卷里，随磁盘快照备份
sudo tar -czf /root/minio-$(date +%F).tgz -C /var/lib/docker/volumes/myblog_minio_data/_data .

# 日志
journalctl -u myblog-api -f          # API
docker logs -f myblog-mongo          # Mongo
docker logs -f myblog-minio          # MinIO
sudo tail -f /var/log/nginx/myblog.error.log

# 常见问题
# 502            → myblog-api 没起来：systemctl status myblog-api
# 上传 503       → MinIO 没起：docker compose ... ps，或 /api/health 看 minio 字段
# 聊天不流式     → nginx 少了 proxy_buffering off
# 图片 403       → minio 初始化没设成公开读，重启一次 API 即可
```

---

## 七、文件清单

| 文件 | 作用 |
|---|---|
| `deploy/nginx-myblog.conf` | nginx 站点配置（静态 + /api + /files，SSE 关缓冲） |
| `deploy/docker-compose.prod.yml` | mongo + minio，只绑本机、限内存 |
| `deploy/myblog-api.service` | API 的 systemd 单元 |
| `deploy/server.env.example` | 服务器端环境变量模板 |
| `deploy/deploy.sh` | 服务器端发布脚本 |
| `deploy/build-local.ps1` | 本地构建 + 上传 + 触发发布 |
