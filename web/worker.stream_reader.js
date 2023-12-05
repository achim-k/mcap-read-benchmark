import { loadDecompressHandlers } from "@mcap/support";
import { McapStreamReader } from "@mcap/core";

const decompressHandlersPromise = loadDecompressHandlers();
console.log("Loading stream reader worker");

self.onmessage = async (event) => {
  const decompressHandlers = await decompressHandlersPromise;
  const { fileContent, bytesReadForProgressUpdate } = event.data;
  const totalStart = self.performance.now();
  const reader = new McapStreamReader({
    includeChunks: false,
    decompressHandlers,
    validateCrcs: false,
  });
  reader.append(fileContent);

  let numMsgs = 0;
  let bytesRead = 0;
  let bytesReadReset = 0;
  const readStart = self.performance.now();

  let record = reader.nextRecord();
  while (record != undefined) {
    if (record.type !== "Message") {
      record = reader.nextRecord();
      continue;
    }

    ++numMsgs;
    bytesRead += record.data.length;
    bytesReadReset += record.data.length;

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

    record = reader.nextRecord();
  }

  const end = performance.now();
  self.postMessage({
    finished: true,
    numMsgs,
    bytesRead: bytesRead.toExponential(2),
    durationSinceReadStart: ((end - readStart) / 1000).toFixed(2),
    totalDuration: ((end - totalStart) / 1000).toFixed(2),
  });
};
