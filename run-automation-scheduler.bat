@echo off
title ProjectFlow Automation Runner
cd /d "%~dp0"

if not exist logs mkdir logs

echo Running ProjectFlow automation...
echo %date% %time% >> logs\automation-run.log
npm.cmd run automation:run >> logs\automation-run.log 2>>&1
echo. >> logs\automation-run.log

echo Automation completed. See logs\automation-run.log
