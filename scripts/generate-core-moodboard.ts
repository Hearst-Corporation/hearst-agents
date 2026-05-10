/**
 * Génère le moodboard "Noyau réseau neuronal" pour /spatial.
 *
 * Lance les 5 prompts en parallèle sur OpenAI Images puis Runway,
 * pose chaque PNG dans son dossier (hearst-os-core-v3-{provider}/NN-slug/preview.png)
 * et écrit un INDEX.md récap.
 *
 * Usage :
 *   npx tsx scripts/generate-core-moodboard.ts openai
 *   npx tsx scripts/generate-core-moodboard.ts runway
 *
 * Lit OPENAI_API_KEY et RUNWAY_API_KEY depuis .env.local.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { config } from "dotenv";

config({ path: ".env.local" });

interface Direction {
  slug: string;
  name: string;
  prompt: string;
  brief: string;
}

const SHARED_STYLE_SUFFIX = `
Photographic studio shot, single soft top light, pure black background (#000000),
matte and noble materials, silent luxury aesthetic, no text, no logo, no UI elements,
no cyberpunk neon, no rgb, no glitch effects. References : Apple Vision Pro intro,
Kubrick monolith, MRI neurology, decorticated luxury watch movement, biological organoid.
Centered subject taking ~40% of the frame. Asymmetric organic form. Dark with subtle
muted teal (#4a8b86) accent only on connection points. Aspect ratio 1:1.
`.trim();

const DIRECTIONS: Direction[] = [
  {
    slug: "01-organoid-neural",
    name: "Organoïde neural",
    prompt: `A precious dark biological organoid sphere, ~6cm wide, suspended in pure void.
Its surface is matte black with extremely fine luminescent neural pathways glowing
faintly white-teal, like a microscope view of a brain organoid in lab. Soft pulsing
synapses at random nodes. Looks alive, breathing very slowly. ${SHARED_STYLE_SUFFIX}`,
    brief: `Organoïde biologique noir, surface mate parsemée de filaments synaptiques
blanc-teal extrêmement fins. Mouvement de pulsation synaptique très lent et aléatoire.
Aspect "organe précieux sous vide".`,
  },
  {
    slug: "02-quantum-processor",
    name: "Processeur quantique",
    prompt: `A close-up of a precious quantum processor unit, dark anodized metal frame
with intricate etched circuit traces in muted teal and white, viewed from a 3/4 angle,
slightly asymmetric, like a piece of high-end laboratory equipment. Visible cooling
lines, a single subtle glow point. Solid, heavy, noble. ${SHARED_STYLE_SUFFIX}`,
    brief: `Bloc processeur quantique vu rapproché. Métal noir anodisé, gravures circuit
teal sourdes, vue 3/4 légèrement asymétrique. Aspect équipement de laboratoire haut de
gamme, lourd, précieux.`,
  },
  {
    slug: "03-neural-mesh-sphere",
    name: "Sphère filaments neuronaux",
    prompt: `A dark sphere made entirely of intertwined neural filaments, like a 3D mesh
of dendrites suspended in space. The filaments are matte black with rare teal nodes
where they cross. Translucent, with depth — you can see through to deeper layers of
the network. Slow, mesmerizing rotation. ${SHARED_STYLE_SUFFIX}`,
    brief: `Sphère composée de filaments neuronaux entrelacés, mate avec nœuds teal aux
intersections. Translucide en profondeur. Rotation lente et hypnotique. Référence :
réseau dendritique 3D sous microscope.`,
  },
  {
    slug: "04-cracked-monolith",
    name: "Monolithe fissuré",
    prompt: `A monolithic dark obsidian object, irregular asymmetric shape (not a cube,
not a sphere — something organic and carved), with hairline fractures glowing very
faintly from within in muted teal. The fractures form a pattern like a neural network
mapping. Polished surface, depth, gravity. ${SHARED_STYLE_SUFFIX}`,
    brief: `Monolithe obsidienne irrégulier, forme asymétrique organique. Fissures
internes lumineuses teal sourdes formant un pattern de réseau neuronal. Surface polie,
profondeur. Mélange Kubrick monolith + IRM cérébrale.`,
  },
  {
    slug: "05-fiber-optic-bundle",
    name: "Faisceau fibre optique",
    prompt: `A precious dense bundle of dormant fiber optic threads tied at center,
forming an irregular dark sphere-like cluster. Each fiber tip catches the top light
faintly. The bundle is mostly inert, with maybe 2-3 fibers very subtly pulsing teal
from deep inside. Like a high-end scientific instrument or a sleeping nervous system.
${SHARED_STYLE_SUFFIX}`,
    brief: `Faisceau de fibres optiques en dormance, lié au centre, formant un cluster
sphérique irrégulier. Pointes captent la lumière top. 2-3 fibres pulsent teal sourd au
cœur. Aspect instrument scientifique ou système nerveux endormi.`,
  },
];

/* ─────────── OpenAI Images (gpt-image-1 / dall-e-3) ─────────── */

