import { createContext, useContext, useSyncExternalStore } from 'react'
import type { BirthdayStore, Snapshot } from '../store/store'

export const StoreContext = createContext<BirthdayStore | null>(null)

export function useBirthdayStore(): BirthdayStore {
  const store = useContext(StoreContext)
  if (!store) throw new Error('BirthdayStore fehlt')
  return store
}

export function useSnapshot(): Snapshot {
  const store = useBirthdayStore()
  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}
