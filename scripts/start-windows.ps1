$ErrorActionPreference = "Stop"

$ImageName = "pm-ai-vibe-coding"
$ContainerName = "pm-ai-vibe-coding-container"
$Port = 8000

Set-Location (Join-Path $PSScriptRoot "..")

docker rm -f $ContainerName 2>$null

docker build -t $ImageName .
docker run --rm -d --name $ContainerName -p "$Port:8000" -v "pm-ai-vibe-coding-data:/data" --env-file .env $ImageName

Write-Host "Application started at http://localhost:$Port"
