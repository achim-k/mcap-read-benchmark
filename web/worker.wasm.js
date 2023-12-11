import * as wasm from "read_mcap_wasm";

console.log("WASM Worker initialized");

let fileContent;

async function run(bytesReadForProgressUpdate, batchSize) {
  let numMsgs = 0;
  let bytesRead = 0;
  let bytesReadReset = 0;
  wasm.init(fileContent);
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
        duration: ((now - readStart) / 1000).toFixed(2),
      });
      bytesReadReset = 0;
    }

    msgs.forEach((msg) => msg.free()); // Free message instances on wasm-bindgen heap
    msgs = wasm.read_messages(batchSize);
  }

  const now = performance.now();
  const duration = ((now - readStart) / 1000).toFixed(2);
  return {numMsgs, bytesRead, duration};
}

self.onmessage = async (event) => {
  if (event.data.cmd === "init") {
    fileContent = event.data.fileContent;
  } else if (event.data.cmd === "run") {
    const { bytesReadForProgressUpdate, wasmMsgBulkSize } = event.data;
    const {numMsgs, bytesRead, duration} = await run(bytesReadForProgressUpdate, wasmMsgBulkSize);
    self.postMessage({
      finished: true,
      numMsgs,
      bytesRead: bytesRead.toExponential(2),
      duration,
    });
  }
};
