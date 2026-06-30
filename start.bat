@echo off
chcp 65001 >nul
title 西幻世界观工具 - 启动中...
color 0F

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║     西幻世界观编辑工具 - 启动脚本           ║
echo  ╚══════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

:: ─── 检查 Node.js ───
echo  [1/4] 检查 Node.js 环境...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] 未检测到 Node.js！
    echo  请前往 https://nodejs.org 下载安装后重试。
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo  [OK] Node.js %NODE_VER% 已就绪
echo.

:: ─── 检查 node_modules ───
echo  [2/4] 检查项目依赖...
if not exist "node_modules" (
    echo  [INFO] 首次运行，正在安装依赖（请稍候）...
    echo  ──────────────────────────────────────────────
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo  [ERROR] 依赖安装失败，请检查网络连接后重试。
        pause
        exit /b 1
    )
    echo  ──────────────────────────────────────────────
    echo  [OK] 依赖安装完成
) else (
    echo  [OK] 依赖已就绪
)
echo.

:: ─── 检查 dist 构建产物 ───
echo  [3/4] 检查前端构建产物...
if not exist "dist\index.html" (
    echo  [INFO] 未检测到构建产物，正在构建（请稍候）...
    echo  ──────────────────────────────────────────────
    call npm run build
    if %errorlevel% neq 0 (
        echo.
        echo  [ERROR] 前端构建失败，请检查源码后重试。
        pause
        exit /b 1
    )
    echo  ──────────────────────────────────────────────
    echo  [OK] 构建完成
) else (
    echo  [OK] 构建产物已就绪
)
echo.

:: ─── 启动服务器 ───
echo  [4/4] 启动 Express 服务器...
echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║                                              ║
echo  ║   访问地址: http://127.0.0.1:3001            ║
echo  ║   按 Ctrl+C 停止服务                         ║
echo  ║                                              ║
echo  ╚══════════════════════════════════════════════╝
echo.

title 西幻世界观工具 - 运行中 (http://127.0.0.1:3001)
start "" http://127.0.0.1:3001
node server.js

if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] 服务器异常退出 (错误码: %errorlevel%)
    echo  可能原因: 端口 3001 被占用，或 server.js 存在错误。
    echo.
)
pause
