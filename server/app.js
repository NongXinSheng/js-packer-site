// app.js
// 在线 JS 压缩 / 混淆 / Packer 打包工具 —— 后端主入口
//
// 安全设计要点：
//  1. 只对用户提交的 JS 做「字符串处理」，绝不在服务器上执行用户代码。
//  2. 全程使用 terser / javascript-obfuscator 的 Node API，不走 shell，杜绝命令注入。
//  3. 限制请求体大小、单段代码体积、按 IP 限流。
//  4. 不在磁盘落地用户文件，结果直接以文本返回，前端用 Blob 下载，无需清理临时文件。

const path = require("path");
const express = require("express");
const rateLimit = require("express-rate-limit");

const { minifyCode } = require("./services/minify");
const { obfuscateCode } = require("./services/obfuscate");
const { packCode } = require("./services/pack");

const app = express();

// 监听端口（可用环境变量覆盖，宝塔里通常用 3000）
const PORT = process.env.PORT || 3000;

// 单段代码最大字节数（默认 5MB）。可用环境变量 MAX_CODE_BYTES 覆盖。
const MAX_CODE_BYTES = Number(process.env.MAX_CODE_BYTES) || 5 * 1024 * 1024;

// 信任反向代理（宝塔 Nginx），让限流能正确识别真实 IP
app.set("trust proxy", 1);

// 解析 JSON 请求体，限制大小
app.use(express.json({ limit: "8mb" }));

// 简单安全响应头（不依赖 helmet，避免 CSP 调试成本）
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

// 接口限流：每个 IP 每分钟最多 30 次构建
const buildLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "请求过于频繁，请稍后再试" },
});

// 静态前端
app.use(express.static(path.join(__dirname, "public")));

// 健康检查
app.get("/api/health", (req, res) => {
  res.json({ success: true, ts: Date.now() });
});

/**
 * 统一构建接口
 * 请求体：
 * {
 *   code: string,                 // 原始 JS
 *   filename?: string,            // 文件名（仅用于下载命名）
 *   steps?: { minify, obfuscate, pack },  // 各步骤开关，默认全开
 *   obfuscatorOptions?: {...}     // 见 services/obfuscate.js
 * }
 */
app.post("/api/build", buildLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const code = body.code;

    if (typeof code !== "string" || code.trim() === "") {
      return res
        .status(400)
        .json({ success: false, error: "code 不能为空", stage: "input" });
    }

    const codeBytes = Buffer.byteLength(code, "utf8");
    if (codeBytes > MAX_CODE_BYTES) {
      return res.status(413).json({
        success: false,
        error:
          "代码体积超过限制（" +
          (MAX_CODE_BYTES / 1024 / 1024).toFixed(1) +
          "MB）",
        stage: "input",
      });
    }

    const steps = body.steps || {};
    // 三个步骤默认都执行；只要某一步显式为 false 才跳过
    const doMinify = steps.minify !== false;
    const doObfuscate = steps.obfuscate !== false;
    const doPack = steps.pack !== false;

    const obfOptions = body.obfuscatorOptions || {};

    const result = {
      original: { size: codeBytes },
    };

    // 当前流水线中正在被处理的代码
    let current = code;

    // 1) 压缩
    if (doMinify) {
      try {
        const min = await minifyCode(current);
        result.min = { code: min, size: Buffer.byteLength(min, "utf8") };
        current = min;
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: e.message || "压缩失败",
          stage: "minify",
        });
      }
    }

    // 2) 混淆
    if (doObfuscate) {
      try {
        const obf = obfuscateCode(current, obfOptions);
        result.obf = { code: obf, size: Buffer.byteLength(obf, "utf8") };
        current = obf;
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: e.message || "混淆失败",
          stage: "obfuscate",
        });
      }
    }

    // 3) Packer 打包
    if (doPack) {
      try {
        const packed = packCode(current);
        result.pack = {
          code: packed,
          size: Buffer.byteLength(packed, "utf8"),
        };
        current = packed;
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: e.message || "打包失败",
          stage: "pack",
        });
      }
    }

    // 最终产物（最后执行的那一步）
    result.final = { code: current, size: Buffer.byteLength(current, "utf8") };

    return res.json({ success: true, result });
  } catch (err) {
    console.error("[/api/build] 未捕获错误:", err);
    return res
      .status(500)
      .json({ success: false, error: "服务器内部错误", stage: "server" });
  }
});

// 兜底：未匹配的路由回到首页（单页工具）
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`JS Packer 服务已启动: http://127.0.0.1:${PORT}`);
});
