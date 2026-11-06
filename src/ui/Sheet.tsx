import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Animated, Dimensions, KeyboardAvoidingView, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SnackbarHost } from './Snackbar'
import { useT } from './i18n'
import { useColors, useFont } from './theme'
import { useKeyboardHeight } from './useKeyboard'

export interface SheetAction {
  label: string
  onPress: () => void
  disabled?: boolean
}

/**
 * Blatt von unten. Links optional "Abbrechen", rechts "Fertig" oder eine eigene Aktion
 * ("Sichern", "Hinzufügen"). Schließt auch über Tippen daneben, Herunterziehen am Griff und
 * die Zurück-Taste von Android. Übernommen aus My Notes und um die linke Aktion ergänzt.
 */
export function Sheet({
  open,
  title,
  onClose,
  onBack,
  left,
  right,
  scrollEnabled = true,
  fullHeight = false,
  children,
  footer,
}: {
  open: boolean
  title: string
  onClose: () => void
  onBack?: () => void
  left?: SheetAction
  /** Ohne Angabe: "Fertig", schließt das Blatt. null: keine Aktion rechts. */
  right?: SheetAction | null
  scrollEnabled?: boolean
  fullHeight?: boolean
  children: ReactNode
  /** Fester Bereich unter dem Inhalt (z. B. ein großer Knopf). */
  footer?: ReactNode
}) {
  const c = useColors()
  const t = useT()
  const f = useFont()
  const insets = useSafeAreaInsets()
  const keyboard = useKeyboardHeight()
  const [visible, setVisible] = useState(open)
  const height = Dimensions.get('window').height
  const y = useRef(new Animated.Value(height)).current
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (open) {
      setVisible(true)
      y.setValue(height)
      Animated.spring(y, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220, mass: 0.9 }).start()
    } else if (visible) {
      Animated.timing(y, { toValue: height, duration: 200, useNativeDriver: true }).start(({ finished }) => finished && setVisible(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 4,
      onPanResponderMove: (_e, g) => y.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 100 || g.vy > 1.2) onCloseRef.current()
        else Animated.spring(y, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }).start()
      },
    }),
  ).current

  if (!visible) return null
  const action = right === undefined ? { label: t.done, onPress: onClose } : right

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onBack ?? onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.backdrop }]} onPress={onClose} accessibilityLabel={t.close} />
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: c.bg, marginTop: insets.top + 24, flexShrink: 1, transform: [{ translateY: y }] },
            fullHeight && { flex: 1 },
          ]}
        >
          <View {...pan.panHandlers}>
            <View style={styles.grip}>
              <View style={[styles.gripBar, { backgroundColor: c.text3 }]} />
            </View>
            <View style={styles.head}>
              <View style={styles.side}>
                {left && (
                  <Pressable onPress={left.onPress} hitSlop={8} disabled={left.disabled} accessibilityRole="button">
                    <Text style={[styles.leftText, { color: c.text2, fontSize: f(16) }]} numberOfLines={1}>
                      {left.label}
                    </Text>
                  </Pressable>
                )}
              </View>
              <Text style={[styles.title, { color: c.text, fontSize: f(18) }]} numberOfLines={1} accessibilityRole="header">
                {title}
              </Text>
              <View style={[styles.side, styles.right]}>
                {action && (
                  <Pressable onPress={action.onPress} hitSlop={8} disabled={action.disabled} accessibilityRole="button" accessibilityState={{ disabled: !!action.disabled }}>
                    <Text style={[styles.rightText, { color: action.disabled ? c.text3 : c.accentText, fontSize: f(16) }]} numberOfLines={1}>
                      {action.label}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
          <ScrollView
            style={styles.scroll}
            scrollEnabled={scrollEnabled}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: footer ? 12 : 24 + (keyboard ? 0 : insets.bottom) }}
          >
            {children}
          </ScrollView>
          {footer && <View style={{ paddingHorizontal: 16, paddingBottom: 12 + (keyboard ? 0 : insets.bottom) }}>{footer}</View>}
        </Animated.View>
        <SnackbarHost bottom={keyboard ? 8 : insets.bottom + 16} />
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', elevation: 12 },
  scroll: { flexShrink: 1 },
  grip: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  gripBar: { width: 36, height: 4, borderRadius: 2, opacity: 0.6 },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 8, minHeight: 44 },
  side: { flex: 1, paddingHorizontal: 10 },
  right: { alignItems: 'flex-end' },
  title: { fontWeight: '700', flexShrink: 1, maxWidth: '56%', textAlign: 'center' },
  leftText: { fontWeight: '500', paddingVertical: 8 },
  rightText: { fontWeight: '700', paddingVertical: 8 },
})
