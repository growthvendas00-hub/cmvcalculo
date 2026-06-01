@echo off
title CMV Studio - Servidor
cd /d "%~dp0"
echo.
echo  ====================================================
echo    CMV STUDIO - Iniciando servidor...
echo    NAO FECHE ESTA JANELA enquanto usar o sistema.
echo  ====================================================
echo.
echo  Abra no navegador:  http://localhost:3001
echo.
node src/server.js
echo.
echo  O servidor parou. Pressione uma tecla para fechar.
pause >nul
