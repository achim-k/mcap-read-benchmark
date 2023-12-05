// import * as wasm from "read_mcap_wasm";

const wasmWorker = new Worker(new URL('./worker.wasm.js', import.meta.url));
const jsIndexedReaderWorker = new Worker(new URL('./worker.indexed_reader.js', import.meta.url));
const jsStreamReaderWorker = new Worker(new URL('./worker.stream_reader.js', import.meta.url));

const filePicker = document.getElementById("file-picker");
const btnRun = document.getElementById("btn-run");
const chbxSequential = document.getElementById("checkbox-sequential");
const wasmResultOutput = document.getElementById("wasm-result");
const jsIndexedReaderOutput = document.getElementById("default-result");
const jsStreamReaderResultOutput = document.getElementById("stream-reader-result");
const inputProgressMegaBytes = document.getElementById("progress-update-after-mb-read");
const inputWasmBatchSize = document.getElementById("wasm-fetch-messages-count");
const logElement = document.getElementById("log");
const log = (val) => logElement.innerHTML = val;

const workers = [
  { worker: wasmWorker, print: (val) => wasmResultOutput.innerHTML = JSON.stringify(val), },
  { worker: jsStreamReaderWorker, print: (val) => jsStreamReaderResultOutput.innerHTML = JSON.stringify(val), },
  { worker: jsIndexedReaderWorker, print: (val) => jsIndexedReaderOutput.innerHTML = JSON.stringify(val), },
];
const runElements = [
  btnRun, chbxSequential, inputProgressMegaBytes, inputWasmBatchSize,
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

btnRun.onclick = async () => {
  const file = filePicker.files[0];
  if (file == undefined) {
    log("No file");
    return;
  } else if (file.size > 1e9) {
    log("File too large");
    return;
  }
  runElements.forEach(element => element.disabled = true);

  log("Reading file into buffer");
  const fileContent = await read_file_into_uint8_array(file);
  log("");

  const donePromises = workers.map(({worker, print}) => {
    return new Promise((resolve) => {
      worker.onmessage = (msg) => {
        const { finished, ...rest } = msg.data;
        print(rest);
        if (finished) {
          resolve(rest);
        }
      }
    });
  });
  const runSequential = chbxSequential.checked;
  const bytesReadForProgressUpdate = inputProgressMegaBytes.value * 1024 * 1024;
  const wasmMsgBulkSize = inputWasmBatchSize.value;
  const msgToWorkers = {fileContent, bytesReadForProgressUpdate, wasmMsgBulkSize };
  if (runSequential) {
    for (let i = 0; i < workers.length; i++) {
      const {worker, print} = workers[i];
      print("Reading file...");
      worker.postMessage(msgToWorkers);

      for (let j = i; j < workers.length; j++) {
        workers[j].print("Waiting for previous worker to finish...");
      }

      await donePromises[i];
    }
  } else {
    workers.forEach(({worker, print}) => {
      print("Reading file...");
      worker.postMessage(msgToWorkers);
    });
    await Promise.all(donePromises);
  }

  runElements.forEach(element => element.disabled = false);
}





wasmWorker.onmessage = (msg) => { wasmResultOutput.innerHTML = JSON.stringify(msg.data); };
jsIndexedReaderWorker.onmessage = (msg) => { jsIndexedReaderOutput.innerHTML = JSON.stringify(msg.data); };
jsStreamReaderWorker.onmessage = (msg) => { jsStreamReaderResultOutput.innerHTML = JSON.stringify(msg.data); };