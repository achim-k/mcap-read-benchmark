import { loadDecompressHandlers } from "@mcap/support";
import { McapIndexedReader } from "@mcap/core";

class McapReadableBuffer {
  // Implements IReadable
  #buffer;

  constructor(buffer) {
    this.#buffer = buffer;
  }
  async size() {
    return BigInt(this.#buffer.byteLength);
  }
  async read(offset, size) {
    if (offset < 0n || offset + size > BigInt(this.#buffer.byteLength)) {
      throw new Error("read out of range");
    }
    return new Uint8Array(this.#buffer.buffer, Number(offset), Number(size));
  }
}

const decompressHandlersPromise = loadDecompressHandlers();
console.log("IndexedReader Worker initialized");

let fileContent;

async function run(bytesReadForProgressUpdate, validateCrcs) {
  const decompressHandlers = await decompressHandlersPromise;
  const readableBuffer = new McapReadableBuffer(fileContent);
  const reader = await McapIndexedReader.Initialize({
    readable: readableBuffer,
    decompressHandlers,
  });

  let numMsgs = 0;
  let bytesRead = 0;
  let bytesReadReset = 0;

  const readStart = self.performance.now();

  for await (const message of reader.readMessages({
    validateCrcs,
  })) {
    ++numMsgs;
    bytesRead += message.data.length;
    bytesReadReset += message.data.length;

    // Post a status update every X bytes read
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
  }

  const end = performance.now();
  return {
    numMsgs,
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
