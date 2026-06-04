cmake_minimum_required(VERSION 3.22)
project(TimelapseTray VERSION 1.0.0 LANGUAGES CXX OBJCXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find Dependencies
find_package(Qt6 REQUIRED COMPONENTS Widgets Gui Core)

find_package(PkgConfig REQUIRED)
pkg_check_modules(FFMPEG REQUIRED IMPORTED_TARGET libavcodec libavformat libswscale libavutil)

# Source files asset arrays
set(SOURCES
    src/main.cpp
    src/dashboard.h
    src/dashboard.cpp
    src/recorder.h
    src/recorder.cpp
    src/capture/capturer.h
)

# Platform Conditional Configurations
if(WIN32)
    list(APPEND SOURCES src/capture/capturer_win.cpp)
    set(PLATFORM_LIBS d3d11 dxgi)
    add_definitions(-DPLATFORM_WINDOWS)
elseif(APPLE)
    list(APPEND SOURCES src/capture/capturer_mac.mm)
    find_library(COCOA_FRAMEWORK Cocoa REQUIRED)
    find_library(SC_FRAMEWORK ScreenCaptureKit REQUIRED)
    set(PLATFORM_LIBS ${COCOA_FRAMEWORK} ${SC_FRAMEWORK})
    add_definitions(-DPLATFORM_MACOS)
else()
    # Linux Wayland Stack
    list(APPEND SOURCES src/capture/capturer_wayland.cpp)
    pkg_check_modules(PIPEWIRE REQUIRED IMPORTED_TARGET libpipewire-0.3)
    pkg_check_modules(GIO REQUIRED IMPORTED_TARGET gio-2.0)
    set(PLATFORM_LIBS PkgConfig::PIPEWIRE PkgConfig::GIO)
    add_definitions(-DPLATFORM_LINUX)
endif()

add_executable(${PROJECT_NAME} ${SOURCES})

target_link_libraries(${PROJECT_NAME} PRIVATE
    Qt6::Widgets
    Qt6::Gui
    Qt6::Core
    PkgConfig::FFMPEG
    ${PLATFORM_LIBS}
)

# Windows Executable Optimization (No background console windows popup)
if(WIN32)
    set_target_properties(${PROJECT_NAME} PROPERTIES WIN32_EXECUTABLE TRUE)
endif()
