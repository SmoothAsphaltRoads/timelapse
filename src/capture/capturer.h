#pragma once
#include <QImage>
#include <memory>

class ScreenCapturer {
public:
    virtual ~ScreenCapturer() = default;
    virtual bool init(int monitorIndex) = 0;
    virtual QImage captureFrame() = 0;
    virtual void release() = 0;

    static std::unique_ptr<ScreenCapturer> create();
};
