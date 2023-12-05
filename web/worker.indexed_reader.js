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

self.onmessage = async (event) => {
  const decompressHandlers = await decompressHandlersPromise;
  const { fileContent, bytesReadForProgressUpdate } = event.data;
  const totalStart = self.performance.now();
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
    validateCrcs: false,
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
        durationSinceReadStart: ((now - readStart) / 1000).toFixed(2),
        totalDuration: ((now - totalStart) / 1000).toFixed(2),
      });
      bytesReadReset = 0;
    }
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
