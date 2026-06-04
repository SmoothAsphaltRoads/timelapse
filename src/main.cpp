#include <QApplication>
#include <QSystemTrayIcon>
#include <QMenu>
#include <QAction>
#include <QStyle>
#include "recorder.h"
#include "dashboard.h"

int main(int argc, char *argv[]) {
    QApplication app(argc, argv);
    
    // Prevent background system loop termination when minimizing/closing the configuration panel layout
    QApplication::setQuitOnLastWindowClosed(false);

    TimelapseRecorder recorder;
    Dashboard dashboard(&recorder);

    QSystemTrayIcon trayIcon(app.style()->standardIcon(QStyle::SP_ComputerIcon));
    QMenu trayMenu;

    QAction* actShow = trayMenu.addAction("Show Dashboard");
    trayMenu.addSeparator();
    QAction* actQuit = trayMenu.addAction("Exit Program");

    QObject::connect(actShow, &QAction::triggered, [&]() {
        dashboard.show();
        dashboard.raise();
        dashboard.activateWindow();
    });
    
    QObject::connect(actQuit, &QAction::triggered, [&]() {
        recorder.stopRecording();
        app.quit();
    });

    trayIcon.setContextMenu(&trayMenu);
    trayIcon.show();

    // Automatically display dashboard workspace on boot cycle run
    dashboard.show();

    return app.exec();
}
