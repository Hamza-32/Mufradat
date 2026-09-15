/**
 * Generates pronunciation MP3s for every word, offline.
 *
 *   npm run audio            # only the words that have no file yet
 *   npm run audio -- --force # regenerate everything
 *
 * No TTS is called at runtime and no audio API is called at all — the files are
 * produced here, committed under public/audio, and served from our own origin
 * or from Cloudflare R2's free tier. That is what keeps the running cost at
 * zero and keeps a review session working with no network.
 *
 * Two engines, in order of preference:
 *
 *   piper      — a neural voice, genuinely listenable. Needs a model file.
 *                https://github.com/rhasspy/piper, Arabic voice `ar_JO-kareem`.
 *   espeak-ng  — a formant synthesiser. Always available, robotic, and its
 *                Arabic reads tashkeel correctly, which is what matters for a
 *                learner checking a vowel. Fine as a placeholder; not what
 *                should ship.
 *
 * Neither is a hard dependency of the app. If neither is installed the script
 * says so and exits without failing the build — every <audio> element already
 * has a missing-file fallback.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadContent } from '../src/content/load';

const OUT_DIR = join(process.cwd(), 'public', 'audio', 'words');
const PIPER_MODEL = process.env['PIPER_MODEL'] ?? '';
const force = process.argv.includes('--force');

function has(command: string): boolean {
  try {
    execFileSync('which', [command], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

type Engine = 'piper' | 'espeak';

function chooseEngine(): Engine | null {
  if (PIPER_MODEL && has('piper') && has('ffmpeg')) return 'piper';
  if (has('espeak-ng') && has('ffmpeg')) return 'espeak';
  return null;
}

/**
 * The word is spoken with its tashkeel intact. That is the whole point: a
 * learner is listening to check whether it is kitāb or kutub, and an
 * unvowelled string would let the synthesiser guess.
 */
function synthesise(engine: Engine, text: string, wavPath: string): void {
  if (engine === 'piper') {
    execFileSync('piper', ['--model', PIPER_MODEL, '--output_file', wavPath], {
      input: text,
      stdio: ['pipe', 'ignore', 'ignore'],
    });
    return;
  }
  execFileSync('espeak-ng', ['-v', 'ar', '-s', '130', '-w', wavPath, text], { stdio: 'ignore' });
}

function toMp3(wavPath: string, mp3Path: string): void {
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-i',
      wavPath,
      // Mono, 64k, 22.05kHz: a single word on a mid-range phone over patchy
      // data. Anything richer is bytes the learner pays for and cannot hear.
      '-ac',
      '1',
      '-ar',
      '22050',
      '-b:a',
      '64k',
      // Trim the silence the synthesisers leave at both ends.
      '-af',
      'silenceremove=start_periods=1:start_silence=0.05:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_silence=0.05:start_threshold=-50dB,areverse',
      mp3Path,
    ],
    { stdio: 'ignore' },
  );
}

async function main(): Promise<void> {
  const engine = chooseEngine();
  if (!engine) {
    console.log(
      [
        'No offline speech engine found, so no audio was generated.',
        '',
        'Install one of:',
        '  espeak-ng + ffmpeg            (apt install espeak-ng ffmpeg)',
        '  piper + ffmpeg + PIPER_MODEL  (a neural voice; much better)',
        '',
        'The app runs without audio: every word without a file shows a disabled',
        'play button labelled "no recording yet".',
      ].join('\n'),
    );
    return;
  }

  const { words } = await loadContent();
  mkdirSync(OUT_DIR, { recursive: true });

  let made = 0;
  let skipped = 0;

  for (const word of words) {
    const mp3Path = join(OUT_DIR, `${word.id}.mp3`);
    if (!force && existsSync(mp3Path)) {
      skipped += 1;
      continue;
    }
    const wavPath = join(OUT_DIR, `${word.id}.wav`);
    try {
      synthesise(engine, word.arabic, wavPath);
      toMp3(wavPath, mp3Path);
      made += 1;
    } catch (error) {
      console.warn(`! ${word.id}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      try {
        execFileSync('rm', ['-f', wavPath]);
      } catch {
        /* the wav is scratch; leaving one behind is not worth failing over */
      }
    }
  }

  console.log(`✓ ${made} file(s) generated with ${engine}, ${skipped} already present`);
  if (engine === 'espeak') {
    console.log('  note: espeak-ng is a placeholder voice. Use piper before launch.');
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
