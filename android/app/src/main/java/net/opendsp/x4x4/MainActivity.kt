package net.opendsp.x4x4

import android.app.Activity
import android.content.Intent
import android.hardware.usb.UsbManager
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
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
    private var safeTopPx = 0f
    private var safeBottomPx = 0f

    /** Push the current system-bar insets into the page as CSS px variables. */
    private fun applyInsets() {
        webView.evaluateJavascript(
            "document.documentElement.style.setProperty('--safe-top','${safeTopPx}px');" +
                "document.documentElement.style.setProperty('--safe-bottom','${safeBottomPx}px');",
            null,
        )
    }

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
                override fun onPageFinished(view: WebView, url: String) = applyInsets()
            }
        }
        setContentView(webView)

        // targetSdk 35 draws edge-to-edge. WebView ignores view padding for its content
        // viewport, so feed the system-bar insets to CSS (--safe-top/--safe-bottom, in CSS px)
        // and let the page reserve room under the status bar and above the nav bar.
        webView.setBackgroundColor(0xFF0B0E13.toInt()) // --bg, so a load flash isn't white
        WindowCompat.getInsetsController(window, webView).apply {
            isAppearanceLightStatusBars = false // dark theme → light icons
            isAppearanceLightNavigationBars = false
        }
        val density = resources.displayMetrics.density
        ViewCompat.setOnApplyWindowInsetsListener(webView) { _, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            safeTopPx = bars.top / density
            safeBottomPx = bars.bottom / density
            applyInsets()
            WindowInsetsCompat.CONSUMED
        }
        ViewCompat.requestApplyInsets(webView)

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
