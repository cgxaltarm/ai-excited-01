// ai-excited-01 — entry program.
//
// What this program does, in one sentence: it takes the single winning
// image bundled with this repository (entry.png) and writes it, byte for
// byte, to /output/entry.png, where the make.fun judge reads it.
//
// The image itself is the entry: a giant humpback whale breaching out of a
// small porcelain teacup (the saucer reads "ENGLAND") on a rustic wooden
// table, water exploding around it, dramatic window light, photorealistic.
// A jury approved this exact image 3/3, so the program does NOT generate,
// edit, or re-encode anything — it only copies the approved bytes.
//
// Determinism matters here: the program is run twice by the grader and the
// two outputs must be byte-identical. A plain copy is deterministic by
// construction, and this program verifies that property itself before it
// exits, so a bad run fails loudly instead of silently submitting a
// corrupted or truncated file.

import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  access,
  mkdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// The bundled image lives next to this source file inside the repository.
// We resolve it from import.meta.url, never from process.cwd(), because the
// grader may launch the program from any working directory and the copy
// must still find its input.
const REPO_DIR = dirname(fileURLToPath(import.meta.url));
const INPUT_NAME = "entry.png";
const INPUT_PATH = join(REPO_DIR, INPUT_NAME);

// The grader reads exactly this path. It is the only output of the entry.
const OUTPUT_DIR = "/output";
const OUTPUT_PATH = join(OUTPUT_DIR, INPUT_NAME);

// Competition limits for the image (from the bounty spec): at most 1 MiB
// and at most 1024 x 1024 pixels. Our bundled file is a 1024 x 1024 JPEG
// of 907,026 bytes, comfortably inside both limits. The byte cap is checked
// below; the pixel size is a property of the approved file itself and is
// re-checked implicitly by the sha256 comparison at the end.
const MAX_IMAGE_BYTES = 1_048_576;

// JPEG files start with the three-byte Start Of Image marker FF D8 FF.
// Checking it catches the most common failure mode (an empty file, an HTML
// error page, or a truncated download being submitted as an image) before
// any bytes are written to the output path.
const JPEG_SOI = Buffer.from([0xff, 0xd8, 0xff]);

// JPEG files end with the two-byte End Of Image marker FF D9. Checking it
// catches a file that was truncated at the tail (for example by a disk-full
// write that still produced the right number of bytes in the middle).
const JPEG_EOI = Buffer.from([0xff, 0xd9]);

// The expected fingerprint of the jury-approved image. The program refuses
// to finish unless the bytes it just wrote hash to exactly this value, so
// the output is provably the approved image and nothing else.
const EXPECTED_SHA256 =
  "808a97a75b1d83733d45036b9df71e3d673492b16ac0d7a16fccc93590af137e";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

