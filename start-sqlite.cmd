@echo off
chcp 65001 >nul
title 章回 - SQLite 一键启动
cd /d "%~dp0"
echo 正在使用 SQLite 启动章回...
call pnpm sqlite
if errorlevel 1 pause
