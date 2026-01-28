module.exports = {
  apps: [
    {
      name: 'multisig-backend',
      cwd: './backend',
      script: 'cargo',
      args: 'run --bin multisigmonitor-backend',
      interpreter: 'none',
      env_file: '../secrets/.env.backend.local',
    },
    {
      name: 'multisig-worker',
      cwd: './backend',
      script: 'cargo',
      args: 'run --bin monitor-worker',
      interpreter: 'none',
      env_file: '../secrets/.env.backend.local',
    },
    {
      name: 'multisig-frontend',
      cwd: './frontend',
      script: 'npm',
      args: 'run dev',
      env_file: '../secrets/.env.frontend.local',
    },
  ],
};

