export type Profile = {
  id: string
  email: string
  display_name: string | null
  is_admin: boolean
  created_at: string
}

export type Test = {
  id: number
  title: string
  description: string
  shuffle_questions: boolean
  shuffle_answers: boolean
  is_published: boolean
  created_at: string
}

export type QuestionType = 'choice' | 'match'

export type Answer = {
  id: number
  question_id: number
  /** choice: text odpovědi; match: levá položka ('' = matoucí možnost navíc) */
  text: string
  /** match: správná možnost k levé položce */
  match_text: string | null
  is_correct: boolean
  position: number
}

export type Question = {
  id: number
  test_id: number
  type: QuestionType
  text: string
  explanation: string
  position: number
  answers: Answer[]
}

export type Attempt = {
  id: number
  test_id: number | null
  test_title: string
  user_id: string
  started_at: string | null
  finished_at: string
  correct_count: number
  total_count: number
  score_pct: number
  profiles?: { display_name: string | null; email: string } | null
}

export type SnapshotAnswer = { id: number; text: string; is_correct: boolean; match_text?: string | null }

export type AttemptAnswer = {
  id: number
  attempt_id: number
  question_id: number
  question_type: QuestionType
  question_text: string
  explanation: string
  answers: SnapshotAnswer[]
  selected_answer_ids: number[]
  /** match: { answer_id: vybraný text možnosti } */
  selected_matches: Record<string, string> | null
  is_correct: boolean
  position: number
}

export type MyTest = {
  id: number
  title: string
  description: string
  question_count: number
  best_pct: number | null
  attempts_count: number
  last_at: string | null
}

export type ImportQuestion = {
  type: QuestionType
  text: string
  explanation?: string
  /** choice */
  answers: { text: string; correct: boolean }[]
  /** match */
  pairs: { left: string; right: string }[]
  distractors: string[]
}
