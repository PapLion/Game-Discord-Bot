module.exports = {
  apps: [
    {
      name: 'game-discord-bot',
      script: 'dist/index.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      time: true,
    },
  ],
};
