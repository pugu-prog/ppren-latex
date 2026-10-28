// PPREN: LaTeX → PDF direkt im Browser (pdfTeX als WebAssembly, eegene Worker).
// Benotzung: <script src=".../ppren-latex.js"></script>, dann  const blob = await PprenLatex.pdf(texQuell);
// Déi éischte Kéier ginn ~20 MB gelueden (Engine + TeX-Bündel), duerno kënnt alles aus dem Browser-Cache.
(function () {
  const BASIS = new URL(".", document.currentScript.src).href;
  let worker = null, init = null, zaehler = 0;
  const offen = {};

  function holWorker() {
    if (worker) return worker;
    worker = new Worker(BASIS + "ppren-latex-worker.js");
    worker.onmessage = ({ data }) => {
      const o = offen[data.id];
      if (!o) return;
      delete offen[data.id];
      if (data.ok) o.res(data);
      else o.rej(Object.assign(new Error(data.error || "LaTeX-Feeler"), { log: data.log }));
    };
    worker.onerror = (e) => {
      Object.values(offen).forEach((o) => o.rej(new Error("Worker-Feeler: " + (e.message || e))));
      Object.keys(offen).forEach((k) => delete offen[k]);
      worker = null; init = null;
    };
    return worker;
  }

  function ruffen(msg) {
    return new Promise((res, rej) => {
      const id = ++zaehler;
      offen[id] = { res, rej };
      holWorker().postMessage(Object.assign({ id }, msg));
    });
  }

  window.PprenLatex = {
    unterstuetzt: typeof WebAssembly === "object" && typeof DecompressionStream === "function" && typeof Worker === "function",
    bereet() {
      init = init || ruffen({ typ: "init", basis: BASIS }).catch((e) => { init = null; throw e; });
      return init;
    },
    async pdf(tex) {
      await this.bereet();
      const r = await ruffen({ typ: "kompileieren", tex });
      return new Blob([r.pdf], { type: "application/pdf" });
    },

    // Wat kann de Backend? (?version=1 → features), z.B. ["latexBrowser", "latexFeeler"]
    async backendFeatures(webAppUrl) {
      try {
        const v = await (await fetch(webAppUrl + "?version=1")).json();
        return Array.isArray(v.features) ? v.features : [];
      } catch (e) {
        return [];
      }
    },

    // Kennt de Backend d'Browser-LaTeX-Aktiounen?
    async backendKann(webAppUrl) {
      return this.unterstuetzt && (await this.backendFeatures(webAppUrl)).includes("latexBrowser");
    },

    // Oppen LaTeX-Optraeg (Docs-PDF → LaTeX-PDF) ofschaffen. Gëtt {fertig, feeler} zréck.
    async optraegErneieren({ webAppUrl, token, onStatus }) {
      const status = onStatus || (() => {});
      const features = this.unterstuetzt ? await this.backendFeatures(webAppUrl) : [];
      if (!features.includes("latexBrowser")) return { fertig: 0, feeler: 0 };
      const post = async (body) => (await fetch(webAppUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(Object.assign({ token }, body)),
      })).json();
      const l = await post({ typ: "latexOptraeg" });
      if (!l.ok || !l.optraeg.length) return { fertig: 0, feeler: 0 };
      let fertig = 0, feeler = 0;
      for (const o of l.optraeg) {
        status(`LaTeX-PDF ${fertig + feeler + 1}/${l.optraeg.length} (${o.typ}) …`);
        try {
          const q = await post({ typ: "latexQuell", id: o.id });
          if (!q.ok) throw new Error(q.error);
          const pdfBase64 = await blobAlsBase64(await this.pdf(q.tex));
          const r = await post({ typ: "latexPdf", id: o.id, versioun: q.versioun, pdfBase64 });
          if (!r.ok && !r.veraltet) throw new Error(r.error);
          fertig++;
        } catch (e) {
          feeler++;
          console.warn("LaTeX-PDF", o, e);
          // de Grond am Blat "LatexOptraeg" notéieren (Optrag bleift oppen)
          if (features.includes("latexFeeler")) {
            const log = String(e.log || "").split("\n").filter((z) => /^!|Error|error/.test(z)).slice(0, 8).join(" | ");
            post({ typ: "latexFeeler", id: o.id, versioun: o.versioun, feeler: e.message + (log ? " — " + log : "") }).catch(() => {});
          }
        }
      }
      status(`${fertig} LaTeX-PDF${fertig === 1 ? "" : "en"} erneiert${feeler ? `, ${feeler} Feeler` : ""}`);
      return { fertig, feeler };
    },
  };

  function blobAlsBase64(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(",")[1]);
      r.onerror = () => rej(r.error);
      r.readAsDataURL(blob);
    });
  }
})();
