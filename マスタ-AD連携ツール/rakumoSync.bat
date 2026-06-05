@echo off
cd C:\rakumoSync
call .\src\user.bat
call .\src\group.bat
cd src
powershell -v 3 -NoProfile -ExecutionPolicy Bypass .\convertdata_JTC.ps1
cd ..
call main.exe
