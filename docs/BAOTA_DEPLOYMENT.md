# 宝塔面板部署教程

本文适用于宝塔 Linux 面板。SQLite 适合轻量部署；PostgreSQL + Docker 更适合多用户和长期运行。两种方式只能选择一种，默认都监听本机 `3000` 端口。

## 一、部署前准备

建议服务器至少具备：

- Linux 64 位系统，2 核 CPU、4 GB 内存及 20 GB 可用磁盘；生成任务较多时建议增加内存。
- 已解析到服务器公网 IP 的域名。
- 宝塔面板、Nginx，以及有效的 OpenAI 兼容模型服务。
- 仅在防火墙开放 `80`、`443` 和宝塔面板管理端口；无需向公网开放 `3000` 或 `5432`。

在宝塔“软件商店”安装：

- 两种部署都安装 `Nginx`。
- SQLite 部署安装“Node.js 版本管理器”，选择 Node.js 22 或更高版本。
- PostgreSQL 部署安装“Docker 管理器”；应用和数据库都在容器中运行，不要求面板额外安装 PostgreSQL。

以下示例将项目放在 `/www/wwwroot/novel-s`。如果实际目录不同，请替换命令中的路径。

## 二、上传项目

可以通过宝塔文件管理器上传并解压，也可以在宝塔终端使用 Git：

```bash
cd /www/wwwroot
git clone 你的仓库地址 novel-s
cd /www/wwwroot/novel-s
```

不要把 `.env`、`.env.local`、SQLite 数据库或用户上传文件提交到 Git。它们应只存在于服务器，并纳入独立备份。

如果真实密钥曾经进入 Git 提交历史，应立即在相应服务中轮换密钥。后来添加 `.gitignore` 只能阻止新的误提交，不能从已有提交历史或远程仓库中抹除秘密。

## 三、方案 A：SQLite 部署

SQLite 不需要单独安装数据库，适合个人站点、内部测试和低并发访问。同一时间只运行一个应用进程，不要使用 PM2 cluster 多实例模式，也不要让两台服务器共享同一个 SQLite 文件。

### 1. 安装 pnpm

在宝塔 Node.js 版本管理器中将当前项目的命令行版本切换到 Node.js 22，然后执行：

```bash
node -v
corepack enable
corepack prepare pnpm@11.9.0 --activate
pnpm -v
cd /www/wwwroot/novel-s
pnpm install --frozen-lockfile
```

如果当前系统不允许使用 Corepack，可以使用宝塔 Node 项目管理器提供的 pnpm，版本建议为 10 或更高。

### 2. 配置环境变量

```bash
cd /www/wwwroot/novel-s
cp .env.sqlite.example .env
```

在宝塔文件管理器中编辑 `.env`：

```env
AUTH_SECRET=""
AUTH_TRUST_HOST="true"
ADMIN_EMAILS="admin@example.com"
ADMIN_PASSWORD="请设置8到72位的强密码"
MODEL_ENCRYPTION_KEY="请设置另一段至少32位的随机密钥"

LLM_BASE_URL="https://api.openai.com/v1"
LLM_API_KEY="你的模型API-Key"
LLM_MODEL="你的模型ID"
LLM_MAX_OUTPUT_TOKENS="16000"
LLM_OUTLINE_MAX_OUTPUT_TOKENS="32768"
LLM_CHAPTER_MAX_CALLS="3"
```

注意事项：

- `ADMIN_EMAILS` 可以用英文逗号配置多个管理员邮箱，第一个邮箱用于首次自动创建管理员。
- `ADMIN_PASSWORD` 建议首次部署时明确填写。登录后可在账户菜单修改，之后不要再通过环境变量重置。
- `AUTH_SECRET` 可以留空，一键启动器会生成随机密钥并写入 `.env.local`；此文件丢失会导致所有登录会话失效。
- `MODEL_ENCRYPTION_KEY` 用于加密管理端保存的模型 API Key，正式环境务必独立设置并永久保存。
- 如果准备登录后台后再添加模型，`LLM_API_KEY` 和 `LLM_MODEL` 可以暂时留空。

生成随机密钥可使用：

```bash
openssl rand -base64 48
```

### 3. 首次构建并试运行

```bash
cd /www/wwwroot/novel-s
chmod +x start-sqlite.sh
pnpm sqlite:prod
```

首次运行会依次生成 SQLite Prisma Client、创建或同步 `prisma/novel.sqlite`、写入系统小说类型、初始化管理员、构建 Next.js 并启动服务。看到 `http://localhost:3000` 后，在另一个终端检查：

```bash
curl http://127.0.0.1:3000/api/health
```

验证完成后按 `Ctrl+C` 停止前台进程，再配置进程守护。

### 4. 在宝塔中配置进程守护

在“网站 → Node 项目”中添加项目，不同宝塔版本的名称可能是“Node 项目管理器”：

- 项目目录：`/www/wwwroot/novel-s`
- Node 版本：22 或更高
- 启动方式：自定义命令
- 启动命令：`pnpm sqlite:prod`
- 运行用户：`www`
- 端口：`3000`
- 实例数：`1`
- 开机启动：开启

