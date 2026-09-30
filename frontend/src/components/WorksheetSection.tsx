import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'

interface MCQ {
  id: number
  question: string
  options: string[]
  correct_index: number
  explanation?: string
}

interface FillInTheBlank {
  id: number
  sentence: string
  answer: string
}

interface ShortQuestion {
  id: number
  question: string
  model_answer: string
}

interface VocabularyItem {
  term: string
  meaning: string
}

export interface WorksheetContent {
  title: string
  summary: string[]
  vocabulary?: VocabularyItem[]
  mcqs: MCQ[]
  fill_in_the_blanks: FillInTheBlank[]
  short_questions: ShortQuestion[]
}

export interface WorksheetData {
  id: number
  lecture_id: number
  target_language: string
  pdf_url: string
  content: WorksheetContent | null
  status: string
  created_at: string
}

interface WorksheetSectionProps {
  lectureId: number
  language: string
  languageName: string
}

export default function WorksheetSection({
  lectureId,
  language,
  languageName,
}: WorksheetSectionProps) {
  const queryClient = useQueryClient()
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({})
  const [revealedFibs, setRevealedFibs] = useState<Record<number, boolean>>({})
  const [revealedShortQs, setRevealedShortQs] = useState<Record<number, boolean>>({})

  // Fetch or check if worksheet exists
  const { data: worksheets, isLoading: listLoading } = useQuery<WorksheetData[]>({
    queryKey: ['lecture-worksheets', lectureId],
    queryFn: async () => {
      const response = await api.get<WorksheetData[]>(`/worksheets/lecture/${lectureId}`)
      return response.data
    },
  })

  // Match worksheet for currently selected language
  const currentWorksheetMeta = worksheets?.find((w) => w.target_language === language)

  // Fetch full worksheet content if matching worksheet exists
  const {
    data: worksheet,
    isLoading: detailLoading,
    refetch,
  } = useQuery<WorksheetData>({
    queryKey: ['worksheet-detail', currentWorksheetMeta?.id],
    queryFn: async () => {
      if (!currentWorksheetMeta?.id) throw new Error('No worksheet id')
      const response = await api.get<WorksheetData>(`/worksheets/${currentWorksheetMeta.id}`)
      return response.data
    },
    enabled: Boolean(currentWorksheetMeta?.id),
  })

  // Mutation to generate worksheet
  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<WorksheetData>(
        `/worksheets/generate/${lectureId}/${language}`
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lecture-worksheets', lectureId] })
      setSelectedAnswers({})
      setRevealedFibs({})
      setRevealedShortQs({})
      refetch()
    },
  })

  const isLoading = listLoading || detailLoading || generateMutation.isPending
  const content = worksheet?.content

  // Calculate score for MCQs
  const mcqs = content?.mcqs || []
  let correctCount = 0
  let answeredCount = 0
  mcqs.forEach((q) => {
    if (selectedAnswers[q.id] !== undefined) {
      answeredCount++
      if (selectedAnswers[q.id] === q.correct_index) {
        correctCount++
      }
    }
  })

  const handleSelectOption = (questionId: number, optionIdx: number) => {
    // Only allow selecting if not already answered
    if (selectedAnswers[questionId] !== undefined) return
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionIdx }))
  }

  const toggleFib = (id: number) => {
    setRevealedFibs((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const toggleShortQ = (id: number) => {
    setRevealedShortQs((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const resetQuiz = () => {
    setSelectedAnswers({})
    setRevealedFibs({})
    setRevealedShortQs({})
  }

  // If no worksheet has been generated for this language yet
  if (!currentWorksheetMeta && !isLoading) {
    return (
      <div className="card shadow-sm border border-gray-100 text-center py-12 px-6">
        <div className="text-5xl mb-4">📝</div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          Practice Worksheet in {languageName}
        </h3>
        <p className="text-sm text-gray-600 max-w-md mx-auto mb-6">
          Test your comprehension! Automatically generate an interactive quiz, vocabulary list,
          and a printable school worksheet for this lesson in <strong>{languageName}</strong>.
        </p>
        <button
          onClick={() => generateMutation.mutate()}
          className="btn btn-primary inline-flex items-center gap-2 shadow-md"
        >
          <span>✨</span>
          <span>Generate Worksheet for {languageName}</span>
        </button>
      </div>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="card shadow-sm border border-gray-100 text-center py-16">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-3 border-primary-600 border-t-transparent mb-4"></div>
        <h3 className="text-lg font-bold text-gray-900">
          Generating Worksheet in {languageName}...
        </h3>
        <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
          Extracting key concepts, framing questions, and creating your printable practice sheet.
        </p>
      </div>
    )
  }

  if (!content) {
    return (
      <div className="card shadow-sm border border-gray-100 text-center py-8">
        <p className="text-gray-600">Worksheet content is not available.</p>
        <button
          onClick={() => generateMutation.mutate()}
          className="btn btn-secondary mt-3 text-sm"
        >
          Regenerate Worksheet
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Action Controls */}
      <div className="card shadow-sm border border-gray-100 bg-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📝</span>
              <h2 className="text-xl font-bold text-gray-900">{content.title}</h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Language: <strong className="text-primary-700">{languageName}</strong> • Auto-generated educational assessment
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            {worksheet?.pdf_url && (
              <a
                href={worksheet.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary text-xs flex items-center gap-1.5 shadow-sm"
              >
                <span>🖨️</span>
                <span>Printable Document / PDF</span>
              </a>
            )}
            <button
              onClick={() => generateMutation.mutate()}
              title="Regenerate questions"
              className="btn btn-secondary text-xs flex items-center gap-1"
            >
              <span>🔄</span>
              <span>Regenerate</span>
            </button>
          </div>
        </div>

        {/* Score banner if student has started answering */}
        {mcqs.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase text-gray-500 tracking-wider">
                Quiz Progress:
              </span>
              <span className="text-sm font-bold text-gray-800">
                {answeredCount} of {mcqs.length} answered
              </span>
              {answeredCount > 0 && (
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                    correctCount === answeredCount
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-indigo-100 text-indigo-800'
                  }`}
                >
                  Score: {correctCount}/{answeredCount} (
                  {Math.round((correctCount / answeredCount) * 100)}%)
                </span>
              )}
            </div>

            {answeredCount > 0 && (
              <button
                onClick={resetQuiz}
                className="text-xs text-primary-600 hover:text-primary-800 font-medium underline"
              >
                Reset Answers
              </button>
            )}
          </div>
        )}
      </div>

      {/* Summary / Key Learnings */}
      {content.summary && content.summary.length > 0 && (
        <div className="card shadow-sm border border-indigo-50 bg-gradient-to-br from-indigo-50/40 via-white to-purple-50/30">
          <h3 className="text-base font-bold text-indigo-900 mb-3 flex items-center gap-2">
            <span>💡</span>
            <span>Key Learnings & Summary</span>
          </h3>
          <ul className="space-y-2">
            {content.summary.map((point, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-sm text-gray-700 leading-relaxed">
                <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 mt-2 shrink-0"></span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Important Vocabulary */}
      {content.vocabulary && content.vocabulary.length > 0 && (
        <div className="card shadow-sm border border-amber-50 bg-amber-50/20">
          <h3 className="text-base font-bold text-amber-900 mb-3 flex items-center gap-2">
            <span>📖</span>
            <span>Key Vocabulary</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {content.vocabulary.map((vocab, idx) => (
              <div
                key={idx}
                className="p-3 bg-white rounded-lg border border-amber-100/80 shadow-xs flex flex-col justify-center"
              >
                <span className="font-bold text-amber-800 text-sm">{vocab.term}</span>
                <span className="text-xs text-gray-600 mt-0.5">{vocab.meaning}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section A: Interactive Multiple Choice Questions */}
      {mcqs.length > 0 && (
        <div className="card shadow-sm border border-gray-100">
          <div className="mb-4 pb-2 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className="bg-primary-100 text-primary-700 text-xs font-bold px-2 py-1 rounded">
                Section A
              </span>
              <span>Multiple Choice Quiz</span>
            </h3>
            <span className="text-xs text-gray-500">Click an option to test your answer</span>
          </div>

          <div className="space-y-6">
            {mcqs.map((q) => {
              const selectedIdx = selectedAnswers[q.id]
              const isAnswered = selectedIdx !== undefined
              const isCorrect = selectedIdx === q.correct_index

              return (
                <div
                  key={q.id}
                  className={`p-4 rounded-xl border transition ${
                    isAnswered
                      ? isCorrect
                        ? 'border-emerald-200 bg-emerald-50/20'
                        : 'border-rose-200 bg-rose-50/20'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <p className="font-semibold text-gray-900 text-base mb-3">
                    <span className="text-primary-700 mr-1.5">Q{q.id}.</span>
                    {q.question}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {q.options.map((opt, optIdx) => {
                      const isOptionSelected = selectedIdx === optIdx
                      const isOptionCorrect = optIdx === q.correct_index
                      const letters = ['A', 'B', 'C', 'D']

                      let optionStyle =
                        'border-gray-200 bg-gray-50/50 hover:bg-gray-100/80 text-gray-800'
                      if (isAnswered) {
                        if (isOptionCorrect) {
                          optionStyle =
                            'border-emerald-500 bg-emerald-100/70 text-emerald-900 font-semibold ring-1 ring-emerald-500'
                        } else if (isOptionSelected) {
                          optionStyle =
                            'border-rose-500 bg-rose-100/70 text-rose-900 ring-1 ring-rose-500'
                        } else {
                          optionStyle = 'border-gray-100 bg-gray-50/40 text-gray-400 opacity-60'
                        }
                      }

                      return (
                        <button
                          key={optIdx}
                          disabled={isAnswered}
                          onClick={() => handleSelectOption(q.id, optIdx)}
                          className={`flex items-center gap-3 p-3 rounded-lg border text-left text-sm transition ${optionStyle}`}
                        >
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              isAnswered && isOptionCorrect
                                ? 'bg-emerald-600 text-white'
                                : isAnswered && isOptionSelected
                                ? 'bg-rose-600 text-white'
                                : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            {letters[optIdx] || optIdx + 1}
                          </span>
                          <span className="flex-1">{opt}</span>
                          {isAnswered && isOptionCorrect && <span>✅</span>}
                          {isAnswered && isOptionSelected && !isCorrect && <span>❌</span>}
                        </button>
                      )
                    })}
                  </div>

                  {/* Feedback Explanation */}
                  {isAnswered && (
                    <div
                      className={`mt-3 pt-3 border-t text-xs flex items-start gap-2 ${
                        isCorrect
                          ? 'border-emerald-100 text-emerald-800'
                          : 'border-rose-100 text-rose-800'
                      }`}
                    >
                      <span className="font-bold">{isCorrect ? '🎉 Correct!' : '❌ Incorrect.'}</span>
                      <span>{q.explanation || `Correct answer is option (${['A','B','C','D'][q.correct_index]}).`}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Section B: Fill in the Blanks */}
      {content.fill_in_the_blanks && content.fill_in_the_blanks.length > 0 && (
        <div className="card shadow-sm border border-gray-100">
          <div className="mb-4 pb-2 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className="bg-primary-100 text-primary-700 text-xs font-bold px-2 py-1 rounded">
                Section B
              </span>
              <span>Fill in the Blanks</span>
            </h3>
            <span className="text-xs text-gray-500">Think of the missing word, then reveal</span>
          </div>

          <div className="space-y-3">
            {content.fill_in_the_blanks.map((fib) => {
              const isRevealed = revealedFibs[fib.id]
              return (
                <div
                  key={fib.id}
                  className="p-3.5 bg-gray-50/60 rounded-xl border border-gray-200/70 flex flex-col md:flex-row md:items-center justify-between gap-3 text-sm"
                >
                  <p className="text-gray-800 font-medium">
                    <span className="text-primary-700 mr-2">{fib.id}.</span>
                    {fib.sentence}
                  </p>

                  <div className="flex items-center gap-2 shrink-0">
                    {isRevealed ? (
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg text-xs">
                        Answer: {fib.answer}
                      </span>
                    ) : null}
                    <button
                      onClick={() => toggleFib(fib.id)}
                      className="btn btn-secondary text-xs py-1 px-2.5"
                    >
                      {isRevealed ? 'Hide' : 'Reveal Answer'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Section C: Short Comprehension Questions */}
      {content.short_questions && content.short_questions.length > 0 && (
        <div className="card shadow-sm border border-gray-100">
          <div className="mb-4 pb-2 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className="bg-primary-100 text-primary-700 text-xs font-bold px-2 py-1 rounded">
                Section C
              </span>
              <span>Comprehension Questions</span>
            </h3>
            <span className="text-xs text-gray-500">Practice writing your own answers</span>
          </div>

          <div className="space-y-4">
            {content.short_questions.map((sq) => {
              const isRevealed = revealedShortQs[sq.id]
              return (
                <div key={sq.id} className="p-4 rounded-xl border border-gray-200 bg-white">
                  <p className="font-semibold text-gray-900 text-sm mb-2">
                    <span className="text-primary-700 mr-1.5">{sq.id}.</span>
                    {sq.question}
                  </p>

                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => toggleShortQ(sq.id)}
                      className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
                    >
                      <span>{isRevealed ? '▼ Hide Model Answer' : '▶ Check Model Answer'}</span>
                    </button>

                    {isRevealed && (
                      <div className="mt-2.5 p-3 bg-primary-50/40 rounded-lg text-xs text-gray-700 border border-primary-100">
                        <strong className="text-primary-900 block mb-1">Model Answer:</strong>
                        <p>{sq.model_answer}</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
