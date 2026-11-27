@echo off
REM Build and publish the site to the Alibaba Cloud server.
REM Wrapper that bypasses PowerShell execution policy for this run only.
REM
REM Usage:
REM   deploy\publish.cmd 47.100.xx.xx
REM   deploy\publish.cmd 47.100.xx.xx -User root -SshKey C:\Users\me\.ssh\aliyun.pem
REM   deploy\publish.cmd 47.100.xx.xx -DryRun      (build and pack only)

setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-local.ps1" %*
exit /b %ERRORLEVEL%
