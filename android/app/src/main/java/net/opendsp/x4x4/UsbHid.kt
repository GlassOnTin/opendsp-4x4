package net.opendsp.x4x4

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbEndpoint
import android.hardware.usb.UsbInterface
import android.hardware.usb.UsbManager
import android.os.Build
import android.util.Log

/**
 * USB-host I/O for the DSP's HID interface. A dumb byte pipe: enumerate by VID/PID,
 * get runtime permission, claim the interface (force=true, detaching the kernel HID
 * driver), then a read thread forwards inbound reports. All timing/retry logic lives
 * in the TypeScript transport — this side just moves bytes.
 */
class UsbHid(
    private val context: Context,
    private val onReport: (ByteArray) -> Unit,
    private val onState: (Boolean) -> Unit,
) {
    companion object {
        const val VENDOR_ID = 0x0168
        const val PRODUCT_ID = 0x0821
        private const val ACTION_PERMISSION = "net.opendsp.x4x4.USB_PERMISSION"
        private const val TAG = "UsbHid"
        private const val REPORT_LEN = 64   // 64-byte interrupt reports
        private const val IO_TIMEOUT = 200  // ms per bulkTransfer
    }

    private val usb get() = context.getSystemService(Context.USB_SERVICE) as UsbManager

    private var connection: UsbDeviceConnection? = null
    private var iface: UsbInterface? = null
    private var epIn: UsbEndpoint? = null
    private var epOut: UsbEndpoint? = null
    private var readThread: Thread? = null
    @Volatile private var running = false

    fun isConnected(): Boolean = connection != null

    /** Find the DSP and open it, requesting permission if it isn't already granted. */
    fun open() {
        if (isConnected()) { onState(true); return }
        val device = findDevice()
        if (device == null) { Log.w(TAG, "no DSP attached"); onState(false); return }
        if (usb.hasPermission(device)) openDevice(device) else requestPermission(device)
    }

    fun write(bytes: ByteArray) {
        val conn = connection ?: return
        val ep = epOut ?: return
        conn.bulkTransfer(ep, bytes, bytes.size, IO_TIMEOUT)
    }

    fun close() {
        running = false
        readThread?.join(300)
        readThread = null
        iface?.let { connection?.releaseInterface(it) }
        connection?.close()
        connection = null; iface = null; epIn = null; epOut = null
        onState(false)
    }

    private fun findDevice(): UsbDevice? =
        usb.deviceList.values.firstOrNull { it.vendorId == VENDOR_ID && it.productId == PRODUCT_ID }

    private fun requestPermission(device: UsbDevice) {
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_IMMUTABLE else 0
        val pi = PendingIntent.getBroadcast(
            context, 0, Intent(ACTION_PERMISSION).setPackage(context.packageName), flags,
        )
        val filter = IntentFilter(ACTION_PERMISSION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
            context.registerReceiver(permissionReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        else
            @Suppress("UnspecifiedRegisterReceiverFlag") context.registerReceiver(permissionReceiver, filter)
        usb.requestPermission(device, pi)
    }

    private val permissionReceiver = object : BroadcastReceiver() {
        override fun onReceive(c: Context, intent: Intent) {
            if (intent.action != ACTION_PERMISSION) return
            context.unregisterReceiver(this)
            val device = deviceFrom(intent)
            if (intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false) && device != null)
                openDevice(device)
            else onState(false)
        }
    }

    private fun openDevice(device: UsbDevice) {
        // Prefer the HID interface (class 3); fall back to interface 0.
        val intf = (0 until device.interfaceCount).map { device.getInterface(it) }
            .firstOrNull { it.interfaceClass == UsbConstants.USB_CLASS_HID }
            ?: device.getInterface(0)

        var ein: UsbEndpoint? = null
        var eout: UsbEndpoint? = null
        for (i in 0 until intf.endpointCount) {
            val ep = intf.getEndpoint(i)
            if (ep.direction == UsbConstants.USB_DIR_IN) ein = ep else eout = ep
        }

        val conn = usb.openDevice(device)
        if (conn == null || ein == null || eout == null) {
            Log.w(TAG, "open failed conn=$conn in=$ein out=$eout")
            conn?.close(); onState(false); return
        }
        if (!conn.claimInterface(intf, true)) { // force=true detaches any kernel HID driver
            Log.w(TAG, "claimInterface failed")
            conn.close(); onState(false); return
        }

        connection = conn; iface = intf; epIn = ein; epOut = eout
        startReadThread()
        onState(true)
    }

    private fun startReadThread() {
        running = true
        readThread = Thread {
            val conn = connection ?: return@Thread
            val ep = epIn ?: return@Thread
            val buf = ByteArray(REPORT_LEN)
            while (running) {
                // Android services interrupt endpoints through bulkTransfer too.
                val n = conn.bulkTransfer(ep, buf, buf.size, IO_TIMEOUT)
                if (n > 0) onReport(buf.copyOf(n))
            }
        }.also { it.isDaemon = true; it.start() }
    }

    private fun deviceFrom(intent: Intent): UsbDevice? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
            intent.getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice::class.java)
        else
            @Suppress("DEPRECATION") intent.getParcelableExtra(UsbManager.EXTRA_DEVICE)
}
