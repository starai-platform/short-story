# 章回：AI 短篇小说生成器

一个面向中文多章节小说创作的多人 Web 应用。每部小说选择一个小说类型，先生成全书大纲，再按章节逐次调用 OpenAI 兼容接口并流式保存正文，支持 10–50 章、2–10 万字。

## 功能

- 邮箱密码注册、登录与用户数据隔离
- 主流系统小说类型，每种分别包含大纲 Prompt 与章节 Prompt
- 用户私有小说类型的新建、编辑、复制、启停和软删除
- 小说项目、人物弧光和 10–50 章结构化大纲
- 每章流式生成并进行最低字数验收，过短时自动续写，可逐章或连续生成
- 前章事实摘要和上章结尾共同维持剧情连续性
- 中断恢复、章节级重试、进度统计与整书 TXT 导出
- SQLite 零配置本地启动，或 PostgreSQL + Docker Compose 部署

## 选择数据库并一键启动

两种模式功能完全一致，数据文件互相独立：

同一时间建议只启动一种模式，因为两者默认都使用 `3000` 端口；需要并行测试时可为 SQLite 设置 `PORT=3010`。

| 模式 | 适合场景 | 依赖 | 数据位置 |
| --- | --- | --- | --- |
| SQLite | 个人使用、快速体验、轻量部署 | Node.js 22+、pnpm 11 | `prisma/novel.sqlite` |
| PostgreSQL + Docker | 多用户、正式部署、长期运行 | Docker Desktop / Docker Engine | Docker `postgres_data` 卷 |

### 宝塔面板部署

项目支持在宝塔 Linux 面板中使用以下两种方式部署：

- SQLite：无需安装数据库，适合个人、少量用户和低并发使用。
- PostgreSQL + Docker：数据可靠性和并发能力更好，推荐正式运营环境使用。

完整教程包含宝塔软件安装、环境变量、进程守护、Nginx 反向代理、SSE 流式输出、HTTPS、管理员初始化、升级、备份恢复及故障排查：

> [宝塔面板部署教程](docs/BAOTA_DEPLOYMENT.md)

### 提交到 Git 前检查

`.gitignore` 已排除真实环境变量、SQLite 数据库、用户上传、依赖、构建缓存、日志、测试报告、备份和编辑器文件，并保留 `.env.example` 与 `.env.sqlite.example` 两个安全模板。

如果这些文件过去已经被 Git 跟踪，仅修改 `.gitignore` 不会自动移除它们。请先确认重要数据已有备份，再只从 Git 索引中取消跟踪：

```bash
git rm -r --cached --ignore-unmatch node_modules .next coverage public/uploads
git rm --cached --ignore-unmatch .env .env.local .env-1 prisma/novel.sqlite
git add .gitignore .env.example .env.sqlite.example public/uploads/.gitkeep
git status
```

该操作不会删除工作目录中的实际文件。如果密钥曾经提交到远程仓库，仅取消跟踪并不足以保证安全，还应立即更换 `AUTH_SECRET`、`MODEL_ENCRYPTION_KEY`、模型 API Key、数据库密码和管理员密码。

### 方式一：SQLite 一键启动（无需安装数据库）

1. 安装依赖并准备环境变量：

```bash
pnpm install
```

将 `.env.sqlite.example` 复制为 `.env`。`AUTH_SECRET` 和 `ADMIN_PASSWORD` 都可以留空：首次启动会自动生成并保存到 `.env.local`，以后启动继续复用。默认管理员邮箱为 `admin@example.com`，初始密码会显示在启动控制台；也可以在首次启动前自行设置 `ADMIN_EMAILS` 和 `ADMIN_PASSWORD`。模型既可以填写 `LLM_*`，也可以启动后由管理员在“AI 模型”中配置。

2. 一键启动：

- Windows：双击 `start-sqlite.cmd`
- macOS / Linux：运行 `sh start-sqlite.sh`
- 命令行：运行 `pnpm sqlite`

首次运行会自动生成 SQLite Client、创建数据库、同步全部表结构、写入系统小说类型并启动开发服务。再次运行会保留原有账号、作品和设置。

生产方式启动：

```bash
pnpm sqlite:prod
```

备份时只需复制 `prisma/novel.sqlite`。如需修改保存路径，可设置 `SQLITE_DATABASE_URL`。

### 方式二：PostgreSQL + Docker 一键启动

1. 复制 `.env.example` 为 `.env`。
2. 至少填写以下配置：

