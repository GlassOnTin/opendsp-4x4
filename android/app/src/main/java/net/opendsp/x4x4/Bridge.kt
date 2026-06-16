package net.opendsp.x4x4

import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.WebView

/**
 * The JS-facing byte pipe injected as `window.AndroidUsb`. JS → native calls are
 * synchronous; inbound reports and connect/drop events are pushed back to the page
 * via evaluateJavascript on the UI thread. Bytes cross the boundary as base64.
 */
class Bridge(private val webView: WebView, private val usb: UsbHid) {

    @JavascriptInterface
    fun open() = usb.open()

    @JavascriptInterface
    fun write(b64: String) = usb.write(Base64.decode(b64, Base64.NO_WRAP))

    @JavascriptInterface
    fun close() = usb.close()

    @JavascriptInterface
    fun isConnected(): Boolean = usb.isConnected()

    fun emitReport(bytes: ByteArray) {
        val b64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
        webView.post { webView.evaluateJavascript("window.__dsp_onReport && window.__dsp_onReport('$b64')", null) }
    }

    fun emitState(connected: Boolean) {
        webView.post { webView.evaluateJavascript("window.__dsp_onState && window.__dsp_onState($connected)", null) }
    }
}
