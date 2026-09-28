import type { QuizDoc, CreateQuestionInput } from "@/lib/db/types";

/**
 * Bridges an approved quiz into the Question Bank (spec 20.4 -> 20.5).
 * Pure function so the server action stays thin and the mapping is
 * unit-testable without a server. Honest provenance: questions copied from
 * an AI-generated quiz keep the quiz's provider stamp; a manual quiz keeps
 * source "manual".
 */
export function questionDraftsFromQuiz(
  quiz: QuizDoc,
  teacherId: string,
): CreateQuestionInput[] {
  return quiz.content.questions.map((question) => ({
    question: question.prompt,
    type: question.type,
    difficulty: question.difficulty,
    topic: quiz.topic,
    learningObjective: quiz.content.learningObjective,
    options: question.options,
    answer: question.answer,
    explanation: question.explanation,
    tags: [quiz.classLevel, ...quiz.topic.split(/\s+/)].filter(
      (tag, index, all) => all.indexOf(tag) === index,
    ),
    source: "ai" as const,
    provider: quiz.provider,
    createdBy: teacherId,
  }));
}
