"use client";

import { useState } from "react";
import { MessageCircle, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorState } from "@/components/shared/error-state";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useGuardianAssistantMutation } from "@/hooks/use-dashboard";
import type { GuardianConversationTurn } from "@/lib/api/dashboard";

interface ChatTurn extends GuardianConversationTurn {
  category: string;
}

/** Section 4.4 — Guardian Support Assistant, with Section 8 session-scoped conversation
 * memory. The conversation transcript lives only in this component's state — it is never
 * persisted, and is discarded the moment the page is left, per prompts.md §8. */
export function GuardianAssistantCard({ children }: { children: { student_id: string; full_name: string }[] }) {
  const [studentId, setStudentId] = useState(children[0]?.student_id ?? "");
  const [question, setQuestion] = useState("");
  const [transcript, setTranscript] = useState<ChatTurn[]>([]);
  const mutation = useGuardianAssistantMutation();

  async function handleAsk() {
    if (!question.trim() || !studentId) return;
    const asked = question.trim();
    setQuestion("");
    try {
      const result = await mutation.mutateAsync({
        student_id: studentId,
        question: asked,
        conversation: transcript.map(({ question: q, answer }) => ({ question: q, answer })),
      });
      setTranscript((prev) => [...prev, { question: asked, answer: result.answer, category: result.category }]);
    } catch {
      // Error surfaced via mutation.isError below; the question stays in `asked` history
      // only in local state, so the guardian can simply retry.
    }
  }

  if (children.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="size-4 text-primary" aria-hidden="true" />
          Ask about your child
        </CardTitle>
        <CardDescription>
          Answers only use your linked child&apos;s attendance, dues, and published results — nothing else.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {children.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <Label>Child</Label>
            <Select
              value={studentId}
              onValueChange={(value) => {
                setStudentId(value);
                setTranscript([]);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {children.map((child) => (
                  <SelectItem key={child.student_id} value={child.student_id}>
                    {child.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {transcript.length > 0 && (
          <div className="flex flex-col gap-3 rounded-md border border-border bg-muted/30 p-3">
            {transcript.map((turn, index) => (
              <div key={index} className="flex flex-col gap-1.5">
                <p className="text-sm font-medium text-foreground">You: {turn.question}</p>
                <p className="text-sm text-muted-foreground">{turn.answer}</p>
              </div>
            ))}
          </div>
        )}

        {mutation.isError && <ErrorState message={loginErrorMessage(mutation.error)} />}

        <div className="flex gap-2">
          <Input
            placeholder="e.g. Has my child been attending school regularly?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAsk();
              }
            }}
          />
          <Button size="sm" disabled={!question.trim() || mutation.isPending} onClick={handleAsk}>
            <Send className="size-4" aria-hidden="true" />
            {mutation.isPending ? "Asking..." : "Ask"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
