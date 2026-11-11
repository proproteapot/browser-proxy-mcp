# Codex Browser Proxy MCP

Windows 上的 Codex MCP 启动器。它读取本机官方 Browser 插件的运行时配置，保留启动参数和访问检查，并让支持代理的 Node 网络请求通过 `http://127.0.0.1:7897`。本地回环地址直连。

## 安装

1. 在 Codex 桌面版启用官方浏览器能力。使用 Edge 时，先完成官方扩展的连接。
2. 确认本机 HTTP 代理在 `127.0.0.1:7897` 监听。如果使用其他端口，修改 `browser-proxy-mcp.mjs` 的 `proxy` 常量。
3. 将 `browser-proxy-mcp.mjs` 复制到 `%USERPROFILE%\.codex`，在该目录的 `config.toml` 里添加以下配置。将两个路径替换为本机的实际绝对路径。

```toml
[mcp_servers.browser_proxy]
command = 'C:\Path\To\node.exe'
args = ['C:\Users\YOUR_USER\.codex\browser-proxy-mcp.mjs']
env_vars = ["BROWSER_USE_ACCESS_EXECUTOR_ID", "BROWSER_USE_ACCESS_PIPE_PATH", "BROWSER_USE_ACCESS_VERIFYING_IDENTITY", "CODEX_WINDOWS_REGISTERED_CORE"]
startup_timeout_sec = 120.0
tool_timeout_sec = 60.0
enabled_tools = ["js", "js_reset", "turn_ended"]
```

4. 重新启动 Codex，开启新会话，使用 `mcp__browser_proxy__js`。如需设为本机默认，可在用户级 `AGENTS.md` 指定优先使用该工具。

## 自检

在仓库目录运行 `node .\browser-proxy-mcp.mjs --self-test`。输出会列出找到的插件版本、运行时路径和代理配置。自检只检查运行时发现，浏览器连通性可在 Codex 里用 `cua.getState()` 验证。

启动器依赖 Codex 桌面版的默认 Windows 插件缓存和运行时目录。Codex 更新后如果找不到运行时，先运行自检并核对官方插件的 `.mcp.json`。
