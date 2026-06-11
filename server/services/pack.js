// services/pack.js
// 自定义 Packer：把代码 base64 后包进 eval(function(p,a,c,k,e,r){...}) 结构。
// 不使用老旧的 npm "packer" 包（依赖 node-gyp / C++ 编译，Windows + 新版 Node 易报错）。
//
// 运行时解码逻辑对 UTF-8（含中文）安全：
//   base64 -> atob 得到逐字节字符串 -> 逐字节转 %XX -> decodeURIComponent 还原 UTF-8

/**
 * 把代码包装成 eval(function(p,a,c,k,e,r){...}) 结构
 * @param {string} code 待打包代码（通常是混淆后的代码）
 * @returns {string} 打包后的代码
 */
function packCode(code) {
  const base64Code = Buffer.from(code, "utf8").toString("base64");

  // 注意：base64 字符集为 A-Za-z0-9+/=，不含单引号，直接内联到 '...' 中是安全的。
  const packed =
    "eval(function(p,a,c,k,e,r){" +
    "e=function(s){" +
    "var b=atob(s),i=0,o='';" +
    "for(;i<b.length;i++){" +
    "var h=b.charCodeAt(i).toString(16);" +
    "o+='%'+(h.length<2?'0':'')+h;" +
    "}" +
    "return decodeURIComponent(o);" +
    "};" +
    "return e(p);" +
    "}('" +
    base64Code +
    "',0,0,'',0,{}));";

  return packed;
}

module.exports = { packCode };
