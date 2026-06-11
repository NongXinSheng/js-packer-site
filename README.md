<div align="center">

# JS Packer

**在线 JS 压缩 / 混淆 / Packer 打包工具**

把 JavaScript 依次做 `Terser 压缩 → javascript-obfuscator 混淆 → 自定义 eval Packer 打包`，
粘贴或上传 `.js`，在线预览并下载结果。Node 全栈、零构建、可自部署。

![license](https://img.shields.io/badge/license-MIT-blue)
![node](https://img.shields.io/badge/node-%3E%3D18-3fb950)
![stack](https://img.shields.io/badge/stack-Express%20%2B%20Terser%20%2B%20obfuscator-f5b340)

<!-- 建议在此放一张运行截图：docs/screenshot.png -->
<!-- ![screenshot](docs/screenshot.png) -->

</div>

---

## ✨ 特性

- **三段式流水线**：压缩 → 混淆 → 打包，每一步都能单独开关。
- **eval Packer**：生成经典 `eval(function(p,a,c,k,e,r){...})` 结构，**UTF-8 安全**（中文、引号都能正确还原），不依赖老旧的 `packer` npm 包。
- **安全 / 强混淆双模式**：默认安全参数对 H5 / WebView / 小程序最友好；强混淆（控制流扁平化、死代码注入、自我防护）可一键开启并有兼容性提示。
- **零构建前端**：原生 HTML/CSS/JS，无 Vite/打包步骤，后端直接静态托管，部署最省事。
- **可视化流水线**：实时显示「原始 → 压缩 → 混淆 → 打包」各阶段体积与压缩率。
- **不执行用户代码**：服务端只做字符串处理，全程 Node API，无 shell 拼接、无命令注入。

## 🧩 处理流程

```txt
源文件 *.js
   │  Terser 压缩
   ▼
*.min.js
   │  javascript-obfuscator 混淆
   ▼
*.obf.js
   │  自定义 eval Packer 打包
   ▼
*.pack.js
```

## 🚀 快速开始

```bash
git clone <你的仓库地址>
cd js-packer-web/server
npm install
npm start
# 打开 http://127.0.0.1:3000
```

## 📡 API

`POST /api/build`

```json
{
  "code": "原始 JS 代码",
  "filename": "demo.js",
  "steps": { "minify": true, "obfuscate": true, "pack": true },
  "obfuscatorOptions": {
    "compact": true,
    "stringArray": true,
    "stringArrayEncoding": "base64",
    "stringArrayThreshold": 0.75,
    "renameGlobals": false,
    "strongMode": false
  }
}
```

返回 `result.min / result.obf / result.pack` 为各阶段产物及体积，`result.final` 为最终产物。

## 🛠 技术栈

| 层 | 选型 |
| --- | --- |
| 后端 | Node.js + Express |
| 处理 | terser · javascript-obfuscator · 自定义 Packer |
| 前端 | 原生 HTML / CSS / JS（无构建） |
| 守护 | PM2 |
| 代理 | Nginx |

## 📦 部署

支持本地运行与服务器自部署。宝塔面板（Node 项目 + PM2 + 反向代理 + SSL）的完整步骤见 **[DEPLOY.md](./DEPLOY.md)**。

> 提示：在线复制功能用到 `navigator.clipboard`，浏览器仅在 HTTPS 下放行，生产环境请务必配置 SSL。

## ⚙️ 配置

| 环境变量 | 说明 | 默认 |
| --- | --- | --- |
| `PORT` | 服务端口 | `3000` |
| `MAX_CODE_BYTES` | 单段代码体积上限（字节） | `5242880`（5MB） |

限流（每 IP 每分钟构建次数）可在 `server/app.js` 的 `buildLimiter` 调整。

## 🔒 安全

- 只对提交的 JS 做字符串处理，**绝不在服务器执行用户代码**；
- 全程使用 Node API，不拼接 shell 命令，无命令注入风险；
- 限制请求体与单段代码体积，按 IP 限流；
- 结果以文本返回，不在磁盘落地用户文件。

## 📁 目录结构

```txt
js-packer-web/
├── server/
│   ├── app.js                # Express 主入口
│   ├── services/             # minify / obfuscate / pack
│   └── public/               # 前端静态资源
├── ecosystem.config.js       # PM2 配置
├── README.md
└── DEPLOY.md                 # 部署文档
```

## ⚠️ 免责声明

本工具仅用于**合法的前端代码保护、体积优化与学习研究**。使用者需对所处理与发布的代码负责，并遵守所在地区的法律法规；请勿用于任何违法、侵权或恶意用途。作者不对使用本工具产生的任何后果负责。

## 📄 License

[MIT](./LICENSE)
