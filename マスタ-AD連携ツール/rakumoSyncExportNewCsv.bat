@echo off
cd C:\rakumoSync
call .\src\group.bat
call .\src\user.bat
cd src
powershell -v 3 -NoProfile -ExecutionPolicy Bypass .\convertdata_JTC.ps1
