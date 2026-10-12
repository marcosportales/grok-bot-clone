"use client"

import * as React from "react"

import { activeTurnMaxAgeMs, type ChatSummaryData } from "@/lib/chat"

type TurnActivityValue = {
  isWorking: (chatId: string) => boolean
  setTurnActive: (chatId: string, active: boolean) => void
  handoffTurn: (chatId: string) => void
}

/**
 * What the client knows about one chat's turn: what a thread last said, and
 * whether anything still stands behind it.
 *
 * `at` is when it was written, so a turn the server has since seen start can
 * overrule a note that an earlier one ended. `expiresAt` is null while a thread
 * is mounted and answers for itself, and an instant once nobody does.
 */
type TurnEntry = {
  active: boolean
  at: number
  expiresAt: number | null
}

/**
 * How long a dot may outlive the thread that published it, after the reader
 * walks out mid-turn. Shorter than the server's marker on purpose: the client
 * cannot see the turn end from outside the chat, and a dot left up for the
 * marker's whole life would be a stale claim about work that finished.
 */
const handoffTurnMaxAgeMs = 60_000

const TurnActivityContext = React.createContext<TurnActivityValue | null>(null)

/**
 * The sidebar's working dots, held next to the sidebar rather than in it. A
 * thread is the only thing that knows a turn is in flight, and it is mounted
 * under the layout rather than inside the sidebar, so the open chat publishes
 * its turn here and the rail reads it back.
 *
 * The server's `activeTurnAt` marker seeds the map, which is what lights the
 * dot for a turn the reader never watched start, and what keeps the dot lit
 * across a page load. A thread then overrules its own seed, because the marker
 * is written by the worker and read by a layout that a soft navigation can
 * leave behind.
 */
function TurnActivityProvider({
  chats,
  children,
}: {
  chats: ChatSummaryData[]
  children: React.ReactNode
}) {
  // Entries live in a ref, not in state: the writes come from a streaming turn,
  // and a dot that lags the turn by a render would be worse than one that beats
  // it. The version counter is what makes a write visible to the rail.
  const entriesRef = React.useRef(new Map<string, TurnEntry>())
  const [version, setVersion] = React.useState(0)

  const seeds = React.useMemo(() => {
    const map = new Map<string, number>()

    for (const chat of chats) {
      if (chat.turn !== null) {
        map.set(chat.id, chat.turn.startedAt)
      }
    }

    return map
  }, [chats])

  const isWorking = React.useCallback(
    (chatId: string) => {
      const now = Date.now()
      const entry = entriesRef.current.get(chatId)
      const seed = seeds.get(chatId)

      if (entry !== undefined && (seed === undefined || entry.at >= seed)) {
        // An expired entry still answers, because falling back would resurrect
        // the very marker it retired: without one the client cannot tell a turn
        // that ended from one that is still going.
        if (!entry.active) {
          return false
        }

        return entry.expiresAt === null || now < entry.expiresAt
      }

      return seed !== undefined && now - seed < activeTurnMaxAgeMs
    },
    [seeds]
  )

  const setTurnActive = React.useCallback((chatId: string, active: boolean) => {
    entriesRef.current.set(chatId, { active, at: Date.now(), expiresAt: null })
    setVersion((version) => version + 1)
  }, [])

  // A thread that unmounts mid-turn leaves a note behind that nobody answers
  // for any more. Its dot is bounded rather than unbounded or absent: the turn
  // may run for minutes more, and the dot still means what it says.
  const handoffTurn = React.useCallback((chatId: string) => {
    entriesRef.current.set(chatId, {
      active: true,
      at: Date.now(),
      expiresAt: Date.now() + handoffTurnMaxAgeMs,
    })
    setVersion((version) => version + 1)
  }, [])

  // A dot that only time will clear has to expire with the reader sitting
  // still, so this sleeps until the earliest instant one can, then renders to
  // retire it. Waking at the expiry and not before matters: asked at wake-up
  // whether anything is still lit, the answer is already no, and a dot nobody
  // re-renders keeps wearing the state it was painted with.
  React.useEffect(() => {
    const now = Date.now()
    const expiries: number[] = []

    for (const entry of entriesRef.current.values()) {
      if (entry.active && entry.expiresAt !== null) {
        expiries.push(entry.expiresAt)
      }
    }

    for (const seed of seeds.values()) {
      expiries.push(seed + activeTurnMaxAgeMs)
    }

    const next = expiries.filter((expiry) => expiry > now)

    if (next.length === 0) {
      return
    }

    // The fudge keeps the render on the far side of the instant it answers for,
    // where a millisecond of scheduler drift the other way would retire nothing
    // and never ask again.
    const timer = setTimeout(
      () => setVersion((current) => current + 1),
      Math.min(...next) - now + 50
    )

    return () => clearTimeout(timer)
  }, [seeds, version])

  // Built fresh every render on purpose. The callbacks are stable and the
  // entries live in a ref, so a memo on them would hand the consumers the same
  // value back and swallow every write; the new object is what tells the rail
  // that the answer to `isWorking` has moved.
  return (
    <TurnActivityContext.Provider
      value={{ isWorking, setTurnActive, handoffTurn }}
    >
      {children}
    </TurnActivityContext.Provider>
  )
}

function useTurnActivity(): TurnActivityValue {
  const context = React.useContext(TurnActivityContext)

  if (!context) {
    throw new Error(
      "useTurnActivity must be used within a TurnActivityProvider."
    )
  }

  return context
}

export { TurnActivityProvider, useTurnActivity }
