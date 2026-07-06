module.exports = {
  apps: [
    {
      name: "absen-ptmip",
      script: "dist/index.js",
      cwd: "/var/www/absensi-pt-mip",
      env: {
        NODE_ENV: "production",
        PORT: 3010,
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
    },
  ],
};
