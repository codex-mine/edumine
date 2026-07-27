"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CheckboxUi } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { loginErrorMessage } from "@/hooks/use-auth";
import {
  useCommunicationSectionsQuery,
  useCreateAnnouncementMutation,
  useDraftAnnouncementMutation,
} from "@/hooks/use-communication";
import { AUDIENCE_TYPE_LABELS, type AudienceType } from "@/lib/api/communication";

const AUDIENCE_OPTIONS: AudienceType[] = ["all", "students", "teachers", "staff", "guardians", "specific_class"];
const SMS_CHAR_LIMIT = 160;

export function ComposeAnnouncementDialog({
  trigger,
  canDraftWithAI,
}: {
  trigger: React.ReactNode;
  canDraftWithAI: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audienceType, setAudienceType] = useState<AudienceType>("all");
  const [sectionId, setSectionId] = useState("");
  const [sendSms, setSendSms] = useState(false);
  const [smsMessage, setSmsMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [showAiHelper, setShowAiHelper] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiDetails, setAiDetails] = useState("");
  const [aiTone, setAiTone] = useState("informational");
  const [aiError, setAiError] = useState<string | null>(null);

  const sectionsQuery = useCommunicationSectionsQuery(audienceType === "specific_class");
  const createMutation = useCreateAnnouncementMutation();
  const draftMutation = useDraftAnnouncementMutation();

  function resetForm() {
    setTitle("");
    setBody("");
    setAudienceType("all");
    setSectionId("");
    setSendSms(false);
    setSmsMessage("");
    setShowAiHelper(false);
    setAiTopic("");
    setAiDetails("");
    setAiTone("informational");
    setAiError(null);
  }

  async function handleGenerateDraft() {
    setAiError(null);
    if (!aiTopic || !aiDetails) {
      setAiError("Enter a topic and key details first");
      return;
    }
    try {
      const draft = await draftMutation.mutateAsync({
        topic: aiTopic,
        audience_type: audienceType,
        details: aiDetails,
        tone: aiTone,
        char_limit: SMS_CHAR_LIMIT,
      });
      // AI output only ever pre-fills the editable fields below — the sender
      // must still review/edit and explicitly submit; nothing is sent here.
      setBody(draft.announcement_body);
      if (draft.sms_variant) {
        setSendSms(true);
        setSmsMessage(draft.sms_variant);
      }
    } catch (mutationError) {
      setAiError(loginErrorMessage(mutationError));
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (audienceType === "specific_class" && !sectionId) {
      setError("Select a class/section");
      return;
    }
    if (sendSms && !smsMessage) {
      setError("Enter the SMS message, or turn off SMS sending");
      return;
    }
    try {
      await createMutation.mutateAsync({
        title,
        body,
        audience_type: audienceType,
        section_id: audienceType === "specific_class" ? sectionId : undefined,
        send_sms: sendSms,
        sms_message: sendSms ? smsMessage : undefined,
      });
      setOpen(false);
      resetForm();
    } catch (mutationError) {
      setError(loginErrorMessage(mutationError));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New announcement</DialogTitle>
          <DialogDescription>Compose and send an announcement to a targeted audience.</DialogDescription>
        </DialogHeader>

        {canDraftWithAI && (
          <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-3">
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setShowAiHelper((v) => !v)}>
              <Sparkles className="size-4" aria-hidden="true" />
              {showAiHelper ? "Hide AI draft assist" : "Draft with AI"}
            </Button>
            {showAiHelper && (
              <div className="flex flex-col gap-2.5">
                <p className="text-xs text-muted-foreground">
                  Generates a reviewable draft below — nothing is sent until you submit.
                </p>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ai_topic">Topic</Label>
                  <Input
                    id="ai_topic"
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    placeholder="e.g. Annual sports day"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ai_details">Key details</Label>
                  <Textarea
                    id="ai_details"
                    value={aiDetails}
                    onChange={(e) => setAiDetails(e.target.value)}
                    placeholder="Date, time, location, action required..."
                    rows={2}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ai_tone">Tone</Label>
                  <Select value={aiTone} onValueChange={setAiTone}>
                    <SelectTrigger id="ai_tone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="informational">Informational</SelectItem>
                      <SelectItem value="formal">Formal</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {aiError && <p className="text-sm text-destructive">{aiError}</p>}
                <Button type="button" size="sm" className="w-fit" disabled={draftMutation.isPending} onClick={handleGenerateDraft}>
                  {draftMutation.isPending ? "Generating..." : "Generate draft"}
                </Button>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="announcement_title">Title</Label>
            <Input id="announcement_title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="announcement_audience">Audience</Label>
            <Select
              value={audienceType}
              onValueChange={(value) => {
                setAudienceType(value as AudienceType);
                setSectionId("");
              }}
            >
              <SelectTrigger id="announcement_audience">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUDIENCE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {AUDIENCE_TYPE_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {audienceType === "specific_class" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="announcement_section">Class/section</Label>
              <Select value={sectionId || undefined} onValueChange={setSectionId}>
                <SelectTrigger id="announcement_section">
                  <SelectValue placeholder="Select a section" />
                </SelectTrigger>
                <SelectContent>
                  {(sectionsQuery.data ?? []).map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="announcement_body">Message</Label>
            <Textarea id="announcement_body" value={body} onChange={(e) => setBody(e.target.value)} rows={5} required />
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <CheckboxUi checked={sendSms} onCheckedChange={(checked) => setSendSms(checked === true)} />
            Also send as SMS
          </label>

          {sendSms && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="announcement_sms">SMS message</Label>
              <Textarea
                id="announcement_sms"
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                rows={3}
                maxLength={480}
                required
              />
              <span className="text-xs text-muted-foreground">{smsMessage.length}/480 characters</span>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={createMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              Send announcement
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
