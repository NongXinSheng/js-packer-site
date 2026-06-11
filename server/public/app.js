// public/app.js
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };

  var els = {
    code: $("codeInput"),
    file: $("fileInput"),
    drop: $("dropZone"),
    fileMeta: $("fileMeta"),
    sample: $("sampleBtn"),
    clear: $("clearBtn"),
    build: $("buildBtn"),
    stepMinify: $("stepMinify"),
    stepObfuscate: $("stepObfuscate"),
    stepPack: $("stepPack"),
    optCompact: $("optCompact"),
    optStringArray: $("optStringArray"),
    optRenameGlobals: $("optRenameGlobals"),
    optEncoding: $("optEncoding"),
    optThreshold: $("optThreshold"),
    optStrong: $("optStrong"),
    strongWarn: $("strongWarn"),
    output: $("codeOutput"),
    outTabs: $("outTabs"),
    outStat: $("outStat"),
    copy: $("copyBtn"),
    download: $("downloadBtn"),
    inputHint: $("inputHint"),
    healthDot: $("healthDot"),
    toast: $("toast"),
  };

  var state = {
    filename: "code.js",
    result: null,     // 后端返回的 result
    activeKey: null,  // 当前展示的 tab: min | obf | pack
    dragDepth: 0,
  };

  var DEFAULT_FILE_META = "支持 .js / .mjs / .cjs / .txt，最大 5MB，也可以直接粘贴代码";

  // ---- 工具函数 ----
  function fmtSize(bytes) {
    if (bytes == null) return "—";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1024 / 1024).toFixed(2) + " MB";
  }

  function toast(msg, type) {
    els.toast.textContent = msg;
    els.toast.className = "toast" + (type ? " " + type : "");
    els.toast.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { els.toast.hidden = true; }, 2600);
  }

  function baseName(name) {
    // 去掉扩展名，得到基础名
    return (name || "code").replace(/\.[^.]+$/, "") || "code";
  }

  function resetOutput() {
    state.result = null;
    state.activeKey = null;
    els.output.innerHTML = '<span class="placeholder">生成后在此显示结果…</span>';
    els.outTabs.innerHTML = "";
    els.outStat.textContent = "";
    els.copy.disabled = true;
    els.download.disabled = true;
    resetPipeline();
  }

  function setInputCode(code, filename) {
    els.code.value = code || "";
    state.filename = filename || "code.js";
    resetOutput();

    if (filename) {
      els.fileMeta.textContent = "当前文件：" + filename + " · " + fmtSize(new Blob([code || ""]).size);
    } else {
      els.fileMeta.textContent = DEFAULT_FILE_META;
    }
  }

  // ---- 流水线显示 ----
  function resetPipeline() {
    var stages = document.querySelectorAll(".stage");
    for (var i = 0; i < stages.length; i++) {
      stages[i].classList.remove("active", "skipped");
    }
    setStageSize("original", "—");
    setStageSize("min", "—");
    setStageSize("obf", "—");
    setStageSize("pack", "—");
  }

  function setStageSize(key, text) {
    var el = document.querySelector('.stage-size[data-size="' + key + '"]');
    if (el) el.textContent = text;
  }

  function markStage(key, active) {
    var el = document.querySelector('.stage[data-stage="' + key + '"]');
    if (!el) return;
    el.classList.remove("skipped");
    el.classList.toggle("active", !!active);
    if (!active) el.classList.add("skipped");
  }

  // ---- 输出 tabs ----
  function renderTabs(result) {
    var keys = [];
    if (result.min) keys.push({ key: "min", label: "min" });
    if (result.obf) keys.push({ key: "obf", label: "obf" });
    if (result.pack) keys.push({ key: "pack", label: "pack" });

    els.outTabs.innerHTML = "";
    keys.forEach(function (k) {
      var b = document.createElement("button");
      b.className = "tab";
      b.dataset.key = k.key;
      b.textContent = k.label;
      b.type = "button";
      b.addEventListener("click", function () { showKey(k.key); });
      els.outTabs.appendChild(b);
    });

    // 默认展示最后一个产物
    if (keys.length) showKey(keys[keys.length - 1].key);
  }

  function showKey(key) {
    if (!state.result || !state.result[key]) return;
    state.activeKey = key;

    var tabs = els.outTabs.querySelectorAll(".tab");
    tabs.forEach(function (t) {
      t.classList.toggle("active", t.dataset.key === key);
    });

    var item = state.result[key];
    els.output.textContent = item.code;
    els.copy.disabled = false;
    els.download.disabled = false;

    var orig = state.result.original.size;
    var ratio = orig ? ((item.size / orig) * 100).toFixed(0) : "—";
    els.outStat.innerHTML =
      '原始 ' + fmtSize(orig) +
      ' → <span class="ok">' + fmtSize(item.size) + "</span>" +
      "（" + ratio + "%）";
  }

  // ---- 构建 ----
  function build() {
    var code = els.code.value;
    if (!code.trim()) {
      toast("请输入或上传 JS 代码", "err");
      els.code.focus();
      return;
    }

    var doMinify = els.stepMinify.checked;
    var doObfuscate = els.stepObfuscate.checked;
    var doPack = els.stepPack.checked;

    if (!doMinify && !doObfuscate && !doPack) {
      toast("请至少选择一个处理步骤", "err");
      return;
    }

    var payload = {
      code: code,
      filename: state.filename,
      steps: { minify: doMinify, obfuscate: doObfuscate, pack: doPack },
      obfuscatorOptions: {
        compact: els.optCompact.checked,
        stringArray: els.optStringArray.checked,
        stringArrayEncoding: els.optEncoding.value,
        stringArrayThreshold: parseFloat(els.optThreshold.value) || 0.75,
        renameGlobals: els.optRenameGlobals.checked,
        strongMode: els.optStrong.checked,
      },
    };

    els.build.disabled = true;
    els.build.textContent = "处理中…";
    els.inputHint.classList.remove("err");
    els.inputHint.textContent = "正在处理…";

    fetch("./api/build", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok || !res.d.success) {
          var stage = res.d.stage ? "（" + res.d.stage + "）" : "";
          throw new Error((res.d.error || "处理失败") + stage);
        }
        applyResult(res.d.result);
        els.inputHint.textContent = "仅做字符串处理，不会在服务器执行你的代码。";
        toast("生成完成", "ok");
      })
      .catch(function (err) {
        els.inputHint.classList.add("err");
        els.inputHint.textContent = "错误：" + err.message;
        toast(err.message, "err");
      })
      .finally(function () {
        els.build.disabled = false;
        els.build.textContent = "生成";
      });
  }

  function applyResult(result) {
    state.result = result;
    resetPipeline();

    markStage("original", true);
    setStageSize("original", fmtSize(result.original.size));

    markStage("min", !!result.min);
    if (result.min) setStageSize("min", fmtSize(result.min.size));

    markStage("obf", !!result.obf);
    if (result.obf) setStageSize("obf", fmtSize(result.obf.size));

    markStage("pack", !!result.pack);
    if (result.pack) setStageSize("pack", fmtSize(result.pack.size));

    renderTabs(result);
  }

  // ---- 文件上传 / 拖拽上传 ----
  function hasDragFiles(e) {
    var types = e.dataTransfer && e.dataTransfer.types;
    if (!types) return false;
    for (var i = 0; i < types.length; i++) {
      if (types[i] === "Files") return true;
    }
    return false;
  }

  function isAllowedFile(file) {
    var nameOk = /\.(js|mjs|cjs|txt)$/i.test(file.name || "");
    var typeOk = /javascript|ecmascript|text\/plain|text\/x-javascript/i.test(file.type || "");
    return nameOk || typeOk || !file.type;
  }

  function setDropActive(active) {
    if (!els.drop) return;
    els.drop.classList.toggle("drag-over", !!active);
  }

  function readFile(file) {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast("文件超过 5MB", "err");
      return;
    }

    if (!isAllowedFile(file)) {
      toast("仅支持 .js / .mjs / .cjs / .txt 文件", "err");
      return;
    }

    var reader = new FileReader();

    reader.onload = function () {
      setInputCode(reader.result, file.name || "code.js");
      toast("已载入 " + (file.name || "文件"), "ok");
      els.code.focus();
    };

    reader.onerror = function () {
      toast("文件读取失败", "err");
    };

    reader.readAsText(file, "utf-8");
  }

  function bindDragUpload() {
    if (!els.drop) return;

    ["dragenter", "dragover"].forEach(function (name) {
      els.drop.addEventListener(name, function (e) {
        if (!hasDragFiles(e)) return;
        e.preventDefault();
        e.stopPropagation();
        if (name === "dragenter") state.dragDepth++;
        setDropActive(true);
      });
    });

    els.drop.addEventListener("dragleave", function (e) {
      if (!hasDragFiles(e)) return;
      e.preventDefault();
      e.stopPropagation();
      state.dragDepth--;
      if (state.dragDepth <= 0) {
        state.dragDepth = 0;
        setDropActive(false);
      }
    });

    els.drop.addEventListener("drop", function (e) {
      if (!hasDragFiles(e)) return;
      e.preventDefault();
      e.stopPropagation();
      state.dragDepth = 0;
      setDropActive(false);

      var files = e.dataTransfer.files;
      if (!files || !files.length) return;

      if (files.length > 1) {
        toast("已选择第 1 个文件：" + files[0].name, "ok");
      }
      readFile(files[0]);
    });

    // 防止把文件拖到页面其他区域时，浏览器直接打开文件
    ["dragover", "drop"].forEach(function (name) {
      document.addEventListener(name, function (e) {
        if (!hasDragFiles(e)) return;
        e.preventDefault();
      });
    });
  }

  // ---- 下载 ----
  function download() {
    if (!state.result || !state.activeKey) return;
    var item = state.result[state.activeKey];
    var ext = state.activeKey; // min | obf | pack
    var name = baseName(state.filename) + "." + ext + ".js";

    var blob = new Blob([item.code], { type: "text/javascript;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function copyOut() {
    if (!state.result || !state.activeKey) return;
    var text = state.result[state.activeKey].code;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { toast("已复制", "ok"); },
        function () { fallbackCopy(text); }
      );
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); toast("已复制", "ok"); }
    catch (e) { toast("复制失败，请手动选择", "err"); }
    document.body.removeChild(ta);
  }

  // ---- 示例代码 ----
  var SAMPLE =
    'function copyToken(token) {\n' +
    '  var input = document.createElement("input");\n' +
    '  input.value = token;\n' +
    '  document.body.appendChild(input);\n' +
    '  input.select();\n' +
    '  document.execCommand("copy");\n' +
    '  document.body.removeChild(input);\n' +
    '  alert("口令已复制：" + token);\n' +
    '}\n\n' +
    'function isIOS() {\n' +
    '  return /iPhone|iPad|iPod/i.test(navigator.userAgent);\n' +
    '}\n\n' +
    'document.getElementById("btn") &&\n' +
    '  document.getElementById("btn").addEventListener("click", function () {\n' +
    '    copyToken("REWARD-2026-OK");\n' +
    '    if (isIOS()) location.href = "https://example.com/ios";\n' +
    '  });\n';

  // ---- 事件绑定 ----
  els.build.addEventListener("click", build);
  els.download.addEventListener("click", download);
  els.copy.addEventListener("click", copyOut);

  els.sample.addEventListener("click", function () {
    setInputCode(SAMPLE, "money_reward.js");
  });

  els.clear.addEventListener("click", function () {
    els.code.value = "";
    state.filename = "code.js";
    els.fileMeta.textContent = DEFAULT_FILE_META;
    els.inputHint.classList.remove("err");
    els.inputHint.textContent = "仅做字符串处理，不会在服务器执行你的代码。";
    resetOutput();
    els.code.focus();
  });

  els.file.addEventListener("change", function (e) {
    var f = e.target.files && e.target.files[0];
    if (f) readFile(f);
    els.file.value = "";
  });

  els.optStrong.addEventListener("change", function () {
    els.strongWarn.hidden = !els.optStrong.checked;
  });

  // Ctrl/Cmd + Enter 触发生成
  els.code.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      build();
    }
  });

  bindDragUpload();
  resetPipeline();

  // ---- 健康检查 ----
  fetch("./api/health")
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d && d.success) {
        els.healthDot.textContent = "● 服务在线";
        els.healthDot.classList.remove("off");
      } else { throw new Error(); }
    })
    .catch(function () {
      els.healthDot.textContent = "● 服务离线";
      els.healthDot.classList.add("off");
    });
})();
