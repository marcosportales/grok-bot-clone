import Link from "next/link"

import { ChatAvatar } from "@/components/chat-avatar"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"

// The face is the app's own, drawn from a fixed seed rather than a fresh one.
// A missing page has nothing per-request to say, so a random seed would only
// make the route dynamic.
const seed = "not-found"

type NotFoundProps = {
  title: string
  description: string
}

/**
 * The shared frame the two 404 variants render: one face, one heading, one line
 * of copy explaining what is missing, and one way out. The variants differ in
 * copy only, so neither takes a face, a layout, or a second action.
 */
function NotFound({ title, description }: NotFoundProps) {
  return (
    <div className="flex flex-1 p-6">
      <Empty>
        <EmptyHeader>
          <ChatAvatar seed={seed} className="mb-2 size-10" />
          {/* `EmptyTitle` renders a `div`, and a page needs one heading, so the
              heading role goes on the component rather than an extra element. */}
          <EmptyTitle role="heading" aria-level={1}>
            {title}
          </EmptyTitle>
          {/* `EmptyDescription` renders a `div`, which has no accessible name,
              so the copy is repeated as its label. Without one the block is
              anonymous in the accessibility tree and a reader of the tree
              cannot see what the page says. */}
          <EmptyDescription aria-label={description}>
            {description}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="secondary" size="lg" render={<Link href="/" />}>
            Back to chats
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  )
}

export { NotFound }
