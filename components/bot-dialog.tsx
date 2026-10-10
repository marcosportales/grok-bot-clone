"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon, ShuffleIcon } from "lucide-react"
import { nanoid } from "nanoid"
import { type ReactNode, useState, useTransition } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"

import { createBot } from "@/actions/bot"
import { ChatAvatar } from "@/components/chat-avatar"
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
import { insertBotSchema, type InsertBot } from "@/lib/db/schema"

const formId = "create-bot-form"

const jobPresets = [
  "Research assistant",
  "Code reviewer",
  "Writing editor",
  "Tutor",
]

// The face is a DiceBear seed, so a fresh one is a face nobody has seen before.
function emptyBot(): InsertBot {
  return { name: "", avatar: nanoid(), job: "", instructions: "" }
}

type BotDialogProps = {
  /** Controlled open state. Omit it and the dialog holds its own state. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /**
   * The trigger button's label. Omit it and the dialog renders no trigger, for
   * a caller that opens the dialog itself: the sidebar opens it from a
   * dropdown item, which is not a DialogTrigger.
   */
  children?: ReactNode
}

function BotDialog({ open: openProp, onOpenChange, children }: BotDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = openProp ?? uncontrolledOpen
  const [isPending, startTransition] = useTransition()

  const form = useForm<InsertBot>({
    resolver: zodResolver(insertBotSchema),
    defaultValues: emptyBot(),
  })

  const job = useWatch({ control: form.control, name: "job" })

  function setOpen(nextOpen: boolean) {
    if (!nextOpen) {
      // Reset on close, not on open. A caller that owns `open` flips it to true
      // itself, and base-ui only reports the changes it causes through
      // onOpenChange, so an open-time reset would miss that open and show the
      // last visit's answers.
      form.reset(emptyBot())
    }

    if (openProp === undefined) {
      setUncontrolledOpen(nextOpen)
    }

    onOpenChange?.(nextOpen)
  }

  function onSubmit(values: InsertBot) {
    startTransition(async () => {
      const result = await createBot(values)

      if (!result.ok) {
        toast.add({
          title: "Could not create bot",
          description: result.error,
          type: "error",
        })
        return
      }

      toast.add({
        title: `${result.bot.name} is ready`,
        description: "Give it something to work on whenever you like.",
        type: "success",
      })
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && (
        <DialogTrigger render={<Button variant="secondary" size="lg" />}>
          <PlusIcon data-icon="inline-start" />
          {children}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New bot</DialogTitle>
          <DialogDescription>
            Give it a face, a name, and a job to do.
          </DialogDescription>
        </DialogHeader>
        <form id={formId} onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <ToggleGroup
              aria-label="Job presets"
              variant="outline"
              size="sm"
              // `justify-between` spreads the four presets across the full row
              // with a 4px minimum gap, and keeps them wrapping instead of
              // overflowing on a narrow screen.
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
                  <FieldLabel htmlFor="bot-name">Name</FieldLabel>
                  <Input
                    {...field}
                    id="bot-name"
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
                  <FieldLabel htmlFor="bot-job">Job</FieldLabel>
                  <Input
                    {...field}
                    id="bot-job"
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
                  <FieldLabel htmlFor="bot-instructions">
                    How it should work
                  </FieldLabel>
                  <Textarea
                    {...field}
                    value={field.value ?? ""}
                    id="bot-instructions"
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
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button type="submit" form={formId} disabled={isPending}>
            {isPending && <Spinner data-icon="inline-start" />}
            Create bot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { BotDialog }
