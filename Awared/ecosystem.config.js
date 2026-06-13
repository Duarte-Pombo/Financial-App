module.exports = {
	apps: [
		{
			name: "awared-server",
			script: "npx",
			args: "tsx server/index.ts",
			cwd: "/home/user/awared",
			env_file: "./server/.env",
			watch: false,
			restart_delay: 2000,
			max_restarts: 10,
			min_uptime: "5s",   // ← add this so PM2 knows a fast exit is a real crash
		},
		{
			name: "awared-ngrok",
			script: "ngrok",
			args: "http --hostname=cotton-quirk-dance.ngrok-free.app 8080",
			cwd: "/home/user/awared",
			watch: false,
			restart_delay: 3000,
			min_uptime: "5s",
		},
	],
};
