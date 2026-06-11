// services/obfuscate.js
// 使用 javascript-obfuscator 的 Node API 进行混淆。
const JavaScriptObfuscator = require("javascript-obfuscator");

/**
 * 把前端传入的扁平选项映射为 javascript-obfuscator 的标准选项。
 * 默认采用「安全模式」参数，对 H5 / WebView / 小程序最友好。
 *
 * @param {string} code 待混淆代码（通常是压缩后的代码）
 * @param {object} [options] 前端传入选项
 * @param {boolean} [options.compact=true]
 * @param {boolean} [options.stringArray=true]
 * @param {string}  [options.stringArrayEncoding="base64"]  none | base64 | rc4
 * @param {number}  [options.stringArrayThreshold=0.75]
 * @param {boolean} [options.renameGlobals=false]
 * @param {boolean} [options.strongMode=false]  开启后启用更激进的混淆参数（有兼容风险）
 * @returns {string} 混淆后的代码
 */
function obfuscateCode(code, options = {}) {
  const compact = options.compact !== false;
  const stringArray = options.stringArray !== false;
  const renameGlobals = options.renameGlobals === true;
  const strongMode = options.strongMode === true;

  // 编码方式做白名单校验，避免传入非法值
  const allowedEncodings = ["none", "base64", "rc4"];
  let encoding = options.stringArrayEncoding || "base64";
  if (!allowedEncodings.includes(encoding)) encoding = "base64";

  // 阈值限定 0~1
  let threshold = Number(options.stringArrayThreshold);
  if (!Number.isFinite(threshold)) threshold = 0.75;
  threshold = Math.min(1, Math.max(0, threshold));

  // 基础（安全）参数
  const obfConfig = {
    compact,
    stringArray,
    stringArrayEncoding: [encoding],
    stringArrayThreshold: threshold,
    renameGlobals,
    // 下面这些在安全模式下保持关闭，最大限度保证运行时正确
    controlFlowFlattening: false,
    deadCodeInjection: false,
    debugProtection: false,
    disableConsoleOutput: false,
    selfDefending: false,
  };

  // 强混淆模式：用户主动勾选，前端需提示可能导致环境异常
  if (strongMode) {
    obfConfig.controlFlowFlattening = true;
    obfConfig.controlFlowFlatteningThreshold = 0.5;
    obfConfig.deadCodeInjection = true;
    obfConfig.deadCodeInjectionThreshold = 0.2;
    obfConfig.selfDefending = true;
    // debugProtection / disableConsoleOutput 仍默认关闭，
    // 它们对 WebView/小程序最容易出问题，需要时单独再开。
  }

  const result = JavaScriptObfuscator.obfuscate(code, obfConfig);
  return result.getObfuscatedCode();
}

module.exports = { obfuscateCode };
