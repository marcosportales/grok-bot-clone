"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Trash2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState, useTransition } from "react"
import { Controller, useForm } from "react-hook-form"

import {
  createGroupChat,
  deleteGroupChat,
  updateGroupChat,
} from "@/actions/chat"
import { ChatAvatar } from "@/components/chat-avatar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import {
  insertGroupChatSchema,
  type InsertGroupChat,
  type UpdateGroupChat,
} from "@/lib/db/schema"

function emptyGroup(): InsertGroupChat {
  return { name: "", botIds: [] }
}

function groupAnswers(chat: UpdateGroupChat): InsertGroupChat {
  return { name: chat.name, botIds: chat.botIds }
}

type GroupChatDialogProps = {
  bots: BotOption[]
  /** The group to edit. Omit it and the dialog creates a new group instead. */
  chat?: UpdateGroupChat
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}

function GroupChatDialog({
  bots,
  chat,
  open,
  onOpenChange,
  onDeleted,
}: GroupChatDialogProps) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const isEdit = chat !== undefined
  const initialValues = useMemo(
    () => (chat ? groupAnswers(chat) : emptyGroup()),
    [chat]
  )

  const form = useForm<InsertGroupChat>({
    resolver: zodResolver(insertGroupChatSchema),
    defaultValues: initialValues,
  })

  // base-ui reports only the changes it causes through onOpenChange, so a
  // programmatic open never fires it and the reset has to read the open prop.
  useEffect(() => {
    if (open) {
      form.reset(initialValues)
    }
  }, [open, form, initialValues])

  const idPrefix = isEdit ? "edit-group-chat" : "new-group-chat"
  const formId = `${idPrefix}-form`

  function setOpen(nextOpen: boolean) {
    if (!nextOpen) {
      setConfirmOpen(false)
    }

    onOpenChange(nextOpen)
  }

  function onSubmit(values: InsertGroupChat) {
    startTransition(async () => {
      const result = chat
        ? await updateGroupChat({ ...values, id: chat.id })
        : await createGroupChat(values)

      if (!result.ok) {
        toast.add({
          title: isEdit
            ? "Could not save the group"
            : "Could not create the group",
          description: result.error,
          type: "error",
        })
        return
      }

      toast.add({
        title: isEdit
          ? `${result.chat.name} is updated`
          : `${result.chat.name} is ready`,
        description: isEdit
          ? "The name and the members are what the group has from now on."
          : "Pick which bot answers and start the conversation.",
        type: "success",
      })
      setOpen(false)

      if (!isEdit) {
        router.push(`/chats/${result.chat.id}`)
      }
    })
  }

  function onDelete(chatId: string) {
    startTransition(async () => {
      const result = await deleteGroupChat(chatId)

      if (!result.ok) {
        toast.add({
          title: "Could not delete the group",
          description: result.error,
          type: "error",
        })
        return
      }

      toast.add({
        title: `${result.chat.name} is deleted`,
        description: "Its chat is gone from the sidebar.",
        type: "success",
      })
      setOpen(false)
      onDeleted?.()
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Edit group chat" : "New group chat"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Change its name, or which bots are in it."
                : "Name the group, then pick the bots that belong in it."}
            </DialogDescription>
          </DialogHeader>
          <form id={formId} onSubmit={form.handleSubmit(onSubmit)}>
            <FieldGroup>
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={`${idPrefix}-name`}>Name</FieldLabel>
                    <Input
                      {...field}
                      id={`${idPrefix}-name`}
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
                    <div className="flex max-h-64 flex-col overflow-y-auto">
                      {bots.map((bot) => {
                        const id = `${idPrefix}-bot-${bot.id}`

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
            {chat && (
              <Button
                type="button"
                variant="destructive"
                className="sm:mr-auto"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2Icon data-icon="inline-start" />
                Delete
              </Button>
            )}
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" form={formId} disabled={isPending}>
              {isPending && <Spinner data-icon="inline-start" />}
              {isEdit ? "Save changes" : "Create group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* A nested dialog gets no backdrop of its own, so the confirmation is
          its own modal rather than a second one inside this dialog. */}
      {chat && (
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {chat.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                Its chat goes with it. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={isPending}
                onClick={() => onDelete(chat.id)}
              >
                {isPending && <Spinner data-icon="inline-start" />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
}

export { GroupChatDialog }
