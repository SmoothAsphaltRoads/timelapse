#ifdef PLATFORM_WINDOWS
#include "capturer.h"
#include <windows.h>
#include <d3d11.h>
#include <dxgi1_2.h>

class WindowsCapturer : public ScreenCapturer {
    ID3D11Device* device = nullptr;
    ID3D11DeviceContext* context = nullptr;
    IDXGIOutputDuplication* deskDupl = nullptr;
public:
    bool init(int monitorIndex) override {
        D3D_FEATURE_LEVEL fl;
        D3D11CreateDevice(nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr, 0, nullptr, 0, D3D11_SDK_VERSION, &device, &fl, &context);
        
        IDXGIDevice* dxgiDevice = nullptr;
        device->QueryInterface(__uuidof(IDXGIDevice), (void**)&dxgiDevice);
        IDXGIAdapter* dxgiAdapter = nullptr;
        dxgiDevice->GetParent(__uuidof(IDXGIAdapter), (void**)&dxgiAdapter);
        
        IDXGIOutput* dxgiOutput = nullptr;
        dxgiAdapter->EnumOutputs(monitorIndex - 1 >= 0 ? monitorIndex - 1 : 0, &dxgiOutput);
        
        IDXGIOutput1* dxgiOutput1 = nullptr;
        dxgiOutput->QueryInterface(__uuidof(IDXGIOutput1), (void**)&dxgiOutput1);
        dxgiOutput1->DuplicateOutput(device, &deskDupl);
        
        // Cleanup intermediates
        dxgiOutput1->Release(); dxgiOutput->Release(); dxgiAdapter->Release(); dxgiDevice->Release();
        return deskDupl != nullptr;
    }

    QImage captureFrame() override {
        if (!deskDupl) return QImage();
        DXGI_OUTDUPL_FRAME_INFO frameInfo;
        IDXGIResource* desktopResource = nullptr;
        
        if (deskDupl->AcquireNextFrame(100, &frameInfo, &desktopResource) != S_OK) return QImage();
        
        ID3D11Texture2D* tex = nullptr;
        desktopResource->QueryInterface(__uuidof(ID3D11Texture2D), (void**)&tex);
        D3D11_TEXTURE2D_DESC desc;
        tex->GetDesc(&desc);
        
        // Stage texture to CPU read space
        desc.Usage = D3D11_USAGE_STAGING;
        desc.BindFlags = 0;
        desc.CPUAccessFlags = D3D11_CPU_ACCESS_READ;
        desc.MiscFlags = 0;
        
        ID3D11Texture2D* stageTex = nullptr;
        device->CreateTexture2D(&desc, nullptr, &stageTex);
        context->CopyResource(stageTex, tex);
        
        D3D11_MAPPED_SUBRESOURCE map;
        context->Map(stageTex, 0, D3D11_MAP_READ, 0, &map);
        
        QImage img((const uchar*)map.pData, desc.Width, desc.Height, map.RowPitch, QImage::Format_RGBA8888);
        QImage out = img.copy(); // Deep Copy
        
        context->Unmap(stageTex, 0);
        stageTex->Release(); tex->Release(); desktopResource->Release();
        deskDupl->ReleaseFrame();
        
        return out;
    }

    void release() override {
        if (deskDupl) deskDupl->Release();
        if (context) context->Release();
        if (device) device->Release();
    }
};

std::unique_ptr<ScreenCapturer> ScreenCapturer::create() { return std::make_unique<WindowsCapturer>(); }
#endif
