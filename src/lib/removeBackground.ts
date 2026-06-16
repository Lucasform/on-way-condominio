/**
 * Removes white/near-white background from a signature image using canvas pixel manipulation.
 * Works well for black ink on white paper — no external dependencies, runs in the browser.
 */
export async function removeWhiteBackground(
  file: File,
  options: { threshold?: number; softEdge?: boolean } = {},
): Promise<{ file: File; previewUrl: string }> {
  const { threshold = 230, softEdge = true } = options

  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height

  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    // Luminance of pixel
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b

    if (softEdge) {
      // Smooth alpha: fully transparent above threshold, gradual below
      if (luminance >= threshold) {
        data[i + 3] = 0
      } else if (luminance >= threshold - 30) {
        // Transition zone: fade out near-white pixels
        data[i + 3] = Math.round(((threshold - luminance) / 30) * 255)
      }
      // Below transition zone: keep pixel fully opaque (already 255)
    } else {
      if (luminance >= threshold) {
        data[i + 3] = 0
      }
    }
  }

  ctx.putImageData(imageData, 0, 0)

  const previewUrl = canvas.toDataURL('image/png')

  const resultFile = await new Promise<File>((resolve) => {
    canvas.toBlob(
      (blob) => {
        const f = new File([blob!], file.name.replace(/\.\w+$/, '.png'), { type: 'image/png' })
        resolve(f)
      },
      'image/png',
    )
  })

  return { file: resultFile, previewUrl }
}
