import { Directory, File, Paths } from 'expo-file-system'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import type { PhotoFiles } from '../store/store'

/**
 * Bilder der Einträge. Jedes Bild liegt als kleines JPEG (512 × 512) im Ordner der App.
 * Ein neues Bild bekommt immer einen neuen Dateinamen, dann zeigt die Oberfläche sofort das neue.
 */
const dir = () => {
  const d = new Directory(Paths.document, 'photos')
  if (!d.exists) d.create({ idempotent: true, intermediates: true })
  return d
}

const newName = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.jpg`

export function photoUri(name: string | null | undefined): string | null {
  if (!name) return null
  try {
    return new File(dir(), name).uri
  } catch {
    return null
  }
}

/** Verkleinert ein Bild (Galerie, Kamera, Kontakt) und legt es ab. Gibt den Dateinamen zurück. */
export async function importPhoto(uri: string): Promise<string> {
  const context = ImageManipulator.manipulate(uri)
  context.resize({ width: 512, height: 512 })
  const image = await context.renderAsync()
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.82 })
  const target = new File(dir(), newName())
  new File(result.uri).copy(target)
  return target.name
}

export const photoFiles: PhotoFiles = {
  async read(name) {
    try {
      const f = new File(dir(), name)
      return f.exists ? await f.base64() : null
    } catch {
      return null
    }
  },
  async write(base64) {
    const f = new File(dir(), newName())
    f.create({ overwrite: true })
    await f.write(base64, { encoding: 'base64' })
    return f.name
  },
  async remove(name) {
    try {
      const f = new File(dir(), name)
      if (f.exists) f.delete()
    } catch {
      /* schon weg */
    }
  },
}

/** Löscht Bilder, die kein Eintrag mehr braucht. */
export function cleanupPhotos(inUse: Set<string>): void {
  try {
    for (const item of dir().list()) if (item instanceof File && !inUse.has(item.name)) item.delete()
  } catch {
    /* beim nächsten Start wieder */
  }
}
