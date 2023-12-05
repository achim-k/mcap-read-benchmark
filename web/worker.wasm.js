import * as wasm from "read_mcap_wasm";

console.log("WASM Worker initialized");

self.onmessage = async (event) => {
  const { fileContent, bytesReadForProgressUpdate, wasmMsgBulkSize: batchSize } = event.data;
  const totalStart = self.performance.now();
  wasm.init(fileContent);
  let numMsgs = 0;
  let bytesRead = 0;
  let bytesReadReset = 0;
  const readStart = self.performance.now();
  let msgs = wasm.read_messages(batchSize);
  while (msgs.length > 0) {
    numMsgs += msgs.length;
    const newBytesRead = msgs.reduce((acc, msg) => acc + msg.data.length, 0);
    bytesRead += newBytesRead;
    bytesReadReset += newBytesRead;

    // Post a status update every X read
    if (bytesReadReset >= bytesReadForProgressUpdate) {
      const now = performance.now();
      self.postMessage({
        finished: false,
        numMsgs,
        bytesRead: bytesRead.toExponential(2),
        durationSinceReadStart: ((now - readStart) / 1000).toFixed(2),
        totalDuration: ((now - totalStart) / 1000).toFixed(2),
      });
      bytesReadReset = 0;
    }

    msgs.forEach((msg) => msg.free()); // Free message instances on wasm-bindgen heap
    msgs = wasm.read_messages(batchSize);
  }

  const now = performance.now();
  const durationSinceStart = ((now - totalStart) / 1000).toFixed(2);
  const durationSinceReadStart = ((now - readStart) / 1000).toFixed(2);
  self.postMessage({
    finished: true,
    numMsgs,
    bytesRead: bytesRead.toExponential(2),
    durationSinceReadStart,
    totalDuration: durationSinceStart,
  });
};
