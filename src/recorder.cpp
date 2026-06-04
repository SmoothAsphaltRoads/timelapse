#include "recorder.h"
#include <QPainter>
#include <QGuiApplication>
#include <QScreen>
#include <QFont>

extern "C" {
    #include <libavcodec/avcodec.h>
    #include <libavformat/avformat.h>
    #include <libswscale/swscale.h>
    #include <libavutil/imgutils.h>
}

TimelapseRecorder::TimelapseRecorder(QObject *parent) : QObject(parent) {
    m_timer = new QTimer(this);
    connect(m_timer, &QTimer::timeout, this, &TimelapseRecorder::processFrameCycle);
    m_capturer = ScreenCapturer::create();
}

TimelapseRecorder::~TimelapseRecorder() {
    cleanupFFmpeg();
}

bool TimelapseRecorder::initFFmpegWebM(const QString& path, int width, int height) {
    avformat_alloc_output_context2(&m_fmtCtx, nullptr, "webm", path.toStdString().c_str());
    if (!m_fmtCtx) return false;

    // VP9 Codec delivers incredibly tiny footprint sizes for WebM targets
    const AVCodec* codec = avcodec_find_encoder(AV_CODEC_ID_VP9);
    if (!codec) codec = avcodec_find_encoder(AV_CODEC_ID_VP8); // Fallback standard
    
    m_stream = avformat_new_stream(m_fmtCtx, codec);
    m_codecCtx = avcodec_alloc_context3(codec);
    
    m_codecCtx->width = width;
    m_codecCtx->height = height;
    m_codecCtx->time_base = {1, m_outputFps};
    m_codecCtx->pix_fmt = AV_PIX_FMT_YUV420P;
    m_codecCtx->bit_rate = 2000000; // Target smooth stable bit rate profile

    if (avcodec_open2(m_codecCtx, codec, nullptr) < 0) return false;

    m_stream->time_base = m_codecCtx->time_base;
    if (!(m_fmtCtx->oformat->flags & AVFMT_NOFILE)) {
        if (avio_open(&m_fmtCtx->pb, path.toStdString().c_str(), AVIO_FLAG_WRITE) < 0) return false;
    }

    avformat_write_header(m_fmtCtx, nullptr);

    m_avFrame = av_frame_alloc();
    m_avFrame->format = m_codecCtx->pix_fmt;
    m_avFrame->width = width;
    m_avFrame->height = height;
    av_image_alloc(m_avFrame->data, m_avFrame->linesize, width, height, m_codecCtx->pix_fmt, 32);

    m_swsCtx = sws_getContext(width, height, AV_PIX_FMT_RGBA, 
                              width, height, m_codecCtx->pix_fmt, 
                              SWS_BICUBIC, nullptr, nullptr, nullptr);
    return true;
}

bool TimelapseRecorder::startRecording(const QString& outputPath, int speedFactor, int inputFps, int outputFps, int maxWidth) {
    m_speedFactor = speedFactor;
    m_outputFps = outputFps;
    m_maxWidth = maxWidth;
    m_frameCount = 0;

    if (!m_capturer->init(1)) return false;

    // Derive target bounds
    QScreen *screen = QGuiApplication::primaryScreen();
    int w = screen->size().width();
    int h = screen->size().height();
    if (m_maxWidth > 0 && w > m_maxWidth) {
        h = (h * m_maxWidth) / w;
        w = m_maxWidth;
    }

    // Force configurations to layout alignments divisible by 2 for standard video frame constraints
    w &= ~1; h &= ~1;

    if (!initFFmpegWebM(outputPath, w, h)) return false;

    m_isRecording = true;
    m_isPaused = false;

    int msInterval = (1000 / inputFps) * m_speedFactor;
    m_timer->start(msInterval);
    return true;
}

