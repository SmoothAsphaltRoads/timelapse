#pragma once
#include <QWidget>
#include <QSpinBox>
#include <QPushButton>
#include "recorder.h"

class Dashboard : public QWidget {
    Q_OBJECT
public:
    explicit Dashboard(TimelapseRecorder* recorder, QWidget *parent = nullptr);

private slots:
    void actionStart();
    void actionPause();
    void actionStop();

private:
    TimelapseRecorder* m_rec;
    QSpinBox* m_speedField;
    QPushButton* m_btnStart;
    QPushButton* m_btnPause;
    QPushButton* m_btnStop;
};
