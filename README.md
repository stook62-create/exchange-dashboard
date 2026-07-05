# 交易所看板

一个基于 React + Vite + Express 的实时行情看板，展示主要市场指数的最新报价和日/周/月 K 线图。

在线预览：https://stook62-create.github.io/exchange-dashboard/

## 功能

- 实时展示 6 个主要指数：
  - 美股：纳斯达克、标普 500
  - A 股：上证指数、创业板指、科创 50
  - 港股：恒生科技指数
- 卡片内实时分时走势图
- 点击卡片弹出日/周/月 K 线蜡烛图

## 技术栈

- 前端：React + Vite + Tailwind CSS + Apache ECharts
- 后端：Express + Node.js fetch
- 数据源：腾讯财经、新浪财经、东方财富（带降级 fallback）

## 本地开发

```bash
npm install
npm run dev
```

然后打开 http://localhost:5173。

后端运行在 http://localhost:3001，前端通过 Vite 代理访问 `/api`。

## 部署架构

本项目采用分离部署：

- **后端**：部署在 Render（免费 Web Service）
- **前端**：通过 GitHub Actions 部署到 GitHub Pages

### 1. 部署后端到 Render

1. 访问 https://dashboard.render.com 并用 GitHub 账号登录。
2. 点击 **New > Web Service**。
3. 选择 `stook62-create/exchange-dashboard` 仓库和 `master` 分支。
4. 填写配置：
   - **Name**：例如 `exchange-dashboard-api`
   - **Build Command**：`npm ci --omit=dev`
   - **Start Command**：`node server/index.js`
   - **Environment**：可设置 `NODE_ENV=production`
5. 点击 **Create Web Service**，等待首次部署完成。
6. 复制 Render 给出的公网地址，例如：
   ```
   https://exchange-dashboard-api.onrender.com
   ```

### 2. 配置 GitHub Secrets

1. 打开仓库 **Settings > Secrets and variables > Actions**。
2. 点击 **New repository secret**。
3. 添加：
   - **Name**：`VITE_API_BASE_URL`
   - **Value**：`https://exchange-dashboard-api.onrender.com/api`
   - 把域名替换为你实际的 Render 域名。

### 3. 启用 GitHub Pages

1. 打开仓库 **Settings > Pages**。
2. 在 **Build and deployment > Source** 中选择 **GitHub Actions**。

### 4. 重新触发前端部署

修改 secret 后，需要重新构建前端才能生效。可以：

- 在仓库页面点击 **Actions > Deploy frontend to GitHub Pages > Run workflow**，或
- 随意修改并 push 一个 commit。

构建完成后即可通过 https://stook62-create.github.io/exchange-dashboard/ 访问。

## 注意事项

- Render 免费 Web Service 约 15 分钟无访问会进入休眠，首次访问可能需要 30–60 秒唤醒。如需完全无延迟，请升级到 Render Starter（约 $7/月）。
- 后端部署在海外时，访问腾讯/新浪接口通常正常，东方财富接口可能不稳定；项目已内置数据源降级逻辑。

## License

MIT
