// ai-excited-01 — entry program.
//
// What this program does:
//   It writes exactly ONE image to /output/entry.png. The image is the
//   jury-approved winner for the ai-excited-01 bounty: a giant humpback
//   whale breaching out of a small porcelain teacup (the saucer says
//   "ENGLAND") on a rustic wooden table, water exploding around it,
//   dramatic window light, photorealistic.
//
// How it works:
//   The image is bundled in this repository as entry.png, next to this
//   file. This program reads that bundled file and copies its bytes,
//   unchanged, to /output/entry.png. No pixels are generated, modified,
//   or re-encoded here — the output is a byte-for-byte copy of the
//   bundled image, so running the program twice always produces the
//   exact same file.
//
// Why copy instead of generating:
//   The competition runs the entry program twice and requires the two
//   outputs to be byte-identical. A straight copy is deterministic by
//   construction: the same input bytes always produce the same output
//   bytes, with no randomness, no timestamps, and no network involved.
//
// Usage:
//   npm start        (runs `tsx main.ts`)
//   or: npx tsx main.ts
//
// Exit codes:
//   0 — the output file was written and verified.
//   1 — something went wrong (missing input, bad image, write failure,
//       or the verification step found a mismatch). The error is printed
//       to stderr so the failure is visible in the run log.

import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// The bundled image lives next to this script. Resolving it from
// import.meta.url (instead of the working directory) means the program
// works no matter which directory it is launched from.
const BUNDLED_IMAGE = fileURLToPath(new URL("./entry.png", import.meta.url));

// The competition reads the entry from this exact path.
const OUTPUT_PATH = "/output/entry.png";

// Limits from the competition rules: the image must be at most 1 MiB and
// at most 1024 x 1024 pixels. Our bundled image is a 1024 x 1024 JPEG of
// 907,026 bytes, comfortably inside both limits. The byte-size check below
// guards the 1 MiB rule; the dimensions are fixed by the bundled file.
const MAX_IMAGE_BYTES = 1 * 1024 * 1024;

// A JPEG file always starts with these three bytes (SOI marker + JFIF
// marker start). Checking them catches a truncated or corrupted bundle
// before we copy garbage to the output path.
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// sha256 of a buffer, as a lowercase hex string. Used to prove the output
// is a byte-for-byte copy of the input: equal hashes mean equal bytes.
function sha256Hex(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

// Fail with a clear message on stderr and a non-zero exit code. Every
// error path in this program goes through here so failures are loud and
// diagnosable instead of silently producing a bad or missing output.
function fail(message: string): never {
  console.error(`ai-excited-01: error: ${message}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // 1. Make sure the bundled image exists and is a regular file.
  let inputStat;
  try {
    inputStat = await stat(BUNDLED_IMAGE);
  } catch {
    fail(`bundled image not found at ${BUNDLED_IMAGE}`);
  }
  if (!inputStat.isFile()) {
    fail(`bundled image at ${BUNDLED_IMAGE} is not a regular file`);
  }

  // 2. Read the bundled image into memory.
  const image = await readFile(BUNDLED_IMAGE);

  // 2b. Short-read guard: the bytes we got must match the size the
  //     filesystem reported in step 1. A mismatch means the read was
  //     cut short and the buffer is incomplete.
  if (image.length !== inputStat.size) {
    fail(
      `short read: expected ${inputStat.size} bytes from the bundled ` +
        `image, got ${image.length}`,
    );
  }

  // 3. Validate the bytes before writing anything.
  //    a. Non-empty — an empty file would be a broken entry.
  if (image.length === 0) {
    fail("bundled image is empty (0 bytes)");
  }
  //    b. Within the 1 MiB size limit.
  if (image.length > MAX_IMAGE_BYTES) {
    fail(
      `bundled image is ${image.length} bytes, over the ` +
        `${MAX_IMAGE_BYTES} byte limit`,
    );
  }
  //    c. Starts with the JPEG magic bytes, so we know it is a real JPEG
  //       and not a truncated or misnamed file.
  if (!image.subarray(0, JPEG_MAGIC.length).equals(JPEG_MAGIC)) {
    fail("bundled image does not start with JPEG magic bytes (FF D8 FF)");
  }

  const inputHash = sha256Hex(image);
  console.log(`ai-excited-01: read ${image.length} bytes from entry.png`);
  console.log(`ai-excited-01: input sha256: ${inputHash}`);

  // 4. Make sure the output directory exists, then write the file.
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, image);
  console.log(`ai-excited-01: wrote ${image.length} bytes to ${OUTPUT_PATH}`);

  // 5. Verify: read the output back and compare it with the input.
  //    If the bytes differ, the entry is corrupt and we must fail loudly
  //    rather than let a bad file be judged.
  const written = await readFile(OUTPUT_PATH);
  // The output must also start with the JPEG magic bytes — if the disk
  // write were corrupted, the header is the first place it would show.
  if (!written.subarray(0, JPEG_MAGIC.length).equals(JPEG_MAGIC)) {
    fail("verification failed: output does not start with JPEG magic bytes");
  }
  // And its size must match the input size exactly.
  if (written.length !== image.length) {
    fail(
      `verification failed: output is ${written.length} bytes, ` +
        `expected ${image.length}`,
    );
  }
  if (!written.equals(image)) {
    fail("verification failed: output bytes differ from input bytes");
  }
  const outputHash = sha256Hex(written);
  if (outputHash !== inputHash) {
    fail(
      `verification failed: output sha256 ${outputHash} ` +
        `!= input sha256 ${inputHash}`,
    );
  }

  console.log(`ai-excited-01: verified output sha256: ${outputHash}`);
  console.log("ai-excited-01: done — entry written and verified.");
}

main().catch((error: unknown) => {
  // Any unexpected exception (permissions, disk full, ...) lands here.
  const detail = error instanceof Error ? error.message : String(error);
  fail(`unexpected failure: ${detail}`);
});
