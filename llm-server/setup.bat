@echo off
echo Setting up Gogh LLM Server...

REM Check if Ollama is installed
where ollama >nul 2>&1
if %errorlevel% neq 0 (
    echo Ollama is not installed.
    echo Please download and install Ollama from https://ollama.com
    echo After installation, run this script again.
    pause
    exit /b 1
)

echo Ollama is installed

REM Pull recommended model
echo Pulling llama3.2:1b model (this may take a few minutes)...
ollama pull llama3.2:1b

REM Install npm dependencies
echo Installing npm dependencies...
call npm install

REM Create .env file if it doesn't exist
if not exist .env (
    echo Creating .env file...
    (
        echo # LLM Server Configuration
        echo LLM_PORT=3001
        echo OLLAMA_URL=http://localhost:11434
        echo OLLAMA_MODEL=llama3.2:1b
    ) > .env
    echo Created .env file
)

echo.
echo Setup complete!
echo.
echo To start the server, run:
echo   npm start
echo.
echo For development with auto-reload:
echo   npm run dev
echo.
pause

