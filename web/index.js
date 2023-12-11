const wasmWorker = new Worker(new URL("./worker.wasm.js", import.meta.url));
const jsIndexedReaderWorker = new Worker(
  new URL("./worker.indexed_reader.js", import.meta.url)
);
const jsStreamReaderWorker = new Worker(
  new URL("./worker.stream_reader.js", import.meta.url)
);

const filePicker = document.getElementById("file-picker");
const btnRun = document.getElementById("btn-run");
const chbxParallel = document.getElementById("checkbox-parallel");
const chbxValidateCrc = document.getElementById("checkbox-validate-crc");
const inputProgressMegaBytes = document.getElementById(
  "progress-update-after-mb-read"
);
const inputWasmBatchSize = document.getElementById("wasm-fetch-messages-count");
const inputNumRuns = document.getElementById("num-runs");
const logElement = document.getElementById("log");
const log = (val) => (logElement.innerHTML = val);

const AVAILABLE_READERS = [
  {
    name: "WasmReader",
    worker: wasmWorker,
    containerId: "wasm-reader",
  },
  {
    name: "StreamReader",
    worker: jsStreamReaderWorker,
    containerId: "js-stream-reader",
  },
  {
    name: "IndexedReader",
    worker: jsIndexedReaderWorker,
    containerId: "js-indexed-reader",
  },
];

const RUN_CONFIG_ELEMENTS = [
  btnRun,
  chbxParallel,
  chbxValidateCrc,
  inputProgressMegaBytes,
  inputWasmBatchSize,
  inputNumRuns
];

async function read_file_into_uint8_array(file) {
  const reader = new FileReader();
  const readPromise = new Promise((resolve) => {
    reader.addEventListener("loadend", () => resolve());
  });
  reader.readAsArrayBuffer(file);
  await readPromise;
  return new Uint8Array(reader.result);
}

const median = (arr) => {
  return arr.slice().sort((a, b) => a - b)[Math.floor(arr.length / 2)];
};

btnRun.onclick = async () => {
  const file = filePicker.files[0];
  if (file == undefined) {
    log("No file");
    return;
  } else if (file.size > 1.5e9) {
    log("File too large (must fit into memory)");
    return;
  }
  RUN_CONFIG_ELEMENTS.forEach((element) => (element.disabled = true));

  log("Reading file into buffer...");
  const fileContent = await read_file_into_uint8_array(file);
  log("");

  const runParallel = chbxParallel.checked;
  const validateCrcs = chbxValidateCrc.checked;
  const bytesReadForProgressUpdate = inputProgressMegaBytes.value * 1024 * 1024;
  const wasmMsgBulkSize = inputWasmBatchSize.value;
  const numRuns = inputNumRuns.value;
  const readers = AVAILABLE_READERS.filter(
    ({ containerId }) =>
      document.querySelector(`#${containerId} input[type="checkbox"]`).checked
  ).map((reader) => {
    const outputElement = document.querySelector(`#${reader.containerId} pre`);
    return {
      ...reader,
      print: (value) => {
        outputElement.innerHTML = JSON.stringify(value);
      },
    };
  });

  readers.forEach(({ worker }) => worker.postMessage({cmd: "init", fileContent}));

  const msgToWorkers = {
    cmd: "run",
    bytesReadForProgressUpdate,
    wasmMsgBulkSize,
    validateCrcs,
  };
  let runResults = {};
  for (let run = 0; run < numRuns; run++) {
    const donePromises = readers.map(({ worker, print }) => {
      return new Promise((resolve, reject) => {
        worker.onerror = (err) => {
          print(err);
          reject(err);
        };
        worker.onmessage = (msg) => {
          const { finished, ...rest } = msg.data;
          print(rest);
          if (finished) {
            resolve(rest);
          }
        };
      });
    });


    if (!runParallel) {
      for (let i = 0; i < readers.length; i++) {
        const { name, worker, print } = readers[i];
        print("");
        worker.postMessage(msgToWorkers);

        try {
          const { duration } = await donePromises[i];
          runResults[name] = (runResults[name] ?? []).concat(duration);
        } catch (err) {
          log(err);
          break;
        }
      }
    } else {
      readers.forEach(({ worker, print }) => {
        print("");
        worker.postMessage(msgToWorkers);
      });

      try {
        const workerResults = await Promise.all(donePromises);
        workerResults.forEach(({ duration }, idx) => {
          const name = readers[idx].name;
          runResults[name] = (runResults[name] ?? []).concat(duration);
        });
      } catch (err) {
        log(err);
        break;
      }
    }

    const timings = Object.entries(runResults).map(([name, arr]) => ({
      name,
      min: Math.min(...arr),
      max: Math.max(...arr),
      median: median(arr),
    }));

    log(
      JSON.stringify(
        { file: file.name, numRuns, timings, run: run + 1 },
        null,
        2
      )
    );
  }

  RUN_CONFIG_ELEMENTS.forEach((element) => (element.disabled = false));
};
