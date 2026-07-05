export const MAX_PRODUCT_IMAGE_SIZE = 2 * 1024 * 1024
const ALLOWED_PRODUCT_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

export function readProductImageFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    if (!ALLOWED_PRODUCT_IMAGE_TYPES.includes(file.type)) {
      reject(new Error('Format foto harus PNG, JPG, WebP, atau GIF.'))
      return
    }

    if (file.size > MAX_PRODUCT_IMAGE_SIZE) {
      reject(new Error('Ukuran foto maksimal 2 MB.'))
      return
    }

    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Foto gagal dibaca. Coba pilih file lain.'))
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Foto gagal dibaca. Coba pilih file lain.'))
    }
    reader.readAsDataURL(file)
  })
}
