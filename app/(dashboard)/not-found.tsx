import { NotFound } from "@/components/not-found"

// The boundary for every `notFound()` raised inside the dashboard group, so a
// stale chat link renders here and keeps the sidebar and the reader's chats.
export default function DashboardNotFound() {
  return (
    <NotFound
      title="Chat not found"
      description="This chat does not exist, or it belongs to another account. A chat link stops working when the chat is deleted, or when you open it signed in as someone else."
    />
  )
}
