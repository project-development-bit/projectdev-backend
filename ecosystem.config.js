module.exports = {
  apps: [
    {
      name: "api",
      script: "src/server.js",

      /* default (dev) env */
      env: {
        NODE_ENV: "development",
        PORT: 3000,
      },

      /* 👇 this is what PM2 looks for when you pass --env production */
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
        HOST: "0.0.0.0",
      },

      /* optional */
      instances: "max",
      exec_mode: "cluster",
      watch: false,
    },
  ],
};