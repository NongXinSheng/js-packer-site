# 宝塔面板 11.6.0 部署文档（Node 项目）

本文针对 **宝塔 Linux 面板 11.6.0** 部署本项目。整体路线：

```txt
上传源码 → 安装 Node 版本 + PM2 管理器 → 安装依赖 → PM2 启动(端口 3000)
→ 放行端口 → 绑定域名 + Nginx 反向代理 → 配置 SSL
```

> 你已经有「专门的 Node 网站部署」环境，那就直接走下面的 PM2 流程即可，不需要再装 PHP。

---

## 一、环境准备

### 1. 安装 Node 版本

宝塔左侧菜单：**软件商店 → 搜索「Node 版本管理器」(Node.js version manager) → 安装**。
安装后打开它，安装一个 **Node 18 或 Node 20**（推荐 20 LTS），并点「设为命令行版本」。

> 本项目兼容 Node 18+。

### 2. 安装 PM2 管理器

**软件商店 → 搜索「PM2 管理器」→ 安装**。
打开 PM2 管理器设置，选择刚才装好的 Node 版本作为 PM2 运行版本。

---

## 二、上传源码

1. 左侧 **文件**，进入建站目录 `/www/wwwroot/`。
2. 新建目录，例如 `js-packer-site`，完整路径：

   ```txt
   /www/wwwroot/js-packer-site
   ```

3. 把本项目上传进去。**注意：不要上传 `node_modules`**（体积大且跨平台不通用，依赖在服务器上重新安装）。

上传后目录应是：

```txt
/www/wwwroot/js-packer-site
├── server/
├── ecosystem.config.js
├── README.md
└── DEPLOY.md
```

---

## 三、安装依赖

左侧 **文件**，进入 `/www/wwwroot/js-packer-site/server`，点右上角 **终端**（或用 SSH），执行：

```bash
cd /www/wwwroot/js-packer-site/server
npm install --production
```

> 国内服务器如果 npm 慢，可先换源：
> ```bash
> npm config set registry https://registry.npmmirror.com
> npm install --production
> ```

装完后 `server/node_modules` 会出现，里面包含 `express`、`terser`、`javascript-obfuscator` 等。

### 先在终端自测一次

```bash
node app.js
```

看到 `JS Packer 服务已启动: http://127.0.0.1:3000` 即正常。按 `Ctrl + C` 停掉，进入 PM2 托管。

---

## 四、用 PM2 启动（二选一）

### 方案 A：用启动文件（最简单，推荐新手）

PM2 管理器 → **添加项目**：

| 项目 | 填写 |
| --- | --- |
| 项目名称 | `js-packer` |
| 运行目录 | `/www/wwwroot/js-packer-site/server` |
| 启动文件 | `app.js` |
| 端口 | `3000` |
| Node 版本 | 选你装的 18 / 20 |

提交后状态为 **运行中 / online** 即成功。

### 方案 B：用 ecosystem 配置文件（官方推荐写法）

宝塔的 PM2 通常识别 **`ecosystem.config.cjs`**。本项目自带 `ecosystem.config.js`，如果面板要求 `.cjs`，复制一份改名即可：

```bash
cd /www/wwwroot/js-packer-site
cp ecosystem.config.js ecosystem.config.cjs
```

然后 PM2 管理器添加项目时选择「配置文件」方式，指向：

```txt
/www/wwwroot/js-packer-site/ecosystem.config.cjs
```

或直接在终端：

```bash
cd /www/wwwroot/js-packer-site
pm2 start ecosystem.config.js   # 或 ecosystem.config.cjs
pm2 save                        # 保存进程列表
pm2 startup                     # 生成开机自启（按提示执行输出的命令）
```

> `ecosystem.config.js` 里已配置 `PORT=3000`、`max_memory_restart=300M`、`MAX_CODE_BYTES=5MB`，可按需修改。

---

## 五、放行端口

1. 宝塔左侧 **安全** → 放行 **3000** 端口（如果只通过域名访问，这步可省，但调试期建议放行先用 IP 测试）。
2. **云服务器还要在云控制台安全组放行 3000**（阿里云 / 腾讯云的安全组，否则外网访问不到）。

此时浏览器访问 `http://服务器IP:3000` 应能打开页面。

---

## 六、绑定域名 + Nginx 反向代理

为了用域名（不带端口）访问：

