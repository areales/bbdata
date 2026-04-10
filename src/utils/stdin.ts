/**
 * Read all data from stdin. Returns the full string.
 * Rejects if stdin is a TTY (no piped data).
 */
export function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (process.stdin.isTTY) {
      reject(new Error('--stdin flag requires piped input. Usage: echo \'{"data":[...]}\' | bbdata query ... --stdin'));
      return;
    }

    const chunks: Buffer[] = [];
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', reject);
  });
}
