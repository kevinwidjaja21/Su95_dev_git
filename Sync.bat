@xcopy ".\PackageSources" ".\Packages\SSJ100" /D /E /C /R /H /I /K /Y
@RD /S /Q ".\Packages\ssj100_CVT_"
@.\scripts\dev-env\run.cmd node scripts/build.js
