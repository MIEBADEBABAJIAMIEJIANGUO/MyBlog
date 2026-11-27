@echo off
REM Publish the static-only site (resume pages) to the server.
REM Wrapper that bypasses PowerShell execution policy for this run only.
REM
REM Usage:
REM   deploy\publish-static.cmd 116.62.103.168 -SshKey C:\Users\Administrator\.ssh\my-blog.pem

setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0publish-static.ps1" %*
exit /b %ERRORLEVEL%
