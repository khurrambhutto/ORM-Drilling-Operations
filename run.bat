@echo off
echo ===================================================
echo   Starting ORM Drilling Operations System...
echo ===================================================

echo Starting FastAPI Backend Server on port 5000...
start "ORM Backend Server" cmd /k "cd /d "%~dp0Drilling ORM Backend\Drilling ORM Backend" && py -3.13 main.py"

echo Starting React Frontend App on port 3000...
start "ORM Frontend App" cmd /k "cd /d "%~dp0Frontend" && npm start"

echo ===================================================
echo   Backend:  http://localhost:5000
echo   Frontend: http://localhost:3000
echo ===================================================
