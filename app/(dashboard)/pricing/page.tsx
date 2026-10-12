import { PricingTable } from "@clerk/nextjs"
import { auth } from "@clerk/nextjs/server"

export default async function Page() {
  await auth.protect()

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-medium">Plans</h1>
        <p className="text-sm text-muted-foreground">
          Bots and their computers are part of the Pro plan.
        </p>
      </div>
      <PricingTable newSubscriptionRedirectUrl="/" />
    </div>
  )
}