如果面板提示目录无权限，执行：

```bash
chown -R www:www /www/wwwroot/novel-s
chmod 750 /www/wwwroot/novel-s
chmod 770 /www/wwwroot/novel-s/prisma /www/wwwroot/novel-s/public/uploads
```

不要开启集群模式。SQLite 模式只允许一个写入进程。

## 四、方案 B：PostgreSQL + Docker 部署

这是正式多用户部署的推荐方案。PostgreSQL 数据和上传文件使用 Docker 命名卷持久化，重新构建 Web 容器不会删除数据。

### 1. 配置环境变量

```bash
cd /www/wwwroot/novel-s
cp .env.example .env
```

编辑 `.env`，至少填写：

```env
# 首次部署时设置；建议只使用字母、数字、下划线和短横线，避免URL转义问题
POSTGRES_USER="novel"
POSTGRES_PASSWORD="请设置高强度随机数据库密码"
POSTGRES_DB="novel"

AUTH_SECRET="使用openssl生成的至少32位随机密钥"
AUTH_TRUST_HOST="true"
ADMIN_EMAILS="admin@example.com"
ADMIN_PASSWORD="请设置8到72位的强密码"
MODEL_ENCRYPTION_KEY="另一段至少32位的随机密钥"

LLM_BASE_URL="https://api.openai.com/v1"
LLM_API_KEY="你的模型API-Key"
LLM_MODEL="你的模型ID"
LLM_MAX_OUTPUT_TOKENS="16000"
LLM_OUTLINE_MAX_OUTPUT_TOKENS="32768"
LLM_CHAPTER_MAX_CALLS="3"
```

`.env` 只能保存在服务器，不能提交到 Git，也不要通过聊天或截图公开。第一次启动时，如果 `ADMIN_EMAILS` 的第一个邮箱不存在且填写了 `ADMIN_PASSWORD`，系统会自动创建管理员账号。

当前 Compose 中 PostgreSQL 只连接 Docker 内部网络，没有映射公网 `5432` 端口。请保持这一设置。

`POSTGRES_USER`、`POSTGRES_PASSWORD` 和 `POSTGRES_DB` 只会在数据卷首次创建时初始化数据库。已有数据卷不会因为修改这三个变量而自动修改数据库账号；需要变更时应先备份，再由数据库管理员执行密码变更并同步更新环境配置。

### 2. 构建并启动

```bash
cd /www/wwwroot/novel-s
docker compose up -d --build
docker compose ps
docker compose logs -f web
```

Web 容器会等待数据库健康，然后自动执行 Prisma migration、种子初始化和 Next.js 启动。出现正常启动信息后按 `Ctrl+C` 只会退出日志查看，不会停止容器。

检查服务：

```bash
curl http://127.0.0.1:3000/api/health
```

常用管理命令：

```bash
docker compose ps
docker compose logs --tail=200 web
docker compose restart web
docker compose down
docker compose up -d
```

`docker compose down` 不会删除数据卷。不要执行 `docker compose down -v`，后者会删除 PostgreSQL 和上传文件数据。

## 五、配置宝塔网站和反向代理

两种数据库模式都使用同一套 Nginx 配置。

### 1. 新建网站

在宝塔“网站”中添加站点：

- 域名：填写已经解析的域名，例如 `novel.example.com`。
- PHP 版本：选择“纯静态”或“不使用 PHP”。
- 数据库：不创建。

进入站点“反向代理”，添加代理：

- 代理名称：`novel-s`
- 目标 URL：`http://127.0.0.1:3000`
- 发送域名：`$host`
- 缓存：关闭

### 2. 支持流式生成

