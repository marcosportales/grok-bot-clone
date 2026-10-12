"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon, ShuffleIcon, Trash2Icon } from "lucide-react"
import { nanoid } from "nanoid"
import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react"
import { Controller, useForm, useWatch } from "react-hook-form"

import { createBot, deleteBot, updateBot } from "@/actions/bot"
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useRefusalToast } from "@/components/refusal-toast"
import type { EditableBot } from "@/lib/bot"
import { insertBotSchema, type InsertBot } from "@/lib/db/schema"

const jobPresets = [
  "Research assistant",
  "Code reviewer",
  "Writing editor",
  "Tutor",
]

function emptyBot(): InsertBot {
  return { name: "", avatar: nanoid(), job: "", instructions: "" }
}

function botAnswers(bot: EditableBot): InsertBot {
  return {
    name: bot.name,
    avatar: bot.avatar,
    job: bot.job,
    instructions: bot.instructions,
  }
}

type BotDialogProps = {
  /** The bot to edit. Omit it and the dialog creates a new bot instead. */
  bot?: EditableBot
  /** Controlled open state. Omit it and the dialog holds its own state. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onDeleted?: () => void
  children?: ReactNode
}

function BotDialog({
  bot,
  open: openProp,
  onOpenChange,
  onDeleted,
  children,
}: BotDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const open = openProp ?? uncontrolledOpen
  const [isPending, startTransition] = useTransition()
  const { showRefusal } = useRefusalToast()

  const isEdit = bot !== undefined
  const initialValues = useMemo(
    () => (bot ? botAnswers(bot) : emptyBot()),
    [bot]
  )

  const form = useForm<InsertBot>({
    resolver: zodResolver(insertBotSchema),
    defaultValues: initialValues,
  })

  // Reset on open, not on close. A caller that owns `open` flips it to true
  // itself, and base-ui only reports the changes it causes through
  // onOpenChange, so an open-time reset reads the prop instead: a dialog that
  // opens again then shows the bot as it stands, and not what a cancelled
  // attempt left behind.
  useEffect(() => {
    if (open) {
      form.reset(initialValues)
    }
  }, [open, form, initialValues])

  const job = useWatch({ control: form.control, name: "job" })

  const idPrefix = isEdit ? "edit-bot" : "new-bot"
  const formId = `${idPrefix}-form`

  function setOpen(nextOpen: boolean) {
    if (!nextOpen) {
      setConfirmOpen(false)
    }

    if (openProp === undefined) {
      setUncontrolledOpen(nextOpen)
    }

    onOpenChange?.(nextOpen)
  }

  function onSubmit(values: InsertBot) {
    startTransition(async () => {
      const result = bot
        ? await updateBot(bot.id, values)
        : await createBot(values)

      if (!result.ok) {
        if ("upgrade" in result) {
          showRefusal(result)
        } else {
          toast.add({
            title: isEdit ? "Could not save the bot" : "Could not create bot",
            description: result.error,
            type: "error",
          })
        }
        return
      }

      toast.add({
        title: isEdit
          ? `${result.bot.name} is updated`
          : `${result.bot.name} is ready`,
        description: isEdit
          ? "The new name and face are what you will see from now on."
          : "Give it something to work on whenever you like.",
        type: "success",
      })
      setOpen(false)
    })
  }

  function onDelete(botId: string) {
    startTransition(async () => {
      const result = await deleteBot(botId)

      if (!result.ok) {
        toast.add({
          title: "Could not delete the bot",
          description: result.error,
          type: "error",
        })
        return
      }

      toast.add({
        title: `${result.bot.name} is deleted`,
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
        {children && (
          <DialogTrigger render={<Button variant="secondary" size="lg" />}>
            <PlusIcon data-icon="inline-start" />
            {children}
          </DialogTrigger>
        )}
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit bot" : "New bot"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Change its face, its name, or what it does."
                : "Give it a face, a name, and a job to do."}
            </DialogDescription>
          </DialogHeader>
          <form id={formId} onSubmit={form.handleSubmit(onSubmit)}>
            <FieldGroup>
              <ToggleGroup
                aria-label="Job presets"
                variant="outline"
                size="sm"
                spacing={1}
                className="w-full flex-wrap justify-between"
                value={job ? [job] : []}
                onValueChange={(pressed) => {
                  form.setValue("job", pressed.at(-1) ?? "", {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }}
              >
                {jobPresets.map((preset) => (
                  <ToggleGroupItem key={preset} value={preset}>
                    {preset}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <Controller
                name="avatar"
                control={form.control}
                render={({ field }) => (
                  <Field orientation="horizontal" className="gap-4">
                    <ChatAvatar
                      seed={field.value ?? ""}
                      className="size-9 rounded-lg"
                    />
                    <FieldContent>
                      <FieldTitle>Face</FieldTitle>
                      <FieldDescription>
                        Shuffle until you find one you like.
                      </FieldDescription>
                    </FieldContent>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => field.onChange(nanoid())}
                    >
                      <ShuffleIcon data-icon="inline-start" />
                      Shuffle
                    </Button>
                  </Field>
                )}
              />
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
                      placeholder="Ada"
                      autoComplete="off"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
              <Controller
                name="job"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={`${idPrefix}-job`}>Job</FieldLabel>
                    <Input
                      {...field}
                      id={`${idPrefix}-job`}
                      aria-invalid={fieldState.invalid}
                      placeholder="Research assistant"
                      autoComplete="off"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
              <Controller
                name="instructions"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={`${idPrefix}-instructions`}>
                      How it should work
                    </FieldLabel>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      id={`${idPrefix}-instructions`}
                      aria-invalid={fieldState.invalid}
                      placeholder="Answer briefly, cite sources, and ask before running anything destructive."
                      className="min-h-24 resize-none"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </FieldGroup>
          </form>
          <DialogFooter>
            {bot && (
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
              {isEdit ? "Save changes" : "Create bot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* The confirmation is its own modal rather than a second one inside this
          dialog: base-ui gives a nested dialog no backdrop of its own, and the
          form behind it would then sit there undimmed while the question lands
          on top of it. */}
      {bot && (
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {bot.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                Its chat goes with it. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={isPending}
                onClick={() => onDelete(bot.id)}
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

export { BotDialog }
