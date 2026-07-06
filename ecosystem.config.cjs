module.exports = {
  apps: [
    {
      name: "absen-ptmip",
      script: "node_modules/.bin/tsx",
      args: "server/index.ts",
      cwd: "/var/www/absensi-pt-mip",
      env: {
        NODE_ENV: "production",
        PORT: 3008,
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
    },
  ],
};
