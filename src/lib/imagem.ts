// Reduz fotos no aparelho antes do envio: arquivo menor, upload rápido e dentro do limite do bucket (5 MB).
// Também remove os metadados da câmera (localização etc.), porque o canvas não os copia.

export const TAMANHO_MAX_ORIGINAL = 25 * 1024 * 1024;

export async function reduzirImagem(arquivo: File, ladoMax = 1600, qualidade = 0.85): Promise<Blob> {
  if (!arquivo.type.startsWith("image/")) throw new Error("Escolha um arquivo de imagem (JPG, PNG ou WEBP).");
  if (arquivo.size > TAMANHO_MAX_ORIGINAL) throw new Error("A imagem é grande demais (máx. 25 MB).");
  const bitmap = await createImageBitmap(arquivo).catch(() => {
    throw new Error("Não foi possível abrir esta imagem. Tente outra foto ou o formato JPG.");
  });
  const escala = Math.min(1, ladoMax / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((ok, falha) => canvas.toBlob((b) => (b ? ok(b) : falha(new Error("Falha ao processar a imagem."))), "image/jpeg", qualidade));
}
