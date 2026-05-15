import { describe, expect, it } from "vitest";
import { makeBatchForm, progressLabel } from "@/app/(user)/components/video-quick-launch/types";

describe("progressLabel", () => {
  it("renvoie 'Initialisation…' pour progress 0 (runway)", () => {
    expect(progressLabel(0, "runway")).toBe("Initialisation…");
  });

  it("renvoie 'Initialisation…' pour progress 4 (runway)", () => {
    expect(progressLabel(4, "runway")).toBe("Initialisation…");
  });

  it("renvoie 'Soumission au provider' pour progress 5 (runway)", () => {
    expect(progressLabel(5, "runway")).toBe("Soumission au provider");
  });

  it("renvoie 'Soumission au provider' pour progress 19 (runway)", () => {
    expect(progressLabel(19, "runway")).toBe("Soumission au provider");
  });

  it("renvoie 'Runway génère la vidéo…' pour progress 20 (runway)", () => {
    expect(progressLabel(20, "runway")).toBe("Runway génère la vidéo…");
  });

  it("renvoie 'Runway génère la vidéo…' pour progress 79 (runway)", () => {
    expect(progressLabel(79, "runway")).toBe("Runway génère la vidéo…");
  });

  it("renvoie 'Téléchargement de la vidéo' pour progress 80 (runway)", () => {
    expect(progressLabel(80, "runway")).toBe("Téléchargement de la vidéo");
  });

  it("renvoie 'Téléchargement de la vidéo' pour progress 89 (runway)", () => {
    expect(progressLabel(89, "runway")).toBe("Téléchargement de la vidéo");
  });

  it("renvoie 'Upload sur le storage' pour progress 90 (runway)", () => {
    expect(progressLabel(90, "runway")).toBe("Upload sur le storage");
  });

  it("renvoie 'Upload sur le storage' pour progress 99 (runway)", () => {
    expect(progressLabel(99, "runway")).toBe("Upload sur le storage");
  });

  it("renvoie 'Vidéo prête' pour progress 100 (runway)", () => {
    expect(progressLabel(100, "runway")).toBe("Vidéo prête");
  });

  it("renvoie 'Initialisation…' pour progress 0 (heygen)", () => {
    expect(progressLabel(0, "heygen")).toBe("Initialisation…");
  });

  it("renvoie 'Initialisation…' pour progress 4 (heygen)", () => {
    expect(progressLabel(4, "heygen")).toBe("Initialisation…");
  });

  it("renvoie 'Soumission au provider' pour progress 5 (heygen)", () => {
    expect(progressLabel(5, "heygen")).toBe("Soumission au provider");
  });

  it("renvoie 'Soumission au provider' pour progress 19 (heygen)", () => {
    expect(progressLabel(19, "heygen")).toBe("Soumission au provider");
  });

  it("renvoie 'HeyGen prépare l'avatar…' pour progress 20 (heygen)", () => {
    expect(progressLabel(20, "heygen")).toBe("HeyGen prépare l'avatar…");
  });

  it("renvoie 'HeyGen prépare l'avatar…' pour progress 79 (heygen)", () => {
    expect(progressLabel(79, "heygen")).toBe("HeyGen prépare l'avatar…");
  });

  it("renvoie 'Téléchargement de la vidéo' pour progress 80 (heygen)", () => {
    expect(progressLabel(80, "heygen")).toBe("Téléchargement de la vidéo");
  });

  it("renvoie 'Téléchargement de la vidéo' pour progress 89 (heygen)", () => {
    expect(progressLabel(89, "heygen")).toBe("Téléchargement de la vidéo");
  });

  it("renvoie 'Upload sur le storage' pour progress 90 (heygen)", () => {
    expect(progressLabel(90, "heygen")).toBe("Upload sur le storage");
  });

  it("renvoie 'Upload sur le storage' pour progress 99 (heygen)", () => {
    expect(progressLabel(99, "heygen")).toBe("Upload sur le storage");
  });

  it("renvoie 'Vidéo prête' pour progress 100 (heygen)", () => {
    expect(progressLabel(100, "heygen")).toBe("Vidéo prête");
  });
});

describe("makeBatchForm", () => {
  it("produit un localId string non vide et les defaults canoniques sans seed", () => {
    const form = makeBatchForm();
    expect(typeof form.localId).toBe("string");
    expect(form.localId.length).toBeGreaterThan(0);
    expect(form.prompt).toBe("");
    expect(form.provider).toBe("runway");
    expect(form.duration).toBe(5);
    expect(form.ratio).toBe("1280:720");
  });

  it("génère des localId distincts pour deux appels consécutifs", () => {
    const a = makeBatchForm();
    const b = makeBatchForm();
    expect(a.localId).not.toBe(b.localId);
  });

  it("applique le seed (provider/duration) sans toucher aux autres defaults", () => {
    const form = makeBatchForm({ provider: "heygen", duration: 10 });
    expect(form.provider).toBe("heygen");
    expect(form.duration).toBe(10);
    expect(form.prompt).toBe("");
    expect(form.ratio).toBe("1280:720");
    expect(typeof form.localId).toBe("string");
    expect(form.localId.length).toBeGreaterThan(0);
  });
});
