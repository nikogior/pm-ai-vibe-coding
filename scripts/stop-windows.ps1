$ErrorActionPreference = "Stop"

$ContainerName = "pm-ai-vibe-coding-container"

docker rm -f $ContainerName 2>$null

Write-Host "Stopped container: $ContainerName"
