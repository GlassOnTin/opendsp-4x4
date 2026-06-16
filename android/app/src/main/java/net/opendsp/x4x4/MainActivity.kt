package net.opendsp.x4x4

import android.app.Activity
import android.content.Intent
import android.hardware.usb.UsbManager
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader

/**
 * Thin shell: a full-screen WebView loading the bundled web UI over the
 * WebViewAssetLoader virtual host (offline, avoids file:// quirks), with the USB
 * byte pipe wired in as `window.AndroidUsb`.
 */
class MainActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var usb: UsbHid
    private lateinit var bridge: Bridge

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true // localStorage for saved defaults
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                    assetLoader.shouldInterceptRequest(request.url)
            }
        }
        setContentView(webView)

        usb = UsbHid(
            this,
            onReport = { bytes -> bridge.emitReport(bytes) },
            onState = { connected -> bridge.emitState(connected) },
        )
        bridge = Bridge(webView, usb)
        webView.addJavascriptInterface(bridge, "AndroidUsb")

        webView.loadUrl("https://appassets.androidplatform.net/assets/www/index.html")
        maybeOpenOnAttach(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        maybeOpenOnAttach(intent)
    }

    override fun onDestroy() {
        usb.close()
        super.onDestroy()
    }

    /** Launched/resumed by the attach intent → permission is pre-granted, so open now. */
    private fun maybeOpenOnAttach(intent: Intent?) {
        if (intent?.action == UsbManager.ACTION_USB_DEVICE_ATTACHED) usb.open()
    }
}
