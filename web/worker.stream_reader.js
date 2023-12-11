import { loadDecompressHandlers } from "@mcap/support";
import { McapStreamReader } from "@mcap/core";

const decompressHandlersPromise = loadDecompressHandlers();
console.log("Loading stream reader worker");

let fileContent;

async function run(bytesReadForProgressUpdate, validateCrcs) {
  const decompressHandlers = await decompressHandlersPromise;
  const reader = new McapStreamReader({
    includeChunks: false,
    decompressHandlers,
    validateCrcs,
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
        duration: ((now - readStart) / 1000).toFixed(2),
      });
      bytesReadReset = 0;
    }
    record = reader.nextRecord();
  }

  const end = performance.now();
  return {
    numMsgs,
    bytesRead,
    bytesRead: bytesRead.toExponential(2),
    duration: ((end - readStart) / 1000).toFixed(2),
  };
}

self.onmessage = async (event) => {
  if (event.data.cmd === "init") {
    fileContent = event.data.fileContent;
  } else if (event.data.cmd === "run") {
    const { bytesReadForProgressUpdate, validateCrcs } = event.data;
    const { numMsgs, bytesRead, duration } = await run(
      bytesReadForProgressUpdate,
      validateCrcs
    );
    self.postMessage({
      finished: true,
      numMsgs,
      bytesRead,
      duration,
    });
  }
};
