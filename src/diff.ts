export type DiffOp = "same" | "add" | "del";

export interface DiffLine {
  op: DiffOp;
  text: string;
}

/**
 * Satır bazlı fark (en uzun ortak alt dizi). Şarkı metinleri kısa olduğu için O(n·m) yeterli.
 * `a` eski, `b` yeni metindir.
 */
export function diffLines(a: string, b: string): DiffLine[] {
  const x = a === "" ? [] : a.split("\n");
  const y = b === "" ? [] : b.split("\n");
  const n = x.length;
  const m = y.length;
  // lcs[i][j] = x[i..] ve y[j..] için ortak uzunluk
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = x[i] === y[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) {
      out.push({ op: "same", text: x[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ op: "del", text: x[i++] });
    } else {
      out.push({ op: "add", text: y[j++] });
    }
  }
  while (i < n) out.push({ op: "del", text: x[i++] });
  while (j < m) out.push({ op: "add", text: y[j++] });
  return out;
}

export function diffStats(lines: DiffLine[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const l of lines) {
    if (l.op === "add") added++;
    else if (l.op === "del") removed++;
  }
  return { added, removed };
}