async function generateOpenAI(direction: Direction, outDir: string): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY manquant");

  const targetDir = join(outDir, direction.slug);
  await mkdir(targetDir, { recursive: true });

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt: direction.prompt,
      n: 1,
      size: "1024x1024",
      quality: "high",
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  const item = data.data?.[0];
  if (!item) throw new Error("OpenAI: pas de data dans la réponse");

  let buffer: Buffer;
  if (item.b64_json) {
    buffer = Buffer.from(item.b64_json, "base64");
  } else if (item.url) {
    const imgRes = await fetch(item.url);
    buffer = Buffer.from(await imgRes.arrayBuffer());
  } else {
    throw new Error("OpenAI: ni b64_json ni url dans la réponse");
  }

  await writeFile(join(targetDir, "preview.png"), buffer);
  await writeFile(
    join(targetDir, "brief.md"),
    `# ${direction.name}\n\n${direction.brief}\n\n---\n\n**Prompt envoyé :**\n\n${direction.prompt}\n`
  );

  console.log(`  ✓ ${direction.slug}`);
}

/* ─────────── Runway Images (text-to-image) ─────────── */

async function generateRunway(direction: Direction, outDir: string): Promise<void> {
  const apiKey = process.env.RUNWAY_API_KEY;
  if (!apiKey) throw new Error("RUNWAY_API_KEY manquant");

  const targetDir = join(outDir, direction.slug);
  await mkdir(targetDir, { recursive: true });

  // Runway text_to_image endpoint
  const submitRes = await fetch("https://api.dev.runwayml.com/v1/text_to_image", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Runway-Version": "2024-11-06",
    },
    body: JSON.stringify({
      promptText: direction.prompt,
      ratio: "1024:1024",
      model: "gen4_image",
    }),
  });

  if (!submitRes.ok) {
    const errText = await submitRes.text().catch(() => "");
    throw new Error(`Runway submit ${submitRes.status}: ${errText.slice(0, 300)}`);
  }

  const submitData = (await submitRes.json()) as { id?: string };
  const taskId = submitData.id;
  if (!taskId) throw new Error("Runway: pas de task id");

  // Poll
  let imageUrl: string | undefined;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const pollRes = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Runway-Version": "2024-11-06",
      },
    });
    const pollData = (await pollRes.json()) as {
      status?: string;
      output?: string[];
      failure?: string;
    };
    if (pollData.status === "SUCCEEDED" && pollData.output?.[0]) {
      imageUrl = pollData.output[0];
      break;
    }
    if (pollData.status === "FAILED") {
      throw new Error(`Runway task failed: ${pollData.failure ?? "unknown"}`);
    }
  }

  if (!imageUrl) throw new Error("Runway: timeout polling");

  const imgRes = await fetch(imageUrl);
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  await writeFile(join(targetDir, "preview.png"), buffer);
  await writeFile(
    join(targetDir, "brief.md"),
    `# ${direction.name}\n\n${direction.brief}\n\n---\n\n**Prompt envoyé :**\n\n${direction.prompt}\n`
  );

  console.log(`  ✓ ${direction.slug}`);
}

/* ─────────── INDEX writer ─────────── */

async function writeIndex(outDir: string, provider: string): Promise<void> {
  const lines = [
    `# Moodboard Noyau v3 — ${provider}`,
    "",
    "Direction : noyau central, réseau neuronal, électronique noble, silent luxury.",
    "",
  ];
  for (const [i, d] of DIRECTIONS.entries()) {
    lines.push(
      `${i + 1}. **[${d.name}](./${d.slug}/)** — ${d.brief.split(".")[0]}.`
    );
  }
  await writeFile(join(outDir, "INDEX.md"), lines.join("\n") + "\n");
}

/* ─────────── Main ─────────── */

async function main() {
  const provider = process.argv[2];
  if (provider !== "openai" && provider !== "runway") {
    console.error("Usage: tsx scripts/generate-core-moodboard.ts <openai|runway>");
    process.exit(1);
  }

  const outDir = `hearst-os-core-v3-${provider}`;
  await mkdir(outDir, { recursive: true });

  console.log(`Génération moodboard via ${provider} dans ${outDir}/`);

  const generator = provider === "openai" ? generateOpenAI : generateRunway;

  // En parallèle pour OpenAI (rate-limit OK), séquentiel pour Runway (polling lourd)
  if (provider === "openai") {
    await Promise.all(
      DIRECTIONS.map(async (d) => {
        try {
          await generator(d, outDir);
        } catch (e) {
          console.error(`  ✗ ${d.slug}: ${(e as Error).message}`);
        }
      })
    );
  } else {
    for (const d of DIRECTIONS) {
      try {
        await generator(d, outDir);
      } catch (e) {
        console.error(`  ✗ ${d.slug}: ${(e as Error).message}`);
      }
    }
  }

  await writeIndex(outDir, provider);
  console.log(`\nDone. Voir ${outDir}/INDEX.md`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