void TimelapseRecorder::processFrameCycle() {
    if (!m_isRecording) return;

    QImage frame = m_capturer->captureFrame();
    if (frame.isNull()) {
        // Hardware frame platform level abstraction fallback layer 
        QScreen *screen = QGuiApplication::primaryScreen();
        frame = screen->grabWindow(0).toImage().convertToFormat(QImage::Format_RGBA8888);
    }

    // Downscale calculation limits
    if (m_maxWidth > 0 && frame.width() > m_maxWidth) {
        frame = frame.scaledToWidth(m_maxWidth, Qt::SmoothTransformation);
    }

    drawDynamicOverlays(frame);
    commitFrameToBuffer(frame);
}

void TimelapseRecorder::drawDynamicOverlays(QImage& frame) {
    QPainter painter(&frame);
    painter.setRenderHint(QPainter::Antialiasing);

    if (m_isPaused) {
        // Dim frame layer
        painter.fillRect(frame.rect(), QColor(0, 0, 0, 160));
        
        // Classic Pause emblem marker
        painter.setPen(Qt::NoPen);
        painter.setBrush(QColor(255, 255, 255, 220));
        painter.drawRoundedRect(frame.width()/2 - 35, frame.height()/2 - 50, 22, 100, 5, 5);
        painter.drawRoundedRect(frame.width()/2 + 13, frame.height()/2 - 50, 22, 100, 5, 5);
    }

    // Build the bottom telemetry dashboard interface HUD inside the video matrix frame
    int barWidth = frame.width() * 0.4;
    int barHeight = 45;
    int posX = 40;
    int posY = frame.height() - 85;

    painter.setPen(Qt::NoPen);
    painter.setBrush(QColor(15, 15, 15, 180));
    painter.drawRoundedRect(posX, posY, barWidth, barHeight, 8, 8);

    // Speed / Progress Frame Text Matrix
    painter.setPen(QColor(240, 240, 240));
    painter.setFont(QFont("Arial", 11, QFont::DemiBold));
    QString hudInfo = QString("TIME-LAPSE | Frame: %1 | Multiplier: %2x").arg(m_frameCount).arg(m_speedFactor);
    painter.drawText(posX + 20, posY + 28, hudInfo);

    // Accent real-time pulse loading bar inside the video container
    painter.setBrush(QColor(46, 204, 113, 220));
    int loaderWidth = (m_frameCount % 100) * (barWidth / 100.0);
    painter.drawRect(posX, posY + barHeight - 4, loaderWidth, 4);

    painter.end();
}

void TimelapseRecorder::commitFrameToBuffer(const QImage& frame) {
    const uint8_t* inData[1] = { frame.bits() };
    int inLinesize[1] = { static_cast<int>(frame.bytesPerLine()) };
    
    sws_scale(m_swsCtx, inData, inLinesize, 0, frame.height(), m_avFrame->data, m_avFrame->linesize);
    m_avFrame->pts = m_frameCount++;

    avcodec_send_frame(m_codecCtx, m_avFrame);
    AVPacket* pkt = av_packet_alloc();
    while (avcodec_receive_packet(m_codecCtx, pkt) == 0) {
        av_interleaved_write_frame(m_fmtCtx, pkt);
        av_packet_unref(pkt);
    }
    av_packet_free(&pkt);
}

void TimelapseRecorder::pauseRecording()  { m_isPaused = true; }
void TimelapseRecorder::resumeRecording() { m_isPaused = false; }

void TimelapseRecorder::stopRecording() {
    m_timer->stop();
    m_isRecording = false;
    cleanupFFmpeg();
    m_capturer->release();
}

void TimelapseRecorder::cleanupFFmpeg() {
    if (m_fmtCtx) {
        av_write_trailer(m_fmtCtx);
        avcodec_free_context(&m_codecCtx);
        av_frame_free(&m_avFrame);
        sws_freeContext(m_swsCtx);
        if (!(m_fmtCtx->oformat->flags & AVFMT_NOFILE)) {
            avio_closep(&m_fmtCtx->pb);
        }
        avformat_free_context(m_fmtCtx);
        m_fmtCtx = nullptr;
    }
}
