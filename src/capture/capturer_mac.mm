#ifdef PLATFORM_MACOS
#include "capturer.h"
#import <ScreenCaptureKit/ScreenCaptureKit.h>

class MacCapturer : public ScreenCapturer {
public:
    bool init(int monitorIndex) override { return true; }
    QImage captureFrame() override { return QImage(); }
    void release() override {}
};

std::unique_ptr<ScreenCapturer> ScreenCapturer::create() { return std::make_unique<MacCapturer>(); }
#endif
