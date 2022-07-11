# SU95 MSFS Project
New repository for MSFS Sukhoi Superjet 100 convert project. Hopefully it will be more cleaner easier to use in MSFS Project Editor.

 ## Requirement
Following software are required to build this project:
- Any git client. I use the [GitHub Desktop](https://desktop.github.com/)
- [Docker](https://docs.docker.com/get-docker/) (To build WASM and react instrument)

Optional software that you don't need but I personally prefer to use it.
- [VScode](https://code.visualstudio.com/download)

 ## How to use
By default, the repository doesn't include AEROPROYECTO SSJ 3D model and engine sounds. You will have to obtain the model and sound file by either through the flightsim.to or the release package.
- Remove the SSJ100 folder from the community folder
- Put the .mdl file inside "PackageSources/SimObjects/Airplanes/SU95/model".
- Put the .wav and sound.cfg to "PackageSources/SimObjects/Airplanes/SU95/sound/"
- Run following. This will install the A32NX docker images and node module.
For powershell:
```shell
.\scripts\dev-env\run.cmd ./scripts/setup.sh
```
For Git Bash/Linux:
```shell
./scripts/dev-env/run.sh ./scripts/setup.sh
```
- Build all A32NX module by running following command. This isntall A32NX modules to PackageSources.
For powershell:
```shell
.\scripts\dev-env\run.cmd ./scripts/build.sh
```
For Git Bash/Linux:
```shell
./scripts/dev-env/run.sh ./scripts/build.sh
```
- Click on Sync.bat on the project root.
- Now the plane should appears when you load the project.

Make changes in PackageSources. To load changes, click on Sync.bat and resync on aircraft editor.

 ## License

Original source code assets present in this repository are licensed under the GNU GPLv3.
Original 3D assets are licensed under CC BY-NC 4.0.

Microsoft Flight Simulator © Microsoft Corporation. SSJ project was created under Microsoft's "Game Content Usage Rules" using assets from Microsoft Flight Simulator, and it is not endorsed by or affiliated with Microsoft.

The contents of distribution packages built from the sources in this repository are therefore licensed as follows:

- in the case of original source code from the SSJ project and FBW, or compiled binaries generated from it, under GPLv3.
- in the case of original or FBW texture, graphics or 3D assets, under CC BY-NC 4.0.
- in the case of assets covered by the "Game Content Usage Rules", under the license granted by those rules.
- in the case of original or modified exterior 3D model, graphics, sound or 3D assets created by Edgar Guinart Lopez, under proprietary freeware license