小说生成使用 SSE 流式响应。打开站点 Nginx 配置，在反向代理的 `location /` 中确认包含以下配置；不要重复创建两个 `location /`：

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
    send_timeout 300s;
}
```

保存后在宝塔中重载 Nginx。配置检查失败时先恢复修改，不要强行重启。

### 3. 开启 HTTPS

进入站点“SSL”，申请 Let's Encrypt 证书并开启“强制 HTTPS”。完成后访问：

```text
https://你的域名/api/health
```

返回 JSON 且数据库状态正常，说明反向代理、应用和数据库已经连通。

## 六、首次登录和管理端配置

1. 使用 `.env` 中的 `ADMIN_EMAILS` 第一个邮箱和 `ADMIN_PASSWORD` 登录。
2. 进入右上角账户菜单修改初始密码。
3. 打开“管理中心 → AI 模型”，检查默认模型和备用模型。
4. 如果环境变量没有配置模型，在管理端添加 Base URL、API Key、模型 ID、输入/输出单价和费率倍数，并指定默认模型。
5. 在“系统设置”中配置站点名称、Logo、ICO、页面标题、描述和版权信息。
6. 用普通测试账号创建一部少章节小说，验证大纲和章节流式生成。

只有 `ADMIN_EMAILS` 中的邮箱拥有管理权限。修改该配置后需要重启应用。

## 七、升级项目

升级前必须先备份数据库、环境文件和上传目录。

### SQLite 升级

先在宝塔中停止 Node 项目，然后执行：

```bash
cd /www/wwwroot/novel-s
git pull
pnpm install --frozen-lockfile
```

随后在宝塔中重新启动项目。`pnpm sqlite:prod` 会同步 SQLite 表结构、更新系统小说类型并重新构建应用。

### PostgreSQL + Docker 升级

```bash
cd /www/wwwroot/novel-s
git pull
docker compose up -d --build
docker compose logs --tail=200 web
```

容器启动时会自动执行尚未应用的数据库迁移。

## 八、备份与恢复

### SQLite

为了获得一致的数据库文件，先在宝塔中停止 Node 项目，然后备份：

```bash
cd /www/wwwroot/novel-s
mkdir -p /www/backup/novel-s
cp prisma/novel.sqlite /www/backup/novel-s/novel-$(date +%F-%H%M%S).sqlite
cp .env .env.local /www/backup/novel-s/
tar -czf /www/backup/novel-s/uploads-$(date +%F-%H%M%S).tar.gz public/uploads
```

恢复时停止应用，将备份的数据库复制回 `prisma/novel.sqlite`，恢复 `.env`、`.env.local` 和上传目录，然后重新启动。`.env.local` 中的 `AUTH_SECRET` 必须一并恢复，否则现有登录会话全部失效；模型加密密钥丢失后，数据库里保存的模型 API Key 将无法解密。

### PostgreSQL

创建数据库备份：

```bash
cd /www/wwwroot/novel-s
mkdir -p /www/backup/novel-s
docker compose exec -T db pg_dump -U novel -d novel -Fc > /www/backup/novel-s/postgres-$(date +%F-%H%M%S).dump
docker run --rm -v novel-s_site_uploads:/data -v /www/backup/novel-s:/backup alpine tar -czf /backup/uploads-$(date +%F-%H%M%S).tar.gz -C /data .
cp .env /www/backup/novel-s/
```

卷名称会受项目目录名影响。先运行 `docker volume ls` 确认真实的 `site_uploads` 卷名，再执行上传文件备份命令。

恢复 PostgreSQL 属于覆盖性操作。务必停止 Web 写入、确认备份文件和目标数据库无误后，再使用 `pg_restore`；建议先恢复到临时数据库完成校验。

建议在宝塔“计划任务”中配置每日备份，并将备份同步到服务器之外的对象存储。只保存在同一块磁盘上的备份无法应对磁盘损坏。

## 九、常见问题

### 1. 宝塔显示 502 Bad Gateway

502 表示 Nginx 无法连接应用，不是模型输出过长。依次检查：

```bash
curl http://127.0.0.1:3000/api/health
ss -lntp | grep 3000
```

SQLite 查看宝塔 Node 项目日志；Docker 查看：

```bash
docker compose ps
docker compose logs --tail=200 web
```

常见原因包括应用未启动、构建失败、3000 端口被占用、反向代理端口写错或目录权限不足。

### 2. `MissingSecret` 或 `JWTSessionError`

- SQLite 必须通过 `pnpm sqlite:prod` 启动一次，让脚本生成并保存 `.env.local`。
- PostgreSQL 必须在 `.env` 设置稳定的 `AUTH_SECRET`。
- 不要在每次重启时随机生成新密钥。更换密钥会使已有登录状态失效，用户需要重新登录。

### 3. SQLite 提示数据库无法打开或只读

```bash
chown -R www:www /www/wwwroot/novel-s/prisma
chmod 770 /www/wwwroot/novel-s/prisma
```

同时确认磁盘空间充足，并且只有一个应用实例使用数据库文件。

### 4. 页面能打开，但生成长时间没有增量文字

确认 Nginx 已设置 `proxy_buffering off`，并将代理读取超时提高到 300 秒。然后检查模型 Base URL、API Key、模型 ID、余额及供应商输出 Token 上限。

### 5. 管理菜单不显示

登录邮箱必须与 `ADMIN_EMAILS` 完全一致，系统会统一转换为小写。修改环境变量后必须重启应用。若没有自动创建账号，可先通过注册页面使用管理员邮箱注册。

### 6. Docker 数据是否会在重新构建后丢失

正常执行 `docker compose up -d --build`、`restart` 或不带 `-v` 的 `down` 不会删除数据。禁止在没有备份时删除 `postgres_data`、`site_uploads` 卷或运行 `docker compose down -v`。

## 十、安全检查清单

- `.env`、`.env.local`、数据库和备份文件均未提交到 Git。
- `AUTH_SECRET` 与 `MODEL_ENCRYPTION_KEY` 使用不同的高强度随机值。
- 已修改管理员初始密码，且管理员邮箱不是公开测试邮箱。
- 仅开放 80、443 和必要的面板管理端口。
- PostgreSQL 5432 与应用 3000 未直接暴露公网。
- 网站已启用 HTTPS，宝塔面板也限制了访问 IP 并开启安全入口。
- 已配置站外备份并实际演练过恢复。
- 已关闭 Nginx 代理缓存和缓冲，SSE 流式生成正常。
