/**
 * Copies text to the clipboard. Returns true if it worked.
 * The modern clipboard API only works on https (or localhost), so we
 * fall back to the old "select a hidden text box and copy" trick.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const box = document.createElement('textarea');
    box.value = text;
    box.style.position = 'fixed';
    box.style.opacity = '0';
    document.body.appendChild(box);
    box.select();
    const ok = document.execCommand('copy');
    box.remove();
    return ok;
  }
}
