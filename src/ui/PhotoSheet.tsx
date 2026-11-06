import * as Contacts from 'expo-contacts/legacy'
import * as ImagePicker from 'expo-image-picker'
import { useEffect, useState } from 'react'
import { Image } from 'react-native'
import type { Person } from '../domain/model'
import { normalize } from '../domain/normalize'
import { Card, Row } from './controls'
import { haptic } from './haptics'
import { useT } from './i18n'
import { importPhoto } from './photos'
import { Sheet } from './Sheet'
import { useSnackbar } from './Snackbar'
import { useBirthdayStore } from './useStore'

/**
 * Bild für einen Eintrag (Screen 3b): aus der Galerie, mit der Kamera oder aus dem Adressbuch.
 * Den runden Ausschnitt wählt man im Zuschneiden von Android, das die Bildauswahl mitbringt.
 */
export function PhotoSheet({ open, person, onClose }: { open: boolean; person: Person; onClose: () => void }) {
  const t = useT()
  const store = useBirthdayStore()
  const snack = useSnackbar()
  const [contactImage, setContactImage] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setContactImage(null)
    let alive = true
    ;(async () => {
      try {
        const perm = await Contacts.getPermissionsAsync()
        if (!perm.granted) return
        // Zuerst über die beim Import gemerkte Kennung, sonst über den Namen.
        if (person.contact?.id) {
          const byId = await Contacts.getContactByIdAsync(person.contact.id, [Contacts.Fields.Image]).catch(() => undefined)
          if (byId?.image?.uri) {
            if (alive) setContactImage(byId.image.uri)
            return
          }
        }
        const res = await Contacts.getContactsAsync({ name: person.name, fields: [Contacts.Fields.Image, Contacts.Fields.Name] })
        const match = res.data.find((x) => normalize(x.name ?? '') === normalize(person.name) && x.image?.uri) ?? res.data.find((x) => x.image?.uri)
        if (alive && match?.image?.uri) setContactImage(match.image.uri)
      } catch {
        /* ohne Kontaktbild */
      }
    })()
    return () => {
      alive = false
    }
  }, [open, person.name, person.contact?.id])

  const use = async (uri: string) => {
    try {
      const name = await importPhoto(uri)
      store.update(person.id, { photo: name })
      haptic('success')
      onClose()
    } catch {
      snack({ message: t.photoFailed })
    }
  }

  const pick = async (camera: boolean) => {
    try {
      if (camera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync()
        if (!perm.granted) {
          snack({ message: t.cameraDenied })
          return
        }
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9 }
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options)
      if (result.canceled || !result.assets?.[0]) return
      await use(result.assets[0].uri)
    } catch {
      snack({ message: t.photoFailed })
    }
  }

  const remove = () => {
    const old = person.photo
    store.update(person.id, { photo: null })
    onClose()
    snack({ message: t.photoRemoved, action: { label: t.undo, run: () => store.update(person.id, { photo: old }) } })
  }

  return (
    <Sheet open={open} title={t.photoFor(person.name.split(/\s+/)[0] ?? person.name)} onClose={onClose} left={{ label: t.cancel, onPress: onClose }} right={null}>
      <Card>
        <Row icon="photo-library" label={t.fromGallery} onPress={() => pick(false)} />
        <Row icon="photo-camera" label={t.takePhoto} onPress={() => pick(true)} last={!contactImage} />
        {contactImage && (
          <Row
            icon="contacts"
            label={t.fromContact}
            sub={t.fromContactSub(person.name.split(/\s+/)[0] ?? person.name)}
            right={<Image source={{ uri: contactImage }} style={{ width: 38, height: 38, borderRadius: 19 }} />}
            onPress={() => use(contactImage)}
            last
          />
        )}
      </Card>
      {person.photo && (
        <Card style={{ marginTop: 12 }}>
          <Row icon="delete-outline" label={t.removePhoto} danger last onPress={remove} />
        </Card>
      )}
    </Sheet>
  )
}
