# TimelapseTray 🎥⏱️

A high-performance, cross-platform, system-tray-based timelapse recorder written in C++20 using Qt6 and FFmpeg. 

Unlike Python-based alternatives, **TimelapseTray** encodes videos directly into the lightweight, web-optimized **WebM (VP9/VP8)** format on the fly. It features native hardware pipeline capture abstractions designed to work flawlessly across Windows (DXGI), macOS (ScreenCaptureKit), and modern Linux compositors—including **Wayland and Hyprland** via XDG Desktop Portals.

---

## ✨ Features

* **System Tray Core:** Starts quietly in your system status tray. Minimize the control panel to keep your workspace clutter-free.
* **Mini Dashboard:** Floating, always-on-top window featuring responsive **Start**, **Pause/Resume**, and **Stop & Compile** mechanics.
* **WebM Native Architecture:** Saves tiny, crystal-clear `.webm` files utilizing ultra-efficient video compression.
* **Smart UI States:** Interlocking configuration fields that lock during active recording sessions to prevent accidental setting changes.
* **On-Video Telemetry HUD:** Automatically embeds a clean progress tracker, frame counter, and alpha-dimmed pause state marker directly into the video frames.

---

## 🛠️ Prerequisites & Dependency Installation

Before building the application, you must install **Qt6 Development Libraries** and **FFmpeg Framework Headers** for your specific operating system.

### 1. Linux (Wayland / Hyprland / X11)

You need the core development tools, Qt6, FFmpeg development headers, and the PipeWire/XDG portal development libraries.

#### Arch Linux / Artix
```bash
sudo pacman -S base-devel cmake qt6-base ffmpeg pipewire xdg-desktop-portal-hyprland pkgconf
```

#### Ubuntu / Debian / Pop!_OS
```bash
sudo apt update
sudo apt install build-essential cmake qt6-base-dev libavcodec-dev libavformat-dev libswscale-dev libavutil-dev libpipewire-0.3-dev pkg-config
```

#### Fedora
```bash
sudo dnf groupinstall "Development Tools"
sudo dnf install cmake qt6-qtbase-devel ffmpeg-devel pipewire-devel pkgconf-pkg-config
```

### 2. Windows (Pure GCC / MinGW Setup)

No heavy Visual Studio installation is required. You can compile completely using the open-source **GCC** toolchain.

1. **Install GCC (MinGW-w64):** Download the latest GCC standalone compiler pack from [winlibs.com](https://winlibs.com/) (Choose the *UCRT runtime, Release* version). Extract it to a folder like `C:\winlibs` and add `C:\winlibs\mingw64\bin` to your Windows **Environment System PATH**.
2. **Install CMake:** Download and install the standard Windows binary installer from the official CMake website.
3. **Fetch Libraries via vcpkg:** Open your command prompt and tell `vcpkg` to explicitly compile your assets using GCC instead of MSVC:
   ```cmd
   git clone [https://github.com/microsoft/vcpkg.git](https://github.com/microsoft/vcpkg.git)
   cd vcpkg
   ./bootstrap-vcpkg.bat
   
   set VCPKG_DEFAULT_TRIPLET=x64-mingw-dynamic
   set VCPKG_DEFAULT_HOST_TRIPLET=x64-mingw-dynamic
   
   ./vcpkg install qt6-base ffmpeg:x64-mingw-dynamic
   ```

### 3. macOS

Install the dependencies using Homebrew:
```bash
brew install cmake qt6 ffmpeg pkg-config
```

---

## 🚀 Building the Application

Clone the repository and jump into your terminal or developer prompt to build the binary using CMake.

### On Linux & macOS:
```bash
# 1. Clone the repository
git clone [https://github.com/yourusername/TimelapseTray.git](https://github.com/yourusername/TimelapseTray.git)
cd TimelapseTray

# 2. Generate build files
mkdir build && cd build
cmake -DCMAKE_BUILD_TYPE=Release ..

# 3. Compile the code using all CPU cores
make -j$(nproc 2>/dev/null || sysctl -n hw.ncpu)

# 4. Run the program
./TimelapseTray
```

### On Windows (Command Prompt / PowerShell using GCC):
```cmd
mkdir build
cd build

# Generate Makefiles referencing the MinGW GCC compiler suite
cmake -G "MinGW Makefiles" -DCMAKE_TOOLCHAIN_FILE=C:/path/to/vcpkg/scripts/buildsystems/vcpkg.cmake -DVCPKG_TARGET_TRIPLET=x64-mingw-dynamic -DCMAKE_BUILD_TYPE=Release ..

# Compile the application using your local g++ compiler engine
cmake --build . --config Release
```
The compiled, optimized execution executable will be located inside `build/TimelapseTray.exe`.

---

## 🎮 How To Use

1. **Launch the App:** Run the compiled binary. The **Timelapse Studio Panel** will launch, and a new computer screen icon will appear in your system tray (Waybar on Hyprland, Taskbar on Windows, Menu bar on macOS).
2. **Configure Speed:** Set your target acceleration using the **Speed Multiplier** selection box (e.g., `10x` or `24x`). 
3. **Select Save Destination:** Click **Start Capture**. A native OS file window will ask you where you want to store your `.webm` timelapse video.
4. **Wayland/Hyprland Handshake (Linux Only):** A secure system popup from your XDG portal agent will ask for permission to capture your screen. Select your primary screen monitor and click **Allow**.
5. **Control Live:** Minimize the dashboard window to your tray whenever you want. Use the tray context menu item `Show Dashboard` to bring it back. Use `Pause` to stop recording temporarily (which smoothly drops a visual pause indicator inside the video file) and click `Stop & Compile` to wrap up your video file completely.

---

## ⚠️ Important Configuration for Hyprland Users

Because Wayland relies on secure application isolations, you **must** ensure your session environment imports variables properly to let the application handshake with your desktop portal daemon. 

Make sure your `~/.config/hypr/hyprland.conf` contains the following lines:
```ini
exec-once = dbus-update-activation-environment --systemd WAYLAND_DISPLAY XDG_CURRENT_DESKTOP
exec-once = systemctl --user import-environment WAYLAND_DISPLAY XDG_CURRENT_DESKTOP
```
Without these configurations active, the portal service will fail to pass hardware frame buffers to the application loop.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
