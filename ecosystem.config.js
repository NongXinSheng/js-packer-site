// ecosystem.config.js  —— PM2 进程守护配置
// 用法：在 server 目录安装依赖后，于项目根目录执行 pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "js-packer",
      cwd: "./server",          // 工作目录指向后端
      script: "app.js",
      instances: 1,             // 工具站无状态，1 个实例足够；如需多核可改 "max"
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,             // 与 Nginx 反向代理端口保持一致
        MAX_CODE_BYTES: 5242880 // 5MB，单段代码上限
      }
    }
  ]
};
