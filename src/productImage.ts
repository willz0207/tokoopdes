export const MAX_PRODUCT_IMAGE_SIZE = 2 * 1024 * 1024
const ALLOWED_PRODUCT_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

export function readProductImageFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    if (!ALLOWED_PRODUCT_IMAGE_TYPES.includes(file.type)) {
      reject(new Error('Format foto harus PNG, JPG, WebP, atau GIF.'))
      return
    }

    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.src = objectUrl

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      
      const maxWidth = 800
      let width = img.width
      let height = img.height

      if (width > maxWidth) {
        height = Math.round(height * (maxWidth / width))
        width = maxWidth
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Gagal menginisialisasi canvas untuk kompresi.'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)
      try {
        const compressedDataUrl = canvas.toDataURL('image/webp', 0.75)
        resolve(compressedDataUrl)
      } catch (err) {
        reject(new Error('Gagal melakukan kompresi gambar.'))
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Foto gagal dimuat untuk dikompresi.'))
    }
  })
}
