#pragma once
#include <QObject>
#include <QTimer>
#include <QImage>
#include <QString>
#include <memory>
#include "capture/capturer.h"

struct AVFormatContext;
struct AVCodecContext;
struct AVStream;
struct AVFrame;
struct SwsContext;

class TimelapseRecorder : public QObject {
    Q_OBJECT
public:
    explicit TimelapseRecorder(QObject *parent = nullptr);
    ~TimelapseRecorder();

    bool startRecording(const QString& outputPath, int speedFactor, int inputFps, int outputFps, int maxWidth);
    void pauseRecording();
    void resumeRecording();
    void stopRecording();

    bool isPaused() const { return m_isPaused; }
    bool isRecording() const { return m_isRecording; }

private slots:
    void processFrameCycle();

private:
    void drawDynamicOverlays(QImage& frame);
    bool initFFmpegWebM(const QString& path, int width, int height);
    void commitFrameToBuffer(const QImage& frame);
    void cleanupFFmpeg();

    QTimer* m_timer;
    std::unique_ptr<ScreenCapturer> m_capturer;
    bool m_isRecording = false;
    bool m_isPaused = false;
    
    int m_frameCount = 0;
    int m_speedFactor = 10;
    int m_outputFps = 24;
    int m_maxWidth = 1280;

    // FFmpeg Frame Pipeline Variables
    AVFormatContext* m_fmtCtx = nullptr;
    AVCodecContext* m_codecCtx = nullptr;
    AVStream* m_stream = nullptr;
    AVFrame* m_avFrame = nullptr;
    SwsContext* m_swsCtx = nullptr;
};
