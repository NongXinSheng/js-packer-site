// services/minify.js
// 使用 Terser 的 Node API 进行压缩，不走 shell 命令，避免命令注入风险。
const { minify } = require("terser");

/**
 * 压缩 JS 代码
 * @param {string} code 原始 JS 源码
 * @param {object} [opts] 可选项
 * @param {boolean} [opts.compress=true] 是否开启 compress
 * @param {boolean} [opts.mangle=true]   是否开启变量名混淆(mangle)
 * @returns {Promise<string>} 压缩后的代码
 */
async function minifyCode(code, opts = {}) {
  const compress = opts.compress !== false;
  const mangle = opts.mangle !== false;

  const result = await minify(code, {
    compress,
    mangle,
    format: {
      // 保留必要的兼容性，去掉注释
      comments: false,
    },
  });

  if (result.error) {
    throw new Error("Terser 压缩失败: " + result.error.message);
  }
  if (typeof result.code !== "string") {
    throw new Error("Terser 压缩失败: 未生成有效输出");
  }
  return result.code;
}

module.exports = { minifyCode };
