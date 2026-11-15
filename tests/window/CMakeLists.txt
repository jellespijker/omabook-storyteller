# The plugin in Omabook's real window, offscreen: see harness.cpp.
#
# It links Omabook's own code, so it needs Omabook's source tree and a build
# of it (for libomabook_core.a):
#
#   cmake -S tests/window -B /tmp/storyteller-window \
#         -DOMABOOK_SOURCE=/path/to/omabook -DOMABOOK_BUILD=/path/to/omabook/build
#   cmake --build /tmp/storyteller-window
#   STORYTELLER=$PWD SHOTS=/tmp/storyteller-window/shots QT_QPA_PLATFORM=offscreen \
#       /tmp/storyteller-window/window_harness
cmake_minimum_required(VERSION 3.21)
project(storyteller_window LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 23)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(OMABOOK_SOURCE "" CACHE PATH "Omabook's source tree")
set(OMABOOK_BUILD "" CACHE PATH "A build of Omabook, holding libomabook_core.a")
if(NOT EXISTS "${OMABOOK_SOURCE}/src/resources.qrc" OR NOT EXISTS "${OMABOOK_BUILD}/libomabook_core.a")
  message(FATAL_ERROR "Set OMABOOK_SOURCE to Omabook's source tree and OMABOOK_BUILD to a build of it.")
endif()
find_package(Qt6 REQUIRED COMPONENTS Core Gui Network Qml Quick QuickControls2 DBus Sql Concurrent Test)
find_package(PkgConfig REQUIRED)
pkg_check_modules(LIBARCHIVE REQUIRED IMPORTED_TARGET libarchive)
pkg_check_modules(POPPLER_QT6 REQUIRED IMPORTED_TARGET poppler-qt6)
add_executable(window_harness harness.cpp ${OMABOOK_SOURCE}/src/resources.qrc)
target_include_directories(window_harness PRIVATE ${OMABOOK_SOURCE}/src)
target_compile_definitions(window_harness PRIVATE OMABOOK_VERSION="0.1.4")
target_link_libraries(window_harness PRIVATE ${OMABOOK_BUILD}/libomabook_core.a
  Qt6::Core Qt6::Gui Qt6::Network Qt6::Qml Qt6::Quick Qt6::QuickControls2 Qt6::DBus Qt6::Sql Qt6::Concurrent Qt6::Test
  PkgConfig::LIBARCHIVE PkgConfig::POPPLER_QT6)
