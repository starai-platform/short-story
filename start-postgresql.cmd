@echo off
chcp 65001 >nul
title 章回 - PostgreSQL Docker 一键启动
cd /d "%~dp0"
echo 正在使用 PostgreSQL 和 Docker 启动章回...
docker compose up -d --build
if errorlevel 1 (
  echo 启动失败，请确认 Docker Desktop 已安装并正在运行。
  pause
) else (
  echo 启动完成：http://localhost:3000
  pause
)
