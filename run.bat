@echo off
echo ============================================
echo  Turing Machine Emulator - Binary Arithmetic
echo ============================================
echo.
echo Installing dependencies...
pip install flask flask-cors -q
echo.
echo Starting server at http://localhost:5000
echo Press Ctrl+C to stop the server.
echo.
start "" "http://localhost:5000"
python app.py
pause
