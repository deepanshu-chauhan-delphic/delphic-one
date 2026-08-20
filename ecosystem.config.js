module.exports = {
  apps: [
    {
      name: 'requirement-dashboard-api',
      cwd: './server',
      script: 'src/index.js',
      exec_mode: 'cluster',
      instances: 2,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
