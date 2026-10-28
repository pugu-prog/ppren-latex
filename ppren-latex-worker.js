// PPREN: pdfTeX (busytex, WebAssembly) im Browser. Lädt die Engine und das eigene kleine TeX-Bündel
// (ppren-texmf.bin.gz) einmal und kompiliert dann LaTeX-Quellen zu PDF. Keine Daten verlassen den Browser.
importScripts("busytex_pipeline.js");

let bereit = null;

async function entpacken(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ": HTTP " + r.status);
  return new Uint8Array(await new Response(r.body.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
}

function mkdirP(FS, pfad) {
  let teil = "";
  for (const s of pfad.split("/").slice(1, -1)) {
    teil += "/" + s;
    try { FS.mkdir(teil); } catch (e) { /* gëtt et schonn */ }
  }
}

async function starten(basis) {
  const wasm = await entpacken(basis + "busytex.wasm.gz");
  const wasmUrl = URL.createObjectURL(new Blob([wasm], { type: "application/wasm" }));
  const pipeline = new BusytexPipeline(basis + "busytex.js", wasmUrl, [], [], [], () => {}, () => {}, true, BusytexPipeline.ScriptLoaderWorker);
  const [Module, buendel] = await Promise.all([pipeline.Module, entpacken(basis + "ppren-texmf.bin.gz")]);
  const kopfLaengt = new DataView(buendel.buffer, buendel.byteOffset).getUint32(0);
  const liste = JSON.parse(new TextDecoder().decode(buendel.subarray(4, 4 + kopfLaengt)));
  let pos = 4 + kopfLaengt;
  // kpathsea brauch e Programm-Pfad (am grousse busytex-Paket ass dat eng 1-Byte-Datei)
  mkdirP(Module.FS, "/bin/busytex");
  Module.FS.writeFile("/bin/busytex", " ");
  for (const [pfad, laengt] of liste) {
    mkdirP(Module.FS, pfad);
    Module.FS.writeFile(pfad, buendel.subarray(pos, pos + laengt));
    pos += laengt;
  }
  return pipeline;
}

onmessage = async ({ data }) => {
  const { id, typ } = data;
  try {
    if (typ === "init") {
      bereit = bereit || starten(data.basis);
      await bereit;
      postMessage({ id, ok: true });
    } else if (typ === "kompileieren") {
      if (!bereit) throw new Error("Net initialiséiert");
      const pipeline = await bereit;
      const r = await pipeline.compile([{ path: "main.tex", contents: data.tex }], "main.tex", false, "silent", "pdftex_bibtex8", []);
      if (r.pdf && r.pdf.length) postMessage({ id, ok: true, pdf: r.pdf }, [r.pdf.buffer]);
      else postMessage({ id, ok: false, error: "LaTeX-Feeler", log: String(r.log || "").slice(-3000) });
    }
  } catch (e) {
    postMessage({ id, ok: false, error: String(e && e.message || e) });
  }
};
