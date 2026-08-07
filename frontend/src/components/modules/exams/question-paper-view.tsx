"use client";

import type { QuestionPaper } from "@/lib/api/exams";

const OPTION_LABELS = ["a", "b", "c", "d", "e", "f", "g", "h"];

/** The printed paper itself.
 *
 * Deliberately plain: serif body, black on white, no cards or shadows. The
 * `print-area` class is what `globals.css` keeps visible when printing, so
 * everything else on the page (sidebar, toolbar) drops away and this renders
 * alone on the sheet.
 */
export function QuestionPaperView({ paper }: { paper: QuestionPaper }) {
  return (
    <div className="print-area mx-auto w-full max-w-[820px] bg-white p-10 font-serif text-black">
      <header className="border-b-2 border-black pb-4 text-center">
        <h1 className="text-xl font-bold tracking-wide uppercase">{paper.exam_name}</h1>
        <p className="mt-1 text-sm">
          Academic Year {paper.academic_year_name}
          {paper.term ? ` · ${paper.term}` : ""}
        </p>
        <p className="mt-2 text-base font-semibold">
          Class {paper.class_name} — {paper.subject_name} ({paper.subject_code})
        </p>
        <div className="mt-3 flex justify-between text-sm">
          <span>Date: {new Date(paper.exam_date).toLocaleDateString()}</span>
          <span>Full Marks: {paper.full_marks}</span>
          <span>Pass Marks: {paper.pass_marks}</span>
        </div>
      </header>

      <p className="mt-4 text-center text-xs italic">
        Answer all questions. Marks for each question are shown in brackets.
      </p>

      <div className="mt-6 flex flex-col gap-7">
        {paper.sections.map((section, sectionIndex) => (
          <section key={`${section.name}-${sectionIndex}`} className="break-inside-avoid">
            {section.name && (
              <h2 className="mb-3 border-b border-black pb-1 text-center text-sm font-bold tracking-widest uppercase">
                {section.name}
                {section.full_marks !== null ? ` — ${section.full_marks} marks` : ""}
              </h2>
            )}

            <ol className="flex flex-col gap-4">
              {section.questions.map((question) => (
                <li key={question.number} className="flex gap-3 break-inside-avoid">
                  <span className="min-w-6 font-semibold">{question.number}.</span>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <p className="whitespace-pre-wrap">{question.question_text}</p>
                      <span className="shrink-0 font-semibold">[{question.marks}]</span>
                    </div>

                    {question.options && question.options.length > 0 && (
                      <ol className="mt-2 grid grid-cols-1 gap-x-8 gap-y-1 pl-2 sm:grid-cols-2">
                        {question.options.map((option, optionIndex) => (
                          <li key={optionIndex} className="flex gap-2">
                            <span>({OPTION_LABELS[optionIndex] ?? optionIndex + 1})</span>
                            <span>{option}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>

      <footer className="mt-10 border-t border-black pt-3 text-center text-xs">
        Total: {paper.total_questions} questions · {paper.total_marks} marks — End of paper
      </footer>
    </div>
  );
}
