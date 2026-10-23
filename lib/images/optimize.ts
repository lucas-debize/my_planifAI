/**
 * Optimisation côté client d'une image pour l'OCR et l'IA :
 * - Redimensionne à max 1600px pour éviter la surcharge mémoire et accélérer l'OCR
 * - Convertit en JPEG avec fond blanc (évite les soucis de transparence PNG ou de format HEIC)
 * - Réduit une photo de smartphone de 10 Mo à ~250-400 Ko sans perte de lisibilité du texte
 */
export async function optimizeImageForOcr(file: File): Promise<File> {
  if (typeof window === "undefined" || !file.type.startsWith("image/")) {
    return file
  }

  const { promise, resolve } = Promise.withResolvers<File>()
  const img = new Image()
  const objectUrl = URL.createObjectURL(file)

  img.onload = () => {
    URL.revokeObjectURL(objectUrl)
    try {
      const maxDim = 1600
      let { width, height } = img

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width)
          width = maxDim
        } else {
          width = Math.round((width * maxDim) / height)
          height = maxDim
        }
      }

      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext("2d")
      if (!ctx) {
        resolve(file)
        return
      }

      // Fond blanc pour éviter la transparence noire
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file)
            return
          }
          const cleanName = file.name.replace(/\.[^/.]+$/, "") + ".jpg"
          const optimizedFile = new File([blob], cleanName, {
            type: "image/jpeg",
            lastModified: Date.now(),
          })
          resolve(optimizedFile)
        },
        "image/jpeg",
        0.85
      )
    } catch {
      resolve(file)
    }
  }

  img.onerror = () => {
    URL.revokeObjectURL(objectUrl)
    resolve(file)
  }

  img.src = objectUrl
  return promise
}
