#include "dashboard.h"
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QLabel>
#include <QFileDialog>
#include <QStyle>

Dashboard::Dashboard(TimelapseRecorder* recorder, QWidget *parent) 
    : QWidget(parent), m_rec(recorder) 
{
    setWindowTitle("Timelapse Studio Panel");
    setFixedSize(320, 190);
    setWindowFlags(Qt::Window | Qt::WindowStaysOnTopHint);

    QVBoxLayout* mainLayout = new QVBoxLayout(this);
    
    QHBoxLayout* configLayout = new QHBoxLayout();
    QLabel* lbl = new QLabel("Speed Multiplier:", this);
    m_speedField = new QSpinBox(this);
    m_speedField->setRange(1, 500);
    m_speedField->setValue(10);
    configLayout->addWidget(lbl);
    configLayout->addWidget(m_speedField);
    mainLayout->addLayout(configLayout);

    m_btnStart = new QPushButton(" Start Capture", this);
    m_btnPause = new QPushButton(" Pause", this);
    m_btnStop = new QPushButton(" Stop & Compile", this);
    
    m_btnPause->setEnabled(false);
    m_btnStop->setEnabled(false);

    mainLayout->addWidget(m_btnStart);
    mainLayout->addWidget(m_btnPause);
    mainLayout->addWidget(m_btnStop);

    connect(m_btnStart, &QPushButton::clicked, this, &Dashboard::actionStart);
    connect(m_btnPause, &QPushButton::clicked, this, &Dashboard::actionPause);
    connect(m_btnStop, &QPushButton::clicked, this, &Dashboard::actionStop);
}

void Dashboard::actionStart() {
    QString dest = QFileDialog::getSaveFileName(this, "Target WebM Output Location", "", "WebM Core Video (*.webm)");
    if(dest.isEmpty()) return;

    if (m_rec->startRecording(dest, m_speedField->value(), 24, 24, 1280)) {
        m_btnStart->setEnabled(false);
        m_speedField->setEnabled(false);
        m_btnPause->setEnabled(true);
        m_btnStop->setEnabled(true);
    }
}

void Dashboard::actionPause() {
    if (m_rec->isPaused()) {
        m_rec->resumeRecording();
        m_btnPause->setText(" Pause");
    } else {
        m_rec->pauseRecording();
        m_btnPause->setText(" Resume");
    }
}

void Dashboard::actionStop() {
    m_rec->stopRecording();
    m_btnStart->setEnabled(true);
    m_speedField->setEnabled(true);
    m_btnPause->setEnabled(false);
    m_btnStop->setEnabled(false);
    m_btnPause->setText(" Pause");
}