1. 左侧 **网站 → 添加站点**：

   - 域名：填你的域名，如 `tool.yourdomain.com`
   - 根目录：随便（反向代理用不到，可指向项目目录）
   - PHP 版本：选 **纯静态 / 不需要 PHP**

2. 进入该站点设置 → **反向代理 → 添加反向代理**：

   | 项目 | 填写 |
   | --- | --- |
   | 代理名称 | `js-packer` |
   | 目标 URL | `http://127.0.0.1:3000` |
   | 发送域名 | `$host` |

提交后，访问 `http://tool.yourdomain.com` 就能打开工具站了。

> 反向代理后，服务只监听本地 `127.0.0.1:3000`，外网无需再开放 3000，更安全。可把第五步在防火墙开放的 3000 关掉，只保留 80/443。

---

## 七、配置 HTTPS（强烈建议）

工具站要用到 **剪贴板复制**（`navigator.clipboard`），现代浏览器**只在 HTTPS 下**才允许，所以一定要上 SSL：

站点设置 → **SSL → Let's Encrypt**，勾选域名，申请并 **强制 HTTPS**。

完成后用 `https://tool.yourdomain.com` 访问。

---

## 八、安全与运维

项目本身已内置：

- 只做字符串处理，不执行用户代码；
- 全程 Node API，不拼接 shell，杜绝命令注入；
- 请求体上限 8MB、单段代码上限 5MB（环境变量 `MAX_CODE_BYTES` 可调）；
- 每 IP 每分钟 30 次构建限流。

建议再补：

1. **改端口/隐藏**：3000 不对外开放，只走反向代理。
2. **日志**：PM2 管理器里可看实时日志；`pm2 logs js-packer` 排错。
3. **资源**：`max_memory_restart` 防止极端输入吃满内存。
4. 如需更严限流，调 `server/app.js` 里的 `buildLimiter`（`windowMs` / `max`）。

---

## 九、更新版本

改完代码后重新上传 `server/` 下变更文件，然后：

```bash
cd /www/wwwroot/js-packer-site/server
npm install --production   # 依赖有变动时才需要
pm2 restart js-packer
```

或在 PM2 管理器界面点「重启」。

---

## 十、常见报错排查

### 1. PM2 启动后端口 OFF / 秒级自动关闭

- 多半是 `app.js` 报错。终端 `cd server && node app.js` 直接跑，看真实错误。
- 依赖没装全：重新 `npm install --production`。
- 端口被占用：`PORT` 改成别的（如 3001），反向代理同步改。

### 2. 外网打不开、IP:3000 访问不了

- 云服务器**安全组没放行 3000**（最常见）。
- 宝塔 **安全** 里没放行 3000。
- 已配反向代理的话，直接用域名访问，别再用 IP:3000。

### 3. 域名能开页面，但「复制口令」点了没反应

- 没上 HTTPS。`navigator.clipboard` 在 HTTP 下被浏览器禁用。按第七步配 SSL。
- 本项目已对此做降级（`execCommand` 兜底），但仍建议上 HTTPS。

### 4. `npm install` 报 node-gyp / Visual Studio / contextify

- 你大概率误装了老的 `packer` 包。本项目**不依赖** `packer`，打包用自带的 `server/services/pack.js`。
- 删掉多余依赖重装：`rm -rf node_modules && npm install --production`。

### 5. 上传/粘贴代码后点「生成」报 SyntaxError

- 这是**你输入的 JS 本身**有语法问题（Terser/obfuscator 会校验）。
- 错误信息里 `stage` 会标明是在 `minify` / `obfuscate` / `pack` 哪一步失败，先修源码。

### 6. 打包后页面 `Unexpected end of input`

- 不要手动 `res.replace('eval("','').replace('")','')` 截断混淆代码。
- 后端最好直接返回 JSON，或前端用 `eval(res)` 整体执行。详见原《执行教程》第十一、十二节。

---

## 十一、可选：用宝塔「网站 → Node 项目」入口

宝塔较新版也提供 **网站 → 添加 Node 项目** 的图形入口，本质同样是 PM2 + 反向代理：

- 项目路径：`/www/wwwroot/js-packer-site/server`
- 启动方式：`npm start`（即 `node app.js`）
- 端口：`3000`
- 提交后面板会自动生成反向代理，绑定域名即可。

两种入口选一个即可，不要重复启动同一端口。
