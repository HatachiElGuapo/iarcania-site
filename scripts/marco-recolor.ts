// Reaplica el diccionario de autocoloreado (lib/marco/color-dictionary.ts) a
// TODOS los documentos de Marco ya guardados. Idempotente. Uso manual, para
// cuando el diccionario crece y querés que agarre lo viejo.
//
//   node --env-file=.env.local --env-file-if-exists=.env.development.local \
//        --import tsx scripts/marco-recolor.ts          # solo muestra el diff
//   node ... scripts/marco-recolor.ts --apply           # escribe
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { marcoDocuments } from "@/lib/db/schema/marco";
import { applyDictionary, autocolorBlock } from "@/lib/marco/autocolor";

const APPLY = process.argv.includes("--apply");

async function main() {
  const docs = await db.select().from(marcoDocuments);
  let changed = 0;

  for (const d of docs) {
    const nextContent = autocolorBlock(d.content);
    const nextIntro = d.intro ? applyDictionary(d.intro) : d.intro;
    if (nextContent === d.content && nextIntro === d.intro) continue;

    changed++;
    console.log(`\n━━ ${d.slug} (${d.id})`);
    if (nextContent !== d.content) {
      d.content.split("\n").forEach((line, i) => {
        const next = nextContent.split("\n")[i];
        if (line !== next) console.log(`  L${i + 1}\n   - ${line}\n   + ${next}`);
      });
    }
    if (nextIntro !== d.intro) {
      console.log(`  intro\n   - ${d.intro}\n   + ${nextIntro}`);
    }

    if (APPLY) {
      await db
        .update(marcoDocuments)
        .set({ content: nextContent, intro: nextIntro ?? null, updatedAt: new Date() })
        .where(eq(marcoDocuments.id, d.id));
    }
  }

  console.log(
    `\n${changed} documento(s) ${APPLY ? "actualizados" : "cambiarían"}.` +
      (APPLY ? "" : " Corré con --apply para escribir."),
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
