// Gera os PNGs do PWA (192, 512 e apple-touch 180) sem dependências.
// Mesmo desenho de public/icon.svg (viewBox 64): fundo marinho, escudo azul, "F" branco.
// Uso: node scripts/gerar-icones.mjs
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const MARINHO = [10, 22, 48];
const AZUL = [31, 123, 255];
const BRANCO = [255, 255, 255];

// escudo aproximado por polígono (coordenadas do viewBox 64)
const escudo = [[14, 10], [50, 10], [50, 30]];
for (let t = 0; t <= 1; t += 0.05) escudo.push([50 - 18 * t, 30 + 22 * Math.sin((t * Math.PI) / 2)]);
for (let t = 1; t >= 0; t -= 0.05) escudo.push([14 + 18 * t, 30 + 22 * Math.sin((t * Math.PI) / 2)]);

function dentro([x, y], poli) {
  let d = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const [xi, yi] = poli[i], [xj, yj] = poli[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}

// distância de um ponto a um segmento (para os traços do "F", espessura 5, pontas redondas)
function distSeg([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
const tracos = [[[24, 21], [41, 21]], [[24, 21], [24, 40]], [[24, 30], [36, 30]]];

function cor(x, y, raio) {
  // cantos arredondados do fundo (rx 14) só quando raio > 0
  if (raio) {
    const cx = Math.min(Math.max(x, 14), 50), cy = Math.min(Math.max(y, 14), 50);
    if (Math.hypot(x - cx, y - cy) > 14) return null;
  }
  if (tracos.some(([a, b]) => distSeg([x, y], a, b) <= 2.5)) return BRANCO;
  if (dentro([x, y], escudo)) return AZUL;
  return MARINHO;
}

function png(tam, raio) {
  const amostras = 4; // antisserrilhado 4×4
  const linhas = Buffer.alloc((tam * 4 + 1) * tam);
  for (let py = 0; py < tam; py++) {
    linhas[py * (tam * 4 + 1)] = 0;
    for (let px = 0; px < tam; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < amostras; sy++)
        for (let sx = 0; sx < amostras; sx++) {
          const c = cor(((px + (sx + 0.5) / amostras) / tam) * 64, ((py + (sy + 0.5) / amostras) / tam) * 64, raio);
          if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
        }
      const o = py * (tam * 4 + 1) + 1 + px * 4;
      const n = amostras * amostras;
      linhas[o] = a ? r / a : 0;
      linhas[o + 1] = a ? g / a : 0;
      linhas[o + 2] = a ? b / a : 0;
      linhas[o + 3] = Math.round((a / n) * 255);
    }
  }
  const crcTab = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTab[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const bloco = (tipo, dados) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(dados.length);
    const corpo = Buffer.concat([Buffer.from(tipo), dados]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(corpo));
    return Buffer.concat([len, corpo, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(tam, 0); ihdr.writeUInt32BE(tam, 4);
  ihdr[8] = 8; ihdr[9] = 6; // RGBA 8 bits
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    bloco("IHDR", ihdr),
    bloco("IDAT", deflateSync(linhas)),
    bloco("IEND", Buffer.alloc(0)),
  ]);
}

// PWA: sem cantos (o sistema recorta; serve também como maskable). iOS também arredonda sozinho.
writeFileSync("public/icon-192.png", png(192, false));
writeFileSync("public/icon-512.png", png(512, false));
writeFileSync("public/apple-touch-icon.png", png(180, false));
console.log("Ícones gerados em public/");
