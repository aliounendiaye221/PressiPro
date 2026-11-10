$ErrorActionPreference = "Stop"
$scriptPath = Join-Path $PSScriptRoot "generate-icons.js"
node $scriptPath
if ($LASTEXITCODE -ne 0) {
    throw "Icon generation failed with exit code $LASTEXITCODE"
}
