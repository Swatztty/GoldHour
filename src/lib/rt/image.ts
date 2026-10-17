"use client";

/** Shrinks a screenshot before upload so it works on slow mobile connections. */
export async function compressImage(file: File, maxSide = 1700): Promise<{ name: string; mimeType: string; data: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error(`${file.name} isn’t an image that can be read.`));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { name: file.name, mimeType: "image/jpeg", data: canvas.toDataURL("image/jpeg", 0.88).split(",")[1] };
  } finally {
    URL.revokeObjectURL(url);
  }
}
