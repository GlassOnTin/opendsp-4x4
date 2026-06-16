// Transport abstraction: the one seam between the (stack-agnostic) protocol
// codec and the platform I/O. WebHID implements it for desktop browsers; the
// Android/desktop-native (Kotlin) build will implement the same contract.

export interface DspTransport {
  readonly isOpen: boolean;
  open(): Promise<void>;
  close(): Promise<void>;
  /** Send a request frame; resolve with the raw bytes of the next reply report. */
  request(frame: Uint8Array, timeoutMs?: number): Promise<Uint8Array>;
  /** Subscribe to every inbound report (incl. unsolicited, e.g. meters). Returns an unsubscribe fn. */
  onReport(cb: (report: Uint8Array) => void): () => void;
}
