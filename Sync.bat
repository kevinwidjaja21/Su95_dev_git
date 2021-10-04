@xcopy ".\PackageSources" ".\Packages\SSJ100" /D /E /C /R /H /I /K /Y
@RD /S /Q ".\Packages\ssj100_CVT_"
@MSFSLayoutGenerator.exe .\Packages\SSJ100\layout.json