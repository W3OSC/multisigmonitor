module.exports = {
  apps: [
    {
      name: 'multisig-backend',
      cwd: './backend',
      script: 'cargo',
      args: 'run',
      interpreter: 'none',
      env: {
        NODE_ENV: 'development',
      },
      env_file: '../secrets/.env.backend.local',
    },
    {
      name: 'multisig-frontend',
      cwd: './frontend',
      script: 'npm',
      args: 'run dev',
      env: {
        NODE_ENV: 'development',
      },
      env_file: '../secrets/.env.frontend.local',
    },
  ],
};
