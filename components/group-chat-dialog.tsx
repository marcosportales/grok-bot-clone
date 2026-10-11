"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useEffect, useTransition } from "react"
import { Controller, useForm } from "react-hook-form"

import { createGroupChat } from "@/actions/chat"
import { ChatAvatar } from "@/components/chat-avatar"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import type { BotOption } from "@/lib/bot"
import { insertGroupChatSchema, type InsertGroupChat } from "@/lib/db/schema"

// The dialog opens empty every time, and the object is built here so the reset
// below can restore it without the form keeping a reference to a live edit.
function emptyGroup(): InsertGroupChat {
  return { name: "", botIds: [] }
}

type GroupChatDialogProps = {
  /** The bots the caller can put in a group, in the order the picker lists. */
  bots: BotOption[]
  /** Controlled open state, since the sidebar opens this from a menu item. */
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * A group chat's two answers in a dialog: its name, and the bots in it. The
 * bots are a multi-select, so the count the schema demands is the count the
 * reader picks.
 *
 * The sidebar owns the open state, which keeps the sidebar a Server Component
 * and this dialog a client one.
 */
function GroupChatDialog({ bots, open, onOpenChange }: GroupChatDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const form = useForm<InsertGroupChat>({
    resolver: zodResolver(insertGroupChatSchema),
    defaultValues: emptyGroup(),
  })

  // Reset on open, not on close, for the same reason as the bot dialog: a
  // cancelled attempt should not be what the next open shows.
  useEffect(() => {
    if (open) {
      form.reset(emptyGroup())
    }
  }, [open, form])

  const formId = "new-group-chat-form"

  function onSubmit(values: InsertGroupChat) {
    startTransition(async () => {
      const result = await createGroupChat(values)

      if (!result.ok) {
        toast.add({
          title: "Could not create the group",
          description: result.error,
          type: "error",
        })
        return
      }

      toast.add({
        title: `${result.chat.name} is ready`,
        description: "Pick which bot answers and start the conversation.",
        type: "success",
      })
      onOpenChange(false)
      router.push(`/chats/${result.chat.id}`)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New group chat</DialogTitle>
          <DialogDescription>
            Name the group, then pick the bots that belong in it.
          </DialogDescription>
        </DialogHeader>
        <form id={formId} onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="new-group-chat-name">Name</FieldLabel>
                  <Input
                    {...field}
                    id="new-group-chat-name"
                    aria-invalid={fieldState.invalid}
                    placeholder="Research team"
                    autoComplete="off"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="botIds"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Bots</FieldLabel>
                  {/* A long bot list scrolls instead of pushing the footer off
                      the dialog. */}
                  <div className="flex max-h-64 flex-col overflow-y-auto">
                    {bots.map((bot) => {
                      const id = `group-chat-bot-${bot.id}`

                      return (
                        <Field
                          key={bot.id}
                          orientation="horizontal"
                          className="gap-3 rounded-lg px-1.5 py-1.5 has-data-checked:bg-accent/50"
                        >
                          <Checkbox
                            id={id}
                            checked={field.value.includes(bot.id)}
                            onCheckedChange={(checked) =>
                              field.onChange(
                                checked
                                  ? [...field.value, bot.id]
                                  : field.value.filter(
                                      (botId) => botId !== bot.id
                                    )
                              )
                            }
                          />
                          <FieldLabel
                            htmlFor={id}
                            className="gap-2 font-normal"
                          >
                            <ChatAvatar
                              seed={bot.avatar}
                              className="size-6 rounded-lg"
                            />
                            {bot.name}
                          </FieldLabel>
                        </Field>
                      )
                    })}
                  </div>
                  <FieldDescription>
                    Pick at least two. Any of them can answer.
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </FieldGroup>
        </form>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button type="submit" form={formId} disabled={isPending}>
            {isPending && <Spinner data-icon="inline-start" />}
            Create group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { GroupChatDialog }