// sha256 of a buffer, as a lowercase hex string.
function sha256Hex(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

// Fail with a clear message and a non-zero exit code. Every validation in
// this program goes through here so a bad input can never produce a silent
// "success" with a wrong output file.
function fail(message: string): never {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Validation of the bundled input
// ---------------------------------------------------------------------------

async function loadInput(): Promise<Buffer> {
  // 1. The file must exist and be readable.
  try {
    await access(INPUT_PATH, fsConstants.R_OK);
  } catch {
    fail(`bundled image not found or not readable: ${INPUT_PATH}`);
  }

  // 2. It must be a regular file with a sane size: non-empty and within
  //    the competition's 1 MiB cap.
  let size: number;
  try {
    size = (await stat(INPUT_PATH)).size;
  } catch {
    fail(`cannot stat bundled image: ${INPUT_PATH}`);
  }
  if (size === 0) {
    fail(`bundled image is empty: ${INPUT_PATH}`);
  }
  if (size > MAX_IMAGE_BYTES) {
    fail(
      `bundled image is ${size} bytes, over the ${MAX_IMAGE_BYTES} byte limit`,
    );
  }

  // 3. Read it fully, then guard against a short read: the number of bytes
  //    actually returned must equal the size we just stat'ed. A short read
  //    would mean we are about to write a truncated image.
  const data = await readFile(INPUT_PATH);
  if (data.length !== size) {
    fail(
      `short read on bundled image: stat said ${size} bytes, ` +
        `read returned ${data.length} bytes`,
    );
  }

  // 4. The content must start with the JPEG magic bytes.
  if (!data.subarray(0, JPEG_SOI.length).equals(JPEG_SOI)) {
    fail(
      `bundled image does not start with JPEG magic bytes ` +
        `(expected ff d8 ff): ${INPUT_PATH}`,
    );
  }

  // 4b. The content must end with the JPEG End Of Image marker, so a
  //     tail-truncated file is rejected even if its head looks valid.
  if (!data.subarray(-JPEG_EOI.length).equals(JPEG_EOI)) {
    fail(
      `bundled image does not end with JPEG End Of Image marker ` +
        `(expected ff d9): ${INPUT_PATH}`,
    );
  }

  // 5. The bundled bytes must be exactly the jury-approved image.
  if (sha256Hex(data) !== EXPECTED_SHA256) {
    fail(
      `bundled image sha256 mismatch: expected ${EXPECTED_SHA256}, ` +
        `got ${sha256Hex(data)}`,
    );
  }

  return data;
}

// ---------------------------------------------------------------------------
// Writing and re-verifying the output
// ---------------------------------------------------------------------------

async function writeOutput(data: Buffer): Promise<void> {
  // The output directory may not exist on a fresh grading machine.
  await mkdir(OUTPUT_DIR, { recursive: true });

  // Write the approved bytes verbatim — no re-encoding, no resize.
  await writeFile(OUTPUT_PATH, data);
}

async function verifyOutput(expected: Buffer): Promise<void> {
  // Read the file back from disk and compare it with the bytes we intended
  // to write. This catches a partial write, a disk error, or any other
  // failure between the write call and the grader reading the file.
  let written: Buffer;
  try {
    written = await readFile(OUTPUT_PATH);
  } catch {
    fail(`cannot read back output file: ${OUTPUT_PATH}`);
  }

  if (!written.equals(expected)) {
    fail(
      `output mismatch: ${OUTPUT_PATH} differs from the bundled image ` +
        `(${written.length} bytes written, ${expected.length} expected)`,
    );
  }

  // Explicit size check, then the End Of Image marker, so a truncated
  // output is caught even if the byte comparison above were ever skipped.
  if (written.length !== expected.length) {
    fail(
      `output size mismatch: ${written.length} bytes, ` +
        `expected ${expected.length}`,
    );
  }
  if (!written.subarray(-JPEG_EOI.length).equals(JPEG_EOI)) {
    fail(`output does not end with JPEG End Of Image marker (ff d9)`);
  }

  // Final fingerprint check: the output on disk must hash to the approved
  // value, which also proves the output equals the bundled input.
  const digest = sha256Hex(written);
  if (digest !== EXPECTED_SHA256) {
    fail(`output sha256 mismatch: expected ${EXPECTED_SHA256}, got ${digest}`);
  }

  console.log(`output verified: ${OUTPUT_PATH}`);
  console.log(`  size: ${written.length} bytes`);
  console.log(`  sha256: ${digest}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`loading bundled image: ${INPUT_PATH}`);
  const image = await loadInput();
  console.log(`  size: ${image.length} bytes`);
  console.log(`  sha256: ${sha256Hex(image)}`);

  console.log(`writing output: ${OUTPUT_PATH}`);
  await writeOutput(image);

  await verifyOutput(image);

  console.log("done: /output/entry.png is the approved winning image.");
}

main().catch((error: unknown) => {
  // Any unexpected failure (permission error, disk error, ...) is reported
  // and exits non-zero instead of being swallowed.
  const detail = error instanceof Error ? error.message : String(error);
  fail(`unexpected failure: ${detail}`);
});