```env
AUTH_SECRET="使用 openssl rand -base64 32 生成"
ADMIN_EMAILS="admin@example.com"
MODEL_ENCRYPTION_KEY="另一段足够长的随机密钥"
LLM_BASE_URL="https://你的兼容服务/v1"
LLM_API_KEY="你的 API Key"
LLM_MODEL="服务支持的模型 ID"
LLM_MAX_OUTPUT_TOKENS="16000"
LLM_OUTLINE_MAX_OUTPUT_TOKENS="32768"
LLM_OUTLINE_RESPONSE_FORMAT="text"
LLM_CHAPTER_MAX_CALLS="3"
```

`LLM_OUTLINE_RESPONSE_FORMAT` 默认使用兼容性最好的 `text`：模型仍被要求只输出 JSON，服务端会本地修正常见的代码块、尾逗号、中文标点和字符串换行，再进行严格字段校验，不会额外调用模型。只有确认供应商完整支持 Chat Completions `json_schema` 时才建议改为 `json_schema`。

`ADMIN_EMAILS` 支持使用英文逗号配置多个管理员邮箱。管理员登录后会看到“管理”菜单，可维护小说类型、AI 模型、用户、兑换码与系统设置。系统设置支持站点名称、LOGO、ICO、页面 Title、站点描述和首页版权配置；上传图片保存在 Docker 的 `site_uploads` 持久化卷中。数据库模型未配置时继续使用 `LLM_*` 环境变量；配置数据库模型后，可分别指定默认与备用模型，以及输入/输出每百万 Token 单价和费率倍数。API Key 使用 `MODEL_ENCRYPTION_KEY`（未设置时回退到 `AUTH_SECRET`）进行 AES-256-GCM 加密后保存。

如果配置了 `ADMIN_PASSWORD`，种子脚本会在管理员邮箱尚未注册时自动创建管理员账号；留空时需要先在注册页面使用 `ADMIN_EMAILS` 中的邮箱自行注册。

算力点按 `（输入 Token × 输入单价 + 输出 Token × 输出单价）÷ 1,000,000 × 费率倍数` 扣除，1 元对应 1 算力点。环境变量模型默认价格为 0，不会在升级后意外扣除旧用户余额。

3. 一键启动：

- Windows：双击 `start-postgresql.cmd`
- macOS / Linux：运行 `sh start-postgresql.sh`
- 命令行：

```bash
pnpm postgres
```

访问 `http://localhost:3000`。容器启动时会自动执行数据库迁移并写入系统小说类型。

停止 PostgreSQL Docker 服务：

```bash
pnpm postgres:stop
```

## 本地开发

使用 PostgreSQL 进行本地开发时，需要 Node.js 22+、pnpm 11 和 PostgreSQL。

```bash
pnpm install
pnpm prisma generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

数据库连接使用 `.env` 中的 `DATABASE_URL`。开发环境可以启动 Compose 中的数据库，再把地址设为 `localhost:5432`。

## 验证

```bash
pnpm test
pnpm typecheck
pnpm build
```

健康检查：`GET /api/health`。响应只报告数据库和模型配置状态，不返回任何密钥。

## 接口说明

- `POST /api/auth/register`
- `GET|POST /api/prompt-types`
- `GET|PATCH|DELETE /api/prompt-types/:id`
- `POST /api/prompt-types/:id/copy`
- `GET|POST /api/projects`
- `GET|DELETE /api/projects/:id`
- `POST /api/projects/:id/outline`
- `POST /api/projects/:id/chapters/:number/generate`
- `GET /api/projects/:id/export`
- `POST /api/generations/stream`
- `GET /api/generations`
- `GET|DELETE /api/generations/:id`
- `GET /api/health`

章节生成返回 SSE 事件：`meta`、`delta`、`done`、`error`。模型 SDK 的故障重试已关闭；如果正文未达到“目标字数 85% 且至少 2000 字”，同一章节会自动续写，最多调用 `LLM_CHAPTER_MAX_CALLS` 次。仍不达标会保留内容并标记为“字数不足”，不会伪装成完成。连续生成由浏览器按章节顺序调度，每章达标即保存；页面关闭后可继续补写。

单个模型响应直接输出 10 万字通常会被供应商 Token 上限截断。因此“一本小说一个小说类型”保持不变，但大纲和每章正文是独立、可恢复的模型任务。

## 当前边界

这是受控多人测试版，不包含邮件验证、找回密码、内容审核、多人协作或公开作品社区。正式公开运营前还需要补充频率限制、内容安全、账号找回、隐私合规和运维告警。
