module.exports = {
  apps: [
    {
      name: "livechat-api",
      cwd: "./backend",
      script: "dist/index.js",
      node_args: "--enable-source-maps",
      env: {
        NODE_ENV: "production"
      },
      max_restarts: 5,
      restart_delay: 2000
    },
    {
      name: "livechat-worker-inbound",
      cwd: "./backend",
      script: "dist/worker.js",
      args: "inbound",
      env: {
        NODE_ENV: "production"
      },
      max_restarts: 5,
      restart_delay: 2000
    },
    {
      name: "livechat-worker-outbound",
      cwd: "./backend",
      script: "dist/worker.js",
      args: "outbound",
      env: {
        NODE_ENV: "production"
      },
      max_restarts: 5,
      restart_delay: 2000
    },
    {
      name: "livechat-worker-campaigns",
      cwd: "./backend",
      script: "dist/worker.campaigns.js",
      env: {
        NODE_ENV: "production"
      },
      max_restarts: 5,
      restart_delay: 2000
    }
  ]
};
