"use client"

import { useCallback, useState } from "react"

export function tapFeedback() {
  try {
    navigator.vibrate?.(12)
  } catch {
    // ignore
  }
}

export function usePress() {
  const [pressed, setPressed] = useState(false)

  const onPointerDown = useCallback(() => {
    setPressed(true)
    tapFeedback()
  }, [])
  const release = useCallback(() => setPressed(false), [])

  return {
    pressed,
    pressProps: {
      onPointerDown,
      onPointerUp: release,
      onPointerCancel: release,
      onPointerLeave: release,
      "data-pressed": pressed ? true : undefined,
    },
  }
}
