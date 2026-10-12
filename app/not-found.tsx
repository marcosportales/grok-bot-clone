import { NotFound } from "@/components/not-found"

// Reached by an unmatched URL anywhere in the app, so it renders at the root
// and takes the framework's 404 status with it. It sits outside the dashboard
// group, so no sidebar is around it: there is no reader here to list chats for.
export default function NotFoundPage() {
  return (
    <NotFound
      title="Page not found"
      description="This page does not exist. Check the address, or head back to your chats."
    />
  )
}
